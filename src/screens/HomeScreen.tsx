import { useState } from 'react';
import { AssistantScreen } from './AssistantScreen';
import { NearbyScreen } from './NearbyScreen';
import { PhotoTranslateScreen } from './PhotoTranslateScreen';
import { TravelJapaneseScreen } from './TravelJapaneseScreen';
import { VoiceInputModal } from '../features/speech/VoiceInputModal';

interface HomeScreenProps { onOpenKnowledge?: () => void; }

export function HomeScreen({ onOpenKnowledge }: HomeScreenProps) {
  const [text, setText] = useState('');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [photoTranslateOpen, setPhotoTranslateOpen] = useState(false);
  const [travelJapaneseOpen, setTravelJapaneseOpen] = useState(false);
  if (assistantOpen) return <AssistantScreen initialText={text} onBack={() => setAssistantOpen(false)} />;
  if (nearbyOpen) return <NearbyScreen onBack={() => setNearbyOpen(false)} />;
  if (photoTranslateOpen) return <PhotoTranslateScreen onBack={() => setPhotoTranslateOpen(false)} />;
  if (travelJapaneseOpen) return <TravelJapaneseScreen onBack={() => setTravelJapaneseOpen(false)} />;
  return <section aria-labelledby="home-heading">
    <h2 id="home-heading">東京旅程，從一句話開始</h2>
    <p>翻譯、問東京、探索附近，或打開東京百科。</p>
    <label>想說什麼？<textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="例如：我想點一份不辣的牛丼" /></label>
    <div role="group" aria-label="主要操作">
      <button type="button" onClick={() => setAssistantOpen(true)} disabled={!text.trim()}>送出</button>
      <button type="button" onClick={() => setVoiceOpen(true)}>麥克風</button>
    </div>
    <nav aria-label="東京功能入口">
      <button type="button" onClick={() => setAssistantOpen(true)}>即時翻譯</button>
      <button type="button" onClick={() => setAssistantOpen(true)}>問東京</button>
      <button type="button" onClick={() => setNearbyOpen(true)}>探索附近</button>
      <button type="button" onClick={onOpenKnowledge}>東京百科</button>
      <button type="button" onClick={() => setPhotoTranslateOpen(true)} aria-label="拍照翻譯：拍照或選圖翻譯文字">拍照翻譯</button>
      <button type="button" onClick={() => setTravelJapaneseOpen(true)}>旅遊日文</button>
    </nav>
    {voiceOpen && <VoiceInputModal onTranscript={(value) => { setText(value); setVoiceOpen(false); }} onClose={() => setVoiceOpen(false)} />}
  </section>;
}