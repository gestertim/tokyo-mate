// Browser-side entry check only; must not import service-worker.ts to avoid pulling the SW runtime into the main bundle graph.
export function shouldRegisterServiceWorker(): boolean {
  return 'serviceWorker' in navigator && Boolean(import.meta.env.PROD);
}
