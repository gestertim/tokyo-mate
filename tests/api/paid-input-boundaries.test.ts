// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPaidEndpointBoundary } from '../../api/_lib/paid-endpoint-boundary';
import { readBoundedJson } from '../../api/_lib/bounded-request';
import { validateImageEnvelope, validatePaidJson } from '../../api/_lib/paid-input-validation';
import { INPUT_POLICY } from '../../api/_lib/local-protection-policy';
import { buildPcmWav } from '../../api/_lib/audio-pcm';
import { createProtectedPipelineFixture } from '../support/protected-pipeline-fixture';
import type { ProtectedEndpoint } from '../../api/_lib/cost-price-table';
afterEach(() => vi.useRealTimers());
const request = (body: unknown) => new Request('https://fixture.invalid/api', { method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: 'fixture-session=opaque-fixture' }, body: JSON.stringify(body) });
function fixture(endpoint: ProtectedEndpoint, imageWidth = 2048) {
  const f = createProtectedPipelineFixture();
  const verifyImage = vi.fn(async (): Promise<{ width: number; height: number } | null> =>
    ({ width: imageWidth, height: 1024 }));
  const handler = createPaidEndpointBoundary(endpoint, { sessions: f.sessions, engine: f.engine,
    admission: f.admission, rate: f.rate, ingress: () => f.context, cookieName: 'fixture-session',
    maxBytes: INPUT_POLICY.maxBytes[endpoint], dependencyTimeoutMs: 100,
    now: f.clock.now, audit: vi.fn(),
    images: { verify: verifyImage } });
  return { ...f, handler, verifyImage };
}
describe('D02 六HTTP拒絕boundary的已批准輸入驗證（無成功grant）', () => {
  it.each([
    { endpoint: 'assistant' as const, field: 'text', limit: 1000, body: { inputType: 'text', text: 'a' } },
    { endpoint: 'photo-translate' as const, field: 'sourceText', limit: 2000, body: { sourceText: 'a', targetLanguage: 'ja' } },
    { endpoint: 'speech' as const, field: 'text', limit: 500, body: { text: 'a', language: 'ja' } },
    { endpoint: 'places' as const, field: 'query', limit: 100, body: { location: { type: 'manual', manualArea: '東京' }, query: '' } },
  ])('$endpoint UTF-16上限與+1，額外欄位拒絕', async ({ endpoint, field, limit, body }) => {
    const f = fixture(endpoint);
    expect((await f.handler(request({ ...body, [field]: '字'.repeat(limit) }))).status).toBe(503);
    expect((await f.handler(request({ ...body, [field]: '字'.repeat(limit + 1) }))).status).toBe(400);
    expect((await f.handler(request({ ...body, extra: true }))).status).toBe(400);
    expect(f.spies.reserve).not.toHaveBeenCalled();
    expect(f.upstream.execute).not.toHaveBeenCalled();
  });
  it('manualArea 50／51、座標型別及nested額外欄位，不靜默轉數字', () => {
    expect(validatePaidJson('places', { location: { type: 'manual', manualArea: '字'.repeat(50) } })).toBe(true);
    expect(validatePaidJson('places', { location: { type: 'manual', manualArea: '字'.repeat(51) } })).toBe(false);
    expect(validatePaidJson('places', { location: { type: 'coordinates', coordinates: { latitude: '0', longitude: 0 } } })).toBe(false);
    expect(validatePaidJson('assistant', { text: 'a', inputType: 'text', context: { currentArea: '東京', role: 'admin' } })).toBe(false);
  });
  it('UTF-16非code point計數，surrogate pair兩units', () => {
    expect(validatePaidJson('assistant', { inputType: 'text', text: '😀'.repeat(500) })).toBe(true);
    expect(validatePaidJson('assistant', { inputType: 'text', text: '😀'.repeat(501) })).toBe(false);
  });
  it('authenticated rate拒絕帶可信Retry-After；資格仍先於rate', async () => {
    const f = fixture('places');
    f.rate.consume.mockResolvedValue({ kind: 'limited', retryAfterSeconds: 17 });
    const response = await f.handler(request({ location: { type: 'manual', manualArea: '東京' } }));
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('17');
    expect(await response.json()).toMatchObject({ error: { code: 'RATE_LIMITED', retryAfterSeconds: 17 } });
    f.rate.consume.mockClear();
    f.store.seed({ identitySubject: 'fixture-subject', status: 'revoked', tier: 'tier1', expiresAt: null });
    expect((await f.handler(request({}))).status).toBe(403);
    expect(f.rate.consume).not.toHaveBeenCalled();
  });
  it('PCM固定格式合法仍503未啟用，壞header／重複欄位拒絕', async () => {
    const f = fixture('transcribe');
    const make = (bytes: Uint8Array, duplicate = false) => {
      const form = new FormData();
      form.append('audio', new Blob([Uint8Array.from(bytes)], { type: 'audio/wav' }), 'recording.wav');
      if (duplicate) form.append('audio', new Blob([Uint8Array.from(bytes)], { type: 'audio/wav' }), 'other.wav');
      return new Request('https://fixture.invalid/api', { method: 'POST', headers: { Cookie: 'fixture-session=opaque-fixture' }, body: form });
    };
    const wav = buildPcmWav(new Uint8Array(32));
    expect((await f.handler(make(wav))).status).toBe(503);
    expect((await f.handler(make(wav, true))).status).toBe(400);
    wav[0] = 0;
    expect((await f.handler(make(wav))).status).toBe(400);
    expect(f.spies.reserve).not.toHaveBeenCalled();
  });
  it('D04可信後端尺寸2048／2049，不以合法base64當完整影像證明', async () => {
    const body = { imageDataUrl: `data:image/png;base64,${Buffer.from('TEST_ONLY').toString('base64')}`, regionVersion: 1 };
    expect((await fixture('photo-ocr', 2048).handler(request(body))).status).toBe(503);
    expect((await fixture('photo-ocr', 2049).handler(request(body))).status).toBe(413);
    const invalid = fixture('photo-ocr');
    invalid.verifyImage.mockResolvedValue(null);
    expect((await invalid.handler(request(body))).status).toBe(400);
    expect(invalid.spies.reserve).not.toHaveBeenCalled();
    expect(invalid.upstream.execute).not.toHaveBeenCalled();
  });
  it('影像版本／base64大小驗證，不信前端宣告尺寸', async () => {
    const f = fixture('photo-ocr');
    const imageDataUrl = `data:image/png;base64,${Buffer.from('TEST_ONLY_IMAGE').toString('base64')}`;
    expect((await f.handler(request({ imageDataUrl, regionVersion: 9999999999 }))).status).toBe(503);
    expect((await f.handler(request({ imageDataUrl, regionVersion: 10000000000 }))).status).toBe(400);
    expect((await f.handler(request({ imageDataUrl, regionVersion: 1, width: 1 }))).status).toBe(400);
    expect(f.spies.reserve).not.toHaveBeenCalled();
  });
  it('D04最壞JPEG包裝恰4194373B，3MiB+1上游前拒絕', () => {
    const imageDataUrl = `data:image/jpeg;base64,${Buffer.alloc(3145728).toString('base64')}`;
    expect(Buffer.byteLength(JSON.stringify({ imageDataUrl, regionVersion: 9999999999 }))).toBe(4194373);
    expect(validateImageEnvelope(imageDataUrl).bytes.length).toBe(3145728);
    expect(() => validateImageEnvelope(`data:image/jpeg;base64,${Buffer.alloc(3145729).toString('base64')}`))
      .toThrow('PAYLOAD_TOO_LARGE');
  });
});
describe('有界reader depth／nodes／UTF-8／timeout（上游前）', () => {
  const parse = (body: unknown) => readBoundedJson(request(body), { ...INPUT_POLICY, maxBytes: 16384 }, vi.fn());
  it('depth8／9與nodes256／257精確邊界', async () => {
    const nested = (depth: number): unknown => depth === 1 ? 1 : { next: nested(depth - 1) };
    await expect(parse(nested(8))).resolves.toBeDefined();
    await expect(parse(nested(9))).rejects.toThrow('INVALID_INPUT');
    await expect(parse(Array.from({ length: 255 }, () => 1))).resolves.toHaveLength(255);
    await expect(parse(Array.from({ length: 256 }, () => 1))).rejects.toThrow('INVALID_INPUT');
  });
  it('Content-Length缺失／偽造亦受累計bytes限制，非法UTF-8拒絕', async () => {
    const f = fixture('places');
    const req = new Request('https://fixture.invalid', { method: 'POST', headers: request({}).headers,
      body: ' '.repeat(2049) });
    expect(req.headers.has('content-length')).toBe(false);
    req.headers.set('content-length', '1');
    expect((await f.handler(req)).status).toBe(413);
    await expect(readBoundedJson(new Request('https://fixture.invalid', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: new Uint8Array([0xff]) }),
    { ...INPUT_POLICY, maxBytes: 16384 }, vi.fn())).rejects.toThrow('INVALID_INPUT');
  });
  it('5000ms reader deadline，cancel失敗明確audit、不等待取消', async () => {
    vi.useFakeTimers();
    const audit = vi.fn(), cancel = vi.fn().mockRejectedValue(new Error('TEST_ONLY_CANCEL'));
    const stream = new ReadableStream<Uint8Array>({ pull: () => new Promise(() => {}), cancel });
    const pending = readBoundedJson(new Request('https://fixture.invalid', { method: 'POST', duplex: 'half',
      headers: { 'Content-Type': 'application/json' }, body: stream } as RequestInit),
    { ...INPUT_POLICY, maxBytes: 16384 }, audit);
    const rejected = expect(pending).rejects.toThrow('INVALID_INPUT');
    await vi.advanceTimersByTimeAsync(4999);
    expect(cancel).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(audit).toHaveBeenCalledWith({ stage: 'reader', outcome: 'cancel_failed' });
  });
});
