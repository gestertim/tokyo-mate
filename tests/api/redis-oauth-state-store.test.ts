// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createRedisOAuthStateStore, REDIS_OAUTH_STATE_LUA } from '../../api/_lib/redis-oauth-state-store';
import { SharedStoreUnavailableError } from '../../api/_lib/shared-store';
import { luaAvailable, runLuaRedis, type LuaInvocation } from '../support/lua-redis-harness';

const now = '2026-10-07T01:00:00.000Z';
const record = {
  state: 's'.repeat(43), nonce: 'n'.repeat(43), verifier: 'v'.repeat(43),
  expiresAt: '2026-10-07T01:00:01.000Z',
};

describe.skipIf(!luaAvailable)('OAuth state 業務 Lua（Redis/cjson 替身，非真實 Redis 證據）', () => {
  const keys = ['{FIXTURE_005}:oauth-states', '{FIXTURE_005}:oauth-state-expiry'];
  const call = (operation: string, at = now): LuaInvocation => ({
    script: REDIS_OAUTH_STATE_LUA, keys,
    command: operation === 'create' ? { operation, record } : { operation, state: record.state }, now: at,
  });
  it('同一 authority 只消耗一次，後續 callback 不取得 verifier', () => {
    expect(runLuaRedis([call('create'), call('consume'), call('consume')]))
      .toEqual([{ status: 'created' }, record, null]);
  });
  it('到期前一毫秒有效，等值到期消耗後回 null，不重新放行', () => {
    expect(runLuaRedis([call('create'), call('consume', '2026-10-07T01:00:00.999Z')])[1]).toEqual(record);
    expect(runLuaRedis([call('create'), call('consume', record.expiresAt), call('consume')]))
      .toEqual([{ status: 'created' }, null, null]);
  });
  it('拒絕碰撞，不覆寫原始 state／nonce／PKCE', () => {
    expect(runLuaRedis([call('create'), call('create'), call('consume')]))
      .toEqual([{ status: 'created' }, { fixtureError: expect.stringContaining('OAUTH_STATE_COLLISION') }, record]);
  });
  it('拒絕建立已到期 state', () => {
    expect(runLuaRedis([call('create', record.expiresAt), call('consume')]))
      .toEqual([{ fixtureError: expect.stringContaining('EXPIRED_OAUTH_STATE') }, null]);
  });
  it('兩個 adapter writer 共用 state authority，合計只有一次取得紀錄', async () => {
    const history: LuaInvocation[] = [];
    const transport = { eval: vi.fn(async (script: string, sharedKeys: readonly string[], json: string) => {
      history.push({ script, keys: sharedKeys, command: JSON.parse(json), now });
      return JSON.stringify(runLuaRedis(history).at(-1));
    }) };
    const options = { namespace: '{FIXTURE_005}', transport, timeoutMs: 1000, audit: vi.fn() };
    const first = createRedisOAuthStateStore(options), second = createRedisOAuthStateStore(options);
    await first.create(record);
    const results = await Promise.all([first.consume(record.state), second.consume(record.state)]);
    expect(results).toEqual([record, null]);
    expect(transport.eval).toHaveBeenCalledTimes(3);
    expect(options.audit).not.toHaveBeenCalled();
  });
  const cleanup = (at: string, batchSize = 1): LuaInvocation => ({
    script: REDIS_OAUTH_STATE_LUA, keys, command: { operation: 'cleanup', batchSize }, now: at,
  });
  it('未 callback state 到期才清理，等值到期與重跑均安全', () => {
    expect(runLuaRedis([call('create'), cleanup('2026-10-07T01:00:00.999Z'),
      cleanup(record.expiresAt), cleanup(record.expiresAt), call('consume', record.expiresAt)]))
      .toEqual([{ status: 'created' }, { inspected: 0, removed: 0, cleanedAt: '2026-10-07T01:00:00.999Z' },
        { inspected: 1, removed: 1, cleanedAt: record.expiresAt },
        { inspected: 0, removed: 0, cleanedAt: record.expiresAt }, null]);
  });
  it.each(['consume-first', 'cleanup-first'])('consume／cleanup 兩順序不復活過期state：%s', (order) => {
    const consume = call('consume', record.expiresAt), clean = cleanup(record.expiresAt);
    const result = runLuaRedis([call('create'), ...(order === 'consume-first' ? [consume, clean] : [clean, consume]),
      call('consume', record.expiresAt)]);
    expect(result.at(-1)).toBeNull();
    expect(result[order === 'consume-first' ? 1 : 2]).toBeNull();
  });
  it('硬批次上限、續跑；cleanup／create兩順序不刪有效state', () => {
    const second = { ...record, state: 't'.repeat(43) };
    const createSecond: LuaInvocation = { script: REDIS_OAUTH_STATE_LUA, keys,
      command: { operation: 'create', record: second }, now };
    const future = { ...record, state: 'f'.repeat(43), expiresAt: '2026-10-07T01:05:00.000Z' };
    const createFuture: LuaInvocation = { script: REDIS_OAUTH_STATE_LUA, keys,
      command: { operation: 'create', record: future }, now: record.expiresAt };
    for (const commands of [[createFuture, cleanup(record.expiresAt)], [cleanup(record.expiresAt), createFuture]]) {
      const result = runLuaRedis([call('create'), createSecond, ...commands,
        cleanup(record.expiresAt), cleanup(record.expiresAt),
        { ...call('consume', record.expiresAt), command: { operation: 'consume', state: future.state } }]);
      expect(result.filter((r) => typeof r === 'object' && r !== null && 'removed' in r))
        .toEqual([{ inspected: 1, removed: 1, cleanedAt: record.expiresAt },
          { inspected: 1, removed: 1, cleanedAt: record.expiresAt },
          { inspected: 0, removed: 0, cleanedAt: record.expiresAt }]);
      expect(result.at(-1)).toEqual(future);
    }
  });
});

describe('OAuth state Redis adapter', () => {
  const fixture = (reply: unknown = JSON.stringify(record)) => {
    const evalCall = vi.fn().mockResolvedValue(reply);
    const audit = vi.fn();
    const store = createRedisOAuthStateStore({
      namespace: '{FIXTURE_005}', timeoutMs: 1000, transport: { eval: evalCall }, audit,
    });
    return { store, evalCall, audit };
  };
  it('同 hash-tag 單次 EVAL，傳入 state 而非 provider token', async () => {
    const f = fixture();
    await expect(f.store.consume(record.state)).resolves.toEqual(record);
    expect(f.evalCall).toHaveBeenCalledTimes(1);
    expect(f.evalCall.mock.calls[0][1]).toEqual(['{FIXTURE_005}:oauth-states', '{FIXTURE_005}:oauth-state-expiry']);
    expect(JSON.parse(f.evalCall.mock.calls[0][2])).toEqual({ operation: 'consume', state: record.state });
  });
  it('create 確認原子 acknowledgment；不存在 state 回 null', async () => {
    const f = fixture('{"status":"created"}');
    await f.store.create(record);
    expect(f.evalCall).toHaveBeenCalledTimes(1);
    const missing = fixture('null');
    await expect(missing.store.consume(record.state)).resolves.toBeNull();
  });
  it('非法 consume key 在 EVAL 前拒絕', async () => {
    const f = fixture();
    await expect(f.store.consume('invalid')).rejects.toThrow(TypeError);
    expect(f.evalCall).not.toHaveBeenCalled();
  });
  it.each([
    { ...record, state: 'wrong' },
    { ...record, nonce: '' },
    { ...record, verifier: 'bad' },
    { ...record, expiresAt: 'invalid' },
    { ...record, token: 'TEST_ONLY_NOT_ALLOWED' },
  ])('非法輸入在 EVAL 前拒絕，不採預設期限', async (invalid) => {
    const f = fixture();
    await expect(f.store.create(invalid)).rejects.toThrow(TypeError);
    expect(f.evalCall).not.toHaveBeenCalled();
  });
  it.each(['{"state":', '{}', JSON.stringify({ ...record, state: 'x'.repeat(43) }),
    JSON.stringify({ ...record, verifier: '' })])('無效回應明確拒絕並記錄無內容的 audit', async (reply) => {
    const f = fixture(reply);
    await expect(f.store.consume(record.state)).rejects.toBeInstanceOf(SharedStoreUnavailableError);
    expect(f.audit).toHaveBeenCalledWith({ operation: 'redis_atomic', outcome: 'unavailable' });
    expect(f.evalCall).toHaveBeenCalledTimes(1);
  });
  it('錯誤寫入 acknowledgment 不假裝成功', async () => {
    const f = fixture('{}');
    await expect(f.store.create(record)).rejects.toBeInstanceOf(SharedStoreUnavailableError);
    expect(f.audit).toHaveBeenCalledTimes(1);
  });
  it('cleanup參數與回傳硬上限驗證；不採保存／排程預設', async () => {
    const f = fixture(JSON.stringify({ inspected: 1, removed: 1, cleanedAt: now }));
    await expect(f.store.cleanup({ batchSize: 1 })).resolves.toEqual({ inspected: 1, removed: 1, cleanedAt: now });
    expect(JSON.parse(f.evalCall.mock.calls[0][2])).toEqual({ operation: 'cleanup', batchSize: 1 });
    for (const batchSize of [0, -1, 1.5, NaN]) {
      await expect(f.store.cleanup({ batchSize })).rejects.toThrow(TypeError);
    }
    const invalid = fixture(JSON.stringify({ inspected: 2, removed: 2, cleanedAt: now }));
    await expect(invalid.store.cleanup({ batchSize: 1 })).rejects.toBeInstanceOf(SharedStoreUnavailableError);
    expect(invalid.audit).toHaveBeenCalledTimes(1);
  });
  it.each(['consume', 'create', 'cleanup'] as const)('timeout 結果未知時不重試 %s', async (operation) => {
    const evalCall = vi.fn().mockReturnValue(new Promise<never>(() => {}));
    const audit = vi.fn();
    const store = createRedisOAuthStateStore({
      namespace: '{FIXTURE_005}', timeoutMs: 1, transport: { eval: evalCall }, audit,
    });
    const result = operation === 'consume' ? store.consume(record.state) :
      operation === 'create' ? store.create(record) : store.cleanup({ batchSize: 1 });
    await expect(result).rejects.toBeInstanceOf(SharedStoreUnavailableError);
    expect(evalCall).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledTimes(1);
  });
});
