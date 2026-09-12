# Tokyo Mate 東京通｜Repository-wide Copilot Instructions

本 repository 採 GitHub Spec Kit 規格驅動開發。整個工作流程與所有需要使用者閱讀、審閱、批准或操作的文字 artifacts，一律使用台灣繁體中文。

程式語法、code identifiers、function/class/variable names、schema/API/config keys、CLI commands、正式 command names、file paths、package/framework/library names，以及技術正確性所需 literals 可以保留英文；其餘 user-facing 說明使用繁體中文。

## Product / Technical Authority

Specification 是 Product Truth。
Constitution 是 Engineering Governance。
Plan 是 Technical Truth。
Tasks 是 executable work。
Analyze 是 implementation 前的唯讀一致性檢查。
只有 `/speckit.implement` 才授權修改 application code 以執行已批准 tasks。

不得因實作方便自行改變已批准產品需求或技術棧。

## Repository Safety

開始任何 setup 或 implementation 前，先檢查 repository 目前內容。

必須保留既有：
- `.git/`
- `.github/`
- `.specify/`
- `.vscode/`
- `specs/`
- 其他已存在的 Specification、Plan、Tasks、UX/UI、README、checklists 與專案資產。

不得把已初始化的 Spec Kit repository 當成空目錄。

禁止在 repository root 執行可能清空、覆蓋或重建既有內容的 destructive scaffolding，例如：
- `npm create vite .`
- `npm create vite@latest .`
- `npx create-vite@latest .`
- `create-next-app .`
- 或任何等效的 destructive command。

如需要建立 React + TypeScript + Vite App，必須先檢查既有檔案，再採非破壞方式建立或補足必要檔案。

## Approval Guard

以下情況必須停止並要求成人教育者明確批准：
- destructive operation
- 已批准 stack 的重大更換
- 新增未批准 Backend / Database / Authentication
- 新增大型 dependency 或 architecture layer
- 核心 scope 改變
- 位置、語音、隱私、分享或資料保存方式重大改變
- 核心 AI 體驗改變

Specify、Constitution、UX/UI、Plan、Tasks、Analyze 都不是 implementation 授權。

在 `/speckit.analyze` 完成且 Implementation Readiness Gate 通過前，不得執行 `/speckit.implement`。

## Tokyo Mate Complexity Discipline

本專案為 C｜AI-Powered App，原因是 Generative AI 是核心產品體驗。

C 不代表可以任意提高其他架構複雜度。

已批准技術方向：
- React
- TypeScript
- Vite
- Vercel Serverless Functions
- OpenAI Responses API
- OpenAI transcription API
- OpenAI Speech API
- OpenAI web search
- Google Places API (New)
- Browser Geolocation API
- repository-local JSON Knowledge Base

目前未批准：
- React Router
- Redux
- Zustand
- Firebase
- Supabase
- SQL / NoSQL application database
- Vector database
- Authentication
- 長期聊天紀錄
- WebSocket backend
- Realtime full-duplex voice
- Microservices
- Docker / Kubernetes
- PWA offline architecture
- 其他無 requirement 理由的 architecture layer

不得自行替換已批准 stack。

## Privacy and Secrets

不得將 API Key、Secret、private token 或 service credential 放入 frontend bundle、public source、README 實際範例或 Git repository。

敏感外部服務呼叫必須經 server-side boundary。

位置權限只在使用者主動選擇「使用我的位置」時要求。
麥克風權限只在使用者主動開始語音功能時要求。

第一版不建立長期聊天紀錄，不預設永久保存精確位置。

## Incremental Implementation

優先 phase-by-phase implementation。

每個 phase 採：
Implement → Run → Verify → Fix → 再進下一 phase。

一次引入一個主要新概念。

所有 Tasks、Analyze、Implement、Verify 與後續 verification notes 都保持繁體中文。