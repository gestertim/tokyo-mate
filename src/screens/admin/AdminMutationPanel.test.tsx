import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminMutationPanel } from './AdminMutationPanel';
import { AdminApiError, submitAdminMutation, type AdminMutationResult, type AdminUserDetail } from '../../services/admin-api';

vi.mock('../../services/admin-api', async (original) => ({
  ...await original<typeof import('../../services/admin-api')>(),
  submitAdminMutation: vi.fn(),
}));

const quota = { limitEstimatedUsd: '3.00', usedEstimatedUsd: '0.00', reservedEstimatedUsd: '0.00',
  remainingEstimatedUsd: '3.00', resetAt: '2026-10-11T16:00:00.000Z' };
const user: AdminUserDetail = { identitySubject: 'TEST_ONLY_USER', status: 'pending', tier: null,
  daily: quota, weekly: { ...quota, windowKey: '2026-W41', activeTopUpEstimatedUsd: '0.00' },
  endpointUsage: [], topUps: [] };

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

describe('管理確認的鍵盤操作與未知結果恢復（全部 mock）', () => {
  it('鍵盤開啟時聚焦有名稱的確認區；送出前取消回到原按鈕，不異動', async () => {
    const keyboard = userEvent.setup();
    render(<AdminMutationPanel user={user} onComplete={vi.fn()} />);
    const prepare = screen.getByRole('button', { name: '檢視並確認異動' });
    prepare.focus();
    await keyboard.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: '確認管理異動' })).toHaveFocus();
    await keyboard.tab();
    expect(screen.getByRole('button', { name: '確認送出異動' })).toHaveFocus();
    await keyboard.tab();
    expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();
    await keyboard.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: '檢視並確認異動' })).toHaveFocus();
    expect(submitAdminMutation).not.toHaveBeenCalled();
  });

  it('未知結果使用alert，不能取消換鍵；只有手動同鍵確認，成功不重複套用', async () => {
    vi.mocked(submitAdminMutation).mockRejectedValueOnce(new AdminApiError('NETWORK_ERROR', '無法確認異動結果。'))
      .mockResolvedValueOnce({ outcome: 'duplicate', auditId: 'TEST_ONLY_AUDIT' });
    const onComplete = vi.fn();
    render(<AdminMutationPanel user={user} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: '檢視並確認異動' }));
    fireEvent.click(screen.getByRole('button', { name: '確認送出異動' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('無法確認異動結果。');
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
    expect(screen.getByText(/請使用相同操作鍵手動確認/)).toBeInTheDocument();
    expect(submitAdminMutation).toHaveBeenCalledTimes(1);
    const first = vi.mocked(submitAdminMutation).mock.calls[0][0];
    fireEvent.click(screen.getByRole('button', { name: '以相同操作鍵手動確認異動' }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(vi.mocked(submitAdminMutation).mock.calls[1][0]).toEqual(first);
    expect(await screen.findByRole('status')).toHaveTextContent('未重複套用');
  });

  it('明確輸入拒絕可取消修正，不把未成立結果當未知成功', async () => {
    vi.mocked(submitAdminMutation).mockRejectedValue(new AdminApiError('INVALID_INPUT', '請重新確認輸入。'));
    render(<AdminMutationPanel user={user} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '檢視並確認異動' }));
    fireEvent.click(screen.getByRole('button', { name: '確認送出異動' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('請重新確認輸入。');
    expect(screen.getByRole('button', { name: '取消' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.getByRole('button', { name: '檢視並確認異動' })).toHaveFocus();
    expect(submitAdminMutation).toHaveBeenCalledTimes(1);
  });

  it.each(['INVALID_RESPONSE', 'PROTECTION_SERVICE_UNAVAILABLE', 'UNAVAILABLE'])(
    '%s 不推論未異動，不自動送出或換鍵', async (code) => {
      vi.mocked(submitAdminMutation).mockRejectedValue(new AdminApiError(code, '結果尚未確認。'));
      render(<AdminMutationPanel user={user} onComplete={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: '檢視並確認異動' }));
      fireEvent.click(screen.getByRole('button', { name: '確認送出異動' }));
      await screen.findByRole('alert');
      expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
      expect(submitAdminMutation).toHaveBeenCalledTimes(1);
    });

  it('未知後再確認被撤權拒絕，仍不能推論原異動未成立或換新鍵', async () => {
    vi.mocked(submitAdminMutation).mockRejectedValueOnce(new AdminApiError('NETWORK_ERROR', '結果未知。'))
      .mockRejectedValueOnce(new AdminApiError('ADMIN_REQUIRED', '管理者權限已撤銷。'));
    render(<AdminMutationPanel user={user} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '檢視並確認異動' }));
    fireEvent.click(screen.getByRole('button', { name: '確認送出異動' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: '以相同操作鍵手動確認異動' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('管理者權限已撤銷。');
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
    expect(vi.mocked(submitAdminMutation).mock.calls[1][0]).toEqual(vi.mocked(submitAdminMutation).mock.calls[0][0]);
  });

  it('同一React批次連點只派送一次；離頁取消等待，晚到成功不更新舊畫面', async () => {
    let finish!: (result: AdminMutationResult) => void;
    vi.mocked(submitAdminMutation).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const onComplete = vi.fn();
    const view = render(<AdminMutationPanel user={user} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: '檢視並確認異動' }));
    const confirm = screen.getByRole('button', { name: '確認送出異動' });
    act(() => { confirm.click(); confirm.click(); });
    expect(submitAdminMutation).toHaveBeenCalledTimes(1);
    const signal = vi.mocked(submitAdminMutation).mock.calls[0][1];
    expect(signal?.aborted).toBe(false);
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => { finish({ outcome: 'applied', auditId: 'TEST_ONLY_AUDIT' }); });
    expect(onComplete).not.toHaveBeenCalled();
  });
});
