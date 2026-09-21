export type PlaybackStatus = 'idle' | 'requested' | 'playing' | 'failed';

interface SpeakHandlers {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

export function isSpeechSynthesisAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

export function speakJapanese(text: string, handlers: SpeakHandlers): void {
  if (!isSpeechSynthesisAvailable()) {
    handlers.onError?.();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.onstart = () => handlers.onStart?.();
  utterance.onend = () => handlers.onEnd?.();
  utterance.onerror = () => handlers.onError?.();

  window.speechSynthesis.speak(utterance);
}

export function cancelSpeech(): void {
  if (!isSpeechSynthesisAvailable()) return;
  window.speechSynthesis.cancel();
}
