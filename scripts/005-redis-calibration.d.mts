export interface CalibrationLimits {
  restRequestsMax: 4;
  logicalCommandsMax: 10;
  operationTimeoutMs: 2000;
  windowMs: 20000;
  maxResponseBytes: 4096;
  maxRequestBodyBytes: 2048;
  markerTtlMs: 60000;
  markerLength: 32;
  inventoryKeys: 1;
  maxSecretLength: 4096;
}
export type CalibrationOperationId = 'probe' | 'write' | 'verify' | 'cleanup';
export interface CalibrationOperation {
  id: CalibrationOperationId;
  mutation: boolean;
  purpose: string;
  maxDispatch: 1;
  keys: readonly string[];
  script: string;
  scriptSha256: string;
  innerCalls: readonly string[];
  logicalCommandsMax: number;
}
export interface CalibrationPlan {
  readonly scope: 'TEST_ONLY_CALIBRATION';
  readonly version: 1;
  readonly namespace: string;
  readonly inventory: readonly string[];
  readonly limits: Readonly<CalibrationLimits>;
  readonly operations: readonly Readonly<CalibrationOperation>[];
  readonly envelope: {
    readonly restRequestsMax: number;
    readonly logicalCommandsMax: number;
    readonly logicalCommandsDefinition: string;
    readonly providerMetering: 'unverified';
    readonly billableUpperBound: null;
    readonly usageSource: 'not_used_manual_console_observation_only';
  };
  readonly templateDigest: string;
}
export interface CalibrationCredentials { url: string; token: string }
export type CalibrationResult = { readonly status: 'ok'; readonly result: unknown } | { readonly status: 'unknown' };
export interface CalibrationDispatcher {
  readonly count: number;
  remaining(): number;
  send(operationId: CalibrationOperationId, keys: readonly string[], args: Record<string, unknown>,
    signal?: AbortSignal): Promise<CalibrationResult>;
}
export interface CalibrationPorts {
  fetch: typeof fetch;
  readSecrets(): Promise<CalibrationCredentials>;
  now?: () => number;
}
export interface CalibrationControl { stopSignal?: AbortSignal; abortSignal?: AbortSignal }
export interface CalibrationReport {
  readonly scope: 'TEST_ONLY_CALIBRATION';
  readonly evidence: 'calibration_caller_report';
  readonly mode: 'execute';
  readonly templateDigest: string;
  readonly namespace: string;
  readonly inventory: readonly string[];
  readonly status: 'completed' | 'stopped';
  readonly reason: 'finished' | 'interrupted' | 'aborted' | 'secret_invalid' | 'deadline' | 'probe_failed' |
    'write_conflict' | 'write_unresolved' | 'confirmation_unknown' | 'contradiction' | 'cleanup_unconfirmed';
  readonly restRequests: number;
  readonly restRequestsMax: number;
  readonly logicalCommandsUpperBound: number;
  readonly logicalCommandsMax: number;
  readonly providerMetering: 'unverified';
  readonly billableUpperBound: null;
  readonly operations: {
    readonly probe: 'not_dispatched' | 'ok' | 'failed';
    readonly write: 'not_dispatched' | 'completed' | 'conflict' | 'unknown';
    readonly verify: 'not_dispatched' | 'present' | 'absent' | 'mismatch' | 'ttl_invalid' | 'unknown';
    readonly cleanup: 'not_dispatched' | 'cleaned' | 'absent' | 'mismatch' | 'unknown';
  };
  readonly write: 'not_dispatched' | 'conflict_not_ours' | 'unknown' | 'completed_unverified' | 'written_confirmed';
  readonly observedPttlMs: number | null;
  readonly cleanup: 'not_needed' | 'not_ours' | 'withheld_unresolved' | 'withheld_deadline' | 'not_attempted_aborted' |
    'cleaned' | 'absent' | 'mismatch' | 'unknown';
  readonly manualFollowUp: boolean;
}
export interface HiddenPromptInput {
  isTTY?: boolean;
  setRawMode?(mode: boolean): unknown;
  setEncoding(encoding: 'utf8'): unknown;
  on(event: 'data', listener: (chunk: string) => void): unknown;
  off(event: 'data', listener: (chunk: string) => void): unknown;
  resume(): unknown;
  pause(): unknown;
}
export interface CalibrationIo {
  stdout: { write(text: string): unknown };
  stderr: { write(text: string): unknown };
  fetch: typeof fetch;
  readSecrets(): Promise<CalibrationCredentials>;
  stopSignal?: AbortSignal;
  abortSignal?: AbortSignal;
}
export class CalibrationError extends Error { readonly code: string }
export const CALIBRATION_LIMITS: Readonly<CalibrationLimits>;
export const CALIBRATION_TEMPLATE_DIGEST: string;
export function createCalibrationPlan(randomId?: string): CalibrationPlan;
export function validateCalibrationPlan(value: unknown): CalibrationPlan;
export function createGuardedDispatcher(plan: CalibrationPlan, credentials: CalibrationCredentials,
  fetchImpl: typeof fetch, options?: { now?: () => number }): CalibrationDispatcher;
export function runCalibration(plan: CalibrationPlan, ports: CalibrationPorts, control?: CalibrationControl): Promise<CalibrationReport>;
export function describeDryRun(plan?: CalibrationPlan): {
  readonly scope: 'TEST_ONLY_CALIBRATION';
  readonly mode: 'dry_run';
  readonly networkDispatched: 0;
  readonly secretsRead: false;
  readonly templateDigest: string;
  readonly namespaceNote: string;
  readonly executeCommand: string;
  readonly interruption: string;
  readonly plan: CalibrationPlan;
};
export function promptHidden(label: string, streams?: { input?: HiddenPromptInput; output?: { write(text: string): unknown } }): Promise<string>;
export function promptCredentials(streams?: { input?: HiddenPromptInput; output?: { write(text: string): unknown } }): Promise<CalibrationCredentials>;
export function main(argv: readonly string[], io: CalibrationIo): Promise<number>;
