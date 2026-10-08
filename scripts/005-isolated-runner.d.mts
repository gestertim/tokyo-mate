export interface RunnerPlan {
  scope: 'TEST_ONLY';
  namespace: string;
  maxBatches: number;
  totalCommands: number;
  windowMs: number;
  operationTimeoutMs: number;
  cleanupReserveMs: number;
  confirmationReserveMs: number;
  reserves: { cleanup: number; usage: number; confirmation: number; uncertainty: number };
  metering: {
    ruleRef: string;
    execute: number;
    confirm: number;
    usage: number;
    cleanupPerKey: number;
  };
  inventory: string[];
}
export interface RunnerPorts {
  execute(client: { slot: number; sequence: number; processId: number }, signal: AbortSignal): Promise<'completed' | 'unknown'>;
  confirm(client: { slot: number; sequence: number; processId: number }, signal: AbortSignal): Promise<'confirmed' | 'unknown'>;
  usage(signal: AbortSignal): Promise<number>;
  cleanup(keys: readonly string[], signal: AbortSignal): Promise<'cleaned' | 'unknown'>;
}
export interface RunnerReport {
  scope: 'TEST_ONLY';
  evidence: 'local_process_substitute';
  status: 'completed' | 'stopped';
  reason: 'finished' | 'budget' | 'deadline' | 'interrupted' | 'worker_failure' | 'unknown' | 'usage_unknown';
  batches: number;
  dispatched: number;
  unknown: number;
  confirmed: number;
  chargedUpperBound: number;
  cleanup: 'cleaned' | 'unknown';
}
export function validateRunnerPlan(value: unknown): RunnerPlan;
export function runIsolatedBatches(plan: RunnerPlan, ports: RunnerPorts, signal?: AbortSignal): Promise<RunnerReport>;
