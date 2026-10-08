import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EpochLifecycleScreen } from './EpochLifecycleScreen';
import { submitEpochLifecycleStep } from '../../services/admin-api';

vi.mock('../../services/admin-api', async (original) => ({
  ...await original<typeof import('../../services/admin-api')>(), submitEpochLifecycleStep: vi.fn(),
}));
afterEach(() => vi.clearAllMocks());
describe('單管理者本機分步稽核', () => {
  it('預設dry-run，第一步後才可確認；unknown使用原識別重試、不將覆核當結案', async () => {
    vi.mocked(submitEpochLifecycleStep).mockResolvedValueOnce({ outcome: 'inspected', auditId: 'a1' })
      .mockRejectedValueOnce(new Error('TEST_ONLY_UNKNOWN'))
      .mockResolvedValueOnce({ outcome: 'duplicate', auditId: 'a2' });
    render(<EpochLifecycleScreen />);
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByRole('button', { name: '第二步：重新授權並手動確認' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('原操作／epoch／family:version 識別'), { target: { value: 'owner:r1' } });
    fireEvent.change(screen.getByLabelText('理由代碼'), { target: { value: 'TEST_ONLY' } });
    fireEvent.click(screen.getByRole('button', { name: '第一步：檢視並稽核' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '第二步：重新授權並手動確認' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '第二步：重新授權並手動確認' }));
    await screen.findByText(/結果未知/);
    fireEvent.click(screen.getByRole('button', { name: '第二步：重新授權並手動確認' }));
    await screen.findByText(/稽核識別：a2/);
    const [inspect, confirm, retry] = vi.mocked(submitEpochLifecycleStep).mock.calls.map(([c]) => c);
    expect(inspect.dryRun).toBe(true);
    expect(confirm.operationId).toBe(inspect.operationId);
    expect(confirm.idempotencyKey).not.toBe(inspect.idempotencyKey);
    expect(retry).toEqual(confirm);
    expect(screen.getByRole('status')).toHaveTextContent('人工覆核不代表帳務結案');
  });
});
