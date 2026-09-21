import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelSpeech, isSpeechSynthesisAvailable, speakJapanese } from './phraseAudio';

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

  it('cancelSpeech() 於 speechSynthesis 不存在時安全 no-op 不拋出例外', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    expect(() => cancelSpeech()).not.toThrow();
  });

  it('cancelSpeech() 於 speechSynthesis 存在時呼叫 cancel()', () => {
    const cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', { cancel, speak: vi.fn() });
    cancelSpeech();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
