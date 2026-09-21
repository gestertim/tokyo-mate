# UI / Module Contracts: Travel Japanese

本 feature 不新增 `/api/*` HTTP endpoint，因此不提供傳統 API contract。以下記錄前端新增 module 對外
暴露的函式與 component 介面契約，作為 `/speckit.tasks` 與 implementation 的依據。

## 1. `src/services/travelJapanese.ts`

```ts
export function getAllPhrases(): TravelJapanesePhrase[];
export function getPhrasesByCategory(category: TravelJapaneseCategory): TravelJapanesePhrase[];
export function searchPhrases(query: string): TravelJapanesePhrase[];
export function getPhraseById(id: string): TravelJapanesePhrase | undefined;
export function getCategoryPlacementCounts(): Record<TravelJapaneseCategory, number>;
export function getUniquePhraseCount(): number;
export function validateTravelJapaneseDataset(): { valid: boolean; issues: string[] };
```

**Contract**:

- 全部為純函式，讀取模組層級靜態 import 的 dataset，無網路呼叫、無副作用。
- `getPhrasesByCategory` 僅回傳 `categories` 陣列包含該 category 的 phrase；`emergency` category 回傳
  結果 MUST 將 `safetyCritical === true` 的 phrase 排列在非 safety-critical phrase 之前（呼叫端據此
  呈現優先序，不需在 UI 層重新排序）。
- `searchPhrases(query)`：`query` 先 `trim().toLowerCase()`；空字串回傳空陣列（不等同「全部句子」，避免
  誤導使用者以為輸入即結果）。比對 `japanese` 與 `traditionalChinese` 兩欄位是否 `includes(normalizedQuery)`；
  同一 phrase 符合多個欄位時只回傳一次（依 `id` 去重）；沒有符合時回傳空陣列，不得回傳猜測結果。
  **UI 呈現區分**：呼叫端（`TravelJapaneseScreen` / `SearchBar`）MUST 區分「`searchQuery` 為空字串（尚未
  輸入）」與「`searchQuery` 非空但 `searchPhrases` 回傳空陣列（已輸入但無符合結果）」兩種情境，分別呈現
  不同文字的狀態（前者為中性提示，例如「輸入繁中或日文關鍵字以搜尋」；後者為 FR-018 要求的無結果空白
  狀態），不得對兩者顯示相同文字而讓使用者誤以為尚未輸入前 App 已判定「沒有結果」。
- `validateTravelJapaneseDataset()`：回傳 `valid: false` 時，`issues` 陣列 MUST 包含足以定位問題的可讀
  訊息（例如 `"category 'shopping' has 18 placements, expected >= 20"`），供測試與未來內容審查使用。

## 2. `src/features/travel-japanese/favorites.ts`

```ts
export function loadFavoriteIds(): string[];
export function persistFavoriteIds(ids: string[]): void;
```

**Contract**:

- `loadFavoriteIds()`：讀取 `localStorage` key `tokyo-mate:travel-japanese:favorites`；不存在、
  `JSON.parse` 失敗，或內容非 `string[]`（例如型別不符、包含非字串元素）時，回傳 `[]`，**不得拋出例外**。
- `persistFavoriteIds(ids)`：寫入前以 `JSON.stringify(ids)` 序列化；寫入失敗（例如
  `localStorage.setItem` 拋出 `QuotaExceededError` 或 `localStorage` 不可用）時內部 `catch`，**不得
  拋出例外**、不得影響呼叫端其餘邏輯。

## 3. `src/features/travel-japanese/phraseAudio.ts`

```ts
export type PlaybackStatus = 'idle' | 'requested' | 'playing' | 'failed';

export function isSpeechSynthesisAvailable(): boolean;
export function speakJapanese(
  text: string,
  handlers: { onStart?: () => void; onEnd?: () => void; onError?: () => void },
): void;
export function cancelSpeech(): void;
```

**Contract**:

- `isSpeechSynthesisAvailable()`：回傳 `typeof window !== 'undefined' && 'speechSynthesis' in window`；
  不檢查是否有 `ja-JP` voice（voice 可用性由 `speakJapanese` 執行期的 `onerror` 處理，不在此提前假設）。
- `speakJapanese`：內部建立 `SpeechSynthesisUtterance`，`lang = 'ja-JP'`；呼叫前**先呼叫
  `window.speechSynthesis.cancel()`** 取消既有播放，確保同一時間最多一個 active playback；`utterance`
  的 `onstart` → 呼叫 `handlers.onStart`；`onend` → 呼叫 `handlers.onEnd`；`onerror` → 呼叫
  `handlers.onError`。若 `isSpeechSynthesisAvailable()` 為 `false`，**不得**呼叫
  `window.speechSynthesis`，直接同步呼叫 `handlers.onError`。
- `cancelSpeech()`：呼叫 `window.speechSynthesis?.cancel()`；在 `speechSynthesis` 不存在時安全地
  no-op，不拋出例外。

## 4. `src/features/travel-japanese/PhraseCard.tsx`（Component Contract）

```ts
interface PhraseCardProps {
  phrase: TravelJapanesePhrase;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  isActivePlayback: boolean;
  playbackStatus: PlaybackStatus;      // 僅在 isActivePlayback 為 true 時具意義呈現
  audioAvailable: boolean;
  onPlay: (phrase: TravelJapanesePhrase) => void;
}
```

**Contract**:

- 日文文字節點 MUST 標記 `lang="ja"`。
- 收藏按鈕 MUST 具 `aria-pressed={isFavorite}` 與可理解的 accessible name（例如
  `aria-label={\`收藏：${phrase.japanese}\`}`），點擊呼叫 `onToggleFavorite(phrase.id)`。
- 播放按鈕：`audioAvailable === false` 時渲染為 `disabled`，並顯示簡短說明文字（非隱藏，維持可理解性）；
  `audioAvailable === true` 時點擊呼叫 `onPlay(phrase)`。
- 播放狀態呈現：`isActivePlayback && playbackStatus === 'playing'` 顯示「播放中」文字；
  `isActivePlayback && playbackStatus === 'requested'` 顯示「已要求播放」；
  `isActivePlayback && playbackStatus === 'failed'` 顯示「播放失敗」，且此時日文／繁中文字與收藏按鈕
  MUST 維持可操作（不得整卡 disabled）。
- `phrase.safetyCritical === true` 時 MUST 顯示非純顏色的視覺標示（圖示＋文字，例如
  `<span aria-hidden="true">⚠</span> 重要`），不得僅以文字顏色／背景色作為唯一辨識依據。

## 5. `src/features/travel-japanese/SafetyReminder.tsx`（Component Contract）

```ts
// 無 props，或僅接受 className 等純樣式性 prop；內容固定，非可設定文案
export function SafetyReminder(): JSX.Element;
```

**Contract**:

- 於 `emergency` category 的 `category-detail` view 中，MUST 在 phrase 清單**上方直接渲染**（不得包在
  需額外點擊才展開的區塊、不得僅存在於「更多資訊」連結內、不得僅有 accessibility-only 而視覺隱藏）。
- 內容 MUST 傳達：翻譯僅供溝通輔助參考、緊急狀況仍須尋求正式協助（對應 FR-035／spec Clarification）。
- MUST 使用語義化標記（例如 `role="note"` 或等效可被 assistive technology 辨識的結構），且視覺呈現
  不得僅依賴顏色（需有可讀文字本身，圖示為輔助而非取代文字）。
- 元件測試 MUST 驗證：進入 `emergency` category-detail 時，`SafetyReminder` 存在於 DOM 且可見（非
  `display:none`／`aria-hidden="true"`／需互動才出現）。

## 6. `src/screens/TravelJapaneseScreen.tsx`（State Owner Contract）

```ts
interface TravelJapaneseScreenProps { onBack: () => void; }
```

**Contract**:

- 持有 `view` / `selectedCategory` / `searchQuery` / `favoriteIds` / `activePhraseId` /
  `playbackStatus`（見 data-model.md 第 5 節），並於 mount 時以 `loadFavoriteIds()` 初始化
  `favoriteIds`。
- `favoriteIds` 每次變化後呼叫 `persistFavoriteIds(Array.from(favoriteIds))`（例如透過 `useEffect`
  依賴 `favoriteIds`）。
- 所有 view（`category-detail` / `search` / `favorites`）渲染 `PhraseCard` 時，MUST 傳入同一個
  `favoriteIds` 衍生的 `isFavorite` 判斷與同一組 `onToggleFavorite` / `onPlay` callback，確保跨 view
  行為與狀態一致（FR-022）。
- `onPlay(phrase)` 呼叫 `phraseAudio.speakJapanese`，並依 handlers 更新 `activePhraseId` /
  `playbackStatus`（見 data-model.md 第 5 節「狀態轉換：Playback」）。
- Component unmount 時（`useEffect` cleanup）MUST 呼叫 `phraseAudio.cancelSpeech()`。
- `onBack` 呼叫時不清除 `favoriteIds`（已持久化，下次進入 Feature 或重開 App 仍應反映）；`view` /
  `selectedCategory` / `searchQuery` / `activePhraseId` / `playbackStatus` 為單次 session 的暫時狀態，
  不需持久化。
