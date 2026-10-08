import { errorResponse } from './error-envelope';
import { success } from './http';
import type { createSessionService } from './session';
import { withStoreTimeout } from './shared-store';

export interface SessionEndpointOptions {
  sessions: ReturnType<typeof createSessionService>;
  origin: string;
  timeoutMs: number;
  now(): Date;
  audit(event: { operation: 'session_endpoint'; outcome: 'unavailable' | 'csrf_rejected' }): void;
}

export function createSessionEndpoints(options?: SessionEndpointOptions) {
  const unavailable = () => errorResponse({ kind: 'code', code: 'PROTECTION_SERVICE_UNAVAILABLE' });
  const lookup = async (request: Request) => {
    if (!options) throw new Error('SESSION_NOT_CONFIGURED');
    const value = options.sessions.readCookie(request);
    return value ? withStoreTimeout(options.sessions.lookup(value, options.now()), options.timeoutMs) :
      { kind: 'unauthenticated' as const };
  };
  return {
    lookup,
    async session(request: Request): Promise<Response> {
      if (request.method !== 'GET') return errorResponse({ kind: 'code', code: 'METHOD_NOT_ALLOWED' }, 'GET');
      if (!options) return unavailable();
      try {
        const state = await lookup(request);
        if (state.kind === 'unavailable') return unavailable();
        return Response.json(success({ authenticated: state.kind === 'authenticated' }),
          { headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        options.audit({ operation: 'session_endpoint', outcome: 'unavailable' });
        if (!(error instanceof Error)) throw error;
        return unavailable();
      }
    },
    async logout(request: Request): Promise<Response> {
      if (request.method !== 'POST') return errorResponse({ kind: 'code', code: 'METHOD_NOT_ALLOWED' });
      if (!options) return unavailable();
      if (request.headers.get('origin') !== options.origin) {
        options.audit({ operation: 'session_endpoint', outcome: 'csrf_rejected' });
        return errorResponse({ kind: 'code', code: 'INVALID_INPUT' });
      }
      try {
        const cookie = await withStoreTimeout(options.sessions.logout(options.sessions.readCookie(request)), options.timeoutMs);
        return Response.json(success({ loggedOut: true }), { headers: { 'Cache-Control': 'no-store', 'Set-Cookie': cookie } });
      } catch (error) {
        options.audit({ operation: 'session_endpoint', outcome: 'unavailable' });
        if (!(error instanceof Error)) throw error;
        return unavailable();
      }
    },
  };
}
