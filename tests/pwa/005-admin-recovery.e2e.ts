import { expect, test } from '@playwright/test';

test('005 管理確認鍵盤與未知結果同鍵恢復；成功管理回應不進PWA cache（隔離HTTP mock）', async ({ page }) => {
  const commands: unknown[] = [];
  const forbidden: string[] = [];
  const quota = { limitEstimatedUsd: '3.00', usedEstimatedUsd: '0.00', reservedEstimatedUsd: '0.00',
    remainingEstimatedUsd: '3.00', resetAt: '2026-10-11T16:00:00.000Z' };
  const user = { identitySubject: 'TEST_ONLY_USER', displayName: '本機測試使用者', status: 'pending', tier: null,
    daily: quota, weekly: { ...quota, windowKey: '2026-W41', activeTopUpEstimatedUsd: '0.00' },
    endpointUsage: [], topUps: [] };
  let details = 0;
  await page.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname !== '127.0.0.1') { forbidden.push(request.url()); await route.abort(); return; }
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return; }
    let data: unknown;
    if (url.pathname === '/api/admin/overview') data = {
      approvalCounts: { pending: 1, approved: 0, rejected: 0, revoked: 0, expired: 0 },
      estimatedUsage: { dailyUsedEstimatedUsd: '0.00', weeklyUsedEstimatedUsd: '0.00' },
      protectionAvailable: true, nearLimits: [],
    };
    else if (url.pathname === '/api/admin/users') data = { items: [user], nextOffset: null };
    else if (url.pathname === '/api/admin/users/TEST_ONLY_USER') { details++; data = user; }
    else if (url.pathname === '/api/admin/approvals' && request.method() === 'POST') {
      commands.push(request.postDataJSON());
      if (commands.length === 1) {
        await route.fulfill({ status: 503, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' },
          body: JSON.stringify({ success: false, error: { code: 'PROTECTION_SERVICE_UNAVAILABLE',
            userMessage: '保護服務暫時無法確認使用狀態，付費功能先暫停。' } }) });
        return;
      }
      data = { outcome: 'duplicate', auditId: 'TEST_ONLY_AUDIT' };
    } else {
      forbidden.push(url.pathname);
      await route.abort();
      return;
    }
    await route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' },
      body: JSON.stringify({ success: true, data }) });
  });

  await page.goto('/admin');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.getByRole('navigation', { name: '管理頁面' }).getByRole('button', { name: '使用者', exact: true }).click();
  await page.getByRole('button', { name: '本機測試使用者' }).click();
  const prepare = page.getByRole('button', { name: '檢視並確認異動' });
  await prepare.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: '確認管理異動' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '確認送出異動' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '取消' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(prepare).toBeFocused();
  expect(commands).toEqual([]);

  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText('保護服務暫時無法確認使用狀態');
  await expect(page.getByRole('button', { name: '取消' })).toBeDisabled();
  expect(commands).toHaveLength(1);
  await page.getByRole('button', { name: '以相同操作鍵手動確認異動' }).focus();
  await page.keyboard.press('Enter');
  await expect(prepare).toBeVisible();
  await expect(page.getByRole('button', { name: '重新確認詳情' })).toBeFocused();
  expect(details).toBe(2);
  expect(commands).toHaveLength(2);
  expect(commands[1]).toEqual(commands[0]);
  expect(forbidden).toEqual([]);

  const cachedPaths = await page.evaluate(async () => {
    const paths: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname);
    }
    return paths;
  });
  expect(cachedPaths).toContain('/');
  expect(cachedPaths.filter((path) => path.startsWith('/api/'))).toEqual([]);
});
