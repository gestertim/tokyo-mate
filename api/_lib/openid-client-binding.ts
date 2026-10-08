import * as client from 'openid-client';
import { validateOidcConfig, type OidcConfig } from './oidc-config';
import { createOidcLibraryAdapter, InvalidOidcResponseError, type OidcVerificationPolicy } from './oidc-provider';
import type { OAuthStateRecord } from './oidc-flow';
import { withStoreTimeout } from './shared-store';

const discoveryUrl = 'https://accounts.google.com/.well-known/openid-configuration';
const authorizationEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
const tokenEndpoint = 'https://oauth2.googleapis.com/token';

export function createOpenidClientProvider(options: {
  config: OidcConfig;
  clientSecret: string;
  policy: OidcVerificationPolicy;
  now(): Date;
  transport?: client.CustomFetch;
}) {
  const config = validateOidcConfig(options.config);
  const policy = { ...options.policy, allowedAlgorithms: [...options.policy.allowedAlgorithms] };
  const clientSecret = options.clientSecret;
  const transportOverride = options.transport;
  const discover = async (signal: AbortSignal, now: Date) => {
    const transport: client.CustomFetch = async (url, init) => {
      if (![discoveryUrl, tokenEndpoint, policy.jwksUri].includes(url)) throw new InvalidOidcResponseError();
      signal.throwIfAborted();
      const request = { ...init, signal: init.signal ? AbortSignal.any([signal, init.signal]) : signal };
      const response = transportOverride
        ? await transportOverride(url, request)
        : await fetch(url, { ...request,
          body: request.body instanceof Uint8Array ? Uint8Array.from(request.body) : request.body });
      signal.throwIfAborted();
      return response;
    };
    const result = await client.discovery(new URL(config.issuer), config.clientId, {
      client_secret: clientSecret,
      id_token_signed_response_alg: policy.allowedAlgorithms[0],
      [client.clockTolerance]: 0,
      [client.clockSkew]: Math.floor(now.getTime() / 1000) - Math.floor(Date.now() / 1000),
    }, client.ClientSecretPost(clientSecret), {
      [client.customFetch]: transport,
      timeout: config.timeoutMs / 1000,
      execute: [client.enableNonRepudiationChecks],
    });
    const metadata = result.serverMetadata();
    if (metadata.issuer !== config.issuer || metadata.authorization_endpoint !== authorizationEndpoint ||
        metadata.token_endpoint !== tokenEndpoint || metadata.jwks_uri !== policy.jwksUri ||
        !metadata.id_token_signing_alg_values_supported?.includes(policy.allowedAlgorithms[0]) ||
        !result.serverMetadata().supportsPKCE('S256')) throw new InvalidOidcResponseError();
    return result;
  };
  const adapter = createOidcLibraryAdapter({ ...options, config, policy, library: {
    async exchangeAndVerify(input) {
      const discovered = await discover(input.signal, input.now);
      const callback = new URL(input.redirectUri);
      callback.search = new URLSearchParams({ code: input.code, state: input.state }).toString();
      let tokens: Awaited<ReturnType<typeof client.authorizationCodeGrant>>;
      try {
        tokens = await client.authorizationCodeGrant(discovered, callback, {
          pkceCodeVerifier: input.codeVerifier, expectedNonce: input.nonce,
          expectedState: input.state, idTokenExpected: true,
        });
      } catch (error) {
        if (error instanceof client.ClientError &&
            ['OAUTH_JWT_CLAIM_COMPARISON_FAILED', 'OAUTH_JWT_TIMESTAMP_CHECK_FAILED',
              'OAUTH_INVALID_RESPONSE', 'OAUTH_KEY_SELECTION_FAILED'].includes(error.code ?? ''))
          throw new InvalidOidcResponseError();
        throw error;
      }
      input.signal.throwIfAborted();
      if (!tokens.id_token || Buffer.byteLength(tokens.id_token) > policy.maxIdTokenBytes)
        throw new InvalidOidcResponseError();
      const claims = tokens.claims();
      if (!claims || typeof claims.nonce !== 'string' ||
          (claims.azp !== undefined && typeof claims.azp !== 'string')) throw new InvalidOidcResponseError();
      return { signatureVerified: true, algorithm: policy.allowedAlgorithms[0], claims: {
        iss: claims.iss, aud: claims.aud, sub: claims.sub, nonce: claims.nonce,
        exp: claims.exp, iat: claims.iat, ...(claims.azp !== undefined ? { azp: claims.azp } : {}),
      } };
    },
  } });
  return {
    ...adapter,
    async authorizationUrl(record: OAuthStateRecord): Promise<URL> {
      const controller = new AbortController();
      try {
        const now = options.now();
        if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('INVALID_OIDC_CLOCK');
        const discovered = await withStoreTimeout(discover(controller.signal, now), config.timeoutMs);
        return client.buildAuthorizationUrl(discovered, {
          redirect_uri: config.callbackUrl, response_type: 'code', scope: 'openid',
          state: record.state, nonce: record.nonce, code_challenge_method: 'S256',
          code_challenge: await client.calculatePKCECodeChallenge(record.verifier),
        });
      } finally {
        controller.abort();
      }
    },
  };
}
