// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createLocalProtectionStores, createLocalSessionService, localOidcConfig } from '../../api/_lib/local-protection-adapters';
import type { SessionRecord } from '../../api/_lib/session';
import { luaAvailable, runLuaRedis, type LuaInvocation } from '../support/lua-redis-harness';
const at = '2026-10-07T01:00:00.000Z';
describe('D06 核准期限的本機接線（不組裝正式auth）', () => {
  it('24小時絕對期限、期限±1、lookup無滑動續期；state300秒', async () => {
    let clock = Date.parse(at);
    const records = new Map<string, SessionRecord>();
    const store = { create: async (r: SessionRecord) => { records.set(r.sessionId, r); },
      get: async (id: string) => records.get(id) ?? null, revoke: async (id: string) => {
        const r = records.get(id); if (r) r.revokedAt = new Date(clock).toISOString();
      } };
    const service = createLocalSessionService({ store, signingKey: new Uint8Array(32).fill(1), cookieName: 'TEST_SESSION',
      now: () => new Date(clock), audit: vi.fn() });
    const cookie = await service.create('TEST_ONLY_SUBJECT');
    const token = cookie.split(';')[0].split('=')[1];
    const original = structuredClone([...records.values()][0]);
    expect(cookie).toContain('Max-Age=86400');
    expect(Date.parse(original.expiresAt) - Date.parse(original.createdAt)).toBe(86400000);
    clock += 86400000 - 1;
    expect(await service.lookup(token, new Date(clock))).toMatchObject({ kind: 'authenticated' });
    expect([...records.values()][0]).toEqual(original);
    clock++;
    expect(await service.lookup(token, new Date(clock))).toEqual({ kind: 'unauthenticated' });
    clock++;
    expect(await service.lookup(token, new Date(clock))).toEqual({ kind: 'unauthenticated' });
    expect(localOidcConfig({ issuer: 'https://accounts.google.com', clientId: 'TEST_ONLY',
      origin: 'https://fixture.invalid', callbackUrl: 'https://fixture.invalid/api/auth/callback', stateCookieName: 'TEST_STATE' }))
      .toMatchObject({ stateLifetimeMs: 300000, timeoutMs: 2000 });
  });
});
describe.skipIf(!luaAvailable)('D06 Session清除期限及撤銷（Lua替身非真實Redis）', () => {
  it('expiresAt＋24h前一毫秒保留、等值清除，重跑不延長撤銷紀錄', async () => {
    let clock = at;
    const history: LuaInvocation[] = [];
    const transport = { eval: vi.fn(async (script: string, keys: readonly string[], json: string) => {
      history.push({ script, keys, command: JSON.parse(json), now: clock });
      return JSON.stringify(runLuaRedis(history).at(-1));
    }) };
    const stores = createLocalProtectionStores({ namespace: '{LOCAL_IDENTITY_TEST}', transport, audit: vi.fn(),
      rateHmacKey: new Uint8Array(32).fill(2) });
    const session = createLocalSessionService({ store: stores.sessions, signingKey: new Uint8Array(32).fill(1),
      cookieName: 'TEST_SESSION', now: () => new Date(clock), audit: vi.fn() });
    const cookie = await session.create('TEST_ONLY_USER'), value = cookie.split(';')[0].split('=')[1];
    await session.logout(value);
    expect(await session.lookup(value, new Date(clock))).toEqual({ kind: 'unauthenticated' });
    const id = value.split('.')[0], original = await stores.sessions.get(id);
    clock = new Date(Date.parse(at) + 2 * 86400000 - 1).toISOString();
    expect(await stores.cleanupExpiredSessions({ cursor: '0', batchSize: 1 })).toEqual({ cursor: '0', removed: 0 });
    expect(await stores.sessions.get(id)).toEqual(original);
    clock = new Date(Date.parse(at) + 2 * 86400000).toISOString();
    expect(await stores.cleanupExpiredSessions({ cursor: '0', batchSize: 1 })).toEqual({ cursor: '0', removed: 1 });
    expect(await stores.cleanupExpiredSessions({ cursor: '0', batchSize: 1 })).toEqual({ cursor: '0', removed: 0 });
    expect(await stores.sessions.get(id)).toBeNull();
  });
});
