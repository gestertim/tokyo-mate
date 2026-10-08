// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createRegistryBundle, costParametersDigest } from '../../api/_lib/cost-registry';
import { costModelOf, PROTECTED_ENDPOINTS } from '../../api/_lib/cost-price-table';
import { REQUEST_EPOCH_KEYS, REDIS_REQUEST_EPOCH_LUA } from '../../api/_lib/redis-request-epoch-store';
import { REDIS_QUOTA_LUA, createRedisClockLua } from '../../api/_lib/redis-quota-script';
import { getQuotaWindows } from '../../api/_lib/quota-window';
import { FIXTURE_ALL_LIVE } from '../fixtures/cost-price-fixtures';
import { fixtureRegistryEntry } from '../fixtures/cost-registry-fixtures';
import { luaAvailable, runLuaRedis, type LuaInvocation } from '../support/lua-redis-harness';

const now = '2026-10-06T02:00:00.000Z', ms = Date.parse(now);
const kid = 'k'.repeat(22), epochId = `g7_${kid}`;
const keys = REQUEST_EPOCH_KEYS('{FIXTURE_005}');
const floor = { namespace: '{FIXTURE_005}', highestGeneration: 7, authorityRevision: 1,
  retiredThrough: 0, revokedKids: [], evidenceDigest: 'a'.repeat(64) };
const authority = { authorityRevision: 1, highestGeneration: 7, retiredThrough: 0, currentEpochId: epochId,
  revokedKids: [], epochs: { [epochId]: { epochId, generation: 7, kid, scopeKeyVersion: 'scope-v1',
    issueStartsAtMs: ms - 1000, issueExpiresAtMs: ms + 60000, validUntilMs: ms + 172800000, state: 'current' } } };
const payload = { generation: 7, epochId, kid, scopeKeyVersion: 'scope-v1', ownerScope: 's'.repeat(43),
  endpoint: 'assistant', operationHandle: 'h'.repeat(43), issuedAtMs: ms, expiresAtMs: ms + 86400000 };
const issuance = { ...payload, identitySubject: 'user', commandId: `${epochId}.123e4567-e89b-42d3-a456-426614174000`,
  commandIndex: 'c'.repeat(43), handleIndex: 'i'.repeat(43), capability: 'TEST_ONLY_TOKEN', preparedAtMs: ms };
const seedScript = createRedisClockLua(['hash', 'hash', 'hash', 'hash', 'hash', 'zset', 'hash']) + String.raw`
local c=cjson.decode(ARGV[1])
redis.call('HSET',KEYS[4],'snapshot',encode(c.authority),'fingerprintCurrent','fp2','fingerprint:fp2','current','fingerprint:fp1','verify_only')
for _,e in pairs(c.authority.epochs) do redis.call('HSET',KEYS[4],'capability:'..e.kid,e.state=='current' and 'current' or 'verify_only') end
return '{"status":"seeded"}'
`;
function fixture(day = 10000, week = 10000) {
  const entries = PROTECTED_ENDPOINTS.map((e) => fixtureRegistryEntry(e, FIXTURE_ALL_LIVE));
  const bundle = createRegistryBundle(1, FIXTURE_ALL_LIVE, entries);
  const digests = Object.fromEntries(entries.map((e) => [e.endpoint, costParametersDigest(e)]));
  const command = { identitySubject: 'user', idempotencyKey: payload.operationHandle, reservationId: 'r-one',
    endpoint: 'assistant', amountMicroUsd: 2400, costModel: costModelOf(FIXTURE_ALL_LIVE),
    costParametersDigest: digests.assistant, requestFingerprint: 'a'.repeat(64), fingerprintKeyVersion: 'fp2',
    comparisonCost: { amountMicroUsd: 2400, costParametersDigest: digests.assistant },
    estimateInputs: { inputTokens: 0 }, ...getQuotaWindows(new Date(now)), expectedRegistry: bundle,
    tierLimits: { tier1: { dayLimitMicroUsd: day, weekBaseLimitMicroUsd: week },
      tier2: { dayLimitMicroUsd: day, weekBaseLimitMicroUsd: week } }, leaseMs: 60000, nowIso: now,
    requestEpoch: { payload, commandIndex: issuance.commandIndex, handleIndex: issuance.handleIndex, accountingIndex: 'a'.repeat(64) } };
  const call = (operation: string, c: object = command, at = now): LuaInvocation =>
    ({ script: REDIS_QUOTA_LUA, keys, command: { operation, command: c, floor, digests }, now: at });
  const seed = (a: object = authority): LuaInvocation => ({ script: seedScript, keys, command: { authority: a }, now });
  const initial = [seed(), call('publish', bundle), call('setEligibility',
    { identitySubject: 'user', status: 'approved', tier: 'tier1', expiresAt: null }),
  { script: REDIS_REQUEST_EPOCH_LUA, keys, command: { operation: 'issue', command: issuance, floor }, now }];
  return { command, call, seed, initial };
}

describe.skipIf(!luaAvailable)('E05／E06 原子首次 grant（Lua interpreter＋Redis/cjson 替身）', () => {
  it('verify-only capability 首次 reserve 一次、duplicate／conflict 無第二 grant，unused 釋放', () => {
    const f = fixture();
    const rotated = { ...authority, epochs: { [epochId]: { ...authority.epochs[epochId], state: 'verify_only' } } };
    const result = runLuaRedis([...f.initial, f.seed(rotated), f.call('reserve'), f.call('reserve'),
      f.call('reserve', { ...f.command, requestFingerprint: 'b'.repeat(64) }),
      f.call('getEpochBinding', { identitySubject: 'user', accountingIndex: 'a'.repeat(64) })]);
    expect(result[5]).toMatchObject({ status: 'reserved', executionGrant: true });
    expect(result[6]).toMatchObject({ status: 'duplicate', executionGrant: false });
    expect(result[7]).toMatchObject({ status: 'idempotency_conflict' });
    expect(result[8]).toMatchObject({ requestEpoch: { accountingIndex: 'a'.repeat(64) }, conflictCount: 1 });
  });
  it.each(['retire-first', 'reserve-first'] as const)('retire／reserve 線性順序 %s', (order) => {
    const f = fixture();
    const retired = { ...authority, retiredThrough: 7, authorityRevision: 2 };
    const operations = order === 'retire-first' ? [f.seed(retired), f.call('reserve')] :
      [f.call('reserve'), f.seed(retired), f.call('reserve')];
    const result = runLuaRedis([...f.initial, ...operations, f.call('readUsage', {
      identitySubject: 'user', dayWindowKey: f.command.day.windowKey, weekWindowKey: f.command.week.windowKey })]);
    expect(result.at(-2)).toEqual({ status: 'epoch_rejected' });
    expect(result.at(-1)).toMatchObject({ day: { reservedMicroUsd: order === 'reserve-first' ? 2400 : 0 },
      week: { reservedMicroUsd: order === 'reserve-first' ? 2400 : 0 } });
  });
  it.each([[8035, 10000, 'day'], [10000, 8035, 'week'], [8036, 8036, null]] as const)(
    'epoch 同次 registry／G／日週 %s/%s', (day, week, window) => {
      const f = fixture(day, week);
      expect(runLuaRedis([...f.initial, f.call('reserve')]).at(-1)).toMatchObject(window
        ? { status: 'denied', deniedWindow: window, denialClass: 'below_floor' } : { status: 'reserved' });
    });
  it('新 binding 不接受 verify-only fingerprint；已有 binding 固定原版本與成本', () => {
    const f = fixture();
    const r = runLuaRedis([...f.initial, f.call('reserve', { ...f.command, fingerprintKeyVersion: 'fp1' }),
      f.call('reserve'), f.call('reserve', { ...f.command, fingerprintKeyVersion: 'fp1' })]);
    expect(r[4]).toEqual({ status: 'epoch_rejected' });
    expect(r[5]).toMatchObject({ status: 'reserved' });
    expect(r[6]).toMatchObject({ status: 'idempotency_conflict' });
  });
  it('資格撤銷優先、key 撤銷拒絕、缺 restore manifest／低 floor fail closed', () => {
    const f = fixture();
    const result = runLuaRedis([...f.initial,
      f.call('setEligibility', { identitySubject: 'user', status: 'revoked', tier: 'tier1', expiresAt: null }),
      f.call('reserve')]);
    expect(result.at(-1)).toEqual({ status: 'not_eligible', reason: 'revoked' });
    const revoked = { ...authority, revokedKids: [kid] };
    expect(runLuaRedis([...f.initial, f.seed(revoked), f.call('reserve')]).at(-1)).toEqual({ status: 'epoch_rejected' });
    const missing = { ...f.call('reserve'), command: { operation: 'reserve', command: f.command } };
    expect(runLuaRedis([...f.initial, missing]).at(-1)).toMatchObject({ fixtureError: expect.stringContaining('MISSING_EPOCH_FLOOR') });
    const rollback = { ...f.call('reserve'), command: { operation: 'reserve', command: f.command, floor: { ...floor, highestGeneration: 8 } } };
    expect(runLuaRedis([...f.initial, rollback]).at(-1)).toMatchObject({ fixtureError: expect.stringContaining('EPOCH_ROLLBACK') });
  });
});
