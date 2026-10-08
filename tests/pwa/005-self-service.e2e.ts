import { expect, test } from '@playwright/test';

test('005 D10／D11本人流程僅手動、分頁不猜offset、不重送付費（隔離HTTP mock）', async ({ page }) => {
  const calls: { path: string; method: string; body: unknown }[] = [];
  const review = { reviewId: 'r1', kind: 'paid_access', reasonCode: 'paid_feature_access',
    createdAt: '2026-10-07T02:00:00.000Z', status: 'pending' };
  await page.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname !== '127.0.0.1') { await route.abort(); return; }
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return; }
    calls.push({ path: url.pathname + url.search, method: request.method(), body: request.postDataJSON() });
    let data: unknown;
    if (url.pathname === '/api/me/requests' && request.method() === 'POST') data = review;
    else if (url.pathname === '/api/me/requests') data = { items: [review], nextOffset: url.searchParams.get('offset') === '0' ? 1 : null };
    else if (url.pathname.endsWith('/withdraw')) data = { ...review, status: 'withdrawn' };
    else if (url.pathname === '/api/me/operation-status') data = {
      state: 'settled', updatedAt: review.createdAt,
      userMessage: '此操作已有記帳紀錄；這不代表結果內容已成功取得。',
    };
    else {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({
        success: false, error: { code: 'AUTH_REQUIRED', userMessage: '需要登入。', actionableStep: '請先登入。' },
      }) }); return;
    }
    await route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' },
      body: JSON.stringify({ success: true, data }) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '本人申請與操作狀態', exact: true }).click();
  const selfCalls = () => calls.filter((r) => r.path.includes('/api/me/requests') || r.path.includes('operation-status'));
  expect(selfCalls()).toHaveLength(0);
  await page.getByRole('button', { name: '申請付費資格', exact: true }).click();
  await expect(page.getByText(/申請待審核/)).toBeVisible();
  expect(selfCalls()).toHaveLength(1);
  await page.getByRole('button', { name: '查詢本人申請' }).click();
  await expect(page.getByRole('button', { name: '撤回 r1' })).toBeVisible();
  await page.getByRole('button', { name: '下一頁' }).click();
  await expect(page.getByRole('button', { name: '下一頁' })).toBeDisabled();
  expect(calls.some((r) => r.path === '/api/me/requests?offset=1&limit=25')).toBe(true);
  await page.getByRole('button', { name: '撤回 r1' }).click();
  await expect(page.getByText('已撤回申請；撤回不會撤銷已核准權利。')).toBeVisible();
  await page.getByLabel('原操作識別碼').fill('original_key');
  await page.getByRole('button', { name: '查看操作狀態' }).click();
  await expect(page.getByText(/這不代表結果內容已成功取得/)).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(selfCalls()).toHaveLength(5);
  expect(calls.filter((r) => ['assistant', 'places', 'photo-ocr', 'photo-translate', 'speech', 'transcribe']
    .some((p) => r.path === `/api/${p}`))).toEqual([]);
});
