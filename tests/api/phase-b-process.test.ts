// @vitest-environment node
import { fork, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { createRedisRestTransport } from '../../api/_lib/redis-rest-transport';
import { createRedisSharedStore, REDIS_QUOTA_KEYS } from '../../api/_lib/redis-shared-store';
import { createPhaseBPlan, phaseBMain, PHASE_B_BRANCH_BOUNDS, PHASE_B_CAPACITY_THRESHOLDS,
  PHASE_B_LIMITS, PHASE_B_SCRIPTS, PHASE_B_STORAGE_ENVELOPE, runPhaseB,
  validatePhaseBConditions, validatePhaseBPlan, type PhaseBControl } from '../../scripts/005-phase-b-caller.mjs';
import { costParametersDigest, createRegistryBundle } from '../../api/_lib/cost-registry';
import { costModelOf, PROTECTED_ENDPOINTS } from '../../api/_lib/cost-price-table';
import { REDIS_QUOTA_LUA } from '../../api/_lib/redis-quota-script';
import { getQuotaWindows } from '../../api/_lib/quota-window';
import type { ReserveCommand } from '../../api/_lib/shared-store';
import type { PhaseBConditions, PhaseBPlan, PhaseBReport } from '../../scripts/005-phase-b-caller.mjs';
import { fixtureRegistryEntry } from '../fixtures/cost-registry-fixtures';
import { FIXTURE_ALL_LIVE, FIXTURE_NONE_LIVE, fixtureWithEndpoint } from '../fixtures/cost-price-fixtures';
import { FIXTURE_FINGERPRINT_KEY } from '../fixtures/quota-fingerprint-fixtures';
import { luaAvailable, runLuaRedis, type LuaInvocation } from '../support/lua-redis-harness';

const now = '2026-10-06T02:00:00.000Z';
const workerPath = fileURLToPath(new URL('../../scripts/005-phase-b-worker.mjs', import.meta.url));
const inventoryPreflightLua = `for _,key in ipairs(KEYS) do if redis.call('EXISTS',key)~=0 then return 1 end end return 0`;
const exactCleanupLua = `local count=0 for _,key in ipairs(KEYS) do count=count+redis.call('DEL',key) end return count`;
const inventoryConfirmLua = `local count=0 for _,key in ipairs(KEYS) do count=count+redis.call('EXISTS',key) end return count`;
const storedFieldsSnapshotLua = `local out={} for i,key in ipairs(KEYS) do local fields=redis.call('HGETALL',key); local bytes=0; for _,value in ipairs(fields) do bytes=bytes+string.len(value) end; out[i]={fields=#fields/2,bytes=bytes} end; return cjson.encode(out)`;
const phaseBConditions = {
  noReadRegions: true,
  noPaymentMethod: true,
  noOtherWorkloadsOrWriters: true,
  commands: { value: 11, source: 'TEST_ONLY console fixture', observedAt: '2026-10-08T09:00:00+08:00' },
  bandwidthBytes: { value: 2048, source: 'TEST_ONLY console fixture', observedAt: '2026-10-08T09:00:00+08:00' },
  storageBytes: { value: 0, source: 'TEST_ONLY console fixture', observedAt: '2026-10-08T09:00:00+08:00' },
};

interface WireRequest {
  operation: string;
  script: string;
  keys: string[];
  argumentsJson: string;
}

interface WorkerResult {
  slot: number;
  pid: number;
  clientCreated?: boolean;
  status?: string;
  executionGrant?: boolean;
}

interface WorkerHandle {
  child: ChildProcess;
  ready: Promise<void>;
  result: Promise<WorkerResult>;
}

interface MockRestResponse {
  status: number;
  result?: unknown;
}

function phaseFixture(namespace: string) {
  const table = fixtureWithEndpoint(FIXTURE_NONE_LIVE, 'assistant',
    FIXTURE_ALL_LIVE.endpoints.assistant, 'PHASE_B_SYNTHETIC_v1');
  const entries = PROTECTED_ENDPOINTS.map((endpoint) => fixtureRegistryEntry(endpoint, table));
  const bundle = createRegistryBundle(1, table, entries);
  const digests = Object.fromEntries(entries.map((entry) => [entry.endpoint, costParametersDigest(entry)]));
  const keys = REDIS_QUOTA_KEYS(namespace);
  const windows = getQuotaWindows(new Date(now));
  const subject = 'phase-b-synthetic-subject';
  const command: ReserveCommand = {
    identitySubject: subject,
    idempotencyKey: 'phase-b-synthetic-operation',
    reservationId: 'phase-b-synthetic-reservation',
    endpoint: 'assistant',
    amountMicroUsd: 2_400,
    costModel: costModelOf(table),
    costParametersDigest: digests.assistant,
    requestFingerprint: 'a'.repeat(64),
    fingerprintKeyVersion: FIXTURE_FINGERPRINT_KEY.version,
    estimateInputs: { inputTokens: 0 },
    expectedRegistry: bundle,
    ...windows,
    tierLimits: {
      tier1: { dayLimitMicroUsd: 10_000, weekBaseLimitMicroUsd: 10_000 },
      tier2: { dayLimitMicroUsd: 10_000, weekBaseLimitMicroUsd: 10_000 },
    },
    leaseMs: 60_000,
    nowIso: now,
  };
  return { subject, keys, digests, bundle, command };
}

class MockRestAuthority {
  readonly history: LuaInvocation[] = [];
  readonly requests: WireRequest[] = [];
  readonly reserveBodyBytes: number[] = [];
  private pendingReserves: { invocation: LuaInvocation;
    resolve: (response: MockRestResponse) => void }[] = [];

  constructor(private readonly options: { loseReserveResponses?: boolean; failConfirmation?: boolean;
    faultOperation?: string; fault?: 'timeout' | 'unknown'; confirmationMismatch?: boolean;
    responseBytes?: number; responseOperation?: string } = {}) {}

  async eval(script: string, keys: readonly string[], argumentsJson: string): Promise<MockRestResponse> {
    const command = JSON.parse(argumentsJson) as Record<string, unknown>;
    const operation = script === inventoryPreflightLua || script === PHASE_B_SCRIPTS.preflight ? 'inventory-preflight'
      : script === exactCleanupLua || script === PHASE_B_SCRIPTS.cleanup ? 'exact-cleanup'
        : script === inventoryConfirmLua || script === PHASE_B_SCRIPTS.confirm ? 'inventory-confirm'
          : typeof command.operation === 'string' ? command.operation : 'unknown';
    const request: WireRequest = { operation, script, keys: [...keys], argumentsJson };
    this.requests.push(request);
    const invocation: LuaInvocation = { script, keys: request.keys, command, now };

    if (operation === 'reserve') {
      return new Promise((resolve) => {
        this.pendingReserves.push({ invocation, resolve });
        if (this.pendingReserves.length === 2) {
          const start = this.history.length;
          this.history.push(...this.pendingReserves.map(({ invocation: pending }) => pending));
          const results = runLuaRedis(this.history).slice(start);
          const pending = this.pendingReserves.splice(0);
          pending.forEach((item, index) => item.resolve(this.options.loseReserveResponses
            ? { status: 503 }
            : { status: 200, result: JSON.stringify(results[index]) }));
        }
      });
    }

    if (operation === 'getReservation' && this.options.failConfirmation) return { status: 503 };
    this.history.push(invocation);
    const result = runLuaRedis(this.history).at(-1);
    if (operation === 'getReservation' && this.options.confirmationMismatch) return { status: 200, result: 'null' };
    return { status: 200, result: script === REDIS_QUOTA_LUA ? JSON.stringify(result) : result };
  }

  async evalWire(body: unknown): Promise<MockRestResponse> {
    if (!Array.isArray(body) || body[0] !== 'EVAL' || typeof body[1] !== 'string' ||
        !Number.isSafeInteger(Number(body[2])) || Number(body[2]) < 1) return { status: 400 };
    const keyCount = Number(body[2]);
    const keys = body.slice(3, 3 + keyCount);
    const argumentsJson = body[3 + keyCount];
    if (keys.length !== keyCount || typeof argumentsJson !== 'string' ||
        keys.some((key) => typeof key !== 'string')) return { status: 400 };
    return this.eval(body[1], keys as string[], argumentsJson);
  }

  readonly fetch: typeof fetch = async (_url, init) => {
    const bodyText = String(init?.body);
    if (JSON.parse(bodyText).at(-1)?.includes('"operation":"reserve"'))
      this.reserveBodyBytes.push(Buffer.byteLength(bodyText));
    const response = await this.evalWire(JSON.parse(bodyText));
    const operation = this.requests.at(-1)?.operation;
    if (operation === this.options.faultOperation) {
      if (this.options.fault === 'timeout') return new Promise<Response>(() => {});
      return new Response('{}', { status: 503 });
    }
    const body = JSON.stringify({ result: response.result });
    return new Response(operation === this.options.responseOperation && this.options.responseBytes
      ? body.padEnd(this.options.responseBytes, ' ') : body, { status: response.status });
  };
}

function safeChildEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const name of ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP']) {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  }
  return env;
}

function startWorker(slot: number, fixture: ReturnType<typeof phaseFixture>,
  authority: MockRestAuthority): WorkerHandle {
  const child = fork(workerPath, [], {
    cwd: process.cwd(),
    env: safeChildEnvironment(),
    execArgv: [],
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  let gotResult = false;
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  let resolveResult!: (value: WorkerResult) => void;
  let rejectResult!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const result = new Promise<WorkerResult>((resolve, reject) => { resolveResult = resolve; rejectResult = reject; });
  child.on('message', (message: WorkerResult & { type?: string; requestId?: number; body?: unknown }) => {
    if (message.type === 'ready' && message.slot === slot) {
      resolveReady();
      return;
    }
    if (message.type === 'mock-request' && message.slot === slot && typeof message.body === 'string') {
      void authority.evalWire(JSON.parse(message.body)).then((response) => {
        child.send({ type: 'mock-response', slot, status: response.status, body: JSON.stringify({ result: response.result }) });
      }).catch(() => {
        child.send({ type: 'mock-response', slot, status: 503, body: '{}' });
      });
      return;
    }
    if (message.type === 'result' && message.slot === slot) {
      gotResult = true;
      resolveResult(message);
      return;
    }
    const error = new Error('PHASE_B_WORKER_PROTOCOL_ERROR');
    rejectReady(error);
    rejectResult(error);
  });
  child.once('error', () => {
    rejectReady(new Error('PHASE_B_WORKER_START_ERROR'));
    rejectResult(new Error('PHASE_B_WORKER_ERROR'));
  });
  child.once('exit', (code) => {
    if (!gotResult) rejectResult(new Error(`PHASE_B_WORKER_EXIT_${code ?? 'signal'}`));
  });
  child.send({
    type: 'init',
    slot,
    mode: 'mock',
    namespace: fixture.keys[0].slice(0, fixture.keys[0].lastIndexOf(':')),
    keys: fixture.keys,
    command: fixture.command,
    timeoutMs: 2000,
    maxRequestBytes: 131072,
    maxResponseBytes: 32768,
  });
  return { child, ready, result };
}

async function postEval(authority: MockRestAuthority, script: string, keys: readonly string[],
  argumentsJson = '{}'): Promise<unknown> {
  const response = await authority.eval(script, keys, argumentsJson);
  if (response.status !== 200) throw new Error('PHASE_B_MOCK_REST_UNKNOWN');
  return typeof response.result === 'string' ? JSON.parse(response.result) as unknown : response.result;
}

async function executeRace(fixture: ReturnType<typeof phaseFixture>, authority: MockRestAuthority) {
  const workers = [0, 1].map((slot) => startWorker(slot, fixture, authority));
  try {
    await Promise.all(workers.map((worker) => worker.ready));
    workers.forEach((worker, slot) => worker.child.send({
      type: 'dispatch', slot, remainingMs: 2000,
      credentials: { url: 'https://phase-b-mock.upstash.io', token: 'FAKE_PHASE_B_ONLY' },
    }));
    return await Promise.all(workers.map((worker) => worker.result));
  } finally {
    workers.forEach((worker) => {
      if (worker.child.exitCode === null && worker.child.signalCode === null) worker.child.kill();
    });
  }
}

async function seed(authority: MockRestAuthority, fixture: ReturnType<typeof phaseFixture>) {
  expect(await postEval(authority, inventoryPreflightLua, fixture.keys)).toBe(0);
  expect(await postEval(authority, REDIS_QUOTA_LUA, fixture.keys, JSON.stringify({
    operation: 'publish',
    command: fixture.bundle,
    digests: fixture.digests,
    rejectLegacy: false,
    bundleJson: JSON.stringify(fixture.bundle),
  }))).toEqual({ status: 'published' });
  expect(await postEval(authority, REDIS_QUOTA_LUA, fixture.keys, JSON.stringify({
    operation: 'setEligibility',
    command: { identitySubject: fixture.subject, status: 'approved', tier: 'tier1', expiresAt: null },
    digests: fixture.digests,
    rejectLegacy: false,
  }))).toMatchObject({ status: 'approved', identitySubject: fixture.subject });
}

describe.skipIf(!luaAvailable)('T153 Phase B：雙 OS process REST mock，非真實 Redis 證據', () => {
  it('三鍵既有業務 Lua 同一原子 reserve 並發只 grant 一次、usage 扣一次，exact cleanup', async () => {
    const fixture = phaseFixture('{preview-phasebtest000001}');
    const authority = new MockRestAuthority();
    await seed(authority, fixture);

    const results = await executeRace(fixture, authority);
    expect(runLuaRedis(authority.history).slice(-2)).toMatchObject([
      { status: 'reserved', executionGrant: true },
      { status: 'duplicate', executionGrant: false },
    ]);
    expect(results.map(({ pid }) => pid)).toHaveLength(2);
    expect(new Set(results.map(({ pid }) => pid)).size).toBe(2);
    expect(results.every(({ clientCreated }) => clientCreated === true)).toBe(true);
    expect(results.map(({ status, executionGrant }) => ({ status, executionGrant })).sort((a, b) =>
      String(a.status).localeCompare(String(b.status)))).toEqual([
      { status: 'duplicate', executionGrant: false },
      { status: 'reserved', executionGrant: true },
    ]);

    const windows = fixture.command;
    const usage = await postEval(authority, REDIS_QUOTA_LUA, fixture.keys, JSON.stringify({
      operation: 'readUsage',
      command: {
        identitySubject: fixture.subject,
        dayWindowKey: windows.day.windowKey,
        weekWindowKey: windows.week.windowKey,
      },
      digests: fixture.digests,
      rejectLegacy: false,
    })) as { day: { reservedMicroUsd: number }; week: { reservedMicroUsd: number } };
    expect(usage.day.reservedMicroUsd).toBe(fixture.command.amountMicroUsd);
    expect(usage.week.reservedMicroUsd).toBe(fixture.command.amountMicroUsd);

    const storedStats = runLuaRedis([...authority.history, {
      script: storedFieldsSnapshotLua, keys: fixture.keys, command: {}, now,
    }]).at(-1) as { fields: number; bytes: number }[];
    const applicationPayloadBytes = storedStats.reduce((sum, key) => sum + key.bytes, 0);
    expect(storedStats.map((key) => key.fields)).toEqual([4, 1, 0]);
    expect(applicationPayloadBytes).toBeLessThan(PHASE_B_STORAGE_ENVELOPE.applicationPayloadBytesMax);

    expect(await postEval(authority, exactCleanupLua, fixture.keys)).toBe(2);
    expect(await postEval(authority, inventoryConfirmLua, fixture.keys)).toBe(0);
    expect(authority.requests.map(({ operation }) => operation)).toEqual([
      'inventory-preflight', 'publish', 'setEligibility', 'reserve', 'reserve',
      'readUsage', 'exact-cleanup', 'inventory-confirm',
    ]);
    expect(authority.requests.every(({ keys }) => [...keys].sort().join('|') === [...fixture.keys].sort().join('|'))).toBe(true);
    expect(authority.requests).toHaveLength(8);
    expect(authority.requests.every(({ operation }) =>
      ['inventory-preflight', 'publish', 'setEligibility', 'reserve', 'readUsage', 'exact-cleanup',
        'inventory-confirm'].includes(operation))).toBe(true);
    expect(authority.requests.every(({ keys }) => keys.length === 3)).toBe(true);
    expect(authority.requests.filter(({ operation }) => operation === 'reserve').every(({ argumentsJson }) => {
    const args = JSON.parse(argumentsJson) as { floor?: unknown; command?: { requestEpoch?: unknown } };
    return args.floor === undefined && args.command?.requestEpoch === undefined;
    })).toBe(true);
  });

  describe.skipIf(!luaAvailable)('Phase B 有界 caller／既有 REST transport 的本機回歸', () => {
    const plan = () => createPhaseBPlan('phasebtest000003');
    function run(authority: MockRestAuthority, control: PhaseBControl = {}) {
      const p = plan();
      return runPhaseB(p, phaseFixture(p.namespace), {
        mode: 'mock', createTransport: createRedisRestTransport, createStore: createRedisSharedStore,
        fetch: authority.fetch, readSecrets: async () =>
          ({ url: 'https://phase-b-mock.upstash.io', token: 'FAKE_PHASE_B_ONLY' }),
      }, control);
    }
    it('成功：兩 child 自建 adapter；8 REST／58 logical commands，無 paid upstream／秘密輸出', async () => {
      const authority = new MockRestAuthority();
      const report = await run(authority);
      expect(report).toMatchObject({
        status: 'completed', cleanup: 'cleaned', restRequestsUpperBound: 8,
        logicalCommandsUpperBound: 58, providerRules: 'operator_response_received',
        providerMetering: 'unverified', billableUpperBound: null,
      });
      expect(report.digest).toMatch(/^[a-f0-9]{64}$/);
      expect(report.inventory).toEqual(REDIS_QUOTA_KEYS(plan().namespace));
      expect(report.inventory).toHaveLength(3);
      expect(new Set(report.workers.map((worker) => worker.pid)).size).toBe(2);
      expect(report.workers.every((worker) => worker.clientCreated)).toBe(true);
      expect(authority.requests.map((request) => request.operation)).toEqual([
        'inventory-preflight', 'publish', 'setEligibility', 'reserve', 'reserve',
        'readUsage', 'exact-cleanup', 'inventory-confirm',
      ]);
      expect(authority.requests.every((request) => JSON.stringify(request.keys) === JSON.stringify(plan().inventory))).toBe(true);
      expect(authority.requests.every((request) => request.keys.length === 3)).toBe(true);
      expect(JSON.stringify(report)).not.toMatch(/FAKE_PHASE_B_ONLY|phase-b-mock\.upstash\.io|Bearer/);
    });
    it('dry-run digest 綁定三鍵、容量門檻及逐分支計量；execute 維持阻擋', () => {
      const p = plan();
      expect(p.inventory).toEqual(REDIS_QUOTA_KEYS(p.namespace));
      expect(p.capacityThresholds).toEqual({
        commands: 400000, bandwidthBytes: 9_000_000_000, storageBytes: 230_000_000,
      });
      expect(p.limits.logicalCommandsMax).toBe(58);
      expect(PHASE_B_LIMITS.restRequestsMax).toBe(8);
      expect(PHASE_B_STORAGE_ENVELOPE).toEqual({
        inventoryKeys: 3, dataBearingKeysMax: 2, registryHashFieldsMax: 4,
        userHashFieldsMax: 1, sessionsWritten: false,
        applicationPayloadBytesMax: 131072,
        cleanupDelCalls: 3, cleanupConfirmExistsCalls: 3, providerStorageBytesUpperBound: null,
      });
      expect(PHASE_B_BRANCH_BOUNDS).toMatchObject({
        preflightUnknownOrNonempty: { restPosts: 1, logicalCommands: 4, writeCalls: 0 },
        registrySeedUnknown: { restPosts: 3, logicalCommands: 21, writeCalls: 1 },
        eligibilitySeedUnknown: { restPosts: 4, logicalCommands: 25, writeCalls: 2 },
        reserveUnknown: { restPosts: 6, logicalCommands: 50, writeCalls: 3 },
        successOrCleanupConfirmation: {
          restPosts: 8, logicalCommands: 58, writeCalls: 6,
          providerCommandsNoReadRegion: 58, providerCommandsOneReadRegion: 64,
          requestBytes: 1_048_576, responseBytes: 262_144,
        },
      });
      expect(p.digest).toMatch(/^[a-f0-9]{64}$/);
      expect(p.inventory).toHaveLength(3);
    });
    it.each(['publish', 'setEligibility'])('seed %s unknown：一次唯讀確認後停止，無 race／清理', async (operation) => {
      const authority = new MockRestAuthority({ faultOperation: operation, fault: 'unknown' });
      const report = await run(authority);
      expect(report.reason).toBe('seed_unknown');
      expect(report.cleanup).toBe('withheld_unresolved');
      expect(report.confirmation).toBe('observed');
      expect(authority.requests.filter((r) => r.operation === operation)).toHaveLength(1);
      expect(authority.requests.map((r) => r.operation)).not.toContain('reserve');
      expect(authority.requests.map((r) => r.operation)).not.toContain('exact-cleanup');
      expect(report.restRequestsUpperBound).toBe(operation === 'publish' ? 3 : 4);
      expect(report.logicalCommandsUpperBound).toBe(operation === 'publish' ? 21 : 25);
    });
    it.each(['publish', 'setEligibility'])('seed %s timeout 不重送／不清理', async (operation) => {
      const authority = new MockRestAuthority({ faultOperation: operation, fault: 'timeout' });
      expect((await run(authority)).reason).toBe('seed_unknown');
      expect(authority.requests.filter((r) => r.operation === operation)).toHaveLength(1);
      expect(authority.requests.map((r) => r.operation)).not.toContain('exact-cleanup');
    });
    it.each(['unknown', 'timeout'] as const)('reserve %s：確認 presence 仍不清理晚到 inventory', async (fault) => {
      const authority = new MockRestAuthority({ faultOperation: 'reserve', fault });
      const report = await run(authority);
      expect(report).toMatchObject({
        reason: 'reserve_unknown', confirmation: 'observed', cleanup: 'withheld_unresolved',
        restRequestsUpperBound: 6, logicalCommandsUpperBound: 50,
      });
      expect(authority.requests.filter((r) => r.operation === 'reserve')).toHaveLength(2);
      expect(authority.requests.filter((r) => r.operation === 'getReservation')).toHaveLength(1);
      expect(authority.requests.map((r) => r.operation)).not.toContain('exact-cleanup');
    });
    it.each(['unknown', 'mismatch'])('reserve 確認 %s 不推論未寫入、不重授權', async (fault) => {
      const authority = new MockRestAuthority({
        loseReserveResponses: true, failConfirmation: fault === 'unknown',
        confirmationMismatch: fault === 'mismatch',
      });
      const report = await run(authority);
      expect(report.confirmation).toBe('unknown');
      expect(report.cleanup).toBe('withheld_unresolved');
      expect(authority.requests.filter((r) => r.operation === 'getReservation')).toHaveLength(1);
      expect(authority.requests).toHaveLength(6);
    });
    it.each(['unknown', 'timeout'] as const)('cleanup %s 只讀 EXISTS 確認，DEL 不重送', async (fault) => {
      const authority = new MockRestAuthority({ faultOperation: 'exact-cleanup', fault });
      expect(await run(authority)).toMatchObject({ status: 'completed', cleanup: 'cleaned' });
      expect(authority.requests.filter((r) => r.operation === 'exact-cleanup')).toHaveLength(1);
      expect(authority.requests.filter((r) => r.operation === 'inventory-confirm')).toHaveLength(1);
    });
    it('cleanup 確認 unknown 停止，不重送 DEL', async () => {
      const authority = new MockRestAuthority({ faultOperation: 'inventory-confirm', fault: 'unknown' });
      expect(await run(authority)).toMatchObject({ reason: 'cleanup_unconfirmed', cleanup: 'withheld_unresolved' });
      expect(authority.requests).toHaveLength(8);
    });
    it.each(['registrySnapshot', 'readQuota', 'getReservation', 'inventory-confirm'])(
      '唯讀 %s timeout 有界停止，無額外確認或異動', async (operation) => {
        const authority = new MockRestAuthority({ faultOperation: operation, fault: 'timeout',
          loseReserveResponses: operation === 'getReservation' });
        const original = authority.fetch;
        const fetch: typeof globalThis.fetch = async (url, init) => {
          const response = await original(url, init);
          const op = authority.requests.at(-1)?.operation;
          if ((operation === 'registrySnapshot' && op === 'publish') ||
              (operation === 'readQuota' && op === 'setEligibility')) return new Response('{}', { status: 503 });
          return response;
        };
        const p = plan();
        const report = await runPhaseB(p, phaseFixture(p.namespace), {
          mode: 'mock', createTransport: createRedisRestTransport, createStore: createRedisSharedStore,
          fetch, readSecrets: async () => ({ url: 'https://phase-b-mock.upstash.io', token: 'FAKE_PHASE_B_ONLY' }),
        });
        expect(report.status).toBe('stopped');
        expect(report.cleanup).toBe('withheld_unresolved');
        expect(authority.requests.filter((r) => r.operation === operation)).toHaveLength(1);
      });
    it.each([32768, 32769])('reserve response bytes=%i 精確驗證 response cap', async (bytes) => {
      const authority = new MockRestAuthority({ responseBytes: bytes, responseOperation: 'reserve' });
      const report = await run(authority);
      expect(report.status).toBe(bytes === 32768 ? 'completed' : 'stopped');
      if (bytes > 32768) expect(report.cleanup).toBe('withheld_unresolved');
      expect(authority.requests.filter((r) => r.operation === 'reserve')).toHaveLength(2);
    });
    it('request 超界在 child reserve 派送前拒絕', async () => {
      const authority = new MockRestAuthority(), p = plan();
      const fixture = phaseFixture(p.namespace);
      fixture.command = { ...fixture.command, ...{ localPadding: 'x'.repeat(131072) } };
      expect(await runPhaseB(p, fixture, {
        mode: 'mock', createTransport: createRedisRestTransport, createStore: createRedisSharedStore,
        fetch: authority.fetch, readSecrets: async () => ({ url: 'https://phase-b-mock.upstash.io', token: 'FAKE_PHASE_B_ONLY' }),
      })).toMatchObject({ reason: 'request_limit_before_dispatch', restRequestsUpperBound: 3 });
      expect(authority.requests).toHaveLength(3);
    });
    it.each([131071, 131072, 131073])('reserve wire bytes=%i 精確驗證 request cap', async (bytes) => {
      const authority = new MockRestAuthority(), p = plan(), fixture = phaseFixture(p.namespace);
      const padded = { ...fixture.command, localPadding: '' };
      const wire = () => JSON.stringify(['EVAL', REDIS_QUOTA_LUA, fixture.keys.length, ...fixture.keys,
        JSON.stringify({ operation: 'reserve', command: padded, digests: fixture.digests,
          rejectLegacy: false })]);
      padded.localPadding = 'x'.repeat(bytes - Buffer.byteLength(wire()));
      expect(Buffer.byteLength(wire())).toBe(bytes);
      fixture.command = padded;
      const report = await runPhaseB(p, fixture, {
        mode: 'mock', createTransport: createRedisRestTransport, createStore: createRedisSharedStore,
        fetch: authority.fetch, readSecrets: async () => ({ url: 'https://phase-b-mock.upstash.io', token: 'FAKE_PHASE_B_ONLY' }),
      });
      expect(report.status).toBe(bytes <= 131072 ? 'completed' : 'stopped');
      expect(authority.reserveBodyBytes).toEqual(bytes <= 131072 ? [bytes, bytes] : []);
      if (bytes > 131072) expect(report.cleanup).toBe('withheld_unresolved');
    });
    it('barrier 後重查中斷，零 reserve 派送', async () => {
      const authority = new MockRestAuthority(), stop = new AbortController();
      const report = await run(authority, { stopSignal: stop.signal, onBarrier: () => stop.abort() });
      expect(report.reason).toBe('interrupted_before_dispatch');
      expect(authority.requests).toHaveLength(3);
    });
    it('barrier 後重查 worker 死亡，零 reserve 派送', async () => {
      const authority = new MockRestAuthority();
      const report = await run(authority, { onBarrier: async (children) => {
        const exited = new Promise((resolve) => children[0].once('exit', resolve));
        children[0].kill(); await exited;
      } });
      expect(report.reason).toBe('worker_failure');
      expect(authority.requests).toHaveLength(3);
    });
    it('barrier 後重查剩餘時間，零 reserve 派送', async () => {
      const authority = new MockRestAuthority();
      let clock = 0;
      const report = await run(authority, { now: () => clock, onBarrier: () => { clock = 19000; } });
      expect(report.reason).toBe('deadline_before_dispatch');
      expect(authority.requests).toHaveLength(3);
    });
    it.each([7999, 8000, 8001])('barrier 後時間預留門檻 remaining=%i ms', async (remaining) => {
      const authority = new MockRestAuthority();
      let clock = 0;
      const report = await run(authority, { now: () => clock,
        onBarrier: () => { clock = 20000 - remaining; } });
      expect(report.reason).toBe(remaining <= 8000 ? 'deadline_before_dispatch' : 'finished');
      expect(authority.requests.filter((r) => r.operation === 'reserve')).toHaveLength(remaining <= 8000 ? 0 : 2);
    });
    it('已中斷時不讀秘密、不建立 transport 或 worker', async () => {
      const stop = new AbortController(); stop.abort();
      const readSecrets = vi.fn(), p = plan(), createTransport = vi.fn();
      expect(await runPhaseB(p, phaseFixture(p.namespace), {
        mode: 'mock', createTransport, createStore: createRedisSharedStore,
        fetch: vi.fn(), readSecrets,
      }, { stopSignal: stop.signal })).toMatchObject({ reason: 'interrupted_before_secrets', restRequestsUpperBound: 0 });
      expect(readSecrets).not.toHaveBeenCalled();
      expect(createTransport).not.toHaveBeenCalled();
      expect(await runPhaseB(p, phaseFixture(p.namespace), {
        mode: 'external', createTransport, createStore: createRedisSharedStore,
        fetch: vi.fn(), readSecrets,
      }, { currentConditions: phaseBConditions })).toMatchObject({
        reason: 'one_time_execution_lock_required', restRequestsUpperBound: 0,
      });
      expect(readSecrets).not.toHaveBeenCalled();
    });
    it('派送後 graceful stop 等待 terminal responses，但不清理', async () => {
      const authority = new MockRestAuthority(), stop = new AbortController();
      expect(await run(authority, { stopSignal: stop.signal, onDispatched: () => stop.abort() }))
        .toMatchObject({ reason: 'interrupted_after_dispatch', cleanup: 'withheld_unresolved' });
      expect(authority.requests).toHaveLength(5);
    });
    it('第二階段強制 abort 不追加確認或清理、不重送', async () => {
      const authority = new MockRestAuthority(), abort = new AbortController();
      expect(await run(authority, { abortSignal: abort.signal, onDispatched: () => abort.abort() }))
        .toMatchObject({ reason: 'aborted_after_dispatch', cleanup: 'withheld_unresolved',
          confirmation: 'unknown', restRequestsUpperBound: 5 });
      expect(authority.requests.map((r) => r.operation)).not.toContain('getReservation');
      expect(authority.requests.map((r) => r.operation)).not.toContain('exact-cleanup');
    });
    it('派送後 worker crash 有界退出，只允許一次唯讀確認', async () => {
      const authority = new MockRestAuthority();
      const report = await run(authority, { onDispatched: async (children) => {
        const exited = new Promise((resolve) => children[0].once('exit', resolve));
        children[0].kill(); await exited;
      } });
      expect(report.reason).toBe('reserve_unknown');
      expect(report.cleanup).toBe('withheld_unresolved');
      expect(authority.requests.filter((r) => r.operation === 'getReservation')).toHaveLength(1);
    });
    it('external gate 在讀秘密／transport／spawn 前拒絕，CLI execute 同樣拒絕', async () => {
      const readSecrets = vi.fn(), createTransport = vi.fn();
      const p = plan();
      expect(await runPhaseB(p, phaseFixture(p.namespace), {
        mode: 'external', createTransport, createStore: createRedisSharedStore, fetch: vi.fn(), readSecrets,
      })).toMatchObject({
        reason: 'current_external_conditions_missing_or_over_limit', restRequestsUpperBound: 0,
      });
      expect(readSecrets).not.toHaveBeenCalled();
      expect(createTransport).not.toHaveBeenCalled();
    });
    it('竄改 limits／inventory fail closed，不取得秘密', async () => {
      const p = plan(), readSecrets = vi.fn();
      await expect(runPhaseB({ ...p, limits: { ...p.limits, restRequestsMax: 9 } },
        phaseFixture(p.namespace), {
          mode: 'mock', createTransport: createRedisRestTransport, createStore: createRedisSharedStore,
          fetch: vi.fn(), readSecrets,
        })).rejects.toThrow('PHASE_B_PLAN_INVALID');
      expect(readSecrets).not.toHaveBeenCalled();
    });
  });

  describe('Phase B 固定計畫與條件式 execute CLI', () => {
    it('dry-run 重用保存計畫；任何 script／操作限制變更均不通過 digest 驗證', async () => {
      const directory = mkdtempSync(join(tmpdir(), 'tokyo-mate-phase-b-'));
      const planPath = join(directory, 'plan.json');
      try {
        const first: string[] = [];
        const second: string[] = [];
        expect(await phaseBMain([`--plan-file=${planPath}`], { write: (value) => first.push(value) })).toBe(0);
        expect(await phaseBMain([`--plan-file=${planPath}`], { write: (value) => second.push(value) })).toBe(0);
        const original = validatePhaseBPlan(JSON.parse(readFileSync(planPath, 'utf8')));
        const firstOutput = JSON.parse(first[0]) as Record<string, unknown>;
        const repeated = JSON.parse(second[0]) as Record<string, unknown>;
        expect(repeated).toEqual(firstOutput);
        expect(repeated).toMatchObject({ ...original, mode: 'dry-run', secretsRead: false, networkDispatched: 0 });
        expect(original.inventory).toEqual(REDIS_QUOTA_KEYS(original.namespace));
        expect(original.digest).toMatch(/^[a-f0-9]{64}$/);
        expect(() => validatePhaseBPlan({ ...original,
          limits: { ...original.limits, logicalCommandsMax: 59 } })).toThrow('PHASE_B_PLAN_INVALID');
        expect(() => validatePhaseBPlan({ ...original,
          scripts: { ...original.scripts, preflight: 'return 0' } })).toThrow('PHASE_B_PLAN_INVALID');
        expect(() => validatePhaseBPlan({ ...original,
          operationSources: { ...original.operationSources, 'api/_lib/redis-quota-script.ts': '0'.repeat(64) },
        })).toThrow('PHASE_B_PLAN_INVALID');
        expect(() => validatePhaseBPlan({ ...original,
          branchBounds: { ...original.branchBounds, successOrCleanupConfirmation: {
            ...original.branchBounds.successOrCleanupConfirmation, logicalCommands: 57,
          } } })).toThrow('PHASE_B_PLAN_INVALID');
      } finally { rmSync(directory, { recursive: true, force: true }); }
    });

    it('digest 錯誤或當次條件未齊時，不讀秘密、不派送且不消耗一次性入口', async () => {
      const directory = mkdtempSync(join(tmpdir(), 'tokyo-mate-phase-b-'));
      const planPath = join(directory, 'plan.json');
      const executionPath = join(directory, 'execution.json');
      try {
        const dryRun: string[] = [];
        await phaseBMain([`--plan-file=${planPath}`], { write: (value) => dryRun.push(value) });
        const plan = JSON.parse(dryRun[0]) as ReturnType<typeof createPhaseBPlan>;
        const readCurrentConditions = vi.fn(() => phaseBConditions);
        const readSecrets = vi.fn(async () => ({ url: 'should-not-be-read', token: 'should-not-be-read' }));
        const execute = vi.fn();
        const errors: string[] = [];
        expect(await phaseBMain(['--execute', `--plan-digest=${'0'.repeat(64)}`,
          `--plan-file=${planPath}`], {
          executionPath, readCurrentConditions, readSecrets, execute, writeError: (value) => errors.push(value),
        })).toBe(2);
        expect(errors).toContain('PHASE_B_PLAN_DIGEST_MISMATCH');
        expect(readCurrentConditions).not.toHaveBeenCalled();

        const stoppedConditions = { ...phaseBConditions, noReadRegions: false };
        const stopped: string[] = [];
        expect(await phaseBMain(['--execute', `--plan-digest=${plan.digest}`,
          `--plan-file=${planPath}`], {
          executionPath, readCurrentConditions: () => stoppedConditions, readSecrets, execute,
          write: (value) => stopped.push(value),
        })).toBe(1);
        expect(JSON.parse(stopped[0])).toMatchObject({
          reason: 'current_external_conditions_missing_or_over_limit',
          secretsRead: false, networkDispatched: 0,
        });
        expect(readSecrets).not.toHaveBeenCalled();
        expect(execute).not.toHaveBeenCalled();
        expect(() => readFileSync(executionPath)).toThrow();
      } finally { rmSync(directory, { recursive: true, force: true }); }
    });

    it('通過當次條件後只開放一次 execute；再次執行同計畫 fail closed', async () => {
      const directory = mkdtempSync(join(tmpdir(), 'tokyo-mate-phase-b-'));
      const planPath = join(directory, 'plan.json');
      const executionPath = join(directory, 'execution.json');
      try {
        const dryRun: string[] = [];
        await phaseBMain([`--plan-file=${planPath}`], { write: (value) => dryRun.push(value) });
        const plan = JSON.parse(dryRun[0]) as ReturnType<typeof createPhaseBPlan>;
        expect(validatePhaseBConditions(phaseBConditions)).toBe(true);
        expect(validatePhaseBConditions({ ...phaseBConditions,
          commands: { ...phaseBConditions.commands, value: 400001 } })).toBe(false);
        const report = { scope: plan.scope, status: 'completed', digest: plan.digest };
        const execute = vi.fn(async (_plan: PhaseBPlan, _conditions: PhaseBConditions,
          _readSecrets: () => Promise<{ url: string; token: string }>, onFirstDispatch: () => void) => {
          onFirstDispatch();
          return report as PhaseBReport;
        });
        const readSecrets = vi.fn(async () => ({ url: 'not persisted', token: 'not persisted' }));
        const output: string[] = [];
        const args = ['--execute', `--plan-digest=${plan.digest}`, `--plan-file=${planPath}`];
        expect(await phaseBMain(args, {
          executionPath, readCurrentConditions: () => phaseBConditions, readSecrets, execute,
          write: (value) => output.push(value),
        })).toBe(0);
        expect(execute).toHaveBeenCalledOnce();
        expect(readSecrets).not.toHaveBeenCalled();
        expect(readFileSync(executionPath, 'utf8')).toContain(plan.digest);
        const errors: string[] = [];
        expect(await phaseBMain(args, {
          executionPath, readCurrentConditions: () => phaseBConditions, readSecrets, execute,
          writeError: (value) => errors.push(value),
        })).toBe(1);
        expect(errors).toContain('PHASE_B_EXECUTION_ALREADY_ATTEMPTED');
        expect(execute).toHaveBeenCalledOnce();
      } finally { rmSync(directory, { recursive: true, force: true }); }
    });
  });

  it('兩個 reserve 回應 unknown 時，每個最多確認一次；確認仍 unknown 即停止且不 cleanup', async () => {
    const fixture = phaseFixture('{preview-phasebtest000002}');
    const authority = new MockRestAuthority({ loseReserveResponses: true, failConfirmation: true });
    await seed(authority, fixture);

    const results = await executeRace(fixture, authority);
    expect(results.map(({ status }) => status)).toEqual(['unknown', 'unknown']);
    await expect(postEval(authority, REDIS_QUOTA_LUA, fixture.keys, JSON.stringify({
      operation: 'getReservation',
      command: { identitySubject: fixture.subject, reservationId: fixture.command.reservationId },
      digests: fixture.digests,
      rejectLegacy: false,
    }))).rejects.toThrow('PHASE_B_MOCK_REST_UNKNOWN');

    expect(authority.requests.filter(({ operation }) => operation === 'reserve')).toHaveLength(2);
    expect(authority.requests.filter(({ operation }) => operation === 'getReservation')).toHaveLength(1);
    expect(authority.requests.some(({ operation }) => operation === 'exact-cleanup')).toBe(false);
    expect(authority.requests.every(({ operation }) =>
      ['inventory-preflight', 'publish', 'setEligibility', 'reserve', 'getReservation'].includes(operation))).toBe(true);
  });
});
