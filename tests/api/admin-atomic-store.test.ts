// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { ADMIN_REDIS_LUA } from '../../api/_lib/admin-redis-script';
import { REDIS_CLOCK_LUA } from '../../api/_lib/redis-quota-script';
import { ADMIN_REDIS_KEYS, createRedisAdminStore } from '../../api/_lib/admin-redis-store';
import { runLuaRedis, luaAvailable, type LuaInvocation } from '../support/lua-redis-harness';
import type { AdminMutation } from '../../api/_lib/admin-store';

const keys = ADMIN_REDIS_KEYS('{admin_fixture}');
const now = '2026-10-06T02:00:00.000Z';
const week = '2026-W41', expiresAt = '2026-10-11T16:00:00.000Z';
const seedScript = `
local c=cjson.decode(ARGV[1])
redis.call('HSET',KEYS[2],'user',cjson.encode(c.user))
redis.call('HSET',KEYS[5],'review1',cjson.encode(c.review))
return cjson.encode({seeded=true})
`;
function seed(tier = 'tier1', status = 'approved'): LuaInvocation {
  return { script: seedScript, keys, now, command: {
    user: { eligibility: { identitySubject: 'user', tier, status, expiresAt: null, updatedAt: now },
      windows: { 'day:2026-10-06': { usedMicroUsd: 500_000, reservedMicroUsd: 100_000 },
        'week:2026-W41': { usedMicroUsd: 2_000_000, reservedMicroUsd: 1_000_000 } },
      reservations: { existing: { endpoint: 'places', weekWindowKey: week, status: 'reserved', estimatedCostUpperBoundUsdMicro: 50_000 } },
      idempotency: {}, topUps: {}, topUpIdempotency: {} },
    review: { reviewId: 'review1', targetIdentitySubject: 'user', kind: status === 'pending' ? 'paid_access' : 'weekly_top_up',
      createdAt: now, status: 'pending' },
  } };
}
function mutation(key = 'key1', extra: object = {}): LuaInvocation {
  return { script: ADMIN_REDIS_LUA, keys, now, command: JSON.parse(JSON.stringify({ operation: 'mutate', command: {
    action: 'top_up', idempotencyKey: key, adminSubject: 'admin1', targetIdentitySubject: 'user',
    confirmed: true, reasonCode: 'weekly_limit_review', nowIso: now, weekWindowKey: week, expiresAt,
    scope: 'all_protected_endpoints', amountMicroUsd: 15_000_000, auditId: `audit_${key}`, generatedTopUpId: `grant_${key}`, ...extra,
  } })) };
}
function read(operation: string, command: object = {}): LuaInvocation {
  return { script: ADMIN_REDIS_LUA, keys, now, command: { operation, command } };
}
describe.runIf(luaAvailable)('管理業務 Lua 實際 interpreter＋明列 Redis/cjson 替身（非正式 Redis 證據）', () => {
  it.each(['tier1', 'tier2'])('%s 同鍵一次／不同鍵與不同管理者累加，日上限與現有預留不變', (tier) => {
    const output = runLuaRedis([seed(tier), mutation(), mutation(), mutation('key2', { adminSubject: 'admin2' }),
      read('detail', { subject: 'user' }), read('audits', { offset: 0, limit: 100 })]) as any[];
    expect(output[1].outcome).toBe('applied');
    expect(output[2]).toEqual({ outcome: 'duplicate', auditId: 'audit_key1' });
    expect(output[3].outcome).toBe('applied');
    expect(output[4].weekly.activeTopUpEstimatedUsd).toBe('30.00');
    expect(output[4].weekly.limitEstimatedUsd).toBe(tier === 'tier1' ? '45.00' : '80.00');
    expect(output[4].daily.limitEstimatedUsd).toBe(tier === 'tier1' ? '3.00' : '10.00');
    expect(output[4].weekly.reservedEstimatedUsd).toBe('1.00');
    expect(output[5].items).toHaveLength(2);
    expect(output[5].items[1].after.cumulativeWeeklyTopUpMicroUsd).toBe(30_000_000);
  });
  it('撤銷單筆只改週可用追加，保留既有reserved與settled', () => {
    const output = runLuaRedis([seed(), mutation(), mutation('key2'),
      mutation('revoke1', { action: 'top_up_revoke', topUpId: 'grant_key1', amountMicroUsd: undefined }),
      read('detail', { subject: 'user' }), read('audits', { offset: 0, limit: 100 })]) as any[];
    expect(output[3].outcome).toBe('applied');
    expect(output[4].weekly.activeTopUpEstimatedUsd).toBe('15.00');
    expect(output[4].weekly.usedEstimatedUsd).toBe('2.00');
    expect(output[4].weekly.reservedEstimatedUsd).toBe('1.00');
    expect(output[5].items).toHaveLength(3);
  });
  it('同待審核不同鍵僅一次追加；拒絕追加申請不撤銷使用資格', () => {
    const output = runLuaRedis([seed(), mutation('key1', { reviewId: 'review1' }),
      mutation('key2', { reviewId: 'review1' }), read('reviews', { offset: 0, limit: 25 })]) as any[];
    expect(output[1].outcome).toBe('applied'); expect(output[2].outcome).toBe('conflict');
    expect(output[3].items).toEqual([]);
    const rejected = runLuaRedis([seed(), mutation('reject1', { action: 'reject', reviewId: 'review1' }),
      read('detail', { subject: 'user' })]) as any[];
    expect(rejected[1].outcome).toBe('applied');
    expect(rejected[2].status).toBe('approved');
    expect(rejected[2].weekly.activeTopUpEstimatedUsd).toBe('0.00');
  });
  it('總覽回核准統計、可信日週用量與服務不可用，不虛構供應商帳單', () => {
    const output = runLuaRedis([seed(), read('overview', { nearLimitPercent: 80 })]) as any[];
    expect(output[1]).toEqual({ approvalCounts: { pending: 0, approved: 1, rejected: 0, revoked: 0, expired: 0 },
      estimatedUsage: { dailyUsedEstimatedUsd: '0.50', weeklyUsedEstimatedUsd: '2.00' },
      protectionAvailable: false, nearLimits: [] });
  });
  it('同待審核資格核准僅一次／同鍵異內容conflict；完整audit', () => {
    const output = runLuaRedis([seed('tier1', 'pending'),
      mutation('approve1', { action: 'approve', tier: 'tier2', reviewId: 'review1' }),
      mutation('approve2', { action: 'approve', tier: 'tier1', reviewId: 'review1' }),
      mutation('approve1', { action: 'approve', tier: 'tier1', reviewId: 'review1' }),
      read('detail', { subject: 'user' }), read('audits', { offset: 0, limit: 25 })]) as any[];
    expect(output[1].outcome).toBe('applied'); expect(output[2].outcome).toBe('conflict');
    expect(output[3].outcome).toBe('conflict'); expect(output[4].tier).toBe('tier2');
    expect(output[5].items[0]).toMatchObject({ action: 'approve', before: { status: 'pending', tier: null },
      after: { status: 'approved', tier: 'tier2' }, adminSubject: 'admin1', targetIdentitySubject: 'user', reasonCode: 'weekly_limit_review' });
  });
  it('拒絕資格／切換等級／撤銷均與audit同一原子操作；微額度稽核不失真', () => {
    const rejected = runLuaRedis([seed('tier1', 'pending'), mutation('reject', { action: 'reject', reviewId: 'review1' }),
      read('detail', { subject: 'user' }), read('audits', { offset: 0, limit: 25 })]) as any[];
    expect(rejected[2]).toMatchObject({ status: 'rejected', tier: null });
    expect(rejected[3].items[0]).toMatchObject({ action: 'reject', after: { status: 'rejected' } });
    const changed = runLuaRedis([seed('tier2'), mutation('tier', { action: 'change_tier', tier: 'tier1' }),
      mutation('tiny', { amountMicroUsd: 1 }), mutation('revoke', { action: 'revoke' }),
      read('audits', { offset: 0, limit: 25 })]) as any[];
    expect(changed[1].outcome).toBe('applied');
    expect(changed[2].outcome).toBe('applied');
    expect(changed[3].outcome).toBe('applied');
    expect(changed[4].items.find((v: any) => v.action === 'top_up')).toMatchObject({
      amountEstimatedUsd: '0.000001', topUpId: 'grant_tiny', after: { cumulativeWeeklyTopUpMicroUsd: 1 } });
  });
  it('大型安全整數之追加、既有usage、audit、冪等fingerprint保存完整micro精度', () => {
    const large = 9_000_000_000_000_001;
    const initial = seed();
    (initial.command as any).user.windows['day:2026-10-06'] = { usedMicroUsd: 0, reservedMicroUsd: large };
    const inspect: LuaInvocation = { keys, now, command: {}, script: REDIS_CLOCK_LUA + `
local u=cjson.decode(redis.call('HGET',KEYS[2],'user'))
local a=cjson.decode(redis.call('HGET',KEYS[6],'audit_large'))
local i=cjson.decode(redis.call('HGET',KEYS[7],'large'))
return encode({amount=u.topUps.grant_large.amountMicroUsd,reserved=u.windows['day:2026-10-06'].reservedMicroUsd,
  cumulative=a.after.cumulativeWeeklyTopUpMicroUsd,idempotencyAmount=i.fingerprint.amountMicroUsd,amountUsd=a.amountEstimatedUsd})
` };
    const output = runLuaRedis([initial, mutation('large', { amountMicroUsd: large }),
      mutation('large', { amountMicroUsd: large }), inspect]) as any[];
    expect(output[1].outcome).toBe('applied');
    expect(output[2].outcome).toBe('duplicate');
    expect(output[3]).toEqual({ amount: large, reserved: large, cumulative: large,
      idempotencyAmount: large, amountUsd: '9000000000.000001' });
  });
  it('有效週上限超過可精確整數表示範圍時不寫入grant或audit，非業務倍數上限', () => {
    const output = runLuaRedis([seed(), mutation('overflow', { amountMicroUsd: Number.MAX_SAFE_INTEGER }),
      read('detail', { subject: 'user' }), read('audits', { offset: 0, limit: 25 })]) as any[];
    expect(output[1].outcome).toBe('invalid');
    expect(output[2].weekly.activeTopUpEstimatedUsd).toBe('0.00');
    expect(output[3].items).toEqual([]);
  });
  it('Redis TIME重驗窗口／跨週到期／型別異常在任何寫入前fail closed', () => {
    const nextWeek = '2026-10-12T02:00:00.000Z';
    const output = runLuaRedis([seed(), mutation('old', { weekWindowKey: '2026-W40' }),
      mutation('extended', { expiresAt: '2026-10-18T16:00:00.000Z' }), mutation(),
      { ...mutation('next'), now: nextWeek }, { ...read('detail', { subject: 'user' }), now: nextWeek },
      read('audits', { offset: 0, limit: 100 })]) as any[];
    expect(output[1].outcome).toBe('invalid'); expect(output[2].outcome).toBe('invalid');
    expect(output[4].outcome).toBe('invalid'); expect(output[5].weekly.activeTopUpEstimatedUsd).toBe('0.00');
    expect(output[6].items).toHaveLength(1);
    const bad = runLuaRedis([seed(), { script: `redis.call('SET',KEYS[6],'broken'); return cjson.encode({ok=true})`,
      keys, now, command: {} }, mutation(), read('detail', { subject: 'user' })]) as any[];
    expect(bad[2].fixtureError).toContain('KEY_TYPE');
    expect(bad[3].fixtureError).toContain('KEY_TYPE');
  });
});
describe('單EVAL管理 adapter', () => {
  it.runIf(luaAvailable)('兩管理者並行相同key不重複、不同key累加（單執行緒Redis替身線性化，非正式競態證據）', async () => {
    const history = [seed()];
    const store = createRedisAdminStore({ namespace: '{admin_fixture}', timeoutMs: 500, audit: vi.fn(), transport: {
      eval: async (script, keyList, argumentsJson) => {
        history.push({ script, keys: keyList, command: JSON.parse(argumentsJson), now });
        return JSON.stringify(runLuaRedis(history).at(-1));
      },
    } });
    const cmd = (mutation().command as any).command as AdminMutation;
    const results = await Promise.all([store.mutate(cmd), store.mutate(cmd),
      store.mutate({ ...cmd, adminSubject: 'admin2', idempotencyKey: 'key2' })]);
    expect(results.map((v) => v.outcome)).toEqual(['applied', 'duplicate', 'applied']);
    expect((await store.detail('user', now))?.weekly.activeTopUpEstimatedUsd).toBe('30.00');
    expect((await store.audits(0, 25)).items).toHaveLength(2);
  });
  it('同slot keys、單次、不重試，provider未知結果拒絕', async () => {
    const evalFn = vi.fn(async () => JSON.stringify({ outcome: 'applied', auditId: 'audit1' }));
    const store = createRedisAdminStore({ namespace: '{admin_fixture}', timeoutMs: 50, audit: vi.fn(), transport: { eval: evalFn } });
    const cmd = (mutation().command as any).command as AdminMutation;
    expect(await store.mutate(cmd)).toEqual({ outcome: 'applied', auditId: 'audit1' });
    expect(evalFn).toHaveBeenCalledWith(ADMIN_REDIS_LUA, keys, expect.any(String));
    expect(evalFn).toHaveBeenCalledTimes(1);
    evalFn.mockRejectedValueOnce(new Error('lost reply'));
    await expect(store.mutate(cmd)).rejects.toThrow();
    expect(evalFn).toHaveBeenCalledTimes(2);
    expect(() => createRedisAdminStore({ namespace: 'no-slot', timeoutMs: 50, audit: vi.fn(), transport: { eval: evalFn } })).toThrow();
  });
});
