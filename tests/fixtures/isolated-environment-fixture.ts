import type { IsolatedEnvironment } from '../../api/_lib/isolated-environment';
import { createRegistryBundle } from '../../api/_lib/cost-registry';
import { FIXTURE_NONE_LIVE } from './cost-price-fixtures';
import { REQUEST_EPOCH_KEYS } from '../../api/_lib/redis-request-epoch-store';
import { PROTECTED_ENDPOINTS } from '../../api/_lib/cost-price-table';
import { fixtureRegistryEntry } from './cost-registry-fixtures';

export function isolatedEnvironmentFixture(): IsolatedEnvironment {
  const namespace = '{preview-local-fixture}';
  const kid = 'A'.repeat(22), epochId = `g1_${'B'.repeat(22)}`;
  const ring = (version: string, byte: number) => ({ current: version,
    entries: [{ version, key: new Uint8Array(32).fill(byte), state: 'current' as const }] });
  return {
    scope: 'TEST_ONLY', network: 'blocked', namespace,
    rest: { url: 'https://fixture-only.upstash.io', token: 'TEST_ONLY_REST' },
    oidc: {
      config: { issuer: 'https://accounts.google.com', clientId: 'TEST_ONLY_CLIENT',
        origin: 'https://fixture.invalid', callbackUrl: 'https://fixture.invalid/api/auth/callback',
        stateCookieName: 'TEST_STATE', stateLifetimeMs: 300000, timeoutMs: 2000 },
      clientSecret: 'TEST_ONLY_OIDC',
      policy: { jwksUri: 'https://www.googleapis.com/oauth2/v3/certs', allowedAlgorithms: ['RS256'],
        maxTokenAgeSeconds: 300, maxIdTokenBytes: 8192, maxCodeBytes: 1024 },
    },
    adminSubjects: ['TEST_ONLY_ADMIN'],
    keyrings: { capability: ring(kid, 1), fingerprint: ring('fp1', 2), oauth_state: ring('state1', 3), rate: ring('rate1', 4) },
    epochFloor: { namespace, highestGeneration: 1, authorityRevision: 1, retiredThrough: 0,
      revokedKids: [], evidenceDigest: 'a'.repeat(64) },
    authority: { authorityRevision: 1, highestGeneration: 1, retiredThrough: 0, revokedKids: [],
      currentEpochId: epochId, epochs: { [epochId]: { epochId, generation: 1, kid, scopeKeyVersion: 'fp1',
        state: 'current', issueStartsAtMs: Date.parse('2026-10-07T00:00:00Z'),
        issueExpiresAtMs: Date.parse('2026-10-08T00:00:00Z'), validUntilMs: Date.parse('2026-10-09T00:00:00Z') } } },
    registry: { scope: 'TEST_ONLY', bundle: createRegistryBundle(1, FIXTURE_NONE_LIVE,
      PROTECTED_ENDPOINTS.map((endpoint) => fixtureRegistryEntry(endpoint, FIXTURE_NONE_LIVE))) },
    runner: { scope: 'TEST_ONLY', namespace, maxBatches: 2, totalCommands: 1000, windowMs: 10000,
      operationTimeoutMs: 500, cleanupReserveMs: 2000, confirmationReserveMs: 1000,
      reserves: { cleanup: 100, usage: 20, confirmation: 100, uncertainty: 50 },
      metering: { ruleRef: 'TEST_ONLY_CONSERVATIVE_RULE', execute: 100, confirm: 10, usage: 2, cleanupPerKey: 5 },
      inventory: [...REQUEST_EPOCH_KEYS(namespace), `${namespace}:oauth-states`, `${namespace}:oauth-state-expiry`] },
  };
}
