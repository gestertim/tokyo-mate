# Tokyo Mate 東京通

**會說台灣中文的東京私人導遊 × 台日雙語口譯員 × 旅遊知識顧問**

使用者不需要懂日文，也不需要懂東京，就可以更放心地在東京行動。

## 主要功能

Tokyo Mate 提供三個核心能力：

### 1. 台日雙向 AI 即時翻譯
- 支援語音輸入（中文或日文）
- 自動語言識別與翻譯
- 語音播放輸出（日文或中文）
- 文字版本可複製使用

### 2. 東京 AI 旅遊助手
- 針對東京旅遊情境的智能問答
- 支援緊急情況協助（遇事、迷路、醫療、交通等）
- 與附近探索、東京百科聯動
- 即時資訊查詢（營業時間、聯絡方式、票價等）

### 3. 東京旅遊知識助手
- 離線可用的東京百科知識庫
- 探索附近景點、餐廳、車站、緊急設施
- 支援按類別、按距離篩選
- 點選地點可複製地址、電話或查看路線

### 輔助功能
- **PWA 可安裝**：新增至主畫面，離線時仍可訪問
- **部分離線能力**：App Shell 與靜態知識內容無須網路
- **隱私友善**：麥克風與定位只在使用者主動授權時啟用
- **台灣中文**：完整繁體中文介面與對話

## PWA 與離線能力

### 離線可用
- ✅ App Shell（導覽、基本 UI）
- ✅ 已核准的靜態東京知識內容與東京百科
- ✅ PWA 安裝與 standalone mode

### 需要網路
- ❌ Generative AI 翻譯（OpenAI API）
- ❌ AI 旅遊問答與緊急協助（OpenAI API）
- ❌ 語音識別 STT（OpenAI Whisper）
- ❌ 文字轉語音 TTS（OpenAI TTS）
- ❌ 附近探索（Google Places API）
- ❌ 即時資訊查詢（Live web search）

**注意**：Tokyo Mate 不聲稱 AI 可以完整離線執行。所有翻譯、問答、語音皆依賴網路連線。

## 隱私設計

- **麥克風**：只在使用者點選「語音輸入」時才請求權限
- **定位**：只在使用者選擇「使用我的位置」時才請求權限；可改用手動輸入地區
- **個人資料**：不建立公開個人資料或用戶帳號
- **聊天歷史**：v1 不提供長期聊天記錄存儲
- **Cache Storage**：不儲存 AI 對話、語音檔案、精確位置或使用者旅程資料
- **API Secrets**：所有 provider credentials 僅存在 server-side environment variables，絕不公開

## Technology Stack

- **前端框架**：React 18 + TypeScript
- **構建工具**：Vite
- **測試**：Vitest + React Testing Library
- **PWA**：Web App Manifest + Service Worker + Cache Storage API
- **地理定位**：Web Geolocation API
- **AI 與語言**：OpenAI API（GPT、Whisper、TTS）
- **地點資訊**：Google Places API
- **部署**：Vercel Serverless Functions + 靜態前端

## 本地開發

### Prerequisites

- Node.js >= 18
- npm >= 9
- 開發環境需使用 HTTPS 或 localhost 以支援 Service Worker 與 PWA 驗證

### Installation

```bash
npm install
cp .env.example .env.local
```

### Environment Variables

在 `.env.local` 設定以下變數（`.env.local` 僅存放於本機，勿提交）：

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GOOGLE_PLACES_API_KEY=
```

**重要**：
- `.env.local` 已納入 `.gitignore`，不會被追蹤或提交
- `.env.example` 只列出變數名稱與預設值，不包含真實 keys
- 所有 secret 必須在本機或 Vercel server environment 中配置

### Development Server

```bash
npm run dev
```

開啟 `http://localhost:5173`（或顯示的實際埠號）。

**首頁行為**：
- 不會主動要求麥克風或定位權限
- 權限只在使用者選擇對應功能後請求
- 使用者可隨時在瀏覽器設定中撤銷權限

### Test

```bash
npm run test
npm run test:watch
npm run coverage
```

Tests 使用 Vitest 與 React Testing Library。

### Production Build

```bash
npm run build
```

輸出位置：`dist/` 目錄

執行 TypeScript 檢查（`tsc -b`）後產出優化的靜態資源。

## Vercel Deployment

Tokyo Mate 可直接部署至 Vercel：

1. **前端**：由 Vite 構建，靜態資源由 Vercel CDN 服務
2. **後端**：`api/` 目錄中的 API routes 作為 serverless functions 執行

### Environment Variables in Vercel

所有 provider secrets 必須在 Vercel 專案設定中配置：

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `GOOGLE_PLACES_API_KEY`

**重點**：secrets 不得放入前端程式碼或公開靜態資產。

### Preview & Production URLs

- **Preview Deployments**：每個 commit/PR 自動生成預覽 URL
- **Production Deployment**：main branch 自動部署至生產環境

## Testing & Verification Status

Tokyo Mate 目前處於 **MVP validation 階段**。

### 已完成驗證
- ✅ T080：Specification completeness
- ✅ T081：Stack & dependencies appropriateness
- ✅ T084：PWA offline capability
- ✅ T089：End-to-end user flow

### 待完成驗證
- ⏳ **T087：Production-like Latency Verification** — 需在 Vercel Preview 或等效 production-like 環境中使用實際 provider 執行量測

### Final MVP Acceptance
- **SC-002 Final Acceptance**：待 T087 完成後進行

**注意**：此版本尚未通過最終 latency 驗證，不得宣稱 SC-002 或整體 Final MVP Acceptance 已完成。

## Known Limitations & Next Steps

- Service Worker 與 offline installability 需在 secure context（localhost 或 HTTPS）驗證
- PWA 安裝、standalone viewport、offline restart 與 Cache Storage privacy 檢驗需依 specification 於支援裝置/瀏覽器手動驗收
- T087 production-like latency report 需在完整 provider 環境執行；目前已建立量測 dataset，待正式環境驗證

## Repository & Spec-driven Development

Tokyo Mate 採用 **specification-driven development** 方法論。

- `specs/` 目錄：完整的產品規格與驗收標準
- `.specify/` 目錄：Spec Kit 組織與工作流程
- `.github/skills/` 目錄：Copilot CLI 與 Spec Kit 工具集

詳見 `specs/` 與 `.specify/` 中的規格文件與計畫。
