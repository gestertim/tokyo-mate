// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createRedisAdminStore, ADMIN_REDIS_KEYS } from '../../api/_lib/admin-redis-store';
import { REDIS_CLOCK_LUA } from '../../api/_lib/redis-quota-script';
import { SharedStoreUnavailableError } from '../../api/_lib/shared-store';
import { createAdminAuthOptions } from '../../api/_lib/admin-principal';
import { createSessionService, type SessionRecord } from '../../api/_lib/session';
import { createHandler } from '../../api/admin/overview';
import { luaAvailable, runLuaRedis, type LuaInvocation } from '../support/lua-redis-harness';

const now = '2026-10-06T02:00:00.000Z', namespace = '{ADMIN_HINT_FIXTURE}';
async function fixture(percent: unknown, weeklyLimit = 15_000_000, weekUsed = 0, dayUsed = 0) {
  const history: LuaInvocation[] = [], audit = vi.fn();
  const transport = { eval: vi.fn(async (script: string, keys: readonly string[], json: string) => {
    history.push({ script, keys, command: JSON.parse(json), now });
    const result = runLuaRedis(history).at(-1);
    if (result && typeof result === 'object' && 'fixtureError' in result) throw new Error(String(result.fixtureError));
    return JSON.stringify(result);
  }) };
  const topUp = weeklyLimit - 15_000_000;
  await transport.eval(REDIS_CLOCK_LUA + `
local c=cjson.decode(ARGV[1]);redis.call('HSET',KEYS[2],'user',encode(c.user));return reply({seeded=true})
`, ADMIN_REDIS_KEYS(namespace), JSON.stringify({ user: {
    eligibility: { identitySubject: 'user', status: 'approved', tier: 'tier1', expiresAt: null, updatedAt: now },
    windows: { 'day:2026-10-06': { usedMicroUsd: dayUsed, reservedMicroUsd: 0 },
      'week:2026-W41': { usedMicroUsd: weekUsed, reservedMicroUsd: 0 } },
    reservations: {}, idempotency: {}, topUpIdempotency: {},
    topUps: topUp > 0 ? { grant: { topUpId: 'grant', identitySubject: 'user', weekWindowKey: '2026-W41',
      amountMicroUsd: topUp, status: 'active', expiresAt: '2026-10-11T16:00:00.000Z',
      idempotencyKey: 'grant', adminSubject: 'admin', reasonCode: 'fixture', createdAt: now } } : {},
  } }));
  const store = createRedisAdminStore({ namespace, transport, timeoutMs: 1000, audit,
    nearLimitPercent: percent as number | undefined });
  const snapshot = async () => JSON.parse(await transport.eval(REDIS_CLOCK_LUA + `
return reply({user=cjson.decode(redis.call('HGET',KEYS[2],'user')),audit=redis.call('HGETALL',KEYS[6]),
  idempotency=redis.call('HGETALL',KEYS[7])})
`, ADMIN_REDIS_KEYS(namespace), '{}'));
  return { store, transport, audit, snapshot };
}

describe.runIf(luaAvailable)('管理總覽可信提示設定（D12已批准80%；僅提示）', () => {
  it('未另外覆寫時採已批准80%，不改授權或usage', async () => {
    const f = await fixture(undefined, 15_000_000, 12_000_000);
    const before = await f.snapshot();
    expect((await f.store.overview()).nearLimits?.filter((v) => v.window === 'week')).toHaveLength(1);
    expect(await f.snapshot()).toEqual(before);
  });
  it.each([null, 0, -1, 101, 80.5, NaN, Infinity, '80'].map((percent) => ({ percent })))(
    '缺失或無效percent=%j：overview明確503/稽核，其他讀取異動不受阻', async ({ percent }) => {
      const f = await fixture(percent);
      f.transport.eval.mockClear();
      await expect(f.store.overview()).rejects.toBeInstanceOf(SharedStoreUnavailableError);
      expect(f.transport.eval).not.toHaveBeenCalled();
      expect(f.audit).toHaveBeenCalledWith({ operation: 'redis_atomic', outcome: 'unavailable' });
      const records = new Map<string, SessionRecord>();
      const sessions = createSessionService({ signingKey: Buffer.alloc(32, 14), lifetimeMs: 60_000,
        storeTimeoutMs: 50, cookieName: 'ADMIN_HINT_SESSION', now: () => new Date(now), audit: vi.fn(),
        store: { create: async (r) => { records.set(r.sessionId, r); }, get: async (id) => records.get(id) ?? null, revoke: async () => {} } });
      const options = createAdminAuthOptions({ sessions, now: () => new Date(now), timeoutMs: 1000,
        origin: 'https://fixture.invalid', adminSubjects: ['admin'], audit: vi.fn() });
      const cookie = (await sessions.create('admin')).split(';')[0];
      const response = await createHandler({ ...options, readOverview: f.store.overview })(
        new Request('https://fixture.invalid/api/admin/overview', { headers: { cookie } }));
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain('nearLimits');
      expect(options.audit).toHaveBeenCalledWith({ operation: 'session_endpoint', outcome: 'unavailable' });
      expect((await f.store.users(0, 25)).items).toHaveLength(1);
      expect(await f.store.mutate({ action: 'change_tier', tier: 'tier2', idempotencyKey: 'independent',
        adminSubject: 'admin', targetIdentitySubject: 'user', confirmed: true,
        reasonCode: 'fixture', nowIso: now })).toMatchObject({ outcome: 'applied' });
    });
  it.each([
    { limit: 15_000_001, percent: 80 },
    ...[1, 80, 99, 100].map((percent) => ({ limit: Number.MAX_SAFE_INTEGER, percent })),
  ])('安全ceil邊界：limit=$limit percent=$percent，只有達門檻才提示且完全唯讀', async ({ limit, percent }) => {
    const threshold = Number((BigInt(limit) * BigInt(percent) + 99n) / 100n);
    for (const used of [threshold - 1, threshold]) {
      const f = await fixture(percent, limit, used);
      const before = await f.snapshot();
      const overview = await f.store.overview();
      expect(overview.nearLimits?.filter((v) => v.window === 'week')).toHaveLength(used === threshold ? 1 : 0);
      expect(overview.nearLimits?.some((v) => v.window === 'day')).toBe(false);
      expect(await f.snapshot()).toEqual(before);
      expect((await f.store.detail('user', now))?.daily.limitEstimatedUsd).toBe('3.00');
    }
  });
  it('day門檻使用原始micro，差一micro不被顯示金額四捨五入誤判', async () => {
    for (const used of [2_399_999, 2_400_000]) {
      const f = await fixture(80, 15_000_000, 0, used);
      expect((await f.store.overview()).nearLimits?.filter((v) => v.window === 'day')).toHaveLength(used === 2_400_000 ? 1 : 0);
    }
  });
});
