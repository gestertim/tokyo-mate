// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createRegistryBundle } from '../../api/_lib/cost-registry';
import { PROTECTED_ENDPOINTS } from '../../api/_lib/cost-price-table';
import { createAtomicQuotaEngine } from '../../api/_lib/quota-engine';
import { createRedisSharedStore } from '../../api/_lib/redis-shared-store';
import { createRedisSessionStore } from '../../api/_lib/redis-session-store';
import { createRedisTileStore } from '../../api/_lib/redis-tile-store';
import { createSessionService } from '../../api/_lib/session';
import { createTileProxyPipeline } from '../../api/_lib/tile-proxy-pipeline';
import { getQuotaWindows } from '../../api/_lib/quota-window';
import { FIXTURE_ALL_LIVE } from '../fixtures/cost-price-fixtures';
import { FIXTURE_FINGERPRINT_KEY } from '../fixtures/quota-fingerprint-fixtures';
import { fixtureRegistryEntry } from '../fixtures/cost-registry-fixtures';
import { luaAvailable, runLuaRedis, type LuaInvocation } from '../support/lua-redis-harness';

describe.skipIf(!luaAvailable)('Session／quota／tile完整Redis adapter管線（仍為Lua替身）', () => {
  it('並發miss只呼叫一次上游；cache/304重查Session與資格，撤銷後不查cache、不重送', async () => {
    const at = '2026-10-06T02:00:00.000Z';
    const now = () => new Date(at);
    const history: LuaInvocation[] = [];
    const transport = { eval: vi.fn(async (script: string, keys: readonly string[], json: string) => {
      history.push({ script, keys, command: JSON.parse(json), now: at });
      const result = runLuaRedis(history).at(-1);
      if (result && typeof result === 'object' && 'fixtureError' in result) throw new Error(String(result.fixtureError));
      return JSON.stringify(result);
    }) };
    const options = { namespace: '{FIXTURE_INTEGRATION}', transport, timeoutMs: 2000, audit: vi.fn() };
    const ledger = createRedisSharedStore(options);
    await ledger.publishRegistry(createRegistryBundle(1, FIXTURE_ALL_LIVE,
      PROTECTED_ENDPOINTS.map((endpoint) => fixtureRegistryEntry(endpoint, FIXTURE_ALL_LIVE))));
    const sessionStore = createRedisSessionStore(options);
    const sessions = createSessionService({ store: sessionStore, signingKey: Buffer.alloc(32, 1), lifetimeMs: 60_000,
      storeTimeoutMs: 2000, cookieName: 'FIXTURE_SESSION', now, audit: vi.fn() });
    const cookie = (await sessions.create('user')).split(';')[0];
    await ledger.setEligibility({ identitySubject: 'user', status: 'approved', tier: 'tier1', expiresAt: null, nowIso: at });
    const engine = createAtomicQuotaEngine({ store: ledger, costRegistry: ledger,
      fingerprintKey: FIXTURE_FINGERPRINT_KEY, now, storeTimeoutMs: 2000, leaseMs: 60_000,
      tierLimits: { tier1: { dayLimitMicroUsd: 3_000_000, weekBaseLimitMicroUsd: 15_000_000 },
        tier2: { dayLimitMicroUsd: 10_000_000, weekBaseLimitMicroUsd: 50_000_000 } } });
    const tiles = createRedisTileStore({ ...options, flightLeaseMs: 60_000,
      waitTimeoutMs: 2000, pollIntervalMs: 1, maxTileBytes: 1024 });
    const counted = vi.spyOn(tiles, 'consumeUserRequest');
    const lookup = vi.spyOn(tiles, 'lookupOrReserve');
    const sessionLookup = vi.spyOn(sessionStore, 'get');
    const reserved = vi.spyOn(ledger, 'reserve');
    const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    const fetchTile = vi.fn(async () => bytes);
    const proxy = createTileProxyPipeline({ sessions, engine, tiles, origin: 'https://fixture.invalid',
      timeoutMs: 2000, now, audit: vi.fn(), maxTileBytes: 1024, upstreamTimeoutMs: 2000,
      upstream: { fetchTile } });
    const request = (etag?: string) => new Request('https://fixture.invalid/api/map/tile/1/0/0.png',
      { headers: { cookie, ...(etag ? { 'if-none-match': etag } : {}) } });
    const [one, two] = await Promise.all([proxy(request()), proxy(request())]);
    expect([one.status, two.status]).toEqual([200, 200]);
    expect(fetchTile).toHaveBeenCalledTimes(1);
    expect(await one.arrayBuffer()).toEqual(bytes.buffer);
    const conditional = await proxy(request(one.headers.get('etag') ?? undefined));
    expect(conditional.status).toBe(304);
    expect(conditional.headers.get('cache-control')).toBe('private, no-cache');
    expect(conditional.headers.get('cdn-cache-control')).toBe('no-store');
    expect(conditional.headers.get('vercel-cdn-cache-control')).toBe('no-store');
    expect(counted).toHaveBeenCalledTimes(3);
    expect(sessionLookup).toHaveBeenCalledTimes(3);
    expect(reserved).not.toHaveBeenCalled();
    const windows = getQuotaWindows(now());
    expect(await ledger.readUsage('user', windows.day.windowKey, windows.week.windowKey))
      .toEqual({ day: { usedMicroUsd: 0, reservedMicroUsd: 0 }, week: { usedMicroUsd: 0, reservedMicroUsd: 0 } });
    await ledger.setEligibility({ identitySubject: 'user', status: 'revoked', tier: 'tier1', expiresAt: null, nowIso: at });
    expect((await proxy(request(one.headers.get('etag') ?? undefined))).status).toBe(403);
    expect(counted).toHaveBeenCalledTimes(3);
    expect(lookup).toHaveBeenCalledTimes(3);
    await sessions.logout(cookie.split('=')[1]);
    expect((await proxy(request())).status).toBe(401);
    expect(sessionLookup).toHaveBeenCalledTimes(5);
    expect(fetchTile).toHaveBeenCalledTimes(1);
  });
});
