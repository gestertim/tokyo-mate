import { useCallback, useEffect, useState } from 'react';
export function useAdminData<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    void load(controller.signal).then((value) => { if (!controller.signal.aborted) setData(value); })
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '無法讀取管理資料。'); });
    return () => controller.abort();
  }, [load, revision]);
  return { data, error, refresh };
}
export function AdminLoading({ error }: { error: string }) {
  return error ? <p role="alert">{error}</p> : <p role="status">正在確認管理者權限與資料。</p>;
}
