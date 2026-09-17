import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_SHELL_CACHE, APPROVED_STATIC_PREFIXES, isCacheableRequest, isServiceWorkerRuntime, PRECACHE_URLS } from './service-worker';

type CacheRecord = Map<string, Response>;

function restoreGlobal(name: 'self' | 'caches', descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    delete (globalThis as Record<string, unknown>)[name];
  }
}

async function loadServiceWorkerRuntime(cacheNames: string[] = [APP_SHELL_CACHE]) {
  const listeners: Record<string, ((event: any) => void)[]> = {};
  const cacheRecords = new Map<string, CacheRecord>(cacheNames.map((name) => [name, new Map()]));
  const cacheApi = {
    open: vi.fn(async (name: string) => {
      const record = cacheRecords.get(name) ?? new Map<string, Response>();
      cacheRecords.set(name, record);
      return {
        addAll: vi.fn(async () => undefined),
        match: vi.fn(async (request: Request | string) => record.get(typeof request === 'string' ? request : request.url)),
        put: vi.fn(async (request: Request | string, response: Response) => {
          record.set(typeof request === 'string' ? request : request.url, response);
        }),
      };
    }),
    match: vi.fn(async (request: Request | string) => {
      const url = typeof request === 'string' ? request : request.url;
      for (const record of cacheRecords.values()) {
        const cached = record.get(url);
        if (cached) return cached;
      }
      return undefined;
    }),
    keys: vi.fn(async () => [...cacheRecords.keys()]),
    delete: vi.fn(async (name: string) => cacheRecords.delete(name)),
  };
  const serviceWorkerGlobal = {
    addEventListener: (type: string, handler: (event: any) => void) => {
      listeners[type] = [...(listeners[type] ?? []), handler];
    },
    clients: { claim: vi.fn(async () => undefined) },
    skipWaiting: vi.fn(async () => undefined),
  };
  const originalSelf = Object.getOwnPropertyDescriptor(globalThis, 'self');
  const originalCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  Object.defineProperty(globalThis, 'self', { configurable: true, value: serviceWorkerGlobal });
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: cacheApi });
  vi.resetModules();
  const serviceWorker = await import('./service-worker');
  return { cacheApi, cacheRecords, listeners, originalCaches, originalSelf, serviceWorker };
}

function createNavigationRequest() {
  const request = new Request(`${location.origin}/`);
  Object.defineProperty(request, 'mode', { configurable: true, value: 'navigate' });
  return request;
}

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe('PWA cache refresh hotfix v2 red tests', () => {
  it('使用新版本 App Shell cache，不得仍使用 v1', () => {
    expect(APP_SHELL_CACHE).not.toBe('tokyo-mate-app-shell-v1');
  });

  it('online navigation 優先回傳 network response，不先回傳舊 cache', async () => {
    const runtime = await loadServiceWorkerRuntime(['tokyo-mate-app-shell-v2']);
    const oldResponse = new Response('old cache');
    const networkResponse = new Response('new network');
    runtime.cacheRecords.get('tokyo-mate-app-shell-v2')?.set(new URL('/', location.origin).href, oldResponse);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(networkResponse));

    let responsePromise: Promise<Response> | undefined;
    runtime.listeners.fetch[0]?.({
      request: createNavigationRequest(),
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
    });

    expect(responsePromise).toBeDefined();
    expect(await responsePromise!.then((response) => response.text())).toBe('new network');
    expect(fetch).toHaveBeenCalledTimes(1);
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('offline navigation 依序回退 cached / 與 cached /index.html', async () => {
    const runtime = await loadServiceWorkerRuntime(['tokyo-mate-app-shell-v2']);
    const fallbackResponse = new Response('cached shell');
    runtime.cacheRecords.get('tokyo-mate-app-shell-v2')?.set(new URL('/index.html', location.origin).href, fallbackResponse);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    let responsePromise: Promise<Response> | undefined;
    runtime.listeners.fetch[0]?.({
      request: createNavigationRequest(),
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
    });

    expect(responsePromise).toBeDefined();
    expect(await responsePromise!.then((response) => response.text())).toBe('cached shell');
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('navigation network 與 App Shell 都失敗時誠實失敗，不回傳虛假成功', async () => {
    const runtime = await loadServiceWorkerRuntime(['tokyo-mate-app-shell-v2']);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    let responsePromise: Promise<Response> | undefined;
    runtime.listeners.fetch[0]?.({
      request: createNavigationRequest(),
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
    });

    expect(responsePromise).toBeDefined();
    await expect(responsePromise!).rejects.toThrow('offline');
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('activate 後刪除 v1 舊 cache，保留目前版本 cache', async () => {
    const runtime = await loadServiceWorkerRuntime(['tokyo-mate-app-shell-v1', 'tokyo-mate-app-shell-v2']);
    const waitForActivation: Promise<unknown>[] = [];
    runtime.listeners.activate[0]?.({ waitUntil: (promise: Promise<unknown>) => waitForActivation.push(promise) });
    await Promise.all(waitForActivation);

    expect(runtime.cacheApi.delete).toHaveBeenCalledWith('tokyo-mate-app-shell-v1');
    expect(runtime.cacheRecords.has('tokyo-mate-app-shell-v2')).toBe(true);
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('hashed static asset 維持 cache-first，miss 才 fetch 並寫入目前版本 cache', async () => {
    const runtime = await loadServiceWorkerRuntime(['tokyo-mate-app-shell-v2']);
    const request = new Request(`${location.origin}/assets/main-hash.js`);
    const networkResponse = new Response('asset');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(networkResponse));

    let responsePromise: Promise<Response> | undefined;
    runtime.listeners.fetch[0]?.({ request, respondWith: (response: Promise<Response>) => { responsePromise = response; } });
    expect(await responsePromise).toBe(networkResponse);
    expect(fetch).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(runtime.cacheRecords.get('tokyo-mate-app-shell-v2')?.has(request.url)).toBe(true);
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('hashed static asset cache hit 優先回傳 cache，不呼叫 network', async () => {
    const runtime = await loadServiceWorkerRuntime();
    const request = new Request(`${location.origin}/assets/main-hash.js`);
    const cachedResponse = new Response('cached asset');
    runtime.cacheRecords.get(APP_SHELL_CACHE)?.set(request.url, cachedResponse);
    const network = vi.fn();
    vi.stubGlobal('fetch', network);

    let responsePromise: Promise<Response> | undefined;
    runtime.listeners.fetch[0]?.({ request, respondWith: (response: Promise<Response>) => { responsePromise = response; } });
    expect(responsePromise).toBeDefined();
    expect(await responsePromise!.then((response) => response.text())).toBe('cached asset');
    expect(network).not.toHaveBeenCalled();
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('API、speech、Places 與非 GET request 均不可快取', () => {
    const forbidden = [
      new Request(`${location.origin}/api/assistant`),
      new Request(`${location.origin}/api/speech`),
      new Request(`${location.origin}/api/places`),
      new Request(`${location.origin}/assets/main.js`, { method: 'POST' }),
    ];
    for (const request of forbidden) {
      expect(isCacheableRequest(request)).toBe(false);
    }
  });
});
