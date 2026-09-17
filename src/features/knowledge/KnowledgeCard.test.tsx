import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../services/api';
import type { KnowledgeEntry } from '../../types/knowledge';
import { KnowledgeCard } from './KnowledgeCard';

const entry: KnowledgeEntry = {
  id: 'card-test',
  category: 'area',
  title: '測試區域指南',
  summary: '預設可讀的摘要。',
  tags: [],
  updatedAt: '2026-09-17',
  content: {
    highlights: ['測試亮點'],
    importantNotes: ['測試注意事項'],
    practicalJapanese: [
      { japanese: '駅はどこですか？', meaning: '車站在哪裡？' },
      { japanese: '助けてください。', meaning: '請幫幫我。' },
    ],
  },
};

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

afterEach(() => {
  vi.restoreAllMocks();
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else delete (navigator as { clipboard?: Clipboard }).clipboard;
});

describe('KnowledgeCard', () => {
  it('keeps the summary visible and exposes details through keyboard-operable ARIA controls', async () => {
    const user = userEvent.setup();
    render(<KnowledgeCard entry={entry} />);

    expect(screen.getByText(entry.title)).toBeInTheDocument();
    expect(screen.getByText(entry.summary)).toBeInTheDocument();
    const control = screen.getByRole('button', { name: /測試區域指南.*展開/ });
    expect(control).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(control.getAttribute('aria-controls')!)).toBeInTheDocument();

    control.focus();
    await user.keyboard('{Enter}');
    expect(control).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('測試亮點')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(control).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders supplied optional content and multiple Japanese phrases without empty sections', async () => {
    const user = userEvent.setup();
    render(<KnowledgeCard entry={entry} />);
    await user.click(screen.getByRole('button', { name: /展開/ }));

    expect(screen.getByText('測試亮點')).toBeInTheDocument();
    expect(screen.getByText('測試注意事項')).toBeInTheDocument();
    expect(screen.getByText('駅はどこですか？')).toBeInTheDocument();
    expect(screen.getByText('車站在哪裡？')).toBeInTheDocument();
    expect(screen.getByText('助けてください。')).toBeInTheDocument();
    expect(screen.queryByText('怎麼逛')).not.toBeInTheDocument();
    expect(screen.queryByText('必吃必買')).not.toBeInTheDocument();
  });

  it('reports Clipboard success, rejection, and unavailability while retaining readable text', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { rerender } = render(<KnowledgeCard entry={entry} />);
    await user.click(screen.getByRole('button', { name: /展開/ }));
    await user.click(screen.getByRole('button', { name: /複製 駅はどこですか/ }));
    expect(writeText).toHaveBeenCalledWith('駅はどこですか？');
    expect(screen.getByRole('status')).toHaveTextContent('已複製實用日文。');

    writeText.mockRejectedValueOnce(new Error('denied'));
    await user.click(screen.getByRole('button', { name: /複製 助けてください/ }));
    expect(screen.getByRole('status')).toHaveTextContent('無法複製，請手動選取日文。');

    delete (navigator as { clipboard?: Clipboard }).clipboard;
    rerender(<KnowledgeCard entry={entry} />);
    await user.click(screen.getByRole('button', { name: /複製 駅はどこですか/ }));
    expect(screen.getByRole('status')).toHaveTextContent('無法複製，請手動選取日文。');
    expect(screen.getByText('駅はどこですか？')).toBeInTheDocument();
  });

  it('offers audio controls and keeps the Japanese text available when speech fails', async () => {
    const user = userEvent.setup();
    const speechSpy = vi.spyOn(api, 'generateSpeech').mockRejectedValue(new Error('offline'));
    render(<KnowledgeCard entry={entry} />);
    await user.click(screen.getByRole('button', { name: /展開/ }));

    expect(screen.getAllByRole('button', { name: '播放語音' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '慢速播放' })).toHaveLength(2);
    await user.click(screen.getAllByRole('button', { name: '播放語音' })[0]);
    expect(speechSpy).toHaveBeenCalledWith({ text: '駅はどこですか？', language: 'ja', speed: 'normal' });
    expect(await screen.findByRole('status')).toHaveTextContent('語音播放暫時無法使用');
    expect(screen.getByText('駅はどこですか？')).toBeInTheDocument();
    expect(speechSpy).toHaveBeenCalledTimes(1);
  });
});