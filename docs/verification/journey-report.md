# Journey Report（Phase 6 automated evidence）

- date: 2026-09-13
- environment: local test/build (Windows, Node v24.19.0)
- commit: 3376307

## Automated Results

| Journey / requirement | 結果 | 證據 |
|---|---|---|
| Journey 0 PWA shell / offline boundary | PARTIAL | manifest、icons、service worker build、NetworkStatus automated tests passed；實際安裝與 offline restart deferred to T089 |
| Journey 1 translation | PASS (regression) | existing translation journey tests included in full suite |
| Journey 2 Knowledge Browser | PASS (regression) | existing knowledge journey tests included in full suite |
| Journey 3 Nearby GPS/manual fallback | PASS (regression) | existing nearby journey and geolocation tests included in full suite |
| Journey 4 live-data status | PASS (regression) | existing live-data contract tests included in full suite |
| Journey 5 emergency priority | PASS (regression) | existing emergency contract and nearby journey tests included in full suite |
| SC-013 update prompt | PASS | `src/components/UpdatePrompt.test.tsx` 3/3 |
| FR-025 accessibility / responsive baseline | PASS (automated subset) | `src/components/AccessibilityAudit.test.tsx` 6/6; manual viewport matrix deferred |
| FR-017 / FR-018 / FR-026 privacy boundary | PASS (automated subset) | `src/service-worker.test.ts` + platform safety gate passed; real browser storage inspection deferred |

## Commands

- `npx vitest run --pool=threads` → 17 test files, 63 tests passed
- `npm run build` → TypeScript and Vite build passed

## Deferred Issues

- Browser/device manual PWA installation, offline restart, Cache Storage inspection, update timing, and four-viewport standalone matrix remain required under T080/T081/T084/T089.

## 2026-09-17 Knowledge Card Repair Preview Evidence

- branch: `fix/knowledge-card-details`
- source commit: `7f8298f759ce56a655539ebe58a1f85aa3a4a9c3`
- Preview: `https://tokyo-mate-f2vnohydr-elonintl21-7498s-projects.vercel.app/`
- deployment: `dpl_CSH2gewA7owezNs8eYEoaeJtkUXg`（target: preview；status: Ready）
- targeted test: `npm test -- src/features/knowledge/KnowledgeJourney.test.tsx` PASS（15/15）
- full test: `npm test` PASS（23 files、138/138）
- build: `npm run build` PASS
- diff hygiene: `git diff --check` PASS
- six-category acceptance: PASS。區域 11、交通 2、美食 2、購物 2、文化 1、緊急 1；切換直接呈現完整靜態資料，未觀察到 AI 或外部 API request，且不影響 AI 問東京 Top 3–5 語意檢索邊界。
- card acceptance: PASS。標題/摘要預設可見，卡片可各自展開/收合；內容依資料存在性呈現，實用日文同時有原文與繁中意思。
- Clipboard: Preview 成功 PASS；Clipboard error fallback 為 automated PASS，Preview not manually simulated。
- TTS: 正常與慢速播放均為人工 PASS；實際聽到音訊，慢速播放確認為較慢日文；`/api/speech` HTTP 200，畫面無錯誤訊息。
- offline: PASS。離線百科文字可讀，未承諾離線語音；語音失敗時文字/複製 fallback 由自動測試 PASS。
- viewport acceptance: 360 x 800、390 x 844、430 x 932、844 x 390 全數 PASS。各尺寸均驗證鍵盤與 ARIA、safe-area、無水平捲動、無控制項重疊或內容裁切；844 x 390 可正常捲動及操作。
- regression smoke: PASS；App Console 無 error。Preview/Vercel 輔助資源警告不視為 App error，兩者分開判讀。
- Production: 未變更 master、Production alias 或 Production deployment。
- remaining: T091、T099、T100 尚缺指定專屬測試檔與空結果覆蓋，維持未完成。詳見 `specs/001-tokyo-travel-assistant/quickstart-results.md`。

## 2026-09-17 Final Test Coverage Gate

- commit 前 HEAD：`e5d82bdadfe88cd35d2757722f8391e13f7d0672`；branch：`fix/knowledge-card-details`。
- `T091` PASS：`src/services/knowledge.test.ts` 確認六分類完整靜態資料、分類限定與穩定順序、未知分類安全性，並確認 `selectKnowledgeEntries` AI Top 3–5 契約未改變；`src/screens/KnowledgeBrowser.test.tsx` 確認百科瀏覽無外部 request。
- `T099` PASS：`src/screens/KnowledgeBrowser.test.tsx` 確認六分類繁中標籤、選取 ARIA、原生鍵盤切換、完整內容與無外部 request。以 Vitest module mock 建立空結果，確認核准空狀態、不渲染卡片/list、分類仍可切換、返回首頁仍可使用且不 crash。
- `T100` PASS：`src/features/knowledge/KnowledgeCard.test.tsx` 確認摘要、展開/收合、鍵盤與 ARIA、optional content、多筆日文、Clipboard success/reject/unavailable、AudioPlayer 正常/慢速控制，以及 TTS 失敗時文字仍可讀；語音服務均 mock。
- focused tests：3 files、10/10 PASS；full suite：25 files、146/146 PASS；`npm run build` PASS；`git diff --check` PASS。
- production boundary：沒有 production source 或 JSON 知識資料變更；未執行 Vercel、未變更 master、保護 tag、Production alias 或 Production deployment。
- traceability：SC-015（T091/T099）、SC-016（T100）、SC-017（T099/T100 加上既有 T101 Preview evidence）；FR-027～FR-030 由此百科卡片驗證 Gate 收斂。
