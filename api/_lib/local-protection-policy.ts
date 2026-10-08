import type { ProtectedEndpoint } from './cost-price-table';

export const INPUT_POLICY = Object.freeze({
  maxDepth: 8, maxNodes: 256, readTimeoutMs: 5000, promptBytes: 4096, knowledgeBytes: 16384,
  maxBytes: Object.freeze({
    assistant: 16384, 'photo-translate': 16384, 'photo-ocr': 4200000,
    places: 2048, speech: 4096, transcribe: 2000000,
  }),
});
export const STORE_POLICY = Object.freeze({ timeoutMs: 2000, maxResponseBytes: 1048576 });
export const SESSION_POLICY = Object.freeze({
  lifetimeMs: 86400000, stateLifetimeMs: 300000, expiredRetentionMs: 86400000,
});
export const ADMIN_NEAR_LIMIT_PERCENT = 80;
export const TILE_RESOURCE_POLICY = Object.freeze({
  upstreamTimeoutMs: 8000, dispatchMarginMs: 2000, settlementBufferMs: 5000,
  flightLeaseMs: 15000, waitTimeoutMs: 8000, pollIntervalMs: 100, maxTileBytes: 1048576,
});
const ai = Object.freeze({ executionTimeoutMs: 30000, dispatchMarginMs: 5000, settlementBufferMs: 10000, leaseMs: 45000 });
export const EXECUTION_POLICY = Object.freeze({
  assistant: ai, 'photo-ocr': ai, 'photo-translate': ai,
  places: Object.freeze({ executionTimeoutMs: 8000, dispatchMarginMs: 5000, settlementBufferMs: 5000, leaseMs: 18000 }),
  transcribe: Object.freeze({ executionTimeoutMs: 45000, dispatchMarginMs: 5000, settlementBufferMs: 10000, leaseMs: 60000 }),
  speech: null,
} satisfies Record<ProtectedEndpoint, {
  executionTimeoutMs: number; dispatchMarginMs: number; settlementBufferMs: number; leaseMs: number;
} | null>);

export const RATE_POLICY = Object.freeze({
  admission: 60, paid_subject: 20, oauth_login: 10, oauth_callback: 60,
  admin_read: 60, admin_write: 10, me_read: 60, operation_status: 30, request_write: 10, request_epoch: 10,
});
export type RateBucket = keyof typeof RATE_POLICY;
