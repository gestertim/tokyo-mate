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

> **Maintenance Amendment（2026-09-21，Documentation Consistency Sync）**：下方 contract 已由原始
> 「僅 `SpeechSynthesis`」單層 module 契約，更新為已批准之三層策略（Primary｜App-bundled MP3 →
> Fallback｜`SpeechSynthesis` → Final fallback｜文字），對應 [plan.md](../plan.md) 「八、Audio
> Technology Decision」與「九、Audio Strategy Escalation Gate」，兩者為完整決策與 timeout/
> terminal-state 規則的權威來源；本節僅定義可轉換為 implementation 的函式簽章與可觀察行為契約。

```ts
export type PlaybackStatus = 'idle' | 'requested' | 'playing' | 'failed';

export function isSpeechSynthesisAvailable(): boolean;

export function playBundledAudio(
  phraseId: string,
  handlers: { onPlaying?: () => void; onEnded?: () => void; onError?: () => void },
): void;

export function speakJapanese(
  text: string,
  handlers: { onStart?: () => void; onEnd?: () => void; onError?: () => void },
): void;

export function cancelPlayback(): void;
```

**Contract**:

- `isSpeechSynthesisAvailable()`：回傳 `typeof window !== 'undefined' && 'speechSynthesis' in window`；
  不檢查是否有 `ja-JP` voice（voice 可用性由 `speakJapanese` 執行期的 `onerror` 處理，不在此提前假設）。
- `playBundledAudio(phraseId, handlers)`：Primary 層。內部以 `phraseId` 推導固定路徑
  `` `/audio/travel-japanese/${phraseId}.mp3` ``（**不**讀取 dataset 上的任何 `audioFile` 欄位，
  該欄位不存在），建立／重用 `HTMLAudioElement` 並呼叫 `.play()`；成功開始播放（`playing` 事件）
  → 呼叫 `handlers.onPlaying`；播放正常結束（`ended` 事件）→ 呼叫 `handlers.onEnded`；載入或播放
  失敗（`error` 事件、404、逾時未收到任何終止事件）→ 呼叫 `handlers.onError`，**不得**拋出未捕捉例外。
- `speakJapanese`：Fallback 層，僅由呼叫端於 `playBundledAudio` 觸發 `onError` 後呼叫。內部建立
  `SpeechSynthesisUtterance`，`lang = 'ja-JP'`；`utterance` 的 `onstart` → 呼叫 `handlers.onStart`；
  `onend` → 呼叫 `handlers.onEnd`；`onerror` → 呼叫 `handlers.onError`。若
  `isSpeechSynthesisAvailable()` 為 `false`，**不得**呼叫 `window.speechSynthesis`，直接同步呼叫
  `handlers.onError`。
- **Timeout / terminal-state 防護**：呼叫端（`TravelJapaneseScreen`）MUST 為 `playBundledAudio` 與
  `speakJapanese` 各自進入等待狀態後設定合理逾時；逾時仍未收到任一終止事件（`onPlaying`／`onEnded`／
  `onError`／`onStart`／`onEnd`）時，視同該層失敗並依序進入下一層或 `failed`，避免永久停留於
  `requested`／`playing`（規則詳見 plan.md 第八節 B）。
- `cancelPlayback()`：終止目前 active playback 與任何 pending timeout——暫停並重置目前的 bundled
  `HTMLAudioElement`（若有），並呼叫 `window.speechSynthesis?.cancel()`；在兩者皆不存在／未啟動時
  安全地 no-op，**不得**拋出例外。呼叫端 MUST 在觸發新播放請求前與 component unmount 時呼叫此函式，
  確保同一時間最多一個 active playback（FR-010/FR-011）。


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
- `onPlay(phrase)` 依三層策略呼叫 `phraseAudio`（**Maintenance Amendment，2026-09-21**：原為單純呼叫
  `phraseAudio.speakJapanese`，已更新為下列順序）：先呼叫 `phraseAudio.playBundledAudio(phrase.id, …)`
  （Primary）；其 `onError` 觸發時才呼叫 `phraseAudio.speakJapanese(phrase.japanese, …)`（Fallback）；
  並依各層 handlers 更新 `activePhraseId` / `playbackStatus`（見 data-model.md 第 5 節「狀態轉換：
  Playback」與 plan.md 第八節 B）。
- Component unmount 時（`useEffect` cleanup）MUST 呼叫 `phraseAudio.cancelPlayback()`（**Maintenance
  Amendment**：原為 `cancelSpeech()`，函式更名以反映其同時終止 bundled audio 與 `SpeechSynthesis`
  兩層播放）。
- `onBack` 呼叫時不清除 `favoriteIds`（已持久化，下次進入 Feature 或重開 App 仍應反映）；`view` /
  `selectedCategory` / `searchQuery` / `activePhraseId` / `playbackStatus` 為單次 session 的暫時狀態，
  不需持久化。

## 7. Audio Asset Content Contract（正式音檔內容契約，Maintenance Amendment 新增，2026-09-21）

> 本節僅定義**正式音檔內容應符合的品質契約**，供未來音檔製作／審查階段引用；**本次 Maintenance 不建立、
> 不下載、不生成任何音檔**，MP3 production 本身仍為待後續批准之獨立 implementation task
> （見 plan.md 第八節 C. Asset Strategy）。

**檔案對應**：

- 每個正式 phrase ID（`tj-001`…`tj-108`）MUST 對應一個正式日文 MP3 檔案，路徑固定為
  `` /audio/travel-japanese/{phraseId}.mp3 ``（例如 `tj-001` → `/audio/travel-japanese/tj-001.mp3`）。
- 不為此在 dataset 型別新增獨立的 `audioFile` 欄位；路徑一律由 `phraseId` 直接推導（見
  data-model.md 第 1 節、contracts §3）。

**內容品質要求**（MUST）：

- 音檔實際口說內容 MUST 與該 phrase 正式日文文字（`japanese` 欄位）完全一致，不得漏字、加字或改變
  原意。
- 發音 MUST 為自然日文發音，語速適合旅遊溝通情境下清楚聽懂（不過快、不過度誇張放慢）。
- 語氣與禮貌程度 MUST 與原 phrase 的禮貌程度、語意保持一致（例如敬語／禮貌形式不得被隨意簡化或加重）。
- MUST NOT 包含背景音樂。
- MUST NOT 包含品牌提示音／音效（例如 App 自訂音效、intro/outro jingle）。
- MUST NOT 包含不必要的語音前綴／後綴（例如朗讀者自我介紹、額外招呼語），音檔內容應僅為該 phrase 本身。
- 音量 MUST 於全部 108 個音檔間維持合理一致，不得有部分音檔明顯過大聲或過小聲。
- MUST 避免過長的 leading／trailing silence（音檔開頭／結尾不必要的空白）。

**變更觸發條件**：

- 任何正式 phrase 日文文字（`japanese` 欄位）的內容變動，MUST 觸發對應音檔的 consistency review，
  確認文字與音檔仍一致；審查前不得視為已完成。

**Production 工具選擇（尚未批准，本節不決定）**：

- 若未來採第三方 TTS／語音服務產生此 static asset，MUST 先確認該服務之發布／再散布權利適合本 App
  的散布方式（例如可合法將產出音檔打包為 App static asset 並公開發佈）。
- 不得因採用第三方 TTS 產生音檔，而額外引入 runtime API 呼叫、將任何 API key 放入 frontend、或自行
  引入新的 cloud runtime dependency——音檔一律以**預先產生的 static asset**形式隨 App 發佈，播放時
  不呼叫任何外部服務（沿用 contracts §3 Primary 層行為）。
- Production tool（例如特定 TTS 服務或錄音方式）本身的選擇尚未批准，本節不代為決定，留待後續正式
  batch 的獨立 approval。

### 7.1 Asset Manifest / Completeness Check Result（執行記錄，待 tasks.md T051 實際執行時填寫）

> 本小節為 T051（asset 完整性驗證）之**指定記錄位置**。本次 Readiness Correction 僅建立記錄位置與欄位
> 格式，**不執行**任何實際比對、不建立任何音檔。執行時應記錄：檢查日期、比對之 dataset 版本、
> missing id 清單（若有）、duplicate id/路徑衝突清單（若有）、結論（PASS／FAIL）。

| 執行日期 | Dataset 版本／來源 | Missing IDs | Duplicate IDs／路徑衝突 | 結論 |
|----------|--------------------|--------------|--------------------------|------|
| （待執行） | — | — | — | — |

### 7.2 Spoken Content Consistency Review Record（執行記錄，待 tasks.md T052 實際執行時填寫）

> 本小節為 T052（音檔口說內容與 `japanese` 欄位一致性審查）之**指定記錄位置**。記錄應包含：審查日期、
> 審查範圍（例如全部 108 句或本次變動之 phrase id 清單）、發現之不一致項目（若有）、修正／重新錄製
> 需求（若有）、結論（PASS／FAIL）。

| 審查日期 | 審查範圍 | 不一致項目 | 後續處理 | 結論 |
|----------|----------|------------|----------|------|
| （待執行） | — | — | — | — |

### 7.3 Audio Content Quality Review Checklist（執行記錄，待 tasks.md T053 實際執行時填寫）

> 本小節為 T053 音檔品質審查 checklist 之**指定記錄位置**，逐項對應上方「內容品質要求」。每個正式音檔
> production batch 完成後，MUST 針對該 batch 逐項勾選並記錄結論。

| 審查項目 | 對應要求 | 結論（PASS／FAIL／N/A） |
|----------|----------|---------------------------|
| 發音自然度與語速 | 內容品質要求 | （待執行） |
| 語氣／禮貌程度與原 phrase 一致 | 內容品質要求 | （待執行） |
| 無背景音樂 | MUST NOT 背景音樂 | （待執行） |
| 無品牌提示音／效果音 | MUST NOT 品牌提示音／效果音 | （待執行） |
| 無不必要語音前後綴 | MUST NOT 不必要語音前後綴 | （待執行） |
| 108 個音檔間音量一致 | 音量一致性要求 | （待執行） |
| 無過長 leading／trailing silence | leading／trailing silence 要求 | （待執行） |

### 7.4 Licensing / Production Approval Record（正式批准記錄）

> 本小節為 T055 formal production approval 之**指定記錄位置**。本次書面同步已完成正式批准，
> 但 108 句 production 仍未完成，且本節僅記錄批准內容與 constraints，不代表 real audio asset 已建立。

| 項目 | 狀態 | 批准者／日期 | 備註 |
|------|------|--------------|------|
| Production method | APPROVED | 成人教育者 / 2026-09-23 | `VOICEVOX Nemo`，WAV master → MP3 delivery asset |
| Voice source | APPROVED | 成人教育者 / 2026-09-23 | 男声1（ノーマル）／CV レナード・ジン |
| Fixed parameters | APPROVED | 成人教育者 / 2026-09-23 | Speed 0.80 / Pitch 0.00 / Intonation 1.00 / Volume 1.00 / Pause 1.00 / Start silence 0.10 / End silence 0.10 |
| Licensing／reuse rights | APPROVED | 成人教育者 / 2026-09-23 | 正式公開／merge 前，必須依 VOICEVOX Nemo 官方規約加入可見 attribution |
| Runtime architecture | APPROVED | 成人教育者 / 2026-09-23 | static MP3 Primary → `SpeechSynthesis` fallback → text fallback |
| Runtime dependency constraint | APPROVED | 成人教育者 / 2026-09-23 | MUST NOT depend on VOICEVOX / Nemo engine / OpenAI TTS / Cloud TTS API / API key |
| QA requirement | APPROVED | 成人教育者 / 2026-09-23 | 108 unique phrases 全量人工聽檢；OpenAI 不作為正式 production provider |
| 108 phrase completion status | PENDING | 成人教育者 / 2026-09-23 | 108 個正式音檔尚未產生完成；本 approval 不表示 production complete |
