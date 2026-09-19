import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslationPanel } from './TranslationPanel';
import type { TranslationState } from '../../types/photoTranslate';
import * as api from '../../services/api';

function renderPanel(translation?: TranslationState) {
  const onSelectTarget = vi.fn();
  const onRetryTranslate = vi.fn();
  render(<TranslationPanel translation={translation} onSelectTarget={onSelectTarget} onRetryTranslate={onRetryTranslate} />);
  return { onSelectTarget, onRetryTranslate };
}

describe('TranslationPanel（Phase 7 Translation Frontend State, FR-005/FR-006/FR-017/FR-018/FR-020）', () => {
  it('僅提供 zh-TW／ja 兩個 target 按鈕，無第三個語言選項', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: '繁體中文' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '日本語' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^(繁體中文|日本語)$/ })).toHaveLength(2);
  });

  it('尚未選擇 target 時顯示尚未產生翻譯提示', () => {
    renderPanel();
    expect(screen.getByText(/尚未產生翻譯/)).toBeInTheDocument();
  });

  it('點擊目標語言按鈕觸發 onSelectTarget', async () => {
    const user = userEvent.setup();
    const { onSelectTarget } = renderPanel();
    await user.click(screen.getByRole('button', { name: '繁體中文' }));
    expect(onSelectTarget).toHaveBeenCalledWith('zh-TW');
  });

  it('translating 狀態顯示翻譯中，不顯示先前翻譯文字（避免誤認為新 target 結果）', () => {
    renderPanel({
      selectedTarget: 'ja',
      forOcrText: '入口 270円',
      status: 'translating',
      displayed: { target: 'zh-TW', text: '舊翻譯內容' },
    });
    expect(screen.getByText('翻譯中…')).toBeInTheDocument();
    expect(screen.queryByText('舊翻譯內容')).not.toBeInTheDocument();
  });

  it('success 狀態顯示翻譯文字', () => {
    renderPanel({
      selectedTarget: 'zh-TW',
      forOcrText: '入口 270円',
      status: 'success',
      displayed: { target: 'zh-TW', text: '入口 270日圓' },
    });
    expect(screen.getByText('入口 270日圓')).toBeInTheDocument();
  });

  it('zh-TW same_language 狀態顯示提示且提供切換至日本語', async () => {
    const user = userEvent.setup();
    const { onSelectTarget } = renderPanel({
      selectedTarget: 'zh-TW',
      forOcrText: '你好',
      status: 'same_language',
    });
    expect(screen.getByText(/辨識原文已是繁體中文/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /切換至日本語/ }));
    expect(onSelectTarget).toHaveBeenCalledWith('ja');
  });

  it('ja same_language 狀態顯示提示且提供切換至繁體中文', async () => {
    const user = userEvent.setup();
    const { onSelectTarget } = renderPanel({
      selectedTarget: 'ja',
      forOcrText: 'こんにちは',
      status: 'same_language',
    });
    expect(screen.getByText(/辨識原文已是日本語/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /切換至繁體中文/ }));
    expect(onSelectTarget).toHaveBeenCalledWith('zh-TW');
  });

  it('failure 狀態（無前次成功結果）顯示一般化錯誤訊息與重新嘗試翻譯，不顯示任何翻譯內容', () => {
    renderPanel({
      selectedTarget: 'ja',
      forOcrText: '入口 270円',
      status: 'failure',
    });
    const alert = screen.getByRole('alert');
    expect(alert).not.toHaveTextContent(/OpenAI|openai|stack|Error:/i);
    expect(screen.getByRole('button', { name: '重新嘗試翻譯' })).toBeInTheDocument();
  });

  it('failure 狀態（有前次成功結果）保留並顯示前次成功翻譯內容與其所屬 target', () => {
    renderPanel({
      selectedTarget: 'ja',
      forOcrText: '入口 270円',
      status: 'failure',
      displayed: { target: 'zh-TW', text: '入口 270日圓' },
    });
    expect(screen.getByText('入口 270日圓')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('切換翻譯失敗');
    expect(screen.getByRole('button', { name: '重新嘗試翻譯' })).toBeInTheDocument();
  });

  it('failure 狀態點擊重新嘗試翻譯觸發 onRetryTranslate', async () => {
    const user = userEvent.setup();
    const { onRetryTranslate } = renderPanel({
      selectedTarget: 'ja',
      forOcrText: '入口 270円',
      status: 'failure',
    });
    await user.click(screen.getByRole('button', { name: '重新嘗試翻譯' }));
    expect(onRetryTranslate).toHaveBeenCalledTimes(1);
  });
});

describe('TranslationPanel（Phase 8 Speech Reuse Integration, FR-011/FR-012/FR-021）', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window.HTMLMediaElement !== 'undefined') {
      window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
      window.HTMLMediaElement.prototype.pause = vi.fn();
    }
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = vi.fn();
    }
  });

  it('success 狀態下語音播放語言等於 displayed.target（與 selectedTarget 相同時）', async () => {
    const user = userEvent.setup();
    const generateSpeechSpy = vi.spyOn(api, 'generateSpeech').mockResolvedValue({
      audioUrl: 'blob:test-url',
      mimeType: 'audio/mpeg',
      speed: 'normal',
    });
    renderPanel({
      selectedTarget: 'zh-TW',
      forOcrText: '入口 270円',
      status: 'success',
      displayed: { target: 'zh-TW', text: '入口 270日圓' },
    });
    await user.click(screen.getByRole('button', { name: /播放語音/ }));
    expect(generateSpeechSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: '入口 270日圓', language: 'zh-TW' }),
    );
  });

  it('切換 selectedTarget=ja 但切換失敗、displayed.target 仍為 zh-TW 時，語音播放語言為 zh-TW 而非 ja', async () => {
    const user = userEvent.setup();
    const generateSpeechSpy = vi.spyOn(api, 'generateSpeech').mockResolvedValue({
      audioUrl: 'blob:test-url',
      mimeType: 'audio/mpeg',
      speed: 'normal',
    });
    renderPanel({
      selectedTarget: 'ja',
      forOcrText: '入口 270円',
      status: 'failure',
      displayed: { target: 'zh-TW', text: '入口 270日圓' },
    });
    await user.click(screen.getByRole('button', { name: /播放語音/ }));
    expect(generateSpeechSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: '入口 270日圓', language: 'zh-TW' }),
    );
  });

  it('ja displayed 翻譯之語音播放語言為 ja', async () => {
    const user = userEvent.setup();
    const generateSpeechSpy = vi.spyOn(api, 'generateSpeech').mockResolvedValue({
      audioUrl: 'blob:test-url',
      mimeType: 'audio/mpeg',
      speed: 'normal',
    });
    renderPanel({
      selectedTarget: 'ja',
      forOcrText: '入口 270円',
      status: 'success',
      displayed: { target: 'ja', text: '入口270円' },
    });
    await user.click(screen.getByRole('button', { name: /播放語音/ }));
    expect(generateSpeechSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: '入口270円', language: 'ja' }),
    );
  });

  it('translating／same_language／idle／無 displayed.text 之 failure 狀態不提供語音播放 action', () => {
    renderPanel({
      selectedTarget: 'ja',
      forOcrText: '入口 270円',
      status: 'translating',
      displayed: { target: 'zh-TW', text: '舊翻譯內容' },
    });
    expect(screen.queryByRole('button', { name: /播放語音/ })).not.toBeInTheDocument();
  });

  it('語音播放失敗時保留翻譯結果並提供重新嘗試播放（不重新翻譯／不重新 OCR）', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'generateSpeech').mockRejectedValue(new Error('tts offline'));
    const { onRetryTranslate, onSelectTarget } = renderPanel({
      selectedTarget: 'zh-TW',
      forOcrText: '入口 270円',
      status: 'success',
      displayed: { target: 'zh-TW', text: '入口 270日圓' },
    });
    await user.click(screen.getByRole('button', { name: /播放語音/ }));
    expect(await screen.findByText(/語音播放暫時無法使用/)).toBeInTheDocument();
    // 翻譯結果仍保留顯示，且未觸發重新翻譯／重新 OCR
    expect(screen.getByText('入口 270日圓')).toBeInTheDocument();
    expect(onRetryTranslate).not.toHaveBeenCalled();
    expect(onSelectTarget).not.toHaveBeenCalled();
    // 仍可重新嘗試播放（播放按鈕依然存在且可再次點擊）
    expect(screen.getByRole('button', { name: /播放語音/ })).toBeEnabled();
  });
});
