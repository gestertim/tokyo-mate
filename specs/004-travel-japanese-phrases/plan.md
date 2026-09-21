# Implementation Plan: Tokyo Mate 東京通｜旅遊日文 Travel Japanese

**Branch**: `004-travel-japanese`（實際 git 分支；spec 目錄為 `specs/004-travel-japanese-phrases/`，兩者
名稱些微差異僅為既存事實記錄，不影響本 Plan 內容） | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-travel-japanese-phrases/spec.md`（Clarify 後最新版，含
2026-09-21 Session 兩則 Clarification：unique phrase >= 100、Help & Emergency MUST 顯示明確可見安全提醒）

**Note**: 本文件僅為 Technical Plan。不構成 implementation 授權（Constitution XI. Authorization Boundary）。

## Maintenance Amendment（2026-09-21｜語音策略調整，Documentation-Only）

本次為 Feature 004 Maintenance 階段的 **Documentation-Only** 更新（`src/`／`public/`／既有
service-worker implementation／`package.json` 均未變更，未新增任何 dependency，未建立任何音檔）。
本次更新已由成人教育者批准以下 Technical Direction，取代原「八、Audio Technology Decision」單純
瀏覽器原生 `SpeechSynthesis` 之選擇：

- **Primary**：App-bundled 日文 MP3 音檔（`HTMLAudioElement` 播放）。
- **Fallback**：瀏覽器原生 `SpeechSynthesis`（Web Speech API）。
- **Final fallback**：日文文字維持可見、可直接展示，不強制要求任何一種語音方式必須成功。

**事實與推定原因之區分（重要）**：Maintenance Audit 曾針對 Android／PWA 環境提出可能的 root cause
分析，但尚未經實機 instrumentation 完整證實。本文件後續內容嚴格區分：

1. **Repository 已確認的 implementation facts**：例如目前程式碼中語音播放僅呼叫瀏覽器原生
   `SpeechSynthesis`、無任何 bundled audio 機制、`service-worker.ts` 目前未針對音檔設計 runtime
   cache 規則——這些是可直接從既有程式碼與既有測試中確認的事實。
2. **高可能性的 device/runtime explanation（非已證實事實）**：例如「部分 Android 瀏覽器的
   `SpeechSynthesis` 可能在特定情境下不觸發 `onend`／`onerror` 事件而導致狀態卡住」「部分裝置可能缺乏
   穩定的 `ja-JP` voice」等，均為**推定的合理解釋**，用以佐證本次改採 bundled audio 為 Primary、並新增
   timeout/terminal-state 防護的理由，但不得被引用為「已於本機或實機證實」的結論。

下方「八、Audio Technology Decision」「九、Audio Strategy Escalation Gate」「PWA / Offline」「PWA
Update Reliability」與「Testing Strategy」章節已依此 Maintenance Amendment 更新。

**Maintenance documentation 同步狀態（實際狀態，非固定數量）**：本次 Maintenance 已同步更新之
documentation 包含：

- [plan.md](./plan.md)（本文件）
- [ux-ui-design-handoff.md](./ux-ui-design-handoff.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/travel-japanese-contracts.md](./contracts/travel-japanese-contracts.md)
- [checklists/implementation-readiness.md](./checklists/implementation-readiness.md)
- [tasks.md](./tasks.md)

上述文件已同步反映三層語音策略（bundled MP3 Primary + `SpeechSynthesis` Fallback + 文字 Final
fallback）與 PWA foreground update 最小改善之 Maintenance Technical Direction，取代舊有「僅瀏覽器
原生 `SpeechSynthesis`」之描述。實際已同步文件清單請以本節列出之文件名稱為準，不以任何固定數量文字
描述為 Technical Truth（避免日後文件清單增減時產生數量文字與實際不符的失真）。`src/`／`public/`／
既有 service-worker implementation／`package.json`／phrase dataset／audio assets 均未變更。

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
   並說明為何 Feature 004 選擇「App-bundled MP3 為 Primary、瀏覽器原生 `SpeechSynthesis` 為 Fallback」，
   而非重用此既有 Cloud TTS 流程**，此為需要 Technical Plan Conformance Check 時明確確認的決策點，但不
   構成 STOP（未新增 dependency／secret／backend／AI service，且符合 Simplest Sufficient Technology）。
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
- **語音**：三層 fallback，非既有 Cloud TTS。Primary 為 App-bundled 日文 MP3（`HTMLAudioElement`），
  bundled 播放失敗時 fallback 至瀏覽器原生 `SpeechSynthesis`（Web Speech API），兩者皆失敗時 final
  fallback 為日文文字持續可見。單一 active playback 由 `TravelJapaneseScreen` 集中管理
  （`activePhraseId` + `playbackStatus`），並具備 timeout/terminal-state 防護避免永久卡在
  `requested`／`playing`。

## Technical Context

**Language/Version**: TypeScript 5.6（既有 `tsconfig.json`），React 18.3

**Primary Dependencies**: React、Vite（既有）；**不新增任何 npm dependency**。語音播放採三層既有瀏覽器
原生能力：Primary 為 `HTMLAudioElement` 播放 App-bundled MP3（`public/audio/travel-japanese/
{phraseId}.mp3`），Fallback 為 `window.speechSynthesis` / `SpeechSynthesisUtterance`（Web Speech
API），均非 npm package；收藏使用瀏覽器原生 `window.localStorage`。

**Storage**: 瀏覽器 `localStorage`（僅 favorite phrase id 陣列，無資料庫、無 Cloud）；日文 MP3 音檔作為
靜態 public asset 隨 App 發佈，並透過既有 Service Worker runtime cache-on-first-successful-fetch
机制在首次成功取得後可從 cache 播放（規格見下方 PWA / Offline 章節）。

**Testing**: Vitest + React Testing Library（沿用既有 `vitest.config.ts` / `src/test/setup.ts`），必要時
沿用既有 Playwright regression 套件

**Target Platform**: 既有 Vite + Vercel 部署行動優先 Web App（既有 PWA 能力不變）

**Project Type**: 既有 single-page web application（`src/` frontend + `api/` Vercel serverless
functions）；本 feature **不新增任何 `/api/*` endpoint**。

**Performance Goals**: 沿用既有畫面反應標準；情境瀏覽／搜尋為同步 in-memory array 運算（約
100–150 筆資料規模），無需 debounce 以外的效能優化；語音播放為瀏覽器原生能力，無網路等待（若 voice 可用）。

**Constraints**: 零新增 runtime dependency；零新增 `/api/*` endpoint；零新增 secret；localStorage 讀寫
MUST 容錯（malformed/unavailable 時安全降級，不得 crash）；同一時間最多一個 active playback；safety
reminder 不得只依賴顏色；語音播放 MUST 定義 timeout/terminal-state，避免裝置/瀏覽器 API 靜默無
事件時永久卡在 `requested`／`playing`；不得宣稱音檔於首次完全離線時一定可播放全部 108 句。

**Scale/Scope**: 1 個新 screen、約 4–6 個新 feature-local module、1 份新 dataset（unique phrase >= 100，
category placements >= 140，每類 >= 20）、不新增 backend、不新增資料庫。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 檢查結果 | 說明 |
|------|---------|------|
| I. Specification Before Implementation | 通過 | 本 Plan 完全依 Clarify 後 spec.md（FR-001–FR-035）展開，未新增或縮減產品行為；使用 Clarify 後 unique phrase >= 100、safety reminder MUST 顯示等最新條款。 |
| II. Simplest Sufficient Technology | 通過 | 搜尋採 array filter；語音採瀏覽器原生 API；收藏採 `localStorage`；皆為零新增 dependency 的最簡方案。 |
| III. A/B/C Complexity Discipline | 通過 | 未新增 Cloud 基礎設施、multi-user、Authentication、Backend 權限架構；亦未新增 Generative AI 核心能力（見下方 Audio Decision，明確選擇非 AI 生成語音）。維持 A｜Frontend-first。 |
| IV. Incremental Enhancement | **有條件通過（需 Conformance Check 確認）** | 畫面導覽、feature 資料夾、dataset+service 層 pattern 完全延伸既有慣例。**唯一例外**：語音播放**不**重用既有 `AudioPlayer`/`generateSpeech` Cloud TTS 流程，改用 App-bundled MP3（`HTMLAudioElement`）為 Primary、瀏覽器原生 `SpeechSynthesis` 為 Fallback，理由詳見下方「八、Audio Technology Decision」。此為 repository inspection 後發現的既有可重用能力，故明確記錄於此供作者確認，而非默默略過。 |
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
│   └── travelJapanese.ts                  # 新增；TravelJapaneseCategory / TravelJapanesePhrase 型別（不新增 audioFile 欄位）
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
│       └── phraseAudio.ts                 # 新增；bundled MP3 Primary + SpeechSynthesis Fallback + timeout/
│                                          #        terminal-state 管理（單一 active playback）
├── screens/
│   └── TravelJapaneseScreen.tsx           # 新增；state owner（view／selectedCategory／searchQuery／
│                                          # favoriteIds／activePhraseId／playbackStatus），onBack 返回首頁
└── App.tsx / screens/HomeScreen.tsx        # 擴充；HomeScreen 新增一個導覽入口按鈕開啟 TravelJapaneseScreen
                                            # （沿用既有 nearbyOpen/photoTranslateOpen 相同 boolean state pattern）

public/
└── audio/
    └── travel-japanese/
        └── {phraseId}.mp3                  # 新增（未來 implementation task）；phraseId 沿用既有穩定 ID
                                            # （tj-001…tj-108），單一正式格式 MP3；本 Plan 不產生音檔內容

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

## 八、Audio Technology Decision（Maintenance Amendment：三層 fallback，2026-09-21 更新）

> 本節已依成人教育者批准之 Maintenance Technical Direction 更新。原始 Plan（Clarify 後首版）僅選用
> 「B｜瀏覽器原生 `SpeechSynthesis`」單一方案；本次 Maintenance **不推翻**該原始比較（見下方「A.
> 既有比較（保留）」），而是在其基礎上新增「App-bundled MP3」作為更高優先序的 Primary 層，
> `SpeechSynthesis` 改列為 Fallback，日文文字始終為 Final fallback。此為 Documentation-Only 的
> architecture 決策更新，**不構成 implementation 授權**。

### A. Audio Technology Decision

**既有可重用能力（inspection 發現，維持不變）**：`AudioPlayer.tsx` + `generateSpeech()` +
`api/speech.ts` 已提供日文語音（OpenAI `gpt-4o-mini-tts`，server-side secret）。技術上可直接重用於
Feature 004，但本 Plan 仍不選用此路徑（理由同下）。

**三層策略（本次 Maintenance 批准）**：

1. **Primary｜App-bundled 日文音檔**：`HTMLAudioElement` / 瀏覽器原生 audio playback，播放 App
   bundled MP3 asset。路徑 convention：`/audio/travel-japanese/{phraseId}.mp3`；`phraseId` 使用既有
   穩定 ID `tj-001`…`tj-108`（**不**為此新增 dataset `audioFile` 欄位，路徑由 `phraseId` 直接推導）。
2. **Fallback｜`SpeechSynthesis`**：僅當 bundled asset 載入或播放**失敗**時才觸發（並非 bundled 尚未
   `cache` 時就預設略過 bundled，見下方 B. Playback lifecycle）。
3. **Final fallback｜既有日文文字 UI**：Primary 與 Fallback 皆失敗時，日文文字（`lang="ja"`）與繁中翻譯
   仍維持可讀、可展示給對方看；不因語音失敗阻塞搜尋、分類、收藏或整體 App（FR-012 沿用不變）。

**A. 既有比較（保留，Cloud TTS vs. 瀏覽器原生能力）**：

| 項目 | 重用既有 Cloud TTS（`generateSpeech`） | 本 Plan 三層策略（bundled MP3 + `SpeechSynthesis` + 文字） |
|------|------------------------------------------|------------------------------------------------------|
| Support | 依賴 server 可用性＋網路 | Primary 為靜態 asset（build-time 已知內容），Fallback 依裝置／瀏覽器內建 TTS engine |
| Japanese voice reliability | 一致（同一 OpenAI voice） | Primary 內容一致（同一組正式錄音／合成音檔）；Fallback 才有裝置差異，且僅在 Primary 失敗時才會使用 |
| Offline behavior | 不可離線（需呼叫 `/api/speech`） | Primary 於**已成功快取過一次**後可離線播放；未快取且離線時降級至 Fallback／文字，不宣稱一定可離線（見下方 D） |
| Bundle size | 無新增（沿用既有元件） | 音檔為 public static asset（不進 JS bundle），不新增 npm 套件 |
| Licensing | 既有 OpenAI 條款 | 音檔內容製作需獨立品質審查（見 C），非本 Plan 產生 |
| Privacy | 句子文字會傳送至 server／OpenAI（既有事實，非新增風險） | Primary／Fallback 播放皆不需將句子文字傳送至外部服務 |
| Failure behavior | 既有 `error` 狀態＋文字仍可讀 | 三層 fallback 自身即為 failure handling 設計，見下方 B |
| API key / Cost | 沿用既有 `OPENAI_API_KEY`；重複播放持續累積既有服務用量與延遲 | 無 API key、無邊際成本；音檔為一次性 build/發布內容 |
| A/B/C complexity impact | 不變（沿用既有 C 前既有能力） | 不變，仍為 A｜Frontend-first、Simplest Sufficient Technology |

**決策**：維持**不**重用既有 Cloud TTS，改採「bundled MP3 Primary + `SpeechSynthesis` Fallback + 文字
Final fallback」三層策略，理由：

1. Feature 004 dataset 為固定、不變的正式句子（非即時 AI 生成內容），不需要每次播放都呼叫 Cloud AI
   服務，持續依賴既有 Cloud TTS 不符合 II. Simplest Sufficient Technology（與原始決策理由一致）。
2. 純 `SpeechSynthesis` 方案在部分裝置／瀏覽器（尤其 Android）上，日文 voice 覆蓋率與事件觸發可靠度
   可能不一致；新增固定內容的 bundled 音檔作為 Primary，可讓「同一句子在不同裝置上聽到的內容一致」，
   並降低對裝置端 TTS engine 可用性的依賴。**此為高可能性的裝置/執行環境解釋，尚未經實機
   instrumentation 完整證實，不視為已證實 root cause**；`SpeechSynthesis` 作為 Fallback 保留，確保即
   使 bundled asset 因故無法取得時仍有次要語音路徑。
3. 不新增 dependency／secret／backend／API key／外部 TTS 服務，維持 A｜Frontend-first、Simplest
   Sufficient Technology；bundled 音檔為靜態 public asset，非 Generative AI 或 Cloud service。
4. 「旅行前收藏、途中使用」（FR-023 assumption）情境下，一旦 Primary 音檔於任一次連線時成功快取過，
   之後可離線播放；此為漸進式離線可用性改善，而非「保證第一次離線一定可播放全部 108 句」（見 D）。

**此為 Plan 決策，非 STOP 案例**（未違反任何 Approval Gate 條件：無新增 dependency、無新增 secret、無
Backend 升級、無 Authentication、無 privacy 惡化、無 Generative AI 升級）。既有 `AudioPlayer.tsx` /
`api/speech.ts` **完全不變更**，繼續服務 Feature 001。

### B. Playback Lifecycle（含 timeout / terminal-state 策略）

狀態維持 spec 既有四態，語意重新定義以涵蓋三層策略：

- **idle**：尚未觸發播放。
- **requested**：使用者已觸發播放，**包含 bundled asset 載入中**（`HTMLAudioElement` 載入／
  buffering，尚未進入實際播放）。
- **playing**：以**實際 audio playback 事件**為準（bundled 的 `playing`/`timeupdate` 事件，或
  `SpeechSynthesisUtterance` 的 `onstart`），而非以「已呼叫播放 API」為準。
- **failed**：Primary（bundled）與 Fallback（`SpeechSynthesis`）**皆**失敗，或皆逾時無終止事件時進入；
  日文文字與繁中翻譯仍維持可讀。

**轉換規則**：

1. 觸發播放 → `requested`，先嘗試 bundled asset（`new Audio(src)` 載入＋播放）。
2. Bundled 播放成功開始（`playing`/`canplay`＋實際播放事件）→ `playing`。
3. Bundled 發生錯誤（`error` 事件、載入失敗、逾時無事件）→ **才**嘗試 `SpeechSynthesis` fallback，
   狀態暫留 `requested`（對使用者而言仍是「已要求播放」，不需呈現為單獨的中間狀態）。
4. `SpeechSynthesis` 播放成功開始（`onstart`）→ `playing`。
5. `SpeechSynthesis` 亦失敗或不可用（`onerror`／`typeof window.speechSynthesis === 'undefined'`）→
   `failed`。
6. **Timeout / terminal-state 防護（新增，對應 Android/瀏覽器 API 可能靜默無事件之風險）**：bundled 與
   `SpeechSynthesis` 各自進入 `requested` 後，MUST 設定合理逾時（例如以句子預期音檔長度為基準的上限
   秒數）；逾時仍未收到任何終止事件（`playing`／`ended`／`error`／`onstart`／`onend`／`onerror`）時，
   視同該層失敗並依序 fallback 至下一層，最終仍無法終止時進入 `failed`，**不得**無限期停留於
   `requested`／`playing`。
7. 同一時間僅允許一個 active playback：新播放請求觸發時，一律先終止（bundled `pause()`+重置 /
   `speechSynthesis.cancel()`）任何進行中的播放與 pending timeout，再開始新的三層流程（FR-010/011）。
8. 播放中 component unmount 或使用者離開 Feature：`TravelJapaneseScreen` 於 `useEffect` cleanup 終止
   bundled audio 與呼叫 `window.speechSynthesis.cancel()`，並清除 pending timeout，避免殘留播放。

### C. Asset Strategy

- 建議路徑：`public/audio/travel-japanese/{phraseId}.mp3`。
- MP3 為**單一正式格式**，不同時支援多格式（例如不額外提供 OGG/WAV），降低維運複雜度。
- `phraseId` 沿用既有穩定 ID（`tj-001`…`tj-108`），**不**為此在 dataset 型別新增 `audioFile` 欄位；
  播放邏輯以 `` `/audio/travel-japanese/${phraseId}.mp3` `` 直接推導路徑。
- **本 Plan 不負責產生 108 個音檔**；音檔內容製作與品質審查（例如錄音／TTS 產出品質、發音自然度、
  音量一致性）MUST 為獨立於本 Plan 的 implementation task，待後續正式 Tasks 階段規劃。
- 音檔內容 MUST 與正式 phrase 日文文字（`japanese` 欄位）一致；任何 phrase 文字修改，MUST 觸發對應
  音檔的 consistency review（避免文字與音檔不同步）。

## 九、Audio Strategy Escalation Gate（Approval Gate，非新 Product Requirement，Maintenance 更新）

Feature 004 已批准「App-bundled MP3 為 Primary、瀏覽器原生 `SpeechSynthesis` 為 Fallback、日文文字為
Final fallback」之三層語音策略（見上方第八節決策）。此為 architecture / implementation authorization
gate，**不是新的 Product Requirement**，spec.md 對語音技術方案本身維持中立（Assumptions 章節）。

**觸發 STOP 的條件**（於 implementation 或 verification 階段發現任一項）：

- Bundled MP3 asset 與 `SpeechSynthesis` fallback **兩者**皆無法合理支援目標使用情境（例如絕大多數
  目標裝置對兩者皆持續失敗）。
- 實際行為無法滿足已批准的 audio acceptance criteria（spec FR-008~FR-012、SC-002/SC-005）。
- Timeout / terminal-state 防護無法在合理時間內讓卡住的 `requested`／`playing` 狀態收斂至
  `playing` 或 `failed`。
- 音檔內容與正式 phrase 日文文字（`japanese` 欄位）不一致，且無法透過既有 consistency review 流程
  即時修正。

**發現上述任一條件時，MUST**：

1. STOP，不得自行切換或簡化已批准的三層策略。
2. 記錄實際證據（例如測試裝置／瀏覽器清單、逾時發生率、失敗率）。
3. 報告對 spec.md／plan.md 已批准 acceptance criteria 的 impact。
4. 比較 alternatives（例如重用既有 Cloud TTS、調整 asset 格式或 timeout 數值）之技術與治理影響。
5. 等待作者對新方案的明確重新 approval，方可變更。

**MUST NOT**（未取得新的明確批准前）：

- 自行改為 OpenAI TTS 或重用既有 `generateSpeech()` Cloud TTS 流程。
- 自行改為其他 Cloud TTS 服務或第三方 audio hosting/CDN。
- 自行移除 Primary（bundled MP3）或 Fallback（`SpeechSynthesis`）任一層，或改變其優先順序。
- 自行將 MP3 改為其他音檔格式，或同時新增多重格式。
- 自行新增任何 external service 或 npm dependency 以替代語音方案。
- 自行宣稱「第一次完全離線時一定可播放全部 108 句」（見下方 PWA / Offline 章節）。

此 Escalation Gate 為第八節 Audio Technology Decision 的必要配套，確保三層策略不會在 implementation
階段被默默變更為未經批准的技術升級或簡化（對應 Constitution V. Technology Stack Stability、
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

## 十四、PWA Update Reliability（Maintenance Amendment 新增，2026-09-21）

**現況（repository 已確認事實）**：`src/service-worker-registration.ts` 與 `src/components/
UpdatePrompt.tsx` 已實作 waiting worker 偵測、使用者主動觸發 `SKIP_WAITING`、`controllerchange` 後
reload、`clients.claim()` 既有 lifecycle；本次 Maintenance **保留**此既有機制，不變更其核心行為。

**最小改善（本次批准，屬未來 implementation 範圍，本 Plan 僅記錄技術方向）**：App 從 background 回到
foreground 時（`document.visibilitychange` 且 `document.visibilityState === 'visible'`），在合理節流
條件下呼叫既有 Service Worker registration 的 `registration.update()`，讓 App 更即時發現新版本，而非
僅依賴既有的頁面載入時機。

**MUST**：

- 以 `visibilitychange` 事件偵測「回到前景」，而非新增輪詢（polling）計時器。
- Throttling：同一次 App session 內，`registration.update()` 呼叫需有基本節流（例如與上次呼叫間隔
  低於門檻時間則略過），避免使用者頻繁切換前景/背景時重複呼叫。
- `registration.update()` 失敗（例如離線、network error）MUST 被容錯處理，不得拋出未捕捉例外、不得
  影響 App 其餘功能可用性。

**MUST NOT**：

- 新增無節流限制的 polling（例如固定 interval 持續呼叫 `update()`）。
- 自動呼叫 `SKIP_WAITING`（仍 MUST 由使用者於 `UpdatePrompt` 主動按下「立即更新」後才觸發）。
- 自動強制 reload（`controllerchange` 後 reload 仍僅在使用者觸發更新流程後才發生一次）。

此為既有 PWA update 機制之最小、範圍受限的補強，**不新增**新的 Service Worker 生命週期概念，亦不修改
既有 `waiting worker` / `UpdatePrompt` / 使用者主動觸發 / `controllerchange` reload 既有流程本身。

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
| `src/features/travel-japanese/phraseAudio.ts` | `playBundledAudio` / `isSpeechSynthesisAvailable` / `speakJapanese` / `cancelPlayback`（bundled MP3 Primary → SpeechSynthesis Fallback，含 timeout/terminal-state 管理） | 新增 |
| `public/audio/travel-japanese/{phraseId}.mp3` | 正式音檔資產（`tj-001`…`tj-108`）；本 Plan 不產生內容，見第八節 C. Asset Strategy | 未來新增（獨立 implementation task） |
| `src/features/travel-japanese/CategoryList.tsx` | 7 情境清單呈現（tablist pattern） | 新增 |
| `src/features/travel-japanese/PhraseCard.tsx` | 日文／繁中／播放／收藏 UI 與狀態呈現 | 新增 |
| `src/features/travel-japanese/SearchBar.tsx` | 搜尋輸入（label、accessible） | 新增 |
| `src/features/travel-japanese/FavoritesList.tsx` | 我的常用句清單＋空狀態 | 新增 |
| `src/features/travel-japanese/SafetyReminder.tsx` | Help & Emergency 安全提醒（明確可見） | 新增 |
| `src/screens/TravelJapaneseScreen.tsx` | View／收藏／播放狀態 owner，串接以上 module | 新增 |
| `src/screens/HomeScreen.tsx` | 新增一個導覽入口按鈕與 boolean state | 擴充 |

## Dependencies

**新 runtime dependency：0**。語音 Primary（`HTMLAudioElement`）與 Fallback
（`SpeechSynthesis`）、持久化（`localStorage`）均為瀏覽器原生 API，非 npm package，不需
`npm install`。音檔本身為 static public asset（MP3），也非 npm dependency。

**F. Dependency Review（Maintenance Amendment 確認，2026-09-21）**：本次 Maintenance 確認仍可
以 **0 新 runtime dependency** 完成所有變更（bundled audio 播放、SpeechSynthesis fallback、
音檔 runtime cache、PWA foreground update 均仅使用瀏覽器原生 API 與既有 Service Worker
基礎設施），正式記錄于此。本次 Maintenance **不**新增 router、global state 套件、backend、
API、cloud service 或任何其他 architecture layer。

## Privacy / Secrets

- 不新增 secret／API key。
- 不新增 microphone／camera／location／帳號薒集面。
- Favorites 僅保存使用者主動標記的 phrase id 陣列於裝置本機 `localStorage`；不複製整份 phrase 內容、不
  上傳、不做 cloud sync。
- 搜尋關鍵字僅在 frontend runtime 記憶體中使用，不持久化、不上傳。
- 語音 Primary（bundled MP3）與 Fallback（`SpeechSynthesis`）播放均不需將句子文字傳送至任何外部
  服務（優於既有 Cloud TTS 的既有既定行為）。

## PWA / Offline Strategy（Maintenance Amendment 更新，2026-09-21）

### D. App Shell / Dataset（既有，不變）

- Dataset 放置於既有 `src/service-worker.ts` `APPROVED_STATIC_PREFIXES` 已涵蓋的 `/src/data/tokyo/`
  前綴下，文字內容（分類／日文／繁中／搜尋／收藏）本質上為建置時 bundle 進 JS 的靜態內容，不依賴
  `/api/*`；App shell precache 機制維持不變。

### D. Phrase Audio Runtime Cache（新增，Documentation-Only；實際 Service Worker 程式碼變更屬未來
implementation 範圍，本次 Maintenance 不修改 `service-worker.ts`）

**MUST NOT**：

- **不 precache 全部 108 個音檔**；不得在 App 安裝／首次載入時強制下載所有音檔。
- **不宣稱**「第一次完全離線時一定可播放全部 108 句」；此為本次 Maintenance 明確澄清事項（回應
  Maintenance Audit 對過往措辭的疑慮）。

**MUST（未來 implementation 需落實的技術方向）**：

- **Runtime cache-on-first-successful-fetch**：當某 `phraseId` 的音檔於任一次連線時被成功取得
  （HTTP 200 且可播放），MUST 寫入專屬 audio cache，供後續（含離線時）直接從 cache 讀取播放。
- **Cache namespace/version**：音檔快取 MUST 使用與既有 app-shell cache 不同的獨立 cache
  namespace（例如 `travel-japanese-audio-v1`），版本號隨格式或路徑慣例變更而遞增。
- **Cache invalidation strategy**：Service Worker `activate` 階段 MUST 清除不屬於目前版本
  namespace 的舊 audio cache（例如比對 cache name 前綴與目前版本號，刪除不符者），避免累積過期
  音檔佔用裝置儲存空間。
- **失敗／404 不快取**：若音檔請求回傳非 2xx（例如 404、5xx）或 fetch 拋出例外，MUST NOT 將該回應
  寫入 cache，避免將失敗結果誤植為「已快取成功」。
- **不得破壞 app shell**：音檔 cache 邏輯 MUST 為既有 `service-worker.ts` 的**最小範圍**新增（例如
  新增一個獨立 fetch handler 分支，僅比對 `/audio/travel-japanese/` 路徑前綴），不得變更既有
  app-shell fetch／cache 邏輯的既有行為；此為未來 implementation 階段對 `service-worker.ts` 的
  **唯一**預期擴充點，其餘既有 Service Worker 行為（`waiting worker`、`clients.claim()`、既有
  `APPROVED_STATIC_PREFIXES`）不受影響。

### 語音離線可用性敘述（澄清）

- Primary（bundled MP3）：**首次連線且成功快取後**，該句子後續可離線播放；**首次即離線**且尚未快取
  過的句子，MUST NOT 承諾可播放。
- Fallback（`SpeechSynthesis`）：離線時仍可嘗試，其可用性**取決於裝置／瀏覽器實際 Speech Synthesis
  能力**，不預設保證可離線。
- Final fallback（文字）：不論是否離線、是否已快取，日文文字與繁中翻譯恆可讀。

## Regression 保護

- 不修改 `AssistantScreen.tsx`／`AudioPlayer.tsx`／`api/speech.ts`／`NearbyScreen.tsx`／
  `PhotoTranslateScreen.tsx`／`KnowledgeBrowser.tsx`／既有 `/api/*` endpoint。
- **`service-worker.ts`（更新說明）**：本次 Maintenance **不修改** `service-worker.ts`（Documentation-
  Only）。原始 Plan 曾記錄「不需修改 `service-worker.ts`」，該敘述於**文字／dataset 部分**仍然成立
  （沿用既有 `APPROVED_STATIC_PREFIXES`）；但新增的 phrase audio runtime cache（見上方「PWA / Offline
  Strategy」）在**未來 implementation 階段**將需要對 `service-worker.ts` 新增一個範圍受限的 fetch
  handler 分支，此為經本次 Maintenance 明確記錄、待正式 Tasks／Implementation 批准後才執行的變更，
  **非本次 Maintenance 執行內容**。
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
- `phraseAudio` bundled asset 載入失敗（mock `HTMLMediaElement` 觸發 `error`）→ 自動 fallback 至
  `SpeechSynthesis`；若 `SpeechSynthesis` 也不可用（mock 為 `undefined`）→ 進入 `failed`，但文字／
  搜尋／分類／收藏不受影響。
- 播放中（`playing`）／失敗（`failed`）狀態可理解呈現。
- 新播放請求取代前一個 active playback（mock bundled audio `pause`/`reset` 與
  `speechSynthesis.speak`/`cancel` 驗證呼叫順序）。
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

### G. Audio 三層策略 與 PWA Update Reliability 測試（Maintenance Amendment 新增，2026-09-21）

**Audio（對應第八節三層策略與 timeout 防護）**：

- Bundled audio 成功播放（Primary 正常路徑）。
- Bundled 失敗 → `SpeechSynthesis` 成功（Fallback 生效）。
- Bundled 失敗 → `SpeechSynthesis` 亦失敗（進入 `failed`，文字仍可讀）。
- Silent/no-event timeout 恢復：bundled 或 `SpeechSynthesis` 皆未觸發任何終止事件時，逾時後正確 fallback
  或進入 `failed`，不永久卡在 `requested`／`playing`。
- 第二句播放停止第一句（同一時間僅一個 active playback）。
- 語音（任一層）失敗不影響收藏／搜尋／分類瀏覽。
- 缺少對應 phrase 音檔（asset 404／不存在）→ 正確 fallback 至 `SpeechSynthesis`，不視為未預期例外。
- 重複播放同一句（多次觸發）行為一致，不殘留前次播放或 timeout。

**PWA（對應第十四節 PWA Update Reliability 與音檔 runtime cache）**：

- 偵測到新版本（update found）。
- 顯示 waiting prompt（`UpdatePrompt`）。
- 使用者選擇更新（按下「立即更新」）。
- `controllerchange` reload 僅發生一次。
- App 回到前景（`visibilitychange`）觸發 `registration.update()`。
- `registration.update()` 失敗時 App 其餘功能不受影響（graceful）。
- 音檔 runtime cache 首次成功 fetch 後寫入 cache。
- 音檔 cache hit（第二次播放同一句直接從 cache 讀取，不再發出 network request）。
- 離線時已快取音檔可正常播放。
- 離線時未快取音檔優雅失敗（fallback 至 `SpeechSynthesis` 或 `failed`，不拋出未捕捉例外）。
- 舊版本 audio cache 於新版本 `activate` 後正確清除（cache invalidation）。

**Regression（沿用既有規模，重申涵蓋範圍）**：

- Feature 001–004 既有自動化測試（Vitest）維持通過。
- 既有 PWA red-gate 測試（`npm run test:pwa-red-gate`）維持通過。
- `npm run build` 型別檢查與打包無誤。

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
- **是否新增 AI service**：否（語音 Primary 為 bundled MP3 static asset、Fallback 為瀏覽器原生 API，
  均非新增 AI service；既有 Cloud TTS 不變更、不擴大使用範圍）。
- **是否新增 routing**：否。
- **是否新增 global state**：否（feature-local state，`localStorage` 僅供 favorites 持久化，非 state
  管理套件）。
- **是否新增 secret**：否。
- **是否存在 stack drift**：否。
- **是否存在需要作者批准的重大 deviation**：無 STOP 等級項目；唯一需 Conformance Check 明確確認的是
  「Audio 採 bundled MP3 Primary + SpeechSynthesis Fallback、不重用既有 Cloud TTS」的三層策略決策
  （Maintenance Amendment，詳見第八、九節），性質為 Plan 決策說明，非 stack escalation 或新增
  dependency/secret/backend。

## Remaining Approval Required Items

本節依批准狀態明確分為三類，避免將「已批准」事項誤讀為仍待重新批准，或將兩項不同的「尚未批准」事項
混為一談。

### A. 已批准（不需再次批准）：Audio Technical Direction

成人教育者已批准「App-bundled MP3 為 Primary、瀏覽器原生 `SpeechSynthesis` 為 Fallback、日文文字為
Final fallback」之三層 Technical Direction（見第八、九節），取代原「重用既有 Cloud TTS」方案。此
Technical Direction 本身**不需再次批准**；本文件與 tasks.md 之後續內容一律以此為現行 Audio Technical
Truth。

### B. 尚未批准：T055 Audio Production Method（tasks.md Phase 11 STOP Gate）

在建立任何一個實際 MP3 音檔內容前，仍須由成人教育者另行明確批准：

- production method（例如人工錄音 vs. 自動化語音合成）
- voice source（人聲來源或合成 voice 選擇）
- licensing／reuse rights（產出內容是否可合法打包為 App static asset 並公開發佈）
- 是否使用第三方 TTS／工具及其服務條款

coding agent 不得自行選擇任何 cloud TTS、AI voice service、API、付費服務、API key 或 vendor。此項
批准前，**不得**建立、下載或串接正式 108 個 MP3（詳見 tasks.md T055、contracts §7.4）。此為**與 A
獨立**的批准事項，並非 Audio Technical Direction 本身尚待重新確認。

### C. 尚未批准：`/speckit.implement`

即使本 Plan 與 tasks.md 已準備就緒，仍須經使用者明確批准進入 `/speckit.implement`
（Constitution XI. Authorization Boundary）後，方可開始修改 application code；音檔內容製作（108 個
MP3，另受 B 項 T055 約束）與 `service-worker.ts` 音檔 runtime cache 擴充均待此批准後方可執行。
