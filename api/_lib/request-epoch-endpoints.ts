import { errorResponse } from './error-envelope';
import { success } from './http';
import { createSessionEndpoints, type SessionEndpointOptions } from './session-endpoints';
import { readBoundedJson, RequestBoundaryError } from './bounded-request';
import { withStoreTimeout } from './shared-store';
import { PROTECTED_ENDPOINTS, type ProtectedEndpoint } from './cost-price-table';
import type { RateLimiter, TrustedIngressContext } from './protected-endpoint-pipeline';
import { capabilityTimeValid, deriveOwnerScope, deriveRequestEpochIndex, makeIssuanceCommandId,
  newOperationHandle, signCapability, verifyCapability } from './request-epoch';
import type { RequestEpochIssueResult, RequestEpochStore } from './request-epoch-store';
import type { QuotaEngine } from './quota-engine';

export interface RequestEpochEndpointsOptions extends SessionEndpointOptions {
  store: RequestEpochStore;
  engine: Pick<QuotaEngine, 'getSnapshot'>;
  admission: RateLimiter;
  rate: RateLimiter;
  ingress(request: Request): TrustedIngressContext;
  signingKeys: readonly { kid: string; key: Uint8Array; state: 'current' | 'verify_only' | 'revoked' }[];
  ownerScopeKeys: readonly { version: string; key: Uint8Array; state: 'current' | 'verify_only' | 'revoked' }[];
}

const endpoints = new Set<string>(PROTECTED_ENDPOINTS);
const failClosed = () => errorResponse({ kind: 'code', code: 'PROTECTION_SERVICE_UNAVAILABLE' });
const invalid = () => errorResponse({ kind: 'code', code: 'INVALID_INPUT' });
const idValid = (value: unknown): value is string => typeof value === 'string' &&
  /^g[1-9][0-9]*_[A-Za-z0-9_-]{22}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) &&
  value.length <= 101;

export function createRequestEpochEndpoints(options?: RequestEpochEndpointsOptions) {
  const session = createSessionEndpoints(options);
  return {
    async issue(request: Request): Promise<Response> {
      if (request.method !== 'POST') return errorResponse({ kind: 'code', code: 'METHOD_NOT_ALLOWED' });
      if (!options) return failClosed();
      try {
        const contentLength = request.headers.get('content-length');
        if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > 1024))
          return errorResponse({ kind: 'code', code: 'PAYLOAD_TOO_LARGE' });
        const ingress = options.ingress(request);
        if (!/^[A-Za-z0-9_.:@/-]{1,128}$/.test(ingress.admissionKey)) return failClosed();
        const admission = await withStoreTimeout(options.admission.consume(
          ingress.admissionKey, 'places', options.now()), options.timeoutMs);
        if (admission.kind === 'limited')
          return errorResponse({ kind: 'code', code: 'RATE_LIMITED', retryAfterSeconds: admission.retryAfterSeconds });
        if (admission.kind !== 'allowed') return failClosed();

        const principal = await session.lookup(request);
        if (principal.kind === 'unauthenticated') return errorResponse({ kind: 'code', code: 'AUTH_REQUIRED' });
        if (principal.kind !== 'authenticated') return failClosed();
        if (principal.expiresAt <= options.now().getTime() || principal.revokedAt !== null)
          return errorResponse({ kind: 'code', code: 'AUTH_REQUIRED' });
        const eligibility = await withStoreTimeout(options.engine.getSnapshot({ identitySubject: principal.subject }), options.timeoutMs);
        if (!eligibility.ok) return eligibility.status === 403
          ? errorResponse({ kind: 'code', code: 'ACCESS_NOT_APPROVED' }) : failClosed();
        if (request.headers.get('origin') !== options.origin ||
            (request.headers.has('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin')) {
          options.audit({ operation: 'session_endpoint', outcome: 'csrf_rejected' });
          return invalid();
        }
        const rate = await withStoreTimeout(options.rate.consume(principal.subject, 'places', options.now()), options.timeoutMs);
        if (rate.kind === 'limited')
          return errorResponse({ kind: 'code', code: 'RATE_LIMITED', retryAfterSeconds: rate.retryAfterSeconds });
        if (rate.kind !== 'allowed') return failClosed();

        const body = await readBoundedJson(request, { maxBytes: 1024, readTimeoutMs: 5000, maxDepth: 8, maxNodes: 256 },
          () => options.audit({ operation: 'session_endpoint', outcome: 'unavailable' }));
        if (body === null || typeof body !== 'object' || Array.isArray(body)) return invalid();
        const input = body as Record<string, unknown>;
        const commandIdInput = input.issuanceCommandId;
        if (Object.keys(input).length !== 2 || typeof input.endpoint !== 'string' || !endpoints.has(input.endpoint) ||
            !idValid(commandIdInput)) return invalid();
        const authorityState = await withStoreTimeout(options.store.authority(), options.timeoutMs);
        const commandEpoch = commandIdInput.split('.')[0];
        const epoch = authorityState.authority.epochs[commandEpoch];
        if (!epoch || epoch.state === 'retired' || epoch.generation <= authorityState.authority.retiredThrough)
          return errorResponse({ kind: 'code', code: 'OPERATION_NO_LONGER_EXECUTABLE' });
        const scopeKey = options.ownerScopeKeys.filter((key) => key.version === epoch.scopeKeyVersion && key.state !== 'revoked');
        const signingKey = options.signingKeys.filter((key) => key.kid === epoch.kid && key.state === 'current');
        if (authorityState.authority.revokedKids.includes(epoch.kid) || scopeKey.length !== 1 ||
            scopeKey[0].key.byteLength !== 32)
          return errorResponse({ kind: 'code', code: 'OPERATION_NO_LONGER_EXECUTABLE' });
        let commandId: string;
        try { commandId = makeIssuanceCommandId(epoch.epochId, commandIdInput.split('.')[1]); }
        catch { return invalid(); }
        const ownerScope = deriveOwnerScope(scopeKey[0].key, epoch.scopeKeyVersion, principal.subject);
        const commandIndex = deriveRequestEpochIndex(scopeKey[0].key, 'tm/issuance-index/v1',
          [ownerScope, epoch.epochId, commandId]);
        const respond = async (result: RequestEpochIssueResult): Promise<Response> => {
          if (result.status === 'conflict') return errorResponse({ kind: 'code', code: 'IDEMPOTENCY_CONFLICT' });
          if (result.status === 'not_eligible') return errorResponse({ kind: 'code', code: 'ACCESS_NOT_APPROVED' });
          if (result.status === 'not_current') return errorResponse({ kind: 'code', code: 'OPERATION_NO_LONGER_EXECUTABLE' });
          if (result.status === 'limit') return errorResponse({ kind: 'code', code: 'RATE_LIMITED' });
          const record = result.record;
          const payload = verifyCapability(record.capability, options.signingKeys);
          if (!payload || payload.ownerScope !== ownerScope || payload.endpoint !== input.endpoint ||
              payload.epochId !== epoch.epochId || payload.operationHandle !== record.operationHandle ||
              record.commandId !== commandId || record.commandIndex !== commandIndex ||
              payload.issuedAtMs !== record.issuedAtMs || payload.expiresAtMs !== record.expiresAtMs) return failClosed();
          // Revalidate at the atomic return boundary; confirmation never signs or grants.
          const checked = await withStoreTimeout(options.store.confirm({
            identitySubject: principal.subject, epochId: epoch.epochId, ownerScope,
            endpoint: payload.endpoint, commandIndex,
          }), options.timeoutMs);
          if (checked.status !== 'duplicate') {
            if (checked.status === 'missing' || checked.status === 'issued') return failClosed();
            return respond(checked);
          }
          if (checked.record.capability !== record.capability) return failClosed();
          const data = { capability: record.capability, operationHandle: record.operationHandle,
            requestEpochId: record.epochId, issuedAt: new Date(record.issuedAtMs).toISOString(),
            expiresAt: new Date(record.expiresAtMs).toISOString() };
          const serialized = JSON.stringify(success(data));
          if (Buffer.byteLength(serialized, 'utf8') > 4096) return failClosed();
          return new Response(serialized, { status: result.status === 'issued' ? 201 : 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
        };
        const confirmed = await withStoreTimeout(options.store.confirm({
          identitySubject: principal.subject, epochId: epoch.epochId, ownerScope,
          endpoint: input.endpoint as ProtectedEndpoint, commandIndex,
        }), options.timeoutMs);
        if (confirmed.status !== 'missing') return respond(confirmed);
        const active = authorityState.authority.epochs[authorityState.authority.currentEpochId];
        if (!active || authorityState.nowMs >= active.issueExpiresAtMs) return failClosed();
        if (epoch.state !== 'current' || signingKey.length !== 1 || signingKey[0].key.byteLength !== 32 ||
            authorityState.authority.currentEpochId !== epoch.epochId) return failClosed();
        const issuedAtMs = authorityState.nowMs;
        const expiresAtMs = Math.min(issuedAtMs + 86_400_000, epoch.validUntilMs);
        const operationHandle = newOperationHandle();
        const payload = { generation: epoch.generation, epochId: epoch.epochId, kid: epoch.kid,
          scopeKeyVersion: epoch.scopeKeyVersion, ownerScope, endpoint: input.endpoint as ProtectedEndpoint,
          operationHandle, issuedAtMs, expiresAtMs };
        if (!capabilityTimeValid(payload, authorityState.nowMs) ||
            issuedAtMs < epoch.issueStartsAtMs || issuedAtMs >= epoch.issueExpiresAtMs)
          return errorResponse({ kind: 'code', code: 'OPERATION_NO_LONGER_EXECUTABLE' });
        const capability = signCapability(payload, signingKey[0].key);
        const handleIndex = deriveRequestEpochIndex(scopeKey[0].key, 'tm/operation-index/v1',
          [ownerScope, input.endpoint, epoch.epochId, operationHandle]);
        const result = await withStoreTimeout(options.store.issue({
          identitySubject: principal.subject, epochId: epoch.epochId, generation: epoch.generation, kid: epoch.kid,
          scopeKeyVersion: epoch.scopeKeyVersion, ownerScope, endpoint: input.endpoint as ProtectedEndpoint,
          commandId, commandIndex, handleIndex, operationHandle, capability,
          preparedAtMs: authorityState.nowMs, issuedAtMs, expiresAtMs,
        }), options.timeoutMs);
        return await respond(result);
      } catch (error) {
        if (error instanceof RequestBoundaryError) return error.code === 'PROTECTION_SERVICE_UNAVAILABLE'
          ? failClosed() : errorResponse({ kind: 'code', code: error.code });
        options.audit({ operation: 'session_endpoint', outcome: 'unavailable' });
        if (!(error instanceof Error)) throw error;
        return failClosed();
      }
    },
  };
}
