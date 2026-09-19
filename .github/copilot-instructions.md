# Tokyo Mate 東京通｜Repository-wide Copilot Instructions

本 repository 採 GitHub Spec Kit 規格驅動開發。所有工作均須遵守 Constitution、已批准的 Specification、Plan 與 Tasks。

## 語言規則

所有需要使用者閱讀、審閱、批准或操作的 artifacts，以及 Copilot 回覆，一律使用台灣繁體中文。

程式語法、identifiers、commands、paths、API、package、framework、library names 與技術必要 literals 可保留英文。

## Source of Truth

- Specification = Product Truth
- Constitution = Engineering Governance
- Plan = Technical Truth
- Tasks = executable work
- Analyze = implementation 前的唯讀 consistency check
- Implement = execution stage

各 artifact 應在自己的治理範圍內作為 source of truth。

如果 Constitution、Specification、Plan、Tasks 或 UX/UI handoff 之間出現實質衝突，不得由 agent 自行選擇其中一方覆蓋另一方。

必須 STOP，指出衝突位置與影響，並透過正確的 artifact / approval flow 完成 reconciliation。

涉及產品行為、範圍、驗收、資料需求、錯誤處理、分享／隱私或核心 AI 體驗的變更，必須同步回正式 Specification。

涉及 engineering governance 的變更必須符合 Constitution。

涉及 implementation technology / architecture 的決策必須反映於已批准 Plan。

不得以 application code 默默改變任何已批准契約。

## Implementation Authorization

Specify、Clarify、UX/UI、Plan、Checklist、Tasks、Analyze 都不是 implementation 授權。

只有在使用者明確批准進入 `/speckit.implement`，且已完成 `/speckit.analyze` 與 Implementation Readiness Gate 後，才可依已批准的 Specification、Plan 與 Tasks 修改 application code。

未經授權不得自行開始 implementation、建立 endpoint、安裝 dependency、修改 environment variables、建立 branch 或變更既有產品行為。

## Repository Safety

必須保留既有：

- `.git/`
- `.github/`
- `.specify/`
- `.vscode/`（若 repository 中存在）
- `specs/`
- 既有 specification、plan、tasks、UX/UI、README、checklists、verification 與其他專案資產

不得因 `.vscode/` 目前不存在而建立它，也不得把缺少 `.vscode/` 視為 blocker。

不得把 repository root 當成空目錄重新 scaffold。

不得執行可能清空、覆寫或重建 repository root 的 destructive scaffolding，例如 `npm create vite .`、`npx create-vite@latest .`、`create-next-app .` 或等效指令。

如需要建立 React + TypeScript + Vite App，必須先檢查既有檔案，再採非破壞方式建立或補足必要檔案。

`.specify/` 與 `.github/skills/` 為本機 Spec Kit／Copilot tooling，可能依 `.gitignore` 不受 Git tracking；不得因而刪除、重新初始化或重新產生。

## 001 Protection

`specs/001-tokyo-travel-assistant/` 是既有 MVP 的正式歷史與產品資產。

002 不得覆寫、搬移、重新編號或把 002 requirements 寫入 001。

001 UX/UI 可作維持產品一致性的 reference，但不是 002 的可修改工作區。既有 001 specification、plan、tasks、UX/UI、checklists、contracts 與 verification artifacts 均須保留。

## Complexity / Stack Stability

遵守 simplest sufficient technology。Tokyo Mate 是既有 C｜AI-Powered App；Generative AI 是核心體驗，但不代表可自行提高其他架構複雜度。

沿用目前已批准 stack；不得因 agent preference 自行替換 framework、provider、deployment、資料策略或新增 architecture layer。

目前既有 stack 至少包括：

- React
- TypeScript
- Vite
- Vercel Serverless Functions
- existing OpenAI integrations
- Google Places integration
- Browser Geolocation
- repository-local knowledge assets
- 001 baseline 已存在的 PWA 能力

不得無 requirement 理由自行加入：

- React Router
- Redux
- Zustand
- Firebase
- Supabase
- application SQL / NoSQL database
- vector database
- Authentication
- microservices
- Docker / Kubernetes
- 新的 PWA offline architecture
- 其他不必要 architecture layer

## Secrets / Privacy

API keys、secrets、private tokens 與 service credentials 不得放入 frontend bundle、public source、README 實際範例或 Git repository。

敏感外部服務呼叫必須經最小必要的 server-side boundary。

Camera、photo、microphone、location 等能力只能由明確使用者操作觸發。

不得無需求建立長期個資、照片、位置或對話儲存。第一版不建立長期聊天紀錄，且不預設永久保存精確位置。

## Approval Gates

遇到下列情況必須 STOP 並取得使用者明確批准：

- destructive operation
- stack change
- 新 dependency
- Backend、Database 或 Authentication architecture change
- major scope change
- privacy behavior change
- location behavior change
- voice behavior change
- core AI behavior change
- 對既有 MVP compatibility 有重大影響的變更
- destructive rollback、history rewrite 或 force push

## Incremental Implementation

教育與安全情境採 phase-by-phase：

Implement → Run → Verify → Fix

每個 phase 驗證完成後，才可進入下一個主要概念。不得一次大量修改後才驗證。

## Baseline Protection

已存在 rollback-safe baseline：

`mvp-safe-baseline`
→ `fb09a41182bcc639a9335adbd0e1f84405a1bba7`

不得移動、刪除、重建或 force-update 此 tag。

不得把 baseline 描述成完整 production acceptance；既有 README 的 MVP validation 與待完成驗證狀態必須如實保留。