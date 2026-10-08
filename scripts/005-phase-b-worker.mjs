import { performance } from 'node:perf_hooks';
import { loadPhaseBAdapters } from './005-phase-b-runtime.mjs';

let input, pending, started = false, dispatched = false;
let deadline = 0;
const suffixes = ['registry', 'users', 'sessions'];
const send = (value, done) => {
  if (!process.connected) { process.exit(1); return; }
  process.send(value, (error) => { if (error) process.exit(1); else done?.(); });
};
const finish = (status, executionGrant) => send({
  type: 'result', slot: input?.slot, pid: process.pid,
  clientCreated: started, status, ...(typeof executionGrant === 'boolean' ? { executionGrant } : {}),
}, () => process.exit(0));

function validInit(v) {
  return v?.type === 'init' && [0, 1].includes(v.slot) &&
    ['mock', 'external'].includes(v.mode) &&
    /^\{preview-[A-Za-z0-9_-]{16}\}$/.test(v.namespace) &&
    Array.isArray(v.keys) && v.keys.length === 3 &&
    v.keys.every((key, i) => key === `${v.namespace}:${suffixes[i]}`) &&
    !Object.hasOwn(v, 'floor') &&
    v.command?.idempotencyKey === 'phase-b-synthetic-operation' &&
    v.command?.reservationId === 'phase-b-synthetic-reservation' &&
    !Object.hasOwn(v.command, 'requestEpoch') &&
    ['timeoutMs', 'maxRequestBytes', 'maxResponseBytes'].every((key) =>
      Number.isSafeInteger(v[key]) && v[key] > 0) &&
    v.timeoutMs <= 2000 && v.maxRequestBytes <= 131072 && v.maxResponseBytes <= 32768;
}

function mockFetch(url, options) {
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    options.signal.addEventListener('abort', () => {
      pending = undefined;
      reject(new Error('PHASE_B_UNKNOWN'));
    }, { once: true });
    // 只限明列 mock 模式；external 模式不透過 parent proxy。
    send({ type: 'mock-request', slot: input.slot, body: options.body });
  });
}

process.on('message', async (message) => {
  if (message?.type === 'mock-response' && input?.mode === 'mock' && pending) {
    const waiter = pending;
    pending = undefined;
    waiter.resolve(new Response(message.body, { status: message.status }));
    return;
  }
  if (!input) {
    if (!validInit(message)) { process.exit(1); return; }
    input = message;
    send({ type: 'ready', slot: input.slot, pid: process.pid });
    return;
  }
  if (message?.type !== 'dispatch' || message.slot !== input.slot || started ||
      !Number.isSafeInteger(message.remainingMs) || message.remainingMs <= 0) {
    process.exit(1); return;
  }
  deadline = performance.now() + message.remainingMs;
  let credentials = message.credentials;
  message.credentials = undefined;
  try {
    if (!credentials || typeof credentials.url !== 'string' || typeof credentials.token !== 'string' ||
        credentials.url.length > 4096 || credentials.token.length > 4096)
      throw new Error('PHASE_B_SECRET_INVALID');
    const { createRedisRestTransport, createRedisSharedStore } = await loadPhaseBAdapters();
    const transport = createRedisRestTransport({
      ...credentials, timeoutMs: Math.min(input.timeoutMs, message.remainingMs),
      maxResponseBytes: input.maxResponseBytes, fetch: input.mode === 'mock' ? mockFetch : fetch,
    });
    credentials = undefined;
    started = true;
    const guarded = { async eval(script, keys, argumentsJson) {
      if (dispatched || performance.now() >= deadline || keys.length !== 3 ||
          !keys.every((key, i) => key === input.keys[i]) ||
          JSON.parse(argumentsJson).operation !== 'reserve' ||
          Buffer.byteLength(JSON.stringify(['EVAL', script, keys.length, ...keys, argumentsJson])) >
            input.maxRequestBytes) throw new Error('PHASE_B_DISPATCH_LIMIT');
      dispatched = true;
      return transport.eval(script, keys, argumentsJson);
    } };
    const store = createRedisSharedStore({
      namespace: input.namespace, transport: guarded,
      timeoutMs: Math.min(input.timeoutMs, message.remainingMs), audit() {},
    });
    const result = await store.reserve(input.command);
    if (!['reserved', 'duplicate'].includes(result.status) ||
        result.reservation?.reservationId !== input.command.reservationId ||
        result.reservation?.idempotencyKey !== input.command.idempotencyKey ||
        result.reservation?.identitySubject !== input.command.identitySubject ||
        result.reservation?.requestFingerprint !== input.command.requestFingerprint ||
        result.reservation?.estimatedCostUpperBoundUsdMicro !== input.command.amountMicroUsd ||
        result.reservation?.dayWindowKey !== input.command.day.windowKey ||
        result.reservation?.weekWindowKey !== input.command.week.windowKey ||
        (result.status === 'reserved') !== result.executionGrant)
      throw new Error('PHASE_B_RESULT_INVALID');
    finish(result.status, result.executionGrant);
  } catch {
    credentials = undefined;
    finish('unknown');
  }
});
process.on('disconnect', () => process.exit(0));
