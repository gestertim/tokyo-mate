import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaidFeatureQuotaBanner } from './PaidFeatureQuotaBanner';
import { AdminOverviewScreen } from './admin/AdminOverviewScreen';
import type { OwnQuotaView } from '../types/access';

const quota: OwnQuotaView = {
  tier: 'tier1', currency: 'USD', timezone: 'Asia/Taipei',
  daily: { limitEstimatedUsd: '3.00', usedEstimatedUsd: '0.45', reservedEstimatedUsd: '0.10',
    remainingEstimatedUsd: '2.45', resetAt: '2026-10-06T16:00:00.000Z' },
  weekly: { baseLimitEstimatedUsd: '15.00', activeTopUpEstimatedUsd: '0.00',
    limitEstimatedUsd: '15.00', usedEstimatedUsd: '2.30', reservedEstimatedUsd: '0.10',
    remainingEstimatedUsd: '12.60', resetAt: '2026-10-11T16:00:00.000Z' },
};

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-06T02:00:00.000Z'));
});
afterEach(() => vi.restoreAllMocks());

describe('L4 額度／管理者 UI（query 不是 grant）', () => {
  it('顯示可信估算金額／重置與週追加不改日上限，只查詢不觸發付費操作', async () => {
    const load = vi.fn(async () => quota);
    const publicAction = vi.fn();
    render(<PaidFeatureQuotaBanner load={load} onOpenPublic={publicAction} />);
    expect(await screen.findByRole('heading', { name: '第一級估算額度' })).toBeInTheDocument();
    expect(screen.getByText(/剩餘 US\$2.45/)).toBeInTheDocument();
    expect(screen.getByText(/週追加不會提高今日上限/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '查看東京百科' }));
    expect(publicAction).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('離線／重新查詢清除舊金額；較晚返回的舊 Promise 不覆蓋新狀態', async () => {
    let late: (data: OwnQuotaView) => void = () => {};
    const load = vi.fn<(_: AbortSignal | undefined) => Promise<OwnQuotaView>>()
      .mockImplementationOnce(() => new Promise((resolve) => { late = resolve; }))
      .mockResolvedValueOnce({ ...quota, tier: 'tier2' });
    render(<PaidFeatureQuotaBanner load={load} onOpenPublic={vi.fn()} />);
    fireEvent(window, new Event('focus'));
    expect(await screen.findByRole('heading', { name: '第二級估算額度' })).toBeInTheDocument();
    await act(async () => { late(quota); });
    expect(screen.queryByRole('heading', { name: '第一級估算額度' })).not.toBeInTheDocument();
    fireEvent(window, new Event('offline'));
    expect(screen.getByRole('alert')).toHaveTextContent('目前離線');
    expect(screen.queryByText(/剩餘 US\$2.45/)).not.toBeInTheDocument();
  });
  it('管理者 query 失敗不顯示統計、不自動重送異動', async () => {
    const load = vi.fn().mockRejectedValue(new Error('此帳號無管理者權限。'));
    render(<AdminOverviewScreen load={load} onBack={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('無管理者權限');
    expect(screen.queryByRole('heading', { name: '核准狀態' })).not.toBeInTheDocument();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  });
});
