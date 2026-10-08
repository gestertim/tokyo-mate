// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { parseTestOnlyArguments } from '../../scripts/005-test-only-server.mjs';

const serverUrl = new URL('../../scripts/005-test-only-server.mjs', import.meta.url).href;
const flow = `
import { createTestOnlyApi } from ${JSON.stringify(serverUrl)};
const origin = 'http://127.0.0.1:5173';
const api = await createTestOnlyApi({ origin });
const out = {};
const call = (path, init = {}) => api.handle(new Request('http://127.0.0.1:3000' + path, init));
async function login(id) {
  const response = await call('/api/auth/login?as=' + id);
  const cookie = response.headers.get('set-cookie') ?? '';
  return { cookie: cookie.split(';')[0], raw: cookie, status: response.status };
}
const get = (path, session) => call(path, { headers: session.cookie ? { cookie: session.cookie } : {} });
const anonymous = { cookie: '' };
out.anonymousQuota = (await get('/api/me/quota', anonymous)).status;
const pending = await login('test-pending');
out.loginRedirect = pending.status;
out.cookieSecure = /;\\s*Secure/i.test(pending.raw);
out.pendingQuota = (await get('/api/me/quota', pending)).status;
const tier1 = await login('test-tier1');
const quota = await (await get('/api/me/quota', tier1)).json();
out.tier1 = [quota.data.tier, quota.data.daily.limitEstimatedUsd, quota.data.weekly.limitEstimatedUsd];
out.nonAdmin = (await get('/api/admin/overview', tier1)).status;
const admin = await login('test-admin');
out.adminOverview = (await get('/api/admin/overview', admin)).status;
const approve = (key) => call('/api/admin/approvals', { method: 'POST', headers: { cookie: admin.cookie, origin,
  'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve', idempotencyKey: key,
  targetIdentitySubject: 'test-pending', confirmed: true, reasonCode: 'operator_review', tier: 'tier2' }) });
out.approve = (await approve('key-1')).status;
out.approveDuplicate = (await (await approve('key-1')).json()).data.outcome;
out.pendingAfter = (await (await get('/api/me/quota', pending)).json()).data.tier;
out.csrf = (await call('/api/admin/approvals', { method: 'POST', headers: { cookie: admin.cookie,
  origin: 'https://evil.invalid', 'content-type': 'application/json' }, body: '{}' })).status;
out.unknownRoute = (await get('/api/assistant', tier1)).status;
try { await fetch('https://example.invalid'); out.fetchBlocked = false; } catch { out.fetchBlocked = true; }
console.log(JSON.stringify(out));
`;

describe('TEST_ONLY 本機 API 隔離與流程', () => {
  it('必須明確 --test-only，拒絕 production／Vercel 與非 loopback origin', () => {
    expect(() => parseTestOnlyArguments([])).toThrow('TEST_ONLY_FLAG_REQUIRED');
    expect(() => parseTestOnlyArguments(['--test-only'], { NODE_ENV: 'production' })).toThrow('TEST_ONLY_PRODUCTION_REFUSED');
    expect(() => parseTestOnlyArguments(['--test-only'], { VERCEL: '1' })).toThrow('TEST_ONLY_PRODUCTION_REFUSED');
    expect(() => parseTestOnlyArguments(['--test-only', '--origin=https://example.com'], {}))
      .toThrow('TEST_ONLY_ARGUMENT_INVALID');
    expect(parseTestOnlyArguments(['--test-only', '--port=3100'], {})).toEqual({ port: 3100, origin: 'http://127.0.0.1:5173' });
  });

  it('登入、額度、管理者核准與拒絕路徑；六付費端點不由此入口開放', () => {
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', flow], {
      encoding: 'utf8', env: Object.fromEntries(['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP']
        .filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]])),
      stdio: ['ignore', 'pipe', 'ignore'], timeout: 30_000,
    });
    expect(JSON.parse(output.trim().split('\n').at(-1)!)).toEqual({
      anonymousQuota: 401, loginRedirect: 302, cookieSecure: false, pendingQuota: 403,
      tier1: ['tier1', '3.00', '15.00'], nonAdmin: 403, adminOverview: 200,
      approve: 200, approveDuplicate: 'duplicate', pendingAfter: 'tier2', csrf: 400,
      unknownRoute: 404, fetchBlocked: true,
    });
  });
});
