import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFixtureQuotaEngine } from '../support/quota-fixture-engine';
import { InMemorySharedStoreMock } from '../support/in-memory-shared-store';
import { FIXTURE_ALL_LIVE, FIXTURE_EFFECTIVE_FROM, FIXTURE_EXPIRES_AT } from '../fixtures/cost-price-fixtures';
import type { SharedStore, SettleResult } from '../../api/_lib/shared-store';

const subject = 'atomic-evidence-subject';
const model = { version: FIXTURE_ALL_LIVE.version, effectiveFrom: FIXTURE_EFFECTIVE_FROM, expiresAt: FIXTURE_EXPIRES_AT };
const failure = { ok: false, status: 503, reason: 'INVALID_STORE_DATA' };
const success = { kind: 'success' as const, settlementEstimateMicroUsd: 4_000, attempts: 1, standardTier: true, costModelVersion: model.version };

function wrap(real: SharedStore, overrides: Partial<SharedStore> = {}): SharedStore {
  return {
    reserve: (c) => real.reserve(c), settle: (c) => real.settle(c),
    expireLeases: (s, t) => real.expireLeases(s, t),
    getReservation: (s, id) => real.getReservation(s, id),
    readUsage: (s, d, w) => real.readUsage(s, d, w),
    readQuota: (s, d, w, l, t) => real.readQuota(s, d, w, l, t),
    setEligibility: (c) => real.setEligibility(c), addTopUp: (c) => real.addTopUp(c),
    revokeTopUp: (c) => real.revokeTopUp(c), ...overrides,
  };
}

function setup(start = '2026-10-06T02:00:00.000Z') {
  let now = new Date(start);
  let id = 0;
  const real = new InMemorySharedStoreMock();
  real.seed({ identitySubject: subject, status: 'approved', tier: 'tier1', expiresAt: null });
  const engine = (store: SharedStore = real, clock = () => now) => createFixtureQuotaEngine({
    store, now: clock, newId: () => `evidence-${++id}`, leaseMs: 60_000, storeTimeoutMs: 10,
    tierLimits: {
      tier1: { dayLimitMicroUsd: 100_000, weekBaseLimitMicroUsd: 300_000 },
      tier2: { dayLimitMicroUsd: 1_000_000, weekBaseLimitMicroUsd: 3_000_000 },
    },
  });
  const request = (key = 'one') => ({
    identitySubject: subject, endpoint: 'assistant' as const, amountMicroUsd: 5_000,
    idempotencyKey: key, costModel: model, content: 'fixture-evidence',
  });
  const reserve = async (key = 'one') => {
    const r = await engine().reserve(request(key));
    if (!r.ok) throw new Error('fixture reserve failed');
    return r.reservation;
  };
  return { real, engine, request, reserve, setNow: (iso: string) => { now = new Date(iso); } };
}

afterEach(() => vi.useRealTimers());

describe('H1-R1 estimation → command → grant 可信時鐘', () => {
  it('估算 02:00:00.000Z、command／grant 01:59:59.999Z 必須在 reserve 前拒絕', async () => {
    const c = setup();
    const reserve = vi.spyOn(c.real, 'reserve');
    const clock = vi.fn()
      .mockReturnValue(new Date('2026-10-06T01:59:59.999Z'))
      .mockReturnValueOnce(new Date('2026-10-06T02:00:00.000Z'));
    const result = await c.engine(c.real, clock).reserve(c.request());
    expect(result).toEqual({ ok: false, status: 503, code: 'PROTECTION_SERVICE_UNAVAILABLE', reason: 'INVALID_CLOCK' });
    expect(result).not.toHaveProperty('executionGrant');
    expect(reserve).not.toHaveBeenCalled();
  });

  it('時鐘重用並修改同一 Date 也不得改寫估算時間佐證', async () => {
    const c = setup();
    const reserve = vi.spyOn(c.real, 'reserve');
    const sharedTime = new Date('2026-10-06T02:00:00.000Z');
    const clock = vi.fn(() => {
      sharedTime.setTime(Date.parse('2026-10-06T01:59:59.999Z'));
      return sharedTime;
    }).mockReturnValueOnce(sharedTime);
    const result = await c.engine(c.real, clock).reserve(c.request());
    expect(result).toMatchObject({ ok: false, status: 503, reason: 'INVALID_CLOCK' });
    expect(result).not.toHaveProperty('executionGrant');
    expect(reserve).not.toHaveBeenCalled();
  });

  it.each([
    ['estimation', ['invalid']],
    ['command', ['2026-10-06T02:00:00.000Z', 'invalid']],
    ['grant', ['2026-10-06T02:00:00.000Z', '2026-10-06T02:00:00.000Z', 'invalid']],
  ] as const)('%s 無效時鐘不授權；只有 grant 階段可能已預留', async (stage, times) => {
    const c = setup();
    const reserve = vi.spyOn(c.real, 'reserve');
    const clock = vi.fn<() => Date>();
    for (const time of times) clock.mockReturnValueOnce(new Date(time));
    const result = await c.engine(c.real, clock).reserve(c.request());
    expect(result).toEqual({ ok: false, status: 503, code: 'PROTECTION_SERVICE_UNAVAILABLE', reason: 'INVALID_CLOCK' });
    expect(result).not.toHaveProperty('executionGrant');
    if (stage !== 'grant') {
      expect(reserve).not.toHaveBeenCalled();
      expect((await c.real.readUsage(subject, '2026-10-06', '2026-W41')).day.reservedMicroUsd).toBe(0);
    } else {
      expect(reserve).toHaveBeenCalledTimes(1);
      expect(await c.engine().reserve(c.request())).toMatchObject({ code: 'DUPLICATE_REQUEST', executionGrant: false });
      expect(await c.real.readUsage(subject, '2026-10-06', '2026-W41')).toEqual({
        day: { usedMicroUsd: 0, reservedMicroUsd: 5_000 },
        week: { usedMicroUsd: 0, reservedMicroUsd: 5_000 },
      });
    }
  });

  it.each([
    ['command → grant 倒退 1 ms', '2026-10-06T02:00:00.001Z', '2026-10-06T02:00:00.000Z'],
    ['grant 恰好 lease 到期', '2026-10-06T02:00:00.000Z', '2026-10-06T02:01:00.000Z'],
    ['grant 已超過 lease', '2026-10-06T02:00:00.000Z', '2026-10-06T02:01:00.001Z'],
  ])('%s 拒絕後仍保留已預留金額且不重放', async (_name, commandTime, grantTime) => {
    const c = setup();
    const reserve = vi.spyOn(c.real, 'reserve');
    const clock = vi.fn<() => Date>()
      .mockReturnValueOnce(new Date('2026-10-06T02:00:00.000Z'))
      .mockReturnValueOnce(new Date(commandTime))
      .mockReturnValueOnce(new Date(grantTime));
    const result = await c.engine(c.real, clock).reserve(c.request());
    expect(result).toMatchObject(failure);
    expect(result).not.toHaveProperty('executionGrant');
    expect(reserve).toHaveBeenCalledTimes(1);
    c.setNow('2026-10-06T02:00:01.000Z');
    expect(await c.engine().reserve(c.request())).toMatchObject({ code: 'DUPLICATE_REQUEST', executionGrant: false });
    expect(await c.real.readUsage(subject, '2026-10-06', '2026-W41')).toEqual({
      day: { usedMicroUsd: 0, reservedMicroUsd: 5_000 },
      week: { usedMicroUsd: 0, reservedMicroUsd: 5_000 },
    });
  });

  it.each([
    ['三階段相等', '2026-10-06T02:00:00.000Z', '2026-10-06T02:00:00.000Z', '2026-10-06T02:00:00.000Z', '2026-10-06', '2026-W41'],
    ['正常前進', '2026-10-06T02:00:00.000Z', '2026-10-06T02:00:00.001Z', '2026-10-06T02:00:00.002Z', '2026-10-06', '2026-W41'],
    ['估算至 command 跨日', '2026-10-06T15:59:59.999Z', '2026-10-06T16:00:00.000Z', '2026-10-06T16:00:00.001Z', '2026-10-07', '2026-W41'],
    ['估算至 command 跨週', '2026-10-11T15:59:59.999Z', '2026-10-11T16:00:00.000Z', '2026-10-11T16:00:00.001Z', '2026-10-12', '2026-W42'],
    ['command 至 grant 跨日', '2026-10-06T15:59:59.998Z', '2026-10-06T15:59:59.999Z', '2026-10-06T16:00:00.000Z', '2026-10-06', '2026-W41'],
    ['command 至 grant 跨週', '2026-10-11T15:59:59.998Z', '2026-10-11T15:59:59.999Z', '2026-10-11T16:00:00.000Z', '2026-10-11', '2026-W41'],
  ])('%s 允許授權，使用 command 的原日／週窗口', async (_name, estimationTime, commandTime, grantTime, dayWindowKey, weekWindowKey) => {
    const c = setup();
    const reserve = vi.spyOn(c.real, 'reserve');
    const clock = vi.fn<() => Date>()
      .mockReturnValueOnce(new Date(estimationTime))
      .mockReturnValueOnce(new Date(commandTime))
      .mockReturnValueOnce(new Date(grantTime));
    const result = await c.engine(c.real, clock).reserve(c.request());
    expect(result).toMatchObject({
      ok: true, executionGrant: true,
      reservation: { createdAt: commandTime, leaseExpiresAt: new Date(Date.parse(commandTime) + 60_000).toISOString(), dayWindowKey, weekWindowKey },
    });
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(reserve).toHaveBeenCalledWith(expect.objectContaining({ nowIso: commandTime }));
    expect(clock).toHaveBeenCalledTimes(3);
  });

  it('三階段相等仍不得繞過成本模型效期', async () => {
    const c = setup();
    const reserve = vi.spyOn(c.real, 'reserve');
    const clock = vi.fn(() => new Date(FIXTURE_EXPIRES_AT));
    const result = await c.engine(c.real, clock).reserve(c.request());
    expect(result).toMatchObject({ ok: false, status: 503, reason: 'COST_MODEL_INVALID' });
    expect(result).not.toHaveProperty('executionGrant');
    expect(reserve).not.toHaveBeenCalled();
  });
});

describe('本輪 H1 新執行權 lease 佐證', () => {
  it.each(['createdAt', 'leaseExpiresAt'] as const)('格式正確但 %s 與 command 不符仍拒絕', async (field) => {
    const c = setup();
    const store = wrap(c.real, { reserve: async (command) => {
      const r = await c.real.reserve(command);
      return r.status === 'reserved' ? { ...r, reservation: { ...r.reservation, [field]: command.nowIso } } : r;
    } });
    if (field === 'createdAt') {
      store.reserve = async (command) => {
        const r = await c.real.reserve(command);
        return r.status === 'reserved' ? { ...r, reservation: { ...r.reservation, createdAt: '2026-10-06T01:59:59.000Z' } } : r;
      };
    }
    expect(await c.engine(store).reserve(c.request())).toMatchObject(failure);
  });

  it.each(['2026-10-06T01:59:00.000Z', '2026-10-06T02:02:00.000Z', 'not-a-date'])('拒絕過期／錯誤／矛盾 lease %s', async (leaseExpiresAt) => {
    const c = setup();
    const store = wrap(c.real, { reserve: async (command) => {
      const r = await c.real.reserve(command);
      return r.status === 'reserved' ? { ...r, reservation: { ...r.reservation, leaseExpiresAt } } : r;
    } });
    expect(await c.engine(store).reserve(c.request())).toMatchObject(failure);
  });

  it.each(['2026-10-06T02:01:00.000Z', '2026-10-06T02:01:00.001Z'])('store 回應延遲至 %s 不授予執行權，亦不退款', async (time) => {
    const c = setup();
    const store = wrap(c.real, { reserve: async (command) => {
      const r = await c.real.reserve(command);
      c.setNow(time);
      return r;
    } });
    expect(await c.engine(store).reserve(c.request())).toMatchObject({ ok: false, status: 503 });
    expect(await c.engine().reserve(c.request())).toMatchObject({ executionGrant: false, code: 'DUPLICATE_REQUEST' });
    expect((await c.real.readUsage(subject, '2026-10-06', '2026-W41')).day.reservedMicroUsd).toBe(5_000);
  });
});

describe('本輪 H2／C1 同次原子結算佐證', () => {
  it.each(['day', 'week'] as const)('settled %s used 不足拒絕，但 store 已入帳不退款', async (window) => {
    const c = setup();
    const r = await c.reserve();
    const store = wrap(c.real, { settle: async (command) => {
      const result = await c.real.settle(command);
      return result.status === 'applied' ? {
        ...result, usage: { ...result.usage, [window]: { usedMicroUsd: 3_999, reservedMicroUsd: 0 } },
      } : result;
    } });
    expect(await c.engine(store).settle({ identitySubject: subject, reservationId: r.reservationId, outcome: success })).toMatchObject(failure);
    expect((await c.real.readUsage(subject, r.dayWindowKey, r.weekWindowKey))[window].usedMicroUsd).toBe(4_000);
  });

  it.each([
    ['applied', 'day'], ['applied', 'week'], ['already_applied', 'day'], ['already_applied', 'week'],
  ] as const)('%s uncertain %s reserved 不足拒絕', async (status, window) => {
    const c = setup();
    const r = await c.reserve();
    const input = { identitySubject: subject, reservationId: r.reservationId, outcome: { kind: 'uncertain' as const } };
    if (status === 'already_applied') await c.engine().settle(input);
    const store = wrap(c.real, { settle: async (command) => {
      const result = await c.real.settle(command);
      return result.status === status ? { ...result, usage: { ...result.usage, [window]: { usedMicroUsd: 0, reservedMicroUsd: 4_999 } } } : result;
    } });
    expect(await c.engine(store).settle(input)).toMatchObject(failure);
  });

  it('already_applied settled used 不足拒絕', async () => {
    const c = setup();
    const r = await c.reserve();
    const input = { identitySubject: subject, reservationId: r.reservationId, outcome: success };
    await c.engine().settle(input);
    const store = wrap(c.real, { settle: async (command) => {
      const result = await c.real.settle(command);
      return result.status === 'already_applied' ? { ...result, usage: { day: { usedMicroUsd: 0, reservedMicroUsd: 0 }, week: { usedMicroUsd: 0, reservedMicroUsd: 0 } } } : result;
    } });
    expect(await c.engine(store).settle(input)).toMatchObject(failure);
  });

  it.each(['identitySubject', 'dayWindowKey', 'weekWindowKey'] as const)('原子 usage 歸屬 %s 不符拒絕', async (field) => {
    const c = setup();
    const r = await c.reserve();
    const store = wrap(c.real, { settle: async (command) => {
      const result = await c.real.settle(command);
      return result.status === 'applied' ? { ...result, [field]: 'wrong-scope' } : result;
    } });
    expect(await c.engine(store).settle({ identitySubject: subject, reservationId: r.reservationId, outcome: success })).toMatchObject(failure);
  });

  it.each(['dayWindowKey', 'weekWindowKey', 'requestFingerprint', 'createdAt', 'leaseExpiresAt'] as const)('結算不可變 reservation %s 不符拒絕', async (field) => {
    const c = setup();
    const r = await c.reserve();
    const values = { dayWindowKey: '2026-10-05', weekWindowKey: '2026-W40', requestFingerprint: 'a'.repeat(64), createdAt: '2026-10-06T01:59:59.000Z', leaseExpiresAt: '2026-10-06T02:02:00.000Z' };
    const store = wrap(c.real, { settle: async (command) => {
      const result = await c.real.settle(command);
      return result.status === 'applied' ? { ...result, reservation: { ...result.reservation, [field]: values[field] } } : result;
    } });
    expect(await c.engine(store).settle({ identitySubject: subject, reservationId: r.reservationId, outcome: success })).toMatchObject(failure);
  });

  it.each(['lease_expired', 'invalid_transition', 'settlement_conflict'] as const)('%s 同次 usage 不足拒絕（含晚到結果）', async (status) => {
    const c = setup();
    const r = await c.reserve();
    if (status !== 'lease_expired') {
      c.setNow('2026-10-06T02:02:00.000Z');
      await c.engine().sweepExpiredLeases({ identitySubject: subject });
    } else c.setNow('2026-10-06T02:02:00.000Z');
    const store = wrap(c.real, { settle: async (command) => {
      const result = await c.real.settle(command);
      return { ...result, usage: { day: { usedMicroUsd: 0, reservedMicroUsd: 0 }, week: { usedMicroUsd: 0, reservedMicroUsd: 0 } } };
    } });
    const outcome = status === 'settlement_conflict' ? { kind: 'uncertain' as const } : success;
    expect(await c.engine(store).settle({ identitySubject: subject, reservationId: r.reservationId, outcome })).toMatchObject(failure);
  });

  it('正常結算為獨立內部狀態，其他請求 used 總計可大於本筆且不追加 usage read', async () => {
    const c = setup();
    const one = await c.reserve('one');
    const two = await c.reserve('two');
    await c.engine().settle({ identitySubject: subject, reservationId: one.reservationId, outcome: success });
    const read = vi.spyOn(c.real, 'readUsage');
    const result = await c.engine().settle({ identitySubject: subject, reservationId: two.reservationId, outcome: success });
    expect(result).toMatchObject({ settlementStatus: 'accounted', usage: { day: { usedMicroUsd: 8_000 } } });
    expect(result).not.toHaveProperty('ok');
    expect(read).not.toHaveBeenCalled();
  });

  it('其他預留使 uncertain reserved 大於本筆仍有效，不要求總計等於單筆', async () => {
    const c = setup();
    const r = await c.reserve('one');
    await c.reserve('two');
    expect(await c.engine().settle({ identitySubject: subject, reservationId: r.reservationId, outcome: { kind: 'uncertain' } }))
      .toMatchObject({ settlementStatus: 'accounted', usage: { day: { reservedMicroUsd: 10_000 }, week: { reservedMicroUsd: 10_000 } } });
  });

  it.each(['applied', 'already_applied', 'invalid_transition', 'settlement_conflict', 'lease_expired'] as const)('%s 不接受矛盾狀態轉移', async (status) => {
    const c = setup();
    const r = await c.reserve();
    const store = wrap(c.real, { settle: async () => ({
      status, reservation: r,
      identitySubject: subject, dayWindowKey: r.dayWindowKey, weekWindowKey: r.weekWindowKey,
      usage: { day: { usedMicroUsd: 0, reservedMicroUsd: 5_000 }, week: { usedMicroUsd: 0, reservedMicroUsd: 5_000 } },
    }) });
    expect(await c.engine(store).settle({ identitySubject: subject, reservationId: r.reservationId, outcome: success })).toMatchObject(failure);
  });

  it('超額如實入帳與雙封鎖，但原 API 契約為 503，重送同樣狀態', async () => {
    const c = setup();
    const r = await c.reserve();
    const input = { identitySubject: subject, reservationId: r.reservationId, outcome: { ...success, settlementEstimateMicroUsd: 7_000 } };
    expect(await c.engine().settle(input)).toMatchObject({
      ok: false, status: 503, code: 'PROTECTION_SERVICE_UNAVAILABLE', settlementStatus: 'accounted_cost_bound_exceeded',
      costOverrun: { chargedMicroUsd: 7_000, excessMicroUsd: 2_000 },
    });
    expect(await c.engine().settle(input)).toMatchObject({ settlementStatus: 'accounted_cost_bound_exceeded', alreadyApplied: true, status: 503 });
    expect(c.real.isCostModelBlocked(model.version)).toBe(true);
    expect(await c.real.readUsage(subject, r.dayWindowKey, r.weekWindowKey)).toEqual({
      day: { usedMicroUsd: 7_000, reservedMicroUsd: 0 }, week: { usedMicroUsd: 7_000, reservedMicroUsd: 0 },
    });
  });
});

describe('本輪 M2 cleanup／settle 競態與恢復（僅 memory mock）', () => {
  it.each(['settle-first', 'cleanup-first'])('同時發起、控制 %s 原子順序', async (order) => {
    const c = setup();
    const r = await c.reserve();
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const store = wrap(c.real, {
      settle: async (command) => {
        if (order === 'cleanup-first') { entered(); await gate; }
        const result = await c.real.settle(command);
        if (order === 'settle-first') release();
        return result;
      },
      expireLeases: async (s, t) => {
        if (order === 'settle-first') await gate;
        const result = await c.real.expireLeases(s, t);
        if (order === 'cleanup-first') release();
        return result;
      },
    });
    const pending = c.engine(store).settle({ identitySubject: subject, reservationId: r.reservationId, outcome: success });
    if (order === 'cleanup-first') await started;
    c.setNow('2026-10-06T02:02:00.000Z');
    const cleanup = c.engine(store).sweepExpiredLeases({ identitySubject: subject });
    const [settled] = await Promise.all([pending, cleanup]);
    expect(settled).toMatchObject(order === 'settle-first' ? { settlementStatus: 'accounted' } : { code: 'INVALID_SETTLEMENT_TRANSITION' });
    expect(await c.real.readUsage(subject, r.dayWindowKey, r.weekWindowKey)).toEqual(order === 'settle-first'
      ? { day: { usedMicroUsd: 4_000, reservedMicroUsd: 0 }, week: { usedMicroUsd: 4_000, reservedMicroUsd: 0 } }
      : { day: { usedMicroUsd: 0, reservedMicroUsd: 5_000 }, week: { usedMicroUsd: 0, reservedMicroUsd: 5_000 } });
  });

  it.each(['partial-error', 'timeout'])('cleanup %s 後重跑只處理剩餘預留', async (mode) => {
    vi.useFakeTimers();
    const c = setup();
    await c.reserve('first');
    c.setNow('2026-10-06T02:00:30.000Z');
    await c.reserve('second');
    c.setNow('2026-10-06T02:02:00.000Z');
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const store = wrap(c.real, { expireLeases: async (s) => {
      await c.real.expireLeases(s, '2026-10-06T02:01:00.001Z');
      entered();
      if (mode === 'partial-error') throw new Error('fixture partial cleanup failure');
      return new Promise(() => {});
    } });
    const pending = c.engine(store).sweepExpiredLeases({ identitySubject: subject });
    await started;
    await vi.advanceTimersByTimeAsync(11);
    expect(await pending).toMatchObject({ ok: false, status: 503 });
    expect(await c.engine().sweepExpiredLeases({ identitySubject: subject })).toEqual({ ok: true, expired: 1 });
    expect(await c.engine().sweepExpiredLeases({ identitySubject: subject })).toEqual({ ok: true, expired: 0 });
    expect((await c.real.readUsage(subject, '2026-10-06', '2026-W41')).day.reservedMicroUsd).toBe(10_000);
  });

  it.each(['day', 'week'] as const)('cleanup 回傳 uncertain 的 %s reserved 不足拒絕', async (window) => {
    const c = setup();
    await c.reserve();
    c.setNow('2026-10-06T02:02:00.000Z');
    const store = wrap(c.real, { expireLeases: async (s, t) => {
      const result = await c.real.expireLeases(s, t);
      return { ...result, entries: result.entries.map((entry) => ({
        ...entry, usage: { ...entry.usage, [window]: { usedMicroUsd: 0, reservedMicroUsd: 4_999 } },
      })) };
    } });
    expect(await c.engine(store).sweepExpiredLeases({ identitySubject: subject })).toMatchObject(failure);
  });

  it.each(['identitySubject', 'dayWindowKey', 'weekWindowKey'] as const)('cleanup 原子 usage %s 歸屬不符拒絕', async (field) => {
    const c = setup();
    await c.reserve();
    c.setNow('2026-10-06T02:02:00.000Z');
    const store = wrap(c.real, { expireLeases: async (s, t) => {
      const result = await c.real.expireLeases(s, t);
      return { ...result, entries: result.entries.map((entry) => ({ ...entry, [field]: 'wrong-scope' })) };
    } });
    expect(await c.engine(store).sweepExpiredLeases({ identitySubject: subject })).toMatchObject(failure);
  });

  it('cleanup 沒有逐筆佐證或 count 矛盾時拒絕，不以非原子 read 補證', async () => {
    const c = setup();
    await c.reserve();
    c.setNow('2026-10-06T02:02:00.000Z');
    const read = vi.spyOn(c.real, 'readUsage');
    const get = vi.spyOn(c.real, 'getReservation');
    const store = wrap(c.real, { expireLeases: async (s, t) => {
      const result = await c.real.expireLeases(s, t);
      return { ...result, entries: [] };
    } });
    expect(await c.engine(store).sweepExpiredLeases({ identitySubject: subject })).toMatchObject(failure);
    expect(read).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(await c.engine().sweepExpiredLeases({ identitySubject: subject })).toEqual({ ok: true, expired: 0 });
  });

  it('settle timeout 後延遲成功，相同語意重送只讀已套用結果、不二次記帳', async () => {
    vi.useFakeTimers();
    const c = setup('2026-10-04T15:59:30.000Z');
    const r = await c.reserve();
    let complete!: () => void;
    let entered!: () => void;
    let done!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const completed = new Promise<void>((resolve) => { done = resolve; });
    const store = wrap(c.real, { settle: (command) => new Promise<SettleResult>((resolve, reject) => {
      complete = () => { c.real.settle(command).then((result) => { resolve(result); done(); }, reject); };
      entered();
    }) });
    const input = { identitySubject: subject, reservationId: r.reservationId, outcome: success };
    const pending = c.engine(store).settle(input);
    await started;
    await vi.advanceTimersByTimeAsync(11);
    expect(await pending).toMatchObject({ ok: false, status: 503 });
    complete();
    await completed;
    c.setNow('2026-10-04T16:02:00.000Z');
    expect(await c.engine().settle(input)).toMatchObject({ settlementStatus: 'accounted', alreadyApplied: true });
    expect(await c.engine().reserve(c.request())).toMatchObject({ executionGrant: false, code: 'DUPLICATE_REQUEST' });
    expect((await c.real.readUsage(subject, '2026-10-04', '2026-W40')).day.usedMicroUsd).toBe(4_000);
    expect((await c.real.readUsage(subject, '2026-10-05', '2026-W41')).day.usedMicroUsd).toBe(0);
  });
});
