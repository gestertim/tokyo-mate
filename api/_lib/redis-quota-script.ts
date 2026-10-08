import { REQUEST_EPOCH_AUTHORITY_LUA } from './request-epoch-authority';

const REDIS_CLOCK_BASE_LUA = String.raw`
local MAX = 9007199254740991
local function safe(n) return type(n) == 'number' and n >= 0 and n <= MAX and n == math.floor(n) end
local function add(a,b) if not safe(a) or not safe(b) or a > MAX-b then error('UNSAFE_INTEGER') end return a+b end
local function mul(a,b) if not safe(a) or not safe(b) or (b>0 and a>math.floor(MAX/b)) then error('UNSAFE_INTEGER') end return a*b end
local function days(y,m,d)
  if m<=2 then y=y-1 end
  local era=math.floor(y/400); local yo=y-era*400
  local mp=m+(m>2 and -3 or 9)
  return era*146097+yo*365+math.floor(yo/4)-math.floor(yo/100)+math.floor((153*mp+2)/5)+d-1-719468
end
local function civil(z)
  z=z+719468; local era=math.floor(z/146097); local doe=z-era*146097
  local yo=math.floor((doe-math.floor(doe/1460)+math.floor(doe/36524)-math.floor(doe/146096))/365)
  local y=yo+era*400; local doy=doe-(365*yo+math.floor(yo/4)-math.floor(yo/100))
  local mp=math.floor((5*doy+2)/153); local d=doy-math.floor((153*mp+2)/5)+1
  local m=mp+(mp<10 and 3 or -9); if m<=2 then y=y+1 end
  return y,m,d
end
local function iso(ms)
  local sec=math.floor(ms/1000); local day=math.floor(sec/86400); local rem=sec-day*86400
  local y,m,d=civil(day)
  return string.format('%04d-%02d-%02dT%02d:%02d:%02d.%03dZ',y,m,d,math.floor(rem/3600),math.floor(rem%3600/60),rem%60,ms%1000)
end
local function epoch(s)
  if type(s)~='string' then error('INVALID_TIME') end
  local y,m,d,h,mi,se,frac=s:match('^(%d%d%d%d)%-(%d%d)%-(%d%d)T(%d%d):(%d%d):(%d%d)%.(%d%d%d)Z$')
  if not y then y,m,d,h,mi,se=s:match('^(%d%d%d%d)%-(%d%d)%-(%d%d)T(%d%d):(%d%d):(%d%d)Z$'); frac='000' end
  if not y then error('NON_CANONICAL_TIME') end
  local n=(days(tonumber(y),tonumber(m),tonumber(d))*86400+tonumber(h)*3600+tonumber(mi)*60+tonumber(se))*1000+tonumber(frac)
  if iso(n)~=string.format('%s-%s-%sT%s:%s:%s.%sZ',y,m,d,h,mi,se,frac) then error('INVALID_TIME') end
  return n
end
local time=redis.call('TIME')
local now=tonumber(time[1])*1000+math.floor(tonumber(time[2])/1000)
local nowIso=iso(now)
local function windows()
  local localDay=math.floor((now+28800000)/86400000)
  local y,m,d=civil(localDay)
  local monday=localDay-((localDay+3)%7)
  local wy=civil(monday+3)
  local jan4=days(wy,1,4); local first=jan4-((jan4+3)%7)
  return {day={windowKey=string.format('%04d-%02d-%02d',y,m,d),resetAt=iso((localDay+1)*86400000-28800000)},
    week={windowKey=string.format('%04d-W%02d',wy,math.floor((monday-first)/7)+1),resetAt=iso((monday+7)*86400000-28800000)}}
end
local function same(a,b)
  if a==cjson.null or b==cjson.null then return a==b end
  if type(a)~=type(b) then return false end
  if type(a)~='table' then return a==b end
  for k,v in pairs(a) do if not same(v,b[k]) then return false end end
  for k,_ in pairs(b) do if a[k]==nil then return false end end
  return true
end
local function object(raw) if raw then return cjson.decode(raw) end return {} end
-- Redis cjson 的預設有效位數不足以保存完整 micro-USD safe integer。
local function encode(value)
  if value==cjson.null then return 'null' end
  local kind=type(value)
  if kind=='string' then return cjson.encode(value) end
  if kind=='boolean' then return value and 'true' or 'false' end
  if kind=='number' then
    if not safe(value) then error('UNSAFE_JSON_INTEGER') end
    return string.format('%.0f',value)
  end
  if kind~='table' then error('INVALID_JSON_DATA') end
  local out={}
  if #value>0 then
    for i=1,#value do table.insert(out,encode(value[i])) end
    return '['..table.concat(out,',')..']'
  end
  for key,child in pairs(value) do
    if type(key)~='string' then error('INVALID_JSON_KEY') end
    table.insert(out,cjson.encode(key)..':'..encode(child))
  end
  table.sort(out)
  return '{'..table.concat(out,',')..'}'
end
local function reply(value) return encode(value) end
`;

export function createRedisClockLua(keyKinds?: readonly ('hash' | 'zset' | 'string')[]): string {
  const kinds = keyKinds ? `{${keyKinds.map((kind) => `'${kind}'`).join(',')}}` : '{}';
  return REDIS_CLOCK_BASE_LUA + `
local keyKinds=${kinds}
for i,key in ipairs(KEYS) do
  local kind=redis.call('TYPE',key).ok
  if kind~='none' and kind~=(keyKinds[i] or 'hash') then error('INVALID_AUTHORITY_KEY_TYPE') end
end
`;
}
export const REDIS_CLOCK_LUA = createRedisClockLua();

export const REDIS_QUOTA_LUA = createRedisClockLua(['hash', 'hash', 'hash', 'hash', 'hash', 'zset', 'hash']) +
REQUEST_EPOCH_AUTHORITY_LUA + String.raw`
local cmd=cjson.decode(ARGV[1]); local op=cmd.operation; local c=cmd.command or {}
local function getUser()
  local raw=redis.call('HGET',KEYS[2],c.identitySubject)
  return raw and cjson.decode(raw) or {eligibility=cjson.null,windows={},reservations={},idempotency={},topUps={},topUpIdempotency={}}
end
local function save(u) redis.call('HSET',KEYS[2],c.identitySubject,encode(u)) end
local function blockMaps()
  return object(redis.call('HGET',KEYS[1],'blockedVersions')),object(redis.call('HGET',KEYS[1],'blockedParameters'))
end
local function projected()
  local raw=redis.call('HGET',KEYS[1],'bundle')
  if not raw then return nil end
  local b=cjson.decode(raw); b.registryRevision=tonumber(redis.call('HGET',KEYS[1],'revision'))
  local versions,parameters=blockMaps()
  local authoritativeDigests=object(redis.call('HGET',KEYS[1],'digests'))
  for _,e in ipairs(b.entries) do
    e.blocked=e.blocked or versions[e.version]==true or parameters[authoritativeDigests[e.endpoint] or '']==true
  end
  return b
end
if op=='publish' then
  local revision=tonumber(redis.call('HGET',KEYS[1],'revision') or '0')
  if c.registryRevision<=revision then error('REGISTRY_REVISION_REUSED') end
  local bindings=object(redis.call('HGET',KEYS[1],'bindings'))
  for _,e in ipairs(c.entries) do
    local key=e.version..'|'..e.endpoint; local digest=cmd.digests[e.endpoint]
    if bindings[key] and bindings[key]~=digest then error('REGISTRY_VERSION_REBOUND') end
    bindings[key]=digest
  end
  redis.call('HSET',KEYS[1],'bundle',cmd.bundleJson or encode(c),'revision',string.format('%.0f',c.registryRevision),'bindings',encode(bindings),
    'digests',encode(cmd.digests))
  return reply({status='published'})
end
if op=='registrySnapshot' then
  return '{"bundle":'..(redis.call('HGET',KEYS[1],'bundle') or '{}')..
    ',"revision":'..(redis.call('HGET',KEYS[1],'revision') or '0')..
    ',"versions":'..(redis.call('HGET',KEYS[1],'blockedVersions') or '{}')..
    ',"parameters":'..(redis.call('HGET',KEYS[1],'blockedParameters') or '{}')..
    ',"nowIso":"'..nowIso..'"}'
end
local u=getUser()
local function usage(day,week)
  u.windows['day:'..day]=u.windows['day:'..day] or {usedMicroUsd=0,reservedMicroUsd=0}
  u.windows['week:'..week]=u.windows['week:'..week] or {usedMicroUsd=0,reservedMicroUsd=0}
  local out={day=u.windows['day:'..day],week=u.windows['week:'..week]}
  for _,v in pairs(out) do
    if not safe(v.usedMicroUsd) or not safe(v.reservedMicroUsd) then error('INVALID_USAGE') end
    add(v.usedMicroUsd,v.reservedMicroUsd)
  end
  return out
end
local function evidence(r,status)
  return {status=status,reservation=r,usage=usage(r.dayWindowKey,r.weekWindowKey),
    identitySubject=c.identitySubject,dayWindowKey=r.dayWindowKey,weekWindowKey=r.weekWindowKey}
end
local function topTotal(key)
  local total=0
  for _,t in pairs(u.topUps) do
    if t.status=='active' and t.weekWindowKey==key and epoch(t.expiresAt)>now then total=add(total,t.amountMicroUsd) end
  end
  return total
end
local function limits()
  local e=u.eligibility
  if e==cjson.null or not e then return nil,'missing' end
  if e.status~='approved' then return nil,e.status end
  if e.expiresAt~=cjson.null and epoch(e.expiresAt)<=now then return nil,'eligibility_expired' end
  local tier=c.tierLimits[e.tier]; if not tier then error('INVALID_TIER') end
  if not safe(tier.dayLimitMicroUsd) or not safe(tier.weekBaseLimitMicroUsd) then error('INVALID_LIMITS') end
  local total=topTotal(c.week.windowKey)
  return {tier=e.tier,dayLimitMicroUsd=tier.dayLimitMicroUsd,weekBaseLimitMicroUsd=tier.weekBaseLimitMicroUsd,
    weekTopUpMicroUsd=total,weekLimitMicroUsd=add(tier.weekBaseLimitMicroUsd,total)}
end
local function registry()
  local b=projected(); local expected=c.expectedRegistry
  if not b or not expected or epoch(c.nowIso)>now then return nil end
  b.bundleDigest=expected.bundleDigest
  if not same(b,expected) then return nil end
  local w=windows()
  if not same(w.day,c.day) or not same(w.week,c.week) then return nil end
  local live={}; local floor=MAX
  for _,e in ipairs(b.entries) do
    if e.table.endpoints[e.endpoint].live and not e.blocked and epoch(e.table.effectiveFrom)<=now and now<epoch(e.table.expiresAt) then
      local amount=b.maxReservations[e.endpoint]
      if not safe(amount) or amount==0 then return nil end
      table.insert(live,e.endpoint); floor=math.min(floor,amount)
    end
  end
  if #live==0 then return nil end
  table.sort(live)
  return {registryRevision=b.registryRevision,bundleDigest=expected.bundleDigest,
    decisionAt=nowIso,floorMicroUsd=floor,liveEndpoints=live},b
end
local function classification(us,l,floor,amount)
  local remaining={day=l.dayLimitMicroUsd-us.day.usedMicroUsd-us.day.reservedMicroUsd,
    week=l.weekLimitMicroUsd-us.week.usedMicroUsd-us.week.reservedMicroUsd}
  for _,w in ipairs({'day','week'}) do
    local limit=w=='day' and l.dayLimitMicroUsd or l.weekLimitMicroUsd
    if limit-us[w].usedMicroUsd<=0 then return 'exhausted',w end
  end
  for _,w in ipairs({'day','week'}) do if remaining[w]<floor then return 'below_floor',w end end
  if amount then for _,w in ipairs({'day','week'}) do if remaining[w]<amount then return 'request_insufficient',w end end end
  return nil
end
if op=='setEligibility' then
  u.eligibility={identitySubject=c.identitySubject,status=c.status,tier=c.tier,expiresAt=c.expiresAt,updatedAt=nowIso}
  save(u); return reply(u.eligibility)
end
if op=='readUsage' then return reply(usage(c.dayWindowKey,c.weekWindowKey)) end
if op=='getReservation' then return reply(u.reservations[c.reservationId] or (u.comparisonTombstones or {})[c.reservationId] or cjson.null) end
if op=='getEpochBinding' then
  local id=(u.epochAccounting or {})[c.accountingIndex]
  return reply(id and ((u.reservations or {})[id] or (u.comparisonTombstones or {})[id]) or cjson.null)
end
if op=='readQuota' or op=='readAtomicQuota' or op=='reserve' then
  local l,reason=limits()
  if not l then return reply({status='not_eligible',reason=reason}) end
  local issuance=nil
  if op=='reserve' and c.requestEpoch then
    local a=epochAuthority(cmd.floor); local x=c.requestEpoch; local p=x.payload
    if not epochAccepts(a,p) or p.endpoint~=c.endpoint or p.operationHandle~=c.idempotencyKey then
      return reply({status='epoch_rejected'})
    end
    local raw=redis.call('HGET',KEYS[5],x.commandIndex)
    issuance=raw and cjson.decode(raw) or nil
    if not issuance or issuance.handleIndex~=x.handleIndex or issuance.ownerScope~=p.ownerScope or
      issuance.operationHandle~=p.operationHandle or issuance.endpoint~=p.endpoint or
      issuance.epochId~=p.epochId or issuance.kid~=p.kid or issuance.generation~=p.generation or
      issuance.scopeKeyVersion~=p.scopeKeyVersion or issuance.issuedAtMs~=p.issuedAtMs or
      issuance.expiresAtMs~=p.expiresAtMs then return reply({status='epoch_rejected'}) end
    local prior=u.idempotency[c.idempotencyKey]
    if prior then
      local r=u.reservations[prior] or (u.comparisonTombstones or {})[prior]
      if not r or not r.requestEpoch or r.requestEpoch.accountingIndex~=x.accountingIndex then error('INVALID_EPOCH_BINDING') end
      local keyState=redis.call('HGET',KEYS[4],'fingerprint:'..r.fingerprintKeyVersion)
      if keyState~='current' and keyState~='verify_only' then error('FINGERPRINT_KEY_UNAVAILABLE') end
      if r.fingerprintKeyVersion==c.fingerprintKeyVersion and r.requestFingerprint==c.requestFingerprint and
        same(r.comparisonCost,c.comparisonCost) then
        return reply({status='duplicate',executionGrant=false,reservation=r})
      end
      r.conflictCount=add(r.conflictCount,1); r.lastConflictAt=nowIso; r.lastConflictFingerprint=c.requestFingerprint
      save(u); return reply({status='idempotency_conflict',reservation=r})
    end
    if issuance.granted or redis.call('HGET',KEYS[4],'fingerprintCurrent')~=c.fingerprintKeyVersion or
      redis.call('HGET',KEYS[4],'fingerprint:'..c.fingerprintKeyVersion)~='current' then return reply({status='epoch_rejected'}) end
  elseif op=='reserve' and cmd.rejectLegacy then return reply({status='epoch_rejected'}) end
  local us=usage(c.day.windowKey,c.week.windowKey)
  if op=='readQuota' then
    local w=windows()
    if not same(w.day,c.day) or not same(w.week,c.week) or epoch(c.nowIso)>now then error('STALE_QUOTA_WINDOW') end
    return reply({status='ok',usage=us,limits=l})
  end
  local decision,b=registry()
  if not decision then return reply({status='cost_model_invalid'}) end
  if op=='readAtomicQuota' then
    local kind,window=classification(us,l,decision.floorMicroUsd)
    return reply({status=kind and 'denied' or 'available',usage=us,limits=l,registryDecision=decision,
      denialClass=kind,deniedWindow=window})
  end
  local entry=nil
  for _,e in ipairs(b.entries) do if e.endpoint==c.endpoint then entry=e end end
  local found=false
  for _,endpoint in ipairs(decision.liveEndpoints) do if endpoint==c.endpoint then found=true end end
  if not found or not entry or c.costModel.version~=entry.version or c.costModel.effectiveFrom~=entry.table.effectiveFrom or
    c.costModel.expiresAt~=entry.table.expiresAt or
    c.costParametersDigest~=object(redis.call('HGET',KEYS[1],'digests'))[c.endpoint] then
    return reply({status='cost_model_invalid'})
  end
  local p=entry.table.endpoints[c.endpoint].pricing; local scale=entry.table.endpoints[c.endpoint].priceScale
  local numerator,denominator
  if p.kind=='request' then numerator=p.perRequestMicroUsd; denominator=1
  elseif p.kind=='tokens' then
    local n=c.estimateInputs.inputTokens
    if not safe(n) or n>p.maxInputTokens then return reply({status='cost_model_invalid'}) end
    numerator=add(mul(n,p.inputMicroUsdPerMTok),mul(p.maxOutputTokens,p.outputMicroUsdPerMTok)); denominator=1000000
  elseif p.kind=='audio_minute' then
    local bytes=c.estimateInputs.audioDataBytes
    if not safe(bytes) or bytes==0 or bytes>mul(p.maxAudioSeconds,32000) then return reply({status='cost_model_invalid'}) end
    numerator=mul(math.ceil(bytes/1920000),p.perMinuteMicroUsd); denominator=1
  else return reply({status='cost_model_invalid'}) end
  numerator=mul(numerator,scale.numerator); denominator=mul(denominator,scale.denominator)
  local remainder=numerator%denominator
  local amount=(numerator-remainder)/denominator+(remainder>0 and 1 or 0)
  if amount~=c.amountMicroUsd or amount<=0 then return reply({status='cost_model_invalid'}) end
  local prior=u.idempotency[c.idempotencyKey]
  if prior then
    local r=u.reservations[prior]
    if r.endpoint==c.endpoint and r.estimatedCostUpperBoundUsdMicro==amount and r.costModelVersion==c.costModel.version and
      r.costParametersDigest==c.costParametersDigest and r.requestFingerprint==c.requestFingerprint then
      return reply({status='duplicate',executionGrant=false,reservation=r})
    end
    r.conflictCount=add(r.conflictCount,1); r.lastConflictAt=nowIso; r.lastConflictFingerprint=c.requestFingerprint
    save(u); return reply({status='idempotency_conflict',reservation=r})
  end
  if u.reservations[c.reservationId] then error('RESERVATION_ID_COLLISION') end
  local kind,window=classification(us,l,decision.floorMicroUsd,amount)
  if kind then return reply({status='denied',deniedWindow=window,denialClass=kind,usage=us,limits=l,registryDecision=decision}) end
  us.day.reservedMicroUsd=add(us.day.reservedMicroUsd,amount); us.week.reservedMicroUsd=add(us.week.reservedMicroUsd,amount)
  local r={reservationId=c.reservationId,idempotencyKey=c.idempotencyKey,identitySubject=c.identitySubject,endpoint=c.endpoint,
    estimatedCostUpperBoundUsdMicro=amount,costModelVersion=c.costModel.version,costParametersDigest=c.costParametersDigest,
    costModelEffectiveFrom=c.costModel.effectiveFrom,costModelExpiresAt=c.costModel.expiresAt,requestFingerprint=c.requestFingerprint,
    fingerprintKeyVersion=c.fingerprintKeyVersion,estimateInputs=c.estimateInputs,status='reserved',
    dayWindowKey=c.day.windowKey,weekWindowKey=c.week.windowKey,createdAt=nowIso,executionGranted=true,
    leaseExpiresAt=iso(add(now,c.leaseMs)),conflictCount=0,registryDecision=decision}
  if c.requestEpoch then
    r.requestEpoch=c.requestEpoch; r.comparisonCost=c.comparisonCost
    u.epochAccounting=u.epochAccounting or {}; u.epochAccounting[c.requestEpoch.accountingIndex]=r.reservationId
    issuance.granted=true
    redis.call('HSET',KEYS[5],c.requestEpoch.commandIndex,encode(issuance))
    redis.call('ZREM',KEYS[6],c.requestEpoch.commandIndex)
    local unused={}
    for _,slot in ipairs(u.requestEpochUnused or {}) do
      if slot.commandIndex~=c.requestEpoch.commandIndex and slot.expiresAtMs>now then table.insert(unused,slot) end
    end
    u.requestEpochUnused=unused
  end
  u.reservations[c.reservationId]=r; u.idempotency[c.idempotencyKey]=c.reservationId
  save(u); return reply({status='reserved',executionGrant=true,reservation=r,usage=us,limits=l,registryDecision=decision})
end
if op=='addTopUp' then
  local w=windows()
  if not same(c.week,w.week) or epoch(c.nowIso)>now then return reply({status='window_expired'}) end
  local prior=u.topUpIdempotency[c.idempotencyKey]
  if prior then
    local t=u.topUps[prior]
    return reply({status=(t.weekWindowKey==c.week.windowKey and t.amountMicroUsd==c.amountMicroUsd) and 'duplicate' or 'idempotency_conflict',
      topUp=t,cumulativeTopUpMicroUsd=topTotal(t.weekWindowKey)})
  end
  if u.topUps[c.topUpId] then error('TOPUP_ID_COLLISION') end
  local total=topTotal(c.week.windowKey)
  if not safe(c.amountMicroUsd) or c.amountMicroUsd<=0 or total>MAX-c.amountMicroUsd then return reply({status='overflow'}) end
  local t={topUpId=c.topUpId,identitySubject=c.identitySubject,weekWindowKey=c.week.windowKey,
    amountMicroUsd=c.amountMicroUsd,status='active',idempotencyKey=c.idempotencyKey,adminSubject=c.adminSubject,
    reasonCode=c.reasonCode,expiresAt=w.week.resetAt,createdAt=nowIso}
  u.topUps[t.topUpId]=t; u.topUpIdempotency[c.idempotencyKey]=t.topUpId
  save(u); return reply({status='applied',topUp=t,cumulativeTopUpMicroUsd=total+c.amountMicroUsd})
end
if op=='revokeTopUp' then
  local t=u.topUps[c.topUpId]; if not t then return reply({status='not_found'}) end
  local status=t.status=='revoked' and 'already_applied' or 'applied'
  t.status='revoked'; t.revokedAt=t.revokedAt or nowIso
  save(u); return reply({status=status,topUp=t,cumulativeTopUpMicroUsd=topTotal(t.weekWindowKey)})
end
if op=='expireLeases' then
  local entries={}
  for _,r in pairs(u.reservations) do
    if r.status=='reserved' and epoch(r.leaseExpiresAt)<now then
      r.status='uncertain'; r.settledAt=nowIso; r.settlementReason='lease_expired'
      r.settledChargeUsdMicro=0; r.settlementCostModelVersion=r.costModelVersion
      table.insert(entries,evidence(r,'expired'))
    end
  end
  save(u)
  if #entries==0 then return '{"expired":0,"entries":[]}' end
  return reply({expired=#entries,entries=entries})
end
if op=='settle' then
  local r=u.reservations[c.reservationId] or (u.comparisonTombstones or {})[c.reservationId]
  if not r then return reply({status='not_found'}) end
  local function result(status)
    local out=evidence(r,status)
    if r.overrunMicroUsd then out.blockedCostModelVersion=r.costModelVersion; out.blockedCostParametersDigest=r.costParametersDigest end
    return reply(out)
  end
  if r.status==c.transition then
    local equal=r.settledChargeUsdMicro==c.chargeMicroUsd and r.settlementReason==c.reason and r.settlementCostModelVersion==c.costModelVersion
    return result(equal and 'already_applied' or 'settlement_conflict')
  end
  local function late()
    if c.transition~='uncertain' and not r.lateOutcomeObserved then
      r.lateOutcomeObserved={outcome=c.transition=='settled' and 'success' or 'unbilled_failure',observedAt=nowIso}
    end
  end
  if r.status~='reserved' then
    if r.status=='uncertain' then late(); save(u) end
    return result('invalid_transition')
  end
  if not safe(c.chargeMicroUsd) or (c.transition~='settled' and c.chargeMicroUsd~=0) then error('INVALID_CHARGE') end
  if c.transition~='uncertain' and now>epoch(r.leaseExpiresAt) then
    r.status='uncertain'; r.settledAt=nowIso; r.settlementReason='lease_expired'; r.settledChargeUsdMicro=0
    r.settlementCostModelVersion=c.costModelVersion; late(); save(u); return result('lease_expired')
  end
  local us=usage(r.dayWindowKey,r.weekWindowKey); local amount=r.estimatedCostUpperBoundUsdMicro
  for _,v in pairs(us) do
    if v.reservedMicroUsd<amount then error('INVALID_USAGE') end
    if c.transition=='settled' and (v.usedMicroUsd>MAX-c.chargeMicroUsd or
      v.usedMicroUsd+c.chargeMicroUsd>MAX-(v.reservedMicroUsd-amount)) then return reply({status='overflow'}) end
  end
  if c.transition~='uncertain' then
    for _,v in pairs(us) do v.reservedMicroUsd=v.reservedMicroUsd-amount; v.usedMicroUsd=add(v.usedMicroUsd,c.chargeMicroUsd) end
  end
  if c.transition=='settled' and c.chargeMicroUsd>amount then
    local versions,parameters=blockMaps()
    versions[r.costModelVersion]=true; parameters[r.costParametersDigest]=true
    local revision=add(tonumber(redis.call('HGET',KEYS[1],'revision') or '0'),1)
    r.overrunMicroUsd=c.chargeMicroUsd-amount
    r.status=c.transition; r.settledAt=nowIso; r.settlementReason=c.reason
    r.settledChargeUsdMicro=c.chargeMicroUsd; r.settlementCostModelVersion=c.costModelVersion
    local encodedUser=encode(u); local encodedVersions=encode(versions); local encodedParameters=encode(parameters)
    redis.call('HSET',KEYS[1],'blockedVersions',encodedVersions,'blockedParameters',encodedParameters,'revision',string.format('%.0f',revision))
    redis.call('HSET',KEYS[2],c.identitySubject,encodedUser)
    return result('applied')
  end
  r.status=c.transition; r.settledAt=nowIso; r.settlementReason=c.reason
  r.settledChargeUsdMicro=c.chargeMicroUsd; r.settlementCostModelVersion=c.costModelVersion
  save(u); return result('applied')
end
error('UNKNOWN_OPERATION')
`;
