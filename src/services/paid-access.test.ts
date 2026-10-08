import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateSpeech, requestAssistant, requestPhotoOcr, requestPhotoTranslate, requestPlaces,
  transcribeAudio } from './api';
import { loadOwnQuota } from './access-api';

const operations = [
  { path: '/api/assistant', run: () => requestAssistant({ id: 'FIXTURE', text: '保留原文', inputType: 'text' }) },
  { path: '/api/places', run: () => requestPlaces({ location: { type: 'manual', manualArea: '淺草' } }) },
  { path: '/api/speech', run: () => generateSpeech({ text: 'こんにちは', language: 'ja', speed: 'normal' }) },
  { path: '/api/transcribe', run: () => transcribeAudio(new Blob(['FIXTURE'], { type: 'audio/wav' })) },
  { path: '/api/photo-ocr', run: () => requestPhotoOcr('data:image/png;base64,RklYVFVSRQ==', 1) },
  { path: '/api/photo-translate', run: () => requestPhotoTranslate('こんにちは', 'zh-TW') },
];
const quota = {
  tier: 'tier1', currency: 'USD', timezone: 'Asia/Taipei',
  daily: { limitEstimatedUsd: '3.00', usedEstimatedUsd: '0.00', reservedEstimatedUsd: '0.00',
    remainingEstimatedUsd: '3.00', resetAt: '2026-10-06T16:00:00.000Z' },
  weekly: { limitEstimatedUsd: '15.00', baseLimitEstimatedUsd: '15.00', activeTopUpEstimatedUsd: '0.00',
    usedEstimatedUsd: '0.00', reservedEstimatedUsd: '0.00', remainingEstimatedUsd: '15.00',
    resetAt: '2026-10-11T16:00:00.000Z' },
};
afterEach(() => vi.unstubAllGlobals());

describe('Public 防送出（查詢只供 UX，不是 grant）', () => {
  it.each(operations)('$path：未登入／未核准／未知只 GET，不送付費 POST', async ({ run }) => {
    for (const [status, code] of [[401, 'AUTH_REQUIRED'], [403, 'ACCESS_NOT_APPROVED'],
      [503, 'PROTECTION_SERVICE_UNAVAILABLE']] as const) {
      const fetch = vi.fn().mockResolvedValue(Response.json({ success: false, error: {
        code, userMessage: '目前沒有有效付費資格。', actionableStep: '你仍可查看公開內容。',
      } }, { status }));
      vi.stubGlobal('fetch', fetch);
      await expect(run()).rejects.toMatchObject({ code });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith('/api/me/quota',
        expect.objectContaining({ method: 'GET', cache: 'no-store', credentials: 'same-origin' }));
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('focus'));
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });
  it.each(operations)('$path：可信資格查詢後只有一次 POST，後端拒絕不重送', async ({ path, run }) => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ success: true, data: quota }))
      .mockResolvedValueOnce(Response.json({ success: false, error: { code: 'DAILY_QUOTA_EXHAUSTED',
        userTitle: '今日額度暫不可用', userMessage: '後端重新判斷後拒絕。', actionableStep: '請手動重試。',
      } }, { status: 429 }));
    vi.stubGlobal('fetch', fetch);
    await expect(run()).rejects.toMatchObject({ code: 'DAILY_QUOTA_EXHAUSTED' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith(path, expect.objectContaining({ method: 'POST' }));
  });
  it('200 錯誤資料及網路失敗也不送付費 POST、不採顯示金額作 grant', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ success: true, data: { tier: 'tier1' } }))
      .mockRejectedValueOnce(new TypeError('FIXTURE_NETWORK'));
    vi.stubGlobal('fetch', fetch);
    await expect(operations[0].run()).rejects.toMatchObject({ code: 'PROTECTION_SERVICE_UNAVAILABLE' });
    await expect(operations[0].run()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(fetch.mock.calls.every(([path]) => path === '/api/me/quota')).toBe(true);
  });
  it.each([
    ['DAILY_QUOTA_EXHAUSTED', 'request', '今日剩餘額度不足以處理這次請求'],
    ['WEEKLY_QUOTA_EXHAUSTED', 'request', '本週剩餘額度不足以處理這次請求'],
    ['DAILY_QUOTA_EXHAUSTED', 'all', '今日剩餘額度不足預留門檻'],
    ['WEEKLY_QUOTA_EXHAUSTED', 'all', '本週剩餘額度不足預留門檻'],
  ] as const)('quota query %s／%s 保留後端文案與scope，不由數字推算', async (code, quotaScope, userTitle) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: false, error: {
      code, quotaScope, userTitle, userMessage: 'FIXTURE可信後端文案', actionableStep: 'FIXTURE只手動確認',
    } }, { status: 429 })));
    await expect(loadOwnQuota()).rejects.toMatchObject({ code, message: 'FIXTURE可信後端文案 FIXTURE只手動確認',
      details: { quotaScope, userTitle } });
  });
  it('quota query 不接受缺scope的429分類、不猜Retry-After', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: false, error: {
      code: 'DAILY_QUOTA_EXHAUSTED', userMessage: '額度已滿', actionableStep: '重試', retryAfterSeconds: -1,
    } }, { status: 429 })));
    await expect(loadOwnQuota()).rejects.toMatchObject({ code: 'PROTECTION_SERVICE_UNAVAILABLE' });
  });
  it.each([
    { status: 429, code: 'DAILY_QUOTA_EXHAUSTED', quotaScope: 'request' },
    { status: 429, code: 'WEEKLY_QUOTA_EXHAUSTED', quotaScope: 'all' },
    { status: 409, code: 'DUPLICATE_REQUEST', quotaScope: undefined },
    { status: 409, code: 'IDEMPOTENCY_CONFLICT', quotaScope: undefined },
  ])('$code 後不重送、不新建查詢、不停止其他付費功能', async ({ status, code, quotaScope }) => {
    const error = { code, ...(quotaScope ? { quotaScope } : {}), userTitle: 'FIXTURE後端標題',
      userMessage: 'FIXTURE後端訊息', actionableStep: 'FIXTURE後端提示' };
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ success: true, data: quota }))
      .mockResolvedValueOnce(Response.json({ success: false, error }, { status }))
      .mockResolvedValueOnce(Response.json({ success: true, data: quota }))
      .mockResolvedValueOnce(Response.json({ success: true, data: { audioUrl: 'blob:fixture', mimeType: 'audio/mpeg', speed: 'normal' } }));
    vi.stubGlobal('fetch', fetch);
    await expect(operations[0].run()).rejects.toMatchObject(error);
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('focus'));
    expect(fetch).toHaveBeenCalledTimes(2);
    await expect(operations[2].run()).resolves.toMatchObject({ audioUrl: 'blob:fixture' });
    expect(fetch.mock.calls.map(([path]) => path)).toEqual(['/api/me/quota', '/api/assistant', '/api/me/quota', '/api/speech']);
  });
});
