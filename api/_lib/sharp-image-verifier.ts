import sharp from 'sharp';
import { RequestBoundaryError } from './bounded-request';
import type { PaidImageVerifier } from './paid-endpoint-boundary';

const formats: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp',
};

function validatePngStructure(bytes: Buffer) {
  let offset = 8;
  let ended = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    if (length > bytes.length - offset - 12) throw new RequestBoundaryError('INVALID_INPUT');
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'acTL' || type === 'fcTL' || type === 'fdAT') throw new RequestBoundaryError('INVALID_INPUT');
    offset += length + 12;
    if (type === 'IEND') {
      ended = length === 0 && offset === bytes.length;
      break;
    }
  }
  if (!ended) throw new RequestBoundaryError('INVALID_INPUT');
}

export function createSharpImageVerifier(options: { timeoutMs: number }): PaidImageVerifier {
  if (!options || !Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0)
    throw new TypeError('影像 decoder 需要明確正值 timeoutMs');
  return {
    async verify(input, mime) {
      if (!(input instanceof Uint8Array) || !input.length || !formats[mime])
        throw new RequestBoundaryError('INVALID_INPUT');
      if (input.length > 3145728) throw new RequestBoundaryError('PAYLOAD_TOO_LARGE');
      const bytes = Buffer.from(input);
      const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 2048 * 2048,
        sequentialRead: true, unlimited: false, pages: 1 }).timeout({ seconds: Math.ceil(options.timeoutMs / 1000) });
      try {
        const metadata = await image.metadata();
        if (metadata.format !== formats[mime] || (metadata.pages ?? 1) !== 1 ||
            !metadata.width || !metadata.height) throw new RequestBoundaryError('INVALID_INPUT');
        if (Math.max(metadata.width, metadata.height) > 2048) throw new RequestBoundaryError('PAYLOAD_TOO_LARGE');
        if (metadata.format === 'png') validatePngStructure(bytes);
        // raw 強制走完像素解碼；metadata 與 header 不構成完整驗證。
        const decoded = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        if (decoded.info.width !== metadata.width || decoded.info.height !== metadata.height ||
            decoded.info.channels !== 4 || decoded.data.length !== metadata.width * metadata.height * 4)
          throw new RequestBoundaryError('INVALID_INPUT');
        return { width: metadata.width, height: metadata.height };
      } catch (error) {
        if (error instanceof RequestBoundaryError) throw error;
        if (!(error instanceof Error)) throw error;
        throw new RequestBoundaryError('INVALID_INPUT');
      } finally {
        image.destroy();
      }
    },
  };
}
