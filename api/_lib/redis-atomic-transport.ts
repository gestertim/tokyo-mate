import { SharedStoreUnavailableError, withStoreTimeout } from './shared-store';

export interface RedisEvalTransport {
  eval(script: string, keys: readonly string[], argumentsJson: string): Promise<unknown>;
}

export interface RedisAtomicTransportOptions {
  transport: RedisEvalTransport;
  keys: readonly string[];
  timeoutMs: number;
  audit(event: { operation: 'redis_atomic'; outcome: 'unavailable' }): void;
}

// 只負責單次 EVAL 邊界；業務 Lua／Redis TIME／TTL 的真實執行證據尚未完成。
export function createRedisAtomicTransport(options: RedisAtomicTransportOptions) {
  const keys = [...options.keys];
  const tags = keys.map((key) => /\{([^{}]+)\}/.exec(key)?.[1]);
  if (keys.length === 0 || keys.some((key) => !key || /[\r\n]/.test(key)) ||
      new Set(keys).size !== keys.length || tags.some((tag) => !tag || tag !== tags[0]) ||
      !Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0)
    throw new TypeError('同次原子操作需要明確 timeout 與相同 Redis hash-tag 的全部 keys');
  return {
    async execute(script: string, command: object): Promise<unknown> {
      if (typeof script !== 'string' || !script.trim()) throw new TypeError('需要明確 Lua script');
      try {
        // 不做讀取、刷新、重試或補償寫入；timeout 代表原子結果未知。
        return await withStoreTimeout(options.transport.eval(script, keys, JSON.stringify(command)), options.timeoutMs);
      } catch (error) {
        options.audit({ operation: 'redis_atomic', outcome: 'unavailable' });
        throw new SharedStoreUnavailableError(error instanceof Error ? error.name : 'REDIS_EVAL_UNAVAILABLE');
      }
    },
  };
}
