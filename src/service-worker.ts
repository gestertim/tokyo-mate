export const APP_SHELL_CACHE_PREFIX = 'tokyo-mate-app-shell-';
export const APP_SHELL_CACHE = `${APP_SHELL_CACHE_PREFIX}v2`;
export const APPROVED_STATIC_PREFIXES = ['/assets/', '/src/data/tokyo/', '/icons/'];
export const PRECACHE_URLS = ['/', '/index.html', '/manifest.webmanifest'];

// Dedicated namespace/version for travel-japanese phrase audio (Feature 004 Maintenance, Phase 13):
// kept separate from APP_SHELL_CACHE so audio invalidation never touches app-shell cache entries,
// and so install-time precache never has to cover all 108 audio files.
export const AUDIO_CACHE_PREFIX = 'travel-japanese-audio-';
export const AUDIO_CACHE = `${AUDIO_CACHE_PREFIX}v1`;
const AUDIO_REQUEST_PREFIX = '/audio/travel-japanese/';

export function isAudioAssetRequest(request: Request): boolean {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  return url.pathname.startsWith(AUDIO_REQUEST_PREFIX);
}

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
            .filter(
              (key) =>
                (key.startsWith(APP_SHELL_CACHE_PREFIX) && key !== APP_SHELL_CACHE) ||
                (key.startsWith(AUDIO_CACHE_PREFIX) && key !== AUDIO_CACHE),
            )
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
    if (isAudioAssetRequest(request)) {
      event.respondWith(handleAudioAssetRequest(request));
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

// Cache-on-first-successful-fetch (Phase 13): only a 2xx response is ever written to the audio
// cache, so a 404/failed fetch never gets mistaken for a successfully cached phrase.
function handleAudioAssetRequest(request: Request): Promise<Response> {
  return caches.open(AUDIO_CACHE).then((cache) =>
    cache.match(request).then(
      (cached: Response | undefined) =>
        cached ||
        fetch(request).then((response: Response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        }),
    ),
  );
}