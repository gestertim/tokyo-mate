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