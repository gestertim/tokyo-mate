import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCTION_COST_PRICE_TABLE } from '../../api/_lib/cost-price-table';
import { buildSnapshot, type QuotaSnapshot } from '../../api/_lib/quota-engine';
import { computeGlobalFloor, evaluateAvailability } from '../../api/_lib/quota-threshold';
import {
  FIXTURE_ALL_LIVE,
  FIXTURE_NONE_LIVE,
  FIXTURE_TRANSCRIBE_LIVE,
  fixtureWithEndpoint,
} from '../fixtures/cost-price-fixtures';

// G=8,036 等數值僅來自測試 fixture（未核准 A1），不代表真實成本上界。
const snap = (dayRemain: number, weekRemain: number, opts: { dayExhausted?: boolean; weekExhausted?: boolean } = {}): QuotaSnapshot => {
  const win = (remain: number, exhausted?: boolean) => ({
    windowKey: 'w',
    limitMicroUsd: 3_000_000,
    resetAt: '2026-10-06T16:00:00.000Z',
    usage: exhausted ? { usedMicroUsd: 3_000_000, reservedMicroUsd: 0 } : { usedMicroUsd: 3_000_000 - remain, reservedMicroUsd: 0 },
  });
  const d = win(dayRemain, opts.dayExhausted);
  const w = win(weekRemain, opts.weekExhausted);
  return buildSnapshot({ day: d.usage, week: w.usage }, d, w);
};

describe('T131 G 計算', () => {
  it('G = E_live 內最小 R_max（fixture 為 8,036，來自 photo-translate）', () => {
    const g = computeGlobalFloor(FIXTURE_ALL_LIVE);
    expect(g).toMatchObject({ ok: true, floorMicroUsd: 8_036 });
    if (g.ok) expect(g.liveEndpoints).toEqual(expect.arrayContaining(['assistant', 'photo-translate', 'photo-ocr', 'places']));
    if (g.ok) expect(g.liveEndpoints).not.toContain('transcribe');
  });

  it('G 隨價表重算；live:false 的價格不影響 G', () => {
    const noPhotoTranslate = fixtureWithEndpoint(FIXTURE_ALL_LIVE, 'photo-translate', { live: false });
    expect(computeGlobalFloor(noPhotoTranslate)).toMatchObject({ ok: true, floorMicroUsd: 9_630 });
    expect(computeGlobalFloor(FIXTURE_TRANSCRIBE_LIVE)).toMatchObject({ ok: true, floorMicroUsd: 8_036 });
    const noPhotoLive = fixtureWithEndpoint(fixtureWithEndpoint(noPhotoTranslate, 'assistant', { live: false }), 'places', { live: false });
    expect(computeGlobalFloor(noPhotoLive)).toMatchObject({ ok: true, floorMicroUsd: 19_398 });
  });

  it('E_live 為空、live 端點算不出 R_max、speech 標 live、version 空 → 成本模型失效', () => {
    expect(computeGlobalFloor(FIXTURE_NONE_LIVE)).toEqual({ ok: false, reason: 'COST_MODEL_INVALID' });
    expect(computeGlobalFloor(fixtureWithEndpoint(FIXTURE_ALL_LIVE, 'assistant', { pricing: null }))).toMatchObject({ ok: false });
    expect(computeGlobalFloor(fixtureWithEndpoint(FIXTURE_ALL_LIVE, 'speech', { live: true }))).toMatchObject({ ok: false });
    expect(computeGlobalFloor({ ...FIXTURE_ALL_LIVE, version: '' })).toMatchObject({ ok: false });
  });

  it('production 價表全 live:false：G 無法計算（不可真實啟用），且原始碼不含 fixture 數值', () => {
    expect(computeGlobalFloor(PRODUCTION_COST_PRICE_TABLE)).toMatchObject({ ok: false });
    for (const file of ['cost-price-table.ts', 'quota-threshold.ts', 'cost-estimators.ts', 'quota-engine.ts']) {
      expect(readFileSync(join(process.cwd(), 'api', '_lib', file), 'utf8'), file).not.toMatch(/8[,_]?036/);
    }
    expect(evaluateAvailability({ snapshot: snap(3_000_000, 3_000_000), table: PRODUCTION_COST_PRICE_TABLE })).toMatchObject({
      state: 'cost_model_invalid',
      status: 503,
      mapAvailable: false,
    });
  });
});

describe('T131 四類狀態（plan §4.5.5）', () => {
  const T = FIXTURE_ALL_LIVE;

  it('available：日週皆足夠', () => {
    expect(evaluateAvailability({ snapshot: snap(200_000, 300_000), table: T, requestReservationMicroUsd: 9_630 })).toMatchObject({ state: 'available', mapAvailable: true });
  });

  it('request_insufficient：單一請求不足，不影響其他端點與地圖', () => {
    const s = snap(8_100, 3_000_000);
    const assistant = evaluateAvailability({ snapshot: s, table: T, requestReservationMicroUsd: 9_630 });
    expect(assistant).toMatchObject({ state: 'request_insufficient', status: 429, quotaScope: 'request', code: 'DAILY_QUOTA_EXHAUSTED', mapAvailable: true });
    expect(evaluateAvailability({ snapshot: s, table: T, requestReservationMicroUsd: 8_036 })).toMatchObject({ state: 'available' });
    expect(evaluateAvailability({ snapshot: s, table: T })).toMatchObject({ state: 'available', mapAvailable: true });
    expect(evaluateAvailability({ snapshot: snap(15_000, 3_000), table: T, requestReservationMicroUsd: 9_630 })).toMatchObject({ state: 'below_floor' });
  });

  it('below_floor：低於 G，所有啟用端點與地圖皆不可用', () => {
    expect(evaluateAvailability({ snapshot: snap(8_000, 3_000_000), table: T, requestReservationMicroUsd: 8_036 })).toMatchObject({
      state: 'below_floor', status: 429, quotaScope: 'all', code: 'DAILY_QUOTA_EXHAUSTED', mapReason: 'daily_quota', mapAvailable: false,
    });
    expect(evaluateAvailability({ snapshot: snap(8_036, 3_000_000), table: T })).toMatchObject({ state: 'available' }); // 邊界：remaining == G
    expect(evaluateAvailability({ snapshot: snap(8_035, 3_000_000), table: T })).toMatchObject({ state: 'below_floor' });
  });

  it('exhausted：limit − used = 0 優先於 below_floor', () => {
    expect(evaluateAvailability({ snapshot: snap(0, 3_000_000, { dayExhausted: true }), table: T })).toMatchObject({ state: 'exhausted', quotaScope: 'all', code: 'DAILY_QUOTA_EXHAUSTED', mapAvailable: false });
    expect(evaluateAvailability({ snapshot: snap(3_000_000, 0, { weekExhausted: true }), table: T })).toMatchObject({ state: 'exhausted', code: 'WEEKLY_QUOTA_EXHAUSTED', mapReason: 'weekly_quota' });
  });

  it('日週餘額不同：取較高優先類別；週 below_floor 與日足夠', () => {
    expect(evaluateAvailability({ snapshot: snap(3_000_000, 7_000), table: T })).toMatchObject({ state: 'below_floor', window: 'week', code: 'WEEKLY_QUOTA_EXHAUSTED' });
    expect(evaluateAvailability({ snapshot: snap(5_000, 0, { weekExhausted: true }), table: T })).toMatchObject({ state: 'exhausted', window: 'week' });
    expect(evaluateAvailability({ snapshot: snap(5_000, 7_000), table: T })).toMatchObject({ state: 'below_floor', window: 'day' }); // 同級日優先
    expect(evaluateAvailability({ snapshot: snap(8_100, 9_000), table: T, requestReservationMicroUsd: 9_630 })).toMatchObject({ state: 'request_insufficient', window: 'day' });
  });

  it('預留中的金額也計入 remaining', () => {
    const base = snap(20_000, 3_000_000);
    const reserved = buildSnapshot({ day: { usedMicroUsd: 3_000_000 - 20_000, reservedMicroUsd: 15_000 }, week: { usedMicroUsd: 0, reservedMicroUsd: 0 } }, { windowKey: 'w', limitMicroUsd: 3_000_000, resetAt: base.day.resetAt }, { windowKey: 'w', limitMicroUsd: 3_000_000, resetAt: base.week.resetAt });
    expect(evaluateAvailability({ snapshot: reserved, table: T })).toMatchObject({ state: 'below_floor' });
  });

  it('成本模型失效 → 503，不帶 quotaScope，優先於任何額度類別', () => {
    for (const result of [
      evaluateAvailability({ snapshot: snap(0, 0, { dayExhausted: true }), table: FIXTURE_NONE_LIVE }),
      evaluateAvailability({ snapshot: snap(3_000_000, 3_000_000), table: T, costModelVersion: 'OTHER_VERSION' }),
      evaluateAvailability({ snapshot: snap(3_000_000, 3_000_000), table: T, requestReservationMicroUsd: -1 }),
      evaluateAvailability({ snapshot: snap(3_000_000, 3_000_000), table: T, requestReservationMicroUsd: 1.5 }),
    ]) {
      expect(result).toEqual({ state: 'cost_model_invalid', status: 503, publicCode: 'PROTECTION_SERVICE_UNAVAILABLE', mapAvailable: false });
      expect(result).not.toHaveProperty('quotaScope');
    }
  });

  it('G 隨價表改變，判定同步改變', () => {
    const s = snap(8_100, 3_000_000);
    expect(evaluateAvailability({ snapshot: s, table: T })).toMatchObject({ state: 'available' });
    const noMin = fixtureWithEndpoint(fixtureWithEndpoint(T, 'photo-translate', { live: false }), 'places', { live: false });
    expect(evaluateAvailability({ snapshot: s, table: noMin })).toMatchObject({ state: 'below_floor' });
  });
});

