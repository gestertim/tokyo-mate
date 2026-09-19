# Phase 0 Research: Photo Translate 拍照翻譯

**Feature Branch**: `002-photo-translate`

本研究僅解決 Technical Context 中的技術選型，不重複或改寫 `spec.md` 之產品需求。

---

## 1. Photo Acquisition（拍照／選圖）

- **Decision**: 使用原生 `<input type="file" accept="image/*" capture="environment">` 觸發相機拍攝，另一顆按鈕使用 `<input type="file" accept="image/*">`（無 `capture`）觸發系統相簿/檔案選擇；兩者皆為使用者主動點擊後才觸發，符合 FR-002「不得自動要求相機權限」。
- **Rationale**: 瀏覽器原生能力已足夠、零新增依賴、行為完全由使用者手勢觸發，與 UX/UI Handoff 第 2 節「僅在按下對應按鈕才觸發相機/相簿權限」一致。
- **Alternatives considered**: `MediaDevices.getUserMedia` 自建即時相機預覽 — 拒絕，因需求僅為「拍一張照片」而非即時相機 UI，屬非必要複雜度且與 Out of Scope「即時相機 AR 翻譯」相近。

## 2. Region Selection（選取框）

- **Decision**: 自建 `RegionSelector` React 元件，使用 Pointer Events（`onPointerDown/Move/Up`）在 `<img>` 上疊加可拖曳矩形選取框（含四角/四邊控點），並以鍵盤方向鍵支援微調（符合 UX/UI Handoff 第 12 節無障礙需求）；確認後以離屏 `<canvas>` 依選取矩形（依顯示尺寸換算回原圖像素座標）繪出裁切結果並 `canvas.toBlob()` 產生裁切影像，全程僅使用瀏覽器原生 Canvas／Pointer Events API。
- **Rationale**: 需求是單一矩形區域選取（非多層影像編輯），Pointer Events + Canvas 已可完整達成含觸控、拖曳調整、鍵盤操作與影像裁切輸出；符合 Constitution II「能以較簡單方案滿足需求時 MUST 採用較簡單方案」與「reuse before adding」，**不需要新增 frontend dependency**。
- **Alternatives considered**:
  - `react-image-crop`（成熟、小型、支援觸控、無自身相依套件）— 評估後認定非必要；若實作階段發現自建元件在特定裝置/瀏覽器的觸控手勢相容性有重大缺陷，可作為最小、成熟、touch-friendly 的候補方案重新提出，**屆時仍須先取得使用者批准才可安裝**。
  - `react-easy-crop`（偏向頭像式縮放裁切，功能多於本需求）— 拒絕，超出「矩形區域選取」的最小需求，且不完全對應「先選取才 OCR」的單次確認流程。
  - 大型影像編輯 framework（如 Fabric.js、Konva）— 明確拒絕，違反使用者指示「不得為 crop 功能加入大型 image editor framework」。

## 3. OCR Strategy（辨識原文）

- **Decision**: 新增 `POST /api/photo-ocr`，reuse 既有 `api/_lib/openai.ts`（`createOpenAIClient` / `getOpenAIModel`）與既有 `client.responses.create` 呼叫模式（與 `api/assistant.ts` 相同技術路徑），將裁切後影像以 `input_image`（base64 data URL）内容區塊與文字指令一併送入既有 OpenAI Responses API，要求模型只回傳「是否有可靠可辨識文字」與「原文（若有）」的結構化 JSON。
- **Rationale**: 既有 `OPENAI_MODEL`（預設 `gpt-4o-mini`）本身具備 vision 輸入能力，屬於既有 provider／既有 SDK 的既有能力延伸，不需新增第二 OCR provider、不需新增 SDK 依賴，完全符合「優先評估現有 OpenAI capability 是否足夠」與「reuse 避免第二個 OCR provider」的原則。
- **Alternatives considered**: 專屬 OCR provider（例如 Google Cloud Vision、Azure Document Intelligence）— 拒絕，因既有 OpenAI vision 能力已可處理菜單、招牌、車站資訊、商品標示等短篇文字辨識需求，不存在需求缺口；若未來驗收發現既有能力對特定情境（例如密集直排文字）明顯不足，需以 Dependency/Architecture Decision Report 中定義的格式重新提出並標記 `REQUIRES USER APPROVAL`。

## 4. Translation Strategy（翻譯）

- **Decision**: 新增 `POST /api/photo-translate`，同樣 reuse `api/_lib/openai.ts` 與 `client.responses.create`，輸入為既有 OCR 原文（任何來源語言）＋使用者選擇的目標語言（`zh-TW` 或 `ja`），輸出結構化 JSON：`{ sameLanguage: boolean, translatedText?: string }`。
- **Rationale**: 與既有 `api/assistant.ts` 的雙向 zh-TW↔ja 翻譯行為（自動判斷對向目標）不同，本功能需求是「任意可辨識來源語言 → 使用者明確選擇的目標語言，且可能與來源語言相同」，兩者屬不同輸入/輸出契約；為避免修改既有 001 已批准的 `assistant` contract，改以獨立新 endpoint 承載，符合「minimum architecture change」與 Repository Safety（不擾動既有 001 行為）。
- **Alternatives considered**: 擴充既有 `/api/assistant.ts` 的 translation route 以支援任意來源語言與同語言偵測 — 拒絕，因會改變既有已批准 001 `AssistantResult` 契約語意（`sourceLanguage: 'zh-TW' | 'ja' | 'other'` 與自動對向 target 邏輯），風險與必要性皆高於新增一個小型獨立 endpoint。

## 5. Speech Strategy（語音播放）

- **Decision**: 完全 reuse 既有 `POST /api/speech`（無程式碼變更），前端以既有 `generateSpeech({ text, language, speed })` 呼叫，`language` 對應 `zh-TW`／`ja`。
- **Rationale**: 既有 endpoint 的輸入介面已與本功能需求（zh-TW 播中文、ja 播日文）完全一致，無需求缺口，不需新增第二個 speech provider。
- **Alternatives considered**: 無；未發現 requirement gap。

## 6. Runtime State Strategy（狀態管理）

- **Decision**: 以單一 `PhotoTranslateScreen` 容器持有 `PhotoTranslateTaskState`（見 `data-model.md`），透過 React `useState`/`useReducer` 管理，不引入 Redux/Zustand/Context 全域狀態庫。
- **Rationale**: 狀態範圍限定於單一畫面之單一當次任務（session-only），與既有 001「僅真正跨區域共享狀態使用 Context，無 Redux/Zustand」原則一致；跨組件資料流僅為 props down / callback up，複雜度可控。
- **Alternatives considered**: 全域 Context 或狀態庫 — 拒絕，無跨畫面共享需求。

## 7. Validation & Privacy Boundaries

- **Decision**: 服務端對每個新 endpoint 執行下列驗證，並沿用既有 `api/_lib/http.ts` 的 `success()/failure()` envelope 與 `ProductError` 格式：
  - `photo-ocr`：驗證 payload 為合法 data URL、MIME 屬於 `image/jpeg`／`image/png`／`image/webp`、解碼後位元組數不超過上限（建議與既有 `transcribe.ts` 之 10MB 量級一致，實際數值於 tasks 階段依裁切後影像實測調整）。
  - `photo-translate`：驗證 `sourceText` 為非空字串且長度有上限、`targetLanguage` 僅接受 `'zh-TW' | 'ja'`。
  - 兩者皆不將影像或文字寫入任何儲存體，僅於單次 request 記憶體中處理，與既有 `speech.ts`／`transcribe.ts` 的 stateless 模式一致；provider 錯誤一律轉換為一般化 `ProductError`，不得外流原始錯誤訊息。
- **Rationale**: 沿用既有 server boundary 慣例，滿足 FR-014／FR-015 與 Constitution VI。
