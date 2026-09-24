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

  // Single-Phrase Audio POC Preparation（tj-097「お願いします。」）：僅驗證路徑推導，不建立正式 audio fixture。
  it('bundled 音檔以 phraseId tj-097 推導路徑 /audio/travel-japanese/tj-097.mp3', async () => {
    let capturedSrc = '';
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLAudioElement) {
      capturedSrc = this.src;
      queueMicrotask(() => this.dispatchEvent(new Event('playing')));
      return Promise.resolve();
    });

    const onPlaying = vi.fn();
    playBundledAudio('tj-097', { onPlaying });

    await vi.waitFor(() => expect(onPlaying).toHaveBeenCalledTimes(1));
    expect(capturedSrc).toContain('/audio/travel-japanese/tj-097.mp3');
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

// Hotfix：Playback Attempt Isolation（Fallback Race Fix，T072 實機發現的男聲/女聲交替問題）。
// 目的：確認舊（已被取代）的 bundled playback attempt，其遲到的 play().catch／error／ended／timeout
// 都不得再驅動任何 handler，避免誤觸 fallback 或誤停最新 attempt。
describe('phraseAudio（Hotfix：Playback Attempt Isolation，Fallback Race Fix）', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('A. 同一 phrase 快速重複觸發：舊 attempt 的 play() 才遲遲 reject 時，不得呼叫舊 attempt 的 onError', async () => {
    const rejecters: Array<(reason: unknown) => void> = [];
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () {
      return new Promise((_resolve, reject) => {
        rejecters.push(reject);
      });
    });

    const onErrorA = vi.fn();
    const onErrorB = vi.fn();

    playBundledAudio('tj-001', { onError: onErrorA });
    playBundledAudio('tj-001', { onError: onErrorB });
    await vi.waitFor(() => expect(rejecters.length).toBe(2));

    // 舊（第一次）attempt 的 play() 才遲遲 reject —— 不得誤觸舊 attempt 的 onError（避免驅動 fallback 中止新 attempt）
    rejecters[0](new Error('stale rejection'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onErrorA).not.toHaveBeenCalled();

    // 新（第二次）attempt 仍可正常失敗／成功，不受舊 attempt 影響
    rejecters[1](new Error('current rejection'));
    await vi.waitFor(() => expect(onErrorB).toHaveBeenCalledTimes(1));
  });

  it('B. Stale Attempt Isolation：舊 attempt 遲到的 error / ended / timeout 事件都不得影響已被取代的 handlers', async () => {
    vi.useFakeTimers();
    const instances: HTMLAudioElement[] = [];
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLAudioElement) {
      instances.push(this);
      return Promise.resolve();
    });

    const onErrorA = vi.fn();
    const onEndedA = vi.fn();
    playBundledAudio('tj-001', { onError: onErrorA, onEnded: onEndedA });
    await vi.advanceTimersByTimeAsync(0);

    const onPlayingB = vi.fn();
    const onEndedB = vi.fn();
    playBundledAudio('tj-001', { onPlaying: onPlayingB, onEnded: onEndedB });
    await vi.advanceTimersByTimeAsync(0);
    expect(instances.length).toBe(2);

    // 舊 attempt（instances[0]）遲到的 error / ended 事件不得驅動舊 handlers
    instances[0].dispatchEvent(new Event('error'));
    instances[0].dispatchEvent(new Event('ended'));
    expect(onErrorA).not.toHaveBeenCalled();
    expect(onEndedA).not.toHaveBeenCalled();

    // 新 attempt（instances[1]）成功播放並完整播完，不受舊 attempt 遲到事件影響
    instances[1].dispatchEvent(new Event('playing'));
    expect(onPlayingB).toHaveBeenCalledTimes(1);
    instances[1].dispatchEvent(new Event('ended'));
    expect(onEndedB).toHaveBeenCalledTimes(1);

    // 新 attempt 已正常完成（自身 timeout 已隨 'ended' 被清除），逾時後兩邊 handlers 均不再被觸發
    await vi.advanceTimersByTimeAsync(8000);
    expect(onErrorA).not.toHaveBeenCalled();
    expect(onEndedB).toHaveBeenCalledTimes(1);
  });

  it('C. Timeout Ownership：timeout 只暫停自己持有的 audio instance，不透過 global 誤停其他 attempt', async () => {
    vi.useFakeTimers();
    const instances: HTMLAudioElement[] = [];
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLAudioElement) {
      instances.push(this);
      // 以獨立屬性覆蓋（非 vi.spyOn）建立每個 instance 各自獨立的 pause 計數，
      // 避免與 prototype 層級的共用 spy 混淆。
      this.pause = vi.fn();
      return Promise.resolve();
    });

    const onPlayingA = vi.fn();
    playBundledAudio('tj-001', { onPlaying: onPlayingA });
    await vi.advanceTimersByTimeAsync(0);
    instances[0].dispatchEvent(new Event('playing'));
    expect(onPlayingA).toHaveBeenCalledTimes(1);

    const onErrorB = vi.fn();
    playBundledAudio('tj-002', { onError: onErrorB });
    await vi.advanceTimersByTimeAsync(0);
    expect(instances[0].pause).toHaveBeenCalledTimes(1); // A 因被 B 取代而終止一次

    await vi.advanceTimersByTimeAsync(8000); // B 逾時
    expect(onErrorB).toHaveBeenCalledTimes(1);
    expect(instances[1].pause).toHaveBeenCalledTimes(1); // timeout 只暫停 B 自己持有的 audio
    expect(instances[0].pause).toHaveBeenCalledTimes(1); // A 未被再次觸碰
  });

  it('D. Primary Success：最新 attempt 成功播放（onPlaying）後，舊 attempt 遲到失敗不得驅動任何 handler', async () => {
    const instances: HTMLAudioElement[] = [];
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLAudioElement) {
      instances.push(this);
      return Promise.resolve();
    });

    const onErrorA = vi.fn();
    playBundledAudio('tj-001', { onError: onErrorA });
    await vi.waitFor(() => expect(instances.length).toBe(1));

    const onPlayingB = vi.fn();
    playBundledAudio('tj-001', { onPlaying: onPlayingB });
    await vi.waitFor(() => expect(instances.length).toBe(2));
    instances[1].dispatchEvent(new Event('playing'));
    expect(onPlayingB).toHaveBeenCalledTimes(1);

    // 舊 attempt 遲到的 error（模擬即使已被取代，網路才回應 404）
    instances[0].dispatchEvent(new Event('error'));
    expect(onErrorA).not.toHaveBeenCalled();
  });

  it('E. Same Phrase Repeated Playback：同一句完整播完後再次播放，仍可正常啟動新的 primary playback', async () => {
    const instances: HTMLAudioElement[] = [];
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLAudioElement) {
      instances.push(this);
      return Promise.resolve();
    });

    const onEnded1 = vi.fn();
    playBundledAudio('tj-001', { onEnded: onEnded1 });
    await vi.waitFor(() => expect(instances.length).toBe(1));
    instances[0].dispatchEvent(new Event('ended'));
    expect(onEnded1).toHaveBeenCalledTimes(1);

    const onPlaying2 = vi.fn();
    playBundledAudio('tj-001', { onPlaying: onPlaying2 });
    await vi.waitFor(() => expect(instances.length).toBe(2));
    instances[1].dispatchEvent(new Event('playing'));
    expect(onPlaying2).toHaveBeenCalledTimes(1);
  });

  it('F. Different Phrase Replacement：播放 phrase A 時改播 phrase B，A 被停止且 A 的遲到 callback 不得影響 B', async () => {
    const instances: HTMLAudioElement[] = [];
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLAudioElement) {
      instances.push(this);
      return Promise.resolve();
    });

    const onErrorA = vi.fn();
    playBundledAudio('tj-001', { onError: onErrorA });
    await vi.waitFor(() => expect(instances.length).toBe(1));

    const onPlayingB = vi.fn();
    const onEndedB = vi.fn();
    playBundledAudio('tj-002', { onPlaying: onPlayingB, onEnded: onEndedB });
    await vi.waitFor(() => expect(instances.length).toBe(2));

    instances[0].dispatchEvent(new Event('error')); // A 的遲到事件
    expect(onErrorA).not.toHaveBeenCalled();

    instances[1].dispatchEvent(new Event('playing'));
    expect(onPlayingB).toHaveBeenCalledTimes(1);
    instances[1].dispatchEvent(new Event('ended'));
    expect(onEndedB).toHaveBeenCalledTimes(1);
  });
});
