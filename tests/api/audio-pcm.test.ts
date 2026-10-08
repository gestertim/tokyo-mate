import { describe, expect, it } from 'vitest';
import {
  PCM_MAX_DATA_BYTES,
  PCM_MAX_FILE_BYTES,
  buildPcmWav,
  validateAndRebuildPcmWav,
  type PcmRejectReason,
} from '../../api/_lib/audio-pcm';

// 全部使用本機合成資料；不代表瀏覽器錄音、AudioContext 16 kHz 或供應商時長計價相容性已通過。

interface HeaderOverrides {
  riffSize?: number;
  fmtLength?: number;
  audioFormat?: number;
  channels?: number;
  sampleRate?: number;
  byteRate?: number;
  blockAlign?: number;
  bits?: number;
  dataSize?: number;
  riffMagic?: string;
  waveMagic?: string;
  dataMagic?: string;
}

function makeWav(dataBytes: number, o: HeaderOverrides = {}): Uint8Array {
  const out = new Uint8Array(44 + dataBytes);
  const v = new DataView(out.buffer);
  const text = (offset: number, s: string) => [...s].forEach((c, i) => (out[offset + i] = c.charCodeAt(0)));
  text(0, o.riffMagic ?? 'RIFF');
  v.setUint32(4, o.riffSize ?? 36 + dataBytes, true);
  text(8, o.waveMagic ?? 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, o.fmtLength ?? 16, true);
  v.setUint16(20, o.audioFormat ?? 1, true);
  v.setUint16(22, o.channels ?? 1, true);
  v.setUint32(24, o.sampleRate ?? 16000, true);
  v.setUint32(28, o.byteRate ?? 32000, true);
  v.setUint16(32, o.blockAlign ?? 2, true);
  v.setUint16(34, o.bits ?? 16, true);
  text(36, o.dataMagic ?? 'data');
  v.setUint32(40, o.dataSize ?? dataBytes, true);
  // 合成 440 Hz 正弦波樣本
  for (let i = 0; i + 1 < dataBytes; i += 2) {
    v.setInt16(44 + i, Math.round(Math.sin((2 * Math.PI * 440 * (i / 2)) / 16000) * 12000), true);
  }
  return out;
}

const reject = (input: Uint8Array, reason: PcmRejectReason, status: 400 | 413 = 400) => {
  const result = validateAndRebuildPcmWav(input);
  expect(result).toMatchObject({ ok: false, status, reason });
};

describe('T127 PCM WAV 驗證與重建', () => {
  it('合法檔案通過，重建 header 位元組與期望完全相等，時長由實際 data bytes 計算', () => {
    const input = makeWav(3_200);
    const result = validateAndRebuildPcmWav(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dataBytes).toBe(3_200);
    expect(result.durationSeconds).toBe(0.1);
    expect(result.wav.length).toBe(3_244);
    // 獨立列出標準 44 B header 的期望位元組（RIFF size = 3,236 = 0x00000ca4；data = 3,200 = 0x00000c80）
    const expected = [
      0x52, 0x49, 0x46, 0x46, 0xa4, 0x0c, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
      0x66, 0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
      0x80, 0x3e, 0x00, 0x00, 0x00, 0x7d, 0x00, 0x00, 0x02, 0x00, 0x10, 0x00,
      0x64, 0x61, 0x74, 0x61, 0x80, 0x0c, 0x00, 0x00,
    ];
    expect([...result.wav.subarray(0, 44)]).toEqual(expected);
    expect([...result.wav.subarray(44)]).toEqual([...input.subarray(44)]);
  });

  it('重建結果不與輸入共用記憶體，且可處理有 byteOffset 的 view', () => {
    const wav = makeWav(64);
    const host = new Uint8Array(wav.length + 10);
    host.set(wav, 7);
    const view = host.subarray(7, 7 + wav.length);
    const result = validateAndRebuildPcmWav(view);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const snapshot = [...result.wav];
    host.fill(0xff);
    expect([...result.wav]).toEqual(snapshot);
  });

  it('60 s 邊界：1,920,044 B 通過；1,920,046 B 拒絕 413；1,920,045 亦拒絕', () => {
    const edge = validateAndRebuildPcmWav(makeWav(PCM_MAX_DATA_BYTES));
    expect(edge).toMatchObject({ ok: true, dataBytes: 1_920_000, durationSeconds: 60 });
    expect(PCM_MAX_FILE_BYTES).toBe(1_920_044);
    reject(makeWav(PCM_MAX_DATA_BYTES + 2), 'too_large', 413);
    reject(new Uint8Array(1_920_045), 'too_large', 413);
  });

  it('header 宣告長度與實際不符（較大、較小、截斷）一律拒絕', () => {
    reject(makeWav(3_200, { dataSize: 6_400, riffSize: 36 + 6_400 }), 'data_size_mismatch');
    reject(makeWav(3_200, { dataSize: 100, riffSize: 136 }), 'data_size_mismatch');
    const truncated = makeWav(3_200).subarray(0, 44 + 1_000);
    reject(truncated, 'data_size_mismatch');
  });

  it('RIFF size 與總長−8 矛盾拒絕；0xFFFFFFFF 串流佔位值拒絕', () => {
    reject(makeWav(3_200, { riffSize: 36 + 3_200 + 2 }), 'riff_size_mismatch');
    reject(makeWav(3_200, { riffSize: 0xffffffff }), 'riff_size_mismatch');
    reject(makeWav(3_200, { dataSize: 0xffffffff }), 'data_size_placeholder');
  });

  it('額外 chunk（LIST、fact 等）拒絕', () => {
    const base = makeWav(200);
    const extra = new Uint8Array(base.length + 12);
    extra.set(base.subarray(0, 36), 0);
    extra.set([0x4c, 0x49, 0x53, 0x54, 0x04, 0x00, 0x00, 0x00, 0x49, 0x4e, 0x46, 0x4f], 36);
    extra.set(base.subarray(36), 48);
    new DataView(extra.buffer).setUint32(4, extra.length - 8, true);
    reject(extra, 'unexpected_chunk');
    reject(makeWav(200, { fmtLength: 18 }), 'bad_fmt_chunk');
  });

  it('非 PCM／非 16 kHz／非 mono／非 16-bit／blockAlign／byteRate 不符皆拒絕', () => {
    reject(makeWav(200, { audioFormat: 3 }), 'unsupported_format');
    reject(makeWav(200, { sampleRate: 8000, byteRate: 16000 }), 'unsupported_format');
    reject(makeWav(200, { sampleRate: 44100, byteRate: 88200 }), 'unsupported_format');
    reject(makeWav(200, { channels: 2, blockAlign: 4, byteRate: 64000 }), 'unsupported_format');
    reject(makeWav(200, { bits: 8, blockAlign: 1, byteRate: 16000 }), 'unsupported_format');
    reject(makeWav(200, { blockAlign: 4 }), 'unsupported_format');
    reject(makeWav(200, { byteRate: 16000 }), 'unsupported_format');
  });

  it('奇數 data bytes、0 bytes、過短、魔術字錯誤皆拒絕', () => {
    reject(makeWav(201), 'frame_misaligned');
    reject(makeWav(0), 'empty_data');
    reject(new Uint8Array(0), 'too_small');
    reject(new Uint8Array(43), 'too_small');
    reject(makeWav(200, { riffMagic: 'RIFX' }), 'bad_riff');
    reject(makeWav(200, { waveMagic: 'WAVX' }), 'bad_wave');
    reject(makeWav(200, { dataMagic: 'datx' }), 'unexpected_chunk');
  });

  it('時長以實際 data bytes／32,000 計算，不採用宣告值（偽造短宣告被拒）', () => {
    const forged = makeWav(32_000 * 5, { dataSize: 32_000, riffSize: 36 + 32_000 });
    reject(forged, 'data_size_mismatch');
    const honest = validateAndRebuildPcmWav(makeWav(32_000 * 5));
    expect(honest).toMatchObject({ ok: true, durationSeconds: 5 });
  });

  it('可由 maxDataBytes 覆寫上限（A3 待核對值不寫死在流程中）', () => {
    expect(validateAndRebuildPcmWav(makeWav(1_000), { maxDataBytes: 500 })).toMatchObject({ ok: false, reason: 'too_large' });
    expect(validateAndRebuildPcmWav(makeWav(500), { maxDataBytes: 500 })).toMatchObject({ ok: true });
  });

  it('buildPcmWav 與驗證互為往返', () => {
    const pcm = makeWav(640).subarray(44);
    const rebuilt = buildPcmWav(pcm);
    expect(validateAndRebuildPcmWav(rebuilt)).toMatchObject({ ok: true, dataBytes: 640 });
  });
});
