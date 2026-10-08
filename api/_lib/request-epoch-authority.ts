import { isRecord as isRedisObject } from './http';
import type { RequestEpochAuthority, RequestEpochFloor } from './request-epoch-store';

export function validRequestEpochAuthority(value: unknown): value is RequestEpochAuthority {
  if (!isRedisObject(value) || !Number.isSafeInteger(value.authorityRevision) || Number(value.authorityRevision) < 1 ||
      !Number.isSafeInteger(value.highestGeneration) || Number(value.highestGeneration) < 1 ||
      !Number.isSafeInteger(value.retiredThrough) || Number(value.retiredThrough) < 0 ||
      Number(value.retiredThrough) > Number(value.highestGeneration) ||
      typeof value.currentEpochId !== 'string' || !isRedisObject(value.epochs) ||
      !Array.isArray(value.revokedKids) || !value.revokedKids.every((kid) => typeof kid === 'string' && /^[A-Za-z0-9_-]{22}$/.test(kid))) return false;
  const generations = new Set<number>();
  for (const [id, epoch] of Object.entries(value.epochs)) {
    if (!isRedisObject(epoch) || id !== epoch.epochId || id.length > 64 || !/^g[1-9][0-9]*_[A-Za-z0-9_-]{22}$/.test(id) ||
        !Number.isSafeInteger(epoch.generation) || Number(epoch.generation) < 1 ||
        Number(id.split('_')[0].slice(1)) !== epoch.generation || Number(epoch.generation) > Number(value.highestGeneration) ||
        generations.has(Number(epoch.generation)) || typeof epoch.kid !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(epoch.kid) ||
        typeof epoch.scopeKeyVersion !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(epoch.scopeKeyVersion) ||
        !['current', 'verify_only', 'retired'].includes(String(epoch.state)) ||
        ![epoch.issueStartsAtMs, epoch.issueExpiresAtMs, epoch.validUntilMs].every((n) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0) ||
        Number(epoch.issueStartsAtMs) >= Number(epoch.issueExpiresAtMs) || Number(epoch.issueExpiresAtMs) > Number(epoch.validUntilMs)) return false;
    generations.add(Number(epoch.generation));
  }
  const current = value.epochs[value.currentEpochId];
  return isRedisObject(current) && current.state === 'current';
}

export function validateRequestEpochFloor(floor: RequestEpochFloor, namespace: string): void {
  if (floor.namespace !== namespace || !/^[a-f0-9]{64}$/.test(floor.evidenceDigest) ||
      ![floor.highestGeneration, floor.authorityRevision, floor.retiredThrough].every((n) => Number.isSafeInteger(n) && n >= 0) ||
      floor.highestGeneration < 1 || floor.authorityRevision < 1 || floor.retiredThrough > floor.highestGeneration ||
      !Array.isArray(floor.revokedKids) || !floor.revokedKids.every((kid) => /^[A-Za-z0-9_-]{22}$/.test(kid)))
    throw new TypeError('缺少獨立可信的 request epoch restore floor');
}

// KEYS[4] is shared by issuance, reserve and lifecycle; floors come from trusted composition, not Redis backup.
export const REQUEST_EPOCH_AUTHORITY_LUA = String.raw`
local function epochAuthorityEncode(a)
  local kids={}; for _,kid in ipairs(a.revokedKids or {}) do table.insert(kids,encode(kid)) end
  return '{"authorityRevision":'..encode(a.authorityRevision)..',"highestGeneration":'..encode(a.highestGeneration)..
    ',"retiredThrough":'..encode(a.retiredThrough)..',"currentEpochId":'..encode(a.currentEpochId)..
    ',"epochs":'..encode(a.epochs)..',"revokedKids":['..table.concat(kids,',')..']}'
end
local function epochAuthority(floor)
  if type(floor)~='table' or type(floor.namespace)~='string' or KEYS[4]~=floor.namespace..':request-epoch-authority' or
    type(floor.evidenceDigest)~='string' or string.len(floor.evidenceDigest)~=64 then error('MISSING_EPOCH_FLOOR') end
  local raw=redis.call('HGET',KEYS[4],'snapshot')
  if not raw then error('MISSING_EPOCH_AUTHORITY') end
  local a=cjson.decode(raw)
  if not safe(a.highestGeneration) or not safe(a.authorityRevision) or not safe(a.retiredThrough) or
    a.highestGeneration<floor.highestGeneration or a.authorityRevision<floor.authorityRevision or
    a.retiredThrough<floor.retiredThrough or a.retiredThrough>a.highestGeneration then error('EPOCH_ROLLBACK') end
  for _,kid in ipairs(floor.revokedKids or {}) do
    local found=false; for _,v in ipairs(a.revokedKids or {}) do if v==kid then found=true end end
    if not found then error('REVOCATION_ROLLBACK') end
  end
  local previous=tonumber(redis.call('HGET',KEYS[4],'lastObservedMs') or '0')
  if not safe(now) or now<previous then error('EPOCH_CLOCK_ROLLBACK') end
  local current=a.epochs[a.currentEpochId]
  if current and now>=current.issueExpiresAtMs then
    local nextEpoch=nil
    for _,e in pairs(a.epochs) do
      if e.state=='current' and now>=e.issueStartsAtMs and now<e.issueExpiresAtMs then
        if nextEpoch then error('AMBIGUOUS_CURRENT_EPOCH') end
        nextEpoch=e
      end
    end
    if nextEpoch then
      current.state='verify_only'; a.currentEpochId=nextEpoch.epochId
      a.authorityRevision=add(a.authorityRevision,1)
      redis.call('HSET',KEYS[4],'snapshot',epochAuthorityEncode(a))
    end
  end
  redis.call('HSET',KEYS[4],'lastObservedMs',string.format('%.0f',now))
  return a
end
local function epochAccepts(a,p)
  local e=a.epochs[p.epochId]
  local signingState=p.kid and redis.call('HGET',KEYS[4],'capability:'..p.kid)
  if signingState~='current' and signingState~='verify_only' then return false end
  if not e or not safe(p.generation) or not safe(p.issuedAtMs) or not safe(p.expiresAtMs) or
    e.state=='retired' or p.generation<=a.retiredThrough or
    p.generation~=e.generation or p.kid~=e.kid or p.scopeKeyVersion~=e.scopeKeyVersion or
    p.issuedAtMs<e.issueStartsAtMs or p.issuedAtMs>=e.issueExpiresAtMs or
    p.issuedAtMs>now or p.expiresAtMs<=p.issuedAtMs or now>=p.expiresAtMs or
    p.expiresAtMs>e.validUntilMs or p.expiresAtMs-p.issuedAtMs>86400000 then return false end
  for _,kid in ipairs(a.revokedKids or {}) do if kid==p.kid then return false end end
  return true
end
`;
