import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminApiError, loadAdminUsers, loadAdminUserDetail, submitAdminMutation } from './admin-api';
afterEach(() => vi.unstubAllGlobals());
describe('管理 client 無自動重試與保守錯誤', () => {
  it('query同源/no-store、subject encode；壞DTO拒絕', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ success: true, data: { items: [], nextOffset: null } }));
    vi.stubGlobal('fetch', fetch);
    expect(await loadAdminUsers()).toEqual({ items: [], nextOffset: null });
    expect(fetch).toHaveBeenCalledWith('/api/admin/users?offset=0&limit=25', expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }));
    await expect(loadAdminUserDetail('oidc|user/1')).rejects.toBeInstanceOf(AdminApiError);
    expect(fetch.mock.calls[1][0]).toBe('/api/admin/users/oidc%7Cuser%2F1');
  });
  it('傳入same idempotencyKey，不添加role或金額權威；網路故障只一次', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('unknown result')); vi.stubGlobal('fetch', fetch);
    const command = { action: 'approve' as const, idempotencyKey: 'key1', targetIdentitySubject: 'user1',
      reasonCode: 'operator_review', confirmed: true as const, tier: 'tier1' as const };
    await expect(submitAdminMutation(command)).rejects.toThrow('相同操作鍵');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/admin/approvals', expect.objectContaining({
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) }));
  });
  it('異動沿用呼叫者取消signal，不自動重送或改操作鍵', async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    vi.stubGlobal('fetch', fetch);
    const command = { action: 'reject' as const, idempotencyKey: 'TEST_ONLY_KEY', targetIdentitySubject: 'TEST_ONLY_USER',
      reasonCode: 'operator_review', confirmed: true as const };
    controller.abort();
    await expect(submitAdminMutation(command, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/admin/approvals', expect.objectContaining({
      signal: controller.signal, body: JSON.stringify(command),
    }));
  });
});
