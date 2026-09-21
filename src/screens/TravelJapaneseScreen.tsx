import { useEffect, useState } from 'react';
import { CategoryList } from '../features/travel-japanese/CategoryList';
import { PhraseCard } from '../features/travel-japanese/PhraseCard';
import { SearchBar } from '../features/travel-japanese/SearchBar';
import { FavoritesList } from '../features/travel-japanese/FavoritesList';
import { SafetyReminder } from '../features/travel-japanese/SafetyReminder';
import { loadFavoriteIds, persistFavoriteIds } from '../features/travel-japanese/favorites';
import { cancelPlayback, isSpeechSynthesisAvailable, playBundledAudio, speakJapanese } from '../features/travel-japanese/phraseAudio';
import type { PlaybackStatus } from '../features/travel-japanese/phraseAudio';
import { playTestTone } from '../features/travel-japanese/audioDiagnostic';
import type { DiagnosticStatus } from '../features/travel-japanese/audioDiagnostic';
import { getAllPhrases, getPhrasesByCategory, searchPhrases, TRAVEL_JAPANESE_CATEGORY_LABELS } from '../services/travelJapanese';
import type { TravelJapaneseCategory, TravelJapanesePhrase } from '../types/travelJapanese';

type TravelJapaneseView = 'categories' | 'category-detail' | 'search' | 'favorites';

// T055 STOP GATE 仍為 BLOCKED：以下狀態標籤僅供 Android PWA static audio engineering diagnostic 使用，非正式產品文案。
const DIAGNOSTIC_STATUS_LABEL: Record<DiagnosticStatus, string> = {
  idle: '',
  requested: '準備播放',
  playing: '播放中',
  success: '播放成功',
  failed: '播放失敗',
};

interface TravelJapaneseScreenProps {
  onBack: () => void;
}

function isDisplayablePhrase(phrase: TravelJapanesePhrase): boolean {
  return typeof phrase.japanese === 'string' && phrase.japanese.trim() !== ''
    && typeof phrase.traditionalChinese === 'string' && phrase.traditionalChinese.trim() !== '';
}

export function TravelJapaneseScreen({ onBack }: TravelJapaneseScreenProps) {
  const [view, setView] = useState<TravelJapaneseView>('categories');
  const [selectedCategory, setSelectedCategory] = useState<TravelJapaneseCategory | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(loadFavoriteIds()));
  const [activePhraseId, setActivePhraseId] = useState<string | undefined>(undefined);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('idle');
  const [diagnosticStatus, setDiagnosticStatus] = useState<DiagnosticStatus>('idle');
  const [diagnosticMessage, setDiagnosticMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    persistFavoriteIds(Array.from(favoriteIds));
  }, [favoriteIds]);

  useEffect(() => {
    return () => cancelPlayback();
  }, []);

  const audioAvailable = isSpeechSynthesisAvailable();

  function handleToggleFavorite(id: string) {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePlay(phrase: TravelJapanesePhrase) {
    setActivePhraseId(phrase.id);
    setPlaybackStatus('requested');
    playBundledAudio(phrase.id, {
      onPlaying: () => setPlaybackStatus('playing'),
      onEnded: () => {
        setActivePhraseId(undefined);
        setPlaybackStatus('idle');
      },
      onError: () => {
        // Primary（bundled MP3）失敗才進入 Fallback（SpeechSynthesis）。
        speakJapanese(phrase.japanese, {
          onStart: () => setPlaybackStatus('playing'),
          onEnd: () => {
            setActivePhraseId(undefined);
            setPlaybackStatus('idle');
          },
          onError: () => setPlaybackStatus('failed'),
        });
      },
    });
  }

  function handleSelectCategory(category: TravelJapaneseCategory) {
    setSelectedCategory(category);
    setView('category-detail');
  }

  // Engineering diagnostic only（T055 STOP GATE 仍 BLOCKED，非正式功能）：驗證 static test-tone.wav
  // 是否能透過 HTMLAudioElement 在 Android installed PWA 上播放，與正式 phrase 音檔／SpeechSynthesis 無關。
  function handleTestTone() {
    setDiagnosticMessage(undefined);
    playTestTone({
      onRequested: () => setDiagnosticStatus('requested'),
      onPlaying: () => setDiagnosticStatus('playing'),
      onSuccess: () => setDiagnosticStatus('success'),
      onError: (message) => {
        setDiagnosticStatus('failed');
        setDiagnosticMessage(message);
      },
    });
  }

  function renderPhraseCards(phrases: TravelJapanesePhrase[]) {
    return phrases.map((phrase) => (
      <PhraseCard
        key={phrase.id}
        phrase={phrase}
        isFavorite={favoriteIds.has(phrase.id)}
        onToggleFavorite={handleToggleFavorite}
        isActivePlayback={activePhraseId === phrase.id}
        playbackStatus={playbackStatus}
        audioAvailable={audioAvailable}
        onPlay={handlePlay}
      />
    ));
  }

  if (view === 'category-detail' && selectedCategory) {
    const rawPhrases = getPhrasesByCategory(selectedCategory);
    const validPhrases = rawPhrases.filter(isDisplayablePhrase);
    const isAnomalous = rawPhrases.length > 0 && validPhrases.length === 0;

    return (
      <section aria-labelledby="travel-japanese-heading">
        <h2 id="travel-japanese-heading">{TRAVEL_JAPANESE_CATEGORY_LABELS[selectedCategory]}</h2>
        <button type="button" onClick={() => setView('categories')}>返回情境清單</button>
        {selectedCategory === 'emergency' && <SafetyReminder />}
        {isAnomalous ? (
          <div className="travel-japanese-dataset-anomaly">
            <p>目前無法顯示這個情境的句子，請稍後再試或返回其他情境。</p>
          </div>
        ) : (
          <div className="travel-japanese-phrase-list">{renderPhraseCards(validPhrases)}</div>
        )}
      </section>
    );
  }

  if (view === 'search') {
    const results = searchPhrases(searchQuery);
    return (
      <section aria-labelledby="travel-japanese-heading">
        <h2 id="travel-japanese-heading">搜尋旅遊日文</h2>
        <button type="button" onClick={() => setView('categories')}>返回情境清單</button>
        <SearchBar query={searchQuery} onQueryChange={setSearchQuery} />
        {searchQuery.trim() !== '' && results.length === 0 && <p>沒有找到符合的句子，請嘗試其他關鍵字。</p>}
        <div className="travel-japanese-phrase-list">{renderPhraseCards(results)}</div>
      </section>
    );
  }

  if (view === 'favorites') {
    const favoritePhrases = getAllPhrases().filter((phrase) => favoriteIds.has(phrase.id));
    return (
      <section aria-labelledby="travel-japanese-heading">
        <h2 id="travel-japanese-heading">我的常用句</h2>
        <button type="button" onClick={() => setView('categories')}>返回情境清單</button>
        <FavoritesList
          phrases={favoritePhrases}
          favoriteIds={favoriteIds}
          onToggleFavorite={handleToggleFavorite}
          activePhraseId={activePhraseId}
          playbackStatus={playbackStatus}
          audioAvailable={audioAvailable}
          onPlay={handlePlay}
          onBrowseCategories={() => setView('categories')}
          onSearch={() => setView('search')}
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="travel-japanese-heading">
      <h2 id="travel-japanese-heading">旅遊日文</h2>
      <p>選擇旅行情境，找到可直接展示給日本人看的日文句子。</p>
      <button type="button" onClick={onBack}>返回首頁</button>
      <div role="group" aria-label="旅遊日文操作">
        <button type="button" onClick={() => setView('search')}>搜尋</button>
        <button type="button" onClick={() => setView('favorites')}>我的常用句</button>
      </div>
      <CategoryList onSelectCategory={handleSelectCategory} />
      <div aria-label="音訊播放診斷（暫時測試用，非正式功能）">
        <p>診斷用：測試音訊（非正式功能，用於確認裝置可播放 App 提供的音檔）</p>
        <button type="button" onClick={handleTestTone}>測試音訊</button>
        {diagnosticStatus !== 'idle' && <p role="status">{DIAGNOSTIC_STATUS_LABEL[diagnosticStatus]}</p>}
        {diagnosticStatus === 'failed' && diagnosticMessage && <p>{diagnosticMessage}</p>}
      </div>
    </section>
  );
}
