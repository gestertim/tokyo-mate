// 功能 005 T019：shared store 契約（Upstash Redis-compatible，真實 resource／credential 尚未核准）。
// 本檔只定義型別、錯誤與 timeout 輔助；不含任何記憶體實作。記憶體 mock 僅位於測試支援目錄，
// production 不得 fallback 到 Map（serverless 併發下不可靠）。
//
// 契約重點（審查修補 R1）：
// 1. 資格（status／tier／到期）、當週有效追加與預留判斷必須在「同一個」provider 原子操作內完成；
//    呼叫端不得先讀取追加上限再以舊值預留。reserve／addTopUp／revokeTopUp 由 provider 線性化，
//    預留之後才發生的撤銷不追溯作廢該預留；撤銷之後的新預留一律看到較低的週上限。
// 2. 首次取得上游執行權（executionGrant）只存在於「建立預留」的那一次原子操作；
//    duplicate 在任何狀態（reserved／settled／released／uncertain）都不得再放行，
//    且執行權不會因 lease 到期而自動恢復。
// 3. 同一冪等鍵搭配不同請求指紋為 conflict，並記錄於預留（僅記錄指紋，不記錄內容）。
import type { CostModelRef, ProtectedEndpoint } from './cost-price-table';
import type { EstimateInputs } from './quota-estimate-inputs';
import type { RegistryBundle, RegistryDecision } from './cost-registry';
import type { RequestEpochExecution } from './request-epoch-store';
import type { TrustedFingerprintCost } from './quota-fingerprint';

export type AccessTier = 'tier1' | 'tier2';
export type EligibilityStatus = 'pending' | 'approved' | 'rejected' | 'revoked' | 'expired';

export interface EligibilityRecord {
  identitySubject: string;
  status: EligibilityStatus;
  tier: AccessTier;
  /** 資格到期時間（UTC ISO）；null 表示無到期。 */
  expiresAt: string | null;
  updatedAt: string;
}

export interface TierLimits {
  dayLimitMicroUsd: number;
  weekBaseLimitMicroUsd: number;
}

/** 營運設定（非使用者輸入）；store 依「當下」資格 tier 在原子操作內選用。 */
export type TierLimitTable = Record<AccessTier, TierLimits>;

export interface WindowSpec {
  windowKey: string;
  resetAt: string;
}

export interface WindowUsage {
  usedMicroUsd: number;
  reservedMicroUsd: number;
}

export interface QuotaUsage {
  day: WindowUsage;
  week: WindowUsage;
}

/** store 在判斷當下實際採用的上限（含當週 active 追加加總）。 */
export interface EffectiveLimits {
  tier: AccessTier;
  dayLimitMicroUsd: number;
  weekBaseLimitMicroUsd: number;
  weekTopUpMicroUsd: number;
  weekLimitMicroUsd: number;
}

export type ReservationStatus = 'reserved' | 'settled' | 'released' | 'uncertain';

export interface ReservationRecord {
  requestEpoch?: RequestEpochExecution;
  comparisonCost?: TrustedFingerprintCost & { costParametersDigest: string };
  lastReviewedAt?: string;
  reviewEvidenceRef?: string;
  reviewEscalated?: boolean;
  registryDecision?: RegistryDecision;
  reservationId: string;
  idempotencyKey: string;
  identitySubject: string;
  endpoint: ProtectedEndpoint;
  estimatedCostUpperBoundUsdMicro: number;
  costModelVersion: string;
  /** 後端 stable encoding 計算，涵蓋影響成本的參數；同參數改版本不得解除封鎖。 */
  costParametersDigest: string;
  costModelEffectiveFrom: string;
  costModelExpiresAt: string;
  /** HMAC-SHA-256 hex；不含原始內容或未加金鑰的內容摘要。 */
  requestFingerprint: string;
  fingerprintKeyVersion: string;
  estimateInputs: EstimateInputs;
  status: ReservationStatus;
  /** 預留當下的原始窗口；結算一律對這兩個窗口，不看結算時的當前日期。 */
  dayWindowKey: string;
  weekWindowKey: string;
  createdAt: string;
  /** 上游執行權已在建立預留時交給原呼叫端；此值永遠為 true，且不會被重新發放。 */
  executionGranted: true;
  /** 超過此時間仍為 reserved 者，settle 只會轉為 uncertain（不退款、不重放）。 */
  leaseExpiresAt: string;
  conflictCount: number;
  lastConflictAt?: string;
  lastConflictFingerprint?: string;
  settledAt?: string;
  settlementReason?: string;
  settledChargeUsdMicro?: number;
  /** 結算金額高於預留金額的部分（保留真實估算，不截斷）。 */
  overrunMicroUsd?: number;
  /** 結算採用的可信價表版本，用於拒絕不同語意的重複結算。 */
  settlementCostModelVersion?: string;
  /** uncertain 之後才到達的結果；只記錄，不改變任何餘額。 */
  lateOutcomeObserved?: { outcome: 'success' | 'unbilled_failure'; observedAt: string };
}

export interface TopUpRecord {
  topUpId: string;
  identitySubject: string;
  weekWindowKey: string;
  amountMicroUsd: number;
  status: 'active' | 'revoked';
  idempotencyKey: string;
  adminSubject: string;
  reasonCode: string;
  /** 該週結束（下一個週一 00:00）；由 store 以窗口 resetAt 寫入，不接受管理者輸入。 */
  expiresAt: string;
  createdAt: string;
  revokedAt?: string;
}

export interface ReserveCommand {
  requestEpoch?: RequestEpochExecution;
  comparisonCost?: TrustedFingerprintCost & { costParametersDigest: string };
  expectedRegistry?: RegistryBundle;
  identitySubject: string;
  idempotencyKey: string;
  reservationId: string;
  endpoint: ProtectedEndpoint;
  amountMicroUsd: number;
  costModel: CostModelRef;
  costParametersDigest: string;
  requestFingerprint: string;
  fingerprintKeyVersion: string;
  estimateInputs: EstimateInputs;
  day: WindowSpec;
  week: WindowSpec;
  tierLimits: TierLimitTable;
  leaseMs: number;
  nowIso: string;
}

export type NotEligibleReason = EligibilityStatus | 'missing' | 'eligibility_expired';

export type ReserveResult =
  | { status: 'epoch_rejected' }
  | { status: 'reserved'; executionGrant: true; reservation: ReservationRecord; usage: QuotaUsage; limits: EffectiveLimits; registryDecision?: RegistryDecision }
  | { status: 'duplicate'; executionGrant: false; reservation: ReservationRecord }
  | { status: 'idempotency_conflict'; reservation: ReservationRecord }
  | { status: 'denied'; deniedWindow: 'day' | 'week' | 'both'; usage: QuotaUsage; limits: EffectiveLimits; registryDecision?: RegistryDecision; denialClass?: 'exhausted' | 'below_floor' | 'request_insufficient' }
  | { status: 'not_eligible'; reason: NotEligibleReason }
  | { status: 'cost_model_blocked'; costModelVersion: string }
  | { status: 'cost_model_invalid' };

export type SettleTransition = 'settled' | 'released' | 'uncertain';

export interface SettleCommand {
  identitySubject: string;
  reservationId: string;
  transition: SettleTransition;
  /** 轉為已用的金額；released／uncertain 必為 0。settled 可高於預留，store 不得截斷。 */
  chargeMicroUsd: number;
  /** 結算結果使用的可信模型版本；不是呼叫端傳入的設定。 */
  costModelVersion: string;
  reason: string;
  nowIso: string;
}

/** 同一原子操作的原窗口佐證；不可由另一個 read 補齊。 */
export interface ReservationUsageEvidence {
  reservation: ReservationRecord;
  usage: QuotaUsage;
  identitySubject: string;
  dayWindowKey: string;
  weekWindowKey: string;
}

export type SettleResult =
  | (ReservationUsageEvidence & {
      status: 'applied' | 'already_applied';
      /** 僅當本筆超額已在同一原子操作封鎖模型時回傳。 */
      blockedCostModelVersion?: string;
      blockedCostParametersDigest?: string;
    })
  | { status: 'not_found' }
  | (ReservationUsageEvidence & { status: 'invalid_transition' })
  | (ReservationUsageEvidence & { status: 'settlement_conflict' })
  /** lease 已到期：reservation 已被原子地轉為 uncertain，餘額不變。 */
  | (ReservationUsageEvidence & { status: 'lease_expired' })
  | { status: 'overflow' };

export interface SetEligibilityCommand {
  identitySubject: string;
  status: EligibilityStatus;
  tier: AccessTier;
  expiresAt: string | null;
  nowIso: string;
}

export interface AddTopUpCommand {
  identitySubject: string;
  topUpId: string;
  idempotencyKey: string;
  week: WindowSpec;
  amountMicroUsd: number;
  adminSubject: string;
  reasonCode: string;
  nowIso: string;
}

export type AddTopUpResult =
  | { status: 'applied' | 'duplicate'; topUp: TopUpRecord; cumulativeTopUpMicroUsd: number }
  | { status: 'idempotency_conflict'; topUp: TopUpRecord }
  | { status: 'window_expired' }
  | { status: 'overflow' };

export interface RevokeTopUpCommand {
  identitySubject: string;
  topUpId: string;
  adminSubject: string;
  nowIso: string;
}

export type RevokeTopUpResult =
  | { status: 'applied' | 'already_applied'; topUp: TopUpRecord; cumulativeTopUpMicroUsd: number }
  | { status: 'not_found' };

export interface ExpireLeasesResult {
  expired: number;
  /** 本次已處理項目的同次原子佐證；重跑不重列已清理項目。 */
  entries: ReservationUsageEvidence[];
}

export type QuotaStateResult =
  | { status: 'ok'; usage: QuotaUsage; limits: EffectiveLimits }
  | { status: 'not_eligible'; reason: NotEligibleReason };

/**
 * 每個方法必須在 provider 端以單一原子操作（Lua script／transaction）完成，
 * 不得由呼叫端以「讀取 → 判斷 → 寫回」多次往返拼湊。
 */
export interface SharedStore {
  getEpochBinding?(identitySubject: string, accountingIndex: string): Promise<ReservationRecord | null>;
  readAtomicQuota?(command: Pick<ReserveCommand,
    'identitySubject' | 'day' | 'week' | 'tierLimits' | 'nowIso'> & { expectedRegistry: RegistryBundle }): Promise<
      | { status: 'available' | 'denied'; usage: QuotaUsage; limits: EffectiveLimits; registryDecision: RegistryDecision;
          denialClass?: 'exhausted' | 'below_floor'; deniedWindow?: 'day' | 'week' }
      | { status: 'not_eligible'; reason: NotEligibleReason }
      | { status: 'cost_model_invalid' }
    >;
  /** 原子核對版本→端點摘要的一致性及版本／摘要兩種封鎖；超額結算同時封鎖兩者。 */
  reserve(command: ReserveCommand): Promise<ReserveResult>;
  /** 同一 transition、金額、reason 與模型版本才可作為 already_applied；超額及封鎖證據同次原子回傳。 */
  settle(command: SettleCommand): Promise<SettleResult>;
  setEligibility(command: SetEligibilityCommand): Promise<EligibilityRecord>;
  addTopUp(command: AddTopUpCommand): Promise<AddTopUpResult>;
  revokeTopUp(command: RevokeTopUpCommand): Promise<RevokeTopUpResult>;
  /** 只把逾 lease 的 reserved 轉為 uncertain；餘額不變、不退款、不重放。 */
  expireLeases(identitySubject: string, nowIso: string): Promise<ExpireLeasesResult>;
  getReservation(identitySubject: string, reservationId: string): Promise<ReservationRecord | null>;
  readUsage(identitySubject: string, dayWindowKey: string, weekWindowKey: string): Promise<QuotaUsage>;
  readQuota(
    identitySubject: string,
    day: WindowSpec,
    week: WindowSpec,
    tierLimits: TierLimitTable,
    nowIso: string,
  ): Promise<QuotaStateResult>;
}

export class SharedStoreUnavailableError extends Error {
  constructor(message = 'shared store 不可用') {
    super(message);
    this.name = 'SharedStoreUnavailableError';
  }
}

export class SharedStoreTimeoutError extends SharedStoreUnavailableError {
  constructor(timeoutMs: number) {
    super(`shared store 操作逾時（${timeoutMs} ms）；結果未知，必須 fail closed`);
    this.name = 'SharedStoreTimeoutError';
  }
}

export async function withStoreTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SharedStoreTimeoutError(timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** 真實 adapter 尚未核准：一律拒絕，而非退回記憶體實作。 */
export function getProductionSharedStore(): never {
  throw new SharedStoreUnavailableError('SHARED_STORE_NOT_CONFIGURED');
}
