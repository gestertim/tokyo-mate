import { useEffect, useRef, useState } from 'react';

/**
 * FR-024 / SC-013: 偵測新版本時只提示，絕不無提示強制 reload 中斷使用者目前任務。
 */

// Feature 004 Maintenance（Phase 14）：同一 session 內，foreground registration.update() 呼叫節流間隔。
const FOREGROUND_UPDATE_THROTTLE_MS = 60_000;

export function useServiceWorkerUpdate() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const reloadedRef = useRef(false);
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const lastUpdateCheckRef = useRef(0);

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
      registrationRef.current = existing;
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

    // App 回到前景時更即時發現新版本；以基本節流避免頻繁切換前景/背景時重複呼叫 update()。
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      const currentRegistration = registrationRef.current;
      if (!currentRegistration) return;
      const now = Date.now();
      if (now - lastUpdateCheckRef.current < FOREGROUND_UPDATE_THROTTLE_MS) return;
      lastUpdateCheckRef.current = now;
      currentRegistration.update().catch(() => {});
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
