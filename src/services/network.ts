import { useEffect, useState } from 'react';

export function isNetworkRequiredAvailable(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

export function useNetworkStatus(): boolean {
  const [online, setOnline] = useState(isNetworkRequiredAvailable);
  useEffect(() => {
    const setOnlineState = () => setOnline(true);
    const setOfflineState = () => setOnline(false);
    window.addEventListener('online', setOnlineState);
    window.addEventListener('offline', setOfflineState);
    return () => {
      window.removeEventListener('online', setOnlineState);
      window.removeEventListener('offline', setOfflineState);
    };
  }, []);
  return online;
}