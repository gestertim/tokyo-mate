import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { isCostModelEffective, type CostModelRef } from '../../api/_lib/cost-price-table';
import { buildRequestFingerprint } from '../../api/_lib/quota-fingerprint';
import type { EstimateInputs } from '../../api/_lib/quota-estimate-inputs';
import { createFixtureQuotaEngine as createQuotaEngine } from '../support/quota-fixture-engine';
import { FIXTURE_FINGERPRINT_KEY, fixtureTrustedCost } from '../fixtures/quota-fingerprint-fixtures';
import { getDayWindow, getQuotaWindows, getWeekWindow } from '../../api/_lib/quota-window';
import {
  SharedStoreTimeoutError,
  SharedStoreUnavailableError,
  getProductionSharedStore,
  withStoreTimeout,
  type ReserveResult,
  type SettleResult,
  type SharedStore,
  type TierLimitTable,
} from '../../api/_lib/shared-store';
import { FIXTURE_ALL_LIVE, FIXTURE_EFFECTIVE_FROM, FIXTURE_EXPIRES_AT } from '../fixtures/cost-price-fixtures';
import { InMemorySharedStoreMock } from '../support/in-memory-shared-store';

/*
 * 證據限制：本檔所有並發／原子性結果來自「記憶體 mock store（單一 JS 執行緒、同步區段）」，
 * 不代表 Upstash Redis 的 Lua／transaction 原子性已驗證，也不代表任何真實服務整合。
 */

const SUBJECT = 'oidc-subject-test-1';
const DAY_LIMIT = 100_000;
const WEEK_LIMIT = 300_000;
const TPE = (iso: string) => new Date(`${iso}+08:00`);
const MODEL: CostModelRef = { version: FIXTURE_ALL_LIVE.version, effectiveFrom: FIXTURE_EFFECTIVE_FROM, expiresAt: FIXTURE_EXPIRES_AT };
const LEASE_MS = 60_000;
const DEFAULT_TIERS: TierLimitTable = {
  tier1: { dayLimitMicroUsd: DAY_LIMIT, weekBaseLimitMicroUsd: WEEK_LIMIT },
  tier2: { dayLimitMicroUsd: 1_000_000, weekBaseLimitMicroUsd: 3_000_000 },
};

interface ReserveOptions {
  subject?: string;
  content?: string;
  model?: CostModelRef;
  inputs?: EstimateInputs;
}

function setup(startIso = '2026-10-06T10:00:00', store: InMemorySharedStoreMock = new InMemorySharedStoreMock(), tierLimits: TierLimitTable = DEFAULT_TIERS) {
  let clock = TPE(startIso);
  let counter = 0;
  store.seed({ identitySubject: SUBJECT, status: 'approved', tier: 'tier1', expiresAt: null });
  const engineFor = (s: SharedStore, tiers: TierLimitTable) =>
    createQuotaEngine({ store: s, tierLimits: tiers, now: () => clock, newId: () => `res-${++counter}`, storeTimeoutMs: 50, leaseMs: LEASE_MS });
  const engine = engineFor(store, tierLimits);
  const reserveWith = (eng: ReturnType<typeof engineFor>, amount: number, key: string, o: ReserveOptions = {}) =>
    eng.reserve({
      identitySubject: o.subject ?? SUBJECT,
      endpoint: 'assistant',
      amountMicroUsd: amount,
      idempotencyKey: key,
      costModel: o.model ?? MODEL,
      estimateInputs: o.inputs,
      content: o.content ?? 'content-default',
    });
  return {
    store,
    engine,
    engineFor,
    reserveWith,
    reserve: (amount: number, key: string, o: ReserveOptions = {}) => reserveWith(engine, amount, key, o),
    setNow: (iso: string) => {
      clock = TPE(iso);
    },
  };
}

type Ctx = ReturnType<typeof setup>;

const SUCCESS = { kind: 'success' as const, settlementEstimateMicroUsd: 4_000, attempts: 1, standardTier: true, costModelVersion: MODEL.version };

/** 包裝真實 mock，只覆寫指定方法；用來模擬損壞或惡意的 store 回傳。 */
function wrapStore(real: SharedStore, over: Partial<SharedStore>): SharedStore {
  return {
    reserve: (c) => real.reserve(c),
    settle: (c) => real.settle(c),
    setEligibility: (c) => real.setEligibility(c),
    addTopUp: (c) => real.addTopUp(c),
    revokeTopUp: (c) => real.revokeTopUp(c),
    expireLeases: (s, n) => real.expireLeases(s, n),
    getReservation: (s, r) => real.getReservation(s, r),
    readUsage: (s, d, w) => real.readUsage(s, d, w),
    readQuota: (s, d, w, t, n) => real.readQuota(s, d, w, t, n),
    ...over,
  };
}

function rejectingStore(make: () => Promise<never>): SharedStore {
  return {
    reserve: make,
    settle: make,
    setEligibility: make,
    addTopUp: make,
    revokeTopUp: make,
    expireLeases: make,
    getReservation: make,
    readUsage: make,
    readQuota: make,
  };
}

describe('T020 Asia/Taipei 日／週窗口', () => {
  it('日／週 key 與 resetAt（週一 00:00 起算，ISO 週）', () => {
    const w = getQuotaWindows(TPE('2026-10-06T10:47:41'));
    expect(w.day).toEqual({ windowKey: '2026-10-06', resetAt: '2026-10-06T16:00:00.000Z' });
    expect(w.week).toEqual({ windowKey: '2026-W41', resetAt: '2026-10-11T16:00:00.000Z' });
    expect(getWeekWindow(TPE('2026-09-25T12:00:00')).windowKey).toBe('2026-W39');
  });

  it('跨午夜與週一 00:00 的邊界（毫秒精度）', () => {
    const before = new Date('2026-10-04T15:59:59.999Z'); // 台北 10/04 23:59:59.999（週日）
    const after = new Date('2026-10-04T16:00:00.000Z'); // 台北 10/05 00:00（週一）
    expect(getDayWindow(before).windowKey).toBe('2026-10-04');
    expect(getDayWindow(after).windowKey).toBe('2026-10-05');
    expect(getWeekWindow(before).windowKey).toBe('2026-W40');
    expect(getWeekWindow(after).windowKey).toBe('2026-W41');
    expect(getDayWindow(before).resetAt).toBe(after.toISOString());
    expect(getWeekWindow(before).resetAt).toBe(after.toISOString());
  });

  it('UTC 日期與台北日期不同時以台北為準；ISO 週年份跨年', () => {
    expect(getDayWindow(new Date('2026-10-06T20:00:00Z')).windowKey).toBe('2026-10-07');
    expect(getWeekWindow(TPE('2025-12-29T00:00:00')).windowKey).toBe('2026-W01');
    expect(getWeekWindow(TPE('2027-01-01T12:00:00')).windowKey).toBe('2026-W53');
    expect(getWeekWindow(TPE('2027-01-03T23:59:59')).windowKey).toBe('2026-W53');
    expect(getWeekWindow(TPE('2027-01-04T00:00:00')).windowKey).toBe('2027-W01');
  });

  it('與 Intl Asia/Taipei 日期交叉比對，且不讀取執行環境時鐘', () => {
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('不得讀取 Date.now');
    });
    try {
      const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' });
      for (let i = 0; i < 400; i += 1) {
        const ms = Date.UTC(2025, 0, 1) + i * 37 * 3_600_000 + 12_345;
        expect(getDayWindow(ms).windowKey).toBe(fmt.format(new Date(ms)));
      }
    } finally {
      spy.mockRestore();
    }
  });

  it('無效時間拒絕', () => {
    expect(() => getDayWindow(Number.NaN)).toThrow(RangeError);
    expect(() => getWeekWindow(new Date('invalid'))).toThrow(RangeError);
  });
});

describe('T019 shared store 契約邊界', () => {
  it('production 無法取得 store，且 shared-store.ts 不含 Map 實作；mock 僅存在於測試目錄', () => {
    expect(() => getProductionSharedStore()).toThrow(SharedStoreUnavailableError);
    expect(new InMemorySharedStoreMock().isMock).toBe(true);
    expect(readFileSync(join(process.cwd(), 'api', '_lib', 'shared-store.ts'), 'utf8')).not.toMatch(/new Map|new Set|Map</);
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : [];
      });
    for (const file of walk(join(process.cwd(), 'api'))) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/tests[\\/]support|in-memory-shared-store/);
    }
  });

  it('逾時拋出 SharedStoreTimeoutError（結果未知，需 fail closed）', async () => {
    await expect(withStoreTimeout(new Promise(() => undefined), 10)).rejects.toBeInstanceOf(SharedStoreTimeoutError);
    await expect(withStoreTimeout(Promise.resolve(1), 10)).resolves.toBe(1);
  });
});

describe('T021 原子預留', () => {
  it('成功預留：日／週 reserved 增加、remaining 減少，記錄原始窗口與一次執行權', async () => {
    const { reserve } = setup();
    const r = await reserve(9_630, 'k1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.executionGrant).toBe(true);
    expect(r.reservation).toMatchObject({ status: 'reserved', dayWindowKey: '2026-10-06', weekWindowKey: '2026-W41', executionGranted: true });
    expect(r.snapshot.day).toMatchObject({ reservedEstimatedUsdMicro: 9_630, remainingEstimatedUsdMicro: DAY_LIMIT - 9_630, resetAt: '2026-10-06T16:00:00.000Z' });
    expect(r.snapshot.week).toMatchObject({ reservedEstimatedUsdMicro: 9_630, remainingEstimatedUsdMicro: WEEK_LIMIT - 9_630 });
  });

  it('日或週任一不足即拒絕（兩窗口都不寫入）；R_e ≤ remaining 邊界', async () => {
    const { reserve } = setup();
    expect(await reserve(DAY_LIMIT, 'edge-ok')).toMatchObject({ ok: true });
    expect(await reserve(1, 'edge-over')).toMatchObject({ ok: false, status: 429, deniedWindow: 'day' });

    const tiers: TierLimitTable = { ...DEFAULT_TIERS, tier1: { dayLimitMicroUsd: 100_000, weekBaseLimitMicroUsd: 7_000 } };
    const s2 = setup('2026-10-06T10:00:00', undefined, tiers);
    expect(await s2.reserve(5_000, 'w-1')).toMatchObject({ ok: true });
    const denied = await s2.reserve(2_001, 'w-2');
    expect(denied).toMatchObject({ ok: false, status: 429, deniedWindow: 'week' });
    if (!denied.ok && denied.status === 429) {
      expect(denied.snapshot.day.reservedEstimatedUsdMicro).toBe(5_000);
      expect(denied.snapshot.week.reservedEstimatedUsdMicro).toBe(5_000);
    }
    expect(await s2.reserve(2_000, 'w-3')).toMatchObject({ ok: true });

    const both = setup('2026-10-06T10:00:00', undefined, { ...DEFAULT_TIERS, tier1: { dayLimitMicroUsd: 5, weekBaseLimitMicroUsd: 5 } });
    expect(await both.reserve(10, 'b')).toMatchObject({ ok: false, deniedWindow: 'both' });
  });

  it('輸入驗證：可信正整數金額、key、endpoint、內容、價表', async () => {
    const { reserve, engine } = setup();
    for (const amount of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, '5' as unknown as number]) {
      expect(await reserve(amount, 'bad-amount')).toMatchObject({ ok: false, status: 503, reason: 'TRUSTED_COST_INVALID' });
    }
    expect(await reserve(5, '')).toMatchObject({ ok: false, status: 400, field: 'idempotencyKey' });
    expect(await reserve(5, 'k'.repeat(129))).toMatchObject({ ok: false, status: 400, field: 'idempotencyKey' });
    const base = { identitySubject: SUBJECT, endpoint: 'assistant' as const, amountMicroUsd: 5, idempotencyKey: 'k', costModel: MODEL, content: 'x' };
    expect(await engine.reserve({ ...base, endpoint: 'evil' as never })).toMatchObject({ status: 400, field: 'endpoint' });
    expect(await engine.reserve({ ...base, identitySubject: '' })).toMatchObject({ status: 400, field: 'identitySubject' });
    expect(await engine.reserve({ ...base, content: undefined as never })).toMatchObject({ status: 400, field: 'content' });
    expect(await engine.reserve({ ...base, costModel: undefined as never })).toMatchObject({ status: 503, reason: 'COST_MODEL_INVALID' });
    expect(await engine.reserve({ ...base, estimateInputs: { 'bad key!': 1 } as never })).toMatchObject({ status: 503, reason: 'TRUSTED_COST_INVALID' });
    expect(await engine.reserve({ ...base, estimateInputs: { inputTokens: Number.NaN } })).toMatchObject({ status: 503, reason: 'TRUSTED_COST_INVALID' });
  });

  it('溢位：上限為 MAX_SAFE_INTEGER 時不產生不安全整數', async () => {
    const max = Number.MAX_SAFE_INTEGER;
    const { reserve } = setup('2026-10-06T10:00:00', undefined, { ...DEFAULT_TIERS, tier1: { dayLimitMicroUsd: max, weekBaseLimitMicroUsd: max } });
    expect(await reserve(max, 'big-1')).toMatchObject({ ok: true });
    expect(await reserve(1, 'big-2')).toMatchObject({ ok: false, status: 429 });
  });

  it('SC-006：並發請求不共用同一筆剩餘額度（mock，非 Redis）', async () => {
    const { engine, reserve, store } = setup();
    const results = await Promise.all(Array.from({ length: 50 }, (_, i) => reserve(3_000, `c-${i}`)));
    expect(results.filter((r) => r.ok)).toHaveLength(33);
    expect(results.filter((r) => !r.ok && r.status === 429)).toHaveLength(17);
    const usage = await store.readUsage(SUBJECT, '2026-10-06', '2026-W41');
    expect(usage.day.reservedMicroUsd).toBe(99_000);
    expect(usage.week.reservedMicroUsd).toBe(99_000);
    const snap = await engine.getSnapshot({ identitySubject: SUBJECT });
    expect(snap.ok && 'snapshot' in snap && snap.snapshot.day.remainingEstimatedUsdMicro).toBe(1_000);
  });

  it('不同使用者額度互相獨立；各自需有資格', async () => {
    const { reserve, store } = setup();
    store.seed({ identitySubject: 'user-a', status: 'approved', tier: 'tier1', expiresAt: null });
    store.seed({ identitySubject: 'user-b', status: 'approved', tier: 'tier1', expiresAt: null });
    expect(await reserve(90_000, 'k', { subject: 'user-a' })).toMatchObject({ ok: true });
    expect(await reserve(90_000, 'k', { subject: 'user-b' })).toMatchObject({ ok: true });
  });

  it('store 錯誤或逾時 → 503，不回傳任何額度結果（fail closed）', async () => {
    const failing = rejectingStore(() => Promise.reject(new SharedStoreUnavailableError()));
    const hanging = rejectingStore(() => new Promise<never>(() => undefined));
    for (const store of [failing, hanging]) {
      const base = setup();
      const eng = base.engineFor(store, DEFAULT_TIERS);
      expect(await base.reserveWith(eng, 10, 'k')).toEqual({ ok: false, status: 503, code: 'PROTECTION_SERVICE_UNAVAILABLE', reason: 'STORE_UNAVAILABLE' });
      expect(await eng.getSnapshot({ identitySubject: SUBJECT })).toEqual({ ok: false, status: 503, code: 'PROTECTION_SERVICE_UNAVAILABLE', reason: 'STORE_UNAVAILABLE' });
    }
  });
});

describe('H1：資格／等級／週追加／預留由 store 原子判斷', () => {
  const WEEK_BASE_10K: TierLimitTable = { ...DEFAULT_TIERS, tier1: { dayLimitMicroUsd: 1_000_000, weekBaseLimitMicroUsd: 10_000 } };

  it('引擎只呼叫 store.reserve 一次，不先讀取追加或資格（無 TOCTOU 視窗）', async () => {
    const store = new InMemorySharedStoreMock();
    const spies = {
      reserve: vi.spyOn(store, 'reserve'),
      readQuota: vi.spyOn(store, 'readQuota'),
      readUsage: vi.spyOn(store, 'readUsage'),
      addTopUp: vi.spyOn(store, 'addTopUp'),
      getReservation: vi.spyOn(store, 'getReservation'),
    };
    const ctx = setup('2026-10-06T10:00:00', store);
    expect(await ctx.reserve(1_000, 'once')).toMatchObject({ ok: true });
    expect(spies.reserve).toHaveBeenCalledTimes(1);
    expect(spies.readQuota).not.toHaveBeenCalled();
    expect(spies.readUsage).not.toHaveBeenCalled();
    expect(spies.addTopUp).not.toHaveBeenCalled();
    expect(spies.getReservation).not.toHaveBeenCalled();
    // 上限由 store 在同一操作內決定，請求不帶任何呼叫端上限
    expect(Object.keys(spies.reserve.mock.calls[0]![0]).sort()).not.toContain('weekLimitMicroUsd');
  });

  it('追加提高當週上限：追加前拒絕、追加後放行；追加依資格 tier 選用基準', async () => {
    const ctx = setup('2026-10-06T10:00:00', undefined, WEEK_BASE_10K);
    expect(await ctx.reserve(10_000, 'a')).toMatchObject({ ok: true });
    expect(await ctx.reserve(1_500, 'b')).toMatchObject({ ok: false, status: 429, deniedWindow: 'week' });
    const topUp = await ctx.engine.addWeeklyTopUp({ identitySubject: SUBJECT, adminSubject: 'admin-1', idempotencyKey: 'tu-1', amountMicroUsd: 5_000, reasonCode: 'SUPPORT' });
    expect(topUp).toMatchObject({ ok: true, duplicate: false, cumulativeTopUpMicroUsd: 5_000 });
    expect(await ctx.reserve(1_500, 'c')).toMatchObject({ ok: true });
    const snap = await ctx.engine.getSnapshot({ identitySubject: SUBJECT });
    expect(snap).toMatchObject({ ok: true, tier: 'tier1', snapshot: { week: { limitEstimatedUsdMicro: 15_000, baseLimitEstimatedUsdMicro: 10_000, cumulativeTopUpEstimatedUsdMicro: 5_000 } } });
  });

  it('撤銷追加：之後的新預留看到較低上限；既有預留不被追溯作廢', async () => {
    const ctx = setup('2026-10-06T10:00:00', undefined, WEEK_BASE_10K);
    const tu = await ctx.engine.addWeeklyTopUp({ identitySubject: SUBJECT, adminSubject: 'admin-1', idempotencyKey: 'tu-1', amountMicroUsd: 5_000, reasonCode: 'SUPPORT' });
    if (!tu.ok) throw new Error('追加失敗');
    for (const k of ['r1', 'r2', 'r3', 'r4']) expect(await ctx.reserve(1_500, k)).toMatchObject({ ok: true });
    const revoked = await ctx.engine.revokeWeeklyTopUp({ identitySubject: SUBJECT, adminSubject: 'admin-1', topUpId: tu.topUp.topUpId });
    expect(revoked).toMatchObject({ ok: true, alreadyApplied: false, cumulativeTopUpMicroUsd: 0 });
    const after = await Promise.all(['r5', 'r6', 'r7', 'r8'].map((k) => ctx.reserve(1_500, k)));
    expect(after.filter((r) => r.ok)).toHaveLength(2); // 上限 10,000；已預留 6,000 → 只剩 4,000
    expect(after.filter((r) => !r.ok && r.status === 429)).toHaveLength(2);
    expect((await ctx.store.readUsage(SUBJECT, '2026-10-06', '2026-W41')).week.reservedMicroUsd).toBe(9_000);
    expect(await ctx.engine.revokeWeeklyTopUp({ identitySubject: SUBJECT, adminSubject: 'admin-1', topUpId: tu.topUp.topUpId })).toMatchObject({ ok: true, alreadyApplied: true });
  });

  it('追加、撤銷與預留並發：任何線性化順序下 reserved 都不超過「當下有效上限」', async () => {
    const ctx = setup('2026-10-06T10:00:00', undefined, WEEK_BASE_10K);
    const tu = await ctx.engine.addWeeklyTopUp({ identitySubject: SUBJECT, adminSubject: 'admin-1', idempotencyKey: 'tu-1', amountMicroUsd: 5_000, reasonCode: 'SUPPORT' });
    if (!tu.ok) throw new Error('追加失敗');
    const ops = [
      ...Array.from({ length: 6 }, (_, i) => ctx.reserve(1_500, `p-${i}`)),
      ctx.engine.revokeWeeklyTopUp({ identitySubject: SUBJECT, adminSubject: 'admin-1', topUpId: tu.topUp.topUpId }),
      ...Array.from({ length: 6 }, (_, i) => ctx.reserve(1_500, `q-${i}`)),
    ];
    await Promise.all(ops);
    const week = (await ctx.store.readUsage(SUBJECT, '2026-10-06', '2026-W41')).week;
    expect(week.reservedMicroUsd).toBeLessThanOrEqual(15_000);
    // 撤銷後再來的預留不得越過基準 10,000（已撤銷的追加不能再被使用）
    const late = await ctx.reserve(1_500, 'late');
    if (week.reservedMicroUsd + 1_500 > 10_000) expect(late).toMatchObject({ ok: false, status: 429 });
  });

  it('追加冪等：同鍵同內容為 duplicate，同鍵不同內容為衝突；累計值不重複計算', async () => {
    const ctx = setup('2026-10-06T10:00:00', undefined, WEEK_BASE_10K);
    const add = (amount: number) => ctx.engine.addWeeklyTopUp({ identitySubject: SUBJECT, adminSubject: 'admin-1', idempotencyKey: 'tu-same', amountMicroUsd: amount, reasonCode: 'SUPPORT' });
    expect(await add(2_000)).toMatchObject({ ok: true, duplicate: false });
    expect(await add(2_000)).toMatchObject({ ok: true, duplicate: true, cumulativeTopUpMicroUsd: 2_000 });
    expect(await add(3_000)).toMatchObject({ ok: false, status: 409, code: 'IDEMPOTENCY_CONFLICT' });
    expect(await ctx.engine.addWeeklyTopUp({ identitySubject: SUBJECT, adminSubject: 'admin-1', idempotencyKey: 'tu-bad', amountMicroUsd: 0, reasonCode: 'SUPPORT' })).toMatchObject({ ok: false, status: 400, field: 'amountMicroUsd' });
  });

  it('追加只在當週有效：下週的預留看不到上週的追加', async () => {
    const ctx = setup('2026-10-06T10:00:00', undefined, WEEK_BASE_10K);
    await ctx.engine.addWeeklyTopUp({ identitySubject: SUBJECT, adminSubject: 'admin-1', idempotencyKey: 'tu-1', amountMicroUsd: 5_000, reasonCode: 'SUPPORT' });
    expect(await ctx.reserve(12_000, 'this-week')).toMatchObject({ ok: true });
    ctx.setNow('2026-10-12T00:00:01'); // 下週
    expect(await ctx.reserve(12_000, 'next-week')).toMatchObject({ ok: false, status: 429, deniedWindow: 'week' });
    expect(await ctx.reserve(10_000, 'next-week-base')).toMatchObject({ ok: true });
  });

  it('資格與等級：無資格／pending／revoked／到期 → 403；tier 變更立即套用且不寫入任何額度', async () => {
    const ctx = setup();
    for (const [status, expiresAt] of [['pending', null], ['rejected', null], ['revoked', null], ['approved', '2026-10-06T00:00:00.000Z']] as const) {
      ctx.store.seed({ identitySubject: 'user-x', status, tier: 'tier1', expiresAt });
      expect(await ctx.reserve(10, `k-${status}`, { subject: 'user-x' })).toMatchObject({ ok: false, status: 403, code: 'ACCESS_NOT_APPROVED' });
    }
    expect(await ctx.reserve(10, 'k-missing', { subject: 'user-none' })).toMatchObject({ ok: false, status: 403, reason: 'missing' });
    expect((await ctx.store.readUsage('user-x', '2026-10-06', '2026-W41')).day.reservedMicroUsd).toBe(0);

    expect(await ctx.reserve(DAY_LIMIT + 1, 'tier1-big')).toMatchObject({ ok: false, status: 429 });
    await ctx.store.setEligibility({ identitySubject: SUBJECT, status: 'approved', tier: 'tier2', expiresAt: null, nowIso: TPE('2026-10-06T10:00:00').toISOString() });
    expect(await ctx.reserve(DAY_LIMIT + 1, 'tier2-big')).toMatchObject({ ok: true });
    expect(await ctx.engine.getSnapshot({ identitySubject: SUBJECT })).toMatchObject({ ok: true, tier: 'tier2' });
    expect(await ctx.engine.getSnapshot({ identitySubject: 'user-none' })).toMatchObject({ ok: false, status: 403 });
  });
});

describe('H2：一次上游執行權；duplicate 在任何狀態都不得再放行', () => {
  it('並發相同請求：恰好一個取得 executionGrant，其餘為 409 DUPLICATE_REQUEST（executionGrant:false）', async () => {
    const { reserve, store } = setup();
    const results = await Promise.all(Array.from({ length: 10 }, () => reserve(4_000, 'same-key')));
    expect(results.filter((r) => r.ok && r.executionGrant)).toHaveLength(1);
    const dups = results.filter((r) => !r.ok && r.status === 409 && r.code === 'DUPLICATE_REQUEST');
    expect(dups).toHaveLength(9);
    for (const d of dups) expect(d).toMatchObject({ executionGrant: false, reservationStatus: 'reserved' });
    expect(new Set(dups.map((d) => (d.ok ? '' : (d as { reservationId: string }).reservationId))).size).toBe(1);
    expect((await store.readUsage(SUBJECT, '2026-10-06', '2026-W41')).day.reservedMicroUsd).toBe(4_000);
  });

  it.each([
    ['settled', { kind: 'success' as const, settlementEstimateMicroUsd: 1_000, attempts: 1, standardTier: true, costModelVersion: MODEL.version }],
    ['released', { kind: 'explicit_unbilled_failure' as const }],
    ['uncertain', { kind: 'uncertain' as const }],
  ])('終態 %s 後重複提交仍是 duplicate，不重新放行、不改變餘額', async (status, outcome) => {
    const ctx = setup();
    const first = await ctx.reserve(5_000, 'k');
    if (!first.ok) throw new Error('預留失敗');
    await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: first.reservation.reservationId, outcome });
    const before = await ctx.store.readUsage(SUBJECT, '2026-10-06', '2026-W41');
    const again = await ctx.reserve(5_000, 'k');
    expect(again).toMatchObject({ ok: false, status: 409, code: 'DUPLICATE_REQUEST', executionGrant: false, reservationStatus: status });
    expect(await ctx.store.readUsage(SUBJECT, '2026-10-06', '2026-W41')).toEqual(before);
  });

  it('lease 到期、跨日跨週後重複提交也不恢復執行權', async () => {
    const ctx = setup();
    await ctx.reserve(5_000, 'k');
    ctx.setNow('2026-10-06T10:05:00'); // 超過 lease
    expect(await ctx.reserve(5_000, 'k')).toMatchObject({ ok: false, status: 409, code: 'DUPLICATE_REQUEST', executionGrant: false });
    ctx.setNow('2026-10-20T10:00:00');
    expect(await ctx.reserve(5_000, 'k')).toMatchObject({ ok: false, status: 409, code: 'DUPLICATE_REQUEST', executionGrant: false });
  });

  it('同一冪等鍵但內容不同：衝突、不預留、不放行，並記錄衝突次數與指紋', async () => {
    const ctx = setup();
    const first = await ctx.reserve(4_000, 'k', { content: 'A' });
    if (!first.ok) throw new Error('預留失敗');
    const variants: Array<[number, ReserveOptions]> = [
      [5_000, { content: 'A' }], // 金額不同
      [4_000, { content: 'B' }], // 內容不同
      [4_000, { content: 'A', inputs: { inputTokens: 9 } }], // 估算輸入不同
      [4_000, { content: 'A', model: { ...MODEL, version: 'FIXTURE_OTHER_v1' } }], // 價表版本不同
    ];
    for (const [amount, opt] of variants) {
      expect(await ctx.reserve(amount, 'k', opt)).toMatchObject({ ok: false, status: 409, code: 'IDEMPOTENCY_CONFLICT' });
    }
    expect((await ctx.store.readUsage(SUBJECT, '2026-10-06', '2026-W41')).day.reservedMicroUsd).toBe(4_000);
    const record = await ctx.store.getReservation(SUBJECT, first.reservation.reservationId);
    expect(record).toMatchObject({ conflictCount: 4, status: 'reserved' });
    expect(record?.lastConflictFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(record?.lastConflictFingerprint).not.toBe(record?.requestFingerprint);
  });
});

describe('M1：請求指紋', () => {
  it('只含 HMAC-SHA-256；稽核資料不含完整對話、音訊或圖片內容', async () => {
    const ctx = setup();
    const secret = '使用者私人對話-SECRET-TEXT-12345';
    const r = await ctx.reserve(1_000, 'fp', { content: secret, inputs: { inputTokens: 40 } });
    if (!r.ok) throw new Error('預留失敗');
    expect(r.reservation.requestFingerprint).toMatch(/^[0-9a-f]{64}$/);
    const dump = ctx.store.dumpState();
    expect(dump).not.toContain('SECRET-TEXT');
    expect(dump).not.toContain(secret);
    expect(JSON.stringify(r)).not.toContain('SECRET-TEXT');
    expect(dump).not.toContain(createHash('sha256').update(secret).digest('hex'));
  });

  it('指紋 canonical：estimateInputs 鍵順序無關；任一欄位變動即改變', () => {
    const trustedCost = { ...fixtureTrustedCost('assistant', 100), estimateInputs: { inputTokens: 1, maxOutputTokens: 2 } };
    const base = { identitySubject: SUBJECT, endpoint: 'assistant' as const, content: 'c', trustedCost };
    const fp = buildRequestFingerprint(base, FIXTURE_FINGERPRINT_KEY);
    expect(buildRequestFingerprint({
      ...base, trustedCost: { ...trustedCost, estimateInputs: { maxOutputTokens: 2, inputTokens: 1 } },
    }, FIXTURE_FINGERPRINT_KEY)).toBe(fp);
    for (const changed of [
      { identitySubject: 'other' },
      { trustedCost: { ...trustedCost, amountMicroUsd: 101 } },
      { trustedCost: { ...trustedCost, costModel: { ...trustedCost.costModel, version: 'v2' } } },
      { trustedCost: { ...trustedCost, estimateInputs: { inputTokens: 2, maxOutputTokens: 2 } } },
      { content: 'd' },
    ]) {
      expect(buildRequestFingerprint({ ...base, ...changed }, FIXTURE_FINGERPRINT_KEY)).not.toBe(fp);
    }
  });
});

describe('M2：價表版本與有效期', () => {
  it('isCostModelEffective：[from, until) 邊界；空區間或無效時間永不有效', () => {
    const from = Date.parse(FIXTURE_EFFECTIVE_FROM);
    const until = Date.parse(FIXTURE_EXPIRES_AT);
    expect(isCostModelEffective(MODEL, from - 1)).toBe(false);
    expect(isCostModelEffective(MODEL, from)).toBe(true);
    expect(isCostModelEffective(MODEL, until - 1)).toBe(true);
    expect(isCostModelEffective(MODEL, until)).toBe(false);
    expect(isCostModelEffective({ ...MODEL, expiresAt: MODEL.effectiveFrom }, from)).toBe(false);
    expect(isCostModelEffective({ ...MODEL, expiresAt: 'not-a-date' }, from)).toBe(false);
    expect(isCostModelEffective(undefined, from)).toBe(false);
  });

  it('尚未生效或已過期的價表 → 503 COST_MODEL_INVALID，不寫入任何預留', async () => {
    const ctx = setup();
    ctx.setNow('2025-12-31T23:59:59');
    expect(await ctx.reserve(100, 'early')).toMatchObject({ ok: false, status: 503, reason: 'COST_MODEL_INVALID' });
    ctx.setNow('2027-01-01T08:00:00'); // 台北 = 2027-01-01T00:00Z，剛好到期
    expect(await ctx.reserve(100, 'late')).toMatchObject({ ok: false, status: 503, reason: 'COST_MODEL_INVALID' });
    ctx.setNow('2026-10-06T10:00:00');
    expect(await ctx.reserve(100, 'ok')).toMatchObject({ ok: true });
  });
});

describe('M3：執行期驗證與無效狀態拒絕', () => {
  async function forged(mutate: (r: ReserveResult) => ReserveResult, run: (ctx: Ctx, eng: ReturnType<Ctx['engineFor']>) => Promise<void>) {
    const ctx = setup();
    const store = wrapStore(ctx.store, { reserve: async (c) => mutate(await ctx.store.reserve(c)) });
    await run(ctx, ctx.engineFor(store, DEFAULT_TIERS));
  }
  const invalidData = { ok: false, status: 503, reason: 'INVALID_STORE_DATA' };

  it('store 回傳身分／金額／指紋／狀態被竄改 → INVALID_STORE_DATA，不產生成功快照', async () => {
    const mutations: Array<(r: ReserveResult) => ReserveResult> = [
      (r) => (r.status === 'reserved' ? { ...r, reservation: { ...r.reservation, identitySubject: 'someone-else' } } : r),
      (r) => (r.status === 'reserved' ? { ...r, reservation: { ...r.reservation, estimatedCostUpperBoundUsdMicro: 1 } } : r),
      (r) => (r.status === 'reserved' ? { ...r, reservation: { ...r.reservation, requestFingerprint: 'f'.repeat(64) } } : r),
      (r) => (r.status === 'reserved' ? { ...r, reservation: { ...r.reservation, status: 'settled' } } : r),
      (r) => (r.status === 'reserved' ? { ...r, reservation: { ...r.reservation, endpoint: 'places' } } : r),
      (r) => (r.status === 'reserved' ? { ...r, reservation: { ...r.reservation, dayWindowKey: '1999-01-01' } } : r),
      (r) => (r.status === 'reserved' ? { ...r, executionGrant: false as never } : r),
    ];
    for (const mutate of mutations) {
      await forged(mutate, async (ctx, eng) => {
        expect(await ctx.reserveWith(eng, 1_000, 'k')).toMatchObject(invalidData);
      });
    }
  });

  it('usage／limits 無效：負數、小數、不安全整數、超過上限、與營運設定不符', async () => {
    const mutations: Array<(r: ReserveResult) => ReserveResult> = [
      (r) => (r.status === 'reserved' ? { ...r, usage: { ...r.usage, day: { usedMicroUsd: -1, reservedMicroUsd: 1_000 } } } : r),
      (r) => (r.status === 'reserved' ? { ...r, usage: { ...r.usage, day: { usedMicroUsd: 0.5, reservedMicroUsd: 1_000 } } } : r),
      (r) => (r.status === 'reserved' ? { ...r, usage: { ...r.usage, week: { usedMicroUsd: Number.MAX_SAFE_INTEGER + 2, reservedMicroUsd: 1_000 } } } : r),
      (r) => (r.status === 'reserved' ? { ...r, usage: { ...r.usage, day: { usedMicroUsd: DAY_LIMIT, reservedMicroUsd: 1_000 } } } : r),
      (r) => (r.status === 'reserved' ? { ...r, usage: { ...r.usage, day: { usedMicroUsd: 0, reservedMicroUsd: 1 } } } : r), // 少於本筆預留
      (r) => (r.status === 'reserved' ? { ...r, limits: { ...r.limits, dayLimitMicroUsd: 999_999_999 } } : r),
      (r) => (r.status === 'reserved' ? { ...r, limits: { ...r.limits, weekLimitMicroUsd: r.limits.weekLimitMicroUsd + 1 } } : r),
      (r) => (r.status === 'reserved' ? { ...r, limits: { ...r.limits, tier: 'tier9' as never } } : r),
    ];
    for (const mutate of mutations) {
      await forged(mutate, async (ctx, eng) => {
        expect(await ctx.reserveWith(eng, 1_000, 'k')).toMatchObject(invalidData);
      });
    }
  });

  it('denied 與 duplicate／conflict 的偽造回傳同樣被拒', async () => {
    const ctx = setup();
    await ctx.reserve(DAY_LIMIT, 'fill');
    const lying = ctx.engineFor(wrapStore(ctx.store, { reserve: async (c) => {
      const r = await ctx.store.reserve(c);
      return r.status === 'denied' ? { ...r, deniedWindow: 'week' as const } : r;
    } }), DEFAULT_TIERS);
    expect(await ctx.reserveWith(lying, 1, 'x')).toMatchObject(invalidData);

    const fakeDup = ctx.engineFor(wrapStore(ctx.store, { reserve: async (c) => {
      const r = await ctx.store.reserve(c);
      return r.status === 'duplicate' ? { ...r, executionGrant: true as never } : r;
    } }), DEFAULT_TIERS);
    await ctx.store.setEligibility({ identitySubject: SUBJECT, status: 'approved', tier: 'tier2', expiresAt: null, nowIso: TPE('2026-10-06T10:00:00').toISOString() });
    const eng2 = ctx.engineFor(ctx.store, DEFAULT_TIERS);
    expect(await ctx.reserveWith(eng2, 10, 'dup2')).toMatchObject({ ok: true });
    expect(await ctx.reserveWith(fakeDup, 10, 'dup2')).toMatchObject(invalidData);
  });

  it('未知 status 與 null 回傳一律拒絕；getSnapshot 的偽造 usage 被拒', async () => {
    const ctx = setup();
    for (const bad of [null, { status: 'maybe' }, undefined]) {
      const eng = ctx.engineFor(wrapStore(ctx.store, { reserve: async () => bad as never }), DEFAULT_TIERS);
      expect(await ctx.reserveWith(eng, 10, 'k')).toMatchObject(invalidData);
    }
    const badSnap = ctx.engineFor(
      wrapStore(ctx.store, {
        readQuota: async (...a) => {
          const r = await ctx.store.readQuota(...a);
          return r.status === 'ok' ? { ...r, usage: { ...r.usage, day: { usedMicroUsd: -5, reservedMicroUsd: 0 } } } : r;
        },
      }),
      DEFAULT_TIERS,
    );
    expect(await badSnap.getSnapshot({ identitySubject: SUBJECT })).toMatchObject(invalidData);
  });

  it('settle：偽造的預留紀錄（他人、金額不符）被拒；無效 outcome 為 400', async () => {
    const ctx = setup();
    const r = await ctx.reserve(5_000, 'k');
    if (!r.ok) throw new Error('預留失敗');
    const id = r.reservation.reservationId;
    const lying = ctx.engineFor(
      wrapStore(ctx.store, { getReservation: async (s, i) => ({ ...(await ctx.store.getReservation(s, i))!, identitySubject: 'someone-else' }) }),
      DEFAULT_TIERS,
    );
    expect(await lying.settle({ identitySubject: SUBJECT, reservationId: id, outcome: { kind: 'uncertain' } })).toMatchObject(invalidData);
    const badSettle = ctx.engineFor(
      wrapStore(ctx.store, { settle: async (c) => ({ status: 'applied', identitySubject: c.identitySubject, dayWindowKey: r.reservation.dayWindowKey, weekWindowKey: r.reservation.weekWindowKey, reservation: { ...(await ctx.store.getReservation(c.identitySubject, c.reservationId))!, status: 'reserved' }, usage: { day: { usedMicroUsd: 0, reservedMicroUsd: 5_000 }, week: { usedMicroUsd: 0, reservedMicroUsd: 5_000 } } }) }),
      DEFAULT_TIERS,
    );
    expect(await badSettle.settle({ identitySubject: SUBJECT, reservationId: id, outcome: { kind: 'uncertain' } })).toMatchObject(invalidData);

    const outcomes = [
      { kind: 'success', attempts: 0, standardTier: true, costModelVersion: MODEL.version },
      { kind: 'success', attempts: 1, standardTier: 'yes', costModelVersion: MODEL.version },
      { kind: 'success', attempts: 1, standardTier: true },
      { kind: 'refund' },
      null,
    ];
    for (const outcome of outcomes) {
      expect(await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: id, outcome: outcome as never })).toMatchObject({ ok: false, status: 400, field: 'outcome' });
    }
    expect(await ctx.store.getReservation(SUBJECT, id)).toMatchObject({ status: 'reserved' });
  });
});

describe('T022 結算（plan §4.4）', () => {
  async function reserved(amount = 9_630) {
    const ctx = setup();
    const r = await ctx.reserve(amount, 'settle-key');
    if (!r.ok) throw new Error('預留失敗');
    return { ...ctx, id: r.reservation.reservationId };
  }
  const usage = async (ctx: Awaited<ReturnType<typeof reserved>>, day = '2026-10-06', week = '2026-W41') => ctx.store.readUsage(SUBJECT, day, week);

  it('成功且 attempts==1／標準層級：釋放差額，只計估算值', async () => {
    const ctx = await reserved();
    const r = await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: ctx.id, outcome: SUCCESS });
    expect(r).toMatchObject({ settlementStatus: 'accounted', alreadyApplied: false, reservation: { status: 'settled', settlementReason: 'success' } });
    expect(await usage(ctx)).toEqual({ day: { usedMicroUsd: 4_000, reservedMicroUsd: 0 }, week: { usedMicroUsd: 4_000, reservedMicroUsd: 0 } });
  });

  it('attempts>1、非標準層級、估算缺漏／無效、價表版本不符 → 保守按預留；估算較高則採較高者', async () => {
    const ok = { attempts: 1, standardTier: true, costModelVersion: MODEL.version };
    const cases: Array<[Parameters<Ctx['engine']['settle']>[0]['outcome'], number]> = [
      [{ kind: 'success', settlementEstimateMicroUsd: 1_000, ...ok, attempts: 2 }, 9_630],
      [{ kind: 'success', settlementEstimateMicroUsd: 1_000, ...ok, standardTier: false }, 9_630],
      [{ kind: 'success', ...ok }, 9_630],
      [{ kind: 'success', settlementEstimateMicroUsd: -5, ...ok }, 9_630],
      [{ kind: 'success', settlementEstimateMicroUsd: Number.NaN, ...ok }, 9_630],
      [{ kind: 'success', settlementEstimateMicroUsd: 1_000, ...ok, costModelVersion: 'FIXTURE_OTHER_v1' }, 9_630],
      [{ kind: 'success', settlementEstimateMicroUsd: 12_000, ...ok, attempts: 3 }, 12_000],
    ];
    for (const [outcome, expectedUsed] of cases) {
      const ctx = await reserved();
      await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: ctx.id, outcome });
      expect((await usage(ctx)).day).toEqual({ usedMicroUsd: expectedUsed, reservedMicroUsd: 0 });
    }
  });

  it('結算高於預留：如實計入、不截斷、封鎖版本與相同成本參數；改版本不解封；不宣稱可追回', async () => {
    const ctx = await reserved(9_630);
    const r = await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: ctx.id, outcome: { ...SUCCESS, settlementEstimateMicroUsd: 15_000 } });
    expect(r).toMatchObject({
      settlementStatus: 'accounted_cost_bound_exceeded', ok: false, status: 503,
      reservation: { status: 'settled', settledChargeUsdMicro: 15_000, overrunMicroUsd: 5_370 },
      costOverrun: { reservedMicroUsd: 9_630, chargedMicroUsd: 15_000, excessMicroUsd: 5_370, blockedCostModelVersion: MODEL.version },
    });
    expect(await usage(ctx)).toEqual({ day: { usedMicroUsd: 15_000, reservedMicroUsd: 0 }, week: { usedMicroUsd: 15_000, reservedMicroUsd: 0 } });
    expect(ctx.store.isCostModelBlocked(MODEL.version)).toBe(true);

    expect(await ctx.reserve(100, 'after-overrun')).toMatchObject({ ok: false, status: 503, reason: 'COST_MODEL_BLOCKED' });
    expect(await ctx.reserve(100, 'new-model', { model: { ...MODEL, version: 'FIXTURE_REVIEWED_v2' } }))
      .toMatchObject({ ok: false, status: 503, reason: 'COST_MODEL_BLOCKED' });
    // 封鎖不影響既有 duplicate 判斷（仍不重新放行）
    expect(await ctx.reserve(9_630, 'settle-key')).toMatchObject({ ok: false, status: 409, code: 'DUPLICATE_REQUEST', executionGrant: false });
  });

  it('明確未計費失敗：釋放預留，已用不增加', async () => {
    const ctx = await reserved();
    const r = await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: ctx.id, outcome: { kind: 'explicit_unbilled_failure' } });
    expect(r).toMatchObject({ settlementStatus: 'accounted', reservation: { status: 'released' } });
    expect(await usage(ctx)).toEqual({ day: { usedMicroUsd: 0, reservedMicroUsd: 0 }, week: { usedMicroUsd: 0, reservedMicroUsd: 0 } });
  });

  it('逾時／不確定：保留預留並標記 uncertain；時間流逝與重試皆不自動退款', async () => {
    const ctx = await reserved();
    const r = await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: ctx.id, outcome: { kind: 'uncertain' } });
    expect(r).toMatchObject({ settlementStatus: 'accounted', reservation: { status: 'uncertain', settlementReason: 'timeout_uncertain' } });
    ctx.setNow('2026-10-20T10:00:00');
    expect(await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: ctx.id, outcome: { kind: 'uncertain' } })).toMatchObject({ settlementStatus: 'accounted', alreadyApplied: true });
    expect(await usage(ctx)).toEqual({ day: { usedMicroUsd: 0, reservedMicroUsd: 9_630 }, week: { usedMicroUsd: 0, reservedMicroUsd: 9_630 } });
    for (const outcome of [{ kind: 'explicit_unbilled_failure' as const }, SUCCESS]) {
      expect(await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: ctx.id, outcome })).toMatchObject({ ok: false, status: 409 });
    }
    expect((await usage(ctx)).day.reservedMicroUsd).toBe(9_630);
    // 晚到成功只留紀錄，不改餘額
    expect(await ctx.store.getReservation(SUBJECT, ctx.id)).toMatchObject({ status: 'uncertain', lateOutcomeObserved: { outcome: 'unbilled_failure' } });
  });

  it('冪等結算：重複與並發結算只套用一次；不同結果的衝突被拒', async () => {
    const ctx = await reserved();
    const results = await Promise.all(Array.from({ length: 10 }, () => ctx.engine.settle({ identitySubject: SUBJECT, reservationId: ctx.id, outcome: SUCCESS })));
    expect(results.filter((r) => 'settlementStatus' in r && r.settlementStatus === 'accounted' && !r.alreadyApplied)).toHaveLength(1);
    expect(results.filter((r) => 'settlementStatus' in r && r.settlementStatus === 'accounted' && r.alreadyApplied)).toHaveLength(9);
    expect((await usage(ctx)).day).toEqual({ usedMicroUsd: 4_000, reservedMicroUsd: 0 });
    expect(await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: ctx.id, outcome: { kind: 'explicit_unbilled_failure' } })).toMatchObject({ ok: false, status: 409, code: 'INVALID_SETTLEMENT_TRANSITION' });
    expect((await usage(ctx)).day.usedMicroUsd).toBe(4_000);
  });

  it('找不到預留、其他使用者的預留 → 404', async () => {
    const ctx = await reserved();
    expect(await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: 'nope', outcome: { kind: 'uncertain' } })).toMatchObject({ ok: false, status: 404 });
    expect(await ctx.engine.settle({ identitySubject: 'other-user', reservationId: ctx.id, outcome: { kind: 'uncertain' } })).toMatchObject({ ok: false, status: 404 });
  });

  it('已用金額溢位時拒絕結算（BigInt 判斷），預留維持不變', async () => {
    const max = Number.MAX_SAFE_INTEGER;
    const ctx = setup('2026-10-06T10:00:00', undefined, { ...DEFAULT_TIERS, tier1: { dayLimitMicroUsd: max, weekBaseLimitMicroUsd: max } });
    const a = await ctx.reserve(10, 'a');
    const b = await ctx.reserve(10, 'b');
    if (!a.ok || !b.ok) throw new Error('預留失敗');
    const huge = { ...SUCCESS, settlementEstimateMicroUsd: max - 10, attempts: 1 };
    expect(await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: a.reservation.reservationId, outcome: huge })).toMatchObject({ settlementStatus: 'accounted_cost_bound_exceeded', ok: false, status: 503 });
    const overflow = await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: b.reservation.reservationId, outcome: { ...huge, settlementEstimateMicroUsd: 1_000 } });
    expect(overflow).toMatchObject({ ok: false, status: 503 });
    expect(await ctx.store.getReservation(SUBJECT, b.reservation.reservationId)).toMatchObject({ status: 'reserved' });
  });

  it('跨期完成：按原預留日／週窗口結算，新窗口不受影響', async () => {
    const ctx = setup('2026-10-04T23:59:59');
    const r = await ctx.reserve(10_000, 'cross');
    if (!r.ok) throw new Error('預留失敗');
    expect(r.reservation).toMatchObject({ dayWindowKey: '2026-10-04', weekWindowKey: '2026-W40' });

    ctx.setNow('2026-10-05T00:00:05'); // 已進入新日、新週（仍在 lease 內：僅 6 秒）
    const fresh = await ctx.reserve(20_000, 'new-window');
    expect(fresh).toMatchObject({ ok: true });
    if (fresh.ok) {
      expect(fresh.snapshot.day).toMatchObject({ windowKey: '2026-10-05', reservedEstimatedUsdMicro: 20_000, remainingEstimatedUsdMicro: DAY_LIMIT - 20_000 });
      expect(fresh.snapshot.week).toMatchObject({ windowKey: '2026-W41', reservedEstimatedUsdMicro: 20_000 });
    }

    await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: r.reservation.reservationId, outcome: { ...SUCCESS, settlementEstimateMicroUsd: 6_000 } });
    expect(await ctx.store.readUsage(SUBJECT, '2026-10-04', '2026-W40')).toEqual({ day: { usedMicroUsd: 6_000, reservedMicroUsd: 0 }, week: { usedMicroUsd: 6_000, reservedMicroUsd: 0 } });
    expect(await ctx.store.readUsage(SUBJECT, '2026-10-05', '2026-W41')).toEqual({ day: { usedMicroUsd: 0, reservedMicroUsd: 20_000 }, week: { usedMicroUsd: 0, reservedMicroUsd: 20_000 } });
  });

  it('窗口跨期後額度重新計算：舊日耗盡不影響新日；同週內週額度延續', async () => {
    const tiers: TierLimitTable = { ...DEFAULT_TIERS, tier1: { dayLimitMicroUsd: 100_000, weekBaseLimitMicroUsd: 150_000 } };
    const ctx = setup('2026-10-06T23:00:00', undefined, tiers);
    expect(await ctx.reserve(100_000, 'full-day')).toMatchObject({ ok: true });
    expect(await ctx.reserve(1, 'same-day')).toMatchObject({ ok: false, deniedWindow: 'day' });
    ctx.setNow('2026-10-07T00:00:01');
    expect(await ctx.reserve(50_000, 'next-day')).toMatchObject({ ok: true });
    expect(await ctx.reserve(1, 'week-full')).toMatchObject({ ok: false, deniedWindow: 'week' });
  });
});

describe('M4：process 中斷與 lease（保守保留，不自動退款或重放）', () => {
  it('lease 到期後才回報成功／失敗：原子轉 uncertain，餘額保留，回 409 RESERVATION_LEASE_EXPIRED', async () => {
    for (const outcome of [SUCCESS, { kind: 'explicit_unbilled_failure' as const }]) {
      const ctx = setup();
      const r = await ctx.reserve(9_630, 'k');
      if (!r.ok) throw new Error('預留失敗');
      ctx.setNow('2026-10-06T10:02:00'); // 超過 60 秒 lease
      const res = await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: r.reservation.reservationId, outcome });
      expect(res).toMatchObject({ ok: false, status: 409, code: 'RESERVATION_LEASE_EXPIRED', reservation: { status: 'uncertain', settlementReason: 'lease_expired' } });
      expect(await ctx.store.readUsage(SUBJECT, '2026-10-06', '2026-W41')).toEqual({ day: { usedMicroUsd: 0, reservedMicroUsd: 9_630 }, week: { usedMicroUsd: 0, reservedMicroUsd: 9_630 } });
      expect(await ctx.store.getReservation(SUBJECT, r.reservation.reservationId)).toMatchObject({ status: 'uncertain', lateOutcomeObserved: { observedAt: expect.any(String) } });
      // 之後再重試也不會改變餘額或重新放行
      expect(await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: r.reservation.reservationId, outcome })).toMatchObject({ ok: false, status: 409 });
      expect(await ctx.reserve(9_630, 'k')).toMatchObject({ ok: false, code: 'DUPLICATE_REQUEST', executionGrant: false, reservationStatus: 'uncertain' });
    }
  });

  it('lease 內的結算正常；lease 邊界（等於到期時間）仍視為有效', async () => {
    const ctx = setup();
    const r = await ctx.reserve(9_630, 'k');
    if (!r.ok) throw new Error('預留失敗');
    ctx.setNow('2026-10-06T10:01:00'); // 剛好 60 秒
    expect(await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: r.reservation.reservationId, outcome: SUCCESS })).toMatchObject({ settlementStatus: 'accounted', reservation: { status: 'settled' } });
  });

  it('sweepExpiredLeases：只把逾 lease 的 reserved 轉 uncertain；不退款、不重放、不動未逾期者', async () => {
    const ctx = setup();
    const old = await ctx.reserve(1_000, 'old');
    ctx.setNow('2026-10-06T10:05:00');
    const fresh = await ctx.reserve(2_000, 'fresh');
    if (!old.ok || !fresh.ok) throw new Error('預留失敗');
    expect(await ctx.engine.sweepExpiredLeases({ identitySubject: SUBJECT })).toEqual({ ok: true, expired: 1 });
    expect(await ctx.store.getReservation(SUBJECT, old.reservation.reservationId)).toMatchObject({ status: 'uncertain', settlementReason: 'lease_expired' });
    expect(await ctx.store.getReservation(SUBJECT, fresh.reservation.reservationId)).toMatchObject({ status: 'reserved' });
    expect((await ctx.store.readUsage(SUBJECT, '2026-10-06', '2026-W41')).day).toEqual({ usedMicroUsd: 0, reservedMicroUsd: 3_000 });
    expect(await ctx.engine.sweepExpiredLeases({ identitySubject: SUBJECT })).toEqual({ ok: true, expired: 0 });
    expect(await ctx.reserve(1_000, 'old')).toMatchObject({ ok: false, code: 'DUPLICATE_REQUEST', executionGrant: false });
  });

  it('逾時後晚到成功（store 端結果未知）仍只會是 uncertain，不會變成可重新執行', async () => {
    const ctx = setup();
    const r = await ctx.reserve(5_000, 'k');
    if (!r.ok) throw new Error('預留失敗');
    const id = r.reservation.reservationId;
    expect(await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: id, outcome: { kind: 'uncertain' } })).toMatchObject({ settlementStatus: 'accounted' });
    expect(await ctx.engine.settle({ identitySubject: SUBJECT, reservationId: id, outcome: SUCCESS })).toMatchObject({ ok: false, status: 409, code: 'INVALID_SETTLEMENT_TRANSITION' });
    expect(await ctx.store.getReservation(SUBJECT, id)).toMatchObject({ status: 'uncertain', lateOutcomeObserved: { outcome: 'success' } });
    expect(await ctx.reserve(5_000, 'k')).toMatchObject({ ok: false, executionGrant: false });
  });

  it('store 逾時於 settle：fail closed 503，狀態不被引擎假設為已結算', async () => {
    const ctx = setup();
    const r = await ctx.reserve(5_000, 'k');
    if (!r.ok) throw new Error('預留失敗');
    const slow = ctx.engineFor(wrapStore(ctx.store, { settle: () => new Promise<SettleResult>(() => undefined) }), DEFAULT_TIERS);
    expect(await slow.settle({ identitySubject: SUBJECT, reservationId: r.reservation.reservationId, outcome: SUCCESS })).toMatchObject({ ok: false, status: 503, reason: 'STORE_UNAVAILABLE' });
    expect(await ctx.store.getReservation(SUBJECT, r.reservation.reservationId)).toMatchObject({ status: 'reserved' });
  });
});
