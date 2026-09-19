# Quickstart: Photo Translate 拍照翻譯 驗證指南

**Feature Branch**: `002-photo-translate`

本指南提供可執行的端到端驗證情境，對應 `spec.md` Acceptance Scenarios 與 Success Criteria；實作細節請見 `data-model.md` 與 `contracts/`。

## 前置條件

- 安裝既有 dependencies：`npm install`
- 開發伺服器：`npm run dev`（Vite + Vercel dev functions）
- 環境變數：既有 `OPENAI_API_KEY`、`OPENAI_MODEL`（沿用 001 設定，無新增變數）
- 測試指令：`npx vitest run --pool=threads`

## 驗證情境（對應 spec.md Acceptance Scenarios / Edge Cases）

1. **首頁入口** — 從首頁點選「拍照翻譯」，確認既有四個入口（即時翻譯／問東京／探索附近／東京百科）仍可正常使用（FR-001）。
2. **不自動要求權限** — 進入功能後，未點擊「拍攝照片」或「從相簿選擇」前，不應觸發任何相機/相簿權限請求（FR-002 / SC-001）。
3. **先選取才 OCR** — 取得照片後必須先出現 Region Selection 畫面；在未按下「確認選取區域」前，不得觸發 `/api/photo-ocr` 請求（FR-003 / SC-002）。
4. **OCR 成功三分區** — 以含日文文字的菜單照片完成選取與確認後，畫面應同時且可分辨地顯示 A 選取影像／B 辨識原文／C 翻譯結果三區（FR-004, FR-006 / SC-003）。
5. **無可靠文字** — 選取模糊或無文字區域，確認後應顯示「沒有辨識到可靠的文字」，保留照片並可重新選取或重新取得照片，且不得產生猜測式原文或翻譯（FR-007, FR-009 / SC-004）。
6. **繁中／日文翻譯與語音** — 針對同一 OCR 原文分別選擇「繁體中文」與「日本語」，各自取得對應翻譯與對應語言語音播放（FR-005, FR-011 / SC-005）。
7. **同語言不產生假翻譯（雙方向）** — 分別以（a）OCR 原文本身已是繁體中文的照片選擇繁體中文為目標，與（b）OCR 原文本身已是日文的照片選擇日本語為目標，確認兩種情況均顯示「原文已是所選語言」提示而非另一份翻譯內容，且均可切換至另一目標語言取得正常翻譯（FR-017 / SC-009）。
8. **target 切換與失敗復原** — 已取得繁體中文翻譯後切換至日本語；模擬 `/api/photo-translate` 呼叫失敗，確認畫面回復顯示切換前最後一次成功的繁體中文結果並提示可重試，不得將舊結果誤標示為新 target 結果（FR-018 / SC-010）。
9. **重新選取區域 stale 處理** — 已有 OCR/翻譯結果時選擇「重新選取區域」，確認畫面立即隱藏舊結果，直到新選取區域完成 OCR 才顯示新內容（FR-016 / SC-011）。
10. **同張照片重新 OCR** — 在同一張照片上重新選取後確認，`/api/photo-ocr` 應以新裁切影像重新請求，不需重新拍照或重新選圖（FR-008）。
11. **各階段失敗與不可用情境的保留與恢復** — 分別模擬相機權限被拒、選擇不支援／無法讀取的照片、OCR 失敗、翻譯失敗、語音播放失敗，確認每種情境均只呈現一般化、使用者可理解的狀態、不顯示 provider 或其他技術性錯誤，並各自提供符合該情境且不要求不必要重新操作的恢復行動（相機權限被拒／不支援照片因尚未取得有效內容，恢復行動為改用相簿或重新拍攝／選圖；OCR／翻譯／語音失敗則保留對應已完成內容如照片／照片＋原文／照片＋原文＋翻譯並提供重試）（FR-010, FR-012, FR-013 / SC-006）。
12. **非日文/非繁中來源語言** — 使用至少 3 組其他語言（例如英文、韓文、泰文標示）的可靠 OCR 原文，確認均可選擇繁體中文或日本語並取得對應翻譯（SC-008）。
13. **Photo Lifecycle** — 按「更換照片」或離開 Photo Translate（返回首頁）後，確認原任務照片、OCR 原文、翻譯結果立即不可再取得，且不存在可瀏覽的照片/OCR/翻譯歷史（FR-014 / SC-007）。
14. **既有 MVP 迴歸** — 完成上述情境後，重新驗證既有 001 核心路徑（即時翻譯、問東京、探索附近、東京百科）行為未受影響。

## 自動化測試對照

| 驗證情境 | 對應測試檔（規劃） |
|---|---|
| 3, 10 | `src/screens/PhotoTranslateScreen.test.tsx`（規劃於 tasks 階段建立） |
| 4, 5, 11（OCR） | `tests/api/photo-ocr.test.ts` |
| 6, 7, 8（翻譯） | `tests/api/photo-translate.test.ts` |
| 9 | `src/features/photo-translate/RegionSelector.test.tsx`（規劃於 tasks 階段建立） |
| 13 | `src/screens/PhotoTranslateScreen.test.tsx`（lifecycle cleanup 案例） |
| 14 | 既有 `src/screens/AssistantScreen.test.tsx`、`tests/api/assistant.*.test.ts` 等既有迴歸測試維持通過 |

測試策略不得斷言特定 provider 回應文字內容，僅斷言 status code、envelope 結構與 UI 可觀察狀態（依使用者原始指示之 Testing 原則）。
