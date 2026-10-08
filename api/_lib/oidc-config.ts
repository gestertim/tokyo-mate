export interface OidcConfig {
  issuer: 'https://accounts.google.com';
  clientId: string;
  callbackUrl: string;
  origin: string;
  stateCookieName: string;
  stateLifetimeMs: number;
  timeoutMs: number;
}

export const OIDC_ENVIRONMENT_NAMES = ['OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET'] as const;

export function validateOidcConfig(config: OidcConfig): OidcConfig {
  const origin = new URL(config.origin), callback = new URL(config.callbackUrl);
  if (config.issuer !== 'https://accounts.google.com' || typeof config.clientId !== 'string' ||
      !config.clientId.trim() || /\s/.test(config.clientId) ||
      origin.protocol !== 'https:' || origin.origin !== config.origin ||
      callback.origin !== origin.origin || callback.pathname !== '/api/auth/callback' ||
      callback.search || callback.hash || callback.username || callback.password ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(config.stateCookieName) ||
      !Number.isSafeInteger(config.stateLifetimeMs) || config.stateLifetimeMs < 1000 ||
      !Number.isSafeInteger(config.timeoutMs) || config.timeoutMs <= 0)
    throw new TypeError('OIDC 需要可信 Google issuer、同源 callback 及明確期限／timeout');
  return { ...config };
}
