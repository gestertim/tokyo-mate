// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { OIDC_ENVIRONMENT_NAMES, validateOidcConfig, type OidcConfig } from '../../api/_lib/oidc-config';
import { GET as login } from '../../api/auth/login';
import { GET as callback } from '../../api/auth/callback';

const fixture = (): OidcConfig => ({
  issuer: 'https://accounts.google.com', clientId: 'FIXTURE_CLIENT',
  origin: 'https://fixture.invalid', callbackUrl: 'https://fixture.invalid/api/auth/callback',
  stateCookieName: 'FIXTURE_STATE', stateLifetimeMs: 30000, timeoutMs: 100,
});
describe('T009 OIDC 設定介面（不讀寫正式 env）', () => {
  it('只定義已批准名稱與 Google code＋PKCE 設定，不產生秘密', () => {
    expect(OIDC_ENVIRONMENT_NAMES).toEqual(['OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET']);
    expect(validateOidcConfig(fixture())).toEqual(fixture());
  });
  it.each(['issuer', 'callbackUrl', 'stateLifetimeMs', 'timeoutMs'] as const)('錯誤 %s 不採預設', (field) => {
    const value = fixture();
    Reflect.set(value, field, field.endsWith('Ms') ? 0 : 'https://attacker.invalid');
    expect(() => validateOidcConfig(value)).toThrow();
  });
  it.each([login, callback])('未配置 auth GET 明確拒絕；405 Allow 不誤寫 POST', async (handler) => {
    const unavailable = await handler(new Request('https://fixture.invalid/api/auth/login'));
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get('Cache-Control')).toBe('no-store');
    const mismatch = await handler(new Request('https://fixture.invalid/api/auth/login', { method: 'POST' }));
    expect(mismatch.status).toBe(405);
    expect(mismatch.headers.get('Allow')).toBe('GET');
  });
  it.each(['', ' ', 'client id', 1])('無效client ID %s不被接受', (clientId) => {
    const config = fixture();
    Reflect.set(config, 'clientId', clientId);
    expect(() => validateOidcConfig(config)).toThrow();
  });
});
