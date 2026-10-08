import { createHash } from 'node:crypto';
import { estimateMaxReservation, estimateReservation, PCM_BYTES_PER_SECOND, type CostRejectCode } from './cost-estimators';
import {
  costModelOf,
  isCostModelEffective,
  type CostPriceTable,
  type ProtectedEndpoint,
} from './cost-price-table';
import {
  canonicalContent,
  FingerprintInputError,
  type TrustedFingerprintCost,
  type RequestContent,
} from './quota-fingerprint';
import {
  EstimateInputError,
  validateEstimateInputs,
  type EstimateBounds,
  type EstimateInputs,
} from './quota-estimate-inputs';

export interface CostRegistryEntry {
  endpoint: ProtectedEndpoint;
  version: string;
  table: CostPriceTable;
  model: string | null;
  billingTier: 'standard';
  attempts: 1;
  estimateBounds: EstimateBounds;
  detailAllowlist: readonly ('low' | 'high' | 'auto')[];
  blocked: boolean;
  approval: {
    approved: boolean;
    activated: boolean;
    upperBoundProven: boolean;
    singleAttemptVerified: boolean;
    priceSourceRef: string;
    approvalEvidenceRef: string;
    boundEvidenceRef: string;
    parametersDigest: string;
  };
}

/** 只由伺服器 options 注入；不是 request body 或正式 store 的記憶體 fallback。 */
export interface CostRegistry {
  resolve(endpoint: ProtectedEndpoint): Promise<CostRegistryEntry | null>;
  snapshot?(): Promise<RegistryBundle>;
}

export interface RegistryBundle {
  registryRevision: number;
  bundleDigest: string;
  table: CostPriceTable;
  entries: CostRegistryEntry[];
  maxReservations: Record<ProtectedEndpoint, number | null>;
}

export interface RegistryDecision {
  registryRevision: number;
  bundleDigest: string;
  decisionAt: string;
  floorMicroUsd: number;
  liveEndpoints: ProtectedEndpoint[];
}

export function registryBundleDigest(bundle: Omit<RegistryBundle, 'bundleDigest'>): string {
  return createHash('sha256').update(canonicalRegistryData({
    format: 'tokyo-mate/registry-bundle/v1', ...bundle,
  })).digest('hex');
}

export function createRegistryBundle(
  registryRevision: number, table: CostPriceTable, entries: CostRegistryEntry[],
): RegistryBundle {
  const maxReservations = Object.fromEntries(Object.keys(table.endpoints).map((name) => {
    const endpoint = name as ProtectedEndpoint;
    if (!table.endpoints[endpoint].live) return [endpoint, null];
    const estimate = estimateMaxReservation(endpoint, table);
    if (!estimate.ok) return reject('COST_MODEL_INVALID');
    return [endpoint, estimate.amountMicroUsd];
  })) as Record<ProtectedEndpoint, number | null>;
  const data = structuredClone({ registryRevision, table, entries, maxReservations });
  if (!positive(registryRevision)) return reject('COST_MODEL_INVALID');
  return { ...data, bundleDigest: registryBundleDigest(data) };
}

export function registryDecision(
  bundle: RegistryBundle, now: Date,
  blocks: { versions: ReadonlySet<string>; parameters: ReadonlySet<string> },
  allowEmpty = false,
): RegistryDecision {
  assertPlainData(bundle);
  const { bundleDigest, ...data } = bundle;
  if (!positive(bundle.registryRevision) || registryBundleDigest(data) !== bundleDigest ||
      !exactFields(bundle, ['registryRevision', 'bundleDigest', 'table', 'entries', 'maxReservations']) ||
      !exactFields(bundle.maxReservations, ['assistant', 'transcribe', 'places', 'speech', 'photo-ocr', 'photo-translate']) ||
      !exactFields(bundle.table.endpoints, ['assistant', 'transcribe', 'places', 'speech', 'photo-ocr', 'photo-translate']) ||
      !Array.isArray(bundle.entries)) return reject('COST_MODEL_INVALID');
  const liveEndpoints: ProtectedEndpoint[] = [];
  let floorMicroUsd = Infinity;
  for (const endpoint of Object.keys(bundle.table.endpoints) as ProtectedEndpoint[]) {
    const matching = bundle.entries.filter((entry) => entry.endpoint === endpoint);
    if (matching.length !== 1) return reject('COST_MODEL_INVALID');
    const entry = matching[0];
    if (canonicalRegistryData(entry.table) !== canonicalRegistryData(bundle.table) ||
        entry.version !== bundle.table.version || typeof entry.table.endpoints[endpoint].live !== 'boolean' ||
        typeof entry.blocked !== 'boolean') return reject('COST_MODEL_INVALID');
    if (!entry.table.endpoints[endpoint].live) {
      if (bundle.maxReservations[endpoint] !== null) return reject('COST_MODEL_INVALID');
      continue;
    }
    const effective = isCostModelEffective(costModelOf(entry.table), now.getTime());
    // 過期屬明確失效；其餘聲稱啟用的 metadata 必須完整，不能以封鎖掩蓋矛盾資料。
    validateEntry({ ...entry, blocked: false }, endpoint,
      effective ? now : new Date(entry.table.effectiveFrom));
    const maximum = estimateMaxReservation(endpoint, entry.table);
    if (!maximum.ok || maximum.amountMicroUsd !== bundle.maxReservations[endpoint])
      return reject('COST_MODEL_INVALID');
    if (!effective || entry.blocked || blocks.versions.has(entry.version) ||
        blocks.parameters.has(costParametersDigest(entry))) continue;
    const estimate = estimateReservation({ endpoint, table: entry.table, model: entry.model ?? undefined, now });
    if (!estimate.ok) return reject('COST_MODEL_INVALID');
    liveEndpoints.push(endpoint);
    floorMicroUsd = Math.min(floorMicroUsd, estimate.amountMicroUsd);
  }
  if (bundle.entries.length !== 6 || (!allowEmpty && liveEndpoints.length === 0)) return reject('COST_MODEL_INVALID');
  if (liveEndpoints.length === 0) floorMicroUsd = 0;
  return { registryRevision: bundle.registryRevision, bundleDigest, decisionAt: now.toISOString(),
    floorMicroUsd, liveEndpoints: liveEndpoints.sort() };
}

export type RegistryRejectReason = CostRejectCode | 'COST_MODEL_BLOCKED' | 'COST_REGISTRY_UNAVAILABLE' | 'TRUSTED_COST_INVALID';

export class CostRegistryError extends Error {
  constructor(public readonly reason: RegistryRejectReason) {
    super(`可信成本 registry 拒絕：${reason}`);
    this.name = 'CostRegistryError';
  }
}

const reject = (reason: RegistryRejectReason): never => { throw new CostRegistryError(reason); };
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
const reference = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_.:+/-]{1,128}$/.test(v);
const exactFields = (value: object, fields: readonly string[]): boolean =>
  Reflect.ownKeys(value).length === fields.length &&
  Reflect.ownKeys(value).every((key) => typeof key === 'string' && fields.includes(key));

function assertPlainData(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))) return;
  if (!value || typeof value !== 'object' || seen.has(value) ||
      (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null)) return reject('COST_MODEL_INVALID');
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue;
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !d || !d.enumerable || !('value' in d)) return reject('COST_MODEL_INVALID');
    assertPlainData(d.value, seen);
  }

  seen.delete(value);
}

export function canonicalRegistryData(value: unknown): string {
  assertPlainData(value);
  const content = (item: unknown): RequestContent => {
    if (item === null || typeof item === 'string' || typeof item === 'number' ||
        typeof item === 'boolean') return item;
    if (Array.isArray(item)) return item.map(content);
    if (typeof item === 'object' && item !== null)
      return Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, content(entry)]));
    return reject('COST_MODEL_INVALID');
  };
  return canonicalContent(content(value));
}

/** 不包含版本／效期／核准標籤，避免僅改名稱或重新貼標籤繞過同成本參數封鎖。 */
export function costParametersDigest(entry: CostRegistryEntry): string {
  const cost = entry.table.endpoints[entry.endpoint];
  let scale = null;
  if (cost.priceScale) {
    const { numerator, denominator } = cost.priceScale;
    if (!positive(numerator) || !positive(denominator)) return reject('COST_MODEL_INVALID');
    let a = BigInt(numerator);
    let b = BigInt(denominator);
    while (b !== 0n) [a, b] = [b, a % b];
    scale = { numerator: Number(BigInt(numerator) / a), denominator: Number(BigInt(denominator) / a) };
  }
  return createHash('sha256').update(canonicalContent({
    format: 'tokyo-mate/cost-parameters/v1',
    endpoint: entry.endpoint,
    model: entry.model,
    modelAllowlist: [...cost.modelAllowlist].sort(),
    billingTier: entry.billingTier,
    attempts: entry.attempts,
    attemptsUpperBound: entry.table.attemptsUpperBound,
    priceScale: scale,
    pricing: cost.pricing && { ...cost.pricing },
    estimateBounds: { ...entry.estimateBounds },
    detailAllowlist: [...entry.detailAllowlist].sort(),
  })).digest('hex');
}

function validateEntry(entry: CostRegistryEntry | null, endpoint: ProtectedEndpoint, now: Date): CostRegistryEntry {
  if (!entry) return reject('COST_MODEL_INVALID');
  try {
    if (!exactFields(entry, ['endpoint', 'version', 'table', 'model', 'billingTier', 'attempts',
      'estimateBounds', 'detailAllowlist', 'blocked', 'approval']) ||
        !exactFields(entry.table, ['version', 'effectiveFrom', 'expiresAt', 'attemptsUpperBound', 'endpoints'])) {
      return reject('COST_MODEL_INVALID');
    }
    if (entry.endpoint !== endpoint || !reference(entry.version) || entry.version !== entry.table.version ||
        !isCostModelEffective(costModelOf(entry.table), now.getTime()) ||
        entry.billingTier !== 'standard' || entry.attempts !== 1 || entry.table.attemptsUpperBound !== 1 ||
        typeof entry.blocked !== 'boolean') return reject('COST_MODEL_INVALID');
    const cost = entry.table.endpoints[endpoint];
    if (!cost || typeof cost.live !== 'boolean' ||
        !exactFields(cost, ['live', 'modelAllowlist', 'priceScale', 'pricing'])) return reject('COST_MODEL_INVALID');
    if (endpoint === 'speech' || !cost.live) return reject('COST_BOUND_UNPROVEN');
    if (entry.blocked) return reject('COST_MODEL_BLOCKED');
    const a = entry.approval;
    if (!a || a.approved !== true || a.activated !== true || a.upperBoundProven !== true ||
        a.singleAttemptVerified !== true || !reference(a.priceSourceRef) ||
        !reference(a.approvalEvidenceRef) || !reference(a.boundEvidenceRef) ||
        !exactFields(a, ['approved', 'activated', 'upperBoundProven', 'singleAttemptVerified',
          'priceSourceRef', 'approvalEvidenceRef', 'boundEvidenceRef', 'parametersDigest'])) return reject('COST_BOUND_UNPROVEN');
    if (!Array.isArray(cost.modelAllowlist) || new Set(cost.modelAllowlist).size !== cost.modelAllowlist.length ||
        !cost.modelAllowlist.every(reference) ||
        (endpoint === 'places' ? entry.model !== null || cost.modelAllowlist.length !== 0 :
          !reference(entry.model) || !cost.modelAllowlist.includes(entry.model))) return reject('COST_MODEL_UNSUPPORTED');
    const pricing = cost.pricing;
    const expectedKind = endpoint === 'places' ? 'request' : endpoint === 'transcribe' ? 'audio_minute' : 'tokens';
    const pricingFields = expectedKind === 'tokens'
      ? ['kind', 'inputMicroUsdPerMTok', 'outputMicroUsdPerMTok', 'maxInputTokens', 'maxOutputTokens']
      : expectedKind === 'request' ? ['kind', 'perRequestMicroUsd'] : ['kind', 'perMinuteMicroUsd', 'maxAudioSeconds'];
    if (!pricing || pricing.kind !== expectedKind || !cost.priceScale ||
        !exactFields(pricing, pricingFields) || !exactFields(cost.priceScale, ['numerator', 'denominator']) ||
        !positive(cost.priceScale.numerator) || !positive(cost.priceScale.denominator) ||
        !Object.entries(pricing).every(([k, v]) => k === 'kind' || positive(v))) return reject('COST_MODEL_INVALID');
    validateEstimateInputs(endpoint, {}, entry.estimateBounds);
    if (pricing.kind === 'tokens' &&
        (!positive(pricing.maxInputTokens) || !positive(pricing.maxOutputTokens) ||
          !positive(pricing.inputMicroUsdPerMTok) || !positive(pricing.outputMicroUsdPerMTok) ||
          entry.estimateBounds.inputTokens !== pricing.maxInputTokens ||
          entry.estimateBounds.maxOutputTokens !== pricing.maxOutputTokens)) return reject('COST_MODEL_INVALID');
    if (pricing.kind === 'audio_minute' &&
        (!positive(pricing.perMinuteMicroUsd) || !positive(pricing.maxAudioSeconds) ||
          !positive(pricing.maxAudioSeconds * PCM_BYTES_PER_SECOND) ||
          entry.estimateBounds.audioDataBytes !== pricing.maxAudioSeconds * PCM_BYTES_PER_SECOND ||
          entry.estimateBounds.billedMinutes !== Math.ceil(pricing.maxAudioSeconds / 60))) return reject('COST_MODEL_INVALID');
    if (pricing.kind === 'request' && !positive(pricing.perRequestMicroUsd)) return reject('COST_MODEL_INVALID');
    const photo = endpoint === 'photo-ocr' || endpoint === 'photo-translate';
    if (!Array.isArray(entry.detailAllowlist) || new Set(entry.detailAllowlist).size !== entry.detailAllowlist.length ||
        entry.detailAllowlist.some((d) => d !== 'low' && d !== 'high' && d !== 'auto') ||
        (photo ? entry.detailAllowlist.length === 0 : entry.detailAllowlist.length !== 0)) return reject('COST_MODEL_INVALID');
    if (a.parametersDigest !== costParametersDigest(entry)) return reject('COST_MODEL_INVALID');
    return entry;
  } catch (error) {
    if (error instanceof CostRegistryError) throw error;
    if (error instanceof EstimateInputError || error instanceof FingerprintInputError || error instanceof TypeError) {
      return reject('TRUSTED_COST_INVALID');
    }
    throw error;
  }
}

export async function estimateRegistryCost(
  registry: CostRegistry | undefined,
  endpoint: ProtectedEndpoint,
  inputs: EstimateInputs,
  now: Date,
): Promise<TrustedFingerprintCost & { costParametersDigest: string }> {
  if (!registry) return reject('COST_REGISTRY_UNAVAILABLE');
  let resolved: CostRegistryEntry | null;
  try {
    resolved = await registry.resolve(endpoint);
  } catch {
    // registry lookup 的失敗明確回報不可用；不採 production／fixture 預設值。
    return reject('COST_REGISTRY_UNAVAILABLE');
  }
  assertPlainData(resolved);
  resolved = structuredClone(resolved);
  const entry = validateEntry(resolved, endpoint, now);
  let verified: EstimateInputs;
  try {
    verified = validateEstimateInputs(endpoint, inputs, entry.estimateBounds);
  } catch (error) {
    if (error instanceof EstimateInputError) return reject('TRUSTED_COST_INVALID');
    throw error;
  }
  if (verified.detail !== undefined && !entry.detailAllowlist.includes(verified.detail)) return reject('TRUSTED_COST_INVALID');
  const pricing = entry.table.endpoints[endpoint].pricing;
  if (pricing?.kind === 'tokens' && verified.maxOutputTokens !== undefined &&
      verified.maxOutputTokens !== pricing.maxOutputTokens) return reject('TRUSTED_COST_INVALID');
  const estimate = estimateReservation({
    endpoint, table: entry.table, model: entry.model ?? undefined,
    input: { inputTokens: verified.inputTokens, audioDataBytes: verified.audioDataBytes }, now,
  });
  if (!estimate.ok) return reject(estimate.status === 503 ? estimate.reason : 'TRUSTED_COST_INVALID');
  const estimateInputs = validateEstimateInputs(endpoint, { ...verified, ...estimate.estimateInputs }, entry.estimateBounds);
  if (verified.billedMinutes !== undefined && verified.billedMinutes !== estimateInputs.billedMinutes) return reject('TRUSTED_COST_INVALID');
  return {
    endpoint, amountMicroUsd: estimate.amountMicroUsd, costModel: costModelOf(entry.table),
    model: entry.model, billingTier: entry.billingTier, attempts: entry.attempts,
    estimateInputs, estimateBounds: entry.estimateBounds, costParametersDigest: costParametersDigest(entry),
  };
}
