import { describe, expect, it, vi } from 'vitest';
import { costParametersDigest, type CostRegistry, type CostRegistryEntry } from '../../api/_lib/cost-registry';
import { createQuotaEngine } from '../../api/_lib/quota-engine';
import { PRODUCTION_COST_PRICE_TABLE, PROTECTED_ENDPOINTS } from '../../api/_lib/cost-price-table';
import type { EstimateInputs } from '../../api/_lib/quota-estimate-inputs';
import { fixtureRegistryEntry } from '../fixtures/cost-registry-fixtures';
import { FIXTURE_FINGERPRINT_KEY } from '../fixtures/quota-fingerprint-fixtures';
import { InMemorySharedStoreMock } from '../support/in-memory-shared-store';

const subject = 'registry-subject';
const request = { identitySubject: subject, endpoint: 'assistant' as const, idempotencyKey: 'first', content: '私密測試內容' };
const unavailable = { ok: false, status: 503, code: 'PROTECTION_SERVICE_UNAVAILABLE' };

function setup(initial = fixtureRegistryEntry()) {
  let entry: CostRegistryEntry | null = initial;
  let now = new Date('2026-10-06T02:00:00.000Z');
  let id = 0;
  const store = new InMemorySharedStoreMock();
  store.seed({ identitySubject: subject, status: 'approved', tier: 'tier1', expiresAt: null });
  const registry: CostRegistry = { resolve: async () => entry };
  const options = {
    store, costRegistry: registry, fingerprintKey: FIXTURE_FINGERPRINT_KEY,
    tierLimits: {
      tier1: { dayLimitMicroUsd: 1_000_000, weekBaseLimitMicroUsd: 3_000_000 },
      tier2: { dayLimitMicroUsd: 10_000_000, weekBaseLimitMicroUsd: 30_000_000 },
    },
    now: () => now, newId: () => `registry-${++id}`, leaseMs: 60_000, storeTimeoutMs: 50,
  };
  return {
    store, registry, options, engine: createQuotaEngine(options),
    setEntry: (next: CostRegistryEntry | null) => { entry = next; },
    setNow: (iso: string) => { now = new Date(iso); },
  };
}

function reapprove(entry: CostRegistryEntry): CostRegistryEntry {
  entry.approval.parametersDigest = costParametersDigest(entry);
  entry.approval.approvalEvidenceRef = `FIXTURE_APPROVAL_${entry.approval.parametersDigest.slice(0, 16)}`;
  entry.approval.boundEvidenceRef = `FIXTURE_BOUND_${entry.approval.parametersDigest.slice(0, 16)}`;
  return entry;
}

describe('Batch-M3a A4 可信 registry 與估算器（僅 fixture／memory mock）', () => {
  it('本輪 M1：估算後至預留前修改原 registry 物件不改變已驗證成本快照', async () => {
    const entry = fixtureRegistryEntry();
    const ctx = setup(entry);
    const originalDigest = costParametersDigest(entry);
    const originalVersion = entry.version;
    const realReserve = ctx.store.reserve.bind(ctx.store);
    vi.spyOn(ctx.store, 'reserve').mockImplementation(async (command) => {
      entry.table.version = 'FIXTURE_MUTATED';
      entry.version = 'FIXTURE_MUTATED';
      entry.table.expiresAt = '2026-10-06T02:00:00.000Z';
      entry.blocked = true;
      entry.estimateBounds.inputTokens = 1;
      entry.approval.parametersDigest = 'a'.repeat(64);
      return realReserve(command);
    });
    expect(await ctx.engine.reserve(request, { inputTokens: 100 })).toMatchObject({
      ok: true, executionGrant: true,
      reservation: { costModelVersion: originalVersion, costParametersDigest: originalDigest, estimatedCostUpperBoundUsdMicro: 2_430 },
    });
  });

  it('金額由估算器產生，預留與 HMAC 綁定後端成本摘要且不保存內容', async () => {
    const ctx = setup();
    const spy = vi.spyOn(ctx.store, 'reserve');
    const result = await ctx.engine.reserve(request, { inputTokens: 100 });
    expect(result).toMatchObject({
      ok: true, executionGrant: true,
      reservation: { estimatedCostUpperBoundUsdMicro: 2_430, costParametersDigest: costParametersDigest(fixtureRegistryEntry()) },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].estimateInputs).toEqual({ inputTokens: 100, maxOutputTokens: 2_000 });
    expect(JSON.stringify(spy.mock.calls)).not.toContain('私密測試內容');
    expect(ctx.store.dumpState()).not.toContain('私密測試內容');
  });

  it.each([
    { amountMicroUsd: 1 }, { costModelVersion: 'INJECTED' }, { costModel: { version: 'INJECTED' } },
    { model: 'INJECTED' }, { billingTier: 'priority' }, { attempts: 3 }, { costParametersDigest: 'a'.repeat(64) },
  ])('拒絕 request 與估算參數的成本注入 %j', async (extra) => {
    const ctx = setup();
    const spy = vi.spyOn(ctx.store, 'reserve');
    expect(await ctx.engine.reserve({ ...request, ...extra })).toMatchObject({ ok: false, status: 400 });
    expect(await ctx.engine.reserve(request, extra as EstimateInputs)).toMatchObject(unavailable);
    expect(spy).not.toHaveBeenCalled();
  });

  it('沒有 registry、未知 entry、查詢失敗及逾時皆 fail closed，無成本 fallback', async () => {
    const ctx = setup();
    const spy = vi.spyOn(ctx.store, 'reserve');
    expect(await createQuotaEngine({ ...ctx.options, costRegistry: undefined }).reserve(request))
      .toMatchObject({ ...unavailable, reason: 'COST_REGISTRY_UNAVAILABLE' });
    ctx.setEntry(null);
    expect(await ctx.engine.reserve(request)).toMatchObject({ ...unavailable, reason: 'COST_MODEL_INVALID' });
    vi.spyOn(ctx.registry, 'resolve').mockRejectedValue(new Error('registry failure'));
    expect(await ctx.engine.reserve(request)).toMatchObject({ ...unavailable, reason: 'COST_REGISTRY_UNAVAILABLE' });
    vi.mocked(ctx.registry.resolve).mockImplementation(() => new Promise(() => {}));
    expect(await ctx.engine.reserve(request)).toMatchObject({ ...unavailable, reason: 'COST_REGISTRY_UNAVAILABLE' });
    expect(spy).not.toHaveBeenCalled();
  });

  const invalidEntries: Array<[string, (entry: CostRegistryEntry) => void]> = [
    ['未核准', (e) => { e.approval.approved = false; }],
    ['未實際啟用', (e) => { e.approval.activated = false; }],
    ['缺上界證據', (e) => { e.approval.upperBoundProven = false; }],
    ['未驗證 attempts', (e) => { e.approval.singleAttemptVerified = false; }],
    ['缺核准 reference', (e) => { e.approval.approvalEvidenceRef = ''; }],
    ['缺價格 reference', (e) => { e.approval.priceSourceRef = ''; }],
    ['缺上界 reference', (e) => { e.approval.boundEvidenceRef = ''; }],
    ['live:false', (e) => { e.table.endpoints.assistant.live = false; }],
    ['尚未生效', (e) => { e.table.effectiveFrom = '2026-10-06T02:00:00.001Z'; }],
    ['到期邊界', (e) => { e.table.expiresAt = '2026-10-06T02:00:00.000Z'; }],
    ['端點錯配', (e) => { e.endpoint = 'places'; }],
    ['entry 與價表版本矛盾', (e) => { e.version = 'OTHER'; }],
    ['錯誤模型', (e) => { e.model = 'not-allowlisted'; }],
    ['錯誤 tier', (e) => { Object.defineProperty(e, 'billingTier', { value: 'priority' }); }],
    ['錯誤 attempts', (e) => { Object.defineProperty(e, 'attempts', { value: 3 }); }],
    ['價表 attempts 矛盾', (e) => { Object.defineProperty(e.table, 'attemptsUpperBound', { value: 3 }); }],
    ['缺數值上限', (e) => { e.estimateBounds = {}; }],
    ['上限與價格矛盾', (e) => { e.estimateBounds.maxOutputTokens = 1; }],
    ['成本與核准摘要矛盾', (e) => { e.table.endpoints.assistant.priceScale = { numerator: 3, denominator: 1 }; }],
    ['未知計價類型', (e) => { e.table.endpoints.assistant.pricing = { kind: 'request', perRequestMicroUsd: 1 }; }],
    ['registry 封鎖', (e) => { e.blocked = true; }],
    ['非法 getter', (e) => { Object.defineProperty(e, 'model', { enumerable: true, get: () => 'gpt-4o-mini' }); }],
    ['任意價格欄位不可當解封標籤', (e) => { Object.defineProperty(e.table.endpoints.assistant.pricing, 'label', { value: 1, enumerable: true }); }],
  ];
  it.each(invalidEntries)('%s：不寫入 store', async (_, mutate) => {
    const entry = fixtureRegistryEntry();
    mutate(entry);
    const ctx = setup(entry);
    const spy = vi.spyOn(ctx.store, 'reserve');
    expect(await ctx.engine.reserve(request)).toMatchObject(unavailable);
    expect(spy).not.toHaveBeenCalled();
  });

  it('allowlist、實際上限與衍生欄位一致性驗證；不讓輸出上限縮小估算', async () => {
    const ctx = setup();
    const spy = vi.spyOn(ctx.store, 'reserve');
    for (const inputs of [
      { inputTokens: 24_101 }, { inputTokens: -1 }, { inputTokens: NaN }, { inputTokens: 'secret' },
      { rawText: 'secret' }, { maxOutputTokens: 1 }, { detail: 'high' },
    ]) expect(await ctx.engine.reserve(request, inputs as EstimateInputs)).toMatchObject(unavailable);
    expect(spy).not.toHaveBeenCalled();
    expect(await ctx.engine.reserve(request, { inputTokens: 0 })).toMatchObject({
      ok: true, reservation: { estimatedCostUpperBoundUsdMicro: 2_400 },
    });
  });

  it('PCM bytes、minute 上界與衍生估算綁定', async () => {
    const ctx = setup(fixtureRegistryEntry('transcribe'));
    const r = { ...request, endpoint: 'transcribe' as const };
    expect(await ctx.engine.reserve(r, { audioDataBytes: 32_000, billedMinutes: 2 })).toMatchObject(unavailable);
    expect(await ctx.engine.reserve(r, { audioDataBytes: 1_920_002 })).toMatchObject(unavailable);
    expect(await ctx.engine.reserve(r, { audioDataBytes: 3 })).toMatchObject(unavailable);
    expect(await ctx.engine.reserve(r, { audioDataBytes: 32_000 })).toMatchObject({
      ok: true, reservation: { estimatedCostUpperBoundUsdMicro: 9_000, estimateInputs: { billedMinutes: 1 } },
    });
  });

  it('photo enum 來自 registry；places 只能用空估算輸入', async () => {
    const entry = fixtureRegistryEntry('photo-ocr');
    entry.detailAllowlist = ['high'];
    const ctx = setup(reapprove(entry));
    expect(await ctx.engine.reserve({ ...request, endpoint: 'photo-ocr' }, { detail: 'low' })).toMatchObject(unavailable);
    expect(await ctx.engine.reserve({ ...request, endpoint: 'photo-ocr' }, { detail: 'high', imageBytes: 100 })).toMatchObject({ ok: true });
    const places = setup(fixtureRegistryEntry('places'));
    expect(await places.engine.reserve({ ...request, endpoint: 'places' }, { inputTokens: 1 })).toMatchObject(unavailable);
    expect(await places.engine.reserve({ ...request, endpoint: 'places' })).toMatchObject({ ok: true });
  });

  it('stable digest 涵蓋成本參數；名稱／效期／核准標籤不是解封鍵', () => {
    const entry = fixtureRegistryEntry();
    const digest = costParametersDigest(entry);
    const renamed = structuredClone(entry);
    renamed.version = renamed.table.version = 'FIXTURE_RENAMED';
    renamed.table.expiresAt = '2028-01-01T00:00:00.000Z';
    renamed.approval.approvalEvidenceRef = 'FIXTURE_REAPPROVED';
    expect(costParametersDigest(renamed)).toBe(digest);
    const reordered = structuredClone(entry);
    reordered.estimateBounds = { maxOutputTokens: 2_000, inputTokens: 24_100 };
    reordered.table.endpoints.assistant.priceScale = { numerator: 4, denominator: 2 };
    expect(costParametersDigest(reordered)).toBe(digest);
    for (const mutate of [
      (e: CostRegistryEntry) => { e.model = 'FIXTURE_OTHER'; },
      (e: CostRegistryEntry) => { Object.defineProperty(e, 'billingTier', { value: 'priority' }); },
      (e: CostRegistryEntry) => { Object.defineProperty(e, 'attempts', { value: 2 }); },
      (e: CostRegistryEntry) => { e.table.endpoints.assistant.modelAllowlist = ['FIXTURE_OTHER']; },
      (e: CostRegistryEntry) => { e.table.endpoints.assistant.priceScale = { numerator: 3, denominator: 1 }; },
      (e: CostRegistryEntry) => {
        const p = e.table.endpoints.assistant.pricing;
        if (p?.kind === 'tokens') p.inputMicroUsdPerMTok++;
      },
      (e: CostRegistryEntry) => { e.estimateBounds.inputTokens = 24_101; },
      (e: CostRegistryEntry) => {
        const p = e.table.endpoints.assistant.pricing;
        if (p?.kind === 'tokens') p.outputMicroUsdPerMTok++;
      },
      (e: CostRegistryEntry) => {
        const p = e.table.endpoints.assistant.pricing;
        if (p?.kind === 'tokens') p.maxOutputTokens++;
      },
    ]) {
      const changed = structuredClone(entry);
      mutate(changed);
      expect(costParametersDigest(changed)).not.toBe(digest);
    }
  });

  it('同一版本不可綁不同成本摘要，包括已核准但未改版本的參數', async () => {
    const ctx = setup();
    expect(await ctx.engine.reserve(request)).toMatchObject({ ok: true });
    const changed = fixtureRegistryEntry();
    changed.table.endpoints.assistant.priceScale = { numerator: 3, denominator: 1 };
    ctx.setEntry(reapprove(changed));
    expect(await ctx.engine.reserve({ ...request, idempotencyKey: 'changed' })).toMatchObject({
      ...unavailable, reason: 'COST_MODEL_INVALID',
    });
  });

  it('原子封鎖勝過 engine 先查放行；換版本／效期／核准 reference 仍擋相同參數', async () => {
    const ctx = setup();
    const first = await ctx.engine.reserve(request);
    if (!first.ok) throw new Error('fixture reserve failed');
    const realReserve = ctx.store.reserve.bind(ctx.store);
    vi.spyOn(ctx.store, 'reserve').mockImplementationOnce(async (command) => {
      expect(await ctx.engine.settle({
        identitySubject: subject, reservationId: first.reservation.reservationId,
        outcome: { kind: 'success', settlementEstimateMicroUsd: 10_000, attempts: 1, standardTier: true, costModelVersion: first.reservation.costModelVersion },
      })).toMatchObject({ settlementStatus: 'accounted_cost_bound_exceeded', ok: false, status: 503 });
      return realReserve(command);
    });
    expect(await ctx.engine.reserve({ ...request, idempotencyKey: 'racing' }))
      .toMatchObject({ ...unavailable, reason: 'COST_MODEL_BLOCKED' });
    const renamed = fixtureRegistryEntry();
    renamed.version = renamed.table.version = 'FIXTURE_RENAMED';
    renamed.table.expiresAt = '2028-01-01T00:00:00.000Z';
    renamed.approval.approvalEvidenceRef = 'FIXTURE_NEW_APPROVAL';
    renamed.table.endpoints.assistant.priceScale = { numerator: 4, denominator: 2 };
    ctx.setEntry(reapprove(renamed));
    expect(await ctx.engine.reserve({ ...request, idempotencyKey: 'renamed' }))
      .toMatchObject({ ...unavailable, reason: 'COST_MODEL_BLOCKED' });
    renamed.table.endpoints.assistant.priceScale = { numerator: 3, denominator: 1 };
    ctx.setEntry(renamed);
    expect(await ctx.engine.reserve({ ...request, idempotencyKey: 'stale-proof' })).toMatchObject(unavailable);
    renamed.version = renamed.table.version = 'FIXTURE_REVIEWED_v3';
    ctx.setEntry(reapprove(renamed));
    expect(await ctx.engine.reserve({ ...request, idempotencyKey: 'new-approved' })).toMatchObject({ ok: true });
  });

  it('registry lookup 期間跨過效期，預留前重新核對可信時間', async () => {
    const entry = fixtureRegistryEntry();
    entry.table.expiresAt = '2026-10-06T02:00:01.000Z';
    const ctx = setup(entry);
    const spy = vi.spyOn(ctx.store, 'reserve');
    vi.spyOn(ctx.registry, 'resolve').mockImplementation(async () => {
      ctx.setNow(entry.table.expiresAt);
      return entry;
    });
    expect(await ctx.engine.reserve(request)).toMatchObject({ ...unavailable, reason: 'COST_MODEL_INVALID' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('並發同版本不同摘要只可建立一種版本綁定；只有首次預留授權執行', async () => {
    const ctx = setup();
    const changed = fixtureRegistryEntry();
    changed.table.endpoints.assistant.priceScale = { numerator: 3, denominator: 1 };
    const second = createQuotaEngine({
      ...ctx.options, costRegistry: { resolve: async () => reapprove(changed) },
    });
    const outcomes = await Promise.all([
      ctx.engine.reserve(request),
      second.reserve({ ...request, idempotencyKey: 'different-digest' }),
    ]);
    expect(outcomes.filter((r) => r.ok)).toHaveLength(1);
    expect(outcomes.find((r) => !r.ok)).toMatchObject({ ...unavailable, reason: 'COST_MODEL_INVALID' });
    expect(await ctx.engine.reserve(request)).toMatchObject({
      ok: false, status: 409, code: 'DUPLICATE_REQUEST', executionGrant: false,
    });
  });

  it('預留先於封鎖仍可結算；到期／registry 故障也不阻止既有保守結算', async () => {
    const entry = fixtureRegistryEntry();
    entry.table.expiresAt = '2026-10-06T02:00:02.000Z';
    const ctx = setup(entry);
    const first = await ctx.engine.reserve(request);
    const second = await ctx.engine.reserve({ ...request, idempotencyKey: 'second' });
    if (!first.ok || !second.ok) throw new Error('fixture reserve failed');
    const settle = (reservationId: string, amount?: number) => ctx.engine.settle({
      identitySubject: subject, reservationId,
      outcome: { kind: 'success' as const, settlementEstimateMicroUsd: amount, attempts: 1, standardTier: true, costModelVersion: entry.version },
    });
    expect(await settle(first.reservation.reservationId, 10_000)).toMatchObject({ settlementStatus: 'accounted_cost_bound_exceeded', ok: false, status: 503 });
    ctx.setNow('2026-10-06T02:00:02.000Z');
    expect(await ctx.engine.reserve({ ...request, idempotencyKey: 'expired' })).toMatchObject(unavailable);
    vi.spyOn(ctx.registry, 'resolve').mockRejectedValue(new Error('registry down'));
    expect(await settle(second.reservation.reservationId)).toMatchObject({
      settlementStatus: 'accounted', reservation: { settledChargeUsdMicro: 9_630 },
    });
    expect(await settle(second.reservation.reservationId)).toMatchObject({ settlementStatus: 'accounted', alreadyApplied: true });
  });

  it('摘要封鎖佐證缺少或矛盾時，超額結算不回成功形狀', async () => {
    const ctx = setup();
    const first = await ctx.engine.reserve(request);
    if (!first.ok) throw new Error('fixture reserve failed');
    const realSettle = ctx.store.settle.bind(ctx.store);
    vi.spyOn(ctx.store, 'settle').mockImplementation(async (command) => {
      const result = await realSettle(command);
      return result.status === 'applied' || result.status === 'already_applied'
        ? { ...result, blockedCostParametersDigest: undefined } : result;
    });
    expect(await ctx.engine.settle({
      identitySubject: subject, reservationId: first.reservation.reservationId,
      outcome: { kind: 'success', settlementEstimateMicroUsd: 10_000, attempts: 1, standardTier: true, costModelVersion: first.reservation.costModelVersion },
    })).toMatchObject({ ...unavailable, reason: 'INVALID_STORE_DATA' });
  });

  it('production 六端點維持 live:false，speech 即使 fixture 偽稱有證據仍受阻', async () => {
    for (const endpoint of PROTECTED_ENDPOINTS) {
      expect(PRODUCTION_COST_PRICE_TABLE.endpoints[endpoint].live).toBe(false);
      const ctx = setup(fixtureRegistryEntry(endpoint, PRODUCTION_COST_PRICE_TABLE));
      expect(await ctx.engine.reserve({ ...request, endpoint })).toMatchObject(unavailable);
    }
    const speech = fixtureRegistryEntry('speech');
    speech.table.endpoints.speech.live = true;
    speech.table.endpoints.speech.modelAllowlist = ['FIXTURE_SPEECH_MODEL'];
    speech.model = 'FIXTURE_SPEECH_MODEL';
    const ctx = setup(reapprove(speech));
    const spy = vi.spyOn(ctx.store, 'reserve');
    expect(await ctx.engine.reserve({ ...request, endpoint: 'speech' })).toMatchObject({
      ...unavailable, reason: 'COST_BOUND_UNPROVEN',
    });
    expect(spy).not.toHaveBeenCalled();
  });
});
