import { REDIS_CLOCK_LUA } from './redis-quota-script';
import { createRedisAtomicTransport } from './redis-atomic-transport';
import { REDIS_QUOTA_KEYS, decodeRedisReply, isRedisObject, type RedisStoreOptions } from './redis-shared-store';
import { SharedStoreUnavailableError } from './shared-store';
import type { SessionRecord, SessionStore } from './session';

export const REDIS_SESSION_LUA = REDIS_CLOCK_LUA + String.raw`
local c=cjson.decode(ARGV[1])
if c.operation=='cleanup' then
  local scan=redis.call('HSCAN',KEYS[3],c.cursor,'COUNT',c.batchSize)
  local remove={}
  for i=1,#scan[2],2 do
    local record=cjson.decode(scan[2][i+1])
    if add(epoch(record.expiresAt),c.retentionMs)<=now then
      table.insert(remove,scan[2][i])
    end
  end
  for _,id in ipairs(remove) do redis.call('HDEL',KEYS[3],id) end
  return reply({cursor=tostring(scan[1]),removed=#remove})
end
local raw=redis.call('HGET',KEYS[3],c.sessionId)
if c.operation=='get' then return raw or 'null' end
if c.operation=='create' then
  if raw then error('SESSION_ID_COLLISION') end
  if epoch(c.record.createdAt)>now or epoch(c.record.expiresAt)<=now then error('INVALID_SESSION_TIME') end
  local user=redis.call('HGET',KEYS[2],c.record.identitySubject)
  local encodedSession=encode(c.record)
  local initial=nil
  if not user then
    initial=encode({identity={identitySubject=c.record.identitySubject,createdAt=c.record.createdAt},
      eligibility=cjson.null,windows={},reservations={},idempotency={},topUps={},topUpIdempotency={}})
  end
  redis.call('HSET',KEYS[3],c.sessionId,encodedSession)
  if initial then redis.call('HSET',KEYS[2],c.record.identitySubject,initial) end
  return '{"status":"created"}'
end
if c.operation=='revoke' then
  if raw then
    local record=cjson.decode(raw)
    record.revokedAt=record.revokedAt~=cjson.null and record.revokedAt or nowIso
    redis.call('HSET',KEYS[3],c.sessionId,encode(record))
  end
  return '{"status":"revoked"}'
end
error('UNKNOWN_SESSION_OPERATION')
`;

export function createRedisSessionStore(options: RedisStoreOptions): SessionStore & {
  cleanup(policy: { retentionMs: number; batchSize: number; cursor: string }): Promise<{ cursor: string; removed: number }>;
} {
  const driver = createRedisAtomicTransport({ ...options, keys: REDIS_QUOTA_KEYS(options.namespace) });
  const call = async (command: object) => decodeRedisReply(await driver.execute(REDIS_SESSION_LUA, command));
  const id = (value: string) => {
    if (!/^[0-9a-f]{64}$/.test(value)) throw new TypeError('無效 opaque Session ID');
    return value;
  };
  const acknowledgement = (result: unknown, status: string) => {
    if (!isRedisObject(result) || result.status !== status)
      throw new SharedStoreUnavailableError('INVALID_SESSION_WRITE_EVIDENCE');
  };
  return {
    async cleanup(policy) {
      if (!Number.isSafeInteger(policy.retentionMs) || policy.retentionMs < 0 ||
          !Number.isSafeInteger(policy.batchSize) || policy.batchSize <= 0 || !/^\d+$/.test(policy.cursor))
        throw new TypeError('Session 清理需要明確核准的保存參數與 scan cursor');
      const raw = await call({ operation: 'cleanup', ...policy });
      if (!isRedisObject(raw) || typeof raw.cursor !== 'string' || !/^\d+$/.test(raw.cursor) ||
          typeof raw.removed !== 'number' || !Number.isSafeInteger(raw.removed) || raw.removed < 0)
        throw new SharedStoreUnavailableError('INVALID_SESSION_CLEANUP_EVIDENCE');
      return { cursor: raw.cursor, removed: raw.removed };
    },
    async create(record) {
      acknowledgement(await call({ operation: 'create', sessionId: id(record.sessionId), record }), 'created');
    },
    async get(sessionId) {
      const result = await call({ operation: 'get', sessionId: id(sessionId) });
      if (result === null) return null;
      if (!isRedisObject(result) || result.sessionId !== sessionId ||
          typeof result.identitySubject !== 'string' || typeof result.createdAt !== 'string' ||
          typeof result.expiresAt !== 'string' || (result.revokedAt !== null && typeof result.revokedAt !== 'string'))
        throw new SharedStoreUnavailableError('INVALID_SESSION_RECORD');
      return { sessionId, identitySubject: result.identitySubject, createdAt: result.createdAt,
        expiresAt: result.expiresAt, revokedAt: result.revokedAt };
    },
    async revoke(sessionId, nowIso) {
      acknowledgement(await call({ operation: 'revoke', sessionId: id(sessionId), nowIso }), 'revoked');
    },
  };
}
