// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createHandler, type AdminOverviewOptions } from '../../api/admin/overview';
import { createSessionService, type SessionRecord } from '../../api/_lib/session';
import { requireAdminMutation } from '../../api/_lib/admin-auth';

function setup(subject = 'user') {
  const records = new Map<string, SessionRecord>();
  const now = () => new Date('2026-10-06T02:00:00.000Z');
  const sessions = createSessionService({ signingKey: Buffer.alloc(32, 1), lifetimeMs: 60_000,
    storeTimeoutMs: 50, cookieName: 'FIXTURE_SESSION', now, audit: vi.fn(),
    store: { create: async (record) => { records.set(record.sessionId, record); },
      get: async (id) => records.get(id) ?? null, revoke: async () => {} } });
  const options: AdminOverviewOptions = {
    sessions, now, origin: 'https://fixture.invalid', timeoutMs: 50, audit: vi.fn(),
    isAdmin: vi.fn(async (candidate) => candidate === 'trusted-admin'),
    readOverview: vi.fn(async () => ({
      approvalCounts: { pending: 1, approved: 2, rejected: 0, revoked: 0, expired: 0 },
      estimatedUsage: { dailyUsedEstimatedUsd: '0.45', weeklyUsedEstimatedUsd: '2.30' }, protectionAvailable: true,
      secret: '不應外洩',
    })),
  };
  return { options, sessions, subject };
}

describe('L4 管理者權限與最小化讀取（mock M1，不設定真實 subject）', () => {
  it.each(['user', 'tier1-user', 'tier2-user'])('%s 即使自報 role=admin 仍403，資料 reader 零次', async (subject) => {
    const c = setup(subject);
    const cookie = (await c.sessions.create(subject)).split(';')[0];
    const response = await createHandler(c.options)(new Request('https://fixture.invalid/api/admin/overview?role=admin',
      { headers: { cookie, role: 'admin' } }));
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('approvalCounts');
    expect(c.options.readOverview).not.toHaveBeenCalled();
  });
  it('未登入401；可信管理者讀取只回白名單 DTO', async () => {
    const c = setup('trusted-admin'), handler = createHandler(c.options);
    expect((await handler(new Request('https://fixture.invalid/api/admin/overview'))).status).toBe(401);
    const cookie = (await c.sessions.create('trusted-admin')).split(';')[0];
    const response = await handler(new Request('https://fixture.invalid/api/admin/overview', { headers: { cookie } }));
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain('secret');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('管理者來源每次查驗；故障503；異動 Origin 不符拒絕', async () => {
    const c = setup('trusted-admin');
    const cookie = (await c.sessions.create('trusted-admin')).split(';')[0];
    const request = () => new Request('https://fixture.invalid/api/admin/overview', { headers: { cookie } });
    await createHandler(c.options)(request());
    vi.mocked(c.options.isAdmin).mockResolvedValueOnce(false);
    expect((await createHandler(c.options)(request())).status).toBe(403);
    vi.mocked(c.options.isAdmin).mockRejectedValueOnce(new Error('FIXTURE_FAILURE'));
    expect((await createHandler(c.options)(request())).status).toBe(503);
    const rejected = await requireAdminMutation(new Request('https://fixture.invalid/api/admin/approvals', {
      method: 'POST', headers: { cookie, origin: 'https://attacker.invalid', 'content-type': 'application/json' }, body: '{}',
    }), c.options);
    expect(rejected).toBeInstanceOf(Response);
    if (rejected instanceof Response) expect(rejected.status).toBe(400);
  });
  it('總覽接近上限提示也白名單輸出，未知查詢拒絕', async () => {
    const c = setup('trusted-admin');
    vi.mocked(c.options.readOverview).mockResolvedValueOnce({
      approvalCounts: { pending: 0, approved: 1, rejected: 0, revoked: 0, expired: 0 },
      estimatedUsage: { dailyUsedEstimatedUsd: '2.40', weeklyUsedEstimatedUsd: '2.40' }, protectionAvailable: true,
      nearLimits: [{ identitySubject: 'user1', window: 'day', usedEstimatedUsd: '2.40', limitEstimatedUsd: '3.00',
        secret: 'hidden' } as never],
    });
    const cookie = (await c.sessions.create('trusted-admin')).split(';')[0];
    const response = await createHandler(c.options)(new Request('https://fixture.invalid/api/admin/overview', { headers: { cookie } }));
    expect(response.status).toBe(200);
    const text = await response.text(); expect(text).toContain('nearLimits'); expect(text).not.toContain('hidden');
    expect((await createHandler(c.options)(new Request('https://fixture.invalid/api/admin/overview?export=all',
      { headers: { cookie } }))).status).toBe(400);
  });
});
