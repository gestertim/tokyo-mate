// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createSessionService, type SessionRecord } from '../../api/_lib/session';
import { createAdminHandler, type AdminEndpointOptions } from '../../api/_lib/admin-endpoints';
import type { AdminStore } from '../../api/_lib/admin-store';

const now = () => new Date('2026-10-06T02:00:00Z');
const window = { limitEstimatedUsd: '3.00', usedEstimatedUsd: '1.00', reservedEstimatedUsd: '0.50',
  remainingEstimatedUsd: '1.50', resetAt: '2026-10-06T16:00:00Z' };
function fixture() {
  const records = new Map<string, SessionRecord>();
  const sessions = createSessionService({ signingKey: Buffer.alloc(32, 7), lifetimeMs: 60_000,
    storeTimeoutMs: 50, cookieName: 'ADMIN_FIXTURE', now, audit: vi.fn(),
    store: { create: async (r) => { records.set(r.sessionId, r); }, get: async (id) => records.get(id) ?? null, revoke: async () => {} } });
  const store: AdminStore = { users: vi.fn<AdminStore['users']>(async () => ({ items: [{ identitySubject: 'user', status: 'pending',
    tier: null, secret: '不要回傳' }], nextOffset: null })),
  detail: vi.fn<AdminStore['detail']>(async () => ({ identitySubject: 'user', status: 'approved', tier: 'tier1', daily: window,
    weekly: { ...window, windowKey: '2026-W41', activeTopUpEstimatedUsd: '0.00' },
    endpointUsage: [{ endpoint: 'places', requestCount: 1, estimatedUsd: '0.05' }], topUps: [], secret: '不要回傳' })),
  reviews: vi.fn<AdminStore['reviews']>(async () => ({ items: [{ reviewId: 'review1', targetIdentitySubject: 'user',
    kind: 'paid_access', createdAt: now().toISOString(), status: 'pending' }], nextOffset: null })),
  audits: vi.fn<AdminStore['audits']>(async () => ({ items: [], nextOffset: null })),
  mutate: vi.fn<AdminStore['mutate']>(async () => ({ outcome: 'applied', auditId: 'audit1' })) };
  const options: AdminEndpointOptions = { sessions, origin: 'https://fixture.invalid', now, timeoutMs: 50,
    audit: vi.fn(), isAdmin: vi.fn(async (s) => s === 'admin'), store };
  const request = async (path: string, subject = 'admin', body?: unknown, headers: Record<string, string> = {}) =>
    new Request(`https://fixture.invalid/api/admin/${path}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { cookie: (await sessions.create(subject)).split(';')[0], ...(body !== undefined ?
        { origin: options.origin, 'content-type': 'application/json' } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { options, store, request };
}
const topup = { idempotencyKey: 'key1', targetIdentitySubject: 'user', confirmed: true, reasonCode: 'weekly_limit_review',
  weekWindowKey: '2026-W41', amountEstimatedUsd: '15.000001', scope: 'all_protected_endpoints' };
describe('管理 HTTP 本機邊界', () => {
  it.each(['users', 'detail', 'reviews', 'audits', 'approvals', 'topups'] as const)('%s 每次查管理權限，拒絕不洩漏', async (operation) => {
    const f = fixture(), path = operation === 'detail' ? 'users/user' : operation;
    const handler = createAdminHandler(operation, f.options);
    const mutation = operation === 'approvals' || operation === 'topups';
    const body = mutation ? topup : undefined;
    const anonymous = new Request(`https://fixture.invalid/api/admin/${path}`, {
      method: mutation ? 'POST' : 'GET', ...(mutation ? { body: '{}', headers: { 'content-type': 'application/json', origin: f.options.origin } } : {}) });
    expect((await handler(anonymous)).status).toBe(401);
    for (const subject of ['user', 'tier1-user', 'tier2-user', 'revoked-user']) {
      const response = await handler(await f.request(path, subject, body, { role: 'admin' }));
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain('identitySubject');
    }
    Object.values(f.store).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });
  it('users/detail/review/audit 白名單投影、有界分頁與壞資料fail closed', async () => {
    const f = fixture();
    for (const [operation, path] of [['users', 'users'], ['detail', 'users/user'], ['reviews', 'review-queue'], ['audits', 'audit']] as const) {
      const response = await createAdminHandler(operation, f.options)(await f.request(path));
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.text()).not.toContain('secret');
    }
    expect((await createAdminHandler('users', f.options)(await f.request('users?limit=101'))).status).toBe(400);
    expect((await createAdminHandler('users', f.options)(await f.request('users?limit=2&limit=3'))).status).toBe(400);
    vi.mocked(f.store.users).mockResolvedValueOnce({ items: [{ identitySubject: 'x', status: 'approved', tier: 'WRONG' as never }], nextOffset: null });
    expect((await createAdminHandler('users', f.options)(await f.request('users'))).status).toBe(503);
  });
  it('CSRF、未知欄位、本文大小與確認拒絕時不異動', async () => {
    const f = fixture(), handler = createAdminHandler('topups', f.options);
    const csrfHeaders: Record<string, string>[] = [{ origin: 'https://evil.invalid' }, { 'sec-fetch-site': 'cross-site' }];
    for (const headers of csrfHeaders) {
      expect((await handler(await f.request('top-ups', 'admin', topup, headers))).status).toBe(400);
    }
    for (const body of [{ ...topup, confirmed: false }, { ...topup, role: 'admin' },
      { ...topup, reasonCode: 'x'.repeat(5000) }, { ...topup, amountEstimatedUsd: '0' },
      { ...topup, amountEstimatedUsd: '0.0000001' }, { ...topup, weekWindowKey: '2026-W42' },
      { ...topup, expiresAt: '2026-10-19T00:00:00+08:00' }]) {
      expect((await handler(await f.request('top-ups', 'admin', body))).status).toBe(400);
    }
    expect(f.store.mutate).not.toHaveBeenCalled();
  });
  it('server推導到期、金額精度、可信subject；fault不重試', async () => {
    const f = fixture(), handler = createAdminHandler('topups', f.options);
    expect((await handler(await f.request('top-ups', 'admin', topup))).status).toBe(200);
    expect(f.store.mutate).toHaveBeenCalledWith(expect.objectContaining({ amountMicroUsd: 15_000_001,
      expiresAt: '2026-10-11T16:00:00.000Z', adminSubject: 'admin' }));
    vi.mocked(f.store.mutate).mockRejectedValueOnce(new Error('unknown'));
    expect((await handler(await f.request('top-ups', 'admin', topup))).status).toBe(503);
    expect(f.store.mutate).toHaveBeenCalledTimes(2);
    expect((await createAdminHandler('topups')(await f.request('top-ups', 'admin', topup))).status).toBe(503);
  });
  it('audit嵌套before/after與追加回覆只投影允許欄位', async () => {
    const f = fixture();
    vi.mocked(f.store.audits).mockResolvedValueOnce({ items: [{ auditId: 'audit1', idempotencyKey: 'key1',
      adminSubject: 'admin', targetIdentitySubject: 'user', action: 'top_up', createdAt: now().toISOString(),
      reasonCode: 'weekly_limit_review', before: { cumulativeWeeklyTopUpMicroUsd: 0, secret: 'hidden' } as never,
      after: { status: 'active', cumulativeWeeklyTopUpMicroUsd: 1, fullConversation: 'hidden' } as never,
      amountEstimatedUsd: '0.000001', weekWindowKey: '2026-W41', expiresAt: '2026-10-11T16:00:00Z',
      scope: 'all_protected_endpoints', topUpId: 'grant1' }], nextOffset: null });
    const response = await createAdminHandler('audits', f.options)(await f.request('audit'));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('0.000001'); expect(text).toContain('grant1');
    expect(text).not.toContain('hidden'); expect(text).not.toContain('fullConversation'); expect(text).not.toContain('secret');
  });
});
