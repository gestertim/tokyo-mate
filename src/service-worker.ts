export const APP_SHELL_CACHE = 'tokyo-mate-app-shell-v1';
export const APPROVED_STATIC_PREFIXES = ['/assets/', '/src/data/tokyo/', '/icons/'];
export const PRECACHE_URLS = ['/', '/index.html', '/manifest.webmanifest'];

export function isCacheableRequest(request: Request): boolean {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return false;
  if (request.method !== 'GET') return false;
  return APPROVED_STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

export function shouldRegisterServiceWorker(): boolean {
  return 'serviceWorker' in navigator && Boolean(import.meta.env.PROD);
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
    event.waitUntil(
      caches
        .keys()
        .then((keys: string[]) => Promise.all(keys.filter((key) => key !== APP_SHELL_CACHE).map((key) => caches.delete(key))))
        .then(() => self.clients?.claim?.()),
    );
  });

  // Update prompts request skip-waiting only after the user opts in; never auto-applied.
  self.addEventListener('message', (event: any) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
  });

  self.addEventListener('fetch', (event: any) => {
    const request = event.request as Request;
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