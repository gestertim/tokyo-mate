import { createHash, randomUUID } from 'node:crypto';
import { createRedisAtomicTransport } from './redis-atomic-transport';
import { REDIS_CLOCK_LUA } from './redis-quota-script';
import { decodeRedisReply, isRedisObject, REDIS_QUOTA_KEYS, type RedisStoreOptions } from './redis-shared-store';
import { SharedStoreUnavailableError } from './shared-store';
import { INITIAL_TILE_POLICY, type TileData, type TileStore } from './tile-proxy-pipeline';

export const REDIS_TILE_LUA = REDIS_CLOCK_LUA + String.raw`
local c=cjson.decode(ARGV[1]); local w=windows()
local function load(key,field) local raw=redis.call('HGET',key,field); return raw and cjson.decode(raw) or nil end
local function credits(day)
  return load(KEYS[4],day) or {reservedQuarters=0,settledQuarters=0,uncertainQuarters=0,actualUpstreamRequestCount=0}
end
if c.operation=='cleanupCache' then
  local scan=redis.call('HSCAN',KEYS[2],c.cursor,'COUNT',c.batchSize); local remove={}
  for i=1,#scan[2],2 do
    local record=cjson.decode(scan[2][i+1])
    if not safe(record.expiresAtMs) then error('INVALID_CACHE_EXPIRY') end
    if record.expiresAtMs<=now then table.insert(remove,scan[2][i]) end
  end
  for _,key in ipairs(remove) do redis.call('HDEL',KEYS[2],key) end
  return reply({cursor=tostring(scan[1]),removed=#remove})
end
local function transition(f,kind,data)
  if f.status~='reserved' then
    if f.status==kind and (kind=='uncertain' or same(f.data,data)) then return end
    error('TILE_SETTLEMENT_CONFLICT')
  end
  local site=credits(f.dayKey)
  if site.reservedQuarters<1 then error('INVALID_SITE_CREDITS') end
  site.reservedQuarters=site.reservedQuarters-1
  if kind=='settled' then site.settledQuarters=add(site.settledQuarters,1)
  else site.uncertainQuarters=add(site.uncertainQuarters,1) end
  site.actualUpstreamRequestCount=add(site.actualUpstreamRequestCount,1)
  f.status=kind; f.data=data
  local encodedSite=encode(site); local encodedFlight=encode(f)
  redis.call('HSET',KEYS[4],f.dayKey,encodedSite)
  redis.call('HSET',KEYS[3],f.flightId,encodedFlight)
end
if c.operation=='consume' then
  local counts=load(KEYS[1],c.subject) or {minute=math.floor(now/60000),dayKey=w.day.windowKey,minuteCount=0,dayCount=0}
  local minute=math.floor(now/60000)
  if counts.minute~=minute then counts.minute=minute; counts.minuteCount=0 end
  if counts.dayKey~=w.day.windowKey then counts.dayKey=w.day.windowKey; counts.dayCount=0 end
  if counts.minuteCount>=c.policy.perMinute or counts.dayCount>=c.policy.perDay then return '{"status":"limited"}' end
  counts.minuteCount=add(counts.minuteCount,1); counts.dayCount=add(counts.dayCount,1)
  redis.call('HSET',KEYS[1],c.subject,encode(counts))
  return '{"status":"allowed"}'
end
if c.operation=='lookup' then
  local cached=load(KEYS[2],c.tileKey)
  if cached and cached.expiresAtMs>now then
    local hits=tonumber(redis.call('HGET',KEYS[4],'sharedCacheHitCount') or '0')
    redis.call('HSET',KEYS[4],'sharedCacheHitCount',add(hits,1))
    return reply({kind='hit',data=cached.data})
  end
  local id=redis.call('HGET',KEYS[3],'tile:'..c.tileKey)
  if id then
    local f=load(KEYS[3],id)
    if not f then error('MISSING_SHARED_FLIGHT') end
    if f.status=='reserved' then
      if f.leaseExpiresAtMs<=now then transition(f,'uncertain',nil); return '{"kind":"unavailable"}' end
      return reply({kind='wait',flightId=f.flightId})
    end
    if f.status=='uncertain' then return '{"kind":"unavailable"}' end
  end
  local site=credits(w.day.windowKey)
  if add(add(site.reservedQuarters,site.settledQuarters),site.uncertainQuarters)>=c.policy.dailyCreditQuarters then
    return '{"kind":"unavailable"}'
  end
  if redis.call('HGET',KEYS[3],c.flightId) then error('FLIGHT_ID_COLLISION') end
  site.reservedQuarters=add(site.reservedQuarters,1)
  local f={tileKey=c.tileKey,flightId=c.flightId,dayKey=w.day.windowKey,status='reserved',reservedAtMs=now,leaseExpiresAtMs=add(now,c.leaseMs)}
  local encodedSite=encode(site); local encodedFlight=encode(f)
  redis.call('HSET',KEYS[4],w.day.windowKey,encodedSite)
  redis.call('HSET',KEYS[3],c.flightId,encodedFlight,'tile:'..c.tileKey,c.flightId)
  return reply({kind='leader',flightId=c.flightId,reservedAtMs=now,leaseExpiresAtMs=f.leaseExpiresAtMs})
end
if c.operation=='wait' or c.operation=='finish' then
  local f=load(KEYS[3],c.flightId); if not f then error('MISSING_SHARED_FLIGHT') end
  if c.operation=='wait' then
    if f.status=='reserved' and f.leaseExpiresAtMs<=now then transition(f,'uncertain',nil) end
    if f.status=='settled' then return reply({kind='hit',data=f.data}) end
    return reply({kind=f.status=='reserved' and 'pending' or 'unavailable'})
  end
  if c.kind=='success' then
    if f.status=='settled' then
      if not same(f.data,c.data) then error('TILE_SETTLEMENT_CONFLICT') end
      return '{"status":"finished"}'
    end
    if f.status=='uncertain' or (f.status=='reserved' and f.leaseExpiresAtMs<=now) then
      if f.status=='reserved' then transition(f,'uncertain',nil) end
      return '{"status":"uncertain"}'
    end
    local cache=encode({data=c.data,expiresAtMs=add(now,mul(c.cacheTtlSeconds,1000))})
    transition(f,'settled',c.data)
    redis.call('HSET',KEYS[2],f.tileKey,cache)
  else transition(f,'uncertain',nil) end
  return '{"status":"finished"}'
end
error('UNKNOWN_TILE_OPERATION')
`;

export interface RedisTileOptions extends RedisStoreOptions {
  flightLeaseMs: number;
  waitTimeoutMs: number;
  pollIntervalMs: number;
  maxTileBytes: number;
  newFlightId?(): string;
}

export function createRedisTileStore(options: RedisTileOptions): TileStore & {
  cleanupCache(batch: { cursor: string; batchSize: number }): Promise<{ cursor: string; removed: number }>;
} {
  REDIS_QUOTA_KEYS(options.namespace);
  if (![options.flightLeaseMs, options.waitTimeoutMs, options.pollIntervalMs, options.maxTileBytes]
    .every((v) => Number.isSafeInteger(v) && v > 0) || options.pollIntervalMs > options.waitTimeoutMs)
    throw new TypeError('圖磚共享狀態需要明確 lease、等待與資料上限；不可採正式預設值');
  const driver = createRedisAtomicTransport({ ...options, keys: [
    `${options.namespace}:tile-users`, `${options.namespace}:tile-cache`,
    `${options.namespace}:tile-flights`, `${options.namespace}:tile-credits`,
  ] });
  const call = async (command: object) => {
    const raw = decodeRedisReply(await driver.execute(REDIS_TILE_LUA, command));
    if (!isRedisObject(raw)) throw new SharedStoreUnavailableError('INVALID_TILE_STORE_REPLY');
    return raw;
  };
  const decodeTile = (raw: unknown): TileData => {
    if (!isRedisObject(raw) || typeof raw.base64 !== 'string' || typeof raw.etag !== 'string')
      throw new SharedStoreUnavailableError('INVALID_SHARED_TILE');
    const bytes = Buffer.from(raw.base64, 'base64');
    if (bytes.toString('base64') !== raw.base64 || bytes.length < 8 || bytes.length > options.maxTileBytes ||
        !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
        raw.etag !== `"${createHash('sha256').update(bytes).digest('hex')}"`)
      throw new SharedStoreUnavailableError('INVALID_SHARED_TILE_BYTES');
    return { bytes, etag: raw.etag };
  };
  const policy = (value: typeof INITIAL_TILE_POLICY) => {
    if (JSON.stringify(value) !== JSON.stringify(INITIAL_TILE_POLICY)) throw new TypeError('圖磚初始政策不一致');
    return value;
  };
  const flightId = (id: string) => {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new TypeError('無效 shared flight ID');
    return id;
  };
  return {
    async cleanupCache(batch) {
      if (!/^\d+$/.test(batch.cursor) || !Number.isSafeInteger(batch.batchSize) || batch.batchSize <= 0)
        throw new TypeError('cache 清理需要明確 scan batch');
      const raw = await call({ operation: 'cleanupCache', ...batch });
      if (typeof raw.cursor !== 'string' || !/^\d+$/.test(raw.cursor) || typeof raw.removed !== 'number' ||
          !Number.isSafeInteger(raw.removed) || raw.removed < 0)
        throw new SharedStoreUnavailableError('INVALID_CACHE_CLEANUP_EVIDENCE');
      return { cursor: raw.cursor, removed: raw.removed };
    },
    async consumeUserRequest(subject, _nowIso, limits) {
      const raw = await call({ operation: 'consume', subject, policy: policy(limits) });
      if (raw.status === 'allowed' || raw.status === 'limited') return raw.status;
      throw new SharedStoreUnavailableError('INVALID_TILE_COUNTER_EVIDENCE');
    },
    async lookupOrReserve(tile, _nowIso, limits) {
      if (![tile.z, tile.x, tile.y].every(Number.isSafeInteger) || tile.z < 0 || tile.z > 20 ||
          tile.x < 0 || tile.y < 0 || tile.x >= 2 ** tile.z || tile.y >= 2 ** tile.z)
        throw new TypeError('無效圖磚座標');
      const raw = await call({ operation: 'lookup', tileKey: `osm-bright/${tile.z}/${tile.x}/${tile.y}`,
        flightId: flightId(options.newFlightId?.() ?? randomUUID()),
        leaseMs: options.flightLeaseMs, policy: policy(limits) });
      if (raw.kind === 'hit') return { kind: 'hit', data: decodeTile(raw.data) };
      if (raw.kind === 'wait' && typeof raw.flightId === 'string') return { kind: 'wait', flightId: flightId(raw.flightId) };
      if (raw.kind === 'leader' && typeof raw.flightId === 'string' &&
          typeof raw.reservedAtMs === 'number' && Number.isSafeInteger(raw.reservedAtMs) &&
          typeof raw.leaseExpiresAtMs === 'number' && Number.isSafeInteger(raw.leaseExpiresAtMs) &&
          raw.reservedAtMs >= 0 && raw.leaseExpiresAtMs - raw.reservedAtMs === options.flightLeaseMs)
        return { kind: 'leader', flightId: flightId(raw.flightId),
          reservedAtMs: raw.reservedAtMs, leaseExpiresAtMs: raw.leaseExpiresAtMs };
      if (raw.kind === 'unavailable') return { kind: 'unavailable' };
      throw new SharedStoreUnavailableError('INVALID_SHARED_FLIGHT_EVIDENCE');
    },
    async wait(id) {
      const started = performance.now();
      while (performance.now() - started < options.waitTimeoutMs) {
        const raw = await call({ operation: 'wait', flightId: flightId(id) });
        if (raw.kind === 'hit') return decodeTile(raw.data);
        if (raw.kind !== 'pending') throw new SharedStoreUnavailableError('SHARED_FLIGHT_UNCERTAIN');
        await new Promise<void>((resolve) => setTimeout(resolve, options.pollIntervalMs));
      }
      throw new SharedStoreUnavailableError('SHARED_FLIGHT_WAIT_TIMEOUT');
    },
    async finish(id, observation, cacheTtlSeconds) {
      if (cacheTtlSeconds !== INITIAL_TILE_POLICY.cacheTtlSeconds) throw new TypeError('圖磚 TTL 必須符合已批准政策');
      let data: { base64: string; etag: string } | undefined;
      if (observation.kind === 'success') {
        data = { base64: Buffer.from(observation.data.bytes).toString('base64'), etag: observation.data.etag };
        decodeTile(data);
      }
      const raw = await call({ operation: 'finish', flightId: flightId(id), kind: observation.kind, data, cacheTtlSeconds });
      if (raw.status !== 'finished') throw new SharedStoreUnavailableError('TILE_LATE_RESULT_UNCERTAIN');
    },
  };
}
