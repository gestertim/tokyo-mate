import type { ProtectedEndpoint } from './cost-price-table';
import { accountingLookupIndex, deriveOwnerScope, deriveRequestEpochIndex, verifyCapability,
  type CapabilityVerificationKey } from './request-epoch';
import type { RequestEpochExecution, RequestEpochStore } from './request-epoch-store';

export type EpochExecutionResult = { ok: true; execution: RequestEpochExecution } |
  { ok: false; code: 'INVALID_INPUT' | 'ACCESS_NOT_APPROVED' | 'OPERATION_NO_LONGER_EXECUTABLE' };
export interface RequestEpochVerifier {
  verify(subject: string, endpoint: ProtectedEndpoint, handle: string, token: string | null): Promise<EpochExecutionResult>;
}

export function createRequestEpochVerifier(options: {
  store: RequestEpochStore;
  signingKeys: readonly CapabilityVerificationKey[];
  scopeKeys: readonly { version: string; key: Uint8Array; state: 'current' | 'verify_only' | 'revoked' }[];
}): RequestEpochVerifier {
  return {
    async verify(subject, endpoint, handle, token) {
      if (!token || token.includes(',') || !/^[A-Za-z0-9_-]{43}$/.test(handle))
        return { ok: false, code: 'INVALID_INPUT' };
      const wire = /^v1\.([A-Za-z0-9_-]{22})\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.exec(token);
      if (wire && options.signingKeys.filter((key) => key.kid === wire[1] && key.state !== 'revoked').length !== 1)
        throw new Error('EPOCH_SIGNING_KEY_UNAVAILABLE');
      const payload = verifyCapability(token, options.signingKeys);
      if (!payload || payload.endpoint !== endpoint || payload.operationHandle !== handle)
        return { ok: false, code: 'INVALID_INPUT' };
      const keys = options.scopeKeys.filter((key) => key.version === payload.scopeKeyVersion && key.state !== 'revoked');
      if (keys.length !== 1) throw new Error('EPOCH_SCOPE_KEY_UNAVAILABLE');
      if (deriveOwnerScope(keys[0].key, payload.scopeKeyVersion, subject) !== payload.ownerScope)
        return { ok: false, code: 'INVALID_INPUT' };
      const handleIndex = deriveRequestEpochIndex(keys[0].key, 'tm/operation-index/v1',
        [payload.ownerScope, endpoint, payload.epochId, handle]);
      const result = await options.store.execution(subject, handleIndex);
      if (result.status === 'not_eligible') return { ok: false, code: 'ACCESS_NOT_APPROVED' };
      if (result.status === 'not_current') return { ok: false, code: 'OPERATION_NO_LONGER_EXECUTABLE' };
      if (result.status !== 'duplicate' || result.record.capability !== token || result.record.handleIndex !== handleIndex)
        return { ok: false, code: 'INVALID_INPUT' };
      return { ok: true, execution: { payload, handleIndex, commandIndex: result.record.commandIndex,
        accountingIndex: accountingLookupIndex(payload.epochId, handle) } };
    },
  };
}
