# Phase 1 Data Model: Travel Japanese

## 1. Phrase（`TravelJapanesePhrase`）

```ts
export type TravelJapaneseCategory =
  | 'airport'
  | 'hotel'
  | 'restaurant'
  | 'shopping'
  | 'transportation'
  | 'emergency'
  | 'daily';

export interface TravelJapanesePhrase {
  id: string;                              // stable unique identifier，例如 "tj-001"
  japanese: string;                        // 日文文字，適合直接展示給日本人看
  traditionalChinese: string;              // 自然繁體中文翻譯
  categories: TravelJapaneseCategory[];    // >= 1 個所屬情境；同一 phrase 可跨多個情境
  safetyCritical?: boolean;                // 僅 emergency 情境下具意義；標示需優先呈現的求助/緊急句子
}
```

**驗證規則**（對應 spec FR-002/003/004/005/006/025/026/027/029/030/034）：

- `id`：全 dataset 唯一，非空字串。
- `japanese` / `traditionalChinese`：非空字串。
- `categories`：長度 >= 1，僅能包含 7 個正式情境值之一，不得為空陣列或非法值。
- `safetyCritical`：僅為 `true` 時具意義；不得作為判斷句子是否顯示的唯一依據（呈現優先序由 UI 層決定，
  非資料本身的可見性開關）。
- Dataset 整體：unique phrase 總數 `>= 100`（FR-034）；`phrases.flatMap(p => p.categories).length >=
  140`（FR-003）；每個 category 的 placements `>= 20`（FR-002）。
- 不得存在兩筆不同 `id` 但 `japanese` 與 `traditionalChinese` 完全相同的資料（避免灌注 unique phrase 數，
  FR-030 精神延伸）。

**不變式**：同一句合理適用多個情境時，MUST 以同一 `id`／同一筆資料的 `categories` 陣列表示，不得建立
第二筆內容相同但 `id` 不同的資料（FR-005）。

## 2. Category（旅行情境，衍生自 `TravelJapaneseCategory`，非獨立資料表）

```ts
export const TRAVEL_JAPANESE_CATEGORIES = [
  'airport', 'hotel', 'restaurant', 'shopping', 'transportation', 'emergency', 'daily',
] as const satisfies readonly TravelJapaneseCategory[];

export const TRAVEL_JAPANESE_CATEGORY_LABELS: Record<TravelJapaneseCategory, string> = {
  airport: '機場',
  hotel: '飯店',
  restaurant: '餐廳點餐',
  shopping: '購物',
  transportation: '交通',
  emergency: '求助／緊急狀況',
  daily: '日常溝通',
};
```

## 3. Category Placement（衍生關聯，非獨立儲存實體）

- 定義：一個 Phrase 出現在一個 Category 中的關聯。
- **不建立獨立資料表／檔案**；由 `phrase.categories` 陣列衍生計算：
  - 該 category 的 placements 清單：`phrases.filter(p => p.categories.includes(category))`
  - 總 placements 數：`phrases.reduce((sum, p) => sum + p.categories.length, 0)`
- 理由：避免雙重資料來源（Constitution VIII. Maintainability），並確保「unique phrase 數」與
  「placement 數」永遠可從單一 source of truth 一致推導（FR-004）。

## 4. Favorite（收藏，前端 in-memory + localStorage 持久化狀態，非資料庫實體）

```ts
// localStorage key: 'tokyo-mate:travel-japanese:favorites'
// value（序列化後）: string[]  // phrase id 陣列
```

- **State owner**：`TravelJapaneseScreen.tsx` 持有 `favoriteIds: Set<string>`。
- **載入**：mount 時呼叫 `loadFavoriteIds()`（`src/features/travel-japanese/favorites.ts`），解析失敗或
  不存在 → 回傳 `[]`（安全降級，不 crash）。
- **寫入**：`favoriteIds` 變化時呼叫 `persistFavoriteIds(Array.from(favoriteIds))`；寫入失敗（例如
  `localStorage` 被封鎖／容量已滿）僅靜默失敗，不影響當前執行階段的收藏功能（收藏仍可在記憶體中運作，僅
  下次重開 App 可能遺失，符合「persistence unavailable 時 Feature 仍可使用」要求）。
- **一致性**：跨 category／搜尋結果的收藏狀態一致，因為所有 view 共用同一個 `favoriteIds` state（非各
  view 各自維護副本），滿足 FR-022。

## 5. 前端 in-memory 狀態（`TravelJapaneseScreen.tsx`）

| 狀態 | 型別 | 說明 |
|------|------|------|
| `view` | `'categories' \| 'category-detail' \| 'search' \| 'favorites'` | 目前顯示的主要畫面（無 router，純本地 state） |
| `selectedCategory` | `TravelJapaneseCategory \| undefined` | 進入 `category-detail` 時設定 |
| `searchQuery` | `string` | 搜尋輸入值 |
| `favoriteIds` | `Set<string>` | 見上方第 4 節 |
| `activePhraseId` | `string \| undefined` | 目前 active playback 對應的 phrase id |
| `playbackStatus` | `'idle' \| 'requested' \| 'playing' \| 'failed'` | 目前 active playback 狀態；僅 `activePhraseId` 對應的 `PhraseCard` 呈現非 idle 狀態 |

### 狀態轉換：Playback

```text
使用者對 phrase A 觸發播放
  → cancelSpeech()（若有既有 active playback，先行取消）
  → activePhraseId = A.id, playbackStatus = 'requested'
  → speakJapanese(A.japanese, { onStart, onEnd, onError })
     onStart → playbackStatus = 'playing'
     onEnd   → activePhraseId = undefined, playbackStatus = 'idle'
     onError → playbackStatus = 'failed'（activePhraseId 維持 A.id，供該卡片呈現「播放失敗」）

使用者於 A 播放中對 phrase B 觸發播放
  → 視為新的播放請求，重複上方流程並以 B 取代 A（cancelSpeech() 確保同一時間僅一個 active playback）

screen unmount / 離開 Feature
  → useEffect cleanup 呼叫 cancelSpeech()
```

## 6. 型別檔案位置

- `src/types/travelJapanese.ts`：`TravelJapaneseCategory`、`TravelJapanesePhrase`。
- `src/services/travelJapanese.ts`：常數（`TRAVEL_JAPANESE_CATEGORIES` / `_LABELS`）與資料存取／搜尋／
  驗證函式（詳見 [contracts/travel-japanese-contracts.md](./contracts/travel-japanese-contracts.md)）。
