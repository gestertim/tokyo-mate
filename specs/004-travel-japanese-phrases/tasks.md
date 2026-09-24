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

> **📜 Historical Baseline 標註**：下方 Checkpoint 屬於 Feature 004 **原始 implementation 歷史紀錄**
> （US1＋US2 完成當時，僅批准瀏覽器原生 `SpeechSynthesis` 單層語音方案）。其中「不得自行切換為…
> 預錄 MP3」之敘述，反映的是**當時**尚未批准 bundled MP3 的狀態；此 SpeechSynthesis-only restriction
> **已被後續 Maintenance Technical Plan supersede**，不代表目前仍有效的 Technical Truth。

**Checkpoint**: User Story 1 + 2 共同構成 P1 MVP（情境瀏覽 + 播放）；**Audio Escalation Gate 檢查點**：
若驗證過程中發現目標裝置／瀏覽器缺乏可用 Japanese voice、或日文 voice 覆蓋率不足以合理支援目標使用
情境，MUST 依 [plan.md](./plan.md) 「九、Audio Strategy Escalation Gate」STOP，記錄實際證據並取得使用者
重新批准，**不得**自行切換為 Cloud TTS、重用既有 `generateSpeech()`、預錄 MP3 或其他 external service

> **✅ 目前正式 Audio Technical Truth（Maintenance Amendment，已批准，非待批准）**：
>
> - **Primary**：App-provided static MP3（bundled，`/audio/travel-japanese/{phraseId}.mp3`）
> - **Fallback**：瀏覽器原生 `SpeechSynthesis`
> - **Final fallback**：日文文字維持可見
>
> 正式 108 個 MP3 之 production baseline 已由成人教育者批准（`VOICEVOX Nemo`／男声1（ノーマル）／
> CV レナード・ジン）；本批准確立 provider、voice、parameters 與 runtime constraints，**但不代表 108
> 個正式 MP3 已完成**，仍不得在本輪啟動正式 108 句生成或 deploy task。

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

---

## Maintenance Phase（2026-09-21｜語音策略調整 + PWA Update Reliability，新增）

**歷史任務澄清（T015–T017，不重編、不刪除、不變更其 `[X]` 狀態）**：T015、T016、T017 為 Feature 004
原始 implementation 歷史紀錄，記載當時已批准之「僅瀏覽器原生 `SpeechSynthesis`」單層語音方案。本次
Maintenance 已由成人教育者批准改採三層策略（bundled MP3 Primary → `SpeechSynthesis` Fallback → 文字
Final fallback，見 [plan.md](./plan.md)「八、Audio Technology Decision」），T015–T017 中對
「SpeechSynthesis-only」的描述**不再代表目前 Maintenance Technical Truth**。目前 audio Technical
Truth 一律以 T056–T060（Phase 12：Bundled Audio Playback Implementation）與 plan.md Maintenance
Amendment 為準；T015–T017 本身作為既有已完成任務之歷史紀錄予以保留，不重編、不刪除。

**依據**：本 Maintenance Phase 之 Technical Truth 為 [plan.md](./plan.md) 已批准之 Maintenance
Amendment（「八、Audio Technology Decision」「九、Audio Strategy Escalation Gate」「十四、PWA Update
Reliability」）與同步更新之 [research.md](./research.md)、[data-model.md](./data-model.md)、
[contracts/travel-japanese-contracts.md](./contracts/travel-japanese-contracts.md)、
[ux-ui-design-handoff.md](./ux-ui-design-handoff.md)。spec.md 本次**無** Product Truth 變更。

**授權邊界（重申）**：本 Maintenance Phase 之任務**不構成** implementation 授權；下列任務僅為
`/speckit-tasks` 階段之工作定義，須待 `/speckit.analyze` 與使用者對 `/speckit.implement` 之明確批准後
方可執行。本階段**不新增**任何 npm dependency（沿用 Plan「新 runtime dependency：0」）。

**既有任務保護**：T001–T045 為既有已完成任務，其編號、內容與完成狀態（`[X]`）維持不變，不因本 Maintenance
Phase 而被覆寫、重編或移除。以下任務編號（T046 起）為新增，接續既有最大編號 T045。

### Phase 10：Maintenance Preflight（Documentation / Pre-implementation Validation）

**Purpose**：在進入任何 audio／PWA 實作任務前，確認本次 Maintenance 之文件同步與 repository 前置條件皆
成立；不重複已完成之文件同步工作本身，僅驗證其結果。

- [X] T046 驗證 [spec.md](./spec.md) 本次 Maintenance **無** Product Truth 變更：比對目前
      working tree（`git diff -- specs/004-travel-japanese-phrases/spec.md`）確認該檔案未被修改，
      並確認 FR-001~FR-035／SC-001~SC-011 內容與批准前一致
- [X] T047 驗證 [plan.md](./plan.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、
      [contracts/travel-japanese-contracts.md](./contracts/travel-japanese-contracts.md)、
      [ux-ui-design-handoff.md](./ux-ui-design-handoff.md) 五份文件對「三層 audio 策略」
      （bundled MP3 Primary → `SpeechSynthesis` Fallback → 文字 Final fallback）與「PWA foreground
      update 節流」之敘述彼此一致，無互相矛盾之技術描述
- [X] T048 驗證 repository safety：確認目前 branch 為 `master`、working tree（`git status --porcelain`）
      僅包含本次已批准之 Feature 004 maintenance documentation files，且不包含清單以外之任何檔案：
      1. `specs/004-travel-japanese-phrases/plan.md`
      2. `specs/004-travel-japanese-phrases/ux-ui-design-handoff.md`
      3. `specs/004-travel-japanese-phrases/research.md`
      4. `specs/004-travel-japanese-phrases/data-model.md`
      5. `specs/004-travel-japanese-phrases/contracts/travel-japanese-contracts.md`
      6. `specs/004-travel-japanese-phrases/checklists/implementation-readiness.md`
      7. `specs/004-travel-japanese-phrases/tasks.md`

      並確認 `004-safe-baseline` 仍固定指向 `ddc73392be88b1bb2e44356a1e4077d96d97bf45` 且未被移動。本
      任務 MUST 以實際比對上方清單檔名為準，不得因清單項目數量變動（例如未來新增／減少 maintenance
      文件）而視為驗證失敗；若 working tree 出現清單以外的檔案（尤其 `src/**`、`public/**`、
      `package.json`、`package-lock.json`），MUST 視為驗證失敗並 STOP。
- [X] T049 驗證 0 dependency escalation：確認 `package.json`／`package-lock.json` 未變更，且本次
      Maintenance 已批准之 audio／PWA 技術方向全數僅使用既有瀏覽器原生 API
      （`HTMLAudioElement`／`SpeechSynthesis`／`localStorage`）與既有 Service Worker 基礎設施，無任何
      新增 npm dependency 之必要

**Checkpoint**：Maintenance Preflight 全數通過後，方可進入 Audio Asset Gate（Phase 11）

---

### Phase 11：Audio Asset Gate / Production Preparation（含 Approval STOP Gate）

**Purpose**：為未來正式產製 108 個音檔預先定義驗證規格與品質契約，**本階段不產生任何實際 MP3 內容**，
亦不下載任何音檔；並在進入實際產製前設置明確 STOP Gate。

- [X] T050 [P] 定義 `src/services/travelJapaneseAudioManifest.test.ts`（未來新建立）之測試規格：驗證
      dataset 中 `tj-001`…`tj-108` 全部 108 個 phrase id 各自對應唯一路徑
      `` /audio/travel-japanese/{phraseId}.mp3 ``，且不存在重複或遺漏對應（依
      [contracts §7](./contracts/travel-japanese-contracts.md)）；本任務僅定義測試規格，**不建立**
      實際音檔或假造 asset
- [X] T051 [P] 定義 asset 完整性驗證規則：一對一比對 dataset 全部 phrase id 與 expected manifest，MUST
      同時檢出「missing」（dataset 有 id 但無對應音檔）與「duplicate」（同一 id 對應多個音檔或路徑
      衝突）兩類異常；執行結果 MUST 記錄於
      [contracts §7.1](./contracts/travel-japanese-contracts.md#71-asset-manifest--completeness-check-result執行記錄待-tasksmd-t051-實際執行時填寫)
- [X] T052 定義 spoken content 一致性審查規則：音檔口說內容 MUST 與 dataset 該 phrase 之 `japanese`
      欄位逐字一致，不得漏字／加字／改變原意，依
      [contracts §7](./contracts/travel-japanese-contracts.md)「內容品質要求」；執行結果 MUST 記錄於
      [contracts §7.2](./contracts/travel-japanese-contracts.md#72-spoken-content-consistency-review-record執行記錄待-tasksmd-t052-實際執行時填寫)
- [X] T053 定義音檔品質審查 checklist（供未來人工／審查階段使用，逐項對應
      [contracts §7](./contracts/travel-japanese-contracts.md)）：發音自然度、禮貌程度與原 phrase 一致、
      語速適合旅遊溝通情境（不過快、不過度誇張放慢）、MUST NOT 背景音樂、MUST NOT 品牌提示音／效果音、
      MUST NOT 不必要語音前後綴、108 個音檔間音量合理一致、避免過長 leading／trailing silence；審查
      結果 MUST 逐項記錄於
      [contracts §7.3](./contracts/travel-japanese-contracts.md#73-audio-content-quality-review-checklist執行記錄待-tasksmd-t053-實際執行時填寫)
- [X] T054 定義 phrase text 變更 → audio consistency review 觸發流程：任何正式 phrase `japanese` 欄位
      內容變動時，MUST 標記對應音檔需重新審查，審查完成前不得視為與文字一致；每次觸發之審查結果 MUST
      以新增一列的方式記錄於
      [contracts §7.2](./contracts/travel-japanese-contracts.md#72-spoken-content-consistency-review-record執行記錄待-tasksmd-t052-實際執行時填寫)
- [x] T055 **✅ APPROVED｜Formal Audio Production Baseline**：已由成人教育者正式批准下列 production
      baseline，並明確記錄為 Technical Truth；本階段仍**不**進行 108 個正式音檔產製、下載、提交或部署，
      僅確認 document sync 與後續 production task readiness：
      - Provider：`VOICEVOX Nemo`
      - Voice：男声1（ノーマル）／CV レナード・ジン
      - 固定參數：Speed 0.80、Pitch 0.00、Intonation 1.00、Volume 1.00、Pause length 1.00、
        Start silence 0.10、End silence 0.10
      - Production master：WAV
      - App delivery asset：MP3
      - Runtime architecture：static MP3 Primary → `SpeechSynthesis` fallback → text fallback
      - Runtime MUST NOT depend on：VOICEVOX engine / Nemo engine / OpenAI TTS / Cloud TTS API /
        API key
      - QA：108 unique phrases 全量人工聽檢
      - Credit：正式公開／merge 前，必須依 VOICEVOX Nemo 官方規約加入可見 attribution
      - OpenAI：不作為 108 句正式 production provider
      - 重要：此 approval 僅定義正式 production baseline，**不**代表 108 個音檔已完成；任何 phrase
        文字修改仍須觸發對應 audio regeneration／review

**Checkpoint**：T055 已正式批准，且文件同步後仍禁止開始 108 個語音產製、生成 tj-001～tj-108、
建立 production script、提交 audio asset 或 deploy production；Phase 12 之程式碼可繼續以 mock／缺檔
情境驗證，但本階段仍不進行正式音檔產製。

### Next production tasks (queued; not executed in this documentation sync)

- [ ] dataset preflight
- [ ] 108 unique IDs validation
- [ ] Nemo engine availability check
- [ ] production parameter verification
- [ ] dry-run
- [ ] single-ID generation check
- [ ] batch WAV generation
- [ ] WAV validation
- [ ] MP3 conversion
- [ ] MP3 validation
- [ ] missing/extra ID check
- [ ] 108 phrase full manual listening QA
- [ ] defect regeneration
- [ ] device verification
- [ ] attribution verification
- [ ] final production verification

---

### Phase 12：Bundled Audio Playback Implementation

**Purpose**：實作三層 audio 播放策略（bundled MP3 Primary → `SpeechSynthesis` Fallback → 文字 Final
fallback），含 timeout／terminal-state 防護與單一 active playback 管理；**本階段不依賴 108 個正式音檔
已存在**，測試以 mock／模擬 404 情境驗證行為。

- [X] T056 [P] 擴充 `src/features/travel-japanese/phraseAudio.test.ts`：新增案例涵蓋 bundled 播放成功、
      bundled 失敗→`SpeechSynthesis` 成功、bundled 失敗→`SpeechSynthesis` 亦失敗（`failed`）、
      bundled／`SpeechSynthesis` 皆無終止事件之 no-event timeout 恢復、缺少對應音檔（模擬 404／
      `error` 事件）正確 fallback，依 [research.md](./research.md) §6 mock 策略（`HTMLMediaElement`
      `play()` spy + 手動觸發事件）
- [X] T057 重構 `src/features/travel-japanese/phraseAudio.ts`：新增 `playBundledAudio(phraseId,
      handlers)`（Primary，依路徑 `` /audio/travel-japanese/${phraseId}.mp3 `` 建立/重用
      `HTMLAudioElement`）、保留 `speakJapanese`（Fallback）、將 `cancelSpeech` 更名為
      `cancelPlayback()`（同時終止 bundled audio 與 `SpeechSynthesis`），並新增 timeout/terminal-state
      管理（逾時無終止事件時視同該層失敗並依序 fallback），依
      [contracts §3](./contracts/travel-japanese-contracts.md)
- [X] T058 擴充 `src/screens/TravelJapaneseScreen.tsx`：`onPlay(phrase)` 改為依序呼叫
      `playBundledAudio` → （`onError` 時）`speakJapanese`，並依 handlers 更新 `activePhraseId` /
      `playbackStatus`；`useEffect` cleanup 改呼叫 `cancelPlayback()`（取代 `cancelSpeech()`），依
      [data-model.md](./data-model.md) §5「狀態轉換：Playback」
- [X] T059 [P] 擴充 `src/screens/TravelJapaneseScreen.test.tsx`：新增案例驗證第二句播放觸發時終止
      第一句（含終止任何 pending timeout）、重複播放同一句行為一致且不殘留前次播放狀態、audio
      任一層失敗皆不影響 favorites／search／categories／文字顯示、component unmount 呼叫
      `cancelPlayback()`
- [X] T060 [P] 複查 `src/features/travel-japanese/PhraseCard.tsx` 與其測試：確認既有
      `playbackStatus`／`isActivePlayback` props 契約與 UI 呈現（文字＋`aria-live`、`failed` 時卡片
      文字與收藏按鈕仍可操作）於改用三層策略後不需變更即可相容，若發現不相容則列出具體差異供本任務
      內修正

**Checkpoint**：Phase 12 完成後，三層 audio 策略可在**無正式 108 個 MP3** 的情況下以 mock／404 情境
通過全部測試（等同驗證 Fallback 與 Final fallback 路徑正確），為後續正式音檔就緒後的無縫接軌做準備

---

### Phase 13：Runtime Audio Cache

**Purpose**：於 `service-worker.ts` 新增最小範圍的音檔 runtime cache 分支，僅在成功取得音檔後才快取，
不 precache 全部 108 個音檔，且不影響既有 app-shell 行為。

- [X] T061 [P] 擴充 `src/service-worker.test.ts`：新增案例驗證獨立 audio cache namespace／version（例如
      `travel-japanese-audio-v1`，需與 `APP_SHELL_CACHE` 區隔）、音檔首次成功 fetch 後寫入 audio
      cache、404／失敗回應**不**寫入 cache、離線時已快取音檔可正常回應、離線時未快取音檔優雅失敗（不
      拋出未捕捉例外）、`activate` 階段清除舊版本 audio cache、既有 app-shell 測試維持全數通過。
      **明確完成條件（cache-hit assertion，MUST 通過方可視為完成）**：於可控制的測試情境下（例如以
      spy／mock 包裝全域 `fetch`），對同一 `phraseId` 音檔第一次成功 fetch 後，MUST 驗證回應已寫入
      audio cache；針對**同一** audio request 發出第二次請求時，MUST 由 cache 命中直接回應，且 MUST
      斷言底層 `fetch` spy 於第二次請求時**未被再次呼叫**（即無實際 network request 發出）
- [X] T062 擴充 `src/service-worker.ts`：新增獨立 audio cache 常數（namespace/version）與最小範圍
      fetch handler 分支（僅比對 `/audio/travel-japanese/` 路徑前綴），成功回應（2xx）才
      `cache.put()`，非 2xx 或 fetch 例外**不**快取，依 [plan.md](./plan.md)「PWA / Offline
      Strategy」D. Phrase Audio Runtime Cache；此分支 MUST NOT 變更既有 `isCacheableRequest`／
      `handleNavigationRequest`／app-shell fetch 邏輯之既有行為
- [X] T063 擴充 `src/service-worker.ts` 既有 `activate` handler：於既有 app-shell cache cleanup
      邏輯之外，新增清除不屬於目前版本 audio cache namespace 的舊 audio cache（比對 cache name 前綴與
      目前版本號），與既有 app-shell cleanup／`clients.claim()` 平行執行、互不阻塞
- [X] T064 確認 `PRECACHE_URLS` 與 `APPROVED_STATIC_PREFIXES` 未（且不應）涵蓋全部 108 個音檔路徑：
      新增測試或檢查斷言，確認 install 階段**不**主動下載全部音檔（僅 runtime
      cache-on-first-successful-fetch 於實際播放時觸發）

**Checkpoint**：Phase 13 完成後，音檔快取行為僅在「已成功播放過」時才生效，且不影響既有 App Shell
precache／offline fallback 行為（既有 `service-worker.test.ts` 全數案例維持通過）

---

### Phase 14：PWA Update Reliability

**Purpose**：在既有 waiting worker／`UpdatePrompt`／使用者主動 `SKIP_WAITING`／`controllerchange`
reload 機制之外，新增 foreground／`visibilitychange` 節流版 `registration.update()`，不自動
`skipWaiting`、不強制 reload、不做無限制 polling。

- [X] T065 [P] 擴充 `src/components/UpdatePrompt.test.tsx`：新增案例驗證
      `document.visibilitychange` 且 `document.visibilityState === 'visible'` 時呼叫既有
      registration 的 `update()`、同一 session 內短時間內重複觸發 foreground 會被節流（不重複呼叫
      `update()`）、`update()` rejection 被容錯處理且不拋出未捕捉例外、既有 waiting worker 偵測／
      使用者按下「立即更新」／`controllerchange` 僅 reload 一次等既有案例維持全數通過
- [X] T066 擴充 `src/components/UpdatePrompt.tsx`（`useServiceWorkerUpdate`）：保留取得的
      `registration` 參照，新增 `visibilitychange` event listener，於節流條件成立時呼叫
      `registration.update().catch(() => {})`；不新增任何 polling timer、不在此流程中呼叫
      `applyUpdate()`／`postMessage('SKIP_WAITING')`，依 [plan.md](./plan.md)「十四、PWA Update
      Reliability」
- [X] T067 複查確認：`self.skipWaiting()`（`service-worker.ts`）與 `applyUpdate()`
      （`UpdatePrompt.tsx`）之既有「僅使用者主動觸發」行為未被本階段變更；`controllerchange` reload
      仍僅發生一次；本階段新增邏輯未引入任何無節流限制的 interval polling

**Checkpoint**：Phase 14 完成後，App 回到前景可更即時發現新版本，但使用者互動流程（非阻塞提示、手動
「立即更新」、單次 reload）與既有行為完全一致

---

### Phase 15：Automated Regression

**Purpose**：確認本次 Maintenance 之全部變更（Phase 12–14）未破壞既有 Feature 001–004 自動化測試、PWA
red-gate 行為與型別／打包正確性，且未引入未經授權之 dependency 或範圍外變更。

- [X] T068 執行 `npx vitest run`：確認 Feature 004 全部測試（含 T056／T059／T061／T065 新增案例）通過，
      且既有 Feature 001／002／003 自動化測試維持 100% 原有通過狀態；若發現既有測試失敗，依
      [plan.md](./plan.md)「Regression Failure Handling」視為 regression blocker 並優先處理。
      本次實際執行結果：**48 / 48 test files、431 / 431 tests 全數通過**。
- [X] T069 執行 `npm run build`：確認型別檢查與打包無誤
- [X] T070 執行 `npm run test:pwa-red-gate`：確認既有 PWA 行為（App Shell、offline fallback、update
      prompt）與新增音檔 cache 邏輯皆不造成既有 red-gate 案例失敗；本次實際執行結果：**4 / 4**
      案例全數通過
- [X] T071 執行 `git diff` / dependency drift check：確認 `package.json`／`package-lock.json` 無變動、
      確認本次變更範圍僅限於 Phase 12–14 所列檔案（`src/features/travel-japanese/phraseAudio.ts`、
      `src/screens/TravelJapaneseScreen.tsx`、`src/service-worker.ts`、
      `src/components/UpdatePrompt.tsx` 及對應測試檔），未觸及 `public/**`（音檔內容）、
      `package.json`、既有 001–003 專屬檔案；本次實際執行結果：`git diff --check` 無輸出，
      working tree 變更僅限本輪 hotfix 所需檔案，未加入 dependency

**Checkpoint**：Phase 15 全數通過後，方可進入 Manual Cross-device Verification（Phase 16）

---

### Phase 16：Manual Cross-device Verification

**Purpose**：以人工走查確認實際裝置／瀏覽器行為符合預期；目標為跨品牌行動裝置可用，**不**將特定品牌
設定調整列為產品必要步驟。

- [X] T072 建立並執行跨裝置手動驗證矩陣（至少涵蓋 Windows Chrome、iPhone 瀏覽器、Android Chrome、
      Android 已安裝 PWA 四種環境），拆分為 A／B 兩部分，記錄各環境走查結果與任何觀察到的差異（不得將
      任何單一品牌特定設定調整記為產品必要前置步驟）：

      **A. 可在正式 MP3 assets 尚未生成時執行**（不依賴正式 MP3 音檔）：App 顯示為新版本、UI 顯示（category／
      phrase card／search／favorites 正常渲染）、search 功能正常、category 切換正常、favorites
      功能正常、text fallback（日文與繁中文字恆可讀）、`SpeechSynthesis` fallback 行為（bundled
      asset 缺席／404 時之 Fallback 播放路徑）、PWA update prompt 與 foreground update check（Phase
      14）正常運作、graceful failure（音檔缺席或播放失敗不影響其他功能）。

      **B. 僅限正式 MP3 assets 已就緒後才可執行**：bundled MP3 於四種環境之真機 playback、cached
      audio offline replay（已快取音檔離線可正常播放）、uncached offline behavior（未快取音檔離線時之
      優雅降級）、四種環境之正式 bundled audio 完整驗證。

      **狀態標記規則**：若正式 MP3 assets 尚未生成，B 部分之全部項目 MUST 明確標記為
      `BLOCKED`／`PENDING`（並註明原因為「正式 MP3 assets 尚未產生」），**不得**標記為 `PASS` 或以 A
      部分結果替代 B 部分結論；A 部分可獨立完成並標記為 `PASS`／`FAIL`。

**Checkpoint**：A 部分於四種環境走查結果皆為預期行為（含已知、已批准之 fallback／降級行為）即可進入
Maintenance Closure（Phase 17）；B 部分若因正式 MP3 assets 尚未生成而標記為 `BLOCKED`／`PENDING`，不視為
Checkpoint 失敗，但 Maintenance Closure（T073）MUST 如實記錄 B 部分尚未完成之原因，不得假裝已 PASS。

---

### Phase 17：Maintenance Closure

**Purpose**：彙整本次 Maintenance 全部驗證結果，確認既有 Feature 004 歷史任務未被覆寫，確認 repository
safety 與 授權邊界全數維持。

- [X] T073 彙整 Maintenance 執行結果並確認：(a) T001–T045 之任務內容與 `[X]` 完成狀態未被覆寫或重編；
      (b) 本次新增之 T046–T072 依 Phase 10–16 全數完成或明確記錄未完成原因；(c) 0 新增 npm
      dependency；(d) 未建立任何實際 MP3 音檔（production baseline approval 不等於 108 句正式音檔完成）；
      (e) `004-safe-baseline`（`ddc73392be88b1bb2e44356a1e4077d96d97bf45`）未被移動；
      (f) 無 commit／push／tag 於本次 Maintenance 範圍內發生

**Checkpoint**：Maintenance Phase（T046–T073）全數確認後，本次 Feature 004 Maintenance 之
`/speckit-tasks` 階段工作完成；仍須待 `/speckit.analyze` 與使用者對 `/speckit.implement` 之明確批准，
方可開始實際 implementation

---

### Maintenance Phase Dependencies

- **Phase 10（Preflight）**：無相依，可立即開始；**BLOCKS** Phase 11
- **Phase 11（Audio Asset Gate）**：依賴 Phase 10 完成；T055 已批准 production baseline，但**不**等於
  108 個正式音檔已完成，且正式 MP3 生成仍需後續 production tasks 依清單完成（不 BLOCK Phase 12
  程式碼開發，因 Phase 12 以 mock／404 情境驗證，不依賴正式音檔已存在）
- **Phase 12（Bundled Audio Playback）**：依賴 Phase 10 完成；不依賴 Phase 11 T055 是否已批准
- **Phase 13（Runtime Audio Cache）**：依賴 Phase 12 完成（`playBundledAudio` 需已存在，audio cache
  fetch handler 才有實際請求可攔截）
- **Phase 14（PWA Update Reliability）**：依賴 Phase 10 完成；與 Phase 12／13 相互獨立，可平行進行
- **Phase 15（Automated Regression）**：依賴 Phase 12、13、14 全數完成
- **Phase 16（Manual Cross-device Verification）**：依賴 Phase 15 全數通過
- **Phase 17（Maintenance Closure）**：依賴 Phase 16 完成

### Maintenance Phase Notes

- 本 Maintenance Phase 之任務編號（T046–T073）接續既有 T001–T045，不重複、不重編既有任務
- T055（Audio Production Method Approval）已於 2026-09-23 正式批准，批准內容為 `VOICEVOX Nemo` /
  男声1（ノーマル）／CV レナード・ジン 等 production baseline；此 approval 仍不代表 108 個正式 asset
  已完成，且 coding agent 不得在本輪啟動任何正式 108 句生成或 deploy task
- 本 Maintenance Phase 不修改 `src/**`、`public/**`、`package.json`；不建立任何 MP3；不下載任何音檔；
  不修改既有 service-worker.ts 以外的 core service-worker lifecycle 行為（`waiting worker`／
  `clients.claim()`／既有 `APPROVED_STATIC_PREFIXES` 不變）
- 本 Maintenance Phase 不構成 implementation 授權；須待 `/speckit.analyze` 與使用者明確批准後方可執行
  `/speckit.implement`

### Maintenance Execution Record（`/speckit.implement` 實際執行結果，2026-09-21）

> 本節記錄本次已獲使用者明確批准之 `/speckit.implement` 執行結果，區別於上方「Maintenance Phase
> Notes」對 tasks.md **文件產生階段**（不修改 code）之敘述。

- **T046–T049（Preflight）**：於本次 implementation 開始前已逐項確認：`spec.md` 未變更、五份文件對
  三層 audio 策略／PWA foreground update 節流敘述一致、branch 為 `master`、working tree 僅含批准清單
  內 7 份 maintenance 文件、`004-safe-baseline`（`ddc73392be88b1bb2e44356a1e4077d96d97bf45`）未被移動、
  `package.json`／`package-lock.json` 未變更。PASS。
- **T050–T054（Audio Asset Gate 定義）**：對應驗證規則與品質 checklist 已於本次 Maintenance
  Documentation Sync 完整記錄於 [contracts §7](./contracts/travel-japanese-contracts.md#7-audio-asset-content-contract正式音檔內容契約maintenance-amendment-新增2026-09-21)
  （含 §7.1–§7.4 執行記錄位置），本階段**僅為規格定義**，未建立、未下載任何音檔或 manifest 實作檔案，
  符合「本任務僅定義測試規格」之限制。PASS（規格完整，待 T055 批准後方可據以實作 manifest 與實際音檔）。
- **T055（APPROVED）**：已正式批准 production baseline，包含 `VOICEVOX Nemo`、男声1（ノーマル）／CV
  レナード・ジン、固定參數、WAV master → MP3 delivery asset、static MP3 Primary →
  `SpeechSynthesis` fallback → text fallback、108 句全量人工聽檢、attribution requirement、runtime
  不能依賴 Nemo/OpenAI；本階段仍**不**將 108 句 production 標示為完成，亦不生成任何實際音檔。
  記錄位置： [contracts §7.4](./contracts/travel-japanese-contracts.md#74-licensing--production-approval-record執行記錄待-tasksmd-t055-stop-gate-批准後填寫)
- **T056–T060（Bundled Audio Playback）**：已實作 `playBundledAudio` / `speakJapanese` /
  `cancelPlayback`（三層策略＋timeout/terminal-state 防護），`TravelJapaneseScreen.onPlay` 改為
  bundled → SpeechSynthesis 依序呼叫，`useEffect` cleanup 改呼叫 `cancelPlayback()`；`PhraseCard.tsx`
  複查後確認既有 props 契約不需變更。對應 Vitest 全數通過（`phraseAudio.test.ts` 14 案例、
  `TravelJapaneseScreen.test.tsx` 20 案例，含 mock 404／timeout／second-phrase-stops-first 等情境）。
- **T061–T064（Runtime Audio Cache）**：已於 `service-worker.ts` 新增獨立 `travel-japanese-audio-v1`
  cache namespace 與 `/audio/travel-japanese/` fetch handler 分支（僅 2xx 才 cache、404 不 cache、
  `activate` 清除舊版本 audio cache），未變更既有 `PRECACHE_URLS`／`APPROVED_STATIC_PREFIXES`／
  app-shell 行為。`service-worker.test.ts` 新增 9 案例（含 cache-hit fetch spy 未被再次呼叫之明確斷言）
  全數通過，既有 24 案例維持通過。
- **T065–T067（PWA Update Reliability）**：已於 `UpdatePrompt.tsx`（`useServiceWorkerUpdate`）新增
  `visibilitychange` 觸發 `registration.update()`，60 秒節流、`.catch(() => {})` 容錯；未新增 polling、
  未自動 `skipWaiting`、`controllerchange` 仍僅 reload 一次。`UpdatePrompt.test.tsx` 新增 5 案例全數
  通過，既有 4 案例維持通過。
- **T068–T071（Automated Regression）**：`npx vitest run` 全專案 48 個測試檔、413 個測試全數通過；
  `npm run build` 成功；`npm run test:pwa-red-gate`（Playwright）4 個既有案例全數通過；
  `package.json`／`package-lock.json` 無變動；`git diff --check` 無 whitespace 錯誤；本次變更範圍確認
  僅限 `src/features/travel-japanese/phraseAudio.ts`（含測試）、`src/screens/TravelJapaneseScreen.tsx`
  （含測試）、`src/service-worker.ts`（含測試）、`src/components/UpdatePrompt.tsx`（含測試），未觸及
  `public/**`、`package.json` 或既有 001–003 專屬檔案。PASS。
- **T072（Manual Cross-device Verification）**：**COMPLETE**——2026-09-24 由人工測試者於四種實體環境
      實際執行完整走查，結果如下：
      - **A. Windows / Desktop Chrome**：第一次播放立即有聲 PASS；正式男聲 MP3 PASS；第二次播放仍為
        男聲 PASS；無男/女聲交替 PASS。
      - **B. iPhone Browser**：第一次播放立即有聲 PASS；不需第二次點擊 PASS；正式男聲 PASS；第二次
        播放仍為男聲 PASS。
      - **C. Android Chrome**：第一次播放立即有聲 PASS；不需第二次點擊 PASS；正式男聲 PASS；第二次
        播放仍為男聲 PASS。
      - **D. Android Installed PWA**：第一次播放立即有聲 PASS；第二次播放仍為男聲 PASS；無男/女聲交替
        PASS；cached offline replay PASS；無 reload loop PASS。
      - **Overall T072：PASS**。B 部分（正式 bundled MP3 playback／cached offline replay／uncached
        offline behavior）已隨正式 108 句 MP3 production 完成而一併於本輪實機驗證中執行並全數 PASS，
        不再為 `BLOCKED`／`PENDING`。既有 Human QA 108/108 PASS 之事實不因本次 device verification 而
        變更或重複計入。
- **T073（Maintenance Closure）**：**COMPLETE**——T001–T045 完成狀態未被覆寫；T046–T072 依 Phase
      10–16 全數完成；T055 已正式批准且 108 句正式 MP3 production 已完成；T072 人工跨裝置驗證已於
      2026-09-24 完成且四種環境全數 PASS；0 新增 npm dependency；`004-safe-baseline`
      （`ddc73392be88b1bb2e44356a1e4077d96d97bf45`）未被移動；production redeploy PASS；automated
      production verify PASS；verification evidence 已同步。Maintenance Phase（T046–T073）fully
      complete。

### Phase C MP3 Delivery Execution Record（2026-09-23）

> 本節為 T055 已批准後之正式 MP3 delivery 執行紀錄；不修改 spec.md。永久 baseline、master、origin/master 與既有 approved working-tree changes 均保留。

- **Phase C Source Gate：PASS**：108 WAV（`tj-001`～`tj-108`）完整；四份 Human QA evidence 一致，108/108 PASS、FAIL 0、PENDING 0、Human QA Completed YES。
- **Dry-run：PASS**：source 108、expected target 108、ID mapping、`tj-097` replacement、96 kbps CBR 與 output path 均確認，未寫入 MP3。
- **MP3 conversion：PASS**：ffmpeg 8.0.1、`libmp3lame`、96 kbps CBR；108 個 approved WAV master 全數轉換，`tj-097.mp3` 由 production WAV 正式覆寫。
- **Validation：PASS**：success 108、failure 0、missing 0、extra 0、invalid 0、zero-byte 0；duration integrity PASS；size 12,428–34,604 bytes。
- **Runtime：PASS**：App path 108/108 mapping；`travel-japanese-audio-v1` cache 行為由 service-worker tests 驗證；不 precache 全部 108 檔；Nemo/OpenAI 均非 runtime dependency。
- **Tasks sync**：本紀錄取代上方「MP3 conversion 尚未完成」之歷史狀態；T055 仍為 APPROVED。新的 MP3 delivery 已完成，但實體裝置跨裝置人工走查仍依 T072 另行記錄，不以本次 conversion check 冒充。

---

### Phase 18：Documentation / Evidence Remediation（Analyze Remediation，2026-09-23）

**Purpose**：對應 `/speckit-analyze` findings（CRITICAL-1／HIGH-1／HIGH-2／HIGH-3），補足既有已批准之
後續收尾工作（README／`.gitignore`／QA tooling／vitest config 等）之 task tracking，並持久化獨立
approval 稽核紀錄與最新 final integration test evidence。**本 Phase 僅為 documentation / evidence
remediation，不修改 runtime product behavior、不修改 108 個 MP3、不修改任何 WAV master、不修改既有
Human QA PASS/FAIL 事實、不將 T072 標記為完成、不執行 device verification、不 deploy、不 push、不
tag、不移動 baseline。**T071／T072／T073 之既有內容與狀態不受本 Phase 影響，維持原樣。**

- [X] T074 [P] 建立獨立 approval 稽核紀錄
      `docs/approvals/004-travel-japanese-audio-implementation-approval.md`：彙整既有已批准事實
      （T055 production baseline、108 WAV production、108/108 Human QA、Phase C MP3 delivery、
      Integration Cleanup），明確聲明不新增、不擴張 implementation authorization，且明確記錄 T072
      未完成、production deployment 未開始、new safety tag 未建立
- [X] T075 [P] 建立最新 final integration test evidence
      `docs/verification/004-final-integration-test-evidence.md`：重新執行 `npm run test`、QA Node
      suite（`node --test tools/travel-japanese-audio-qa/qa-data.test.mjs`）、`npm run build`、
      `npm run test:pwa-red-gate`、`git diff --check`，並持久化本次實際結果（Vitest 417/417、QA Node
      suite 8/8、Build PASS、PWA Red Gate 4/4、`git diff --check` PASS），同時標明既有歷史數字
      （422/422、413 個測試）為當時執行結果，不竄改
- [X] T076 追蹤 `.gitignore` 新增 WAV master 保留／不進 Git delivery 之 ignore 規則
      （`production/audio/travel-japanese/wav/`），對應目前 staged 變更
- [X] T077 追蹤 `vitest.config.ts` 新增 `exclude`，排除
      `tools/travel-japanese-audio-qa/qa-data.test.mjs`（該檔為 Node 原生 `node --test` suite，非
      Vitest suite，避免 Vitest 收集無 test suite 檔案而 exit 1）
- [X] T078 追蹤本機 Human QA 工具 `tools/travel-japanese-audio-qa/**`（`server.mjs`、
      `lib/qa-data.mjs`、`public/**`、`qa-data.test.mjs`、`README.md`）：對應目前 staged 變更，並確認
      該工具非正式 App 功能、不進 production runtime、不呼叫 VOICEVOX Nemo synthesis
- [X] T079 追蹤 Human QA evidence 持久化
      `production/audio/travel-japanese/reports/human-qa-checklist.md`／`human-qa-results.json`／
      `human-qa-summary.md`：對應目前 staged 變更；本任務不修改上述檔案之 PASS/FAIL 內容
- [X] T080 追蹤 diagnostic-only production 報告之保留位置
      `production/audio/travel-japanese/reports/batch-summary.json`／`dry-run-report.json`：確認
      此類 diagnostic/production 過程證據僅存放於 `production/` 而非 `public/` runtime 路徑，不影響
      App 實際載入之 asset
- [X] T081 追蹤 `README.md` 語音架構與離線行為敘述同步（三層策略、VOICEVOX Nemo 可見 attribution、
      local-first 搜尋／收藏、runtime cache-on-first-successful-fetch 離線行為敘述）：對應目前 staged
      變更
- [X] T082 追蹤 `docs/verification/travel-japanese-audio-production-verification.md` 措辭精確化：
      將原「108-Phrase Production Complete：YES」單一措辭拆解為獨立狀態行（MP3 Delivery
      Production：COMPLETE／Human QA：108/108 PASS／Cross-device Verification（T072）：NOT
      COMPLETED／Production Deployment：NOT STARTED／New Safety Tag：NOT CREATED），並為第 8 節舊
      422/422 test 數字加註「當時執行結果」與指向 T075 建立之最新 final evidence 之引用

**Checkpoint**：Phase 18 完成後，`/speckit-analyze` 對應之 CRITICAL-1／HIGH-1／HIGH-2／HIGH-3 findings
之 documentation／evidence 缺口皆已補齊；T072 仍為未完成、production deployment 仍未開始、new safety
tag 仍未建立，皆不因本 Phase 而變更。

> **後續狀態更新（2026-09-24，Feature 004 Final Closure）**：上列「T072 仍為未完成、production
> deployment 仍未開始、new safety tag 仍未建立」為 Phase 18（2026-09-23）執行當下之如實記錄，
> **保留不刪除**。此三項已於 2026-09-24 依序完成：T072 已於本文件上方 Maintenance Execution Record
> 更新為 `COMPLETE`（四種環境實機驗證全數 PASS）；production deployment 已完成並經 automated
> production verify PASS；新 safety tag `004-audio-production-safe-baseline` 已依本輪 Final Closure
> 批准建立。詳見
> [docs/verification/travel-japanese-audio-production-verification.md](../../docs/verification/travel-japanese-audio-production-verification.md)。
