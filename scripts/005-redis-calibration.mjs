// TEST_ONLY Redis 校準 one-shot caller。import 時不連網、不讀秘密、不讀 env／檔案。
// 預設 dry-run；只有 `--execute --plan-digest=<digest>` 才會在 TTY 無回顯輸入後派送固定操作。
import { createHash, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const SCOPE = 'TEST_ONLY_CALIBRATION';
const NAMESPACE_PATTERN = /^\{preview-[A-Za-z0-9_-]{16,48}\}$/;
const MARKER_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export const CALIBRATION_LIMITS = Object.freeze({
  restRequestsMax: 4,
  logicalCommandsMax: 10,
  operationTimeoutMs: 2000,
  windowMs: 20000,
  maxResponseBytes: 4096,
  maxRequestBodyBytes: 2048,
  markerTtlMs: 60000,
  markerLength: 32,
  inventoryKeys: 1,
  maxSecretLength: 4096,
});

const ARGUMENT_GUARD = "if type(a.m) ~= 'string' or string.len(a.m) ~= 32 then return redis.error_reply('CALIBRATION_ARGUMENT') end";
const SCRIPTS = Object.freeze({
  probe: "return redis.call('TIME')",
  write: [
    'local a = cjson.decode(ARGV[1])',
    ARGUMENT_GUARD,
    "if a.ttl ~= 60000 then return redis.error_reply('CALIBRATION_ARGUMENT') end",
    "if redis.call('SET', KEYS[1], a.m, 'PX', a.ttl, 'NX') then return 1 end",
    'return 0',
  ].join('\n'),
  verify: [
    'local a = cjson.decode(ARGV[1])',
    ARGUMENT_GUARD,
    "local v = redis.call('GET', KEYS[1])",
    "local t = redis.call('PTTL', KEYS[1])",
    'if v == false then return {0, t} end',
    'if v == a.m then return {1, t} end',
    'return {2, t}',
  ].join('\n'),
  cleanup: [
    'local a = cjson.decode(ARGV[1])',
    ARGUMENT_GUARD,
    "local v = redis.call('GET', KEYS[1])",
    'if v == false then return 0 end',
    'if v ~= a.m then return 2 end',
    "redis.call('DEL', KEYS[1])",
    'return 1',
  ].join('\n'),
});

const OPERATION_TEMPLATES = Object.freeze([
  { id: 'probe', mutation: false, innerCalls: ['TIME'],
    purpose: '唯讀連線／Lua／TIME 相容；不作任何其他請求的確認證據' },
  { id: 'write', mutation: true, innerCalls: ['SET KEYS[1] <marker> PX 60000 NX'],
    purpose: '唯一 synthetic marker 寫入；結果未知時不重送' },
  { id: 'verify', mutation: false, innerCalls: ['GET KEYS[1]', 'PTTL KEYS[1]'],
    purpose: '同一唯讀 Lua 核對 marker 與當下 PTTL；write 派送後恰一次' },
  { id: 'cleanup', mutation: true, innerCalls: ['GET KEYS[1]', 'DEL KEYS[1]'],
    purpose: 'exact key compare-and-delete；僅在 marker 已確認存在時派送一次' },
]);

export class CalibrationError extends Error {
  constructor(code) { super(code); this.name = 'CalibrationError'; this.code = code; }
}

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const deepFreeze = (value) => {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
};

function buildPlan(namespace) {
  const key = `${namespace}:calibration:marker`;
  const operations = OPERATION_TEMPLATES.map((op) => ({
    id: op.id, mutation: op.mutation, purpose: op.purpose, maxDispatch: 1,
    keys: [key], script: SCRIPTS[op.id], scriptSha256: sha256(SCRIPTS[op.id]),
    innerCalls: [...op.innerCalls], logicalCommandsMax: 1 + op.innerCalls.length,
  }));
  return {
    scope: SCOPE,
    version: 1,
    namespace,
    inventory: [key],
    limits: { ...CALIBRATION_LIMITS },
    operations,
    envelope: {
      restRequestsMax: CALIBRATION_LIMITS.restRequestsMax,
      logicalCommandsMax: operations.reduce((sum, op) => sum + op.logicalCommandsMax, 0),
      logicalCommandsDefinition: 'outer EVAL + listed inner redis.call; not provider billing',
      providerMetering: 'unverified',
      billableUpperBound: null,
      usageSource: 'not_used_manual_console_observation_only',
    },
  };
}

export const CALIBRATION_TEMPLATE_DIGEST = sha256(JSON.stringify(buildPlan('{preview-<random-id>}')));

export function createCalibrationPlan(randomId = randomBytes(12).toString('base64url')) {
  const namespace = `{preview-${randomId}}`;
  if (!NAMESPACE_PATTERN.test(namespace)) throw new CalibrationError('CALIBRATION_PLAN_INVALID');
  return deepFreeze({ ...buildPlan(namespace), templateDigest: CALIBRATION_TEMPLATE_DIGEST });
}

export function validateCalibrationPlan(value) {
  if (!value || typeof value !== 'object' || typeof value.namespace !== 'string' ||
      !NAMESPACE_PATTERN.test(value.namespace)) throw new CalibrationError('CALIBRATION_PLAN_INVALID');
  const expected = { ...buildPlan(value.namespace), templateDigest: CALIBRATION_TEMPLATE_DIGEST };
  if (JSON.stringify(value) !== JSON.stringify(expected)) throw new CalibrationError('CALIBRATION_PLAN_INVALID');
  return deepFreeze(expected);
}

function validateTarget(credentials) {
  if (!credentials || typeof credentials !== 'object' || typeof credentials.url !== 'string' ||
      typeof credentials.token !== 'string' || credentials.url.length > CALIBRATION_LIMITS.maxSecretLength ||
      credentials.token.length > CALIBRATION_LIMITS.maxSecretLength) throw new CalibrationError('CALIBRATION_SECRET_INVALID');
  let url;
  try { url = new URL(credentials.url); } catch { throw new CalibrationError('CALIBRATION_SECRET_INVALID'); }
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.upstash\.io$/.test(url.hostname) || url.port ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !/^[\x21-\x7e]+$/.test(credentials.token)) throw new CalibrationError('CALIBRATION_SECRET_INVALID');
  return Object.freeze({ href: url.href, origin: url.origin, authorization: `Bearer ${credentials.token}` });
}

const UNKNOWN = Object.freeze({ status: 'unknown' });

async function readCapped(body, maxBytes) {
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > maxBytes) { void reader.cancel().catch(() => {}); return null; }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return joined;
}

/**
 * 只派送凍結 plan 中的固定 script／exact keys；每 operation 最多一次、總數 ≤ restRequestsMax，
 * 計數在 fetch 前遞增。任何失敗只回固定 `unknown`，不帶 provider 原文，也不自動重試。
 */
export function createGuardedDispatcher(planInput, credentials, fetchImpl, options = {}) {
  const plan = validateCalibrationPlan(planInput);
  if (typeof fetchImpl !== 'function') throw new CalibrationError('CALIBRATION_PORTS_REQUIRED');
  const target = validateTarget(credentials);
  const now = typeof options.now === 'function' ? options.now : () => performance.now();
  const deadline = now() + plan.limits.windowMs;
  const used = new Set();
  let count = 0;
  return Object.freeze({
    get count() { return count; },
    remaining: () => deadline - now(),
    async send(operationId, keys, args, signal) {
      const op = plan.operations.find((candidate) => candidate.id === operationId);
      const marker = args && typeof args === 'object' ? args.m : undefined;
      const expectedArgs = operationId === 'probe' ? {} :
        operationId === 'write' ? { m: marker, ttl: plan.limits.markerTtlMs } : { m: marker };
      if (!op || used.has(op.id) || count >= plan.limits.restRequestsMax || signal?.aborted ||
          !Array.isArray(keys) || keys.length !== op.keys.length ||
          !keys.every((key, index) => key === op.keys[index] && plan.inventory.includes(key)) ||
          (operationId !== 'probe' && (typeof marker !== 'string' || !MARKER_PATTERN.test(marker))) ||
          JSON.stringify(args) !== JSON.stringify(expectedArgs)) throw new CalibrationError('CALIBRATION_DISPATCH_REJECTED');
      const timeoutMs = Math.min(plan.limits.operationTimeoutMs, deadline - now());
      const body = JSON.stringify(['EVAL', op.script, keys.length, ...keys, JSON.stringify(args)]);
      if (timeoutMs <= 0 || new TextEncoder().encode(body).byteLength > plan.limits.maxRequestBodyBytes)
        throw new CalibrationError('CALIBRATION_DISPATCH_REJECTED');
      used.add(op.id);
      count++;
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      let timer;
      const work = (async () => {
        const response = await fetchImpl(target.href, {
          method: 'POST',
          headers: { Authorization: target.authorization, 'Content-Type': 'application/json' },
          body, signal: controller.signal, redirect: 'error', cache: 'no-store',
        });
        if (!response || response.status !== 200 || response.redirected || !response.body ||
            (response.url && new URL(response.url).origin !== target.origin)) return UNKNOWN;
        const bytes = await readCapped(response.body, plan.limits.maxResponseBytes);
        if (!bytes || controller.signal.aborted) return UNKNOWN;
        const raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Object.hasOwn(raw, 'result') ||
            Object.hasOwn(raw, 'error')) return UNKNOWN;
        return Object.freeze({ status: 'ok', result: raw.result });
      })().catch(() => UNKNOWN);
      try {
        return await Promise.race([
          work,
          new Promise((done) => { timer = setTimeout(() => done(UNKNOWN), timeoutMs); }),
          new Promise((done) => { controller.signal.addEventListener('abort', () => done(UNKNOWN), { once: true }); }),
        ]);
      } finally {
        clearTimeout(timer);
        controller.abort();
        signal?.removeEventListener('abort', onAbort);
      }
    },
  });
}

function baseReport(plan, mode) {
  return {
    scope: SCOPE,
    evidence: 'calibration_caller_report',
    mode,
    templateDigest: CALIBRATION_TEMPLATE_DIGEST,
    namespace: plan.namespace,
    inventory: [...plan.inventory],
    status: 'stopped',
    reason: 'finished',
    restRequests: 0,
    restRequestsMax: plan.envelope.restRequestsMax,
    logicalCommandsUpperBound: 0,
    logicalCommandsMax: plan.envelope.logicalCommandsMax,
    providerMetering: 'unverified',
    billableUpperBound: null,
    operations: { probe: 'not_dispatched', write: 'not_dispatched', verify: 'not_dispatched', cleanup: 'not_dispatched' },
    write: 'not_dispatched',
    observedPttlMs: null,
    cleanup: 'not_needed',
    manualFollowUp: false,
  };
}

const isTime = (value) => Array.isArray(value) && value.length === 2 &&
  value.every((part) => (typeof part === 'string' && /^\d{1,20}$/.test(part)) || (Number.isSafeInteger(part) && part >= 0));
const isPair = (value) => Array.isArray(value) && value.length === 2 && value.every(Number.isSafeInteger);

/**
 * one-shot 校準。stopSignal＝第一段中斷：不再開始 probe／write，但已派送 write 仍做一次唯讀核對及
 * 已確認 marker 的 exact cleanup；abortSignal＝第二段中斷：中止 in-flight 並停止所有後續派送。
 */
export async function runCalibration(planInput, ports, control = {}) {
  const plan = validateCalibrationPlan(planInput);
  if (!ports || typeof ports.fetch !== 'function' || typeof ports.readSecrets !== 'function')
    throw new CalibrationError('CALIBRATION_PORTS_REQUIRED');
  const report = baseReport(plan, 'execute');
  const hard = () => control.abortSignal?.aborted === true;
  const stopped = () => hard() || control.stopSignal?.aborted === true;
  const finish = (reason) => {
    report.reason = reason;
    report.status = reason === 'finished' && report.write === 'written_confirmed' && report.cleanup === 'cleaned'
      ? 'completed' : 'stopped';
    report.manualFollowUp = !['cleaned', 'not_needed'].includes(report.cleanup);
    return deepFreeze(report);
  };
  if (stopped()) return finish('interrupted');
  let dispatcher;
  try {
    const credentials = await ports.readSecrets();
    dispatcher = createGuardedDispatcher(plan, credentials, ports.fetch, { now: ports.now });
  } catch {
    return finish('secret_invalid');
  }
  if (stopped()) return finish('interrupted');
  const marker = randomBytes(24).toString('base64url');
  const args = { probe: {}, write: { m: marker, ttl: plan.limits.markerTtlMs }, verify: { m: marker }, cleanup: { m: marker } };
  const T = plan.limits.operationTimeoutMs;
  const dispatch = async (id) => {
    const op = plan.operations.find((candidate) => candidate.id === id);
    const before = dispatcher.count;
    // send 在第一個 await 前同步完成檢查與計數；被拒絕時未派送、不計入。
    const pending = dispatcher.send(id, op.keys, args[id], control.abortSignal).catch(() => UNKNOWN);
    if (dispatcher.count > before) report.logicalCommandsUpperBound += op.logicalCommandsMax;
    report.restRequests = dispatcher.count;
    return pending;
  };

  if (dispatcher.remaining() < 4 * T) return finish('deadline');
  const probe = await dispatch('probe');
  report.operations.probe = probe.status === 'ok' && isTime(probe.result) ? 'ok' : 'failed';
  if (report.operations.probe !== 'ok') return finish(hard() ? 'aborted' : 'probe_failed');

  if (stopped()) return finish(hard() ? 'aborted' : 'interrupted');
  if (dispatcher.remaining() < 3 * T) return finish('deadline');
  const write = await dispatch('write');
  if (write.status === 'ok' && write.result === 0) {
    report.operations.write = 'conflict';
    report.write = 'conflict_not_ours';
    report.cleanup = 'not_ours';
    return finish('write_conflict');
  }
  const writeCompleted = write.status === 'ok' && write.result === 1;
  report.operations.write = writeCompleted ? 'completed' : 'unknown';
  report.write = writeCompleted ? 'completed_unverified' : 'unknown';
  report.cleanup = 'withheld_unresolved';
  if (hard()) return finish('aborted');
  if (dispatcher.remaining() < 2 * T) return finish('deadline');

  const verify = await dispatch('verify');
  let verifyState = 'unknown';
  if (verify.status === 'ok' && isPair(verify.result)) {
    const [state, pttl] = verify.result;
    if (state === 1 || state === 0) report.observedPttlMs = pttl;
    if (state === 1) verifyState = pttl > 0 && pttl <= plan.limits.markerTtlMs ? 'present' : 'ttl_invalid';
    else if (state === 0) verifyState = pttl === -2 ? 'absent' : 'ttl_invalid';
    else if (state === 2) verifyState = 'mismatch';
  }
  report.operations.verify = verifyState;
  if (verifyState !== 'present') {
    // absent／mismatch／TTL 異常／確認逾時都不推論未寫入；未收斂時不清理可能晚到的寫入。
    report.write = writeCompleted ? 'completed_unverified' : 'unknown';
    if (hard()) return finish('aborted');
    if (verifyState === 'unknown') return finish('confirmation_unknown');
    return finish(!writeCompleted && verifyState === 'absent' ? 'write_unresolved' : 'contradiction');
  }
  report.write = 'written_confirmed';
  if (hard()) { report.cleanup = 'not_attempted_aborted'; return finish('aborted'); }
  if (dispatcher.remaining() < 1) { report.cleanup = 'withheld_deadline'; return finish('deadline'); }

  const cleanup = await dispatch('cleanup');
  const outcome = cleanup.status !== 'ok' ? 'unknown' :
    cleanup.result === 1 ? 'cleaned' : cleanup.result === 0 ? 'absent' : cleanup.result === 2 ? 'mismatch' : 'unknown';
  report.operations.cleanup = outcome;
  report.cleanup = outcome;
  if (outcome !== 'cleaned') return finish(hard() ? 'aborted' : 'cleanup_unconfirmed');
  return finish(stopped() ? (hard() ? 'aborted' : 'interrupted') : 'finished');
}

export function describeDryRun(plan = createCalibrationPlan()) {
  const validated = validateCalibrationPlan(plan);
  return deepFreeze({
    scope: SCOPE,
    mode: 'dry_run',
    networkDispatched: 0,
    secretsRead: false,
    templateDigest: CALIBRATION_TEMPLATE_DIGEST,
    namespaceNote: 'execute 會重新產生唯一 namespace，並在讀取秘密後、首次派送前凍結；template digest 不含 namespace',
    executeCommand: `node scripts/005-redis-calibration.mjs --execute --plan-digest=${CALIBRATION_TEMPLATE_DIGEST}`,
    interruption: '第一次 Ctrl+C／SIGINT 停止新 probe／write 但收斂已派送 write；第二次中止 in-flight 並停止全部派送',
    plan: validated,
  });
}

/** TTY 無回顯輸入；非 TTY 拒絕，不從 env、檔案或 argv 取值。 */
export function promptHidden(label, streams = {}) {
  const input = streams.input ?? process.stdin;
  const output = streams.output ?? process.stderr;
  if (!input.isTTY || typeof input.setRawMode !== 'function')
    return Promise.reject(new CalibrationError('CALIBRATION_SECRET_PROMPT_REQUIRES_TTY'));
  output.write(label);
  return new Promise((resolvePrompt, rejectPrompt) => {
    let value = '';
    const end = (error) => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      output.write('\n');
      if (error) rejectPrompt(new CalibrationError(error)); else resolvePrompt(value);
    };
    const onData = (chunk) => {
      for (const ch of String(chunk)) {
        if (ch === '\r' || ch === '\n') { end(); return; }
        if (ch === '\u0003' || ch === '\u001b') { end('CALIBRATION_SECRET_PROMPT_CANCELLED'); return; }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
        if (value.length > CALIBRATION_LIMITS.maxSecretLength) { end('CALIBRATION_SECRET_INVALID'); return; }
      }
    };
    input.setRawMode(true);
    input.setEncoding('utf8');
    input.on('data', onData);
    input.resume();
  });
}

export async function promptCredentials(streams = {}) {
  const url = await promptHidden('Redis REST URL（不回顯）: ', streams);
  const token = await promptHidden('Redis REST token（不回顯）: ', streams);
  return { url, token };
}

export async function main(argv, io) {
  if (argv.length === 0) {
    io.stdout.write(`${JSON.stringify(describeDryRun(), null, 2)}\n`);
    return 0;
  }
  // 不回顯任何 argv，避免誤貼的秘密進入輸出。
  if (argv.length !== 2 || argv[0] !== '--execute' || !/^--plan-digest=[0-9a-f]{64}$/.test(argv[1])) {
    io.stderr.write('CALIBRATION_ARGUMENTS_INVALID\n');
    return 2;
  }
  if (argv[1].slice('--plan-digest='.length) !== CALIBRATION_TEMPLATE_DIGEST) {
    io.stderr.write('CALIBRATION_PLAN_DIGEST_MISMATCH\n');
    return 2;
  }
  const report = await runCalibration(createCalibrationPlan(), { fetch: io.fetch, readSecrets: io.readSecrets },
    { stopSignal: io.stopSignal, abortSignal: io.abortSignal });
  io.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.status === 'completed' ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const stop = new AbortController();
  const abort = new AbortController();
  process.on('SIGINT', () => { if (!stop.signal.aborted) stop.abort(); else abort.abort(); });
  main(process.argv.slice(2), {
    stdout: process.stdout, stderr: process.stderr, fetch: globalThis.fetch,
    readSecrets: () => promptCredentials(), stopSignal: stop.signal, abortSignal: abort.signal,
  }).then((code) => { process.exitCode = code; }, () => {
    process.stderr.write('CALIBRATION_FAILED\n');
    process.exitCode = 1;
  });
}
