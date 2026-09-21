import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FavoritesList } from './FavoritesList';
import type { TravelJapanesePhrase } from '../../types/travelJapanese';

const phrase: TravelJapanesePhrase = {
  id: 'tj-001',
  japanese: 'パスポートです。',
  traditionalChinese: '這是我的護照。',
  categories: ['airport'],
};

function baseProps(overrides: Partial<React.ComponentProps<typeof FavoritesList>> = {}) {
  return {
    phrases: [],
    favoriteIds: new Set<string>(),
    onToggleFavorite: vi.fn(),
    playbackStatus: 'idle' as const,
    audioAvailable: true,
    onPlay: vi.fn(),
    onBrowseCategories: vi.fn(),
    onSearch: vi.fn(),
    ...overrides,
  };
}

describe('FavoritesList（Phase 6 US4）', () => {
  it('有收藏時渲染 PhraseCard 清單', () => {
    render(<FavoritesList {...baseProps({ phrases: [phrase], favoriteIds: new Set(['tj-001']) })} />);
    expect(screen.getByText('パスポートです。')).toBeInTheDocument();
    expect(screen.getByText('這是我的護照。')).toBeInTheDocument();
  });

  it('無收藏時顯示可理解空白狀態並提供回到情境瀏覽或搜尋的方式', () => {
    render(<FavoritesList {...baseProps()} />);
    expect(screen.getByText(/尚未收藏任何句子/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '瀏覽情境' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '搜尋句子' })).toBeInTheDocument();
  });
});
