// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROTECTED_ENDPOINTS } from '../../api/_lib/cost-price-table';
import { createProtectedPipelineFixture } from '../support/protected-pipeline-fixture';

afterEach(() => vi.useRealTimers());
const codeOf = async (response: Response) => (await response.json()).error.code;
describe('入口契約補充與輸出最小化', () => {
  it.each(PROTECTED_ENDPOINTS)('P04/P09 %s 未登入及非Places成功路徑不放行', async (endpoint) => {
    const f = createProtectedPipelineFixture({ endpoint });
    expect((await f.execute(f.request({ query: '東京' }, 'k', { Cookie: '' }))).status).toBe(401);
    if (endpoint !== 'places') {
      expect((await f.execute()).status).toBe(503);
      expect(f.upstream.execute).not.toHaveBeenCalled();
      expect(f.spies.reserve).not.toHaveBeenCalled();
    }
  });
  it.each(['missing', 'expiry'] as const)('P05 %s 資格拒絕', async (kind) => {
    const f = createProtectedPipelineFixture();
    if (kind === 'missing') f.sessions.lookup.mockResolvedValue({ kind: 'authenticated', subject: 'unknown-subject',
      expiresAt: f.clock.now().getTime() + 1_000, revokedAt: null });
    else f.store.seed({ identitySubject: 'fixture-subject', status: 'approved', tier: 'tier1', expiresAt: f.clock.now().toISOString() });
    expect((await f.execute()).status).toBe(403);
    expect(f.spies.getReservation).not.toHaveBeenCalled();
  });
  it('P06 無效Session／quota shape明確503而非預設放行', async () => {
    const f = createProtectedPipelineFixture();
    f.sessions.lookup.mockResolvedValueOnce({ kind: 'authenticated', subject: '', expiresAt: NaN, revokedAt: null });
    expect((await f.execute()).status).toBe(503);
    const original = f.spies.readQuota.getMockImplementation()!;
    f.spies.readQuota.mockImplementationOnce(async (...args) => {
      const result = await original(...args);
      if (result.status === 'ok') result.usage.day.reservedMicroUsd = -1;
      return result;
    });
    expect((await f.execute()).status).toBe(503);
    expect(f.upstream.execute).not.toHaveBeenCalled();
  });
  it.each(['session', 'admission', 'rate', 'cost'] as const)('P06 %s deadline明確503', async (name) => {
    vi.useFakeTimers();
    const f = createProtectedPipelineFixture();
    if (name === 'session') f.sessions.lookup.mockImplementation(() => new Promise(() => {}));
    if (name === 'admission') f.admission.consume.mockImplementation(() => new Promise(() => {}));
    if (name === 'rate') f.rate.consume.mockImplementation(() => new Promise(() => {}));
    if (name === 'cost') f.cost.resolve.mockImplementation(() => new Promise(() => {}));
    const pending = f.execute();
    await vi.advanceTimersByTimeAsync(101);
    expect((await pending).status).toBe(503);
    expect(f.spies.reserve).not.toHaveBeenCalled();
    expect(f.upstream.execute).not.toHaveBeenCalled();
  });
  it.each([{}, { query: '' }, { query: 'x'.repeat(65) }])('P08 schema／文字上限拒絕不占額 %j', async (body) => {
    const f = createProtectedPipelineFixture();
    expect([400, 413]).toContain((await f.execute(f.request(body))).status);
    expect(f.spies.reserve).not.toHaveBeenCalled();
    expect(f.spies.settle).not.toHaveBeenCalled();
  });
  it('P02 多chunk累計UTF-8 bytes、不接受其他Content-Type', async () => {
    const f = createProtectedPipelineFixture();
    const cancel = vi.fn();
    const req = new Request('https://fixture.invalid', { method: 'POST', duplex: 'half',
      headers: f.request().headers, body: new ReadableStream({ start(c) {
        c.enqueue(new Uint8Array(150)); c.enqueue(new Uint8Array(150));
      }, cancel }) } as RequestInit);
    expect((await f.execute(req)).status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect((await f.execute(f.request({}, 'k', { 'Content-Type': 'text/plain' }))).status).toBe(400);
    expect(f.spies.reserve).not.toHaveBeenCalled();
  });
  it('P19 無效clock與共用Date倒退均拒絕；不以Date參照放行', async () => {
    const f = createProtectedPipelineFixture();
    f.deps.now = () => new Date(NaN);
    expect((await f.execute()).status).toBe(503);
    const other = createProtectedPipelineFixture();
    const date = other.clock.now();
    other.policy.deriveEstimateInputs = () => {
      let calls = 0;
      other.clock.now = () => { if (++calls === 2) date.setTime(date.getTime() - 1); return date; };
      return {};
    };
    expect((await other.execute()).status).toBe(503);
    expect(other.spies.reserve).not.toHaveBeenCalled();
  });
  it('P22 跨拒絕路徑 no-store／public allowlist，不含私人資料', async () => {
    for (const mode of ['method', 'auth', 'input', 'cost', 'rate'] as const) {
      const f = createProtectedPipelineFixture();
      if (mode === 'cost') f.cost.resolve.mockRejectedValue(new Error('private-cookie-HMAC-version'));
      if (mode === 'rate') f.rate.consume.mockResolvedValue({ kind: 'limited' });
      const req = mode === 'method' ? new Request('https://fixture.invalid')
        : f.request(mode === 'input' ? {} : { query: '私人位置內容' }, 'k', mode === 'auth' ? { Cookie: '' } : {});
      const response = await f.execute(req);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(Object.keys(body.error).sort()).toEqual(['actionableStep', 'code', 'userMessage', 'userTitle']);
      expect(JSON.stringify(body)).not.toMatch(/私人位置內容|private-cookie|opaque-fixture|fixture-subject|FIXTURE_ALL_LIVE/);
    }
  });
});
describe('隔離入口與有界解析', () => {
  it.each(PROTECTED_ENDPOINTS)('P01 %s 共用拒絕不讀取 Session／store／上游', async (endpoint) => {
    const f = createProtectedPipelineFixture({ endpoint });
    const response = await f.execute(new Request('https://fixture.invalid', { method: 'GET' }));
    expect(response.status).toBe(405);
    expect(await codeOf(response)).toBe('METHOD_NOT_ALLOWED');
    expect(f.sessions.lookup).not.toHaveBeenCalled();
    expect(f.spies.readQuota).not.toHaveBeenCalled();
    expect(f.upstream.execute).not.toHaveBeenCalled();
    expect((await f.execute(f.request({}, 'k', { 'Content-Length': '999' }))).status).toBe(413);
  });

  describe('原子 grant、單次 mock 與保守結算', () => {
    it('P14 首次 Places 僅執行一次，完整順序與原窗口入帳', async () => {
      const f = createProtectedPipelineFixture();
      const response = await f.execute();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, data: { places: ['FIXTURE_PLACE'] } });
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(f.order).toEqual(['admission', 'session', 'rate', 'validate', 'cost', 'upstream']);
      expect(f.spies.reserve).toHaveBeenCalledOnce();
      expect(f.spies.settle).toHaveBeenCalledOnce();
      const state = await f.engine.getSnapshot({ identitySubject: 'fixture-subject' });
      expect(state.ok && state.snapshot.day.usedEstimatedUsdMicro).toBe(40_000);
      expect(state.ok && state.snapshot.week.reservedEstimatedUsdMicro).toBe(0);
      expect(f.store.dumpState()).not.toContain('東京車站');
      expect(JSON.stringify(f.spies.audit.mock.calls)).not.toContain('東京車站');
    });
    it('P14 同鍵並發 N 次僅一個有效 grant／上游呼叫', async () => {
      const f = createProtectedPipelineFixture();
      const responses = await Promise.all(Array.from({ length: 8 }, () => f.execute()));
      expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
      expect(responses.filter((r) => r.status === 409)).toHaveLength(7);
      expect(f.upstream.execute).toHaveBeenCalledOnce();
    });
    it('P14 不同鍵競爭，used＋reserved不超額', async () => {
      const f = createProtectedPipelineFixture({ day: 50_000 });
      const responses = await Promise.all(Array.from({ length: 8 }, (_, n) => f.execute(f.request({ query: '東京' }, `k-${n}`))));
      expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
      expect(f.upstream.execute).toHaveBeenCalledOnce();
      const state = await f.engine.getSnapshot({ identitySubject: 'fixture-subject' });
      expect(state.ok && state.snapshot.day.usedEstimatedUsdMicro + state.snapshot.day.reservedEstimatedUsdMicro).toBeLessThanOrEqual(50_000);
    });
    it.each(['success', 'explicit_unbilled_failure', 'uncertain'] as const)('P13/P16 %s 結算後重送409', async (kind) => {
      const f = createProtectedPipelineFixture();
      if (kind !== 'success') f.upstream.execute.mockResolvedValue({ kind });
      const initial = await f.execute();
      expect(initial.status).toBe(kind === 'success' ? 200 : 503);
      const replay = await f.execute();
      expect(await codeOf(replay)).toBe('DUPLICATE_REQUEST');
      expect(f.upstream.execute).toHaveBeenCalledOnce();
      const conflict = await f.execute(f.request({ query: '不同內容' }));
      expect(await codeOf(conflict)).toBe('IDEMPOTENCY_CONFLICT');
      const state = await f.engine.getSnapshot({ identitySubject: 'fixture-subject' });
      expect(state.ok && state.snapshot.day.reservedEstimatedUsdMicro).toBe(kind === 'uncertain' ? 50_000 : 0);
      expect(state.ok && state.snapshot.day.usedEstimatedUsdMicro).toBe(kind === 'success' ? 40_000 : 0);
    });
    it('P13 reserved、跨期重送仍409，撤銷後403不查原預留', async () => {
      const f = createProtectedPipelineFixture();
      let finish!: (value: { kind: 'uncertain' }) => void;
      f.upstream.execute.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
      const original = f.execute();
      await vi.waitFor(() => expect(f.upstream.execute).toHaveBeenCalledOnce());
      expect((await f.execute()).status).toBe(409);
      finish({ kind: 'uncertain' });
      await original;
      f.clock.advance(8 * 86_400_000);
      expect((await f.execute()).status).toBe(409);
      f.store.seed({ identitySubject: 'fixture-subject', status: 'revoked', tier: 'tier1', expiresAt: null });
      f.spies.getReservation.mockClear();
      expect((await f.execute()).status).toBe(403);
      expect(f.spies.getReservation).not.toHaveBeenCalled();
    });
    it.each(['revoke', 'downgrade'] as const)('P15 %s 在原子 reserve 前生效', async (change) => {
      const f = createProtectedPipelineFixture({ day: 49_999 });
      if (change === 'downgrade') f.store.seed({ identitySubject: 'fixture-subject', status: 'approved', tier: 'tier2', expiresAt: null });
      const original = f.spies.reserve.getMockImplementation()!;
      f.spies.reserve.mockImplementationOnce(async (command) => {
        f.store.seed({ identitySubject: 'fixture-subject', status: change === 'revoke' ? 'revoked' : 'approved', tier: 'tier1', expiresAt: null });
        return original.call(f.store, command);
      });
      expect((await f.execute()).status).toBe(change === 'revoke' ? 403 : 429);
      expect(f.upstream.execute).not.toHaveBeenCalled();
    });
    it.each(['reject', 'deadline', 'disconnect'] as const)('P17 %s uncertain，不重送；晚到只稽核', async (mode) => {
      vi.useFakeTimers();
      const f = createProtectedPipelineFixture();
      let finish!: (value: { kind: 'success'; data: { places: string[] } }) => void;
      if (mode === 'deadline') f.upstream.execute.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
      else f.upstream.execute.mockRejectedValue(new Error(mode));
      const pending = f.execute();
      await vi.advanceTimersByTimeAsync(201);
      const response = await pending;
      expect(response.status).toBe(503);
      expect(await codeOf(response)).toBe('PLACES_SERVICE_UNAVAILABLE');
      if (mode === 'deadline') {
        finish({ kind: 'success', data: { places: ['late-private'] } });
        await vi.advanceTimersByTimeAsync(1);
        expect(f.spies.audit).toHaveBeenCalledWith({ stage: 'upstream', outcome: 'late_observation' });
      }
      expect(f.spies.settle).toHaveBeenCalledOnce();
      expect(f.spies.settle.mock.calls[0][0].transition).toBe('uncertain');
      expect(f.upstream.execute).toHaveBeenCalledOnce();
      const state = await f.engine.getSnapshot({ identitySubject: 'fixture-subject' });
      expect(state.ok && state.snapshot.day.reservedEstimatedUsdMicro).toBe(50_000);
    });
    it('P18 超額完整入帳及雙封鎖，原 API503，無成功資料', async () => {
      const f = createProtectedPipelineFixture();
      f.upstream.execute.mockResolvedValue({ kind: 'success', data: { places: ['must-not-leak'] }, settlementEstimateMicroUsd: 50_001 });
      const response = await f.execute();
      expect(response.status).toBe(503);
      expect(await codeOf(response)).toBe('PROTECTION_SERVICE_UNAVAILABLE');
      expect(f.store.isCostModelBlocked(f.pinned.table.version)).toBe(true);
      const state = await f.engine.getSnapshot({ identitySubject: 'fixture-subject' });
      expect(state.ok && state.snapshot.day.usedEstimatedUsdMicro).toBe(50_001);
      await f.execute();
      expect(f.upstream.execute).toHaveBeenCalledOnce();
    });
    it.each([0, 1_000, 1_001])('P19 grant 時間 %s 拒絕到期；有效首次放行', async (delta) => {
      const f = createProtectedPipelineFixture();
      const original = f.spies.reserve.getMockImplementation()!;
      f.spies.reserve.mockImplementationOnce(async (command) => {
        const result = await original.call(f.store, command);
        f.clock.advance(delta);
        return result;
      });
      expect((await f.execute()).status).toBe(delta === 0 ? 200 : 503);
      expect(f.upstream.execute).toHaveBeenCalledTimes(delta === 0 ? 1 : 0);
      expect(f.spies.settle).toHaveBeenCalledTimes(delta === 0 ? 1 : 0);
    });
    it('P19 estimation→command 倒退時不進 store.reserve', async () => {
      const f = createProtectedPipelineFixture();
      const ms = f.clock.now().getTime();
      f.policy.deriveEstimateInputs = () => {
        f.clock.now = vi.fn().mockReturnValueOnce(new Date(ms)).mockReturnValue(new Date(ms - 1));
        return {};
      };
      expect((await f.execute()).status).toBe(503);
      expect(f.spies.reserve).not.toHaveBeenCalled();
    });
    it.each(['identity', 'usage', 'lease', 'fingerprint'] as const)('P20 reserve %s 矛盾503不拼佐證', async (field) => {
      const f = createProtectedPipelineFixture();
      const original = f.spies.reserve.getMockImplementation()!;
      f.spies.reserve.mockImplementationOnce(async (command) => {
        const result = await original.call(f.store, command);
        if (result.status === 'reserved') {
          if (field === 'identity') result.reservation.identitySubject = 'other';
          if (field === 'usage') result.usage.day.reservedMicroUsd = 0;
          if (field === 'lease') result.reservation.leaseExpiresAt = result.reservation.createdAt;
          if (field === 'fingerprint') result.reservation.requestFingerprint = '0'.repeat(64);
        }
        return result;
      });
      expect((await f.execute()).status).toBe(503);
      expect(f.upstream.execute).not.toHaveBeenCalled();
      expect(f.spies.getReservation).not.toHaveBeenCalled();
      expect(f.spies.settle).not.toHaveBeenCalled();
    });
    it.each(['identity', 'usage', 'version-block', 'digest-block'] as const)('P20 settle %s 矛盾不回成功', async (field) => {
      const f = createProtectedPipelineFixture();
      if (field.endsWith('block')) f.upstream.execute.mockResolvedValue({ kind: 'success', data: { places: [] }, settlementEstimateMicroUsd: 50_001 });
      const original = f.spies.settle.getMockImplementation()!;
      f.spies.settle.mockImplementationOnce(async (command) => {
        const result = await original.call(f.store, command);
        if (result.status === 'applied') {
          if (field === 'identity') result.identitySubject = 'other';
          if (field === 'usage') result.usage.week.usedMicroUsd = 0;
          if (field === 'version-block') delete result.blockedCostModelVersion;
          if (field === 'digest-block') delete result.blockedCostParametersDigest;
        }
        return result;
      });
      expect((await f.execute()).status).toBe(503);
      expect(f.upstream.execute).toHaveBeenCalledOnce();
      expect(f.spies.settle).toHaveBeenCalledOnce();
      expect(f.spies.getReservation).toHaveBeenCalledOnce();
    });
    it.each(['reserve', 'settle'] as const)('P21 %s timeout 含已寫入，不retry／refund', async (operation) => {
      vi.useFakeTimers();
      const f = createProtectedPipelineFixture();
      if (operation === 'reserve') {
        const original = f.spies.reserve.getMockImplementation()!;
        f.spies.reserve.mockImplementationOnce(async (command) => {
          await original.call(f.store, command);
          return new Promise(() => {});
        });
      } else {
        const original = f.spies.settle.getMockImplementation()!;
        f.spies.settle.mockImplementationOnce(async (command) => {
          await original.call(f.store, command);
          return new Promise(() => {});
        });
      }
      const pending = f.execute();
      await vi.advanceTimersByTimeAsync(101);
      expect((await pending).status).toBe(503);
      expect(f.spies.reserve).toHaveBeenCalledOnce();
      expect(f.spies.settle).toHaveBeenCalledTimes(operation === 'reserve' ? 0 : 1);
      expect(f.upstream.execute).toHaveBeenCalledTimes(operation === 'reserve' ? 0 : 1);
      const state = await f.engine.getSnapshot({ identitySubject: 'fixture-subject' });
      expect(state.ok && state.snapshot.day[operation === 'reserve' ? 'reservedEstimatedUsdMicro' : 'usedEstimatedUsdMicro'])
        .toBe(operation === 'reserve' ? 50_000 : 40_000);
    });
    it('P21 執行後 lease 過期結算503，原窗口轉 uncertain', async () => {
      const f = createProtectedPipelineFixture();
      f.upstream.execute.mockImplementation(async () => {
        f.clock.advance(1_001);
        return { kind: 'success', data: { places: [] } };
      });
      expect((await f.execute()).status).toBe(503);
      expect(f.store.dumpState()).toContain('"status":"uncertain"');
      expect(f.spies.settle).toHaveBeenCalledOnce();
    });
  });
  it.each(['-1', 'abc', '1.5'])('P01 非法 length %s', async (length) => {
    const f = createProtectedPipelineFixture();
    expect((await f.execute(f.request({}, 'k', { 'Content-Length': length }))).status).toBe(400);
    expect(f.sessions.lookup).not.toHaveBeenCalled();
  });
  it('P02 缺／低報 length 仍限制實際 bytes，取消 reader', async () => {
    for (const length of [undefined, '1']) {
      const f = createProtectedPipelineFixture();
      const cancel = vi.fn();
      const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(257)); }, cancel });
      const req = new Request('https://fixture.invalid', { method: 'POST', body: stream,
        duplex: 'half', headers: { Cookie: 'fixture-session=x', 'Content-Type': 'application/json',
          'Idempotency-Key': 'k', ...(length ? { 'Content-Length': length } : {}) } } as RequestInit);
      expect((await f.execute(req)).status).toBe(413);
      expect(cancel).toHaveBeenCalledOnce();
      expect(f.spies.reserve).not.toHaveBeenCalled();
      expect(f.spies.settle).not.toHaveBeenCalled();
    }
  });
  it.each(['{', '{"a":{"b":{"c":{"d":{"e":1}}}}}', JSON.stringify(Array.from({ length: 33 }, () => 0))])
    ('P02 malformed／depth／nodes %s', async (body) => {
      const f = createProtectedPipelineFixture();
      const req = f.request(); const bad = new Request(req.url, { method: 'POST', headers: req.headers, body });
      expect((await f.execute(bad)).status).toBe(400);
      expect(f.spies.reserve).not.toHaveBeenCalled();
    });
  it('P02 reader deadline 不占額，取消 reader', async () => {
    vi.useFakeTimers();
    const f = createProtectedPipelineFixture();
    const cancel = vi.fn();
    const req = new Request('https://fixture.invalid', { method: 'POST', body: new ReadableStream({ cancel }),
      duplex: 'half', headers: f.request().headers } as RequestInit);
    const pending = f.execute(req);
    await vi.advanceTimersByTimeAsync(101);
    expect((await pending).status).toBe(400);
    expect(cancel).toHaveBeenCalledOnce();
    expect(f.spies.reserve).not.toHaveBeenCalled();
  });
  it('P03 admission 使用可信 key，入口拒絕不查 Session／reservation', async () => {
    const f = createProtectedPipelineFixture();
    f.admission.consume.mockResolvedValue({ kind: 'limited', retryAfterSeconds: 7 });
    const response = await f.execute(f.request({}, 'k', { 'X-Forwarded-For': 'forged', Forwarded: 'for=forged' }));
    expect(response.status).toBe(429);
    expect(f.admission.consume).toHaveBeenCalledWith('fixture-ingress', 'places', expect.any(Date));
    expect(f.sessions.lookup).not.toHaveBeenCalled();
    expect(f.spies.getReservation).not.toHaveBeenCalled();
  });
  it.each(['unknown', 'expired', 'revoked', 'missing'])('P04 %s Session', async (kind) => {
    const f = createProtectedPipelineFixture();
    if (kind === 'unknown') f.sessions.lookup.mockResolvedValue({ kind: 'unauthenticated' });
    if (kind === 'expired') f.sessions.lookup.mockResolvedValue({ kind: 'authenticated', subject: 'fixture-subject', expiresAt: 0, revokedAt: null });
    if (kind === 'revoked') f.sessions.lookup.mockResolvedValue({ kind: 'authenticated', subject: 'fixture-subject', expiresAt: Date.now(), revokedAt: 1 });
    expect((await f.execute(f.request({}, 'k', kind === 'missing' ? { Cookie: '' } : {}))).status).toBe(401);
    expect(f.spies.readQuota).not.toHaveBeenCalled();
    expect(f.spies.getReservation).not.toHaveBeenCalled();
  });
  it.each(['pending', 'rejected', 'revoked', 'expired'] as const)('P05 %s 資格優先', async (status) => {
    const f = createProtectedPipelineFixture();
    f.store.seed({ identitySubject: 'fixture-subject', status, tier: 'tier1', expiresAt: null });
    const response = await f.execute();
    expect(response.status).toBe(403);
    expect(await codeOf(response)).toBe('ACCESS_NOT_APPROVED');
    expect(f.cost.resolve).not.toHaveBeenCalled();
    expect(f.spies.getReservation).not.toHaveBeenCalled();
  });
  it.each(['session', 'admission', 'rate', 'quota'])('P06 %s 故障統一503', async (which) => {
    const f = createProtectedPipelineFixture();
    const error = new Error('private-secret');
    if (which === 'session') f.sessions.lookup.mockRejectedValue(error);
    if (which === 'admission') f.admission.consume.mockRejectedValue(error);
    if (which === 'rate') f.rate.consume.mockRejectedValue(error);
    if (which === 'quota') f.spies.readQuota.mockRejectedValue(error);
    const response = await f.execute();
    expect(response.status).toBe(503);
    expect(await codeOf(response)).toBe('PROTECTION_SERVICE_UNAVAILABLE');
    expect(f.spies.reserve).not.toHaveBeenCalled();
    expect(f.upstream.execute).not.toHaveBeenCalled();
  });
  it('P07 subject rate 與入口分開，可靠 Retry-After', async () => {
    const f = createProtectedPipelineFixture();
    f.rate.consume.mockResolvedValue({ kind: 'limited', retryAfterSeconds: 5 });
    const response = await f.execute();
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('5');
    expect((await response.json()).error.retryAfterSeconds).toBe(5);
    expect(f.rate.consume).toHaveBeenCalledWith('fixture-subject', 'places', expect.any(Date));
    expect(f.spies.reserve).not.toHaveBeenCalled();
  });
  it.each(['identitySubject', 'tier', 'estimateInputs', 'amount', 'model', 'version', 'attempts', 'digest'])
    ('P08 拒絕 body 權威欄位 %s', async (field) => {
      const f = createProtectedPipelineFixture();
      expect((await f.execute(f.request({ query: '東京', [field]: 'forged' }))).status).toBe(400);
      expect(f.spies.reserve).not.toHaveBeenCalled();
      expect(f.cost.resolve).not.toHaveBeenCalled();
    });
});
