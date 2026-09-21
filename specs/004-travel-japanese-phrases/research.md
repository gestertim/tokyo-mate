# Phase 0 Research: Travel Japanese

本文件整理 Technical Plan 展開前需要決策的技術選項，格式：Decision / Rationale / Alternatives considered。

## 1. 語音播放技術

- **Decision**: 瀏覽器原生 `window.speechSynthesis` + `SpeechSynthesisUtterance`（Web Speech API），
  `utterance.lang = 'ja-JP'`。
- **Rationale**: 見 [plan.md](./plan.md) 第八節完整比較；固定 dataset 不需要 Cloud AI 生成語音，原生
  API 零成本、零延遲、無新增 dependency／secret／backend，且更貼近「旅行途中重複使用」情境。
- **Alternatives considered**:
  - 重用既有 `AudioPlayer.tsx` / `generateSpeech()` Cloud TTS：技術上可行但每次播放皆為一次既有 OpenAI
    TTS 呼叫，100+ 句 × 重複播放會持續累積既有服務用量與延遲，且不可離線；已在 plan.md 記錄比較與決策。
  - 預錄 MP3：需要额外音檔製作、儲存與授權管理，且 dataset 內容仍在審查/調整階段，維護成本高於
    Web Speech API；未被選用。
  - 第三方 TTS npm library：違反「零新增 dependency」目標，未被選用。

## 2. 搜尋技術

- **Decision**: Local deterministic frontend 搜尋——正規化（trim + lowercase）後對每個 phrase 的
  `japanese` 與 `traditionalChinese` 欄位做 `String.prototype.includes` 部分比對，回傳所有符合的 phrase
  （含跨多個 category 的 phrase，僅回傳一次，去重複依 `id`）。
- **Rationale**: 資料規模約 100–150 筆，array filter 為 O(n) 且即時；符合 Simplest Sufficient Technology，
  且 FR-016/FR-018 要求搜尋結果只能來自正式 dataset、無結果時不得生成內容——純本地 array filter 天然滿足
  此限制，不需額外「避免 AI 生成」的防護邏輯。
- **Alternatives considered**: fuzzy-search npm 套件（例如 Fuse.js）——資料量小，不需要模糊比對即可滿足
  spec「部分關鍵字」要求；未被選用（零新增 dependency 目標）。Backend 搜尋 API——不需要，未被選用。

## 3. 收藏持久化

- **Decision**: `window.localStorage`，key 例如 `tokyo-mate:travel-japanese:favorites`，值為
  `string[]`（phrase id 陣列）的 JSON 字串。讀取時 `try/catch` 解析，失敗或不存在則視為空陣列；寫入時
  `try/catch`，失敗僅記錄（不拋出、不影響其餘功能）。
- **Rationale**: FR-023 僅要求同裝置重開 App 後仍存在，不需要帳號／Cloud／多裝置同步；`localStorage`
  是達成此需求的最簡瀏覽器原生機制，且是此 repository 中第一個合法使用本機持久化的已批准情境（不同於
  001 FR-017/018/026 禁止持久化聊天內容/翻譯結果/位置等範圍）。
- **Alternatives considered**: IndexedDB（透過抽象層）——對簡單 id 陣列而言過度設計；未被選用。

## 4. Dataset 結構與 placement 計算

- **Decision**: 單一 JSON 檔（`src/data/tokyo/travel-japanese-phrases.json`），陣列，每筆為一個 unique
  phrase，含 `categories: TravelJapaneseCategory[]`（長度 >= 1）。Category placement 為衍生計算
  （`phrases.flatMap(p => p.categories).length` 即為總 placements 數；`phrases.filter(p =>
  p.categories.includes(category)).length` 即為該 category 的 placements 數），不建立獨立的
  placement 資料表，避免重複資料來源（Constitution VIII. Maintainability）。
- **Rationale**: 符合 spec FR-004/FR-005「unique phrase 與 category placement 分別統計，同一句不得複製
  內容灌注 placement 數」；衍生計算保證兩個指標永遠一致、不會因手動維護兩份資料而產生落差。
- **Alternatives considered**: 獨立 `CategoryPlacement` 資料表（正規化 join 結構）——對 100–150 筆固定
  資料而言為不必要的資料庫化設計，違反「不要為 100–140+ phrases 建立不必要的 database layer」的
  明確指示；未被選用。

## 5. PWA 快取

- **Decision**: 新 dataset 放置於既有 `APPROVED_STATIC_PREFIXES` 已涵蓋的 `src/data/tokyo/` 路徑下，
  不修改 `service-worker.ts`。
- **Rationale**: 文字內容本質上於建置時 bundle 進 JS（ESM 靜態 import），且既有 allowlist 已涵蓋此路徑，
  無需新增快取規則即可維持既有 offline app shell 行為不變。
- **Alternatives considered**: 新增獨立資料夾＋修改 `service-worker.ts` allowlist——非必要變更，未被
  選用（prompt 明確指示「不要假設需要修改 Service Worker」）。

## 6. 測試環境對 Web Speech API 的支援

- **Decision**: 於 Vitest（jsdom）測試中以 `vi.stubGlobal('speechSynthesis', mockObject)` 或直接於
  `window` 上賦值 mock 物件（含 `speak`/`cancel`/`getVoices` 與可觸發的 `onstart`/`onend`/`onerror`）
  模擬瀏覽器行為，比照既有 003 對 `leaflet` 的 `vi.mock` 作法。
- **Rationale**: jsdom 原生不支援 `SpeechSynthesis`；沿用既有專案「以 mock 驗證呼叫行為」慣例
  （見 `NearbyMap.test.tsx` 對 leaflet 的處理方式），不依賴真實瀏覽器 TTS engine 執行單元測試。
