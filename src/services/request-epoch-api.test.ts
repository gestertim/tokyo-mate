import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearPendingEpochs, confirmEpochIssuance, pendingEpochs, prepareEpochOperation } from './request-epoch-api';

const epochId = `g7_${'k'.repeat(22)}`;
const issued = { capability: `v1.${'k'.repeat(22)}.abc.${'m'.repeat(43)}`, operationHandle: 'h'.repeat(43),
  requestEpochId: epochId, issuedAt: '2026-10-07T00:00:00.000Z', expiresAt: '2026-10-08T00:00:00.000Z' };
afterEach(() => { clearPendingEpochs(); vi.unstubAllGlobals(); });
describe('epoch client 手動簽發／同命令確認', () => {
  it('unknown 保留原命令；重按送出不自動确认；confirm 原bytes且不送付費API', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('TEST_ONLY timeout'))
      .mockResolvedValueOnce(Response.json({ success: true, data: issued }));
    vi.stubGlobal('fetch', fetcher);
    await expect(prepareEpochOperation('places', epochId)).rejects.toMatchObject({ code: 'PROTECTION_SERVICE_UNAVAILABLE' });
    const command = pendingEpochs()[0].issuanceCommandId;
    await expect(prepareEpochOperation('places', epochId)).rejects.toMatchObject({ code: 'PROTECTION_SERVICE_UNAVAILABLE' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await confirmEpochIssuance('places');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual(['/api/me/request-epochs', '/api/me/request-epochs']);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ endpoint: 'places', issuanceCommandId: command });
    expect(await prepareEpochOperation('places', epochId)).toEqual(issued);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(localStorage.length).toBe(0);
    expect(window.location.search).toBe('');
  });
  it('畸形／跨epoch／超出信封上限拒絕，不回成功形狀', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ success: true, data: { ...issued, operationHandle: 'bad' } }));
    vi.stubGlobal('fetch', fetcher);
    await expect(prepareEpochOperation('assistant', epochId)).rejects.toMatchObject({ code: 'PROTECTION_SERVICE_UNAVAILABLE' });
    expect(pendingEpochs()[0].state).toBe('unknown');
  });
});
