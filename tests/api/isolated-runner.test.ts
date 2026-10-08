// @vitest-environment node
import * as childProcess from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runIsolatedBatches, validateRunnerPlan, type RunnerPorts } from '../../scripts/005-isolated-runner.mjs';
import { isolatedEnvironmentFixture } from '../fixtures/isolated-environment-fixture';

vi.mock('node:child_process', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:child_process')>(),
}));
afterEach(() => { vi.restoreAllMocks(); });

function controlledBarrier(beforeReplies: () => void, afterReplies: (workers: childProcess.ChildProcess[]) => void = () => {}) {
  const workers = [new childProcess.ChildProcess(), new childProcess.ChildProcess()];
  let releases = 0;
  workers.forEach((worker, slot) => {
    Object.defineProperty(worker, 'pid', { value: 1000 + slot });
    Object.defineProperty(worker, 'connected', { value: true });
    const reply = (type: string, sequence: number) => worker.emit('message', { type, slot, sequence });
    worker.send = (message: childProcess.Serializable) => {
      if (typeof message !== 'object' || message === null || !('type' in message) || !('sequence' in message) ||
          typeof message.sequence !== 'number') throw new Error('TEST_ONLY_IPC_INVALID');
      const sequence = message.sequence;
      if (message.type === 'init') queueMicrotask(() => reply('ready', sequence));
      if (message.type === 'release' && ++releases === 2) queueMicrotask(() => {
        beforeReplies();
        workers.forEach((client, clientSlot) => client.emit('message', { type: 'execute', slot: clientSlot, sequence }));
        afterReplies(workers);
      });
      if (message.type === 'result') queueMicrotask(() => reply('done', sequence));
      return true;
    };
    vi.spyOn(worker, 'kill').mockImplementation(() => { worker.emit('exit', 0, null); return true; });
  });
  vi.spyOn(childProcess, 'fork').mockReturnValueOnce(workers[0]).mockReturnValueOnce(workers[1]);
}

function fixture() {
  const plan = isolatedEnvironmentFixture().runner;
  const clients: { slot: number; sequence: number; processId: number }[] = [];
  const ports: RunnerPorts = {
    execute: vi.fn<RunnerPorts['execute']>(async (client) => { clients.push(client); return 'completed'; }),
    confirm: vi.fn<RunnerPorts['confirm']>(async () => 'confirmed'),
    usage: vi.fn(async () => 0),
    cleanup: vi.fn<RunnerPorts['cleanup']>(async () => 'cleaned'),
  };
  return { plan, ports, clients };
}
describe('D14有界runner：實際雙process，非Redis跨instance證據', () => {
  it('兩個獨立process在barrier後派送有限batch，report不含process／payload', async () => {
    const f = fixture(), report = await runIsolatedBatches(f.plan, f.ports);
    expect(report).toMatchObject({ status: 'completed', batches: 2, dispatched: 4, unknown: 0, cleanup: 'cleaned',
      evidence: 'local_process_substitute' });
    expect(new Set(f.clients.map((c) => c.processId)).size).toBe(2);
    expect(f.clients.map((c) => c.slot)).toEqual([0, 1, 0, 1]);
    expect(f.clients.every((c) => c.processId !== process.pid)).toBe(true);
    expect(f.ports.cleanup).toHaveBeenCalledWith(f.plan.inventory, expect.any(AbortSignal));
    expect(report.chargedUpperBound).toBe(400 + 6 + f.plan.inventory.length * 5);
    expect(JSON.stringify(report)).not.toMatch(/processId|token|cookie|nonce|key|subject|code/);
  });
  it('unknown停止新batch，不retry／refund／regrant，只走獨立readonly確認', async () => {
    const f = fixture();
    vi.mocked(f.ports.execute).mockResolvedValue('unknown');
    const report = await runIsolatedBatches(f.plan, f.ports);
    expect(report).toMatchObject({ status: 'stopped', reason: 'unknown', batches: 1, dispatched: 2, unknown: 2, confirmed: 2 });
    expect(f.ports.execute).toHaveBeenCalledTimes(2);
    expect(f.ports.confirm).toHaveBeenCalledTimes(2);
    expect(report.chargedUpperBound).toBe(200 + 2 + 20 + f.plan.inventory.length * 5);
  });
  it('operation timeout不重試；readonly仍unknown時不清除可能晚到寫入的inventory', async () => {
    const f = fixture();
    vi.mocked(f.ports.execute).mockImplementation(async () => new Promise(() => {}));
    vi.mocked(f.ports.confirm).mockResolvedValue('unknown');
    const report = await runIsolatedBatches(f.plan, f.ports);
    expect(report).toMatchObject({ reason: 'unknown', unknown: 2, confirmed: 0, cleanup: 'unknown' });
    expect(f.ports.execute).toHaveBeenCalledTimes(2);
    expect(f.ports.cleanup).not.toHaveBeenCalled();
  });
  it('worker被終止仍不重送已派送操作，停止後有界處理', async () => {
    const f = fixture();
    vi.mocked(f.ports.execute).mockImplementation(async (client) => {
      if (client.slot === 0) process.kill(client.processId);
      return 'completed';
    });
    const report = await runIsolatedBatches(f.plan, f.ports);
    expect(report).toMatchObject({ reason: 'worker_failure', batches: 1, dispatched: 2 });
    expect(f.ports.execute).toHaveBeenCalledTimes(2);
  });
  it('中斷先停止新batch，已派送操作完成後只清理明列inventory', async () => {
    const f = fixture(), controller = new AbortController();
    vi.mocked(f.ports.execute).mockImplementation(async () => { controller.abort(); return 'completed'; });
    expect(await runIsolatedBatches(f.plan, f.ports, controller.signal)).toMatchObject({
      reason: 'interrupted', batches: 1, dispatched: 2, cleanup: 'cleaned' });
    expect(f.ports.execute).toHaveBeenCalledTimes(2);
  });
  it('開始前已中斷，不啟動worker或派送異動', async () => {
    const f = fixture(), controller = new AbortController(); controller.abort();
    expect(await runIsolatedBatches(f.plan, f.ports, controller.signal)).toMatchObject({ reason: 'interrupted', dispatched: 0 });
    expect(f.ports.execute).not.toHaveBeenCalled();
  });
  it('barrier等待期間中斷，兩個execute皆不派送或計量', async () => {
    const f = fixture(), controller = new AbortController();
    controlledBarrier(() => controller.abort());
    const report = await runIsolatedBatches(f.plan, f.ports, controller.signal);
    expect(report).toMatchObject({ reason: 'interrupted', batches: 0, dispatched: 0, unknown: 0, cleanup: 'cleaned' });
    expect(f.ports.execute).not.toHaveBeenCalled();
    expect(f.ports.confirm).not.toHaveBeenCalled();
    expect(report.chargedUpperBound).toBe(f.plan.metering.usage + f.plan.inventory.length * f.plan.metering.cleanupPerKey);
  });
  it('barrier回覆齊全但派送前worker失敗，兩個execute皆不派送', async () => {
    const f = fixture();
    controlledBarrier(() => {}, (workers) => workers[0].emit('exit', 1, null));
    const report = await runIsolatedBatches(f.plan, f.ports);
    expect(report).toMatchObject({ reason: 'worker_failure', batches: 0, dispatched: 0, unknown: 0, cleanup: 'cleaned' });
    expect(f.ports.execute).not.toHaveBeenCalled();
    expect(f.ports.confirm).not.toHaveBeenCalled();
    expect(report.chargedUpperBound).toBe(f.plan.metering.usage + f.plan.inventory.length * f.plan.metering.cleanupPerKey);
  });
  it.each([-1, 0, 1])('barrier後剩餘時間相對operation與收斂預留界線%ims', async (margin) => {
    const f = fixture(); f.plan.maxBatches = 1;
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    const required = f.plan.operationTimeoutMs + f.plan.confirmationReserveMs + f.plan.cleanupReserveMs;
    controlledBarrier(() => clock.mockReturnValue(f.plan.windowMs - required - margin));
    const report = await runIsolatedBatches(f.plan, f.ports);
    expect(report).toMatchObject({ reason: margin <= 0 ? 'deadline' : 'finished',
      dispatched: margin <= 0 ? 0 : 2, batches: margin <= 0 ? 0 : 1, cleanup: 'cleaned' });
    expect(f.ports.execute).toHaveBeenCalledTimes(margin <= 0 ? 0 : 2);
    expect(f.ports.confirm).not.toHaveBeenCalled();
  });
  it.each(['confirmed', 'unknown'] as const)('已派送後中斷且結果unknown，唯讀確認%s保留保守收斂', async (confirmation) => {
    const f = fixture(), controller = new AbortController();
    vi.mocked(f.ports.execute).mockImplementation(async () => { controller.abort(); return 'unknown'; });
    vi.mocked(f.ports.confirm).mockResolvedValue(confirmation);
    const report = await runIsolatedBatches(f.plan, f.ports, controller.signal);
    expect(report).toMatchObject({ reason: 'interrupted', status: 'stopped', batches: 1, dispatched: 2, unknown: 2,
      confirmed: confirmation === 'confirmed' ? 2 : 0, cleanup: confirmation === 'confirmed' ? 'cleaned' : 'unknown' });
    expect(f.ports.execute).toHaveBeenCalledTimes(2);
    expect(f.ports.confirm).toHaveBeenCalledTimes(2);
    expect(f.ports.cleanup).toHaveBeenCalledTimes(confirmation === 'confirmed' ? 1 : 0);
    expect(report.chargedUpperBound).toBe(2 * f.plan.metering.execute + f.plan.metering.usage +
      2 * f.plan.metering.confirm + (confirmation === 'confirmed' ? f.plan.inventory.length * f.plan.metering.cleanupPerKey : 0));
  });
  it.each([
    (p: ReturnType<typeof fixture>['plan']) => { p.totalCommands = 10; },
    (p: ReturnType<typeof fixture>['plan']) => { p.reserves.cleanup = 1; },
    (p: ReturnType<typeof fixture>['plan']) => { p.reserves.confirmation = 1; },
    (p: ReturnType<typeof fixture>['plan']) => { p.reserves.usage = 1; },
    (p: ReturnType<typeof fixture>['plan']) => { p.windowMs = p.operationTimeoutMs + p.cleanupReserveMs + p.confirmationReserveMs; },
    (p: ReturnType<typeof fixture>['plan']) => { p.metering.execute = Infinity; },
    (p: ReturnType<typeof fixture>['plan']) => { p.inventory.push('{preview-foreign}:users'); },
    (p: ReturnType<typeof fixture>['plan']) => { p.inventory.push(`${p.namespace}:*`); },
    (p: ReturnType<typeof fixture>['plan']) => { p.inventory.push(`${p.namespace}:{foreign}:users`); },
  ])('預算／deadline／清理容量或未知上界拒絕 #%#', async (mutate) => {
    const f = fixture(); mutate(f.plan);
    await expect(runIsolatedBatches(f.plan, f.ports)).rejects.toThrow('TEST_ONLY_RUNNER_CONFIG_INVALID');
    expect(f.ports.execute).not.toHaveBeenCalled();
    expect(f.ports.cleanup).not.toHaveBeenCalled();
  });
  it('用量讀取未知或超界不派送下一batch，不輸出provider error', async () => {
    const f = fixture();
    vi.mocked(f.ports.usage).mockResolvedValueOnce(0).mockResolvedValueOnce(10001);
    expect(await runIsolatedBatches(f.plan, f.ports)).toMatchObject({ reason: 'budget', batches: 1 });
    const failed = fixture();
    vi.mocked(failed.ports.usage).mockRejectedValue(new Error('token cookie code nonce key real-subject'));
    const report = await runIsolatedBatches(failed.plan, failed.ports);
    expect(report).toMatchObject({ reason: 'usage_unknown', dispatched: 0 });
    expect(JSON.stringify(report)).not.toMatch(/token|cookie|code|nonce|key|real-subject/);
  });
  it('清理失敗輸出unknown且不宣稱完成，不重新異動', async () => {
    const f = fixture(); vi.mocked(f.ports.cleanup).mockRejectedValue(new Error('secret-cleanup'));
    const report = await runIsolatedBatches(f.plan, f.ports);
    expect(report).toMatchObject({ status: 'stopped', cleanup: 'unknown' });
    expect(f.ports.cleanup).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(report)).not.toContain('secret-cleanup');
  });
  it('validated plan與inventory複製，不讓呼叫端改動清理範圍', () => {
    const f = fixture(), plan = validateRunnerPlan(f.plan);
    f.plan.inventory.push('{preview-foreign}:users');
    expect(plan.inventory).not.toContain('{preview-foreign}:users');
  });
  it('剩餘時間不足派送上界時停止新batch，保留confirmation與cleanup', async () => {
    const f = fixture();
    f.plan.windowMs = 4050;
    vi.mocked(f.ports.usage).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return 0;
    });
    const at = performance.now(), report = await runIsolatedBatches(f.plan, f.ports);
    expect(report).toMatchObject({ reason: 'deadline', dispatched: 0, cleanup: 'cleaned' });
    expect(performance.now() - at).toBeLessThan(f.plan.windowMs);
    expect(f.ports.execute).not.toHaveBeenCalled();
  });
  it('cleanup timeout有界且unknown，不重試清理', async () => {
    const f = fixture(); f.plan.cleanupReserveMs = 100;
    vi.mocked(f.ports.cleanup).mockImplementation(async () => new Promise(() => {}));
    const at = performance.now(), report = await runIsolatedBatches(f.plan, f.ports);
    expect(report).toMatchObject({ cleanup: 'unknown', status: 'stopped' });
    expect(performance.now() - at).toBeLessThan(f.plan.windowMs);
    expect(f.ports.cleanup).toHaveBeenCalledTimes(1);
  });
  it('可信metering含EVAL內部及replication保守上界，不假定每操作計1', async () => {
    const f = fixture(); f.plan.metering.execute = 200;
    f.plan.totalCommands = 1200;
    const report = await runIsolatedBatches(f.plan, f.ports);
    expect(report.dispatched).toBe(4);
    expect(report.chargedUpperBound).toBe(800 + 6 + f.plan.inventory.length * 5);
    expect(report.chargedUpperBound).toBeLessThanOrEqual(f.plan.totalCommands);
  });
});
