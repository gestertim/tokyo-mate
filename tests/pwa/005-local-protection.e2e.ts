import { expect, test } from '@playwright/test';

test('005 D09 30秒快照到期卸載互動圖，不自動Places或付費POST', async ({ page }) => {
  const clock = new Date();
  await page.clock.install({ time: clock });
  await page.clock.pauseAt(clock);
  let queries = 0, tiles = 0, paid = 0;
  await page.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname !== '127.0.0.1') { await route.abort(); return; }
    if (request.method() === 'POST' && url.pathname.startsWith('/api/')) paid++;
    if (url.pathname === '/api/me/map-eligibility') {
      queries++;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: {
        eligibleForInteractiveMap: true, reason: 'eligible', fetchedAt: new Date().toISOString(),
        resetAt: new Date(Date.now() + 86400000).toISOString(),
      } }) });
    } else if (url.pathname.startsWith('/api/map/tile/')) {
      tiles++;
      await route.fulfill({ contentType: 'image/png',
        body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64') });
    } else if (url.pathname.startsWith('/api/')) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({
        success: false, error: { code: 'PROTECTION_SERVICE_UNAVAILABLE', userTitle: '無法確認使用狀態',
          userMessage: '保護服務暫時無法確認使用狀態。', actionableStep: '請稍後手動重試。' },
      }) });
    } else await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: '探索附近', exact: true }).click();
  await expect(page.getByRole('button', { name: '使用我的位置' })).toBeEnabled();
  await expect(page.locator('.leaflet-container')).toHaveCount(1);
  await page.clock.fastForward(29999);
  await expect(page.getByRole('button', { name: '使用我的位置' })).toBeEnabled();
  await page.clock.fastForward(1);
  await expect(page.getByRole('region', { name: '靜態東京風格示意圖' })).toBeVisible();
  await expect(page.locator('.leaflet-container')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '使用我的位置' })).toBeDisabled();
  const before = tiles;
  await page.clock.fastForward(1000);
  expect(tiles).toBe(before);
  expect(queries).toBe(1);
  expect(paid).toBe(0);
});

for (const reason of ['auth_required', 'not_approved', 'daily_quota', 'weekly_quota',
  'map_tile_quota', 'protection_unavailable', 'unknown']) {
  test(`005 本機 fixture ${reason}：零 Places／tile／外部圖磚，恢復後仍受限`, async ({ page }) => {
    await page.setViewportSize({ width: reason === 'auth_required' ? 390 : 1280, height: 844 });
    const forbidden: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname === '/api/places' || url.pathname.startsWith('/api/map/tile/') ||
          url.host.includes('geoapify.com')) forbidden.push(request.url());
    });
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1') { await route.abort(); return; }
      if (url.pathname === '/api/me/map-eligibility') {
        await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' },
          body: JSON.stringify({ success: true, data: {
            eligibleForInteractiveMap: false, reason, fetchedAt: '2026-10-06T02:00:00.000Z',
          } }) });
      } else if (url.pathname.startsWith('/api/')) {
        await route.fulfill({ status: 503, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' },
          body: JSON.stringify({ success: false, error: { code: 'PROTECTION_SERVICE_UNAVAILABLE',
            userTitle: '無法確認使用狀態', userMessage: '保護服務暫時無法確認使用狀態。', actionableStep: '請稍後手動重試。' } }) });
      } else await route.continue();
    });
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.getByRole('button', { name: '探索附近', exact: true }).click();
    await expect(page.getByRole('region', { name: '靜態東京風格示意圖' })).toBeVisible();
    const frame = await page.locator('.nearby-static-map-frame').boundingBox();
    expect(frame).not.toBeNull();
    if (!frame) throw new Error('示意圖未保留版面區域');
    expect(frame.width / frame.height).toBeCloseTo(reason === 'auth_required' ? 4 / 3 : 16 / 9, 2);
    await expect(page.getByRole('button', { name: '使用我的位置' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '輸入地區' })).toBeDisabled();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('button', { name: '輸入地區' })).toBeDisabled();
    await page.reload();
    await page.getByRole('button', { name: '探索附近', exact: true }).click();
    await expect(page.getByRole('region', { name: '靜態東京風格示意圖' })).toBeVisible();
    const entries = await page.evaluate(async () => {
      const names = await caches.keys();
      const urls: string[] = [];
      for (const name of names) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) urls.push(request.url);
      }
      return urls;
    });
    expect(entries.some((entry) => new URL(entry).pathname === '/')).toBe(true);
    expect(entries.filter((entry) => new URL(entry).pathname.startsWith('/api/'))).toEqual([]);
    expect(forbidden).toEqual([]);
  });
}

test('005 管理者 fixture 403：不顯示管理統計，沒有一般 UI 管理入口', async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') { await route.abort(); return; }
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return; }
    await route.fulfill({ status: 403, contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ success: false, error: {
        code: 'ADMIN_REQUIRED', userTitle: '需要管理者權限', userMessage: '此帳號無法讀取管理資料。', actionableStep: '請返回公開內容。',
      } }) });
  });
  await page.goto('/admin');
  await expect(page.getByRole('alert')).toContainText('無法讀取管理資料');
  await expect(page.getByRole('heading', { name: '核准狀態' })).toHaveCount(0);
  await page.getByRole('button', { name: '返回公開內容' }).click();
  await expect(page.getByRole('button', { name: '探索附近', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /管理者/ })).toHaveCount(0);
});

for (const [status, code] of [[401, 'AUTH_REQUIRED'], [403, 'ACCESS_NOT_APPROVED'],
  [503, 'PROTECTION_SERVICE_UNAVAILABLE']] as const) {
  test(`005 Public ${status}：原輸入保留，付費 POST 零次，不因恢復自動送出`, async ({ page }) => {
    const paid: string[] = [];
    await page.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.hostname !== '127.0.0.1') { await route.abort(); return; }
      if (!url.pathname.startsWith('/api/')) { await route.continue(); return; }
      if (request.method() === 'POST') paid.push(url.pathname);
      await route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' },
        body: JSON.stringify({ success: false, error: { code, userTitle: '無法使用付費功能',
          userMessage: '目前無法使用付費功能。', actionableStep: '你仍可查看公開內容。' } }) });
    });
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.getByRole('textbox', { name: '想說什麼？' }).fill('保留這份本機測試原文');
    await page.getByRole('button', { name: '送出', exact: true }).click();
    const assistant = page.getByRole('region', { name: '東京助手' });
    await assistant.getByRole('button', { name: '送出', exact: true }).click();
    await expect(assistant.getByRole('status')).toContainText('目前無法使用付費功能。');
    await expect(assistant.getByRole('textbox', { name: '輸入內容' })).toHaveValue('保留這份本機測試原文');
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('online'));
    });
    expect(paid).toEqual([]);
    if (status === 401) await expect(page.getByRole('link', { name: /登入/ })).toBeVisible();
  });
}
