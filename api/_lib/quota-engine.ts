// 功能 005 T021／T022：原子預留與結算（金額一律為整數 µUSD）。
// 引擎只負責驗證輸入、呼叫 shared store 的單一原子操作、驗證 store 回傳並整理 snapshot；
// 資格／等級／當週追加／額度判斷全部由 store 在同一原子操作內完成（見 shared-store.ts）。
// 日／週「額度不可用」分類由 quota-threshold.ts 依 snapshot 判定。
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { PROTECTED_ENDPOINTS, isCostModelEffective, type ProtectedEndpoint } from './cost-price-table';
import { CostRegistryError, estimateRegistryCost, registryDecision,
  type RegistryBundle, type RegistryDecision, type CostRegistry } from './cost-registry';
import { classifyAtomicAvailability } from './quota-threshold';
import {
  buildRequestFingerprint,
  canonicalContent,
  FingerprintConfigError,
  FingerprintInputError,
  validateFingerprintKey,
  type FingerprintKey,
  type RequestContent,
  type TrustedFingerprintCost,
} from './quota-fingerprint';
import type { EstimateInputs } from './quota-estimate-inputs';
import type { RequestEpochExecution } from './request-epoch-store';
import {
  InvalidQuotaDataError,
  addSafe,
  fail,
  isKey,
  isNonNegativeSafeInt,
  isPositiveSafeInt,
  remainingOf,
  validateLimits,
  validateReservation,
  validateNewReservationLease,
  validateReservationUsage,
  validateTierLimits,
  validateTopUp,
  validateUsage,
} from './quota-validation';
import { getQuotaWindows } from './quota-window';
import { EXECUTION_POLICY, STORE_POLICY } from './local-protection-policy';
import {
  withStoreTimeout,
  SharedStoreTimeoutError,
  type EffectiveLimits,
  type NotEligibleReason,
  type QuotaUsage,
  type ReservationRecord,
  type ReservationStatus,
  type SharedStore,
  type TierLimitTable,
  type TopUpRecord,
} from './shared-store';

export interface WindowSnapshot {
  windowKey: string;
  limitEstimatedUsdMicro: number;
  usedEstimatedUsdMicro: number;
  reservedEstimatedUsdMicro: number;
  remainingEstimatedUsdMicro: number;
  resetAt: string;
  /** 週窗口：base limit 與當週 active 追加加總（日窗口：base＝limit、追加＝0）。 */
  baseLimitEstimatedUsdMicro: number;
  cumulativeTopUpEstimatedUsdMicro: number;
}

export interface QuotaSnapshot {
  day: WindowSnapshot;
  week: WindowSnapshot;
}

export interface ReserveRequest {
  identitySubject: string;
  endpoint: ProtectedEndpoint;
  idempotencyKey: string;
  /** 完整語意輸入；僅供記憶體 HMAC 計算，不送入 store。 */
  content: RequestContent;
}

export type UnavailableReason =
  | 'STORE_UNAVAILABLE'
  | 'INVALID_STORE_DATA'
  | 'COST_MODEL_INVALID'
  | 'COST_MODEL_BLOCKED'
  | 'USAGE_OVERFLOW'
  | 'INVALID_CLOCK'
  | 'FINGERPRINT_CONFIG_INVALID'
  | 'TRUSTED_COST_INVALID'
  | 'COST_REGISTRY_UNAVAILABLE'
  | 'COST_MODEL_UNSUPPORTED'
  | 'COST_BOUND_UNPROVEN';

export interface Unavailable {
  ok: false;
  status: 503;
  code: 'PROTECTION_SERVICE_UNAVAILABLE';
  reason: UnavailableReason;
}

export interface InvalidInput {
  ok: false;
  status: 400;
  code: 'INVALID_QUOTA_INPUT';
  field: string;
}

export type ReserveOutcome =
  | { ok: false; status: 410; code: 'OPERATION_NO_LONGER_EXECUTABLE' }
  /** 唯一會帶 executionGrant 的結果：只有建立預留的那一次呼叫可以呼叫上游。 */
  | { ok: true; executionGrant: true; reservation: ReservationRecord; snapshot: QuotaSnapshot }
  | { ok: false; status: 429; reason: 'insufficient'; deniedWindow: 'day' | 'week' | 'both'; snapshot: QuotaSnapshot;
      denialClass?: 'exhausted' | 'below_floor' | 'request_insufficient'; registryDecision?: RegistryDecision }
  | { ok: false; status: 403; code: 'ACCESS_NOT_APPROVED'; reason: NotEligibleReason }
  | { ok: false; status: 409; code: 'IDEMPOTENCY_CONFLICT' }
  /** 同一冪等鍵、同一內容的重複：任何狀態都不得再次呼叫上游。 */
  | { ok: false; status: 409; code: 'DUPLICATE_REQUEST'; executionGrant: false; reservationId: string; reservationStatus: ReservationStatus }
  | InvalidInput
  | Unavailable;

export type SettleOutcomeInput =
  | {
      kind: 'success';
      /** 依 usage／固定 SKU 的結算估算；缺漏或無效時保守按預留結算。 */
      settlementEstimateMicroUsd?: number;
      attempts: number;
      standardTier: boolean;
      /** 結算估算所用價表版本；與預留不同時保守按預留（或較高的估算）結算。 */
      costModelVersion: string;
    }
  | { kind: 'explicit_unbilled_failure' }
  | { kind: 'uncertain' };

export interface CostOverrun {
  reservedMicroUsd: number;
  chargedMicroUsd: number;
  excessMicroUsd: number;
  /** 此成本模型版本已被 store 封鎖；需發布新版本價表（重新確認）才能再放行。 */
  blockedCostModelVersion: string;
}

export type SettleOutcomeResult =
  | { settlementStatus: 'accounted'; alreadyApplied: boolean; reservation: ReservationRecord; usage: QuotaUsage }
  | { settlementStatus: 'accounted_cost_bound_exceeded'; ok: false; status: 503; code: 'PROTECTION_SERVICE_UNAVAILABLE'; reason: 'COST_BOUND_EXCEEDED'; alreadyApplied: boolean; reservation: ReservationRecord; usage: QuotaUsage; costOverrun: CostOverrun }
  | { ok: false; status: 404; code: 'RESERVATION_NOT_FOUND' }
  | { ok: false; status: 409; code: 'INVALID_SETTLEMENT_TRANSITION'; reservation: ReservationRecord }
  | { ok: false; status: 409; code: 'SETTLEMENT_CONFLICT'; reservation: ReservationRecord }
  | { ok: false; status: 409; code: 'RESERVATION_LEASE_EXPIRED'; reservation: ReservationRecord }
  | InvalidInput
  | Unavailable;

export type TopUpOutcome =
  | { ok: true; duplicate: boolean; topUp: TopUpRecord; cumulativeTopUpMicroUsd: number }
  | { ok: false; status: 409; code: 'IDEMPOTENCY_CONFLICT' | 'TOP_UP_WINDOW_EXPIRED' }
  | InvalidInput
  | Unavailable;

export type RevokeTopUpOutcome =
  | { ok: true; alreadyApplied: boolean; topUp: TopUpRecord; cumulativeTopUpMicroUsd: number }
  | { ok: false; status: 404; code: 'TOP_UP_NOT_FOUND' }
  | InvalidInput
  | Unavailable;

export type SnapshotOutcome =
  | { ok: true; snapshot: QuotaSnapshot; tier: EffectiveLimits['tier'] }
  | { ok: false; status: 403; code: 'ACCESS_NOT_APPROVED'; reason: NotEligibleReason }
  | Unavailable;

export type AtomicSnapshotOutcome =
  | { ok: true; snapshot: QuotaSnapshot; tier: EffectiveLimits['tier']; registryDecision: RegistryDecision }
  | { ok: false; status: 429; window: 'day' | 'week'; denialClass: 'exhausted' | 'below_floor' }
  | Exclude<SnapshotOutcome, { ok: true }>;

export interface QuotaEngineOptions {
  store: SharedStore;
  costRegistry?: CostRegistry;
  /** 只能由伺服器依賴注入，無預設金鑰、環境讀取或普通雜湊 fallback。 */
  fingerprintKey?: FingerprintKey;
  fingerprintKeys?: readonly (FingerprintKey & { state: 'current' | 'verify_only' | 'revoked' })[];
  /** 營運設定的等級額度；使用者請求不得影響。 */
  tierLimits: TierLimitTable;
  now?: () => Date;
  newId?: () => string;
  storeTimeoutMs?: number;
  /** 預留 lease；必須大於單次上游逾時＋緩衝。到期只會限制結算（轉 uncertain），不會重新放行。 */
  leaseMs?: number;
}

const DEFAULT_STORE_TIMEOUT_MS = STORE_POLICY.timeoutMs;

const invalidInput = (field: string): InvalidInput => ({ ok: false, status: 400, code: 'INVALID_QUOTA_INPUT', field });
const unavailable = (reason: UnavailableReason): Unavailable => ({ ok: false, status: 503, code: 'PROTECTION_SERVICE_UNAVAILABLE', reason });
const classifyError = (error: unknown): Unavailable =>
  unavailable(error instanceof InvalidQuotaDataError ? 'INVALID_STORE_DATA' : 'STORE_UNAVAILABLE');

function validateRegistryEvidence(
  evidence: RegistryDecision | undefined, bundle: RegistryBundle, commandTime: Date, grantTime: Date | null,
): Date {
  if (!evidence || !grantTime) fail('registry.evidence');
  const decisionTime = new Date(evidence.decisionAt);
  if (!Number.isFinite(decisionTime.getTime()) || decisionTime.getTime() < commandTime.getTime() ||
      decisionTime.getTime() > grantTime.getTime() ||
      !isDeepStrictEqual(getQuotaWindows(decisionTime), getQuotaWindows(commandTime)))
    fail('registry.clock');
  const expected = registryDecision(bundle, decisionTime, { versions: new Set(), parameters: new Set() });
  if (!isDeepStrictEqual(evidence, expected)) fail('registry.binding');
  return decisionTime;
}

export function remainingMicroUsd(w: {
  limitEstimatedUsdMicro: number;
  usedEstimatedUsdMicro: number;
  reservedEstimatedUsdMicro: number;
}): number {
  return remainingOf(w.limitEstimatedUsdMicro, w.usedEstimatedUsdMicro, w.reservedEstimatedUsdMicro);
}

export interface SnapshotWindowSpec {
  windowKey: string;
  limitMicroUsd: number;
  resetAt: string;
  baseLimitMicroUsd?: number;
  topUpMicroUsd?: number;
}

/** 無效的 usage／limit（負值、小數、NaN、字串、加總超出安全整數）一律丟 InvalidQuotaDataError。 */
export function buildSnapshot(usage: QuotaUsage, day: SnapshotWindowSpec, week: SnapshotWindowSpec): QuotaSnapshot {
  validateUsage(usage);
  const build = (spec: SnapshotWindowSpec, u: QuotaUsage['day'], field: string): WindowSnapshot => {
    if (!isKey(spec.windowKey) || typeof spec.resetAt !== 'string') fail(`${field}.window`);
    if (!isNonNegativeSafeInt(spec.limitMicroUsd)) fail(`${field}.limit`);
    const topUp = spec.topUpMicroUsd ?? 0;
    const base = spec.baseLimitMicroUsd ?? spec.limitMicroUsd - topUp;
    if (!isNonNegativeSafeInt(topUp) || !isNonNegativeSafeInt(base) || addSafe(base, topUp) !== spec.limitMicroUsd) fail(`${field}.limit`);
    return {
      windowKey: spec.windowKey,
      limitEstimatedUsdMicro: spec.limitMicroUsd,
      usedEstimatedUsdMicro: u.usedMicroUsd,
      reservedEstimatedUsdMicro: u.reservedMicroUsd,
      remainingEstimatedUsdMicro: remainingOf(spec.limitMicroUsd, u.usedMicroUsd, u.reservedMicroUsd),
      resetAt: spec.resetAt,
      baseLimitEstimatedUsdMicro: base,
      cumulativeTopUpEstimatedUsdMicro: topUp,
    };
  };
  return { day: build(day, usage.day, 'day'), week: build(week, usage.week, 'week') };
}

export function createQuotaEngine(options: QuotaEngineOptions) {
  const { store } = options;
  const tierLimits = validateTierLimits(options.tierLimits);
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? (() => randomUUID());
  const timeoutMs = options.storeTimeoutMs ?? DEFAULT_STORE_TIMEOUT_MS;
  if (options.leaseMs !== undefined && !isPositiveSafeInt(options.leaseMs))
    throw new RangeError('leaseMs 必須為正整數');

  // 任何 store 失敗或逾時都視為結果未知：fail closed，不自動恢復或釋放額度。
  const call = <T>(operation: () => Promise<T>) => withStoreTimeout(operation(), timeoutMs);

  function clock(): Date | null {
    const current = now();
    return current instanceof Date && Number.isFinite(current.getTime()) ? new Date(current.getTime()) : null;
  }

  const snapshotFrom = (
    usage: QuotaUsage,
    limits: EffectiveLimits,
    windows: ReturnType<typeof getQuotaWindows>,
  ): QuotaSnapshot =>
    buildSnapshot(
      usage,
      { windowKey: windows.day.windowKey, limitMicroUsd: limits.dayLimitMicroUsd, resetAt: windows.day.resetAt },
      {
        windowKey: windows.week.windowKey,
        limitMicroUsd: limits.weekLimitMicroUsd,
        resetAt: windows.week.resetAt,
        baseLimitMicroUsd: limits.weekBaseLimitMicroUsd,
        topUpMicroUsd: limits.weekTopUpMicroUsd,
      },
    );

  async function reserve(userRequest: ReserveRequest, inputs: EstimateInputs = {}, requestEpoch?: RequestEpochExecution): Promise<ReserveOutcome> {
    if (!userRequest || typeof userRequest !== 'object') return invalidInput('request');
    if (Reflect.ownKeys(userRequest).some((key) =>
      typeof key !== 'string' || !['identitySubject', 'endpoint', 'idempotencyKey', 'content'].includes(key))) {
      return invalidInput('request.fields');
    }
    if (!isKey(userRequest.identitySubject)) return invalidInput('identitySubject');
    if (!isKey(userRequest.idempotencyKey)) return invalidInput('idempotencyKey');
    if (!(PROTECTED_ENDPOINTS as readonly string[]).includes(userRequest.endpoint)) return invalidInput('endpoint');
    const leaseMs = options.leaseMs ?? EXECUTION_POLICY[userRequest.endpoint]?.leaseMs;
    if (!leaseMs) return unavailable('COST_BOUND_UNPROVEN');
    const estimationTime = clock();
    if (!estimationTime) return unavailable('INVALID_CLOCK');
    let cost: (TrustedFingerprintCost & { costParametersDigest: string }) | undefined;
    let bundle: RegistryBundle | undefined;
    let key: FingerprintKey;
    let prior: ReservationRecord | null = null;
    try {
      if (requestEpoch) {
        if (!store.getEpochBinding || requestEpoch.payload.endpoint !== userRequest.endpoint ||
            requestEpoch.payload.operationHandle !== userRequest.idempotencyKey) return unavailable('INVALID_STORE_DATA');
        prior = await call(() => store.getEpochBinding!(userRequest.identitySubject, requestEpoch.accountingIndex));
      }
      if (prior) {
        validateReservation(prior, { identitySubject: userRequest.identitySubject, idempotencyKey: userRequest.idempotencyKey });
        const matches = options.fingerprintKeys?.filter((candidate) =>
          candidate.version === prior!.fingerprintKeyVersion && candidate.state !== 'revoked') ?? [];
        if (matches.length !== 1 || !prior.comparisonCost) return unavailable('FINGERPRINT_CONFIG_INVALID');
        key = validateFingerprintKey(matches[0]);
        cost = structuredClone(prior.comparisonCost);
      } else {
        const currentKeys = options.fingerprintKeys?.filter((candidate) => candidate.state === 'current');
        if (currentKeys && currentKeys.length !== 1) return unavailable('FINGERPRINT_CONFIG_INVALID');
        key = validateFingerprintKey(currentKeys?.[0] ?? options.fingerprintKey);
      }
      if (!prior && options.costRegistry?.snapshot) {
        try {
          bundle = structuredClone(await call(() => options.costRegistry!.snapshot!()));
        } catch (error) {
          if (!(error instanceof Error)) throw error;
          return unavailable('COST_REGISTRY_UNAVAILABLE');
        }
        registryDecision(bundle, estimationTime, { versions: new Set(), parameters: new Set() });
      }
      if (!prior) cost = await withStoreTimeout(
        estimateRegistryCost(bundle ? {
          resolve: async (endpoint) => bundle!.entries.find((entry) => entry.endpoint === endpoint) ?? null,
        } : options.costRegistry, userRequest.endpoint, inputs, estimationTime),
        timeoutMs,
      );
    } catch (error) {
      if (error instanceof FingerprintConfigError) return unavailable('FINGERPRINT_CONFIG_INVALID');
      if (error instanceof CostRegistryError) return unavailable(error.reason);
      if (error instanceof FingerprintInputError) return unavailable('TRUSTED_COST_INVALID');
      if (error instanceof SharedStoreTimeoutError) return unavailable('COST_REGISTRY_UNAVAILABLE');
      if (requestEpoch && error instanceof Error) return classifyError(error);
      throw error;
    }
    if (!cost) return unavailable('TRUSTED_COST_INVALID');
    try {
      canonicalContent(userRequest.content);
    } catch (error) {
      if (error instanceof FingerprintInputError) return invalidInput('content');
      throw error;
    }
    const request = { ...userRequest, amountMicroUsd: cost.amountMicroUsd, costModel: cost.costModel };
    const model = request.costModel;
    const estimateInputs = cost.estimateInputs;
    const current = clock();
    if (!current || current.getTime() < estimationTime.getTime()) return unavailable('INVALID_CLOCK');
    if (!prior && !isCostModelEffective(model, current.getTime())) return unavailable('COST_MODEL_INVALID');

    const windows = getQuotaWindows(current);
    const reservationId = newId();
    const requestFingerprint = buildRequestFingerprint({
      identitySubject: request.identitySubject,
      endpoint: request.endpoint,
      content: request.content,
      trustedCost: cost,
    }, key);

    try {
      const result = await call(() =>
        store.reserve({
          identitySubject: request.identitySubject,
          idempotencyKey: request.idempotencyKey,
          reservationId,
          endpoint: request.endpoint,
          amountMicroUsd: request.amountMicroUsd,
          costModel: { version: model.version, effectiveFrom: model.effectiveFrom, expiresAt: model.expiresAt },
          costParametersDigest: cost.costParametersDigest,
          requestFingerprint,
          fingerprintKeyVersion: key.version,
          estimateInputs,
          day: { windowKey: windows.day.windowKey, resetAt: windows.day.resetAt },
          week: { windowKey: windows.week.windowKey, resetAt: windows.week.resetAt },
          tierLimits,
          leaseMs,
          nowIso: current.toISOString(),
          ...(bundle ? { expectedRegistry: bundle } : {}),
          ...(requestEpoch ? { requestEpoch, comparisonCost: cost } : {}),
        }),
      );

      const base = { identitySubject: request.identitySubject, endpoint: request.endpoint };
      if (requestEpoch && (result.status === 'reserved' || result.status === 'duplicate' || result.status === 'idempotency_conflict') &&
          !isDeepStrictEqual(result.reservation.requestEpoch, requestEpoch)) fail('reservation.requestEpoch');
      switch (result?.status) {
        case 'epoch_rejected': return { ok: false, status: 410, code: 'OPERATION_NO_LONGER_EXECUTABLE' };
        case 'reserved': {
          const reservation = validateReservation(result.reservation, {
            ...base,
            reservationId,
            idempotencyKey: request.idempotencyKey,
            amountMicroUsd: request.amountMicroUsd,
            costModelVersion: model.version,
            costParametersDigest: cost.costParametersDigest,
            requestFingerprint,
            dayWindowKey: windows.day.windowKey,
            weekWindowKey: windows.week.windowKey,
            statuses: ['reserved'],
          });
          if (reservation.fingerprintKeyVersion !== key.version ||
              reservation.costModelEffectiveFrom !== model.effectiveFrom || reservation.costModelExpiresAt !== model.expiresAt ||
              canonicalContent(reservation.estimateInputs) !== canonicalContent(estimateInputs)) fail('reservation.fingerprintInputs');
          if (result.executionGrant !== true) fail('executionGrant');
          let decisionTime = current;
          if (bundle) {
            decisionTime = validateRegistryEvidence(result.registryDecision, bundle, current, clock());
            if (!isDeepStrictEqual(reservation.registryDecision, result.registryDecision))
              fail('reservation.registryDecision');
          }
          validateNewReservationLease(reservation, decisionTime, leaseMs);
          const usage = validateUsage(result.usage);
          const limits = validateLimits(result.limits, tierLimits);
          // 成功預留後 used + reserved 不得超過上限，且 reserved 至少含本筆。
          const amount = request.amountMicroUsd;
          if (usage.day.reservedMicroUsd < amount || usage.week.reservedMicroUsd < amount) fail('usage.reserved');
          const snapshot = snapshotFrom(usage, limits, windows);
          if (snapshot.day.remainingEstimatedUsdMicro < 0 || snapshot.week.remainingEstimatedUsdMicro < 0) fail('usage.overLimit');
          if (bundle && result.registryDecision &&
              (snapshot.day.remainingEstimatedUsdMicro + amount < result.registryDecision.floorMicroUsd ||
               snapshot.week.remainingEstimatedUsdMicro + amount < result.registryDecision.floorMicroUsd)) fail('usage.floor');
          const grantTime = clock();
          if (!grantTime) return unavailable('INVALID_CLOCK');
          if (grantTime.getTime() < current.getTime() ||
              grantTime.getTime() >= Date.parse(reservation.leaseExpiresAt)) fail('reservation.executionLease');
          return { ok: true, executionGrant: true, reservation, snapshot };
        }
        case 'duplicate': {
          if (result.executionGrant !== false) fail('executionGrant');
          const reservation = validateReservation(result.reservation, {
            ...base,
            idempotencyKey: request.idempotencyKey,
            amountMicroUsd: request.amountMicroUsd,
            costModelVersion: model.version,
            costParametersDigest: cost.costParametersDigest,
            requestFingerprint,
          });
          if (reservation.fingerprintKeyVersion !== key.version ||
              reservation.costModelEffectiveFrom !== model.effectiveFrom || reservation.costModelExpiresAt !== model.expiresAt ||
              canonicalContent(reservation.estimateInputs) !== canonicalContent(estimateInputs)) fail('reservation.fingerprintInputs');
          return {
            ok: false,
            status: 409,
            code: 'DUPLICATE_REQUEST',
            executionGrant: false,
            reservationId: reservation.reservationId,
            reservationStatus: reservation.status,
          };
        }
        case 'idempotency_conflict': {
          const reservation = validateReservation(result.reservation, { identitySubject: request.identitySubject, idempotencyKey: request.idempotencyKey });
          if (reservation.requestFingerprint === requestFingerprint) fail('reservation.requestFingerprint');
          return { ok: false, status: 409, code: 'IDEMPOTENCY_CONFLICT' };
        }
        case 'denied': {
          const usage = validateUsage(result.usage);
          const limits = validateLimits(result.limits, tierLimits);
          const snapshot = snapshotFrom(usage, limits, windows);
          if (bundle) {
            validateRegistryEvidence(result.registryDecision, bundle, current, clock());
            const classification = classifyAtomicAvailability(snapshot, result.registryDecision!.floorMicroUsd, request.amountMicroUsd);
            if (classification.state === 'available' || classification.state !== result.denialClass ||
                classification.window !== result.deniedWindow) fail('denied.classification');
            return { ok: false, status: 429, reason: 'insufficient', deniedWindow: classification.window,
              snapshot, denialClass: classification.state, registryDecision: result.registryDecision };
          }
          const dayShort = request.amountMicroUsd > snapshot.day.remainingEstimatedUsdMicro;
          const weekShort = request.amountMicroUsd > snapshot.week.remainingEstimatedUsdMicro;
          const expected = dayShort && weekShort ? 'both' : dayShort ? 'day' : weekShort ? 'week' : null;
          if (expected === null || expected !== result.deniedWindow) fail('deniedWindow');
          return { ok: false, status: 429, reason: 'insufficient', deniedWindow: expected, snapshot };
        }
        case 'not_eligible':
          return { ok: false, status: 403, code: 'ACCESS_NOT_APPROVED', reason: result.reason };
        case 'cost_model_blocked':
          if (result.costModelVersion !== model.version) fail('costModelVersion');
          return unavailable('COST_MODEL_BLOCKED');
        case 'cost_model_invalid':
          return unavailable('COST_MODEL_INVALID');
        default:
          return fail('reserve.status');
      }
    } catch (error) {
      return classifyError(error);
    }
  }

  async function settle(input: { identitySubject: string; reservationId: string; outcome: SettleOutcomeInput }): Promise<SettleOutcomeResult> {
    if (!isKey(input.identitySubject)) return invalidInput('identitySubject');
    if (!isKey(input.reservationId)) return invalidInput('reservationId');
    const { outcome } = input;
    if (!outcome || typeof outcome !== 'object') return invalidInput('outcome');
    if (outcome.kind === 'success' && (!isPositiveSafeInt(outcome.attempts) || typeof outcome.standardTier !== 'boolean' || !isKey(outcome.costModelVersion))) {
      return invalidInput('outcome');
    }
    if (outcome.kind !== 'success' && outcome.kind !== 'explicit_unbilled_failure' && outcome.kind !== 'uncertain') return invalidInput('outcome');

    const current = clock();
    if (!current) return unavailable('INVALID_CLOCK');

    try {
      const found = await call(() => store.getReservation(input.identitySubject, input.reservationId));
      if (found === null) return { ok: false, status: 404, code: 'RESERVATION_NOT_FOUND' };
      const reservation = validateReservation(found, { identitySubject: input.identitySubject, reservationId: input.reservationId });

      const reserved = reservation.estimatedCostUpperBoundUsdMicro;
      let transition: 'settled' | 'released' | 'uncertain';
      let chargeMicroUsd = 0;
      let reason: string;
      let settlementCostModelVersion: string;

      if (outcome.kind === 'success') {
        transition = 'settled';
        settlementCostModelVersion = outcome.costModelVersion;
        const estimate = outcome.settlementEstimateMicroUsd;
        const estimateValid = isNonNegativeSafeInt(estimate);
        const sameModel = outcome.costModelVersion === reservation.costModelVersion;
        // 僅同版本成本模型、attempts==1 且標準層級才可低於預留；
        // 其餘維持預留（估算更高時以估算為準，不截斷）。
        const safeToRelease = outcome.attempts === 1 && outcome.standardTier && estimateValid && sameModel;
        chargeMicroUsd = safeToRelease ? (estimate as number) : Math.max(estimateValid ? (estimate as number) : 0, reserved);
        reason = sameModel ? 'success' : 'success_cost_model_mismatch';
      } else if (outcome.kind === 'explicit_unbilled_failure') {
        transition = 'released';
        settlementCostModelVersion = reservation.costModelVersion;
        reason = 'explicit_unbilled_failure';
      } else {
        transition = 'uncertain';
        settlementCostModelVersion = reservation.costModelVersion;
        reason = 'timeout_uncertain';
      }

      const result = await call(() =>
        store.settle({
          identitySubject: input.identitySubject,
          reservationId: input.reservationId,
          transition,
          chargeMicroUsd,
          costModelVersion: settlementCostModelVersion,
          reason,
          nowIso: current.toISOString(),
        }),
      );

      const expectation = { identitySubject: input.identitySubject, reservationId: input.reservationId, amountMicroUsd: reserved, costModelVersion: reservation.costModelVersion, costParametersDigest: reservation.costParametersDigest };
      switch (result?.status) {
        case 'applied':
        case 'already_applied': {
          const settled = validateReservationUsage(result, { ...expectation, statuses: [transition] }, reservation);
          const usage = result.usage;
          if (result.status === 'applied' && reservation.status !== 'reserved') fail('settlement.transition');
          if (result.status === 'applied' && settled.settledAt !== current.toISOString()) fail('settlement.time');
          if (
            settled.settledChargeUsdMicro !== chargeMicroUsd ||
            settled.settlementReason !== reason ||
            settled.settlementCostModelVersion !== settlementCostModelVersion
          ) fail('settlement.semantics');
          const excess = settled.overrunMicroUsd;
          const expectedBlockedVersion = excess === undefined ? undefined : settled.costModelVersion;
          if (result.blockedCostModelVersion !== expectedBlockedVersion) fail('settlement.blockedCostModelVersion');
          if (result.blockedCostParametersDigest !== (excess === undefined ? undefined : settled.costParametersDigest)) {
            fail('settlement.blockedCostParametersDigest');
          }
          const accounted = {
            alreadyApplied: result.status === 'already_applied',
            reservation: settled,
            usage,
          };
          if (excess !== undefined) return {
            ...accounted,
            settlementStatus: 'accounted_cost_bound_exceeded',
            ok: false, status: 503, code: 'PROTECTION_SERVICE_UNAVAILABLE', reason: 'COST_BOUND_EXCEEDED',
            costOverrun: {
              reservedMicroUsd: reserved, chargedMicroUsd: chargeMicroUsd,
              excessMicroUsd: excess, blockedCostModelVersion: settled.costModelVersion,
            },
          };
          return { ...accounted, settlementStatus: 'accounted' };
        }
        case 'not_found':
          return { ok: false, status: 404, code: 'RESERVATION_NOT_FOUND' };
        case 'invalid_transition': {
          const terminal = validateReservationUsage(result, { ...expectation, statuses: ['settled', 'released', 'uncertain'] }, reservation);
          if (terminal.status === transition ||
              (reservation.status !== 'reserved' && terminal.status !== reservation.status)) fail('settlement.transition');
          return { ok: false, status: 409, code: 'INVALID_SETTLEMENT_TRANSITION', reservation: terminal };
        }
        case 'settlement_conflict': {
          const terminal = validateReservationUsage(result, { ...expectation, statuses: [transition] }, reservation);
          if (terminal.settledChargeUsdMicro === chargeMicroUsd && terminal.settlementReason === reason &&
              terminal.settlementCostModelVersion === settlementCostModelVersion) fail('settlement.conflict');
          return { ok: false, status: 409, code: 'SETTLEMENT_CONFLICT', reservation: terminal };
        }
        case 'lease_expired': {
          const expired = validateReservationUsage(result, { ...expectation, statuses: ['uncertain'] }, reservation);
          if (transition === 'uncertain' || current.getTime() <= Date.parse(expired.leaseExpiresAt) ||
              expired.settlementReason !== 'lease_expired' || expired.settledChargeUsdMicro !== 0) fail('settlement.lease');
          return { ok: false, status: 409, code: 'RESERVATION_LEASE_EXPIRED', reservation: expired };
        }
        case 'overflow':
          return unavailable('USAGE_OVERFLOW');
        default:
          return fail('settle.status');
      }
    } catch (error) {
      return classifyError(error);
    }
  }

  async function getSnapshot(input: { identitySubject: string }): Promise<SnapshotOutcome | InvalidInput> {
    if (!isKey(input.identitySubject)) return invalidInput('identitySubject');
    const current = clock();
    if (!current) return unavailable('INVALID_CLOCK');
    const windows = getQuotaWindows(current);
    try {
      const result = await call(() =>
        store.readQuota(input.identitySubject, windows.day, windows.week, tierLimits, current.toISOString()),
      );
      if (result?.status === 'not_eligible') return { ok: false, status: 403, code: 'ACCESS_NOT_APPROVED', reason: result.reason };
      if (result?.status !== 'ok') fail('readQuota.status');
      const usage = validateUsage(result.usage);
      const limits = validateLimits(result.limits, tierLimits);
      return { ok: true, snapshot: snapshotFrom(usage, limits, windows), tier: limits.tier };
    } catch (error) {
      return classifyError(error);
    }
  }

  async function addWeeklyTopUp(input: {
    identitySubject: string;
    adminSubject: string;
    idempotencyKey: string;
    amountMicroUsd: number;
    reasonCode: string;
  }): Promise<TopUpOutcome> {
    if (!isKey(input.identitySubject)) return invalidInput('identitySubject');
    if (!isKey(input.adminSubject)) return invalidInput('adminSubject');
    if (!isKey(input.idempotencyKey)) return invalidInput('idempotencyKey');
    if (!isPositiveSafeInt(input.amountMicroUsd)) return invalidInput('amountMicroUsd');
    if (typeof input.reasonCode !== 'string' || !/^[A-Za-z0-9_]{1,64}$/.test(input.reasonCode)) return invalidInput('reasonCode');
    const current = clock();
    if (!current) return unavailable('INVALID_CLOCK');
    const week = getQuotaWindows(current).week;
    const topUpId = newId();
    try {
      const result = await call(() =>
        store.addTopUp({
          identitySubject: input.identitySubject,
          topUpId,
          idempotencyKey: input.idempotencyKey,
          week: { windowKey: week.windowKey, resetAt: week.resetAt },
          amountMicroUsd: input.amountMicroUsd,
          adminSubject: input.adminSubject,
          reasonCode: input.reasonCode,
          nowIso: current.toISOString(),
        }),
      );
      switch (result?.status) {
        case 'applied':
        case 'duplicate': {
          const topUp = validateTopUp(result.topUp, { identitySubject: input.identitySubject, weekWindowKey: week.windowKey });
          if (topUp.amountMicroUsd !== input.amountMicroUsd) fail('topUp.amountMicroUsd');
          if (!isNonNegativeSafeInt(result.cumulativeTopUpMicroUsd) || (topUp.status === 'active' && result.cumulativeTopUpMicroUsd < topUp.amountMicroUsd)) fail('cumulativeTopUpMicroUsd');
          if (result.status === 'applied' && topUp.topUpId !== topUpId) fail('topUp.topUpId');
          return { ok: true, duplicate: result.status === 'duplicate', topUp, cumulativeTopUpMicroUsd: result.cumulativeTopUpMicroUsd };
        }
        case 'idempotency_conflict':
          validateTopUp(result.topUp, { identitySubject: input.identitySubject });
          return { ok: false, status: 409, code: 'IDEMPOTENCY_CONFLICT' };
        case 'window_expired':
          return { ok: false, status: 409, code: 'TOP_UP_WINDOW_EXPIRED' };
        case 'overflow':
          return unavailable('USAGE_OVERFLOW');
        default:
          return fail('addTopUp.status');
      }
    } catch (error) {
      return classifyError(error);
    }
  }

  async function revokeWeeklyTopUp(input: { identitySubject: string; adminSubject: string; topUpId: string }): Promise<RevokeTopUpOutcome> {
    if (!isKey(input.identitySubject)) return invalidInput('identitySubject');
    if (!isKey(input.adminSubject)) return invalidInput('adminSubject');
    if (!isKey(input.topUpId)) return invalidInput('topUpId');
    const current = clock();
    if (!current) return unavailable('INVALID_CLOCK');
    try {
      const result = await call(() =>
        store.revokeTopUp({ identitySubject: input.identitySubject, topUpId: input.topUpId, adminSubject: input.adminSubject, nowIso: current.toISOString() }),
      );
      switch (result?.status) {
        case 'applied':
        case 'already_applied': {
          const topUp = validateTopUp(result.topUp, { identitySubject: input.identitySubject, topUpId: input.topUpId });
          if (topUp.status !== 'revoked' || !isNonNegativeSafeInt(result.cumulativeTopUpMicroUsd)) fail('topUp.status');
          return { ok: true, alreadyApplied: result.status === 'already_applied', topUp, cumulativeTopUpMicroUsd: result.cumulativeTopUpMicroUsd };
        }
        case 'not_found':
          return { ok: false, status: 404, code: 'TOP_UP_NOT_FOUND' };
        default:
          return fail('revokeTopUp.status');
      }
    } catch (error) {
      return classifyError(error);
    }
  }

  /** 把逾 lease 的 reserved 轉為 uncertain（保留預留、不退款、不重放）。 */
  async function sweepExpiredLeases(input: { identitySubject: string }): Promise<{ ok: true; expired: number } | InvalidInput | Unavailable> {
    if (!isKey(input.identitySubject)) return invalidInput('identitySubject');
    const current = clock();
    if (!current) return unavailable('INVALID_CLOCK');
    try {
      const result = await call(() => store.expireLeases(input.identitySubject, current.toISOString()));
      if (!result || !isNonNegativeSafeInt(result.expired)) fail('expired');
      if (!Array.isArray(result.entries) || result.entries.length !== result.expired) fail('expired.entries');
      const seen = new Set<string>();
      const totals = new Map<string, number>();
      for (const entry of result.entries) {
        const r = validateReservationUsage(entry, { identitySubject: input.identitySubject, statuses: ['uncertain'] });
        const windows = getQuotaWindows(new Date(r.createdAt));
        if (r.dayWindowKey !== windows.day.windowKey || r.weekWindowKey !== windows.week.windowKey ||
            current.getTime() <= Date.parse(r.leaseExpiresAt) ||
            r.settledAt !== current.toISOString() || r.settlementReason !== 'lease_expired' ||
            r.settledChargeUsdMicro !== 0 || r.settlementCostModelVersion !== r.costModelVersion ||
            seen.has(r.reservationId)) fail('expired.reservation');
        seen.add(r.reservationId);
        for (const window of ['day', 'week'] as const) {
          const key = `${window}|${window === 'day' ? r.dayWindowKey : r.weekWindowKey}`;
          totals.set(key, addSafe(totals.get(key) ?? 0, r.estimatedCostUpperBoundUsdMicro));
        }
      }
      for (const entry of result.entries) {
        for (const window of ['day', 'week'] as const) {
          const key = `${window}|${window === 'day' ? entry.dayWindowKey : entry.weekWindowKey}`;
          if (entry.usage[window].reservedMicroUsd < (totals.get(key) ?? 0)) fail('expired.usage');
        }
      }
      return { ok: true, expired: result.expired };
    } catch (error) {
      return classifyError(error);
    }
  }

  async function getAtomicSnapshot(identitySubject: string): Promise<AtomicSnapshotOutcome> {
    if (!isKey(identitySubject) || !options.costRegistry?.snapshot || !store.readAtomicQuota)
      return unavailable('COST_REGISTRY_UNAVAILABLE');
    const current = clock();
    if (!current) return unavailable('INVALID_CLOCK');
    try {
      const bundle = structuredClone(await call(() => options.costRegistry!.snapshot!()));
      const windows = getQuotaWindows(current);
      const result = await call(() => store.readAtomicQuota!({
        identitySubject, expectedRegistry: bundle, day: windows.day, week: windows.week, tierLimits,
        nowIso: current.toISOString(),
      }));
      if (result.status === 'not_eligible')
        return { ok: false, status: 403, code: 'ACCESS_NOT_APPROVED', reason: result.reason };
      if (result.status === 'cost_model_invalid') return unavailable('COST_MODEL_INVALID');
      validateRegistryEvidence(result.registryDecision, bundle, current, clock());
      const snapshot = snapshotFrom(validateUsage(result.usage), validateLimits(result.limits, tierLimits), windows);
      const classification = classifyAtomicAvailability(snapshot, result.registryDecision.floorMicroUsd);
      if (result.status === 'available' && classification.state === 'available')
        return { ok: true, snapshot, tier: result.limits.tier, registryDecision: result.registryDecision };
      if (result.status !== 'denied' || classification.state === 'available' ||
          classification.state === 'request_insufficient' || classification.state !== result.denialClass ||
          classification.window !== result.deniedWindow) fail('map.classification');
      return { ok: false, status: 429, denialClass: classification.state, window: classification.window };
    } catch (error) {
      return classifyError(error);
    }
  }

  return { reserve, settle, getSnapshot, getAtomicSnapshot, addWeeklyTopUp, revokeWeeklyTopUp, sweepExpiredLeases };
}

export function createAtomicQuotaEngine(options: QuotaEngineOptions & {
  costRegistry: CostRegistry & { snapshot(): Promise<RegistryBundle> };
}) {
  if (typeof options.costRegistry?.snapshot !== 'function')
    throw new TypeError('原子引擎需要完整權威 registry snapshot');
  return createQuotaEngine(options);
}

export type QuotaEngine = ReturnType<typeof createQuotaEngine>;
