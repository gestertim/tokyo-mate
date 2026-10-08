import { REDIS_CLOCK_LUA } from './redis-quota-script';

export const ADMIN_REDIS_LUA = REDIS_CLOCK_LUA + String.raw`
local input=cjson.decode(ARGV[1]); local op=input.operation; local c=input.command or {}
for _,i in ipairs({2,4,5,6,7}) do
  local t=redis.call('TYPE',KEYS[i]).ok
  if t~='none' and t~='hash' then error('INVALID_ADMIN_KEY_TYPE') end
end
local function state(subject)
  local raw=redis.call('HGET',KEYS[2],subject)
  if not raw then return nil end
  local u=cjson.decode(raw)
  if type(u.windows)~='table' or type(u.topUps)~='table' or type(u.reservations)~='table' or
    type(u.idempotency)~='table' or type(u.topUpIdempotency)~='table' then error('INVALID_USER_STATE') end
  if u.eligibility~=cjson.null and u.eligibility~=nil and u.eligibility.identitySubject~=subject then error('SUBJECT_MISMATCH') end
  for _,t in pairs(u.topUps) do if t.identitySubject~=subject then error('TOPUP_SUBJECT_MISMATCH') end end
  return u
end
local function approval(u)
  local e=u.eligibility
  if e==cjson.null or e==nil then return 'pending',cjson.null end
  if e.status~='pending' and e.status~='approved' and e.status~='rejected' and e.status~='revoked' and e.status~='expired' then error('INVALID_APPROVAL') end
  if e.tier~='tier1' and e.tier~='tier2' then error('INVALID_TIER') end
  local s=e.status
  if s=='approved' and e.expiresAt~=cjson.null and e.expiresAt~=nil and epoch(e.expiresAt)<=now then s='expired' end
  return s,s=='approved' and e.tier or cjson.null
end
local function money(n)
  if type(n)~='number' or math.abs(n)>MAX then error('INVALID_AMOUNT') end
  return string.format('%.2f',n/1000000)
end
local function exactMoney(n)
  if not safe(n) then error('INVALID_AMOUNT') end
  return string.format('%.0f',math.floor(n/1000000))..'.'..string.format('%06d',n%1000000)
end
local function cumulative(u,w)
  local sum=0
  for _,t in pairs(u.topUps) do
    if t.status=='active' and t.weekWindowKey==w.windowKey and epoch(t.expiresAt)>now then
      if t.expiresAt~=w.resetAt then error('INVALID_TOPUP_WINDOW') end
      sum=add(sum,t.amountMicroUsd)
    end
  end
  return sum
end
local function user(subject,u)
  local s,t=approval(u)
  local out={identitySubject=subject,status=s,tier=t}
  local meta=object(redis.call('HGET',KEYS[4],subject))
  out.displayName=meta.displayName; out.maskedContact=meta.maskedContact
  local w=windows();local rawTier=u.eligibility~=cjson.null and u.eligibility and u.eligibility.tier or 'tier1'
  local function summary(spec,kind,limit)
    local usage=u.windows[kind..':'..spec.windowKey] or {usedMicroUsd=0,reservedMicroUsd=0}
    if not safe(usage.usedMicroUsd) or not safe(usage.reservedMicroUsd) then error('INVALID_USAGE') end
    add(usage.usedMicroUsd,usage.reservedMicroUsd)
    return {limitEstimatedUsd=money(limit),usedEstimatedUsd=money(usage.usedMicroUsd),
      reservedEstimatedUsd=money(usage.reservedMicroUsd),remainingEstimatedUsd=money(limit-usage.usedMicroUsd-usage.reservedMicroUsd),resetAt=spec.resetAt}
  end
  out.daily=summary(w.day,'day',rawTier=='tier2' and 10000000 or 3000000)
  out.weekly=summary(w.week,'week',add(rawTier=='tier2' and 50000000 or 15000000,cumulative(u,w.week)))
  return out
end
if op=='overview' then
  if not safe(c.nearLimitPercent) or c.nearLimitPercent<1 or c.nearLimitPercent>100 then error('ADMIN_NEAR_LIMIT_POLICY_UNAVAILABLE') end
  local function threshold(limit)
    -- 不直接乘 limit；兩段乘法與最後相加均維持 safe integer。
    local whole=mul(math.floor(limit/100),c.nearLimitPercent)
    local fraction=mul(limit%100,c.nearLimitPercent)
    return add(whole,math.floor((fraction+99)/100))
  end
  local counts={pending=0,approved=0,rejected=0,revoked=0,expired=0}
  local totalDay=0;local totalWeek=0;local alerts={};local w=windows()
  local raw=redis.call('HGETALL',KEYS[2])
  for i=1,#raw,2 do
    local u=state(raw[i]);local v=user(raw[i],u)
    counts[v.status]=add(counts[v.status],1)
    local day=u.windows['day:'..w.day.windowKey] or {usedMicroUsd=0}
    local week=u.windows['week:'..w.week.windowKey] or {usedMicroUsd=0}
    totalDay=add(totalDay,day.usedMicroUsd);totalWeek=add(totalWeek,week.usedMicroUsd)
    if v.status=='approved' then
      local dayLimit=v.tier=='tier2' and 10000000 or 3000000
      local weekLimit=add(v.tier=='tier2' and 50000000 or 15000000,cumulative(u,w.week))
      for _,window in ipairs({'day','week'}) do
        local summary=window=='day' and v.daily or v.weekly
        local used=window=='day' and day.usedMicroUsd or week.usedMicroUsd
        local limit=window=='day' and dayLimit or weekLimit
        if used>=threshold(limit) and #alerts<100 then
          table.insert(alerts,encode({identitySubject=raw[i],window=window,
            usedEstimatedUsd=summary.usedEstimatedUsd,limitEstimatedUsd=summary.limitEstimatedUsd}))
        end
      end
    end
  end
  local bundle=redis.call('HGET',KEYS[1],'bundle')
  local available=false
  if bundle then
    local b=cjson.decode(bundle)
    if type(b.table)~='table' or type(b.entries)~='table' then error('INVALID_REGISTRY_OVERVIEW') end
    local versions=object(redis.call('HGET',KEYS[1],'blockedVersions'))
    local parameters=object(redis.call('HGET',KEYS[1],'blockedParameters'))
    local digests=object(redis.call('HGET',KEYS[1],'digests'))
    for _,e in ipairs(b.entries) do
      if e.table.endpoints[e.endpoint].live and not e.blocked and not versions[e.version] and not parameters[digests[e.endpoint] or ''] and
        epoch(e.table.effectiveFrom)<=now and now<epoch(e.table.expiresAt) then available=true end
    end
  end
  local encoded=encode({approvalCounts=counts,estimatedUsage={
    dailyUsedEstimatedUsd=money(totalDay),weeklyUsedEstimatedUsd=money(totalWeek)},protectionAvailable=available})
  return encoded:sub(1,-2)..',"nearLimits":['..table.concat(alerts,',')..']}'
end
local function arrayReply(items,nextOffset)
  -- Redis cjson 會把空 Lua table 編碼成 object，回覆改用明確 JSON array。
  local encoded={}; for _,v in ipairs(items) do table.insert(encoded,encode(v)) end
  return '{"items":['..table.concat(encoded,',')..'],"nextOffset":'..(nextOffset and tostring(nextOffset) or 'null')..'}'
end
if op=='users' or op=='reviews' or op=='audits' then
  local index=op=='users' and 2 or op=='reviews' and 5 or 6
  local raw=redis.call('HGETALL',KEYS[index]); local rows={}
  for i=1,#raw,2 do
    local v=cjson.decode(raw[i+1])
    if op=='users' then v=user(raw[i],state(raw[i])) end
    if op=='reviews' and v.status=='pending' then
      local u=state(v.targetIdentitySubject);if not u then error('MISSING_REVIEW_USER') end
      local summary=user(v.targetIdentitySubject,u);v.tier=summary.tier;v.weekly=summary.weekly
    end
    if op~='reviews' or v.status=='pending' then table.insert(rows,{key=raw[i],value=v}) end
  end
  table.sort(rows,function(a,b)
    if op=='audits' and a.value.createdAt~=b.value.createdAt then return a.value.createdAt>b.value.createdAt end
    return a.key<b.key
  end)
  local items={}; for i=c.offset+1,math.min(#rows,c.offset+c.limit) do table.insert(items,rows[i].value) end
  return arrayReply(items,c.offset+c.limit<#rows and c.offset+c.limit or nil)
end
if op=='detail' then
  local u=state(c.subject); if not u then return reply(cjson.null) end
  local out=user(c.subject,u); local w=windows(); local s,t=approval(u)
  local tier=u.eligibility~=cjson.null and u.eligibility and u.eligibility.tier or 'tier1'
  local dayLimit=tier=='tier2' and 10000000 or 3000000
  local weekBase=tier=='tier2' and 50000000 or 15000000
  local sum=cumulative(u,w.week)
  local function win(spec,limit,kind)
    local usage=u.windows[kind..':'..spec.windowKey] or {usedMicroUsd=0,reservedMicroUsd=0}
    if not safe(usage.usedMicroUsd) or not safe(usage.reservedMicroUsd) then error('INVALID_USAGE') end
    return {limitEstimatedUsd=money(limit),usedEstimatedUsd=money(usage.usedMicroUsd),
      reservedEstimatedUsd=money(usage.reservedMicroUsd),remainingEstimatedUsd=money(limit-usage.usedMicroUsd-usage.reservedMicroUsd),resetAt=spec.resetAt}
  end
  out.daily=win(w.day,dayLimit,'day');out.weekly=win(w.week,add(weekBase,sum),'week')
  out.weekly.windowKey=w.week.windowKey;out.weekly.activeTopUpEstimatedUsd=money(sum)
  local usage={}; local names={'assistant','photo-ocr','photo-translate','places','transcribe','speech'}
  for _,name in ipairs(names) do usage[name]={endpoint=name,requestCount=0,estimatedUsd='0.00',micro=0} end
  for _,r in pairs(u.reservations) do
    if r.weekWindowKey==w.week.windowKey and usage[r.endpoint] then
      local v=usage[r.endpoint]; v.requestCount=add(v.requestCount,1)
      v.micro=add(v.micro,r.settledChargeUsdMicro or r.estimatedCostUpperBoundUsdMicro)
    end
  end
  local eu={}; for _,name in ipairs(names) do local v=usage[name];v.estimatedUsd=money(v.micro);v.micro=nil;table.insert(eu,encode(v)) end
  local top={}; local ids={};for id,_ in pairs(u.topUps) do table.insert(ids,id) end;table.sort(ids)
  for _,id in ipairs(ids) do
    local v=u.topUps[id]
    if v.weekWindowKey==w.week.windowKey and #top<100 then
      table.insert(top,encode({topUpId=id,amountEstimatedUsd=money(v.amountMicroUsd),
        status=v.status=='revoked' and 'revoked' or epoch(v.expiresAt)<=now and 'expired' or 'active',expiresAt=v.expiresAt}))
    end
  end
  local encoded=encode(out)
  return encoded:sub(1,-2)..',"endpointUsage":['..table.concat(eu,',')..'],"topUps":['..table.concat(top,',')..']}'
end
local function ownReview(v)
  return {reviewId=v.reviewId,kind=v.kind,reasonCode=v.reasonCode,createdAt=v.createdAt,status=v.status,
    weekWindowKey=v.kind=='weekly_top_up' and v.weekWindowKey or nil}
end
if op=='me_access' or op=='me_operation' or op=='me_enqueue' or op=='me_list' or op=='me_withdraw' then
  local u=state(c.subject);local w=windows()
  local approved=u and approval(u)=='approved' or false
  if op=='me_access' then return reply({approved=approved,weekWindowKey=w.week.windowKey}) end
  if op=='me_operation' then
    if not approved then return reply({outcome='not_approved'}) end
    local id=c.accountingIndex and (u.epochAccounting or {})[c.accountingIndex] or u.idempotency[c.key]
    local r=id and (u.reservations[id] or (u.comparisonTombstones or {})[id] or (u.accountingRecords or {})[id])
    if not r or r.identitySubject~=c.subject or r.endpoint~=c.endpoint then return reply({outcome='not_found'}) end
    if r.status~='reserved' and r.status~='settled' and r.status~='released' and r.status~='uncertain' then error('INVALID_OPERATION_STATE') end
    return reply({outcome='found',state=r.status,updatedAt=r.settledAt or r.createdAt})
  end
  local raw=redis.call('HGETALL',KEYS[5]);local rows={}
  for i=1,#raw,2 do
    local v=cjson.decode(raw[i+1])
    if v.targetIdentitySubject==c.subject then table.insert(rows,v) end
  end
  if op=='me_list' then
    if not safe(c.offset) or c.offset>999999 or not safe(c.limit) or c.limit<1 or c.limit>100 then error('INVALID_ME_PAGE') end
    table.sort(rows,function(a,b) return a.reviewId<b.reviewId end)
    local items={};for i=c.offset+1,math.min(#rows,c.offset+c.limit) do table.insert(items,ownReview(rows[i])) end
    return arrayReply(items,c.offset+#items<#rows and c.offset+#items or nil)
  end
  for _,i in ipairs({8,9}) do
    local t=redis.call('TYPE',KEYS[i]).ok;if t~='none' and t~='hash' then error('INVALID_ME_KEY_TYPE') end
  end
  if redis.call('HGET',KEYS[9],c.eventId) then error('ME_EVENT_COLLISION') end
  if op=='me_withdraw' then
    local value=redis.call('HGET',KEYS[5],c.reviewId)
    local v=value and cjson.decode(value)
    if not v or v.targetIdentitySubject~=c.subject then return reply({outcome='not_found'}) end
    if v.status~='pending' then return reply({outcome='resolved'}) end
    v.status='withdrawn';v.withdrawnAt=nowIso
    local encoded=encode(v);local event=encode({actor='user',subject=c.subject,reviewId=v.reviewId,action='withdraw',createdAt=nowIso})
    redis.call('HSET',KEYS[5],v.reviewId,encoded);redis.call('HSET',KEYS[9],c.eventId,event)
    return reply({outcome='withdrawn',review=ownReview(v)})
  end
  if not u then return reply({outcome='not_approved'}) end
  if c.kind~='paid_access' and c.kind~='weekly_top_up' then return reply({outcome='invalid'}) end
  if c.kind=='weekly_top_up' and not approved then return reply({outcome='not_approved'}) end
  if c.kind=='weekly_top_up' and c.weekWindowKey~=w.week.windowKey then return reply({outcome='invalid'}) end
  if c.kind=='paid_access' and c.reasonCode~='paid_feature_access' or
    c.kind=='weekly_top_up' and c.reasonCode~='weekly_limit_review' and c.reasonCode~='weekly_floor_review' then return reply({outcome='invalid'}) end
  local key=tostring(#c.subject)..':'..c.subject..':'..c.idempotencyKey
  local fingerprint={kind=c.kind,reasonCode=c.reasonCode,weekWindowKey=c.weekWindowKey}
  local old=redis.call('HGET',KEYS[8],key)
  if old then
    local prior=cjson.decode(old)
    if not same(prior.fingerprint,fingerprint) then return reply({outcome='conflict'}) end
    local v=cjson.decode(redis.call('HGET',KEYS[5],prior.reviewId))
    if v.targetIdentitySubject~=c.subject then error('ME_OWNER_MISMATCH') end
    return reply({outcome='duplicate',review=ownReview(v)})
  end
  local v=nil
  for _,row in ipairs(rows) do
    if row.kind==c.kind and row.status=='pending' and row.weekWindowKey==w.week.windowKey then v=row;break end
  end
  local duplicate=v~=nil
  if not v then
    if redis.call('HGET',KEYS[5],c.reviewId) then error('ME_REVIEW_COLLISION') end
    v={reviewId=c.reviewId,targetIdentitySubject=c.subject,kind=c.kind,reasonCode=c.reasonCode,
      weekWindowKey=w.week.windowKey,createdAt=nowIso,status='pending'}
  end
  local encoded=encode(v);local idem=encode({fingerprint=fingerprint,reviewId=v.reviewId})
  local event=encode({actor='user',subject=c.subject,reviewId=v.reviewId,action='enqueue',createdAt=nowIso})
  if not duplicate then redis.call('HSET',KEYS[5],v.reviewId,encoded) end
  redis.call('HSET',KEYS[8],key,idem);redis.call('HSET',KEYS[9],c.eventId,event)
  return reply({outcome=duplicate and 'duplicate' or 'created',review=ownReview(v)})
end
if op~='mutate' then error('INVALID_ADMIN_OPERATION') end
if c.confirmed~=true then return reply({outcome='invalid'}) end
local w=windows()
local fingerprint={}
for k,v in pairs(c) do if k~='nowIso' and k~='auditId' and k~='generatedTopUpId' then fingerprint[k]=v end end
local idem=redis.call('HGET',KEYS[7],c.idempotencyKey)
if idem then
  local old=cjson.decode(idem)
  if not same(old.fingerprint,fingerprint) then return reply({outcome='conflict'}) end
  return reply({outcome='duplicate',auditId=old.auditId})
end
if epoch(c.nowIso)>now then error('ADMIN_CLOCK_AHEAD') end
local u=state(c.targetIdentitySubject); if not u then return reply({outcome='not_found'}) end
local review=nil
if c.reviewId then
  local raw=redis.call('HGET',KEYS[5],c.reviewId)
  if not raw then return reply({outcome='not_found'}) end
  review=cjson.decode(raw)
  if review.targetIdentitySubject~=c.targetIdentitySubject or review.status~='pending' then return reply({outcome='conflict'}) end
  if not ((review.kind=='paid_access' and (c.action=='approve' or c.action=='reject')) or
    (review.kind=='weekly_top_up' and (c.action=='top_up' or c.action=='reject'))) then return reply({outcome='invalid'}) end
  if review.kind=='weekly_top_up' and c.action=='top_up' and review.weekWindowKey and
    review.weekWindowKey~=w.week.windowKey then return reply({outcome='invalid'}) end
end
local status,tier=approval(u)
local before={status=status,tier=tier};local after={}
local audit={auditId=c.auditId,idempotencyKey=c.idempotencyKey,adminSubject=c.adminSubject,
  targetIdentitySubject=c.targetIdentitySubject,action=c.action,createdAt=nowIso,reasonCode=c.reasonCode}
if c.action=='top_up' or c.action=='top_up_revoke' then
  if c.scope~='all_protected_endpoints' or c.weekWindowKey~=w.week.windowKey or c.expiresAt~=w.week.resetAt or epoch(c.expiresAt)<=now then return reply({outcome='invalid'}) end
  local sum=cumulative(u,w.week); before={cumulativeWeeklyTopUpMicroUsd=sum}
  local amount=nil
  if c.action=='top_up' then
    if status~='approved' or not safe(c.amountMicroUsd) or c.amountMicroUsd<=0 then return reply({outcome='invalid'}) end
    sum=add(sum,c.amountMicroUsd);amount=c.amountMicroUsd
    local base=tier=='tier2' and 50000000 or 15000000
    if sum>MAX-base then return reply({outcome='invalid'}) end
    if u.topUps[c.generatedTopUpId] or u.topUpIdempotency[c.idempotencyKey] then return reply({outcome='conflict'}) end
    u.topUps[c.generatedTopUpId]={topUpId=c.generatedTopUpId,identitySubject=c.targetIdentitySubject,
      weekWindowKey=w.week.windowKey,amountMicroUsd=amount,status='active',idempotencyKey=c.idempotencyKey,
      adminSubject=c.adminSubject,reasonCode=c.reasonCode,expiresAt=w.week.resetAt,createdAt=nowIso}
    u.topUpIdempotency[c.idempotencyKey]=c.generatedTopUpId
    after={status='active',cumulativeWeeklyTopUpMicroUsd=sum}
  else
    local grant=u.topUps[c.topUpId]
    if not grant or grant.identitySubject~=c.targetIdentitySubject or grant.weekWindowKey~=w.week.windowKey then return reply({outcome='not_found'}) end
    if grant.status~='active' or epoch(grant.expiresAt)<=now then return reply({outcome='conflict'}) end
    amount=grant.amountMicroUsd;sum=sum-amount
    grant.status='revoked';grant.revokedAt=nowIso
    after={status='revoked',cumulativeWeeklyTopUpMicroUsd=sum}
  end
  audit.weekWindowKey=w.week.windowKey;audit.expiresAt=w.week.resetAt
  audit.amountEstimatedUsd=exactMoney(amount);audit.scope='all_protected_endpoints'
  audit.topUpId=c.action=='top_up' and c.generatedTopUpId or c.topUpId
elseif review and review.kind=='weekly_top_up' and c.action=='reject' then
  before={status='pending'};after={status='rejected'}
else
  local accessReview=review and review.kind=='paid_access' and status~='approved'
  if c.action=='approve' and status~='pending' and not accessReview or c.action=='reject' and status~='pending' and not accessReview or
    c.action=='change_tier' and status~='approved' or c.action=='revoke' and status~='approved' then return reply({outcome='conflict'}) end
  if (c.action=='approve' or c.action=='change_tier') and c.tier~='tier1' and c.tier~='tier2' then return reply({outcome='invalid'}) end
  local nextStatus=c.action=='approve' and 'approved' or c.action=='change_tier' and 'approved' or c.action=='reject' and 'rejected' or c.action=='revoke' and 'revoked'
  if not nextStatus then return reply({outcome='invalid'}) end
  local retainedTier=u.eligibility~=cjson.null and u.eligibility and u.eligibility.tier or 'tier1'
  u.eligibility={identitySubject=c.targetIdentitySubject,status=nextStatus,tier=c.tier or retainedTier,
    expiresAt=u.eligibility~=cjson.null and u.eligibility and u.eligibility.expiresAt or cjson.null,updatedAt=nowIso}
  after={status=nextStatus,tier=nextStatus=='approved' and u.eligibility.tier or cjson.null}
end
audit.before=before;audit.after=after
if redis.call('HGET',KEYS[6],c.auditId) then error('AUDIT_ID_COLLISION') end
-- 所有 decode、金額與型別檢查在寫入前完成；Redis script 錯誤不提供回滾。
local encodedUser=encode(u);local encodedAudit=encode(audit)
local encodedIdem=encode({fingerprint=fingerprint,auditId=c.auditId})
local encodedReview=nil
if review then review.status='resolved';review.resolvedAt=nowIso;review.auditId=c.auditId;encodedReview=encode(review) end
redis.call('HSET',KEYS[2],c.targetIdentitySubject,encodedUser)
redis.call('HSET',KEYS[6],c.auditId,encodedAudit)
redis.call('HSET',KEYS[7],c.idempotencyKey,encodedIdem)
if review then redis.call('HSET',KEYS[5],c.reviewId,encodedReview) end
return reply({outcome='applied',auditId=c.auditId})
`;
