// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { REQUEST_EPOCH_KEYS, REDIS_REQUEST_EPOCH_LUA } from '../../api/_lib/redis-request-epoch-store';
import { createRedisClockLua } from '../../api/_lib/redis-quota-script';
import { luaAvailable, runLuaRedis, type LuaInvocation } from '../support/lua-redis-harness';
import type { RequestEpochAuthority } from '../../api/_lib/request-epoch-store';

const now = '2026-10-06T02:00:00.000Z';
const nowMs = Date.parse(now);
const kid = Buffer.alloc(16, 0x22).toString('base64url');
const epochId = `g7_${kid}`;
const keys = REQUEST_EPOCH_KEYS('{FIXTURE_005}');
const kinds = ['hash', 'hash', 'hash', 'hash', 'hash', 'zset', 'hash'] as const;
const authority: RequestEpochAuthority = {
  authorityRevision: 1, highestGeneration: 7, retiredThrough: 0, currentEpochId: epochId, revokedKids: [],
  epochs: { [epochId]: { epochId, generation: 7, kid, scopeKeyVersion: 'scope-v1',
    issueStartsAtMs: nowMs - 1000, issueExpiresAtMs: nowMs + 60_000, validUntilMs: nowMs + 172_800_000, state: 'current' } },
};
const floor = { namespace: '{FIXTURE_005}', highestGeneration: 7, authorityRevision: 1,
  retiredThrough: 0, revokedKids: [], evidenceDigest: 'a'.repeat(64) };
const baseCommand = {
  identitySubject: 'owner', epochId, generation: 7, kid, scopeKeyVersion: 'scope-v1',
  ownerScope: 's'.repeat(43), endpoint: 'places', commandId: `${epochId}.123e4567-e89b-42d3-a456-426614174000`,
  commandIndex: 'c'.repeat(43), handleIndex: 'i'.repeat(43), operationHandle: 'h'.repeat(43),
  capability: 'x'.repeat(256), preparedAtMs: nowMs, issuedAtMs: nowMs, expiresAtMs: nowMs + 86_400_000,
};
const setupScript = createRedisClockLua(kinds) + String.raw`
local c=cjson.decode(ARGV[1])
redis.call('HSET',KEYS[4],'snapshot',cjson.encode(c.authority))
for _,e in pairs(c.authority.epochs) do redis.call('HSET',KEYS[4],'capability:'..e.kid,e.state=='current' and 'current' or 'verify_only') end
redis.call('HSET',KEYS[2],c.subject,cjson.encode(c.user))
return cjson.encode({status='seeded'})
`;
function call(script: string, command: object): LuaInvocation {
  return { script, keys, command: { ...command, floor }, now };
}

describe.skipIf(!luaAvailable)('Request epoch Lua（本機 Redis/cjson 替身，非真實 Redis 證據）', () => {
  it('可信publish不可ABA／rollback；預先發布next按TIME切換且保留舊驗證', () => {
    const start = Date.parse('2026-10-06T00:00:00.000Z'), day = 86400000, nextId = `g8_${'n'.repeat(22)}`;
    const published: RequestEpochAuthority = { ...authority, highestGeneration: 8, authorityRevision: 2,
      epochs: { [epochId]: { ...authority.epochs[epochId], issueStartsAtMs: start, issueExpiresAtMs: start + day, validUntilMs: start + 2 * day },
        [nextId]: { ...authority.epochs[epochId], epochId: nextId, generation: 8,
          issueStartsAtMs: start + day, issueExpiresAtMs: start + 2 * day, validUntilMs: start + 3 * day } } };
    const initial = { ...published, highestGeneration: 7, authorityRevision: 1, epochs: { [epochId]: published.epochs[epochId] } };
    const proof = { allVersionsEpochAware: true, restoreBarrierVerified: true };
    const load = createRedisClockLua(kinds) + String.raw`
redis.call('HSET',KEYS[4],'fingerprint:scope-v1','current'); return '{"status":"loaded"}'
`;
    const results = runLuaRedis([
      call(setupScript, { authority: initial, subject: 'owner', user: { eligibility: { status: 'approved', expiresAt: null } } }),
      call(load, {}),
      call(REDIS_REQUEST_EPOCH_LUA, { operation: 'publish', command: { authority: published, evidence: proof } }),
      { ...call(REDIS_REQUEST_EPOCH_LUA, { operation: 'authority' }), now: new Date(start + day - 1).toISOString() },
      { ...call(REDIS_REQUEST_EPOCH_LUA, { operation: 'authority' }), now: new Date(start + day).toISOString() },
      { ...call(REDIS_REQUEST_EPOCH_LUA, { operation: 'publish', command: { authority: published, evidence: proof } }),
        now: new Date(start + day).toISOString() },
    ]);
    expect(results[2]).toEqual({ status: 'published' });
    expect(results[3]).toMatchObject({ authority: { currentEpochId: epochId } });
    expect(results[4]).toMatchObject({ authority: { currentEpochId: nextId, authorityRevision: 3,
      epochs: { [epochId]: { state: 'verify_only' } } } });
    expect(results[5]).toMatchObject({ fixtureError: expect.stringContaining('EPOCH_PUBLICATION_ROLLBACK') });
  });
  it('原子核對資格、同命令回原紀錄、異endpoint conflict，退役後不重建miss', () => {
    const eligible = { eligibility: { identitySubject: 'owner', status: 'approved', tier: 'tier1', expiresAt: null } };
    const seed = call(setupScript, { authority, subject: 'owner', user: eligible });
    const issue = call(REDIS_REQUEST_EPOCH_LUA, { operation: 'issue', command: baseCommand });
    const duplicate = call(REDIS_REQUEST_EPOCH_LUA, { operation: 'issue', command: {
      ...baseCommand, capability: 'different-candidate', operationHandle: 'z'.repeat(43),
    } });
    const conflict = call(REDIS_REQUEST_EPOCH_LUA, { operation: 'issue', command: {
      ...baseCommand, endpoint: 'assistant', capability: 'different-candidate',
    } });
    const retiredAuthority = { ...authority, currentEpochId: `g8_${kid}`, retiredThrough: 7,
      epochs: { ...authority.epochs, [epochId]: { ...authority.epochs[epochId], state: 'retired' } } };
    const update = call(setupScript, { authority: retiredAuthority, subject: 'owner', user: eligible });
    const miss = call(REDIS_REQUEST_EPOCH_LUA, { operation: 'issue', command: {
      ...baseCommand, commandId: `${epochId}.223e4567-e89b-42d3-a456-426614174000`,
      commandIndex: 'd'.repeat(43),
    } });
    const result = runLuaRedis([seed, issue, duplicate, conflict, update, miss]);
    expect(result[1]).toMatchObject({ status: 'issued', record: { capability: baseCommand.capability, granted: false } });
    expect(result[2]).toMatchObject({ status: 'duplicate', record: { capability: baseCommand.capability } });
    expect(result[3]).toEqual({ status: 'conflict' });
    expect(result[5]).toEqual({ status: 'not_current' });
  });

  it.each(['revoked', 'retired', 'expired', 'eligibility'] as const)('same-command confirm rechecks %s', (reason) => {
    const eligible = { eligibility: { status: 'approved', tier: 'tier1', expiresAt: null } };
    const next = structuredClone(authority);
    if (reason === 'revoked') next.revokedKids = [kid];
    if (reason === 'retired') next.retiredThrough = 7;
    const user = reason === 'eligibility' ? { eligibility: { status: 'revoked', tier: 'tier1', expiresAt: null } } : eligible;
    const result = runLuaRedis([
      call(setupScript, { authority, subject: 'owner', user: eligible }),
      call(REDIS_REQUEST_EPOCH_LUA, { operation: 'issue', command: baseCommand }),
      call(setupScript, { authority: next, subject: 'owner', user }),
      { ...call(REDIS_REQUEST_EPOCH_LUA, { operation: 'confirm', command: baseCommand }),
        now: reason === 'expired' ? new Date(baseCommand.expiresAtMs).toISOString() : now },
    ]);
    expect(result[3]).toEqual({ status: reason === 'eligibility' ? 'not_eligible' : 'not_current' });
  });

  it.each([1999, 2000, 2001])('pre-sign commit boundary %i ms', (delay) => {
    const result = runLuaRedis([
      call(setupScript, { authority, subject: 'owner', user: { eligibility: { status: 'approved', expiresAt: null } } }),
      { ...call(REDIS_REQUEST_EPOCH_LUA, { operation: 'issue', command: baseCommand }),
        now: new Date(nowMs + delay).toISOString() },
    ]);
    expect(result[1]).toMatchObject({ status: delay <= 2000 ? 'issued' : 'not_current' });
  });
  it('每本人跨六端點20個unused上限，不誤限其他本人；duplicate不增加', () => {
    const user = { eligibility: { status: 'approved', expiresAt: null } };
    const calls = Array.from({ length: 21 }, (_, i) => call(REDIS_REQUEST_EPOCH_LUA, {
      operation: 'issue', command: { ...baseCommand,
        commandId: `${epochId}.123e4567-e89b-42d3-a456-${i.toString(16).padStart(12, '0')}`,
        commandIndex: Buffer.alloc(32, i + 1).toString('base64url'),
        handleIndex: Buffer.alloc(32, i + 21).toString('base64url'),
        operationHandle: Buffer.alloc(32, i + 41).toString('base64url'), endpoint: i % 2 ? 'places' : 'assistant' },
    }));
    const result = runLuaRedis([call(setupScript, { authority, subject: 'owner', user }), ...calls,
      call(setupScript, { authority, subject: 'other', user }),
      call(REDIS_REQUEST_EPOCH_LUA, { operation: 'issue', command: { ...baseCommand,
        identitySubject: 'other', ownerScope: 'o'.repeat(43), commandIndex: 'other-command', handleIndex: 'other-handle' } })]);
    expect(result.slice(1, 21).every((v) => (v as { status: string }).status === 'issued')).toBe(true);
    expect(result[21]).toEqual({ status: 'limit' });
    expect(result.at(-1)).toMatchObject({ status: 'issued' });
  });
  it('每owner/epoch第100筆成立，第101筆拒絕；時計倒退／缺floor拒絕', () => {
    const user = { eligibility: { status: 'approved', expiresAt: null } };
    const counter = createRedisClockLua(kinds) + String.raw`
local c=cjson.decode(ARGV[1]); redis.call('HSET',KEYS[7],c.counter,99); return '{"status":"seeded"}'
`;
    const result = runLuaRedis([
      call(setupScript, { authority, subject: 'owner', user }),
      call(counter, { counter: `${baseCommand.ownerScope}|${epochId}` }),
      call(REDIS_REQUEST_EPOCH_LUA, { operation: 'issue', command: baseCommand }),
      call(REDIS_REQUEST_EPOCH_LUA, { operation: 'issue', command: { ...baseCommand, commandIndex: '101', handleIndex: '101' } }),
      { ...call(REDIS_REQUEST_EPOCH_LUA, { operation: 'confirm', command: baseCommand }), now: new Date(nowMs - 1).toISOString() },
    ]);
    expect(result[2]).toMatchObject({ status: 'issued' });
    expect(result[3]).toEqual({ status: 'limit' });
    expect(result[4]).toMatchObject({ fixtureError: expect.stringContaining('EPOCH_CLOCK_ROLLBACK') });
  });
  it('authority回應保留空array與safe integer，不把cjson空table當array', () => {
    const result = runLuaRedis([call(setupScript, { authority, subject: 'owner',
      user: { eligibility: { status: 'approved', expiresAt: null } } }),
    call(REDIS_REQUEST_EPOCH_LUA, { operation: 'authority' })]);
    expect(result[1]).toMatchObject({ status: 'ok', authority: { revokedKids: [], highestGeneration: 7 }, nowMs });
  });
});
