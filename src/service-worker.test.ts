import { describe, expect, it } from 'vitest';
import { APPROVED_STATIC_PREFIXES, isCacheableRequest, isServiceWorkerRuntime, PRECACHE_URLS } from './service-worker';

describe('Service Worker cache privacy boundary (FR-017 / FR-018 / FR-026)', () => {
  it('precache 清單只包含 App Shell 入口，不含任何 API 或使用者資料路徑', () => {
    for (const url of PRECACHE_URLS) {
      expect(url.startsWith('/api/')).toBe(false);
    }
    expect(PRECACHE_URLS).toEqual(['/', '/index.html', '/manifest.webmanifest']);
  });

  it('allowlist 前綴僅限批准的 App Shell assets、icons 與靜態 Tokyo Knowledge Base', () => {
    expect(APPROVED_STATIC_PREFIXES).toEqual(['/assets/', '/src/data/tokyo/', '/icons/']);
  });

  it('聊天內容、翻譯結果、語音、位置與即時 API response 皆不可快取', () => {
    const forbidden = [
      'http://localhost:5173/api/assistant',
      'http://localhost:5173/api/transcribe',
      'http://localhost:5173/api/speech',
      'http://localhost:5173/api/places',
    ];
    for (const url of forbidden) {
      expect(isCacheableRequest(new Request(url))).toBe(false);
    }
  });

  it('在非 Service Worker 環境（測試 / 主執行緒）不啟用 SW 專用 API', () => {
    expect(isServiceWorkerRuntime()).toBe(false);
  });
});
