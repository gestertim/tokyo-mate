// 功能 005 R1：quota 執行期驗證。所有金額一律為安全整數，加總與餘額以 BigInt 計算；
// 任何無效的輸入或 store 回傳都丟出 InvalidQuotaDataError，呼叫端必須 fail closed（不得產生成功快照）。
import { PROTECTED_ENDPOINTS } from './cost-price-table';
import { parseIsoUtc } from './cost-price-table';
import { canonicalContent, HMAC_SHA256_HEX, validateTrustedCost } from './quota-fingerprint';
import { accountingLookupIndex, isCapabilityPayload } from './request-epoch';
import { getQuotaWindows } from './quota-window';
import { EstimateInputError, validateEstimateInputs } from './quota-estimate-inputs';
import type {
  EffectiveLimits,
  QuotaUsage,
  ReservationRecord,
  ReservationStatus,
  ReservationUsageEvidence,
  TierLimitTable,
  TopUpRecord,
  WindowUsage,
} from './shared-store';

export class InvalidQuotaDataError extends Error {
  constructor(public readonly field: string) {
    super(`quota 資料無效：${field}`);
    this.name = 'InvalidQuotaDataError';
  }
}

export const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
export const MAX_KEY_LENGTH = 128;

export const isPositiveSafeInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
export const isNonNegativeSafeInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export const isKey = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_KEY_LENGTH;
export const isHmacSha256Hex = (v: unknown): v is string => typeof v === 'string' && HMAC_SHA256_HEX.test(v);

export function fail(field: string): never {
  throw new InvalidQuotaDataError(field);
}

/** BigInt 加總；結果超過 MAX_SAFE_INTEGER 視為無效。 */
export function addSafe(...values: number[]): number {
  let total = 0n;
  for (const v of values) {
    if (!isNonNegativeSafeInt(v)) fail('addSafe.operand');
    total += BigInt(v);
  }
  if (total > MAX_SAFE) fail('addSafe.overflow');
  return Number(total);
}

/** limit − used − reserved；允許負值（撤銷追加或成本超額後），但必須落在安全整數範圍。 */
export function remainingOf(limit: number, used: number, reserved: number): number {
  if (!isNonNegativeSafeInt(limit) || !isNonNegativeSafeInt(used) || !isNonNegativeSafeInt(reserved)) fail('remaining.operand');
  const result = BigInt(limit) - BigInt(used) - BigInt(reserved);
  if (result > MAX_SAFE || result < -MAX_SAFE) fail('remaining.range');
  return Number(result);
}

export function validateWindowUsage(value: unknown, field: string): WindowUsage {
  const u = value as WindowUsage | null;
  if (!u || typeof u !== 'object' || !isNonNegativeSafeInt(u.usedMicroUsd) || !isNonNegativeSafeInt(u.reservedMicroUsd)) fail(field);
  addSafe(u.usedMicroUsd, u.reservedMicroUsd);
  return u;
}

export function validateUsage(value: unknown, field = 'usage'): QuotaUsage {
  const u = value as QuotaUsage | null;
  if (!u || typeof u !== 'object') fail(field);
  validateWindowUsage(u.day, `${field}.day`);
  validateWindowUsage(u.week, `${field}.week`);
  return u;
}

export function validateLimits(value: unknown, tierLimits: TierLimitTable): EffectiveLimits {
  const l = value as EffectiveLimits | null;
  if (!l || typeof l !== 'object') fail('limits');
  if (l.tier !== 'tier1' && l.tier !== 'tier2') fail('limits.tier');
  for (const key of ['dayLimitMicroUsd', 'weekBaseLimitMicroUsd', 'weekTopUpMicroUsd', 'weekLimitMicroUsd'] as const) {
    if (!isNonNegativeSafeInt(l[key])) fail(`limits.${key}`);
  }
  // 週上限必須恰為 base + 當週 active 追加，且 base／日上限必須等於營運設定。
  if (addSafe(l.weekBaseLimitMicroUsd, l.weekTopUpMicroUsd) !== l.weekLimitMicroUsd) fail('limits.weekLimitMicroUsd');
  if (l.dayLimitMicroUsd !== tierLimits[l.tier].dayLimitMicroUsd) fail('limits.dayLimitMicroUsd');
  if (l.weekBaseLimitMicroUsd !== tierLimits[l.tier].weekBaseLimitMicroUsd) fail('limits.weekBaseLimitMicroUsd');
  return l;
}

export function validateTierLimits(value: unknown): TierLimitTable {
  const t = value as TierLimitTable | null;
  if (!t || typeof t !== 'object') fail('tierLimits');
  for (const tier of ['tier1', 'tier2'] as const) {
    const entry = t[tier];
    if (!entry || !isNonNegativeSafeInt(entry.dayLimitMicroUsd) || !isNonNegativeSafeInt(entry.weekBaseLimitMicroUsd)) fail(`tierLimits.${tier}`);
  }
  return t;
}

const STATUSES: readonly ReservationStatus[] = ['reserved', 'settled', 'released', 'uncertain'];
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const WEEK_KEY = /^\d{4}-W\d{2}$/;

export interface ReservationExpectation {
  identitySubject: string;
  reservationId?: string;
  idempotencyKey?: string;
  endpoint?: string;
  amountMicroUsd?: number;
  costModelVersion?: string;
  costParametersDigest?: string;
  requestFingerprint?: string;
  dayWindowKey?: string;
  weekWindowKey?: string;
  statuses?: readonly ReservationStatus[];
}

export function validateReservation(value: unknown, expect: ReservationExpectation): ReservationRecord {
  const r = value as ReservationRecord | null;
  if (!r || typeof r !== 'object') fail('reservation');
  const check = (ok: boolean, field: string) => {
    if (!ok) fail(`reservation.${field}`);
  };
  check(isKey(r.reservationId), 'reservationId');
  check(isKey(r.idempotencyKey), 'idempotencyKey');
  check(r.identitySubject === expect.identitySubject, 'identitySubject');
  check((PROTECTED_ENDPOINTS as readonly string[]).includes(r.endpoint), 'endpoint');
  check(isPositiveSafeInt(r.estimatedCostUpperBoundUsdMicro), 'estimatedCostUpperBoundUsdMicro');
  check(isKey(r.costModelVersion), 'costModelVersion');
  check(isHmacSha256Hex(r.costParametersDigest), 'costParametersDigest');
  const from = parseIsoUtc(r.costModelEffectiveFrom);
  const until = parseIsoUtc(r.costModelExpiresAt);
  check(from !== null && until !== null && from < until, 'costModelInterval');
  check(isHmacSha256Hex(r.requestFingerprint), 'requestFingerprint');
  check(isKey(r.fingerprintKeyVersion), 'fingerprintKeyVersion');
  try {
    validateEstimateInputs(r.endpoint, r.estimateInputs);
  } catch (error) {
    if (!(error instanceof EstimateInputError)) throw error;
    fail('reservation.estimateInputs');
  }
  const allowed = new Set([
    'reservationId', 'idempotencyKey', 'identitySubject', 'endpoint', 'estimatedCostUpperBoundUsdMicro',
    'costModelVersion', 'costParametersDigest', 'costModelEffectiveFrom', 'costModelExpiresAt', 'requestFingerprint', 'fingerprintKeyVersion',
    'estimateInputs', 'status', 'dayWindowKey', 'weekWindowKey', 'createdAt', 'executionGranted', 'leaseExpiresAt',
    'conflictCount', 'lastConflictAt', 'lastConflictFingerprint', 'settledAt', 'settlementReason',
    'settledChargeUsdMicro', 'overrunMicroUsd', 'settlementCostModelVersion', 'lateOutcomeObserved', 'registryDecision',
    'requestEpoch', 'comparisonCost', 'lastReviewedAt', 'reviewEvidenceRef', 'reviewEscalated',
  ]);
  check(Reflect.ownKeys(r).every((key) => typeof key === 'string' && allowed.has(key)), 'fields');
  if (r.requestEpoch !== undefined) {
    const x = r.requestEpoch;
    check(!!x && isCapabilityPayload(x.payload) && /^[A-Za-z0-9_-]{43}$/.test(x.commandIndex) &&
      /^[A-Za-z0-9_-]{43}$/.test(x.handleIndex) && Object.keys(x).length === 4, 'requestEpoch');
    check(x.payload.endpoint === r.endpoint && x.payload.operationHandle === r.idempotencyKey &&
      x.accountingIndex === accountingLookupIndex(x.payload.epochId, x.payload.operationHandle), 'epochBinding');
    const cost = validateTrustedCost(r.comparisonCost, r.endpoint);
    check(cost.amountMicroUsd === r.estimatedCostUpperBoundUsdMicro &&
      cost.costParametersDigest === r.costParametersDigest && cost.costModel.version === r.costModelVersion &&
      cost.costModel.effectiveFrom === r.costModelEffectiveFrom && cost.costModel.expiresAt === r.costModelExpiresAt &&
      canonicalContent(cost.estimateInputs) === canonicalContent(r.estimateInputs), 'comparisonCost');
  } else check(r.comparisonCost === undefined, 'comparisonCost');
  if (r.lastReviewedAt !== undefined) check(parseIsoUtc(r.lastReviewedAt) !== null, 'lastReviewedAt');
  if (r.reviewEvidenceRef !== undefined) check(isKey(r.reviewEvidenceRef), 'reviewEvidenceRef');
  if (r.reviewEscalated !== undefined) check(typeof r.reviewEscalated === 'boolean', 'reviewEscalated');
  if (r.lastConflictFingerprint !== undefined) check(isHmacSha256Hex(r.lastConflictFingerprint), 'lastConflictFingerprint');
  if (r.lateOutcomeObserved !== undefined) {
    const late = r.lateOutcomeObserved;
    check(!!late && (late.outcome === 'success' || late.outcome === 'unbilled_failure') &&
      parseIsoUtc(late.observedAt) !== null &&
      Reflect.ownKeys(late).every((key) => key === 'outcome' || key === 'observedAt'), 'lateOutcomeObserved');
  }
  check(STATUSES.includes(r.status), 'status');
  check(typeof r.dayWindowKey === 'string' && DAY_KEY.test(r.dayWindowKey), 'dayWindowKey');
  check(typeof r.weekWindowKey === 'string' && WEEK_KEY.test(r.weekWindowKey), 'weekWindowKey');
  check(parseIsoUtc(r.createdAt) !== null && parseIsoUtc(r.leaseExpiresAt) !== null, 'timestamps');
  if (r.registryDecision !== undefined) {
    const d = r.registryDecision;
    check(isPositiveSafeInt(d.registryRevision) && isHmacSha256Hex(d.bundleDigest) &&
      isPositiveSafeInt(d.floorMicroUsd) && d.decisionAt === r.createdAt &&
      Array.isArray(d.liveEndpoints) && d.liveEndpoints.length > 0 &&
      new Set(d.liveEndpoints).size === d.liveEndpoints.length &&
      d.liveEndpoints.every((endpoint) => PROTECTED_ENDPOINTS.includes(endpoint)) &&
      Reflect.ownKeys(d).every((field) => ['registryRevision', 'bundleDigest', 'floorMicroUsd', 'decisionAt', 'liveEndpoints'].includes(String(field))),
    'registryDecision');
  }
  check(Date.parse(r.leaseExpiresAt) > Date.parse(r.createdAt), 'leaseInterval');
  const windows = getQuotaWindows(new Date(r.createdAt));
  check(r.dayWindowKey === windows.day.windowKey && r.weekWindowKey === windows.week.windowKey, 'originalWindows');
  check(r.executionGranted === true, 'executionGranted');
  check(isNonNegativeSafeInt(r.conflictCount), 'conflictCount');

  if (expect.reservationId !== undefined) check(r.reservationId === expect.reservationId, 'reservationId');
  if (expect.idempotencyKey !== undefined) check(r.idempotencyKey === expect.idempotencyKey, 'idempotencyKey');
  if (expect.endpoint !== undefined) check(r.endpoint === expect.endpoint, 'endpoint');
  if (expect.amountMicroUsd !== undefined) check(r.estimatedCostUpperBoundUsdMicro === expect.amountMicroUsd, 'amount');
  if (expect.costModelVersion !== undefined) check(r.costModelVersion === expect.costModelVersion, 'costModelVersion');
  if (expect.costParametersDigest !== undefined) check(r.costParametersDigest === expect.costParametersDigest, 'costParametersDigest');
  if (expect.requestFingerprint !== undefined) check(r.requestFingerprint === expect.requestFingerprint, 'requestFingerprint');
  if (expect.dayWindowKey !== undefined) check(r.dayWindowKey === expect.dayWindowKey, 'dayWindowKey');
  if (expect.weekWindowKey !== undefined) check(r.weekWindowKey === expect.weekWindowKey, 'weekWindowKey');
  if (expect.statuses) check(expect.statuses.includes(r.status), 'status');

  if (r.status === 'settled') {
    check(isNonNegativeSafeInt(r.settledChargeUsdMicro), 'settledChargeUsdMicro');
    const excess = BigInt(r.settledChargeUsdMicro as number) - BigInt(r.estimatedCostUpperBoundUsdMicro);
    check(excess <= 0n ? r.overrunMicroUsd === undefined : r.overrunMicroUsd === Number(excess), 'overrunMicroUsd');
  } else {
    check(r.settledChargeUsdMicro === undefined || r.settledChargeUsdMicro === 0, 'settledChargeUsdMicro');
    check(r.overrunMicroUsd === undefined, 'overrunMicroUsd');
  }
  return r;
}

export function validateNewReservationLease(r: ReservationRecord, commandTime: Date, leaseMs: number): void {
  if (r.createdAt !== commandTime.toISOString() ||
      Date.parse(r.leaseExpiresAt) !== commandTime.getTime() + leaseMs) fail('reservation.commandLease');
}

export function validateReservationUsage(
  evidence: ReservationUsageEvidence,
  expect: ReservationExpectation,
  original?: ReservationRecord,
): ReservationRecord {
  const r = validateReservation(evidence.reservation, expect);
  const usage = validateUsage(evidence.usage);
  if (evidence.identitySubject !== r.identitySubject ||
      evidence.dayWindowKey !== r.dayWindowKey || evidence.weekWindowKey !== r.weekWindowKey) fail('usage.scope');
  if (original) {
    for (const field of [
      'reservationId', 'idempotencyKey', 'identitySubject', 'endpoint', 'estimatedCostUpperBoundUsdMicro',
      'costModelVersion', 'costParametersDigest', 'costModelEffectiveFrom', 'costModelExpiresAt',
      'requestFingerprint', 'fingerprintKeyVersion', 'dayWindowKey', 'weekWindowKey', 'createdAt', 'leaseExpiresAt',
    ] as const) {
      if (r[field] !== original[field]) fail(`reservation.immutable.${field}`);
    }
    if (canonicalContent(r.estimateInputs) !== canonicalContent(original.estimateInputs)) fail('reservation.immutable.estimateInputs');
    if (JSON.stringify(r.registryDecision) !== JSON.stringify(original.registryDecision)) fail('reservation.immutable.registryDecision');
    if (original.status !== 'reserved') {
      for (const field of ['status', 'settledAt', 'settledChargeUsdMicro', 'settlementReason', 'settlementCostModelVersion', 'overrunMicroUsd'] as const) {
        if (r[field] !== original[field]) fail(`reservation.terminal.${field}`);
      }
    }
  }
  if (r.status !== 'reserved' && (parseIsoUtc(r.settledAt) === null ||
      Date.parse(r.settledAt ?? '') < Date.parse(r.createdAt))) fail('reservation.settledAt');
  for (const window of [usage.day, usage.week]) {
    if (r.status === 'settled' && window.usedMicroUsd < (r.settledChargeUsdMicro ?? 0)) fail('usage.settled');
    if ((r.status === 'uncertain' || r.status === 'reserved') &&
        window.reservedMicroUsd < r.estimatedCostUpperBoundUsdMicro) fail('usage.reserved');
  }
  return r;
}

export function validateTopUp(
  value: unknown,
  expect: { identitySubject: string; weekWindowKey?: string; topUpId?: string },
): TopUpRecord {
  const t = value as TopUpRecord | null;
  if (!t || typeof t !== 'object') fail('topUp');
  const check = (ok: boolean, field: string) => {
    if (!ok) fail(`topUp.${field}`);
  };
  check(isKey(t.topUpId) && isKey(t.idempotencyKey) && isKey(t.adminSubject), 'ids');
  check(t.identitySubject === expect.identitySubject, 'identitySubject');
  check(isPositiveSafeInt(t.amountMicroUsd), 'amountMicroUsd');
  check(t.status === 'active' || t.status === 'revoked', 'status');
  check(typeof t.weekWindowKey === 'string' && WEEK_KEY.test(t.weekWindowKey), 'weekWindowKey');
  check(parseIsoUtc(t.expiresAt) !== null && parseIsoUtc(t.createdAt) !== null, 'timestamps');
  if (expect.weekWindowKey !== undefined) check(t.weekWindowKey === expect.weekWindowKey, 'weekWindowKey');
  if (expect.topUpId !== undefined) check(t.topUpId === expect.topUpId, 'topUpId');
  return t;
}
