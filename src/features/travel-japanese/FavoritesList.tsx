import { PhraseCard } from './PhraseCard';
import type { PlaybackStatus } from './phraseAudio';
import type { TravelJapanesePhrase } from '../../types/travelJapanese';

interface FavoritesListProps {
  phrases: TravelJapanesePhrase[];
  favoriteIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  activePhraseId?: string;
  playbackStatus: PlaybackStatus;
  audioAvailable: boolean;
  onPlay: (phrase: TravelJapanesePhrase) => void;
  onBrowseCategories: () => void;
  onSearch: () => void;
}

export function FavoritesList({
  phrases,
  favoriteIds,
  onToggleFavorite,
  activePhraseId,
  playbackStatus,
  audioAvailable,
  onPlay,
  onBrowseCategories,
  onSearch,
}: FavoritesListProps) {
  if (phrases.length === 0) {
    return (
      <div className="travel-japanese-favorites-empty">
        <p>尚未收藏任何句子。收藏後會顯示在這裡，方便下次直接使用。</p>
        <button type="button" onClick={onBrowseCategories}>瀏覽情境</button>
        <button type="button" onClick={onSearch}>搜尋句子</button>
      </div>
    );
  }

  return (
    <div className="travel-japanese-favorites-list">
      {phrases.map((phrase) => (
        <PhraseCard
          key={phrase.id}
          phrase={phrase}
          isFavorite={favoriteIds.has(phrase.id)}
          onToggleFavorite={onToggleFavorite}
          isActivePlayback={activePhraseId === phrase.id}
          playbackStatus={playbackStatus}
          audioAvailable={audioAvailable}
          onPlay={onPlay}
        />
      ))}
    </div>
  );
}
