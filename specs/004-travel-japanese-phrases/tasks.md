---

description: "Task list template for feature implementation"
---

# Tasks: Tokyo Mate 東京通｜旅遊日文 Travel Japanese

**Input**: Design documents from `/specs/004-travel-japanese-phrases/`

**Prerequisites**: [plan.md](./plan.md)（required）、[spec.md](./spec.md)（required for user stories）、
[research.md](./research.md)、[data-model.md](./data-model.md)、
[contracts/travel-japanese-contracts.md](./contracts/travel-japanese-contracts.md)、
[quickstart.md](./quickstart.md)、[ux-ui-design-handoff.md](./ux-ui-design-handoff.md)、
[checklists/implementation-readiness.md](./checklists/implementation-readiness.md)（140/140 [x]；原
CHK009、CHK032、CHK069、CHK119 共 4 項已於 M2 最終複查裁決為 PASS／N/A，詳見該檔案「三次複查總結」章節）

**Tests**: plan.md「Testing Strategy」章節（A–E）與本次使用者輸入第十一節皆明確要求將測試視為正式
implementation work，故本 tasks.md 包含測試任務（非樣板預設，而是依 plan.md 與使用者明確要求納入）。

**Organization**: 任務依 spec.md 之 User Story（US1/US2 為 P1，US3/US4/US5 為 P2）分組，確保各 story 可
獨立實作與驗證；Dataset production 與 Home Integration 為跨 Story 之必要基礎與整合工作，各自獨立成 phase。

**⚠️ Implementation Authorization**: 本 tasks.md 產生後，仍須待使用者完成 `/speckit.analyze` 與
Implementation Readiness Gate，並明確批准進入 `/speckit.implement`，方可修改 application code（依
[copilot-instructions.md](../../.github/copilot-instructions.md) Authorization Boundary）。本文件本身
不修改 `src/`、`api/`、`package.json`，不安裝 dependency，不建立正式 dataset 內容。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、無相依）
- **[Story]**: 對應 spec.md 的 US1 / US2 / US3 / US4 / US5
- 每項任務均含明確檔案路徑

## Path Conventions

沿用既有 single-project 結構：`src/`（frontend）、`api/`（Vercel serverless functions，本 feature **不
新增** `api/*` 路由）。無 `backend/` / `frontend/` 分離目錄，無新增 `tests/` 頂層目錄（沿用既有
`src/**/*.test.ts(x)` 慣例）。

**新 runtime dependency：0**（依 plan.md §Dependencies；語音使用瀏覽器原生 `SpeechSynthesis`，收藏使用
瀏覽器原生 `localStorage`，皆非 npm package）。

---

## Phase 1: Setup（Shared Infrastructure）

**Purpose**: 建立本 feature 型別、service 骨架與 dataset 檔案位置，不含正式內容與商業邏輯

- [X] T001 [P] 建立 `src/types/travelJapanese.ts`：定義 `TravelJapaneseCategory`（7 個字面值聯集）與
      `TravelJapanesePhrase`（`id`/`japanese`/`traditionalChinese`/`categories`/`safetyCritical?`），依
      [data-model.md](./data-model.md) §1
- [X] T002 [P] 建立 `src/services/travelJapanese.ts` 模組骨架：匯出常數 `TRAVEL_JAPANESE_CATEGORIES`（7
      個正式情境值）與 `TRAVEL_JAPANESE_CATEGORY_LABELS`（對應繁中標籤），依
      [data-model.md](./data-model.md) §2；本階段尚不含 dataset 存取或搜尋邏輯
- [X] T003 [P] 建立 `src/data/tokyo/travel-japanese-phrases.json` 檔案骨架（初始為空陣列
      `[]`），確認此路徑落於既有 `src/service-worker.ts` `APPROVED_STATIC_PREFIXES` 涵蓋範圍內
      （`/src/data/tokyo/`），確認**不需修改** `service-worker.ts`

**Checkpoint**: 型別、service 骨架與 dataset 檔案位置就緒，可進入 Foundational dataset production 階段

---

## Phase 2: Foundational（Dataset Production + Validation — BLOCKING）

**Purpose**: 建立正式 dataset 內容並通過三項門檻驗證，及提供全部 User Story 共用的 catalog／validation
服務層函式；本階段完成前，任何 User Story 階段不得開始

**⚠️ CRITICAL**: 沒有正式 dataset 內容與 catalog 存取函式，US1–US5 皆無可瀏覽/搜尋/收藏/播放/辨識的內容

- [X] T004 撰寫正式 dataset candidate 內容（第一輪）於
      `src/data/tokyo/travel-japanese-phrases.json`：涵蓋 7 個正式情境（機場、飯店、餐廳點餐、購物、
      交通、求助／緊急狀況、日常溝通），每個 phrase 具備 `id`／`japanese`／`traditionalChinese`／
      `categories`（>=1）；`emergency` 情境內容 MUST 涵蓋 FR-025 六類 safety-critical 句子（警察協助、
      救護車、要求對方停止、身體不舒服、遺失重要物品、尋找醫院／警察／藥局）並標記 `safetyCritical: true`
      （依 spec FR-001~FR-007、FR-025，data-model.md §1）
- [X] T005 對 T004 candidate 內容執行內容品質審查（依 spec FR-029/FR-030）：逐句檢查日文自然度、禮貌
      程度、是否適合旅客直接使用、繁中翻譯自然度、實際旅行價值、不必要重複、multi-category 適用性、
      醫療／過敏／緊急用語安全性；淘汰不合格內容並記錄淘汰原因，**不得**為湊滿門檻保留低價值句子
- [X] T006 於 `src/services/travelJapanese.ts` 實作 `getAllPhrases` / `getPhrasesByCategory` /
      `getPhraseById` / `getCategoryPlacementCounts` / `getUniquePhraseCount` /
      `validateTravelJapaneseDataset`（依 [contracts §1](./contracts/travel-japanese-contracts.md)）；
      `getPhrasesByCategory` 對 `emergency` category 之回傳結果 MUST 將 `safetyCritical === true` 的
      phrase 排列在非 safety-critical phrase 之前
- [X] T007 [P] 建立 `src/services/travelJapanese.test.ts`：驗證 7 個正式情境全部存在、unique phrase 總數
      `>= 100`、category placements 總數 `>= 140`、每個 category `>= 20`、`id` 全部唯一、`japanese` /
      `traditionalChinese` 皆非空字串、`categories` 僅引用 7 個正式情境值（無非法值）、不存在兩筆不同
      `id` 但內容完全相同的資料（重複防護）、`emergency` 情境涵蓋 FR-025 六類 safety-critical 句子、
      `validateTravelJapaneseDataset()` 於門檻不成立時回傳可定位問題的 `issues` 訊息
- [X] T008 執行 `npx vitest run src/services/travelJapanese.test.ts`：若任一門檻或驗證規則未通過，依
      [plan.md](./plan.md) 「十一、Dataset Quality Review 未達門檻之處理流程」重複「補 candidate（回到
      T004）→ 品質審查（回到 T005）→ 重新驗證（回到 T006/T007）」，直到 unique phrase `>= 100`、總
      placements `>= 140`、每個 category `>= 20` 三項門檻與其餘驗證規則全部 PASS；**不得**降低門檻數值
      或保留已審查判定為低價值之內容湊數

**Checkpoint**: Dataset 與 service 層驗證全數 PASS — 全部 5 個 User Story 可基於此正式資料獨立開發與驗證

---

## Phase 3: User Story 1 - 依旅行情境找到並理解合適的日文句子 (Priority: P1) 🎯 MVP

**Goal**: 使用者依所在旅行情境瀏覽日文句子，先以繁體中文確認意思，再取得可直接展示給日本人看的日文文字。

**Independent Test**: 進入「旅遊日文」，選擇任一旅行情境，瀏覽該情境下的句子卡，確認每張句子卡同時顯示
日文與自然的繁體中文翻譯，即可獨立驗證，不需先完成搜尋或收藏。

### Tests for User Story 1 ⚠️

> **NOTE: 先撰寫測試並確認失敗，再進行實作**

- [X] T009 [P] [US1] 建立 `src/features/travel-japanese/CategoryList.test.tsx`：驗證渲染 7 個情境按鈕
      （原生 `<button>`，鍵盤可操作）、點擊任一按鈕呼叫 `onSelectCategory(category)`
- [X] T010 [P] [US1] 建立 `src/features/travel-japanese/PhraseCard.test.tsx`：驗證同時渲染日文文字（具
      `lang="ja"`）與繁體中文文字、播放按鈕與收藏按鈕（`aria-pressed`）皆存在、`safetyCritical: true`
      的 phrase 顯示圖示＋文字標示（非純顏色），依
      [contracts §4](./contracts/travel-japanese-contracts.md)

### Implementation for User Story 1

- [X] T011 [US1] 建立 `src/features/travel-japanese/CategoryList.tsx`：7 情境清單（沿用
      `src/features/knowledge/CategoryFilter.tsx` 的 tablist pattern），使用
      `TRAVEL_JAPANESE_CATEGORY_LABELS` 呈現繁中標籤
- [X] T012 [US1] 建立 `src/features/travel-japanese/PhraseCard.tsx`：依
      [contracts §4](./contracts/travel-japanese-contracts.md) 完整 props 介面渲染日文（`lang="ja"`）／
      繁中／播放按鈕／收藏按鈕（`aria-pressed={isFavorite}`）／`safetyCritical` 標示；本階段
      `onPlay` / `onToggleFavorite` 由呼叫端提供之呼叫介面即可，實際播放與收藏行為分別於 Phase 4／
      Phase 6 串接
- [X] T013 [US1] 建立 `src/screens/TravelJapaneseScreen.tsx`：實作 `view`
      （`'categories' | 'category-detail'`）與 `selectedCategory` state；`'categories'` view 渲染
      `CategoryList`，`'category-detail'` view 依 `selectedCategory` 呼叫 `getPhrasesByCategory` 渲染
      `PhraseCard` 清單；`onBack` prop 依既有 screen 慣例（`AssistantScreen`/`NearbyScreen` 等）返回首頁
- [X] T014 [P] [US1] 建立 `src/screens/TravelJapaneseScreen.test.tsx`（Phase 3 案例）：驗證進入畫面可見
      7 個情境、選擇任一情境顯示 `>= 20` 筆句子卡且每張同時顯示日文與繁中、挑選一個已知跨情境 phrase
      驗證其在不同情境中日文／繁中內容一致（依 spec Acceptance Scenario 1.5）

**Checkpoint**: User Story 1 應可獨立完成實作與驗證（情境瀏覽 + phrase card 呈現），為 MVP 第一部分

---

## Phase 4: User Story 2 - 播放日文語音給對方聽 (Priority: P1)

**Goal**: 使用者可讓手機播放正式句子的日文語音給對方聽，並清楚知道播放狀態；同一時間最多一個 active
playback。

**Independent Test**: 對任一正式句子卡觸發語音播放，可獨立觀察「已要求播放」「播放中」「播放失敗」等
狀態，並確認同一時間只有一個句子處於播放中，不需先完成搜尋或收藏。

### Tests for User Story 2 ⚠️

- [X] T015 [P] [US2] 建立 `src/features/travel-japanese/phraseAudio.test.ts`：以
      `vi.stubGlobal('speechSynthesis', mock)`（依 [research.md](./research.md) §6）驗證
      `isSpeechSynthesisAvailable()` 在 `speechSynthesis` 不存在時回傳 `false`；`speakJapanese` 呼叫
      順序為「先 `cancel()` 再 `speak()`」、`utterance.lang === 'ja-JP'`、`onstart`/`onend`/`onerror`
      正確觸發對應 handlers；`cancelSpeech()` 於 `speechSynthesis` 不存在時安全 no-op 不拋例外

### Implementation for User Story 2

- [X] T016 [US2] 建立 `src/features/travel-japanese/phraseAudio.ts`：依
      [contracts §3](./contracts/travel-japanese-contracts.md) 實作 `isSpeechSynthesisAvailable` /
      `speakJapanese` / `cancelSpeech`
- [X] T017 [US2] 擴充 `src/screens/TravelJapaneseScreen.tsx`：新增 `activePhraseId` /
      `playbackStatus`（`'idle'|'requested'|'playing'|'failed'`）state；`onPlay(phrase)` 呼叫
      `phraseAudio.speakJapanese`，依 `onStart`/`onEnd`/`onError` 更新狀態（依
      [data-model.md](./data-model.md) §5 狀態轉換）；新播放請求觸發時以新 phrase 取代既有 active
      playback；`useEffect` cleanup 呼叫 `cancelSpeech()`
- [X] T018 [US2] 擴充 `src/features/travel-japanese/PhraseCard.tsx`：依 `isActivePlayback` /
      `playbackStatus` 顯示「已要求播放」／「播放中」／「播放失敗」文字＋`aria-live`（非純顏色）；
      `audioAvailable === false` 時播放按鈕 `disabled` 並顯示簡短說明文字（非隱藏）；播放失敗
      （`failed`）時該卡片文字與收藏按鈕 MUST 維持可操作，不得整卡 disabled

### Additional Tests for User Story 2

- [X] T019 [P] [US2] 擴充 `src/screens/TravelJapaneseScreen.test.tsx`（Phase 4 案例）：驗證播放狀態轉換
      可觀察、句子 A 播放中觸發句子 B 播放時 A 的狀態被 B 取代（同一時間僅一個 active playback）、
      `speechSynthesis` 不可用時播放按鈕 disabled 但文字／搜尋／分類／收藏不受影響、播放失敗不影響
      其他句子播放、component unmount 時呼叫 `cancelSpeech()`；**新增斷言**：句子播放失敗
      （`playbackStatus === 'failed'`）時，**該卡片自身**的日文文字、繁中文字與收藏按鈕仍可操作（不得
      整卡 `disabled`），且使用者仍可對其他句子觸發播放／收藏、仍可切換情境或使用搜尋（不因單一句子
      播放失敗而被阻斷），依 [contracts §4](./contracts/travel-japanese-contracts.md)

**Checkpoint**: User Story 1 + 2 共同構成 P1 MVP（情境瀏覽 + 播放）；**Audio Escalation Gate 檢查點**：
若驗證過程中發現目標裝置／瀏覽器缺乏可用 Japanese voice、或日文 voice 覆蓋率不足以合理支援目標使用
情境，MUST 依 [plan.md](./plan.md) 「九、Audio Strategy Escalation Gate」STOP，記錄實際證據並取得使用者
重新批准，**不得**自行切換為 Cloud TTS、重用既有 `generateSpeech()`、預錄 MP3 或其他 external service

---

## Phase 5: User Story 3 - 快速搜尋日文或繁中關鍵字找到句子 (Priority: P2)

**Goal**: 使用者輸入部分繁中或日文關鍵字，直接找到符合的正式句子，不需逐一瀏覽情境分類。

**Independent Test**: 輸入部分繁中或日文關鍵字，可獨立確認搜尋結果僅來自正式 dataset、可直接播放與
收藏，不需先完成分類瀏覽或收藏流程。

### Tests for User Story 3 ⚠️

- [X] T020 [P] [US3] 擴充 `src/services/travelJapanese.test.ts`：驗證 `searchPhrases` 對繁中部分關鍵字、
      日文部分關鍵字皆可找到符合句子；空字串回傳空陣列（非全部句子）；同一 phrase 符合多個欄位時僅
      回傳一次（依 `id` 去重）；無符合關鍵字時回傳空陣列，依
      [contracts §1](./contracts/travel-japanese-contracts.md)
- [X] T021 [P] [US3] 建立 `src/features/travel-japanese/SearchBar.test.tsx`：驗證搜尋輸入具備
      `<label>`、輸入變化呼叫 `onQueryChange`、「尚未輸入」中性提示與「已輸入但無結果」空白狀態顯示
      不同文字（依 [ux-ui-design-handoff.md](./ux-ui-design-handoff.md)「Search」章節）

### Implementation for User Story 3

- [X] T022 [US3] 於 `src/services/travelJapanese.ts` 實作 `searchPhrases(query)`：`trim().toLowerCase()`
      正規化；空字串回傳 `[]`；比對 `japanese` 與 `traditionalChinese` 是否 `includes(normalizedQuery)`；
      依 `id` 去重；無符合時回傳 `[]`，依 [contracts §1](./contracts/travel-japanese-contracts.md)
- [X] T023 [US3] 建立 `src/features/travel-japanese/SearchBar.tsx`：搜尋輸入元件（具 `<label>`），依
      `searchQuery` 是否為空字串呈現不同的中性提示／無結果空白狀態文字
- [X] T024 [US3] 擴充 `src/screens/TravelJapaneseScreen.tsx`：新增 `'search'` view 與 `searchQuery`
      state，渲染 `SearchBar` 與 `searchPhrases(searchQuery)` 結果之 `PhraseCard` 清單，共用同一
      `favoriteIds` / `onToggleFavorite` / `onPlay`，不建立額外的句子詳細頁面

### Additional Tests for User Story 3

- [X] T025 [P] [US3] 擴充 `src/screens/TravelJapaneseScreen.test.tsx`（Phase 5 案例）：驗證繁中搜尋、
      日文搜尋、部分關鍵字皆可找到結果；無結果顯示可理解空白狀態且不出現虛構句子；尚未輸入時顯示中性
      提示；搜尋結果可直接播放與收藏，不需進入額外頁面

**Checkpoint**: User Story 3 可獨立驗證（搜尋僅回傳正式 dataset 內容，不即時生成新翻譯或新句子）

---

## Phase 6: User Story 4 - 收藏常用句以便重複使用 (Priority: P2)

**Goal**: 使用者收藏常用句子，之後可直接從「我的常用句」找到，跨情境／搜尋結果收藏狀態一致。

**Independent Test**: 對任一正式句子收藏，之後從「我的常用句」瀏覽確認該句子出現，並確認同一句子無論
從哪個情境或搜尋結果收藏，收藏狀態一致，不需先完成其他 User Story 流程。

### Tests for User Story 4 ⚠️

- [X] T026 [P] [US4] 建立 `src/features/travel-japanese/favorites.test.ts`：驗證 `loadFavoriteIds()` 於
      正常情況、`localStorage` 不存在、`JSON.parse` 失敗、內容型別不符（非 `string[]`）時皆安全回傳
      `[]` 且**不拋出例外**；`persistFavoriteIds()` 寫入失敗（例如模擬 `setItem` 拋出例外）時**不拋出
      例外**，依 [contracts §2](./contracts/travel-japanese-contracts.md)
- [X] T027 [P] [US4] 建立 `src/features/travel-japanese/FavoritesList.test.tsx`：驗證有收藏時渲染
      `PhraseCard` 清單、無收藏時顯示可理解空白狀態並提供回到情境瀏覽或搜尋的方式（依 spec FR-024）

### Implementation for User Story 4

- [X] T028 [US4] 建立 `src/features/travel-japanese/favorites.ts`：依
      [contracts §2](./contracts/travel-japanese-contracts.md) 實作 `loadFavoriteIds()` /
      `persistFavoriteIds(ids)`（`localStorage` key `tokyo-mate:travel-japanese:favorites`）
- [X] T029 [US4] 建立 `src/features/travel-japanese/FavoritesList.tsx`：我的常用句清單 + 空狀態（含回到
      情境瀏覽或搜尋的按鈕／連結）
- [X] T030 [US4] 擴充 `src/screens/TravelJapaneseScreen.tsx`：新增 `'favorites'` view；mount 時以
      `loadFavoriteIds()` 初始化 `favoriteIds: Set<string>`；`favoriteIds` 變化時呼叫
      `persistFavoriteIds(Array.from(favoriteIds))`；`'categories'`／`'category-detail'`／`'search'`／
      `'favorites'` 全部 view 共用同一個 `favoriteIds` 與 `onToggleFavorite` callback，確保跨 view 收藏
      狀態一致（依 spec FR-022）

### Additional Tests for User Story 4

- [X] T031 [P] [US4] 擴充 `src/screens/TravelJapaneseScreen.test.tsx`（Phase 6 案例）：驗證收藏／取消
      收藏、同一 phrase 跨情境與搜尋結果收藏狀態一致、模擬重新掛載 screen 後先前收藏仍存在（持久化
      還原）、`localStorage` 內容為非法 JSON 時安全降級為空收藏且不 crash、收藏空狀態顯示與導覽路徑

**Checkpoint**: User Story 1–4 共同構成完整 P1+P2 主要功能（瀏覽、播放、搜尋、收藏）

---

## Phase 7: User Story 5 - 在求助／緊急狀況中快速辨識並取得安全相關句子 (Priority: P2)

**Goal**: 使用者在「求助／緊急狀況」情境中可快速辨識 safety-critical 句子，並看到明確可見的安全提醒。

**Independent Test**: 進入「求助／緊急狀況」情境，可獨立確認 safety-critical 句子具較高資訊優先級與
容易辨識的呈現方式，不依賴顏色作為唯一辨識依據，且安全提醒明確可見。

### Tests for User Story 5 ⚠️

- [X] T032 [P] [US5] 建立 `src/features/travel-japanese/SafetyReminder.test.tsx`：驗證元件存在於 DOM 且
      可見（非 `display:none`／`aria-hidden="true"`／需互動才出現）、使用語義化標記（例如
      `role="note"`），依 [contracts §5](./contracts/travel-japanese-contracts.md)

### Implementation for User Story 5

- [X] T033 [US5] 建立 `src/features/travel-japanese/SafetyReminder.tsx`：固定內容元件（提醒翻譯僅供
      參考、緊急狀況仍須尋求正式協助），非 blocking、非 modal、非需額外點擊才展開，依
      [contracts §5](./contracts/travel-japanese-contracts.md) 與 [plan.md](./plan.md) 「十、Safety
      Reminder Escalation Constraint」
- [X] T034 [US5] 擴充 `src/screens/TravelJapaneseScreen.tsx`：`emergency` category 的
      `'category-detail'` view 於 `PhraseCard` 清單**上方直接渲染** `SafetyReminder`，不阻擋使用者
      查看或播放任一句子

### Additional Tests for User Story 5

- [X] T035 [P] [US5] 擴充 `src/features/travel-japanese/PhraseCard.test.tsx`（Phase 7 案例）：驗證
      `safetyCritical` phrase 的視覺標示以圖示＋文字呈現（非純顏色），移除顏色樣式後仍可從文字／圖示
      辨識
- [X] T036 [P] [US5] 擴充 `src/screens/TravelJapaneseScreen.test.tsx`（Phase 7 案例）：驗證進入
      `emergency` 情境時 safety-critical 句子排列於清單前段（對應 `getPhrasesByCategory` 排序）、
      `SafetyReminder` 立即可見、且使用者可在不與 `SafetyReminder` 互動的情況下直接查看／播放任一
      safety-critical 句子

**Checkpoint**: User Story 1–5 全部可獨立驗證完成

---

## Phase 8: Home Integration（Cross-Cutting，非獨立 User Story，但為必要進入點整合）

**Purpose**: 讓「旅遗日文」成為既有首頁第 6 個功能入口，使 US1–US5 可透過完整 App 實際進入使用

**⚠️ 依賴**: 需 `TravelJapaneseScreen`（T013 起）已存在；不依賴 US2–US5 是否已完成（可在任一 User Story
完成後接續進行，但建議於全部 5 個 Story 完成後執行以降低既有 `HomeScreen.test.tsx` 的回歸驗證次數）

- [X] T037 擴充 `src/screens/HomeScreen.tsx`：新增 `travelJapaneseOpen` boolean state 與「旅遊日文」導覽
      按鈕，沿用既有 `nearbyOpen`/`photoTranslateOpen` 相同 boolean state 擴充 pattern；既有 5 個入口
      （即時翻譯、問東京、探索附近、東京百科、拍照翻譯）與既有 4 個既有目的地畫面串接方式維持不變
- [X] T038 更新既有 `src/screens/HomeScreen.test.tsx`：新增案例驗證「旅遊日文」入口存在、
      `nav[aria-label="東京功能入口"]` 下既有 5 個按鈕仍存在（新增後共 6 個按鈕）、點擊新入口進入
      `TravelJapaneseScreen`、原有既有案例（拍照翻譯 regression、東京百科 regression 等）維持通過，
      依 [plan.md](./plan.md) Testing Strategy §E「Home Integration Regression Test」

**Checkpoint**: Feature 004 可從既有首頁實際進入使用，US1–US5 皆可透過完整 App 手動走查

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility／Mobile-first 最終複查與全面 regression 驗證

- [X] T039 [P] Accessibility 複查：確認 `src/features/travel-japanese/*` 與
      `src/screens/TravelJapaneseScreen.tsx` 全數落實 `lang="ja"`、`aria-pressed`、`aria-live`、
      `role="note"`、focus-visible（沿用既有全域樣式）、無任何狀態（播放／收藏／safety-critical）僅以
      顏色辨識，對照 [ux-ui-design-handoff.md](./ux-ui-design-handoff.md)「Accessibility」章節逐項確認
- [X] T040 [P] Mobile-first 複查：確認 Play／Favorite 觸控區域不易誤觸、情境清單／句子清單／搜尋結果／
      我的常用句於行動裝置寬度下無 horizontal scrolling、日文文字清楚可讀，沿用既有樣式慣例，不新增
      CSS framework，對照 [ux-ui-design-handoff.md](./ux-ui-design-handoff.md)「Mobile-first」章節
- [X] T045 [P] 擴充 `src/screens/TravelJapaneseScreen.test.tsx`（Dataset Runtime Anomaly 案例，依
      [plan.md](./plan.md) 「十三、Dataset Runtime Anomaly Handling」）：模擬 dataset 存取層（例如
      `getPhrasesByCategory`）回傳缺少必要欄位（`japanese` 或 `traditionalChinese`）之異常資料時，驗證
      受影響 view 顯示可理解的 graceful-failure 狀態（不得顯示虛構或半有效的句子卡），並提供返回情境
      清單或首頁的方式；同時驗證未受影響的其他情境、搜尋、我的常用句 view 仍可正常操作。本任務為
      UI 層最後一道防禦測試，不取代、不降低 T004–T008 之 build-time dataset 驗證門檻
- [X] T041 執行 `npx vitest run`：確認 Feature 004 全部新測試（T007/T009/T010/T014/T015/T019-T021/
      T025-T027/T031/T032/T035/T036/T038/T045）通過，且既有 Feature 001／002／003 自動化測試維持 100%
      原有通過狀態（依 spec FR-031/SC-008）；若發現既有測試失敗，依 [plan.md](./plan.md)「Regression
      Failure Handling」視為 regression blocker 並優先處理，**不得**刪除／skip／弱化既有測試或靜默改變
      既有產品行為
- [X] T042 執行 `npm run build`：確認型別檢查與打包無誤
- [X] T043 執行 `npm run test:pwa-red-gate`：確認既有 PWA 行為（App Shell、offline fallback、update
      prompt）不受影響
- [X] T044 對照 [quickstart.md](./quickstart.md) 全部驗證場景手動走查一次，確認 spec.md SC-001~SC-011
      皆可觀察成立，並記錄走查結果

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup（Phase 1）**：無相依，可立即開始
- **Foundational（Phase 2）**：依賴 Setup 完成；**BLOCKS** 所有 User Story（US1–US5 均需正式 dataset
  與 catalog 函式）
- **User Story 1（Phase 3，P1）**：依賴 Foundational 完成；無其他 Story 相依
- **User Story 2（Phase 4，P1）**：依賴 Foundational 完成；`PhraseCard` 播放狀態呈現（T018）依賴 US1
  已建立的 `PhraseCard.tsx`（T012）與 `TravelJapaneseScreen.tsx`（T013）
- **User Story 3（Phase 5，P2）**：依賴 Foundational 完成；搜尋結果之 `PhraseCard` 呈現與播放／收藏
  互動依賴 US1（T012）與 US2（T016-T018）已完成的元件與狀態
- **User Story 4（Phase 6，P2）**：依賴 Foundational 完成；跨 view 收藏一致性依賴 US1（T013）已建立的
  `TravelJapaneseScreen` view 架構；`PhraseCard` 收藏按鈕（T012）已存在，本階段串接實際邏輯
- **User Story 5（Phase 7，P2）**：依賴 Foundational 完成、US1（`emergency` category 已可瀏覽）；
  safety-critical 排序依賴 T006 已實作的 `getPhrasesByCategory` 排序規則
- **Home Integration（Phase 8）**：依賴 US1（T013，`TravelJapaneseScreen` 已存在）；不依賴 US2–US5，但
  建議於全部 User Story 完成後執行
- **Polish（Phase 9）**：依賴所有已完成的 User Story 與 Home Integration

### User Story Dependencies

- **US1（P1）**：Foundational 完成後即可開始，無其他 Story 相依
- **US2（P1）**：Foundational 完成後即可開始；與 US1 共用 `PhraseCard.tsx` / `TravelJapaneseScreen.tsx`，
  故實務上建議接續 US1 之後實作
- **US3（P2）**：與 US1、US2 共用 `PhraseCard` 呈現與播放／收藏 callback，建議於 US1、US2 完成後實作
- **US4（P2）**：與 US1、US2、US3 共用 `PhraseCard` 收藏按鈕與跨 view 一致性，建議於 US1 完成後、US3
  之前或之後皆可（US4 不依賴 US3 完成）
- **US5（P2）**：依賴 US1 已建立的 `emergency` category 瀏覽能力，與 US2–US4 相互獨立

### Within Each User Story

- 先撰寫測試並確認失敗，再進行實作（例如 T009/T010 早於 T011/T012；T015 早於 T016；以此類推）
- 純函式模組（`favorites.ts`／`phraseAudio.ts`／`travelJapanese.ts` 內函式）先於串接
  `TravelJapaneseScreen.tsx` 的任務
- Story 完成（含 Checkpoint 驗證）才進入下一優先序 Story

### Parallel Opportunities

- Setup 階段 T001–T003 可全部平行（不同檔案）
- Foundational 階段 T007 可於 T006 函式簽章確定後平行撰寫
- 每個 User Story 內標示 `[P]` 的測試任務可平行撰寫（不同檔案）
- Phase 9 的 T039／T040（複查類任務）可平行進行

---

## Parallel Example: User Story 1

```bash
# 平行撰寫 User Story 1 的測試任務：
Task: "建立 src/features/travel-japanese/CategoryList.test.tsx"
Task: "建立 src/features/travel-japanese/PhraseCard.test.tsx"
```

## Parallel Example: User Story 4

```bash
# 平行撰寫 User Story 4 的測試任務：
Task: "建立 src/features/travel-japanese/favorites.test.ts"
Task: "建立 src/features/travel-japanese/FavoritesList.test.tsx"
```

---

## Implementation Strategy

### MVP First（User Story 1 + User Story 2，皆為 P1）

1. 完成 Phase 1：Setup
2. 完成 Phase 2：Foundational（CRITICAL，封鎖所有 User Story；含 dataset 三項門檻驗證迴圈）
3. 完成 Phase 3：User Story 1（情境瀏覽 + Phrase Card）
4. **STOP 並驗證**：獨立測試 User Story 1
5. 完成 Phase 4：User Story 2（語音播放）
6. **STOP 並驗證**：獨立測試 User Story 2；此時 MVP（瀏覽 + 播放）已可展示；同時確認 Audio Escalation
   Gate 未被觸發

### Incremental Delivery

1. 完成 Setup + Foundational → 正式 dataset 與服務層就緒
2. 加入 User Story 1 → 獨立測試 → 展示（情境瀏覽，MVP 第一部分）
3. 加入 User Story 2 → 獨立測試 → 展示（語音播放，MVP 完整）
4. 加入 User Story 3 → 獨立測試 → 展示（搜尋）
5. 加入 User Story 4 → 獨立測試 → 展示（收藏）
6. 加入 User Story 5 → 獨立測試 → 展示（求助／緊急安全辨識）
7. 加入 Home Integration → 展示（可從既有首頁完整走查全部 5 個 Story）
8. 加入 Polish → Accessibility／Mobile／全面 regression 驗證
9. 每個 Story 皆在不破壞先前 Story 與既有 Feature 001–003 的前提下增加價值

---

## Notes

- `[P]` 任務 = 不同檔案、無相依
- `[Story]` 標籤將任務對應至 spec.md 之特定 User Story，利於追蹤
- 每個 User Story 應可獨立完成與測試
- 實作前先確認測試失敗（TDD 慣例，依 plan.md Testing Strategy 要求）
- 每個 Checkpoint 停下驗證該 Story 獨立性後，才進入下一個 Story
- Dataset 門檻（unique phrase >= 100、總 placements >= 140、每類 >= 20）未達成前，**不得**降低門檻或
  保留低價值內容湊數，須依 T008 所述迴圈重複執行
- Audio Escalation Gate（Phase 4 Checkpoint）與 Safety Reminder Escalation Constraint（Phase 7）為
  Approval Gate，非可自行決定之實作細節；觸發條件出現時 MUST STOP 並取得批准
- 避免：模糊任務、同檔案衝突、破壞 Story 獨立性的跨 Story 相依
- 本 tasks.md 不構成 implementation 授權；須待 `/speckit.analyze` 與使用者明確批准後方可執行
  `/speckit.implement`
