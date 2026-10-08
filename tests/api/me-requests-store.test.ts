// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createRedisMeStore } from '../../api/_lib/me-store';
import { createRedisAdminStore } from '../../api/_lib/admin-redis-store';
import { createRedisSharedStore, REDIS_QUOTA_KEYS } from '../../api/_lib/redis-shared-store';
import { REDIS_CLOCK_LUA } from '../../api/_lib/redis-quota-script';
import { luaAvailable, runLuaRedis, type LuaInvocation } from '../support/lua-redis-harness';
import { accountingLookupIndex } from '../../api/_lib/request-epoch';

function setup() {
  let now = '2026-10-07T02:00:00.000Z';
  const history: LuaInvocation[] = [];
  const transport = { eval: vi.fn(async (script: string, keys: readonly string[], json: string) => {
    history.push({ script, keys, command: JSON.parse(json), now });
    const result = runLuaRedis(history).at(-1);
    if (result && typeof result === 'object' && 'fixtureError' in result) throw new Error(String(result.fixtureError));
    return JSON.stringify(result);
  }) };
  const options = { namespace: '{ME_TEST}', transport, timeoutMs: 2000, audit: vi.fn() };
  const me = createRedisMeStore(options), admin = createRedisAdminStore(options), quota = createRedisSharedStore(options);
  const enqueue = (key: string, subject = 'owner', kind: 'paid_access' | 'weekly_top_up' = 'paid_access') =>
    me.enqueue(subject, { kind, idempotencyKey: key,
      reasonCode: kind === 'paid_access' ? 'paid_feature_access' : 'weekly_limit_review',
      ...(kind === 'weekly_top_up' ? { weekWindowKey: '2026-W41' } : {}) });
  const approve = (reviewId?: string) => admin.mutate({ action: 'approve', adminSubject: 'admin',
    targetIdentitySubject: 'owner', confirmed: true, tier: 'tier2', reasonCode: 'review',
    idempotencyKey: 'admin_approve', nowIso: now, ...(reviewId ? { reviewId } : {}) });
  const seed = (subject = 'owner') => quota.setEligibility({
    identitySubject: subject, status: 'pending', tier: 'tier1', expiresAt: null, nowIso: now,
  });
  return { me, admin, quota, transport, options, enqueue, approve, seed, setTime: (v: string) => { now = v; } };
}

describe.skipIf(!luaAvailable)('D11 本機 Lua authority（非真實 Redis）', () => {
  it.each(['reserved','settled','released','uncertain'] as const)('epoch %s：expired／retired後仍本人唯讀，他人同404，資格403優先', async (state) => {
    const f = setup(); await f.seed(); await f.seed('other'); await f.approve();
    await f.quota.setEligibility({ identitySubject: 'other', status: 'approved', tier: 'tier1', expiresAt: null,
      nowIso: '2026-10-07T02:00:00.000Z' });
    const epochId = `g7_${'k'.repeat(22)}`, handle = 'h'.repeat(43);
    await f.transport.eval(REDIS_CLOCK_LUA + String.raw`
local c=cjson.decode(ARGV[1]); local u=object(redis.call('HGET',KEYS[2],'owner'))
u.epochAccounting={[c.index]='record'}
u.accountingRecords={record={identitySubject='owner',endpoint='assistant',status=c.state,createdAt=nowIso,
  settledAt=nowIso,secret='DO_NOT_RETURN'}}
redis.call('HSET',KEYS[2],'owner',encode(u)); return '{"status":"seeded"}'
`, REDIS_QUOTA_KEYS(f.options.namespace), JSON.stringify({ index: accountingLookupIndex(epochId,handle), state }));
    f.setTime('2026-12-07T02:00:00.000Z');
    expect(await f.me.epochOperation!('owner','assistant',epochId,handle)).toEqual({
      outcome: 'found', state, updatedAt: '2026-10-07T02:00:00.000Z' });
    expect(await f.me.epochOperation!('other','assistant',epochId,handle)).toEqual({ outcome: 'not_found' });
    expect(await f.me.epochOperation!('owner','assistant',epochId,'z'.repeat(43))).toEqual({ outcome: 'not_found' });
    await f.quota.setEligibility({ identitySubject: 'owner', status: 'revoked', tier: 'tier1', expiresAt: null,
      nowIso: '2026-12-07T02:00:00.000Z' });
    expect(await f.me.epochOperation!('owner','assistant',epochId,handle)).toEqual({ outcome: 'not_approved' });
  });
  it('並發 enqueue 與不同 key pending 去重；同 key 異內容 conflict，owner 隔離', async () => {
    const f = setup(); await f.seed(); await f.seed('other');
    const [a, b] = await Promise.all([f.enqueue('one'), f.enqueue('two')]);
    expect([a.outcome, b.outcome].sort()).toEqual(['created', 'duplicate']);
    expect(a.review?.reviewId).toBe(b.review?.reviewId);
    expect(await f.me.enqueue('owner', { kind: 'weekly_top_up', idempotencyKey: 'one',
      reasonCode: 'weekly_limit_review', weekWindowKey: '2026-W41' })).toMatchObject({ outcome: 'not_approved' });
    await f.approve();
    expect(await f.me.enqueue('owner', { kind: 'weekly_top_up', idempotencyKey: 'one',
      reasonCode: 'weekly_limit_review', weekWindowKey: '2026-W41' })).toMatchObject({ outcome: 'conflict' });
    await f.enqueue('one', 'other');
    expect((await f.me.list('owner', 0, 25)).items).toHaveLength(1);
    expect((await f.me.list('other', 0, 25)).items).toHaveLength(1);
  });
  it('withdraw先則管理resolve拒絕；resolve先則withdraw拒絕，終態可新key再提', async () => {
    const f = setup(); await f.seed();
    const first = await f.enqueue('one'); const id = first.review!.reviewId;
    expect(await f.me.withdraw('other', id)).toEqual({ outcome: 'not_found' });
    expect(await f.me.withdraw('owner', 'unknown')).toEqual({ outcome: 'not_found' });
    expect(await f.me.withdraw('owner', id)).toMatchObject({ outcome: 'withdrawn' });
    expect(await f.approve(id)).toMatchObject({ outcome: 'conflict' });
    const second = await f.enqueue('two');
    expect(second.outcome).toBe('created');
    expect(await f.approve(second.review!.reviewId)).toMatchObject({ outcome: 'applied' });
    expect(await f.me.withdraw('owner', second.review!.reviewId)).toEqual({ outcome: 'resolved' });
    expect((await f.me.list('owner', 0, 25)).items.map((r) => r.status).sort()).toEqual(['resolved', 'withdrawn']);
  });
  it('週耗盡仍可申請；跨週舊申請不得追加新週，新週可另提', async () => {
    const f = setup(); await f.seed(); await f.approve();
    await f.transport.eval(REDIS_CLOCK_LUA + `
local c=cjson.decode(ARGV[1]);local u=cjson.decode(redis.call('HGET',KEYS[2],'owner'))
u.windows['week:2026-W41']={usedMicroUsd=50000000,reservedMicroUsd=0}
redis.call('HSET',KEYS[2],'owner',encode(u));return reply({ok=true})
`, REDIS_QUOTA_KEYS(f.options.namespace), '{}');
    const result = await f.enqueue('top', 'owner', 'weekly_top_up');
    expect(result.outcome).toBe('created');
    f.setTime('2026-10-12T02:00:00.000Z');
    expect(await f.enqueue('stale', 'owner', 'weekly_top_up')).toMatchObject({ outcome: 'invalid' });
    expect(await f.admin.mutate({ action: 'top_up', adminSubject: 'admin', targetIdentitySubject: 'owner',
      confirmed: true, reasonCode: 'review', idempotencyKey: 'admin_top', reviewId: result.review!.reviewId,
      weekWindowKey: '2026-W42', expiresAt: '2026-10-18T16:00:00.000Z',
      scope: 'all_protected_endpoints', amountMicroUsd: 1000, nowIso: '2026-10-12T02:00:00.000Z' }))
      .toMatchObject({ outcome: 'invalid' });
    expect(await f.me.enqueue('owner', { kind: 'weekly_top_up', idempotencyKey: 'new_week',
      reasonCode: 'weekly_floor_review', weekWindowKey: '2026-W42' })).toMatchObject({ outcome: 'created' });
  });
  it('D10 owner lookup只projection、未知／他人相同且資格優先，不寫quota', async () => {
    const f = setup(); await f.seed(); await f.approve();
    await f.transport.eval(REDIS_CLOCK_LUA + `
local u=cjson.decode(redis.call('HGET',KEYS[2],'owner'))
u.idempotency.op='reservation'
u.reservations.reservation={identitySubject='owner',endpoint='assistant',status='settled',
createdAt=nowIso,settledAt=nowIso,executionGranted=true,secret='不可輸出'}
redis.call('HSET',KEYS[2],'owner',encode(u));return reply({ok=true})
`, REDIS_QUOTA_KEYS(f.options.namespace), '{}');
    expect(await f.me.operation('owner', 'assistant', 'op')).toEqual({
      outcome: 'found', state: 'settled', updatedAt: '2026-10-07T02:00:00.000Z',
    });
    expect(await f.me.operation('owner', 'places', 'op')).toEqual({ outcome: 'not_found' });
    expect(await f.me.operation('owner', 'assistant', 'unknown')).toEqual({ outcome: 'not_found' });
    expect(await f.me.operation('other', 'assistant', 'op')).toEqual({ outcome: 'not_approved' });
    await f.quota.setEligibility({ identitySubject: 'other', status: 'approved', tier: 'tier1', expiresAt: null,
      nowIso: '2026-10-07T02:00:00.000Z' });
    expect(await f.me.operation('other', 'assistant', 'op')).toEqual({ outcome: 'not_found' });
    expect(f.transport.eval.mock.calls.at(-1)?.[0]).not.toContain("op=='reserve'");
  });
  it.each(['rejected', 'revoked', 'expired'] as const)('%s可申請paid_access，不能自行top-up；管理者決定tier', async (status) => {
    const f = setup();
    await f.quota.setEligibility({ identitySubject: 'owner', status, tier: 'tier1', expiresAt: null,
      nowIso: '2026-10-07T02:00:00.000Z' });
    const result = await f.enqueue('request');
    expect(result.outcome).toBe('created');
    expect(await f.enqueue('top', 'owner', 'weekly_top_up')).toMatchObject({ outcome: 'not_approved' });
    expect(await f.approve(result.review!.reviewId)).toMatchObject({ outcome: 'applied' });
    expect(await f.me.access('owner')).toEqual({ approved: true, weekWindowKey: '2026-W41' });
    expect((await f.admin.detail('owner', '2026-10-07T02:00:00.000Z'))?.tier).toBe('tier2');
  });
});
