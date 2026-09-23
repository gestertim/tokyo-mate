import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TravelJapaneseScreen } from './TravelJapaneseScreen';
import * as travelJapaneseService from '../services/travelJapanese';

class StubSpeechSynthesisUtterance {
  lang = '';
  onstart: ((event: Event) => void) | null = null;
  onend: ((event: Event) => void) | null = null;
  onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;
  constructor(public text: string) {}
}

function stubSpeechSynthesis() {
  const utterances: SpeechSynthesisUtterance[] = [];
  const cancel = vi.fn();
  const speak = vi.fn((utterance: SpeechSynthesisUtterance) => {
    utterances.push(utterance);
  });
  vi.stubGlobal('SpeechSynthesisUtterance', StubSpeechSynthesisUtterance);
  vi.stubGlobal('speechSynthesis', { cancel, speak });
  return { cancel, speak, utterances };
}

// Bundled MP3 是三層策略之 Primary 層；jsdom 不支援真正的媒體播放，故 mock HTMLMediaElement.play()
// 並手動觸發 playing/error 事件，模擬 asset 成功／失敗兩種情境（見 research.md §6）。
function stubBundledAudio(mode: 'success' | 'error' | 'no-event' = 'error') {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLAudioElement) {
    if (mode === 'success') {
      queueMicrotask(() => this.dispatchEvent(new Event('playing')));
    } else if (mode === 'error') {
      queueMicrotask(() => this.dispatchEvent(new Event('error')));
    }
    return Promise.resolve();
  });
  return { play };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('TravelJapaneseScreen — Phase 3 US1（情境瀏覽 + Phrase Card）', () => {
  it('進入畫面可見 7 個情境', () => {
    stubSpeechSynthesis();
    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: '機場' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '飯店' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '餐廳點餐' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '購物' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '交通' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '求助／緊急狀況' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '日常溝通' })).toBeInTheDocument();
  });

  it('主畫面顯示 VOICEVOX Nemo attribution', () => {
    stubSpeechSynthesis();
    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    expect(screen.getByText('日文語音由 VOICEVOX Nemo 製作')).toBeInTheDocument();
  });

  it('選擇任一情境顯示 >= 20 筆句子卡且每張同時顯示日文與繁中', async () => {
    stubSpeechSynthesis();
    const user = userEvent.setup();
    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '機場' }));

    const phrases = travelJapaneseService.getPhrasesByCategory('airport');
    expect(phrases.length).toBeGreaterThanOrEqual(20);
    for (const phrase of phrases) {
      expect(screen.getByText(phrase.japanese)).toBeInTheDocument();
      expect(screen.getByText(phrase.traditionalChinese)).toBeInTheDocument();
    }
  });

  it('同一跨情境 phrase 在不同情境中日文／繁中內容一致', async () => {
    stubSpeechSynthesis();
    const user = userEvent.setup();
    const crossPhrase = travelJapaneseService.getAllPhrases().find((phrase) => phrase.categories.length > 1)!;
    expect(crossPhrase).toBeTruthy();

    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    for (const category of crossPhrase.categories) {
      await user.click(screen.getByRole('button', { name: travelJapaneseService.TRAVEL_JAPANESE_CATEGORY_LABELS[category] }));
      expect(screen.getByText(crossPhrase.japanese)).toBeInTheDocument();
      expect(screen.getByText(crossPhrase.traditionalChinese)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '返回情境清單' }));
    }
  });
});

describe('TravelJapaneseScreen — Phase 4 + Maintenance US2（三層語音播放策略）', () => {
  it('bundled 音檔成功播放時直接進入 playing，不呼叫 SpeechSynthesis（Primary 正常路徑）', async () => {
    const { play } = stubBundledAudio('success');
    const { speak } = stubSpeechSynthesis();
    const user = userEvent.setup();
    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '日常溝通' }));

    const [firstPlayButton] = screen.getAllByRole('button', { name: '播放' });
    await user.click(firstPlayButton);
    expect(await screen.findByText('播放中')).toBeInTheDocument();
    expect(play).toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });

  it('bundled 失敗時 fallback 至 SpeechSynthesis：requested -> playing -> idle', async () => {
    stubBundledAudio('error');
    const { speak } = stubSpeechSynthesis();
    const user = userEvent.setup();
    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '日常溝通' }));

    const [firstPlayButton] = screen.getAllByRole('button', { name: '播放' });
    await user.click(firstPlayButton);
    expect(screen.getByText('已要求播放')).toBeInTheDocument();

    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    utterance.onstart?.({} as SpeechSynthesisEvent);
    expect(await screen.findByText('播放中')).toBeInTheDocument();

    utterance.onend?.({} as SpeechSynthesisEvent);
    await waitFor(() => {
      expect(screen.queryByText('播放中')).not.toBeInTheDocument();
      expect(screen.queryByText('已要求播放')).not.toBeInTheDocument();
    });
  });

  it('bundled 與 SpeechSynthesis 皆失敗時進入 failed，文字仍可讀', async () => {
    stubBundledAudio('error');
    const { speak } = stubSpeechSynthesis();
    const user = userEvent.setup();
    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '日常溝通' }));

    const [firstPlayButton] = screen.getAllByRole('button', { name: '播放' });
    await user.click(firstPlayButton);
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    utterance.onerror?.({} as SpeechSynthesisErrorEvent);

    expect(await screen.findByText('播放失敗')).toBeInTheDocument();
  });

  it('句子 A 播放中觸發句子 B 播放時，A 的狀態被 B 取代（同一時間僅一個 active playback）', async () => {
    stubBundledAudio('error');
    const { speak, cancel } = stubSpeechSynthesis();
    const user = userEvent.setup();
    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '日常溝通' }));

    const playButtons = screen.getAllByRole('button', { name: '播放' });
    await user.click(playButtons[0]);
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    const firstUtterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    firstUtterance.onstart?.({} as SpeechSynthesisEvent);
    expect(await screen.findByText('播放中')).toBeInTheDocument();

    await user.click(playButtons[1]);
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(2));
    expect(cancel).toHaveBeenCalled();
    const activeLabels = [...screen.queryAllByText('播放中'), ...screen.queryAllByText('已要求播放')];
    expect(activeLabels.length).toBe(1);
  });

  it('speechSynthesis 不可用時播放按鈕 disabled，但文字／搜尋／分類／收藏不受影響', async () => {
    stubBundledAudio('error');
    vi.stubGlobal('speechSynthesis', undefined);
    const user = userEvent.setup();
    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '日常溝通' }));

    const [firstPlayButton] = screen.getAllByRole('button', { name: '播放' });
    expect(firstPlayButton).toBeDisabled();

    const [firstFavoriteButton] = screen.getAllByRole('button', { name: /收藏/ });
    await user.click(firstFavoriteButton);
    expect(firstFavoriteButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('播放失敗時，該卡片文字與收藏按鈕仍可操作，其他句子與導覽不受影響', async () => {
    stubBundledAudio('error');
    const { speak } = stubSpeechSynthesis();
    const user = userEvent.setup();
    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '日常溝通' }));

    const playButtons = screen.getAllByRole('button', { name: '播放' });
    await user.click(playButtons[0]);
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    utterance.onerror?.({} as SpeechSynthesisErrorEvent);

    expect(await screen.findByText('播放失敗')).toBeInTheDocument();
    const favoriteButtons = screen.getAllByRole('button', { name: /收藏/ });
    expect(favoriteButtons[0]).not.toBeDisabled();
    await user.click(favoriteButtons[0]);
    expect(favoriteButtons[0]).toHaveAttribute('aria-pressed', 'true');

    await user.click(playButtons[1]);
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole('button', { name: '返回情境清單' }));
    await user.click(screen.getByRole('button', { name: '機場' }));
    expect(screen.getAllByRole('button', { name: '播放' }).length).toBeGreaterThan(0);
  });

  it('重複播放同一句（多次觸發）行為一致，不殘留前次播放狀態', async () => {
    stubBundledAudio('success');
    stubSpeechSynthesis();
    const user = userEvent.setup();
    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '日常溝通' }));
    const [firstPlayButton] = screen.getAllByRole('button', { name: '播放' });

    await user.click(firstPlayButton);
    expect(await screen.findByText('播放中')).toBeInTheDocument();

    await user.click(firstPlayButton);
    expect(await screen.findByText('播放中')).toBeInTheDocument();
    expect(screen.getAllByText('播放中').length).toBe(1);
  });

  it('component unmount 時呼叫 cancelPlayback()（bundled audio 與 speechSynthesis.cancel 皆終止）', () => {
    stubBundledAudio('success');
    const { cancel } = stubSpeechSynthesis();
    const { unmount } = render(<TravelJapaneseScreen onBack={vi.fn()} />);
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});

describe('TravelJapaneseScreen — Phase 5 US3（搜尋）', () => {
  it('繁中搜尋、日文搜尋、部分關鍵字皆可找到結果', async () => {
    stubSpeechSynthesis();
    const user = userEvent.setup();
    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '搜尋' }));

    const input = screen.getByLabelText('搜尋繁中或日文關鍵字');
    await user.type(input, '護照');
    expect(screen.getAllByText(/護照/).length).toBeGreaterThan(0);

    await user.clear(input);
    await user.type(input, 'パスポート');
    expect(screen.getAllByText(/パスポート/).length).toBeGreaterThan(0);
  });

  it('尚未輸入時顯示中性提示；無結果顯示可理解空白狀態且不出現虛構句子', async () => {
    stubSpeechSynthesis();
    const user = userEvent.setup();
    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '搜尋' }));
    expect(screen.getByText('輸入繁中或日文關鍵字以搜尋')).toBeInTheDocument();

    const input = screen.getByLabelText('搜尋繁中或日文關鍵字');
    await user.type(input, '這個關鍵字不存在xyz999');
    expect(screen.getByText('沒有找到符合的句子，請嘗試其他關鍵字。')).toBeInTheDocument();
  });

  it('搜尋結果可直接播放與收藏，不需進入額外頁面', async () => {
    stubSpeechSynthesis();
    const user = userEvent.setup();
    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '搜尋' }));
    await user.type(screen.getByLabelText('搜尋繁中或日文關鍵字'), '護照');

    const favoriteButton = screen.getAllByRole('button', { name: /收藏/ })[0];
    await user.click(favoriteButton);
    expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: '播放' }).length).toBeGreaterThan(0);
  });
});

describe('TravelJapaneseScreen — Phase 6 US4（收藏）', () => {
  it('收藏／取消收藏；同一 phrase 跨情境與搜尋結果收藏狀態一致', async () => {
    stubSpeechSynthesis();
    const user = userEvent.setup();
    const crossPhrase = travelJapaneseService.getAllPhrases().find((phrase) => phrase.categories.length > 1)!;

    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: travelJapaneseService.TRAVEL_JAPANESE_CATEGORY_LABELS[crossPhrase.categories[0]] }));

    const favoriteButton = screen.getByRole('button', { name: `收藏：${crossPhrase.japanese}` });
    await user.click(favoriteButton);
    expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: '返回情境清單' }));
    await user.click(screen.getByRole('button', { name: travelJapaneseService.TRAVEL_JAPANESE_CATEGORY_LABELS[crossPhrase.categories[1]] }));
    const secondCategoryFavoriteButton = screen.getByRole('button', { name: `收藏：${crossPhrase.japanese}` });
    expect(secondCategoryFavoriteButton).toHaveAttribute('aria-pressed', 'true');

    await user.click(secondCategoryFavoriteButton);
    expect(secondCategoryFavoriteButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('重新掛載 screen 後先前收藏仍存在（持久化還原）', async () => {
    stubSpeechSynthesis();
    const user = userEvent.setup();
    const { unmount } = render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '日常溝通' }));
    const favoriteButton = screen.getAllByRole('button', { name: /收藏/ })[0];
    await user.click(favoriteButton);
    unmount();

    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '我的常用句' }));
    expect(screen.getAllByRole('button', { name: /收藏/ }).length).toBeGreaterThan(0);
  });

  it('localStorage 內容為非法 JSON 時安全降級為空收藏且不 crash', () => {
    stubSpeechSynthesis();
    window.localStorage.setItem('tokyo-mate:travel-japanese:favorites', '{invalid');
    expect(() => render(<TravelJapaneseScreen onBack={vi.fn()} />)).not.toThrow();
  });

  it('收藏空狀態顯示與導覽路徑', async () => {
    stubSpeechSynthesis();
    const user = userEvent.setup();
    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '我的常用句' }));
    expect(screen.getByText(/尚未收藏任何句子/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '瀏覽情境' }));
    expect(screen.getByRole('button', { name: '機場' })).toBeInTheDocument();
  });
});

describe('TravelJapaneseScreen — Phase 7 US5（求助／緊急狀況安全辨識）', () => {
  it('進入 emergency 情境時 safety-critical 句子排列於前段，SafetyReminder 立即可見', async () => {
    stubSpeechSynthesis();
    const user = userEvent.setup();
    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '求助／緊急狀況' }));

    expect(screen.getByRole('note')).toBeInTheDocument();

    const phrases = travelJapaneseService.getPhrasesByCategory('emergency');
    const firstNonCritical = phrases.findIndex((phrase) => !phrase.safetyCritical);
    const lastCritical = phrases.reduce((last, phrase, index) => (phrase.safetyCritical ? index : last), -1);
    if (firstNonCritical !== -1 && lastCritical !== -1) {
      expect(lastCritical).toBeLessThan(firstNonCritical);
    }

    expect(screen.getAllByRole('button', { name: '播放' }).length).toBeGreaterThan(0);
  });
});

describe('TravelJapaneseScreen — Dataset Runtime Anomaly（T045，Graceful Failure）', () => {
  it('dataset 存取層回傳缺少必要欄位的異常資料時，顯示可理解的 graceful-failure 狀態，且不影響其他 view', async () => {
    stubSpeechSynthesis();
    const user = userEvent.setup();
    const spy = vi.spyOn(travelJapaneseService, 'getPhrasesByCategory').mockImplementation((category) => {
      if (category === 'shopping') {
        return [{ id: 'broken-1', japanese: '', traditionalChinese: '', categories: ['shopping'] }];
      }
      return travelJapaneseService.getAllPhrases().filter((phrase) => phrase.categories.includes(category));
    });

    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '購物' }));
    expect(screen.getByText(/目前無法顯示這個情境的句子/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回情境清單' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '返回情境清單' }));
    await user.click(screen.getByRole('button', { name: '機場' }));
    expect(screen.getAllByRole('button', { name: '播放' }).length).toBeGreaterThan(0);

    spy.mockRestore();
  });
});

// Single-Phrase Audio Proof-of-Concept Preparation（tj-097「お願いします。」）：僅驗證既有正式
// Maintenance playback architecture 對 tj-097 的路徑推導與行為，不建立正式 audio fixture、不呼叫
// Cloud TTS、不解除 T055 STOP GATE。
describe('TravelJapaneseScreen — tj-097 Single-Phrase POC Preparation（T055 仍 BLOCKED）', () => {
  function getTj097Card() {
    const japaneseText = screen.getByText('お願いします。');
    const article = japaneseText.closest('article');
    expect(article).not.toBeNull();
    return article as HTMLElement;
  }

  it('tj-097「お願いします。」card bundled 成功播放時 src 指向 /audio/travel-japanese/tj-097.mp3，且不呼叫 SpeechSynthesis', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLAudioElement) {
      queueMicrotask(() => this.dispatchEvent(new Event('playing')));
      return Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const { speak } = stubSpeechSynthesis();

    const user = userEvent.setup();
    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '日常溝通' }));

    const card = getTj097Card();
    const playButton = within(card).getByRole('button', { name: '播放' });
    await user.click(playButton);

    expect(play).toHaveBeenCalledTimes(1);
    const audio = play.mock.instances[0] as HTMLAudioElement;
    expect(audio.src).toContain('/audio/travel-japanese/tj-097.mp3');
    await within(card).findByText('播放中');
    expect(speak).not.toHaveBeenCalled();
    expect(screen.getByText('麻煩您了。')).toBeInTheDocument();
  });

  it('tj-097 bundled 失敗時才 fallback 至 SpeechSynthesis，日文文字始終可見', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLAudioElement) {
      queueMicrotask(() => this.dispatchEvent(new Event('error')));
      return Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const { speak } = stubSpeechSynthesis();

    const user = userEvent.setup();
    render(<TravelJapaneseScreen onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '日常溝通' }));

    const card = getTj097Card();
    const playButton = within(card).getByRole('button', { name: '播放' });
    await user.click(playButton);

    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    const utterance = speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.text).toBe('お願いします。');
    utterance.onstart?.({} as SpeechSynthesisEvent);
    await within(card).findByText('播放中');

    expect(screen.getByText('お願いします。')).toBeInTheDocument();
    expect(screen.getByText('麻煩您了。')).toBeInTheDocument();
  });
});
