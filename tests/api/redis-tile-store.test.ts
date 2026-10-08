// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REDIS_TILE_LUA, createRedisTileStore } from '../../api/_lib/redis-tile-store';
import { createRedisRestTransport } from '../../api/_lib/redis-rest-transport';
import { INITIAL_TILE_POLICY } from '../../api/_lib/tile-proxy-pipeline';
import { luaAvailable, runLuaRedis, type LuaInvocation } from '../support/lua-redis-harness';

const now = '2026-10-06T02:00:00.000Z';
afterEach(() => vi.useRealTimers());
const keys = ['users', 'cache', 'flights', 'credits'].map((key) => `{FIXTURE_TILE}:tile-${key}`);
const call = (command: object, at = now): LuaInvocation => ({ script: REDIS_TILE_LUA, keys, command, now: at });
const lookup = (flightId: string, tileKey = '1/0/0') => ({
  operation: 'lookup', tileKey, flightId, leaseMs: 60_000, policy: INITIAL_TILE_POLICY,
});

describe.skipIf(!luaAvailable)('共享圖磚Lua（Redis替身，無Geoapify呼叫）', () => {
  it('同tile只有一leader/credit，其他writer等待；完成後共享cache與304同計數', () => {
    const data = { base64: 'FIXTURE_BYTES', etag: '"FIXTURE_ETAG"' };
    const results = runLuaRedis([
      call({ operation: 'consume', subject: 'one', policy: INITIAL_TILE_POLICY }),
      call(lookup('flight-one')), call(lookup('flight-two')),
      call({ operation: 'finish', flightId: 'flight-one', kind: 'success', data, cacheTtlSeconds: 604800 }),
      call({ operation: 'wait', flightId: 'flight-one' }),
      call({ operation: 'consume', subject: 'one', policy: INITIAL_TILE_POLICY }), call(lookup('flight-three')),
      call({ operation: 'finish', flightId: 'flight-one', kind: 'success', data, cacheTtlSeconds: 604800 }),
    ]);
    expect(results[1]).toEqual({ kind: 'leader', flightId: 'flight-one',
      reservedAtMs: Date.parse(now), leaseExpiresAtMs: Date.parse(now) + 60000 });
    expect(results[2]).toEqual({ kind: 'wait', flightId: 'flight-one' });
    expect(results[4]).toEqual({ kind: 'hit', data });
    expect(results[6]).toEqual({ kind: 'hit', data });
    expect(results[7]).toEqual({ status: 'finished' });
  });
  it('minute 120th可用，121st拒絕；分鐘reset不重置日1000', () => {
    const commands: LuaInvocation[] = [];
    for (let n = 0; n < 1001; n++) {
      commands.push(call({ operation: 'consume', subject: 'one', policy: INITIAL_TILE_POLICY },
        new Date(Date.parse(now) + Math.floor(n / 120) * 60_000).toISOString()));
    }
    const results = runLuaRedis(commands);
    expect(results[119]).toEqual({ status: 'allowed' });
    expect(results[120]).toEqual({ status: 'allowed' });
    expect(results[999]).toEqual({ status: 'allowed' });
    expect(results[1000]).toEqual({ status: 'limited' });
    const minute = Array.from({ length: 121 }, () => call({
      operation: 'consume', subject: 'one', policy: INITIAL_TILE_POLICY,
    }));
    expect(runLuaRedis(minute)[120]).toEqual({ status: 'limited' });
  });
  it('site credit在呼叫前預留、uncertain不退款；禁止逾lease接管或晚到成功', () => {
    const policy = { ...INITIAL_TILE_POLICY, dailyCreditQuarters: 1 };
    const results = runLuaRedis([
      call({ ...lookup('one'), policy }),
      call({ ...lookup('two', '1/0/1'), policy }),
      call({ operation: 'wait', flightId: 'one' }, '2026-10-06T02:01:00.000Z'),
      call({ ...lookup('three'), policy }, '2026-10-06T02:01:00.000Z'),
      call({ operation: 'finish', flightId: 'one', kind: 'success', data: {}, cacheTtlSeconds: 604800 },
        '2026-10-06T02:01:01.000Z'),
      call({ ...lookup('four', '1/0/1'), policy }, '2026-10-06T02:01:01.000Z'),
    ]);
    expect(results[0]).toMatchObject({ kind: 'leader' });
    expect(results[1]).toEqual({ kind: 'unavailable' });
    expect(results[2]).toEqual({ kind: 'unavailable' });
    expect(results[3]).toEqual({ kind: 'unavailable' });
    expect(results[4]).toEqual({ status: 'uncertain' });
    expect(results[5]).toEqual({ kind: 'unavailable' });
  });
  it('已批准site 9600個quarter-credit：第9600筆預留可用，第9601筆無leader', () => {
    const commands = Array.from({ length: 9601 }, (_, n) => call(lookup(`flight-${n}`, `14/${n}/0`)));
    const results = runLuaRedis(commands);
    expect(results[9599]).toEqual({ kind: 'leader', flightId: 'flight-9599',
      reservedAtMs: Date.parse(now), leaseExpiresAtMs: Date.parse(now) + 60000 });
    expect(results[9600]).toEqual({ kind: 'unavailable' });
  });
  it('cache恰滿7天失效，日credits依Taipei重置', () => {
    const first = '2026-10-06T15:59:59.999Z';
    const later = '2026-10-06T16:00:00.000Z';
    const policy = { ...INITIAL_TILE_POLICY, dailyCreditQuarters: 1 };
    const results = runLuaRedis([
      call({ ...lookup('one'), policy }, first),
      call({ operation: 'finish', flightId: 'one', kind: 'success', data: { base64: 'fixture', etag: 'fixture' },
        cacheTtlSeconds: 604800 }, first),
      call({ ...lookup('two', '1/0/1'), policy }, later),
      call({ ...lookup('three'), policy }, '2026-10-13T15:59:59.999Z'),
    ]);
    expect(results[2]).toMatchObject({ kind: 'leader', flightId: 'two' });
    expect(results[3]).toMatchObject({ kind: 'leader', flightId: 'three' });
  });
  it('cache實體清理只移除已滿7天的項目，不變動credit或重授execution', () => {
    const results = runLuaRedis([
      call(lookup('one')),
      call({ operation: 'finish', flightId: 'one', kind: 'success', data: { base64: 'fixture', etag: 'fixture' },
        cacheTtlSeconds: 604800 }),
      call({ operation: 'cleanupCache', cursor: '0', batchSize: 10 }),
      call({ operation: 'cleanupCache', cursor: '0', batchSize: 10 }, '2026-10-13T02:00:00.000Z'),
      call({ operation: 'cleanupCache', cursor: '0', batchSize: 10 }, '2026-10-13T02:00:00.000Z'),
    ]);
    expect(results[2]).toEqual({ cursor: '0', removed: 0 });
    expect(results[3]).toEqual({ cursor: '0', removed: 1 });
    expect(results[4]).toEqual({ cursor: '0', removed: 0 });
  });
});

describe('Redis tile/REST adapter', () => {
  it('D05整體2秒deadline，即使fetch忽略AbortSignal仍拒絕且不重試', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(new Promise(() => {}));
    const transport = createRedisRestTransport({ url: 'https://fixture.upstash.io', token: 'TEST_ONLY',
      timeoutMs: 2000, maxResponseBytes: 1048576, fetch: fetchMock });
    const rejected = expect(transport.eval('test', ['{FIXTURE}:one'], '{}')).rejects.toThrow('REDIS_REST_UNAVAILABLE');
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('D05回應1048576B／+1，取消Promise不完成也不阻塞拒絕', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ result: 'x'.repeat(1048576 - 13) }));
    const transport = createRedisRestTransport({ url: 'https://fixture.upstash.io', token: 'TEST_ONLY',
      timeoutMs: 2000, maxResponseBytes: 1048576, fetch: fetchMock });
    expect((await transport.eval('test', ['{FIXTURE}:one'], '{}') as string).length).toBe(1048576 - 13);
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ start(c) {
      c.enqueue(new Uint8Array(1048577));
    }, cancel })));
    await expect(transport.eval('test', ['{FIXTURE}:one'], '{}')).rejects.toThrow('REDIS_REST_UNAVAILABLE');
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('圖磚期限/資料上限必須注入；未知結果不成功fallback', async () => {
    const evalMock = vi.fn(async () => '{"kind":"hit","data":{"base64":"bad","etag":"bad"}}');
    const store = createRedisTileStore({ namespace: '{FIXTURE_TILE}', transport: { eval: evalMock },
      timeoutMs: 20, audit: vi.fn(), flightLeaseMs: 60_000, waitTimeoutMs: 100,
      pollIntervalMs: 10, maxTileBytes: 100 });
    await expect(store.lookupOrReserve({ z: 1, x: 0, y: 0 }, now, INITIAL_TILE_POLICY)).rejects.toThrow();
    expect(evalMock).toHaveBeenCalledOnce();
    expect(() => createRedisTileStore({ namespace: '{FIXTURE_TILE}', transport: { eval: evalMock },
      timeoutMs: 20, audit: vi.fn(), flightLeaseMs: 0, waitTimeoutMs: 100,
      pollIntervalMs: 10, maxTileBytes: 100 })).toThrow();
  });
  it('REST只有一次EVAL fetch，沒有redirect/retry，secret不出錯誤', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ result: '{"status":"fixture"}' }));
    const transport = createRedisRestTransport({ url: 'https://fixture.upstash.io', token: 'FIXTURE_TOKEN',
      timeoutMs: 100, maxResponseBytes: 100, fetch: fetchMock });
    expect(await transport.eval('return ARGV[1]', ['{FIXTURE}:one'], '{}')).toBe('{"status":"fixture"}');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'error', cache: 'no-store',
      body: '["EVAL","return ARGV[1]",1,"{FIXTURE}:one","{}"]' });
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'FIXTURE_TOKEN leaked provider body' }));
    await expect(transport.eval('return ARGV[1]', ['{FIXTURE}:one'], '{}'))
      .rejects.toThrow('REDIS_REST_UNAVAILABLE');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('REST拒絕非可信origin、超大回應；不連外', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ result: 'x'.repeat(100) }));
    const options = { url: 'https://fixture.upstash.io', token: 'FIXTURE_TOKEN',
      timeoutMs: 100, maxResponseBytes: 30, fetch: fetchMock };
    expect(() => createRedisRestTransport({ ...options, url: 'https://attacker.invalid' })).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(createRedisRestTransport(options).eval('fixture', ['{FIXTURE}:one'], '{}')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
