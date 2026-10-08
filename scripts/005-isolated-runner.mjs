import { fork } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, fields) => object(v) && Object.keys(v).length === fields.length &&
  fields.every((field) => Object.hasOwn(v, field));
const positive = (v) => Number.isSafeInteger(v) && v > 0;
const reject = () => { throw new TypeError('TEST_ONLY_RUNNER_CONFIG_INVALID'); };

export function validateRunnerPlan(value) {
  if (!exact(value, ['scope', 'namespace', 'maxBatches', 'totalCommands', 'windowMs', 'operationTimeoutMs',
    'cleanupReserveMs', 'confirmationReserveMs', 'reserves', 'metering', 'inventory']) ||
      value.scope !== 'TEST_ONLY' || !/^\{preview-[A-Za-z0-9_-]+\}$/.test(value.namespace) ||
      value.namespace.length > 66 ||
      !['maxBatches', 'totalCommands', 'windowMs', 'operationTimeoutMs', 'cleanupReserveMs', 'confirmationReserveMs']
        .every((name) => positive(value[name])) ||
      value.totalCommands > 10000 || value.windowMs > 7200000 ||
      !exact(value.reserves, ['cleanup', 'usage', 'confirmation', 'uncertainty']) ||
      !Object.values(value.reserves).every(positive) ||
      !exact(value.metering, ['ruleRef', 'execute', 'confirm', 'usage', 'cleanupPerKey']) ||
      typeof value.metering.ruleRef !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value.metering.ruleRef) ||
      !['execute', 'confirm', 'usage', 'cleanupPerKey'].every((name) => positive(value.metering[name])) ||
      !Array.isArray(value.inventory) || value.inventory.length === 0 ||
      new Set(value.inventory).size !== value.inventory.length ||
      !value.inventory.every((key) => typeof key === 'string' &&
        key.startsWith(`${value.namespace}:`) && /^[A-Za-z0-9_{}:-]{1,256}$/.test(key) &&
        !key.slice(value.namespace.length).includes('{') && !key.slice(value.namespace.length).includes('}'))) reject();
  const reserveTotal = Object.values(value.reserves).reduce((a, b) => a + b, 0);
  const capacity = value.totalCommands - reserveTotal;
  if (!Number.isSafeInteger(reserveTotal) || capacity < value.metering.execute * 2 ||
      value.maxBatches > Math.floor(capacity / (value.metering.execute * 2)) ||
      value.reserves.cleanup < value.inventory.length * value.metering.cleanupPerKey ||
      value.reserves.usage < (value.maxBatches + 1) * value.metering.usage ||
      value.reserves.confirmation < value.maxBatches * 2 * value.metering.confirm ||
      value.operationTimeoutMs * 2 > value.confirmationReserveMs ||
      value.operationTimeoutMs * 2 + value.confirmationReserveMs + value.cleanupReserveMs >= value.windowMs) reject();
  return structuredClone(value);
}

async function bounded(work, timeoutMs, fallback) {
  if (timeoutMs <= 0) return fallback;
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => work(controller.signal)).catch(() => fallback),
      new Promise((resolve) => { timer = setTimeout(() => { controller.abort(); resolve(fallback); }, timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

function startWorker(slot, waitLimit) {
  const child = fork(new URL('./005-isolated-worker.mjs', import.meta.url), [], {
    execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.fromEntries(['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'PATH']
      .filter((name) => typeof process.env[name] === 'string').map((name) => [name, process.env[name]])),
  });
  const pending = new Set();
  let dead = false;
  const fail = () => { dead = true; for (const waiter of pending) waiter.finish(null); };
  child.on('error', fail);
  child.on('exit', fail);
  const wait = (type, sequence) => new Promise((resolve) => {
    if (dead) { resolve(null); return; }
    const timer = setTimeout(() => finish(null), waitLimit());
    const listener = (message) => {
      if (exact(message, ['type', 'slot', 'sequence']) && message.type === type &&
          message.slot === slot && message.sequence === sequence) finish(message);
    };
    const waiter = { finish };
    function finish(message) {
      clearTimeout(timer); child.off('message', listener); pending.delete(waiter); resolve(message);
    }
    pending.add(waiter);
    child.on('message', listener);
  });
  const send = (message) => {
    if (!dead && child.connected) child.send(message, (error) => { if (error) fail(); });
    else fail();
  };
  const ready = wait('ready', 0);
  send({ type: 'init', slot, sequence: 0 });
  return { child, wait, send, ready, isDead: () => dead, async stop() {
    if (!dead) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill();
      await bounded(() => exited, waitLimit(), null);
      if (!dead) { child.kill('SIGKILL'); await bounded(() => exited, waitLimit(), null); }
    }
    fail();
  } };
}

export async function runIsolatedBatches(input, ports, signal) {
  const plan = validateRunnerPlan(input);
  if (!ports || !['execute', 'confirm', 'usage', 'cleanup'].every((name) => typeof ports[name] === 'function'))
    throw new TypeError('TEST_ONLY_RUNNER_PORTS_REQUIRED');
  const started = performance.now();
  const deadline = started + plan.windowMs;
  const remaining = () => deadline - performance.now();
  const report = { scope: 'TEST_ONLY', evidence: 'local_process_substitute', status: 'stopped', reason: 'finished',
    batches: 0, dispatched: 0, unknown: 0, confirmed: 0, chargedUpperBound: 0, cleanup: 'unknown' };
  const capacity = plan.totalCommands - Object.values(plan.reserves).reduce((a, b) => a + b, 0);
  let testSpent = 0, usageSpent = 0, confirmSpent = 0, unresolved = false;
  let workers = [];
  const unknownClients = [];
  const charge = (amount) => { report.chargedUpperBound += amount; };
  const readUsage = async () => {
    if (usageSpent + plan.metering.usage > plan.reserves.usage ||
        remaining() <= plan.cleanupReserveMs + plan.confirmationReserveMs) return null;
    usageSpent += plan.metering.usage; charge(plan.metering.usage);
    const value = await bounded(ports.usage, Math.min(plan.operationTimeoutMs,
      remaining() - plan.cleanupReserveMs - plan.confirmationReserveMs), null);
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  };
  try {
    const baseline = signal?.aborted ? 0 : await readUsage();
    if (baseline === null) report.reason = 'usage_unknown';
    else if (signal?.aborted) report.reason = 'interrupted';
    else {
      const waitLimit = () => Math.max(1, Math.min(plan.operationTimeoutMs,
        remaining() - plan.cleanupReserveMs - plan.confirmationReserveMs));
      workers = [startWorker(0, waitLimit), startWorker(1, waitLimit)];
      const ready = await Promise.all(workers.map((worker) => worker.ready));
      if (ready.some((value) => value === null)) report.reason = 'worker_failure';
      else {
        let previousUsage = baseline;
        for (let sequence = 1; sequence <= plan.maxBatches; sequence++) {
          if (signal?.aborted) { report.reason = 'interrupted'; break; }
          if (workers.some((worker) => worker.isDead())) { report.reason = 'worker_failure'; break; }
          if (testSpent + plan.metering.execute * 2 > capacity) { report.reason = 'budget'; break; }
          // Readiness handshake and operation each have a bound; cleanup and confirmation remain untouched.
          if (remaining() <= plan.operationTimeoutMs * 2 + plan.cleanupReserveMs + plan.confirmationReserveMs) {
            report.reason = 'deadline'; break;
          }
          const requests = workers.map((worker) => worker.wait('execute', sequence));
          workers.forEach((worker, slot) => worker.send({ type: 'release', slot, sequence }));
          const requested = await Promise.all(requests);
          if (signal?.aborted) { report.reason = 'interrupted'; break; }
          if (requested.some((value) => value === null) || workers.some((worker) => worker.isDead())) {
            report.reason = 'worker_failure'; break;
          }
          if (remaining() <= plan.operationTimeoutMs + plan.cleanupReserveMs + plan.confirmationReserveMs) {
            report.reason = 'deadline'; break;
          }
          testSpent += plan.metering.execute * 2; charge(plan.metering.execute * 2);
          report.dispatched += 2; report.batches++;
          const clients = workers.map((worker, slot) => ({ slot, sequence, processId: worker.child.pid }));
          const outcomes = await Promise.all(clients.map((client) =>
            bounded((operationSignal) => ports.execute(client, operationSignal), plan.operationTimeoutMs, 'unknown')));
          const done = workers.map((worker) => worker.wait('done', sequence));
          for (let slot = 0; slot < 2; slot++) {
            if (outcomes[slot] !== 'completed') {
              report.unknown++; unknownClients.push(clients[slot]); report.reason = 'unknown';
            }
            workers[slot].send({ type: 'result', slot, sequence });
          }
          const finished = await Promise.all(done);
          if (finished.some((value) => value === null)) report.reason = 'worker_failure';
          if (signal?.aborted) report.reason = 'interrupted';
          if (report.reason !== 'finished') break;
          const usage = await readUsage();
          if (usage === null || usage < previousUsage) { report.reason = 'usage_unknown'; break; }
          previousUsage = usage;
          if (usage - baseline > plan.totalCommands ||
              usage - baseline > report.chargedUpperBound + plan.reserves.uncertainty) {
            report.reason = 'budget'; break;
          }
        }
      }
    }
    const confirmationEnds = Math.min(deadline - plan.cleanupReserveMs, performance.now() + plan.confirmationReserveMs);
    for (const client of unknownClients) {
      if (confirmSpent + plan.metering.confirm > plan.reserves.confirmation ||
          performance.now() >= confirmationEnds) { unresolved = true; continue; }
      confirmSpent += plan.metering.confirm; charge(plan.metering.confirm);
      const confirmed = await bounded((confirmationSignal) => ports.confirm(client, confirmationSignal),
        Math.min(plan.operationTimeoutMs, confirmationEnds - performance.now()), 'unknown');
      if (confirmed === 'confirmed') report.confirmed++;
      else unresolved = true;
    }
  } finally {
    // Freeze worker dispatch before exact-inventory cleanup. Unknown writers can still complete later.
    await Promise.all(workers.map((worker) => worker.stop()));
    if (!unresolved && remaining() > 0) {
      charge(plan.inventory.length * plan.metering.cleanupPerKey);
      const cleanup = await bounded((cleanupSignal) => ports.cleanup(Object.freeze([...plan.inventory]), cleanupSignal),
        Math.min(plan.cleanupReserveMs, remaining()), 'unknown');
      report.cleanup = cleanup === 'cleaned' ? 'cleaned' : 'unknown';
    }
  }
  report.status = report.reason === 'finished' && report.cleanup === 'cleaned' ? 'completed' : 'stopped';
  return report;
}
