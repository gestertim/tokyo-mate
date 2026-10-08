import { createRedisAtomicTransport } from './redis-atomic-transport';
import { createRedisClockLua } from './redis-quota-script';
import { decodeRedisReply, isRedisObject, type RedisStoreOptions } from './redis-shared-store';
import { REQUEST_EPOCH_AUTHORITY_LUA, validRequestEpochAuthority, validateRequestEpochFloor } from './request-epoch-authority';
import type { RequestEpochAuthority, RequestEpochFloor, RequestEpochIssueCommand, RequestEpochIssueRecord,
  RequestEpochIssueResult, RequestEpochStore } from './request-epoch-store';

export function REQUEST_EPOCH_KEYS(namespace: string): readonly string[] {
  if (!/^\{[A-Za-z0-9_-]{1,64}\}$/.test(namespace)) throw new TypeError('需要明確且同 slot 的 Redis namespace');
  return [`${namespace}:registry`, `${namespace}:users`, `${namespace}:sessions`,
    `${namespace}:request-epoch-authority`, `${namespace}:request-epoch-issuances`,
    `${namespace}:request-epoch-unused`, `${namespace}:request-epoch-owner-counts`];
}

export const REDIS_REQUEST_EPOCH_LUA = createRedisClockLua(['hash', 'hash', 'hash', 'hash', 'hash', 'zset', 'hash']) +
REQUEST_EPOCH_AUTHORITY_LUA + String.raw`
local input=cjson.decode(ARGV[1]); local op=input.operation; local c=input.command or {}
if op=='publish' then
  local a=c.authority; local proof=c.evidence; local floor=input.floor
  if not proof or proof.allVersionsEpochAware~=true or proof.restoreBarrierVerified~=true or
    a.highestGeneration<floor.highestGeneration or a.authorityRevision<floor.authorityRevision or
    a.retiredThrough<floor.retiredThrough then error('EPOCH_PUBLICATION_EVIDENCE_REQUIRED') end
  for _,kid in ipairs(floor.revokedKids or {}) do
    local found=false; for _,v in ipairs(a.revokedKids) do if v==kid then found=true end end
    if not found then error('REVOCATION_ROLLBACK') end
  end
  local raw=redis.call('HGET',KEYS[4],'snapshot')
  if raw then
    local old=epochAuthority(floor)
    if a.authorityRevision<=old.authorityRevision or a.highestGeneration<old.highestGeneration or
      a.retiredThrough<old.retiredThrough then error('EPOCH_PUBLICATION_ROLLBACK') end
    for id,e in pairs(old.epochs) do
      local n=a.epochs[id]
      if not n or n.generation~=e.generation or n.kid~=e.kid or n.scopeKeyVersion~=e.scopeKeyVersion or
        n.issueStartsAtMs~=e.issueStartsAtMs or n.issueExpiresAtMs~=e.issueExpiresAtMs or n.validUntilMs~=e.validUntilMs or
        (e.state=='retired' and n.state~='retired') or (e.state=='verify_only' and n.state=='current') then error('EPOCH_ABA_OR_REBOUND') end
    end
    for id,e in pairs(a.epochs) do if not old.epochs[id] and e.generation<=old.highestGeneration then error('EPOCH_GENERATION_REUSED') end end
    for _,kid in ipairs(old.revokedKids) do
      local found=false; for _,nextKid in ipairs(a.revokedKids) do if nextKid==kid then found=true end end
      if not found then error('REVOCATION_ROLLBACK') end
    end
  end
  for _,e in pairs(a.epochs) do
    if e.state=='current' and (redis.call('HGET',KEYS[4],'capability:'..e.kid)~='current' or
      (redis.call('HGET',KEYS[4],'fingerprint:'..e.scopeKeyVersion)~='current' and
       redis.call('HGET',KEYS[4],'fingerprint:'..e.scopeKeyVersion)~='verify_only')) then error('PUBLICATION_KEYS_NOT_LOADED') end
  end
  redis.call('HSET',KEYS[4],'snapshot',epochAuthorityEncode(a))
  return '{"status":"published"}'
end
local function issueRecord(v)
  return type(v)=='table' and type(v.epochId)=='string' and type(v.commandIndex)=='string' and
    type(v.operationHandle)=='string' and type(v.capability)=='string' and type(v.ownerScope)=='string' and
    type(v.endpoint)=='string' and type(v.expiresAtMs)=='number' and type(v.granted)=='boolean'
end
if op=='authority' then
  local a=epochAuthority(input.floor)
  return '{"status":"ok","authority":'..epochAuthorityEncode(a)..',"nowMs":'..encode(now)..'}'
end
if op~='issue' and op~='confirm' and op~='execution' then error('INVALID_REQUEST_EPOCH_OPERATION') end
local a=epochAuthority(input.floor)
local userRaw=redis.call('HGET',KEYS[2],c.identitySubject)
if not userRaw then return '{"status":"not_eligible"}' end
local user=cjson.decode(userRaw)
local e=user.eligibility
if not e or e==cjson.null or e.status~='approved' or
  (e.expiresAt and e.expiresAt~=cjson.null and epoch(e.expiresAt)<=now) then return '{"status":"not_eligible"}' end
if op=='execution' then
  local index=redis.call('HGET',KEYS[5],'handle:'..c.handleIndex)
  if not index then return '{"status":"missing"}' end
  local raw=redis.call('HGET',KEYS[5],index); local rec=raw and cjson.decode(raw) or nil
  if not rec or not issueRecord(rec) then error('INVALID_ISSUANCE_RECORD') end
  if not epochAccepts(a,rec) then return '{"status":"not_current"}' end
  return reply({status='duplicate',record=rec})
end
local priorRaw=redis.call('HGET',KEYS[5],c.commandIndex)
if priorRaw then
  local prior=cjson.decode(priorRaw)
  if not issueRecord(prior) then error('INVALID_ISSUANCE_RECORD') end
  if prior.ownerScope~=c.ownerScope or not epochAccepts(a,prior) then return '{"status":"not_current"}' end
  if prior.endpoint~=c.endpoint then return '{"status":"conflict"}' end
  if prior.expiresAtMs<=now or prior.epochId~=c.epochId then return '{"status":"not_current"}' end
  return reply({status='duplicate',record=prior})
end
if op=='confirm' then
  local e=a.epochs[c.epochId]
  if not e or e.state=='retired' or e.generation<=a.retiredThrough or now>=e.validUntilMs then return '{"status":"not_current"}' end
  for _,kid in ipairs(a.revokedKids) do if kid==e.kid then return '{"status":"not_current"}' end end
  return '{"status":"missing"}'
end
local epoch=a.epochs[c.epochId]
if c.epochId~=a.currentEpochId or not epoch or epoch.state~='current' or
  redis.call('HGET',KEYS[4],'capability:'..c.kid)~='current' or
  not epochAccepts(a,c) or
  epoch.generation~=c.generation or epoch.kid~=c.kid or epoch.scopeKeyVersion~=c.scopeKeyVersion or
  epoch.issueStartsAtMs>now or now>=epoch.issueExpiresAtMs or
  c.preparedAtMs>now or now-c.preparedAtMs>2000 or
  c.issuedAtMs~=c.preparedAtMs or c.expiresAtMs<=now or c.expiresAtMs>c.issuedAtMs+86400000 or
  c.operationHandle=='' or string.len(c.capability)>1024 then return '{"status":"not_current"}' end
local unused={}
for _,slot in ipairs(user.requestEpochUnused or {}) do
  if slot.expiresAtMs>now then table.insert(unused,slot) end
end
if #unused>=20 then return '{"status":"limit"}' end
local counterKey=c.ownerScope..'|'..c.epochId
local count=tonumber(redis.call('HGET',KEYS[7],counterKey) or '0')
if count>=100 then return '{"status":"limit"}' end
local rec={epochId=c.epochId,generation=c.generation,kid=c.kid,scopeKeyVersion=c.scopeKeyVersion,
  ownerScope=c.ownerScope,endpoint=c.endpoint,commandId=c.commandId,commandIndex=c.commandIndex,
  handleIndex=c.handleIndex,operationHandle=c.operationHandle,capability=c.capability,
  issuedAtMs=c.issuedAtMs,expiresAtMs=c.expiresAtMs,granted=false}
if redis.call('HGET',KEYS[5],'handle:'..c.handleIndex) then error('EPOCH_HANDLE_COLLISION') end
redis.call('HSET',KEYS[5],c.commandIndex,encode(rec))
redis.call('HSET',KEYS[5],'handle:'..c.handleIndex,c.commandIndex)
redis.call('ZADD',KEYS[6],c.expiresAtMs,c.commandIndex)
redis.call('HSET',KEYS[7],counterKey,count+1)
table.insert(unused,{commandIndex=c.commandIndex,expiresAtMs=c.expiresAtMs})
user.requestEpochUnused=unused
redis.call('HSET',KEYS[2],c.identitySubject,encode(user))
return reply({status='issued',record=rec})
`;

const validRecord = (value: unknown): value is RequestEpochIssueRecord =>
  isRedisObject(value) && typeof value.epochId === 'string' && Number.isSafeInteger(value.generation) &&
  typeof value.kid === 'string' && typeof value.scopeKeyVersion === 'string' &&
  typeof value.ownerScope === 'string' && typeof value.endpoint === 'string' &&
  typeof value.commandId === 'string' && typeof value.commandIndex === 'string' &&
  typeof value.handleIndex === 'string' && typeof value.operationHandle === 'string' &&
  typeof value.capability === 'string' && Number.isSafeInteger(value.issuedAtMs) &&
  Number.isSafeInteger(value.expiresAtMs) && typeof value.granted === 'boolean';

export function createRedisRequestEpochStore(options: RedisStoreOptions & { epochFloor: RequestEpochFloor }): RequestEpochStore {
  validateRequestEpochFloor(options.epochFloor, options.namespace);
  const driver = createRedisAtomicTransport({ ...options, keys: REQUEST_EPOCH_KEYS(options.namespace) });
  const execute = async (operation: string, command: object = {}) =>
    decodeRedisReply(await driver.execute(REDIS_REQUEST_EPOCH_LUA, { operation, command, floor: options.epochFloor }));
  const issueResult = (value: unknown, allowMissing = false): RequestEpochIssueResult | { status: 'missing' } => {
    if (!isRedisObject(value)) throw new Error('INVALID_REQUEST_EPOCH_RESULT');
    if (allowMissing && value.status === 'missing') return { status: 'missing' };
    if (value.status === 'issued' || value.status === 'duplicate') {
      if (!validRecord(value.record)) throw new Error('INVALID_REQUEST_EPOCH_RECORD');
      return { status: value.status, record: value.record };
    }
    if (value.status === 'conflict' || value.status === 'not_current' || value.status === 'not_eligible' || value.status === 'limit')
      return { status: value.status };
    throw new Error('INVALID_REQUEST_EPOCH_RESULT');
  };
  return {
    async publish(authority: RequestEpochAuthority, evidence) {
      if (!validRequestEpochAuthority(authority)) throw new TypeError('INVALID_REQUEST_EPOCH_AUTHORITY');
      if (Object.values(authority.epochs).some((epoch) => epoch.issueStartsAtMs % 86_400_000 !== 0 ||
          epoch.issueExpiresAtMs - epoch.issueStartsAtMs !== 86_400_000 ||
          epoch.validUntilMs - epoch.issueExpiresAtMs !== 86_400_000)) throw new TypeError('INVALID_UTC_EPOCH_WINDOWS');
      const value = await execute('publish', { authority, evidence });
      if (!isRedisObject(value) || value.status !== 'published') throw new Error('EPOCH_PUBLICATION_FAILED');
    },
    async authority() {
      const value = await execute('authority');
      if (!isRedisObject(value) || value.status !== 'ok' || !validRequestEpochAuthority(value.authority) ||
          !Number.isSafeInteger(value.nowMs) || Number(value.nowMs) < 0) throw new Error('REQUEST_EPOCH_AUTHORITY_UNAVAILABLE');
      return { authority: value.authority, nowMs: Number(value.nowMs) };
    },
    async confirm(command) { return issueResult(await execute('confirm', command), true); },
    async execution(identitySubject, handleIndex) {
      return issueResult(await execute('execution', { identitySubject, handleIndex }), true);
    },
    async issue(command: RequestEpochIssueCommand): Promise<RequestEpochIssueResult> {
      const result = issueResult(await execute('issue', command));
      if (result.status === 'missing') throw new Error('INVALID_REQUEST_EPOCH_RESULT');
      return result;
    },
  };
}
