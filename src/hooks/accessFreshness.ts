export interface AccessFreshnessPolicy { maxAgeMs: number; now(): number }
export const ACCESS_FRESHNESS_POLICY: AccessFreshnessPolicy = Object.freeze({
  maxAgeMs: 30000, now: () => Date.now(),
});
