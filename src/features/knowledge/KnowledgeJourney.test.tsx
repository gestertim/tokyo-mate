import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KnowledgeBrowser } from '../../screens/KnowledgeBrowser';
import { TravelAnswer } from '../travel/TravelAnswer';

describe('knowledge journey', () => {
  it('renders styled travel answer in the required order', () => {
    render(
      <TravelAnswer
        travelAnswer={{
          conclusion: '淺草適合先逛寺廟再吃晚餐。',
          action: ['先從雷門出發', '傍晚前往上野用餐'],
          caution: ['避開假日尖峰時段'],
          phrase: { japanese: '上野駅までどのくらいかかりますか？', meaning: '到上野站大約多久？' },
        }}
      />,
    );

    expect(screen.getByText('結論')).toBeInTheDocument();
    expect(screen.getByText('淺草適合先逛寺廟再吃晚餐。')).toBeInTheDocument();
    expect(screen.getByText('怎麼做')).toBeInTheDocument();
    expect(screen.getByText('注意事項')).toBeInTheDocument();
    expect(screen.getByText('實用日文')).toBeInTheDocument();
  });

  it('does not crash when a malformed array-like field slips past server normalization', () => {
    render(
      <TravelAnswer
        travelAnswer={{
          conclusion: '先去淺草寺再吃晚餐',
          action: '先去淺草寺' as unknown as string[],
          caution: '假日人潮較多' as unknown as string[],
        }}
      />,
    );

    expect(screen.getByText('結論')).toBeInTheDocument();
    expect(screen.getByText('先去淺草寺')).toBeInTheDocument();
    expect(screen.queryByText('假日人潮較多')).not.toBeInTheDocument();
  });

  it('shows knowledge categories and entries for offline browsing', () => {
    render(<KnowledgeBrowser onBack={vi.fn()} />);

    expect(screen.getByRole('button', { name: '區域' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '交通' })).toBeInTheDocument();
    expect(screen.getByText('東京百科')).toBeInTheDocument();
  });

  it('returns to home when the back control is used', () => {
    const onBack = vi.fn();
    render(<KnowledgeBrowser onBack={onBack} />);

    screen.getByRole('button', { name: '返回首頁' }).click();

    expect(onBack).toHaveBeenCalledOnce();
  });
});
