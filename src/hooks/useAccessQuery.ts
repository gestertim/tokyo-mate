import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessApiError } from '../services/access-api';
import { ACCESS_FRESHNESS_POLICY, type AccessFreshnessPolicy } from './accessFreshness';
const isHidden = () => document.visibilityState === 'hidden';

export type AccessQueryState<T> = { status: 'loading' } | { status: 'ready'; data: T } |
  { status: 'error'; message: string; code?: string; title?: string; quotaScope?: 'all' | 'request' };

interface Options<T> {
  freshness?: AccessFreshnessPolicy;
  expiresAt?(data: T): number;
  unknownMessage?: string;
}
export function useAccessQuery<T>(loader: (signal?: AbortSignal) => Promise<T>, options: Options<T> = {}) {
  const freshness = options.freshness ?? ACCESS_FRESHNESS_POLICY;
  const expiresAt = options.expiresAt;
  const unknownMessage = options.unknownMessage ?? '目前無法確認使用狀態。請稍後手動重新整理。';
  if (!Number.isSafeInteger(freshness.maxAgeMs) || freshness.maxAgeMs <= 0)
    throw new TypeError('快照 freshness 必須為明列正整數');
  const [state, setState] = useState<AccessQueryState<T>>({ status: 'loading' });
  const controller = useRef<AbortController>();
  const sequence = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const lastClock = useRef<number>();
  const invalidate = useCallback(() => {
    ++sequence.current;
    controller.current?.abort();
    clearTimeout(timer.current);
  }, []);
  const refresh = useCallback(async (): Promise<T | null> => {
    invalidate();
    const id = sequence.current;
    if (!navigator.onLine) {
      setState({ status: 'error', message: '目前離線，無法確認使用狀態。你仍可查看公開內容。' });
      return null;
    }
    if (isHidden()) {
      setState({ status: 'loading' });
      return null;
    }
    const startedAt = freshness.now();
    const current = new AbortController();
    controller.current = current;
    setState({ status: 'loading' });
    try {
      const data = await loader(current.signal);
      if (current.signal.aborted || sequence.current !== id) return null;
      const receivedAt = freshness.now();
      const remaining = Math.min(freshness.maxAgeMs, (expiresAt?.(data) ?? Infinity) - receivedAt);
      if (!Number.isFinite(startedAt) || !Number.isFinite(receivedAt) || receivedAt < startedAt ||
          (lastClock.current !== undefined && receivedAt < lastClock.current) ||
          !Number.isFinite(remaining) || remaining <= 0 ||
          !navigator.onLine || isHidden()) throw new Error(unknownMessage);
      lastClock.current = receivedAt;
      setState({ status: 'ready', data });
      timer.current = setTimeout(() => {
        if (sequence.current !== id) return;
        invalidate();
        setState({ status: 'error', message: unknownMessage });
      }, Math.min(remaining, 2_147_483_647));
      return data;
    } catch (error) {
      if (current.signal.aborted || sequence.current !== id) return null;
      setState({ status: 'error', code: error instanceof AccessApiError ? error.code : undefined,
        title: error instanceof AccessApiError ? error.details?.userTitle : undefined,
        quotaScope: error instanceof AccessApiError ? error.details?.quotaScope : undefined,
        message: error instanceof AccessApiError ? error.message :
          options.unknownMessage ? unknownMessage : error instanceof Error ? error.message : unknownMessage });
      return null;
    }
  }, [loader, freshness, expiresAt, unknownMessage, options.unknownMessage, invalidate]);
  useEffect(() => {
    void refresh();
    const restore = () => { if (document.visibilityState === 'visible') void refresh(); };
    const visibility = () => {
      if (document.visibilityState === 'visible') restore();
      else {
        invalidate();
        setState({ status: 'loading' });
      }
    };
    const offline = () => {
      invalidate();
      setState({ status: 'error', message: '目前離線，無法確認使用狀態。你仍可查看公開內容。' });
    };
    window.addEventListener('focus', restore);
    window.addEventListener('online', restore);
    window.addEventListener('offline', offline);
    window.addEventListener('pageshow', restore);
    const suspend = () => { invalidate(); setState({ status: 'loading' }); };
    window.addEventListener('pagehide', suspend);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('tokyo-mate:quota-changed', restore);
    return () => {
      invalidate();
      window.removeEventListener('focus', restore);
      window.removeEventListener('online', restore);
      window.removeEventListener('offline', offline);
      window.removeEventListener('pageshow', restore);
      window.removeEventListener('pagehide', suspend);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('tokyo-mate:quota-changed', restore);
    };
  }, [refresh, invalidate]);
  return { state, refresh };
}
