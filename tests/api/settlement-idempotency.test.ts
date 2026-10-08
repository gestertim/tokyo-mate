import { describe, expect, it } from 'vitest';
import { createFixtureQuotaEngine as createQuotaEngine } from '../support/quota-fixture-engine';
import { type SharedStore, type TierLimitTable } from '../../api/_lib/shared-store';
import { FIXTURE_ALL_LIVE, FIXTURE_EFFECTIVE_FROM, FIXTURE_EXPIRES_AT } from '../fixtures/cost-price-fixtures';
import { InMemorySharedStoreMock } from '../support/in-memory-shared-store';

const SUBJECT = 'settlement-idempotency-subject';
const MODEL = { version: FIXTURE_ALL_LIVE.version, effectiveFrom: FIXTURE_EFFECTIVE_FROM, expiresAt: FIXTURE_EXPIRES_AT };
const TIERS: TierLimitTable = {
  tier1: { dayLimitMicroUsd: 100_000, weekBaseLimitMicroUsd: 300_000 },
  tier2: { dayLimitMicroUsd: 1_000_000, weekBaseLimitMicroUsd: 3_000_000 },
};
const at = (iso: string) => new Date(`${iso}+08:00`);

function setup() {
  let now = at('2026-10-06T10:00:00');
  let id = 0;
  const store = new InMemorySharedStoreMock();
  store.seed({ identitySubject: SUBJECT, status: 'approved', tier: 'tier1', expiresAt: null });
  const engine = createQuotaEngine({
    store,
    tierLimits: TIERS,
    now: () => now,
    newId: () => `settle-${++id}`,
    storeTimeoutMs: 50,
    leaseMs: 60_000,
  });
  return { store, engine, setNow: (iso: string) => { now = at(iso); } };
}

describe('T137 mock 結算冪等與語意衝突', () => {
  it('相同 transition、金額、reason 與模型版本重送只套用一次', async () => {
    const ctx = setup();
    const reserved = await ctx.engine.reserve({
      identitySubject: SUBJECT,
      endpoint: 'assistant',
      amountMicroUsd: 5_000,
      idempotencyKey: 'same-settlement',
      costModel: MODEL,
      content: 'fixture-content-f',
    });
    if (!reserved.ok) throw new Error('reserve failed');
    const input = {
      identitySubject: SUBJECT,
      reservationId: reserved.reservation.reservationId,
      outcome: { kind: 'success' as const, settlementEstimateMicroUsd: 7_000, attempts: 3, standardTier: true, costModelVersion: MODEL.version },
    };

    expect(await ctx.engine.settle(input)).toMatchObject({ settlementStatus: 'accounted_cost_bound_exceeded', ok: false, status: 503, alreadyApplied: false });
    expect(await ctx.engine.settle(input)).toMatchObject({ settlementStatus: 'accounted_cost_bound_exceeded', ok: false, status: 503, alreadyApplied: true });
    expect(await ctx.store.readUsage(SUBJECT, '2026-10-06', '2026-W41')).toEqual({
      day: { usedMicroUsd: 7_000, reservedMicroUsd: 0 },
      week: { usedMicroUsd: 7_000, reservedMicroUsd: 0 },
    });
  });

  it('同一預留以不同結算金額或模型版本重送時回衝突且餘額不變', async () => {
    const ctx = setup();
    const reserved = await ctx.engine.reserve({
      identitySubject: SUBJECT,
      endpoint: 'assistant',
      amountMicroUsd: 5_000,
      idempotencyKey: 'conflicting-settlement',
      costModel: MODEL,
      content: 'fixture-content-e',
    });
    if (!reserved.ok) throw new Error('reserve failed');
    const input = {
      identitySubject: SUBJECT,
      reservationId: reserved.reservation.reservationId,
      outcome: { kind: 'success' as const, settlementEstimateMicroUsd: 7_000, attempts: 3, standardTier: true, costModelVersion: MODEL.version },
    };
    await ctx.engine.settle(input);
    const before = await ctx.store.readUsage(SUBJECT, '2026-10-06', '2026-W41');

    expect(await ctx.engine.settle({
      ...input,
      outcome: { ...input.outcome, settlementEstimateMicroUsd: 8_000 },
    })).toMatchObject({ ok: false, status: 409, code: 'SETTLEMENT_CONFLICT' });
    expect(await ctx.engine.settle({
      ...input,
      outcome: { ...input.outcome, costModelVersion: 'FIXTURE_OTHER_MODEL' },
    })).toMatchObject({ ok: false, status: 409, code: 'SETTLEMENT_CONFLICT' });
    expect(await ctx.store.readUsage(SUBJECT, '2026-10-06', '2026-W41')).toEqual(before);
  });

  it('超額重送保留原子封鎖佐證；不相符的 already-applied store 結果 fail closed', async () => {
    const ctx = setup();
    const reserved = await ctx.engine.reserve({
      identitySubject: SUBJECT,
      endpoint: 'assistant',
      amountMicroUsd: 5_000,
      idempotencyKey: 'overrun-replay',
      costModel: MODEL,
      content: 'fixture-content-c',
    });
    if (!reserved.ok) throw new Error('reserve failed');
    const input = {
      identitySubject: SUBJECT,
      reservationId: reserved.reservation.reservationId,
      outcome: { kind: 'success' as const, settlementEstimateMicroUsd: 7_000, attempts: 3, standardTier: true, costModelVersion: MODEL.version },
    };
    expect(await ctx.engine.settle(input)).toMatchObject({
      settlementStatus: 'accounted_cost_bound_exceeded', ok: false, status: 503,
      costOverrun: { blockedCostModelVersion: MODEL.version, chargedMicroUsd: 7_000 },
    });
    expect(await ctx.engine.settle(input)).toMatchObject({
      settlementStatus: 'accounted_cost_bound_exceeded', ok: false, status: 503,
      alreadyApplied: true,
      costOverrun: { blockedCostModelVersion: MODEL.version, chargedMicroUsd: 7_000 },
    });

    const real = ctx.store;
    const store: SharedStore = {
      reserve: (command) => real.reserve(command),
      settle: async (command) => {
        const result = await real.settle(command);
        return result.status === 'already_applied'
          ? { ...result, reservation: { ...result.reservation, settlementReason: 'contradictory-reason' } }
          : result;
      },
      setEligibility: (command) => real.setEligibility(command),
      addTopUp: (command) => real.addTopUp(command),
      revokeTopUp: (command) => real.revokeTopUp(command),
      expireLeases: (subject, nowIso) => real.expireLeases(subject, nowIso),
      getReservation: (subject, reservationId) => real.getReservation(subject, reservationId),
      readUsage: (subject, day, week) => real.readUsage(subject, day, week),
      readQuota: (subject, day, week, limits, nowIso) => real.readQuota(subject, day, week, limits, nowIso),
    };
    const guardedEngine = createQuotaEngine({ store, tierLimits: TIERS, now: () => at('2026-10-06T10:00:02'), leaseMs: 60_000 });
    expect(await guardedEngine.settle(input)).toMatchObject({ ok: false, status: 503, reason: 'INVALID_STORE_DATA' });
  });

  it('超額須有同次原子封鎖佐證才能標示已入帳，對外仍為 503', async () => {
    const ctx = setup();
    const reserved = await ctx.engine.reserve({
      identitySubject: SUBJECT,
      endpoint: 'assistant',
      amountMicroUsd: 5_000,
      idempotencyKey: 'overrun-proof',
      costModel: MODEL,
      content: 'fixture-content-d',
    });
    if (!reserved.ok) throw new Error('reserve failed');
    const real = ctx.store;
    const store: SharedStore = {
      reserve: (command) => real.reserve(command),
      settle: async (command) => {
        const result = await real.settle(command);
        return result.status === 'applied' ? { ...result, blockedCostModelVersion: 'WRONG_VERSION' } : result;
      },
      setEligibility: (command) => real.setEligibility(command),
      addTopUp: (command) => real.addTopUp(command),
      revokeTopUp: (command) => real.revokeTopUp(command),
      expireLeases: (subject, nowIso) => real.expireLeases(subject, nowIso),
      getReservation: (subject, reservationId) => real.getReservation(subject, reservationId),
      readUsage: (subject, day, week) => real.readUsage(subject, day, week),
      readQuota: (subject, day, week, limits, nowIso) => real.readQuota(subject, day, week, limits, nowIso),
    };
    const guardedEngine = createQuotaEngine({ store, tierLimits: TIERS, now: () => at('2026-10-06T10:00:01'), leaseMs: 60_000 });

    expect(await guardedEngine.settle({
      identitySubject: SUBJECT,
      reservationId: reserved.reservation.reservationId,
      outcome: { kind: 'success', settlementEstimateMicroUsd: 7_000, attempts: 3, standardTier: true, costModelVersion: MODEL.version },
    })).toMatchObject({ ok: false, status: 503, reason: 'INVALID_STORE_DATA' });
    expect(real.isCostModelBlocked(MODEL.version)).toBe(true);
  });
});
