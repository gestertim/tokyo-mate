import { createSecretKey } from 'node:crypto';
import { validateRunnerPlan, type RunnerPlan } from '../../scripts/005-isolated-runner.mjs';
import { isRecord } from './http';
import { validateOidcConfig, type OidcConfig } from './oidc-config';
import { createOidcLibraryAdapter, type OidcVerificationPolicy } from './oidc-provider';
import { createRedisRestTransport } from './redis-rest-transport';
import { REDIS_QUOTA_KEYS } from './redis-shared-store';
import { validRequestEpochAuthority, validateRequestEpochFloor } from './request-epoch-authority';
import type { RequestEpochAuthority, RequestEpochFloor } from './request-epoch-store';
import { CostRegistryError, registryDecision, type RegistryBundle } from './cost-registry';
import { adminSubjectValid } from './admin-store';
import { SESSION_POLICY, STORE_POLICY } from './local-protection-policy';

export type IsolatedKeyFamily = 'capability' | 'fingerprint' | 'oauth_state' | 'rate';
export interface IsolatedKeyEntry {
  version: string;
  key: Uint8Array;
  state: 'current' | 'verify_only' | 'revoked';
}
export interface IsolatedKeyring { current: string; entries: IsolatedKeyEntry[] }
export interface IsolatedEnvironment {
  scope: 'TEST_ONLY';
  network: 'blocked';
  namespace: string;
  rest: { url: string; token: string };
  oidc: { config: OidcConfig; clientSecret: string; policy: OidcVerificationPolicy };
  adminSubjects: string[];
  keyrings: Record<IsolatedKeyFamily, IsolatedKeyring>;
  epochFloor: RequestEpochFloor;
  authority: RequestEpochAuthority;
  registry: { scope: 'TEST_ONLY'; bundle: RegistryBundle };
  runner: RunnerPlan;
}

export class IsolatedEnvironmentError extends TypeError {
  constructor() { super('TEST_ONLY_ENVIRONMENT_INVALID'); this.name = 'IsolatedEnvironmentError'; }
}
const reject = (): never => { throw new IsolatedEnvironmentError(); };
const exact = (v: unknown, fields: readonly string[]): v is Record<string, unknown> =>
  isRecord(v) && Object.keys(v).length === fields.length && fields.every((name) => Object.hasOwn(v, name));
const families: readonly IsolatedKeyFamily[] = ['capability', 'fingerprint', 'oauth_state', 'rate'];

function assertEnvironmentShape(value: unknown): asserts value is IsolatedEnvironment {
  if (!exact(value, ['scope', 'network', 'namespace', 'rest', 'oidc', 'adminSubjects', 'keyrings',
    'epochFloor', 'authority', 'registry', 'runner']) ||
      value.scope !== 'TEST_ONLY' || value.network !== 'blocked' ||
      typeof value.namespace !== 'string' || !/^\{preview-[A-Za-z0-9_-]+\}$/.test(value.namespace) ||
      !exact(value.rest, ['url', 'token']) || typeof value.rest.url !== 'string' || typeof value.rest.token !== 'string' ||
      !exact(value.oidc, ['config', 'clientSecret', 'policy']) ||
      !exact(value.oidc.config, ['issuer', 'clientId', 'origin', 'callbackUrl', 'stateCookieName', 'stateLifetimeMs', 'timeoutMs']) ||
      !exact(value.oidc.policy, ['jwksUri', 'allowedAlgorithms', 'maxTokenAgeSeconds', 'maxIdTokenBytes', 'maxCodeBytes']) ||
      typeof value.oidc.clientSecret !== 'string' ||
      !Array.isArray(value.adminSubjects) || value.adminSubjects.length === 0 ||
      !value.adminSubjects.every((subject) => adminSubjectValid(subject) &&
        typeof subject === 'string' && /^[A-Za-z0-9_.:@/-]{1,128}$/.test(subject)) ||
      new Set(value.adminSubjects).size !== value.adminSubjects.length ||
      !exact(value.keyrings, families) ||
      !exact(value.epochFloor, ['namespace', 'highestGeneration', 'authorityRevision', 'retiredThrough', 'revokedKids', 'evidenceDigest']) ||
      !exact(value.authority, ['authorityRevision', 'highestGeneration', 'retiredThrough', 'currentEpochId', 'epochs', 'revokedKids']) ||
      !validRequestEpochAuthority(value.authority) ||
      !exact(value.registry, ['scope', 'bundle']) || value.registry.scope !== 'TEST_ONLY') return reject();
  const seen = new Set<string>();
  for (const family of families) {
    const ring = value.keyrings[family];
    if (!exact(ring, ['current', 'entries']) || typeof ring.current !== 'string' ||
        !Array.isArray(ring.entries) || ring.entries.length === 0 || ring.entries.length > 64) return reject();
    const versions = new Set<string>();
    let currents = 0;
    for (const entry of ring.entries) {
      if (!exact(entry, ['version', 'key', 'state']) || typeof entry.version !== 'string' ||
          !(family === 'capability' ? /^[A-Za-z0-9_-]{22}$/ : /^[A-Za-z0-9_-]{1,64}$/).test(entry.version) ||
          versions.has(entry.version) || !(entry.key instanceof Uint8Array) || entry.key.byteLength !== 32 ||
          !['current', 'verify_only', 'revoked'].includes(String(entry.state))) return reject();
      versions.add(entry.version);
      const bytes = Buffer.from(entry.key).toString('hex');
      if (seen.has(bytes)) return reject();
      seen.add(bytes);
      if (entry.state === 'current') { currents++; if (entry.version !== ring.current) return reject(); }
    }
    if (currents !== 1 || !versions.has(ring.current)) return reject();
  }
}

export function validateIsolatedEnvironment(value: unknown): IsolatedEnvironment {
  assertEnvironmentShape(value);
  const config = value;
  try {
    REDIS_QUOTA_KEYS(config.namespace);
    if (new URL(config.rest.url).port) return reject();
    createRedisRestTransport({ ...config.rest, ...STORE_POLICY, fetch: async () => { throw new Error('TEST_ONLY_NETWORK_BLOCKED'); } });
    validateOidcConfig(config.oidc.config);
    if (config.oidc.config.stateLifetimeMs !== SESSION_POLICY.stateLifetimeMs ||
        config.oidc.config.timeoutMs !== STORE_POLICY.timeoutMs ||
        !Array.isArray(config.oidc.policy.allowedAlgorithms) ||
        new Set(config.oidc.policy.allowedAlgorithms).size !== config.oidc.policy.allowedAlgorithms.length) return reject();
    createOidcLibraryAdapter({ ...config.oidc, now: () => new Date(0),
      library: { exchangeAndVerify: async () => { throw new Error('TEST_ONLY_NETWORK_BLOCKED'); } } });
    validateRequestEpochFloor(config.epochFloor, config.namespace);
    const a = config.authority, f = config.epochFloor;
    if (a.highestGeneration < f.highestGeneration || a.authorityRevision < f.authorityRevision ||
        a.retiredThrough < f.retiredThrough || new Set(f.revokedKids).size !== f.revokedKids.length ||
        new Set(a.revokedKids).size !== a.revokedKids.length ||
        f.revokedKids.some((kid) => !a.revokedKids.includes(kid))) return reject();
    for (const epoch of Object.values(a.epochs)) {
      if (!exact(epoch, ['epochId', 'generation', 'kid', 'scopeKeyVersion', 'state',
        'issueStartsAtMs', 'issueExpiresAtMs', 'validUntilMs'])) return reject();
      if (![epoch.issueStartsAtMs, epoch.issueExpiresAtMs, epoch.validUntilMs]
        .every((time) => Number.isFinite(new Date(time).getTime()))) return reject();
      if (epoch.state === 'retired') continue;
      const signing = config.keyrings.capability.entries.find((key) => key.version === epoch.kid);
      const scope = config.keyrings.fingerprint.entries.find((key) => key.version === epoch.scopeKeyVersion);
      if (!signing || !scope || signing.state === 'revoked' || scope.state === 'revoked' ||
          (epoch.state === 'current' && (signing.state !== 'current' || a.revokedKids.includes(epoch.kid) ||
            epoch.generation <= a.retiredThrough))) return reject();
    }
    registryDecision(config.registry.bundle, new Date(config.authority.epochs[config.authority.currentEpochId].issueStartsAtMs),
      { versions: new Set(), parameters: new Set() }, true);
    if (config.registry.bundle.table.endpoints.speech.live) return reject();
    const runner = validateRunnerPlan(config.runner);
    if (runner.namespace !== config.namespace) return reject();
    return { ...structuredClone(config), runner };
  } catch (error) {
    if (!(error instanceof TypeError) && !(error instanceof CostRegistryError)) throw error;
    return reject();
  }
}

export function currentIsolatedKey(ring: IsolatedKeyring): IsolatedKeyEntry {
  const key = ring.entries.find((entry) => entry.version === ring.current && entry.state === 'current');
  if (!key) return reject();
  return key;
}
export function isolatedFingerprintKeys(ring: IsolatedKeyring) {
  return ring.entries.filter((entry) => entry.state !== 'revoked')
    .map((entry) => ({ version: entry.version, key: createSecretKey(entry.key), state: entry.state }));
}
