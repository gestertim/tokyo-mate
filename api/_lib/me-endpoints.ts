import { createSessionEndpoints, type SessionEndpointOptions } from './session-endpoints';
import { errorResponse } from './error-envelope';
import { readBoundedJson, RequestBoundaryError } from './bounded-request';
import { withStoreTimeout } from './shared-store';
import { PROTECTED_ENDPOINTS, type ProtectedEndpoint } from './cost-price-table';
import type { RateResult } from './protected-endpoint-pipeline';
import type { MeStore, RequestMutationResult } from './me-store';
import { success } from './http';
import { meId, meRecord, meDate, isOwnRequestPage, projectOwnRequest, requestReasonValid, operationMessages,
  type OwnRequestInput } from '../../src/types/self-service';

export interface MeEndpointOptions extends SessionEndpointOptions {
  store: MeStore;
  rates: Record<'operation' | 'read' | 'mutation', { consume(key: string): Promise<RateResult> }>;
}
const unavailable = () => errorResponse({ kind: 'code', code: 'PROTECTION_SERVICE_UNAVAILABLE' });
const bad = () => errorResponse({ kind: 'code', code: 'INVALID_INPUT' });
const encoded = (data: unknown) => JSON.stringify(success(data));
const json = (body: string, status = 200) => new Response(body, {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// 上限含信封與 nextOffset；續頁一定從第一筆尚未回傳的項目開始。
export function boundedOwnPage<T>(page: { items: T[]; nextOffset: number | null }, offset: number): string {
  for (let count = page.items.length; count >= 0; count--) {
    const more = count < page.items.length || page.nextOffset !== null;
    const nextOffset = more ? offset + count : null;
    if (more && (count === 0 || nextOffset! > 999999)) break;
    const body = encoded({ items: page.items.slice(0, count), nextOffset });
    if (Buffer.byteLength(body, 'utf8') <= 65536) return body;
  }
  throw new Error('ME_PAGE_TOO_LARGE');
}
function mutationResponse(result: RequestMutationResult): Response {
  switch (result.outcome) {
    case 'created': case 'duplicate': case 'withdrawn':
      return json(encoded(projectOwnRequest(result.review)), result.outcome === 'created' ? 201 : 200);
    case 'conflict': return errorResponse({ kind: 'code', code: 'IDEMPOTENCY_CONFLICT' });
    case 'not_found': return errorResponse({ kind: 'code', code: 'REQUEST_NOT_FOUND' });
    case 'resolved': return errorResponse({ kind: 'code', code: 'REQUEST_ALREADY_RESOLVED' });
    case 'not_approved': return errorResponse({ kind: 'code', code: 'ACCESS_NOT_APPROVED' });
    case 'invalid': return bad();
    default: throw new Error('INVALID_ME_MUTATION_RESULT');
  }
}
export function createMeEndpoints(options?: MeEndpointOptions) {
  const session = createSessionEndpoints(options);
  async function handle(request: Request, operation: 'operation' | 'requests' | 'withdraw'): Promise<Response> {
    const get = operation === 'requests' && request.method === 'GET';
    if (!get && request.method !== 'POST') return errorResponse({ kind: 'code', code: 'METHOD_NOT_ALLOWED' });
    if (!options) return unavailable();
    try {
      const principal = await session.lookup(request);
      if (principal.kind === 'unauthenticated') return errorResponse({ kind: 'code', code: 'AUTH_REQUIRED' });
      if (principal.kind !== 'authenticated') {
        options.audit({ operation: 'session_endpoint', outcome: 'unavailable' }); return unavailable();
      }
      if (!get && (request.headers.get('origin') !== options.origin ||
          (request.headers.has('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin'))) {
        options.audit({ operation: 'session_endpoint', outcome: 'csrf_rejected' }); return bad();
      }
      if (operation === 'operation') {
        const access = await withStoreTimeout(options.store.access(principal.subject), options.timeoutMs);
        if (typeof access.approved !== 'boolean') throw new Error('INVALID_ME_ACCESS');
        if (!access.approved) return errorResponse({ kind: 'code', code: 'ACCESS_NOT_APPROVED' });
      }
      const bucket = operation === 'operation' ? 'operation' : get ? 'read' : 'mutation';
      const rate = await withStoreTimeout(options.rates[bucket].consume(principal.subject), options.timeoutMs);
      if (rate.kind === 'limited') return errorResponse({ kind: 'code', code: 'RATE_LIMITED', retryAfterSeconds: rate.retryAfterSeconds });
      if (rate.kind !== 'allowed') {
        options.audit({ operation: 'session_endpoint', outcome: 'unavailable' }); return unavailable();
      }
      if (get) {
        const url = new URL(request.url);
        if ([...url.searchParams.keys()].some((k) => k !== 'offset' && k !== 'limit') ||
          url.searchParams.getAll('offset').length > 1 || url.searchParams.getAll('limit').length > 1) return bad();
        const off = url.searchParams.get('offset') ?? '0', lim = url.searchParams.get('limit') ?? '25';
        if (!/^\d{1,6}$/.test(off) || !/^\d{1,3}$/.test(lim)) return bad();
        const offset = Number(off), limit = Number(lim);
        if (limit < 1 || limit > 100) return bad();
        const page = await withStoreTimeout(options.store.list(principal.subject, offset, limit), options.timeoutMs);
        if (!isOwnRequestPage(page) || page.items.length > limit ||
            (page.nextOffset !== null && page.nextOffset !== offset + page.items.length)) throw new Error('INVALID_ME_PAGE');
        return json(boundedOwnPage({ items: page.items.map(projectOwnRequest), nextOffset: page.nextOffset }, offset));
      }
      const maxBytes = operation === 'operation' ? 1024 : 2048;
      const length = request.headers.get('content-length');
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes))
        return errorResponse({ kind: 'code', code: 'PAYLOAD_TOO_LARGE' });
      const body = await readBoundedJson(request, { maxBytes, readTimeoutMs: 5000, maxDepth: 8, maxNodes: 256 },
        () => options.audit({ operation: 'session_endpoint', outcome: 'unavailable' }));
      if (!meRecord(body)) return bad();
      if (operation === 'operation') {
        if (!PROTECTED_ENDPOINTS.includes(body.endpoint as ProtectedEndpoint)) return bad();
        const legacy = Object.keys(body).length === 2 && meId(body.idempotencyKey);
        const epoch = Object.keys(body).length === 3 && typeof body.requestEpochId === 'string' &&
          body.requestEpochId.length <= 64 && /^g[1-9][0-9]*_[A-Za-z0-9_-]{22}$/.test(body.requestEpochId) &&
          typeof body.operationHandle === 'string' && /^[A-Za-z0-9_-]{43}$/.test(body.operationHandle);
        if (!legacy && !epoch) return bad();
        if (epoch && !options.store.epochOperation) throw new Error('EPOCH_LOOKUP_NOT_CONFIGURED');
        const result = await withStoreTimeout(epoch
          ? options.store.epochOperation!(principal.subject, body.endpoint as ProtectedEndpoint,
            String(body.requestEpochId), String(body.operationHandle))
          : options.store.operation(principal.subject, body.endpoint as ProtectedEndpoint, String(body.idempotencyKey)), options.timeoutMs);
        if (result.outcome === 'not_approved') return errorResponse({ kind: 'code', code: 'ACCESS_NOT_APPROVED' });
        if (result.outcome === 'not_found') return errorResponse({ kind: 'code', code: 'OPERATION_NOT_FOUND' });
        if (result.outcome !== 'found') throw new Error('INVALID_OPERATION_RESULT');
        if (!Object.hasOwn(operationMessages, result.state) || !meDate(result.updatedAt)) throw new Error('INVALID_OPERATION_STATE');
        const response = encoded({ state: result.state, updatedAt: result.updatedAt, userMessage: operationMessages[result.state] });
        if (Buffer.byteLength(response) > 4096) throw new Error('ME_OPERATION_TOO_LARGE');
        return json(response);
      }
      if (operation === 'withdraw') {
        if (Object.keys(body).length !== 0) return bad();
        const match = /^\/api\/me\/requests\/([A-Za-z0-9_-]{1,128})\/withdraw$/.exec(new URL(request.url).pathname);
        if (!match) return bad();
        return mutationResponse(await withStoreTimeout(options.store.withdraw(principal.subject, match[1]), options.timeoutMs));
      }
      if (!meId(body.idempotencyKey) || !requestReasonValid(body.kind, body.reasonCode) ||
          Object.keys(body).some((k) => !['kind', 'idempotencyKey', 'reasonCode', 'weekWindowKey'].includes(k)) ||
          (body.kind === 'paid_access' ? body.weekWindowKey !== undefined : !/^\d{4}-W\d{2}$/.test(String(body.weekWindowKey))))
        return bad();
      if (!isRequestInput(body)) return bad();
      const input = body;
      return mutationResponse(await withStoreTimeout(options.store.enqueue(principal.subject, input), options.timeoutMs));
    } catch (error) {
      if (error instanceof RequestBoundaryError) return errorResponse({ kind: 'code', code: error.code });
      options.audit({ operation: 'session_endpoint', outcome: 'unavailable' });
      if (!(error instanceof Error)) throw error;
      return unavailable();
    }
    function isRequestInput(body: Record<string, unknown>): body is Record<string, unknown> & OwnRequestInput {
      return (body.kind === 'paid_access' || body.kind === 'weekly_top_up') && meId(body.idempotencyKey) &&
        requestReasonValid(body.kind, body.reasonCode);
    }
  }
  return {
    operation: (request: Request) => handle(request, 'operation'),
    requests: (request: Request) => handle(request, 'requests'),
    withdraw: (request: Request) => handle(request, 'withdraw'),
  };
}
