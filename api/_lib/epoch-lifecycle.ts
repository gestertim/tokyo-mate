export type EpochKeyFamily = 'capability' | 'fingerprint' | 'oauth_state' | 'rate';
export type EpochLifecycleAction = 'review_uncertain' | 'retire_epoch' | 'revoke_key' | 'rotate_key' | 'retire_key' | 'cleanup';
export interface EpochLifecycleInput {
  operationId: string;
  idempotencyKey: string;
  step: 'inspect' | 'confirm';
  action: EpochLifecycleAction;
  target: string;
  reasonCode: string;
  evidenceRef?: string;
  nextVersion?: string;
  dryRun: boolean;
}
export interface EpochLifecycleCommand extends EpochLifecycleInput {
  actor: string;
  auditId: string;
}
export interface EpochCleanupEvidence {
  billingWindowSufficient: boolean;
  allDeploymentsEpochAware: boolean;
  restoreBarrierVerified: boolean;
  unknownIssuancesBlocked: boolean;
  allKeyReferencesZero: boolean;
}
export interface EpochLifecyclePolicy {
  retentionMs: number;
  issuanceRetentionMs: number;
  firstReviewMs: number;
  reviewEveryMs: number;
  escalateMs: number;
  rotationMs: number;
}
export const LOCAL_EPOCH_LIFECYCLE_POLICY: Readonly<EpochLifecyclePolicy> = Object.freeze({
  retentionMs: 30 * 86400000, issuanceRetentionMs: 86400000,
  firstReviewMs: 86400000, reviewEveryMs: 7 * 86400000,
  escalateMs: 30 * 86400000, rotationMs: 90 * 86400000,
});
export interface EpochLifecycleResult {
  outcome: 'inspected' | 'applied' | 'duplicate' | 'conflict' | 'refused' | 'dry_run' | 'not_found';
  auditId?: string;
  reason?: string;
  changed?: number;
}
export interface EpochLifecycleStore {
  execute(command: EpochLifecycleCommand): Promise<EpochLifecycleResult>;
}
export function isEpochLifecycleInput(value: unknown): value is EpochLifecycleInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).every((key) => ['operationId', 'idempotencyKey', 'step', 'action', 'target',
    'reasonCode', 'evidenceRef', 'nextVersion', 'dryRun'].includes(key)) &&
    ['operationId', 'idempotencyKey', 'reasonCode'].every((key) =>
      typeof v[key] === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v[key])) &&
    (v.step === 'inspect' || v.step === 'confirm') &&
    ['review_uncertain', 'retire_epoch', 'revoke_key', 'rotate_key', 'retire_key', 'cleanup'].includes(String(v.action)) &&
    typeof v.target === 'string' && /^[A-Za-z0-9_.:-]{1,256}$/.test(v.target) &&
    typeof v.dryRun === 'boolean' &&
    (v.evidenceRef === undefined || typeof v.evidenceRef === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v.evidenceRef)) &&
    (v.nextVersion === undefined || typeof v.nextVersion === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v.nextVersion));
}
