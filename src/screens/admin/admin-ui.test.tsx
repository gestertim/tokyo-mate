import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminUserListScreen } from './AdminUserListScreen';
import { AdminUserDetailScreen } from './AdminUserDetailScreen';
import { AdminReviewQueueScreen } from './AdminReviewQueueScreen';
import { AdminAuditScreen } from './AdminAuditScreen';
import { AdminMutationPanel } from './AdminMutationPanel';
import { AdminDashboardScreen } from './AdminDashboardScreen';
import * as api from '../../services/admin-api';
vi.mock('../../services/admin-api', async (original) => ({ ...await original<typeof import('../../services/admin-api')>(),
  loadAdminUsers: vi.fn(), loadAdminUserDetail: vi.fn(),
  loadAdminReviews: vi.fn(), loadAdminAudit: vi.fn(), submitAdminMutation: vi.fn(), loadAdminOverviewData: vi.fn() }));
const window = { limitEstimatedUsd: '3.00', usedEstimatedUsd: '0.50', reservedEstimatedUsd: '0.10',
  remainingEstimatedUsd: '2.40', resetAt: '2026-10-11T16:00:00.000Z' };
const user: api.AdminUserDetail = { identitySubject: 'user1', displayName: '測試使用者', status: 'approved', tier: 'tier1',
  daily: window, weekly: { ...window, windowKey: '2026-W41', activeTopUpEstimatedUsd: '15.00' },
  endpointUsage: [{ endpoint: 'places', requestCount: 3, estimatedUsd: '0.15' }],
  topUps: [{ topUpId: 'grant1', amountEstimatedUsd: '15.00', status: 'active', expiresAt: window.resetAt }] };
beforeEach(() => { vi.resetAllMocks(); });
describe('管理清單／詳情／待審核／稽核', () => {
  it('未知權限不顯示管理頁面導航；可信overview之後才顯示獨立導航', async () => {
    vi.mocked(api.loadAdminOverviewData).mockRejectedValueOnce(new Error('需要管理者權限')).mockResolvedValueOnce({
      approvalCounts: { pending: 0, approved: 1, rejected: 0, revoked: 0, expired: 0 },
      estimatedUsage: { dailyUsedEstimatedUsd: '2.40', weeklyUsedEstimatedUsd: '2.40' }, protectionAvailable: true,
      nearLimits: [{ identitySubject: 'user1', window: 'day', usedEstimatedUsd: '2.40', limitEstimatedUsd: '3.00' }],
    });
    render(<AdminDashboardScreen onBack={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('管理者權限');
    expect(screen.queryByRole('navigation', { name: '管理頁面' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '重新確認管理資料' }));
    expect(await screen.findByRole('navigation', { name: '管理頁面' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '接近上限提示' })).toHaveTextContent('user1：日已用估算 US$2.40');
  });
  it('清單只提供最小識別與額度摘要、可選詳情', async () => {
    vi.mocked(api.loadAdminUsers).mockResolvedValue({ items: [user], nextOffset: null });
    const select = vi.fn(); render(<AdminUserListScreen onSelect={select} />);
    await userEvent.click(await screen.findByRole('button', { name: '測試使用者' }));
    expect(select).toHaveBeenCalledWith('user1');
    expect(screen.getByText(/日已用 US\$0.50/)).toBeInTheDocument();
  });
  it('詳情顯示預留、重置與端點摘要；錯誤清除舊資料、不自動重送', async () => {
    vi.mocked(api.loadAdminUserDetail).mockResolvedValueOnce(user).mockRejectedValueOnce(new Error('管理者權限已撤銷。'));
    render(<AdminUserDetailScreen subject="user1" />);
    expect(await screen.findByText(/places：3 次/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '日估算額度' })).toHaveTextContent('預留 US$0.10');
    await userEvent.click(screen.getByRole('button', { name: '重新確認詳情' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('權限已撤銷');
    expect(screen.queryByText(/places：3 次/)).not.toBeInTheDocument();
    expect(api.submitAdminMutation).not.toHaveBeenCalled();
  });
  it('待審核帶reviewId進入確認流程', async () => {
    const review: api.AdminReview = { reviewId: 'review1', targetIdentitySubject: 'user1', kind: 'weekly_top_up',
      status: 'pending', createdAt: '2026-10-06T02:00:00Z' };
    vi.mocked(api.loadAdminReviews).mockResolvedValue({ items: [review], nextOffset: null });
    const onReview = vi.fn(); render(<AdminReviewQueueScreen onReview={onReview} />);
    await userEvent.click(await screen.findByRole('button', { name: '檢視並審核' }));
    expect(onReview).toHaveBeenCalledWith(review);
  });
  it('成功異動刷新詳情後，焦點留在可鍵盤操作的詳情確認按鈕', async () => {
    vi.mocked(api.loadAdminUserDetail).mockResolvedValue({ ...user, status: 'pending', tier: null });
    vi.mocked(api.submitAdminMutation).mockResolvedValue({ outcome: 'applied', auditId: 'TEST_ONLY_AUDIT' });
    render(<AdminUserDetailScreen subject="user1" />);
    await userEvent.click(await screen.findByRole('button', { name: '檢視並確認異動' }));
    await userEvent.click(screen.getByRole('button', { name: '確認送出異動' }));
    await waitFor(() => expect(api.loadAdminUserDetail).toHaveBeenCalledTimes(2));
    await screen.findByRole('button', { name: '檢視並確認異動' });
    expect(screen.getByRole('button', { name: '重新確認詳情' })).toHaveFocus();
    expect(api.submitAdminMutation).toHaveBeenCalledTimes(1);
  });
  it('稽核顯示操作者、最小前後狀態與週累計', async () => {
    vi.mocked(api.loadAdminAudit).mockResolvedValue({ items: [{ auditId: 'audit1', idempotencyKey: 'key1',
      adminSubject: 'admin1', targetIdentitySubject: 'user1', action: 'top_up', createdAt: '2026-10-06T02:00:00Z',
      reasonCode: 'weekly_limit_review', before: { cumulativeWeeklyTopUpMicroUsd: 0 },
      after: { status: 'active', cumulativeWeeklyTopUpMicroUsd: 15_000_000 },
      weekWindowKey: '2026-W41', expiresAt: window.resetAt, amountEstimatedUsd: '15.00', scope: 'all_protected_endpoints' }], nextOffset: null });
    render(<AdminAuditScreen />);
    expect(await screen.findByText(/操作後同週累計 US\$15.00/)).toBeInTheDocument();
    expect(screen.getByText(/管理者 admin1/)).toBeInTheDocument();
  });
});
describe('明確二次確認與冪等鍵', () => {
  it('追加不在確認前送出、未知結果保留同鍵手動確認，不自動重送', async () => {
    vi.mocked(api.submitAdminMutation).mockRejectedValueOnce(new Error('無法確認異動結果')).mockResolvedValueOnce({ outcome: 'duplicate', auditId: 'audit1' });
    const onComplete = vi.fn();
    render(<AdminMutationPanel user={user} reviewId="review1" reviewKind="weekly_top_up" onComplete={onComplete} />);
    await userEvent.type(screen.getByLabelText('追加金額（US$）'), '15.00');
    await userEvent.click(screen.getByRole('button', { name: '檢視並確認異動' }));
    expect(api.submitAdminMutation).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('日上限不變');
    await userEvent.click(screen.getByRole('button', { name: '確認送出異動' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('無法確認');
    await waitFor(() => expect(api.submitAdminMutation).toHaveBeenCalledTimes(1));
    const first = vi.mocked(api.submitAdminMutation).mock.calls[0][0];
    expect(first).toMatchObject({ reviewId: 'review1', weekWindowKey: '2026-W41', expiresAt: window.resetAt,
      amountEstimatedUsd: '15.00', scope: 'all_protected_endpoints', confirmed: true });
    await userEvent.click(screen.getByRole('button', { name: '以相同操作鍵手動確認異動' }));
    expect(api.submitAdminMutation).toHaveBeenNthCalledWith(2, first, expect.any(AbortSignal));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('status')).toHaveTextContent('未重複套用');
  });
  it('拒絕不合法金額、取消確認不異動；撤銷追加提示不追溯', async () => {
    render(<AdminMutationPanel user={user} onComplete={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText('操作'), 'top_up');
    await userEvent.click(screen.getByRole('button', { name: '檢視並確認異動' }));
    expect(screen.getByRole('alert')).toHaveTextContent('正值金額');
    await userEvent.selectOptions(screen.getByLabelText('操作'), 'top_up_revoke');
    await userEvent.click(screen.getByRole('button', { name: '檢視並確認異動' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('不取消既有預留');
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(api.submitAdminMutation).not.toHaveBeenCalled();
  });
});
