# Technical Research: Tokyo Mate 東京通

**Feature Branch**: `001-tokyo-travel-assistant`  
**Date**: 2026-09-12  
**Status**: Completed  

---

## 研究 1：Vercel Serverless Functions API Handler 與請求解析

### 問題與背景
Tokyo Mate 選擇 Vercel Serverless Functions 作為最小必要 API server boundary，用以保護 `OPENAI_API_KEY` 與 `GOOGLE_PLACES_API_KEY`。需要確定在 Node.js / Vite 專案架構下的 Vercel Function 撰寫標準與請求解析方式。

### Decision（決策）
採用 Vercel 原生 Node.js Serverless Functions (`VercelRequest` / `VercelResponse` 或標準 Web `Request` / `Response` handler) 置於根目錄 `/api` 下。
- Endpoints:
  - `/api/assistant.ts`
  - `/api/transcribe.ts`
  - `/api/speech.ts`
  - `/api/places.ts`
- 內部均封裝強型別 request validation、API key 存取、錯誤攔截與統一 response shape (`{ success: true, data: ... }` / `{ success: false, error: ... }`)。

### Rationale（理由）
1. 無需額外引入 Express、Fastify、NestJS 或 Koa，完全符合 **Simplest Sufficient Technology** 原則。
2. Vercel 自動偵測 `/api/*.ts` 檔案並部署為 Serverless Functions，開箱即用支援 TypeScript。
3. 同一 Repository 部署 Vite 前端與 `/api` 後端，不需設定複雜的 CORS 或額外網域管理。

### Alternatives Considered（替代方案比較）
- **Express / NestJS Backend**: 架構過於龐大，增加維護與營運成本，違反 Simplest Sufficient Technology。
- **Direct Client-Side External API Calls**: 將 API Key 曝露於前端 bundle，違反 Constitution VI（Secrets Never Live in Frontend）。

---

## 研究 2：瀏覽器 MediaRecorder 與 `/api/transcribe` 語音轉文字流程

### 問題與背景
使用者透過麥克風錄音，瀏覽器需轉為音訊 Blob，傳送至 `/api/transcribe` 後呼叫 OpenAI Audio Transcription API (Whisper)。需要確定音訊格式相容性與 multipart/form-data 處理方式。

### Decision（決策）
- 前端使用原生 `MediaRecorder` API 錄製音訊，音訊格式優先採用 `audio/webm;codecs=opus`（或 Safari 下相容的 `audio/mp4` / `audio/aac`）。
- 錄音完成後轉為 `Blob` / `File` 物件，包裝於 HTML5 `FormData` 傳送至 `/api/transcribe`。
- Server 端 `/api/transcribe` 接收 multipart payload 或原生 buffer，傳送至 OpenAI API `openai.audio.transcriptions.create({ file, model: "whisper-1" })`。
- 回傳辨識文字 `{ text: string }` 給前端，前端顯示於可編輯文字框，讓使用者檢查與修正後，再呼叫 `/api/assistant`。

### Rationale（理由）
1. 支援主流行動裝置與桌面瀏覽器（iOS Safari, Android Chrome, Desktop Chrome/Safari）。
2. 使用者在 AI 翻譯前可檢查與修正文字，避免錄音口誤或環境雜音造成錯誤翻譯，提升產品可用性。
3. 不需要建立全雙工 WebSocket 或 Realtime WebRTC 複雜連線，符合 v1 需求。

### Alternatives Considered（替代方案比較）
- **Web Speech API (`webkitSpeechRecognition`)**: 跨瀏覽器相容性極差（iOS Safari 支援度有限、不同瀏覽器行為不一）。
- **OpenAI Realtime Voice Session**: 複雜度過高，且費用高昂，超越 v1 需求。

---

## 研究 3：OpenAI Responses / Chat API 結構化輸出與 Intent Orchestration

### 問題與背景
AI 回應需要涵蓋意圖判斷（翻譯、導遊、附近、百科、緊急）、自然雙語輸出、即時資料狀態判斷與建議操作。如何確保 AI 回傳可預測且嚴格相符的結構化資料？

### Decision（決策）
- 在 `/api/assistant.ts` 中使用 OpenAI SDK 的 Structured Outputs (`response_format: { type: "json_object" }` 或 `zod` schema / JSON Schema) 強制 OpenAI 輸出符合 TypeScript `AssistantResult` 介面的 JSON 結構。
- 系統提示詞（System Prompt）注入：
  - 台灣繁體中文原則與親切禮貌語氣。
  - 台北/東京旅遊情境感知規則（結論優先、步驟清晰）。
  - 當前東京知識庫關聯資料（Knowledge Context Injection）。
  - 緊急情況判定邏輯（安全第一、隱藏景點推薦）。
  - 需求是否需要即時資料 (`liveDataStatus`) 判定。
- 模型名稱由環境變數 `OPENAI_MODEL` 控制（預設例如 `gpt-4o-mini` 或 `gpt-4o`）。

### Rationale（理由）
1. 前端組件只需讀取強型別 JSON 欄位（`intent`, `primaryContent`, `translation`, `liveDataStatus`, `emergency` 等），不需進行危險易錯的非結構化字串解析。
2. 單一 Assistant Endpoint + 強型別 Intent 判斷，維持簡潔的 Request Orchestration，不需維護 5 套獨立的 Agent 系統。

### Alternatives Considered（替代方案比較）
- **LangChain / LlamaIndex / Agent Frameworks**: 導入過多不必要的抽象層，違反 Simplest Sufficient Technology。
- **純文字串流 (Plain Text Streaming)**: 非結構化純文字難以安全呈現結構化的旅遊建議、日文對照卡與緊急模式面板。

---

## 研究 4：Google Places API (New) REST 整合與位置隱私

### 問題與背景
「探索附近」功能需要在使用者授權位置（或手動輸入地區）後，搜尋附近的景點、餐廳、便利商店等 Places 資料。需要確定 Google Places API (New) 的呼叫方式與隱私保護。

### Decision（決策）
- Server 端 `/api/places.ts` 透過 HTTP POST 直接呼叫 Google Places API (New) REST Endpoints：
  - 當傳入座標時：呼叫 `https://places.googleapis.com/v1/places:searchNearby`（傳入 `locationRestriction` 經緯度與搜尋類別/關鍵字）。
  - 當傳入地區名稱文字時：呼叫 `https://places.googleapis.com/v1/places:textSearch`（傳入 `textQuery` 如 "新宿 燒肉"）。
- 回傳經簡化與型別化的 `PlaceResult[]` 陣列（包含 `id`, `name`, `category`, `address`, `location`, `distance`, `openingStatus` 等）。
- 嚴格遵守隱私原則：使用者座標僅在一次性 Request 處理中使用，不寫入 Local Storage、Session 或任何數據庫。

### Rationale（理由）
1. 直接使用 server-side HTTP `fetch` 呼叫 Google Places REST API，無需安裝重量級的 Client/Server Google Maps SDK，符合最小相依套件原則。
2. 位置僅在使用者主動點擊「使用我的位置」並授權後才透過 Geolocation API 取得；拒絕時能平滑退回至手動地區搜尋。

### Alternatives Considered（替代方案比較）
- **前端直接呼叫 Google Places JavaScript API / SDK**: 會將 `GOOGLE_PLACES_API_KEY` 暴露在前端 bundle 中，違反安全原則。
- **安裝 `@googlemaps/google-maps-services-js` 大型 SDK**: 增加了非必要的套件依據，直接使用原生 fetch 效能更好、包更小。

---

## 研究 5：東京 Knowledge Base 結構化 JSON 與檢索演算法

### 問題與背景
東京知識庫不使用應用程式資料庫或向量資料庫（Vector DB），需要確定以 repository 內 JSON 檔案進行高效檢索與 Context Injection 的機制。

### Decision（決策）
- 資料庫存放於 `src/data/tokyo/` 內，分為 6 個結構化 JSON 檔案：
  - `areas.json`（新宿、澀谷、淺草、上野等 18+ 區域指南）
  - `transport.json`（JR、地下鐵、Suica/PASMO、機場交通、轉乘與常見錯誤）
  - `food.json`（拉麵、燒肉、點餐、預約、過敏、小費等）
  - `shopping.json`（藥妝、電器、免稅退稅等）
  - `culture.json`（禮儀、溫泉、神社、電車注意事項等）
  - `emergency.json`（生病、護照遺失、手機遺失、警察、災害等）
- 每個 Entry 符合 TypeScript `KnowledgeEntry` 介面。
- 檢索機制：
  - **Step 1 (Metadata Filtering)**: 根據使用者 Request 中的類別、區域關鍵字、主題標籤 (tags) 進行本機比對過濾。
  - **Step 2 (Context Selection)**: 取出分數最高的前 3~5 筆相關 Entry，組裝為 JSON Context 注入給 OpenAI Assistant Prompt。

### Rationale（理由）
1. 靜態 JSON 檔案跟隨 Git 版本控管，完全不需要營運/託管 External Database 或 Vector Search Service，符合 Simplest Sufficient Technology。
2. 東京旅遊常用知識規模（數百筆）在記憶體比對極快（<2ms），檢索準確度高且維護成本極低。

### Alternatives Considered（替代方案比較）
- **Pinecone / Supabase Vector / Chroma / Embeddings**: 不必要的基礎設施複雜度，違反 Simplest Sufficient Technology 與 Complexity Discipline。

---

## 研究 6：單元測試與組件測試架構 (Testing Stack)

### 問題與背景
專案需要針對 Intent/Helper、Location Validation、Response Mapping、Knowledge Filtering、UI Components (TranslationResult, VoiceInput 等) 進行輕量級測試。

### Decision（決策）
- 採用 **Vitest** + **@testing-library/react** + **jsdom**。
- Vite 專案原生的 Vitest 無縫整合 Vite 設定，零額外轉譯開銷。
- 測試檔案與被測檔案鄰近放置（如 `*.test.ts` / `*.test.tsx`）。

### Rationale（理由）
1. Vitest 與 Vite 共用相同的 config 與 plugin，執行速度快且設定最少。
2. React Testing Library 提供使用者導向的組件測試，有效驗證 UI 狀態與互動行為。

---

## 結論總結

所有技術選項均符合 Constitution (Simplest Sufficient Technology, Complexity Discipline, Privacy, Secrets, Graceful Failure, Traditional Chinese) 以及 Approved Technical Truth。所有 NEEDS CLARIFICATION 事項均已完全解析，可進入 Phase 1 設計階段。
