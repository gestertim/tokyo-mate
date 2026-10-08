// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createRegistryBundle } from '../../api/_lib/cost-registry';
import { PROTECTED_ENDPOINTS } from '../../api/_lib/cost-price-table';
import { createAtomicQuotaEngine } from '../../api/_lib/quota-engine';
import { createSessionService, type SessionRecord } from '../../api/_lib/session';
import { createSelfServiceEndpoints } from '../../api/_lib/self-service-endpoints';
import { createTileProxyPipeline, type TileData, type TileProxyOptions } from '../../api/_lib/tile-proxy-pipeline';
import { FIXTURE_ALL_LIVE } from '../fixtures/cost-price-fixtures';
import { fixtureRegistryEntry } from '../fixtures/cost-registry-fixtures';
import { FIXTURE_FINGERPRINT_KEY } from '../fixtures/quota-fingerprint-fixtures';
import { InMemorySharedStoreMock } from '../support/in-memory-shared-store';
import { createLocalTileProxyPipeline } from '../../api/_lib/local-protection-adapters';

const now = () => new Date('2026-10-06T02:00:00.000Z');
const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const cached: TileData = { bytes, etag: `"${createHash('sha256').update(bytes).digest('hex')}"` };
async function setup(limit = 10000) {
  const ledger = new InMemorySharedStoreMock(now);
  ledger.publishRegistry(createRegistryBundle(1, FIXTURE_ALL_LIVE,
    PROTECTED_ENDPOINTS.map((e) => fixtureRegistryEntry(e, FIXTURE_ALL_LIVE))));
  ledger.seed({ identitySubject: 'user', status: 'approved', tier: 'tier1', expiresAt: null });
  const engine = createAtomicQuotaEngine({ store: ledger, now, leaseMs: 60000,
    costRegistry: { snapshot: () => ledger.registrySnapshot(), resolve: async () => null },
    fingerprintKey: FIXTURE_FINGERPRINT_KEY,
    tierLimits: { tier1: { dayLimitMicroUsd: limit, weekBaseLimitMicroUsd: 10000 },
      tier2: { dayLimitMicroUsd: limit, weekBaseLimitMicroUsd: 10000 } } });
  const records = new Map<string, SessionRecord>();
  const sessions = createSessionService({ signingKey: Buffer.alloc(32, 1), lifetimeMs: 60000,
    cookieName: 'FIXTURE_SESSION', storeTimeoutMs: 50, now, audit: vi.fn(),
    store: { create: async (record) => { records.set(record.sessionId, record); },
      get: async (id) => records.get(id) ?? null, revoke: async () => {} } });
  const cookie = (await sessions.create('user')).split(';')[0];
  const options: TileProxyOptions = {
    engine, sessions, now, origin: 'https://fixture.invalid', timeoutMs: 100, audit: vi.fn(),
    maxTileBytes: 1024, upstreamTimeoutMs: 100,
    upstream: { fetchTile: vi.fn(async () => bytes) },
    tiles: {
      consumeUserRequest: vi.fn<TileProxyOptions['tiles']['consumeUserRequest']>().mockResolvedValue('allowed'),
      lookupOrReserve: vi.fn<TileProxyOptions['tiles']['lookupOrReserve']>().mockResolvedValue({ kind: 'hit', data: cached }),
      wait: vi.fn(async () => cached), finish: vi.fn(async () => {}),
    },
  };
  const request = (etag?: string) => new Request('https://fixture.invalid/api/map/tile/1/0/0.png', {
    headers: { cookie, ...(etag ? { 'if-none-match': etag } : {}) },
  });
  return { options, request, ledger, engine };
}

describe('T134／L5 原子 map gate 及 tile ports（只有 memory mock，非 CDN／Redis 證據）', () => {
  it.each([1999, 2000, 2001])('D16嚴格flight剩餘預算，派送耗時%s ms（不放寬等值）', async (dispatchMs) => {
    const c = await setup();
    const at = now().getTime();
    c.options.now = () => new Date(at + dispatchMs);
    vi.mocked(c.options.tiles.lookupOrReserve).mockResolvedValue({ kind: 'leader', flightId: 'TEST_FLIGHT',
      reservedAtMs: at, leaseExpiresAtMs: at + 15000 });
    const response = await createLocalTileProxyPipeline(c.options)(c.request());
    expect(response.status).toBe(dispatchMs < 2000 ? 200 : 503);
    expect(c.options.upstream.fetchTile).toHaveBeenCalledTimes(dispatchMs < 2000 ? 1 : 0);
    if (dispatchMs >= 2000) expect(c.options.tiles.finish)
      .toHaveBeenCalledWith('TEST_FLIGHT', { kind: 'uncertain' }, 604800);
  });
  it('自身額度 DTO 只取 Session subject，不揭露 G／revision／reservation；query 不是 grant', async () => {
    const c = await setup();
    const response = await createSelfServiceEndpoints(c.options).quota(new Request(
      `${c.request().url}?identitySubject=other-person`, { headers: c.request().headers }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ success: true, data: {
      tier: 'tier1', currency: 'USD', timezone: 'Asia/Taipei',
      daily: { limitEstimatedUsd: '0.01', usedEstimatedUsd: '0.00', reservedEstimatedUsd: '0.00' },
    } });
    expect(JSON.stringify(payload)).not.toMatch(/registryRevision|bundleDigest|floorMicroUsd|reservationId|identitySubject/);
  });
  it('原子 snapshot 不預留／不扣 US$；cache hit／304 仍每次重驗並計數', async () => {
    const c = await setup();
    const reserve = vi.spyOn(c.ledger, 'reserve');
    const atomic = vi.spyOn(c.ledger, 'readAtomicQuota');
    const before = await c.engine.getSnapshot({ identitySubject: 'user' });
    const proxy = createTileProxyPipeline(c.options);
    expect((await proxy(c.request())).status).toBe(200);
    const response = await proxy(c.request(cached.etag));
    expect(response.status).toBe(304);
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
    expect(response.headers.get('vercel-cdn-cache-control')).toBe('no-store');
    expect(atomic).toHaveBeenCalledTimes(2);
    expect(c.options.tiles.consumeUserRequest).toHaveBeenCalledTimes(2);
    expect(reserve).not.toHaveBeenCalled();
    expect(await c.engine.getSnapshot({ identitySubject: 'user' })).toEqual(before);
    expect(c.options.upstream.fetchTile).not.toHaveBeenCalled();
  });
  it('撤銷後同一 conditional tile403，不能304／查快取／呼叫上游', async () => {
    const c = await setup(), proxy = createTileProxyPipeline(c.options);
    expect((await proxy(c.request())).status).toBe(200);
    await c.ledger.setEligibility({ identitySubject: 'user', status: 'revoked', tier: 'tier1',
      expiresAt: null, nowIso: now().toISOString() });
    expect((await proxy(c.request(cached.etag))).status).toBe(403);
    expect(c.options.tiles.lookupOrReserve).toHaveBeenCalledTimes(1);
    expect(c.options.upstream.fetchTile).not.toHaveBeenCalled();
  });
  it('remaining<G 的同次 map snapshot：429 all，cache／counter／上游零次', async () => {
    const c = await setup(8035);
    const response = await createTileProxyPipeline(c.options)(c.request());
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: { quotaScope: 'all', code: 'DAILY_QUOTA_EXHAUSTED' } });
    expect(c.options.tiles.lookupOrReserve).not.toHaveBeenCalled();
    expect(c.options.tiles.consumeUserRequest).not.toHaveBeenCalled();
    const query = await createSelfServiceEndpoints(c.options).mapEligibility(c.request());
    expect(await query.json()).toMatchObject({ data: { eligibleForInteractiveMap: false, reason: 'daily_quota' } });
  });
  it('cache miss coalescing：fixture shared port 只發一次上游及一次 leader credit 預留', async () => {
    const c = await setup();
    let leader = false, resolveFlight: (data: TileData) => void = () => {};
    const flight = new Promise<TileData>((resolve) => { resolveFlight = resolve; });
    vi.mocked(c.options.tiles.lookupOrReserve).mockImplementation(async () => {
      if (leader) return { kind: 'wait', flightId: 'FIXTURE_FLIGHT' };
      leader = true;
      return { kind: 'leader', flightId: 'FIXTURE_FLIGHT' };
    });
    vi.mocked(c.options.tiles.wait).mockImplementation(async () => flight);
    vi.mocked(c.options.tiles.finish).mockImplementation(async (_flightId, result) => {
      if (result.kind === 'success') resolveFlight(result.data);
    });
    const proxy = createTileProxyPipeline(c.options);
    const [one, two] = await Promise.all([proxy(c.request()), proxy(c.request())]);
    expect([one.status, two.status]).toEqual([200, 200]);
    expect(c.options.upstream.fetchTile).toHaveBeenCalledTimes(1);
    expect(c.options.tiles.finish).toHaveBeenCalledTimes(1);
    expect(c.options.tiles.consumeUserRequest).toHaveBeenCalledTimes(2);
  });
  it('credits 無法預留則503；未登入401；不接受任意上游URL', async () => {
    const c = await setup(), proxy = createTileProxyPipeline(c.options);
    vi.mocked(c.options.tiles.lookupOrReserve).mockResolvedValue({ kind: 'unavailable' });
    expect((await proxy(c.request())).status).toBe(503);
    expect((await proxy(new Request(c.request().url))).status).toBe(401);
    expect((await proxy(new Request(`${c.request().url}?host=attacker.invalid`))).status).toBe(400);
    expect(c.options.upstream.fetchTile).not.toHaveBeenCalled();
  });
  it('不確定上游失敗 finish uncertain，不自動重送／釋放 credits', async () => {
    const c = await setup();
    vi.mocked(c.options.tiles.lookupOrReserve).mockResolvedValue({ kind: 'leader', flightId: 'FIXTURE_FLIGHT' });
    vi.mocked(c.options.upstream.fetchTile).mockRejectedValue(new Error('FIXTURE_UNKNOWN_BILLING'));
    expect((await createTileProxyPipeline(c.options)(c.request())).status).toBe(503);
    expect(c.options.upstream.fetchTile).toHaveBeenCalledTimes(1);
    expect(c.options.tiles.finish).toHaveBeenCalledWith('FIXTURE_FLIGHT', { kind: 'uncertain' }, 604800);
  });
});
