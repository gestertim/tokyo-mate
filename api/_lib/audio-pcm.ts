// 功能 005 T127：P1 後端 PCM WAV 驗證與重建（plan.md §4.2.4.1）。
// 不信任 header 宣告，只信任實際收到的 bytes；驗證通過後丟棄原 header 並重建標準 44 B header。
// D03 已批准 60 s／1,920,000 B；HTTP 拒絕 boundary 已驗證，付費成功接線／價格仍待批准。

export const PCM_FORMAT = {
  audioFormat: 1,
  numChannels: 1,
  sampleRate: 16_000,
  bitsPerSample: 16,
  blockAlign: 2,
  byteRate: 32_000,
} as const;

export const WAV_HEADER_BYTES = 44;
export const PCM_MAX_DATA_BYTES = 1_920_000;
export const PCM_MAX_FILE_BYTES = PCM_MAX_DATA_BYTES + WAV_HEADER_BYTES;
export const PCM_MULTIPART_PREPARSE_MAX_BYTES = 2_000_000;

export type PcmRejectReason =
  | 'too_small'
  | 'bad_riff'
  | 'bad_wave'
  | 'bad_fmt_chunk'
  | 'unexpected_chunk'
  | 'unsupported_format'
  | 'riff_size_mismatch'
  | 'data_size_placeholder'
  | 'data_size_mismatch'
  | 'frame_misaligned'
  | 'empty_data'
  | 'too_large';

export type PcmValidationResult =
  | { ok: true; wav: Uint8Array; dataBytes: number; durationSeconds: number }
  | { ok: false; status: 400 | 413; code: 'INVALID_INPUT' | 'PAYLOAD_TOO_LARGE'; reason: PcmRejectReason };

export interface PcmValidationOptions {
  maxDataBytes?: number;
}

const ascii = (view: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...view.subarray(offset, offset + length));

const bad = (reason: PcmRejectReason): PcmValidationResult => ({ ok: false, status: 400, code: 'INVALID_INPUT', reason });

export function buildPcmWav(pcm: Uint8Array): Uint8Array {
  const out = new Uint8Array(WAV_HEADER_BYTES + pcm.length);
  const view = new DataView(out.buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) out[offset + i] = text.charCodeAt(i);
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, PCM_FORMAT.audioFormat, true);
  view.setUint16(22, PCM_FORMAT.numChannels, true);
  view.setUint32(24, PCM_FORMAT.sampleRate, true);
  view.setUint32(28, PCM_FORMAT.byteRate, true);
  view.setUint16(32, PCM_FORMAT.blockAlign, true);
  view.setUint16(34, PCM_FORMAT.bitsPerSample, true);
  write(36, 'data');
  view.setUint32(40, pcm.length, true);
  out.set(pcm, WAV_HEADER_BYTES);
  return out;
}

export function validateAndRebuildPcmWav(input: Uint8Array, options: PcmValidationOptions = {}): PcmValidationResult {
  const maxDataBytes = options.maxDataBytes ?? PCM_MAX_DATA_BYTES;
  const total = input.length;

  if (total > maxDataBytes + WAV_HEADER_BYTES) {
    return { ok: false, status: 413, code: 'PAYLOAD_TOO_LARGE', reason: 'too_large' };
  }
  if (total < WAV_HEADER_BYTES) return bad('too_small');

  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  if (ascii(input, 0, 4) !== 'RIFF') return bad('bad_riff');
  if (ascii(input, 8, 4) !== 'WAVE') return bad('bad_wave');
  if (ascii(input, 12, 4) !== 'fmt ' || view.getUint32(16, true) !== 16) return bad('bad_fmt_chunk');
  if (ascii(input, 36, 4) !== 'data') return bad('unexpected_chunk');

  const fmtOk =
    view.getUint16(20, true) === PCM_FORMAT.audioFormat &&
    view.getUint16(22, true) === PCM_FORMAT.numChannels &&
    view.getUint32(24, true) === PCM_FORMAT.sampleRate &&
    view.getUint32(28, true) === PCM_FORMAT.byteRate &&
    view.getUint16(32, true) === PCM_FORMAT.blockAlign &&
    view.getUint16(34, true) === PCM_FORMAT.bitsPerSample;
  if (!fmtOk) return bad('unsupported_format');

  const actualData = total - WAV_HEADER_BYTES;
  const declaredData = view.getUint32(40, true);
  if (declaredData === 0xffffffff) return bad('data_size_placeholder');
  if (declaredData !== actualData) return bad('data_size_mismatch');
  if (view.getUint32(4, true) !== total - 8) return bad('riff_size_mismatch');
  if (actualData % PCM_FORMAT.blockAlign !== 0) return bad('frame_misaligned');
  if (actualData === 0) return bad('empty_data');

  const rebuilt = buildPcmWav(input.slice(WAV_HEADER_BYTES));
  return { ok: true, wav: rebuilt, dataBytes: actualData, durationSeconds: actualData / PCM_FORMAT.byteRate };
}
