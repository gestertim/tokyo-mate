import { validateOidcConfig, type OidcConfig } from './oidc-config';
import type { VerifiedOidcClaims } from './oidc-flow';
import { withStoreTimeout } from './shared-store';

export class InvalidOidcResponseError extends Error {
  constructor() { super('INVALID_OIDC_RESPONSE'); this.name = 'InvalidOidcResponseError'; }
}

export interface OidcVerificationPolicy {
  jwksUri: string;
  allowedAlgorithms: readonly string[];
  maxTokenAgeSeconds: number;
  maxIdTokenBytes: number;
  maxCodeBytes: number;
}

/** 由另行批准的通用 OIDC library 實作；不可用 JWT decode 或自製 crypto 替代。 */
export interface OidcClientLibrary {
  exchangeAuthorizationCode(input: {
    issuer: string; clientId: string; clientSecret: string; redirectUri: string;
    code: string; codeVerifier: string; signal: AbortSignal;
  }): Promise<{ idToken: string }>;
  verifyIdToken(input: {
    idToken: string; issuer: string; audience: string; nonce: string;
    jwksUri: string; allowedAlgorithms: readonly string[]; now: Date;
    maxTokenAgeSeconds: number; signal: AbortSignal;
  }): Promise<{
    signatureVerified: true; algorithm: string; claims: {
      iss: string; aud: string | string[]; azp?: string; sub: string; nonce: string; exp: number; iat: number;
    };
  }>;
}

export interface CombinedOidcClientLibrary {
  exchangeAndVerify(input: {
    issuer: string; clientId: string; clientSecret: string; redirectUri: string;
    code: string; codeVerifier: string; nonce: string; state: string; signal: AbortSignal;
    policy: OidcVerificationPolicy; now: Date;
  }): Promise<Awaited<ReturnType<OidcClientLibrary['verifyIdToken']>>>;
}

export function createOidcLibraryAdapter(options: {
  config: OidcConfig;
  clientSecret: string;
  policy: OidcVerificationPolicy;
  library: OidcClientLibrary | CombinedOidcClientLibrary;
  now(): Date;
}) {
  const config = validateOidcConfig(options.config);
  const policy = { ...options.policy, allowedAlgorithms: [...options.policy.allowedAlgorithms] };
  const clientSecret = options.clientSecret;
  if (typeof clientSecret !== 'string' || !clientSecret.trim() ||
      policy.jwksUri !== 'https://www.googleapis.com/oauth2/v3/certs' ||
      policy.allowedAlgorithms.length === 0 ||
      policy.allowedAlgorithms.some((algorithm) => !/^(RS|PS|ES)(256|384|512)$/.test(algorithm)) ||
      ![policy.maxTokenAgeSeconds, policy.maxIdTokenBytes, policy.maxCodeBytes]
        .every((value) => Number.isSafeInteger(value) && value > 0))
    throw new TypeError('OIDC library adapter 需要可信 secret、Google JWKS 與明確驗證限制');

  return {
    async exchangeAndVerify(code: string, verifier: string, callbackUrl: string, nonce: string, state?: string): Promise<VerifiedOidcClaims> {
      if (typeof code !== 'string' || !code.trim() || Buffer.byteLength(code) > policy.maxCodeBytes ||
          !/^[A-Za-z0-9_-]{43}$/.test(verifier) || !/^[A-Za-z0-9_-]{43}$/.test(nonce) ||
          callbackUrl !== config.callbackUrl) throw new InvalidOidcResponseError();
      const controller = new AbortController();
      const work = async (): Promise<VerifiedOidcClaims> => {
        const now = options.now();
        if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('INVALID_OIDC_CLOCK');
        let verified: Awaited<ReturnType<OidcClientLibrary['verifyIdToken']>>;
        if ('exchangeAndVerify' in options.library) {
          if (!state || !/^[A-Za-z0-9_-]{43}$/.test(state)) throw new InvalidOidcResponseError();
          verified = await options.library.exchangeAndVerify({
            issuer: config.issuer, clientId: config.clientId, clientSecret, redirectUri: config.callbackUrl,
            code, codeVerifier: verifier, nonce, state, policy, now, signal: controller.signal,
          });
        } else {
          const tokens = await options.library.exchangeAuthorizationCode({
            issuer: config.issuer, clientId: config.clientId, clientSecret,
            redirectUri: config.callbackUrl, code, codeVerifier: verifier, signal: controller.signal,
          });
          controller.signal.throwIfAborted();
          if (!tokens || typeof tokens.idToken !== 'string' || !tokens.idToken ||
              Buffer.byteLength(tokens.idToken) > policy.maxIdTokenBytes) throw new InvalidOidcResponseError();
          try {
            verified = await options.library.verifyIdToken({
              idToken: tokens.idToken, issuer: config.issuer, audience: config.clientId, nonce,
              jwksUri: policy.jwksUri, allowedAlgorithms: [...policy.allowedAlgorithms],
              now, maxTokenAgeSeconds: policy.maxTokenAgeSeconds, signal: controller.signal,
            });
          } catch (error) {
            if (!(error instanceof Error)) throw error;
            throw new InvalidOidcResponseError();
          }
        }
        controller.signal.throwIfAborted();
        const claims = verified?.claims;
        const audiences = typeof claims?.aud === 'string' ? [claims.aud] : claims?.aud;
        const verifiedAt = options.now();
        if (!(verifiedAt instanceof Date) || !Number.isFinite(verifiedAt.getTime())) throw new Error('INVALID_OIDC_CLOCK');
        const seconds = verifiedAt.getTime() / 1000;
        if (verified?.signatureVerified !== true || !policy.allowedAlgorithms.includes(verified.algorithm) ||
            !claims || claims.iss !== config.issuer ||
            !Array.isArray(audiences) || !audiences.every((audience) => typeof audience === 'string') ||
            !audiences.includes(config.clientId) ||
            (audiences.length > 1 && claims.azp !== config.clientId) ||
            (claims.azp !== undefined && claims.azp !== config.clientId) ||
            claims.nonce !== nonce || typeof claims.sub !== 'string' || !/^[A-Za-z0-9_.:@/-]{1,128}$/.test(claims.sub) ||
            !Number.isSafeInteger(claims.exp) || !Number.isSafeInteger(claims.iat) ||
            claims.exp <= seconds || claims.iat > seconds || claims.iat < 0 ||
            claims.exp <= claims.iat || seconds - claims.iat > policy.maxTokenAgeSeconds)
          throw new InvalidOidcResponseError();
        return { issuer: claims.iss, audience: config.clientId, subject: claims.sub, nonce: claims.nonce,
          expiresAtSeconds: claims.exp, issuedAtSeconds: claims.iat };
      };
      try {
        return await withStoreTimeout(work(), config.timeoutMs);
      } finally {
        controller.abort();
      }
    },
  };
}
