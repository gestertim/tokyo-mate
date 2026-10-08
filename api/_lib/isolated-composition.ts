import { randomBytes } from 'node:crypto';
import type { CustomFetch } from 'openid-client';
import { currentIsolatedKey, isolatedFingerprintKeys, validateIsolatedEnvironment } from './isolated-environment';
import { createRedisRestTransport } from './redis-rest-transport';
import { createRedisSharedStore } from './redis-shared-store';
import { createLocalProtectionStores, createOpenidClientProvider } from './local-protection-adapters';
import { createOidcFlow } from './oidc-flow';
import { createAdminAllowlist } from './admin-principal';
import { createQuotaEngine } from './quota-engine';
import { createRequestEpochEndpoints } from './request-epoch-endpoints';
import { createRequestEpochVerifier } from './request-epoch-execution';
import { createSessionEndpoints } from './session-endpoints';
import { createRedisEpochLifecycleStore } from './redis-epoch-lifecycle-store';
import { LOCAL_EPOCH_LIFECYCLE_POLICY } from './epoch-lifecycle';
import type { createSessionService } from './session';
import type { TrustedIngressContext } from './protected-endpoint-pipeline';
import { PROTECTED_ENDPOINTS, type ProtectedEndpoint } from './cost-price-table';
import { SESSION_POLICY, STORE_POLICY } from './local-protection-policy';
import { SharedStoreUnavailableError, withStoreTimeout, type TierLimitTable } from './shared-store';
import { validateTierLimits } from './quota-validation';

export interface IsolatedCompositionPorts {
  scope: 'TEST_ONLY';
  restFetch: typeof fetch;
  oidcFetch: CustomFetch;
  now(): Date;
  ingress(request: Request): TrustedIngressContext;
  tierLimits: TierLimitTable;
  lifecycleEvidence: Parameters<typeof createRedisEpochLifecycleStore>[0]['evidence'];
  audit(event: { stage: 'store' | 'session' | 'oidc' | 'endpoint'; outcome: 'unavailable' | 'rejected' }): void;
}

export function createIsolatedComposition(input: unknown, ports: IsolatedCompositionPorts) {
  const config = validateIsolatedEnvironment(input);
  if (!ports || ports.scope !== 'TEST_ONLY' ||
      ![ports.restFetch, ports.oidcFetch, ports.now, ports.ingress, ports.audit, ports.lifecycleEvidence]
    .every((port) => typeof port === 'function')) throw new TypeError('TEST_ONLY_COMPOSITION_PORTS_REQUIRED');
  const tierLimits = validateTierLimits(ports.tierLimits);
  const inventory = new Set<string>();
  const allowed = new Set(config.runner.inventory);
  const rest = createRedisRestTransport({ ...config.rest, ...STORE_POLICY, fetch: ports.restFetch });
  const transport = {
    async eval(script: string, keys: readonly string[], json: string) {
      if (keys.length === 0 || !keys.every((key) => key.startsWith(`${config.namespace}:`) && allowed.has(key))) {
        ports.audit({ stage: 'store', outcome: 'rejected' });
        throw new SharedStoreUnavailableError('TEST_ONLY_INVENTORY_REQUIRED');
      }
      keys.forEach((key) => inventory.add(key));
      return rest.eval(script, keys, json);
    },
  };
  const base = { namespace: config.namespace, transport, epochFloor: config.epochFloor,
    timeoutMs: STORE_POLICY.timeoutMs, audit: () => ports.audit({ stage: 'store', outcome: 'unavailable' }) };
  const stores = createLocalProtectionStores({ ...base, rateHmacKey: currentIsolatedKey(config.keyrings.rate).key });
  const shared = createRedisSharedStore(base);
  const now = () => {
    const at = ports.now();
    if (!(at instanceof Date) || !Number.isFinite(at.getTime())) throw new SharedStoreUnavailableError('INVALID_TEST_ONLY_CLOCK');
    return new Date(at.getTime());
  };
  const cookieName = 'TEST_ONLY_SESSION';
  const validId = (id: string) => /^[a-f0-9]{64}$/.test(id);
  const cookie = (id: string, age: number) =>
    `${cookieName}=${id}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
  const sessions: ReturnType<typeof createSessionService> = {
    readCookie(request) {
      const candidates = (request.headers.get('cookie') ?? '').split(';').map((part) => part.trim())
        .filter((part) => part.startsWith(`${cookieName}=`));
      return candidates.length === 1 ? candidates[0].slice(cookieName.length + 1) : null;
    },
    async create(subject) {
      if (!/^[A-Za-z0-9_.:@/-]{1,128}$/.test(subject)) throw new TypeError('INVALID_TEST_ONLY_SUBJECT');
      const at = now(), sessionId = randomBytes(32).toString('hex');
      await withStoreTimeout(stores.sessions.create({ sessionId, identitySubject: subject, createdAt: at.toISOString(),
        expiresAt: new Date(at.getTime() + SESSION_POLICY.lifetimeMs).toISOString(), revokedAt: null }), STORE_POLICY.timeoutMs);
      return cookie(sessionId, SESSION_POLICY.lifetimeMs / 1000);
    },
    async lookup(id, at) {
      if (!validId(id)) return { kind: 'unauthenticated' };
      try {
        const record = await withStoreTimeout(stores.sessions.get(id), STORE_POLICY.timeoutMs);
        if (!record) return { kind: 'unauthenticated' };
        const from = Date.parse(record.createdAt), until = Date.parse(record.expiresAt);
        if (!Number.isFinite(at.getTime()) || record.sessionId !== id ||
            !/^[A-Za-z0-9_.:@/-]{1,128}$/.test(record.identitySubject) ||
            !Number.isFinite(from) || !Number.isFinite(until) || until - from !== SESSION_POLICY.lifetimeMs ||
            from > at.getTime() || (record.revokedAt !== null && !Number.isFinite(Date.parse(record.revokedAt))))
          throw new SharedStoreUnavailableError('INVALID_TEST_ONLY_SESSION');
        return until <= at.getTime() || record.revokedAt !== null ? { kind: 'unauthenticated' } :
          { kind: 'authenticated', subject: record.identitySubject, expiresAt: until, revokedAt: null };
      } catch (error) {
        ports.audit({ stage: 'session', outcome: 'unavailable' });
        if (!(error instanceof Error)) throw error;
        return { kind: 'unavailable' };
      }
    },
    async logout(id) {
      if (id && validId(id)) await withStoreTimeout(stores.sessions.revoke(id, now().toISOString()), STORE_POLICY.timeoutMs);
      return cookie('', 0);
    },
  };
  const provider = createOpenidClientProvider({ ...config.oidc, now, transport: ports.oidcFetch });
  const auth = createOidcFlow({ config: config.oidc.config,
    stateSigningKey: currentIsolatedKey(config.keyrings.oauth_state).key, states: stores.states, provider, sessions, now,
    audit: (event) => ports.audit({ stage: 'oidc', outcome: event.outcome === 'unavailable' ? 'unavailable' : 'rejected' }) });
  const engine = createQuotaEngine({ store: shared, costRegistry: shared, tierLimits,
    fingerprintKeys: isolatedFingerprintKeys(config.keyrings.fingerprint), now, storeTimeoutMs: STORE_POLICY.timeoutMs });
  const signingKeys = config.keyrings.capability.entries.map((entry) => ({ kid: entry.version, key: entry.key, state: entry.state }));
  const epochs = stores.requestEpochs;
  if (!epochs) throw new TypeError('TEST_ONLY_EPOCH_AUTHORITY_REQUIRED');
  const endpointOptions = { sessions, now, origin: config.oidc.config.origin, timeoutMs: STORE_POLICY.timeoutMs,
    audit: () => ports.audit({ stage: 'endpoint', outcome: 'rejected' }) };
  const issuance = createRequestEpochEndpoints({ ...endpointOptions, engine, store: epochs,
    admission: stores.rate('admission'), rate: stores.requestEpochRate, ingress: ports.ingress,
    signingKeys, ownerScopeKeys: config.keyrings.fingerprint.entries });
  const verifier = createRequestEpochVerifier({ store: epochs, signingKeys, scopeKeys: config.keyrings.fingerprint.entries });
  const lifecycle = createRedisEpochLifecycleStore({ ...base, scope: 'TEST_ONLY',
    policy: LOCAL_EPOCH_LIFECYCLE_POLICY, evidence: ports.lifecycleEvidence });
  const paid = Object.fromEntries(PROTECTED_ENDPOINTS.map((endpoint) => [endpoint, Object.freeze({
    async execute() {
      return endpoint === 'speech' ? { kind: 'blocked' as const } : { kind: 'mock' as const, scope: 'TEST_ONLY' as const };
    },
  })])) as Record<ProtectedEndpoint, { execute(): Promise<{ kind: 'blocked' } | { kind: 'mock'; scope: 'TEST_ONLY' }> }>;
  return {
    scope: 'TEST_ONLY' as const, stores, shared, sessions, auth, provider, engine, epochs, issuance, verifier, lifecycle,
    sessionEndpoints: createSessionEndpoints(endpointOptions), admin: createAdminAllowlist(config.adminSubjects), paid,
    inventory: () => [...inventory].sort(),
    async cleanupInventory(keys: readonly string[], signal: AbortSignal): Promise<'cleaned' | 'unknown'> {
      if (keys.length !== allowed.size || new Set(keys).size !== allowed.size || !keys.every((key) => allowed.has(key))) {
        ports.audit({ stage: 'store', outcome: 'rejected' });
        throw new TypeError('TEST_ONLY_EXACT_INVENTORY_REQUIRED');
      }
      const cleanupTransport = createRedisRestTransport({ ...config.rest, ...STORE_POLICY,
        fetch: (url, init) => ports.restFetch(url, { ...init,
          signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal }) });
      for (const key of keys) {
        signal.throwIfAborted();
        const result = await cleanupTransport.eval("return redis.call('DEL', KEYS[1])", [key], '{}');
        if (result !== 0 && result !== 1) {
          ports.audit({ stage: 'store', outcome: 'unavailable' });
          return 'unknown';
        }
      }
      return 'cleaned';
    },
  };
}
