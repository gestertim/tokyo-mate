// @vitest-environment node
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { CustomFetch } from 'openid-client';
import { createOpenidClientProvider } from '../../api/_lib/openid-client-binding';
import { createOidcFlow, type OAuthStateRecord } from '../../api/_lib/oidc-flow';

const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...pair.publicKey.export({ format: 'jwk' }), kid: 'local-test-key', use: 'sig', alg: 'RS256' };
function fixture() {
  const config = { issuer: 'https://accounts.google.com' as const, clientId: 'LOCAL_TEST_CLIENT',
    origin: 'https://fixture.invalid', callbackUrl: 'https://fixture.invalid/api/auth/callback',
    stateCookieName: 'LOCAL_STATE', stateLifetimeMs: 300000, timeoutMs: 2000 };
  const now = () => new Date();
  const policy = { jwksUri: 'https://www.googleapis.com/oauth2/v3/certs', allowedAlgorithms: ['RS256'],
    maxTokenAgeSeconds: 300, maxIdTokenBytes: 4096, maxCodeBytes: 128 };
  const nonce = 'n'.repeat(43), verifier = 'v'.repeat(43), state = 's'.repeat(43);
  const seconds = Math.floor(Date.now() / 1000);
  const claims: Record<string, unknown> = {
    iss: config.issuer, aud: config.clientId, sub: 'local-subject', nonce, iat: seconds, exp: seconds + 60,
  };
  let wrongSignature = false, jwksFailure = false;
  const used = new Set<string>();
  const metadata = { issuer: config.issuer as string, authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_endpoint: 'https://oauth2.googleapis.com/token', jwks_uri: policy.jwksUri,
    response_types_supported: ['code'], subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'], code_challenge_methods_supported: ['S256'] };
  const transport = vi.fn<CustomFetch>(async (url, init) => {
    if (url.endsWith('/.well-known/openid-configuration')) return Response.json(metadata);
    if (url === policy.jwksUri) return jwksFailure ? new Response('unavailable', { status: 503 }) : Response.json({ keys: [jwk] });
    if (url !== metadata.token_endpoint) throw new Error('LOCAL_TRANSPORT_REJECTED_NETWORK');
    const params = new URLSearchParams(String(init.body));
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('code_verifier')).toBe(verifier);
    expect(params.get('redirect_uri')).toBe(config.callbackUrl);
    expect(params.get('client_id')).toBe(config.clientId);
    expect(params.get('client_secret')).toBe('LOCAL_TEST_SECRET');
    const code = params.get('code')!;
    if (used.has(code)) return Response.json({ error: 'invalid_grant' }, { status: 400 });
    used.add(code);
    const encoded = [Buffer.from(JSON.stringify({ alg: 'RS256', kid: jwk.kid })).toString('base64url'),
      Buffer.from(JSON.stringify(claims)).toString('base64url')].join('.');
    const signature = sign('RSA-SHA256', Buffer.from(encoded), wrongSignature ? otherPair.privateKey : pair.privateKey);
    return Response.json({ access_token: 'LOCAL_UNUSED_ACCESS_TOKEN', token_type: 'Bearer',
      id_token: `${encoded}.${signature.toString('base64url')}` });
  });
  const options = { config, policy, now, clientSecret: 'LOCAL_TEST_SECRET', transport };
  const provider = createOpenidClientProvider(options);
  const run = (code = 'LOCAL_CODE') => provider.exchangeAndVerify(code, verifier, config.callbackUrl, nonce, state);
  return { config, policy, nonce, verifier, state, claims, metadata, transport, options, provider, run,
    badSignature: () => { wrongSignature = true; }, badJwks: () => { jwksFailure = true; } };
}

describe('D13 真實 openid-client、RSA/JWKS 與攔截 transport（無 Google 帳戶）', () => {
  it('library 建 authorization URL、S256、交換並驗簽，不取得 profile／付費資格', async () => {
    const f = fixture();
    const url = await f.provider.authorizationUrl({ state: f.state, nonce: f.nonce, verifier: f.verifier,
      expiresAt: new Date(Date.now() + 300000).toISOString() });
    expect(url.origin + url.pathname).toBe(f.metadata.authorization_endpoint);
    expect(url.searchParams.get('scope')).toBe('openid');
    expect(url.searchParams.get('state')).toBe(f.state);
    expect(url.searchParams.get('nonce')).toBe(f.nonce);
    expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(f.verifier).digest('base64url'));
    expect(await f.run()).toMatchObject({ subject: 'local-subject', issuer: f.config.issuer });
    expect(f.transport.mock.calls.filter(([url]) => url === f.metadata.token_endpoint)).toHaveLength(1);
    expect(f.transport.mock.calls.filter(([url]) => url === f.policy.jwksUri)).toHaveLength(1);
  });
  it.each(['iss', 'aud', 'nonce', 'exp', 'iat', 'old_iat', 'azp', 'multi_aud', 'missing_iat'] as const)(
    '拒絕 %s，不回傳 Session claims', async (field) => {
      const f = fixture();
      if (field === 'exp') f.claims.exp = Math.floor(Date.now() / 1000) - 1;
      else if (field === 'iat') f.claims.iat = Math.floor(Date.now() / 1000) + 60;
      else if (field === 'old_iat') f.claims.iat = Math.floor(Date.now() / 1000) - 301;
      else if (field === 'missing_iat') delete f.claims.iat;
      else if (field === 'multi_aud') f.claims.aud = [f.config.clientId, 'another-client'];
      else f.claims[field] = 'invalid';
      await expect(f.run()).rejects.toThrow();
    });
  it('matching多audience／azp可通過；錯誤簽章與JWKS皆拒絕', async () => {
    const f = fixture();
    f.claims.aud = [f.config.clientId, 'another-client'];
    f.claims.azp = f.config.clientId;
    await expect(f.run()).resolves.toMatchObject({ audience: f.config.clientId });
    const bad = fixture(); bad.badSignature();
    await expect(bad.run()).rejects.toThrow();
    const jwks = fixture(); jwks.badJwks();
    await expect(jwks.run()).rejects.toThrow();
  });
  it.each(['issuer', 'jwks_uri', 'token_endpoint', 'authorization_endpoint'] as const)(
    'discovery %s 污染不交換 code／不連其他 host', async (field) => {
      const f = fixture();
      f.metadata[field] = 'https://attacker.invalid';
      await expect(f.run()).rejects.toThrow();
      expect(f.transport.mock.calls).toHaveLength(1);
    });
  it('code 單次使用：新的state也不能使同code再成功', async () => {
    const f = fixture();
    await f.run();
    await expect(f.run()).rejects.toThrow();
    expect(f.transport.mock.calls.filter(([url]) => url === f.metadata.token_endpoint)).toHaveLength(2);
  });
  it('缺state／code超限不出站；ID token bytes超限拒絕', async () => {
    const f = fixture();
    await expect(f.provider.exchangeAndVerify('LOCAL_CODE', f.verifier, f.config.callbackUrl, f.nonce)).rejects.toThrow();
    await expect(f.run('c'.repeat(129))).rejects.toThrow();
    expect(f.transport).not.toHaveBeenCalled();
    const small = createOpenidClientProvider({ ...f.options, policy: { ...f.policy, maxIdTokenBytes: 100 } });
    await expect(small.exchangeAndVerify('LOCAL_CODE', f.verifier, f.config.callbackUrl, f.nonce, f.state)).rejects.toThrow();
  });
  it('不允許的JWT algorithm、錯誤kid及非JWT不能以decode成功', async () => {
    for (const variant of ['algorithm', 'kid', 'malformed']) {
      const f = fixture(), normal = f.transport.getMockImplementation()!;
      f.transport.mockImplementation(async (url, init) => {
        const response = await normal(url, init);
        if (url !== f.metadata.token_endpoint) return response;
        const data = await response.json();
        if (variant === 'malformed') data.id_token = 'not-a-jwt';
        else {
          const payload = String(data.id_token).split('.')[1];
          const header = Buffer.from(JSON.stringify({ alg: variant === 'algorithm' ? 'HS256' : 'RS256',
            kid: variant === 'kid' ? 'unknown-kid' : jwk.kid })).toString('base64url');
          const encoded = `${header}.${payload}`;
          data.id_token = `${encoded}.${sign('RSA-SHA256', Buffer.from(encoded), pair.privateKey).toString('base64url')}`;
        }
        return Response.json(data);
      });
      await expect(f.run()).rejects.toThrow();
    }
  });
  it.each(['discovery', 'token', 'jwks'] as const)('%s timeout abort、零重試、無晚到成功', async (stage) => {
    const f = fixture();
    const normal = f.transport.getMockImplementation()!;
    let signal: AbortSignal | undefined;
    f.transport.mockImplementation(async (url, init) => {
      const target = stage === 'discovery' ? url.endsWith('/.well-known/openid-configuration')
        : stage === 'token' ? url === f.metadata.token_endpoint : url === f.policy.jwksUri;
      if (!target) return normal(url, init);
      signal = init.signal;
      return new Promise<Response>((_, reject) => init.signal?.addEventListener('abort',
        () => reject(new Error('LOCAL_ABORT')), { once: true }));
    });
    const provider = createOpenidClientProvider({ ...f.options, config: { ...f.config, timeoutMs: 40 } });
    await expect(provider.exchangeAndVerify('LOCAL_CODE', f.verifier, f.config.callbackUrl, f.nonce, f.state)).rejects.toThrow();
    expect(signal?.aborted).toBe(true);
    expect(f.transport.mock.calls.filter(([url]) => url === f.metadata.token_endpoint).length).toBeLessThanOrEqual(1);
  });
  it.each([false, true])('真實binding接flow；signature failure=%s、state單次消耗', async (failure) => {
    const f = fixture();
    const records = new Map<string, OAuthStateRecord>();
    const sessions = { create: vi.fn(async () => 'LOCAL_SESSION=opaque; HttpOnly; Secure') };
    const flow = createOidcFlow({ config: f.config, stateSigningKey: Buffer.alloc(32, 1), now: f.options.now,
      provider: f.provider, sessions, audit: vi.fn(), states: {
        create: async (record) => { records.set(record.state, record); },
        consume: async (state) => { const record = records.get(state); records.delete(state); return record ?? null; },
      } });
    const login = await flow.login(new Request(`${f.config.origin}/api/auth/login`));
    expect(login.status).toBe(302);
    const url = new URL(login.headers.get('location')!);
    const state = url.searchParams.get('state')!, record = records.get(state)!;
    f.claims.nonce = record.nonce;
    if (failure) f.badSignature();
    const normal = f.transport.getMockImplementation()!;
    f.transport.mockImplementation((url, init) => {
      if (url === f.metadata.token_endpoint) {
        const body = new URLSearchParams(String(init.body));
        expect(body.get('code_verifier')).toBe(record.verifier);
        body.set('code_verifier', f.verifier);
        return normal(url, { ...init, body });
      }
      return normal(url, init);
    });
    const callback = () => new Request(`${f.config.callbackUrl}?code=LOCAL_CODE&state=${state}`,
      { headers: { cookie: login.headers.get('set-cookie')!.split(';')[0] } });
    expect((await flow.callback(callback())).status).toBe(failure ? 401 : 302);
    expect((await flow.callback(callback())).status).toBe(401);
    if (failure) expect(sessions.create).not.toHaveBeenCalled();
    else expect(sessions.create).toHaveBeenCalledExactlyOnceWith('local-subject');
    expect(records.size).toBe(0);
  });
});
