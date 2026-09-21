import { afterEach, describe, expect, it, vi } from 'vitest';
import { playTestTone, TEST_TONE_SRC } from './audioDiagnostic';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('audioDiagnostic（Android PWA static audio engineering diagnostic，非正式功能）', () => {
  it('呼叫時建立 Audio 並使用 test-tone.wav 作為 src，且呼叫 play()', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    const onRequested = vi.fn();

    playTestTone({ onRequested });

    expect(onRequested).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    const audio = play.mock.instances[0] as HTMLAudioElement;
    expect(audio.src).toContain(TEST_TONE_SRC);
  });

  it('play() 觸發 playing 事件後呼叫 onPlaying，觸發 ended 後呼叫 onSuccess', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLAudioElement) {
      queueMicrotask(() => this.dispatchEvent(new Event('playing')));
      return Promise.resolve();
    });
    const onPlaying = vi.fn();
    const onSuccess = vi.fn();

    let audioRef: HTMLAudioElement | undefined;
    playTestTone({
      onPlaying: () => {
        onPlaying();
        audioRef?.dispatchEvent(new Event('ended'));
      },
      onSuccess,
    });
    audioRef = (vi.mocked(HTMLMediaElement.prototype.play).mock.instances[0] as HTMLAudioElement);

    await vi.waitFor(() => {
      expect(onPlaying).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('play() 觸發 error 事件時呼叫 onError 並帶出 MediaError code', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLAudioElement) {
      queueMicrotask(() => this.dispatchEvent(new Event('error')));
      return Promise.resolve();
    });
    const onError = vi.fn();

    playTestTone({ onError });

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  it('play() 被拒絕（例如 NotAllowedError）時呼叫 onError 並帶出 name/message', async () => {
    const rejection = Object.assign(new Error('play() failed because the user did not interact'), {
      name: 'NotAllowedError',
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.reject(rejection));
    const onError = vi.fn();

    playTestTone({ onError });

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('NotAllowedError'));
    });
  });
});
