import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeBrowser } from '../../screens/KnowledgeBrowser';
import { TravelAnswer } from '../travel/TravelAnswer';

const categories = [
  { label: '區域', title: '淺草區域指南' },
  { label: '交通', title: 'JR 路線與轉乘' },
  { label: '美食', title: '拉麵與日式餐食' },
  { label: '購物', title: '百貨與購物指南' },
  { label: '文化', title: '餐廳與公共場所禮儀' },
  { label: '緊急', title: '警察與失物處理' },
] as const;

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

afterEach(() => {
  if (originalClipboard) {
    Object.defineProperty(navigator, 'clipboard', originalClipboard);
  } else {
    delete (navigator as { clipboard?: Clipboard }).clipboard;
  }
});

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

  it.each(categories)('shows the complete static $label catalog instead of AI Top 5 results', async ({ label, title }) => {
    const user = userEvent.setup();
    render(<KnowledgeBrowser onBack={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: label }));

    expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it('switches the selected category without retaining entries from the previous category', async () => {
    const user = userEvent.setup();
    render(<KnowledgeBrowser onBack={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '區域' }));
    expect(screen.getByText('淺草區域指南')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '交通' }));
    expect(screen.getByRole('button', { name: '交通' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '區域' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('JR 路線與轉乘')).toBeInTheDocument();
    expect(screen.queryByText('淺草區域指南')).not.toBeInTheDocument();
  });

  it('keeps a card summary visible and exposes its details through a keyboard-operable control', async () => {
    const user = userEvent.setup();
    render(<KnowledgeBrowser onBack={vi.fn()} />);

    expect(screen.getByText('淺草區域指南')).toBeInTheDocument();
    expect(screen.getByText('寺廟、仲見世與雷門周邊適合午後散策與用餐。')).toBeInTheDocument();
    expect(screen.queryByText('仲見世商店街')).not.toBeInTheDocument();

    const expandControl = screen.getByRole('button', { name: /淺草區域指南.*展開/ });
    expect(expandControl).toHaveAttribute('aria-expanded', 'false');
    const detailsId = expandControl.getAttribute('aria-controls');
    expect(detailsId).toBeTruthy();
    expect(document.getElementById(detailsId!)).toBeInTheDocument();

    expandControl.focus();
    await user.keyboard('{Enter}');
    expect(expandControl).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('仲見世商店街')).toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(expandControl).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('仲見世商店街')).not.toBeInTheDocument();
  });

  it('isolates expanded state between cards and renders only optional content provided by each category', async () => {
    const user = userEvent.setup();
    render(<KnowledgeBrowser onBack={vi.fn()} />);

    const asakusaControl = screen.getByRole('button', { name: /淺草區域指南.*展開/ });
    const uenoControl = screen.getByRole('button', { name: /上野區域指南.*展開/ });
    await user.click(asakusaControl);

    expect(screen.getByText('亮點')).toBeInTheDocument();
    expect(screen.getByText('怎麼逛')).toBeInTheDocument();
    expect(screen.getByText('建議停留時間')).toBeInTheDocument();
    expect(screen.queryByText('日夜差異')).not.toBeInTheDocument();
    expect(uenoControl).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('button', { name: '交通' }));
    const transportControl = screen.getByRole('button', { name: /JR 路線與轉乘.*展開/ });
    await user.click(transportControl);
    expect(screen.getByText('交通提示')).toBeInTheDocument();
    expect(screen.queryByText('必吃必買')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '美食' }));
    const foodControl = screen.getByRole('button', { name: /拉麵與日式餐食.*展開/ });
    await user.click(foodControl);
    expect(screen.getByText('必吃必買')).toBeInTheDocument();
  });

  it('copies practical Japanese and announces the accessible success status', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<KnowledgeBrowser onBack={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /淺草區域指南.*展開/ }));
    expect(screen.getByText('浅草駅までどのくらいかかりますか？')).toBeInTheDocument();
    expect(screen.getByText('到淺草站大約多久？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /複製.*浅草駅までどのくらいかかりますか？/ }));
    expect(writeText).toHaveBeenCalledWith('浅草駅までどのくらいかかりますか？');
    expect(screen.getByRole('status')).toHaveTextContent(/已複製/);
  });

  it('keeps practical Japanese readable when clipboard and speech playback fail', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<KnowledgeBrowser onBack={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /淺草區域指南.*展開/ }));
    const copyControl = screen.getByRole('button', { name: /複製.*浅草駅までどのくらいかかりますか？/ });
    expect(screen.getByRole('button', { name: '播放語音' })).toBeInTheDocument();

    await user.click(copyControl);
    expect(writeText).toHaveBeenCalledWith('浅草駅までどのくらいかかりますか？');
    expect(screen.getByRole('status')).toHaveTextContent(/無法複製/);
    expect(screen.getByText('浅草駅までどのくらいかかりますか？')).toBeInTheDocument();
    expect(screen.getByText('到淺草站大約多久？')).toBeInTheDocument();
  });
});
