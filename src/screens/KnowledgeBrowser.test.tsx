import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as knowledge from '../services/knowledge';
import { KnowledgeBrowser } from './KnowledgeBrowser';

vi.mock('../services/knowledge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/knowledge')>();
  return { ...actual, getKnowledgeEntriesByCategory: vi.fn(actual.getKnowledgeEntriesByCategory) };
});

const categories = [
  ['區域', '淺草區域指南'],
  ['交通', 'JR 路線與轉乘'],
  ['美食', '拉麵與日式餐食'],
  ['購物', '百貨與購物指南'],
  ['文化', '餐廳與公共場所禮儀'],
  ['緊急', '警察與失物處理'],
] as const;

const getEntriesByCategory = vi.mocked(knowledge.getKnowledgeEntriesByCategory);

afterEach(() => {
  getEntriesByCategory.mockClear();
});

describe('KnowledgeBrowser', () => {
  it('switches all six static categories by keyboard without external requests', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<KnowledgeBrowser onBack={vi.fn()} />);

    for (const [label, title] of categories) {
      const control = screen.getByRole('button', { name: label });
      expect(control).toHaveAttribute('aria-pressed', label === '區域' ? 'true' : 'false');
      control.focus();
      await user.keyboard('{Enter}');
      expect(control).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText(title)).toBeInTheDocument();
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders the approved empty state without cards or requests and retains usable controls', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    getEntriesByCategory.mockReturnValueOnce([]);
    render(<KnowledgeBrowser onBack={onBack} />);

    expect(screen.getByText('目前沒有符合內容。')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /knowledge/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '交通' }));
    expect(screen.getByText('JR 路線與轉乘')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '返回首頁' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});