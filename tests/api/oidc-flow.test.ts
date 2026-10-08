// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createOidcFlow, type OAuthStateRecord, type VerifiedOidcClaims } from '../../api/_lib/oidc-flow';

function setup() {
  const states = new Map<string, OAuthStateRecord>();
  const now = () => new Date('2026-10-06T02:00:00.000Z');
  let consumed: OAuthStateRecord | undefined;
  const provider = vi.fn(async (_code: string, _verifier: string, _callback: string): Promise<VerifiedOidcClaims> => ({
    issuer: 'https://accounts.google.com', audience: 'FIXTURE_CLIENT', subject: 'trusted-subject',
    nonce: consumed?.nonce ?? '', expiresAtSeconds: now().getTime() / 1000 + 60,
    issuedAtSeconds: now().getTime() / 1000,
  }));
  const session = vi.fn(async () => 'FIXTURE_SESSION=opaque; HttpOnly; Secure; SameSite=Strict');
  const flow = createOidcFlow({
    config: { issuer: 'https://accounts.google.com', clientId: 'FIXTURE_CLIENT',
      origin: 'https://fixture.invalid', callbackUrl: 'https://fixture.invalid/api/auth/callback',
      stateCookieName: 'FIXTURE_STATE', stateLifetimeMs: 30_000, timeoutMs: 50 },
    stateSigningKey: Buffer.alloc(32, 1), now, audit: vi.fn(), sessions: { create: session },
    states: {
      create: async (record) => { states.set(record.state, record); },
      consume: async (state) => { consumed = states.get(state); states.delete(state); return consumed ?? null; },
    },
    provider: { exchangeAndVerify: provider },
  });
  return { flow, states, provider, session };
}

async function login(c: ReturnType<typeof setup>) {
  const response = await c.flow.login(new Request('https://fixture.invalid/api/auth/login?return=https://attacker.invalid'));
  const url = new URL(response.headers.get('location')!);
  return { url, cookie: response.headers.get('set-cookie')!.split(';')[0],
    callback: () => new Request(`https://fixture.invalid/api/auth/callback?code=FIXTURE_CODE&state=${url.searchParams.get('state')}`,
      { headers: { cookie: response.headers.get('set-cookie')!.split(';')[0] } }) };
}

describe('L2 OIDC code／PKCE／state（provider 驗證為 mock，不是 JWKS 證據）', () => {
  it('S256／Lax／state single-use，不接受任意 return URL、不補送付費請求', async () => {
    const c = setup(), l = await login(c);
    expect(l.url.origin).toBe('https://accounts.google.com');
    expect(l.url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(l.cookie).not.toContain('verifier');
    expect((await c.flow.callback(l.callback())).headers.get('location')).toBe('/');
    expect((await c.flow.callback(l.callback())).status).toBe(401);
    expect(c.provider).toHaveBeenCalledTimes(1);
    expect(c.session).toHaveBeenCalledTimes(1);
  });
  it.each(['issuer', 'audience', 'subject', 'nonce', 'expiresAtSeconds', 'issuedAtSeconds'] as const)('錯誤 claim %s 不建立 Session', async (field) => {
    const c = setup(), l = await login(c);
    const claims: VerifiedOidcClaims = { issuer: 'https://accounts.google.com', audience: 'FIXTURE_CLIENT',
      subject: 'subject', nonce: [...c.states.values()][0].nonce, expiresAtSeconds: Date.parse('2026-10-06T03:00:00.000Z') / 1000,
      issuedAtSeconds: Date.parse('2026-10-06T02:00:00.000Z') / 1000 };
    if (field === 'expiresAtSeconds') claims.expiresAtSeconds = 0;
    else if (field === 'issuedAtSeconds') claims.issuedAtSeconds += 1;
    else claims[field] = field === 'subject' ? '' : 'attacker';
    c.provider.mockResolvedValueOnce(claims);
    expect((await c.flow.callback(l.callback())).status).toBe(401);
    expect(c.session).not.toHaveBeenCalled();
  });
  it('缺 cookie 不交換 code；provider 失敗不建立 Session且不重試', async () => {
    const c = setup(), l = await login(c);
    expect((await c.flow.callback(new Request(l.callback().url))).status).toBe(401);
    expect(c.provider).not.toHaveBeenCalled();
    c.provider.mockRejectedValueOnce(new Error('FIXTURE_PROVIDER_ERROR'));
    expect((await c.flow.callback(l.callback())).status).toBe(503);
    expect(c.provider).toHaveBeenCalledTimes(1);
    expect(c.session).not.toHaveBeenCalled();
  });
  it.each(['cookie_signature', 'state', 'expired_state', 'verifier', 'duplicate_state', 'provider_error'] as const)(
    '%s callback 拒絕時不交換 code、不建立 Session', async (failure) => {
      const c = setup(), l = await login(c);
      const url = new URL(l.callback().url);
      let cookie = l.cookie;
      const record = [...c.states.values()][0];
      if (failure === 'cookie_signature') cookie = cookie.slice(0, -1) + 'x';
      if (failure === 'state') url.searchParams.set('state', 'x'.repeat(43));
      if (failure === 'expired_state') record.expiresAt = '2026-10-06T02:00:00.000Z';
      if (failure === 'verifier') record.verifier = 'invalid';
      if (failure === 'duplicate_state') url.searchParams.append('state', record.state);
      if (failure === 'provider_error') url.searchParams.set('error', 'access_denied');
      expect((await c.flow.callback(new Request(url, { headers: { cookie } }))).status).toBe(401);
      expect(c.provider).not.toHaveBeenCalled();
      expect(c.session).not.toHaveBeenCalled();
    });
});
