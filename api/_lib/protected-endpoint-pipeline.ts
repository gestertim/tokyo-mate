import { isDeepStrictEqual } from 'node:util';
import type { RequestContent } from './quota-fingerprint';
import { CostRegistryError, costParametersDigest, estimateRegistryCost, registryDecision,
  type RegistryBundle, type CostRegistry, type CostRegistryEntry } from './cost-registry';
import { PROTECTED_ENDPOINTS, type CostPriceTable, type ProtectedEndpoint } from './cost-price-table';
import type { EstimateInputs } from './quota-estimate-inputs';
import type { QuotaEngine } from './quota-engine';
import { computeGlobalFloor, evaluateAvailability } from './quota-threshold';
import { errorResponse, type TrustedPublicRejection } from './error-envelope';
import { isRecord, success } from './http';
import { RequestBoundaryError as BoundaryFailure, readBoundedJson as boundedJson } from './bounded-request';
import type { RequestEpochVerifier } from './request-epoch-execution';

export interface TrustedIngressContext { admissionKey: string }
export type SessionResult =
  | { kind: 'authenticated'; subject: string; expiresAt: number; revokedAt: number | null }
  | { kind: 'unauthenticated' | 'unavailable' };
export interface SessionVerifier { lookup(cookie: string, now: Date): Promise<SessionResult> }
export type RateResult = { kind: 'allowed' | 'unavailable' } | { kind: 'limited'; retryAfterSeconds?: number };
export interface RateLimiter { consume(key: string, endpoint: ProtectedEndpoint, now: Date): Promise<RateResult> }
export interface PinnedCostContext {
  scope?: 'TEST_ONLY';
  registryBundle?: RegistryBundle;
  table: CostPriceTable;
  entries: CostRegistryEntry[];
  blockEvidence: { endpoint: ProtectedEndpoint; version: string; digest: string; versionBlocked: boolean; parametersBlocked: boolean }[];
}
export interface CostContextProvider { resolve(endpoint: ProtectedEndpoint, now: Date): Promise<PinnedCostContext | null> }
export type MockObservation<Output> =
  | { kind: 'success'; data: Output; settlementEstimateMicroUsd?: number }
  | { kind: 'explicit_unbilled_failure' | 'uncertain' };
export interface MockUpstream<Input, Output> { execute(input: Input, signal: AbortSignal): Promise<MockObservation<Output>> }
export interface EndpointPolicy<Input, Output> {
  endpoint: ProtectedEndpoint;
  cookieName: string;
  resources: {
    maxBytes: number; maxDepth: number; maxNodes: number; readTimeoutMs: number; dependencyTimeoutMs: number;
    executionTimeoutMs: number; settlementBufferMs: number; leaseMs: number;
  };
  parse?(request: Request, resources: EndpointPolicy<Input, Output>['resources'],
    audit: (event: { stage: string; outcome: string }) => void): Promise<unknown>;
  validate(body: unknown): { ok: true; input: Input; content: RequestContent }
    | { ok: false; code: 'INVALID_INPUT' | 'PAYLOAD_TOO_LARGE' }
    | Promise<{ ok: true; input: Input; content: RequestContent }
    | { ok: false; code: 'INVALID_INPUT' | 'PAYLOAD_TOO_LARGE' }>;
  deriveEstimateInputs(input: Input, pinnedCost: PinnedCostContext): EstimateInputs;
  upstream: MockUpstream<Input, Output>;
}
export interface PipelineDependencies {
  origin?: string;
  epochs?: RequestEpochVerifier;
  rejectLegacy?: boolean;
  sessions: SessionVerifier; admission: RateLimiter; rate: RateLimiter; cost: CostContextProvider;
  now(): Date;
  makeEngine(registry?: CostRegistry): QuotaEngine;
  audit(event: { stage: string; outcome: string }): void;
}
const keyValid = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_.:@/-]{1,128}$/.test(v);
const unavailable = (): TrustedPublicRejection => ({ kind: 'code', code: 'PROTECTION_SERVICE_UNAVAILABLE' });

async function deadline<T>(promise: Promise<T>, ms: number, code: BoundaryFailure['code'], abort?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { abort?.(); reject(new BoundaryFailure(code)); }, ms);
    })]);
  } finally { clearTimeout(timer); }
}

async function pinCost(source: PinnedCostContext | null, endpoint: ProtectedEndpoint, now: Date) {
  if (!source) throw new BoundaryFailure('PROTECTION_SERVICE_UNAVAILABLE');
  const pinned = structuredClone(source);
  if (pinned.registryBundle) {
    const bundle = pinned.registryBundle;
    const decision = registryDecision(bundle, now, { versions: new Set(), parameters: new Set() });
    if (!isDeepStrictEqual(bundle.table, pinned.table) || !decision.liveEndpoints.includes(endpoint))
      throw new BoundaryFailure('PROTECTION_SERVICE_UNAVAILABLE');
    const table = structuredClone(bundle.table);
    for (const e of PROTECTED_ENDPOINTS) table.endpoints[e].live = decision.liveEndpoints.includes(e);
    const registry: CostRegistry = {
      snapshot: async () => structuredClone(bundle),
      resolve: async (e) => bundle.entries.find((entry) => entry.endpoint === e) ?? null,
    };
    return { pinned, table, registry, floor: decision.floorMicroUsd };
  }
  const live = PROTECTED_ENDPOINTS.filter((e) => pinned.table.endpoints[e].live);
  if (!live.length || pinned.entries.length !== live.length || pinned.blockEvidence.length !== live.length)
    throw new BoundaryFailure('PROTECTION_SERVICE_UNAVAILABLE');
  const table = structuredClone(pinned.table);
  const accepted: CostRegistryEntry[] = [];
  for (const e of live) {
    const entries = pinned.entries.filter((entry) => entry.endpoint === e);
    const evidence = pinned.blockEvidence.filter((entry) => entry.endpoint === e);
    if (entries.length !== 1 || evidence.length !== 1) throw new BoundaryFailure('PROTECTION_SERVICE_UNAVAILABLE');
    const entry = entries[0], block = evidence[0];
    if (!isDeepStrictEqual(entry.table, pinned.table) || entry.version !== table.version ||
        block.version !== table.version || block.digest !== costParametersDigest(entry) ||
        typeof block.versionBlocked !== 'boolean' || typeof block.parametersBlocked !== 'boolean' ||
        entry.blocked !== (block.versionBlocked || block.parametersBlocked))
      throw new BoundaryFailure('PROTECTION_SERVICE_UNAVAILABLE');
    if (entry.blocked) { table.endpoints[e].live = false; continue; }
    await estimateRegistryCost({ resolve: async () => entry }, e, {}, now);
    accepted.push(entry);
  }
  const registry: CostRegistry = { resolve: async (e) => accepted.find((entry) => entry.endpoint === e) ?? null };
  const floor = computeGlobalFloor(table);
  if (!floor.ok || !accepted.some((entry) => entry.endpoint === endpoint))
    throw new BoundaryFailure('PROTECTION_SERVICE_UNAVAILABLE');
  return { pinned, table, registry, floor: floor.floorMicroUsd };
}

export function createProtectedEndpointPipeline(deps: PipelineDependencies) {
  function clock(): Date {
    const date = deps.now();
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new BoundaryFailure('PROTECTION_SERVICE_UNAVAILABLE');
    return new Date(date.getTime());
  }
  return {
    async execute<Input, Output>(request: Request, context: TrustedIngressContext, policy: EndpointPolicy<Input, Output>): Promise<Response> {
      let stage = 'method';
      const reject = (rejection: TrustedPublicRejection) => {
        deps.audit({ stage, outcome: rejection.kind === 'code' ? rejection.code : 'quota_denied' });
        return errorResponse(rejection);
      };
      try {
        if (request.method !== 'POST') return reject({ kind: 'code', code: 'METHOD_NOT_ALLOWED' });
        stage = 'policy';
        const r = policy.resources;
        if (!PROTECTED_ENDPOINTS.includes(policy.endpoint) || !Object.values(r).every((n) => Number.isSafeInteger(n) && n > 0) ||
            r.executionTimeoutMs + r.settlementBufferMs >= r.leaseMs || !keyValid(context.admissionKey) || !keyValid(policy.cookieName))
          return reject(unavailable());
        stage = 'length';
        const length = request.headers.get('content-length');
        if (length !== null) {
          if (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length))) return reject({ kind: 'code', code: 'INVALID_INPUT' });
          if (Number(length) > r.maxBytes) return reject({ kind: 'code', code: 'PAYLOAD_TOO_LARGE' });
        }
        const consume = async (limiter: RateLimiter, key: string): Promise<Response | null> => {
          const result: unknown = await deadline(limiter.consume(key, policy.endpoint, clock()), r.dependencyTimeoutMs, 'PROTECTION_SERVICE_UNAVAILABLE');
          if (!isRecord(result)) return reject(unavailable());
          if (result.kind === 'allowed') return null;
          if (result.kind === 'limited') return reject({ kind: 'code', code: 'RATE_LIMITED',
            retryAfterSeconds: typeof result.retryAfterSeconds === 'number' ? result.retryAfterSeconds : undefined });
          return reject(unavailable());
        };
        stage = 'admission';
        const admission = await consume(deps.admission, context.admissionKey);
        if (admission) return admission;
        stage = 'session';
        const cookies = (request.headers.get('cookie') ?? '').split(';').map((part) => part.trim());
        const matches = cookies.filter((part) => part.startsWith(`${policy.cookieName}=`));
        if (matches.length !== 1 || matches[0].length <= policy.cookieName.length + 1)
          return reject({ kind: 'code', code: 'AUTH_REQUIRED' });
        const now = clock();
        const session: unknown = await deadline(deps.sessions.lookup(matches[0].slice(policy.cookieName.length + 1), now),
          r.dependencyTimeoutMs, 'PROTECTION_SERVICE_UNAVAILABLE');
        if (!isRecord(session)) return reject(unavailable());
        if (session.kind === 'unauthenticated') return reject({ kind: 'code', code: 'AUTH_REQUIRED' });
        if (session.kind !== 'authenticated' || !keyValid(session.subject) ||
            typeof session.expiresAt !== 'number' || !Number.isSafeInteger(session.expiresAt) ||
            (session.revokedAt !== null && (!Number.isSafeInteger(session.revokedAt) || typeof session.revokedAt !== 'number')))
          return reject(unavailable());
        if (session.expiresAt <= clock().getTime() || session.revokedAt !== null) return reject({ kind: 'code', code: 'AUTH_REQUIRED' });
        const subject = session.subject;
        stage = 'eligibility';
        const engine = deps.makeEngine();
        const snapshot = await deadline(engine.getSnapshot({ identitySubject: subject }), r.dependencyTimeoutMs, 'PROTECTION_SERVICE_UNAVAILABLE');
        if (!snapshot.ok) return reject(snapshot.status === 403 ? { kind: 'code', code: 'ACCESS_NOT_APPROVED' } : unavailable());
        stage = 'subject_rate';
        const limited = await consume(deps.rate, subject);
        if (limited) return limited;
        stage = 'input';
        const body = policy.parse
          ? await policy.parse(request, r, deps.audit)
          : await boundedJson(request, r, deps.audit);
        const validated = await policy.validate(body);
        if (!validated.ok) return reject({ kind: 'code', code: validated.code });
        const idempotencyKey = request.headers.get('idempotency-key');
        if (!keyValid(idempotencyKey)) return reject({ kind: 'code', code: 'INVALID_INPUT' });
        stage = 'capability';
        const token = request.headers.get('x-request-capability');
        if (token && (!isRecord(body) || body.idempotencyKey !== idempotencyKey))
          return reject({ kind: 'code', code: 'INVALID_INPUT' });
        if (token && (!deps.origin || request.headers.get('origin') !== deps.origin ||
            (request.headers.has('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin')))
          return reject(deps.origin ? { kind: 'code', code: 'INVALID_INPUT' } : unavailable());
        if (deps.rejectLegacy && !token) return reject({ kind: 'code', code: 'OPERATION_NO_LONGER_EXECUTABLE' });
        const epoch = token && deps.epochs
          ? await deadline(deps.epochs.verify(subject, policy.endpoint, idempotencyKey, token),
            r.dependencyTimeoutMs, 'PROTECTION_SERVICE_UNAVAILABLE') : null;
        if (token && !deps.epochs) return reject(unavailable());
        if (epoch && !epoch.ok) return reject({ kind: 'code', code: epoch.code });
        stage = 'cost';
        const costNow = clock();
        const cost = await deadline(pinCost(await deadline(deps.cost.resolve(policy.endpoint, costNow),
          r.dependencyTimeoutMs, 'PROTECTION_SERVICE_UNAVAILABLE'), policy.endpoint, costNow),
          r.dependencyTimeoutMs, 'PROTECTION_SERVICE_UNAVAILABLE');
        const inputs = policy.deriveEstimateInputs(validated.input, structuredClone(cost.pinned));
        const estimate = await estimateRegistryCost(cost.registry, policy.endpoint, inputs, costNow);
        // 非 Places 成功僅接受明確標記的隔離合成 accounting context。
        if (policy.endpoint !== 'places' && cost.pinned.scope !== 'TEST_ONLY') return reject(unavailable());
        if (!cost.pinned.registryBundle && estimate.amountMicroUsd < cost.floor) return reject(unavailable());
        stage = 'reserve';
        const pinnedEngine = deps.makeEngine(cost.registry);
        const reserved = await pinnedEngine.reserve({
          identitySubject: subject, endpoint: policy.endpoint, idempotencyKey, content: validated.content,
        }, inputs, epoch?.ok ? epoch.execution : undefined);
        if (!reserved.ok) {
          if (reserved.status === 403) return reject({ kind: 'code', code: 'ACCESS_NOT_APPROVED' });
          if (reserved.status === 409) return reject({ kind: 'code', code: reserved.code });
          if (reserved.status === 410) return reject({ kind: 'code', code: reserved.code });
          if (reserved.status === 400) return reject({ kind: 'code', code: 'INVALID_INPUT' });
          if (reserved.status === 503) return reject(unavailable());
          if (reserved.registryDecision && reserved.denialClass &&
              (reserved.deniedWindow === 'day' || reserved.deniedWindow === 'week'))
            return reject({ kind: 'quota', state: reserved.denialClass, window: reserved.deniedWindow });
          const availability = evaluateAvailability({ snapshot: reserved.snapshot, table: cost.table,
            requestReservationMicroUsd: estimate.amountMicroUsd, costModelVersion: estimate.costModel.version, now: clock() });
          if (availability.state === 'available' || availability.state === 'cost_model_invalid') return reject(unavailable());
          return reject({ kind: 'quota', state: availability.state, window: availability.window });
        }
        stage = 'grant';
        const grantedAt = clock().getTime();
        if (reserved.executionGrant !== true || grantedAt < Date.parse(reserved.reservation.createdAt) ||
            Date.parse(reserved.reservation.leaseExpiresAt) !== Date.parse(reserved.reservation.createdAt) + r.leaseMs ||
            grantedAt + r.executionTimeoutMs + r.settlementBufferMs >= Date.parse(reserved.reservation.leaseExpiresAt))
          return reject(unavailable());
        stage = 'upstream';
        const controller = new AbortController();
        let timedOut = false;
        let observation: MockObservation<Output>;
        try {
          const pending = policy.upstream.execute(validated.input, controller.signal);
          void pending.then(() => {
            if (timedOut) deps.audit({ stage: 'upstream', outcome: 'late_observation' });
          }, () => {
            if (timedOut) deps.audit({ stage: 'upstream', outcome: 'late_observation' });
          });
          observation = await deadline(pending, r.executionTimeoutMs, 'PROTECTION_SERVICE_UNAVAILABLE', () => {
            timedOut = true;
            controller.abort();
          });
          if (!observation || !['success', 'explicit_unbilled_failure', 'uncertain'].includes(observation.kind) ||
              (observation.kind === 'success' && !('data' in observation))) {
            deps.audit({ stage, outcome: 'invalid_observation' });
            observation = { kind: 'uncertain' };
          }
        } catch {
          deps.audit({ stage, outcome: 'uncertain_observation' });
          observation = { kind: 'uncertain' };
        }
        stage = 'settle';
        const settled = await pinnedEngine.settle({
          identitySubject: subject, reservationId: reserved.reservation.reservationId,
          outcome: observation.kind === 'success' ? {
            kind: 'success', settlementEstimateMicroUsd: observation.settlementEstimateMicroUsd,
            attempts: 1, standardTier: true, costModelVersion: reserved.reservation.costModelVersion,
          } : { kind: observation.kind },
        });
        if (!('settlementStatus' in settled) || settled.settlementStatus !== 'accounted') return reject(unavailable());
        if (observation.kind !== 'success') return reject({ kind: 'code', code: 'PLACES_SERVICE_UNAVAILABLE' });
        deps.audit({ stage: 'complete', outcome: 'success' });
        return new Response(JSON.stringify(success(observation.data)), {
          status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      } catch (error) {
        deps.audit({ stage, outcome: error instanceof CostRegistryError ? error.reason
          : error instanceof BoundaryFailure ? error.code : 'dependency_failed' });
        return reject(error instanceof BoundaryFailure ? { kind: 'code', code: error.code } : unavailable());
      }
    },
  };
}
