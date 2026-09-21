# Implementation Plan: Tokyo Mate 東京通｜旅遊日文 Travel Japanese

**Branch**: `004-travel-japanese`（實際 git 分支；spec 目錄為 `specs/004-travel-japanese-phrases/`，兩者
名稱些微差異僅為既存事實記錄，不影響本 Plan 內容） | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-travel-japanese-phrases/spec.md`（Clarify 後最新版，含
2026-09-21 Session 兩則 Clarification：unique phrase >= 100、Help & Emergency MUST 顯示明確可見安全提醒）

**Note**: 本文件僅為 Technical Plan。不構成 implementation 授權（Constitution XI. Authorization Boundary）。

## 0. Repository Inspection Summary

實際 inspect 現有 repository 後確認：

1. **既有 stack**：React 18.3 + TypeScript 5.6 + Vite；`src/` frontend + `api/` Vercel serverless functions；
   無 router、無 global state library（Redux/Zustand 皆未安裝）。`package.json` 目前 `dependencies` 僅
   `leaflet`、`openai`、`react`、`react-dom`，`devDependencies` 對應既有 003 Leaflet 整合與既有測試工具鏈。
2. **既有畫面導覽 pattern**：無 router。`App.tsx` 僅切換首頁／東京百科；`HomeScreen.tsx` 以本地
   `useState` boolean 切換 `AssistantScreen` / `NearbyScreen` / `PhotoTranslateScreen`，各 screen 以
   `onBack` prop 返回首頁。本 Plan 沿用完全相同 pattern，不新增 routing library。
3. **既有 feature-local 資料夾慣例**：`src/features/<feature>/` 下放置該 feature 專屬元件（例如
   `src/features/knowledge/CategoryFilter.tsx`、`KnowledgeCard.tsx`）；資料集以 `src/data/tokyo/*.json`
   靜態 ESM import（`with { type: 'json' }`）進 `src/services/<feature>.ts`，由該 service 提供
   catalog／filter／search 函式，畫面層不直接 import JSON。
4. **既有 localStorage 使用狀況**：全 repo 搜尋確認 `src/` 下**目前沒有任何** `localStorage` /
   `sessionStorage` / `IndexedDB` 寫入呼叫；既有 001 Specification（FR-017/018/026）明確禁止把聊天內容、
   翻譯結果、精確位置、語音 blob 等寫入這些儲存。Feature 004 的 Favorites（收藏 phrase id 清單）是
   repository 中**第一個**合法使用 browser local persistence 的既有已批准情境（spec FR-023 明確要求同裝置
   重開 App 後仍存在，且不需要帳號／Cloud），與 001 對「聊天內容／翻譯結果／位置」的禁止範圍不衝突——
   Favorites 只保存「使用者主動標記的 phrase id 清單」，不屬於 001 FR-017/018/026 所禁止的類別。
5. **既有語音播放能力（重要發現）**：`src/components/AudioPlayer.tsx` 透過 `services/api.ts` 的
   `generateSpeech()` 呼叫既有 `api/speech.ts`（server-side OpenAI `gpt-4o-mini-tts`，`OPENAI_API_KEY`
   為 server-only secret），已在 Feature 001（`AssistantScreen`）用於日文語音播放。此為既有、已批准、正在
   production 使用的 Cloud TTS 能力。**本 Plan 在下方「八、Audio Technology Decision」中明確記錄此發現，
   並說明為何 Feature 004 選擇瀏覽器原生 `SpeechSynthesis` 而非重用此既有 Cloud TTS 流程**，此為需要
   Technical Plan Conformance Check 時明確確認的決策點，但不構成 STOP（未新增 dependency／secret／
   backend／AI service，且符合 Simplest Sufficient Technology）。
6. **既有 PWA 快取 allowlist**：`src/service-worker.ts` 的 `APPROVED_STATIC_PREFIXES` 已包含
   `/src/data/tokyo/`。將新 dataset 放在此既有前綴下，可沿用既有 allowlist，**不需修改
   `service-worker.ts`**。
7. **既有測試慣例**：`src/services/knowledge.test.ts`（service 層 dataset／search 邏輯測試）、
   `src/features/knowledge/*.test.tsx`（元件測試）、`src/screens/*.test.tsx`（screen 整合測試），採
   Vitest + React Testing Library；`tests/` 下另有 Playwright regression（`playwright.config.ts` /
   `npm run test:pwa-red-gate`）。
8. **004 UX/UI Handoff 文件現況（已更新）**：`specs/004-travel-japanese-phrases/` 現已建立獨立的
   [ux-ui-design-handoff.md](./ux-ui-design-handoff.md)，整理已批准的核心體驗、主要 Views、首頁、
   Phrase Card、Audio、Search、Favorites、Safety、Mobile-first 與 Accessibility 等 UX/UI 決策，格式
   比照既有 001/002 前例。該文件為 UX/UI reference，不新增 `spec.md` 之外的產品行為，亦不構成
   implementation 授權。

**結論**：既有架構（React + TypeScript + Vite、無 router、feature-local state、`src/data/tokyo/` +
service 層 + feature 元件 pattern）足以承載 Feature 004 全部 5 項核心功能，不需要新增 dependency、
Backend endpoint、Cloud DB、Authentication 或 state 管理套件。

## Summary

Feature 004 以「情境瀏覽 → 句子卡（日文＋繁中＋語音）→ 搜尋 → 收藏」延伸既有 App 的第六個功能入口，完全
在既有 frontend 架構內完成：

- **資料**：新增 1 份靜態 dataset（`src/data/tokyo/travel-japanese-phrases.json`），每個 phrase 為
  unique 實體，可關聯一至多個情境（`categories: string[]`），避免以複製內容方式灌注 placement 數量。
- **畫面**：新增 1 個 screen（`TravelJapaneseScreen.tsx`），沿用既有「screen 本地 state 切換 view」
  pattern（無 router），管理 4 個內部 view：情境清單／情境內句子／搜尋結果／我的常用句。
- **搜尋**：Local deterministic frontend 搜尋（正規化字串 + array filter），僅回傳正式 dataset，無
  fuzzy-search dependency、無 Backend、無 AI。
- **收藏**：`localStorage` 保存 phrase id 陣列（非整份 phrase 內容），screen 層以單一 `Set<string>`
  狀態達成跨情境／搜尋結果一致性；讀寫失敗時安全降級為空收藏，不影響其餘功能。
- **語音**：瀏覽器原生 `SpeechSynthesis`（Web Speech API），非既有 Cloud TTS。單一 active playback 由
  `TravelJapaneseScreen` 集中管理（`activePhraseId` + `playbackStatus`）。

## Technical Context

**Language/Version**: TypeScript 5.6（既有 `tsconfig.json`），React 18.3

**Primary Dependencies**: React、Vite（既有）；**不新增任何 npm dependency**。語音使用瀏覽器原生
`window.speechSynthesis` / `SpeechSynthesisUtterance`（Web Speech API，非 npm package）；收藏使用瀏覽器
原生 `window.localStorage`。

**Storage**: 瀏覽器 `localStorage`（僅 favorite phrase id 陣列，無資料庫、無 Cloud）

**Testing**: Vitest + React Testing Library（沿用既有 `vitest.config.ts` / `src/test/setup.ts`），必要時
沿用既有 Playwright regression 套件

**Target Platform**: 既有 Vite + Vercel 部署行動優先 Web App（既有 PWA 能力不變）

**Project Type**: 既有 single-page web application（`src/` frontend + `api/` Vercel serverless
functions）；本 feature **不新增任何 `/api/*` endpoint**。

**Performance Goals**: 沿用既有畫面反應標準；情境瀏覽／搜尋為同步 in-memory array 運算（約
100–150 筆資料規模），無需 debounce 以外的效能優化；語音播放為瀏覽器原生能力，無網路等待（若 voice 可用）。

**Constraints**: 零新增 runtime dependency；零新增 `/api/*` endpoint；零新增 secret；localStorage 讀寫
MUST 容錯（malformed/unavailable 時安全降級，不得 crash）；同一時間最多一個 active playback；safety
reminder 不得只依賴顏色。

**Scale/Scope**: 1 個新 screen、約 4–6 個新 feature-local module、1 份新 dataset（unique phrase >= 100，
category placements >= 140，每類 >= 20）、不新增 backend、不新增資料庫。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 檢查結果 | 說明 |
|------|---------|------|
| I. Specification Before Implementation | 通過 | 本 Plan 完全依 Clarify 後 spec.md（FR-001–FR-035）展開，未新增或縮減產品行為；使用 Clarify 後 unique phrase >= 100、safety reminder MUST 顯示等最新條款。 |
| II. Simplest Sufficient Technology | 通過 | 搜尋採 array filter；語音採瀏覽器原生 API；收藏採 `localStorage`；皆為零新增 dependency 的最簡方案。 |
| III. A/B/C Complexity Discipline | 通過 | 未新增 Cloud 基礎設施、multi-user、Authentication、Backend 權限架構；亦未新增 Generative AI 核心能力（見下方 Audio Decision，明確選擇非 AI 生成語音）。維持 A｜Frontend-first。 |
| IV. Incremental Enhancement | **有條件通過（需 Conformance Check 確認）** | 畫面導覽、feature 資料夾、dataset+service 層 pattern 完全延伸既有慣例。**唯一例外**：語音播放**不**重用既有 `AudioPlayer`/`generateSpeech` Cloud TTS 流程，改用瀏覽器原生 `SpeechSynthesis`，理由詳見下方「八、Audio Technology Decision」。此為 repository inspection 後發現的既有可重用能力，故明確記錄於此供作者確認，而非默默略過。 |
| V. Technology Stack Stability | 通過 | 未替換 framework／AI provider／deployment／secret handling model；`SpeechSynthesis` 與 `localStorage` 為既有瀏覽器原生能力，非新 stack 元件。 |
| VI. Privacy & Educational Safety | 通過 | 僅新增「使用者主動收藏的 phrase id」此一最小必要資料，無帳號、無位置、無麥克風、無 shaming/dark pattern。 |
| VII. Testability | 通過 | 見下方 Testing Strategy，涵蓋 dataset 驗證、正常流程、failure/recovery（語音失敗、localStorage 失敗、無搜尋結果）與 regression。 |
| VIII. Maintainability | 通過 | Dataset 存取、搜尋、收藏、語音各自獨立 module，職責單一；不建立不必要抽象層。 |
| IX. Incremental Implementation | 通過 | Implementation Phases（見下）採 Phase 1–6，每 phase 皆為 Implement → Run → Verify → Fix；本 Plan 不執行任何 phase。 |
| X. Repository Safety | 通過 | 未修改 `specs/001-*`／`specs/002-*`／`specs/003-*`；未移動任何 baseline tag；未執行 destructive 操作。 |
| XI. Authorization Boundary | 通過 | 本 Plan 不修改 application code、不安裝 dependency、不建立 dataset 正式內容檔案之外的程式碼；仍待 `/speckit.tasks` 與 `/speckit.implement` 批准。 |
| XII. 繁體中文交付 | 通過 | 本 Plan 與所有 artifacts 均以繁體中文撰寫；程式 identifier／path 保留英文。 |

**需 Conformance Check 明確確認之項目**：IV（Audio 決策不重用既有 Cloud TTS flow，見下方第八節完整比較）。

## Project Structure

### Documentation (this feature)

```text
specs/004-travel-japanese-phrases/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── travel-japanese-contracts.md   # Phase 1 output（內部 module/component 介面契約）
├── ux-ui-design-handoff.md  # 已批准 UX/UI 決策 reference（本次 planning artifact 補強新增）
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── data/
│   └── tokyo/
│       └── travel-japanese-phrases.json   # 新增；正式 dataset（沿用既有 SW allowlist 前綴，不需改 service-worker.ts）
├── types/
│   └── travelJapanese.ts                  # 新增；TravelJapaneseCategory / TravelJapanesePhrase 型別
├── services/
│   └── travelJapanese.ts                  # 新增；catalog 載入、category 分組、search、dataset 驗證輔助函式
├── features/
│   └── travel-japanese/
│       ├── CategoryList.tsx               # 新增；7 情境清單（沿用 knowledge/CategoryFilter.tsx 的 tablist pattern）
│       ├── PhraseCard.tsx                 # 新增；日文＋繁中＋播放＋收藏
│       ├── SearchBar.tsx                  # 新增；搜尋輸入（label、debounce 非必要，資料量小）
│       ├── FavoritesList.tsx              # 新增；我的常用句（含空狀態）
│       ├── SafetyReminder.tsx             # 新增；Help & Emergency 情境安全提醒（明確可見、非 modal）
│       ├── favorites.ts                   # 新增；localStorage 讀寫（容錯）
│       └── phraseAudio.ts                 # 新增；SpeechSynthesis 封裝（單一 active playback）
├── screens/
│   └── TravelJapaneseScreen.tsx           # 新增；state owner（view／selectedCategory／searchQuery／
│                                          # favoriteIds／activePhraseId／playbackStatus），onBack 返回首頁
└── App.tsx / screens/HomeScreen.tsx        # 擴充；HomeScreen 新增一個導覽入口按鈕開啟 TravelJapaneseScreen
                                            # （沿用既有 nearbyOpen/photoTranslateOpen 相同 boolean state pattern）

tests/
└── (unit) src/services/travelJapanese.test.ts        # 新增；dataset 驗證（7 類、>=100 unique、>=140 placements、每類>=20…）
└── (unit) src/features/travel-japanese/*.test.ts(x)  # 新增；PhraseCard／favorites／phraseAudio／SafetyReminder
└── (unit) src/screens/TravelJapaneseScreen.test.tsx  # 新增；view 切換、搜尋、收藏一致性、播放狀態、無障礙
└── (既有) Playwright regression 套件擴充              # 001／002／003 regression 涵蓋
```

**Structure Decision**: 沿用既有 single Vite frontend + Vercel serverless `api/` 結構（與 001–003 一致）。
本 feature 僅在 `src/features/travel-japanese/`、`src/screens/`、`src/services/`、`src/types/`、
`src/data/tokyo/` 下新增純前端檔案，**不新增 `api/` 路由**，`HomeScreen.tsx` 僅新增一個導覽按鈕與一個
boolean state（沿用既有 `nearbyOpen`／`photoTranslateOpen` 相同的 boolean state 擴充方式）。

## 八、Audio Technology Decision（含既有 Cloud TTS 比較）

### 既有可重用能力（inspection 發現）

`AudioPlayer.tsx` + `generateSpeech()` + `api/speech.ts` 已提供日文語音（OpenAI `gpt-4o-mini-tts`，
server-side secret）。技術上可直接重用於 Feature 004。

### 比較

| 項目 | A. 重用既有 Cloud TTS（`generateSpeech`） | B. 瀏覽器原生 `SpeechSynthesis`（**本 Plan 選擇**） |
|------|------------------------------------------|------------------------------------------------------|
| Support | 依賴 server 可用性＋網路 | 依裝置／瀏覽器內建 TTS engine，不保證所有裝置皆有日文 voice |
| Japanese voice reliability | 一致（同一 OpenAI voice） | 不一致，需 runtime 偵測＋fallback；spec 已明確允許「voice 不可用時文字仍可用」 |
| Offline behavior | 不可離線（需呼叫 `/api/speech`） | 頁面已載入且裝置已安裝日文 voice 時可離線播放，貼近「旅行前收藏、途中使用」情境 |
| Bundle size | 無新增（沿用既有元件） | 無新增（原生瀏覽器 API，無 npm 套件） |
| Licensing | 既有 OpenAI 條款 | 無 |
| Privacy | 句子文字會傳送至 server／OpenAI（現況既有行為，非新增風險，但屬既有事實） | 依裝置本機 TTS engine，句子文字不需離開瀏覽器 |
| Failure behavior | 既有 `error` 狀態＋文字仍可讀 | 需自行實作 idle/requested/playing/failed（spec 要求），一致性由本 feature 負責 |
| Deployment complexity | 無新增（沿用既有 endpoint） | 無新增 |
| API key / Cost | 沿用既有 `OPENAI_API_KEY`；**每次播放**皆為一次 OpenAI TTS 呼叫，100+ 句 × 多次重複播放（旅行途中重複使用為已批准情境）會持續累積既有服務用量與延遲 | 無 API key、無邊際成本、無延遲（本機合成） |
| A/B/C complexity impact | 不變（沿用既有 C 前既有能力） | 不變，且更貼近 A｜Frontend-first、Simplest Sufficient Technology |

### 決策

選擇 **B｜瀏覽器原生 `SpeechSynthesis`**，理由：

1. Feature 004 的 dataset 是固定、不變的正式句子（非即時 AI 生成內容），不需要每次播放都呼叫 Cloud AI
   服務；持續依賴既有 Cloud TTS 會讓「一句固定短句的重複播放」持續產生非必要的既有 AI 服務用量與延遲，
   不符合 II. Simplest Sufficient Technology。
2. 「旅行前收藏、途中使用」是 spec 已批准的情境（FR-023 assumption），旅途中網路品質不穩定時，瀏覽器
   原生語音仍可能可用，Cloud TTS 則完全依賴網路。
3. 不新增 dependency／secret／backend，維持 A｜Frontend-first，且與本次 prompt 明確方向一致。
4. Spec 本身已允許「Japanese voice 不可用時，文字仍可讀、其餘功能不受影響」，故不論選 A 或 B 都需要
   graceful fallback；選 B 不會降低使用者可用性下限，但可避免既有服務的邊際成本與離線限制。

**此為 Plan 決策，非 STOP 案例**（未違反任何 Approval Gate 條件：無新增 dependency、無新增 secret、無
Backend 升級、無 Authentication、無 privacy 惡化、無 Generative AI 升級）。既有 `AudioPlayer.tsx` /
`api/speech.ts` **完全不變更**，繼續服務 Feature 001。

### Fallback 行為

- 若 `typeof window.speechSynthesis === 'undefined'` 或裝置無任何 `ja-JP`／`ja` voice：`audioAvailable =
  false`，Phrase Card 不顯示可用的播放按鈕為啟用狀態（顯示為 disabled 並附文字說明，非隱藏，維持
  Accessibility 可理解性），日文文字、繁中、搜尋、分類、收藏皆不受影響（FR-012）。
- 播放中 component unmount 或使用者離開 Feature：`TravelJapaneseScreen` 於 `useEffect` cleanup 呼叫
  `window.speechSynthesis.cancel()`，避免殘留播放。
- 新播放請求觸發時，一律先呼叫 `cancel()` 再 `speak()`，確保同一時間最多一個 active playback（FR-010/011）。

## 九、Audio Strategy Escalation Gate（Approval Gate，非新 Product Requirement）

Feature 004 已批准瀏覽器原生 `SpeechSynthesis` 作為語音首選方案（見上方第八節決策）。此為 architecture /
implementation authorization gate，**不是新的 Product Requirement**，spec.md 對語音技術方案本身維持
中立（Assumptions 章節）。

**觸發 STOP 的條件**（於 implementation 或 verification 階段發現任一項）：

- 目標 browser / device 缺乏可用的 Japanese voice。
- 日文 voice availability 低到無法合理支援目標使用情境（例如多數目標裝置皆無 `ja-JP`／`ja` voice）。
- 實際行為無法滿足已批准的 audio acceptance criteria（spec FR-008~FR-012、SC-002/SC-005）。

**發現上述任一條件時，MUST**：

1. STOP，不得自行切換語音技術方案。
2. 記錄實際證據（例如測試裝置／瀏覽器清單、voice 偵測結果、失敗率）。
3. 報告對 spec.md／plan.md 已批准 acceptance criteria 的 impact。
4. 比較 alternatives（例如重用既有 Cloud TTS、其他方案）之技術與治理影響。
5. 等待作者對新方案的明確重新 approval，方可變更。

**MUST NOT**（未取得新的明確批准前）：

- 自行改為 OpenAI TTS 或重用既有 `generateSpeech()` Cloud TTS 流程。
- 自行改為其他 Cloud TTS 服務。
- 自行改為預錄 MP3。
- 自行新增任何 external service 或 npm dependency 以替代語音方案。

此 Escalation Gate 為第八節 Audio Technology Decision 的必要配套，確保「選擇 B 方案」不會在
implementation 階段被默默變更為未經批准的技術升級（對應 Constitution V. Technology Stack Stability、
Approval Gates）。

## 十、Safety Reminder Escalation Constraint（MUST NOT Become Blocking UX）

Clarify 後正式要求（spec FR-035）是：「求助／緊急狀況」相關使用流程 MUST 顯示明確可見的 safety
reminder。此要求**不得**在 implementation 階段被自行升級為以下任一形式（未經 Specification 正式變更前）：

- Blocking modal。
- Mandatory confirmation。
- Checkbox acknowledgement。
- 每次進入該情境都必須確認一次。
- Emergency gating（例如需完成某操作才能查看句子）。
- 任何阻止使用者先看到或播放緊急 phrase 的流程。

因此 safety reminder 的呈現方式 MUST：

- 明確可見（直接呈現於句子清單上方，非需額外互動才出現）。
- 非 hidden help（非收合在「更多資訊」之類的區塊內）。
- 非 README-only（不得僅存在於文件，未反映在實際 UI）。
- 非 color-only（不得僅以顏色作為辨識或警示依據）。
- 對一般使用者與 assistive technology 皆可理解（語義化標記，例如 `role="note"`）。
- 不阻礙緊急使用流程（使用者可在不與 safety reminder 互動的情況下，立即查看、播放任一 safety-critical
  phrase）。

此限制已同步記錄於 [ux-ui-design-handoff.md](./ux-ui-design-handoff.md) 「Safety」章節，兩份文件對此
要求的敘述一致。若未來 Specification 正式變更此要求（例如新增強制確認流程），須先完成 spec.md 的正式
變更與批准，plan.md／UX handoff 才可隨之更新，不得由 implementation 階段自行升級。

## 十一、Dataset Quality Review 未達門檻之處理流程

正式 dataset 必須同時滿足 spec FR-002/FR-003/FR-034 三項門檻：

- unique phrase 總數 `>= 100`。
- category placements 總數 `>= 140`。
- 每個 category 的 placements `>= 20`。

若內容品質 review（FR-029/FR-030：日文自然度、禮貌程度、繁中自然度、旅客可直接使用性、實際旅行價值、
不必要重複、multi-category 適用性、醫療／過敏／緊急用語安全性）淘汰任一 phrase 或 category 關聯，導致
上述任一門檻不再成立時：

**MUST NOT**：

- 降低門檻數值。
- 保留已被審查判定為低價值的 phrase 以湊數（違反 FR-030）。
- 複製既有 phrase 內容灌注 unique phrase 數（違反 FR-005／data-model.md 第 1 節重複防護規則）。
- 不合理增加 category 關聯（例如將不適用的 phrase 勉強關聯至缺口 category）以灌注 placement 數。

**MUST**（依序執行，直到三項門檻全部重新 PASS）：

1. 補入新的高實用性 candidate phrase（針對缺口 category 或缺口 unique count）。
2. 對新增內容再次執行 FR-029 列出的日文自然度／禮貌程度／繁中自然度／實用性／安全性審查。
3. 再次執行 `validateTravelJapaneseDataset()`（見 contracts §1）進行 dataset validation。
4. 重複步驟 1–3，直到 unique phrase `>= 100`、總 placements `>= 140`、每個 category `>= 20` 三項門檻
   同時成立。

若補充候選內容需要改變產品 scope（例如新增第 8 個情境、變更 safety-critical 涵蓋範圍以外的內容需求）：
MUST STOP 並重新取得作者批准，不得在 dataset 產製階段默默擴大或變更 spec.md 已批准的範圍。

本流程屬 dataset production／validation 階段之責任，本 Plan 本身不執行、不建立正式 dataset 內容。

## 十二、Escalation Mechanisms for Future Deviations

為避免 Tasks／Implementation 階段的個別技術決策被默默視為已通過，本 Plan 明確重申以下情境須比照
Constitution Approval Gates 標記為 deviation 並 STOP，而非自動視為通過：

- **Architecture drift**：若出現 Constitution Check（見上方表格）與 §二十三 已逐項確認排除的項目
  （例如新增 router、Redux/Zustand、Backend endpoint、Cloud Database、Authentication、Generative AI
  搜尋或語音核心能力、新 UI/CSS framework）任一項，須標記為 architecture drift，STOP 並等待批准，不得
  默默實作。
- **Dependency escalation**：若 Tasks 階段提出任何新 npm dependency（本 Plan 明確聲明新增數為 0），
  提案須說明對應 requirement 與現有瀏覽器原生／既有工具鏈能力不足之具體原因；未附理由或理由不成立時
  視為 FAIL，不得安裝。
- **Destructive operation**：若任何階段需要 force push、history rewrite、rollback baseline tag 移動
  等 destructive git 操作，須先 STOP 並取得使用者明確批准（比照 Constitution 既有 Approval Gates 與
  Repository Safety 原則），本 Plan 不預先授權任何此類操作。
- **Language policy**：若未來任何 user-facing planning／documentation artifact（spec/plan/research/
  data-model/quickstart/contracts/ux-ui-design-handoff/checklist）被改為非繁體中文（程式 identifier／
  path／API 除外），須標記為需要修正之語言政策違反並改回繁體中文，方可視為完成。

## 十三、Dataset Runtime Anomaly Handling（既有 Graceful Failure 要求之 Technical Completion）

spec.md「Edge Cases」章節已列出：「正式資料異常導致某情境無法顯示應有的內容（正常情況下每類至少 20 個
category placements）時：顯示可理解的狀態、保留離開該畫面的方法，不造成整個 App 失效。」本節僅將此既有
Edge Case 具體化為可執行的 planning-level 要求，**不新增 Product Requirement**，而是既有 graceful-failure
原則（Constitution「Product and Security Constraints」：「失敗處理 MUST 不捏造結果」）與既有 dataset
validation 要求（FR-002/FR-003/FR-034）的 technical completion：

1. **Build/test 階段為第一道防線**：`validateTravelJapaneseDataset()`（[contracts §1](./contracts/travel-japanese-contracts.md)）
   與 Phase 2 Foundational 驗證（tasks.md T004–T008，BLOCKING）MUST 在正式 dataset 進入 production 前
   攔截不合格資料（門檻不足、`id` 重複、非法 `category`、必要欄位空白等）。正常情況下 runtime 不應遇到
   未經此驗證的資料；此為預設且優先的防線。
2. **Runtime 防禦（極端情況，最後一道防線）**：若 runtime 仍因未預期原因（例如 build artifact 損壞、
   未來內容維運流程繞過驗證）遇到無法安全使用的 dataset 異常（例如某 phrase 缺少 `japanese` 或
   `traditionalChinese`），`TravelJapaneseScreen` 與 `PhraseCard` MUST NOT 顯示虛構或半有效的 phrase
   內容（不得以空字串、佔位文字或猜測內容頂替缺失欄位並仍呈現為正常句子卡）；受影響的 view（例如該
   category-detail）MUST 呈現可理解的 graceful-failure 狀態（文字說明＋返回情境清單或首頁的方式），
   比照既有 FR-018／FR-024 空白狀態呈現慣例，MUST NOT 直接暴露 technical error 或造成整個畫面／App
   無回應。
3. **不擴及其他功能**：上述異常僅限縮影響受影響的單一 view；Feature 004 其餘 view（其他情境、搜尋、我
   的常用句）與既有 Tokyo Mate Feature 001–003 功能 MUST 不受影響，比照既有 FR-012（單一語音失敗不影響
   其他功能）之隔離原則。

本節不變更 spec.md 已批准之產品範圍與 FR 編號，僅為既有 Edge Cases／Constitution 失敗處理原則之
planning-level 技術落地；對應之未來 testing responsibility 已納入下方 Testing Strategy 「F. Dataset
runtime anomaly」與 tasks.md 新增之驗證任務。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

本 Plan 無需 Complexity Tracking 例外項目：未新增 dependency、Backend、Cloud DB、Authentication、
routing 或 global state library。唯一需明確記錄的是上方「八、Audio Technology Decision」（IV. Incremental
Enhancement 之有條件通過），已在該節完整說明理由與比較，不構成違反 Constitution 的 complexity escalation。

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1（data-model.md / contracts / quickstart.md 完成後）*

Phase 1 設計未新增 Phase 0 之外的架構元素：仍為 1 個新 screen、1 份 dataset、7 個 feature-local module
（皆為既有前端層級擴充）；未新增 `/api/*` endpoint、資料庫、Authentication 或 state 管理套件。Constitution
Check 結果與 Phase 0 一致，**通過**，Audio Technology Decision 記錄維持不變，待 `/speckit.tasks` 與
`/speckit.implement` 的 Implementation Readiness Gate 一併確認。

## Module Responsibilities（彙總）

| Module | 責任 | 變更類型 |
|--------|------|----------|
| `src/data/tokyo/travel-japanese-phrases.json` | 正式 dataset（unique phrase + categories 關聯） | 新增 |
| `src/types/travelJapanese.ts` | `TravelJapaneseCategory` / `TravelJapanesePhrase` 型別 | 新增 |
| `src/services/travelJapanese.ts` | catalog 載入、`getPhrasesByCategory`、`searchPhrases`、`getCategoryPlacementCounts`、`validateTravelJapaneseDataset`（供測試使用） | 新增 |
| `src/features/travel-japanese/favorites.ts` | `loadFavoriteIds` / `persistFavoriteIds`（localStorage 容錯讀寫） | 新增 |
| `src/features/travel-japanese/phraseAudio.ts` | `isSpeechSynthesisAvailable` / `speakJapanese` / `cancelSpeech` | 新增 |
| `src/features/travel-japanese/CategoryList.tsx` | 7 情境清單呈現（tablist pattern） | 新增 |
| `src/features/travel-japanese/PhraseCard.tsx` | 日文／繁中／播放／收藏 UI 與狀態呈現 | 新增 |
| `src/features/travel-japanese/SearchBar.tsx` | 搜尋輸入（label、accessible） | 新增 |
| `src/features/travel-japanese/FavoritesList.tsx` | 我的常用句清單＋空狀態 | 新增 |
| `src/features/travel-japanese/SafetyReminder.tsx` | Help & Emergency 安全提醒（明確可見） | 新增 |
| `src/screens/TravelJapaneseScreen.tsx` | View／收藏／播放狀態 owner，串接以上 module | 新增 |
| `src/screens/HomeScreen.tsx` | 新增一個導覽入口按鈕與 boolean state | 擴充 |

## Dependencies

**新 runtime dependency：0**。語音（`SpeechSynthesis`）與持久化（`localStorage`）皆為瀏覽器原生 API，非
npm package，不需 `npm install`。

## Privacy / Secrets

- 不新增 secret／API key。
- 不新增 microphone／camera／location／帳號蒐集面。
- Favorites 僅保存使用者主動標記的 phrase id 陣列於裝置本機 `localStorage`；不複製整份 phrase 內容、不
  上傳、不做 cloud sync。
- 搜尋關鍵字僅在 frontend runtime 記憶體中使用，不持久化、不上傳。
- 語音採瀏覽器原生合成，句子文字不需離開瀏覽器（優於既有 Cloud TTS 的既有既定行為）。

## PWA / Offline

- Dataset 放置於既有 `src/service-worker.ts` `APPROVED_STATIC_PREFIXES` 已涵蓋的 `/src/data/tokyo/`
  前綴下，**不需修改 `service-worker.ts`**；文字內容（分類／日文／繁中／搜尋／收藏）本質上為建置時
  bundle 進 JS 的靜態內容，不依賴 `/api/*`。
- 語音的離線可用性**取決於裝置／瀏覽器實際 Speech Synthesis 能力**，不預設保證可離線；不符合條件時
  文字與其餘功能仍可正常使用。

## Regression 保護

- 不修改 `AssistantScreen.tsx`／`AudioPlayer.tsx`／`api/speech.ts`／`NearbyScreen.tsx`／
  `PhotoTranslateScreen.tsx`／`KnowledgeBrowser.tsx`／既有 `/api/*` endpoint／既有 PWA
  `service-worker.ts`。
- `HomeScreen.tsx` 僅新增一個導覽按鈕與一個 boolean state，比照既有 5 個入口的擴充方式，既有 5 個入口
  行為與既有測試不受影響。
- 既有 001／002／003 自動化測試（Vitest + Playwright）預期於 implementation 階段全數維持通過。

### Regression Failure Handling（Verification 階段處理原則）

若 Feature 004 implementation 或 verification 造成 Feature 001–003 任一既有 automated test、PWA
behavior、Photo Translate、Nearby flow（manual area search／current location／Nearby cards／Leaflet
map／Geoapify tiles／Selected Place／Google Maps handoff）、既有 `/api/*` endpoint 或其他既有已驗證
核心行為失敗：

- **預設視為 regression blocker**，MUST 先處理，不得直接進入下一 implementation phase。

**MUST NOT**（為了讓 Feature 004 通過而）：

- 刪除既有測試。
- Skip 既有測試。
- 弱化既有 assertion。
- 靜默改變既有產品行為以配合 Feature 004。

**例外處理**：若確認某既有測試因正式批准的產品變更而需要調整，須先向作者說明理由並取得批准，方可調整該
測試；未取得批准前，該測試失敗仍視為 regression blocker。

## Testing Strategy

沿用既有 Vitest + React Testing Library + Playwright regression。

### A. Dataset validation（`src/services/travelJapanese.test.ts`）

- 7 個正式情境全部存在（`airport`/`hotel`/`restaurant`/`shopping`/`transportation`/`emergency`/`daily`）。
- unique phrase 總數 `>= 100`。
- category placements 總數 `>= 140`。
- 每個 category 的 placements `>= 20`。
- phrase `id` 全部唯一。
- 每個 phrase 的 `japanese` / `traditionalChinese` 皆非空字串。
- 每個 phrase 的 `categories` 僅能引用 7 個正式情境之一（無非法值）。
- 不得有兩個不同 `id` 但 `japanese` + `traditionalChinese` 完全相同的內容（duplicate content 防護，避免
  灌注 unique phrase 數）。
- multi-category phrase（`categories.length > 1`）之關聯需為 dataset 中明確列出的分類（不得推斷）。
- `emergency` 情境中，`safetyCritical: true` 的 phrase 需涵蓋 spec FR-025 所列六類（警察／救護車／要求
  對方停止／身體不舒服／遺失重要物品／醫院或警察或藥局）。

### B. Component / behavior tests

- 7 情境清單渲染（`CategoryList.test.tsx`）。
- Phrase Card 同時顯示日文（`lang="ja"`）與繁中（`PhraseCard.test.tsx`）。
- 繁中搜尋、日文搜尋、部分關鍵字搜尋皆能找到結果（`travelJapanese.test.ts` 或 `SearchBar.test.tsx`）。
- 搜尋無結果 → 空白狀態，不產生虛構句子。
- 搜尋輸入為空字串（尚未輸入）時呈現中性提示狀態，與「已輸入但無結果」的空白狀態文字不同（見 contracts
  §1 UI 呈現區分）。
- 收藏／取消收藏；收藏空狀態＋回到瀏覽或搜尋路徑。
- 同一 phrase 跨情境／搜尋結果收藏狀態一致（`TravelJapaneseScreen.test.tsx`，以共用 `Set<string>` 驗證）。
- Favorites 持久化：模擬重新掛載 screen，確認先前收藏仍存在。
- Favorites malformed persistence（例如 localStorage 內容非合法 JSON）→ 安全降級為空收藏，不 crash。
- `phraseAudio` 不可用（mock `speechSynthesis` 為 `undefined`）→ 播放按鈕停用但文字／搜尋／分類／收藏不受影響。
- 播放中（`playing`）／失敗（`failed`）狀態可理解呈現。
- 新播放請求取代前一個 active playback（mock `speechSynthesis.speak`/`cancel` 驗證呼叫順序）。
- Help & Emergency 情境：safety-critical 句子具較高呈現優先序（例如排序至清單前段）。
- Help & Emergency 情境：`SafetyReminder` 在進入該情境時即直接可見（非需額外點擊展開）。
- 播放失敗（`failed`）時，**該卡片自身**的日文文字、繁中文字與收藏按鈕仍可操作（不得整卡 `disabled`）；
  使用者仍可搜尋、切換情境、操作其他句子的播放與收藏，Search／情境瀏覽不因單一句子播放失敗而被阻斷
  （對應 FR-012、[contracts §4](./contracts/travel-japanese-contracts.md)）。

### F. Dataset runtime anomaly（Graceful Failure，對應「十三、Dataset Runtime Anomaly Handling」）

- 未來測試 MUST 驗證：當 dataset 存取層（例如 `getPhrasesByCategory`／`getAllPhrases`）回傳的資料存在
  必要欄位缺失或其他無法安全呈現之異常時，受影響 view 顯示可理解的 graceful-failure 狀態（而非顯示
  空白日文／繁中或半成品句子卡），並提供返回情境清單或首頁的方式。
- 此驗證為 UI 層最後一道防禦測試，**不取代**、也不降低 T004–T008 之 build-time dataset 驗證門檻
  （build/test 階段仍為攔截不合格正式資料的第一道且優先防線）。
- 未受影響的其他情境、搜尋、我的常用句 view 於此情境下仍須維持可正常操作。

### C. Accessibility checks

- 搜尋輸入具備 `<label>`。
- 情境按鈕鍵盤可操作（原生 `<button>`，沿用既有 tablist pattern）。
- 日文文字節點具 `lang="ja"`。
- 收藏按鈕具 `aria-pressed` 與可理解 accessible name。
- 播放狀態以文字＋`aria-live`（非純顏色）呈現。
- safety-critical 標示採圖示＋文字（非純顏色）。
- `SafetyReminder` 使用語義化標記（例如 `role="note"`），非僅圖形化裝饰。
- Focus visible：沿用既有全域樣式，不新增 CSS framework。

### D. Regression

- 執行既有全部 Vitest 測試套件，確認 001／002／003 既有可觀察行為與既有測試維持通過。
- 執行既有 Playwright regression（`npm run test:pwa-red-gate`），確認既有 PWA 行為不變。
- 執行 `npm run build` 確認型別檢查與打包無誤。

### E. Home Integration Regression Test（`/speckit-tasks` 必須包含之項目）

`/speckit-tasks` 未來 MUST 包含 Home integration regression test，作為 Feature 004 的驗收責任之一
（本 Plan 僅列為未來 implementation task／verification responsibility，本 Plan 不執行、不修改測試
程式碼）：

- 應檢查 repository 實際既有測試位置；目前對應測試為
  [src/screens/HomeScreen.test.tsx](../../../src/screens/HomeScreen.test.tsx)，須於 Tasks 階段更新
  該測試（而非另建平行測試檔）。
- 至少驗證：
  - 新增「旅遊日文」入口存在。
  - 原有 `nav[aria-label="東京功能入口"]` 下 5 個既有按鈕（即時翻譯、問東京、探索附近、東京百科、
    拍照翻譯，對應 4 個既有目的地畫面：即時翻譯與問東京共用 `AssistantScreen`、探索附近對應
    `NearbyScreen`、東京百科透過 `onOpenKnowledge` callback、拍照翻譯對應 `PhotoTranslateScreen`）
    仍存在。
  - 原有首頁行為未被 Feature 004 取代或改變。
  - 新入口可進入 Feature 004（`TravelJapaneseScreen`）。
  - 新增入口不破壞既有 Home layout／interaction contract（例如既有 `nav[aria-label="東京功能入口"]`
    結構與既有入口的互動方式）。

## Setup Requirements（implementation 階段參考，本 Plan 不執行）

- 無需 `npm install`（零新增 dependency）。
- 無需新增／修改任何環境變數（`.env` / `.env.example` 不變更）。
- 無需修改 `vercel.json`（不新增 `/api/*` route）。

## Repository Safety Confirmation

- 未修改、未移動 `specs/001-tokyo-travel-assistant/`、`specs/002-photo-translate/`、
  `specs/003-nearby-map-navigation/`。
- 未移動或重建 `mvp-safe-baseline`、`002-safe-baseline`、`003-safe-baseline` 任何 tag。
- 未執行任何 destructive scaffolding、reset、rebase、amend、force push 或 history rewrite。
- 本 Plan 僅新增／更新 `specs/004-travel-japanese-phrases/` 下的 `plan.md`、`research.md`、
  `data-model.md`、`quickstart.md`、`contracts/travel-japanese-contracts.md`、
  `ux-ui-design-handoff.md`；未修改任何既有 `.git/`、`.github/`、`.specify/`、`.vscode/`、`specs/` 下
  001–003 既有檔案。
- 本 Plan 不構成 implementation 授權；`src/`、`api/`、`package.json` 均未變更。

## 二十三、Plan Output Requirements（回報摘要）

- **是否仍為 A｜Frontend-first**：是。
- **是否新增 runtime dependency**：否（0 個）。
- **是否新增 Backend**：否。
- **是否新增 Cloud DB**：否。
- **是否新增 Authentication**：否。
- **是否新增 AI service**：否（語音改用瀏覽器原生 API，非新增 AI service；既有 Cloud TTS 不變更、不擴大
  使用範圍）。
- **是否新增 routing**：否。
- **是否新增 global state**：否（feature-local state，`localStorage` 僅供 favorites 持久化，非 state
  管理套件）。
- **是否新增 secret**：否。
- **是否存在 stack drift**：否。
- **是否存在需要作者批准的重大 deviation**：無 STOP 等級項目；唯一需 Conformance Check 明確確認的是
  「Audio 選擇瀏覽器原生 SpeechSynthesis、不重用既有 Cloud TTS」的決策（詳見第八節），性質為 Plan 決策
  說明，非 stack escalation 或新增 dependency/secret/backend。

## Remaining Approval Required Items

1. **Audio Technology Decision 確認**：請確認同意「瀏覽器原生 SpeechSynthesis」而非「重用既有 Cloud
   TTS」作為 Feature 004 語音方案（見第八節）。
2. **`/speckit.tasks` 與 `/speckit.implement` 批准**：本 Plan 完成後仍須經使用者明確批准才可進入
   `/speckit.implement`（Constitution XI. Authorization Boundary）。
