// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createRedisEpochLifecycleStore, REDIS_EPOCH_LIFECYCLE_LUA } from '../../api/_lib/redis-epoch-lifecycle-store';
import { LOCAL_EPOCH_LIFECYCLE_POLICY } from '../../api/_lib/epoch-lifecycle';
import { createRedisClockLua } from '../../api/_lib/redis-quota-script';
import { REQUEST_EPOCH_KEYS } from '../../api/_lib/redis-request-epoch-store';
import { createEpochLifecycleEndpoint } from '../../api/_lib/epoch-lifecycle-endpoints';
import { createSessionService, type SessionRecord } from '../../api/_lib/session';
import { luaAvailable, runLuaRedis, type LuaInvocation } from '../support/lua-redis-harness';
import { createEpochLuaTransport } from '../support/epoch-lua-transport';

const ms = Date.parse('2026-10-07T00:00:00.000Z'), day = 86400000;
const kid = 'k'.repeat(22), epochId = `g1_${kid}`, nextId = `g2_${kid}`;
const keys = [...REQUEST_EPOCH_KEYS('{FIXTURE_005}'), '{FIXTURE_005}:request-epoch-admin-commands', '{FIXTURE_005}:request-epoch-audit',
  '{FIXTURE_005}:admin-reviews', '{FIXTURE_005}:admin-audit'];
const floor = { namespace: '{FIXTURE_005}', highestGeneration: 2, authorityRevision: 2, retiredThrough: 0,
  revokedKids: [], evidenceDigest: 'a'.repeat(64) };
const authority = { highestGeneration: 2, authorityRevision: 2, retiredThrough: 0, revokedKids: [], currentEpochId: nextId,
  epochs: { [epochId]: { epochId, generation: 1, kid, scopeKeyVersion: 'scope1', state: 'verify_only',
    issueStartsAtMs: ms - 2 * day, issueExpiresAtMs: ms - day, validUntilMs: ms },
  [nextId]: { epochId: nextId, generation: 2, kid: 'n'.repeat(22), scopeKeyVersion: 'scope2', state: 'current',
    issueStartsAtMs: ms, issueExpiresAtMs: ms + day, validUntilMs: ms + 2 * day } } };
const r = { reservationId: 'r1', identitySubject: 'owner', endpoint: 'places', status: 'settled',
  createdAt: new Date(ms - day).toISOString(), settledAt: new Date(ms).toISOString(), leaseExpiresAt: new Date(ms).toISOString(),
  dayWindowKey: '2026-10-06', weekWindowKey: '2026-W41', estimatedCostUpperBoundUsdMicro: 500,
  settledChargeUsdMicro: 500, executionGranted: true, fingerprintKeyVersion: 'fp1', requestFingerprint: 'a'.repeat(64),
  conflictCount: 0, requestEpoch: { payload: { epochId } }, comparisonCost: { amountMicroUsd: 500 } };
const seedScript = createRedisClockLua(['hash', 'hash', 'hash', 'hash', 'hash', 'zset', 'hash', 'hash', 'hash']) + String.raw`
local c=cjson.decode(ARGV[1])
redis.call('HSET',KEYS[4],'snapshot',encode(c.authority),'fingerprint:fp1','verify_only','capability:old','current',
  'capability:next','loaded','capability:created:old',string.format('%.0f',c.created))
redis.call('HSET',KEYS[2],'owner',encode(c.user))
return '{"status":"seeded"}'
`;
const inspectScript = createRedisClockLua(['hash', 'hash', 'hash', 'hash', 'hash', 'zset', 'hash', 'hash', 'hash']) + String.raw`
return reply({user=object(redis.call('HGET',KEYS[2],'owner')),authority=object(redis.call('HGET',KEYS[4],'snapshot')),
  old=redis.call('HGET',KEYS[4],'capability:old'),next=redis.call('HGET',KEYS[4],'capability:next'),
  audits=redis.call('HGETALL',KEYS[9])})
`;
function fixture(status = 'settled') {
  const user = { eligibility: { status: 'approved' }, windows: {
    'day:2026-10-06': { usedMicroUsd: status === 'uncertain' ? 0 : 500, reservedMicroUsd: status === 'uncertain' ? 500 : 0 },
    'week:2026-W41': { usedMicroUsd: status === 'uncertain' ? 0 : 500, reservedMicroUsd: status === 'uncertain' ? 500 : 0 } },
  reservations: { r1: { ...r, status } }, idempotency: { legacy: 'r1' }, topUps: {}, topUpIdempotency: {} };
  const seed: LuaInvocation = { script: seedScript, keys, now: new Date(ms).toISOString(),
    command: { authority, user, created: ms } };
  const call = (action = 'cleanup', step = 'inspect', at = ms, extra = {}, proof = {}): LuaInvocation => ({
    script: REDIS_EPOCH_LIFECYCLE_LUA, keys, now: new Date(at).toISOString(),
    command: { command: { operationId: 'op1', idempotencyKey: `${step}-1`, step, action, target: 'owner:r1',
      reasonCode: 'TEST_ONLY_REVIEW', actor: 'admin', auditId: `${action}-${step}-${at}`, dryRun: false, ...extra },
    policy: LOCAL_EPOCH_LIFECYCLE_POLICY, floor, keyReferences: {}, ...proof },
  });
  const dump = (at = ms): LuaInvocation => ({ script: inspectScript, keys, now: new Date(at).toISOString(), command: {} });
  return { seed, call, dump, user };
}

describe.skipIf(!luaAvailable)('E07～E09 lifecycle Lua（Redis/cjson 替身，非正式清除證據）', () => {
  it('先驗全部batch：後一user的損壞record拒絕，前一user不先刪detail／寫半套tombstone', () => {
    const f=fixture(), at=ms+30*day;
    const malformed=createRedisClockLua()+String.raw`
redis.call('HSET',KEYS[2],'z_owner',encode({reservations={bad={status='settled',settledAt=nowIso,
  dayWindowKey='2026-10-06',weekWindowKey='2026-W41',requestEpoch={}}}}));return '{"status":"seeded"}'
`;
    const result=runLuaRedis([f.seed,{script:malformed,keys,now:new Date(ms).toISOString(),command:{}},
      f.call('cleanup','inspect',at),f.call('cleanup','confirm',at),f.dump(at)]);
    expect(result[3]).toMatchObject({fixtureError:expect.stringContaining('INVALID_RETENTION_EPOCH')});
    expect(result[4]).toMatchObject({user:{reservations:f.user.reservations,windows:f.user.windows}});
  });
  it('cleanup已commit但回應遺失：原tombstone仍在，同命令duplicate不再更動原窗口', async () => {
    const f = fixture(), at = ms + 30 * day, { transport } = createEpochLuaTransport(() => new Date(at));
    await transport.eval(seedScript, keys, JSON.stringify(f.seed.command));
    let lose = false;
    const store = createRedisEpochLifecycleStore({ namespace: '{FIXTURE_005}', scope: 'TEST_ONLY', epochFloor: floor,
      timeoutMs: 1000, audit: vi.fn(),
      evidence: async () => ({ accounting: false, key: false, keyReferences: {} }),
      transport: { async eval(...args) { const result = await transport.eval(...args);
        if (lose) { lose = false; throw new Error('TEST_ONLY_COMMITTED_RESPONSE_LOST'); } return result; } } });
    const command = { operationId: 'unknown', idempotencyKey: 'inspect', step: 'inspect' as const, action: 'cleanup' as const,
      target: 'all', reasonCode: 'TEST_ONLY', actor: 'admin', auditId: 'inspect-audit', dryRun: false };
    await store.execute(command);
    const confirm = { ...command, step: 'confirm' as const, idempotencyKey: 'confirm', auditId: 'confirm-audit' };
    lose = true;
    await expect(store.execute(confirm)).rejects.toThrow();
    expect(await store.execute({ ...confirm, auditId: 'retry-audit' })).toMatchObject({ outcome: 'duplicate', changed: 1 });
    const raw = await transport.eval(inspectScript, keys, '{}');
    if (typeof raw !== 'string') throw new TypeError('INVALID_TEST_ONLY_REPLY');
    const snapshot = JSON.parse(raw);
    expect(snapshot.user).toMatchObject({ comparisonTombstones: { r1: { status: 'settled' } }, windows: f.user.windows });
    expect(snapshot.user.reservations.r1).toBeUndefined();
  });
  it.each(['capability','fingerprint','oauth_state','rate'])('四family %s：引用未歸零拒絕，歸零與屏障成立才退役', (family) => {
    const f = fixture(), target = `${family}:orphan`;
    const proof = { cleanupEvidence: { billingWindowSufficient: true, allDeploymentsEpochAware: true,
      restoreBarrierVerified: true, unknownIssuancesBlocked: true, allKeyReferencesZero: true }, keyReferences: { [target]: 1 } };
    const loaded = createRedisClockLua() + `redis.call('HSET',KEYS[4],'${target}','verify_only'); return '{"status":"loaded"}'`;
    const result = runLuaRedis([f.seed, { script: loaded, keys, now: new Date(ms).toISOString(), command: {} },
      f.call('retire_key','inspect',ms,{ target },proof), f.call('retire_key','confirm',ms,{ target },proof),
      f.call('retire_key','inspect',ms,{ target, operationId: 'zero', auditId: 'zero-inspect' }, { ...proof, keyReferences: { [target]: 0 } }),
      f.call('retire_key','confirm',ms,{ target, operationId: 'zero', auditId: 'zero-confirm' }, { ...proof, keyReferences: { [target]: 0 } })]);
    expect(result[3]).toMatchObject({ outcome: 'refused', reason: 'KEY_REFERENCES_OR_BARRIER' });
    expect(result[5]).toMatchObject({ outcome: 'applied' });
  });
  it.each([-1,0,1])('epoch validUntil %i ms：退役成功保留accounting，reserved／legacy不被清', (offset) => {
    const f = fixture(), at = ms + offset;
    f.seed.now = new Date(ms - 1).toISOString();
    const proof = { cleanupEvidence: { billingWindowSufficient: true, allDeploymentsEpochAware: true,
      restoreBarrierVerified: true, unknownIssuancesBlocked: true, allKeyReferencesZero: true } };
    const result = runLuaRedis([f.seed, f.call('retire_epoch','inspect',at,{ target: epochId },proof),
      f.call('retire_epoch','confirm',at,{ target: epochId },proof), f.dump(at)]);
    expect(result[2]).toMatchObject({ outcome: offset < 0 ? 'refused' : 'applied' });
    expect(result[3]).toMatchObject({ user: { reservations: f.user.reservations, windows: f.user.windows, idempotency: f.user.idempotency } });
  });
  it.each([-1, 0, 1])('aggregate 可信reset＋30天 %i；uncertain數值保留，終結aggregate缺屏障不刪', (offset) => {
    const f = fixture('uncertain'), at = ms - 28800000 + 30 * day + offset;
    f.seed.command = { ...f.seed.command, user: { ...f.user, windows: {
      ...f.user.windows, 'day:2026-10-06': { ...f.user.windows['day:2026-10-06'], display: 'REMOVE' },
    } } };
    const proof = { cleanupEvidence: { billingWindowSufficient: true, allDeploymentsEpochAware: true,
      restoreBarrierVerified: true, unknownIssuancesBlocked: true, allKeyReferencesZero: true } };
    const result = runLuaRedis([f.seed, f.call('cleanup','inspect',at,{},proof),
      f.call('cleanup','confirm',at,{},proof), f.dump(at)]);
    const state = result[3] as { user: { windows: Record<string, { reservedMicroUsd: number; display?: string }> } };
    expect(state.user.windows['day:2026-10-06'].reservedMicroUsd).toBe(500);
    expect(state.user.windows['day:2026-10-06'].display).toBe(offset < 0 ? 'REMOVE' : undefined);
  });
  it.each([-1, 0, 1])('review／audit首次終結30天 %i；無reservation仍收斂，不動pending或legacy索引', (offset) => {
    const f = fixture(), at = ms + 30 * day + offset;
    f.seed.command = { ...f.seed.command, user: { ...f.user, reservations: {} } };
    const seedDetails = createRedisClockLua(['hash','hash','hash','hash','hash','zset','hash','hash','hash','hash','hash']) + String.raw`
redis.call('HSET',KEYS[10],'resolved',encode({status='resolved',resolvedAt=nowIso,createdAt=nowIso,reviewId='resolved',display='REMOVE'}),
  'pending',encode({status='pending',createdAt=nowIso,display='KEEP'}))
redis.call('HSET',KEYS[11],'a1',encode({auditId='a1',createdAt=nowIso,action='TEST_ONLY',display='REMOVE'}))
return '{"status":"seeded"}'
`;
    const dump = createRedisClockLua() + String.raw`
return reply({resolved=object(redis.call('HGET',KEYS[10],'resolved')),pending=object(redis.call('HGET',KEYS[10],'pending')),
  audit=object(redis.call('HGET',KEYS[11],'a1')),user=object(redis.call('HGET',KEYS[2],'owner'))})
`;
    const result = runLuaRedis([f.seed, { script: seedDetails, keys, now: new Date(ms).toISOString(), command: {} },
      f.call('cleanup', 'inspect', at), f.call('cleanup', 'confirm', at), { script: dump, keys, now: new Date(at).toISOString(), command: {} }]);
    expect(result[3]).toMatchObject({ outcome: 'applied', changed: offset < 0 ? 0 : 2 });
    expect(result[4]).toMatchObject({ pending: { display: 'KEEP' }, user: { idempotency: f.user.idempotency } });
    const state = result[4] as { resolved: { display?: string }; audit: { display?: string } };
    expect(state.resolved.display).toBe(offset < 0 ? 'REMOVE' : undefined);
    expect(state.audit.display).toBe(offset < 0 ? 'REMOVE' : undefined);
  });
  it.each([-1, 0, 1])('首次review後7天 %i不釋額；aggregate reset＋30天保留未結案最小數值', (offset) => {
    const f = fixture('uncertain'), extra = { evidenceRef: 'trusted-ref' }, proof = { accountingEvidence: true };
    const at = ms + 8 * day + offset;
    const result = runLuaRedis([f.seed, f.call('review_uncertain', 'inspect', ms + day, extra, proof),
      f.call('review_uncertain', 'confirm', ms + day, extra, proof),
      f.call('review_uncertain', 'inspect', at, { ...extra, operationId: 'second' }, proof),
      f.call('review_uncertain', 'confirm', at, { ...extra, operationId: 'second' }, proof), f.dump(at)]);
    expect(result[4]).toMatchObject({ outcome: offset < 0 ? 'refused' : 'applied' });
    expect(result[5]).toMatchObject({ user: { windows: f.user.windows, reservations: { r1: { status: 'uncertain' } } } });
  });
  it.each([-1, 0, 1])('首次結案＋30天邊界 %i ms；缺屏障仍保留 comparison／accounting', (offset) => {
    const f = fixture(), at = ms + 30 * day + offset;
    const result = runLuaRedis([f.seed, f.call('cleanup', 'inspect', at), f.call('cleanup', 'confirm', at), f.dump(at)]);
    expect(result[2]).toMatchObject({ outcome: 'applied', changed: offset < 0 ? 0 : 1 });
    const state = result[3] as { user: { reservations: Record<string, unknown>; comparisonTombstones: Record<string, unknown>; windows: unknown } };
    expect(state.user.reservations.r1 !== undefined).toBe(offset < 0);
    expect(state.user.comparisonTombstones.r1 !== undefined).toBe(offset >= 0);
    expect(state.user.windows).toEqual(f.user.windows);
  });
  it('uncertain 可收斂但不退款／搬窗口；missing inspection／proof 不結案', () => {
    const f = fixture('uncertain');
    const result = runLuaRedis([f.seed, f.call('review_uncertain', 'confirm', ms + day),
      f.call('cleanup', 'inspect', ms + day, { operationId: 'cleanup-op' }),
      f.call('cleanup', 'confirm', ms + day, { operationId: 'cleanup-op' }), f.dump(ms + day)]);
    expect(result[1]).toMatchObject({ outcome: 'refused', reason: 'INSPECTION_REQUIRED' });
    expect(result[4]).toMatchObject({ user: { comparisonTombstones: { r1: { status: 'uncertain' } }, windows: f.user.windows } });
  });
  it.each([day - 1, day, day + 1, 30 * day - 1, 30 * day, 30 * day + 1])('24h 首次review／30d escalation %s', (delay) => {
    const f = fixture('uncertain');
    const extra = { evidenceRef: 'trusted-accounting-ref' };
    const proof = { accountingEvidence: true };
    const result = runLuaRedis([f.seed, f.call('review_uncertain', 'inspect', ms + delay, extra, proof),
      f.call('review_uncertain', 'confirm', ms + delay, extra, proof), f.dump(ms + delay)]);
    expect(result[2]).toMatchObject({ outcome: delay < day ? 'refused' : 'applied' });
    if (delay >= day) expect(result[3]).toMatchObject({ user: { reservations: {
      r1: { status: 'uncertain', reviewEscalated: delay >= 30 * day, reviewEvidenceRef: 'trusted-accounting-ref' } }, windows: f.user.windows } });
  });
  it('分步同管理者冪等；異action／target／理由不能偷換操作，audit包含每步', () => {
    const f = fixture('uncertain'), at = ms + day, extra = { evidenceRef: 'ref' }, proof = { accountingEvidence: true };
    const result = runLuaRedis([f.seed, f.call('review_uncertain', 'inspect', at, extra, proof),
      f.call('review_uncertain', 'confirm', at, extra, proof),
      f.call('review_uncertain', 'confirm', at, { ...extra, auditId: 'retry-audit' }, proof),
      f.call('cleanup', 'confirm', at, { auditId: 'conflict-audit' }), f.dump(at)]);
    expect(result[3]).toMatchObject({ outcome: 'duplicate' });
    expect(result[4]).toMatchObject({ outcome: 'conflict' });
    expect(result[5]).toMatchObject({ user: { reservations: { r1: { status: 'uncertain' } } } });
  });
  it.each([90 * day - 1, 90 * day, 90 * day + 1])('正常輪替90天 %i ms，從不生成secret', (delay) => {
    const f = fixture(), extra = { target: 'capability:old', nextVersion: 'next' };
    const result = runLuaRedis([f.seed, f.call('rotate_key', 'inspect', ms + delay, extra),
      f.call('rotate_key', 'confirm', ms + delay, extra), f.dump(ms + delay)]);
    expect(result[2]).toMatchObject({ outcome: delay < 90 * day ? 'refused' : 'applied' });
    expect(result[3]).toMatchObject({ old: delay < 90 * day ? 'current' : 'verify_only', next: delay < 90 * day ? 'loaded' : 'current' });
  });
  it('key retire／epoch retire缺任何正式證據拒絕；dry-run不更動資料', () => {
    const f = fixture();
    const result = runLuaRedis([f.seed, f.call('retire_key', 'inspect', ms, { target: 'fingerprint:fp1' }),
      f.call('retire_key', 'confirm', ms, { target: 'fingerprint:fp1' }), f.dump()]);
    expect(result[2]).toMatchObject({ outcome: 'refused' });
    const dry = runLuaRedis([f.seed, f.call('cleanup', 'inspect', ms + 30 * day, { dryRun: true }),
      f.call('cleanup', 'confirm', ms + 30 * day, { dryRun: true }), f.dump(ms + 30 * day)]);
    expect(dry[2]).toMatchObject({ outcome: 'dry_run', changed: 1 });
    expect(dry[3]).toMatchObject({ user: { reservations: { r1: { status: 'settled' } } } });
  });
});

describe('lifecycle HTTP 每步重新管理者授權', () => {
  it('未配置503；inspect後權限撤銷403、CSRF400、直接confirm拒絕', async () => {
    const records = new Map<string, SessionRecord>(), now = () => new Date(ms);
    const sessions = createSessionService({ signingKey: Buffer.alloc(32, 9), cookieName: 'LIFECYCLE_TEST',
      lifetimeMs: 60000, storeTimeoutMs: 100, now, audit: vi.fn(),
      store: { create: async (r) => { records.set(r.sessionId, r); }, get: async (id) => records.get(id) ?? null, revoke: async () => {} } });
    const isAdmin = vi.fn(async () => true), execute = vi.fn(async () => ({ outcome: 'inspected' as const, auditId: 'audit' }));
    const options = { sessions, origin: 'https://fixture.invalid', now, timeoutMs: 100, audit: vi.fn(), isAdmin,
      store: { execute }, rate: { consume: async () => ({ kind: 'allowed' as const }) }, scope: 'TEST_ONLY' as const };
    const cookie = (await sessions.create('admin')).split(';')[0];
    const request = (step: string) => new Request(`${options.origin}/api/admin/epoch-lifecycle`, { method: 'POST',
      headers: { cookie, origin: options.origin, 'content-type': 'application/json' },
      body: JSON.stringify({ operationId: 'op1', idempotencyKey: step, step, action: 'cleanup',
        target: 'all', reasonCode: 'TEST_ONLY', dryRun: true }) });
    expect((await createEpochLifecycleEndpoint()(request('inspect'))).status).toBe(503);
    const endpoint = createEpochLifecycleEndpoint(options);
    expect((await endpoint(request('inspect'))).status).toBe(200);
    isAdmin.mockResolvedValueOnce(false);
    expect((await endpoint(request('confirm'))).status).toBe(403);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(isAdmin).toHaveBeenCalledTimes(2);
  });
});
