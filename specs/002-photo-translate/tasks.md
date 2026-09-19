---

description: "Tokyo Mate 東京通｜Photo Translate 拍照翻譯 實作任務清單"
---

# Tasks: Tokyo Mate 東京通｜Photo Translate 拍照翻譯

**Input**: `/specs/002-photo-translate/` 下的設計文件

**Prerequisites**: `plan.md`、`spec.md`（含 Clarifications）、`research.md`、`data-model.md`、`contracts/photo-ocr-api.md`、`contracts/photo-translate-api.md`、`quickstart.md`、`ux-ui-design-handoff.md`、`checklists/photo-translate-readiness.md`（PASS）

**Tests**: 規格要求核心行為、stale-state 保護與失敗恢復均可驗證，因此各 Phase 均包含先寫且先失敗的 Vitest／React Testing Library／contract 測試，再進行對應實作。

**Organization**: 本功能之技術邊界（Region Selection ↔ OCR ↔ Translation ↔ Speech ↔ Lifecycle）彼此依賴順序明確，強行以 User Story 切分會打斷實際 build 順序；故本檔案依**實際 dependency 關係**分為 13 個 Phase（技術層），並於每個 task 標註對應 User Story（US1／US2／US3，來自 spec.md）以維持追溯性。此為經使用者明確核准之組織方式偏離（非預設 User-Story-first 模板）。

## Phase 組織與 User Story 對照說明

| Tasks Phase | 主要對應 User Story | 說明 |
|---|---|---|
| Phase 1 Shared Types / Runtime State Foundation | — | 阻塞所有 Phase 之共用型別，無單一 Story 標籤 |
| Phase 2 Photo Acquisition | US1 | 取得照片，不自動要求權限 |
| Phase 3 Region Selection | US1, US2 | 先選取才 OCR；US2 涵蓋調整選取範圍 |
| Phase 4 OCR Server Boundary | US1 | `/api/photo-ocr` |
| Phase 5 OCR Frontend Integration | US1, US2 | OCR 結果三分區、無可靠文字恢復 |
| Phase 6 Translation Server Boundary | US1, US3 | `/api/photo-translate` |
| Phase 7 Translation Frontend State / Recovery | US1, US3 | target 切換、同語言、失敗復原 |
| Phase 8 Speech Reuse Integration | US3 | reuse 既有 `/api/speech` |
| Phase 9 Homepage Integration | US1 | 首頁第五入口 |
| Phase 10 Error / Privacy Lifecycle | US1, US2, US3（cross-cutting） | 離開/更換照片清除、stale 立即隱藏、錯誤淨化 |
| Phase 11 Automated Tests — Scenario Coverage & OCR Real-World Verification | US1, US2, US3（cross-cutting） | 端到端情境測試＋OCR Guard 實際驗證 |
| Phase 12 Mobile / Touch Verification | US1, US2（cross-cutting） | Region Selection Guard 實機驗證 |
| Phase 13 Existing MVP Regression Verification | — | 001 既有路徑迴歸確認 |

若實際執行順序需微調（例如同一檔案跨 Phase 漸進擴充），已於各 Phase 內以「延伸既有檔案」註記說明，不視為破壞 dependency order。

## Requirement Traceability Matrix

| Requirement ID | 對應 Task ID(s) |
|---|---|
| FR-001 | T029, T030, T042, T043 |
| FR-002 | T003, T004, T029 |
| FR-003 | T007, T008, T009, T010 |
| FR-004 | T011, T013, T014, T015, T017, T018 |
| FR-005 | T019, T021, T022, T023 |
| FR-006 | T014, T015, T022, T023 |
| FR-007 | T011, T013, T019, T021 |
| FR-008 | T009, T010, T017, T018 |
| FR-009 | T014, T015, T017, T018 |
| FR-010 | T022, T023, T025, T026 |
| FR-011 | T027, T028 |
| FR-012 | T027, T028 |
| FR-013 | T031, T032 |
| FR-014 | T031, T032, T039 |
| FR-015 | T011, T013, T019, T021 |
| FR-016 | T009, T010, T017, T018, T031, T032, T035 |
| FR-017 | T019, T021, T022, T023, T036 |
| FR-018 | T022, T023, T025, T026, T037 |
| FR-019 | T007, T008, T009, T010 |
| FR-020 | T022, T023, T025, T026, T037 |
| FR-021 | T027, T028 |
| SC-001 | T003, T004, T029, T033 |
| SC-002 | T007, T008, T040 |
| SC-003 | T014, T015, T022, T023, T033 |
| SC-004 | T014, T015, T034 |
| SC-005 | T027, T028, T033 |
| SC-006 | T003, T004, T031, T032, T038 |
| SC-007 | T031, T032, T039 |
| SC-008 | T019, T021, T040 |
| SC-009 | T019, T021, T036 |
| SC-010 | T025, T026, T037 |
| SC-011 | T009, T010, T035 |
| SC-012 | T025, T026, T037 |
| SC-013 | T027, T028, T037 |

## Critical State Behaviors Coverage

| Critical State Behavior | 對應 Task ID(s) |
|---|---|
| invalid selection 不得觸發 OCR | T007, T008, T009, T010 |
| regionVersion / stale result protection | T009, T010, T017, T018, T031, T032, T035 |
| 重新選取使舊 OCR/翻譯失效 | T009, T010, T017, T018, T031, T032, T035 |
| source 不限，target 僅 zh-TW/ja | T019, T021, T022, T023 |
| no reliable text 不得猜測翻譯 | T011, T013, T014, T015, T019, T021 |
| same-language 不製造假翻譯 | T019, T021, T022, T023, T036 |
| target 切換使用既有 OCR 原文 | T022, T023, T025, T026 |
| target-switch failure with fallback | T025, T026, T037 |
| target-switch failure without fallback | T025, T026, T037 |
| selectedTarget 與 displayed.target 分離 | T022, T023, T025, T026 |
| Speech 依 displayed target 而非 selectedTarget | T027, T028 |
| 翻譯失敗保留可恢復內容 | T022, T023, T031, T032 |
| 語音失敗保留翻譯結果 | T027, T028 |
| 更換照片清除舊 task | T031, T032, T039 |
| 離開 Photo Translate 清除 task | T031, T032, T039 |
| camera/photo 僅由明確 user action 觸發 | T003, T004, T029 |

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 可平行執行，因為使用不同檔案且不依賴尚未完成的任務
- **[Story]**: 對應 `spec.md` 的 User Story（US1／US2／US3）；純基礎設施或 cross-cutting task 不標註
- 每項任務均包含明確檔案路徑

## Path Conventions

- React 前端位於 `src/`；本功能新增於 `src/features/photo-translate/`、`src/screens/PhotoTranslateScreen.tsx`、`src/types/photoTranslate.ts`
- Vercel Serverless Functions 位於 `api/`；本功能新增 `api/photo-ocr.ts`、`api/photo-translate.ts`、`api/_lib/prompts/photo-ocr.ts`、`api/_lib/prompts/photo-translate.ts`
- API 測試位於 `tests/api/`；前端測試與被測程式相鄰，使用 `*.test.ts` 或 `*.test.tsx`
- 驗證報告位於 `docs/verification/`

---

## Phase 1: Shared Types / Runtime State Foundation

**Purpose**: 建立 `PhotoTranslateTaskState` 及子狀態型別（依 `data-model.md`），阻塞所有後續 Phase。

- [ ] T001 [P] 撰寫 `regionVersion` stale 比對與 `selectedTarget`／`displayed.target` 分離不變式之單元測試於 src/types/photoTranslate.test.ts
- [ ] T002 [P] 依 data-model.md 定義 `PhotoTranslateTaskState`、`PhotoTranslatePhase`、`OcrState`、`TranslationState`、`SpeechState` 型別及 stale-check 純函式於 src/types/photoTranslate.ts

**Run**：`npx vitest run src/types/photoTranslate.test.ts`
**Verify**：確認型別編譯通過、stale-check 純函式測試涵蓋「舊 regionVersion」「相同 regionVersion」「selectedTarget≠displayed.target」情境。
**Fix**：僅修正本 Phase 型別定義或測試，重新 Run/Verify。
**Evidence**：記錄測試通過結果。

---

## Phase 2: Photo Acquisition

**Goal**: 使用者可主動拍攝或選取照片，且不自動要求任何權限（FR-002／SC-001）。

- [ ] T003 [P] [US1] 撰寫 PhotoAcquisitionPanel 測試：掛載時不觸發任何權限、「拍攝照片」使用 `capture="environment"` file input、「從相簿選擇」使用無 `capture` file input、拍攝/選圖取消停留原狀態不顯示錯誤、相機權限被拒時顯示一般化可恢復訊息（可改用相簿照片）、不支援/無法讀取照片顯示可恢復訊息於 src/features/photo-translate/PhotoAcquisitionPanel.test.tsx
- [ ] T004 [US1] 實作 PhotoAcquisitionPanel（拍攝照片／從相簿選擇兩個 action，相機被拒／取消／不支援照片狀態）依 ux-ui-design-handoff.md §2 於 src/features/photo-translate/PhotoAcquisitionPanel.tsx
- [ ] T005 [P] [US1] 撰寫 PhotoTranslateScreen 初始測試：預設 phase 為 `acquisition` 並渲染 PhotoAcquisitionPanel，取得照片後轉為 `region_selection` 於 src/screens/PhotoTranslateScreen.test.tsx
- [ ] T006 [US1] 建立 PhotoTranslateScreen 初始容器：持有 `PhotoTranslateTaskState`（初始 phase=`acquisition`），渲染 PhotoAcquisitionPanel，取得照片後轉場至 `region_selection` 於 src/screens/PhotoTranslateScreen.tsx

**Run**：`npx vitest run src/features/photo-translate/PhotoAcquisitionPanel.test.tsx src/screens/PhotoTranslateScreen.test.tsx`
**Verify**：確認掛載時無 `getUserMedia`/权限 API 呼叫；取消/不支援照片情境均不顯示技術錯誤字樣。
**Fix**：僅修正本 Phase 檔案，重新 Run/Verify。
**Evidence**：記錄測試通過結果與人工確認「掛載未觸發權限」之檢視紀錄。

---

## Phase 3: Region Selection

**Goal**: 使用者必須先框選有效範圍並確認，才可進入 OCR；可在同張照片重新選取（FR-003／FR-008／FR-019／SC-002）。

- [ ] T007 [P] [US1] 撰寫 RegionSelector 測試：Pointer 事件建立/調整矩形選取框、零面積或未拖曳選取時「確認選取區域」保持 disabled、鍵盤方向鍵微調、確認後以 canvas 產生裁切影像於 src/features/photo-translate/RegionSelector.test.tsx
- [ ] T008 [US1] 實作 RegionSelector：Pointer Events 拖曳/調整控點、鍵盤微調、canvas 裁切輸出、有效選取守門（非零面積才可確認）依 research.md §2／data-model.md 於 src/features/photo-translate/RegionSelector.tsx
- [ ] T009 [P] [US1] [US2] 延伸 PhotoTranslateScreen 測試：`region_selection` 渲染 RegionSelector、確認選取觸發 `regionVersion++` 並轉場至 `ocr_processing`、無效選取不得觸發轉場、「更換照片」回到 `acquisition` 並清除既有 photo/region/ocr/translation/speech 於 src/screens/PhotoTranslateScreen.test.tsx
- [ ] T010 [US1] [US2] 延伸 PhotoTranslateScreen：`region_selection` phase 渲染 RegionSelector，確認選取遞增 `regionVersion` 並轉場 `ocr_processing`；「更換照片」action 重置整個 task 於 src/screens/PhotoTranslateScreen.tsx

**Run**：`npx vitest run src/features/photo-translate/RegionSelector.test.tsx src/screens/PhotoTranslateScreen.test.tsx`
**Verify**：確認未拖曳出有效範圍時無法觸發 OCR（FR-019）；「更換照片」清除先前狀態且不殘留舊選取框。
**Fix**：僅修正本 Phase 檔案，重新 Run/Verify。
**Evidence**：記錄測試通過結果。

---

## Phase 4: OCR Server Boundary

**Goal**: `POST /api/photo-ocr` 依既有 OpenAI Responses API vision 能力辨識裁切影像，回傳可靠原文或無可靠文字狀態，且不持久化（FR-004／FR-007／FR-015）。

- [ ] T011 [P] [US1] 撰寫 `/api/photo-ocr` contract 測試：MIME 白名單拒絕、超過大小上限拒絕、`regionVersion` 缺漏/型別錯誤拒絕、`reliableTextFound:true` 成功並原樣回傳 `regionVersion`、`reliableTextFound:false` 不含 `sourceText`、provider 失敗回傳一般化 `ProductError`（不含 OpenAI 原始錯誤）、不寫入任何儲存體於 tests/api/photo-ocr.test.ts
- [ ] T012 [P] [US1] 撰寫 OCR 指令樣板，要求模型只回傳結構化 `{reliableTextFound, sourceText?}` 且明確禁止猜測性內容於 api/_lib/prompts/photo-ocr.ts
- [ ] T013 [US1] 實作 `POST /api/photo-ocr`：驗證 `imageDataUrl` MIME／大小、`regionVersion` 型別，呼叫既有 `createOpenAIClient`／`getOpenAIModel` 之 `client.responses.create` 搭配 `input_image`，對應 success/failure envelope 於 api/photo-ocr.ts

**Run**：`npx vitest run tests/api/photo-ocr.test.ts`
**Verify**：確認所有 400/500 錯誤訊息為一般化文案、無 OpenAI 原始錯誤外流；確認 `reliableTextFound:false` 時 `sourceText` 欄位不存在。
**Fix**：僅修正本 Phase 檔案，重新 Run/Verify。
**Evidence**：記錄測試通過結果。

---

## Phase 5: OCR Frontend Integration

**Goal**: 前端呼叫 `/api/photo-ocr` 並以三分區其中 A/B 呈現結果，含 stale 保護與無可靠文字恢復路徑（FR-004／FR-006／FR-009／FR-016）。

- [ ] T014 [P] [US1] 撰寫 OcrResultPanel 測試：processing／success／no_reliable_text／failure 四狀態渲染、各狀態對應恢復 action（重新選取區域／重新拍攝／重新選擇照片／重試辨識）於 src/features/photo-translate/OcrResultPanel.test.tsx
- [ ] T015 [US1] 實作 OcrResultPanel：A（選取影像縮圖）／B（辨識原文）分區與四狀態、恢復 action 依 ux-ui-design-handoff.md §4 於 src/features/photo-translate/OcrResultPanel.tsx
- [ ] T016 [P] [US1] 於 src/services/api.ts 新增 `requestPhotoOcr(imageDataUrl, regionVersion)` 型別化 fetch wrapper（不修改既有匯出）
- [ ] T017 [US1] [US2] 延伸 PhotoTranslateScreen 測試：進入 `ocr_processing` 呼叫 `requestPhotoOcr`、依回應設定 OcrState 並渲染 OcrResultPanel、僅顯示 `ocr.forRegionVersion === task.regionVersion` 之結果（stale 保護）、各恢復 action 正確轉場於 src/screens/PhotoTranslateScreen.test.tsx
- [ ] T018 [US1] [US2] 延伸 PhotoTranslateScreen：呼叫 `requestPhotoOcr`、管理 `OcrState`（含 stale 保護）、渲染 OcrResultPanel、串接恢復 action 於 src/screens/PhotoTranslateScreen.tsx

**Run**：`npx vitest run src/features/photo-translate/OcrResultPanel.test.tsx src/screens/PhotoTranslateScreen.test.tsx`
**Verify**：確認舊 regionVersion 之 OCR 結果不會顯示；無可靠文字時不產生猜測內容且保留照片。
**Fix**：僅修正本 Phase 檔案，重新 Run/Verify。
**Evidence**：記錄測試通過結果。

---

## Phase 6: Translation Server Boundary

**Goal**: `POST /api/photo-translate` 將既有 OCR 原文譯為使用者選擇之 zh-TW／ja，同語言時不產生假翻譯，且不持久化（FR-005／FR-017／FR-018／FR-020）。

- [ ] T019 [P] [US1] [US3] 撰寫 `/api/photo-translate` contract 測試：`targetLanguage` 僅接受 `zh-TW`／`ja`（其餘拒絕）、`sourceText` 空字串/超長拒絕、`sameLanguage:true` 時不含 `translatedText`、一般翻譯成功回應、provider 失敗回傳一般化 `ProductError`、不寫入任何儲存體於 tests/api/photo-translate.test.ts
- [ ] T020 [P] [US3] 撰寫翻譯指令樣板，要求判斷同語言並依 Constitution VIII 產出自然繁體中文／日文語氣於 api/_lib/prompts/photo-translate.ts
- [ ] T021 [US1] [US3] 實作 `POST /api/photo-translate`：驗證 `sourceText`／`targetLanguage`，呼叫既有 OpenAI Responses API，回應 `{sameLanguage, translatedText?, targetLanguage}` 對應 success/failure envelope 於 api/photo-translate.ts

**Run**：`npx vitest run tests/api/photo-translate.test.ts`
**Verify**：確認 `targetLanguage` 白名單以外一律 400；`sameLanguage:true` 回應不含 `translatedText`。
**Fix**：僅修正本 Phase 檔案，重新 Run/Verify。
**Evidence**：記錄測試通過結果。

---

## Phase 7: Translation Frontend State / Recovery

**Goal**: 前端管理 target 選擇、同語言提示、切換 target 之重新翻譯與失敗復原，並區分 `selectedTarget` 與 `displayed.target`（FR-005／FR-006／FR-010／FR-017／FR-018／FR-020）。

- [ ] T022 [P] [US3] 撰寫 TranslationPanel 測試：僅提供 zh-TW／ja 兩個 target 按鈕、`same_language` 狀態顯示提示與切換另一目標之 action、失敗狀態保留照片/OCR 原文並提供「重新嘗試翻譯」於 src/features/photo-translate/TranslationPanel.test.tsx
- [ ] T023 [US1] [US3] 實作 TranslationPanel：target 切換按鈕、translating/success/same_language/failure 狀態，`displayed.target` 與 `selectedTarget` 不一致時之視覺區分依 ux-ui-design-handoff.md §5–6 於 src/features/photo-translate/TranslationPanel.tsx
- [ ] T024 [P] [US3] 於 src/services/api.ts 新增 `requestPhotoTranslate(sourceText, targetLanguage)` 型別化 fetch wrapper（不修改既有匯出）
- [ ] T025 [US3] 延伸 PhotoTranslateScreen 測試：切換 target 以既有 OCR 原文重新請求（不沿用舊翻譯）；切換失敗且切換前已有成功結果時，`displayed` 維持切換前最後一次成功結果並可重試；切換失敗且切換前無任何成功結果時，`displayed` 維持 `undefined` 且不顯示任何翻譯內容，僅保留照片/選取區域/OCR 原文並可重試於 src/screens/PhotoTranslateScreen.test.tsx
- [ ] T026 [US3] 延伸 PhotoTranslateScreen：實作 `TranslationState` 切換規則（target 切換重新請求、失敗回復最後成功結果、無前次成功結果時之失敗狀態）依 data-model.md §3 於 src/screens/PhotoTranslateScreen.tsx

**Run**：`npx vitest run src/features/photo-translate/TranslationPanel.test.tsx src/screens/PhotoTranslateScreen.test.tsx`
**Verify**：確認切換 target 一律重新呼叫 `/api/photo-translate`；`selectedTarget` 與 `displayed.target` 不一致時使用者可分辨。
**Fix**：僅修正本 Phase 檔案，重新 Run/Verify。
**Evidence**：記錄測試通過結果。

---

## Phase 8: Speech Reuse Integration

**Goal**: reuse 既有 `/api/speech` 與 `AudioPlayer`，播放語言必須對應 `displayed.target` 而非 `selectedTarget`（FR-011／FR-012／FR-021）。

- [ ] T027 [P] [US3] 延伸 TranslationPanel 測試：語音播放語言恆等於 `translation.displayed.target`（非 `selectedTarget`）；語音失敗保留翻譯結果並可重新嘗試播放（不重新翻譯/不重新 OCR）於 src/features/photo-translate/TranslationPanel.test.tsx
- [ ] T028 [US3] 於 TranslationPanel 內接入既有 `AudioPlayer`（src/components/AudioPlayer.tsx，不修改），以 `translation.displayed.target` 作為 `language` prop，不新增 speech endpoint 或元件於 src/features/photo-translate/TranslationPanel.tsx

**Run**：`npx vitest run src/features/photo-translate/TranslationPanel.test.tsx`
**Verify**：確認切換 target 失敗回復顯示前次結果時，播放語言與畫面實際顯示之翻譯語言一致，不隨 `selectedTarget` 錯置。
**Fix**：僅修正本 Phase 檔案，重新 Run/Verify。
**Evidence**：記錄測試通過結果。

---

## Phase 9: Homepage Integration

**Goal**: 「拍照翻譯」以第五個入口加入既有首頁，不影響既有四個入口（FR-001）。

- [ ] T029 [P] [US1] 撰寫/延伸 HomeScreen 測試：新增「拍照翻譯」入口不自動觸發相機/相簿權限、既有「即時翻譯」「問東京」「探索附近」「東京百科」四個入口與行為不變於 src/screens/HomeScreen.test.tsx
- [ ] T030 [US1] 於 `nav[aria-label="東京功能入口"]` 新增「拍照翻譯」入口與 `photoTranslateOpen` state，渲染 PhotoTranslateScreen，不變動既有四個入口於 src/screens/HomeScreen.tsx

**Run**：`npx vitest run src/screens/HomeScreen.test.tsx`
**Verify**：確認既有四個入口之既有測試（若有）與行為未受影響。
**Fix**：僅修正本 Phase 檔案，重新 Run/Verify。
**Evidence**：記錄測試通過結果。

---

## Phase 10: Error / Privacy Lifecycle

**Goal**: 更換照片或離開 Photo Translate 立即清除當次 task；重新選取立即隱藏舊結果；所有失敗訊息淨化（FR-013／FR-014／FR-016）。

- [ ] T031 [P] 延伸 PhotoTranslateScreen 測試：「更換照片」清除 photo/region/ocr/translation/speech 並 revoke object URLs；元件卸載（離開功能）觸發相同清除；「重新選取區域」在確認新選取框前立即隱藏舊 ocr/translation（不得殘留顯示）；所有錯誤訊息不含 provider 名稱/stack trace 於 src/screens/PhotoTranslateScreen.test.tsx
- [ ] T032 強化 PhotoTranslateScreen：`useEffect` cleanup 於卸載與更換照片時 revoke object URLs 並重置 state、重新選取立即標記 stale 並隱藏（不待新選取確認才隱藏）、統一 `ProductError` 淨化呈現於 src/screens/PhotoTranslateScreen.tsx

**Run**：`npx vitest run src/screens/PhotoTranslateScreen.test.tsx`
**Verify**：確認 object URL 於卸載/更換照片後即被 revoke（可用 spy 驗證 `URL.revokeObjectURL` 呼叫次數與時機）；重新選取時舊結果於同一互動內即消失。
**Fix**：僅修正本 Phase 檔案，重新 Run/Verify。
**Evidence**：記錄測試通過結果。

---

## Phase 11: Automated Tests — Scenario Coverage & OCR Real-World Verification

**Purpose**: 補齊跨元件端到端情境（對照 quickstart.md 驗證情境），並執行 OCR Guard 要求之代表性旅行圖片實際驗證（不建立 provider benchmark）。

- [ ] T033 撰寫端到端測試：照片→區域選取→OCR 成功→zh-TW 翻譯→ja 翻譯→語音播放（quickstart 情境 4, 6）於 src/screens/PhotoTranslateScreen.test.tsx（延伸；與 T034–T039 修改同一檔案，須依序執行，不得平行）
- [ ] T034 撰寫端到端測試：無可靠文字→同張照片重新選取重新 OCR（quickstart 情境 5, 10）於 src/screens/PhotoTranslateScreen.test.tsx（延伸；依賴 T033 已完成之擴充，序列執行）
- [ ] T035 撰寫端到端測試：重新選取立即隱藏舊結果→新選取完成 OCR 才顯示新內容（quickstart 情境 9）於 src/screens/PhotoTranslateScreen.test.tsx（延伸；依賴 T034 已完成之擴充，序列執行）
- [ ] T036 撰寫端到端測試：同語言不產生假翻譯→切換另一目標取得正常翻譯（quickstart 情境 7）於 src/screens/PhotoTranslateScreen.test.tsx（延伸；依賴 T035 已完成之擴充，序列執行）
- [ ] T037 撰寫端到端測試：target 切換失敗回復前次成功結果（含播放語言對應）與切換前無前次成功結果之失敗狀態（quickstart 情境 8）於 src/screens/PhotoTranslateScreen.test.tsx（延伸；依賴 T036 已完成之擴充，序列執行）
- [ ] T038 撰寫端到端測試：OCR／翻譯／語音個別失敗之內容保留與對應重試 action、不顯示技術性錯誤（quickstart 情境 11）於 src/screens/PhotoTranslateScreen.test.tsx（延伸；依賴 T037 已完成之擴充，序列執行）
- [ ] T039 撰寫端到端測試：更換照片與離開功能之 Photo Lifecycle 清除（quickstart 情境 13）於 src/screens/PhotoTranslateScreen.test.tsx（延伸；依賴 T038 已完成之擴充，序列執行）
- [ ] T040 執行 OCR 實際能力驗證：以代表性旅行圖片（菜單、招牌、車站資訊、商品標示、小型文字區域、較複雜文字排列、非日文／非繁中來源文字，對應 quickstart 情境 12／SC-008）驗證產品行為與 recovery，不建立 provider-specific benchmark；若實際能力不足須 **STOP** 並標記 **REQUIRES USER APPROVAL**（不得自行加入第二 OCR provider），結果記錄於 docs/verification/photo-translate-ocr-report.md

**Run**：`npx vitest run --pool=threads`
**Verify**：確認 T033–T039 涵蓋 quickstart.md 全部 14 項驗證情境（既有 001 迴歸另於 Phase 13 確認）；T040 依實際圖片驗證結果誠實記錄 PASS/FAIL，不得虛報。
**Fix**：僅修正本 Phase 相關測試或既有實作缺陷，重新 Run/Verify；若 T040 判定能力不足，STOP 並回報，不自行修正為新增 provider。
**Evidence**：測試輸出、docs/verification/photo-translate-ocr-report.md。

---

## Phase 12: Mobile / Touch Verification（Region Selection Guard）

**Purpose**: 依批准 Plan（Pointer Events + Canvas 自建 RegionSelector），在實際 mobile/touch 裝置驗證可用性。

- [ ] T041 執行手機/觸控實機驗證：selection 建立、selection 調整、touch interaction、image scaling／coordinate mapping 準確性、narrow viewport 可用性，涵蓋至少一款代表性窄螢幕手機視角；若自建方案無法以合理複雜度可靠滿足需求，須 **STOP** 並標記 **REQUIRES USER APPROVAL**（不得自行安裝 `react-image-crop` 或其他 dependency），結果記錄於 docs/verification/photo-translate-region-selection-report.md

**Run**：於實機或裝置模擬環境操作 RegionSelector。
**Verify**：確認選取框建立/調整在觸控下可靠、座標換算正確對應原圖像素、窄螢幕下主要 action 仍可觸及。
**Fix**：若為程式邏輯缺陷，回到 Phase 3 修正 RegionSelector 後重新驗證；若判定架構層級不足，STOP 並回報，不自行安裝新 dependency。
**Evidence**：docs/verification/photo-translate-region-selection-report.md。

---

## Phase 13: Existing MVP Regression Verification

**Purpose**: 確認 002 變更未影響既有 001 MVP 核心路徑（FR-001）。

- [ ] T042 執行既有完整自動化測試套件確認全數通過：`npx vitest run --pool=threads`
- [ ] T043 執行 quickstart.md 情境 14 人工迴歸：確認既有「即時翻譯」「問東京」「探索附近」「東京百科」行為未受影響，結果記錄於 docs/verification/photo-translate-mvp-regression-report.md

**Run**：`npx vitest run --pool=threads`；人工操作既有四個入口。
**Verify**：既有測試全數 PASS；既有 001 quickstart-results.md 所載行為未劣化。
**Fix**：若發現 002 造成既有行為劣化，回到對應 Phase 修正，不得修改 001 既有 specification/plan/UX 資產本身。
**Evidence**：測試輸出、docs/verification/photo-translate-mvp-regression-report.md。

---

## Dependencies & Execution Order

- Phase 1 阻塞所有後續 Phase（共用型別）。
- Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8：嚴格依技術邊界順序（後者依賴前者之元件/endpoint/state）。
- Phase 9（Homepage Integration）依賴 Phase 2–8 已使 `PhotoTranslateScreen` 具備完整可運作流程。
- Phase 10（Error/Privacy Lifecycle）依賴 Phase 2–9 全部狀態轉換已存在，才能對其加固清除/淨化邏輯。
- Phase 11（Automated Tests & OCR Verification）依賴 Phase 1–10 全部完成；Phase 11 內 T033–T039 均修改同一檔案 `src/screens/PhotoTranslateScreen.test.tsx`，須依 T033→T034→T035→T036→T037→T038→T039 順序序列擴充，不得平行；T040 依賴 T033–T039 完成後之實際功能行為方可驗證。
- Phase 12（Mobile/Touch Verification）依賴 Phase 3（RegionSelector）完成，可與 Phase 11 平行執行。
- Phase 13（MVP Regression）建議於 Phase 11／12 之後執行，作為批准前最後確認。

## Parallel Execution Examples

- Phase 1：T001、T002 可平行（測試與型別定義為不同檔案，但建議先完成 T002 型別後 T001 測試才可通過）。
- Phase 4：T011、T012 可平行（測試與 prompt 樣板為不同檔案），T013 需待兩者存在後實作。
- Phase 6：T019、T020 可平行，T021 需待兩者存在後實作。
- Phase 11：T033–T039 均明確指定修改同一檔案 `src/screens/PhotoTranslateScreen.test.tsx`（延伸），依 tasks.md 自身「不同檔案才可平行」之定義，**均不得標示 [P]**，須依 T033→T034→T035→T036→T037→T038→T039 順序序列擴充，以避免同檔案漸進修改互相覆蓋或合併衝突。

## Implementation Strategy

- **核心可用流程（US1 對應 Phase 1–6, 9）**：完成後即可從首頁進入拍照翻譯，完成拍攝/選圖→選取區域→OCR→取得繁體中文或日文翻譯，對應 spec.md User Story 1（P1）。
- **修正與復原（US2／US3 對應 Phase 3, 5, 7, 8, 10）**：疊加重新選取、target 切換復原、語音播放與各階段失敗保留內容，對應 User Story 2（P2）與 User Story 3（P2）。
- **驗證收斂（Phase 11–13）**：批准 `/speckit.implement` 前，需完成自動化情境測試、OCR 實際能力驗證、Region Selection 觸控驗證與既有 001 迴歸確認；任一 STOP／REQUIRES USER APPROVAL 條件觸發時，暫停並回報，不自行擴大 provider/dependency 範圍。

---

**本檔案僅產生 executable tasks，非 implementation 授權。實作須待使用者明確批准 `/speckit.implement` 並完成 `/speckit.analyze` 與 Implementation Readiness Gate。**
