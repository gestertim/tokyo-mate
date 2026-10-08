// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createAdminAllowlist, createAdminAuthOptions } from '../../api/_lib/admin-principal';
import { createHandler, type AdminOverviewOptions } from '../../api/admin/overview';
import { requireAdminMutation } from '../../api/_lib/admin-auth';
import { createSessionService, type SessionRecord } from '../../api/_lib/session';

function fixture(allowlist: unknown) {
  const records = new Map<string, SessionRecord>(), now = () => new Date('2026-10-06T02:00:00.000Z');
  const sessions = createSessionService({ signingKey: Buffer.alloc(32, 12), lifetimeMs: 60_000,
    storeTimeoutMs: 50, cookieName: 'M1_ALLOWLIST_FIXTURE', now, audit: vi.fn(),
    store: { create: async (r) => { records.set(r.sessionId, r); }, get: async (id) => records.get(id) ?? null, revoke: async () => {} } });
  const options: AdminOverviewOptions = {
    ...createAdminAuthOptions({ adminSubjects: allowlist, sessions, now, origin: 'https://fixture.invalid', timeoutMs: 50, audit: vi.fn() }),
    readOverview: vi.fn(async () => ({
      approvalCounts: { pending: 0, approved: 1, rejected: 0, revoked: 0, expired: 0 },
      estimatedUsage: { dailyUsedEstimatedUsd: '0.00', weeklyUsedEstimatedUsd: '0.00' }, protectionAvailable: true,
    })),
  };
  const request = async (subject: string, mutation = false) => new Request('https://fixture.invalid/api/admin/overview', {
    method: mutation ? 'POST' : 'GET', headers: { cookie: (await sessions.create(subject)).split(';')[0],
      role: 'admin', 'x-is-admin': 'true', 'x-admin-subject': 'trusted-admin',
      ...(mutation ? { origin: options.origin, 'content-type': 'application/json' } : {}) },
    ...(mutation ? { body: JSON.stringify({ role: 'admin', isAdmin: true, adminSubject: 'trusted-admin' }) } : {}),
  });
  return { options, request };
}
describe('M1 server options allowlist parser／逐請求管理來源', () => {
  it.each([['trusted-admin'], '["trusted-admin"]'].map((allowlist) => ({ allowlist })))('只接受可信 subject allowlist：%j', async ({ allowlist }) => {
    const f = fixture(allowlist);
    expect((await createHandler(f.options)(await f.request('trusted-admin'))).status).toBe(200);
    const response = await createHandler(f.options)(await f.request('normal-user'));
    expect(response.status).toBe(403); expect(await response.text()).not.toContain('approvalCounts');
    const rejected = await requireAdminMutation(await f.request('normal-user', true), f.options);
    expect(rejected).toBeInstanceOf(Response);
    if (rejected instanceof Response) expect(rejected.status).toBe(403);
    expect(f.options.readOverview).toHaveBeenCalledTimes(1);
  });
  it.each([undefined, null, '', 'trusted-admin', '{"role":"admin"}', '[]', [], [''], ['trusted-admin', 1],
    ['trusted-admin', 'trusted-admin'], [' trusted-admin'], ['trusted-admin\n'], ['x'.repeat(201)]].map((allowlist) => ({ allowlist })))(
    '缺失／空／格式錯誤 fail closed：%j，不回傳管理資料', async ({ allowlist }) => {
      const f = fixture(allowlist);
      const response = await createHandler(f.options)(await f.request('trusted-admin'));
      expect(response.status).toBe(503); expect(await response.text()).not.toContain('approvalCounts');
      const rejected = await requireAdminMutation(await f.request('trusted-admin', true), f.options);
      expect(rejected).toBeInstanceOf(Response);
      if (rejected instanceof Response) expect(rejected.status).toBe(503);
      expect(f.options.readOverview).not.toHaveBeenCalled();
    });
  it('未登入維持401；不接受偽造Header／role，不快取管理者於Session', async () => {
    const f = fixture(['trusted-admin']);
    expect((await createHandler(f.options)(new Request('https://fixture.invalid/api/admin/overview',
      { headers: { role: 'admin', 'x-is-admin': 'true' } }))).status).toBe(401);
    const check = vi.spyOn(f.options, 'isAdmin');
    const request = await f.request('trusted-admin');
    expect((await createHandler(f.options)(request)).status).toBe(200);
    f.options.isAdmin = createAdminAllowlist(['different-admin']).isAdmin;
    expect((await createHandler(f.options)(request)).status).toBe(403);
    expect(check).toHaveBeenCalledTimes(1);
    expect(f.options.readOverview).toHaveBeenCalledTimes(1);
  });
  it('allowlist不暴露可變Set，呼叫端陣列後續變更不自行擴權', async () => {
    const subjects = ['trusted-admin'];
    const principal = createAdminAllowlist(subjects);
    subjects.push('attacker');
    expect(await principal.isAdmin('trusted-admin')).toBe(true);
    expect(await principal.isAdmin('attacker')).toBe(false);
  });
});
