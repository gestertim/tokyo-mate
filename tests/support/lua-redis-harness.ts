import { spawnSync } from 'node:child_process';

export const luaAvailable = !spawnSync('lua', ['-v'], { encoding: 'utf8' }).error;

function literal(value: unknown): string {
  if (value === null) return 'cjson.null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return `{${value.map(literal).join(',')}}`;
  if (value && typeof value === 'object') return `{${Object.entries(value).map(([k, v]) =>
    `[${JSON.stringify(k)}]=${literal(v)}`).join(',')}}`;
  throw new TypeError('Lua fixture 必須為 JSON data');
}

export interface LuaInvocation { script: string; keys: readonly string[]; command: object; now: string }

// 執行既有 Lua interpreter，Redis/cjson 為明列的本機替身；不等同 Redis server 證據。
export function runLuaRedis(invocations: LuaInvocation[]): unknown[] {
  const harness = String.raw`
local hashes={}; local strings={}; local sorted={}; local expiries={}; local decoded={}; local clock=0
cjson={null={}}
local function clone(t)
  if t==cjson.null or type(t)~='table' then return t end
  local out={}; for k,v in pairs(t) do out[k]=clone(v) end; return out
end
local function quote(s)
  s=s:gsub('\\','\\\\'):gsub('"','\\"'):gsub('\n','\\n'):gsub('\r','\\r'):gsub('\t','\\t')
  return '"'..s..'"'
end
local function encode(t)
  if t==cjson.null then return 'null' end
  if type(t)=='string' then return quote(t) end
  if type(t)=='boolean' or type(t)=='number' then return tostring(t) end
  local out={}
  if #t>0 then for i=1,#t do table.insert(out,encode(t[i])) end return '['..table.concat(out,',')..']' end
  for k,v in pairs(t) do table.insert(out,quote(k)..':'..encode(v)) end
  table.sort(out); return '{'..table.concat(out,',')..'}'
end
cjson.encode=function(t) local s=encode(t); decoded[s]=clone(t); return s end
cjson.decode=function(s)
  if decoded[s]~=nil then return clone(decoded[s]) end
  local pos=1
  local function space() while s:sub(pos,pos):match('%s') do pos=pos+1 end end
  local function text()
    pos=pos+1; local out={}
    while pos<=#s do
      local ch=s:sub(pos,pos); pos=pos+1
      if ch=='"' then return table.concat(out) end
      if ch=='\\' then
        ch=s:sub(pos,pos); pos=pos+1
        local escape={['"']='"',['\\']='\\',['/']='/',b='\b',f='\f',n='\n',r='\r',t='\t'}
        if ch=='u' then local n=tonumber(s:sub(pos,pos+3),16);pos=pos+4;ch=utf8.char(n)
        else ch=escape[ch]; if not ch then error('INVALID_FIXTURE_ESCAPE') end end
      end
      table.insert(out,ch)
    end
    error('UNTERMINATED_FIXTURE_JSON')
  end
  local parse
  parse=function()
    space(); local ch=s:sub(pos,pos)
    if ch=='"' then return text() end
    if ch=='{' then
      pos=pos+1;space();local out={}
      if s:sub(pos,pos)=='}' then pos=pos+1;return out end
      while true do
        space(); if s:sub(pos,pos)~='"' then error('INVALID_FIXTURE_KEY') end
        local key=text();space();if s:sub(pos,pos)~=':' then error('INVALID_FIXTURE_COLON') end
        pos=pos+1;out[key]=parse();space();ch=s:sub(pos,pos);pos=pos+1
        if ch=='}' then return out end
        if ch~=',' then error('INVALID_FIXTURE_OBJECT') end
      end
    end
    if ch=='[' then
      pos=pos+1;space();local out={}
      if s:sub(pos,pos)==']' then pos=pos+1;return out end
      while true do
        table.insert(out,parse());space();ch=s:sub(pos,pos);pos=pos+1
        if ch==']' then return out end
        if ch~=',' then error('INVALID_FIXTURE_ARRAY') end
      end
    end
    for word,value in pairs({['true']=true,['false']=false,['null']=cjson.null}) do
      if s:sub(pos,pos+#word-1)==word then pos=pos+#word;return value end
    end
    local n=s:sub(pos):match('^%-?%d+%.?%d*[eE]?[+-]?%d*')
    if not n or not tonumber(n) then error('INVALID_FIXTURE_NUMBER') end
    pos=pos+#n;return tonumber(n)
  end
  local out=parse();space();if pos<=#s then error('TRAILING_FIXTURE_JSON') end
  return out
end
redis={call=function(op,key,...)
  local args={...}
  if expiries[key] and expiries[key]<=clock then strings[key]=nil;expiries[key]=nil end
  if op=='TIME' then return {math.floor(clock/1000), (clock%1000)*1000} end
  if op=='TYPE' then return {ok=hashes[key] and 'hash' or strings[key] and 'string' or sorted[key] and 'zset' or 'none'} end
  if op=='HGET' then return hashes[key] and hashes[key][args[1]] or false end
  if op=='HSET' then
    hashes[key]=hashes[key] or {}
    for i=1,#args,2 do hashes[key][args[i]]=tostring(args[i+1]) end
    return 1
  end
  if op=='HGETALL' then local out={}; for k,v in pairs(hashes[key] or {}) do table.insert(out,k);table.insert(out,v) end return out end
  if op=='HSCAN' then local out={}; for k,v in pairs(hashes[key] or {}) do table.insert(out,k);table.insert(out,v) end return {'0',out} end
  if op=='HDEL' then if hashes[key] then hashes[key][args[1]]=nil end return 1 end
  if op=='ZADD' then sorted[key]=sorted[key] or {};sorted[key][args[2]]=tonumber(args[1]);return 1 end
  if op=='ZREM' then if sorted[key] then sorted[key][args[1]]=nil end return 1 end
  if op=='ZCARD' then local n=0;for _ in pairs(sorted[key] or {}) do n=n+1 end;return n end
  if op=='ZRANGEBYSCORE' then
    local rows={}
    for id,score in pairs(sorted[key] or {}) do
      if score<=tonumber(args[2]) then table.insert(rows,{id=id,score=score}) end
    end
    table.sort(rows,function(a,b) return a.score<b.score or a.score==b.score and a.id<b.id end)
    local out={}
    for i=1,math.min(#rows,tonumber(args[5])) do table.insert(out,rows[i].id) end
    return out
  end
  if op=='GET' then return strings[key] or false end
  if op=='EXISTS' then
    local count=0
    local keys={key}
    for i=1,#args do table.insert(keys,args[i]) end
    for i=1,#keys do
      local item=keys[i]
      if hashes[item] or strings[item] or sorted[item] then count=count+1 end
    end
    return count
  end
  if op=='SET' then
    strings[key]=args[1]
    if args[2]=='PX' then expiries[key]=clock+tonumber(args[3]) end
    return 'OK'
  end
  if op=='DEL' then
    local count=0
    local keys={key}
    for i=1,#args do table.insert(keys,args[i]) end
    for i=1,#keys do
      local item=keys[i]
      if hashes[item] or strings[item] or sorted[item] then count=count+1 end
      strings[item]=nil;hashes[item]=nil;sorted[item]=nil;expiries[item]=nil
    end
    return count
  end
  error('UNIMPLEMENTED_REDIS_COMMAND:'..op)
end}
`;
  const scripts = [...new Set(invocations.map((v) => v.script))];
  const invoke = `
local function invoke(script,keys,command,at)
  clock=at; KEYS=keys; ARGV={cjson.encode(command)}
  local fn,err=load(script)
  if not fn then error(err) end
  local ok,result=pcall(fn)
  if ok then print(result) else print(cjson.encode({fixtureError=tostring(result)})) end
end
`;
  const calls = invocations.map((v) => `
${'bundleJson' in v.command && typeof v.command.bundleJson === 'string'
    ? `decoded[${literal(v.command.bundleJson)}]=${literal(JSON.parse(v.command.bundleJson))}` : ''}
invoke(scripts[${scripts.indexOf(v.script) + 1}],${literal(v.keys)},${literal(v.command)},${Date.parse(v.now)})
`).join('\n');
  const result = spawnSync('lua', ['-'], {
    input: harness + `\nlocal scripts=${literal(scripts)}\n` + invoke + calls, encoding: 'utf8', timeout: 10_000,
  });
  if (result.error || result.status !== 0) throw new Error(`${result.error?.message ?? ''}\n${result.stderr}`);
  return result.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}
