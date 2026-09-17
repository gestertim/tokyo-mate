export const APP_SHELL_CACHE_PREFIX = 'tokyo-mate-app-shell-';
export const APP_SHELL_CACHE = `${APP_SHELL_CACHE_PREFIX}v2`;
export const APPROVED_STATIC_PREFIXES = ['/assets/', '/src/data/tokyo/', '/icons/'];
export const PRECACHE_URLS = ['/', '/index.html', '/manifest.webmanifest'];

// Only same-origin, non-redirected, non-opaque HTML responses may become the offline App Shell fallback.
const SAFE_RESPONSE_TYPES = new Set(['basic', 'default']);

export function isSafeAppShellResponse(response: Response): boolean {
  if (!response.ok) return false;
  if (response.redirected) return false;
  if (!SAFE_RESPONSE_TYPES.has(response.type)) return false;
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.toLowerCase().includes('text/html');
}

export function isCacheableRequest(request: Request): boolean {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return false;
  if (request.method !== 'GET') return false;
  return APPROVED_STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

// Navigation requests (document loads) never match the static asset allowlist above.
export function isNavigationRequest(request: Request): boolean {
  return request.method === 'GET' && request.mode === 'navigate';
}

declare const self: any;

// `skipWaiting`/`clients` only exist on ServiceWorkerGlobalScope, so this reliably
// distinguishes the actual SW runtime from window/jsdom contexts that also import this module.
export function isServiceWorkerRuntime(): boolean {
  return typeof self !== 'undefined' && typeof self.skipWaiting === 'function' && typeof caches !== 'undefined';
}

if (isServiceWorkerRuntime()) {
  self.addEventListener('install', (event: any) => {
    event.waitUntil(caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
  });

  self.addEventListener('activate', (event: any) => {
    // Cleanup and claim start independently so a cleanup rejection never skips clients.claim().
    const cleanupPromise = caches
      .keys()
      .then((keys: string[]) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(APP_SHELL_CACHE_PREFIX) && key !== APP_SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      );
    const claimPromise = self.clients.claim();
    event.waitUntil(Promise.all([cleanupPromise, claimPromise]).then(() => undefined));
  });

  // Update prompts request skip-waiting only after the user opts in; never auto-applied.
  self.addEventListener('message', (event: any) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
  });

  self.addEventListener('fetch', (event: any) => {
    const request = event.request as Request;
    if (isNavigationRequest(request)) {
      event.respondWith(handleNavigationRequest(request));
      return;
    }
    if (!isCacheableRequest(request)) return;
    event.respondWith(
      caches.match(request).then(
        (cached: Response | undefined) =>
          cached ||
          fetch(request).then((response: Response) => {
            const copy = response.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  });
}

// Network-first navigation: always prefer a live response, fall back to the cached App Shell when offline.
function handleNavigationRequest(request: Request): Promise<Response> {
  return fetch(request)
    .then((response: Response) => {
      if (isSafeAppShellResponse(response)) {
        const copy = response.clone();
        caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(async (networkError: unknown) => {
      const cache = await caches.open(APP_SHELL_CACHE);
      const rootUrl = new URL('/', request.url).href;
      const indexUrl = new URL('/index.html', request.url).href;
      const cached = (await cache.match(request)) || (await cache.match(rootUrl)) || (await cache.match(indexUrl));
      if (cached) return cached;
      throw networkError;
    });
}