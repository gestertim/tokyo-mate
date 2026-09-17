import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DIST_DIR = path.resolve(process.cwd(), 'dist');

async function readProductionEntry() {
  const html = await readFile(path.join(DIST_DIR, 'index.html'), 'utf8');
  const mainScript = html.match(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/i)?.[1];
  expect(mainScript, 'production index.html 應有主 module script').toBeTruthy();
  const mainPath = path.join(DIST_DIR, mainScript!.replace(/^\//, ''));
  return { html, mainScript: mainScript!, source: await readFile(mainPath, 'utf8') };
}

function staticImportSpecifiers(source: string) {
  return [...source.matchAll(/\bimport\s*(?:[^"']*?from\s*)?["']([^"']+)["']/g)].map((match) => match[1]);
}

test.describe('Offline Blank Screen Red Test Gate', () => {
  test('production 主 bundle 不得靜態 import /service-worker.js', async () => {
    const { mainScript, source } = await readProductionEntry();
    const importedPaths = staticImportSpecifiers(source).map(
      (specifier) => new URL(specifier, `http://localhost${mainScript}`).pathname,
    );

    expect(importedPaths).not.toContain('/service-worker.js');
  });

  test('production index.html 不得為 service worker 產生 modulepreload', async () => {
    const { html } = await readProductionEntry();
    const modulePreloads = [...html.matchAll(/<link\b[^>]*\brel=["']modulepreload["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)]
      .map((match) => new URL(match[1], 'http://localhost/').pathname);

    expect(modulePreloads).not.toContain('/service-worker.js');
  });

  test('production build 暖快取後離線 reload 仍 render #root 子內容', async ({ context, page }) => {
    await page.goto('/');
    await expect.poll(
      () => page.evaluate(() => navigator.serviceWorker.ready.then(() => true)).catch(() => false),
    ).toBe(true);

    const controlledPage = await context.newPage();
    await controlledPage.goto('/');
    await expect(controlledPage.locator('#root')).not.toBeEmpty();
    await expect.poll(() => controlledPage.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await context.setOffline(true);
    await controlledPage.reload({ waitUntil: 'domcontentloaded' });

    await expect(controlledPage.locator('#root')).not.toBeEmpty();
    await expect(controlledPage.getByRole('heading', { name: '東京通', exact: true })).toBeVisible();
    await expect(controlledPage.getByRole('button', { name: '即時翻譯', exact: true })).toBeVisible();
    await expect(controlledPage.getByRole('button', { name: '問東京', exact: true })).toBeVisible();
    await expect(controlledPage.getByRole('button', { name: '探索附近', exact: true })).toBeVisible();
    await expect(controlledPage.getByRole('button', { name: '東京百科', exact: true })).toBeVisible();
  });

  test('manifest.webmanifest 載入失敗時 App 仍正常 render', async ({ page }) => {
    await page.route('**/manifest.webmanifest', (route) => route.abort('failed'));

    await page.goto('/');

    await expect(page.locator('#root')).not.toBeEmpty();
  });
});