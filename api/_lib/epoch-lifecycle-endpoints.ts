import { randomUUID } from 'node:crypto';
import { requireAdminMutation, type AdminAuthOptions } from './admin-auth';
import { readBoundedJson, RequestBoundaryError } from './bounded-request';
import { errorResponse } from './error-envelope';
import { success } from './http';
import { withStoreTimeout } from './shared-store';
import { isEpochLifecycleInput, type EpochLifecycleStore } from './epoch-lifecycle';
import type { RateResult } from './protected-endpoint-pipeline';

export interface EpochLifecycleEndpointOptions extends AdminAuthOptions {
  store: EpochLifecycleStore;
  rate: { consume(subject: string): Promise<RateResult> };
  scope: 'TEST_ONLY';
}
export function createEpochLifecycleEndpoint(options?: EpochLifecycleEndpointOptions) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return errorResponse({ kind: 'code', code: 'METHOD_NOT_ALLOWED' });
    if (!options || options.scope !== 'TEST_ONLY') return errorResponse({ kind: 'code', code: 'PROTECTION_SERVICE_UNAVAILABLE' });
    const admin = await requireAdminMutation(request, options);
    if (admin instanceof Response) return admin;
    try {
      const rate = await withStoreTimeout(options.rate.consume(admin.subject), options.timeoutMs);
      if (rate.kind === 'limited') return errorResponse({ kind: 'code', code: 'RATE_LIMITED', retryAfterSeconds: rate.retryAfterSeconds });
      if (rate.kind !== 'allowed') throw new Error('LIFECYCLE_RATE_UNAVAILABLE');
      const body = await readBoundedJson(request, { maxBytes: 4096, maxDepth: 8, maxNodes: 256, readTimeoutMs: 5000 },
        () => options.audit({ operation: 'session_endpoint', outcome: 'unavailable' }));
      if (!isEpochLifecycleInput(body)) return errorResponse({ kind: 'code', code: 'INVALID_INPUT' });
      const result = await withStoreTimeout(options.store.execute({ ...body, actor: admin.subject, auditId: randomUUID() }), options.timeoutMs);
      if (result.outcome === 'conflict') return errorResponse({ kind: 'code', code: 'IDEMPOTENCY_CONFLICT' });
      if (result.outcome === 'not_found') return errorResponse({ kind: 'code', code: 'OPERATION_NOT_FOUND' });
      if (result.outcome === 'refused') {
        options.audit({ operation: 'session_endpoint', outcome: 'unavailable' });
        return errorResponse({ kind: 'code', code: 'PROTECTION_SERVICE_UNAVAILABLE' });
      }
      const serialized = JSON.stringify(success(result));
      if (Buffer.byteLength(serialized) > 4096) throw new Error('LIFECYCLE_RESPONSE_TOO_LARGE');
      return new Response(serialized, { status: 200,
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' } });
    } catch (error) {
      options.audit({ operation: 'session_endpoint', outcome: 'unavailable' });
      return errorResponse({ kind: 'code', code: error instanceof RequestBoundaryError ? error.code : 'PROTECTION_SERVICE_UNAVAILABLE' });
    }
  };
}
