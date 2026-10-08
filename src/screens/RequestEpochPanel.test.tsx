import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequestEpochPanel } from './RequestEpochPanel';
import { clearPendingEpochs, prepareEpochOperation } from '../services/request-epoch-api';
afterEach(() => { cleanup(); clearPendingEpochs(); vi.unstubAllGlobals(); });

it('手動確認簽發成功不自動付費，提示再手動送出；離頁不保存識別', async () => {
  const epochId = `g7_${'k'.repeat(22)}`;
  const issued = { capability: `v1.${'k'.repeat(22)}.abc.${'m'.repeat(43)}`, operationHandle: 'h'.repeat(43),
    requestEpochId: epochId, issuedAt: '2026-10-07T00:00:00.000Z', expiresAt: '2026-10-08T00:00:00.000Z' };
  const fetcher = vi.fn().mockRejectedValueOnce(new Error('TEST_ONLY timeout'))
    .mockResolvedValueOnce(Response.json({ success: true, data: issued }));
  vi.stubGlobal('fetch', fetcher);
  await expect(prepareEpochOperation('places', epochId)).rejects.toThrow();
  const view = render(<RequestEpochPanel />);
  await userEvent.click(screen.getByRole('button', { name: '確認簽發結果' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('尚未執行付費操作'));
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.every((call) => call[0] === '/api/me/request-epochs')).toBe(true);
  view.unmount();
  expect(localStorage.length).toBe(0);
});
