export type PlaybackStatus = 'idle' | 'requested' | 'playing' | 'failed';

interface BundledAudioHandlers {
  onPlaying?: () => void;
  onEnded?: () => void;
  onError?: () => void;
}

interface SpeakHandlers {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

// No-event terminal-state guard (plan.md 第八節 B.6): a silent bundled/SpeechSynthesis API must not
// leave playback stuck in 'requested'/'playing' forever, so each layer gets a bounded wait window.
const PLAYBACK_TIMEOUT_MS = 8000;

let activeAudio: HTMLAudioElement | null = null;
let activeTimeoutId: ReturnType<typeof setTimeout> | null = null;

function clearActiveTimeout(): void {
  if (activeTimeoutId !== null) {
    clearTimeout(activeTimeoutId);
    activeTimeoutId = null;
  }
}

// Stops whatever is currently active (bundled audio and/or SpeechSynthesis) so only one playback
// is ever in flight at a time (FR-010/FR-011).
function stopActivePlayback(): void {
  clearActiveTimeout();
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = '';
    activeAudio = null;
  }
  if (isSpeechSynthesisAvailable()) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeechSynthesisAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

export function playBundledAudio(phraseId: string, handlers: BundledAudioHandlers): void {
  stopActivePlayback();

  const audio = new Audio(`/audio/travel-japanese/${phraseId}.mp3`);
  activeAudio = audio;

  let timedOut = false;
  function clearWait() {
    clearActiveTimeout();
  }

  audio.addEventListener('playing', () => {
    clearWait();
    if (!timedOut) handlers.onPlaying?.();
  });
  audio.addEventListener('ended', () => {
    clearWait();
    if (!timedOut) handlers.onEnded?.();
  });
  audio.addEventListener('error', () => {
    clearWait();
    if (!timedOut) handlers.onError?.();
  });

  activeTimeoutId = setTimeout(() => {
    timedOut = true;
    activeTimeoutId = null;
    handlers.onError?.();
  }, PLAYBACK_TIMEOUT_MS);

  Promise.resolve()
    .then(() => audio.play())
    .catch(() => {
      clearWait();
      if (!timedOut) handlers.onError?.();
    });
}

export function speakJapanese(text: string, handlers: SpeakHandlers): void {
  stopActivePlayback();

  if (!isSpeechSynthesisAvailable()) {
    handlers.onError?.();
    return;
  }

  let timedOut = false;
  function clearWait() {
    clearActiveTimeout();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.onstart = () => {
    clearWait();
    if (!timedOut) handlers.onStart?.();
  };
  utterance.onend = () => {
    clearWait();
    if (!timedOut) handlers.onEnd?.();
  };
  utterance.onerror = () => {
    clearWait();
    if (!timedOut) handlers.onError?.();
  };

  activeTimeoutId = setTimeout(() => {
    timedOut = true;
    activeTimeoutId = null;
    handlers.onError?.();
  }, PLAYBACK_TIMEOUT_MS);

  window.speechSynthesis.speak(utterance);
}

export function cancelPlayback(): void {
  stopActivePlayback();
}
