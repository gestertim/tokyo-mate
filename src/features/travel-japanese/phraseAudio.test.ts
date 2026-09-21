import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelPlayback, isSpeechSynthesisAvailable, playBundledAudio, speakJapanese } from './phraseAudio';

class StubSpeechSynthesisUtterance {
  lang = '';
  onstart: ((event: Event) => void) | null = null;
  onend: ((event: Event) => void) | null = null;
  onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;
  constructor(public text: string) {}
}

beforeEach(() => {
  vi.stubGlobal('SpeechSynthesisUtterance', StubSpeechSynthesisUtterance);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('phraseAudio（Phase 4 US2，SpeechSynthesis 封裝）', () => {
  it('speechSynthesis 不存在時 isSpeechSynthesisAvailable 回傳 false', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    expect(isSpeechSynthesisAvailable()).toBe(false);
  });

  it('speechSynthesis 存在時 isSpeechSynthesisAvailable 回傳 true', () => {
    vi.stubGlobal('speechSynthesis', { cancel: vi.fn(), speak: vi.fn() });
    expect(isSpeechSynthesisAvailable()).toBe(true);
  });

  it('speakJapanese 呼叫順序為「先 cancel() 再 speak()」，lang 為 ja-JP', () => {
    const calls: string[] = [];
    const cancel = vi.fn(() => calls.push('cancel'));
    const speak = vi.fn((_utterance: SpeechSynthesisUtterance) => calls.push('speak'));
    vi.stubGlobal('speechSynthesis', { cancel, speak });

    speakJapanese('こんにちは', {});

    expect(calls).toEqual(['cancel', 'speak']);
    const utterance = speak.mock.calls[0]?.[0] as unknown as SpeechSynthesisUtterance;
    expect(utterance.lang).toBe('ja-JP');
  });

  it('onstart/onend/onerror 正確觸發對應 handlers', () => {
    const speak = vi.fn((_utterance: SpeechSynthesisUtterance) => {});
    vi.stubGlobal('speechSynthesis', { cancel: vi.fn(), speak });

    const onStart = vi.fn();
    const onEnd = vi.fn();
    const onError = vi.fn();
    speakJapanese('こんにちは', { onStart, onEnd, onError });

    const utterance = speak.mock.calls[0]?.[0] as unknown as SpeechSynthesisUtterance;
    utterance.onstart?.({} as SpeechSynthesisEvent);
    utterance.onend?.({} as SpeechSynthesisEvent);
    utterance.onerror?.({} as unknown as SpeechSynthesisErrorEvent);

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('speechSynthesis 不可用時 speakJapanese 同步呼叫 onError，不拋出例外', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    const onError = vi.fn();
    expect(() => speakJapanese('こんにちは', { onError })).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('cancelPlayback() 於 speechSynthesis 不存在時安全 no-op 不拋出例外', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    expect(() => cancelPlayback()).not.toThrow();
  });

  it('cancelPlayback() 於 speechSynthesis 存在時呼叫 cancel()', () => {
    const cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', { cancel, speak: vi.fn() });
    cancelPlayback();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('speechSynthesis 逾時未收到任何終止事件時視同失敗（onError），不永久停留', () => {
    vi.useFakeTimers();
    vi.stubGlobal('speechSynthesis', { cancel: vi.fn(), speak: vi.fn() });
    const onError = vi.fn();
    speakJapanese('こんにちは', { onError });

    expect(onError).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10000);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('phraseAudio（Maintenance：playBundledAudio Primary 層 + timeout/terminal-state）', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bundled 音檔以 phraseId 推導固定路徑並成功播放時呼叫 onPlaying', async () => {
    let capturedSrc = '';
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLAudioElement) {
      capturedSrc = this.src;
      queueMicrotask(() => this.dispatchEvent(new Event('playing')));
      return Promise.resolve();
    });

    const onPlaying = vi.fn();
    playBundledAudio('tj-001', { onPlaying });

    await vi.waitFor(() => expect(onPlaying).toHaveBeenCalledTimes(1));
    expect(capturedSrc).toContain('/audio/travel-japanese/tj-001.mp3');
  });

  it('bundled 音檔載入失敗（error 事件）時呼叫 onError，不拋出例外', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLAudioElement) {
      queueMicrotask(() => this.dispatchEvent(new Event('error')));
      return Promise.resolve();
    });

    const onError = vi.fn();
    expect(() => playBundledAudio('tj-001', { onError })).not.toThrow();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });

  it('bundled 音檔 play() 被拒絕（例如缺少對應音檔／404）時呼叫 onError', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.reject(new Error('missing asset')));

    const onError = vi.fn();
    playBundledAudio('tj-108', { onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });

  it('bundled 音檔逾時未收到任何終止事件時視同失敗（onError），不永久停留', () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());

    const onError = vi.fn();
    playBundledAudio('tj-001', { onError });
    expect(onError).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10000);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('新播放請求觸發時終止前一個 bundled audio（pause 並重置）', () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());

    playBundledAudio('tj-001', {});
    playBundledAudio('tj-002', {});

    expect(pause).toHaveBeenCalled();
  });

  it('cancelPlayback() 同時終止 bundled audio 與 speechSynthesis', () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    const cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', { cancel, speak: vi.fn() });

    playBundledAudio('tj-001', {});
    cancelPlayback();

    expect(pause).toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
  });
});
