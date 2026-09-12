<!--
Sync Impact Report
- Version change: scaffold → 1.0.0
- Modified principles: template placeholders → 15 Tokyo Mate engineering principles
- Added sections: Product and Security Constraints; Delivery and Quality Gates
- Removed sections: none
- Follow-up TODOs: none
-->

# Tokyo Mate 東京通 Constitution

## Core Principles

### I. Specification Before Implementation
Specification 是 Product Truth。任何會改變核心功能、使用者流程、資料需求、分享或隱私行為、即時資訊行為，或核心 AI 體驗的變更，MUST 先同步 Specification，再開始實作。實作、審查與驗收 MUST 能回溯至已批准的 Specification。

### II. Simplest Sufficient Technology
每一項 dependency、service、framework capability 與 architecture layer MUST 對應已確認的 requirement 或清楚的教學理由。沒有需求依據的技術不得加入；能以較簡單方案滿足需求時，MUST 採用較簡單方案。

### III. Complexity Discipline
Tokyo Mate 是 C｜AI-Powered App，因為 Generative AI 是核心體驗。C 不代表自動需要 Database、Authentication、微服務、複雜 global state、vector infrastructure 或其他架構。每項複雜度 MUST 有明確需求、風險或教學價值作為理由。

### IV. Technology Stack Stability
Technical Plan 一經批准即為 Technical Truth。未經批准不得自行替換 framework、AI provider、Speech、Places、deployment、data strategy 或重大 dependencies。若需要重大更換，提案 MUST 說明需求、現有問題、替代方案與新增風險，取得批准後才可修改。

### V. Privacy by Minimum Necessary Data
位置、語音與對話 MUST 只處理完成當下任務所需的最小資料。第一版 MUST 不建立長期旅遊聊天紀錄，也 MUST 不預設永久保存精確位置。任何例外都必須在 Specification 中說明目的、保存期限、使用範圍與使用者控制方式。

### VI. Secrets Never Live in Frontend
API Key、Secret、private token 與 service credential MUST 不得進入 frontend bundle 或 public repository。需要秘密憑證的服務 MUST 經由最小必要的 server-side boundary；審查 MUST 檢查設定、輸出與建置產物沒有暴露秘密。

### VII. AI Freshness and Honesty
涉及營業時間、交通異常、車班、票價、天氣、活動、展覽、訂位、價格或其他可能變動資訊時，產品 MUST 先辨識是否需要即時資料。無法確認時 MUST 清楚表達不確定性，不得把舊資料或模型知識表達成最新事實。

### VIII. Translation Quality Over Literal Translation
繁中轉日文的驗收標準是自然、友善、符合東京旅遊情境與適當禮貌程度，而非逐字翻譯。日文轉繁中 MUST 使用自然的台灣繁體中文，避免中國大陸慣用詞；語意、語氣與對方關係 MUST 維持一致。

### IX. Safety-Critical Action First
醫療、護照遺失、警察、災害、失物及其他緊急情況，回答 MUST 先提供立即可採取的安全行動與必要求助方向，不得以一般旅遊推薦取代重要安全資訊。無法確認時 MUST 明確指出限制並引導使用者尋求正式協助。

### X. Testability
核心產品行為與失敗狀態 MUST 能被觀察、測試與驗收。每項核心變更 MUST 定義可驗證的成功條件與至少一個失敗或邊界情境；不可觀察或不可驗收的行為不得視為完成。

### XI. Maintainability
程式 MUST 保持可理解、命名清楚，並避免巨型檔案、重複邏輯與無需求的 abstraction。抽象化、共用元件與重構 MUST 能降低已確認的維護成本，不得只為未來假設而增加結構。

### XII. Incremental Implementation
實作 MUST 採 phase-by-phase 方式進行。每個階段完成 Run、Verify、Fix，並確認結果後，才可進入下一個主要概念；未驗證的階段不得被當作完成或作為後續工作的可靠基礎。

### XIII. Graceful Failure
AI、網路、語音、位置、即時搜尋、Places 或其他外部能力失敗時，產品 MUST 提供一般使用者看得懂的狀態、影響範圍與可恢復的下一步，不得直接暴露 technical error。失敗處理 MUST 不捏造結果，且在可能時保留使用者已輸入的非敏感內容。

### XIV. Repository Safety
既有 `.git/`、`.github/`、`.specify/`、`.vscode/`、`specs/` 與所有既有規格資產 MUST 保留。任何 scaffolding、初始化或批次操作 MUST 不得 destructive，也不得未經批准覆寫既有資產；不確定時 MUST 先停止並提出確認。

### XV. Traditional Chinese Working Language
Specification、Constitution、UX/UI Handoff、Plan、Tasks、Analyze report、README、checklists、verification notes 與 `.github/copilot-instructions.md` 等 user-facing artifacts MUST 使用台灣繁體中文。code identifiers、正式 commands、API、package 與 file paths 可保留英文。

## Product and Security Constraints

Tokyo Mate 的治理優先順序為：使用者安全與誠實資訊、隱私與秘密保護、已批准的 Product Truth 與 Technical Truth、可驗收的使用者價值，最後才是便利性或實作速度。任何衝突 MUST 在審查紀錄中明確指出，並由適當的產品或技術責任人批准取捨。

涉及外部資料、位置、語音、對話、翻譯或 AI 產生內容的功能，Specification MUST 說明資料最小化、錯誤狀態、資訊新鮮度與使用者可理解性。不得以技術可行性推導出未獲批准的資料保存或分享行為。

## Delivery and Quality Gates

每個功能在進入實作前 MUST 具備已批准的 Specification；在進入主要實作階段前 MUST 具備已批准的 Technical Plan；在宣稱完成前 MUST 通過對應的 Run、Verify、Fix、測試與審查紀錄。審查者 MUST 檢查 Specification、Technical Plan、實作、測試與驗收結果的一致性。

發現未涵蓋的需求、資料風險、資訊新鮮度問題、安全性問題或重大技術替換時，工作 MUST 回到適當的規格或計畫階段，而不是以程式碼默默改變產品契約。所有豁免 MUST 記錄理由、影響、批准者與後續期限。

## Governance

本 Constitution 是 Tokyo Mate 的工程治理基準；若其他工作流程與本文件衝突，MUST 以本文件為準，除非已完成正式修訂。每次 Pull Request、規格審查與階段驗收 MUST 檢查本 Constitution 的適用原則，並在發現例外時留下可追溯紀錄。

修訂程序：提出者 MUST 說明變更動機、受影響原則、相容性影響、遷移或補救計畫與驗證方式；涉及 Product Truth、Technical Truth、隱私、安全或 AI 行為的修訂 MUST 在相關規格或計畫批准後才生效。修訂完成後 MUST 更新本文件的 Sync Impact Report、版本與日期。

版本政策遵循 Semantic Versioning：移除或重新定義既有治理義務時增加 MAJOR；新增原則或實質擴大治理要求時增加 MINOR；文字澄清、錯字修正或不改變義務的整理增加 PATCH。每次修訂 MUST 說明版本變更理由。

合規檢查至少在規格完成、Technical Plan 批准、每個主要 phase 驗證及發布前執行。檢查結果 MUST 可追溯至具體原則與驗證證據；若未符合，工作不得標記為完成，除非已記錄並批准正式豁免。

**Version**: 1.0.0 | **Ratified**: 2026-09-12 | **Last Amended**: 2026-09-12
