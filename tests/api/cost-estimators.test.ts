import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { estimateMaxReservation, estimateReservation } from '../../api/_lib/cost-estimators';
import { PRODUCTION_COST_PRICE_TABLE, PROTECTED_ENDPOINTS, type CostPriceTable } from '../../api/_lib/cost-price-table';
import { emergencyInstruction } from '../../api/_lib/prompts/emergency';
import { liveDataInstruction } from '../../api/_lib/prompts/live-data';
import { photoOcrInstruction } from '../../api/_lib/prompts/photo-ocr';
import { photoTranslateInstruction } from '../../api/_lib/prompts/photo-translate';
import { translationInstruction } from '../../api/_lib/prompts/translation';
import { travelInstruction } from '../../api/_lib/prompts/travel';
import {
  KNOWLEDGE_CATEGORIES,
  getKnowledgeEntriesByCategory,
  serializeKnowledgeContext,
} from '../../src/services/knowledge';
import {
  FIXTURE_ALL_LIVE,
  FIXTURE_EXPECTED_R_MAX,
  FIXTURE_LIMITS,
  FIXTURE_NONE_LIVE,
  FIXTURE_TRANSCRIBE_LIVE,
  fixtureWithEndpoint,
} from '../fixtures/cost-price-fixtures';

// 全部為 mock 算術：驗證公式與 ceil 進位，不代表真實成本上界或供應商帳單。

const libDir = join(process.cwd(), 'api', '_lib');
function productionSources(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [full] : [];
    });
  return walk(libDir);
}

describe('T126 production 價表隔離', () => {
  it('所有端點 live:false，且不含任何單價／係數／白名單數值', () => {
    for (const endpoint of PROTECTED_ENDPOINTS) {
      const entry = PRODUCTION_COST_PRICE_TABLE.endpoints[endpoint];
      expect(entry.live).toBe(false);
      expect(entry.pricing).toBeNull();
      expect(entry.priceScale).toBeNull();
      expect(entry.modelAllowlist).toEqual([]);
    }
  });

  it('production 價表不存在 A＝3 欄位，A 固定為 1', () => {
    expect(PRODUCTION_COST_PRICE_TABLE.attemptsUpperBound).toBe(1);
    expect(JSON.stringify(PRODUCTION_COST_PRICE_TABLE)).not.toMatch(/attempts3|a3|A3|"A":3/);
  });

  it('production 價表為 frozen，無法在執行期改為 live', () => {
    expect(Object.isFrozen(PRODUCTION_COST_PRICE_TABLE)).toBe(true);
    expect(Object.isFrozen(PRODUCTION_COST_PRICE_TABLE.endpoints)).toBe(true);
    expect(() => {
      (PRODUCTION_COST_PRICE_TABLE.endpoints.assistant as { live: boolean }).live = true;
    }).toThrow();
  });

  it('production 路徑原始碼不引用 fixture，也不含 FIXTURE_／8,036 常數', () => {
    for (const file of productionSources()) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/tests[\\/]fixtures|FIXTURE_|cost-price-fixtures/);
      expect(text, file).not.toMatch(/\b8_?,?036\b/);
    }
  });

  it('production 預設價表下六端點一律 COST_BOUND_UNPROVEN（不得進入預留與上游）', () => {
    for (const endpoint of PROTECTED_ENDPOINTS) {
      const result = estimateReservation({ endpoint, model: 'gpt-4o-mini' });
      expect(result).toEqual({
        ok: false,
        status: 503,
        publicCode: 'PROTECTION_SERVICE_UNAVAILABLE',
        reason: 'COST_BOUND_UNPROVEN',
      });
    }
  });
});

describe('T126／T023 表一 R_max（fixture，A＝1，ceil 一次）', () => {
  it.each(Object.entries(FIXTURE_EXPECTED_R_MAX))('%s 的 R_max ＝ %i', (endpoint, expected) => {
    const result = estimateMaxReservation(endpoint as keyof typeof FIXTURE_EXPECTED_R_MAX, FIXTURE_TRANSCRIBE_LIVE);
    expect(result).toMatchObject({ ok: true, amountMicroUsd: expected, costModelVersion: 'FIXTURE_TRANSCRIBE_LIVE_v1' });
  });

  it('只在最後 ceil 一次：photo-translate 8,035.2 → 8,036；photo-ocr 19,397.1 → 19,398', () => {
    const r = estimateMaxReservation('photo-translate', FIXTURE_ALL_LIVE);
    expect(r.ok && r.amountMicroUsd).toBe(8_036);
    // 逐步進位的錯誤算法會得到 (7,856＋1,844)×2 ＝ 19,400
    const ocr = estimateMaxReservation('photo-ocr', FIXTURE_ALL_LIVE);
    expect(ocr.ok && ocr.amountMicroUsd).toBe(19_398);
  });

  it('預留隨實際輸入縮放，超過合法上限回 400 INPUT_EXCEEDS_BOUND', () => {
    const small = estimateReservation({ endpoint: 'assistant', table: FIXTURE_ALL_LIVE, model: 'gpt-4o-mini', input: { inputTokens: 100 } });
    const max = estimateReservation({ endpoint: 'assistant', table: FIXTURE_ALL_LIVE, model: 'gpt-4o-mini' });
    expect(small.ok && max.ok && small.amountMicroUsd < max.amountMicroUsd).toBe(true);
    expect(estimateReservation({ endpoint: 'assistant', table: FIXTURE_ALL_LIVE, model: 'gpt-4o-mini', input: { inputTokens: 0 } }))
      .toMatchObject({ ok: true, amountMicroUsd: 2_400 });
    for (const inputTokens of [24_101, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        estimateReservation({ endpoint: 'assistant', table: FIXTURE_ALL_LIVE, model: 'gpt-4o-mini', input: { inputTokens } }),
      ).toMatchObject({ ok: false, status: 400, reason: 'INPUT_EXCEEDS_BOUND' });
    }
  });

  it('transcribe 依 PCM bytes 以分鐘進位計價，超過 60 s 拒絕', () => {
    const at = (audioDataBytes: number) =>
      estimateReservation({ endpoint: 'transcribe', table: FIXTURE_TRANSCRIBE_LIVE, model: 'whisper-1', input: { audioDataBytes } });
    expect(at(1)).toMatchObject({ ok: true, amountMicroUsd: 9_000 });
    expect(at(1_920_000)).toMatchObject({ ok: true, amountMicroUsd: 9_000 });
    expect(at(1_920_002)).toMatchObject({ ok: false, status: 400 });
  });
});

describe('T023 拒絕路徑', () => {
  it('OPENAI_MODEL 不在白名單回 COST_MODEL_UNSUPPORTED（含缺漏模型）', () => {
    for (const endpoint of ['assistant', 'photo-ocr', 'photo-translate'] as const) {
      for (const model of ['gpt-5-unknown', '', undefined, 'GPT-4O-MINI']) {
        expect(estimateReservation({ endpoint, table: FIXTURE_ALL_LIVE, model })).toMatchObject({
          ok: false,
          status: 503,
          reason: 'COST_MODEL_UNSUPPORTED',
        });
      }
    }
  });

  it('live:false 端點（含 fixture 中的 transcribe）與 speech 一律 COST_BOUND_UNPROVEN', () => {
    expect(estimateMaxReservation('transcribe', FIXTURE_ALL_LIVE)).toMatchObject({ ok: false, reason: 'COST_BOUND_UNPROVEN' });
    expect(estimateMaxReservation('assistant', FIXTURE_NONE_LIVE)).toMatchObject({ ok: false, reason: 'COST_BOUND_UNPROVEN' });
    // 即使有人把 speech 標為 live 並塞入價格，也不得放行
    const speechLive = fixtureWithEndpoint(FIXTURE_ALL_LIVE, 'speech', {
      live: true,
      modelAllowlist: ['gpt-4o-mini-tts'],
      priceScale: { numerator: 1, denominator: 1 },
      pricing: { kind: 'request', perRequestMicroUsd: 1 },
    });
    expect(estimateMaxReservation('speech', speechLive)).toMatchObject({ ok: false, reason: 'COST_BOUND_UNPROVEN' });
  });

  it('價表數值非有限正整數、缺失或版本空白 → COST_MODEL_INVALID', () => {
    const bad = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1];
    for (const value of bad) {
      const table = fixtureWithEndpoint(FIXTURE_ALL_LIVE, 'places', { pricing: { kind: 'request', perRequestMicroUsd: value } });
      expect(estimateMaxReservation('places', table)).toMatchObject({ ok: false, reason: 'COST_MODEL_INVALID' });
      const scale = fixtureWithEndpoint(FIXTURE_ALL_LIVE, 'places', { priceScale: { numerator: value, denominator: 1 } });
      expect(estimateMaxReservation('places', scale)).toMatchObject({ ok: false, reason: 'COST_MODEL_INVALID' });
    }
    expect(estimateMaxReservation('places', fixtureWithEndpoint(FIXTURE_ALL_LIVE, 'places', { pricing: null }))).toMatchObject({
      reason: 'COST_MODEL_INVALID',
    });
    expect(estimateMaxReservation('places', { ...FIXTURE_ALL_LIVE, version: '' })).toMatchObject({ reason: 'COST_MODEL_INVALID' });
    expect(
      estimateMaxReservation('places', { ...FIXTURE_ALL_LIVE, attemptsUpperBound: 3 } as unknown as CostPriceTable),
    ).toMatchObject({ reason: 'COST_MODEL_INVALID' });
  });

  it('結果超過 MAX_SAFE_INTEGER 時不回傳不精確數字，回 COST_MODEL_INVALID', () => {
    const huge = fixtureWithEndpoint(FIXTURE_ALL_LIVE, 'places', {
      priceScale: { numerator: Number.MAX_SAFE_INTEGER, denominator: 1 },
      pricing: { kind: 'request', perRequestMicroUsd: Number.MAX_SAFE_INTEGER },
    });
    expect(estimateMaxReservation('places', huge)).toMatchObject({ ok: false, reason: 'COST_MODEL_INVALID' });
  });
});

describe('T126 prompt／知識 byte 上限與最壞 pre-parse 尺寸（待證明項的 mock 佐證）', () => {
  const bytes = (text: string) => Buffer.byteLength(text, 'utf8');

  it('既有 prompt 指示 ≤ 4,096 B', () => {
    const prompts = [
      travelInstruction(''),
      emergencyInstruction(''),
      liveDataInstruction(''),
      photoOcrInstruction(),
      photoTranslateInstruction('zh-TW'),
      photoTranslateInstruction('ja'),
      translationInstruction('default'),
      translationInstruction('polite'),
      translationInstruction('casual'),
    ];
    for (const prompt of prompts) expect(bytes(prompt)).toBeLessThanOrEqual(FIXTURE_LIMITS.promptMaxBytes);
  });

  it('現況 catalog 最大 5 筆序列化 ≤ 16,384 B；最壞字串以 UTF-16 unit×3 估算', () => {
    const entries = KNOWLEDGE_CATEGORIES.flatMap((category) => getKnowledgeEntriesByCategory(category));
    expect(entries.length).toBeGreaterThan(0);
    const sizes = entries.map((entry) => bytes(serializeKnowledgeContext([entry]))).sort((a, b) => b - a);
    const worstFive = sizes.slice(0, 5).reduce((sum, n) => sum + n, 0) + 4;
    expect(worstFive).toBeLessThanOrEqual(FIXTURE_LIMITS.knowledgeMaxBytes);
    expect(bytes('\uFFFF'.repeat(1000))).toBe(3000);
    expect(bytes('😀'.repeat(500))).toBeLessThanOrEqual(1000 * 3); // surrogate pair 2 units 共 4 B
  });

  it('各端點 Tin 組成在 fixture maxInputTokens 內（表一算術）', () => {
    const pricing = (e: keyof typeof FIXTURE_ALL_LIVE.endpoints) => {
      const p = FIXTURE_ALL_LIVE.endpoints[e].pricing;
      if (p?.kind !== 'tokens') throw new Error('not tokens');
      return p.maxInputTokens;
    };
    expect(3000 + 4096 + 16384 + 35 + 100).toBeLessThanOrEqual(pricing('assistant'));
    expect(6000 + 4096 + 100).toBeLessThanOrEqual(pricing('photo-translate'));
    expect(2833 + 8 * 5667 + 4096 + 100).toBeLessThanOrEqual(pricing('photo-ocr'));
  });

  const esc = (n: number) => '\\u0000'.repeat(n);
  const size = (json: string) => Buffer.byteLength(json, 'utf8');

  it('最壞轉義請求的 pre-parse 尺寸低於上限（僅已受驗證欄位；其餘未受限欄位仍待證明）', () => {
    const assistant = `{"text":"${esc(1000)}","inputType":"quick_action","tone":"polite"}`;
    const photoTranslate = `{"sourceText":"${esc(2000)}","targetLanguage":"zh-TW"}`;
    const speech = `{"text":"${esc(500)}","language":"zh-TW","speed":"normal"}`;
    const places = `{"location":{"type":"gps","coordinates":{"latitude":-35.123456789012345,"longitude":-139.123456789012345},"manualArea":"${esc(50)}"},"category":"restaurant","query":"${esc(100)}"}`;
    expect(size(assistant)).toBeLessThan(FIXTURE_LIMITS.preParseMaxBytes.assistant);
    expect(size(photoTranslate)).toBeLessThan(FIXTURE_LIMITS.preParseMaxBytes['photo-translate']);
    expect(size(speech)).toBeLessThan(FIXTURE_LIMITS.preParseMaxBytes.speech);
    expect(size(places)).toBeLessThan(FIXTURE_LIMITS.preParseMaxBytes.places);
  });

  it('photo-ocr：3 MiB 影像 base64 外殼 ＝ 4,194,373 B（regionVersion 10 位），低於 4,200,000 與 4,500,000', () => {
    const base64Chars = 4 * Math.ceil(3_145_728 / 3);
    expect(base64Chars).toBe(4_194_304);
    const json = `{"imageDataUrl":"data:image/jpeg;base64,${'A'.repeat(base64Chars)}","regionVersion":${'9'.repeat(10)}}`;
    expect(size(json)).toBe(4_194_373);
    expect(size(json)).toBeLessThan(FIXTURE_LIMITS.preParseMaxBytes['photo-ocr']);
  });

  it('transcribe：WAV 1,920,044 B ＋ 65,536 B multipart 餘裕 ≤ 2,000,000', () => {
    expect(1_920_000 + 44 + 65_536).toBe(1_985_580);
    expect(1_985_580).toBeLessThanOrEqual(FIXTURE_LIMITS.preParseMaxBytes.transcribe);
  });
});

describe('價表有效期（now 參數）', () => {
  const base = { endpoint: 'assistant' as const, table: FIXTURE_ALL_LIVE, model: 'gpt-4o-mini' };
  it('區間內可估算；生效前、到期當下、無 now 的 production 空區間價表皆拒絕', () => {
    expect(estimateReservation({ ...base, now: new Date('2026-10-06T00:00:00Z') })).toMatchObject({ ok: true });
    expect(estimateReservation({ ...base, now: new Date('2025-12-31T23:59:59Z') })).toMatchObject({ ok: false, status: 503, reason: 'COST_MODEL_INVALID' });
    expect(estimateReservation({ ...base, now: new Date('2027-01-01T00:00:00Z') })).toMatchObject({ ok: false, status: 503, reason: 'COST_MODEL_INVALID' });
    expect(estimateReservation({ ...base, table: PRODUCTION_COST_PRICE_TABLE, now: new Date('2026-10-06T00:00:00Z') })).toMatchObject({ ok: false, status: 503 });
  });
});