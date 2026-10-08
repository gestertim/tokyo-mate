import type { OAuthStateRecord, OAuthStateStore } from './oidc-flow';
import { createRedisAtomicTransport } from './redis-atomic-transport';
import { createRedisClockLua } from './redis-quota-script';
import { decodeRedisReply, isRedisObject, REDIS_QUOTA_KEYS, type RedisStoreOptions } from './redis-shared-store';
import { SharedStoreUnavailableError } from './shared-store';

export const REDIS_OAUTH_STATE_LUA = createRedisClockLua(['hash', 'zset']) + String.raw`
local c=cjson.decode(ARGV[1])
if c.operation=='cleanup' then
  local ids=redis.call('ZRANGEBYSCORE',KEYS[2],'-inf',now,'LIMIT',0,c.batchSize)
  local remove={}
  for _,id in ipairs(ids) do
    local raw=redis.call('HGET',KEYS[1],id)
    if raw and epoch(cjson.decode(raw).expiresAt)>now then error('INVALID_OAUTH_EXPIRY_INDEX') end
    table.insert(remove,id)
  end
  for _,id in ipairs(remove) do
    redis.call('HDEL',KEYS[1],id)
    redis.call('ZREM',KEYS[2],id)
  end
  return reply({inspected=#ids,removed=#remove,cleanedAt=nowIso})
end
if c.operation=='create' then
  local record=c.record
  if epoch(record.expiresAt)<=now then error('EXPIRED_OAUTH_STATE') end
  if redis.call('HGET',KEYS[1],record.state) then error('OAUTH_STATE_COLLISION') end
  redis.call('HSET',KEYS[1],record.state,encode(record))
  redis.call('ZADD',KEYS[2],epoch(record.expiresAt),record.state)
  return '{"status":"created"}'
end
if c.operation=='consume' then
  local raw=redis.call('HGET',KEYS[1],c.state)
  if not raw then return 'null' end
  local record=cjson.decode(raw)
  local expires=epoch(record.expiresAt)
  redis.call('HDEL',KEYS[1],c.state)
  redis.call('ZREM',KEYS[2],c.state)
  if expires<=now then return 'null' end
  return raw
end
error('UNKNOWN_OAUTH_STATE_OPERATION')
`;

const tokenValid = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
function recordValid(value: unknown): value is OAuthStateRecord {
  if (!isRedisObject(value) || Reflect.ownKeys(value).length !== 4 ||
      !tokenValid(value.state) || !tokenValid(value.nonce) || !tokenValid(value.verifier) ||
      typeof value.expiresAt !== 'string') return false;
  const expires = Date.parse(value.expiresAt);
  return Number.isFinite(expires) && new Date(expires).toISOString() === value.expiresAt;
}

export function createRedisOAuthStateStore(options: RedisStoreOptions): OAuthStateStore & {
  cleanup(policy: { batchSize: number }): Promise<{ inspected: number; removed: number; cleanedAt: string }>;
} {
  REDIS_QUOTA_KEYS(options.namespace);
  const driver = createRedisAtomicTransport({
    ...options, keys: [`${options.namespace}:oauth-states`, `${options.namespace}:oauth-state-expiry`],
  });
  const invalidReply = (): never => {
    options.audit({ operation: 'redis_atomic', outcome: 'unavailable' });
    throw new SharedStoreUnavailableError('INVALID_OAUTH_STATE_EVIDENCE');
  };
  const call = async (command: object) => {
    const raw = await driver.execute(REDIS_OAUTH_STATE_LUA, command);
    try { return decodeRedisReply(raw); }
    catch (error) {
      if (!(error instanceof SharedStoreUnavailableError)) throw error;
      return invalidReply();
    }
  };
  return {
    async cleanup(policy) {
      if (!Number.isSafeInteger(policy.batchSize) || policy.batchSize <= 0)
        throw new TypeError('OAuth state 清理需要明列的正整數批次上限');
      const result = await call({ operation: 'cleanup', batchSize: policy.batchSize });
      if (!isRedisObject(result) || typeof result.inspected !== 'number' ||
          !Number.isSafeInteger(result.inspected) || result.inspected < 0 || result.inspected > policy.batchSize ||
          typeof result.removed !== 'number' || !Number.isSafeInteger(result.removed) ||
          result.removed < 0 || result.removed > result.inspected ||
          typeof result.cleanedAt !== 'string' || !Number.isFinite(Date.parse(result.cleanedAt)) ||
          new Date(result.cleanedAt).toISOString() !== result.cleanedAt) return invalidReply();
      return { inspected: result.inspected, removed: result.removed, cleanedAt: result.cleanedAt };
    },
    async create(record) {
      if (!recordValid(record)) throw new TypeError('OAuth state 需要明確有效的 nonce／PKCE／期限');
      const result = await call({ operation: 'create', record });
      if (!isRedisObject(result) || result.status !== 'created') invalidReply();
    },
    async consume(state) {
      if (!tokenValid(state)) throw new TypeError('無效 OAuth state');
      const result = await call({ operation: 'consume', state });
      if (result === null) return null;
      if (!recordValid(result) || result.state !== state) return invalidReply();
      return result;
    },
  };
}
