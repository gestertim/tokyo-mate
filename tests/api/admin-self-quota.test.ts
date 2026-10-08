// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createRegistryBundle, costParametersDigest } from '../../api/_lib/cost-registry';
import { PROTECTED_ENDPOINTS, costModelOf } from '../../api/_lib/cost-price-table';
import { REDIS_QUOTA_LUA } from '../../api/_lib/redis-quota-script';
import { ADMIN_REDIS_LUA } from '../../api/_lib/admin-redis-script';
import { ADMIN_REDIS_KEYS } from '../../api/_lib/admin-redis-store';
import { getQuotaWindows } from '../../api/_lib/quota-window';
import { FIXTURE_ALL_LIVE } from '../fixtures/cost-price-fixtures';
import { fixtureRegistryEntry } from '../fixtures/cost-registry-fixtures';
import { luaAvailable, runLuaRedis, type LuaInvocation } from '../support/lua-redis-harness';
import { REDIS_QUOTA_KEYS } from '../../api/_lib/redis-shared-store';

const now = '2026-10-06T02:00:00.000Z', subject = 'trusted-admin';
describe.skipIf(!luaAvailable)('管理者本身額度與管理／quota共用authority（Lua本機替身）', () => {
  it('追加audit可被quota立即讀取；追加後仍日額度拒絕，撤銷資格下一次reserve拒絕', () => {
    const keys = ADMIN_REDIS_KEYS('{admin_self_fixture}');
    const entries = PROTECTED_ENDPOINTS.map((e) => fixtureRegistryEntry(e, FIXTURE_ALL_LIVE));
    const bundle = createRegistryBundle(1, FIXTURE_ALL_LIVE, entries);
    const digests = Object.fromEntries(entries.map((e) => [e.endpoint, costParametersDigest(e)]));
    const windows = getQuotaWindows(new Date(now));
    const command = { identitySubject: subject, idempotencyKey: 'request1', reservationId: 'reservation1',
      endpoint: 'assistant', amountMicroUsd: 2400, costModel: costModelOf(FIXTURE_ALL_LIVE),
      costParametersDigest: digests.assistant, requestFingerprint: 'a'.repeat(64), fingerprintKeyVersion: 'FIXTURE',
      estimateInputs: { inputTokens: 0 }, ...windows, expectedRegistry: bundle,
      tierLimits: { tier1: { dayLimitMicroUsd: 8036, weekBaseLimitMicroUsd: 8035 },
        tier2: { dayLimitMicroUsd: 8036, weekBaseLimitMicroUsd: 8035 } }, leaseMs: 60_000, nowIso: now };
    const quota = (operation: string, value: object): LuaInvocation => ({
      script: REDIS_QUOTA_LUA, keys: REDIS_QUOTA_KEYS('{admin_self_fixture}'), now, command: { operation, command: value, digests },
    });
    const admin = (action: string, id: string): LuaInvocation => ({
      script: ADMIN_REDIS_LUA, keys, now, command: { operation: 'mutate', command: {
        action, idempotencyKey: id, adminSubject: subject, targetIdentitySubject: subject, confirmed: true,
        reasonCode: 'operator_review', nowIso: now, auditId: `audit_${id}`, generatedTopUpId: `top_${id}`,
        ...(action === 'top_up' ? { scope: 'all_protected_endpoints', amountMicroUsd: 15_000_000,
          weekWindowKey: windows.week.windowKey, expiresAt: windows.week.resetAt } : {}),
      } },
    });
    const results = runLuaRedis([quota('publish', bundle), quota('setEligibility', {
      identitySubject: subject, status: 'approved', tier: 'tier1', expiresAt: null,
    }), quota('reserve', command), admin('top_up', 'top1'), quota('reserve', command),
    admin('top_up', 'top2'), quota('readQuota', command),
    quota('reserve', { ...command, idempotencyKey: 'request2', reservationId: 'reservation2' }),
    admin('revoke', 'revoke1'), quota('reserve', { ...command, idempotencyKey: 'request3', reservationId: 'reservation3' })]);
    expect(results[2]).toMatchObject({ status: 'denied', deniedWindow: 'week' });
    expect(results[3]).toMatchObject({ outcome: 'applied', auditId: 'audit_top1' });
    expect(results[4]).toMatchObject({ status: 'reserved', executionGrant: true });
    expect(results[6]).toMatchObject({ status: 'ok', limits: { dayLimitMicroUsd: 8036,
      weekTopUpMicroUsd: 30_000_000, weekLimitMicroUsd: 30_008_035 },
    usage: { day: { reservedMicroUsd: 2400 }, week: { reservedMicroUsd: 2400 } } });
    expect(results[7]).toMatchObject({ status: 'denied', deniedWindow: 'day', denialClass: 'below_floor' });
    expect(results[8]).toMatchObject({ outcome: 'applied' });
    expect(results[9]).toEqual({ status: 'not_eligible', reason: 'revoked' });
  });
});
