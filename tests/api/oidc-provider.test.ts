// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createOidcLibraryAdapter, InvalidOidcResponseError, type OidcClientLibrary } from '../../api/_lib/oidc-provider';
import { createOidcFlow, type OAuthStateRecord } from '../../api/_lib/oidc-flow';

const fixture = () => {
  const config = { issuer: 'https://accounts.google.com' as const, clientId: 'FIXTURE_CLIENT',
    origin: 'https://fixture.invalid', callbackUrl: 'https://fixture.invalid/api/auth/callback',
    stateCookieName: 'FIXTURE_STATE', stateLifetimeMs: 30_000, timeoutMs: 50 };
  const policy = { jwksUri: 'https://www.googleapis.com/oauth2/v3/certs', allowedAlgorithms: ['RS256'],
    maxTokenAgeSeconds: 60, maxIdTokenBytes: 2000, maxCodeBytes: 128 };
  const now = () => new Date('2026-10-06T02:00:00.000Z');
  const claims = { iss: config.issuer as string, aud: config.clientId as string | string[], sub: 'FIXTURE_SUBJECT',
    nonce: 'n'.repeat(43), exp: now().getTime() / 1000 + 60, iat: now().getTime() / 1000, azp: undefined as string | undefined };
  const result = { signatureVerified: true as const, algorithm: 'RS256', claims };
  const library = {
    exchangeAuthorizationCode: vi.fn<OidcClientLibrary['exchangeAuthorizationCode']>()
      .mockResolvedValue({ idToken: 'FIXTURE_ID_TOKEN_NOT_A_REAL_JWT' }),
    verifyIdToken: vi.fn<OidcClientLibrary['verifyIdToken']>().mockImplementation(async () => result),
  };
  const options = { config, clientSecret: 'FIXTURE_SECRET_NOT_REAL', policy, library, now };
  const adapter = createOidcLibraryAdapter(options);
  const run = () => adapter.exchangeAndVerify('FIXTURE_CODE', 'v'.repeat(43), config.callbackUrl, claims.nonce);
  return { config, policy, now, claims, result, library, options, adapter, run };
};

describe('OIDC library adapter（mock port；不代表真實 JWT／JWKS 驗證）', () => {
  it('一次 code exchange 傳 PKCE／server-only secret；library 取得 signature／claims 必要政策', async () => {
    const c = fixture();
    expect(await c.run()).toMatchObject({ subject: 'FIXTURE_SUBJECT', issuedAtSeconds: c.claims.iat });
    expect(c.library.exchangeAuthorizationCode).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      issuer: c.config.issuer, clientId: c.config.clientId, clientSecret: c.options.clientSecret,
      redirectUri: c.config.callbackUrl, code: 'FIXTURE_CODE', codeVerifier: 'v'.repeat(43),
    }));
    expect(c.library.verifyIdToken).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      issuer: c.config.issuer, audience: c.config.clientId, nonce: c.claims.nonce,
      jwksUri: c.policy.jwksUri, allowedAlgorithms: ['RS256'], maxTokenAgeSeconds: 60, now: c.now(),
    }));
    expect(c.library.verifyIdToken.mock.calls[0][0].signal.aborted).toBe(true);
  });
  it.each(['iss', 'aud', 'nonce', 'sub', 'exp', 'iat', 'azp', 'signature', 'algorithm', 'old_iat', 'missing_iat'] as const)(
    '%s 驗證失敗不能回傳可建立 Session 的 claims', async (field) => {
      const c = fixture();
      if (field === 'signature') Reflect.set(c.result, 'signatureVerified', false);
      else if (field === 'algorithm') c.result.algorithm = 'none';
      else if (field === 'exp') c.claims.exp = c.claims.iat;
      else if (field === 'iat') c.claims.iat += 1;
      else if (field === 'old_iat') c.claims.iat -= 61;
      else if (field === 'missing_iat') Reflect.deleteProperty(c.claims, 'iat');
      else Reflect.set(c.claims, field, field === 'sub' ? '' : 'attacker');
      // nonce 比對使用原始可信 state，不跟著污染的 claims 變動。
      await expect(c.adapter.exchangeAndVerify('FIXTURE_CODE', 'v'.repeat(43), c.config.callbackUrl, 'n'.repeat(43)))
        .rejects.toBeInstanceOf(InvalidOidcResponseError);
    });
  it('多 audience 需要 matching azp；library 拒絕 JWKS／簽章不重試', async () => {
    const c = fixture();
    c.claims.aud = ['OTHER_CLIENT', c.config.clientId];
    await expect(c.run()).rejects.toBeInstanceOf(InvalidOidcResponseError);
    c.claims.azp = c.config.clientId;
    await expect(c.run()).resolves.toMatchObject({ audience: c.config.clientId });
    c.library.verifyIdToken.mockRejectedValueOnce(new Error('FIXTURE_INVALID_SIGNATURE_OR_JWKS'));
    await expect(c.run()).rejects.toBeInstanceOf(InvalidOidcResponseError);
    expect(c.library.exchangeAuthorizationCode).toHaveBeenCalledTimes(3);
    expect(c.library.verifyIdToken).toHaveBeenCalledTimes(3);
  });
  it.each(['clientSecret', 'jwksUri', 'allowedAlgorithms', 'maxTokenAgeSeconds', 'maxIdTokenBytes', 'maxCodeBytes'])(
    '缺少／不安全 %s 設定不得採預設', (field) => {
      const c = fixture();
      if (field === 'clientSecret') c.options.clientSecret = '';
      else Reflect.set(c.policy, field, field === 'allowedAlgorithms' ? ['HS256'] : field === 'jwksUri' ? 'https://attacker.invalid' : 0);
      expect(() => createOidcLibraryAdapter(c.options)).toThrow(TypeError);
    });
  it('無效 PKCE／callback／code 上限不交換；過大或缺 ID token 不進 library verify', async () => {
    const c = fixture();
    for (const [code, verifier, callback] of [
      ['x'.repeat(129), 'v'.repeat(43), c.config.callbackUrl],
      ['FIXTURE_CODE', 'wrong-verifier', c.config.callbackUrl],
      ['FIXTURE_CODE', 'v'.repeat(43), 'https://attacker.invalid/api/auth/callback'],
    ]) await expect(c.adapter.exchangeAndVerify(code, verifier, callback, c.claims.nonce)).rejects.toBeInstanceOf(InvalidOidcResponseError);
    expect(c.library.exchangeAuthorizationCode).not.toHaveBeenCalled();
    c.library.exchangeAuthorizationCode.mockResolvedValueOnce({ idToken: '' })
      .mockResolvedValueOnce({ idToken: 'x'.repeat(2001) });
    await expect(c.run()).rejects.toBeInstanceOf(InvalidOidcResponseError);
    await expect(c.run()).rejects.toBeInstanceOf(InvalidOidcResponseError);
    expect(c.library.verifyIdToken).not.toHaveBeenCalled();
  });
  it('timeout abort、不重試、不回傳晚到 claims', async () => {
    const c = fixture();
    c.library.exchangeAuthorizationCode.mockImplementationOnce(() => new Promise(() => {}));
    await expect(c.run()).rejects.toThrow();
    expect(c.library.exchangeAuthorizationCode).toHaveBeenCalledTimes(1);
    expect(c.library.exchangeAuthorizationCode.mock.calls[0][0].signal.aborted).toBe(true);
    expect(c.library.verifyIdToken).not.toHaveBeenCalled();
  });
  it.each(['signature', 'exchange'] as const)('完整 flow %s 失敗不建立 Session、state 消耗後不能重送', async (failure) => {
    const c = fixture();
    const states = new Map<string, OAuthStateRecord>();
    const create = vi.fn(async () => 'FIXTURE_SESSION=opaque');
    const flow = createOidcFlow({ config: c.config, stateSigningKey: Buffer.alloc(32, 1), now: c.now,
      audit: vi.fn(), provider: c.adapter, sessions: { create }, states: {
        create: async (value) => { states.set(value.state, value); },
        consume: async (state) => { const value = states.get(state); states.delete(state); return value ?? null; },
      } });
    const login = await flow.login(new Request('https://fixture.invalid/api/auth/login'));
    const url = new URL(login.headers.get('location')!);
    const state = url.searchParams.get('state')!, record = states.get(state)!;
    expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(record.verifier).digest('base64url'));
    c.claims.nonce = record.nonce;
    if (failure === 'signature') c.library.verifyIdToken.mockRejectedValueOnce(new Error('FIXTURE_BAD_SIGNATURE'));
    else c.library.exchangeAuthorizationCode.mockRejectedValueOnce(new Error('FIXTURE_EXCHANGE_UNAVAILABLE'));
    const callback = () => new Request(`${c.config.callbackUrl}?code=FIXTURE_CODE&state=${state}`,
      { headers: { cookie: login.headers.get('set-cookie')!.split(';')[0] } });
    expect((await flow.callback(callback())).status).toBe(failure === 'signature' ? 401 : 503);
    expect((await flow.callback(callback())).status).toBe(401);
    expect(create).not.toHaveBeenCalled();
    expect(c.library.exchangeAuthorizationCode).toHaveBeenCalledTimes(1);
  });
});
