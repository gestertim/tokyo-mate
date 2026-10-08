import { createRedisAtomicTransport } from './redis-atomic-transport';
import { createRedisClockLua } from './redis-quota-script';
import { REQUEST_EPOCH_AUTHORITY_LUA, validateRequestEpochFloor } from './request-epoch-authority';
import { REQUEST_EPOCH_KEYS } from './redis-request-epoch-store';
import { decodeRedisReply, isRedisObject, type RedisStoreOptions } from './redis-shared-store';
import { isEpochLifecycleInput, LOCAL_EPOCH_LIFECYCLE_POLICY, type EpochCleanupEvidence,
  type EpochLifecyclePolicy, type EpochLifecycleResult, type EpochLifecycleStore } from './epoch-lifecycle';
import type { RequestEpochFloor } from './request-epoch-store';

export const REDIS_EPOCH_LIFECYCLE_LUA = createRedisClockLua(
  ['hash', 'hash', 'hash', 'hash', 'hash', 'zset', 'hash', 'hash', 'hash', 'hash', 'hash']) + REQUEST_EPOCH_AUTHORITY_LUA + String.raw`
local input=cjson.decode(ARGV[1]); local c=input.command; local policy=input.policy
local a=epochAuthority(input.floor)
if redis.call('HGET',KEYS[9],c.auditId) then error('AUDIT_ID_COLLISION') end
local id=c.operationId..':'..c.step
local binding={actor=c.actor,action=c.action,target=c.target,reasonCode=c.reasonCode,
  evidenceRef=c.evidenceRef,nextVersion=c.nextVersion,dryRun=c.dryRun,idempotencyKey=c.idempotencyKey}
local function audit(outcome,reason,changed)
  if redis.call('HGET',KEYS[9],c.auditId) then error('AUDIT_ID_COLLISION') end
  redis.call('HSET',KEYS[9],c.auditId,encode({auditId=c.auditId,actor=c.actor,operationId=c.operationId,
    action=c.action,step=c.step,target=c.target,reasonCode=c.reasonCode,evidenceRef=c.evidenceRef,
    outcome=outcome,reason=reason,createdAt=nowIso}))
  return {outcome=outcome,reason=reason,auditId=c.auditId,changed=changed}
end
local raw=redis.call('HGET',KEYS[8],id)
if raw then
  local prior=cjson.decode(raw)
  if not same(prior.binding,binding) then return reply(audit('conflict','COMMAND_REBOUND')) end
  return reply({outcome='duplicate',auditId=prior.result.auditId,changed=prior.result.changed,reason=prior.result.reason})
end
if c.step=='confirm' then
  local firstRaw=redis.call('HGET',KEYS[8],c.operationId..':inspect')
  local first=firstRaw and cjson.decode(firstRaw) or nil
  if not first or first.binding.actor~=c.actor or first.binding.action~=c.action or
    first.binding.target~=c.target or first.binding.reasonCode~=c.reasonCode or
    first.binding.nextVersion~=c.nextVersion or first.binding.dryRun~=c.dryRun then
    return reply(audit('refused','INSPECTION_REQUIRED'))
  end
end
local users=redis.call('HGETALL',KEYS[2])
if #users>200 then error('LIFECYCLE_BATCH_LIMIT') end
local function refs(family,version)
  local n=0
  for _,e in pairs(a.epochs) do
    if e.state~='retired' and ((family=='capability' and e.kid==version) or
      (family=='fingerprint' and e.scopeKeyVersion==version)) then n=n+1 end
  end
  for i=1,#users,2 do
    local u=cjson.decode(users[i+1])
    for _,rows in ipairs({u.reservations or {},u.comparisonTombstones or {}}) do
      for _,r in pairs(rows) do if family=='fingerprint' and r.fingerprintKeyVersion==version then n=n+1 end end
    end
  end
  local issues=redis.call('HGETALL',KEYS[5])
  for i=1,#issues,2 do
    if not issues[i]:match('^handle:') then
      local r=cjson.decode(issues[i+1])
      if (family=='capability' and r.kid==version) or (family=='fingerprint' and r.scopeKeyVersion==version) then n=n+1 end
    end
  end
  local external=input.keyReferences[family..':'..version]
  if not safe(external) then return nil end
  return n+external
end
local function cleanupSafe()
  local e=input.cleanupEvidence
  return e and e.billingWindowSufficient==true and e.allDeploymentsEpochAware==true and
    e.restoreBarrierVerified==true and e.unknownIssuancesBlocked==true and e.allKeyReferencesZero==true
end
local result=nil
if c.step=='inspect' then
  result=audit('inspected')
elseif c.action=='review_uncertain' then
  local subject,reservationId=c.target:match('^([^:]+):([^:]+)$')
  local userRaw=subject and redis.call('HGET',KEYS[2],subject)
  local u=userRaw and cjson.decode(userRaw) or nil
  local r=u and ((u.reservations or {})[reservationId] or (u.comparisonTombstones or {})[reservationId] or
    (u.accountingRecords or {})[reservationId])
  if not r or r.status~='uncertain' then result=audit('not_found')
  elseif not c.evidenceRef or input.accountingEvidence~=true then result=audit('refused','ACCOUNTING_EVIDENCE_REQUIRED')
  else
    local started=epoch(r.settledAt or r.leaseExpiresAt)
    local previous=r.lastReviewedAt and epoch(r.lastReviewedAt) or nil
    if now<started+policy.firstReviewMs or (previous and now<previous+policy.reviewEveryMs) then
      result=audit('refused','REVIEW_NOT_DUE')
    else
      if not c.dryRun then
        r.lastReviewedAt=nowIso; r.reviewEvidenceRef=c.evidenceRef
        r.reviewEscalated=now>=started+policy.escalateMs
        redis.call('HSET',KEYS[2],subject,encode(u))
      end
      result=audit(c.dryRun and 'dry_run' or 'applied','REVIEW_ONLY_NO_ACCOUNTING_CLOSE')
    end
  end
elseif c.action=='retire_epoch' then
  local e=a.epochs[c.target]
  if not e then result=audit('not_found')
  elseif e.state=='retired' then result=audit('applied','ALREADY_RETIRED')
  elseif now<e.validUntilMs or a.currentEpochId==e.epochId then result=audit('refused','EPOCH_STILL_ACCEPTABLE')
  elseif not cleanupSafe() then result=audit('refused','RETIREMENT_EVIDENCE_REQUIRED')
  else
    if not c.dryRun then
      e.state='retired'; e.retiredAtMs=now; a.authorityRevision=add(a.authorityRevision,1)
      local generations={}
      for _,v in pairs(a.epochs) do generations[v.generation]=v.state end
      while generations[a.retiredThrough+1]=='retired' do a.retiredThrough=a.retiredThrough+1 end
      redis.call('HSET',KEYS[4],'snapshot',epochAuthorityEncode(a))
    end
    result=audit(c.dryRun and 'dry_run' or 'applied')
  end
elseif c.action=='revoke_key' or c.action=='rotate_key' or c.action=='retire_key' then
  local family,version=c.target:match('^([^:]+):([^:]+)$')
  local state=family and redis.call('HGET',KEYS[4],family..':'..version)
  if not state then result=audit('not_found')
  elseif c.action=='retire_key' then
    local references=refs(family,version)
    if not cleanupSafe() or references~=0 or state=='current' then result=audit('refused','KEY_REFERENCES_OR_BARRIER')
    else
      if not c.dryRun then redis.call('HSET',KEYS[4],family..':'..version,'retired') end
      result=audit(c.dryRun and 'dry_run' or 'applied')
    end
  elseif c.action=='rotate_key' then
    local loaded=c.nextVersion and redis.call('HGET',KEYS[4],family..':'..c.nextVersion)=='loaded'
    local created=tonumber(redis.call('HGET',KEYS[4],family..':created:'..version) or '')
    if state~='current' or not loaded or not created or now<created+policy.rotationMs then result=audit('refused','ROTATION_NOT_READY')
    else
      if not c.dryRun then
        redis.call('HSET',KEYS[4],family..':'..version,'verify_only',family..':'..c.nextVersion,'current',
          family..'Current',c.nextVersion,family..':created:'..c.nextVersion,string.format('%.0f',now))
        a.authorityRevision=add(a.authorityRevision,1); redis.call('HSET',KEYS[4],'snapshot',epochAuthorityEncode(a))
      end
      result=audit(c.dryRun and 'dry_run' or 'applied')
    end
  else
    if not c.evidenceRef or input.keyEvidence~=true then result=audit('refused','REVOCATION_EVIDENCE_REQUIRED')
    else
      if not c.dryRun then
        redis.call('HSET',KEYS[4],family..':'..version,'revoked')
        for _,e in pairs(a.epochs) do
          if (family=='capability' and e.kid==version) or (family=='fingerprint' and e.scopeKeyVersion==version) then
            local found=false; for _,kid in ipairs(a.revokedKids) do if kid==e.kid then found=true end end
            if not found then table.insert(a.revokedKids,e.kid) end
          end
        end
        a.authorityRevision=add(a.authorityRevision,1); redis.call('HSET',KEYS[4],'snapshot',epochAuthorityEncode(a))
      end
      result=audit(c.dryRun and 'dry_run' or 'applied')
    end
  end
elseif c.action=='cleanup' then
  local count=0
  local function resetAt(key)
    local y,m,d=key:match('^day:(%d%d%d%d)%-(%d%d)%-(%d%d)$')
    if y then return epoch(y..'-'..m..'-'..d..'T00:00:00.000Z')+86400000-28800000 end
    local wy,w=key:match('^week:(%d%d%d%d)%-W(%d%d)$')
    if not wy or tonumber(w)<1 or tonumber(w)>53 then error('INVALID_WINDOW_REFERENCE') end
    local jan4=days(tonumber(wy),1,4); local first=jan4-((jan4+3)%7)
    return (first+tonumber(w)*7)*86400000-28800000
  end
  local reviews=redis.call('HGETALL',KEYS[10]); local audits=redis.call('HGETALL',KEYS[11])
  local issues=redis.call('HGETALL',KEYS[5])
  if #reviews>200 or #audits>200 then error('LIFECYCLE_BATCH_LIMIT') end
  if #issues>400 then error('LIFECYCLE_BATCH_LIMIT') end
  for i=1,#users,2 do
    local u=cjson.decode(users[i+1]); local total=0
    encode(u)
    for key,v in pairs(u.windows or {}) do
      resetAt(key)
      if type(v)~='table' or not safe(v.usedMicroUsd) or not safe(v.reservedMicroUsd) then error('INVALID_RETENTION_AGGREGATE') end
    end
    for _,rows in ipairs({u.reservations or {},u.comparisonTombstones or {},u.accountingRecords or {}}) do
      for _,r in pairs(rows) do
        total=total+1
        if type(r)~='table' or type(r.dayWindowKey)~='string' or type(r.weekWindowKey)~='string' then error('INVALID_RETENTION_RECORD') end
        if r.requestEpoch and (type(r.requestEpoch)~='table' or type(r.requestEpoch.payload)~='table' or
          type(r.requestEpoch.payload.epochId)~='string') then error('INVALID_RETENTION_EPOCH') end
        if rows==u.comparisonTombstones and not r.requestEpoch then error('MISSING_COMPARISON_EPOCH') end
        if r.status~='reserved' and r.status~='uncertain' and r.settledAt then epoch(r.settledAt) end
      end
    end
    if total>100 then error('LIFECYCLE_BATCH_LIMIT') end
  end
  for _,rows in ipairs({reviews,audits}) do
    for i=1,#rows,2 do
      local r=cjson.decode(rows[i+1]); encode(r)
      if type(r)~='table' then error('INVALID_RETENTION_EVENT') end
      for _,key in ipairs({'createdAt','resolvedAt','withdrawnAt'}) do if r[key] then epoch(r[key]) end end
    end
  end
  for i=1,#issues,2 do
    if not issues[i]:match('^handle:') then local r=cjson.decode(issues[i+1]); encode(r)
      if type(r.epochId)~='string' or type(r.handleIndex)~='string' then error('INVALID_ISSUANCE_RECORD') end
    end
  end
  for i=1,#users,2 do
    local u=cjson.decode(users[i+1]); u.comparisonTombstones=u.comparisonTombstones or {}
    u.accountingRecords=u.accountingRecords or {}
    for id,r in pairs(u.reservations or {}) do
      local terminal=r.status=='settled' or r.status=='released'
      local due=terminal and r.settledAt and now>=epoch(r.settledAt)+policy.retentionMs
      if (due or r.status=='uncertain') and r.requestEpoch then
        count=count+1
        local tomb={}
        for _,key in ipairs({'reservationId','identitySubject','idempotencyKey','endpoint','estimatedCostUpperBoundUsdMicro',
          'costModelVersion','costParametersDigest','costModelEffectiveFrom','costModelExpiresAt','requestFingerprint',
          'fingerprintKeyVersion','estimateInputs','status','dayWindowKey','weekWindowKey','createdAt','executionGranted',
          'leaseExpiresAt','conflictCount','settledAt','settlementReason','settledChargeUsdMicro','overrunMicroUsd',
          'settlementCostModelVersion','lateOutcomeObserved','requestEpoch','comparisonCost','lastReviewedAt',
          'reviewEvidenceRef','reviewEscalated'}) do tomb[key]=r[key] end
        u.comparisonTombstones[id]=tomb
        u.reservations[id]=nil
      end
    end
    for id,r in pairs(u.comparisonTombstones) do
      local e=a.epochs[r.requestEpoch.payload.epochId]
      if r.status~='uncertain' and cleanupSafe() and e and (e.state=='retired' or e.generation<=a.retiredThrough) then
        u.accountingRecords[id]={reservationId=id,identitySubject=r.identitySubject,endpoint=r.endpoint,status=r.status,
            accountingCompacted=true,leaseExpiresAt=r.leaseExpiresAt,executionGranted=r.executionGranted,
            settlementReason=r.settlementReason,settlementCostModelVersion=r.settlementCostModelVersion,
            dayWindowKey=r.dayWindowKey,weekWindowKey=r.weekWindowKey,createdAt=r.createdAt,settledAt=r.settledAt,
            settledChargeUsdMicro=r.settledChargeUsdMicro,estimatedCostUpperBoundUsdMicro=r.estimatedCostUpperBoundUsdMicro,
            lateOutcomeObserved=r.lateOutcomeObserved,reviewEvidenceRef=r.reviewEvidenceRef,lastReviewedAt=r.lastReviewedAt}
        u.comparisonTombstones[id]=nil
        count=count+1
      end
    end
    for key,aggregate in pairs(u.windows or {}) do
      if now>=resetAt(key)+policy.retentionMs then
        local retain=false
        for _,rows in ipairs({u.reservations or {},u.comparisonTombstones or {},u.accountingRecords or {}}) do
          for _,r in pairs(rows) do
            local linked=key=='day:'..r.dayWindowKey or key=='week:'..r.weekWindowKey
            if linked and (not r.requestEpoch and not r.accountingCompacted or r.status=='reserved' or r.status=='uncertain') then retain=true end
          end
        end
        local changes=cleanupSafe() and not retain
        for field,_ in pairs(aggregate) do if field~='usedMicroUsd' and field~='reservedMicroUsd' then changes=true end end
        if changes then count=count+1 end
        if not c.dryRun then
          if cleanupSafe() and not retain then u.windows[key]=nil
          else u.windows[key]={usedMicroUsd=aggregate.usedMicroUsd,reservedMicroUsd=aggregate.reservedMicroUsd} end
        end
      end
    end
    if not c.dryRun then redis.call('HSET',KEYS[2],users[i],encode(u)) end
  end
  for i=1,#reviews,2 do
    local r=cjson.decode(reviews[i+1])
    local finished=r.status=='resolved' and r.resolvedAt or r.status=='withdrawn' and r.withdrawnAt or nil
    if finished and now>=epoch(finished)+policy.retentionMs and not r.detailCompacted then
      count=count+1
      if not c.dryRun then
        local out={detailCompacted=true}
        for _,key in ipairs({'reviewId','targetIdentitySubject','kind','reasonCode','weekWindowKey','status',
          'createdAt','resolvedAt','withdrawnAt'}) do out[key]=r[key] end
        redis.call('HSET',KEYS[10],reviews[i],encode(out))
      end
    end
  end
  for i=1,#audits,2 do
    local r=cjson.decode(audits[i+1])
    if r.createdAt and now>=epoch(r.createdAt)+policy.retentionMs and not r.detailCompacted then
      count=count+1
      if not c.dryRun then
        local out={detailCompacted=true}
        for _,key in ipairs({'auditId','idempotencyKey','adminSubject','targetIdentitySubject','action','createdAt',
          'reasonCode','before','after','weekWindowKey','expiresAt','amountEstimatedUsd','scope','topUpId'}) do out[key]=r[key] end
        redis.call('HSET',KEYS[11],audits[i],encode(out))
      end
    end
  end
  if cleanupSafe() then
    for i=1,#issues,2 do
      if not issues[i]:match('^handle:') then
        local r=cjson.decode(issues[i+1]); local e=a.epochs[r.epochId]
        if e and e.state=='retired' and e.retiredAtMs and now>=e.retiredAtMs+policy.issuanceRetentionMs then
          if not c.dryRun then
            redis.call('HDEL',KEYS[5],issues[i]);redis.call('HDEL',KEYS[5],'handle:'..r.handleIndex)
            redis.call('ZREM',KEYS[6],issues[i])
          end
          count=count+1
        end
      end
    end
  end
  result=audit(c.dryRun and 'dry_run' or 'applied',cleanupSafe() and 'LOCAL_ONLY' or 'COMPARISON_AND_ACCOUNTING_RETAINED',count)
else error('INVALID_LIFECYCLE_ACTION') end
redis.call('HSET',KEYS[8],id,encode({binding=binding,result=result}))
return reply(result)
`;

export function createRedisEpochLifecycleStore(options: RedisStoreOptions & {
  scope: 'TEST_ONLY';
  epochFloor: RequestEpochFloor;
  policy?: EpochLifecyclePolicy;
  evidence(reference: string | undefined): Promise<{
    cleanup?: EpochCleanupEvidence;
    accounting: boolean;
    key: boolean;
    keyReferences: Record<string, number>;
  }>;
}): EpochLifecycleStore {
  if (options.scope !== 'TEST_ONLY') throw new TypeError('正式 lifecycle 操作尚未批准');
  validateRequestEpochFloor(options.epochFloor, options.namespace);
  const policy = options.policy ?? LOCAL_EPOCH_LIFECYCLE_POLICY;
  if (Object.keys(policy).length !== 6 || !Object.keys(LOCAL_EPOCH_LIFECYCLE_POLICY).every((key) =>
    Object.hasOwn(policy, key)) || !Object.values(policy).every((n) => Number.isSafeInteger(n) && n > 0))
    throw new TypeError('無效 lifecycle 期限設定');
  const driver = createRedisAtomicTransport({ ...options, keys: [...REQUEST_EPOCH_KEYS(options.namespace),
    `${options.namespace}:request-epoch-admin-commands`, `${options.namespace}:request-epoch-audit`,
    `${options.namespace}:admin-reviews`, `${options.namespace}:admin-audit`] });
  return {
    async execute(command) {
      const { actor, auditId, ...input } = command;
      if (!isEpochLifecycleInput(input) || !/^[A-Za-z0-9_.:@/-]{1,200}$/.test(actor) || !/^[A-Za-z0-9_-]{1,128}$/.test(auditId))
        throw new TypeError('無效 lifecycle 操作');
      const evidence = await options.evidence(command.evidenceRef);
      if (!isRedisObject(evidence.keyReferences) || !Object.entries(evidence.keyReferences).every(([version, references]) =>
        /^(capability|fingerprint|oauth_state|rate):[A-Za-z0-9_-]{1,128}$/.test(version) &&
        Number.isSafeInteger(references) && references >= 0)) throw new TypeError('無效 key 引用證據');
      const value = decodeRedisReply(await driver.execute(REDIS_EPOCH_LIFECYCLE_LUA, { command, policy,
        floor: options.epochFloor, cleanupEvidence: evidence.cleanup, accountingEvidence: evidence.accounting,
        keyEvidence: evidence.key, keyReferences: evidence.keyReferences }));
      if (!isLifecycleResult(value) ||
          (value.changed !== undefined && (!Number.isSafeInteger(value.changed) || Number(value.changed) < 0)))
        throw new Error('INVALID_LIFECYCLE_REPLY');
      return value;
    },
  };
}

function isLifecycleResult(value: unknown): value is EpochLifecycleResult {
  return isRedisObject(value) &&
    ['inspected', 'applied', 'duplicate', 'conflict', 'refused', 'dry_run', 'not_found'].includes(String(value.outcome)) &&
    (value.auditId === undefined || typeof value.auditId === 'string') &&
    (value.reason === undefined || typeof value.reason === 'string');
}
