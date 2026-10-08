// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createIsolatedComposition, type IsolatedCompositionPorts } from '../../api/_lib/isolated-composition';
import { isolatedEnvironmentFixture } from '../fixtures/isolated-environment-fixture';
import type { SessionRecord } from '../../api/_lib/session';
import { createSessionEndpoints } from '../../api/_lib/session-endpoints';
import { createHmac } from 'node:crypto';
import { SharedStoreUnavailableError } from '../../api/_lib/shared-store';
import { createEpochLuaTransport } from '../support/epoch-lua-transport';
import { createRedisClockLua } from '../../api/_lib/redis-quota-script';
import { REQUEST_EPOCH_KEYS } from '../../api/_lib/redis-request-epoch-store';
import { createRegistryBundle } from '../../api/_lib/cost-registry';
import { PROTECTED_ENDPOINTS } from '../../api/_lib/cost-price-table';
import { FIXTURE_ALL_LIVE, FIXTURE_NONE_LIVE } from '../fixtures/cost-price-fixtures';
import { fixtureRegistryEntry } from '../fixtures/cost-registry-fixtures';
import { runIsolatedBatches } from '../../scripts/005-isolated-runner.mjs';

function fixture() {
  const config = isolatedEnvironmentFixture();
  const records = new Map<string, SessionRecord>();
  const restFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const args = JSON.parse(String(init?.body));
    const count = args[2];
    const command = JSON.parse(args[3 + count]);
    let result: unknown;
    if (command.operation === 'create') { records.set(command.sessionId, command.record); result = { status: 'created' }; }
    else if (command.operation === 'get') result = records.get(command.sessionId) ?? null;
    else if (command.operation === 'revoke') {
      const record = records.get(command.sessionId);
      if (record) record.revokedAt = command.nowIso;
      result = { status: 'revoked' };
    } else throw new Error('TEST_ONLY_UNEXPECTED_COMMAND');
    return Response.json({ result: JSON.stringify(result) });
  });
  const ports: IsolatedCompositionPorts = { scope: 'TEST_ONLY', restFetch, oidcFetch: vi.fn(async () => {
    throw new Error('TEST_ONLY_OIDC_BLOCKED');
  }), now: () => new Date('2026-10-07T01:00:00Z'), ingress: () => ({ admissionKey: 'TEST_ONLY_INGRESS' }),
    tierLimits: { tier1: { dayLimitMicroUsd: 3000000, weekBaseLimitMicroUsd: 15000000 },
      tier2: { dayLimitMicroUsd: 10000000, weekBaseLimitMicroUsd: 50000000 } }, audit: vi.fn(),
    lifecycleEvidence: vi.fn(async () => ({ accounting: false, key: false, keyReferences: {} })) };
  return { config, ports, records, restFetch, composition: createIsolatedComposition(config, ports) };
}

describe('D14 TEST_ONLY composition，網路全替身且不改production exports', () => {
  it('opaque Session每次查shared store，無Session簽章key，24h且logout不續期', async () => {
    const f = fixture(), c = f.composition;
    const cookie = await c.sessions.create('TEST_ONLY_OWNER');
    const id = cookie.split(';')[0].split('=')[1];
    expect(id).toMatch(/^[a-f0-9]{64}$/);
    expect(cookie).not.toContain('TEST_ONLY_OWNER');
    expect(await c.sessions.lookup(id, f.ports.now())).toMatchObject({ kind: 'authenticated' });
    expect(await c.sessions.lookup(id, f.ports.now())).toMatchObject({ kind: 'authenticated' });
    expect(f.restFetch).toHaveBeenCalledTimes(3);
    expect(await c.sessions.logout(id)).toContain('Max-Age=0');
    expect(await c.sessions.lookup(id, f.ports.now())).toEqual({ kind: 'unauthenticated' });
    expect(c.inventory()).toEqual(f.config.runner.inventory.slice(0, 3).sort());
  });
  it('store拒絕無memory fallback，不能由壞Session取得資格', async () => {
    const f = fixture();
    f.restFetch.mockRejectedValue(new Error('SECRET_PROVIDER_REPLY'));
    await expect(f.composition.sessions.create('TEST_ONLY_OWNER')).rejects.toThrow(SharedStoreUnavailableError);
    expect(await f.composition.sessions.lookup('a'.repeat(64), f.ports.now())).toEqual({ kind: 'unavailable' });
    expect(f.ports.audit).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(f.ports.audit).mock.calls)).not.toContain('SECRET_PROVIDER_REPLY');
  });
  it('M1不讀frontend role，paid ports全部mock且speech受阻', async () => {
    const f = fixture();
    expect(await f.composition.admin.isAdmin('TEST_ONLY_ADMIN')).toBe(true);
    expect(await f.composition.admin.isAdmin('TEST_ONLY_OWNER')).toBe(false);
    for (const endpoint of ['assistant', 'photo-ocr', 'photo-translate', 'places', 'transcribe'] as const)
      expect(await f.composition.paid[endpoint].execute()).toEqual({ kind: 'mock', scope: 'TEST_ONLY' });
    expect(await f.composition.paid.speech.execute()).toEqual({ kind: 'blocked' });
    expect(f.restFetch).not.toHaveBeenCalled();
    expect(f.ports.oidcFetch).not.toHaveBeenCalled();
    expect(f.composition.lifecycle.execute).toBeTypeOf('function');
  });
  it('missing可信transport拒絕；inventory漏動態rate key不派送', async () => {
    const f = fixture();
    const invalidPorts = { ...f.ports };
    Reflect.deleteProperty(invalidPorts, 'restFetch');
    expect(() => createIsolatedComposition(f.config, invalidPorts))
      .toThrow('TEST_ONLY_COMPOSITION_PORTS_REQUIRED');
    const missingEvidence = { ...f.ports }; Reflect.deleteProperty(missingEvidence, 'lifecycleEvidence');
    expect(() => createIsolatedComposition(f.config, missingEvidence)).toThrow('TEST_ONLY_COMPOSITION_PORTS_REQUIRED');
    expect(await f.composition.stores.rate('admission').consume('TEST_ONLY_INGRESS')).toEqual({ kind: 'unavailable' });
    expect(f.restFetch).not.toHaveBeenCalled();
  });
  it('inventory明列rate key後same-tag REST傳輸，缺floor不composition', async () => {
    const f = fixture(), namespace = f.config.namespace;
    const digest = createHmac('sha256', f.config.keyrings.rate.entries[0].key)
      .update('tokyo-mate/rate/admission:TEST_ONLY_INGRESS').digest('hex');
    f.config.runner.inventory.push(`${namespace}:rate:admission:${digest}`);
    const restFetch = vi.fn(async (_url, init) => {
      const data = JSON.parse(String(init?.body));
      expect(data.slice(3, 3 + data[2])).toEqual([`${namespace}:rate:admission:${digest}`]);
      return Response.json({ result: '{"kind":"allowed"}' });
    });
    const c = createIsolatedComposition(f.config, { ...f.ports, restFetch });
    expect(await c.stores.rate('admission').consume('TEST_ONLY_INGRESS')).toEqual({ kind: 'allowed' });
    const invalid: Record<string, unknown> = { ...f.config }; delete invalid.epochFloor;
    expect(() => createIsolatedComposition(invalid, f.ports)).toThrow('TEST_ONLY_ENVIRONMENT_INVALID');
  });
  it('OIDC實際library只走注入port，default factory仍fail closed', async () => {
    const f = fixture();
    const request = new Request('https://fixture.invalid/api/auth/login');
    expect((await f.composition.auth.login(request)).status).toBe(503);
    expect(f.ports.oidcFetch).toHaveBeenCalledTimes(1);
    expect((await createSessionEndpoints().session(new Request('https://fixture.invalid/api/auth/session'))).status).toBe(503);
  });
  it('exact inventory清理只送逐key DEL，不允許FLUSHALL／額外key／子集合', async () => {
    const f = fixture();
    const restFetch: typeof fetch = vi.fn(async (_url, init) => {
      const command = JSON.parse(String(init?.body));
      expect(command[0]).toBe('EVAL');
      expect(command[1]).toBe("return redis.call('DEL', KEYS[1])");
      expect(command[2]).toBe(1);
      expect(f.config.runner.inventory).toContain(command[3]);
      return Response.json({ result: 1 });
    });
    const c = createIsolatedComposition(f.config, { ...f.ports, restFetch });
    await expect(c.cleanupInventory(['{preview-other}:users'], new AbortController().signal)).rejects.toThrow();
    await expect(c.cleanupInventory(f.config.runner.inventory.slice(1), new AbortController().signal)).rejects.toThrow();
    expect(restFetch).not.toHaveBeenCalled();
    expect(await c.cleanupInventory(f.config.runner.inventory, new AbortController().signal)).toBe('cleaned');
    expect(restFetch).toHaveBeenCalledTimes(f.config.runner.inventory.length);
  });
  it('雙process／獨立composition clients沿REST與Lua替身首次grant一次，非真實Redis證據', async () => {
    const f = fixture(), now = f.ports.now;
    const fake = createEpochLuaTransport(now);
    const restFetch: typeof fetch = async (_url, init) => {
      const args = JSON.parse(String(init?.body));
      const result = await fake.transport.eval(args[1], args.slice(3, 3 + args[2]), args.at(-1));
      return Response.json({ result: args[1] === "return redis.call('DEL', KEYS[1])" ? Number(result) : result });
    };
    const config = f.config, subject = 'TEST_ONLY_OWNER';
    for (const [bucket, identity] of [['admission', 'TEST_ONLY_INGRESS'], ['request_epoch', subject]]) {
      const digest = createHmac('sha256', config.keyrings.rate.entries[0].key)
        .update(`tokyo-mate/rate/${bucket}:${identity}`).digest('hex');
      config.runner.inventory.push(`${config.namespace}:rate:${bucket}:${digest}`);
    }
    config.runner.operationTimeoutMs = 2000; config.runner.confirmationReserveMs = 4000;
    config.runner.cleanupReserveMs = 5000; config.runner.windowMs = 30000;
    config.runner.maxBatches = 1;
    const table = structuredClone(FIXTURE_NONE_LIVE);
    table.endpoints.places = structuredClone(FIXTURE_ALL_LIVE.endpoints.places);
    config.registry.bundle = createRegistryBundle(1, table, PROTECTED_ENDPOINTS.map((endpoint) => fixtureRegistryEntry(endpoint, table)));
    const clients = [createIsolatedComposition(config, { ...f.ports, restFetch }),
      createIsolatedComposition(config, { ...f.ports, restFetch })];
    // Only the substitute is seeded. This is not a restore barrier or external initialization.
    await fake.transport.eval(createRedisClockLua(['hash', 'hash', 'hash', 'hash', 'hash', 'zset', 'hash']) + String.raw`
local c=cjson.decode(ARGV[1])
redis.call('HSET',KEYS[4],'snapshot',encode(c.authority),'fingerprintCurrent','fp1','fingerprint:fp1','current',
  'capability:'..c.kid,'current')
return '{"status":"seeded"}'
`, REQUEST_EPOCH_KEYS(config.namespace), JSON.stringify({ authority: config.authority, kid: config.keyrings.capability.current }));
    await clients[0].shared.publishRegistry(config.registry.bundle);
    await clients[0].shared.setEligibility({ identitySubject: subject, status: 'approved', tier: 'tier1',
      expiresAt: null, nowIso: now().toISOString() });
    const cookie = await clients[0].sessions.create(subject);
    const response = await clients[0].issuance.issue(new Request(`${config.oidc.config.origin}/api/me/request-capability`, {
      method: 'POST', headers: { cookie, origin: config.oidc.config.origin, 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: 'places', issuanceCommandId: `${config.authority.currentEpochId}.123e4567-e89b-42d3-a456-426614174000` }),
    }));
    expect(response.status).toBe(201);
    const body = await response.json();
    const capability = body.data.capability, handle = body.data.operationHandle;
    const grants: boolean[] = [];
    const report = await runIsolatedBatches(config.runner, {
      async execute(client) {
        const c = clients[client.slot];
        const checked = await c.verifier.verify(subject, 'places', handle, capability);
        if (!checked.ok) throw new Error('TEST_ONLY_VERIFIER_REJECTED');
        const result = await c.engine.reserve({ identitySubject: subject, endpoint: 'places',
          idempotencyKey: handle, content: { query: 'TEST_ONLY_QUERY' } }, {}, checked.execution);
        grants.push(result.ok);
        return 'completed';
      },
      confirm: async () => 'unknown',
      usage: async () => 0,
      cleanup: (keys, signal) => clients[0].cleanupInventory(keys, signal),
    });
    expect(report).toMatchObject({ status: 'completed', dispatched: 2 });
    expect(grants.sort()).toEqual([false, true]);
    expect(clients[0]).not.toBe(clients[1]);
    expect(fake.history.every((call) => call.keys.every((key) => key.startsWith(`${config.namespace}:`)))).toBe(true);
  });
});
