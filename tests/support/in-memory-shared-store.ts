// 僅供測試的記憶體 mock。
// 原子性來自「單一同步區段、單一 JS 執行緒」，不是 Redis／Lua／transaction 行為，
// 因此通過此 mock 的測試「不代表」Upstash 原子性已驗證。
import type {
  AddTopUpCommand,
  AddTopUpResult,
  EffectiveLimits,
  EligibilityRecord,
  ExpireLeasesResult,
  NotEligibleReason,
  QuotaStateResult,
  QuotaUsage,
  ReservationRecord,
  ReservationUsageEvidence,
  ReserveCommand,
  ReserveResult,
  RevokeTopUpCommand,
  RevokeTopUpResult,
  SetEligibilityCommand,
  SettleCommand,
  SettleResult,
  SharedStore,
  TierLimitTable,
  TopUpRecord,
  WindowSpec,
  WindowUsage,
} from '../../api/_lib/shared-store';
import { validateEstimateInputs } from '../../api/_lib/quota-estimate-inputs';
import { isCostModelEffective } from '../../api/_lib/cost-price-table';
import { CostRegistryError, createRegistryBundle, registryDecision, costParametersDigest,
  type RegistryBundle, type RegistryDecision } from '../../api/_lib/cost-registry';
import { buildSnapshot } from '../../api/_lib/quota-engine';
import { classifyAtomicAvailability } from '../../api/_lib/quota-threshold';
import { getQuotaWindows } from '../../api/_lib/quota-window';
import { estimateReservation } from '../../api/_lib/cost-estimators';

const clone = <T>(value: T): T => structuredClone(value);
const MAX = BigInt(Number.MAX_SAFE_INTEGER);

function assertPositiveSafeInt(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`mock store invariant: ${name} 必須為正整數`);
}

function toSafe(value: bigint, name: string): number {
  if (value > MAX || value < 0n) throw new Error(`mock store invariant: ${name} 超出安全整數範圍`);
  return Number(value);
}

export class InMemorySharedStoreMock implements SharedStore {
  private registry: RegistryBundle | null = null;
  constructor(private readonly atomicNow?: () => Date) {}

  publishRegistry(bundle: RegistryBundle): void {
    if (!this.atomicNow) throw new Error('原子 registry mock 必須注入可信時鐘');
    registryDecision(bundle, this.atomicNow?.() ?? new Date(bundle.table.effectiveFrom),
      { versions: new Set(), parameters: new Set() }, true);
    if (this.registry && bundle.registryRevision <= this.registry.registryRevision)
      throw new Error('registry revision 不得重用或倒退');
    this.registry = createRegistryBundle(bundle.registryRevision, bundle.table, bundle.entries.map((entry) => ({
      ...entry, blocked: entry.blocked || this.blockedCostModels.has(entry.version) ||
        this.blockedCostParameters.has(costParametersDigest(entry)),
    })));
  }

  async registrySnapshot(): Promise<RegistryBundle> {
    if (!this.registry) throw new Error('registry 尚未發布');
    return clone(this.registry);
  }

  blockParameters(digest: string): void {
    this.blockedCostParameters.add(digest);
    this.refreshRegistryBlocks();
  }

  private refreshRegistryBlocks(): void {
    if (!this.registry) return;
    const entries = this.registry.entries.map((entry) => ({
      ...entry, blocked: entry.blocked || this.blockedCostModels.has(entry.version) ||
        this.blockedCostParameters.has(costParametersDigest(entry)),
    }));
    this.registry = createRegistryBundle(this.registry.registryRevision + 1, this.registry.table, entries);
  }
  readonly isMock = true;
  private readonly windows = new Map<string, WindowUsage>();
  private readonly reservations = new Map<string, ReservationRecord>();
  private readonly idempotency = new Map<string, string>();
  private readonly eligibility = new Map<string, EligibilityRecord>();
  private readonly topUps = new Map<string, TopUpRecord>();
  private readonly topUpIdempotency = new Map<string, string>();
  private readonly blockedCostModels = new Set<string>();
  private readonly blockedCostParameters = new Set<string>();
  private readonly costBindings = new Map<string, string>();

  /** 測試用：同步植入資格，避免每個測試都要 await。 */
  seed(record: Omit<EligibilityRecord, 'updatedAt'>): void {
    this.eligibility.set(record.identitySubject, { ...record, updatedAt: '2026-01-01T00:00:00.000Z' });
  }

  /** 測試用：整體狀態的序列化，用來檢查稽核資料不含原文。 */
  dumpState(): string {
    return JSON.stringify({
      reservations: [...this.reservations.values()],
      topUps: [...this.topUps.values()],
      eligibility: [...this.eligibility.values()],
    });
  }

  isCostModelBlocked(version: string): boolean {
    return this.blockedCostModels.has(version);
  }

  private usageOf(subject: string, type: 'day' | 'week', key: string): WindowUsage {
    const mapKey = `${subject}|${type}|${key}`;
    let usage = this.windows.get(mapKey);
    if (!usage) {
      usage = { usedMicroUsd: 0, reservedMicroUsd: 0 };
      this.windows.set(mapKey, usage);
    }
    return usage;
  }

  private usageSnapshot(subject: string, dayKey: string, weekKey: string): QuotaUsage {
    return {
      day: clone(this.usageOf(subject, 'day', dayKey)),
      week: clone(this.usageOf(subject, 'week', weekKey)),
    };
  }

  private evidenceOf(record: ReservationRecord): ReservationUsageEvidence {
    return {
      reservation: clone(record),
      usage: this.usageSnapshot(record.identitySubject, record.dayWindowKey, record.weekWindowKey),
      identitySubject: record.identitySubject, dayWindowKey: record.dayWindowKey, weekWindowKey: record.weekWindowKey,
    };
  }

  private topUpTotal(subject: string, weekKey: string, nowMs: number): number {
    let total = 0n;
    for (const topUp of this.topUps.values()) {
      if (topUp.identitySubject !== subject || topUp.weekWindowKey !== weekKey || topUp.status !== 'active') continue;
      if (Date.parse(topUp.expiresAt) <= nowMs) continue; // 週界一到自動失效，不看管理者輸入
      total += BigInt(topUp.amountMicroUsd);
    }
    return toSafe(total, 'topUpTotal');
  }

  /** 資格與有效上限：與預留判斷在同一個同步區段內計算，不存在「先讀後用舊值」。 */
  private resolveLimits(
    subject: string,
    week: WindowSpec,
    tierLimits: TierLimitTable,
    nowIso: string,
  ): { limits: EffectiveLimits } | { reason: NotEligibleReason } {
    const record = this.eligibility.get(subject);
    if (!record) return { reason: 'missing' };
    if (record.status !== 'approved') return { reason: record.status };
    const nowMs = Date.parse(nowIso);
    if (record.expiresAt !== null && Date.parse(record.expiresAt) <= nowMs) return { reason: 'eligibility_expired' };
    const tier = tierLimits[record.tier];
    const weekTopUpMicroUsd = this.topUpTotal(subject, week.windowKey, nowMs);
    return {
      limits: {
        tier: record.tier,
        dayLimitMicroUsd: tier.dayLimitMicroUsd,
        weekBaseLimitMicroUsd: tier.weekBaseLimitMicroUsd,
        weekTopUpMicroUsd,
        weekLimitMicroUsd: toSafe(BigInt(tier.weekBaseLimitMicroUsd) + BigInt(weekTopUpMicroUsd), 'weekLimit'),
      },
    };
  }

  async setEligibility(command: SetEligibilityCommand): Promise<EligibilityRecord> {
    await Promise.resolve();
    const record: EligibilityRecord = {
      identitySubject: command.identitySubject,
      status: command.status,
      tier: command.tier,
      expiresAt: command.expiresAt,
      updatedAt: command.nowIso,
    };
    this.eligibility.set(command.identitySubject, record);
    return clone(record);
  }

  async reserve(command: ReserveCommand): Promise<ReserveResult> {
    await Promise.resolve();
    return this.reserveSync(command);
  }

  async readAtomicQuota(command: Parameters<NonNullable<SharedStore['readAtomicQuota']>>[0]):
    Promise<Awaited<ReturnType<NonNullable<SharedStore['readAtomicQuota']>>>> {
    await Promise.resolve();
    if (!this.atomicNow) return { status: 'cost_model_invalid' };
    const now = this.atomicNow();
    const limits = this.resolveLimits(command.identitySubject, command.week, command.tierLimits, now.toISOString());
    if ('reason' in limits) return { status: 'not_eligible', reason: limits.reason };
    const windows = getQuotaWindows(now);
    if (!this.registry || this.registry.registryRevision !== command.expectedRegistry.registryRevision ||
        this.registry.bundleDigest !== command.expectedRegistry.bundleDigest || now.getTime() < Date.parse(command.nowIso) ||
        windows.day.windowKey !== command.day.windowKey || windows.day.resetAt !== command.day.resetAt ||
        windows.week.windowKey !== command.week.windowKey || windows.week.resetAt !== command.week.resetAt)
      return { status: 'cost_model_invalid' };
    let decision: RegistryDecision;
    try {
      decision = registryDecision(this.registry, now, {
        versions: this.blockedCostModels, parameters: this.blockedCostParameters,
      });
    } catch (error) {
      if (!(error instanceof CostRegistryError)) throw error;
      return { status: 'cost_model_invalid' };
    }
    const usage = this.usageSnapshot(command.identitySubject, command.day.windowKey, command.week.windowKey);
    const classification = classifyAtomicAvailability(buildSnapshot(usage,
      { ...command.day, limitMicroUsd: limits.limits.dayLimitMicroUsd },
      { ...command.week, limitMicroUsd: limits.limits.weekLimitMicroUsd }), decision.floorMicroUsd);
    if (classification.state === 'request_insufficient') throw new Error('map 不得使用個別請求分類');
    return {
      status: classification.state === 'available' ? 'available' : 'denied', usage,
      limits: limits.limits, registryDecision: decision,
      ...(classification.state === 'available' ? {} : {
        denialClass: classification.state, deniedWindow: classification.window,
      }),
    };
  }

  private reserveSync(command: ReserveCommand): ReserveResult {
    assertPositiveSafeInt(command.amountMicroUsd, 'amountMicroUsd');
    assertPositiveSafeInt(command.leaseMs, 'leaseMs');
    const estimateInputs = validateEstimateInputs(command.endpoint, command.estimateInputs);
    const decisionTime = this.atomicNow?.() ?? new Date(command.nowIso);
    const decisionIso = decisionTime.toISOString();
    const { identitySubject: subject, day, week } = command;

    const resolved = this.resolveLimits(subject, week, command.tierLimits, decisionIso);
    if ('reason' in resolved) return { status: 'not_eligible', reason: resolved.reason };
    let decision: RegistryDecision | undefined;
    if (this.registry || command.expectedRegistry) {
      if (!this.registry || !command.expectedRegistry ||
          this.registry.registryRevision !== command.expectedRegistry.registryRevision ||
          this.registry.bundleDigest !== command.expectedRegistry.bundleDigest ||
          Date.parse(command.nowIso) > decisionTime.getTime()) return { status: 'cost_model_invalid' };
      const windows = getQuotaWindows(decisionTime);
      if (day.windowKey !== windows.day.windowKey || week.windowKey !== windows.week.windowKey ||
          day.resetAt !== windows.day.resetAt || week.resetAt !== windows.week.resetAt)
        return { status: 'cost_model_invalid' };
      try {
        decision = registryDecision(this.registry, decisionTime, {
          versions: this.blockedCostModels, parameters: this.blockedCostParameters,
        });
        const entry = this.registry.entries.find((entry) => entry.endpoint === command.endpoint);
        if (!entry || !decision.liveEndpoints.includes(command.endpoint) ||
            command.costModel.version !== entry.version ||
            command.costModel.effectiveFrom !== entry.table.effectiveFrom ||
            command.costModel.expiresAt !== entry.table.expiresAt ||
            command.costParametersDigest !== costParametersDigest(entry))
          return { status: 'cost_model_invalid' };
        const verified = validateEstimateInputs(command.endpoint, command.estimateInputs, entry.estimateBounds);
        const estimate = estimateReservation({ endpoint: command.endpoint, table: entry.table,
          model: entry.model ?? undefined, input: verified, now: decisionTime });
        if (!estimate.ok || estimate.amountMicroUsd !== command.amountMicroUsd)
          return { status: 'cost_model_invalid' };
      } catch (error) {
        if (!(error instanceof CostRegistryError)) throw error;
        return { status: 'cost_model_invalid' };
      }
    }
    if (!isCostModelEffective(command.costModel, Date.parse(command.nowIso)) ||
        !/^[0-9a-f]{64}$/.test(command.costParametersDigest)) return { status: 'cost_model_invalid' };
    const bindingKey = `${command.costModel.version}|${command.endpoint}`;
    const binding = this.costBindings.get(bindingKey);
    if (binding !== undefined && binding !== command.costParametersDigest) return { status: 'cost_model_invalid' };
    this.costBindings.set(bindingKey, command.costParametersDigest);

    const existingKey = this.idempotency.get(`${subject}|${command.idempotencyKey}`);
    if (existingKey) {
      const existing = this.reservations.get(existingKey)!;
      const same =
        existing.endpoint === command.endpoint &&
        existing.estimatedCostUpperBoundUsdMicro === command.amountMicroUsd &&
        existing.costModelVersion === command.costModel.version &&
        existing.costParametersDigest === command.costParametersDigest &&
        existing.requestFingerprint === command.requestFingerprint;
      if (same) return { status: 'duplicate', executionGrant: false, reservation: clone(existing) };
      existing.conflictCount += 1;
      existing.lastConflictAt = command.nowIso;
      existing.lastConflictFingerprint = command.requestFingerprint;
      return { status: 'idempotency_conflict', reservation: clone(existing) };
    }

    if (this.blockedCostModels.has(command.costModel.version) || this.blockedCostParameters.has(command.costParametersDigest)) {
      return { status: 'cost_model_blocked', costModelVersion: command.costModel.version };
    }

    const { limits } = resolved;
    const dayUsage = this.usageOf(subject, 'day', day.windowKey);
    const weekUsage = this.usageOf(subject, 'week', week.windowKey);
    const amount = BigInt(command.amountMicroUsd);
    const dayRemaining = BigInt(limits.dayLimitMicroUsd) - BigInt(dayUsage.usedMicroUsd) - BigInt(dayUsage.reservedMicroUsd);
    const weekRemaining = BigInt(limits.weekLimitMicroUsd) - BigInt(weekUsage.usedMicroUsd) - BigInt(weekUsage.reservedMicroUsd);
    const dayShort = amount > dayRemaining;
    const weekShort = amount > weekRemaining;
    const availability = decision && classifyAtomicAvailability(buildSnapshot(
      this.usageSnapshot(subject, day.windowKey, week.windowKey),
      { ...day, limitMicroUsd: limits.dayLimitMicroUsd },
      { ...week, limitMicroUsd: limits.weekLimitMicroUsd },
    ), decision.floorMicroUsd, command.amountMicroUsd);
    if (dayShort || weekShort || (availability && availability.state !== 'available')) {
      return {
        status: 'denied',
        deniedWindow: availability ? availability.window : dayShort && weekShort ? 'both' : dayShort ? 'day' : 'week',
        usage: this.usageSnapshot(subject, day.windowKey, week.windowKey),
        limits: clone(limits),
        ...(decision && availability && availability.state !== 'available'
          ? { registryDecision: decision, denialClass: availability.state } : {}),
      };
    }

    dayUsage.reservedMicroUsd += command.amountMicroUsd;
    weekUsage.reservedMicroUsd += command.amountMicroUsd;
    const record: ReservationRecord = {
      reservationId: command.reservationId,
      idempotencyKey: command.idempotencyKey,
      identitySubject: subject,
      endpoint: command.endpoint,
      estimatedCostUpperBoundUsdMicro: command.amountMicroUsd,
      costModelVersion: command.costModel.version,
      costParametersDigest: command.costParametersDigest,
      costModelEffectiveFrom: command.costModel.effectiveFrom,
      costModelExpiresAt: command.costModel.expiresAt,
      requestFingerprint: command.requestFingerprint,
      fingerprintKeyVersion: command.fingerprintKeyVersion,
      estimateInputs: clone(estimateInputs),
      status: 'reserved',
      dayWindowKey: day.windowKey,
      weekWindowKey: week.windowKey,
      createdAt: decisionIso,
      executionGranted: true,
      leaseExpiresAt: new Date(decisionTime.getTime() + command.leaseMs).toISOString(),
      conflictCount: 0,
      ...(decision ? { registryDecision: decision } : {}),
    };
    this.reservations.set(`${subject}|${record.reservationId}`, record);
    this.idempotency.set(`${subject}|${command.idempotencyKey}`, `${subject}|${record.reservationId}`);
    return {
      status: 'reserved',
      executionGrant: true,
      reservation: clone(record),
      usage: this.usageSnapshot(subject, day.windowKey, week.windowKey),
      limits: clone(limits),
      ...(decision ? { registryDecision: clone(decision) } : {}),
    };
  }

  async settle(command: SettleCommand): Promise<SettleResult> {
    await Promise.resolve();
    return this.settleSync(command);
  }

  private settleSync(command: SettleCommand): SettleResult {
    const record = this.reservations.get(`${command.identitySubject}|${command.reservationId}`);
    if (!record) return { status: 'not_found' };

    if (record.status === command.transition) {
      const sameSemantics =
        record.settledChargeUsdMicro === command.chargeMicroUsd &&
        record.settlementReason === command.reason &&
        record.settlementCostModelVersion === command.costModelVersion;
      if (!sameSemantics) return { status: 'settlement_conflict', ...this.evidenceOf(record) };
      return {
        status: 'already_applied',
        ...this.evidenceOf(record),
        ...(record.overrunMicroUsd === undefined ? {} : {
          blockedCostModelVersion: record.costModelVersion, blockedCostParametersDigest: record.costParametersDigest,
        }),
      };
    }
    if (record.status !== 'reserved') {
      // uncertain 之後才到的結果只留紀錄，不改餘額、不退款。
      if (record.status === 'uncertain' && command.transition !== 'uncertain' && !record.lateOutcomeObserved) {
        record.lateOutcomeObserved = {
          outcome: command.transition === 'settled' ? 'success' : 'unbilled_failure',
          observedAt: command.nowIso,
        };
      }
      return { status: 'invalid_transition', ...this.evidenceOf(record) };
    }

    if (!Number.isSafeInteger(command.chargeMicroUsd) || command.chargeMicroUsd < 0) {
      throw new Error('mock store invariant: chargeMicroUsd 必須為非負整數');
    }
    if (command.transition !== 'settled' && command.chargeMicroUsd !== 0) {
      throw new Error('mock store invariant: released／uncertain 的 charge 必為 0');
    }

    // lease 到期：不論回報什麼都只轉 uncertain（保留預留），不退款、不重新放行。
    if (command.transition !== 'uncertain' && Date.parse(command.nowIso) > Date.parse(record.leaseExpiresAt)) {
      record.status = 'uncertain';
      record.settledAt = command.nowIso;
      record.settlementReason = 'lease_expired';
      record.settledChargeUsdMicro = 0;
      record.settlementCostModelVersion = command.costModelVersion;
      record.lateOutcomeObserved = {
        outcome: command.transition === 'settled' ? 'success' : 'unbilled_failure',
        observedAt: command.nowIso,
      };
      return { status: 'lease_expired', ...this.evidenceOf(record) };
    }

    const dayUsage = this.usageOf(record.identitySubject, 'day', record.dayWindowKey);
    const weekUsage = this.usageOf(record.identitySubject, 'week', record.weekWindowKey);
    const amount = record.estimatedCostUpperBoundUsdMicro;

    if (command.transition === 'settled') {
      // 結算後 used + reserved 必須仍為安全整數；高於預留的金額如實計入，不截斷。
      const newTotal = (u: WindowUsage) => BigInt(u.usedMicroUsd) + BigInt(command.chargeMicroUsd) + BigInt(u.reservedMicroUsd) - BigInt(amount);
      if (newTotal(dayUsage) > MAX || newTotal(weekUsage) > MAX) return { status: 'overflow' };
    }
    if (command.transition !== 'uncertain') {
      if (dayUsage.reservedMicroUsd < amount || weekUsage.reservedMicroUsd < amount) {
        throw new Error('mock store invariant: reserved 不得為負');
      }
      dayUsage.reservedMicroUsd -= amount;
      weekUsage.reservedMicroUsd -= amount;
      dayUsage.usedMicroUsd += command.chargeMicroUsd;
      weekUsage.usedMicroUsd += command.chargeMicroUsd;
    }
    if (command.transition === 'settled' && command.chargeMicroUsd > amount) {
      record.overrunMicroUsd = command.chargeMicroUsd - amount;
      this.blockedCostModels.add(record.costModelVersion);
      this.blockedCostParameters.add(record.costParametersDigest);
      this.refreshRegistryBlocks();
    }
    record.status = command.transition;
    record.settledAt = command.nowIso;
    record.settlementReason = command.reason;
    record.settledChargeUsdMicro = command.chargeMicroUsd;
    record.settlementCostModelVersion = command.costModelVersion;
    return {
      status: 'applied',
      ...this.evidenceOf(record),
      ...(record.overrunMicroUsd === undefined ? {} : {
        blockedCostModelVersion: record.costModelVersion, blockedCostParametersDigest: record.costParametersDigest,
      }),
    };
  }

  async addTopUp(command: AddTopUpCommand): Promise<AddTopUpResult> {
    await Promise.resolve();
    assertPositiveSafeInt(command.amountMicroUsd, 'amountMicroUsd');
    const nowMs = Date.parse(command.nowIso);
    if (nowMs >= Date.parse(command.week.resetAt)) return { status: 'window_expired' };

    const existingId = this.topUpIdempotency.get(`${command.identitySubject}|${command.idempotencyKey}`);
    if (existingId) {
      const existing = this.topUps.get(`${command.identitySubject}|${existingId}`)!;
      const same = existing.weekWindowKey === command.week.windowKey && existing.amountMicroUsd === command.amountMicroUsd;
      return same
        ? { status: 'duplicate', topUp: clone(existing), cumulativeTopUpMicroUsd: this.topUpTotal(command.identitySubject, existing.weekWindowKey, nowMs) }
        : { status: 'idempotency_conflict', topUp: clone(existing) };
    }

    const cumulative = BigInt(this.topUpTotal(command.identitySubject, command.week.windowKey, nowMs)) + BigInt(command.amountMicroUsd);
    if (cumulative > MAX) return { status: 'overflow' };
    const record: TopUpRecord = {
      topUpId: command.topUpId,
      identitySubject: command.identitySubject,
      weekWindowKey: command.week.windowKey,
      amountMicroUsd: command.amountMicroUsd,
      status: 'active',
      idempotencyKey: command.idempotencyKey,
      adminSubject: command.adminSubject,
      reasonCode: command.reasonCode,
      expiresAt: command.week.resetAt,
      createdAt: command.nowIso,
    };
    this.topUps.set(`${record.identitySubject}|${record.topUpId}`, record);
    this.topUpIdempotency.set(`${record.identitySubject}|${command.idempotencyKey}`, record.topUpId);
    return { status: 'applied', topUp: clone(record), cumulativeTopUpMicroUsd: Number(cumulative) };
  }

  async revokeTopUp(command: RevokeTopUpCommand): Promise<RevokeTopUpResult> {
    await Promise.resolve();
    const record = this.topUps.get(`${command.identitySubject}|${command.topUpId}`);
    if (!record) return { status: 'not_found' };
    const nowMs = Date.parse(command.nowIso);
    if (record.status === 'revoked') {
      return { status: 'already_applied', topUp: clone(record), cumulativeTopUpMicroUsd: this.topUpTotal(record.identitySubject, record.weekWindowKey, nowMs) };
    }
    // 只影響之後的預留判斷；既有 reserved／settled 金額不回溯。
    record.status = 'revoked';
    record.revokedAt = command.nowIso;
    return { status: 'applied', topUp: clone(record), cumulativeTopUpMicroUsd: this.topUpTotal(record.identitySubject, record.weekWindowKey, nowMs) };
  }

  async expireLeases(identitySubject: string, nowIso: string): Promise<ExpireLeasesResult> {
    await Promise.resolve();
    let expired = 0;
    const entries: ReservationUsageEvidence[] = [];
    for (const record of this.reservations.values()) {
      if (record.identitySubject !== identitySubject || record.status !== 'reserved') continue;
      if (Date.parse(nowIso) <= Date.parse(record.leaseExpiresAt)) continue;
      record.status = 'uncertain';
      record.settledAt = nowIso;
      record.settlementReason = 'lease_expired';
      record.settledChargeUsdMicro = 0;
      record.settlementCostModelVersion = record.costModelVersion;
      expired += 1;
      entries.push(this.evidenceOf(record));
    }
    return { expired, entries };
  }

  async getReservation(identitySubject: string, reservationId: string): Promise<ReservationRecord | null> {
    await Promise.resolve();
    const record = this.reservations.get(`${identitySubject}|${reservationId}`);
    return record ? clone(record) : null;
  }

  async readUsage(identitySubject: string, dayWindowKey: string, weekWindowKey: string): Promise<QuotaUsage> {
    await Promise.resolve();
    return this.usageSnapshot(identitySubject, dayWindowKey, weekWindowKey);
  }

  async readQuota(identitySubject: string, day: WindowSpec, week: WindowSpec, tierLimits: TierLimitTable, nowIso: string): Promise<QuotaStateResult> {
    await Promise.resolve();
    const resolved = this.resolveLimits(identitySubject, week, tierLimits, nowIso);
    if ('reason' in resolved) return { status: 'not_eligible', reason: resolved.reason };
    return { status: 'ok', usage: this.usageSnapshot(identitySubject, day.windowKey, week.windowKey), limits: clone(resolved.limits) };
  }
}
