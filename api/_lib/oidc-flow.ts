import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { validateOidcConfig, type OidcConfig } from './oidc-config';
import { errorResponse } from './error-envelope';
import { withStoreTimeout } from './shared-store';
import { InvalidOidcResponseError } from './oidc-provider';

export interface OAuthStateRecord {
  state: string;
  nonce: string;
  verifier: string;
  expiresAt: string;
}
export interface OAuthStateStore {
  create(record: OAuthStateRecord): Promise<void>;
  /** 同一原子操作讀取並消耗；重送只能得到 null。 */
  consume(state: string): Promise<OAuthStateRecord | null>;
}
export interface VerifiedOidcClaims {
  issuer: string;
  audience: string;
  subject: string;
  nonce: string;
  expiresAtSeconds: number;
  issuedAtSeconds: number;
}
export interface OidcFlowOptions {
  config: OidcConfig;
  stateSigningKey: Uint8Array;
  states: OAuthStateStore;
  provider: {
    exchangeAndVerify(code: string, verifier: string, callbackUrl: string, nonce: string, state?: string): Promise<VerifiedOidcClaims>;
    authorizationUrl?(record: OAuthStateRecord): Promise<URL>;
  };
  sessions: { create(subject: string): Promise<string> };
  now(): Date;
  audit(event: { stage: 'oidc'; outcome: 'unavailable' | 'invalid_callback' }): void;
}

export function createOidcFlow(options: OidcFlowOptions) {
  const config = validateOidcConfig(options.config);
  if (!(options.stateSigningKey instanceof Uint8Array) || options.stateSigningKey.byteLength < 32)
    throw new TypeError('OAuth state 必須使用可信伺服器金鑰');
  const key = Buffer.from(options.stateSigningKey);
  const sign = (state: string) => createHmac('sha256', key).update(`tokyo-mate/oauth-state/v1:${state}`).digest('hex');
  const cookie = (value: string, age: number) =>
    `${config.stateCookieName}=${value}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
  const reject = (status: 'AUTH_REQUIRED' | 'PROTECTION_SERVICE_UNAVAILABLE') => {
    options.audit({ stage: 'oidc', outcome: status === 'AUTH_REQUIRED' ? 'invalid_callback' : 'unavailable' });
    const response = errorResponse({ kind: 'code', code: status });
    response.headers.append('Set-Cookie', cookie('', 0));
    return response;
  };
  const clock = () => {
    const time = options.now();
    if (!(time instanceof Date) || !Number.isFinite(time.getTime())) throw new Error('INVALID_OIDC_CLOCK');
    return time;
  };
  return {
    async login(request: Request): Promise<Response> {
      if (request.method !== 'GET') return errorResponse({ kind: 'code', code: 'METHOD_NOT_ALLOWED' }, 'GET');
      try {
        const state = randomBytes(32).toString('base64url');
        const nonce = randomBytes(32).toString('base64url');
        const verifier = randomBytes(32).toString('base64url');
        const record = { state, nonce, verifier,
          expiresAt: new Date(clock().getTime() + config.stateLifetimeMs).toISOString() };
        await withStoreTimeout(options.states.create(record), config.timeoutMs);
        const url = options.provider.authorizationUrl
          ? await withStoreTimeout(options.provider.authorizationUrl(record), config.timeoutMs)
          : new URL('https://accounts.google.com/o/oauth2/v2/auth');
        if (!options.provider.authorizationUrl) url.search = new URLSearchParams({
          client_id: config.clientId, redirect_uri: config.callbackUrl, response_type: 'code',
          scope: 'openid', state, nonce, code_challenge_method: 'S256',
          code_challenge: createHash('sha256').update(verifier).digest('base64url'),
        }).toString();
        return new Response(null, { status: 302, headers: {
          Location: url.toString(), 'Cache-Control': 'no-store',
          'Set-Cookie': cookie(`${state}.${sign(state)}`, Math.floor(config.stateLifetimeMs / 1000)),
        } });
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        return reject('PROTECTION_SERVICE_UNAVAILABLE');
      }
    },
    async callback(request: Request): Promise<Response> {
      if (request.method !== 'GET') return errorResponse({ kind: 'code', code: 'METHOD_NOT_ALLOWED' }, 'GET');
      try {
        const url = new URL(request.url);
        const state = url.searchParams.get('state'), code = url.searchParams.get('code');
        if (url.searchParams.has('error') || url.searchParams.getAll('state').length !== 1 ||
            url.searchParams.getAll('code').length !== 1 || !code || !state || !/^[A-Za-z0-9_-]{43}$/.test(state))
          return reject('AUTH_REQUIRED');
        const candidates = (request.headers.get('cookie') ?? '').split(';').map((part) => part.trim())
          .filter((part) => part.startsWith(`${config.stateCookieName}=`));
        const signed = candidates.length === 1 ? candidates[0].slice(config.stateCookieName.length + 1).split('.') : [];
        if (signed.length !== 2 || signed[0] !== state || !/^[0-9a-f]{64}$/.test(signed[1]) ||
            !timingSafeEqual(Buffer.from(sign(state), 'hex'), Buffer.from(signed[1], 'hex')))
          return reject('AUTH_REQUIRED');
        const record = await withStoreTimeout(options.states.consume(state), config.timeoutMs);
        if (!record || record.state !== state || !/^[A-Za-z0-9_-]{43}$/.test(record.verifier) ||
            !/^[A-Za-z0-9_-]{43}$/.test(record.nonce) ||
            !Number.isFinite(Date.parse(record.expiresAt)) || Date.parse(record.expiresAt) <= clock().getTime())
          return reject('AUTH_REQUIRED');
        const claims = await withStoreTimeout(
          options.provider.exchangeAndVerify(code, record.verifier, config.callbackUrl, record.nonce, state), config.timeoutMs);
        if (claims.issuer !== config.issuer || claims.audience !== config.clientId ||
            claims.nonce !== record.nonce || typeof claims.subject !== 'string' ||
            !/^[A-Za-z0-9_.:@/-]{1,128}$/.test(claims.subject) ||
            !Number.isSafeInteger(claims.expiresAtSeconds) ||
            !Number.isSafeInteger(claims.issuedAtSeconds) || claims.issuedAtSeconds < 0 ||
            claims.issuedAtSeconds * 1000 > clock().getTime() ||
            claims.issuedAtSeconds >= claims.expiresAtSeconds ||
            claims.expiresAtSeconds * 1000 <= clock().getTime()) return reject('AUTH_REQUIRED');
        const sessionCookie = await withStoreTimeout(options.sessions.create(claims.subject), config.timeoutMs);
        const response = new Response(null, { status: 302, headers: { Location: '/', 'Cache-Control': 'no-store' } });
        response.headers.append('Set-Cookie', cookie('', 0));
        response.headers.append('Set-Cookie', sessionCookie);
        return response;
      } catch (error) {
        if (error instanceof InvalidOidcResponseError) return reject('AUTH_REQUIRED');
        if (!(error instanceof Error)) throw error;
        return reject('PROTECTION_SERVICE_UNAVAILABLE');
      }
    },
  };
}
