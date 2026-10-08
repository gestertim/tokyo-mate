import { fork } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promptCredentials } from './005-redis-calibration.mjs';

export const PHASE_B_LIMITS = Object.freeze({
  restRequestsMax: 8, logicalCommandsMax: 58, operationTimeoutMs: 2000,
  windowMs: 20000, workerReadyMs: 3000, confirmationReserveMs: 2000,
  cleanupReserveMs: 4000, maxRequestBytes: 131072, maxResponseBytes: 32768,
});
export const PHASE_B_CAPACITY_THRESHOLDS = Object.freeze({
  commands: 400000, bandwidthBytes: 9_000_000_000, storageBytes: 230_000_000,
});
const inventorySuffixes = ['registry', 'users', 'sessions'];
const branch = (restPosts, logicalCommands, writeCalls) => Object.freeze({
  restPosts, logicalCommands, writeCalls,
  providerCommandsNoReadRegion: logicalCommands,
  providerCommandsOneReadRegion: logicalCommands + writeCalls,
  requestBytes: restPosts * PHASE_B_LIMITS.maxRequestBytes,
  responseBytes: restPosts * PHASE_B_LIMITS.maxResponseBytes,
});
export const PHASE_B_BRANCH_BOUNDS = Object.freeze({
  gateOrSecretFailure: branch(0, 0, 0),
  preflightUnknownOrNonempty: branch(1, 4, 0),
  registrySeedUnknown: branch(3, 21, 1),
  eligibilitySeedUnknown: branch(4, 25, 2),
  postSeedWorkerOrDeadlineStop: branch(3, 19, 2),
  reserveUnknown: branch(6, 50, 3),
  terminalContradictionOrAbort: branch(5, 44, 3),
  usageUnknownOrPreCleanupStop: branch(6, 50, 3),
  successOrCleanupConfirmation: branch(8, 58, 6),
  cleanupUnconfirmed: branch(8, 58, 6),
});
export const PHASE_B_STORAGE_ENVELOPE = Object.freeze({
  inventoryKeys: 3, dataBearingKeysMax: 2, registryHashFieldsMax: 4,
  userHashFieldsMax: 1, sessionsWritten: false,
  applicationPayloadBytesMax: 131072,
  cleanupDelCalls: 3, cleanupConfirmExistsCalls: 3, providerStorageBytesUpperBound: null,
});
const digest = (value) => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
export const PHASE_B_SCRIPTS = Object.freeze({
  preflight: "for _,key in ipairs(KEYS) do if redis.call('EXISTS',key)~=0 then return 1 end end return 0",
  cleanup: "local count=0 for _,key in ipairs(KEYS) do count=count+redis.call('DEL',key) end return count",
  confirm: "local count=0 for _,key in ipairs(KEYS) do count=count+redis.call('EXISTS',key) end return count",
});
const PHASE_B_OPERATION_SOURCES = Object.freeze([
  ['scripts/005-phase-b-caller.mjs', new URL('./005-phase-b-caller.mjs', import.meta.url)],
  ['scripts/005-phase-b-worker.mjs', new URL('./005-phase-b-worker.mjs', import.meta.url)],
  ['scripts/005-phase-b-runtime.mjs', new URL('./005-phase-b-runtime.mjs', import.meta.url)],
  ['api/_lib/redis-quota-script.ts', new URL('../api/_lib/redis-quota-script.ts', import.meta.url)],
  ['api/_lib/redis-shared-store.ts', new URL('../api/_lib/redis-shared-store.ts', import.meta.url)],
  ['api/_lib/redis-rest-transport.ts', new URL('../api/_lib/redis-rest-transport.ts', import.meta.url)],
  ['api/_lib/redis-atomic-transport.ts', new URL('../api/_lib/redis-atomic-transport.ts', import.meta.url)],
  ['api/_lib/cost-registry.ts', new URL('../api/_lib/cost-registry.ts', import.meta.url)],
  ['api/_lib/cost-price-table.ts', new URL('../api/_lib/cost-price-table.ts', import.meta.url)],
  ['api/_lib/cost-estimators.ts', new URL('../api/_lib/cost-estimators.ts', import.meta.url)],
  ['api/_lib/quota-estimate-inputs.ts', new URL('../api/_lib/quota-estimate-inputs.ts', import.meta.url)],
  ['api/_lib/quota-fingerprint.ts', new URL('../api/_lib/quota-fingerprint.ts', import.meta.url)],
  ['api/_lib/quota-window.ts', new URL('../api/_lib/quota-window.ts', import.meta.url)],
  ['api/_lib/request-epoch-authority.ts', new URL('../api/_lib/request-epoch-authority.ts', import.meta.url)],
  ['api/_lib/shared-store.ts', new URL('../api/_lib/shared-store.ts', import.meta.url)],
  ['api/_lib/bounded-request.ts', new URL('../api/_lib/bounded-request.ts', import.meta.url)],
  ['tests/fixtures/cost-price-fixtures.ts', new URL('../tests/fixtures/cost-price-fixtures.ts', import.meta.url)],
  ['tests/fixtures/cost-registry-fixtures.ts', new URL('../tests/fixtures/cost-registry-fixtures.ts', import.meta.url)],
  ['tests/fixtures/quota-fingerprint-fixtures.ts', new URL('../tests/fixtures/quota-fingerprint-fixtures.ts', import.meta.url)],
]);
const phaseBOperationSources = Object.freeze(Object.fromEntries(
  PHASE_B_OPERATION_SOURCES.map(([path, url]) =>
    [path, createHash('sha256').update(readFileSync(url)).digest('hex')]),
));
export function createPhaseBPlan(id = randomBytes(12).toString('base64url')) {
  if (!/^[A-Za-z0-9_-]{16}$/.test(id)) throw new Error('PHASE_B_PLAN_INVALID');
  const namespace = `{preview-${id}}`;
  const plan = {
    version: 2,
    scope: 'TEST_ONLY_PHASE_B',
    namespace,
    inventory: Object.freeze(inventorySuffixes.map((suffix) => `${namespace}:${suffix}`)),
    limits: PHASE_B_LIMITS,
    capacityThresholds: PHASE_B_CAPACITY_THRESHOLDS,
    scripts: PHASE_B_SCRIPTS,
    operationSources: phaseBOperationSources,
    branchBounds: PHASE_B_BRANCH_BOUNDS,
    storageEnvelope: PHASE_B_STORAGE_ENVELOPE,
    providerRules: 'operator_response_received',
    providerMetering: 'unverified',
    usageObservation: 'manual_source_timestamp_timezone_stale_capable',
    billableUpperBound: null,
  };
  return Object.freeze({ ...plan, digest: digest(plan) });
}

export function validatePhaseBPlan(value) {
  if (!value || typeof value !== 'object' || typeof value.namespace !== 'string') {
    throw new Error('PHASE_B_PLAN_INVALID');
  }
  const id = /^\{preview-([A-Za-z0-9_-]{16})\}$/.exec(value.namespace)?.[1];
  if (!id) throw new Error('PHASE_B_PLAN_INVALID');
  const expected = createPhaseBPlan(id);
  if (JSON.stringify(value) !== JSON.stringify(expected)) throw new Error('PHASE_B_PLAN_INVALID');
  return expected;
}

const validUsageObservation = (value) => value && typeof value === 'object' &&
  typeof value.source === 'string' && value.source.trim().length > 0 && value.source.length <= 256 &&
  typeof value.observedAt === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value.observedAt) &&
  Number.isFinite(Date.parse(value.observedAt)) &&
  Number.isSafeInteger(value.value) && value.value >= 0;

export function validatePhaseBConditions(value) {
  return Boolean(value && typeof value === 'object' &&
    value.noReadRegions === true && value.noPaymentMethod === true &&
    value.noOtherWorkloadsOrWriters === true &&
    validUsageObservation(value.commands) && value.commands.value <= PHASE_B_CAPACITY_THRESHOLDS.commands &&
    validUsageObservation(value.bandwidthBytes) &&
      value.bandwidthBytes.value <= PHASE_B_CAPACITY_THRESHOLDS.bandwidthBytes &&
    validUsageObservation(value.storageBytes) &&
      value.storageBytes.value <= PHASE_B_CAPACITY_THRESHOLDS.storageBytes);
}

async function bounded(work, ms, signal) {
  if (ms <= 0 || signal?.aborted) return { known: false };
  let timer, onAbort;
  const controller = new AbortController();
  try {
    return await Promise.race([
      Promise.resolve().then(() => work(controller.signal)).then(
        (value) => ({ known: true, value }), () => ({ known: false })),
      new Promise((resolve) => {
        const stop = () => { controller.abort(); resolve({ known: false }); };
        timer = setTimeout(stop, ms);
        onAbort = stop;
        signal?.addEventListener('abort', stop, { once: true });
        if (signal?.aborted) stop();
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    controller.abort();
  }
}

function startWorker(slot, input, mockFetch) {
  const child = fork(new URL('./005-phase-b-worker.mjs', import.meta.url), [], {
    execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.fromEntries(['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP']
      .filter((key) => typeof process.env[key] === 'string').map((key) => [key, process.env[key]])),
  });
  let dead = false, readyDone, resultDone;
  const ready = new Promise((resolve) => { readyDone = resolve; });
  const result = new Promise((resolve) => { resultDone = resolve; });
  const fail = () => { dead = true; readyDone(null); resultDone(null); };
  child.on('error', fail);
  child.on('exit', fail);
  const send = (message) => {
    if (dead || !child.connected) { fail(); return false; }
    child.send(message, (error) => { if (error) fail(); });
    return true;
  };
  let mockRequested = false;
  child.on('message', (message) => {
    if (message?.slot !== slot) { fail(); child.kill(); return; }
    if (message.type === 'ready' && message.pid === child.pid) readyDone(message);
    else if (message.type === 'result' && message.pid === child.pid &&
        ['reserved', 'duplicate', 'unknown'].includes(message.status)) resultDone(message);
    else if (message.type === 'mock-request' && input.mode === 'mock' && !mockRequested &&
        typeof message.body === 'string' && Buffer.byteLength(message.body) <= input.maxRequestBytes) {
      mockRequested = true;
      void bounded(async (signal) => {
        const response = await mockFetch('https://phase-b-mock.upstash.io', {
          method: 'POST', body: message.body, signal,
        });
        // 此橋接僅限本機替身，response 同樣先有界再交給 child REST reader。
        const reader = response.body?.getReader();
        if (!reader) throw new Error('PHASE_B_MOCK_UNKNOWN');
        const cancel = () => { void reader.cancel().catch(() => { fail(); child.kill(); }); };
        signal.addEventListener('abort', cancel, { once: true });
        let bytes = 0;
        const chunks = [];
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > input.maxResponseBytes) {
              await reader.cancel(); throw new Error('PHASE_B_MOCK_RESPONSE_LIMIT');
            }
            chunks.push(Buffer.from(chunk.value));
          }
        } finally {
          signal.removeEventListener('abort', cancel);
          reader.releaseLock();
        }
        return { status: response.status, body: Buffer.concat(chunks).toString('utf8') };
      }, input.timeoutMs).then((outcome) => {
        if (!dead && child.connected) send({ type: 'mock-response', slot,
          ...(outcome.known ? outcome.value : { status: 503, body: '{}' }) });
      });
    } else { fail(); child.kill(); }
  });
  send({ type: 'init', slot, ...input });
  return { child, ready, result, send,
    alive: () => !dead && child.connected && child.exitCode === null && child.signalCode === null,
    async stop() {
      if (dead) return;
      const exit = new Promise((resolve) => child.once('exit', resolve));
      child.kill();
      await bounded(() => exit, 250);
      if (!dead) { child.kill('SIGKILL'); await bounded(() => exit, 250); }
      fail();
    },
  };
}

export async function runPhaseB(plan, fixture, ports, control = {}) {
  plan = validatePhaseBPlan(plan);
  const report = {
    scope: plan.scope, evidence: ports?.mode === 'mock' ? 'local_child_rest_transport_mock' : 'not_executed',
    status: 'stopped',
    reason: 'external_gate_blocked', providerRules: 'operator_response_received',
    providerMetering: 'unverified', billableUpperBound: null, digest: plan.digest,
    restRequestsUpperBound: 0, logicalCommandsUpperBound: 0,
    inventory: [...plan.inventory], cleanup: 'not_dispatched', confirmation: 'not_dispatched',
    workers: [], manualFollowUp: false,
  };
  if (ports?.mode !== 'mock' && ports?.mode !== 'external') return report;
  if (ports.mode === 'external') {
    if (!validatePhaseBConditions(control.currentConditions)) {
      report.reason = 'current_external_conditions_missing_or_over_limit';
      return report;
    }
    if (typeof control.onFirstDispatch !== 'function') {
      report.reason = 'one_time_execution_lock_required';
      return report;
    }
  }
  if (!fixture ||
      JSON.stringify(fixture.keys) !== JSON.stringify(plan.inventory) ||
      fixture.command?.identitySubject !== 'phase-b-synthetic-subject' ||
      fixture.command?.idempotencyKey !== 'phase-b-synthetic-operation' ||
      fixture.command?.reservationId !== 'phase-b-synthetic-reservation' ||
      fixture.command.endpoint !== 'assistant' || fixture.command.amountMicroUsd !== 2400 ||
      fixture.command.leaseMs !== 60000 ||
      Object.hasOwn(fixture, 'floor') || Object.hasOwn(fixture.command, 'requestEpoch') ||
      !['createTransport', 'createStore', 'fetch', 'readSecrets'].every((key) => typeof ports[key] === 'function'))
    throw new Error('PHASE_B_LOCAL_INPUT_INVALID');
  fixture = structuredClone(fixture);
  const limits = plan.limits;
  const clock = control.now ?? (() => performance.now());
  const deadline = clock() + limits.windowMs;
  const remaining = () => deadline - clock();
  const stop = () => control.stopSignal?.aborted || control.abortSignal?.aborted;
  let workers = [], secrets;
  let executionLockWritten = false;
  const dispatched = new Set();
  const charge = (name, logical) => {
    if (dispatched.has(name) || report.restRequestsUpperBound >= limits.restRequestsMax ||
        report.logicalCommandsUpperBound + logical > limits.logicalCommandsMax)
      throw new Error('PHASE_B_DISPATCH_LIMIT');
    dispatched.add(name);
    report.restRequestsUpperBound++;
    report.logicalCommandsUpperBound += logical;
  };
  const call = async (name, logical, work, readonly = false) => {
    if (remaining() <= 0 || control.abortSignal?.aborted || (!readonly && stop())) return { known: false };
    if (ports.mode === 'external' && !executionLockWritten) {
      try {
        await control.onFirstDispatch();
        executionLockWritten = true;
      } catch {
        throw new Error('PHASE_B_EXECUTION_STATE_LOCK_FAILED');
      }
    }
    charge(name, logical);
    if (ports.mode === 'external') report.evidence = 'external_bounded_phase_b';
    return bounded(work, Math.min(limits.operationTimeoutMs, remaining()), control.abortSignal);
  };
  const retained = (reason) => {
    report.reason = reason; report.cleanup = 'withheld_unresolved'; report.manualFollowUp = true;
  };
  try {
    if (stop()) { report.reason = 'interrupted_before_secrets'; return report; }
    const secretResult = await bounded(() => ports.readSecrets(), Math.min(remaining(), limits.operationTimeoutMs),
      control.abortSignal);
    if (!secretResult.known || stop()) { report.reason = 'secret_or_interrupt'; return report; }
    secrets = secretResult.value;
    const validMockCredentials = secrets?.url === 'https://phase-b-mock.upstash.io' &&
      secrets?.token === 'FAKE_PHASE_B_ONLY';
    let validExternalCredentials = false;
    if (ports.mode === 'external' && typeof secrets?.url === 'string' &&
        typeof secrets?.token === 'string' && secrets.url.length <= 2048 &&
        secrets.token.length > 0 && secrets.token.length <= 4096 &&
        /^[\x21-\x7e]+$/.test(secrets.token)) {
      try {
        const url = new URL(secrets.url);
        validExternalCredentials = url.protocol === 'https:' &&
          /^[a-z0-9-]+\.upstash\.io$/.test(url.hostname) && !url.port &&
          !url.username && !url.password && !url.search && !url.hash && url.pathname === '/';
      } catch { validExternalCredentials = false; }
    }
    if ((ports.mode === 'mock' && !validMockCredentials) ||
        (ports.mode === 'external' && !validExternalCredentials)) {
      report.reason = 'secret_invalid'; return report;
    }
    const base = ports.createTransport({
      ...secrets, fetch: ports.fetch, timeoutMs: limits.operationTimeoutMs,
      maxResponseBytes: limits.maxResponseBytes,
    });
    const transport = { eval(script, keys, argumentsJson) {
      if (remaining() <= 0 || control.abortSignal?.aborted ||
          JSON.stringify(keys) !== JSON.stringify(plan.inventory) ||
          Buffer.byteLength(JSON.stringify(['EVAL', script, keys.length, ...keys, argumentsJson])) >
            limits.maxRequestBytes) throw new Error('PHASE_B_REQUEST_LIMIT');
      return base.eval(script, keys, argumentsJson);
    } };
    const store = ports.createStore({
      namespace: plan.namespace, transport, timeoutMs: limits.operationTimeoutMs, audit() {},
    });
    const preflight = await call('preflight', 4, () => transport.eval(PHASE_B_SCRIPTS.preflight, plan.inventory, '{}'));
    if (!preflight.known || preflight.value !== 0) { report.reason = 'inventory_not_empty_or_unknown'; return report; }
    const published = await call('publish', 8, () => store.publishRegistry(fixture.bundle));
    if (!published.known) {
      const confirm = await call('seed-confirm', 9, () => store.snapshot(), true);
      report.confirmation = confirm.known && confirm.value?.bundleDigest === fixture.bundle.bundleDigest
        ? 'observed' : 'unknown';
      retained('seed_unknown'); return report;
    }
    const eligible = await call('eligibility', 7, () => store.setEligibility({
      identitySubject: fixture.subject, status: 'approved', tier: 'tier1', expiresAt: null,
    }));
    if (!eligible.known) {
      const c = fixture.command;
      const confirm = await call('seed-confirm', 6, () =>
        store.readQuota(fixture.subject, c.day, c.week, c.tierLimits, c.nowIso), true);
      report.confirmation = confirm.known && confirm.value?.status === 'ok' ? 'observed' : 'unknown';
      retained('seed_unknown'); return report;
    }
    if (stop()) { retained('interrupted_before_dispatch'); return report; }
    if (Buffer.byteLength(JSON.stringify({ command: fixture.command, keys: plan.inventory })) >
        limits.maxRequestBytes) {
      retained('request_limit_before_dispatch'); return report;
    }
    workers = [0, 1].map((slot) => startWorker(slot, {
      mode: ports.mode, namespace: plan.namespace, keys: plan.inventory,
      command: fixture.command, timeoutMs: limits.operationTimeoutMs,
      maxRequestBytes: limits.maxRequestBytes, maxResponseBytes: limits.maxResponseBytes,
    }, ports.fetch));
    const barrier = await bounded(() => Promise.all(workers.map((worker) => worker.ready)),
      Math.min(limits.workerReadyMs, remaining()), control.abortSignal);
    await control.onBarrier?.(workers.map(({ child }) => child));
    if (stop()) { retained('interrupted_before_dispatch'); return report; }
    if (!barrier.known || barrier.value.some((ready) => !ready) || workers.some((worker) => !worker.alive())) {
      retained('worker_failure'); return report;
    }
    if (remaining() <= limits.operationTimeoutMs + limits.confirmationReserveMs + limits.cleanupReserveMs) {
      retained('deadline_before_dispatch'); return report;
    }
    // barrier 後重新核對；兩 writer 的派送額度在 private IPC go 之前一起預留。
    charge('reserve-0', 13); charge('reserve-1', 12);
    workers.forEach((worker, slot) => worker.send({
      type: 'dispatch', slot, credentials: secrets,
      remainingMs: Math.floor(Math.min(limits.operationTimeoutMs, remaining())),
    }));
    secrets = undefined;
    await control.onDispatched?.(workers.map(({ child }) => child));
    const race = await bounded(() => Promise.all(workers.map((worker) => worker.result)),
      Math.min(limits.operationTimeoutMs + 500, remaining() - limits.confirmationReserveMs -
        limits.cleanupReserveMs), control.abortSignal);
    await Promise.all(workers.map((worker) => worker.stop()));
    const results = race.known ? race.value : [null, null];
    report.workers = results.filter(Boolean).map(({ slot, pid, status, executionGrant, clientCreated }) =>
      ({ slot, pid, status, executionGrant, clientCreated }));
    if (results.some((result) => !result || result.status === 'unknown')) {
      const confirm = await call('reserve-confirm', 6, () =>
        store.getReservation(fixture.subject, fixture.command.reservationId), true);
      const r = confirm.value, c = fixture.command;
      report.confirmation = confirm.known && r?.identitySubject === fixture.subject &&
        r.reservationId === c.reservationId && r.idempotencyKey === c.idempotencyKey &&
        r.requestFingerprint === c.requestFingerprint && r.estimatedCostUpperBoundUsdMicro === c.amountMicroUsd &&
        r.dayWindowKey === c.day.windowKey && r.weekWindowKey === c.week.windowKey &&
        r.executionGranted === true ? 'observed' : 'unknown';
      retained(control.abortSignal?.aborted ? 'aborted_after_dispatch' : 'reserve_unknown'); return report;
    }
    if (stop()) { retained('interrupted_after_dispatch'); return report; }
    if (new Set(results.map((r) => r.pid)).size !== 2 ||
        results.filter((r) => r.status === 'reserved' && r.executionGrant === true).length !== 1 ||
        results.filter((r) => r.status === 'duplicate' && r.executionGrant === false).length !== 1) {
      retained('race_contradiction'); return report;
    }
    const c = fixture.command;
    const usage = await call('usage', 6, () =>
      store.readUsage(fixture.subject, c.day.windowKey, c.week.windowKey), true);
    if (!usage.known || usage.value?.day?.reservedMicroUsd !== c.amountMicroUsd ||
        usage.value?.week?.reservedMicroUsd !== c.amountMicroUsd) {
      retained('usage_unknown_or_contradiction'); return report;
    }
    if (stop() || remaining() <= limits.operationTimeoutMs * 2) {
      retained('interrupted_or_deadline_before_cleanup'); return report;
    }
    const cleanup = await call('cleanup', 4, () => transport.eval(PHASE_B_SCRIPTS.cleanup, plan.inventory, '{}'));
    if (!cleanup.known || !Number.isSafeInteger(cleanup.value) || cleanup.value < 0 || cleanup.value > 3)
      report.cleanup = 'unknown';
    const confirm = await call('cleanup-confirm', 4, () => transport.eval(PHASE_B_SCRIPTS.confirm, plan.inventory, '{}'), true);
    if (!confirm.known || confirm.value !== 0) {
      retained('cleanup_unconfirmed'); return report;
    }
    report.cleanup = 'cleaned'; report.status = 'completed'; report.reason = 'finished';
    return report;
  } catch (error) {
    if (error?.message === 'PHASE_B_EXECUTION_STATE_LOCK_FAILED') {
      report.reason = 'execution_state_lock_failed';
      return report;
    }
    retained('local_boundary_failure');
    return report;
  } finally {
    secrets = undefined;
    await Promise.all(workers.map((worker) => worker.stop()));
  }
}

// 安全來源／無回顯 TTY port；秘密不經 argv、env 或檔案。
export const phaseBSecretSource = () => promptCredentials();
const defaultPlanPath = fileURLToPath(new URL('../.specify/phase-b-plan-v5.json', import.meta.url));
const defaultExecutionPath = fileURLToPath(new URL('../.specify/phase-b-execution.json', import.meta.url));

function loadOrCreatePlan(planPath) {
  try {
    return validatePhaseBPlan(JSON.parse(readFileSync(planPath, 'utf8')));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw new Error('PHASE_B_PLAN_INVALID');
  }
  const plan = createPhaseBPlan();
  mkdirSync(dirname(planPath), { recursive: true });
  try {
    writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    return plan;
  } catch (error) {
    if (error?.code !== 'EEXIST') throw new Error('PHASE_B_PLAN_SAVE_FAILED');
    return validatePhaseBPlan(JSON.parse(readFileSync(planPath, 'utf8')));
  }
}

function readExistingPlan(planPath) {
  try {
    return validatePhaseBPlan(JSON.parse(readFileSync(planPath, 'utf8')));
  } catch {
    throw new Error('PHASE_B_PLAN_MISSING_OR_INVALID');
  }
}

function parsePhaseBArguments(argv) {
  let execute = false, planDigest, planPath = defaultPlanPath;
  const seen = new Set();
  for (const argument of argv) {
    if (argument === '--execute' && !seen.has('execute')) {
      execute = true; seen.add('execute');
    } else if (argument.startsWith('--plan-digest=') && !seen.has('digest')) {
      planDigest = argument.slice('--plan-digest='.length); seen.add('digest');
      if (!/^[a-f0-9]{64}$/.test(planDigest)) throw new Error('PHASE_B_ARGUMENTS_INVALID');
    } else if (argument.startsWith('--plan-file=') && !seen.has('file')) {
      const supplied = argument.slice('--plan-file='.length);
      if (!supplied) throw new Error('PHASE_B_ARGUMENTS_INVALID');
      planPath = resolve(supplied); seen.add('file');
    } else throw new Error('PHASE_B_ARGUMENTS_INVALID');
  }
  if (execute !== Boolean(planDigest) || (!execute && seen.has('digest')))
    throw new Error('PHASE_B_ARGUMENTS_INVALID');
  return { execute, planDigest, planPath };
}

function executionAlreadyAttempted(statePath) {
  try {
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    return state?.scope === 'TEST_ONLY_PHASE_B' && state?.status === 'attempted';
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw new Error('PHASE_B_EXECUTION_STATE_INVALID');
  }
}

function markExecutionAttempted(statePath, plan) {
  mkdirSync(dirname(statePath), { recursive: true });
  try {
    writeFileSync(statePath, `${JSON.stringify({
      scope: plan.scope, status: 'attempted', digest: plan.digest,
    })}\n`, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error('PHASE_B_EXECUTION_ALREADY_ATTEMPTED');
    throw new Error('PHASE_B_EXECUTION_STATE_SAVE_FAILED');
  }
}

function printCurrentConditionsPrompt(input = process.stdin, output = process.stderr) {
  if (!input.isTTY) throw new Error('PHASE_B_EXECUTE_REQUIRES_TTY');
  return import('node:readline/promises').then(async ({ createInterface }) => {
    const readline = createInterface({ input, output });
    const yes = async (prompt) => (await readline.question(prompt)).trim().toLowerCase() === 'yes';
    const observation = async (label) => ({
      value: Number((await readline.question(`${label} 用量（整數）: `)).trim()),
      source: (await readline.question(`${label} 來源: `)).trim(),
      observedAt: (await readline.question(`${label} 擷取時間（ISO 8601 含時區）: `)).trim(),
    });
    try {
      return {
        noReadRegions: await yes('已確認本次 DB 無 Read Regions？輸入 yes 確認: '),
        noPaymentMethod: await yes('已確認沒有付款方式？輸入 yes 確認: '),
        noOtherWorkloadsOrWriters: await yes('已確認沒有其他 workload 或 writer？輸入 yes 確認: '),
        commands: await observation('Commands'),
        bandwidthBytes: await observation('Bandwidth bytes'),
        storageBytes: await observation('Storage bytes'),
      };
    } finally { readline.close(); }
  });
}

async function runExternalPhaseB(plan, currentConditions, readSecrets, onFirstDispatch) {
  const { loadPhaseBAdapters } = await import('./005-phase-b-runtime.mjs');
  const [adapters, costs, prices, windows, priceFixtures, registryFixtures, fingerprintFixtures] =
    await Promise.all([
      loadPhaseBAdapters(),
      import('../api/_lib/cost-registry.ts'),
      import('../api/_lib/cost-price-table.ts'),
      import('../api/_lib/quota-window.ts'),
      import('../tests/fixtures/cost-price-fixtures.ts'),
      import('../tests/fixtures/cost-registry-fixtures.ts'),
      import('../tests/fixtures/quota-fingerprint-fixtures.ts'),
    ]);
  const table = priceFixtures.fixtureWithEndpoint(priceFixtures.FIXTURE_NONE_LIVE,
    'assistant', priceFixtures.FIXTURE_ALL_LIVE.endpoints.assistant, 'PHASE_B_SYNTHETIC_v1');
  const entries = prices.PROTECTED_ENDPOINTS.map((endpoint) =>
    registryFixtures.fixtureRegistryEntry(endpoint, table));
  const bundle = costs.createRegistryBundle(1, table, entries);
  const now = new Date();
  const subject = 'phase-b-synthetic-subject';
  const fixture = {
    subject, keys: plan.inventory, bundle,
    command: {
      identitySubject: subject, idempotencyKey: 'phase-b-synthetic-operation',
      reservationId: 'phase-b-synthetic-reservation', endpoint: 'assistant', amountMicroUsd: 2400,
      costModel: prices.costModelOf(table),
      costParametersDigest: costs.costParametersDigest(entries[0]),
      fingerprintKeyVersion: fingerprintFixtures.FIXTURE_FINGERPRINT_KEY.version,
      requestFingerprint: 'a'.repeat(64), estimateInputs: { inputTokens: 0 },
      expectedRegistry: bundle, ...windows.getQuotaWindows(now),
      tierLimits: {
        tier1: { dayLimitMicroUsd: 10_000, weekBaseLimitMicroUsd: 10_000 },
        tier2: { dayLimitMicroUsd: 10_000, weekBaseLimitMicroUsd: 10_000 },
      },
      leaseMs: 60_000, nowIso: now.toISOString(),
    },
  };
  return runPhaseB(plan, fixture, {
    mode: 'external', createTransport: adapters.createRedisRestTransport,
    createStore: adapters.createRedisSharedStore, fetch: globalThis.fetch, readSecrets,
  }, { currentConditions, onFirstDispatch });
}

export async function phaseBMain(argv, io = {}) {
  const write = io.write ?? console.log;
  try {
    const { execute, planDigest, planPath } = parsePhaseBArguments(argv);
    if (!execute) {
      const plan = loadOrCreatePlan(planPath);
      write(JSON.stringify({
        ...plan, mode: 'dry-run', planFile: planPath,
        reason: 'external_conditions_and_operator_observations_required_before_execute',
        secretsRead: false, networkDispatched: 0,
      }));
      return 0;
    }
    const plan = readExistingPlan(planPath);
    if (plan.digest !== planDigest) throw new Error('PHASE_B_PLAN_DIGEST_MISMATCH');
    const statePath = io.executionPath ?? defaultExecutionPath;
    if (executionAlreadyAttempted(statePath)) throw new Error('PHASE_B_EXECUTION_ALREADY_ATTEMPTED');
    const currentConditions = await (io.readCurrentConditions ?? printCurrentConditionsPrompt)();
    if (!validatePhaseBConditions(currentConditions)) {
      write(JSON.stringify({ scope: plan.scope, mode: 'execute', status: 'stopped',
        reason: 'current_external_conditions_missing_or_over_limit',
        secretsRead: false, networkDispatched: 0, digest: plan.digest }));
      return 1;
    }
    const executePlan = io.execute ?? runExternalPhaseB;
    const report = await executePlan(plan, currentConditions, io.readSecrets ?? phaseBSecretSource,
      () => markExecutionAttempted(statePath, plan));
    write(JSON.stringify(report));
    return report.status === 'completed' ? 0 : 1;
  } catch (error) {
    const code = typeof error?.message === 'string' && /^PHASE_B_[A-Z0-9_]+$/.test(error.message)
      ? error.message : 'PHASE_B_FAILED';
    (io.writeError ?? console.error)(code);
    return code === 'PHASE_B_ARGUMENTS_INVALID' || code === 'PHASE_B_PLAN_DIGEST_MISMATCH' ? 2 : 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  phaseBMain(process.argv.slice(2)).then((code) => { process.exitCode = code; });
