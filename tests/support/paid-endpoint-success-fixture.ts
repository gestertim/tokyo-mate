import { vi } from 'vitest';
import { createQuotaEngine } from '../../api/_lib/quota-engine';
import { readBoundedBytes } from '../../api/_lib/bounded-request';
import { parsePcmMultipart, validateImageEnvelope, validatePaidJson, type ParsedPcmMultipart } from '../../api/_lib/paid-input-validation';
import { EXECUTION_POLICY, INPUT_POLICY } from '../../api/_lib/local-protection-policy';
import { PROTECTED_ENDPOINTS, type ProtectedEndpoint } from '../../api/_lib/cost-price-table';
import { costParametersDigest } from '../../api/_lib/cost-registry';
import { createProtectedEndpointPipeline, type EndpointPolicy, type MockObservation,
  type PinnedCostContext, type RateResult, type SessionResult } from '../../api/_lib/protected-endpoint-pipeline';
import type { PaidBoundaryOptions } from '../../api/_lib/paid-endpoint-boundary';
import { isRecord } from '../../api/_lib/http';
import { InMemorySharedStoreMock } from './in-memory-shared-store';
import { FIXTURE_FINGERPRINT_KEY } from '../fixtures/quota-fingerprint-fixtures';
import { TEST_ONLY_PAID_ENDPOINT_DESCRIPTORS, TEST_ONLY_QUOTA_LIMITS,
  type PaidEndpointSuccessDescriptor } from '../fixtures/paid-endpoint-success-descriptors';
import { fixtureRegistryEntry } from '../fixtures/cost-registry-fixtures';

type JsonInput = { kind: 'json'; body: Record<string, unknown>; imageBytes?: number };
type PcmInput = { kind: 'pcm'; value: ParsedPcmMultipart };
type EndpointInput = JsonInput | PcmInput;

function toRequestContent(value: unknown): import('../../api/_lib/quota-fingerprint').RequestContent {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))) return value;
  if (Array.isArray(value)) return value.map(toRequestContent);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toRequestContent(item)]));
  throw new TypeError('TEST_ONLY_REQUEST_CONTENT_INVALID');
}

function parsePcmRequest(value: unknown): value is ParsedPcmMultipart {
  return isRecord(value) && value.wav instanceof Uint8Array && Number.isSafeInteger(value.dataBytes) &&
    typeof value.durationSeconds === 'number' && (value.language === null || typeof value.language === 'string') &&
    (value.idempotencyKey === null || typeof value.idempotencyKey === 'string');
}

function pipelineDescriptor(endpoint: ProtectedEndpoint): Exclude<PaidEndpointSuccessDescriptor, { mode: 'mock_only' }> {
  const descriptor = TEST_ONLY_PAID_ENDPOINT_DESCRIPTORS[endpoint];
  if (descriptor.mode !== 'pipeline') throw new TypeError('TEST_ONLY_PIPELINE_DESCRIPTOR_REQUIRED');
  return descriptor;
}

export function createPaidEndpointSuccessFixture(endpoint: Exclude<ProtectedEndpoint, 'speech'>) {
  const descriptor = pipelineDescriptor(endpoint);
  const now = Date.parse('2026-10-06T00:00:00.000Z');
  let currentTime = now;
  const clock = () => new Date(currentTime);
  const store = new InMemorySharedStoreMock();
  store.seed({ identitySubject: 'fixture-subject', status: 'approved', tier: descriptor.quotaTier, expiresAt: null });
  const order: string[] = [];
  const originalReserve = store.reserve.bind(store);
  const originalSettle = store.settle.bind(store);
  const spies = {
    reserve: vi.spyOn(store, 'reserve').mockImplementation(async (...args) => {
      order.push('reserve');
      return originalReserve(...args);
    }),
    settle: vi.spyOn(store, 'settle').mockImplementation(async (...args) => {
      order.push('settle');
      return originalSettle(...args);
    }),
    audit: vi.fn(),
  };
  const table = structuredClone(descriptor.table);
  const entries = PROTECTED_ENDPOINTS.filter((name) => table.endpoints[name].live)
    .map((name) => fixtureRegistryEntry(name, table));
  const pinned: PinnedCostContext = {
    scope: 'TEST_ONLY',
    table,
    entries,
    blockEvidence: entries.map((entry) => ({
      endpoint: entry.endpoint,
      version: entry.version,
      digest: costParametersDigest(entry),
      versionBlocked: false,
      parametersBlocked: false,
    })),
  };
  const sessions = {
    lookup: vi.fn(async (): Promise<SessionResult> => {
      order.push('session');
      return { kind: 'authenticated', subject: 'fixture-subject', expiresAt: currentTime + 60_000, revokedAt: null };
    }),
  };
  const admission = { consume: vi.fn(async (): Promise<RateResult> => { order.push('admission'); return { kind: 'allowed' }; }) };
  const rate = { consume: vi.fn(async (): Promise<RateResult> => { order.push('rate'); return { kind: 'allowed' }; }) };
  const cost = { resolve: vi.fn(async (): Promise<PinnedCostContext> => { order.push('cost'); return pinned; }) };
  const verifyImage = vi.fn(async (_bytes: Uint8Array, _mime: string) => ({ width: 1, height: 1 }));
  const upstream = {
    execute: vi.fn(async (): Promise<MockObservation<unknown>> => {
      order.push('upstream');
      return { kind: 'success', data: descriptor.response,
        settlementEstimateMicroUsd: descriptor.settlementEstimateMicroUsd };
    }),
  };
  const resources = {
    ...INPUT_POLICY,
    maxBytes: INPUT_POLICY.maxBytes[endpoint],
    dependencyTimeoutMs: 100,
    executionTimeoutMs: endpoint === 'places' ? 200 : 600,
    settlementBufferMs: 100,
    leaseMs: endpoint === 'places' ? 1_000 : 2_000,
  };
  const policy: EndpointPolicy<EndpointInput, unknown> = {
    endpoint,
    cookieName: 'fixture-session',
    resources,
    ...(endpoint === 'transcribe' ? {
      parse: async (request, limits, audit) => ({
        kind: 'pcm' as const,
        value: await parsePcmMultipart(request, await readBoundedBytes(request, limits, audit)),
      }),
    } : {}),
    validate: async (body) => {
      order.push('validate');
      if (endpoint === 'transcribe') {
        if (!isRecord(body) || body.kind !== 'pcm' || !parsePcmRequest(body.value)) return { ok: false, code: 'INVALID_INPUT' };
        return {
          ok: true,
          input: { kind: 'pcm', value: body.value },
          content: { audio: body.value.wav, language: body.value.language },
        };
      }
      if (!isRecord(body) || !validatePaidJson(endpoint, body)) return { ok: false, code: 'INVALID_INPUT' };
      const { idempotencyKey: _key, ...semanticBody } = body;
      const content = toRequestContent(semanticBody);
      let imageBytes: number | undefined;
      if (endpoint === 'photo-ocr') {
        if (typeof body.imageDataUrl !== 'string') return { ok: false, code: 'INVALID_INPUT' };
        const image = validateImageEnvelope(body.imageDataUrl);
        const size = await verifyImage(image.bytes, image.mime);
        if (size === null) return { ok: false, code: 'INVALID_INPUT' };
        if (![size.width, size.height].every((dimension) => Number.isSafeInteger(dimension) && dimension > 0))
          return { ok: false, code: 'INVALID_INPUT' };
        if (Math.max(size.width, size.height) > 2048) return { ok: false, code: 'PAYLOAD_TOO_LARGE' };
        imageBytes = image.bytes.byteLength;
      }
      return { ok: true, input: { kind: 'json', body, ...(imageBytes !== undefined ? { imageBytes } : {}) }, content };
    },
    deriveEstimateInputs: (input) => {
      const entry = pinned.entries.find((item) => item.endpoint === endpoint);
      if (!entry) throw new TypeError('TEST_ONLY_COST_DESCRIPTOR_MISSING');
      if (endpoint === 'places') return {};
      if (endpoint === 'transcribe') {
        if (input.kind !== 'pcm') throw new TypeError('TEST_ONLY_PCM_INPUT_REQUIRED');
        return { audioDataBytes: input.value.dataBytes, billedMinutes: Math.ceil(input.value.durationSeconds / 60) };
      }
      if (input.kind !== 'json') throw new TypeError('TEST_ONLY_JSON_INPUT_REQUIRED');
      const tokenInputs = {
        inputTokens: entry.estimateBounds.inputTokens,
        maxOutputTokens: entry.estimateBounds.maxOutputTokens,
      };
      return endpoint.startsWith('photo-')
        ? { ...tokenInputs, ...(input.imageBytes !== undefined ? { imageBytes: input.imageBytes } : {}) }
        : tokenInputs;
    },
    upstream,
  };
  const tierLimits = TEST_ONLY_QUOTA_LIMITS;
  const makeEngine = (registry?: Parameters<typeof createQuotaEngine>[0]['costRegistry']) => createQuotaEngine({
    store,
    tierLimits,
    fingerprintKey: FIXTURE_FINGERPRINT_KEY,
    now: clock,
    costRegistry: registry,
    storeTimeoutMs: 100,
    leaseMs: resources.leaseMs,
  });
  const pipeline = createProtectedEndpointPipeline({
    sessions, admission, rate, cost, now: clock, audit: spies.audit, makeEngine,
  });
  const request = (body: unknown = descriptor.body, key = 'fixture-idempotency-key') => {
    const headers = { Cookie: 'fixture-session=opaque-fixture', 'Idempotency-Key': key };
    if (endpoint === 'transcribe') {
      if (!(body instanceof Uint8Array)) throw new TypeError('TEST_ONLY_PCM_BYTES_REQUIRED');
      const form = new FormData();
      const audioBuffer = new ArrayBuffer(body.byteLength);
      new Uint8Array(audioBuffer).set(body);
      form.append('audio', new Blob([audioBuffer], { type: 'audio/wav' }), 'recording.wav');
      form.append('language', 'ja');
      return new Request('https://fixture.invalid/api/transcribe', { method: 'POST', headers, body: form });
    }
    return new Request(`https://fixture.invalid/api/${endpoint}`, { method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  };
  const execute = (req = request()) => pipeline.execute(req, { admissionKey: 'fixture-ingress' }, policy);
  const handlerOptions: PaidBoundaryOptions = {
    audit: (event) => spies.audit({ stage: 'boundary', outcome: event.outcome }),
    testOnlyPipeline: {
      scope: 'TEST_ONLY',
      endpoint,
      execute,
    },
  };
  return { descriptor, execute, request, policy, pipeline, pinned, store, spies, order, upstream,
    sessions, admission, rate, cost, verifyImage, clock, advance: (delta: number) => { currentTime += delta; },
    engine: makeEngine(), handlerOptions, currentTime: () => currentTime };
}
