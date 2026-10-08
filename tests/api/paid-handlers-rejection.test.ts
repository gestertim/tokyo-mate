// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import * as assistant from '../../api/assistant';
import * as places from '../../api/places';
import * as speech from '../../api/speech';
import * as transcribe from '../../api/transcribe';
import * as ocr from '../../api/photo-ocr';
import * as translate from '../../api/photo-translate';
import type { PaidBoundaryOptions } from '../../api/_lib/paid-endpoint-boundary';

const routes = [assistant, places, speech, transcribe, ocr, translate];
function options(): PaidBoundaryOptions {
  return {
    sessions: { lookup: async () => ({ kind: 'authenticated', subject: 'trusted-subject',
      expiresAt: Date.parse('2026-10-06T03:00:00.000Z'), revokedAt: null }) },
    engine: { getSnapshot: async () => ({ ok: false, status: 403, code: 'ACCESS_NOT_APPROVED', reason: 'revoked' }) },
    admission: { consume: async () => ({ kind: 'allowed' }) },
    ingress: () => ({ admissionKey: 'FIXTURE_TRANSPORT' }),
    cookieName: 'FIXTURE_SESSION', maxBytes: 1000, dependencyTimeoutMs: 20,
    now: () => new Date('2026-10-06T02:00:00.000Z'), audit: vi.fn(),
  };
}

describe('L3 六個真實 route handler 的拒絕接線（不含成功授權）', () => {
  it.each(routes.map((route, index) => [index, route] as const))('route %s 實际 POST 未配置503／錯誤method405，fetch零次',
    async (_index, route) => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('不得連外'));
      const logger = vi.spyOn(console, 'info').mockImplementation(() => {});
      try {
        const response = await route.POST(new Request('https://fixture.invalid/api', { method: 'POST', body: '{}' }));
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({ success: false,
          error: { code: 'PROTECTION_SERVICE_UNAVAILABLE' } });
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect((await route.POST(new Request('https://fixture.invalid/api'))).status).toBe(405);
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally { fetchSpy.mockRestore(); logger.mockRestore(); }
    });

  it.each(routes.map((route, index) => [index, route] as const))('route %s 的 factory 401／403／故障503，先於body讀取',
    async (_index, route) => {
      const deps = options();
      const handler = route.createHandler(deps);
      const noCookie = new Request('https://fixture.invalid/api', { method: 'POST', body: 'invalid' });
      const read = vi.spyOn(noCookie, 'json');
      expect((await handler(noCookie)).status).toBe(401);
      const request = () => new Request('https://fixture.invalid/api', { method: 'POST',
        headers: { cookie: 'FIXTURE_SESSION=opaque', 'x-forwarded-for': 'attacker' }, body: 'invalid' });
      const lookup = vi.spyOn(deps.sessions, 'lookup');
      expect((await handler(request())).status).toBe(403);
      expect(lookup).toHaveBeenCalledWith('opaque', deps.now());
      vi.spyOn(deps.engine, 'getSnapshot').mockRejectedValueOnce(new Error('FIXTURE_STORE_FAILURE'));
      expect((await handler(request())).status).toBe(503);
      expect(read).not.toHaveBeenCalled();
    });
});
