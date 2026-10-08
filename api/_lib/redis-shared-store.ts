import { createRegistryBundle, costParametersDigest, registryDecision, type CostRegistry,
  type RegistryBundle } from './cost-registry';
import { estimateReservation } from './cost-estimators';
import { validateEstimateInputs } from './quota-estimate-inputs';
import { createRedisAtomicTransport, type RedisEvalTransport } from './redis-atomic-transport';
import { REDIS_QUOTA_LUA } from './redis-quota-script';
import { validateRequestEpochFloor } from './request-epoch-authority';
import type { RequestEpochFloor } from './request-epoch-store';
import { SharedStoreUnavailableError, type SharedStore, type EligibilityRecord, type ReservationRecord,
  type TopUpRecord, type WindowUsage, type ReserveResult, type SettleResult, type AddTopUpResult,
  type RevokeTopUpResult, type ExpireLeasesResult, type QuotaStateResult } from './shared-store';

export interface RedisUserState {
  identity?: { identitySubject: string; createdAt: string };
  eligibility: EligibilityRecord | null;
  windows: Record<string, WindowUsage>;
  reservations: Record<string, ReservationRecord>;
  idempotency: Record<string, string>;
  topUps: Record<string, TopUpRecord>;
  topUpIdempotency: Record<string, string>;
}

export interface RedisStoreOptions {
  epochFloor?: RequestEpochFloor;
  rejectLegacy?: boolean;
  namespace: string;
  transport: RedisEvalTransport;
  timeoutMs: number;
  audit(event: { operation: 'redis_atomic'; outcome: 'unavailable' }): void;
}

export function REDIS_QUOTA_KEYS(namespace: string): readonly [string, string, string] {
  if (!/^\{[A-Za-z0-9_-]{1,64}\}$/.test(namespace)) throw new TypeError('需要明確且同 slot 的 Redis namespace');
  return [`${namespace}:registry`, `${namespace}:users`, `${namespace}:sessions`];
}

export const isRedisObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function decodeRedisReply(value: unknown): unknown {
  if (typeof value !== 'string') throw new SharedStoreUnavailableError('INVALID_REDIS_REPLY');
  try { return JSON.parse(value); }
  catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new SharedStoreUnavailableError('INVALID_REDIS_JSON');
  }
}

const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const usage = (v: unknown): v is { day: WindowUsage; week: WindowUsage } =>
  isRedisObject(v) && [v.day, v.week].every((w) =>
    isRedisObject(w) && integer(w.usedMicroUsd) && integer(w.reservedMicroUsd));
const reservation = (v: unknown): v is ReservationRecord =>
  isRedisObject(v) && typeof v.reservationId === 'string' && typeof v.identitySubject === 'string' &&
  typeof v.dayWindowKey === 'string' && typeof v.weekWindowKey === 'string' &&
  ['reserved', 'settled', 'released', 'uncertain'].includes(String(v.status)) &&
  integer(v.estimatedCostUpperBoundUsdMicro) && v.executionGranted === true;
const topUp = (v: unknown): v is TopUpRecord =>
  isRedisObject(v) && typeof v.topUpId === 'string' && typeof v.identitySubject === 'string' &&
  typeof v.weekWindowKey === 'string' && integer(v.amountMicroUsd) &&
  ['active', 'revoked'].includes(String(v.status));
const evidence = (v: Record<string, unknown>) =>
  reservation(v.reservation) && usage(v.usage) && typeof v.identitySubject === 'string' &&
  typeof v.dayWindowKey === 'string' && typeof v.weekWindowKey === 'string';
const hasLimits = (v: Record<string, unknown>) => isRedisObject(v.limits) &&
  ['tier1', 'tier2'].includes(String(v.limits.tier)) &&
  ['dayLimitMicroUsd', 'weekBaseLimitMicroUsd', 'weekTopUpMicroUsd', 'weekLimitMicroUsd']
    .every((key) => isRedisObject(v.limits) && integer(v.limits[key]));
const notEligible = (v: Record<string, unknown>) => v.status === 'not_eligible' &&
  ['missing', 'pending', 'approved', 'rejected', 'revoked', 'expired', 'eligibility_expired'].includes(String(v.reason));

function reserveReply(v: unknown): v is ReserveResult {
  if (!isRedisObject(v)) return false;
  if (v.status === 'cost_model_invalid' || v.status === 'epoch_rejected' || notEligible(v)) return true;
  if (v.status === 'reserved') return v.executionGrant === true && reservation(v.reservation) && usage(v.usage) && hasLimits(v);
  if (v.status === 'duplicate') return v.executionGrant === false && reservation(v.reservation);
  if (v.status === 'idempotency_conflict') return reservation(v.reservation);
  return v.status === 'denied' && ['day', 'week', 'both'].includes(String(v.deniedWindow)) &&
    ['exhausted', 'below_floor', 'request_insufficient'].includes(String(v.denialClass)) && usage(v.usage) && hasLimits(v);
}
function settleReply(v: unknown): v is SettleResult {
  return isRedisObject(v) && (['not_found', 'overflow'].includes(String(v.status)) ||
    (['applied', 'already_applied', 'invalid_transition', 'settlement_conflict', 'lease_expired'].includes(String(v.status)) && evidence(v)));
}
function addReply(v: unknown): v is AddTopUpResult {
  return isRedisObject(v) && (['window_expired', 'overflow'].includes(String(v.status)) ||
    (['applied', 'duplicate', 'idempotency_conflict'].includes(String(v.status)) && topUp(v.topUp) &&
      integer(v.cumulativeTopUpMicroUsd)));
}
function revokeReply(v: unknown): v is RevokeTopUpResult {
  return isRedisObject(v) && (v.status === 'not_found' ||
    (['applied', 'already_applied'].includes(String(v.status)) && topUp(v.topUp) && integer(v.cumulativeTopUpMicroUsd)));
}
function expiryReply(v: unknown): v is ExpireLeasesResult {
  return isRedisObject(v) && integer(v.expired) && Array.isArray(v.entries) &&
    v.entries.length === v.expired && v.entries.every((entry) => isRedisObject(entry) && evidence(entry));
}
function eligibility(v: unknown): v is EligibilityRecord {
  return isRedisObject(v) && typeof v.identitySubject === 'string' &&
    ['pending', 'approved', 'rejected', 'revoked', 'expired'].includes(String(v.status)) &&
    ['tier1', 'tier2'].includes(String(v.tier)) && typeof v.updatedAt === 'string' &&
    (v.expiresAt === null || typeof v.expiresAt === 'string');
}
function bundle(v: unknown): v is RegistryBundle {
  return isRedisObject(v) && integer(v.registryRevision) && typeof v.bundleDigest === 'string' &&
    isRedisObject(v.table) && Array.isArray(v.entries) && isRedisObject(v.maxReservations);
}
function quotaReply(v: unknown): v is QuotaStateResult {
  return isRedisObject(v) && (notEligible(v) || (v.status === 'ok' && usage(v.usage) && hasLimits(v)));
}
type AtomicQuotaResult = Awaited<ReturnType<NonNullable<SharedStore['readAtomicQuota']>>>;
function atomicReply(v: unknown): v is AtomicQuotaResult {
  return isRedisObject(v) && (notEligible(v) || v.status === 'cost_model_invalid' ||
    (['available', 'denied'].includes(String(v.status)) && usage(v.usage) && hasLimits(v) &&
      isRedisObject(v.registryDecision)));
}

export function createRedisSharedStore(options: RedisStoreOptions): SharedStore & CostRegistry & {
  publishRegistry(value: RegistryBundle): Promise<void>;
  snapshot(): Promise<RegistryBundle>;
} {
  if (options.epochFloor) validateRequestEpochFloor(options.epochFloor, options.namespace);
  const keys = options.epochFloor ? [...REDIS_QUOTA_KEYS(options.namespace),
    `${options.namespace}:request-epoch-authority`, `${options.namespace}:request-epoch-issuances`,
    `${options.namespace}:request-epoch-unused`, `${options.namespace}:request-epoch-owner-counts`] : REDIS_QUOTA_KEYS(options.namespace);
  const driver = createRedisAtomicTransport({ ...options, keys });
  const execute = async <T>(operation: string, command: object, guard: (v: unknown) => v is T,
    digests?: Record<string, string>): Promise<T> => {
    const result = decodeRedisReply(await driver.execute(REDIS_QUOTA_LUA, { operation, command, digests,
      floor: options.epochFloor, rejectLegacy: options.rejectLegacy === true,
      ...(operation === 'publish' ? { bundleJson: JSON.stringify(command) } : {}) }));
    if (!guard(result)) {
      options.audit({ operation: 'redis_atomic', outcome: 'unavailable' });
      throw new SharedStoreUnavailableError('INVALID_REDIS_STORE_DATA');
    }
    return result;
  };
  const digestsOf = (b: RegistryBundle) => Object.fromEntries(b.entries.map((e) => [e.endpoint, costParametersDigest(e)]));
  const snapshot = async (): Promise<RegistryBundle> => {
    const raw = decodeRedisReply(await driver.execute(REDIS_QUOTA_LUA, { operation: 'registrySnapshot' }));
    if (!isRedisObject(raw) || !bundle(raw.bundle) || !integer(raw.revision) ||
        !isRedisObject(raw.versions) || !isRedisObject(raw.parameters) || typeof raw.nowIso !== 'string')
      throw new SharedStoreUnavailableError('INVALID_REGISTRY_AUTHORITY');
    registryDecision(raw.bundle, new Date(raw.nowIso), { versions: new Set(), parameters: new Set() }, true);
    const versions = new Set(Object.keys(raw.versions).filter((key) => raw.versions && isRedisObject(raw.versions) && raw.versions[key] === true));
    const parameters = new Set(Object.keys(raw.parameters).filter((key) => raw.parameters && isRedisObject(raw.parameters) && raw.parameters[key] === true));
    const result = createRegistryBundle(raw.revision, raw.bundle.table, raw.bundle.entries.map((entry) => ({
      ...entry, blocked: entry.blocked || versions.has(entry.version) || parameters.has(costParametersDigest(entry)),
    })));
    registryDecision(result, new Date(raw.nowIso), { versions, parameters }, true);
    return result;
  };
  return {
    snapshot,
    async resolve(endpoint) { return (await snapshot()).entries.find((e) => e.endpoint === endpoint) ?? null; },
    async publishRegistry(value) {
      registryDecision(value, new Date(value.table.effectiveFrom), { versions: new Set(), parameters: new Set() }, true);
      await execute('publish', value, (v): v is { status: 'published' } => isRedisObject(v) && v.status === 'published', digestsOf(value));
    },
    async reserve(command) {
      if (command.requestEpoch && !options.epochFloor) throw new SharedStoreUnavailableError('EPOCH_AUTHORITY_REQUIRED');
      if (command.requestEpoch && command.comparisonCost) {
        const prior = await execute('getEpochBinding', { identitySubject: command.identitySubject,
          accountingIndex: command.requestEpoch.accountingIndex },
          (v): v is ReservationRecord | null => v === null || reservation(v));
        if (prior) return execute('reserve', command, reserveReply);
      }
      const b = command.expectedRegistry;
      if (!b) throw new SharedStoreUnavailableError('ATOMIC_REGISTRY_REQUIRED');
      registryDecision(b, new Date(command.nowIso), { versions: new Set(), parameters: new Set() });
      const entry = b.entries.find((e) => e.endpoint === command.endpoint);
      if (!entry || command.costParametersDigest !== costParametersDigest(entry))
        throw new SharedStoreUnavailableError('INVALID_COST_BINDING');
      const input = validateEstimateInputs(command.endpoint, command.estimateInputs, entry.estimateBounds);
      const estimate = estimateReservation({ endpoint: command.endpoint, table: entry.table,
        model: entry.model ?? undefined, input, now: new Date(command.nowIso) });
      if (!estimate.ok || estimate.amountMicroUsd !== command.amountMicroUsd)
        throw new SharedStoreUnavailableError('INVALID_COST_ESTIMATE');
      return execute('reserve', command, reserveReply, digestsOf(b));
    },
    settle: (command) => execute('settle', command, settleReply),
    setEligibility: (command) => execute('setEligibility', {
      ...command, expiresAt: command.expiresAt === null ? null : new Date(command.expiresAt).toISOString(),
    }, eligibility),
    addTopUp: (command) => execute('addTopUp', command, addReply),
    revokeTopUp: (command) => execute('revokeTopUp', command, revokeReply),
    expireLeases: (identitySubject, nowIso) => execute('expireLeases', { identitySubject, nowIso }, expiryReply),
    getReservation: (identitySubject, reservationId) => execute('getReservation', { identitySubject, reservationId },
      (v): v is ReservationRecord | null => v === null || reservation(v)),
    getEpochBinding: (identitySubject, accountingIndex) => execute('getEpochBinding', { identitySubject, accountingIndex },
      (v): v is ReservationRecord | null => v === null || reservation(v)),
    readUsage: (identitySubject, dayWindowKey, weekWindowKey) =>
      execute('readUsage', { identitySubject, dayWindowKey, weekWindowKey }, usage),
    readQuota: (identitySubject, day, week, tierLimits, nowIso) =>
      execute('readQuota', { identitySubject, day, week, tierLimits, nowIso }, quotaReply),
    readAtomicQuota: (command) => execute('readAtomicQuota', command, atomicReply, digestsOf(command.expectedRegistry)),
  };
}
