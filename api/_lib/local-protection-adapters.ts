import { createRedisAdminStore } from './admin-redis-store';
import { createRedisOAuthStateStore } from './redis-oauth-state-store';
import { createRedisSessionStore } from './redis-session-store';
import { createRedisTileStore } from './redis-tile-store';
import { createRedisRateLimiter } from './redis-rate-limiter';
import { createRedisMeStore } from './me-store';
import { createSessionService, type SessionOptions } from './session';
import type { RedisStoreOptions } from './redis-shared-store';
import { SESSION_POLICY, STORE_POLICY, TILE_RESOURCE_POLICY, type RateBucket } from './local-protection-policy';
import { validateOidcConfig, type OidcConfig } from './oidc-config';
import { createTileProxyPipeline, type TileProxyOptions } from './tile-proxy-pipeline';
import { createSharpImageVerifier } from './sharp-image-verifier';
import { createOpenidClientProvider } from './openid-client-binding';
import { createRedisRequestEpochStore } from './redis-request-epoch-store';

export { createOpenidClientProvider };
export function createLocalImageVerifier() {
  return createSharpImageVerifier({ timeoutMs: STORE_POLICY.timeoutMs });
}

export function createLocalSessionService(options: Omit<SessionOptions, 'lifetimeMs' | 'storeTimeoutMs'>) {
  return createSessionService({ ...options, lifetimeMs: SESSION_POLICY.lifetimeMs, storeTimeoutMs: STORE_POLICY.timeoutMs });
}
export function localOidcConfig(config: Omit<OidcConfig, 'stateLifetimeMs' | 'timeoutMs'>): OidcConfig {
  return validateOidcConfig({ ...config, stateLifetimeMs: SESSION_POLICY.stateLifetimeMs, timeoutMs: STORE_POLICY.timeoutMs });
}
export function createLocalProtectionStores(options: Omit<RedisStoreOptions, 'timeoutMs'> & { rateHmacKey: Uint8Array }) {
  const base = { ...options, timeoutMs: STORE_POLICY.timeoutMs };
  const sessions = createRedisSessionStore(base);
  const rate = (bucket: RateBucket) => createRedisRateLimiter({ ...base, bucket, hmacKey: options.rateHmacKey });
  return {
    sessions, states: createRedisOAuthStateStore(base),
    admin: createRedisAdminStore(base),
    me: createRedisMeStore(base),
    meRates: { operation: rate('operation_status'), read: rate('me_read'), mutation: rate('request_write') },
    requestEpochs: options.epochFloor ? createRedisRequestEpochStore({ ...base, epochFloor: options.epochFloor }) : undefined,
    requestEpochRate: rate('request_epoch'),
    tiles: createRedisTileStore({ ...base, ...TILE_RESOURCE_POLICY }),
    rate,
    cleanupExpiredSessions(batch: { cursor: string; batchSize: number }) {
      return sessions.cleanup({ ...batch, retentionMs: SESSION_POLICY.expiredRetentionMs });
    },
  };
}
export function createLocalTileProxyPipeline(
  options: Omit<TileProxyOptions, 'timeoutMs' | 'maxTileBytes' | 'upstreamTimeoutMs' | 'flightBudget'>,
) {
  return createTileProxyPipeline({ ...options, timeoutMs: STORE_POLICY.timeoutMs,
    maxTileBytes: TILE_RESOURCE_POLICY.maxTileBytes, upstreamTimeoutMs: TILE_RESOURCE_POLICY.upstreamTimeoutMs,
    flightBudget: { leaseMs: TILE_RESOURCE_POLICY.flightLeaseMs,
      executionTimeoutMs: TILE_RESOURCE_POLICY.upstreamTimeoutMs, settlementBufferMs: TILE_RESOURCE_POLICY.settlementBufferMs } });
}
