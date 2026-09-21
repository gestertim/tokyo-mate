import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PhraseCard } from './PhraseCard';
import type { TravelJapanesePhrase } from '../../types/travelJapanese';

const phrase: TravelJapanesePhrase = {
  id: 'tj-001',
  japanese: 'パスポートです。',
  traditionalChinese: '這是我的護照。',
  categories: ['airport'],
};

const safetyPhrase: TravelJapanesePhrase = {
  id: 'tj-078',
  japanese: '警察を呼んでください。',
  traditionalChinese: '請幫我叫警察。',
  categories: ['emergency'],
  safetyCritical: true,
};

function renderCard(overrides: Partial<React.ComponentProps<typeof PhraseCard>> = {}) {
  const props: React.ComponentProps<typeof PhraseCard> = {
    phrase,
    isFavorite: false,
    onToggleFavorite: vi.fn(),
    isActivePlayback: false,
    playbackStatus: 'idle',
    audioAvailable: true,
    onPlay: vi.fn(),
    ...overrides,
  };
  render(<PhraseCard {...props} />);
  return props;
}

describe('PhraseCard（Phase 3 US1 + Phase 7 US5 安全標示）', () => {
  it('同時渲染日文文字（具 lang="ja"）與繁體中文文字', () => {
    renderCard();
    const japaneseNode = screen.getByText('パスポートです。');
    expect(japaneseNode).toHaveAttribute('lang', 'ja');
    expect(screen.getByText('這是我的護照。')).toBeInTheDocument();
  });

  it('播放按鈕與收藏按鈕（aria-pressed）皆存在', () => {
    renderCard();
    expect(screen.getByRole('button', { name: /播放/ })).toBeInTheDocument();
    const favoriteButton = screen.getByRole('button', { name: /收藏/ });
    expect(favoriteButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('點擊收藏按鈕呼叫 onToggleFavorite(phrase.id)', async () => {
    const user = userEvent.setup();
    const props = renderCard();
    await user.click(screen.getByRole('button', { name: /收藏/ }));
    expect(props.onToggleFavorite).toHaveBeenCalledWith('tj-001');
  });

  it('點擊播放按鈕呼叫 onPlay(phrase)', async () => {
    const user = userEvent.setup();
    const props = renderCard();
    await user.click(screen.getByRole('button', { name: /播放/ }));
    expect(props.onPlay).toHaveBeenCalledWith(phrase);
  });

  it('audioAvailable 為 false 時播放按鈕 disabled 並顯示說明文字', () => {
    renderCard({ audioAvailable: false });
    expect(screen.getByRole('button', { name: /播放/ })).toBeDisabled();
    expect(screen.getByText(/此裝置無法播放語音|語音功能無法使用/)).toBeInTheDocument();
  });

  it('safetyCritical: true 的 phrase 顯示圖示＋文字標示（非純顏色）', () => {
    renderCard({ phrase: safetyPhrase });
    expect(screen.getByText('重要')).toBeInTheDocument();
  });

  it('isActivePlayback + playing 顯示「播放中」文字', () => {
    renderCard({ isActivePlayback: true, playbackStatus: 'playing' });
    expect(screen.getByText('播放中')).toBeInTheDocument();
  });

  it('isActivePlayback + requested 顯示「已要求播放」文字', () => {
    renderCard({ isActivePlayback: true, playbackStatus: 'requested' });
    expect(screen.getByText('已要求播放')).toBeInTheDocument();
  });

  it('isActivePlayback + failed 顯示「播放失敗」，且日文/繁中/收藏按鈕仍可操作', () => {
    renderCard({ isActivePlayback: true, playbackStatus: 'failed' });
    expect(screen.getByText('播放失敗')).toBeInTheDocument();
    expect(screen.getByText('パスポートです。')).toBeInTheDocument();
    expect(screen.getByText('這是我的護照。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /收藏/ })).not.toBeDisabled();
  });
});
