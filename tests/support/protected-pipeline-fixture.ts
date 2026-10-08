import { vi } from 'vitest';
import { createQuotaEngine } from '../../api/_lib/quota-engine';
import { PROTECTED_ENDPOINTS, type ProtectedEndpoint } from '../../api/_lib/cost-price-table';
import { costParametersDigest } from '../../api/_lib/cost-registry';
import { createProtectedEndpointPipeline, type EndpointPolicy, type PinnedCostContext,
  type SessionResult, type RateResult, type MockObservation } from '../../api/_lib/protected-endpoint-pipeline';
import { isRecord } from '../../api/_lib/http';
import { InMemorySharedStoreMock } from './in-memory-shared-store';
import { FIXTURE_ALL_LIVE } from '../fixtures/cost-price-fixtures';
import { fixtureRegistryEntry } from '../fixtures/cost-registry-fixtures';
import { FIXTURE_FINGERPRINT_KEY } from '../fixtures/quota-fingerprint-fixtures';

export interface FixtureOptions { day?: number; week?: number; endpoint?: ProtectedEndpoint }
export interface PlacesInput { query: string }

const FIXTURE_EXECUTION_POLICY = {
  assistant: { executionTimeoutMs: 500, settlementBufferMs: 200, leaseMs: 2_000 },
  transcribe: { executionTimeoutMs: 600, settlementBufferMs: 200, leaseMs: 2_000 },
  places: { executionTimeoutMs: 200, settlementBufferMs: 100, leaseMs: 1_000 },
  speech: { executionTimeoutMs: 400, settlementBufferMs: 200, leaseMs: 2_000 },
  'photo-ocr': { executionTimeoutMs: 600, settlementBufferMs: 200, leaseMs: 2_000 },
  'photo-translate': { executionTimeoutMs: 500, settlementBufferMs: 200, leaseMs: 2_000 },
} satisfies Record<ProtectedEndpoint, { executionTimeoutMs: number; settlementBufferMs: number; leaseMs: number }>;

export function createProtectedPipelineFixture(options: FixtureOptions = {}) {
  let ms = Date.parse('2026-10-06T00:00:00.000Z');
  const clock = { now: () => new Date(ms), advance: (delta: number) => { ms += delta; } };
  const store = new InMemorySharedStoreMock();
  store.seed({ identitySubject: 'fixture-subject', status: 'approved', tier: 'tier1', expiresAt: null });
  const order: string[] = [];
  const original = {
    readQuota: store.readQuota.bind(store), reserve: store.reserve.bind(store),
    settle: store.settle.bind(store), getReservation: store.getReservation.bind(store),
  };
  const spies = {
    readQuota: vi.spyOn(store, 'readQuota').mockImplementation(original.readQuota),
    reserve: vi.spyOn(store, 'reserve').mockImplementation(original.reserve),
    settle: vi.spyOn(store, 'settle').mockImplementation(original.settle),
    getReservation: vi.spyOn(store, 'getReservation').mockImplementation(original.getReservation),
    audit: vi.fn(),
  };
  const tierLimits = {
    tier1: { dayLimitMicroUsd: options.day ?? 1_000_000, weekBaseLimitMicroUsd: options.week ?? 5_000_000 },
    tier2: { dayLimitMicroUsd: 2_000_000, weekBaseLimitMicroUsd: 10_000_000 },
  };
  const table = structuredClone(FIXTURE_ALL_LIVE);
  const entries = PROTECTED_ENDPOINTS.filter((endpoint) => table.endpoints[endpoint].live)
    .map((endpoint) => fixtureRegistryEntry(endpoint, table));
  const pinned: PinnedCostContext = {
    table, entries,
    blockEvidence: entries.map((entry) => ({
      endpoint: entry.endpoint, version: entry.version, digest: costParametersDigest(entry),
      versionBlocked: false, parametersBlocked: false,
    })),
  };
  const sessions = { lookup: vi.fn(async (): Promise<SessionResult> => {
    order.push('session');
    return { kind: 'authenticated' as const, subject: 'fixture-subject', expiresAt: ms + 60_000, revokedAt: null };
  }) };
  const admission = { consume: vi.fn(async (): Promise<RateResult> => { order.push('admission'); return { kind: 'allowed' }; }) };
  const rate = { consume: vi.fn(async (): Promise<RateResult> => { order.push('rate'); return { kind: 'allowed' }; }) };
  const cost = { resolve: vi.fn(async (): Promise<PinnedCostContext | null> => { order.push('cost'); return pinned; }) };
  const upstream = { execute: vi.fn(async (): Promise<MockObservation<{ places: string[] }>> => {
    order.push('upstream');
    return { kind: 'success' as const, data: { places: ['FIXTURE_PLACE'] }, settlementEstimateMicroUsd: 40_000 };
  }) };
  const policy: EndpointPolicy<PlacesInput, { places: string[] }> = {
    endpoint: options.endpoint ?? 'places',
    cookieName: 'fixture-session',
    resources: { maxBytes: 256, maxDepth: 4, maxNodes: 32, readTimeoutMs: 100, dependencyTimeoutMs: 100,
      ...FIXTURE_EXECUTION_POLICY[options.endpoint ?? 'places'] },
    validate: (body) => {
      order.push('validate');
      if (!isRecord(body) || Object.keys(body).length !== 1 || typeof body.query !== 'string') return { ok: false, code: 'INVALID_INPUT' };
      if (body.query.length > 64) return { ok: false, code: 'PAYLOAD_TOO_LARGE' };
      if (!body.query.trim()) return { ok: false, code: 'INVALID_INPUT' };
      return { ok: true, input: { query: body.query }, content: { query: body.query } };
    },
    deriveEstimateInputs: () => ({}),
    upstream,
  };
  const makeEngine = (registry?: Parameters<typeof createQuotaEngine>[0]['costRegistry']) => createQuotaEngine({
    store, tierLimits, fingerprintKey: FIXTURE_FINGERPRINT_KEY, now: clock.now,
    costRegistry: registry, storeTimeoutMs: 100, leaseMs: policy.resources.leaseMs,
  });
  const deps = { sessions, admission, rate, cost, now: clock.now, audit: spies.audit, makeEngine };
  const pipeline = createProtectedEndpointPipeline(deps);
  const context = { admissionKey: 'fixture-ingress' };
  const request = (body: unknown = { query: '東京車站' }, key = 'fixture-key', headers: Record<string, string> = {}) =>
    new Request('https://fixture.invalid/api/places', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'fixture-session=opaque-fixture',
        'Idempotency-Key': key, ...headers }, body: JSON.stringify(body) });
  const execute = (req = request()) => pipeline.execute(req, context, policy);
  return { deps, pipeline, execute, request, context, policy, spies, sessions, admission, rate, cost,
    upstream, pinned, clock, store, order, engine: makeEngine(), tierLimits };
}
export type ProtectedPipelineFixture = ReturnType<typeof createProtectedPipelineFixture>;
