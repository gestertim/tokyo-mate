// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createRedisAdminStore } from '../../api/_lib/admin-redis-store';
import { createRedisSharedStore, REDIS_QUOTA_KEYS } from '../../api/_lib/redis-shared-store';
import { createRedisSessionStore } from '../../api/_lib/redis-session-store';
import { createAtomicQuotaEngine } from '../../api/_lib/quota-engine';
import { createRegistryBundle } from '../../api/_lib/cost-registry';
import { PROTECTED_ENDPOINTS } from '../../api/_lib/cost-price-table';
import { REDIS_CLOCK_LUA } from '../../api/_lib/redis-quota-script';
import { getQuotaWindows } from '../../api/_lib/quota-window';
import type { AdminMutation } from '../../api/_lib/admin-store';
import { fixtureRegistryEntry } from '../fixtures/cost-registry-fixtures';
import { FIXTURE_ALL_LIVE } from '../fixtures/cost-price-fixtures';
import { FIXTURE_FINGERPRINT_KEY } from '../fixtures/quota-fingerprint-fixtures';
import { luaAvailable, runLuaRedis, type LuaInvocation } from '../support/lua-redis-harness';

const subject = 'integrated-user', namespace = '{ADMIN_WRITER_INTEGRATION}';
const dayLimit = 3_000_000, weekBase = 15_000_000;
async function setup(start: string) {
  let time = start, nextId = 0;
  const history: LuaInvocation[] = [];
  const transport = { eval: vi.fn(async (script: string, keys: readonly string[], json: string) => {
    history.push({ script, keys, command: JSON.parse(json), now: time });
    const result = runLuaRedis(history).at(-1);
    if (result && typeof result === 'object' && 'fixtureError' in result) throw new Error(String(result.fixtureError));
    return JSON.stringify(result);
  }) };
  const options = { namespace, transport, timeoutMs: 1000, audit: vi.fn() };
  const quotaStore = createRedisSharedStore(options), adminStore = createRedisAdminStore(options);
  // 此延長效期只屬跨年測試 fixture，不代表任何正式成本版本獲得延期。
  const table = { ...FIXTURE_ALL_LIVE, version: 'FIXTURE_ADMIN_WRITER_CROSS_YEAR', expiresAt: '2028-01-01T00:00:00.000Z' };
  const entries = PROTECTED_ENDPOINTS.map((e) => fixtureRegistryEntry(e, table));
  await quotaStore.publishRegistry(createRegistryBundle(1, table, entries));
  await quotaStore.setEligibility({ identitySubject: subject, status: 'pending', tier: 'tier1', expiresAt: null, nowIso: time });
  const engine = createAtomicQuotaEngine({
    store: quotaStore, costRegistry: quotaStore, fingerprintKey: FIXTURE_FINGERPRINT_KEY,
    now: () => new Date(time), newId: () => `reservation_${++nextId}`, leaseMs: 60_000, storeTimeoutMs: 1000,
    tierLimits: { tier1: { dayLimitMicroUsd: dayLimit, weekBaseLimitMicroUsd: weekBase },
      tier2: { dayLimitMicroUsd: 10_000_000, weekBaseLimitMicroUsd: 50_000_000 } },
  });
  const mutate = (action: AdminMutation['action'], key: string, extra: Partial<AdminMutation> = {}) => {
    const week = getQuotaWindows(new Date(time)).week;
    return adminStore.mutate({
      action, idempotencyKey: key, adminSubject: 'trusted-admin', targetIdentitySubject: subject,
      confirmed: true, reasonCode: 'operator_review', nowIso: time,
      ...(action === 'approve' || action === 'change_tier' ? { tier: 'tier1' as const } : {}),
      ...(action === 'top_up' || action === 'top_up_revoke' ? {
        weekWindowKey: week.windowKey, expiresAt: week.resetAt, scope: 'all_protected_endpoints' as const,
        ...(action === 'top_up' ? { amountMicroUsd: 15_000_000 } : {}),
      } : {}),
      ...extra,
    });
  };
  const reserve = (key: string) => engine.reserve({
    identitySubject: subject, endpoint: 'assistant', idempotencyKey: key, content: '本機跨 writer fixture',
  }, { inputTokens: 0 });
  await mutate('approve', 'approve1');
  return { adminStore, quotaStore, engine, mutate, reserve, transport, history,
    now: () => time, setTime: (value: string) => { time = value; } };
}

describe.runIf(luaAvailable)('AdminStore＋RedisSharedStore＋AtomicQuotaEngine 共用單一 Lua replay authority（非外部 Redis 證據）', () => {
  it('首次Session create初始化identity/null資格後，管理可見pending且不自動建立申請或核准', async () => {
    const f = await setup('2026-10-06T02:00:00.000Z');
    const firstSubject = 'first-login-subject';
    const sessions = createRedisSessionStore({ namespace, transport: f.transport, timeoutMs: 1000, audit: vi.fn() });
    await sessions.create({ sessionId: 'c'.repeat(64), identitySubject: firstSubject, createdAt: f.now(),
      expiresAt: '2026-10-06T02:01:00.000Z', revokedAt: null });
    expect((await f.adminStore.users(0, 25)).items.find((u) => u.identitySubject === firstSubject)).toMatchObject({
      identitySubject: firstSubject, status: 'pending', tier: null,
    });
    expect(await f.adminStore.detail(firstSubject, f.now())).toMatchObject({
      identitySubject: firstSubject, status: 'pending', tier: null, endpointUsage: expect.any(Array), topUps: [],
    });
    expect((await f.adminStore.reviews(0, 25)).items).toEqual([]);
    expect(await f.engine.getSnapshot({ identitySubject: firstSubject })).toMatchObject({ status: 403 });
    const inspectIdentity = () => f.transport.eval(REDIS_CLOCK_LUA + `
local c=cjson.decode(ARGV[1]);local u=cjson.decode(redis.call('HGET',KEYS[2],c.subject))
return reply({identity=u.identity,eligibility=u.eligibility})
`, REDIS_QUOTA_KEYS(namespace), JSON.stringify({ subject: firstSubject }));
    expect(JSON.parse(await inspectIdentity())).toEqual({
      identity: { identitySubject: firstSubject, createdAt: f.now() }, eligibility: null,
    });
    await f.mutate('approve', 'explicit_first_login_approval', { targetIdentitySubject: firstSubject });
    expect(JSON.parse(await inspectIdentity())).toMatchObject({
      identity: { identitySubject: firstSubject, createdAt: f.now() },
      eligibility: { status: 'approved', tier: 'tier1' },
    });
  });
  it('admin資格／當週追加被engine讀取；撤回保留舊reservation，新reserve按低限拒絕，日限額不變', async () => {
    const f = await setup('2026-10-06T02:00:00.000Z');
    expect(await f.engine.getSnapshot({ identitySubject: subject })).toMatchObject({
      ok: true, tier: 'tier1', snapshot: { day: { limitEstimatedUsdMicro: dayLimit },
        week: { limitEstimatedUsdMicro: weekBase, windowKey: '2026-W41' } },
    });
    // 僅植入已耗盡週用量 fixture；後續所有管理及 quota 業務均走正式 adapter/engine。
    await f.transport.eval(REDIS_CLOCK_LUA + `
local c=cjson.decode(ARGV[1]);local u=cjson.decode(redis.call('HGET',KEYS[2],c.subject))
local w=windows();u.windows['week:'..w.week.windowKey]={usedMicroUsd=c.used,reservedMicroUsd=0}
redis.call('HSET',KEYS[2],c.subject,encode(u));return reply({seeded=true})
`, REDIS_QUOTA_KEYS(namespace), JSON.stringify({ subject, used: weekBase }));
    expect(await f.reserve('before_topup')).toMatchObject({ status: 429, deniedWindow: 'week' });
    expect(await f.mutate('top_up', 'topup1')).toMatchObject({ outcome: 'applied' });
    const first = await f.reserve('reserved_before_revoke');
    expect(first).toMatchObject({
      ok: true, executionGrant: true, snapshot: { day: { limitEstimatedUsdMicro: dayLimit },
        week: { windowKey: '2026-W41', limitEstimatedUsdMicro: 30_000_000, cumulativeTopUpEstimatedUsdMicro: 15_000_000 } },
    });
    if (!first.ok) throw new Error('跨 writer fixture 應取得單次 grant');
    const reservation = first.reservation;
    const detail = await f.adminStore.detail(subject, f.now());
    const topUpId = detail?.topUps[0]?.topUpId;
    if (!topUpId) throw new Error('AdminStore 應可讀回同一追加');
    const before = await f.quotaStore.readUsage(subject, '2026-10-06', '2026-W41');
    expect(await f.mutate('top_up_revoke', 'revoke_top1', { topUpId })).toMatchObject({ outcome: 'applied' });
    expect(await f.quotaStore.readUsage(subject, '2026-10-06', '2026-W41')).toEqual(before);
    expect(await f.quotaStore.getReservation(subject, reservation.reservationId)).toEqual(reservation);
    expect(await f.engine.getSnapshot({ identitySubject: subject })).toMatchObject({
      ok: true, snapshot: { day: { limitEstimatedUsdMicro: dayLimit, reservedEstimatedUsdMicro: 2400 },
        week: { limitEstimatedUsdMicro: weekBase, reservedEstimatedUsdMicro: 2400, cumulativeTopUpEstimatedUsdMicro: 0 } },
    });
    expect(await f.reserve('after_revoke')).toMatchObject({ status: 429, deniedWindow: 'week', denialClass: 'exhausted' });
    expect((await f.adminStore.audits(0, 25)).items.map((v) => v.action).sort()).toEqual(['approve', 'top_up', 'top_up_revoke'].sort());
    await f.mutate('revoke', 'revoke_access');
    expect(await f.reserve('after_access_revoke')).toMatchObject({ status: 403 });
    expect(await f.quotaStore.getReservation(subject, reservation.reservationId)).toEqual(reservation);
    expect(f.history.some((v) => v.keys.length === 7)).toBe(true);
    expect(f.history.some((v) => v.keys.length === 3)).toBe(true);
  });
  it.each([
    ['2026-09-27T15:59:59.999Z', '2026-09-27T16:00:00.000Z', '2026-W39', '2026-W40'],
    ['2027-01-03T15:59:59.999Z', '2027-01-03T16:00:00.000Z', '2026-W53', '2027-W01'],
  ])('Asia/Taipei 週一／ISO週年：%s → %s，舊追加不跨週且日限額不變', async (before, after, oldKey, newKey) => {
    const f = await setup(before);
    expect(await f.mutate('top_up', 'topup_before_week')).toMatchObject({ outcome: 'applied' });
    expect(await f.engine.getAtomicSnapshot(subject)).toMatchObject({ ok: true,
      snapshot: { day: { limitEstimatedUsdMicro: dayLimit },
        week: { windowKey: oldKey, limitEstimatedUsdMicro: 30_000_000, cumulativeTopUpEstimatedUsdMicro: 15_000_000 } } });
    const oldWindow = getQuotaWindows(new Date(before)).week;
    const grant = await f.reserve('before_boundary');
    expect(grant).toMatchObject({ ok: true, executionGrant: true });
    if (!grant.ok) throw new Error('跨週前應取得 grant');
    f.setTime(after);
    expect(await f.engine.getAtomicSnapshot(subject)).toMatchObject({ ok: true,
      snapshot: { day: { limitEstimatedUsdMicro: dayLimit },
        week: { windowKey: newKey, limitEstimatedUsdMicro: weekBase, cumulativeTopUpEstimatedUsdMicro: 0 } } });
    expect(await f.mutate('top_up', 'stale_week', { weekWindowKey: oldKey, expiresAt: oldWindow.resetAt })).toEqual({ outcome: 'invalid' });
    expect(await f.quotaStore.getReservation(subject, grant.reservation.reservationId)).toEqual(grant.reservation);
    expect((await f.adminStore.audits(0, 25)).items).toHaveLength(2);
    const next = await f.reserve('after_boundary');
    expect(next).toMatchObject({ ok: true, executionGrant: true,
      snapshot: { day: { limitEstimatedUsdMicro: dayLimit }, week: { windowKey: newKey, limitEstimatedUsdMicro: weekBase } } });
  });
});
