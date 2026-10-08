// @vitest-environment node
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CALIBRATION_TEMPLATE_DIGEST, createCalibrationPlan, createGuardedDispatcher, describeDryRun, main,
  promptCredentials, promptHidden, runCalibration, validateCalibrationPlan,
  type CalibrationControl, type CalibrationOperationId, type CalibrationPlan, type HiddenPromptInput,
} from '../../scripts/005-redis-calibration.mjs';

const SYNTH_HOST = 'synthetic-calibration-db.upstash.io';
const SYNTH_URL = `https://${SYNTH_HOST}`;
const SYNTH_TOKEN = 'SYNTHETIC_TOKEN_not_real_0123456789';
const secrets = () => Promise.resolve({ url: SYNTH_URL, token: SYNTH_TOKEN });
const SOURCE = new URL('../../scripts/005-redis-calibration.mjs', import.meta.url);

interface Entry { value: string; ttl: number }
interface Ctx { args: { m?: string; ttl?: number }; key: string; store: Map<string, Entry>; signal: AbortSignal }
type Override = (ctx: Ctx) => Promise<Response>;

const ok = (result: unknown) => Promise.resolve(new Response(JSON.stringify({ result }), { status: 200 }));
const hang = () => new Promise<Response>(() => {});

function defaultRedis(op: CalibrationOperationId, { args, key, store }: Ctx): unknown {
  const entry = store.get(key);
  if (op === 'probe') return ['1791374493', '123456'];
  if (op === 'write') { if (entry) return 0; store.set(key, { value: args.m!, ttl: args.ttl! }); return 1; }
  if (op === 'verify') return entry ? [entry.value === args.m ? 1 : 2, entry.ttl - 5] : [0, -2];
  if (!entry) return 0;
  if (entry.value !== args.m) return 2;
  store.delete(key);
  return 1;
}

function redisMock(plan: CalibrationPlan, overrides: Partial<Record<CalibrationOperationId, Override>> = {}) {
  const store = new Map<string, Entry>();
  const calls: { op: CalibrationOperationId; body: unknown[]; init: RequestInit; url: string }[] = [];
  const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init!.body)) as unknown[];
    const op = plan.operations.find((candidate) => candidate.script === body[1])!.id;
    calls.push({ op, body, init: init!, url: String(url) });
    const ctx = { args: JSON.parse(String(body[4])), key: String(body[3]), store, signal: init!.signal! };
    return overrides[op] ? overrides[op]!(ctx) : ok(defaultRedis(op, ctx));
  });
  return { fetch: fetchMock as unknown as typeof fetch, fetchMock, calls, store,
    ops: () => calls.map((call) => call.op) };
}

function run(plan: CalibrationPlan, mock: ReturnType<typeof redisMock>, control: CalibrationControl = {},
  now: () => number = () => 0, readSecrets = vi.fn(secrets)) {
  return runCalibration(plan, { fetch: mock.fetch, readSecrets, now }, control);
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('005 Redis 校準 caller：plan、dry-run 與無副作用', () => {
  it('出站網路在測試中被封鎖，import 不讀 env／檔案、不註冊 signal、不呼叫 fetch', async () => {
    await expect(globalThis.fetch('https://example.invalid/')).rejects.toThrow('TEST_ONLY_EXTERNAL_NETWORK_BLOCKED');
    const source = readFileSync(SOURCE, 'utf8');
    expect(source).not.toMatch(/process\.env|readFile|dotenv|\.env\b|SCAN|FLUSH|KEYS \*/);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const listeners = process.listenerCount('SIGINT');
    vi.resetModules();
    const fresh = await import('../../scripts/005-redis-calibration.mjs');
    expect(typeof fresh.runCalibration).toBe('function');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(process.listenerCount('SIGINT')).toBe(listeners);
  });

  it('dry-run 預設零 fetch、不讀秘密，輸出固定 scripts／次數／限制且 provider 計量未知', async () => {
    const out: string[] = [], err: string[] = [];
    const fetchSpy = vi.fn(), readSecrets = vi.fn(secrets);
    const code = await main([], { stdout: { write: (t) => out.push(t) }, stderr: { write: (t) => err.push(t) },
      fetch: fetchSpy as unknown as typeof fetch, readSecrets });
    expect(code).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(readSecrets).not.toHaveBeenCalled();
    expect(err).toEqual([]);
    const dry = JSON.parse(out.join(''));
    expect(dry).toMatchObject({ mode: 'dry_run', networkDispatched: 0, secretsRead: false,
      templateDigest: CALIBRATION_TEMPLATE_DIGEST });
    expect(dry.plan.envelope).toEqual({ restRequestsMax: 4, logicalCommandsMax: 10,
      logicalCommandsDefinition: 'outer EVAL + listed inner redis.call; not provider billing',
      providerMetering: 'unverified', billableUpperBound: null, usageSource: 'not_used_manual_console_observation_only' });
    expect(dry.plan.operations.map((op: { id: string }) => op.id)).toEqual(['probe', 'write', 'verify', 'cleanup']);
    expect(dry.plan.inventory).toHaveLength(1);
    expect(dry.plan.limits).toMatchObject({ operationTimeoutMs: 2000, windowMs: 20000, maxResponseBytes: 4096,
      maxRequestBodyBytes: 2048, markerTtlMs: 60000, markerLength: 32 });
  });

  it('計畫中的 inner calls、邏輯 commands 與實際 scripts 一致；template digest 不隨 namespace 變動', () => {
    const plan = createCalibrationPlan();
    for (const op of plan.operations) {
      expect(op.script.match(/redis\.call\(/g)).toHaveLength(op.innerCalls.length);
      expect(op.logicalCommandsMax).toBe(1 + op.innerCalls.length);
      expect(op.scriptSha256).toBe(createHash('sha256').update(op.script).digest('hex'));
      expect(op.keys).toEqual(plan.inventory);
      expect(op.script).not.toMatch(/SCAN|FLUSH|KEYS\(|EXPIRE|redis\.call\('KEYS'/);
    }
    expect(plan.operations.map((op) => op.logicalCommandsMax)).toEqual([2, 2, 3, 3]);
    expect(plan.operations.filter((op) => op.mutation).map((op) => op.id)).toEqual(['write', 'cleanup']);
    const other = createCalibrationPlan();
    expect(other.namespace).not.toBe(plan.namespace);
    expect(other.templateDigest).toBe(plan.templateDigest);
    expect(describeDryRun(plan).plan).toEqual(plan);
  });

  it('plan 任何偏離（額外 key、改 script、放寬上限、非法 namespace）都拒絕', () => {
    const plan = createCalibrationPlan();
    const clone = () => JSON.parse(JSON.stringify(plan));
    const extra = clone(); extra.inventory.push(`${plan.namespace}:extra`);
    const script = clone(); script.operations[1].script = "return redis.call('FLUSHALL')";
    const limit = clone(); limit.limits.restRequestsMax = 5;
    const ns = clone(); ns.namespace = 'tokyomate:{preview-abcdefghijklmnop}';
    for (const bad of [extra, script, limit, ns, null, {}]) expect(() => validateCalibrationPlan(bad))
      .toThrow('CALIBRATION_PLAN_INVALID');
    expect(validateCalibrationPlan(clone())).toEqual(plan);
  });
});

describe('005 Redis 校準 caller：派送界線與秘密', () => {
  it('完整成功：固定順序 4 次 EVAL POST、10 邏輯 commands 上限、exact key 清理', async () => {
    const plan = createCalibrationPlan();
    const mock = redisMock(plan);
    const report = await run(plan, mock);
    expect(report).toMatchObject({ status: 'completed', reason: 'finished', restRequests: 4,
      logicalCommandsUpperBound: 10, providerMetering: 'unverified', billableUpperBound: null,
      write: 'written_confirmed', cleanup: 'cleaned', observedPttlMs: 59995, manualFollowUp: false,
      operations: { probe: 'ok', write: 'completed', verify: 'present', cleanup: 'cleaned' } });
    expect(mock.ops()).toEqual(['probe', 'write', 'verify', 'cleanup']);
    const markers = new Set<string>();
    for (const call of mock.calls) {
      expect(call.url).toBe(`${SYNTH_URL}/`);
      expect(call.init).toMatchObject({ method: 'POST', redirect: 'error', cache: 'no-store' });
      expect((call.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${SYNTH_TOKEN}`);
      expect(call.body.slice(0, 1)).toEqual(['EVAL']);
      expect(call.body.slice(2, 4)).toEqual([1, plan.inventory[0]]);
      expect(call.body).toHaveLength(5);
      const args = JSON.parse(String(call.body[4]));
      if (args.m) markers.add(args.m);
    }
    expect([...markers]).toHaveLength(1);
    expect([...markers][0]).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(JSON.parse(String(mock.calls[1].body[4]))).toMatchObject({ ttl: 60000 });
    expect(mock.store.size).toBe(0);
    expect(Object.isFrozen(report)).toBe(true);
  });

  it('秘密不進 stdout／stderr／report／錯誤；provider 錯誤原文不輸出；argv 不回顯', async () => {
    const plan = createCalibrationPlan();
    const leaky = () => Promise.resolve(new Response(JSON.stringify({ error: `${SYNTH_TOKEN} ${SYNTH_HOST}` }), { status: 400 }));
    const mock = redisMock(plan, { probe: leaky });
    const out: string[] = [], err: string[] = [];
    const io = { stdout: { write: (t: string) => out.push(t) }, stderr: { write: (t: string) => err.push(t) },
      fetch: mock.fetch, readSecrets: secrets };
    expect(await main(['--execute', `--plan-digest=${CALIBRATION_TEMPLATE_DIGEST}`], io)).toBe(1);
    expect(await main(['--execute', `--token=${SYNTH_TOKEN}`], io)).toBe(2);
    expect(await main([SYNTH_URL], io)).toBe(2);
    const success = await run(plan, redisMock(plan));
    const all = [...out, ...err, JSON.stringify(success)].join('\n');
    expect(all).not.toContain(SYNTH_TOKEN);
    expect(all).not.toContain(SYNTH_HOST);
    expect(err).toEqual(['CALIBRATION_ARGUMENTS_INVALID\n', 'CALIBRATION_ARGUMENTS_INVALID\n']);
    expect(JSON.parse(out[0])).toMatchObject({ reason: 'probe_failed', restRequests: 1, cleanup: 'not_needed' });
    let thrown: unknown;
    try { createGuardedDispatcher(plan, { url: SYNTH_URL, token: `${SYNTH_TOKEN}\n` }, mock.fetch); }
    catch (error) { thrown = error; }
    expect(String((thrown as Error).message)).toBe('CALIBRATION_SECRET_INVALID');
    expect(JSON.stringify(thrown)).not.toContain(SYNTH_TOKEN);
  });

  it.each([
    ['http://synthetic-calibration-db.upstash.io', SYNTH_TOKEN],
    ['https://synthetic.example.com', SYNTH_TOKEN],
    [`${SYNTH_URL}/path`, SYNTH_TOKEN],
    [`${SYNTH_URL}:8443`, SYNTH_TOKEN],
    [`https://u:p@${SYNTH_HOST}`, SYNTH_TOKEN],
    [`${SYNTH_URL}/?q=1`, SYNTH_TOKEN],
    [SYNTH_URL, ''],
    [SYNTH_URL, 'has space'],
    [SYNTH_URL, 'line\nbreak'],
  ])('非可信目標或 token 在派送前拒絕：%s', async (url, token) => {
    const plan = createCalibrationPlan();
    const mock = redisMock(plan);
    const report = await run(plan, mock, {}, () => 0, vi.fn(() => Promise.resolve({ url, token })));
    expect(report).toMatchObject({ reason: 'secret_invalid', restRequests: 0, cleanup: 'not_needed' });
    expect(mock.fetchMock).not.toHaveBeenCalled();
  });

  it('dispatcher 拒絕額外 key、非 inventory key、未知 operation、改參數，並強制每 operation 一次與總數 4', async () => {
    const plan = createCalibrationPlan();
    const mock = redisMock(plan);
    const d = createGuardedDispatcher(plan, { url: SYNTH_URL, token: SYNTH_TOKEN }, mock.fetch, { now: () => 0 });
    const key = plan.inventory;
    const m = 'a'.repeat(32);
    const rejected = [
      d.send('probe', [...key, `${plan.namespace}:extra`], {}),
      d.send('probe', [`${plan.namespace}:other`], {}),
      d.send('flush' as CalibrationOperationId, key, {}),
      d.send('probe', key, { m }),
      d.send('write', key, { m, ttl: 600000 }),
      d.send('write', key, { m: 'short', ttl: 60000 }),
      d.send('verify', key, { m, extra: true }),
    ];
    for (const attempt of rejected) await expect(attempt).rejects.toThrow('CALIBRATION_DISPATCH_REJECTED');
    expect(d.count).toBe(0);
    expect((await d.send('probe', key, {})).status).toBe('ok');
    expect((await d.send('write', key, { m, ttl: 60000 })).status).toBe('ok');
    expect((await d.send('verify', key, { m })).status).toBe('ok');
    expect((await d.send('cleanup', key, { m })).status).toBe('ok');
    await expect(d.send('probe', key, {})).rejects.toThrow('CALIBRATION_DISPATCH_REJECTED');
    await expect(d.send('write', key, { m, ttl: 60000 })).rejects.toThrow('CALIBRATION_DISPATCH_REJECTED');
    expect(d.count).toBe(4);
    expect(mock.fetchMock).toHaveBeenCalledTimes(4);
  });

  it('轉址、跨來源回應、超過回應 bytes 與 provider error 都只成為 unknown／failed', async () => {
    const plan = createCalibrationPlan();
    const redirected = () => {
      const response = new Response(JSON.stringify({ result: ['1', '2'] }), { status: 200 });
      Object.defineProperty(response, 'redirected', { value: true });
      return Promise.resolve(response);
    };
    const crossOrigin = () => {
      const response = new Response(JSON.stringify({ result: ['1', '2'] }), { status: 200 });
      Object.defineProperty(response, 'url', { value: 'https://other.upstash.io/' });
      return Promise.resolve(response);
    };
    const oversized = () => Promise.resolve(new Response(JSON.stringify({ result: 'x'.repeat(5000) }), { status: 200 }));
    const malformed = () => Promise.resolve(new Response('{not json', { status: 200 }));
    for (const probe of [redirected, crossOrigin, oversized, malformed]) {
      const mock = redisMock(plan, { probe });
      expect(await run(plan, mock)).toMatchObject({ reason: 'probe_failed', restRequests: 1, write: 'not_dispatched' });
    }
  });

  it('deadline 不足以容納 write＋verify＋cleanup 時不開始 write', async () => {
    const plan = createCalibrationPlan();
    let t = 0;
    const mock = redisMock(plan, { probe: () => { t = 15000; return ok(['1', '2']); } });
    const report = await run(plan, mock, {}, () => t);
    expect(report).toMatchObject({ reason: 'deadline', restRequests: 1, write: 'not_dispatched', cleanup: 'not_needed' });
  });
});

describe('005 Redis 校準 caller：兩階段中斷、unknown 與清理', () => {
  it('啟動前已中斷：不讀秘密、零 fetch', async () => {
    const plan = createCalibrationPlan();
    const mock = redisMock(plan);
    const stop = new AbortController(); stop.abort();
    const readSecrets = vi.fn(secrets);
    const report = await run(plan, mock, { stopSignal: stop.signal }, () => 0, readSecrets);
    expect(report).toMatchObject({ reason: 'interrupted', restRequests: 0 });
    expect(readSecrets).not.toHaveBeenCalled();
    expect(mock.fetchMock).not.toHaveBeenCalled();
  });

  it('第一段中斷於 probe：不派送 write，無需清理', async () => {
    const plan = createCalibrationPlan();
    const stop = new AbortController();
    const mock = redisMock(plan, { probe: () => { stop.abort(); return ok(['1', '2']); } });
    const report = await run(plan, mock, { stopSignal: stop.signal });
    expect(report).toMatchObject({ reason: 'interrupted', restRequests: 1, write: 'not_dispatched',
      cleanup: 'not_needed', manualFollowUp: false });
  });

  it('第一段中斷於 write：仍做一次唯讀核對並 exact 清理已確認 marker，但 status 不是 completed', async () => {
    const plan = createCalibrationPlan();
    const stop = new AbortController();
    const mock = redisMock(plan, { write: (ctx) => { stop.abort(); return ok(defaultRedis('write', ctx)); } });
    const report = await run(plan, mock, { stopSignal: stop.signal });
    expect(mock.ops()).toEqual(['probe', 'write', 'verify', 'cleanup']);
    expect(report).toMatchObject({ status: 'stopped', reason: 'interrupted', write: 'written_confirmed', cleanup: 'cleaned' });
  });

  it('第二段中斷於 in-flight write：write unknown、不再確認／清理、標記人工追蹤', async () => {
    const plan = createCalibrationPlan();
    const stop = new AbortController(), abort = new AbortController();
    const mock = redisMock(plan, { write: () => { stop.abort(); abort.abort(); return hang(); } });
    const report = await run(plan, mock, { stopSignal: stop.signal, abortSignal: abort.signal });
    expect(mock.ops()).toEqual(['probe', 'write']);
    expect(report).toMatchObject({ reason: 'aborted', write: 'unknown', cleanup: 'withheld_unresolved',
      manualFollowUp: true, operations: { write: 'unknown', verify: 'not_dispatched' } });
  });

  it('write timeout 不重送；marker 不存在時仍保留 unknown、不清理', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const plan = createCalibrationPlan();
    const mock = redisMock(plan, { write: hang });
    const pending = run(plan, mock);
    await vi.advanceTimersByTimeAsync(2000);
    const report = await pending;
    expect(mock.ops()).toEqual(['probe', 'write', 'verify']);
    expect(report).toMatchObject({ reason: 'write_unresolved', write: 'unknown', cleanup: 'withheld_unresolved',
      observedPttlMs: -2, manualFollowUp: true, operations: { write: 'unknown', verify: 'absent' } });
  });

  it('write 回應不明但 marker GET＋PTTL 相符：只據 marker 確認寫入後 exact 清理', async () => {
    const plan = createCalibrationPlan();
    const mock = redisMock(plan, { write: (ctx) => {
      defaultRedis('write', ctx);
      return Promise.resolve(new Response('upstream unavailable', { status: 503 }));
    } });
    const report = await run(plan, mock);
    expect(mock.ops()).toEqual(['probe', 'write', 'verify', 'cleanup']);
    expect(report).toMatchObject({ status: 'completed', write: 'written_confirmed', cleanup: 'cleaned',
      operations: { write: 'unknown', verify: 'present' } });
  });

  it.each([
    ['marker 不符', [2, 50000], 'mismatch'],
    ['已寫入卻不存在／到期', [0, -2], 'absent'],
    ['PTTL 無到期', [1, -1], 'ttl_invalid'],
    ['PTTL 超過 TTL', [1, 60001], 'ttl_invalid'],
  ])('完成的 write 遇 %s：矛盾、不清理、不重寫', async (_label, result, verify) => {
    const plan = createCalibrationPlan();
    const mock = redisMock(plan, { verify: () => ok(result) });
    const report = await run(plan, mock);
    expect(mock.ops()).toEqual(['probe', 'write', 'verify']);
    expect(report).toMatchObject({ reason: 'contradiction', write: 'completed_unverified',
      cleanup: 'withheld_unresolved', operations: { verify } });
    expect(mock.store.size).toBe(1);
  });

  it('確認本身逾時：保留 unknown，不推論未寫入、不清理', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const plan = createCalibrationPlan();
    const mock = redisMock(plan, { write: () => Promise.resolve(new Response('', { status: 500 })), verify: hang });
    const pending = run(plan, mock);
    await vi.advanceTimersByTimeAsync(2000);
    const report = await pending;
    expect(mock.ops()).toEqual(['probe', 'write', 'verify']);
    expect(report).toMatchObject({ reason: 'confirmation_unknown', write: 'unknown', cleanup: 'withheld_unresolved' });
  });

  it('write NX 衝突：key 非本批所有，不核對、不刪除', async () => {
    const plan = createCalibrationPlan();
    const mock = redisMock(plan);
    mock.store.set(plan.inventory[0], { value: 'foreign', ttl: 1000 });
    const report = await run(plan, mock);
    expect(mock.ops()).toEqual(['probe', 'write']);
    expect(report).toMatchObject({ reason: 'write_conflict', write: 'conflict_not_ours', cleanup: 'not_ours',
      manualFollowUp: true });
    expect(mock.store.get(plan.inventory[0])?.value).toBe('foreign');
  });

  it.each([
    ['逾時', 'timeout', 'unknown'],
    ['marker 不符', 2, 'mismatch'],
    ['已不存在', 0, 'absent'],
    ['HTTP 錯誤', 'http', 'unknown'],
  ])('清理%s：不重試、如實回報且需人工追蹤', async (_label, outcome, cleanup) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const plan = createCalibrationPlan();
    const mock = redisMock(plan, { cleanup: () => outcome === 'timeout' ? hang() :
      outcome === 'http' ? Promise.resolve(new Response('', { status: 502 })) : ok(outcome) });
    const pending = run(plan, mock);
    await vi.advanceTimersByTimeAsync(2000);
    const report = await pending;
    expect(mock.ops()).toEqual(['probe', 'write', 'verify', 'cleanup']);
    expect(report).toMatchObject({ status: 'stopped', reason: 'cleanup_unconfirmed', cleanup, manualFollowUp: true,
      write: 'written_confirmed' });
  });

  it('逾時後晚到的 write 結果不追加任何派送或狀態異動', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const plan = createCalibrationPlan();
    let deliver: (() => void) | undefined;
    const mock = redisMock(plan, { write: (ctx) => new Promise<Response>((resolveLate) => {
      deliver = () => { defaultRedis('write', ctx); resolveLate(new Response(JSON.stringify({ result: 1 }), { status: 200 })); };
    }) });
    const pending = run(plan, mock);
    await vi.advanceTimersByTimeAsync(2000);
    const report = await pending;
    const snapshot = JSON.stringify(report);
    expect(report).toMatchObject({ reason: 'write_unresolved', cleanup: 'withheld_unresolved' });
    deliver!();
    await vi.advanceTimersByTimeAsync(5000);
    expect(mock.fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(report)).toBe(snapshot);
    expect(Object.isFrozen(report.operations)).toBe(true);
    expect(mock.store.size).toBe(1);
  });
});

describe('005 Redis 校準 caller：CLI 與無回顯秘密輸入', () => {
  function fakeTty(chunks: string[], isTTY = true) {
    const emitter = new EventEmitter();
    const raw: boolean[] = [];
    const input: HiddenPromptInput = {
      isTTY,
      setRawMode: (mode: boolean) => raw.push(mode),
      setEncoding: () => undefined,
      on: (event, listener) => emitter.on(event, listener),
      off: (event, listener) => emitter.off(event, listener),
      resume: () => { const next = chunks.shift(); if (next !== undefined) queueMicrotask(() => emitter.emit('data', next)); },
      pause: () => undefined,
    };
    return { input, raw };
  }

  it('TTY 無回顯讀取 URL／token，輸出只含提示；非 TTY 與取消拒絕', async () => {
    const written: string[] = [];
    const output = { write: (t: string) => written.push(t) };
    const tty = fakeTty([`${SYNTH_URL}\r`, `${SYNTH_TOKEN}x\u007f\n`]);
    await expect(promptCredentials({ input: tty.input, output })).resolves.toEqual({ url: SYNTH_URL, token: SYNTH_TOKEN });
    expect(written.join('')).not.toContain(SYNTH_TOKEN);
    expect(written.join('')).not.toContain(SYNTH_HOST);
    expect(tty.raw).toEqual([true, false, true, false]);
    await expect(promptHidden('x', { input: fakeTty([], false).input, output }))
      .rejects.toThrow('CALIBRATION_SECRET_PROMPT_REQUIRES_TTY');
    await expect(promptHidden('x', { input: fakeTty(['abc\u0003']).input, output }))
      .rejects.toThrow('CALIBRATION_SECRET_PROMPT_CANCELLED');
  });

  it('execute 需精確 template digest；不符時不讀秘密、不派送', async () => {
    const readSecrets = vi.fn(secrets);
    const fetchSpy = vi.fn();
    const err: string[] = [];
    const io = { stdout: { write: () => undefined }, stderr: { write: (t: string) => err.push(t) },
      fetch: fetchSpy as unknown as typeof fetch, readSecrets };
    expect(await main(['--execute', `--plan-digest=${'0'.repeat(64)}`], io)).toBe(2);
    expect(await main(['--execute'], io)).toBe(2);
    expect(await main(['--dry-run', 'extra'], io)).toBe(2);
    expect(err).toEqual(['CALIBRATION_PLAN_DIGEST_MISMATCH\n', 'CALIBRATION_ARGUMENTS_INVALID\n', 'CALIBRATION_ARGUMENTS_INVALID\n']);
    expect(readSecrets).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('execute（mock fetch）成功時 exit 0 並輸出 allowlist report', async () => {
    const out: string[] = [];
    // mock 以固定 script 辨識 operation，與 execute 重新產生的 namespace 無關。
    const mock = redisMock(createCalibrationPlan());
    const io = { stdout: { write: (t: string) => out.push(t) }, stderr: { write: () => undefined },
      fetch: mock.fetch, readSecrets: secrets };
    expect(await main(['--execute', `--plan-digest=${CALIBRATION_TEMPLATE_DIGEST}`], io)).toBe(0);
    const report = JSON.parse(out[0]);
    expect(new Set(mock.calls.map((call) => call.body[3]))).toEqual(new Set(report.inventory));
    expect(report).toMatchObject({ mode: 'execute', status: 'completed', restRequests: 4, logicalCommandsUpperBound: 10 });
    expect(Object.keys(report).sort()).toEqual(['billableUpperBound', 'cleanup', 'evidence', 'inventory',
      'logicalCommandsMax', 'logicalCommandsUpperBound', 'manualFollowUp', 'mode', 'namespace', 'observedPttlMs',
      'operations', 'providerMetering', 'reason', 'restRequests', 'restRequestsMax', 'scope', 'status',
      'templateDigest', 'write'].sort());
  });
});
