import { describe, expect, it } from 'vitest';
import { createFixtureQuotaEngine as createQuotaEngine } from '../support/quota-fixture-engine';
import {
  type ReserveCommand,
  type ReserveResult,
  type SharedStore,
  type TierLimitTable,
} from '../../api/_lib/shared-store';
import { FIXTURE_ALL_LIVE, FIXTURE_EFFECTIVE_FROM, FIXTURE_EXPIRES_AT } from '../fixtures/cost-price-fixtures';
import { InMemorySharedStoreMock } from '../support/in-memory-shared-store';

const SUBJECT = 'reconciliation-subject';
const MODEL = { version: FIXTURE_ALL_LIVE.version, effectiveFrom: FIXTURE_EFFECTIVE_FROM, expiresAt: FIXTURE_EXPIRES_AT };
const TIERS: TierLimitTable = {
  tier1: { dayLimitMicroUsd: 100_000, weekBaseLimitMicroUsd: 300_000 },
  tier2: { dayLimitMicroUsd: 1_000_000, weekBaseLimitMicroUsd: 3_000_000 },
};
const at = (iso: string) => new Date(`${iso}+08:00`);

function setup(start = '2026-10-06T10:00:00') {
  let now = at(start);
  let id = 0;
  const store = new InMemorySharedStoreMock();
  store.seed({ identitySubject: SUBJECT, status: 'approved', tier: 'tier1', expiresAt: null });
  const engine = createQuotaEngine({
    store,
    tierLimits: TIERS,
    now: () => now,
    newId: () => `orphan-${++id}`,
    storeTimeoutMs: 20,
    leaseMs: 60_000,
  });
  return { store, engine, setNow: (iso: string) => { now = at(iso); } };
}

async function reserve(ctx: ReturnType<typeof setup>, key: string) {
  const result = await ctx.engine.reserve({
    identitySubject: SUBJECT,
    endpoint: 'assistant',
    amountMicroUsd: 5_000,
    idempotencyKey: key,
    costModel: MODEL,
    content: 'fixture-content-a',
  });
  if (!result.ok) throw new Error('reserve failed');
  return result.reservation;
}

function wrapStore(real: SharedStore, reserveOverride?: (command: ReserveCommand) => Promise<ReserveResult>): SharedStore {
  return {
    reserve: reserveOverride ?? ((command) => real.reserve(command)),
    settle: (command) => real.settle(command),
    setEligibility: (command) => real.setEligibility(command),
    addTopUp: (command) => real.addTopUp(command),
    revokeTopUp: (command) => real.revokeTopUp(command),
    expireLeases: (subject, nowIso) => real.expireLeases(subject, nowIso),
    getReservation: (subject, reservationId) => real.getReservation(subject, reservationId),
    readUsage: (subject, day, week) => real.readUsage(subject, day, week),
    readQuota: (subject, day, week, limits, nowIso) => real.readQuota(subject, day, week, limits, nowIso),
  };
}

describe('T138 mock 孤兒預留清理與對帳', () => {
  it('結算先完成時清理不改結果；清理先完成時晚到結算只記錄且不改額度', async () => {
    const settledFirst = setup();
    const first = await reserve(settledFirst, 'settle-first');
    expect(await settledFirst.engine.settle({
      identitySubject: SUBJECT,
      reservationId: first.reservationId,
      outcome: { kind: 'success', settlementEstimateMicroUsd: 4_000, attempts: 1, standardTier: true, costModelVersion: MODEL.version },
    })).toMatchObject({ settlementStatus: 'accounted' });
    settledFirst.setNow('2026-10-06T10:02:00');
    expect(await settledFirst.engine.sweepExpiredLeases({ identitySubject: SUBJECT })).toEqual({ ok: true, expired: 0 });
    expect(await settledFirst.store.readUsage(SUBJECT, '2026-10-06', '2026-W41')).toEqual({
      day: { usedMicroUsd: 4_000, reservedMicroUsd: 0 },
      week: { usedMicroUsd: 4_000, reservedMicroUsd: 0 },
    });

    const cleanupFirst = setup();
    const second = await reserve(cleanupFirst, 'cleanup-first');
    cleanupFirst.setNow('2026-10-06T10:02:00');
    expect(await cleanupFirst.engine.sweepExpiredLeases({ identitySubject: SUBJECT })).toEqual({ ok: true, expired: 1 });
    const beforeLateResult = await cleanupFirst.store.readUsage(SUBJECT, '2026-10-06', '2026-W41');
    expect(await cleanupFirst.engine.settle({
      identitySubject: SUBJECT,
      reservationId: second.reservationId,
      outcome: { kind: 'success', settlementEstimateMicroUsd: 4_000, attempts: 1, standardTier: true, costModelVersion: MODEL.version },
    })).toMatchObject({ ok: false, status: 409, code: 'INVALID_SETTLEMENT_TRANSITION' });
    expect(await cleanupFirst.store.readUsage(SUBJECT, '2026-10-06', '2026-W41')).toEqual(beforeLateResult);
    expect(await cleanupFirst.store.getReservation(SUBJECT, second.reservationId)).toMatchObject({
      status: 'uncertain',
      lateOutcomeObserved: { outcome: 'success' },
    });
  });

  it('清理可重複執行且不重複扣額；清理後重送不會重新取得執行權', async () => {
    const ctx = setup();
    const reservation = await reserve(ctx, 'repeat-cleanup');
    ctx.setNow('2026-10-06T10:02:00');
    expect(await ctx.engine.sweepExpiredLeases({ identitySubject: SUBJECT })).toEqual({ ok: true, expired: 1 });
    const afterFirst = await ctx.store.readUsage(SUBJECT, '2026-10-06', '2026-W41');
    expect(await ctx.engine.sweepExpiredLeases({ identitySubject: SUBJECT })).toEqual({ ok: true, expired: 0 });
    expect(await ctx.store.readUsage(SUBJECT, '2026-10-06', '2026-W41')).toEqual(afterFirst);
    expect(await ctx.engine.reserve({
      identitySubject: SUBJECT,
      endpoint: 'assistant',
      amountMicroUsd: 5_000,
      idempotencyKey: 'repeat-cleanup',
      costModel: MODEL,
      content: 'fixture-content-a',
    })).toMatchObject({ ok: false, status: 409, code: 'DUPLICATE_REQUEST', executionGrant: false, reservationStatus: 'uncertain' });
    expect(await ctx.store.getReservation(SUBJECT, reservation.reservationId)).toMatchObject({ status: 'uncertain' });
  });

  it('跨日跨週清理仍保留原窗口；晚到成功與未計費失敗只留紀錄', async () => {
    const ctx = setup('2026-10-04T23:59:00');
    const success = await reserve(ctx, 'late-success');
    const failure = await reserve(ctx, 'late-failure');
    ctx.setNow('2026-10-05T00:01:00');
    expect(await ctx.engine.sweepExpiredLeases({ identitySubject: SUBJECT })).toEqual({ ok: true, expired: 2 });
    const oldUsage = await ctx.store.readUsage(SUBJECT, '2026-10-04', '2026-W40');
    expect(oldUsage).toEqual({
      day: { usedMicroUsd: 0, reservedMicroUsd: 10_000 },
      week: { usedMicroUsd: 0, reservedMicroUsd: 10_000 },
    });
    expect(await ctx.store.readUsage(SUBJECT, '2026-10-05', '2026-W41')).toEqual({
      day: { usedMicroUsd: 0, reservedMicroUsd: 0 },
      week: { usedMicroUsd: 0, reservedMicroUsd: 0 },
    });
    expect(await ctx.engine.settle({
      identitySubject: SUBJECT,
      reservationId: success.reservationId,
      outcome: { kind: 'success', settlementEstimateMicroUsd: 4_000, attempts: 1, standardTier: true, costModelVersion: MODEL.version },
    })).toMatchObject({ ok: false, status: 409 });
    expect(await ctx.engine.settle({
      identitySubject: SUBJECT,
      reservationId: failure.reservationId,
      outcome: { kind: 'explicit_unbilled_failure' },
    })).toMatchObject({ ok: false, status: 409 });
    expect(await ctx.store.readUsage(SUBJECT, '2026-10-04', '2026-W40')).toEqual(oldUsage);
    expect(await ctx.store.getReservation(SUBJECT, success.reservationId)).toMatchObject({
      status: 'uncertain',
      lateOutcomeObserved: { outcome: 'success' },
    });
    expect(await ctx.store.getReservation(SUBJECT, failure.reservationId)).toMatchObject({
      status: 'uncertain',
      lateOutcomeObserved: { outcome: 'unbilled_failure' },
    });
  });

  it('reserve timeout 後 store 延遲成功，清理仍將孤兒預留轉 uncertain 並保留額度', async () => {
    const ctx = setup();
    let pendingCommand: ReserveCommand | undefined;
    let completeDelayedWrite!: () => void;
    let notifyStarted!: () => void;
    let notifyCompleted!: () => void;
    const started = new Promise<void>((resolve) => { notifyStarted = resolve; });
    const completed = new Promise<void>((resolve) => { notifyCompleted = resolve; });
    const delayedStore = wrapStore(ctx.store, (command) => new Promise<ReserveResult>((resolve) => {
      pendingCommand = command;
      completeDelayedWrite = () => {
        void ctx.store.reserve(command).then((result) => {
          resolve(result);
          notifyCompleted();
        });
      };
      notifyStarted();
    }));
    const timedEngine = createQuotaEngine({
      store: delayedStore,
      tierLimits: TIERS,
      now: () => at('2026-10-06T10:00:00'),
      storeTimeoutMs: 5,
      leaseMs: 60_000,
    });

    const timedOut = timedEngine.reserve({
      identitySubject: SUBJECT,
      endpoint: 'assistant',
      amountMicroUsd: 5_000,
      idempotencyKey: 'late-store-write',
      costModel: MODEL,
      content: 'fixture-content-b',
    });
    await started;
    expect(await timedOut).toMatchObject({ ok: false, status: 503, reason: 'STORE_UNAVAILABLE' });
    ctx.setNow('2026-10-06T10:02:00');
    completeDelayedWrite();
    await completed;
    expect(pendingCommand).toBeDefined();
    expect(await ctx.engine.sweepExpiredLeases({ identitySubject: SUBJECT })).toEqual({ ok: true, expired: 1 });
    expect(await ctx.store.getReservation(SUBJECT, pendingCommand!.reservationId)).toMatchObject({ status: 'uncertain' });
    expect(await ctx.store.readUsage(SUBJECT, '2026-10-06', '2026-W41')).toEqual({
      day: { usedMicroUsd: 0, reservedMicroUsd: 5_000 },
      week: { usedMicroUsd: 0, reservedMicroUsd: 5_000 },
    });
    expect(await ctx.engine.reserve({
      identitySubject: SUBJECT,
      endpoint: 'assistant',
      amountMicroUsd: 5_000,
      idempotencyKey: 'late-store-write',
      costModel: MODEL,
      content: 'fixture-content-b',
    })).toMatchObject({ ok: false, status: 409, code: 'DUPLICATE_REQUEST', executionGrant: false, reservationStatus: 'uncertain' });
  });
});
