import { createHmac } from 'node:crypto';
import type { RateLimiter, RateResult } from './protected-endpoint-pipeline';
import { RATE_POLICY, type RateBucket } from './local-protection-policy';
import { createRedisAtomicTransport } from './redis-atomic-transport';
import { createRedisClockLua } from './redis-quota-script';
import { decodeRedisReply, isRedisObject, REDIS_QUOTA_KEYS, type RedisStoreOptions } from './redis-shared-store';

export const REDIS_RATE_LUA = createRedisClockLua(['string']) + String.raw`
local c=cjson.decode(ARGV[1])
local start=math.floor(now/60000)*60000
local raw=redis.call('GET',KEYS[1])
local count=0
if raw then
  local previous=cjson.decode(raw)
  if not safe(previous.start) or not safe(previous.count) or previous.start>start then error('INVALID_RATE_COUNTER') end
  if previous.start==start then count=previous.count end
end
if count>=c.limit then return reply({kind='limited',retryAfterSeconds=math.ceil((start+60000-now)/1000)}) end
redis.call('SET',KEYS[1],encode({start=start,count=count+1}),'PX',start+120000-now)
return '{"kind":"allowed"}'
`;

export interface RedisRateOptions extends RedisStoreOptions {
  bucket: RateBucket;
  /** 僅本機依賴注入；正式 HMAC 生命週期與可信入口仍待批准／取證。 */
  hmacKey: Uint8Array;
}
export function createRedisRateLimiter(options: RedisRateOptions): RateLimiter & { consume(key: string): Promise<RateResult> } {
  REDIS_QUOTA_KEYS(options.namespace);
  if (!(options.hmacKey instanceof Uint8Array) || options.hmacKey.byteLength < 32 ||
      !Object.hasOwn(RATE_POLICY, options.bucket)) throw new TypeError('限流需要可信桶與去識別化金鑰');
  const hmacKey = Buffer.from(options.hmacKey);
  return {
    async consume(key): Promise<RateResult> {
      if (typeof key !== 'string' || !/^[A-Za-z0-9_.:@/-]{1,128}$/.test(key))
        throw new TypeError('限流 key 必須由可信入口或目前 subject 提供');
      const digest = createHmac('sha256', hmacKey).update(`tokyo-mate/rate/${options.bucket}:${key}`).digest('hex');
      const driver = createRedisAtomicTransport({ ...options,
        keys: [`${options.namespace}:rate:${options.bucket}:${digest}`] });
      try {
        const result = decodeRedisReply(await driver.execute(REDIS_RATE_LUA, { limit: RATE_POLICY[options.bucket] }));
        if (isRedisObject(result) && result.kind === 'allowed' && Reflect.ownKeys(result).length === 1)
          return { kind: 'allowed' };
        if (isRedisObject(result) && result.kind === 'limited' && Reflect.ownKeys(result).length === 2 &&
            typeof result.retryAfterSeconds === 'number' && Number.isSafeInteger(result.retryAfterSeconds) &&
            result.retryAfterSeconds >= 1 && result.retryAfterSeconds <= 60)
          return { kind: 'limited', retryAfterSeconds: result.retryAfterSeconds };
        options.audit({ operation: 'redis_atomic', outcome: 'unavailable' });
        return { kind: 'unavailable' };
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        options.audit({ operation: 'redis_atomic', outcome: 'unavailable' });
        return { kind: 'unavailable' };
      }
    },
  };
}
