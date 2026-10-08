// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createRedisRateLimiter, REDIS_RATE_LUA } from '../../api/_lib/redis-rate-limiter';
import { EXECUTION_POLICY, INPUT_POLICY, RATE_POLICY, SESSION_POLICY, TILE_RESOURCE_POLICY } from '../../api/_lib/local-protection-policy';
import { luaAvailable, runLuaRedis, type LuaInvocation } from '../support/lua-redis-harness';

describe('已批准本機 policies（不啟用服務）', () => {
  it('端點 lease 等於 execution＋派送＋結算，speech 無 lease', () => {
    for (const p of Object.values(EXECUTION_POLICY)) if (p) {
      expect(p.leaseMs).toBe(p.executionTimeoutMs + p.dispatchMarginMs + p.settlementBufferMs);
      expect(p.leaseMs).toBeGreaterThan(p.executionTimeoutMs + p.settlementBufferMs);
    }
    expect(EXECUTION_POLICY.speech).toBeNull();
    expect(SESSION_POLICY).toEqual({ lifetimeMs: 86400000, stateLifetimeMs: 300000, expiredRetentionMs: 86400000 });
    expect(INPUT_POLICY.maxBytes['photo-ocr']).toBe(4200000);
    expect(TILE_RESOURCE_POLICY.flightLeaseMs).toBe(15000);
  });
});
describe.skipIf(!luaAvailable)('固定窗口限流 Lua（本機替身，不是真實 TTL 證據）', () => {
  const call = (limit: number, now: string): LuaInvocation => ({
    script: REDIS_RATE_LUA, keys: ['{FIXTURE_005}:rate:test'], command: { limit }, now,
  });
  it.each(Object.entries(RATE_POLICY))('%s 精確上限，下一筆限流並回可信 Retry-After', (_bucket, limit) => {
    const result = runLuaRedis(Array.from({ length: limit + 1 }, () => call(limit, '2026-10-07T01:00:00.001Z')));
    expect(result.slice(0, limit)).toEqual(Array.from({ length: limit }, () => ({ kind: 'allowed' })));
    expect(result.at(-1)).toEqual({ kind: 'limited', retryAfterSeconds: 60 });
  });
  it('明列交界突發：59.999秒與下一窗口合計可接受兩倍配額', () => {
    const result = runLuaRedis([call(2, '2026-10-07T01:00:59.999Z'), call(2, '2026-10-07T01:00:59.999Z'),
      call(2, '2026-10-07T01:00:59.999Z'), call(2, '2026-10-07T01:01:00.000Z'),
      call(2, '2026-10-07T01:01:00.000Z')]);
    expect(result).toEqual([{ kind: 'allowed' }, { kind: 'allowed' }, { kind: 'limited', retryAfterSeconds: 1 },
      { kind: 'allowed' }, { kind: 'allowed' }]);
  });
  it('兩個writer、不同付費endpoint共subject桶，不將明文subject送store', async () => {
    const history: LuaInvocation[] = [];
    const evalCall = vi.fn(async (script: string, keys: readonly string[], command: string) => {
      history.push({ script, keys, command: JSON.parse(command), now: '2026-10-07T01:00:00.000Z' });
      return JSON.stringify(runLuaRedis(history).at(-1));
    });
    const options = { namespace: '{FIXTURE_005}', timeoutMs: 1000, transport: { eval: evalCall },
      audit: vi.fn(), bucket: 'paid_subject' as const, hmacKey: new Uint8Array(32).fill(1) };
    const a = createRedisRateLimiter(options), b = createRedisRateLimiter(options);
    const results = await Promise.all(Array.from({ length: 21 }, (_, i) =>
      (i % 2 ? a : b).consume('FIXTURE_SUBJECT', i % 2 ? 'assistant' : 'places', new Date())));
    expect(results.filter((r) => r.kind === 'allowed')).toHaveLength(20);
    expect(results.at(-1)).toEqual({ kind: 'limited', retryAfterSeconds: 60 });
    expect(new Set(history.map((h) => h.keys[0])).size).toBe(1);
    expect(JSON.stringify(history)).not.toContain('FIXTURE_SUBJECT');
  });
});
describe('限流adapter failure', () => {
  it.each(['{}', '{"kind":"limited","retryAfterSeconds":0}', '{"kind":"allowed","extra":1}'])('無效佐證 %s fail closed', async (reply) => {
    const evalCall = vi.fn().mockResolvedValue(reply), audit = vi.fn();
    const limiter = createRedisRateLimiter({ namespace: '{FIXTURE_005}', timeoutMs: 1000,
      transport: { eval: evalCall }, audit, bucket: 'admission', hmacKey: new Uint8Array(32) });
    expect(await limiter.consume('FIXTURE', 'places', new Date())).toEqual({ kind: 'unavailable' });
    expect(audit).toHaveBeenCalled();
    expect(evalCall).toHaveBeenCalledTimes(1);
  });
  it('timeout不重試，未知入口不查store', async () => {
    const evalCall = vi.fn().mockReturnValue(new Promise(() => {})), audit = vi.fn();
    const limiter = createRedisRateLimiter({ namespace: '{FIXTURE_005}', timeoutMs: 1,
      transport: { eval: evalCall }, audit, bucket: 'admission', hmacKey: new Uint8Array(32) });
    expect(await limiter.consume('FIXTURE', 'places', new Date())).toEqual({ kind: 'unavailable' });
    await expect(limiter.consume('', 'places', new Date())).rejects.toThrow(TypeError);
    expect(evalCall).toHaveBeenCalledTimes(1);
  });
});
