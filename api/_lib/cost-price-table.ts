// 功能 005 T126：成本價表型別與 production 價表。
// A1 數值尚未核准，因此 production 價表所有端點 live:false，且不含任何單價／係數／上限數值。
// 測試用數值只存在於測試目錄的價表 fixture；此檔不得引用它。

export const PROTECTED_ENDPOINTS = ['assistant', 'transcribe', 'places', 'speech', 'photo-ocr', 'photo-translate'] as const;
export type ProtectedEndpoint = (typeof PROTECTED_ENDPOINTS)[number];

export type EndpointPricing =
  | {
      kind: 'tokens';
      inputMicroUsdPerMTok: number;
      outputMicroUsdPerMTok: number;
      maxInputTokens: number;
      maxOutputTokens: number;
    }
  | { kind: 'request'; perRequestMicroUsd: number }
  | { kind: 'audio_minute'; perMinuteMicroUsd: number; maxAudioSeconds: number };

export interface EndpointCostEntry {
  live: boolean;
  modelAllowlist: readonly string[];
  /** S_e = numerator / denominator，以整數比表示避免浮點誤差。 */
  priceScale: { numerator: number; denominator: number } | null;
  pricing: EndpointPricing | null;
}

export interface CostPriceTable {
  version: string;
  /** 價表生效時間（含，UTC ISO）。 */
  effectiveFrom: string;
  /** 價表失效時間（不含，UTC ISO）；過期不得放行，需發布新版本重新確認。 */
  expiresAt: string;
  /** A：單次請求上游嘗試次數上界。A＝3 已撤回，型別上只允許 1。 */
  attemptsUpperBound: 1;
  endpoints: Record<ProtectedEndpoint, EndpointCostEntry>;
}

const unapprovedEntry: EndpointCostEntry = Object.freeze({
  live: false,
  modelAllowlist: Object.freeze([]) as readonly string[],
  priceScale: null,
  pricing: null,
});

export const PRODUCTION_COST_PRICE_TABLE: CostPriceTable = Object.freeze({
  version: 'unapproved-a1-all-live-false',
  // 未核准：有效區間為空（from == until），任何時間點都不具效力。
  effectiveFrom: '1970-01-01T00:00:00.000Z',
  expiresAt: '1970-01-01T00:00:00.000Z',
  attemptsUpperBound: 1,
  endpoints: Object.freeze({
    assistant: unapprovedEntry,
    transcribe: unapprovedEntry,
    places: unapprovedEntry,
    speech: unapprovedEntry,
    'photo-ocr': unapprovedEntry,
    'photo-translate': unapprovedEntry,
  }),
});

export interface CostModelRef {
  version: string;
  effectiveFrom: string;
  expiresAt: string;
}

export const costModelOf = (table: CostPriceTable): CostModelRef => ({
  version: table.version,
  effectiveFrom: table.effectiveFrom,
  expiresAt: table.expiresAt,
});

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export function parseIsoUtc(value: unknown): number | null {
  if (typeof value !== 'string' || !ISO_UTC.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** 版本非空、起訖為有效 UTC ISO 且 from < until，並且 now 落在 [from, until)。 */
export function isCostModelEffective(model: CostModelRef | undefined, nowMs: number): boolean {
  if (!model || typeof model.version !== 'string' || model.version.length === 0) return false;
  const from = parseIsoUtc(model.effectiveFrom);
  const until = parseIsoUtc(model.expiresAt);
  if (from === null || until === null || from >= until) return false;
  return Number.isFinite(nowMs) && nowMs >= from && nowMs < until;
}
