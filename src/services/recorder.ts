const SAMPLE_RATE = 16000;
const MAX_SAMPLES = SAMPLE_RATE * 60;
export class PcmRecordingUnsupportedError extends Error {
  constructor() { super('此瀏覽器不支援固定格式錄音，請改用文字輸入。'); }
}
export interface RecorderSession {
  stop(): Promise<Blob>;
  cancel(): void;
  isStopped?(): boolean;
}
export function encodePcmWav(samples: Float32Array): Blob {
  if (samples.length === 0 || samples.length > MAX_SAMPLES || samples.some((value) => !Number.isFinite(value)))
    throw new Error('錄音內容無效，請重新錄音或改用文字輸入。');
  const bytes = new Uint8Array(44 + samples.length * 2), view = new DataView(bytes.buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; ++i) bytes[offset + i] = text.charCodeAt(i);
  };
  write(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); write(8, 'WAVE');
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, samples.length * 2, true);
  samples.forEach((value, index) => {
    const bounded = Math.max(-1, Math.min(1, value));
    view.setInt16(44 + index * 2, Math.round(bounded * (bounded < 0 ? 32768 : 32767)), true);
  });
  return new Blob([bytes], { type: 'audio/wav' });
}
export async function startRecording(onAutoStop?: () => void): Promise<RecorderSession> {
  if (typeof AudioContext === 'undefined') throw new PcmRecordingUnsupportedError();
  let context: AudioContext;
  try { context = new AudioContext({ sampleRate: SAMPLE_RATE }); }
  catch (error) {
    if (error instanceof DOMException && error.name === 'NotSupportedError') throw new PcmRecordingUnsupportedError();
    throw error;
  }
  if (context.sampleRate !== SAMPLE_RATE || typeof context.createScriptProcessor !== 'function') {
    await context.close();
    throw new PcmRecordingUnsupportedError();
  }
  let stream: MediaStream | undefined;
  let released = false;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: SAMPLE_RATE } });
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    const silent = context.createGain();
    silent.gain.value = 0;
    const chunks: Float32Array[] = [];
    let count = 0, finished = false, cancelled = false;
    let finishPromise: Promise<Blob> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (): Promise<Blob> => {
      if (finishPromise) return finishPromise;
      finished = true;
      clearTimeout(timer);
      processor.onaudioprocess = null;
      source.disconnect(); processor.disconnect(); silent.disconnect();
      stream!.getTracks().forEach((track) => track.stop());
      released = true;
      finishPromise = (async () => {
        await context.close();
        if (cancelled) return new Blob([], { type: 'audio/wav' });
        const joined = new Float32Array(count);
        let offset = 0;
        for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
        chunks.length = 0;
        return encodePcmWav(joined);
      })();
      return finishPromise;
    };
    const autoStop = () => {
      if (finished) return;
      // 自動停止不送轉錄請求；由 UI 明確操作讀取結果／錯誤。
      void finish().catch(() => {
        console.info(JSON.stringify({ event: 'tokyo-mate.recording', outcome: 'capture_failed' }));
      });
      onAutoStop?.();
    };
    processor.onaudioprocess = (event) => {
      if (finished) return;
      const input = event.inputBuffer.getChannelData(0);
      const part = input.slice(0, MAX_SAMPLES - count);
      chunks.push(part); count += part.length;
      if (count === MAX_SAMPLES) autoStop();
    };
    source.connect(processor); processor.connect(silent); silent.connect(context.destination);
    timer = setTimeout(autoStop, 60000);
    try { await context.resume(); }
    catch (error) { cancelled = true; await finish(); throw error; }
    return { stop: finish, isStopped: () => finished, cancel: () => {
      cancelled = true; chunks.length = 0; count = 0;
      void finish().catch((error: unknown) => {
        console.info(JSON.stringify({ event: 'tokyo-mate.recording', outcome: 'cleanup_failed',
          errorKind: error instanceof Error ? error.name : 'unknown' }));
      });
    } };
  } catch (error) {
    if (!released) {
      stream?.getTracks().forEach((track) => track.stop());
      await context.close();
    }
    throw error;
  }
}
