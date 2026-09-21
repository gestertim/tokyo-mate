import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APP_SHELL_CACHE,
  APP_SHELL_CACHE_PREFIX,
  APPROVED_STATIC_PREFIXES,
  AUDIO_CACHE,
  AUDIO_CACHE_PREFIX,
  isAudioAssetRequest,
  isCacheableRequest,
  isSafeAppShellResponse,
  isServiceWorkerRuntime,
  PRECACHE_URLS,
} from './service-worker';

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
  const claim = vi.fn(async () => undefined);
  const skipWaiting = vi.fn(async () => undefined);
  const serviceWorkerGlobal = {
    addEventListener: (type: string, handler: (event: any) => void) => {
      listeners[type] = [...(listeners[type] ?? []), handler];
    },
    clients: { claim },
    skipWaiting,
  };
  const originalSelf = Object.getOwnPropertyDescriptor(globalThis, 'self');
  const originalCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  Object.defineProperty(globalThis, 'self', { configurable: true, value: serviceWorkerGlobal });
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: cacheApi });
  vi.resetModules();
  const serviceWorker = await import('./service-worker');
  return { cacheApi, cacheRecords, claim, listeners, originalCaches, originalSelf, serviceWorker, skipWaiting };
}

function dispatchLifecycleEvent(
  listener: ((event: { waitUntil: (promise: Promise<unknown>) => void }) => void) | undefined,
) {
  const waitUntilPromises: Promise<unknown>[] = [];
  listener?.({ waitUntil: (promise) => waitUntilPromises.push(promise) });
  expect(waitUntilPromises).toHaveLength(1);
  return waitUntilPromises[0]!;
}

function createNavigationRequest() {
  const request = new Request(`${location.origin}/`);
  Object.defineProperty(request, 'mode', { configurable: true, value: 'navigate' });
  return request;
}

function createAudioRequest(phraseId = 'tj-001') {
  return new Request(`${location.origin}/audio/travel-japanese/${phraseId}.mp3`);
}

function createNetworkResponse(
  body: string,
  overrides: { ok?: boolean; redirected?: boolean; type?: string; contentType?: string } = {},
) {
  const headers = overrides.contentType ? { 'Content-Type': overrides.contentType } : undefined;
  const response = new Response(body, { headers });
  if (overrides.ok !== undefined) {
    Object.defineProperty(response, 'ok', { configurable: true, value: overrides.ok });
  }
  if (overrides.redirected !== undefined) {
    Object.defineProperty(response, 'redirected', { configurable: true, value: overrides.redirected });
  }
  if (overrides.type !== undefined) {
    Object.defineProperty(response, 'type', { configurable: true, value: overrides.type });
  }
  return response;
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
    await dispatchLifecycleEvent(runtime.listeners.activate[0]);

    expect(runtime.cacheApi.delete).toHaveBeenCalledWith('tokyo-mate-app-shell-v1');
    expect(runtime.cacheRecords.has('tokyo-mate-app-shell-v2')).toBe(true);
    expect(runtime.claim).toHaveBeenCalledTimes(1);
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

describe('PWA Hotfix Safety Correction Gate', () => {
  it('activate cleanup 成功時完成 waitUntil 並恰好 claim 一次 client ownership', async () => {
    const runtime = await loadServiceWorkerRuntime(['tokyo-mate-app-shell-v1', APP_SHELL_CACHE]);

    await expect(dispatchLifecycleEvent(runtime.listeners.activate[0])).resolves.toBeUndefined();

    expect(runtime.cacheApi.keys).toHaveBeenCalledTimes(1);
    expect(runtime.cacheApi.delete).toHaveBeenCalledWith('tokyo-mate-app-shell-v1');
    expect(runtime.claim).toHaveBeenCalledTimes(1);
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('cleanup 失敗仍嘗試 claim，並讓 waitUntil 可觀察 cleanup error', async () => {
    const runtime = await loadServiceWorkerRuntime(['tokyo-mate-app-shell-v1', APP_SHELL_CACHE]);
    const cleanupError = new Error('cache cleanup failed');
    runtime.cacheApi.delete.mockRejectedValueOnce(cleanupError);

    await expect(dispatchLifecycleEvent(runtime.listeners.activate[0])).rejects.toBe(cleanupError);
    expect(runtime.claim).toHaveBeenCalledTimes(1);
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('claim 失敗時 waitUntil 反映 rejection，不靜默當成成功', async () => {
    const runtime = await loadServiceWorkerRuntime(['tokyo-mate-app-shell-v1', APP_SHELL_CACHE]);
    const claimError = new Error('claim failed');
    runtime.claim.mockRejectedValueOnce(claimError);

    await expect(dispatchLifecycleEvent(runtime.listeners.activate[0])).rejects.toBe(claimError);
    expect(runtime.cacheApi.delete).toHaveBeenCalledWith('tokyo-mate-app-shell-v1');
    expect(runtime.claim).toHaveBeenCalledTimes(1);
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('install 不自行 skipWaiting，僅 SKIP_WAITING message 可觸發', async () => {
    const runtime = await loadServiceWorkerRuntime();

    await expect(dispatchLifecycleEvent(runtime.listeners.install[0])).resolves.toBeUndefined();
    expect(runtime.skipWaiting).not.toHaveBeenCalled();

    runtime.listeners.message[0]?.({ data: 'IGNORE' });
    expect(runtime.skipWaiting).not.toHaveBeenCalled();

    runtime.listeners.message[0]?.({ data: 'SKIP_WAITING' });
    expect(runtime.skipWaiting).toHaveBeenCalledTimes(1);
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('activate 只刪除 Tokyo Mate App Shell namespace 的舊版 cache，保留其他 origin cache', async () => {
    const runtime = await loadServiceWorkerRuntime([
      'tokyo-mate-app-shell-v1',
      'tokyo-mate-app-shell-v2',
      'another-app-cache-v3',
      'unrelated-runtime-cache',
    ]);
    const waitForActivation: Promise<unknown>[] = [];
    runtime.listeners.activate[0]?.({ waitUntil: (promise: Promise<unknown>) => waitForActivation.push(promise) });
    await Promise.all(waitForActivation);

    expect(runtime.cacheApi.delete).toHaveBeenCalledWith('tokyo-mate-app-shell-v1');
    expect(runtime.cacheApi.delete).not.toHaveBeenCalledWith('another-app-cache-v3');
    expect(runtime.cacheApi.delete).not.toHaveBeenCalledWith('unrelated-runtime-cache');
    expect(runtime.cacheRecords.has('tokyo-mate-app-shell-v2')).toBe(true);
    expect(runtime.cacheRecords.has('another-app-cache-v3')).toBe(true);
    expect(runtime.cacheRecords.has('unrelated-runtime-cache')).toBe(true);
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('APP_SHELL_CACHE 必須落在 APP_SHELL_CACHE_PREFIX namespace 之內', () => {
    expect(APP_SHELL_CACHE.startsWith(APP_SHELL_CACHE_PREFIX)).toBe(true);
  });

  it('redirected navigation response 可回傳給瀏覽器，但不得寫入 App Shell cache', async () => {
    const runtime = await loadServiceWorkerRuntime(['tokyo-mate-app-shell-v2']);
    const networkResponse = createNetworkResponse('redirected body', {
      ok: true,
      redirected: true,
      type: 'basic',
      contentType: 'text/html',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(networkResponse));

    let responsePromise: Promise<Response> | undefined;
    runtime.listeners.fetch[0]?.({
      request: createNavigationRequest(),
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
    });

    const response = await responsePromise!;
    expect(await response.text()).toBe('redirected body');
    await Promise.resolve();
    expect(runtime.cacheRecords.get('tokyo-mate-app-shell-v2')?.has(new URL('/', location.origin).href)).toBe(false);
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it.each(['opaque', 'error'])('%s response type 不得寫入 App Shell cache', async (unsafeType) => {
    const runtime = await loadServiceWorkerRuntime(['tokyo-mate-app-shell-v2']);
    const networkResponse = createNetworkResponse('unsafe body', {
      ok: true,
      redirected: false,
      type: unsafeType,
      contentType: 'text/html',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(networkResponse));

    let responsePromise: Promise<Response> | undefined;
    runtime.listeners.fetch[0]?.({
      request: createNavigationRequest(),
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
    });

    const response = await responsePromise!;
    expect(await response.text()).toBe('unsafe body');
    await Promise.resolve();
    expect(runtime.cacheRecords.get('tokyo-mate-app-shell-v2')?.has(new URL('/', location.origin).href)).toBe(false);
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('非 HTML navigation response 依網路語意回傳，但不得成為 App Shell fallback', async () => {
    const runtime = await loadServiceWorkerRuntime(['tokyo-mate-app-shell-v2']);
    const networkResponse = createNetworkResponse('{"ok":true}', {
      ok: true,
      redirected: false,
      type: 'basic',
      contentType: 'application/json',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(networkResponse));

    let responsePromise: Promise<Response> | undefined;
    runtime.listeners.fetch[0]?.({
      request: createNavigationRequest(),
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
    });

    const response = await responsePromise!;
    expect(await response.text()).toBe('{"ok":true}');
    await Promise.resolve();
    expect(runtime.cacheRecords.get('tokyo-mate-app-shell-v2')?.has(new URL('/', location.origin).href)).toBe(false);
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('安全同源 HTML navigation response 可寫入目前版本 App Shell cache 並回傳原 network response', async () => {
    const runtime = await loadServiceWorkerRuntime(['tokyo-mate-app-shell-v2']);
    const networkResponse = createNetworkResponse('<html>fresh shell</html>', {
      ok: true,
      redirected: false,
      type: 'basic',
      contentType: 'text/html; charset=utf-8',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(networkResponse));

    let responsePromise: Promise<Response> | undefined;
    runtime.listeners.fetch[0]?.({
      request: createNavigationRequest(),
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
    });

    const response = await responsePromise!;
    expect(await response.text()).toBe('<html>fresh shell</html>');
    await Promise.resolve();
    expect(runtime.cacheRecords.get('tokyo-mate-app-shell-v2')?.has(new URL('/', location.origin).href)).toBe(true);
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('isSafeAppShellResponse 直接單元測試涵蓋所有邊界條件', () => {
    const safe = createNetworkResponse('ok', { ok: true, redirected: false, type: 'basic', contentType: 'text/html' });
    expect(isSafeAppShellResponse(safe)).toBe(true);

    const notOk = createNetworkResponse('fail', { ok: false, redirected: false, type: 'basic', contentType: 'text/html' });
    expect(isSafeAppShellResponse(notOk)).toBe(false);

    const redirected = createNetworkResponse('redirect', { ok: true, redirected: true, type: 'basic', contentType: 'text/html' });
    expect(isSafeAppShellResponse(redirected)).toBe(false);

    const opaque = createNetworkResponse('opaque', { ok: true, redirected: false, type: 'opaque', contentType: 'text/html' });
    expect(isSafeAppShellResponse(opaque)).toBe(false);

    const nonHtml = createNetworkResponse('json', { ok: true, redirected: false, type: 'basic', contentType: 'application/json' });
    expect(isSafeAppShellResponse(nonHtml)).toBe(false);
  });
});

describe('Travel Japanese Phrase Audio Runtime Cache（Feature 004 Maintenance Phase 13）', () => {
  it('audio cache namespace/version 與 App Shell cache 區隔', () => {
    expect(AUDIO_CACHE.startsWith(AUDIO_CACHE_PREFIX)).toBe(true);
    expect(AUDIO_CACHE).not.toBe(APP_SHELL_CACHE);
    expect(AUDIO_CACHE_PREFIX).not.toBe(APP_SHELL_CACHE_PREFIX);
  });

  it('isAudioAssetRequest 僅比對 /audio/travel-japanese/ 路徑前綴且限 GET', () => {
    expect(isAudioAssetRequest(createAudioRequest('tj-001'))).toBe(true);
    expect(isAudioAssetRequest(new Request(`${location.origin}/assets/main.js`))).toBe(false);
    expect(isAudioAssetRequest(new Request(`${location.origin}/api/speech`))).toBe(false);
    expect(isAudioAssetRequest(new Request(`${location.origin}/audio/travel-japanese/tj-001.mp3`, { method: 'POST' }))).toBe(false);
  });

  it('PRECACHE_URLS 與 APPROVED_STATIC_PREFIXES 不涵蓋音檔路徑（install 階段不主動下載全部音檔）', () => {
    for (const url of PRECACHE_URLS) {
      expect(url.startsWith('/audio/travel-japanese/')).toBe(false);
    }
    for (const prefix of APPROVED_STATIC_PREFIXES) {
      expect(prefix.startsWith('/audio/travel-japanese/')).toBe(false);
    }
  });

  it('音檔首次成功 fetch（2xx）後寫入 audio cache，第二次同一 request 由 cache 命中且 fetch 不再被呼叫', async () => {
    const runtime = await loadServiceWorkerRuntime([APP_SHELL_CACHE, AUDIO_CACHE]);
    const networkResponse = new Response('audio-bytes', { status: 200 });
    const fetchSpy = vi.fn().mockResolvedValue(networkResponse);
    vi.stubGlobal('fetch', fetchSpy);

    const request = createAudioRequest('tj-001');
    let firstResponsePromise: Promise<Response> | undefined;
    runtime.listeners.fetch[0]?.({
      request,
      respondWith: (response: Promise<Response>) => {
        firstResponsePromise = response;
      },
    });
    await firstResponsePromise;
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(runtime.cacheRecords.get(AUDIO_CACHE)?.has(request.url)).toBe(true);

    let secondResponsePromise: Promise<Response> | undefined;
    runtime.listeners.fetch[0]?.({
      request: createAudioRequest('tj-001'),
      respondWith: (response: Promise<Response>) => {
        secondResponsePromise = response;
      },
    });
    await secondResponsePromise;
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('404／失敗回應不寫入 audio cache', async () => {
    const runtime = await loadServiceWorkerRuntime([APP_SHELL_CACHE, AUDIO_CACHE]);
    const notFoundResponse = new Response('not found', { status: 404 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(notFoundResponse));

    const request = createAudioRequest('tj-999');
    let responsePromise: Promise<Response> | undefined;
    runtime.listeners.fetch[0]?.({
      request,
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
    });
    const response = await responsePromise!;
    expect(response.status).toBe(404);
    expect(runtime.cacheRecords.get(AUDIO_CACHE)?.has(request.url)).toBe(false);
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('離線時已快取音檔可正常回應（不觸發 network）', async () => {
    const runtime = await loadServiceWorkerRuntime([APP_SHELL_CACHE, AUDIO_CACHE]);
    const request = createAudioRequest('tj-001');
    runtime.cacheRecords.get(AUDIO_CACHE)?.set(request.url, new Response('cached-audio-bytes'));
    const fetchSpy = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchSpy);

    let responsePromise: Promise<Response> | undefined;
    runtime.listeners.fetch[0]?.({
      request,
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
    });
    expect(await responsePromise!.then((response) => response.text())).toBe('cached-audio-bytes');
    expect(fetchSpy).not.toHaveBeenCalled();
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('離線時未快取音檔優雅失敗（respondWith promise 被 reject，但不拋出未捕捉例外）', async () => {
    const runtime = await loadServiceWorkerRuntime([APP_SHELL_CACHE, AUDIO_CACHE]);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const request = createAudioRequest('tj-002');
    let responsePromise: Promise<Response> | undefined;
    expect(() => {
      runtime.listeners.fetch[0]?.({
        request,
        respondWith: (response: Promise<Response>) => {
          responsePromise = response;
        },
      });
    }).not.toThrow();

    await expect(responsePromise!).rejects.toThrow('offline');
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('activate 階段清除舊版本 audio cache，保留目前版本與其他 cache', async () => {
    const runtime = await loadServiceWorkerRuntime([
      'travel-japanese-audio-v0',
      AUDIO_CACHE,
      APP_SHELL_CACHE,
      'unrelated-runtime-cache',
    ]);
    await dispatchLifecycleEvent(runtime.listeners.activate[0]);

    expect(runtime.cacheApi.delete).toHaveBeenCalledWith('travel-japanese-audio-v0');
    expect(runtime.cacheRecords.has(AUDIO_CACHE)).toBe(true);
    expect(runtime.cacheRecords.has(APP_SHELL_CACHE)).toBe(true);
    expect(runtime.cacheRecords.has('unrelated-runtime-cache')).toBe(true);
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });

  it('音檔 fetch handler 不影響既有 app-shell hashed asset cache-first 行為', async () => {
    const runtime = await loadServiceWorkerRuntime([APP_SHELL_CACHE, AUDIO_CACHE]);
    const request = new Request(`${location.origin}/assets/main-hash.js`);
    const cachedResponse = new Response('cached asset');
    runtime.cacheRecords.get(APP_SHELL_CACHE)?.set(request.url, cachedResponse);
    const network = vi.fn();
    vi.stubGlobal('fetch', network);

    let responsePromise: Promise<Response> | undefined;
    runtime.listeners.fetch[0]?.({ request, respondWith: (response: Promise<Response>) => { responsePromise = response; } });
    expect(await responsePromise!.then((response) => response.text())).toBe('cached asset');
    expect(network).not.toHaveBeenCalled();
    restoreGlobal('self', runtime.originalSelf);
    restoreGlobal('caches', runtime.originalCaches);
  });
});
