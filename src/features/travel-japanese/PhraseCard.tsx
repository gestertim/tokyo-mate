import type { PlaybackStatus } from './phraseAudio';
import type { TravelJapanesePhrase } from '../../types/travelJapanese';

interface PhraseCardProps {
  phrase: TravelJapanesePhrase;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  isActivePlayback: boolean;
  playbackStatus: PlaybackStatus;
  audioAvailable: boolean;
  onPlay: (phrase: TravelJapanesePhrase) => void;
}

const PLAYBACK_STATUS_LABEL: Record<PlaybackStatus, string | null> = {
  idle: null,
  requested: '已要求播放',
  playing: '播放中',
  failed: '播放失敗',
};

export function PhraseCard({ phrase, isFavorite, onToggleFavorite, isActivePlayback, playbackStatus, audioAvailable, onPlay }: PhraseCardProps) {
  const statusLabel = isActivePlayback ? PLAYBACK_STATUS_LABEL[playbackStatus] : null;
  // Hotfix（Button Interaction Guard）：僅在「此卡片為目前 active phrase 且播放進行中」時 disable 自己的
  // 播放按鈕，避免同一句被快速重複點擊造成 attempt race；不影響其他 phrase 的播放按鈕。
  const isPlaybackBusy = isActivePlayback && (playbackStatus === 'requested' || playbackStatus === 'playing');

  return (
    <article className="travel-japanese-phrase-card">
      {phrase.safetyCritical && (
        <p className="travel-japanese-safety-badge">
          <span aria-hidden="true">⚠</span> 重要
        </p>
      )}
      <p lang="ja" className="travel-japanese-phrase-japanese">{phrase.japanese}</p>
      <p className="travel-japanese-phrase-chinese">{phrase.traditionalChinese}</p>
      <div className="travel-japanese-phrase-actions">
        <button type="button" onClick={() => onPlay(phrase)} disabled={!audioAvailable || isPlaybackBusy}>
          播放
        </button>
        {!audioAvailable && <p className="travel-japanese-audio-unavailable">此裝置無法播放語音，請直接展示日文文字給對方看。</p>}
        <button
          type="button"
          aria-pressed={isFavorite}
          aria-label={`收藏：${phrase.japanese}`}
          onClick={() => onToggleFavorite(phrase.id)}
        >
          {isFavorite ? '取消收藏' : '收藏'}
        </button>
      </div>
      {statusLabel && (
        <p aria-live="polite" className={`travel-japanese-playback-status travel-japanese-playback-status--${playbackStatus}`}>
          {statusLabel}
        </p>
      )}
    </article>
  );
}
