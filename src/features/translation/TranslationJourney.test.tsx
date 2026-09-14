import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslationResult } from './TranslationResult';
import { AssistantScreen } from '../../screens/AssistantScreen';
import { VoiceInputModal } from '../speech/VoiceInputModal';
import * as api from '../../services/api';
import * as recorder from '../../services/recorder';

describe('translation journey', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window.HTMLMediaElement !== 'undefined') {
      window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
      window.HTMLMediaElement.prototype.pause = vi.fn();
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = vi.fn();
    }
  });

  it('shows editable target text, tone controls, copy and playback actions', async () => {
    const user = userEvent.setup();
    const onToneChange = vi.fn();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const { rerender } = render(
      <TranslationResult
        sourceText="不辣的牛丼"
        targetText="辛くない牛丼をお願いします。"
        tone="default"
        onToneChange={onToneChange}
      />,
    );

    expect(screen.getByRole('textbox', { name: /日文翻譯/i })).toHaveValue('辛くない牛丼をお願いします。');
    await user.click(screen.getByRole('button', { name: '更禮貌' }));
    await user.click(screen.getByRole('button', { name: '複製' }));
    expect(onToneChange).toHaveBeenCalledWith('polite');
    expect(writeText).toHaveBeenCalledWith('辛くない牛丼をお願いします。');
    expect(screen.getByRole('button', { name: /播放語音/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /慢速播放/i })).toBeInTheDocument();

    rerender(
      <TranslationResult
        sourceText="不辣的牛丼"
        targetText="恐れ入りますが、辛くない牛丼を1ついただけますでしょうか。"
        tone="polite"
        onToneChange={onToneChange}
      />,
    );
    expect(screen.getByRole('textbox', { name: /日文翻譯/i })).toHaveValue(
      '恐れ入りますが、辛くない牛丼を1ついただけますでしょうか。',
    );
  });

  it('updates actual targetText when changing tone in AssistantScreen', async () => {
    const user = userEvent.setup();
    const requestAssistantSpy = vi.spyOn(api, 'requestAssistant').mockImplementation(async (req) => {
      if (req.tone === 'polite') {
        return {
          id: 'test-2',
          safety: 'normal',
          freshness: 'not_required',
          intent: 'translation',
          sourceLanguage: 'zh-TW',
          targetLanguage: 'ja',
          answerType: 'direct_translation',
          primaryContent: '恐れ入りますが、辛くない牛丼を1ついただけますでしょうか。',
          translation: {
            sourceText: '我想點一份不辣的牛丼',
            targetText: '恐れ入りますが、辛くない牛丼を1ついただけますでしょうか。',
            toneUsed: 'polite',
          },
          liveDataStatus: 'not_required',
          suggestedActions: [],
          emergency: false,
        };
      }
      return {
        id: 'test-1',
        safety: 'normal',
        freshness: 'not_required',
        intent: 'translation',
        sourceLanguage: 'zh-TW',
        targetLanguage: 'ja',
        answerType: 'direct_translation',
        primaryContent: '辛くない牛丼をお願いします。',
        translation: {
          sourceText: '我想點一份不辣的牛丼',
          targetText: '辛くない牛丼をお願いします。',
          toneUsed: 'default',
        },
        liveDataStatus: 'not_required',
        suggestedActions: [],
        emergency: false,
      };
    });

    render(<AssistantScreen initialText="我想點一份不辣的牛丼" onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '送出' }));

    expect(await screen.findByRole('textbox', { name: /日文翻譯/i })).toHaveValue('辛くない牛丼をお願いします。');

    await user.click(screen.getByRole('button', { name: '更禮貌' }));

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /日文翻譯/i })).toHaveValue(
        '恐れ入りますが、辛くない牛丼を1ついただけますでしょうか。',
      );
    });
    expect(requestAssistantSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: '我想點一份不辣的牛丼',
        tone: 'polite',
      }),
    );
  });

  it('displays correct label for reverse translation (ja to zh-TW) and passes targetLanguage to AudioPlayer', async () => {
    const user = userEvent.setup();
    const generateSpeechSpy = vi.spyOn(api, 'generateSpeech').mockResolvedValue({
      audioUrl: 'blob:test-url',
      mimeType: 'audio/mpeg',
      speed: 'normal',
    });

    render(
      <TranslationResult
        sourceText="この近くに駅はありますか？"
        targetText="請問這附近有車站嗎？"
        sourceLanguage="ja"
        targetLanguage="zh-TW"
        tone="default"
        onToneChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('textbox', { name: /中文翻譯/i })).toHaveValue('請問這附近有車站嗎？');
    expect(screen.getByLabelText('中文翻譯')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /播放語音/i }));
    expect(generateSpeechSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '請問這附近有車站嗎？',
        language: 'zh-TW',
        speed: 'normal',
      }),
    );
  });

  it('handles STT stop/transcribe failure without getting stuck in transcribing and shows friendly error', async () => {
    const user = userEvent.setup();
    const mockStop = vi.fn().mockResolvedValue(new Blob(['test-audio'], { type: 'audio/webm' }));
    vi.spyOn(recorder, 'startRecording').mockResolvedValue({
      stop: mockStop,
      cancel: vi.fn(),
    });
    vi.spyOn(api, 'transcribeAudio').mockRejectedValue({
      code: 'TRANSCRIPTION_FAILED',
      userTitle: '無法辨識語音',
      userMessage: '請靠近麥克風或改用文字輸入。',
      actionableStep: '重試或文字輸入',
    });

    render(<VoiceInputModal onTranscript={vi.fn()} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '開始錄音' }));
    expect(screen.getByRole('button', { name: '停止錄音' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '停止錄音' }));

    expect(await screen.findByText('請靠近麥克風或改用文字輸入。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '開始錄音' })).toBeInTheDocument();
    expect(screen.queryByText('轉錄中…')).not.toBeInTheDocument();
  });
});