// 僅供測試。數值取自 plan.md §4.2.3 表一（A＝1）的「示意算術」，未經 A1 核准，不代表真實成本上界。
import type { CostPriceTable, EndpointCostEntry, ProtectedEndpoint } from '../../api/_lib/cost-price-table';

const tokens = (inMax: number, outMax: number): EndpointCostEntry['pricing'] => ({
  kind: 'tokens',
  inputMicroUsdPerMTok: 150_000,
  outputMicroUsdPerMTok: 600_000,
  maxInputTokens: inMax,
  maxOutputTokens: outMax,
});

export const FIXTURE_EFFECTIVE_FROM = '2026-01-01T00:00:00.000Z';
export const FIXTURE_EXPIRES_AT = '2027-01-01T00:00:00.000Z';

const notLive: EndpointCostEntry = { live: false, modelAllowlist: [], priceScale: null, pricing: null };

export const FIXTURE_ALL_LIVE: CostPriceTable = {
  version: 'FIXTURE_ALL_LIVE_v1',
  effectiveFrom: FIXTURE_EFFECTIVE_FROM,
  expiresAt: FIXTURE_EXPIRES_AT,
  attemptsUpperBound: 1,
  endpoints: {
    assistant: { live: true, modelAllowlist: ['gpt-4o-mini'], priceScale: { numerator: 2, denominator: 1 }, pricing: tokens(24_100, 2_000) },
    'photo-translate': { live: true, modelAllowlist: ['gpt-4o-mini'], priceScale: { numerator: 2, denominator: 1 }, pricing: tokens(10_400, 4_096) },
    'photo-ocr': { live: true, modelAllowlist: ['gpt-4o-mini'], priceScale: { numerator: 2, denominator: 1 }, pricing: tokens(52_369, 3_072) },
    places: { live: true, modelAllowlist: [], priceScale: { numerator: 5, denominator: 4 }, pricing: { kind: 'request', perRequestMicroUsd: 40_000 } },
    transcribe: notLive,
    speech: notLive,
  },
};

export const FIXTURE_TRANSCRIBE_LIVE: CostPriceTable = {
  ...FIXTURE_ALL_LIVE,
  version: 'FIXTURE_TRANSCRIBE_LIVE_v1',
  endpoints: {
    ...FIXTURE_ALL_LIVE.endpoints,
    transcribe: {
      live: true,
      modelAllowlist: ['whisper-1'],
      priceScale: { numerator: 3, denominator: 2 },
      pricing: { kind: 'audio_minute', perMinuteMicroUsd: 6_000, maxAudioSeconds: 60 },
    },
  },
};

export const FIXTURE_NONE_LIVE: CostPriceTable = {
  version: 'FIXTURE_NONE_LIVE_v1',
  effectiveFrom: FIXTURE_EFFECTIVE_FROM,
  expiresAt: FIXTURE_EXPIRES_AT,
  attemptsUpperBound: 1,
  endpoints: {
    assistant: notLive,
    transcribe: notLive,
    places: notLive,
    speech: notLive,
    'photo-ocr': notLive,
    'photo-translate': notLive,
  },
};

export function fixtureWithEndpoint(
  base: CostPriceTable,
  endpoint: ProtectedEndpoint,
  patch: Partial<EndpointCostEntry>,
  version = `${base.version}+patched`,
): CostPriceTable {
  return {
    ...base,
    version,
    endpoints: { ...base.endpoints, [endpoint]: { ...base.endpoints[endpoint], ...patch } },
  };
}

// plan.md §4.2.1／§4.2.3 的提案限制值（待核對，僅測試用）
export const FIXTURE_LIMITS = {
  promptMaxBytes: 4_096,
  knowledgeMaxBytes: 16_384,
  preParseMaxBytes: {
    assistant: 16_384,
    'photo-translate': 16_384,
    speech: 4_096,
    places: 2_048,
    'photo-ocr': 4_200_000,
    transcribe: 2_000_000,
  },
} as const;

// plan.md §4.2.3 表一 A＝1 的 R_e 示意值
export const FIXTURE_EXPECTED_R_MAX = {
  assistant: 9_630,
  'photo-translate': 8_036,
  'photo-ocr': 19_398,
  places: 50_000,
  transcribe: 9_000,
} as const;
