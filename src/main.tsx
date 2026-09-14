import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { shouldRegisterServiceWorker } from './service-worker';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (shouldRegisterServiceWorker()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { type: 'module' }).catch(() => {
      // Registration failure must not block app usage; core features already have offline/online fallbacks.
    });
  });
}
