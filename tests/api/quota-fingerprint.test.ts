import { createHash, createSecretKey } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createQuotaEngine, type QuotaEngineOptions } from '../../api/_lib/quota-engine';
import {
  buildRequestFingerprint,
  type FingerprintKey,
  type RequestContent,
  type TrustedFingerprintCost,
} from '../../api/_lib/quota-fingerprint';
import { PROTECTED_ENDPOINTS } from '../../api/_lib/cost-price-table';
import { validateEstimateInputs, type EstimateInputs } from '../../api/_lib/quota-estimate-inputs';
import { FIXTURE_FINGERPRINT_KEY, fixtureTrustedCost } from '../fixtures/quota-fingerprint-fixtures';
import { fixtureRegistryEntry } from '../fixtures/cost-registry-fixtures';
import { InMemorySharedStoreMock } from '../support/in-memory-shared-store';

const request = {
  identitySubject: 'fingerprint-subject',
  endpoint: 'assistant' as const,
  idempotencyKey: 'operation-1',
  content: { messages: [{ role: 'user', content: '私密東京旅遊測試內容' }], temperature: 0.5 },
};
const parts = (content: RequestContent = request.content, trustedCost = fixtureTrustedCost()) => ({
  identitySubject: request.identitySubject,
  endpoint: request.endpoint,
  content,
  trustedCost,
});

function setup(key: FingerprintKey | undefined = FIXTURE_FINGERPRINT_KEY) {
  const store = new InMemorySharedStoreMock();
  store.seed({ identitySubject: request.identitySubject, status: 'approved', tier: 'tier1', expiresAt: null });
  const options: QuotaEngineOptions = {
    store,
    fingerprintKey: key,
    costRegistry: { resolve: async (endpoint) => fixtureRegistryEntry(endpoint) },
    tierLimits: {
      tier1: { dayLimitMicroUsd: 100_000, weekBaseLimitMicroUsd: 300_000 },
      tier2: { dayLimitMicroUsd: 1_000_000, weekBaseLimitMicroUsd: 3_000_000 },
    },
    now: () => new Date('2026-10-06T02:00:00Z'),
    newId: () => 'fingerprint-reservation',
    leaseMs: 60_000,
  };
  return { store, options, engine: createQuotaEngine(options) };
}

describe('T139 隔離 HMAC 指紋與資料最小化', () => {
  it('同金鑰同內容穩定；內容與估算欄位順序無關', () => {
    const cost = { ...fixtureTrustedCost(), estimateInputs: { inputTokens: 40, maxOutputTokens: 100 } };
    const fingerprint = buildRequestFingerprint(parts(request.content, cost), FIXTURE_FINGERPRINT_KEY);
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(buildRequestFingerprint(parts({
      temperature: 0.5, messages: [{ content: '私密東京旅遊測試內容', role: 'user' }],
    }, { ...cost, estimateInputs: { maxOutputTokens: 100, inputTokens: 40 } }), FIXTURE_FINGERPRINT_KEY)).toBe(fingerprint);
  });

  it('保留型別、內容、陣列順序與二進位差異', () => {
    const values: RequestContent[] = ['1', 1, true, null, { a: 1 }, { a: '1' }, [1, 2], [2, 1], new Uint8Array([49])];
    expect(new Set(values.map((content) => buildRequestFingerprint(parts(content), FIXTURE_FINGERPRINT_KEY))).size).toBe(values.length);
    expect(buildRequestFingerprint(parts(-0), FIXTURE_FINGERPRINT_KEY))
      .not.toBe(buildRequestFingerprint(parts(0), FIXTURE_FINGERPRINT_KEY));
  });

  it('不同 key／key version 產生不同結果；無 key 或無效 key 不降級', () => {
    const fingerprint = buildRequestFingerprint(parts(), FIXTURE_FINGERPRINT_KEY);
    expect(buildRequestFingerprint(parts(), {
      ...FIXTURE_FINGERPRINT_KEY, key: createSecretKey(Buffer.alloc(32, 7)),
    })).not.toBe(fingerprint);
    expect(buildRequestFingerprint(parts(), { ...FIXTURE_FINGERPRINT_KEY, version: 'TEST_KEY_v2' })).not.toBe(fingerprint);
    for (const key of [undefined, { version: 'TEST_EMPTY', key: createSecretKey(Buffer.alloc(0)) }]) {
      expect(() => buildRequestFingerprint(parts(), key)).toThrow('HMAC 設定無效');
    }
  });

  it('每個可信成本欄位變更皆影響指紋，不靠 estimateInputs 任意字串補入', () => {
    const cost = fixtureTrustedCost();
    const fingerprint = buildRequestFingerprint(parts(), FIXTURE_FINGERPRINT_KEY);
    for (const changed of [
      { ...cost, model: 'FIXTURE_OTHER_MODEL' },
      { ...cost, amountMicroUsd: 5_001 },
      { ...cost, costModel: { ...cost.costModel, version: 'FIXTURE_v2' } },
      { ...cost, costModel: { ...cost.costModel, expiresAt: '2028-01-01T00:00:00.000Z' } },
      { ...cost, estimateInputs: { inputTokens: 50 } },
    ]) {
      expect(buildRequestFingerprint(parts(request.content, changed), FIXTURE_FINGERPRINT_KEY)).not.toBe(fingerprint);
    }
    expect(buildRequestFingerprint({ ...parts(), identitySubject: 'another-subject' }, FIXTURE_FINGERPRINT_KEY)).not.toBe(fingerprint);
  });

  it('缺 key 回 503，無 store 操作且不回傳內容或 key', async () => {
    const ctx = setup();
    const reserveSpy = vi.spyOn(ctx.store, 'reserve');
    const engine = createQuotaEngine({ ...ctx.options, fingerprintKey: undefined });
    expect(await engine.reserve(request)).toEqual({
      ok: false, status: 503, code: 'PROTECTION_SERVICE_UNAVAILABLE', reason: 'FINGERPRINT_CONFIG_INVALID',
    });
    expect(reserveSpy).not.toHaveBeenCalled();
    for (const key of [
      { version: 'TEST_SHORT', key: createSecretKey(Buffer.alloc(31, 1)) },
      { version: '', key: FIXTURE_FINGERPRINT_KEY.key },
    ]) {
      expect(await createQuotaEngine({ ...ctx.options, fingerprintKey: key }).reserve(request))
        .toMatchObject({ status: 503, reason: 'FINGERPRINT_CONFIG_INVALID' });
    }
    expect(reserveSpy).not.toHaveBeenCalled();
  });

  it('任意 trustedCost 不能再透過 reserve 參數注入；指紋仍驗證可信欄位', async () => {
    const ctx = setup();
    const spy = vi.spyOn(ctx.store, 'reserve');
    const cost = fixtureTrustedCost();
    const invalid: unknown[] = [
      undefined,
      { ...cost, endpoint: 'places' },
      { ...cost, amountMicroUsd: undefined },
      { ...cost, amountMicroUsd: 0 },
      { ...cost, costModel: undefined },
      { ...cost, costModel: { ...cost.costModel, effectiveFrom: cost.costModel.expiresAt } },
      { ...cost, model: undefined },
      { ...cost, model: null },
      { ...cost, billingTier: undefined },
      { ...cost, billingTier: 'priority' },
      { ...cost, attempts: undefined },
      { ...cost, attempts: 3 },
      { ...cost, estimateBounds: undefined },
      { ...cost, estimateInputs: { inputTokens: 1 }, estimateBounds: {} },
      { ...cost, estimateBounds: { inputTokens: Infinity } },
      { ...cost, estimateInputs: undefined },
    ];
    for (const trusted of invalid) {
      expect(() => buildRequestFingerprint({ ...parts(), trustedCost: trusted as TrustedFingerprintCost }, FIXTURE_FINGERPRINT_KEY)).toThrow();
      if (trusted !== undefined) {
        expect(await ctx.engine.reserve(request, trusted as EstimateInputs))
          .toMatchObject({ ok: false, status: 503, reason: 'TRUSTED_COST_INVALID' });
      }
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('每端點白名單的上下界精確驗證，fixture 上限不變成正式預設', () => {
    const valid: Record<(typeof PROTECTED_ENDPOINTS)[number], EstimateInputs> = {
      assistant: { inputTokens: 100_000, maxOutputTokens: 10_000 },
      'photo-ocr': { inputTokens: 100_000, maxOutputTokens: 10_000, imageBytes: 4_200_000, detail: 'high' },
      'photo-translate': { inputTokens: 100_000, maxOutputTokens: 10_000, imageBytes: 4_200_000, detail: 'low' },
      transcribe: { audioDataBytes: 1_920_000, billedMinutes: 1 },
      speech: { characterCount: 4_096, speed: 4 },
      places: {},
    };
    for (const endpoint of PROTECTED_ENDPOINTS) {
      const bounds = fixtureTrustedCost(endpoint).estimateBounds;
      expect(validateEstimateInputs(endpoint, valid[endpoint], bounds)).toEqual(valid[endpoint]);
      for (const [field, upperBound] of Object.entries(bounds)) {
        for (const invalid of [upperBound + 1, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '文字', true]) {
          expect(() => validateEstimateInputs(endpoint, { [field]: invalid }, bounds)).toThrow();
        }
      }
      expect(() => validateEstimateInputs(endpoint, { detail: '私密資料' }, bounds)).toThrow();
    }
    expect(() => validateEstimateInputs('transcribe', { audioDataBytes: 3 }, fixtureTrustedCost('transcribe').estimateBounds)).toThrow();
    expect(() => validateEstimateInputs('transcribe', { audioDataBytes: 32_000, billedMinutes: 2 }, {
      audioDataBytes: 1_920_000, billedMinutes: 2,
    })).toThrow();
    expect(validateEstimateInputs('speech', { characterCount: 1, speed: 0.5 }, fixtureTrustedCost('speech').estimateBounds))
      .toEqual({ characterCount: 1, speed: 0.5 });
    expect(() => buildRequestFingerprint(parts(request.content, {
      ...fixtureTrustedCost(), estimateBounds: undefined as never,
    }), FIXTURE_FINGERPRINT_KEY)).toThrow();
  });

  it('非 canonical 内容、未知非列舉鍵及 getter 拒絕，沒有內容 fallback', async () => {
    const ctx = setup();
    const spy = vi.spyOn(ctx.store, 'reserve');
    const cycle: RequestContent[] = [];
    cycle.push(cycle);
    const getter = Object.defineProperty({}, 'text', { enumerable: true, get: () => 'secret' });
    const sparse: RequestContent[] = new Array(2);
    for (const content of [NaN, Infinity, undefined, cycle, getter, sparse, new Date()] ) {
      expect(await ctx.engine.reserve({ ...request, content: content as RequestContent }))
        .toMatchObject({ status: 400, field: 'content' });
    }
    const extra = Object.defineProperty({ ...request }, 'model', { value: 'not-trusted' });
    expect(await ctx.engine.reserve(extra)).toMatchObject({ status: 400 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('客戶端宣告成本／tier／model／attempts 或 estimateInputs 時拒絕，不靜默忽略', async () => {
    const ctx = setup();
    for (const extra of [
      { model: 'user-model' }, { billingTier: 'standard' }, { attempts: 1 },
      { amountMicroUsd: 1 }, { estimateInputs: {} }, { contentDigest: 'a'.repeat(64) },
    ]) {
      expect(await ctx.engine.reserve({ ...request, ...extra })).toMatchObject({ ok: false, status: 400 });
    }
    expect(ctx.store.dumpState()).not.toContain('fingerprint-reservation');
  });

  it('六端點只接受明列數值／enum，未知鍵、敏感字串、非有限與超界值拒絕', async () => {
    const ctx = setup();
    for (const endpoint of PROTECTED_ENDPOINTS) {
      for (const estimateInputs of [
        { rawText: '私密文字' }, { model: 'gpt-4o-mini' }, { attempts: 1 },
        { inputTokens: NaN }, { inputTokens: Infinity }, { inputTokens: -1 },
        { inputTokens: 1.5 }, { inputTokens: 100_001 }, { inputTokens: '敏感字串' },
      ]) {
        expect(await ctx.engine.reserve({ ...request, endpoint }, estimateInputs as EstimateInputs)).toMatchObject({ ok: false });
      }
    }
    for (const detail of ['low', 'high', 'auto'] as const) {
      expect(buildRequestFingerprint({
        ...parts(), endpoint: 'photo-ocr',
        trustedCost: { ...fixtureTrustedCost('photo-ocr'), estimateInputs: { imageBytes: 100, detail } },
      }, FIXTURE_FINGERPRINT_KEY)).toMatch(/^[0-9a-f]{64}$/);
    }
    const invalidDetail = { ...fixtureTrustedCost('photo-ocr'), estimateInputs: { detail: 'low' as const } };
    Object.defineProperty(invalidDetail.estimateInputs, 'detail', { value: '原始照片' });
    expect(() => buildRequestFingerprint({
      ...parts(), endpoint: 'photo-ocr',
      trustedCost: invalidDetail,
    }, FIXTURE_FINGERPRINT_KEY)).toThrow();
    expect(await ctx.engine.reserve({ ...request, endpoint: 'speech' }))
      .toMatchObject({ ok: false, status: 503, reason: 'COST_BOUND_UNPROVEN' });
  });

  it('store／稽核與衝突紀錄只有 HMAC 與 allowlist，不含原始內容、普通摘要或 key', async () => {
    const ctx = setup();
    const spy = vi.spyOn(ctx.store, 'reserve');
    const first = await ctx.engine.reserve(request);
    expect(first).toMatchObject({ ok: true });
    expect(await ctx.engine.reserve(request)).toMatchObject({ status: 409, code: 'DUPLICATE_REQUEST' });
    expect(await ctx.engine.reserve({ ...request, content: new Uint8Array([1, 2, 3]) }))
      .toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' });
    const audit = JSON.stringify({ store: ctx.store.dumpState(), commands: spy.mock.calls, first });
    for (const forbidden of [
      '私密東京旅遊測試內容', 'messages', 'contentDigest', '"content"', '"key"',
      FIXTURE_FINGERPRINT_KEY.key.export().toString('hex'),
      createHash('sha256').update('私密東京旅遊測試內容').digest('hex'),
    ]) expect(audit).not.toContain(forbidden);
  });

  it('不可信 store 夾帶敏感 estimateInputs 或額外內容時拒絕回傳', async () => {
    const ctx = setup();
    const reserve = ctx.store.reserve.bind(ctx.store);
    vi.spyOn(ctx.store, 'reserve').mockImplementation(async (command) => {
      const result = await reserve(command);
      if (result.status === 'reserved') Object.defineProperty(result.reservation.estimateInputs, 'rawText', { value: 'secret', enumerable: true });
      return result;
    });
    expect(await ctx.engine.reserve(request)).toMatchObject({ status: 503, reason: 'INVALID_STORE_DATA' });
  });

  it('不可信 store 夾帶額外內容、key 版本或數值遭竄改時回 503', async () => {
    for (const mutate of [
      (record: object) => Object.defineProperty(record, 'content', { value: 'secret', enumerable: true }),
      (record: object) => Object.defineProperty(record, 'fingerprintKeyVersion', { value: 'OTHER_KEY' }),
      (record: object) => Object.defineProperty(record, 'estimateInputs', { value: { inputTokens: 1 } }),
    ]) {
      const ctx = setup();
      const reserve = ctx.store.reserve.bind(ctx.store);
      vi.spyOn(ctx.store, 'reserve').mockImplementation(async (command) => {
        const result = await reserve(command);
        if (result.status === 'reserved') mutate(result.reservation);
        return result;
      });
      expect(await ctx.engine.reserve(request)).toMatchObject({ status: 503, reason: 'INVALID_STORE_DATA' });
    }
  });
});
