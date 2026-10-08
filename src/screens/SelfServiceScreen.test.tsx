import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SelfServiceScreen } from './SelfServiceScreen';
import * as api from '../services/self-service-api';
import { AccessApiError, loadOwnQuota } from '../services/access-api';
import { operationMessages, type OwnRequest } from '../types/self-service';
vi.mock('../services/self-service-api', () => ({
  loadOwnRequests: vi.fn(), submitOwnRequest: vi.fn(), withdrawOwnRequest: vi.fn(), loadOperationStatus: vi.fn(),
}));
vi.mock('../services/access-api', async (original) => ({
  ...await original<typeof import('../services/access-api')>(), loadOwnQuota: vi.fn(),
}));
const review: OwnRequest = { reviewId: 'r1', kind: 'paid_access', reasonCode: 'paid_feature_access',
  createdAt: '2026-10-07T02:00:00.000Z', status: 'pending' };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.submitOwnRequest).mockResolvedValue(review);
  vi.mocked(api.loadOwnRequests).mockResolvedValue({ items: [review], nextOffset: null });
});
afterEach(cleanup);
describe('D10／D11 手動本人UI', () => {
  it('進入／focus不申請不查詢不poll；只有點擊才送出，不提供tier／amount', async () => {
    render(<SelfServiceScreen onBack={vi.fn()} />);
    fireEvent.focus(window);
    Object.values(api).forEach((fn) => expect(fn).not.toHaveBeenCalled());
    expect(loadOwnQuota).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '申請付費資格' }));
    await screen.findByText(/申請待審核/);
    expect(api.submitOwnRequest).toHaveBeenCalledTimes(1);
    expect(api.submitOwnRequest).toHaveBeenCalledWith({
      kind: 'paid_access', reasonCode: 'paid_feature_access', idempotencyKey: expect.any(String),
    }, expect.any(AbortSignal));
    expect(api.loadOwnRequests).not.toHaveBeenCalled();
  });
  it('網路不確定不自動重送；手動確認用同一key，401／409只顯示錯誤', async () => {
    vi.mocked(api.submitOwnRequest).mockRejectedValueOnce(new AccessApiError('NETWORK_ERROR', '請手動查詢，不會自動重送。'));
    render(<SelfServiceScreen onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '申請付費資格' }));
    await screen.findByRole('alert');
    const first = vi.mocked(api.submitOwnRequest).mock.calls[0][0];
    expect(api.submitOwnRequest).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '以相同操作鍵手動確認申請' }));
    await screen.findByText(/申請待審核/);
    expect(vi.mocked(api.submitOwnRequest).mock.calls[1][0]).toEqual(first);
  });
  it('額度耗盡仍手動取得可信週key並申請；reason白名單，不帶金額', async () => {
    vi.mocked(loadOwnQuota).mockResolvedValue({
      tier: 'tier1', currency: 'USD', timezone: 'Asia/Taipei',
      daily: { limitEstimatedUsd: '3.00', usedEstimatedUsd: '0.00', reservedEstimatedUsd: '0.00', remainingEstimatedUsd: '3.00', resetAt: '2026-10-07T16:00:00Z' },
      weekly: { limitEstimatedUsd: '15.00', baseLimitEstimatedUsd: '15.00', activeTopUpEstimatedUsd: '0.00',
        usedEstimatedUsd: '15.00', reservedEstimatedUsd: '0.00', remainingEstimatedUsd: '0.00', resetAt: '2026-10-11T16:00:00Z', weekWindowKey: '2026-W41' },
    });
    render(<SelfServiceScreen onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('申請類型'), { target: { value: 'weekly_top_up' } });
    expect(loadOwnQuota).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '申請本週追加' }));
    await screen.findByText(/申請待審核/);
    expect(api.submitOwnRequest).toHaveBeenCalledWith({
      kind: 'weekly_top_up', reasonCode: 'weekly_limit_review', weekWindowKey: '2026-W41', idempotencyKey: expect.any(String),
    }, expect.any(AbortSignal));
  });
  it('縮頁下一頁沿用server offset，不自動查詢；撤回手動且不重整付費功能', async () => {
    vi.mocked(api.loadOwnRequests).mockResolvedValueOnce({ items: [review], nextOffset: 1 });
    vi.mocked(api.withdrawOwnRequest).mockResolvedValue({ ...review, status: 'withdrawn' });
    render(<SelfServiceScreen onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '查詢本人申請' }));
    await screen.findByRole('button', { name: '撤回 r1' });
    expect(api.loadOwnRequests).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '下一頁' }));
    await waitFor(() => expect(api.loadOwnRequests).toHaveBeenCalledWith(1, expect.any(AbortSignal)));
    await waitFor(() => expect(screen.getByRole('button', { name: '撤回 r1' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '撤回 r1' }));
    await screen.findByText('已撤回申請；撤回不會撤銷已核准權利。');
    expect(api.withdrawOwnRequest).toHaveBeenCalledTimes(1);
    expect(api.loadOwnRequests).toHaveBeenCalledTimes(2);
  });
  it('settled非內容成功；手動一次狀態查詢，離頁取消並忽略晚到', async () => {
    vi.mocked(api.loadOperationStatus).mockResolvedValue({ state: 'settled', updatedAt: review.createdAt, userMessage: operationMessages.settled });
    const view = render(<SelfServiceScreen onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('原操作識別碼'), { target: { value: 'original_key' } });
    fireEvent.click(screen.getByRole('button', { name: '查看操作狀態' }));
    await screen.findByText(/這不代表結果內容已成功取得/);
    expect(api.loadOperationStatus).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(vi.mocked(api.loadOperationStatus).mock.calls[0][2]?.aborted).toBe(false);
    let finish!: (v: { items: OwnRequest[]; nextOffset: null }) => void;
    vi.mocked(api.loadOwnRequests).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const next = render(<SelfServiceScreen onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '查詢本人申請' }));
    const signal = vi.mocked(api.loadOwnRequests).mock.calls.at(-1)![1]!;
    next.unmount(); expect(signal.aborted).toBe(true);
    finish({ items: [review], nextOffset: null });
  });
});
