// TEST_ONLY 本機 API：僅記憶體測試 store／固定測試身分，不讀 env／秘密、不連外、不是正式 factory fallback。
// 必須明確加上 --test-only；production／Vercel 環境與非 loopback 綁定一律拒絕。
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TEST_IDENTITIES = Object.freeze([
  { id: 'test-anonymous', label: '未登入（不建立 Session）', status: null },
  { id: 'test-pending', label: '已登入、待核准', status: 'pending', tier: 'tier1' },
  { id: 'test-tier1', label: '第一級（US$3／日、US$15／週）', status: 'approved', tier: 'tier1' },
  { id: 'test-tier2', label: '第二級（US$10／日、US$50／週）', status: 'approved', tier: 'tier2' },
  { id: 'test-revoked', label: '已撤銷', status: 'revoked', tier: 'tier1' },
  { id: 'test-admin', label: '管理者（同時為第一級）', status: 'approved', tier: 'tier1', admin: true },
]);
const COOKIE = 'TM_TEST_ONLY';

export function parseTestOnlyArguments(argv, env = process.env) {
  let port = 3000, origin = 'http://127.0.0.1:5173';
  if (!argv.includes('--test-only')) throw new Error('TEST_ONLY_FLAG_REQUIRED');
  if (env.NODE_ENV === 'production' || env.VERCEL) throw new Error('TEST_ONLY_PRODUCTION_REFUSED');
  for (const arg of argv) {
    if (arg === '--test-only') continue;
    if (arg.startsWith('--port=') && /^\d{2,5}$/.test(arg.slice(7))) port = Number(arg.slice(7));
    else if (arg.startsWith('--origin=') && /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(arg.slice(9)))
      origin = arg.slice(9);
    else throw new Error('TEST_ONLY_ARGUMENT_INVALID');
  }
  return { port, origin };
}

function registerTypeScript() {
  const root = new URL('../', import.meta.url).href;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (context.parentURL?.startsWith(root) && specifier.startsWith('.') && !extname(specifier) &&
          existsSync(`${fileURLToPath(new URL(specifier, context.parentURL))}.ts`)) specifier += '.ts';
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url.startsWith(root) && url.endsWith('.ts') && !url.includes('/node_modules/')) return {
        format: 'module', shortCircuit: true,
        source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }),
      };
      return nextLoad(url, context);
    },
  });
}

const usd = (micro) => (micro / 1_000_000).toFixed(2);

export async function createTestOnlyApi({ origin }) {
  globalThis.fetch = async () => { throw new Error('TEST_ONLY_EXTERNAL_NETWORK_BLOCKED'); };
  registerTypeScript();
  const load = (path) => import(new URL(`../${path}`, import.meta.url).href);
  const [{ createSessionService }, { createSessionEndpoints }, { createSelfServiceEndpoints },
    { createAdminHandler }, overview, { createQuotaEngine }, { InMemorySharedStoreMock },
    { createRegistryBundle }, { PROTECTED_ENDPOINTS }, priceFixtures, registryFixtures, keyFixtures,
    { getWeekWindow }] = await Promise.all([
    load('api/_lib/session.ts'), load('api/_lib/session-endpoints.ts'), load('api/_lib/self-service-endpoints.ts'),
    load('api/_lib/admin-endpoints.ts'), load('api/admin/overview.ts'), load('api/_lib/quota-engine.ts'),
    load('tests/support/in-memory-shared-store.ts'), load('api/_lib/cost-registry.ts'),
    load('api/_lib/cost-price-table.ts'), load('tests/fixtures/cost-price-fixtures.ts'),
    load('tests/fixtures/cost-registry-fixtures.ts'), load('tests/fixtures/quota-fingerprint-fixtures.ts'),
    load('api/_lib/quota-window.ts'),
  ]);
  const now = () => new Date();
  const store = new InMemorySharedStoreMock(now);
  const table = priceFixtures.fixtureWithEndpoint(priceFixtures.FIXTURE_NONE_LIVE, 'assistant',
    priceFixtures.FIXTURE_ALL_LIVE.endpoints.assistant, 'TEST_ONLY_LOCAL_v1');
  const entries = PROTECTED_ENDPOINTS.map((endpoint) => registryFixtures.fixtureRegistryEntry(endpoint, table));
  store.publishRegistry(createRegistryBundle(1, table, entries));
  const costRegistry = {
    resolve: async (endpoint) => entries.find((entry) => entry.endpoint === endpoint) ?? null,
    snapshot: () => store.registrySnapshot(),
  };
  const tierLimits = {
    tier1: { dayLimitMicroUsd: 3_000_000, weekBaseLimitMicroUsd: 15_000_000 },
    tier2: { dayLimitMicroUsd: 10_000_000, weekBaseLimitMicroUsd: 50_000_000 },
  };
  const engine = createQuotaEngine({ store, tierLimits, costRegistry, now, storeTimeoutMs: 1000, leaseMs: 60_000,
    fingerprintKey: keyFixtures.FIXTURE_FINGERPRINT_KEY });
  const users = new Map();
  for (const identity of TEST_IDENTITIES.filter((item) => item.status)) {
    users.set(identity.id, { status: identity.status, tier: identity.tier });
    store.seed({ identitySubject: identity.id, status: identity.status, tier: identity.tier, expiresAt: null });
  }
  const records = new Map();
  const sessions = createSessionService({
    signingKey: randomBytes(32), lifetimeMs: 3_600_000, storeTimeoutMs: 1000, cookieName: COOKIE, now,
    audit() {},
    store: { create: async (record) => { records.set(record.sessionId, record); },
      get: async (id) => records.get(id) ?? null,
      revoke: async (id, at) => { const record = records.get(id); if (record) record.revokedAt = at; } },
  });
  const common = { sessions, origin, timeoutMs: 1000, now, audit() {} };
  const admins = new Set(TEST_IDENTITIES.filter((item) => item.admin).map((item) => item.id));
  const isAdmin = async (subject) => admins.has(subject);

  const audits = [], idempotency = new Map(), topUps = new Map();
  const reviews = [{ reviewId: 'review-test-pending', targetIdentitySubject: 'test-pending', kind: 'paid_access',
    createdAt: now().toISOString(), status: 'pending' }];
  const view = (subject) => ({ identitySubject: subject, displayName: subject, ...users.get(subject),
    tier: users.get(subject).status === 'approved' ? users.get(subject).tier : null });
  const windowOf = (w) => ({ limitEstimatedUsd: usd(w.limitEstimatedUsdMicro), usedEstimatedUsd: usd(w.usedEstimatedUsdMicro),
    reservedEstimatedUsd: usd(w.reservedEstimatedUsdMicro), remainingEstimatedUsd: usd(w.remainingEstimatedUsdMicro),
    resetAt: w.resetAt });
  const page = (items, offset, limit) => ({ items: items.slice(offset, offset + limit),
    nextOffset: offset + limit < items.length ? offset + limit : null });
  const adminStore = {
    async users(offset, limit) { return page([...users.keys()].map(view), offset, limit); },
    async detail(subject) {
      if (!users.has(subject)) return null;
      const result = await engine.getSnapshot({ identitySubject: subject });
      const day = result.ok ? windowOf(result.snapshot.day) : windowOf({ limitEstimatedUsdMicro: 0, usedEstimatedUsdMicro: 0,
        reservedEstimatedUsdMicro: 0, remainingEstimatedUsdMicro: 0, resetAt: now().toISOString() });
      const week = result.ok ? { ...windowOf(result.snapshot.week), windowKey: result.snapshot.week.windowKey,
        activeTopUpEstimatedUsd: usd(result.snapshot.week.cumulativeTopUpEstimatedUsdMicro) }
        : { ...day, windowKey: getWeekWindow(now()).windowKey, activeTopUpEstimatedUsd: '0.00' };
      return { ...view(subject), daily: day, weekly: week, endpointUsage: [],
        topUps: (topUps.get(subject) ?? []).map((t) => ({ topUpId: t.topUpId, amountEstimatedUsd: usd(t.amountMicroUsd),
          status: t.status, expiresAt: t.expiresAt })) };
    },
    async reviews(offset, limit) { return page(reviews.filter((r) => r.status === 'pending'), offset, limit); },
    async audits(offset, limit) { return page([...audits].reverse(), offset, limit); },
    async mutate(command) {
      if (!users.has(command.targetIdentitySubject)) return { outcome: 'not_found' };
      const prior = idempotency.get(command.idempotencyKey);
      const signature = JSON.stringify({ ...command, nowIso: undefined });
      if (prior) return prior.signature === signature ? { outcome: 'duplicate', auditId: prior.auditId } : { outcome: 'conflict' };
      const subject = command.targetIdentitySubject, before = { ...users.get(subject) };
      const auditId = `audit-${audits.length + 1}`;
      if (['approve', 'change_tier', 'reject', 'revoke'].includes(command.action)) {
        const status = { approve: 'approved', change_tier: 'approved', reject: 'rejected', revoke: 'revoked' }[command.action];
        const tier = command.tier ?? before.tier;
        users.set(subject, { status, tier });
        await store.setEligibility({ identitySubject: subject, status, tier, expiresAt: null, nowIso: command.nowIso });
        for (const review of reviews) if (review.targetIdentitySubject === subject) review.status = 'resolved';
      } else if (command.action === 'top_up') {
        const result = await engine.addWeeklyTopUp({ identitySubject: subject, adminSubject: command.adminSubject,
          idempotencyKey: command.idempotencyKey, amountMicroUsd: command.amountMicroUsd, reasonCode: command.reasonCode });
        if (!result.ok) return { outcome: result.status === 409 ? 'conflict' : 'invalid' };
        topUps.set(subject, [...(topUps.get(subject) ?? []), result.topUp]);
      } else {
        const result = await engine.revokeWeeklyTopUp({ identitySubject: subject, adminSubject: command.adminSubject,
          topUpId: command.topUpId });
        if (!result.ok) return { outcome: result.status === 404 ? 'not_found' : 'invalid' };
        topUps.set(subject, (topUps.get(subject) ?? []).map((t) => t.topUpId === command.topUpId ? result.topUp : t));
      }
      audits.push({ auditId, idempotencyKey: command.idempotencyKey, adminSubject: command.adminSubject,
        targetIdentitySubject: subject, action: command.action, createdAt: command.nowIso, reasonCode: command.reasonCode,
        before: { status: before.status, tier: before.tier }, after: { status: users.get(subject).status, tier: users.get(subject).tier } });
      idempotency.set(command.idempotencyKey, { signature, auditId });
      return { outcome: 'applied', auditId };
    },
  };
  const adminOptions = { ...common, isAdmin, store: adminStore };
  const readOverview = async () => {
    const counts = { pending: 0, approved: 0, rejected: 0, revoked: 0, expired: 0 };
    let day = 0, week = 0;
    for (const [subject, state] of users) {
      counts[state.status]++;
      const result = await engine.getSnapshot({ identitySubject: subject });
      if (result.ok) { day += result.snapshot.day.usedEstimatedUsdMicro; week += result.snapshot.week.usedEstimatedUsdMicro; }
    }
    return { approvalCounts: counts, estimatedUsage: { dailyUsedEstimatedUsd: usd(day), weeklyUsedEstimatedUsd: usd(week) },
      protectionAvailable: true };
  };
  const sessionApi = createSessionEndpoints(common);
  const self = createSelfServiceEndpoints({ ...common, engine });
  const routes = new Map([
    ['GET /api/auth/session', sessionApi.session], ['POST /api/auth/logout', sessionApi.logout],
    ['GET /api/me/quota', self.quota], ['GET /api/me/map-eligibility', self.mapEligibility],
    ['GET /api/admin/overview', overview.createHandler({ ...adminOptions, readOverview })],
    ['GET /api/admin/users', createAdminHandler('users', adminOptions)],
    ['GET /api/admin/review-queue', createAdminHandler('reviews', adminOptions)],
    ['GET /api/admin/audit', createAdminHandler('audits', adminOptions)],
    ['POST /api/admin/approvals', createAdminHandler('approvals', adminOptions)],
    ['POST /api/admin/top-ups', createAdminHandler('topups', adminOptions)],
  ]);
  const picker = () => `<!doctype html><meta charset="utf-8"><title>TEST_ONLY 登入</title>
<h1>TEST_ONLY 本機測試登入</h1><p>僅限本機記憶體測試身分；不是 Google／OIDC 正式登入，不呼叫任何外部服務。</p><ul>${
    TEST_IDENTITIES.map((item) => `<li><a href="/api/auth/login?as=${item.id}">${item.label}</a>（${item.id}）</li>`).join('')}</ul>`;
  const bareCookie = (value) => value.replace('; Secure', '');
  async function handle(request) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/auth/login') {
      const identity = TEST_IDENTITIES.find((item) => item.id === url.searchParams.get('as'));
      if (!identity) return new Response(picker(), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
      if (!identity.status) return new Response(null, { status: 302, headers: { location: origin + '/',
        'set-cookie': `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` } });
      return new Response(null, { status: 302, headers: { location: origin + '/',
        'set-cookie': bareCookie(await sessions.create(identity.id)) } });
    }
    const route = routes.get(`${request.method} ${url.pathname}`) ??
      (request.method === 'GET' && url.pathname.startsWith('/api/admin/users/')
        ? createAdminHandler('detail', adminOptions) : null);
    if (!route) return Response.json({ ok: false, code: 'TEST_ONLY_ROUTE_NOT_AVAILABLE' }, { status: 404 });
    const response = await route(request);
    const cookie = response.headers.get('set-cookie');
    if (!cookie) return response;
    const headers = new Headers(response.headers);
    headers.set('set-cookie', bareCookie(cookie));
    return new Response(response.body, { status: response.status, headers });
  }
  return { handle, identities: TEST_IDENTITIES };
}

export async function startTestOnlyServer(argv = process.argv.slice(2)) {
  const { port, origin } = parseTestOnlyArguments(argv);
  const api = await createTestOnlyApi({ origin });
  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks = [];
      for await (const chunk of incoming) chunks.push(chunk);
      const hasBody = !['GET', 'HEAD'].includes(incoming.method);
      const response = await api.handle(new Request(`http://127.0.0.1:${port}${incoming.url}`, {
        method: incoming.method, headers: incoming.headers, ...(hasBody ? { body: Buffer.concat(chunks) } : {}) }));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      outgoing.writeHead(503, { 'content-type': 'application/json' });
      outgoing.end('{"ok":false,"code":"TEST_ONLY_SERVER_ERROR"}');
    }
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  console.log(`TEST_ONLY API listening on http://127.0.0.1:${port} (origin ${origin})`);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startTestOnlyServer().catch((error) => {
    console.error(typeof error?.message === 'string' && /^TEST_ONLY_[A-Z_]+$/.test(error.message)
      ? error.message : 'TEST_ONLY_SERVER_START_FAILED');
    process.exitCode = 1;
  });
}
