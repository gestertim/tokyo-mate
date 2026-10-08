// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createRedisAtomicTransport } from '../../api/_lib/redis-atomic-transport';

describe('T019 transport 隔離子範圍（未執行 Lua／Redis）', () => {
  it('registry／資格／追加／日週 keys 同一 hash-tag，只執行同次 EVAL', async () => {
    const evalMock = vi.fn(async () => ({ status: 'FIXTURE_NOT_A_GRANT' }));
    const keys = ['{FIXTURE_005}:registry', '{FIXTURE_005}:eligibility', '{FIXTURE_005}:topups',
      '{FIXTURE_005}:day', '{FIXTURE_005}:week'];
    const driver = createRedisAtomicTransport({ keys, timeoutMs: 20, audit: vi.fn(), transport: { eval: evalMock } });
    expect(await driver.execute('return ARGV[1]', { expectedRevision: 1 })).toEqual({ status: 'FIXTURE_NOT_A_GRANT' });
    expect(evalMock).toHaveBeenCalledExactlyOnceWith('return ARGV[1]', keys, '{"expectedRevision":1}');
  });
  it('不同 hash-tag 不拆成多次操作；錯誤及 timeout 不重試、不退款', async () => {
    const evalMock = vi.fn(async () => { throw new Error('FIXTURE_DISCONNECT'); });
    expect(() => createRedisAtomicTransport({ keys: ['{one}:registry', '{two}:usage'],
      timeoutMs: 20, audit: vi.fn(), transport: { eval: evalMock } })).toThrow();
    expect(evalMock).not.toHaveBeenCalled();
    const audit = vi.fn();
    const driver = createRedisAtomicTransport({ keys: ['{FIXTURE_005}:state'], timeoutMs: 20,
      audit, transport: { eval: evalMock } });
    await expect(driver.execute('return ARGV[1]', {})).rejects.toThrow();
    evalMock.mockImplementationOnce(() => new Promise(() => {}));
    await expect(driver.execute('return ARGV[1]', {})).rejects.toThrow();
    expect(evalMock).toHaveBeenCalledTimes(2);
    expect(audit).toHaveBeenCalledTimes(2);
  });
});
