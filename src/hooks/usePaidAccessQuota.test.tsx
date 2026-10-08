import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaidFeatureQuotaBanner } from '../screens/PaidFeatureQuotaBanner';
import { AccessApiError } from '../services/access-api';
import type { OwnQuotaView } from '../types/access';

const quota: OwnQuotaView = {
  tier: 'tier1', currency: 'USD', timezone: 'Asia/Taipei',
  daily: { limitEstimatedUsd: '3.00', usedEstimatedUsd: '0.45', reservedEstimatedUsd: '0.10',
    remainingEstimatedUsd: '2.45', resetAt: '2026-10-06T16:00:00.000Z' },
  weekly: { baseLimitEstimatedUsd: '15.00', activeTopUpEstimatedUsd: '0.00',
    limitEstimatedUsd: '15.00', usedEstimatedUsd: '2.30', reservedEstimatedUsd: '0.10',
    remainingEstimatedUsd: '12.60', resetAt: '2026-10-11T16:00:00.000Z' },
};
const freshness = { maxAgeMs: 1000, now: () => Date.parse('2026-10-06T02:00:00.000Z') };
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('可信額度 UX（時間限制為注入 fixture，不是正式政策）', () => {
  it('TTL 到期隱藏舊剩餘金額，不猜恢復、不自動查詢或送付費操作', async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => quota);
    await act(async () => {
      render(<PaidFeatureQuotaBanner load={load} freshness={freshness} onOpenPublic={vi.fn()} />);
    });
    expect(screen.getByText(/剩餘 US\$2.45/)).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(freshness.maxAgeMs); });
    expect(screen.queryByText(/剩餘 US\$/)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('無法確認最新額度');
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('後端 resetAt 只使舊快照失效，不代表額度恢復', async () => {
    vi.useFakeTimers();
    const policy = { maxAgeMs: 5000, now: () => Date.parse(quota.daily.resetAt) - 10 };
    const load = vi.fn(async () => quota);
    await act(async () => {
      render(<PaidFeatureQuotaBanner load={load} freshness={policy} onOpenPublic={vi.fn()} />);
    });
    await act(async () => { vi.advanceTimersByTime(10); });
    expect(screen.queryByText(/剩餘 US\$/)).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/額度已恢復/)).not.toBeInTheDocument();
  });
  it('啟動時已離線不查詢，手動刷新亦不採用舊快照', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const load = vi.fn(async () => quota);
    await act(async () => {
      render(<PaidFeatureQuotaBanner load={load} freshness={freshness} onOpenPublic={vi.fn()} />);
    });
    fireEvent.click(screen.getByRole('button', { name: '重新確認額度' }));
    expect(load).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('目前離線');
    expect(screen.queryByText(/剩餘 US\$/)).not.toBeInTheDocument();
  });
  it('offline 中舊 Promise 晚到不得恢復金額；online 只刷新 quota', async () => {
    let late: (data: OwnQuotaView) => void = () => {};
    const load = vi.fn().mockImplementationOnce(() => new Promise<OwnQuotaView>((resolve) => { late = resolve; }))
      .mockResolvedValueOnce({ ...quota, tier: 'tier2' });
    await act(async () => {
      render(<PaidFeatureQuotaBanner load={load} freshness={freshness} onOpenPublic={vi.fn()} />);
    });
    fireEvent(window, new Event('offline'));
    await act(async () => { late(quota); });
    expect(screen.getByRole('alert')).toHaveTextContent('目前離線');
    expect(screen.queryByText(/剩餘 US\$/)).not.toBeInTheDocument();
    await act(async () => { fireEvent(window, new Event('online')); });
    expect(screen.getByRole('heading', { name: '第二級估算額度' })).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('背景隱藏立即失效，返回只重新查詢且忽略晚到舊結果', async () => {
    const visible = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    let late: (data: OwnQuotaView) => void = () => {};
    const load = vi.fn().mockResolvedValueOnce(quota)
      .mockImplementationOnce(() => new Promise<OwnQuotaView>((resolve) => { late = resolve; }))
      .mockResolvedValueOnce({ ...quota, tier: 'tier2' });
    await act(async () => {
      render(<PaidFeatureQuotaBanner load={load} freshness={freshness} onOpenPublic={vi.fn()} />);
    });
    fireEvent.click(screen.getByRole('button', { name: '重新確認額度' }));
    visible.mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    visible.mockReturnValue('visible');
    await act(async () => { fireEvent(document, new Event('visibilitychange')); });
    await act(async () => { late(quota); });
    expect(screen.getByRole('heading', { name: '第二級估算額度' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '第一級估算額度' })).not.toBeInTheDocument();
  });
  it('重查失敗／未知資料清除先前可見金額', async () => {
    const load = vi.fn().mockResolvedValueOnce(quota).mockResolvedValueOnce({ tier: 'tier1' });
    await act(async () => {
      render(<PaidFeatureQuotaBanner load={load} freshness={freshness} onOpenPublic={vi.fn()} />);
    });
    expect(screen.getByText(/剩餘 US\$2.45/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重新確認額度' })); });
    expect(screen.queryByText(/剩餘 US\$/)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('無法確認最新額度');
  });
  it('bfcache pagehide 隱藏快照；pageshow 查詢失敗不能恢復舊可用金額', async () => {
    const load = vi.fn().mockResolvedValueOnce(quota).mockRejectedValueOnce(new Error('FIXTURE_UNAVAILABLE'));
    await act(async () => {
      render(<PaidFeatureQuotaBanner load={load} freshness={freshness} onOpenPublic={vi.fn()} />);
    });
    fireEvent(window, new Event('pagehide'));
    expect(screen.queryByText(/剩餘 US\$/)).not.toBeInTheDocument();
    await act(async () => { fireEvent(window, new Event('pageshow')); });
    expect(screen.getByRole('alert')).toHaveTextContent('無法確認最新額度');
    expect(screen.queryByText(/剩餘 US\$/)).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
  it.each(['request', 'all'] as const)('%s 使用後端精確文案，不自行分類 G 或建立全站停用狀態', async (quotaScope) => {
    const message = quotaScope === 'request' ?
      '今日／本週剩餘額度不足以預留這次操作，僅本次操作無法執行；其他功能仍會依各自的資格、額度及防護狀態判斷是否可用。' :
      '今日額度尚未用完，但剩餘額度不足目前可用付費功能的預留門檻，付費功能暫時無法使用。你仍可查看公開內容。';
    const load = vi.fn().mockRejectedValue(new AccessApiError('DAILY_QUOTA_EXHAUSTED', message,
      { quotaScope, userTitle: quotaScope === 'request' ? '今日剩餘額度不足以處理這次請求' : '今日剩餘額度不足預留門檻' }));
    const publicAction = vi.fn();
    await act(async () => {
      render(<PaidFeatureQuotaBanner load={load} freshness={freshness} onOpenPublic={publicAction} />);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText(/額度已滿/)).not.toBeInTheDocument();
    expect(screen.queryByText(/剩餘 US\$/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看東京百科' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '查看東京百科' }));
    expect(publicAction).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it.each(['DUPLICATE_REQUEST', 'IDEMPOTENCY_CONFLICT'])('409 %s 只有提示，不產生狀態查詢動作', async (code) => {
    const message = code === 'DUPLICATE_REQUEST' ? '此操作已送出，請查看目前狀態。' : '操作識別碼與原請求不一致，請重新確認操作。';
    const load = vi.fn().mockRejectedValue(new AccessApiError(code, message));
    await act(async () => {
      render(<PaidFeatureQuotaBanner load={load} freshness={freshness} onOpenPublic={vi.fn()} />);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('button', { name: '查看目前狀態' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '查看目前狀態' })).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
