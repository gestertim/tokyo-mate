import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantScreen } from './AssistantScreen';
import * as api from '../services/api';
import type { AssistantResult } from '../types/assistant';

function baseResult(overrides: Partial<AssistantResult>): AssistantResult {
  return {
    id: 'test-result',
    safety: 'normal',
    freshness: 'not_required',
    intent: 'translation',
    sourceLanguage: 'zh-TW',
    targetLanguage: 'ja',
    answerType: 'direct_translation',
    primaryContent: '',
    liveDataStatus: 'not_required',
    suggestedActions: [],
    emergency: false,
    ...overrides,
  };
}

describe('AssistantScreen result wiring', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders TranslationResult when result contains a translation', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'requestAssistant').mockResolvedValue(
      baseResult({
        intent: 'translation',
        answerType: 'direct_translation',
        primaryContent: '辛くない牛丼をお願いします。',
        translation: {
          sourceText: '我想點一份不辣的牛丼',
          targetText: '辛くない牛丼をお願いします。',
          toneUsed: 'default',
        },
      }),
    );

    render(<AssistantScreen initialText="我想點一份不辣的牛丼" onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '送出' }));

    expect(await screen.findByRole('heading', { name: '翻譯結果' })).toBeInTheDocument();
  });

  it('renders TravelAnswer via AssistantScreen when result contains travelAnswer', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'requestAssistant').mockResolvedValue(
      baseResult({
        intent: 'travel',
        answerType: 'action_plan',
        primaryContent: '先到售票機購票',
        travelAnswer: {
          conclusion: '先到售票機購票',
          action: ['選擇目的地', '投入現金', '取票'],
        },
      }),
    );

    render(<AssistantScreen initialText="怎麼買車票" onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '送出' }));

    const article = await screen.findByRole('article', { name: '結論' });
    expect(article).toHaveTextContent('先到售票機購票');
  });

  it('renders EmergencyAnswerCard via AssistantScreen when result contains emergencyGuide', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'requestAssistant').mockResolvedValue(
      baseResult({
        intent: 'emergency',
        answerType: 'emergency_guide',
        safety: 'emergency',
        emergency: true,
        primaryContent: '立即撥打119',
        emergencyGuide: {
          immediateAction: ['撥打119'],
          nextAction: ['聯絡飯店櫃檯'],
        },
      }),
    );

    render(<AssistantScreen initialText="有人受傷了" onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '送出' }));

    const article = await screen.findByRole('article', { name: '緊急指引' });
    expect(article).toHaveTextContent('撥打119');
  });

  it('surfaces LiveDataStatus through AssistantScreen when live-data fields are present', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'requestAssistant').mockResolvedValue(
      baseResult({
        intent: 'travel',
        answerType: 'action_plan',
        freshness: 'live_required',
        liveDataStatus: 'verified',
        liveDataMessage: '班次資訊已於 5 分鐘前確認',
        liveDataNextAction: '出發前請再次確認時刻表',
        travelAnswer: { conclusion: '搭乘下一班列車', action: '前往月台' },
      }),
    );

    render(<AssistantScreen initialText="下一班車幾點" onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '送出' }));

    expect(await screen.findByText('班次資訊已於 5 分鐘前確認')).toBeInTheDocument();
    expect(screen.getByText('出發前請再次確認時刻表')).toBeInTheDocument();
  });

  it('clears the stale primary result as soon as a new submission starts', async () => {
    const user = userEvent.setup();
    let resolveSecond: (value: AssistantResult) => void = () => {};
    const secondPending = new Promise<AssistantResult>((resolve) => {
      resolveSecond = resolve;
    });
    const requestAssistantSpy = vi
      .spyOn(api, 'requestAssistant')
      .mockResolvedValueOnce(
        baseResult({
          intent: 'travel',
          answerType: 'action_plan',
          travelAnswer: { conclusion: '第一次的結論', action: '做某件事' },
        }),
      )
      .mockImplementationOnce(() => secondPending);

    render(<AssistantScreen initialText="怎麼買車票" onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '送出' }));
    expect(await screen.findByRole('article', { name: '結論' })).toHaveTextContent('第一次的結論');

    await user.click(screen.getByRole('button', { name: '送出' }));

    await waitFor(() => {
      expect(screen.queryByRole('article', { name: '結論' })).not.toBeInTheDocument();
    });

    resolveSecond(
      baseResult({
        intent: 'travel',
        answerType: 'action_plan',
        travelAnswer: { conclusion: '第二次的結論', action: '做另一件事' },
      }),
    );
    expect(await screen.findByRole('article', { name: '結論' })).toHaveTextContent('第二次的結論');
    expect(requestAssistantSpy).toHaveBeenCalledTimes(2);
  });

  it('sends the current textarea text on a second manual submit instead of the previous translation source', async () => {
    const user = userEvent.setup();
    const requestAssistantSpy = vi.spyOn(api, 'requestAssistant').mockImplementation(async (request) =>
      baseResult({
        intent: 'translation',
        answerType: 'direct_translation',
        primaryContent: '翻譯結果',
        translation: {
          sourceText: request.text,
          targetText: '翻譯結果',
          toneUsed: request.tone ?? 'default',
        },
      }),
    );

    render(<AssistantScreen initialText="第一句話" onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '送出' }));
    expect(await screen.findByRole('heading', { name: '翻譯結果' })).toBeInTheDocument();
    expect(requestAssistantSpy.mock.calls[0][0].text).toBe('第一句話');

    const input = screen.getByLabelText('輸入內容');
    await user.clear(input);
    await user.type(input, '第二句話');
    await user.click(screen.getByRole('button', { name: '送出' }));

    await waitFor(() => {
      expect(requestAssistantSpy).toHaveBeenCalledTimes(2);
    });
    expect(requestAssistantSpy.mock.calls[1][0].text).toBe('第二句話');
  });

  it('keeps using the previous translation source text when the user changes tone', async () => {
    const user = userEvent.setup();
    const requestAssistantSpy = vi.spyOn(api, 'requestAssistant').mockImplementation(async (request) =>
      baseResult({
        intent: 'translation',
        answerType: 'direct_translation',
        primaryContent: '翻譯結果',
        translation: {
          sourceText: request.text,
          targetText: '翻譯結果',
          toneUsed: request.tone ?? 'default',
        },
      }),
    );

    render(<AssistantScreen initialText="第一句話" onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '送出' }));
    expect(await screen.findByRole('heading', { name: '翻譯結果' })).toBeInTheDocument();

    const input = screen.getByLabelText('輸入內容');
    await user.clear(input);
    await user.type(input, '第二句話');
    await user.click(screen.getByRole('button', { name: '更禮貌' }));

    await waitFor(() => {
      expect(requestAssistantSpy).toHaveBeenCalledTimes(2);
    });
    expect(requestAssistantSpy.mock.calls[1][0].text).toBe('第一句話');
    expect(requestAssistantSpy.mock.calls[1][0].tone).toBe('polite');
  });

  it('shows StatusMessage on failure without keeping the previous primary answer visible', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'requestAssistant')
      .mockResolvedValueOnce(
        baseResult({
          intent: 'travel',
          answerType: 'action_plan',
          travelAnswer: { conclusion: '成功的結論', action: '做某件事' },
        }),
      )
      .mockRejectedValueOnce({
        code: 'NETWORK_ERROR',
        userTitle: '目前無法連線',
        userMessage: '請確認網路連線後再試一次。',
        actionableStep: '恢復網路後點擊重試。',
      });

    render(<AssistantScreen initialText="怎麼買車票" onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '送出' }));
    expect(await screen.findByRole('article', { name: '結論' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '送出' }));

    expect(await screen.findByRole('status')).toHaveTextContent('請確認網路連線後再試一次。');
    expect(screen.queryByRole('article', { name: '結論' })).not.toBeInTheDocument();
  });
});
