// 功能 005 T023：六端點可信最大估算成本（µUSD 整數；僅最後 ceil 一次）。
// 價表一律由呼叫端傳入，預設為 production 價表（目前全部 live:false → COST_BOUND_UNPROVEN）。
// 不含任何 G 公式（見 quota-threshold.ts）。
import {
  PRODUCTION_COST_PRICE_TABLE,
  costModelOf,
  isCostModelEffective,
  type CostPriceTable,
  type EndpointCostEntry,
  type ProtectedEndpoint,
} from './cost-price-table';

export type CostRejectCode = 'COST_BOUND_UNPROVEN' | 'COST_MODEL_UNSUPPORTED' | 'COST_MODEL_INVALID';

export type CostEstimateResult =
  | { ok: true; amountMicroUsd: number; costModelVersion: string; estimateInputs: Record<string, number> }
  | { ok: false; status: 503; publicCode: 'PROTECTION_SERVICE_UNAVAILABLE'; reason: CostRejectCode }
  | { ok: false; status: 400; publicCode: 'INVALID_INPUT'; reason: 'INPUT_EXCEEDS_BOUND' };

export interface EstimateInput {
  /** token 端點：實際輸入 token 上界；缺省使用最大合法輸入。 */
  inputTokens?: number;
  /** transcribe：驗證後的 PCM data bytes（16 kHz／mono／16-bit，32,000 B/s）。 */
  audioDataBytes?: number;
}

export interface EstimateRequest {
  endpoint: ProtectedEndpoint;
  table?: CostPriceTable;
  model?: string;
  input?: EstimateInput;
  /** 提供時才檢查價表有效期（生效前／過期 → COST_MODEL_INVALID）；quota engine 於預留時一律檢查。 */
  now?: Date;
}

export const PCM_BYTES_PER_SECOND = 32_000;

const reject503 = (reason: CostRejectCode): CostEstimateResult => ({
  ok: false,
  status: 503,
  publicCode: 'PROTECTION_SERVICE_UNAVAILABLE',
  reason,
});

const isPositiveSafeInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

function finish(
  value: bigint,
  table: CostPriceTable,
  estimateInputs: Record<string, number>,
): CostEstimateResult {
  if (value <= 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) return reject503('COST_MODEL_INVALID');
  return { ok: true, amountMicroUsd: Number(value), costModelVersion: table.version, estimateInputs };
}

export function estimateReservation(request: EstimateRequest): CostEstimateResult {
  const table = request.table ?? PRODUCTION_COST_PRICE_TABLE;
  const { endpoint } = request;

  if (!table || typeof table.version !== 'string' || table.version.length === 0 || table.attemptsUpperBound !== 1) {
    return reject503('COST_MODEL_INVALID');
  }
  if (request.now !== undefined && !isCostModelEffective(costModelOf(table), request.now.getTime())) {
    return reject503('COST_MODEL_INVALID');
  }
  const entry: EndpointCostEntry | undefined = table.endpoints?.[endpoint];
  if (!entry) return reject503('COST_MODEL_INVALID');

  // speech 沒有可證明的輸出上界，無論價表如何設定一律不放行。
  if (endpoint === 'speech' || !entry.live) return reject503('COST_BOUND_UNPROVEN');

  const { pricing, priceScale } = entry;
  if (!pricing || !priceScale || !isPositiveSafeInt(priceScale.numerator) || !isPositiveSafeInt(priceScale.denominator)) {
    return reject503('COST_MODEL_INVALID');
  }
  const scaleNum = BigInt(priceScale.numerator);
  const scaleDen = BigInt(priceScale.denominator);

  if (pricing.kind === 'request') {
    if (!isPositiveSafeInt(pricing.perRequestMicroUsd)) return reject503('COST_MODEL_INVALID');
    return finish(ceilDiv(scaleNum * BigInt(pricing.perRequestMicroUsd), scaleDen), table, {});
  }

  if (!request.model || !entry.modelAllowlist.includes(request.model)) return reject503('COST_MODEL_UNSUPPORTED');

  if (pricing.kind === 'tokens') {
    const { inputMicroUsdPerMTok, outputMicroUsdPerMTok, maxInputTokens, maxOutputTokens } = pricing;
    if (![inputMicroUsdPerMTok, outputMicroUsdPerMTok, maxInputTokens, maxOutputTokens].every(isPositiveSafeInt)) {
      return reject503('COST_MODEL_INVALID');
    }
    const inputTokens = request.input?.inputTokens ?? maxInputTokens;
    if (!Number.isSafeInteger(inputTokens) || inputTokens < 0 || inputTokens > maxInputTokens) {
      return { ok: false, status: 400, publicCode: 'INVALID_INPUT', reason: 'INPUT_EXCEEDS_BOUND' };
    }
    const microPerMTok =
      BigInt(inputTokens) * BigInt(inputMicroUsdPerMTok) + BigInt(maxOutputTokens) * BigInt(outputMicroUsdPerMTok);
    return finish(ceilDiv(scaleNum * microPerMTok, scaleDen * 1_000_000n), table, {
      inputTokens,
      maxOutputTokens,
    });
  }

  // audio_minute
  if (!isPositiveSafeInt(pricing.perMinuteMicroUsd) || !isPositiveSafeInt(pricing.maxAudioSeconds)) {
    return reject503('COST_MODEL_INVALID');
  }
  const maxBytes = pricing.maxAudioSeconds * PCM_BYTES_PER_SECOND;
  const audioDataBytes = request.input?.audioDataBytes ?? maxBytes;
  if (!isPositiveSafeInt(audioDataBytes) || audioDataBytes > maxBytes) {
    return { ok: false, status: 400, publicCode: 'INVALID_INPUT', reason: 'INPUT_EXCEEDS_BOUND' };
  }
  const minutes = ceilDiv(BigInt(audioDataBytes), BigInt(PCM_BYTES_PER_SECOND * 60));
  return finish(ceilDiv(scaleNum * minutes * BigInt(pricing.perMinuteMicroUsd), scaleDen), table, {
    audioDataBytes,
    billedMinutes: Number(minutes),
  });
}

/** 合法輸入上限下的 R_max；模型取價表白名單第一項。 */
export function estimateMaxReservation(endpoint: ProtectedEndpoint, table: CostPriceTable = PRODUCTION_COST_PRICE_TABLE): CostEstimateResult {
  const model = table.endpoints?.[endpoint]?.modelAllowlist?.[0];
  return estimateReservation({ endpoint, table, model });
}
