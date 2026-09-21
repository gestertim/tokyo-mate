// 暫時性 Engineering Diagnostic（非正式產品功能）：驗證 Android installed PWA 能否透過
// HTMLAudioElement 播放 App 自己提供的 static audio asset。與 phraseAudio.ts 的正式三層播放策略無關。
export type DiagnosticStatus = 'idle' | 'requested' | 'playing' | 'success' | 'failed';

export const TEST_TONE_SRC = '/audio/diagnostics/test-tone.wav';

interface DiagnosticHandlers {
  onRequested?: () => void;
  onPlaying?: () => void;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

function describeError(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error) {
    const named = error as { name?: string; message?: string };
    return `${named.name ?? 'Error'}${named.message ? `: ${named.message}` : ''}`;
  }
  return String(error);
}

export function playTestTone(handlers: DiagnosticHandlers): void {
  handlers.onRequested?.();

  const audio = new Audio(TEST_TONE_SRC);

  audio.addEventListener('playing', () => {
    handlers.onPlaying?.();
  });
  audio.addEventListener('ended', () => {
    handlers.onSuccess?.();
  });
  audio.addEventListener('error', () => {
    const mediaError = audio.error;
    handlers.onError?.(mediaError ? `MediaError(code=${mediaError.code})` : '未知的媒體錯誤');
  });

  audio.play().catch((error: unknown) => {
    handlers.onError?.(describeError(error));
  });
}
