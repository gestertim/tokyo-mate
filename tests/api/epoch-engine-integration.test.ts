// @vitest-environment node
import { createSecretKey } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createQuotaEngine } from '../../api/_lib/quota-engine';
import { createRedisSharedStore } from '../../api/_lib/redis-shared-store';
import { createRedisRequestEpochStore, REQUEST_EPOCH_KEYS } from '../../api/_lib/redis-request-epoch-store';
import { createRedisClockLua } from '../../api/_lib/redis-quota-script';
import { createRequestEpochVerifier } from '../../api/_lib/request-epoch-execution';
import { deriveOwnerScope, deriveRequestEpochIndex, signCapability } from '../../api/_lib/request-epoch';
import { createRegistryBundle } from '../../api/_lib/cost-registry';
import { PROTECTED_ENDPOINTS } from '../../api/_lib/cost-price-table';
import { FIXTURE_ALL_LIVE } from '../fixtures/cost-price-fixtures';
import { fixtureRegistryEntry } from '../fixtures/cost-registry-fixtures';
import { createEpochLuaTransport } from '../support/epoch-lua-transport';
import { luaAvailable } from '../support/lua-redis-harness';
import { createProtectedEndpointPipeline } from '../../api/_lib/protected-endpoint-pipeline';
import { createRedisEpochLifecycleStore } from '../../api/_lib/redis-epoch-lifecycle-store';

describe.skipIf(!luaAvailable)('capability→authority→engine→同次Lua reserve 完整本機接線', () => {
  it('normal rotation 後首次 fp current；已grant按原 key／cost 比較，response unknown 不重新 grant', async () => {
    const at = new Date('2026-10-06T02:00:00.000Z'), now = () => at;
    const { transport } = createEpochLuaTransport(now);
    const namespace = '{FIXTURE_005}', kid = 'k'.repeat(22), epochId = `g7_${kid}`;
    const floor = { namespace, highestGeneration: 7, authorityRevision: 1, retiredThrough: 0,
      revokedKids: [], evidenceDigest: 'a'.repeat(64) };
    const base = { namespace, epochFloor: floor, transport, timeoutMs: 1000, audit: vi.fn() };
    const scopeKey = Buffer.alloc(32, 3), signingKey = Buffer.alloc(32, 4);
    const payload = { generation: 7, epochId, kid, scopeKeyVersion: 'fp1', ownerScope: deriveOwnerScope(scopeKey, 'fp1', 'owner'),
      endpoint: 'assistant' as const, operationHandle: 'h'.repeat(43), issuedAtMs: at.getTime(), expiresAtMs: at.getTime() + 86400000 };
    const authority = { highestGeneration: 7, authorityRevision: 1, retiredThrough: 0, revokedKids: [], currentEpochId: epochId,
      epochs: { [epochId]: { epochId, generation: 7, kid, scopeKeyVersion: 'fp1', state: 'current',
        issueStartsAtMs: at.getTime() - 1000, issueExpiresAtMs: at.getTime() + 86400000, validUntilMs: at.getTime() + 172800000 } } };
    const seed = createRedisClockLua(['hash', 'hash', 'hash', 'hash', 'hash', 'zset', 'hash']) + String.raw`
local c=cjson.decode(ARGV[1])
redis.call('HSET',KEYS[4],'snapshot',encode(c.authority),'fingerprintCurrent',c.current,'fingerprint:fp1','verify_only',
  'fingerprint:fp2',c.current=='fp2' and 'current' or 'verify_only','fingerprint:fp3',c.current=='fp3' and 'current' or 'loaded')
for _,e in pairs(c.authority.epochs) do redis.call('HSET',KEYS[4],'capability:'..e.kid,e.state=='current' and 'current' or 'verify_only') end
return '{"status":"seeded"}'
`;
    await transport.eval(seed, REQUEST_EPOCH_KEYS(namespace), JSON.stringify({ authority, current: 'fp2' }));
    const store = createRedisSharedStore(base), epochs = createRedisRequestEpochStore(base);
    const table = structuredClone(FIXTURE_ALL_LIVE);
    const publish = (revision: number) => store.publishRegistry(createRegistryBundle(revision, table,
      PROTECTED_ENDPOINTS.map((endpoint) => fixtureRegistryEntry(endpoint, table))));
    await publish(1);
    await store.setEligibility({ identitySubject: 'owner', status: 'approved', tier: 'tier1', expiresAt: null, nowIso: at.toISOString() });
    const commandId = `${epochId}.123e4567-e89b-42d3-a456-426614174000`;
    const commandIndex = deriveRequestEpochIndex(scopeKey, 'tm/issuance-index/v1', [payload.ownerScope, epochId, commandId]);
    const handleIndex = deriveRequestEpochIndex(scopeKey, 'tm/operation-index/v1', [payload.ownerScope, payload.endpoint, epochId, payload.operationHandle]);
    const capability = signCapability(payload, signingKey);
    expect(await epochs.issue({ ...payload, identitySubject: 'owner', commandId, commandIndex, handleIndex, capability,
      preparedAtMs: at.getTime() })).toMatchObject({ status: 'issued' });
    const rotated = { ...authority, epochs: { [epochId]: { ...authority.epochs[epochId], state: 'verify_only' } } };
    await transport.eval(seed, REQUEST_EPOCH_KEYS(namespace), JSON.stringify({ authority: rotated, current: 'fp2' }));
    const verifier = createRequestEpochVerifier({ store: epochs, signingKeys: [{ kid, key: signingKey, state: 'verify_only' }],
      scopeKeys: [{ version: 'fp1', key: scopeKey, state: 'verify_only' }] });
    const verified = await verifier.verify('owner', payload.endpoint, payload.operationHandle, capability);
    if (!verified.ok) throw new Error('TEST_ONLY capability rejected');
    const fp2 = { version: 'fp2', key: createSecretKey(Buffer.alloc(32, 2)), state: 'current' as const };
    const fp3 = { version: 'fp3', key: createSecretKey(Buffer.alloc(32, 5)), state: 'current' as const };
    let id = 0;
    const engine = (keys: (typeof fp2 | (Omit<typeof fp2, 'state'> & { state: 'verify_only' }))[]) =>
      createQuotaEngine({ store, costRegistry: store, fingerprintKeys: keys, now,
        newId: () => `reservation-${++id}`, leaseMs: 60000, storeTimeoutMs: 1000,
        tierLimits: { tier1: { dayLimitMicroUsd: 100000, weekBaseLimitMicroUsd: 500000 },
          tier2: { dayLimitMicroUsd: 200000, weekBaseLimitMicroUsd: 1000000 } } });
    const request = { identitySubject: 'owner', endpoint: payload.endpoint, idempotencyKey: payload.operationHandle, content: 'TEST_ONLY private input' };
    const originalEval = transport.eval.bind(transport);
    let loseFirstReserveResponse = true;
    vi.spyOn(transport, 'eval').mockImplementation(async (script, keys, args) => {
      const value = await originalEval(script, keys, args);
      if (JSON.parse(args).operation === 'reserve' && loseFirstReserveResponse) {
        loseFirstReserveResponse = false;
        throw new Error('TEST_ONLY committed reserve response lost');
      }
      return value;
    });
    const first = await engine([fp2]).reserve(request, { inputTokens: 0 }, verified.execution);
    expect(first).toMatchObject({ ok: false, status: 503 });
    expect(await store.getEpochBinding!('owner', verified.execution.accountingIndex)).toMatchObject({ fingerprintKeyVersion: 'fp2' });
    expect(await engine([fp2]).reserve(request, { inputTokens: 0 }, verified.execution))
      .toMatchObject({ code: 'DUPLICATE_REQUEST', executionGrant: false });
    await transport.eval(seed, REQUEST_EPOCH_KEYS(namespace), JSON.stringify({ authority: rotated, current: 'fp3' }));
    await publish(2);
    const currentEngine = engine([{ ...fp2, state: 'verify_only' }, fp3]);
    expect(await currentEngine.reserve(request, { inputTokens: 10 }, verified.execution)).toMatchObject({ code: 'DUPLICATE_REQUEST', executionGrant: false });
    expect(await currentEngine.reserve({ ...request, content: 'changed' }, {}, verified.execution)).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(await store.readUsage('owner', '2026-10-06', '2026-W41')).toMatchObject({
      day: { reservedMicroUsd: 2400 }, week: { reservedMicroUsd: 2400 } });
    const nextKid = 'n'.repeat(22), nextEpochId = `g8_${nextKid}`, nextKey = Buffer.alloc(32, 8);
    const nextAuthority = { ...rotated, highestGeneration: 8, authorityRevision: 2, currentEpochId: nextEpochId,
      epochs: { ...rotated.epochs, [nextEpochId]: { ...authority.epochs[epochId], epochId: nextEpochId, generation: 8,
        kid: nextKid, state: 'current' } } };
    await transport.eval(seed, REQUEST_EPOCH_KEYS(namespace), JSON.stringify({ authority: nextAuthority, current: 'fp3' }));
    const nextPayload = { ...payload, epochId: nextEpochId, generation: 8, kid: nextKid, endpoint: 'places' as const,
      operationHandle: 'p'.repeat(43) };
    const nextCommandId = `${nextEpochId}.123e4567-e89b-42d3-a456-426614174001`;
    const nextCommandIndex = deriveRequestEpochIndex(scopeKey, 'tm/issuance-index/v1', [payload.ownerScope, nextEpochId, nextCommandId]);
    const nextHandleIndex = deriveRequestEpochIndex(scopeKey, 'tm/operation-index/v1', [payload.ownerScope, 'places', nextEpochId, nextPayload.operationHandle]);
    const nextCapability = signCapability(nextPayload, nextKey);
    await epochs.issue({ ...nextPayload, identitySubject: 'owner', commandId: nextCommandId, commandIndex: nextCommandIndex,
      handleIndex: nextHandleIndex, capability: nextCapability, preparedAtMs: at.getTime() });
    const currentVerifier = createRequestEpochVerifier({ store: epochs, signingKeys: [{ kid: nextKid, key: nextKey, state: 'current' }],
      scopeKeys: [{ version: 'fp1', key: scopeKey, state: 'verify_only' }] });
    const allow = { consume: async () => ({ kind: 'allowed' as const }) };
    const pipeline = createProtectedEndpointPipeline({ origin: 'https://fixture.invalid', now,
      epochs: currentVerifier, rejectLegacy: true, admission: allow, rate: allow, audit: vi.fn(),
      sessions: { lookup: async () => ({ kind: 'authenticated', subject: 'owner', expiresAt: at.getTime() + 60000, revokedAt: null }) },
      cost: { resolve: async () => { const registryBundle = await store.snapshot();
        return { registryBundle, table: registryBundle.table, entries: registryBundle.entries, blockEvidence: [] }; } },
      makeEngine: (registry) => createQuotaEngine({ store, costRegistry: registry, fingerprintKeys: [fp3], now,
        newId: () => `reservation-${++id}`, leaseMs: 18000,
        tierLimits: { tier1: { dayLimitMicroUsd: 100000, weekBaseLimitMicroUsd: 500000 },
          tier2: { dayLimitMicroUsd: 200000, weekBaseLimitMicroUsd: 1000000 } } }),
    });
    const upstream = { execute: vi.fn(async () => ({ kind: 'success' as const, data: { places: ['TEST_ONLY'] } })) };
    const requestHttp = (token: string | null = nextCapability) => new Request('https://fixture.invalid/api/places', {
      method: 'POST', headers: { cookie: 'SESSION=TEST_ONLY', origin: 'https://fixture.invalid',
        'content-type': 'application/json', 'idempotency-key': nextPayload.operationHandle,
        ...(token ? { 'x-request-capability': token } : {}) },
      body: JSON.stringify({ query: 'TEST_ONLY query', idempotencyKey: nextPayload.operationHandle }),
    });
    const policy = { endpoint: 'places' as const, cookieName: 'SESSION',
      resources: { maxBytes: 2048, maxDepth: 8, maxNodes: 256, readTimeoutMs: 5000, dependencyTimeoutMs: 1000,
        executionTimeoutMs: 8000, settlementBufferMs: 5000, leaseMs: 18000 },
      validate: (_body: unknown) => ({ ok: true as const, input: 'TEST_ONLY', content: 'TEST_ONLY query' }),
      deriveEstimateInputs: () => ({}), upstream };
    const context = { admissionKey: 'TEST_ONLY_ingress' };
    const lifecycle = createRedisEpochLifecycleStore({ namespace, transport, timeoutMs: 2000, audit: vi.fn(),
      scope: 'TEST_ONLY', epochFloor: floor, evidence: async () => ({ accounting: false, key: false, keyReferences: {} }) });
    const cleanup = async (operationId: string) => {
      const command = { operationId, action: 'cleanup' as const, target: 'all', actor: 'admin',
        reasonCode: 'TEST_ONLY', dryRun: false, step: 'inspect' as const,
        idempotencyKey: `${operationId}-inspect`, auditId: `${operationId}-inspect` };
      await lifecycle.execute(command);
      return lifecycle.execute({ ...command, step: 'confirm', idempotencyKey: `${operationId}-confirm`, auditId: `${operationId}-confirm` });
    };
    expect(await cleanup('before-reserve')).toMatchObject({ outcome: 'applied', changed: 0 });
    expect((await pipeline.execute(requestHttp(null), context, policy)).status).toBe(410);
    expect((await pipeline.execute(requestHttp(), context, policy)).status).toBe(200);
    expect((await pipeline.execute(requestHttp(), context, policy)).status).toBe(409);
    expect(upstream.execute).toHaveBeenCalledTimes(1);
    at.setTime(at.getTime()+60001);
    await store.expireLeases('owner', at.toISOString());
    expect(await cleanup('after-reserve')).toMatchObject({ outcome: 'applied', changed: 1 });
    const original = await verifier.verify('owner','assistant',payload.operationHandle,capability);
    if(!original.ok) throw new Error('TEST_ONLY_ORIGINAL_BINDING_LOST');
    const tombstoneDuplicate=await currentEngine.reserve(request,{inputTokens:0},original.execution);
    expect(tombstoneDuplicate).toMatchObject({ok:false,status:409});
    const accounting=await store.getEpochBinding!('owner',original.execution.accountingIndex);
    if(!accounting) throw new Error('TEST_ONLY_ACCOUNTING_LOST');
    expect(await store.settle({identitySubject:'owner',reservationId:accounting.reservationId,transition:'settled',
      chargeMicroUsd:2400,costModelVersion:accounting.costModelVersion,reason:'TEST_ONLY_LATE_SUCCESS',nowIso:at.toISOString()}))
      .toMatchObject({status:'invalid_transition',reservation:{status:'uncertain',lateOutcomeObserved:{outcome:'success'}}});
    expect(await store.readUsage('owner','2026-10-06','2026-W41')).toMatchObject({
      day:{usedMicroUsd:50000,reservedMicroUsd:2400},week:{usedMicroUsd:50000,reservedMicroUsd:2400}});
  });
});
