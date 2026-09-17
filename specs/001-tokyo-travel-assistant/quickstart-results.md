# 東京百科卡片修正驗收紀錄

- date: 2026-09-17
- environment: local Vite / Playwright browser（Windows）
- branch: `fix/knowledge-card-details`
- pre-commit HEAD: `036cf28201a0633fd7a3e9f7b3c8d9c1693e8b00`
- status: 本機驗收 PASS；Preview、真實 TTS 與真正 offline 驗收尚待執行

## Automated Checks

| Command | Result |
|---|---|
| `git diff --check` | PASS |
| `npm test -- src/features/knowledge/KnowledgeJourney.test.tsx` | PASS：1 file、15 tests |
| `npm test` | PASS：23 files、138 tests |
| `npm run build` | PASS：`tsc -b && vite build` |

## Local Encyclopedia Acceptance

六分類均直接呈現靜態內容：區域 11 張、交通 2 張、美食 2 張、購物 2 張、文化 1 張、緊急 1 張。分類切換期間未觀察到 `/api/*` request。

| CSS viewport | 結果 | 已驗證項目 |
|---|---|---|
| 360 x 800 | PASS | 六分類可操作、分類文字與卡片標題/摘要可讀、展開/收合、詳細內容與日文無水平捲動、複製與語音按鈕/touch targets 無重疊、Tab focus indicator 可見、重要內容未受 safe-area 遮擋 |
| 390 x 844 | PASS | 同上 |
| 430 x 932 | PASS | 同上 |
| 844 x 390 | PASS | 同上；橫向頁面可捲動並可完成分類切換與卡片操作 |

## Evidence Boundaries

- Clipboard 成功與拒絕 fallback、可存取狀態、展開/收合、獨立卡片狀態、optional content、鍵盤與 ARIA 由 `KnowledgeJourney.test.tsx` 驗證。
- AudioPlayer UI 已存在且語音失敗時日文文字保持可讀/可複製；未在可用 API 環境實際播放 TTS，因此不宣稱真實 TTS 成功。
- 真正 offline App Shell、離線百科重新載入、離線語音失敗 fallback，以及完整 Preview journey 尚未驗證；T098、T101 維持未完成。
- T091、T099、T100 仍未完成：尚缺該任務要求的空結果與專屬測試檔覆蓋。