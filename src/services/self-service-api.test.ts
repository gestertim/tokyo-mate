import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadOperationStatus, loadOwnRequests, submitOwnRequest, withdrawOwnRequest } from './self-service-api';
import { operationMessages } from '../types/self-service';
afterEach(() => vi.unstubAllGlobals());
describe('本人client單次手動request', () => {
  it('POST操作鍵不進URL，settled不宣稱結果成功，credentials／no-store', async () => {
    const fetch = vi.fn(async () => Response.json({ success: true, data: {
      state: 'settled', updatedAt: '2026-10-07T02:00:00Z', userMessage: operationMessages.settled,
    } }));
    vi.stubGlobal('fetch', fetch);
    expect((await loadOperationStatus('assistant', 'original')).state).toBe('settled');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/me/operation-status', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', cache: 'no-store', body: '{"endpoint":"assistant","idempotencyKey":"original"}',
    }));
  });
  it.each([401, 403, 409, 503])('%i不重試、不改key、不補送付費', async (status) => {
    const fetch = vi.fn(async () => Response.json({ success: false, error: {
      code: 'REQUEST_ALREADY_RESOLVED', userMessage: '此申請已處理，無法撤回。', actionableStep: '請手動確認。',
    } }, { status }));
    vi.stubGlobal('fetch', fetch);
    await expect(withdrawOwnRequest('r1')).rejects.toMatchObject({ code: 'REQUEST_ALREADY_RESOLVED' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('網路失敗一次、JSON超限及非法dto明確拒絕', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    fetch.mockRejectedValueOnce(new Error('offline'));
    await expect(submitOwnRequest({ kind: 'paid_access', idempotencyKey: 'one', reasonCode: 'paid_feature_access' }))
      .rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    fetch.mockResolvedValueOnce(new Response('x'.repeat(65537)));
    await expect(loadOwnRequests()).rejects.toMatchObject({ code: 'PROTECTION_SERVICE_UNAVAILABLE' });
    fetch.mockResolvedValueOnce(Response.json({ success: true, data: { items: [], nextOffset: 25 } }));
    await expect(loadOwnRequests()).rejects.toMatchObject({ code: 'PROTECTION_SERVICE_UNAVAILABLE' });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
