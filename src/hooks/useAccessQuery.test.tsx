import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAccessQuery } from './useAccessQuery';
const data = { allowed: true, resetAt: Date.parse('2026-10-08T00:00:00Z') };
const expiry = (value: typeof data) => value.resetAt;
function View({ load }: { load: (signal?: AbortSignal) => Promise<typeof data> }) {
  const { state } = useAccessQuery(load, { expiresAt: expiry });
  return <p>{state.status === 'ready' ? 'eligible' : state.status}</p>;
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe('D09 共享快照 freshness', () => {
  it('29999ms仍有效／30000ms失效，不自動查詢', async () => {
    vi.useFakeTimers(); vi.setSystemTime('2026-10-07T01:00:00Z');
    const load = vi.fn(async () => data);
    await act(async () => { render(<View load={load} />); });
    await act(async () => { vi.advanceTimersByTime(29999); });
    expect(screen.getByText('eligible')).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('後端reset較早時立即到期，沒有恢復授權的假象', async () => {
    vi.useFakeTimers(); vi.setSystemTime(data.resetAt - 10);
    const load = vi.fn(async () => data);
    await act(async () => { render(<View load={load} />); });
    await act(async () => { vi.advanceTimersByTime(10); });
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('pageshow／pagehide使舊回應無效，恢復只查免費狀態', async () => {
    vi.useFakeTimers(); vi.setSystemTime('2026-10-07T01:00:00Z');
    let late!: (value: typeof data) => void;
    const load = vi.fn().mockImplementationOnce(() => new Promise<typeof data>((r) => { late = r; }))
      .mockResolvedValue(data);
    await act(async () => { render(<View load={load} />); });
    fireEvent(window, new Event('pagehide'));
    await act(async () => { late(data); });
    expect(screen.getByText('loading')).toBeInTheDocument();
    await act(async () => { fireEvent(window, new Event('pageshow')); });
    expect(screen.getByText('eligible')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('讀取期間時鐘倒退不能採用回應', async () => {
    vi.useFakeTimers(); vi.setSystemTime('2026-10-07T01:00:00Z');
    let late!: (value: typeof data) => void;
    const load = vi.fn(() => new Promise<typeof data>((r) => { late = r; }));
    await act(async () => { render(<View load={load} />); });
    vi.setSystemTime('2026-10-07T00:59:59Z');
    await act(async () => { late(data); });
    expect(screen.getByText('error')).toBeInTheDocument();
  });
});
