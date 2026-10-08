import { expect, test } from '@playwright/test';

const epochId = `g7_${'k'.repeat(22)}`;
const issued = { capability: `v1.${'k'.repeat(22)}.abc.${'m'.repeat(43)}`, operationHandle: 'h'.repeat(43),
  requestEpochId: epochId, issuedAt: '2026-10-07T00:00:00.000Z', expiresAt: '2026-10-08T00:00:00.000Z' };
const quota = {
  tier: 'tier1', currency: 'USD', timezone: 'Asia/Taipei', requestEpoch: { epochId },
  daily: { limitEstimatedUsd: '3.00', usedEstimatedUsd: '0.00', reservedEstimatedUsd: '0.00',
    remainingEstimatedUsd: '3.00', resetAt: '2026-10-08T16:00:00.000Z' },
  weekly: { limitEstimatedUsd: '15.00', baseLimitEstimatedUsd: '15.00', activeTopUpEstimatedUsd: '0.00',
    usedEstimatedUsd: '0.00', reservedEstimatedUsd: '0.00', remainingEstimatedUsd: '15.00',
    resetAt: '2026-10-11T16:00:00.000Z' },
};
test('005 epoch unknown→原命令手動確認→再次手動送出；無外部／自動付費／持久token', async ({ page }) => {
  const issuanceBodies: unknown[] = [], paid: { body: unknown; capability: string | undefined }[] = [], external: string[] = [];
  await page.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname !== '127.0.0.1') { external.push(url.hostname); await route.abort(); return; }
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return; }
    if (url.pathname === '/api/me/quota') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: quota }) });
    } else if (url.pathname === '/api/me/request-epochs') {
      issuanceBodies.push(request.postDataJSON());
      if (issuanceBodies.length === 1) await route.abort();
      else await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: issued }) });
    } else if (url.pathname === '/api/assistant') {
      paid.push({ body: request.postDataJSON(), capability: request.headers()['x-request-capability'] });
      await route.fulfill({ status: 410, contentType: 'application/json', body: JSON.stringify({ success: false, error: {
        code: 'OPERATION_NO_LONGER_EXECUTABLE', userTitle: '這個操作已不能再送出',
        userMessage: '既有記帳或預留不會因此取消。', actionableStep: '請手動查看原操作狀態。',
      } }) });
    } else if (url.pathname === '/api/me/operation-status') {
      expect(request.postDataJSON()).toEqual({ endpoint: 'assistant', requestEpochId: epochId, operationHandle: issued.operationHandle });
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: {
        state: 'uncertain', updatedAt: issued.issuedAt, userMessage: '目前無法確認此操作結果，預留仍保留；請勿自動重送。',
      } }) });
    } else await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: {
      code: 'PROTECTION_SERVICE_UNAVAILABLE', userTitle: '無法確認', userMessage: '請手動確認。', actionableStep: '不會自動重送。',
    } }) });
  });
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.getByRole('textbox', { name: '想說什麼？' }).fill('保留 epoch 原輸入');
  await page.getByRole('button', { name: '送出', exact: true }).click();
  await page.getByRole('button', { name: '送出', exact: true }).click();
  await expect(page.getByRole('button', { name: '確認簽發結果' })).toBeEnabled();
  expect(paid).toHaveLength(0);
  await page.evaluate(() => { window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('focus')); });
  expect(issuanceBodies).toHaveLength(1);
  await page.getByRole('button', { name: '確認簽發結果' }).click();
  await expect(page.getByRole('region', { name: '原操作手動確認' })).toContainText('尚未執行付費操作');
  expect(issuanceBodies[1]).toEqual(issuanceBodies[0]);
  expect(paid).toHaveLength(0);
  await page.getByRole('button', { name: '送出', exact: true }).click();
  await expect(page.getByRole('region', { name: '原操作手動確認' })).toContainText('目前無法確認原操作結果');
  expect(paid).toEqual([{ body: expect.objectContaining({ text: '保留 epoch 原輸入', idempotencyKey: issued.operationHandle }),
    capability: issued.capability }]);
  await page.getByRole('button', { name: '手動查看原操作狀態' }).click();
  await expect(page.getByRole('region', { name: '原操作手動確認' })).toContainText('預留仍保留');
  expect(paid).toHaveLength(1);
  const privateState = await page.evaluate(async () => {
    const cacheUrls: string[] = [];
    for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) cacheUrls.push(req.url);
    return { local: JSON.stringify(localStorage), session: JSON.stringify(sessionStorage), cacheUrls, url: location.href };
  });
  expect(JSON.stringify(privateState)).not.toContain(issued.capability);
  expect(JSON.stringify(privateState)).not.toContain(issued.operationHandle);
  expect(privateState.cacheUrls.filter((url) => new URL(url).pathname.startsWith('/api/'))).toEqual([]);
  await page.reload();
  await expect(page.getByRole('region', { name: '原操作手動確認' })).toHaveCount(0);
  expect(issuanceBodies).toHaveLength(2);
  expect(paid).toHaveLength(1);
  expect(external).toEqual([]);
});
