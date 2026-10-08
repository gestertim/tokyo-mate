// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createQuotaEngine } from '../../api/_lib/quota-engine';
import { createRequestEpochEndpoints, type RequestEpochEndpointsOptions } from '../../api/_lib/request-epoch-endpoints';
import { createSessionService, type SessionRecord } from '../../api/_lib/session';
import { deriveOwnerScope, deriveRequestEpochIndex, makeIssuanceCommandId, signCapability } from '../../api/_lib/request-epoch';
import type { RequestEpochAuthority, RequestEpochIssueRecord, RequestEpochStore } from '../../api/_lib/request-epoch-store';
import { InMemorySharedStoreMock } from '../support/in-memory-shared-store';
import { FIXTURE_FINGERPRINT_KEY } from '../fixtures/quota-fingerprint-fixtures';

const now = () => new Date('2026-10-06T02:00:00.000Z');
const kid = Buffer.alloc(16, 0x22).toString('base64url');
const epochId = `g7_${kid}`;
const ownerKey = Buffer.alloc(32, 0x33);
const signingKey = Buffer.alloc(32, 0x11);
function fixture(approved = true) {
  const sessionsById = new Map<string, SessionRecord>();
  const sessions = createSessionService({ signingKey: Buffer.alloc(32, 9), lifetimeMs: 60_000,
    storeTimeoutMs: 50, now, audit: vi.fn(), cookieName: 'EPOCH_FIXTURE',
    store: { create: async (record) => { sessionsById.set(record.sessionId, record); },
      get: async (id) => sessionsById.get(id) ?? null, revoke: async () => {} } });
  const shared = new InMemorySharedStoreMock(() => now());
  shared.seed({ identitySubject: 'owner', status: approved ? 'approved' : 'revoked', tier: 'tier1', expiresAt: null });
  const engine = createQuotaEngine({ store: shared, fingerprintKey: FIXTURE_FINGERPRINT_KEY,
    tierLimits: { tier1: { dayLimitMicroUsd: 1_000_000, weekBaseLimitMicroUsd: 5_000_000 },
      tier2: { dayLimitMicroUsd: 2_000_000, weekBaseLimitMicroUsd: 10_000_000 } }, now });
  const authority: RequestEpochAuthority = {
    authorityRevision: 1, highestGeneration: 7, retiredThrough: 0, currentEpochId: epochId, revokedKids: [],
    epochs: { [epochId]: { epochId, generation: 7, kid, scopeKeyVersion: 'scope-v1',
      issueStartsAtMs: now().getTime() - 1000, issueExpiresAtMs: now().getTime() + 60_000,
      validUntilMs: now().getTime() + 172_800_000, state: 'current' } },
  };
  const payload = { generation: 7, epochId, kid, scopeKeyVersion: 'scope-v1',
    ownerScope: deriveOwnerScope(ownerKey, 'scope-v1', 'owner'), endpoint: 'places' as const, operationHandle: 'h'.repeat(43),
    issuedAtMs: now().getTime(), expiresAtMs: now().getTime() + 86_400_000 };
  const record: RequestEpochIssueRecord = { ...payload, commandId: makeIssuanceCommandId(epochId,
      '123e4567-e89b-42d3-a456-426614174000'), commandIndex: deriveRequestEpochIndex(ownerKey, 'tm/issuance-index/v1',
        [payload.ownerScope, epochId, makeIssuanceCommandId(epochId, '123e4567-e89b-42d3-a456-426614174000')]), handleIndex: 'i'.repeat(43),
    capability: signCapability(payload, signingKey), granted: false };
  const store: RequestEpochStore = {
    authority: vi.fn(async () => ({ authority, nowMs: now().getTime() })),
    confirm: vi.fn().mockResolvedValue({ status: 'duplicate', record }),
    execution: vi.fn().mockResolvedValue({ status: 'duplicate', record }),
    issue: vi.fn<RequestEpochStore['issue']>(async () => ({ status: 'issued', record })),
  };
  const allow = { consume: vi.fn(async () => ({ kind: 'allowed' as const })) };
  const options: RequestEpochEndpointsOptions = {
    sessions, store, engine, admission: allow, rate: allow, ingress: () => ({ admissionKey: 'fixture-ingress' }),
    signingKeys: [{ kid, key: signingKey, state: 'current' }],
    ownerScopeKeys: [{ version: 'scope-v1', key: ownerKey, state: 'current' }],
    origin: 'https://fixture.invalid', timeoutMs: 50, now, audit: vi.fn(),
  };
  const issuanceCommandId = makeIssuanceCommandId(epochId, '123e4567-e89b-42d3-a456-426614174000');
  const request = async (origin = options.origin) => new Request(`${options.origin}/api/me/request-epochs`, {
    method: 'POST', headers: { cookie: (await sessions.create('owner')).split(';')[0],
      origin, 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: 'places', issuanceCommandId }),
  });
  return { options, store, shared, request, handler: createRequestEpochEndpoints(options).issue, record };
}

describe('E01 request epoch issuance endpoint', () => {
  it.each([1023,1024,1025])('簽發body %i bytes：上限不截斷、不補簽', async (bytes) => {
    const f=fixture(), original=await f.request(), body=(await original.text()).padEnd(bytes,' ');
    const response=await f.handler(new Request(original,{ body }));
    expect(response.status).toBe(bytes<=1024 ? 200 : 413);
    expect(f.store.issue).not.toHaveBeenCalled();
  });
  it('current簽發區間已結束且缺next：新命令503而非捏造epoch，原confirm仍不補簽', async () => {
    const f=fixture(), snapshot=await f.options.store.authority();
    snapshot.authority.epochs[epochId].issueExpiresAtMs=snapshot.nowMs;
    vi.mocked(f.options.store.authority).mockResolvedValue(snapshot);
    vi.mocked(f.store.confirm).mockResolvedValueOnce({status:'missing'});
    expect((await f.handler(await f.request())).status).toBe(503);
    expect(f.store.issue).not.toHaveBeenCalled();
  });
  it('fails closed without trusted configuration and rejects non-POST', async () => {
    const handler = createRequestEpochEndpoints().issue;
    expect((await handler(new Request('https://fixture.invalid/api/me/request-epochs', { method: 'POST' }))).status).toBe(503);
    expect((await handler(new Request('https://fixture.invalid/api/me/request-epochs'))).status).toBe(405);
  });

  it('requires current origin and approved本人資格 before atomic issue', async () => {
    const f = fixture();
    expect((await f.handler(await f.request('https://elsewhere.invalid'))).status).toBe(400);
    expect(f.store.issue).not.toHaveBeenCalled();
    const denied = fixture(false);
    expect((await denied.handler(await denied.request())).status).toBe(403);
    expect(denied.store.issue).not.toHaveBeenCalled();
  });

  it('returns a no-store signed capability and preserves exact bytes on duplicate confirmation', async () => {
    const f = fixture();
    vi.mocked(f.store.confirm).mockResolvedValueOnce({ status: 'missing' });
    const first = await f.handler(await f.request());
    expect(first.status).toBe(201);
    expect(first.headers.get('cache-control')).toBe('no-store');
    expect((await first.json()).data).toMatchObject({
      capability: f.record.capability, operationHandle: f.record.operationHandle, requestEpochId: epochId,
    });

    vi.mocked(f.store.issue).mockResolvedValueOnce({ status: 'duplicate', record: f.record });
    const confirmed = await f.handler(await f.request());
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).data.capability).toBe(f.record.capability);
  });

  it.each(['not_eligible', 'not_current'] as const)('confirmation rechecks %s without issuing a replacement', async (status) => {
    const f = fixture();
    vi.mocked(f.store.confirm).mockResolvedValueOnce({ status });
    expect((await f.handler(await f.request())).status).toBe(status === 'not_eligible' ? 403 : 410);
    expect(f.store.issue).not.toHaveBeenCalled();
  });

  it('a committed issuance whose response is lost is manually confirmed without signing again', async () => {
    const f = fixture();
    vi.mocked(f.store.confirm).mockResolvedValueOnce({ status: 'missing' });
    vi.mocked(f.store.issue).mockRejectedValueOnce(new Error('TEST_ONLY response lost'));
    expect((await f.handler(await f.request())).status).toBe(503);
    const calls = vi.mocked(f.store.issue).mock.calls.length;
    expect((await f.handler(await f.request())).status).toBe(200);
    expect(f.store.issue).toHaveBeenCalledTimes(calls);
  });
  it('confirms an existing capability after normal rotation without a signing key', async () => {
    const f = fixture();
    const rotated: RequestEpochAuthority = {
      ...((await f.options.store.authority()).authority),
      authorityRevision: 2,
      highestGeneration: 8,
      currentEpochId: `g8_${kid}`,
      epochs: { ...((await f.options.store.authority()).authority.epochs),
        [epochId]: { ...((await f.options.store.authority()).authority.epochs[epochId]), state: 'verify_only' } },
    };
    vi.mocked(f.options.store.authority).mockResolvedValueOnce({ authority: rotated, nowMs: now().getTime() });
    f.options.signingKeys[0].state = 'verify_only';
    vi.mocked(f.store.issue).mockResolvedValueOnce({ status: 'duplicate', record: f.record });
    const response = await f.handler(await f.request());
    expect(response.status).toBe(200);
    expect((await response.json()).data.capability).toBe(f.record.capability);
  });
});
