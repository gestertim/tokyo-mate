// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createRegistryBundle, costParametersDigest } from '../../api/_lib/cost-registry';
import { PROTECTED_ENDPOINTS, costModelOf } from '../../api/_lib/cost-price-table';
import { REDIS_QUOTA_LUA } from '../../api/_lib/redis-quota-script';
import { createRedisSharedStore, REDIS_QUOTA_KEYS } from '../../api/_lib/redis-shared-store';
import { REDIS_SESSION_LUA } from '../../api/_lib/redis-session-store';
import { createRedisSessionStore } from '../../api/_lib/redis-session-store';
import { createAtomicQuotaEngine } from '../../api/_lib/quota-engine';
import { getQuotaWindows } from '../../api/_lib/quota-window';
import { FIXTURE_ALL_LIVE } from '../fixtures/cost-price-fixtures';
import { fixtureRegistryEntry } from '../fixtures/cost-registry-fixtures';
import { FIXTURE_FINGERPRINT_KEY } from '../fixtures/quota-fingerprint-fixtures';
import { luaAvailable, runLuaRedis, type LuaInvocation } from '../support/lua-redis-harness';

const now = '2026-10-06T02:00:00.000Z';
const keys = REDIS_QUOTA_KEYS('{FIXTURE_005}');
function fixture(day = 10_000, week = 10_000, time = now) {
  const entries = PROTECTED_ENDPOINTS.map((e) => fixtureRegistryEntry(e, FIXTURE_ALL_LIVE));
  const bundle = createRegistryBundle(1, FIXTURE_ALL_LIVE, entries);
  const digests = Object.fromEntries(entries.map((e) => [e.endpoint, costParametersDigest(e)]));
  const windows = getQuotaWindows(new Date(time));
  const command = { identitySubject: 'user', idempotencyKey: 'one', reservationId: 'r-one', endpoint: 'assistant',
    amountMicroUsd: 2400, costModel: costModelOf(FIXTURE_ALL_LIVE), costParametersDigest: digests.assistant,
    requestFingerprint: 'a'.repeat(64), fingerprintKeyVersion: 'FIXTURE_KEY',
    estimateInputs: { inputTokens: 0 }, ...windows, expectedRegistry: bundle,
    tierLimits: { tier1: { dayLimitMicroUsd: day, weekBaseLimitMicroUsd: week },
      tier2: { dayLimitMicroUsd: day, weekBaseLimitMicroUsd: week } }, leaseMs: 60_000, nowIso: time };
  const call = (operation: string, c: object = command, at = time): LuaInvocation => ({
    script: REDIS_QUOTA_LUA, keys, command: { operation, command: c, digests }, now: at,
  });
  const initial = [call('publish', bundle), call('setEligibility', {
    identitySubject: 'user', status: 'approved', tier: 'tier1', expiresAt: null, nowIso: time,
  })];
  return { call, command, initial };
}

describe.skipIf(!luaAvailable)('Redis 業務 Lua（實際 interpreter；Redis/cjson 替身，非正式證據）', () => {
  it('首次grant、重複不grant、撤銷優先於重複，兩窗口只扣R_e', () => {
    const c = fixture(8036, 8036);
    const results = runLuaRedis([...c.initial, c.call('reserve'), c.call('reserve'),
      c.call('setEligibility', { identitySubject: 'user', status: 'revoked', tier: 'tier1', expiresAt: null }),
      c.call('reserve')]);
    expect(results[2]).toMatchObject({ status: 'reserved', executionGrant: true,
      usage: { day: { reservedMicroUsd: 2400 }, week: { reservedMicroUsd: 2400 } },
      registryDecision: { floorMicroUsd: 8036, decisionAt: now } });
    expect(results[3]).toMatchObject({ status: 'duplicate', executionGrant: false });
    expect(results[5]).toEqual({ status: 'not_eligible', reason: 'revoked' });
  });
  it.each([[8035, 10000, 'below_floor', 'day'], [10000, 8035, 'below_floor', 'week'],
    [0, 10000, 'exhausted', 'day'], [10000, 0, 'exhausted', 'week']] as const)(
    'G與分類：%s/%s -> %s/%s', (day, week, kind, window) => {
      const c = fixture(day, week);
      expect(runLuaRedis([...c.initial, c.call('reserve')])[2]).toMatchObject({
        status: 'denied', denialClass: kind, deniedWindow: window,
        usage: { day: { reservedMicroUsd: 0 }, week: { reservedMicroUsd: 0 } },
      });
    });
  it('Redis TIME跨週，不沿用caller舊窗口；ISO週年跨年一致', () => {
    for (const at of ['2026-09-27T15:59:59.999Z', '2026-09-27T16:00:00.000Z',
      '2027-01-03T15:59:59.999Z', '2027-01-03T16:00:00.000Z']) {
      const c = fixture(10000, 10000, at);
      const add = { identitySubject: 'user', topUpId: 'top', idempotencyKey: 'top', week: c.command.week,
        amountMicroUsd: 100, adminSubject: 'admin', reasonCode: 'FIXTURE', nowIso: at };
      const results = runLuaRedis([...c.initial, c.call('addTopUp', add)]);
      expect(results[2]).toMatchObject({ status: 'applied',
        topUp: { weekWindowKey: getQuotaWindows(new Date(at)).week.windowKey,
          expiresAt: getQuotaWindows(new Date(at)).week.resetAt } });
    }
    const c = fixture(10000, 10000, '2026-09-27T15:59:59.999Z');
    expect(runLuaRedis([...c.initial, c.call('reserve', c.command, '2026-09-27T16:00:00.000Z')])[2])
      .toEqual({ status: 'cost_model_invalid' });
  });
  it('週追加同鍵一次、不同鍵累加，舊suffix與延長期限拒絕', () => {
    const c = fixture(10000, 8035);
    const add = { identitySubject: 'user', topUpId: 'top', idempotencyKey: 'top', week: c.command.week,
      amountMicroUsd: 1, adminSubject: 'admin', reasonCode: 'FIXTURE', nowIso: now };
    const results = runLuaRedis([...c.initial, c.call('addTopUp', add), c.call('addTopUp', add),
      c.call('addTopUp', { ...add, topUpId: 'top2', idempotencyKey: 'top2' }),
      c.call('addTopUp', { ...add, week: { ...add.week, windowKey: `${add.week.windowKey}-AsiaTaipei` } }),
      c.call('addTopUp', { ...add, week: { ...add.week, resetAt: '2026-10-19T16:00:00.000Z' } }),
      c.call('reserve')]);
    expect(results[2]).toMatchObject({ status: 'applied', cumulativeTopUpMicroUsd: 1 });
    expect(results[3]).toMatchObject({ status: 'duplicate', cumulativeTopUpMicroUsd: 1 });
    expect(results[4]).toMatchObject({ status: 'applied', cumulativeTopUpMicroUsd: 2 });
    expect(results[5]).toEqual({ status: 'window_expired' });
    expect(results[6]).toEqual({ status: 'window_expired' });
    expect(results[7]).toMatchObject({ status: 'reserved', limits: { dayLimitMicroUsd: 10000, weekLimitMicroUsd: 8037 } });
  });
  it('追加跨週失效且不提高日限額；同週撤回不抹除既有預留', () => {
    const c = fixture(8036, 8035);
    const add = { identitySubject: 'user', topUpId: 'top', idempotencyKey: 'top', week: c.command.week,
      amountMicroUsd: 1, adminSubject: 'admin', reasonCode: 'FIXTURE', nowIso: now };
    const later = '2026-10-12T02:00:00.000Z';
    const next = { ...c.command, ...getQuotaWindows(new Date(later)), nowIso: later,
      reservationId: 'next', idempotencyKey: 'next' };
    const results = runLuaRedis([...c.initial, c.call('addTopUp', add), c.call('reserve'),
      c.call('revokeTopUp', { identitySubject: 'user', topUpId: 'top', adminSubject: 'admin', nowIso: now }),
      c.call('readUsage', { identitySubject: 'user', dayWindowKey: c.command.day.windowKey,
        weekWindowKey: c.command.week.windowKey }),
      c.call('reserve', next, later), c.call('addTopUp', add, later)]);
    expect(results[3]).toMatchObject({ status: 'reserved', limits: { dayLimitMicroUsd: 8036, weekLimitMicroUsd: 8036 } });
    expect(results[5]).toMatchObject({ day: { reservedMicroUsd: 2400 }, week: { reservedMicroUsd: 2400 } });
    expect(results[6]).toMatchObject({ status: 'denied', deniedWindow: 'week', denialClass: 'below_floor',
      limits: { weekTopUpMicroUsd: 0 } });
    expect(results[7]).toEqual({ status: 'window_expired' });
  });
  it('registry更新先成立，舊快照無grant；revision不可倒退或ABA重用', () => {
    const c = fixture();
    const entries = PROTECTED_ENDPOINTS.map((e) => fixtureRegistryEntry(e, FIXTURE_ALL_LIVE));
    const next = createRegistryBundle(2, FIXTURE_ALL_LIVE, entries);
    const results = runLuaRedis([...c.initial, c.call('publish', next), c.call('reserve'),
      c.call('reserve', { ...c.command, expectedRegistry: next }),
      c.call('publish', next)]);
    expect(results[3]).toEqual({ status: 'cost_model_invalid' });
    expect(results[4]).toMatchObject({ status: 'reserved' });
    expect(results[5]).toMatchObject({ fixtureError: expect.stringContaining('REGISTRY_REVISION_REUSED') });
  });
  it('大型合法週追加完整保存safe integer，不受cjson有效位數截短', () => {
    const c = fixture();
    const amount = Number.MAX_SAFE_INTEGER - 10_000;
    const results = runLuaRedis([...c.initial, c.call('addTopUp', { identitySubject: 'user', topUpId: 'large',
      idempotencyKey: 'large', week: c.command.week, amountMicroUsd: amount, adminSubject: 'admin',
      reasonCode: 'FIXTURE', nowIso: now }), c.call('readQuota')]);
    expect(results[2]).toMatchObject({ status: 'applied', cumulativeTopUpMicroUsd: amount,
      topUp: { amountMicroUsd: amount } });
    expect(results[3]).toMatchObject({ status: 'ok', limits: {
      weekTopUpMicroUsd: amount, weekLimitMicroUsd: Number.MAX_SAFE_INTEGER } });
  });
  it('清理冪等、uncertain保留原窗口；晚到只記錄不退款不regrant', () => {
    const c = fixture();
    const later = '2026-10-12T02:00:00.000Z';
    const results = runLuaRedis([...c.initial, c.call('reserve'),
      c.call('expireLeases', { identitySubject: 'user', nowIso: later }, later),
      c.call('expireLeases', { identitySubject: 'user', nowIso: later }, later),
      c.call('settle', { identitySubject: 'user', reservationId: 'r-one', transition: 'released',
        chargeMicroUsd: 0, costModelVersion: FIXTURE_ALL_LIVE.version, reason: 'unbilled', nowIso: later }, later)]);
    expect(results[3]).toMatchObject({ expired: 1,
      entries: [{ dayWindowKey: '2026-10-06', weekWindowKey: '2026-W41',
        reservation: { status: 'uncertain' }, usage: { day: { reservedMicroUsd: 2400 } } }] });
    expect(results[4]).toEqual({ expired: 0, entries: [] });
    expect(results[5]).toMatchObject({ status: 'invalid_transition', reservation: {
      status: 'uncertain', lateOutcomeObserved: { outcome: 'unbilled_failure' } },
    usage: { day: { reservedMicroUsd: 2400, usedMicroUsd: 0 } } });
  });
  it('超額如實入帳、同次雙封鎖及revision；新預留舊snapshot拒絕', () => {
    const c = fixture();
    const results = runLuaRedis([...c.initial, c.call('reserve'), c.call('settle', {
      identitySubject: 'user', reservationId: 'r-one', transition: 'settled', chargeMicroUsd: 2401,
      costModelVersion: FIXTURE_ALL_LIVE.version, reason: 'success', nowIso: now,
    }), c.call('registrySnapshot', {}), c.call('reserve', { ...c.command, idempotencyKey: 'next', reservationId: 'next' })]);
    expect(results[3]).toMatchObject({ status: 'applied', blockedCostModelVersion: FIXTURE_ALL_LIVE.version,
      blockedCostParametersDigest: c.command.costParametersDigest,
      usage: { day: { usedMicroUsd: 2401, reservedMicroUsd: 0 } } });
    expect(results[4]).toMatchObject({ revision: 2 });
    expect(results[5]).toEqual({ status: 'cost_model_invalid' });
  });
  it('Session共享writer：每次get、revoke後仍查store且不再有效', () => {
    const sessionId = 'a'.repeat(64);
    const record = { sessionId, identitySubject: 'user', createdAt: now,
      expiresAt: '2026-10-06T02:01:00.000Z', revokedAt: null };
    const call = (command: object): LuaInvocation => ({ script: REDIS_SESSION_LUA, keys, command, now });
    const results = runLuaRedis([call({ operation: 'create', sessionId, record }),
      call({ operation: 'get', sessionId }), call({ operation: 'revoke', sessionId }),
      call({ operation: 'get', sessionId }), call({ operation: 'create', sessionId, record }),
      { ...call({ operation: 'readQuota', command: { identitySubject: 'user', ...getQuotaWindows(new Date(now)),
        tierLimits: { tier1: { dayLimitMicroUsd: 10000, weekBaseLimitMicroUsd: 10000 } }, nowIso: now } }),
        script: REDIS_QUOTA_LUA }]);
    expect(results[1]).toEqual(record);
    expect(results[3]).toEqual({ ...record, revokedAt: now });
    expect(results[4]).toMatchObject({ fixtureError: expect.stringContaining('SESSION_ID_COLLISION') });
    expect(results[5]).toEqual({ status: 'not_eligible', reason: 'missing' });
  });
  it('真實adapter接engine，snapshot/grant/settlement/雙封鎖均驗證（transport仍為Lua替身）', async () => {
    const history: LuaInvocation[] = [];
    const transport = { eval: vi.fn(async (script: string, evalKeys: readonly string[], json: string) => {
      history.push({ script, keys: evalKeys, command: JSON.parse(json), now });
      const result = runLuaRedis(history).at(-1);
      if (result && typeof result === 'object' && 'fixtureError' in result) throw new Error(String(result.fixtureError));
      return JSON.stringify(result);
    }) };
    const store = createRedisSharedStore({ transport, namespace: '{FIXTURE_005}', timeoutMs: 1000, audit: vi.fn() });
    const entries = PROTECTED_ENDPOINTS.map((e) => fixtureRegistryEntry(e, FIXTURE_ALL_LIVE));
    await store.publishRegistry(createRegistryBundle(1, FIXTURE_ALL_LIVE, entries));
    await store.setEligibility({ identitySubject: 'user', status: 'approved', tier: 'tier1', expiresAt: null, nowIso: now });
    expect((await store.snapshot()).registryRevision).toBe(1);
    const engine = createAtomicQuotaEngine({ store, costRegistry: store, fingerprintKey: FIXTURE_FINGERPRINT_KEY,
      now: () => new Date(now), newId: () => 'r-one', leaseMs: 60_000, storeTimeoutMs: 1000,
      tierLimits: { tier1: { dayLimitMicroUsd: 10_000, weekBaseLimitMicroUsd: 10_000 },
        tier2: { dayLimitMicroUsd: 10_000, weekBaseLimitMicroUsd: 10_000 } } });
    expect(await engine.getAtomicSnapshot('user')).toMatchObject({ ok: true });
    const first = await engine.reserve({ identitySubject: 'user', endpoint: 'assistant', idempotencyKey: 'one',
      content: 'fixture' }, { inputTokens: 0 });
    expect(first).toMatchObject({ ok: true, executionGrant: true });
    if (!first.ok) throw new Error('fixture 未取得grant');
    const raw = await store.settle({ identitySubject: 'user', reservationId: first.reservation.reservationId,
      transition: 'settled', chargeMicroUsd: 2401, costModelVersion: FIXTURE_ALL_LIVE.version,
      reason: 'fixture', nowIso: now });
    expect(raw).toMatchObject({ status: 'applied', blockedCostParametersDigest: first.reservation.costParametersDigest });
    const snapshot = await store.snapshot();
    expect(snapshot.registryRevision).toBe(2);
    expect(snapshot.entries.filter((e) => e.table.endpoints[e.endpoint].live).every((e) => e.blocked)).toBe(true);
    expect(await engine.getAtomicSnapshot('user')).toMatchObject({ status: 503 });
  });
  it('參數化Session清理只刪過期且已滿保存期，重跑冪等不刪有效Session', async () => {
    let time = now;
    const history: LuaInvocation[] = [];
    const store = createRedisSessionStore({ namespace: '{FIXTURE_005}', timeoutMs: 1000, audit: vi.fn(),
      transport: { eval: async (script, evalKeys, json) => {
        history.push({ script, keys: evalKeys, command: JSON.parse(json), now: time });
        return JSON.stringify(runLuaRedis(history).at(-1));
      } } });
    const sessionId = 'b'.repeat(64);
    await store.create({ sessionId, identitySubject: 'user', createdAt: now,
      expiresAt: '2026-10-06T02:01:00.000Z', revokedAt: null });
    expect(await store.cleanup({ retentionMs: 1000, batchSize: 10, cursor: '0' })).toEqual({ cursor: '0', removed: 0 });
    time = '2026-10-06T02:01:01.000Z';
    expect(await store.cleanup({ retentionMs: 1000, batchSize: 10, cursor: '0' })).toEqual({ cursor: '0', removed: 1 });
    expect(await store.get(sessionId)).toBeNull();
    expect(await store.cleanup({ retentionMs: 1000, batchSize: 10, cursor: '0' })).toEqual({ cursor: '0', removed: 0 });
  });
});

describe('Redis adapter 不配置正式服務、不fallback', () => {
  it('單次EVAL、malformed fail-closed，有明確稽核且無重試', async () => {
    const transport = { eval: vi.fn(async () => '{"status":"reserved"}') };
    const audit = vi.fn();
    const store = createRedisSharedStore({ transport, namespace: '{FIXTURE_005}', timeoutMs: 20, audit });
    await expect(store.expireLeases('user', now)).rejects.toThrow('INVALID_REDIS_STORE_DATA');
    expect(transport.eval).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledOnce();
  });
  it('未指定registry或不同hash slot不得拼read/write授權', () => {
    expect(() => createRedisSharedStore({ transport: { eval: vi.fn() }, namespace: 'invalid',
      timeoutMs: 20, audit: vi.fn() })).toThrow();
  });
});
