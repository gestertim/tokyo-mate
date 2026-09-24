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

// Hotfix（T072 實機發現 fallback race）：module-level monotonically increasing attempt token.
// 每次 playBundledAudio / speakJapanese 都會建立自己的 attemptId；只有 attemptId === currentAttemptId
// 的 attempt 才被允許執行 handler／fallback／global playback 停止，避免舊 attempt 遲到的
// play().catch／error／ended／timeout 誤殺較新的 attempt（或誤觸 SpeechSynthesis fallback）。
let attemptSequence = 0;
let currentAttemptId = 0;

let activeAudio: HTMLAudioElement | null = null;
let activeTimeoutId: ReturnType<typeof setTimeout> | null = null;

function clearActiveTimeout(): void {
  if (activeTimeoutId !== null) {
    clearTimeout(activeTimeoutId);
    activeTimeoutId = null;
  }
}

// Stops whatever is currently active (bundled audio and/or SpeechSynthesis) so only one playback
// is ever in flight at a time (FR-010/FR-011). Also invalidates whichever attempt is currently in
// flight so its late callbacks become permanent no-ops.
function stopActivePlayback(): void {
  currentAttemptId = ++attemptSequence;
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
  const attemptId = ++attemptSequence;
  currentAttemptId = attemptId;

  const audio = new Audio(`/audio/travel-japanese/${phraseId}.mp3`);
  activeAudio = audio;

  function isCurrent(): boolean {
    return attemptId === currentAttemptId;
  }

  // timedOut 僅由本 attempt 自己的 timeout 設定；一旦逾時視為終局，不再處理任何遲到的真實事件。
  let timedOut = false;

  audio.addEventListener('playing', () => {
    if (!isCurrent() || timedOut) return;
    clearActiveTimeout();
    handlers.onPlaying?.();
  });
  audio.addEventListener('ended', () => {
    if (!isCurrent() || timedOut) return;
    clearActiveTimeout();
    handlers.onEnded?.();
  });
  audio.addEventListener('error', () => {
    if (!isCurrent() || timedOut) return;
    clearActiveTimeout();
    handlers.onError?.();
  });

  activeTimeoutId = setTimeout(() => {
    if (!isCurrent() || timedOut) return;
    timedOut = true;
    activeTimeoutId = null;
    // Timeout ownership: only pause the audio instance this attempt owns; never touch a newer
    // attempt's audio via the shared `activeAudio` pointer.
    audio.pause();
    handlers.onError?.();
  }, PLAYBACK_TIMEOUT_MS);

  Promise.resolve()
    .then(() => audio.play())
    .catch(() => {
      if (!isCurrent() || timedOut) return;
      clearActiveTimeout();
      handlers.onError?.();
    });
}

export function speakJapanese(text: string, handlers: SpeakHandlers): void {
  stopActivePlayback();
  const attemptId = ++attemptSequence;
  currentAttemptId = attemptId;

  function isCurrent(): boolean {
    return attemptId === currentAttemptId;
  }

  if (!isSpeechSynthesisAvailable()) {
    handlers.onError?.();
    return;
  }

  // timedOut 僅由本 attempt 自己的 timeout 設定；一旦逾時視為終局，不再處理任何遲到的真實事件。
  let timedOut = false;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.onstart = () => {
    if (!isCurrent() || timedOut) return;
    clearActiveTimeout();
    handlers.onStart?.();
  };
  utterance.onend = () => {
    if (!isCurrent() || timedOut) return;
    clearActiveTimeout();
    handlers.onEnd?.();
  };
  utterance.onerror = () => {
    if (!isCurrent() || timedOut) return;
    clearActiveTimeout();
    handlers.onError?.();
  };

  activeTimeoutId = setTimeout(() => {
    if (!isCurrent() || timedOut) return;
    timedOut = true;
    activeTimeoutId = null;
    handlers.onError?.();
  }, PLAYBACK_TIMEOUT_MS);

  window.speechSynthesis.speak(utterance);
}

export function cancelPlayback(): void {
  stopActivePlayback();
}
