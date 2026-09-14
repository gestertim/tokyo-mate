export function chooseRecordingMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/aac'];
  return candidates.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) ?? '';
}

export interface RecorderSession {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

export async function startRecording(): Promise<RecorderSession> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = chooseRecordingMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  recorder.addEventListener('dataavailable', (event) => { if (event.data.size > 0) chunks.push(event.data); });
  recorder.start();
  const finish = (cancelled: boolean) => new Promise<Blob>((resolve) => {
    recorder.addEventListener('stop', () => {
      stream.getTracks().forEach((track) => track.stop());
      resolve(cancelled ? new Blob() : new Blob(chunks, { type: recorder.mimeType }));
    }, { once: true });
    recorder.stop();
  });
  return { stop: () => finish(false), cancel: () => { void finish(true); } };
}