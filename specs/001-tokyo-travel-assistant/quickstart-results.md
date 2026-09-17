# 東京百科卡片修正驗收紀錄

- date: 2026-09-17
- environment: Vercel Preview / browser（Windows）
- branch: `fix/knowledge-card-details`
- source commit: `7f8298f759ce56a655539ebe58a1f85aa3a4a9c3`
- Preview: `https://tokyo-mate-f2vnohydr-elonintl21-7498s-projects.vercel.app/`
- deployment: `dpl_CSH2gewA7owezNs8eYEoaeJtkUXg`
- target / status: preview / Ready
- status: Preview Acceptance Gate PASS；Production 未變更。

## Automated Checks

| Command | Result |
|---|---|
| `git diff --check` | PASS |
| `npm test -- src/features/knowledge/KnowledgeJourney.test.tsx` | PASS：1 file、15/15 tests |
| `npm test` | PASS：23 files、138/138 tests |
| `npm run build` | PASS：`tsc -b && vite build` |

## Preview Encyclopedia Acceptance

六分類均直接呈現完整靜態內容：區域 11 張、交通 2 張、美食 2 張、購物 2 張、文化 1 張、緊急 1 張。分類切換期間未觀察到 AI 或外部 API request；AI 問東京的 Top 3–5 語意檢索邊界未受影響。

| CSS viewport | 結果 | 已驗證項目 |
|---|---|---|
| 360 x 800 | PASS | 六分類可操作、分類文字與卡片標題/摘要可讀、展開/收合、詳細內容與日文無水平捲動、複製與語音按鈕/touch targets 無重疊、Tab focus indicator 可見、重要內容未受 safe-area 遮擋 |
| 390 x 844 | PASS | 同上 |
| 430 x 932 | PASS | 同上 |
| 844 x 390 | PASS | 同上；橫向頁面可捲動並可完成分類切換與卡片操作 |

## Interaction And Fallback Evidence

- Clipboard 成功：Preview PASS。
- Clipboard error fallback：automated PASS；Preview not manually simulated。
- 正常語音與慢速語音：Preview 人工 PASS；實際聽到音訊，慢速播放確認為較慢的日文。
- `/api/speech`：HTTP 200；畫面無錯誤訊息，App Console 無 error。
- Offline：Preview PASS；百科文字可讀，不承諾離線語音。
- 展開/收合、獨立卡片狀態、optional content、鍵盤與 ARIA：Preview PASS，並由 `KnowledgeJourney.test.tsx` 驗證。
- Regression smoke：PASS。

## Evidence Boundaries

- Preview 輔助資源/Vercel 警告與 App error 分開判讀；本次無 App Console error。
- 語音或 Clipboard 失敗時保留日文原文、繁中意思與複製路徑的 fallback 由自動測試驗證；不將 Clipboard error fallback 宣稱為 Preview 人工 PASS。
- T091、T099、T100 維持未完成：仍缺各自要求的專屬測試檔及空結果覆蓋。
- Production alias、master 與 Production deployment 均未變更。

## 2026-09-17 Final Test Coverage Gate

- commit 前 HEAD：`e5d82bdadfe88cd35d2757722f8391e13f7d0672`
- scope：僅新增測試與更新 evidence；沒有 production source、JSON 知識資料、部署或 Production alias 變更。
- `T091`：`src/services/knowledge.test.ts` 驗證六分類完整靜態 catalog、指定分類、穩定順序、未知分類安全性，並確認 AI `selectKnowledgeEntries` 維持 Top 3–5 契約；`src/screens/KnowledgeBrowser.test.tsx` 驗證畫面不發出 request。
- `T099`：`src/screens/KnowledgeBrowser.test.tsx` 驗證六個繁體中文分類、`aria-pressed`、原生 Enter 操作、完整分類切換及無外部 request。以 Vitest module mock 讓目前分類回傳空陣列，驗證「目前沒有符合內容。」、不渲染卡片或 list、仍可切換分類與返回首頁，且不 crash。
- `T100`：`src/features/knowledge/KnowledgeCard.test.tsx` 驗證預設摘要、展開/收合、`aria-expanded`、`aria-controls`、optional 欄位、多筆實用日文、Clipboard success/reject/unavailable，以及正常/慢速 AudioPlayer controls 與語音失敗後文字 fallback；所有語音均 mock，未使用真實網路。
- commands：`npm test -- src/services/knowledge.test.ts src/screens/KnowledgeBrowser.test.tsx src/features/knowledge/KnowledgeCard.test.tsx` PASS（3 files、10/10）；`npm test` PASS（25 files、146/146）；`npm run build` PASS；`git diff --check` PASS。
- traceability：FR-027～FR-030 依本 Gate 的 encyclopedia card 行為驗證收斂；SC-015 由 T091/T099、SC-016 由 T100、SC-017 由 T099/T100 與既有 T101 Preview evidence 覆蓋。