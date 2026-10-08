// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createSessionService, type SessionRecord, type SessionStore } from '../../api/_lib/session';
import { createSessionEndpoints } from '../../api/_lib/session-endpoints';
import { createSelfServiceEndpoints } from '../../api/_lib/self-service-endpoints';

function setup() {
  let now = new Date('2026-10-06T02:00:00.000Z');
  const records = new Map<string, SessionRecord>();
  const store: SessionStore = {
    create: async (record) => { records.set(record.sessionId, structuredClone(record)); },
    get: async (id) => structuredClone(records.get(id) ?? null),
    revoke: async (id, at) => { const r = records.get(id); if (r) r.revokedAt = at; },
  };
  const audit = vi.fn();
  const service = createSessionService({ store, signingKey: Buffer.alloc(32, 1), lifetimeMs: 60_000,
    storeTimeoutMs: 20, cookieName: 'FIXTURE_SESSION', now: () => now, audit });
  const value = (header: string) => header.split(';')[0].split('=')[1];
  return { store, records, audit, service, value, now: () => now, setNow: (at: string) => { now = new Date(at); } };
}

describe('L2 Session（只有 mock／fixture 期限，無 OIDC 外部證據）', () => {
  it('opaque cookie 不含 subject／role，逐次查 store；logout 冪等', async () => {
    const c = setup();
    const cookie = await c.service.create('private-subject');
    expect(cookie).toContain('HttpOnly; Secure; SameSite=Strict');
    expect(cookie).not.toContain('private-subject');
    const lookup = vi.spyOn(c.store, 'get');
    expect(await c.service.lookup(c.value(cookie), c.now())).toMatchObject({ kind: 'authenticated', subject: 'private-subject' });
    expect(await c.service.lookup(c.value(cookie), c.now())).toMatchObject({ kind: 'authenticated' });
    expect(lookup).toHaveBeenCalledTimes(2);
    await c.service.logout(c.value(cookie));
    await c.service.logout(c.value(cookie));
    expect(await c.service.lookup(c.value(cookie), c.now())).toEqual({ kind: 'unauthenticated' });
  });
  it('竄改、重複 Cookie、到期均不取得身分', async () => {
    const c = setup();
    const cookie = await c.service.create('subject');
    const signed = c.value(cookie);
    expect(await c.service.lookup(`${signed.slice(0, -1)}x`, c.now())).toEqual({ kind: 'unauthenticated' });
    const request = new Request('https://fixture.invalid', { headers: { cookie: `FIXTURE_SESSION=${signed}; FIXTURE_SESSION=${signed}` } });
    expect(c.service.readCookie(request)).toBeNull();
    c.setNow('2026-10-06T02:01:00.000Z');
    expect(await c.service.lookup(signed, c.now())).toEqual({ kind: 'unauthenticated' });
  });
  it('store timeout／無效資料 fail-closed 且記錄，不當成未登入成功', async () => {
    const c = setup();
    const cookie = await c.service.create('subject');
    vi.spyOn(c.store, 'get').mockImplementationOnce(() => new Promise(() => {}));
    expect(await c.service.lookup(c.value(cookie), c.now())).toEqual({ kind: 'unavailable' });
    expect(c.audit).toHaveBeenCalledWith({ operation: 'session', outcome: 'unavailable' });
    const record = [...c.records.values()][0];
    record.expiresAt = 'invalid';
    expect(await c.service.lookup(c.value(cookie), c.now())).toEqual({ kind: 'unavailable' });
  });
  it('未設定期限／金鑰不得採預設或前端值', () => {
    const c = setup();
    expect(() => createSessionService({ store: c.store, signingKey: new Uint8Array(), lifetimeMs: 0,
      storeTimeoutMs: 20, cookieName: 'FIXTURE', now: c.now, audit: c.audit })).toThrow();
  });
  it('Session endpoint 只揭露布林值；logout 同源、冪等且撤銷紀錄', async () => {
    const c = setup();
    const endpoints = createSessionEndpoints({ sessions: c.service, origin: 'https://fixture.invalid',
      timeoutMs: 20, now: c.now, audit: c.audit });
    const cookie = (await c.service.create('private-subject')).split(';')[0];
    const response = await endpoints.session(new Request('https://fixture.invalid/api/auth/session', { headers: { cookie } }));
    expect(await response.json()).toEqual({ success: true, data: { authenticated: true } });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await endpoints.logout(new Request('https://fixture.invalid/api/auth/logout', {
      method: 'POST', headers: { cookie, origin: 'https://attacker.invalid' },
    }))).status).toBe(400);
    const request = () => new Request('https://fixture.invalid/api/auth/logout', {
      method: 'POST', headers: { cookie, origin: 'https://fixture.invalid' },
    });
    expect((await endpoints.logout(request())).status).toBe(200);
    expect((await endpoints.logout(request())).status).toBe(200);
    expect(await c.service.lookup(c.value(cookie), c.now())).toEqual({ kind: 'unauthenticated' });
  });
  it('保留有效簽章亦不能略過每次 endpoint store lookup／缺失／故障／撤銷', async () => {
    const c = setup();
    const endpoints = createSessionEndpoints({ sessions: c.service, origin: 'https://fixture.invalid',
      timeoutMs: 50, now: c.now, audit: c.audit });
    const cookie = (await c.service.create('subject')).split(';')[0];
    const request = () => new Request('https://fixture.invalid/api/auth/session', { headers: { cookie } });
    const get = vi.spyOn(c.store, 'get');
    expect(await (await endpoints.session(request())).json()).toMatchObject({ data: { authenticated: true } });
    expect(await (await endpoints.session(request())).json()).toMatchObject({ data: { authenticated: true } });
    expect(get).toHaveBeenCalledTimes(2);
    get.mockRejectedValueOnce(new Error('FIXTURE_STORE_DOWN'));
    expect((await endpoints.session(request())).status).toBe(503);
    await c.service.logout(c.value(cookie));
    expect(await (await endpoints.session(request())).json()).toMatchObject({ data: { authenticated: false } });
    c.records.clear();
    expect(await (await endpoints.session(request())).json()).toMatchObject({ data: { authenticated: false } });
    expect(get).toHaveBeenCalledTimes(5);
  });
  it('有 Session 簽章仍逐請求檢查核准資格；撤銷只回403，不沿用先前結果', async () => {
    const c = setup();
    const window = { limitEstimatedUsdMicro: 3_000_000, usedEstimatedUsdMicro: 0,
      reservedEstimatedUsdMicro: 0, remainingEstimatedUsdMicro: 3_000_000,
      baseLimitEstimatedUsdMicro: 3_000_000, cumulativeTopUpEstimatedUsdMicro: 0,
      resetAt: '2026-10-06T16:00:00.000Z' };
    const getSnapshot = vi.fn().mockResolvedValueOnce({ ok: true, tier: 'tier1',
      snapshot: { day: window, week: window } }).mockResolvedValue({ ok: false, status: 403 });
    const endpoints = createSelfServiceEndpoints({ sessions: c.service, origin: 'https://fixture.invalid',
      timeoutMs: 50, now: c.now, audit: c.audit,
      engine: { getSnapshot, getAtomicSnapshot: vi.fn() } });
    const cookie = (await c.service.create('subject')).split(';')[0];
    const request = () => new Request('https://fixture.invalid/api/me/quota', { headers: { cookie } });
    const get = vi.spyOn(c.store, 'get');
    expect((await endpoints.quota(request())).status).toBe(200);
    expect((await endpoints.quota(request())).status).toBe(403);
    expect(getSnapshot).toHaveBeenCalledTimes(2);
    expect(getSnapshot).toHaveBeenCalledWith({ identitySubject: 'subject' });
    expect(get).toHaveBeenCalledTimes(2);
    await c.service.logout(c.value(cookie));
    expect((await endpoints.quota(request())).status).toBe(401);
    expect(getSnapshot).toHaveBeenCalledTimes(2);
  });
  it('logout store 失敗不得回成功或宣稱已撤銷', async () => {
    const c = setup();
    const endpoints = createSessionEndpoints({ sessions: c.service, origin: 'https://fixture.invalid',
      timeoutMs: 50, now: c.now, audit: c.audit });
    const cookie = (await c.service.create('subject')).split(';')[0];
    vi.spyOn(c.store, 'revoke').mockRejectedValueOnce(new Error('FIXTURE_REVOKE_FAILED'));
    const response = await endpoints.logout(new Request('https://fixture.invalid/api/auth/logout', {
      method: 'POST', headers: { cookie, origin: 'https://fixture.invalid' },
    }));
    expect(response.status).toBe(503);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await c.service.lookup(c.value(cookie), c.now())).toMatchObject({ kind: 'authenticated' });
  });
});
