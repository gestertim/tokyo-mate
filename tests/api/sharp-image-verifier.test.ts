// @vitest-environment node
import sharp from 'sharp';
import { crc32 } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { createSharpImageVerifier } from '../../api/_lib/sharp-image-verifier';
import { createLocalImageVerifier } from '../../api/_lib/local-protection-adapters';
import { createPaidEndpointBoundary } from '../../api/_lib/paid-endpoint-boundary';
import { createProtectedPipelineFixture } from '../support/protected-pipeline-fixture';

const verifier = createSharpImageVerifier({ timeoutMs: 2000 });
const image = (width = 2, height = 2) => sharp({ create: { width, height, channels: 4, background: '#123456' } });
function pngChunk(type: string, payload: Buffer) {
  const data = Buffer.concat([Buffer.from(type), payload]);
  const size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(payload.length); crc.writeUInt32BE(crc32(data));
  return Buffer.concat([size, data, crc]);
}

describe('D13 sharp 三格式可信完整解碼（無存檔／vision呼叫）', () => {
  it.each(['jpeg', 'png', 'webp'] as const)('%s 合法樣本取得實際尺寸', async (format) => {
    const bytes = await image().toFormat(format).toBuffer();
    expect(await verifier.verify(bytes, `image/${format}`)).toEqual({ width: 2, height: 2 });
  });
  it.each(['jpeg', 'png', 'webp'] as const)('%s 截斷與MIME偽裝拒絕', async (format) => {
    const bytes = await image(50, 50).toFormat(format).toBuffer();
    await expect(verifier.verify(bytes.subarray(0, Math.floor(bytes.length / 2)), `image/${format}`)).rejects.toThrow('INVALID_INPUT');
    await expect(verifier.verify(bytes, format === 'png' ? 'image/jpeg' : 'image/png')).rejects.toThrow('INVALID_INPUT');
  });
  it('metadata可讀但PNG像素損壞不能宣稱完整解碼；缺IEND同樣拒絕', async () => {
    const bytes = await image(32, 32).png().toBuffer();
    const corrupted = Buffer.from(bytes);
    const idat = corrupted.indexOf(Buffer.from('IDAT'));
    corrupted[idat + 8] ^= 255;
    expect((await sharp(corrupted).metadata()).width).toBe(32);
    await expect(verifier.verify(corrupted, 'image/png')).rejects.toThrow('INVALID_INPUT');
    await expect(verifier.verify(bytes.subarray(0, bytes.length - 12), 'image/png')).rejects.toThrow('INVALID_INPUT');
  });
  it('動畫WebP／APNG拒絕，不擷取第一頁當單頁', async () => {
    const frames = Buffer.concat([Buffer.alloc(2 * 2 * 4, 128), Buffer.alloc(2 * 2 * 4, 255)]);
    const webp = await sharp(frames,
      { raw: { width: 2, height: 4, channels: 4, pageHeight: 2 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
    expect((await sharp(webp).metadata()).pages).toBe(2);
    await expect(verifier.verify(webp, 'image/webp')).rejects.toThrow('INVALID_INPUT');
    const png = await image().png().toBuffer(), control = Buffer.alloc(8);
    control.writeUInt32BE(2);
    const apng = Buffer.concat([png.subarray(0, 33), pngChunk('acTL', control), png.subarray(33)]);
    await expect(verifier.verify(apng, 'image/png')).rejects.toThrow('INVALID_INPUT');
  });
  it('2047／2048合法；2049與像素炸彈拒絕', async () => {
    for (const width of [2047, 2048]) {
      expect(await verifier.verify(await image(width, 1).png().toBuffer(), 'image/png')).toEqual({ width, height: 1 });
    }
    await expect(verifier.verify(await image(2049, 1).png().toBuffer(), 'image/png')).rejects.toThrow('PAYLOAD_TOO_LARGE');
    await expect(verifier.verify(await image(2049, 2049).png().toBuffer(), 'image/png')).rejects.toThrow();
    expect(await verifier.verify(await image(2048, 2048).png().toBuffer(), 'image/png')).toEqual({ width: 2048, height: 2048 });
  });
  it('合法PNG精確3MiB−1／3MiB；+1先拒絕', async () => {
    const png = await image().png().toBuffer();
    for (const length of [3145727, 3145728, 3145729]) {
      const payload = Buffer.alloc(length - png.length - 12, 65);
      payload[1] = 0;
      const padded = Buffer.concat([png.subarray(0, png.length - 12), pngChunk('tEXt', payload), png.subarray(png.length - 12)]);
      expect(padded.length).toBe(length);
      if (length <= 3145728) expect(await verifier.verify(padded, 'image/png')).toEqual({ width: 2, height: 2 });
      else await expect(verifier.verify(padded, 'image/png')).rejects.toThrow('PAYLOAD_TOO_LARGE');
    }
  });
  it('空／未知格式／缺timeout設定fail closed', async () => {
    await expect(verifier.verify(new Uint8Array(), 'image/png')).rejects.toThrow('INVALID_INPUT');
    await expect(verifier.verify(await image().gif().toBuffer(), 'image/gif')).rejects.toThrow('INVALID_INPUT');
    for (const timeoutMs of [0, -1, NaN]) expect(() => createSharpImageVerifier({ timeoutMs })).toThrow(TypeError);
  });
  it('既有HTTP images.verify seam實接decoder，合法仍503且零reserve／零vision', async () => {
    const f = createProtectedPipelineFixture();
    const audit = vi.fn();
    const handler = createPaidEndpointBoundary('photo-ocr', { sessions: f.sessions, engine: f.engine,
      admission: f.admission, rate: f.rate, ingress: () => f.context, cookieName: 'fixture-session',
      maxBytes: 4200000, dependencyTimeoutMs: 2000, now: f.clock.now, audit, images: createLocalImageVerifier() });
    const bytes = await image().png().toBuffer();
    const request = (data: Buffer) => new Request('https://fixture.invalid/api/photo-ocr', { method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'fixture-session=opaque-fixture' },
      body: JSON.stringify({ imageDataUrl: `data:image/png;base64,${data.toString('base64')}`, regionVersion: 1 }) });
    expect((await handler(request(bytes))).status).toBe(503);
    expect((await handler(request(Buffer.from('not-an-image')))).status).toBe(400);
    expect(audit).toHaveBeenCalledWith({ endpoint: 'photo-ocr', outcome: 'INVALID_INPUT' });
    expect(f.spies.reserve).not.toHaveBeenCalled();
    expect(f.upstream.execute).not.toHaveBeenCalled();
  });
});
