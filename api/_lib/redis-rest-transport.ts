import type { RedisEvalTransport } from './redis-atomic-transport';
import { SharedStoreUnavailableError, withStoreTimeout } from './shared-store';
import { readBoundedBytes } from './bounded-request';

export interface RedisRestTransportOptions {
  url: string;
  token: string;
  timeoutMs: number;
  maxResponseBytes: number;
  fetch: typeof fetch;
}

export function createRedisRestTransport(options: RedisRestTransportOptions): RedisEvalTransport {
  const url = new URL(options.url);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.upstash\.io$/.test(url.hostname) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      typeof options.token !== 'string' || !options.token.trim() || /[\r\n]/.test(options.token) ||
      ![options.timeoutMs, options.maxResponseBytes].every((v) => Number.isSafeInteger(v) && v > 0))
    throw new TypeError('Redis REST 需要明確可信 server-side 設定');
  return {
    async eval(script, keys, argumentsJson) {
      const controller = new AbortController();
      try {
        return await withStoreTimeout((async () => {
          const response = await options.fetch(url, {
          method: 'POST', headers: { Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(['EVAL', script, keys.length, ...keys, argumentsJson]),
          signal: controller.signal, redirect: 'error', cache: 'no-store',
        });
        if (!response.ok || !response.body) throw new SharedStoreUnavailableError('REDIS_REST_UNAVAILABLE');
          const bytes = await readBoundedBytes(response, { maxBytes: options.maxResponseBytes,
            readTimeoutMs: options.timeoutMs }, (event) => {
            console.info(JSON.stringify({ event: 'tokyo-mate.redis-reader', outcome: event.outcome }));
          });
        const raw: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        if (!raw || typeof raw !== 'object' || !('result' in raw) || 'error' in raw)
          throw new SharedStoreUnavailableError('INVALID_REDIS_REST_REPLY');
          return raw.result;
        })(), options.timeoutMs);
      } catch (error) {
        controller.abort();
        if (!(error instanceof Error)) throw error;
        // 不輸出 provider 回應、URL 或 token，也不重試結果未知的 EVAL。
        throw new SharedStoreUnavailableError('REDIS_REST_UNAVAILABLE');
      }
    },
  };
}
