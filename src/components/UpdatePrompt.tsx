import { useEffect, useRef, useState } from 'react';

/**
 * FR-024 / SC-013: 偵測新版本時只提示，絕不無提示強制 reload 中斷使用者目前任務。
 */
export function useServiceWorkerUpdate() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const reloadedRef = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;

    function trackInstallingWorker(worker: ServiceWorker | null) {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          setWaitingWorker(worker);
        }
      });
    }

    navigator.serviceWorker.getRegistration().then((existing) => {
      registration = existing;
      if (registration?.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(registration.waiting);
      }
      registration?.addEventListener('updatefound', () => {
        trackInstallingWorker(registration?.installing ?? null);
      });
    });

    function handleControllerChange() {
      if (reloadedRef.current) return;
      reloadedRef.current = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
  }, []);

  function applyUpdate() {
    waitingWorker?.postMessage('SKIP_WAITING');
  }

  function dismiss() {
    setWaitingWorker(null);
  }

  return { updateAvailable: Boolean(waitingWorker), applyUpdate, dismiss };
}

export function UpdatePrompt() {
  const { updateAvailable, applyUpdate, dismiss } = useServiceWorkerUpdate();
  if (!updateAvailable) return null;

  return (
    <div role="status" aria-label="應用程式更新提示">
      <p>有新版本可用，可稍後更新，不會中斷目前操作。</p>
      <button type="button" onClick={dismiss}>
        稍後更新
      </button>
      <button type="button" onClick={applyUpdate}>
        立即更新
      </button>
    </div>
  );
}
