import type { ChildProcess } from 'node:child_process';
import type { createRedisRestTransport } from '../api/_lib/redis-rest-transport';
import type { createRedisSharedStore } from '../api/_lib/redis-shared-store';
import type { ReserveCommand } from '../api/_lib/shared-store';
import type { RegistryBundle } from '../api/_lib/cost-registry';

export const PHASE_B_LIMITS: Readonly<{
  restRequestsMax: number; logicalCommandsMax: number; operationTimeoutMs: number;
  windowMs: number; workerReadyMs: number; confirmationReserveMs: number;
  cleanupReserveMs: number; maxRequestBytes: number; maxResponseBytes: number;
}>;
export const PHASE_B_CAPACITY_THRESHOLDS: Readonly<{
  commands: 400000; bandwidthBytes: 9000000000; storageBytes: 230000000;
}>;
export const PHASE_B_BRANCH_BOUNDS: Readonly<Record<string, {
  restPosts: number; logicalCommands: number; writeCalls: number;
  providerCommandsNoReadRegion: number; providerCommandsOneReadRegion: number;
  requestBytes: number; responseBytes: number;
}>>;
export const PHASE_B_STORAGE_ENVELOPE: Readonly<{
  inventoryKeys: 3; dataBearingKeysMax: 2; registryHashFieldsMax: 4;
  userHashFieldsMax: 1; sessionsWritten: false;
  applicationPayloadBytesMax: 131072;
  cleanupDelCalls: 3; cleanupConfirmExistsCalls: 3; providerStorageBytesUpperBound: null;
}>;
export const PHASE_B_SCRIPTS: Readonly<{ preflight: string; cleanup: string; confirm: string }>;
export interface PhaseBPlan {
  version: 2; scope: 'TEST_ONLY_PHASE_B'; namespace: string; inventory: readonly string[];
  limits: typeof PHASE_B_LIMITS; capacityThresholds: typeof PHASE_B_CAPACITY_THRESHOLDS;
  scripts: typeof PHASE_B_SCRIPTS;
  operationSources: Readonly<Record<string, string>>;
  branchBounds: typeof PHASE_B_BRANCH_BOUNDS; storageEnvelope: typeof PHASE_B_STORAGE_ENVELOPE;
  providerRules: 'operator_response_received';
  providerMetering: 'unverified'; usageObservation: 'manual_source_timestamp_timezone_stale_capable';
  billableUpperBound: null; digest: string;
}
export interface PhaseBFixture {
  subject: string; keys: readonly string[];
  command: ReserveCommand; bundle: RegistryBundle;
}
export interface PhaseBReport {
  scope: string; evidence: string; status: string; reason: string;
  providerRules: 'operator_response_received'; providerMetering: 'unverified';
  billableUpperBound: null; digest: string;
  restRequestsUpperBound: number; logicalCommandsUpperBound: number;
  inventory: string[]; cleanup: string; confirmation: string; manualFollowUp: boolean;
  workers: { slot: number; pid: number; status: string; executionGrant?: boolean; clientCreated: boolean }[];
}
export interface PhaseBPorts {
  mode: 'mock' | 'external';
  createTransport: typeof createRedisRestTransport;
  createStore: typeof createRedisSharedStore;
  fetch: typeof fetch;
  readSecrets(): Promise<{ url: string; token: string }>;
}
export interface PhaseBControl {
  stopSignal?: AbortSignal; abortSignal?: AbortSignal; now?(): number;
  onBarrier?(children: ChildProcess[]): void | Promise<void>;
  onDispatched?(children: ChildProcess[]): void | Promise<void>;
  onFirstDispatch?(): void | Promise<void>;
  currentConditions?: PhaseBConditions;
}
export interface PhaseBUsageObservation {
  source: string; observedAt: string; value: number;
}
export interface PhaseBConditions {
  noReadRegions: boolean; noPaymentMethod: boolean; noOtherWorkloadsOrWriters: boolean;
  commands: PhaseBUsageObservation;
  bandwidthBytes: PhaseBUsageObservation;
  storageBytes: PhaseBUsageObservation;
}
export function createPhaseBPlan(id?: string): PhaseBPlan;
export function validatePhaseBPlan(value: unknown): PhaseBPlan;
export function validatePhaseBConditions(value: unknown): value is PhaseBConditions;
export function runPhaseB(plan: PhaseBPlan, fixture: PhaseBFixture,
  ports: PhaseBPorts, control?: PhaseBControl): Promise<PhaseBReport>;
export function phaseBSecretSource(): Promise<{ url: string; token: string }>;
export function phaseBMain(argv: string[], io?: {
  write?: (value: string) => void; writeError?: (value: string) => void;
  executionPath?: string;
  readCurrentConditions?(): Promise<PhaseBConditions> | PhaseBConditions;
  readSecrets?(): Promise<{ url: string; token: string }>;
  execute?(plan: PhaseBPlan, conditions: PhaseBConditions,
    readSecrets: () => Promise<{ url: string; token: string }>,
    onFirstDispatch: () => void): Promise<PhaseBReport>;
}): Promise<number>;
