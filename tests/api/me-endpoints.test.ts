// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createSessionService, type SessionRecord } from '../../api/_lib/session';
import { boundedOwnPage, createMeEndpoints, type MeEndpointOptions } from '../../api/_lib/me-endpoints';
import type { MeStore } from '../../api/_lib/me-store';
import { operationMessages, type OwnRequest } from '../../src/types/self-service';
import { POST as unconfiguredOperation } from '../../api/me/operation-status';
import { GET as unconfiguredRequests } from '../../api/me/requests';

const now = () => new Date('2026-10-07T02:00:00.000Z');
const review: OwnRequest = { reviewId: 'review1', kind: 'paid_access', reasonCode: 'paid_feature_access',
  createdAt: now().toISOString(), status: 'pending' };
function fixture() {
  const records = new Map<string, SessionRecord>();
  const sessions = createSessionService({ signingKey: Buffer.alloc(32, 9), lifetimeMs: 60000,
    storeTimeoutMs: 50, now, audit: vi.fn(), cookieName: 'ME_FIXTURE',
    store: { create: async (r) => { records.set(r.sessionId, r); }, get: async (id) => records.get(id) ?? null, revoke: async () => {} } });
  const store: MeStore = {
    access: vi.fn(async () => ({ approved: true, weekWindowKey: '2026-W41' })),
    operation: vi.fn<MeStore['operation']>(async () => ({ outcome: 'found', state: 'settled', updatedAt: now().toISOString() })),
    epochOperation: vi.fn<NonNullable<MeStore['epochOperation']>>(async () => ({ outcome: 'found', state: 'uncertain', updatedAt: now().toISOString() })),
    enqueue: vi.fn<MeStore['enqueue']>(async () => ({ outcome: 'created', review })),
    list: vi.fn<MeStore['list']>(async () => ({ items: [review], nextOffset: null })),
    withdraw: vi.fn<MeStore['withdraw']>(async () => ({ outcome: 'withdrawn', review: { ...review, status: 'withdrawn' } })),
  };
  const rates = { operation: { consume: vi.fn(async () => ({ kind: 'allowed' as const })) },
    read: { consume: vi.fn(async () => ({ kind: 'allowed' as const })) },
    mutation: { consume: vi.fn(async () => ({ kind: 'allowed' as const })) } };
  const options: MeEndpointOptions = { sessions, store, rates, origin: 'https://fixture.invalid', now,
    timeoutMs: 50, audit: vi.fn() };
  const request = async (path: string, body?: unknown, subject: string | null = 'owner', headers = {}) =>
    new Request(`${options.origin}/api/me/${path}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { ...(subject ? { cookie: (await sessions.create(subject)).split(';')[0] } : {}),
        ...(body === undefined ? {} : { origin: options.origin, 'content-type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { options, store, rates, request, handlers: createMeEndpoints(options) };
}
describe('D10／D11 HTTP本機契約', () => {
  it('epoch lookup oneOf 不需有效 capability；混欄位拒絕、資格優先、同404且零異動', async () => {
    const f = fixture();
    const body = { endpoint: 'assistant', requestEpochId: `g7_${'k'.repeat(22)}`, operationHandle: 'h'.repeat(43) };
    expect((await f.handlers.operation(await f.request('operation-status', body))).status).toBe(200);
    expect(f.store.epochOperation).toHaveBeenCalledWith('owner', body.endpoint, body.requestEpochId, body.operationHandle);
    expect((await f.handlers.operation(await f.request('operation-status', { ...body, idempotencyKey: 'legacy' }))).status).toBe(400);
    vi.mocked(f.store.epochOperation!).mockResolvedValueOnce({ outcome: 'not_found' });
    expect((await f.handlers.operation(await f.request('operation-status', body))).status).toBe(404);
    vi.mocked(f.store.access).mockResolvedValueOnce({ approved: false, weekWindowKey: '2026-W41' });
    expect((await f.handlers.operation(await f.request('operation-status', body))).status).toBe(403);
    expect(f.store.epochOperation).toHaveBeenCalledTimes(2);
    expect(f.store.operation).not.toHaveBeenCalled();
    expect(f.store.enqueue).not.toHaveBeenCalled();
  });
  it('401所有面；D10資格403在lookup前，paid_access未核准仍可提出', async () => {
    const f = fixture();
    for (const [handler, path, body] of [
      [f.handlers.operation, 'operation-status', { endpoint: 'assistant', idempotencyKey: 'one' }],
      [f.handlers.requests, 'requests', { kind: 'paid_access', reasonCode: 'paid_feature_access', idempotencyKey: 'one' }],
      [f.handlers.requests, 'requests', undefined], [f.handlers.withdraw, 'requests/review1/withdraw', {}],
    ] as const) expect((await handler(await f.request(path, body, null))).status).toBe(401);
    vi.mocked(f.store.access).mockResolvedValue({ approved: false, weekWindowKey: '2026-W41' });
    expect((await f.handlers.operation(await f.request('operation-status', { endpoint: 'assistant', idempotencyKey: 'one' }))).status).toBe(403);
    expect(f.store.operation).not.toHaveBeenCalled(); expect(f.rates.operation.consume).not.toHaveBeenCalled();
    expect((await f.handlers.requests(await f.request('requests',
      { kind: 'paid_access', reasonCode: 'paid_feature_access', idempotencyKey: 'one' }))).status).toBe(201);
    expect(f.store.enqueue).toHaveBeenCalledWith('owner', expect.any(Object));
  });
  it('未知／他人同404；四狀態文案與只讀零reserve/grant/上游', async () => {
    const f = fixture(), body = { endpoint: 'assistant', idempotencyKey: 'one' };
    for (const state of ['reserved', 'settled', 'released', 'uncertain'] as const) {
      vi.mocked(f.store.operation).mockResolvedValueOnce({ outcome: 'found', state, updatedAt: now().toISOString() });
      const response = await f.handlers.operation(await f.request('operation-status', body));
      expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({ success: true, data: { state, updatedAt: now().toISOString(), userMessage: operationMessages[state] } });
    }
    vi.mocked(f.store.operation).mockResolvedValue({ outcome: 'not_found' });
    const a = await f.handlers.operation(await f.request('operation-status', body));
    const b = await f.handlers.operation(await f.request('operation-status', { ...body, idempotencyKey: 'other' }));
    expect(a.status).toBe(404); expect(await a.text()).toBe(await b.text());
    expect(f.store.enqueue).not.toHaveBeenCalled(); expect(f.store.withdraw).not.toHaveBeenCalled();
    expect(Object.keys(f.store)).not.toContain('reserve');
  });
  it('CSRF／額外欄位／reason／週格式／本文bytes拒絕，不異動', async () => {
    const f = fixture(), input = { kind: 'paid_access', reasonCode: 'paid_feature_access', idempotencyKey: 'one' };
    for (const headers of [{ origin: 'https://evil.invalid' }, { 'sec-fetch-site': 'cross-site' }]) {
      expect((await f.handlers.requests(await f.request('requests', input, 'owner', headers))).status).toBe(400);
    }
    for (const body of [{ ...input, tier: 'tier2' }, { ...input, requestedAmount: '100' },
      { ...input, identitySubject: 'other' }, { ...input, reasonCode: 'free_text' }, { ...input, weekWindowKey: '2026-W41' },
      { ...input, kind: 'weekly_top_up', reasonCode: 'weekly_floor_review', weekWindowKey: '2026-W41-AsiaTaipei' }]) {
      expect((await f.handlers.requests(await f.request('requests', body))).status).toBe(400);
    }
    expect((await f.handlers.requests(await f.request('requests', { ...input, text: '中'.repeat(700) }))).status).toBe(413);
    expect((await f.handlers.operation(await f.request('operation-status', {
      endpoint: 'assistant', idempotencyKey: 'one', text: '中'.repeat(400),
    }))).status).toBe(413);
    expect(f.store.enqueue).not.toHaveBeenCalled();
  });
  it('duplicate200、conflict409、撤回終態409、404、限流Retry-After及503不重試', async () => {
    const f = fixture(), input = { kind: 'paid_access', reasonCode: 'paid_feature_access', idempotencyKey: 'one' };
    for (const [outcome, status] of [['duplicate', 200], ['conflict', 409], ['not_approved', 403], ['invalid', 400]] as const) {
      vi.mocked(f.store.enqueue).mockResolvedValueOnce({ outcome, review });
      expect((await f.handlers.requests(await f.request('requests', input))).status).toBe(status);
    }
    for (const [outcome, status] of [['resolved', 409], ['not_found', 404]] as const) {
      vi.mocked(f.store.withdraw).mockResolvedValueOnce({ outcome });
      expect((await f.handlers.withdraw(await f.request('requests/review1/withdraw', {}))).status).toBe(status);
    }
    f.options.rates.mutation.consume = vi.fn(async () => ({ kind: 'limited' as const, retryAfterSeconds: 12 }));
    const limited = await f.handlers.requests(await f.request('requests', input));
    expect(limited.status).toBe(429); expect(limited.headers.get('retry-after')).toBe('12');
    f.options.rates.mutation.consume = vi.fn(async () => ({ kind: 'allowed' as const }));
    vi.mocked(f.store.enqueue).mockRejectedValueOnce(new Error('store fault'));
    expect((await f.handlers.requests(await f.request('requests', input))).status).toBe(503);
    expect(f.store.enqueue).toHaveBeenCalledTimes(5); expect(f.options.audit).toHaveBeenCalled();
    expect((await unconfiguredOperation(await f.request('operation-status', {}))).status).toBe(503);
    expect((await unconfiguredRequests(await f.request('requests'))).status).toBe(503);
  });
  it('分頁合法參數／owner／白名單；非法續頁fail-closed', async () => {
    const f = fixture();
    vi.mocked(f.store.list).mockResolvedValueOnce({ items: [{ ...review, secret: 'hidden' } as OwnRequest], nextOffset: 11 });
    const response = await f.handlers.requests(await f.request('requests?offset=10&limit=1'));
    expect(response.status).toBe(200); expect(await response.text()).not.toContain('hidden');
    expect(f.store.list).toHaveBeenCalledWith('owner', 10, 1);
    for (const query of ['limit=0', 'limit=101', 'offset=1000000', 'offset=-1', 'limit=1&limit=2', 'owner=other'])
      expect((await f.handlers.requests(await f.request(`requests?${query}`))).status).toBe(400);
    vi.mocked(f.store.list).mockResolvedValueOnce({ items: [review], nextOffset: 50 });
    expect((await f.handlers.requests(await f.request('requests'))).status).toBe(503);
  });
  it('資格於lookup前撤銷仍403；timeout／非法authority資料503且單次呼叫', async () => {
    const f = fixture(), input = { endpoint: 'assistant', idempotencyKey: 'one' };
    vi.mocked(f.store.operation).mockResolvedValueOnce({ outcome: 'not_approved' });
    expect((await f.handlers.operation(await f.request('operation-status', input))).status).toBe(403);
    vi.mocked(f.store.operation).mockImplementationOnce(() => new Promise(() => {}));
    expect((await f.handlers.operation(await f.request('operation-status', input))).status).toBe(503);
    expect(f.store.operation).toHaveBeenCalledTimes(2);
    expect(f.options.audit).toHaveBeenCalledWith({ operation: 'session_endpoint', outcome: 'unavailable' });
  });
});
describe('完整序列化 JSON 65536 bytes 精確邊界', () => {
  it.each([65535, 65536, 65537])('%i bytes不截斷，單筆超限fail-closed', (bytes) => {
    const base = boundedOwnPage({ items: [''], nextOffset: null }, 0);
    const page = { items: ['x'.repeat(bytes - Buffer.byteLength(base))], nextOffset: null };
    if (bytes > 65536) expect(() => boundedOwnPage(page, 0)).toThrow('ME_PAGE_TOO_LARGE');
    else {
      const json = boundedOwnPage(page, 0);
      expect(Buffer.byteLength(json)).toBe(bytes); expect(JSON.parse(json).data.items).toEqual(page.items);
    }
  });
  it('多byte與跳脫JSON，缩頁nextOffset按實際筆數，續頁全集不漏項', () => {
    const rows = Array.from({ length: 105 }, (_, id) => ({ id, text: '中"\\\n'.repeat(1000) }));
    const seen: typeof rows = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const end = Math.min(rows.length, offset + 25);
      const page: { items: typeof rows; nextOffset: number | null } = { items: rows.slice(offset, end), nextOffset: end < rows.length ? end : null };
      const body: string = boundedOwnPage(page, offset);
      expect(Buffer.byteLength(body)).toBeLessThanOrEqual(65536);
      const result: { items: typeof rows; nextOffset: number | null } = JSON.parse(body).data;
      if (result.nextOffset !== null) expect(result.nextOffset).toBe(offset + result.items.length);
      seen.push(...result.items); offset = result.nextOffset;
    }
    expect(seen).toEqual(rows);
    expect(() => boundedOwnPage({ items: ['x'], nextOffset: 1000000 }, 999999)).toThrow();
  });
});
