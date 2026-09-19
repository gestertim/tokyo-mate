# 002 Photo Translate｜Phase 13 既有 MVP Regression 驗收紀錄

- date: 2026-09-19
- branch: `002-photo-translate`
- verification environment: local dev（`npm run dev` → Vite dev server，`http://localhost:5174/`）；瀏覽器人工／自動化互動驗證
- local server configuration: `vite.config.ts` 將 `/api` proxy 至 `http://localhost:3000`；repository 未定義 local serverless function host script（既有 baseline limitation，非本次新增）
- baseline tag: `mvp-safe-baseline^{}` = `fb09a41182bcc639a9335adbd0e1f84405a1bba7`（已核對，未被移動）

## Existing MVP Regression

| 項目 | Baseline expectation | Observed result | 結果 |
|---|---|---|---|
| App Shell / Homepage | 品牌、主要輸入區、四個原有入口正常 | TOKYO MATE／東京通品牌正常；「即時翻譯」「問東京」「探索附近」「東京百科」四個原有入口均存在且可操作；新增「拍照翻譯」入口未取代／刪除任何原有入口；返回首頁後五個入口完整重現 | PASS |
| 即時翻譯 | 原有 UI／interaction 可正常進入 | 點擊「即時翻譯」正常進入「東京助手」畫面，可輸入文字並送出；因本機無 serverless host（`ECONNREFUSED` to `localhost:3000`），`/api/assistant` 回傳既有 502，UI 顯示既有「請確認網路連線後再試一次。」錯誤 fallback | LIMITED（既有 local serverless-host limitation，非 002 regression） |
| 問東京 / 即時資訊 | 原有入口與主要 interaction 不受影響 | 「問東京」與「即時翻譯」共用同一 AssistantScreen，行為與上列一致 | LIMITED（同上，既有 baseline limitation） |
| 探索附近 | 原有入口、使用我的位置／輸入地區／manual area flow／categories 正常 | 「探索附近」正常開啟；「使用我的位置」「輸入地區」按鈕存在；手動輸入「新宿」＋切換分類（景點）互動正常，畫面文案正確更新；未觀察到未經使用者操作即發出定位權限請求；`/api/places` 因同一本機 `ECONNREFUSED` 回傳既有 502 | LIMITED（既有 local serverless-host limitation，非 002 regression） |
| 東京百科 | 既有百科入口與主要內容 flow 正常 | 六分類（區域／交通／美食／購物／文化／緊急）均可切換並顯示既有靜態內容，含緊急分類「警察與失物處理」；返回首頁正常 | PASS |
| 緊急協助 / baseline applicable flows | 依既有 baseline 方法確認 | 緊急協助內容屬東京百科「緊急」分類，已於上列一併驗證，內容與行為正常 | PASS |
| Photo Translate coexistence | 開啟／返回不污染既有功能 state；不產生新的 upfront 權限請求 | 開啟「拍照翻譯」僅顯示「拍攝照片」「從相簿選擇」，未自動觸發相機權限（`navigator.permissions.query` camera/geolocation 均維持 `denied`，無瀏覽器提示）；返回首頁後重新開啟「探索附近」重置為預設狀態（無殘留「新宿」查詢）、重新開啟「即時翻譯」輸入框為空（無殘留先前輸入文字），確認各功能 state 互不污染 | PASS |

## Automated Verification

| 檢查 | 結果 |
|---|---|
| `npx vitest run --pool=threads` | PASS：34 files / 290 tests |
| `npx tsc -b` | PASS（無錯誤輸出） |
| `npm run build` | PASS：`tsc -b && vite build` |
| `git diff --check` | PASS（無 whitespace 錯誤） |

## Regression Findings

- regression caused by 002：No
- minimal fixes required：No
- unresolved blocker：No

所有 `/api/assistant`、`/api/places` 502／`ECONNREFUSED` 均對應既有「本機無 documented serverless host（`localhost:3000`）」limitation，於 002 修改前後行為一致，非 002 造成。

## Known Limitations Retained

- 既有 local serverless-host limitation：`npm run dev` 僅啟動 Vite frontend，`/api` proxy 指向 `localhost:3000`，repository 無 package-script-defined local serverless host，故 provider-backed `/api/*` 本機 smoke 出現既有 502／`ECONNREFUSED`
- production-like latency limitation（T087）仍存在，未於本 Phase 重新驗證或宣稱已解決
- PWA deferred items 仍未完成，未於本 Phase 冒充已完成
- physical camera hardware 尚未實機驗證（Phase 12 已知限制，本 Phase 未變更）
- 16×16px region corner handles mobile finger usability observation（Phase 12 已知限制，本 Phase 未變更）

## Traceability

- T042：執行 `npx vitest run --pool=threads` 全數 PASS（34 files / 290 tests）
- T043：完成既有四個入口（即時翻譯／問東京／探索附近／東京百科）人工迴歸，結果如上表，記錄於本檔案
