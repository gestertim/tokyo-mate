import type { ProtectedEndpoint } from './cost-price-table';
import type { CapabilityPayload } from './request-epoch';

export interface RequestEpochDefinition {
  epochId: string;
  generation: number;
  kid: string;
  scopeKeyVersion: string;
  issueStartsAtMs: number;
  issueExpiresAtMs: number;
  validUntilMs: number;
  state: 'current' | 'verify_only' | 'retired';
}

export interface RequestEpochAuthority {
  authorityRevision: number;
  highestGeneration: number;
  retiredThrough: number;
  currentEpochId: string;
  epochs: Record<string, RequestEpochDefinition>;
  revokedKids: string[];
}

export interface RequestEpochIssueCommand {
  identitySubject: string;
  epochId: string;
  generation: number;
  kid: string;
  scopeKeyVersion: string;
  ownerScope: string;
  endpoint: ProtectedEndpoint;
  commandId: string;
  commandIndex: string;
  handleIndex: string;
  operationHandle: string;
  capability: string;
  preparedAtMs: number;
  issuedAtMs: number;
  expiresAtMs: number;
}

export interface RequestEpochIssueRecord {
  epochId: string;
  generation: number;
  kid: string;
  scopeKeyVersion: string;
  ownerScope: string;
  endpoint: ProtectedEndpoint;
  commandId: string;
  commandIndex: string;
  handleIndex: string;
  operationHandle: string;
  capability: string;
  issuedAtMs: number;
  expiresAtMs: number;
  granted: boolean;
}

export type RequestEpochIssueResult =
  | { status: 'issued'; record: RequestEpochIssueRecord }
  | { status: 'duplicate'; record: RequestEpochIssueRecord }
  | { status: 'conflict' }
  | { status: 'not_current' }
  | { status: 'not_eligible' }
  | { status: 'limit' };

export type RequestEpochConfirmCommand = Pick<RequestEpochIssueCommand,
  'identitySubject' | 'epochId' | 'ownerScope' | 'endpoint' | 'commandIndex'>;

export interface RequestEpochFloor {
  namespace: string;
  highestGeneration: number;
  authorityRevision: number;
  retiredThrough: number;
  revokedKids: string[];
  evidenceDigest: string;
}

export interface RequestEpochExecution {
  payload: CapabilityPayload;
  commandIndex: string;
  handleIndex: string;
  accountingIndex: string;
}

export interface RequestEpochStore {
  publish?(authority: RequestEpochAuthority, evidence: { allVersionsEpochAware: true; restoreBarrierVerified: true }): Promise<void>;
  authority(): Promise<{ authority: RequestEpochAuthority; nowMs: number }>;
  confirm(command: RequestEpochConfirmCommand): Promise<RequestEpochIssueResult | { status: 'missing' }>;
  issue(command: RequestEpochIssueCommand): Promise<RequestEpochIssueResult>;
  execution(identitySubject: string, handleIndex: string): Promise<RequestEpochIssueResult | { status: 'missing' }>;
}
