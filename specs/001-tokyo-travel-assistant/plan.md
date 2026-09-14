# Technical Implementation Plan: Tokyo Mate 東京通

**Feature Branch**: `001-tokyo-travel-assistant` | **Date**: 2026-09-12 | **Spec**: [spec.md](spec.md)

---

## Technical Truth & Plan 邊界說明

> **重要架構原則**：
> 1. **Specification 是 Product Truth**：定義產品的核心承諾、需求範圍（FR）、驗收標準（SC）與隱私邊界。
> 2. **Plan 是 Technical Truth**：Plan 內之 React、Vite、OpenAI、Google Places、Vercel、PWA 等技術選型，是用來實現 Specification 的實作機制，不是產品契約本身。
> 3. **變更邊界**：
>    - 若技術實作改變但產品行為不變，僅需更新 Technical Plan。
>    - 若產品行為、功能範圍（Scope）、隱私邊界（Privacy）或核心 AI 體驗改變，**必須先更新 Specification 並重新批准**，嚴禁技術端逕行推導擴展。

---

## Executive Summary (執行摘要)

Tokyo Mate 東京通是專門服務台灣自由行旅客的東京 AI 旅遊助手。核心定位為「東京在地私人導遊 × 台日雙語口譯員 × 東京旅遊知識顧問」。
本計畫依據已批准的 Product Specification (`spec.md`)、UX/UI Design Handoff (`ux-ui-design-handoff.md`) 與 Engineering Constitution (`.specify/memory/constitution.md`) 制定。
架構遵循 **Simplest Sufficient Technology** 原則，前端採用 React + TypeScript + Vite，後端採 Vercel Serverless Functions 做為保護 API Key 的最小必要 Server Boundary。AI 核心採用 OpenAI Responses API (GPT-4o/mini) 搭配 Whisper API (Speech-to-Text) 與 Speech API (Text-to-Speech)；地點服務採用 Google Places API (New) REST endpoint；東京知識庫採用 Repository 內結構化 JSON (`src/data/tokyo/*.json`) 搭配最簡詮釋資料過濾與 Context Injection。第一版不採用資料庫、向量庫或帳號系統，僅維護當次使用之記憶體/UI 狀態。

---

## Technical Context (技術上下文)

| 項目 | 決策 / 技術選型 | 備註 / 驗證依據 |
|---|---|---|
| **Language/Version** | TypeScript 5.x + Node.js 18+ | 型別安全與現代 ES 語法 |
| **Frontend Framework** | React 18 + Vite | 單頁應用 (SPA)，單一 App Shell，第一版不加入 React Router |
| **State Management** | React local state / Context | 僅真正跨區域共享狀態使用 Context，無 Redux/Zustand；所有 session-only interaction 僅存在 runtime memory，不寫入 LocalStorage/IndexedDB；Interaction／Permission／Network 狀態機與 Temporary Session Data 範圍以 spec.md「Session UI State Contract」為單一事實來源，Plan 不重複定義 |
| **Server Boundary** | Vercel Serverless Functions | `/api/assistant.ts`, `/api/transcribe.ts`, `/api/speech.ts`, `/api/places.ts` |
| **AI Provider** | OpenAI Responses API | `OPENAI_MODEL` 環境變數控制，處理意圖判斷、雙語翻譯、旅遊問答 |
| **Speech-to-Text** | MediaRecorder + OpenAI Whisper API | `/api/transcribe` 接收錄音 Blob 轉文字，提供前端修正 |
| **Text-to-Speech** | OpenAI Speech API | `/api/speech` 合成正常與慢速 (0.75x) 語音檔供前端播放 |
| **Places Service** | Google Places API (New) REST | `/api/places` 支援經緯度 Nearby Search 與文字地區 Text Search |
| **Knowledge Base** | Repo 內結構化 JSON 靜態庫 | `src/data/tokyo/*.json` (areas, transport, food, shopping, culture, emergency)，為「Tokyo Knowledge Base / 東京知識庫」底層資料 |
| **Retrieval Strategy** | Simplest Metadata Filtering | Step 1 Tag/Category 詮釋資料過濾 + Step 2 Top-3~5 Entry Context Injection |
| **Decision Contract** | AI request router 內部技術狀態 | Safety/Freshness 判斷規則、狀態值域與 emergency+live_required 呈現順序依 Specification FR-015 / FR-016 為唯一來源；Plan 僅定義 `/api/assistant.ts` 如何以 discriminated union 內部表達此決策並驅動前端 progressive render |
| **Assistant Result Contract** | 強型別回應介面 | 回應欄位語意與適用情境依 Specification FR-009 / FR-015 / FR-016 為唯一來源；Plan 僅定義 `src/types/assistant.ts` 之 TypeScript discriminated union 型別與 Serverless Function 產生方式 |
| **Latency Contract** | Benchmark harness 實作 | 產品層 latency acceptance criteria（p95 門檻、樣本數、dataset 欄位、排除基準）以 Specification SC-002 為唯一來源；Plan 僅定義 harness 讀取 `tests/fixtures/latency-cases.json` 執行、於 client-to-render 邊界量測、輸出報告至 `docs/verification/latency-report.md`，並將 web search/Places/STT/TTS 另行獨立量測 |
| **Styling** | Vanilla CSS / CSS Variables | 輕量化響應式 mobile-first 樣式，無 Tailwind / Heavy UI library |
| **Testing Stack** | Vitest + React Testing Library + jsdom | 單元測試與 Component 互動測試 |
| **Target Platform** | Vercel (Web / Mobile-first installable PWA) | 單一 Repository 部署 Vite 前端與 Serverless API；PWA 提供可安裝 App Shell、受控靜態快取與離線 fallback |
| **PWA Architecture** | Web App Manifest + versioned icons + Service Worker + Cache Storage | 只 precache/cache-first App Shell、版本化 frontend assets、icons 與批准的靜態 Tokyo Knowledge Base；不加入 IndexedDB、background sync、push notifications 或離線模型 |
| **Cache Boundary** | Cache allowlist + network-only API exclusion | `/api/assistant`、`/api/transcribe`、`/api/speech`、`/api/places` 與其他 user-specific、AI、位置、即時資訊 requests 必須 network-only 或排除 cache |

---

## Assistant Orchestration：Emergency + Live-Required 兩階段技術機制

> 產品行為（何時判定為 `emergency`、必須先呈現哪些欄位）以 Specification FR-016 為唯一來源；本節僅定義 Plan 層級「不得等待 live lookup 完成才顯示安全行動」之技術實作機制，不重複或改寫 FR-016 原文。

- **Stage 1（Emergency-first response）**：當 Safety = `emergency` 時，`/api/assistant.ts` 必須在不依賴 live search 呼叫結果的前提下，同步組出 `emergencyGuide`（`immediateAction`／`nextAction`／可選 `phrase`／`importantNotice`）並回傳。若同時 Freshness = `live_required`，此次 live search 呼叫須設定短逾時（bounded timeout race）；逾時即以既有 `freshness: 'uncertain'` 或 `'unavailable'` 回傳，不得因等待 live search 而延遲 `emergencyGuide` 之交付。
- **前端 Render 規則**：前端收到 Stage 1 response 後立即 render `EmergencyAnswerCard`，不等待任何後續請求。
- **Stage 2（Live-data enrichment request）**：前端於 Stage 1 render 完成後，背景自動送出第二次 `POST /api/assistant` request（沿用既有 request/response contract 與相同 query context），此次 live search 呼叫使用完整逾時預算：
  - 成功：回傳 `freshness: 'verified'` 與 `liveDataMessage`，前端僅更新 live-data 狀態區塊。
  - 逾時／失敗：回傳 `freshness: 'uncertain'` 或 `'unavailable'`。
  - 前端一律不得以 Stage 2 結果重新渲染、撤回或延後已顯示之 `emergencyGuide` 內容。
- **架構邊界**：Stage 1 / Stage 2 皆為既有 `POST /api/assistant` contract 之標準 request/response 呼叫，不使用 WebSocket、SSE、full-duplex streaming、Realtime API，亦不新增 backend framework、provider 或架構層。

---

## Constitution Check (工程憲章審查)

*GATE: Must pass before implementation.*

- [x] **I. Specification Before Implementation**: 本 Plan 嚴格對齊已批准之 `spec.md` 與 `ux-ui-design-handoff.md`。
- [x] **II. Simplest Sufficient Technology**: 無 Database、無 Vector DB、無 Auth、無 React Router、無 Redux/Zustand、無 Axios、無 Monorepo，無不必要依賴。
- [x] **III. Complexity Discipline**: 複雜度等級為 C｜AI-Powered App，Generative AI 為核心體驗，其餘架構保持 Simplest Standard。
- [x] **IV. Technology Stack Stability**: 採用 React + TS + Vite + Vercel Functions + OpenAI + Google Places，完全遵守 Approved Technical Truth。
- [x] **V. Privacy by Minimum Necessary Data**: 位置、語音與對話資料之最小處理範圍與持久化限制依 Specification FR-017 / FR-018；技術上經緯度僅於一次性 Request 處理中使用。
- [x] **VI. Secrets Never Live in Frontend**: `OPENAI_API_KEY` 與 `GOOGLE_PLACES_API_KEY` 僅在 Serverless Functions 存取，`.env.local` 已 gitignored。
- [x] **VII. AI Freshness and Honesty**: Freshness 判斷與使用者提示規則依 Specification FR-015；技術上以 `liveDataStatus` 欄位驅動 UI 呈現。
- [x] **VIII. Translation Quality Over Literal Translation**: 中譯日注重東京在地自然情境語氣；日譯中採用台灣繁體中文，避免大陸用語。
- [x] **IX. Safety-Critical Action First**: Emergency 情境判斷與首屏優先順序依 Specification FR-016；技術上以 `EmergencyAnswerCard` 優先 render 安全動作、隱藏無關推薦。
- [x] **X. Testability**: 提供 Vitest 自動化測試與完整的 Runnable Validation Journeys 手動測試流程。
- [x] **XI. Maintainability**: 扁平、低抽象層之專案結構，依功能導向模組化。
- [x] **XII. Incremental Implementation**: 劃分 9 大實作 Phase，每一 Phase 遵守 Run → Verify → Fix 循環。
- [x] **XIII. Graceful Failure**: 所有外部 API 失敗與麥克風/GPS 權限拒絕均轉換為使用者友善的 `ProductError` 狀態與下一步建議。
- [x] **XIV. Repository Safety**: 非破壞性專案結構，保留既有 `.git/`, `.github/`, `.specify/`, `.vscode/`, `specs/` 資產。
- [x] **XV. Traditional Chinese Working Language**: 所有計畫、設計與說明文件均使用台灣繁體中文。

---

## Project Structure (專案目錄結構)

```text
tokyo-mate/
├── .github/                      # GitHub Workflows & Copilot/SpecKit configuration
├── .specify/                     # SpecKit memory, constitution & scripts
├── api/                          # Vercel Serverless Functions
│   ├── assistant.ts              # OpenAI Assistant Orchestration
│   ├── transcribe.ts             # OpenAI Whisper Audio Transcription
│   ├── speech.ts                 # OpenAI TTS Speech Generation
│   └── places.ts                 # Google Places API (New) Integration
├── public/                       # Static public assets (icons, manifest, offline fallback)
├── specs/                        # Specifications & Design artifacts
│   └── 001-tokyo-travel-assistant/
│       ├── spec.md               # Product Truth Specification
│       ├── ux-ui-design-handoff.md
│       ├── plan.md               # Technical Implementation Plan (This file)
│       ├── research.md           # Phase 0 Research Decisions
│       ├── data-model.md         # Phase 1 Data Model & Interfaces
│       ├── quickstart.md         # Phase 1 Quickstart Validation Guide
│       ├── contracts/            # Phase 1 Server API Contracts
│       │   ├── assistant-api.md
│       │   ├── transcribe-api.md
│       │   ├── speech-api.md
│       │   └── places-api.md
│       └── checklists/
│           └── requirements.md
├── src/                          # Frontend Application Code
│   ├── components/               # Shared UI Components (Button, Input, Card, Modal, AudioPlayer)
│   ├── screens/                  # Top-level Screen Views (HomeScreen, AssistantScreen, KnowledgeBrowser；命名依 spec.md Naming Glossary，KnowledgeBrowser 僅為東京百科 UI component 識別名稱)
│   ├── features/                 # Domain Feature UI Modules
│   │   ├── translation/          # TranslationResult, ToneAdjuster
│   │   ├── travel/               # TravelAnswer, ActionPlan
│   │   ├── nearby/               # NearbyResults, PlaceCard
│   │   ├── knowledge/            # KnowledgeCard, CategoryFilter
│   │   ├── emergency/            # EmergencyAnswerCard
│   │   └── speech/               # VoiceInputModal, EditableTranscript
│   ├── data/                     # Tokyo Knowledge Base JSON Files
│   │   └── tokyo/
│   │       ├── areas.json        # 18+ Tokyo Areas
│   │       ├── transport.json    # Transport & Transfers
│   │       ├── food.json         # Dining & Etiquette
│   │       ├── shopping.json     # Shopping & Tax Free
│   │       ├── culture.json      # Culture & Manners
│   │       └── emergency.json    # Emergency Contacts & Actions
│   ├── services/                 # Client Services & API Client Helpers
│   │   ├── api.ts                # Client fetch wrappers for /api/*
│   │   ├── knowledge.ts          # Local Knowledge Retrieval & Filtering
│   │   └── geolocation.ts        # Geolocation API Wrapper
│   ├── types/                    # Shared TypeScript Types & Interfaces
│   │   ├── request.ts            # UserRequest, UserLocation
│   │   ├── assistant.ts          # AssistantResult, SuggestedAction
│   │   ├── knowledge.ts          # KnowledgeEntry
│   │   ├── place.ts              # PlaceResult
│   │   └── error.ts              # ProductError, ErrorCode
│   ├── styles/                   # Vanilla CSS / CSS Variables / Global Styles
│   │   ├── variables.css
│   │   ├── global.css
│   │   └── components.css
│   ├── App.tsx                   # Main App Shell & State Orchestration
│   └── main.tsx                  # React Entry Point
├── .env.example                  # Environment Variables Template
├── README.md                     # 產品、設定、驗證、PWA、隱私與部署說明
├── .gitignore                    # Git Ignore rules
├── package.json                  # Dependencies & Scripts
├── tsconfig.json                 # TypeScript Config
├── vite.config.ts                # Vite Build & Dev Server Config
└── vitest.config.ts              # Vitest Testing Config
```

---

## Complexity Tracking (複雜度管制)

| 項目 | 理由 | 替代被拒絕方案與原因 |
|---|---|---|
| **Vercel Serverless Functions (`api/*.ts`)** | 保護 `OPENAI_API_KEY` 與 `GOOGLE_PLACES_API_KEY` | 拒絕前端直接呼叫外部 API（違反 Constitution VI 秘密洩漏風險）。 |
| **Local Knowledge JSON (`src/data/tokyo/*.json`)** | 完全零託管成本、Git 版本管理，檢索極快 | 拒絕 Vector Database / Supabase / Pinecone（違反 Simplest Sufficient Technology）。 |

---

## Implementation Phases (實作階段劃分)

### Phase 1: App Shell & Foundation
- 建立非破壞性專案結構、`package.json`、Vite + TS 設定、CSS 變數與基礎 RWD Layout。
- 實作品牌 Header、通用輸入列（文字/麥克風按鈕）與 4 大入口卡片（即時翻譯、問東京、探索附近、東京百科）。
- 建立 Web App Manifest 與必要 icons 基礎規格。
- 實作網路狀態提示、需要連線功能的 disabled/error 邊界，以及不阻斷目前任務的新版更新提示。

### Phase 2: Server Boundary & 文字 AI 核心（含 Early Platform Safety Gate Checkpoint）
- 實作 `/api/assistant.ts` Serverless Function。
- 整合 OpenAI Structured Outputs，依 Specification FR-015 / FR-016 之 Safety/Freshness 決策模型，實作 `AssistantResult` 強型別回應（技術上以 discriminated union 表達）。
- 前端實作 AssistantScreen 基礎訊息呈現與 API Client Wrapper (`src/services/api.ts`)。
- **Early Platform Safety Gate Checkpoint**（此 Gate 未通過前不得開始 User Story 實作）：
  1. Service Worker implementation 存在且驗證後才允許被註冊。
  2. `/api/*`、AI/Speech/Places/live requests 絕對排除於 PWA Cache Storage 之外。
  3. 依 Specification FR-018，驗證 AI response、翻譯結果、語音 Blob 與精確地理位置未被持久化至任何 client-side storage。
  4. 依 Specification FR-017，驗證 LocalStorage / IndexedDB 未保存任何聊天對話紀錄（僅允許 browser runtime memory 暫存當次使用狀態）。
  5. Web App Manifest 基本有效，靜態 Cache allowlist 僅允許批准的 App Shell、靜態 assets 與靜態 Knowledge Base。

### Phase 3: 中日雙向翻譯體驗
- 增強 AI Prompt 支援語調切換（預設自然、更禮貌、更口語）。
- 實作 `TranslationResult` 組件：大字日文顯示、一鍵複製、播放語音與語調按鈕。

### Phase 4: Tokyo Knowledge Base & 檢索
- 建立 `src/data/tokyo/` 6 大結構化 JSON 資料檔 (`areas`, `transport`, `food`, `shopping`, `culture`, `emergency`)。
- 實作 `src/services/knowledge.ts` 元資料比對檢索，並將 Top 相關條目注入至 `/api/assistant.ts` System Context。
- 實作 `KnowledgeBrowser` 分類瀏覽器。
- 依 Specification FR-009 / SC-003 之首屏內容順序，實作 conclusion/action/caution/phrase 型別化 render 流程。

### Phase 5: 即時 Web Data 狀態處理
- 在 `/api/assistant.ts` 中結合 OpenAI Web Search 能力處理時間敏感查詢（Freshness = `live_required`）。
- 產品判斷與使用者可觀察行為依 Specification FR-015；Plan 僅實作 `liveDataStatus`/`message`/`nextAction` 型別化 render 流程與 live lookup 技術整合。

### Phase 6: Speech-to-Text & Text-to-Speech
- 實作前端 `VoiceInputModal` 搭配 `MediaRecorder` API。
- 實作 `/api/transcribe.ts` (Whisper API) 與可編輯辨識文字框 (`EditableTranscript`)。
- 實作 `/api/speech.ts` (TTS API) 與前端 Audio Player，支援正常與慢速 (0.75x) 播放。

### Phase 7: Explore Nearby 地點探索
- 實作 `/api/places.ts` (Google Places REST API)。
- 前端 `geolocation.ts` 處理主動授權，拒絕時提供手動地區輸入 fallback，確保精確座標不持久化。
- 實作 `NearbyResults` 與 `PlaceCard` 地點卡片。

### Phase 8: Emergency Mode & Graceful Error Recovery
- 於 `/api/assistant.ts` 依 Specification FR-016 實作 Safety = `emergency` 意圖偵測與對應結構化回應之技術產生流程。
- 實作 `EmergencyAnswerCard`（優先顯示獨立安全動作、隱藏無關景點快捷）。
- 實作全站統一 `ProductError` 失敗處理（麥克風拒絕、GPS 拒絕、網路斷線、API 異常）。

### Phase 9: Responsive Polish & Acceptance Criteria Verification
- 完成手機、平板、桌面視圖之排版優化。
- 完整 PWA 驗收：installability、offline App Shell / static Knowledge Base、network-required fallback、update flow 與 cache privacy boundary。
- 依 Specification SC-001、SC-002、SC-003、SC-004、FR-015、FR-017/SC-009、FR-020、FR-025／SC-014 驗證產品行為；Plan 僅執行對應 benchmark harness、fixture 測試與 viewport matrix 技術檢查。
- 執行全部單元測試與 `quickstart.md` 手動 validation journeys，確保 100% 滿足 Acceptance Criteria。

### Cross-Artifact Remediation Traceability

本表僅為 Product Truth 與 Technical Realization 之最小對照，完整 Product Requirement 與 Acceptance Criteria 原文以 `spec.md` 為唯一事實來源。

| Product Truth | Technical Realization |
| --- | --- |
| SC-001 | `quickstart.md` 手動驗證旅程（四步驟操作流程） |
| SC-002 | Benchmark harness (`tests/fixtures/latency-cases.json`)、`docs/verification/latency-report.md` 報告產生 |
| SC-003 / SC-004 | `AssistantResult` 型別化 render 順序（TravelAnswer / EmergencyAnswerCard 元件呈現順序） |
| FR-015 / FR-016 | Assistant orchestration、freshness/safety 內部技術狀態、live lookup 流程、emergency progressive rendering |
| FR-017 / FR-018 | Runtime-only client state（React state/Context）、Service Worker cache allowlist 排除規則、Early Platform Safety Gate（Phase 2）技術檢查點 |
| FR-019 / FR-020 | Prompt 規則實作、QA fixture 檔案、驗證產出流程 |
| SC-009 | `docs/verification/privacy-report.md` 驗證產出（LocalStorage/IndexedDB/Cache Storage 檢查） |

## Run / Verify / Fix / Evidence Standard

為確保實作過程可嚴格追溯與驗證，所有 Phase 均須落實以下標準流程：

- **Run**：執行該階段的建置、測試或啟動指令。
- **Verify**：以自動化測試與手動旅程檢驗該階段的目標與安全邊界。
- **Fix**：若 Verify 失敗，僅修正與該階段直接相關的檔案，嚴禁刪除測試或放寬驗收門檻。
- **Evidence**：於測試紀錄中明確留存：
  - `commands`：實際執行的驗證命令。
  - `automated checks`：單元測試、型別檢查與 linter 執行結果。
  - `manual journeys`：手動旅程操作情境與觀察。
  - `pass/fail`：具體通過或失敗項目。
  - `deferred issues`：若有非阻塞性已知問題，明確記錄追蹤。

## Generated Verification Artifacts

以下 verification artifacts 由對應 Verify 任務執行時產生；尚未執行對應任務前不要求檔案預先存在。完整 owner task／trigger／output path／minimum contents 定義以 tasks.md『Generated Verification Artifacts』為單一事實來源，本節僅摘要清單：

| Artifact | Output Path |
|---|---|
| Latency Report | `docs/verification/latency-report.md` |
| Privacy Report | `docs/verification/privacy-report.md` |
| PWA Report | `docs/verification/pwa-report.md` |
| Journey Report | `docs/verification/journey-report.md` |
| Final Report | `docs/verification/final-report.md` |

## Notes

### README.md 最低內容

README.md 必須以台灣繁體中文提供以下內容：產品簡介、v1 核心能力、prerequisites、setup、environment variable names（不含 Secret）、local development、test/build、PWA installability 與 partial offline boundary、privacy/data retention、deployment，以及 known limitations。

