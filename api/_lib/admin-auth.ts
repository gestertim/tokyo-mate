import { errorResponse } from './error-envelope';
import { failure } from './http';
import { createSessionEndpoints, type SessionEndpointOptions } from './session-endpoints';
import { withStoreTimeout } from './shared-store';

export interface AdminAuthOptions extends SessionEndpointOptions {
  isAdmin(subject: string): Promise<boolean>;
}

export async function requireAdmin(request: Request, options?: AdminAuthOptions):
  Promise<{ subject: string } | Response> {
  if (!options) return errorResponse({ kind: 'code', code: 'PROTECTION_SERVICE_UNAVAILABLE' });
  try {
    const session = await createSessionEndpoints(options).lookup(request);
    if (session.kind === 'unauthenticated') return errorResponse({ kind: 'code', code: 'AUTH_REQUIRED' });
    if (session.kind !== 'authenticated') return errorResponse({ kind: 'code', code: 'PROTECTION_SERVICE_UNAVAILABLE' });
    const admin = await withStoreTimeout(options.isAdmin(session.subject), options.timeoutMs);
    if (typeof admin !== 'boolean') throw new TypeError('管理者來源回傳無效資料');
    if (!admin) return Response.json(failure({
      code: 'ADMIN_REQUIRED', userTitle: '需要管理者權限',
      userMessage: '此帳號無法讀取或異動管理資料。', actionableStep: '請返回公開內容。',
    }), { status: 403, headers: { 'Cache-Control': 'no-store' } });
    return { subject: session.subject };
  } catch (error) {
    options.audit({ operation: 'session_endpoint', outcome: 'unavailable' });
    if (!(error instanceof Error)) throw error;
    return errorResponse({ kind: 'code', code: 'PROTECTION_SERVICE_UNAVAILABLE' });
  }
}

export async function requireAdminMutation(request: Request, options?: AdminAuthOptions):
  Promise<{ subject: string } | Response> {
  const principal = await requireAdmin(request, options);
  if (principal instanceof Response || !options) return principal;
  if (request.headers.get('origin') !== options.origin ||
      request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json' ||
      (request.headers.has('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin')) {
    options.audit({ operation: 'session_endpoint', outcome: 'csrf_rejected' });
    return errorResponse({ kind: 'code', code: 'INVALID_INPUT' });
  }
  return principal;
}
