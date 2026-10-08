// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodePcmWav, PcmRecordingUnsupportedError, startRecording } from './recorder';
import { validateAndRebuildPcmWav } from '../../api/_lib/audio-pcm';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function fixture(sampleRate = 16000) {
  const track = { stop: vi.fn() };
  const processor = { connect: vi.fn(), disconnect: vi.fn(),
    onaudioprocess: null as ((e: { inputBuffer: { getChannelData(channel: number): Float32Array } }) => void) | null };
  const context = {
    sampleRate, close: vi.fn().mockResolvedValue(undefined), resume: vi.fn().mockResolvedValue(undefined),
    destination: {}, createScriptProcessor: vi.fn(() => processor),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    createGain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() })),
  };
  const getUserMedia = vi.fn(async () => ({ getTracks: () => [track] }));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('AudioContext', class { constructor() { return context; } });
  const emit = (samples: Float32Array) => processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => samples } });
  return { context, track, getUserMedia, emit, processor };
}
describe('D03 固定PCM錄音（WebAudio替身；非真實麥克風）', () => {
  it('輸出固定mono16kHz16bit WAV，振幅裁切不改採樣率', async () => {
    const blob = encodePcmWav(new Float32Array([-2, -1, 0, 1, 2]));
    const result = validateAndRebuildPcmWav(new Uint8Array(await blob.arrayBuffer()));
    expect(result).toMatchObject({ ok: true, dataBytes: 10, durationSeconds: 5 / 16000 });
    const view = new DataView(await blob.arrayBuffer());
    expect(view.getInt16(44, true)).toBe(-32768);
    expect(view.getInt16(52, true)).toBe(32767);
  });
  it('60秒exact上限及+1frame，空資料與NaN明確拒絕', async () => {
    expect(encodePcmWav(new Float32Array(960000)).size).toBe(1920044);
    expect(() => encodePcmWav(new Float32Array(960001))).toThrow();
    expect(() => encodePcmWav(new Float32Array())).toThrow();
    expect(() => encodePcmWav(new Float32Array([NaN]))).toThrow();
  });
  it('timer60000ms停止並釋放track；不自動轉錄，stop冪等', async () => {
    vi.useFakeTimers();
    const f = fixture(), onAutoStop = vi.fn();
    const recording = await startRecording(onAutoStop);
    f.emit(new Float32Array([0.5, -0.5]));
    await vi.advanceTimersByTimeAsync(59999);
    expect(f.track.stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(f.track.stop).toHaveBeenCalledTimes(1);
    expect(onAutoStop).toHaveBeenCalledTimes(1);
    const a = await recording.stop(), b = await recording.stop();
    expect(a).toBe(b);
    expect(a.type).toBe('audio/wav');
    expect(f.context.close).toHaveBeenCalledTimes(1);
  });
  it('960000 samples觸發自動停止，超出frame不送出', async () => {
    vi.useFakeTimers();
    const f = fixture(), auto = vi.fn(), recording = await startRecording(auto);
    f.emit(new Float32Array(960001));
    expect((await recording.stop()).size).toBe(1920044);
    expect(auto).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(auto).toHaveBeenCalledTimes(1);
  });
  it('取消不回傳音訊、不啟動自動完成，重複cancel安全', async () => {
    vi.useFakeTimers();
    const f = fixture(), auto = vi.fn(), recording = await startRecording(auto);
    f.emit(new Float32Array(10));
    recording.cancel(); recording.cancel();
    expect((await recording.stop()).size).toBe(0);
    await vi.advanceTimersByTimeAsync(60000);
    expect(auto).not.toHaveBeenCalled();
    expect(f.track.stop).toHaveBeenCalledTimes(1);
  });
  it('真實採樣率不符或AudioContext不支援時不開麥克風，不改送壓縮格式', async () => {
    const f = fixture(48000);
    await expect(startRecording()).rejects.toBeInstanceOf(PcmRecordingUnsupportedError);
    expect(f.getUserMedia).not.toHaveBeenCalled();
    expect(f.context.close).toHaveBeenCalledTimes(1);
    vi.stubGlobal('AudioContext', class { constructor() { throw new DOMException('TEST_ONLY', 'NotSupportedError'); } });
    await expect(startRecording()).rejects.toBeInstanceOf(PcmRecordingUnsupportedError);
  });
});
