# Quickstart Validation Guide: Tokyo Mate 東京通

**Feature Branch**: `001-tokyo-travel-assistant`  
**Date**: 2026-09-12  
**Status**: Draft  

---

## 概述

本指南提供開發者與 QA 驗證 Tokyo Mate 東京通完整功能與驗收條件的獨立驗證流程。
涵蓋開發環境設定、單元/組件測試執行，以及三大 User Story 的手動 Journeys 驗證情境。

---

## 1. 環境設定 (Setup)

### 1.1 前置需求
- Node.js >= 18.0.0
- npm >= 9.0.0

### 1.2 安裝與設定 `.env.local`
於專案根目錄複製範本並填入測試用 API Keys：

```bash
cp .env.example .env.local
```

`.env.local` 內容：
```env
OPENAI_API_KEY=sk-proj-your-openai-key-here
GOOGLE_PLACES_API_KEY=AIzaSy-your-google-places-key-here
OPENAI_MODEL=gpt-4o-mini
```

*注意：.env.local 已設定於 .gitignore 中，切勿提交至 Git。*

### 1.3 啟動開發伺服器
```bash
npm run dev
```
啟動後於瀏覽器開啟 `http://localhost:5173`。

---

## 2. 自動化測試驗證 (Automated Testing)

執行單元測試與組件測試：
```bash
# 執行所有測試
npm run test

# 執行特定功能測試 (如 API response mapping)
npx vitest run src/services/assistant.test.ts
```

驗證涵蓋範圍：
- Intent 分類與 Request Mapping
- 經緯度與邊界 Validation
- 地理位置拒絕 fallback 邏輯
- 雙語回應結構 mapping (`AssistantResult`)
- 錯誤狀態 (`ProductError`) 轉換

---

## 3. 手動驗證情境 (Runnable Validation Journeys)

### Journey 0: PWA 安裝、離線啟動與網路恢復

#### 步驟：
1. 使用支援安裝的行動瀏覽器開啟首頁，確認瀏覽器提供安裝或加入主畫面入口；完成安裝後從主畫面啟動。
2. **驗證點**：
   - App 可直接進入首頁，不要求登入、位置或麥克風權限。
   - 獨立啟動時主要輸入、四個入口與品牌識別仍可使用，且不被瀏覽器工具列或安全區域遮蔽。
3. 在仍有網路時開啟一次東京百科中的穩定內容，再關閉網路並重新啟動已安裝 App。
4. **驗證點**：
   - 基本介面與已提供的穩定內容可讀取。
   - 翻譯、AI 問答、語音、附近搜尋與即時資料功能清楚顯示需要連線，不顯示假成功結果。
   - 畫面提供重新連線或重試的下一步。
5. 恢復網路後重試一次翻譯或問東京。
6. **驗證點**：
   - 網路狀態更新為可連線，功能可正常送出。
   - 不需重新安裝或清除 App 資料，失敗中的請求不會被誤當成成功。
7. 發布一個可辨識的新版本，回到已開啟的 App。
8. **驗證點**：
   - 更新提示不會強制打斷正在查看的翻譯結果或緊急指引。
   - 使用者完成目前任務後可更新並重新啟動；更新失敗時仍可使用原有版本。

### Journey 1: 中日雙向即時翻譯與語調切換 (User Story 1 / P1)

#### 步驟：
1. 開啟首頁，直接在通用輸入框輸入中文：「我想點一份不辣的牛丼，麻煩幫我點一份」，按下送出。
2. **驗證點**：
   - 系統自動判定為 `translation` 意圖，無需手動切換語系。
   - 主要顯示自然日文：「辛くない牛丼を1つお願いします。」字體清晰適合展示給店員看。
   - 提供「播放語音」、「慢速播放」、「更禮貌」、「更口語」、「複製」按鈕。
3. 點擊「更禮貌」。
   - **驗證點**：日文更新為更正式禮貌用語（如：「恐れ入りますが、辛くない牛丼を1ついただけますでしょうか。」）。
4. 點擊「播放語音」與「慢速播放」。
   - **驗證點**：聽到正確日文語音朗讀，且慢速播放語速明顯減慢（0.75x）。
5. 點擊麥克風按鈕進行語音輸入，故意講錯：「我想去……淺草寺」。
   - **驗證點**：顯示辨識文字框，允許手動編輯修改文字後再送出翻譯。
6. 測試麥克風權限封鎖（於瀏覽器設定拒絕麥克風）。
   - **驗證點**：顯示「已關閉麥克風權限，您仍可使用文字輸入完成翻譯」，畫面不崩潰。

---

### Journey 2: 東京 AI 私人導遊與 Knowledge Base 檢索 (User Story 2 / P1)

#### 步驟：
1. 於首頁輸入框輸入：「我今天下午想去淺草和上野，怎麼安排比較省時？」
2. **驗證點**：
   - AI 回傳版型依序為：**結論/建議順序** → **交通方式** → **注意事項** → **實用日文**。
   - 不會優先輸出冗長歷史百科介紹。
3. 輸入問答：「新宿站怎麼轉乘最簡單？」
   - **驗證點**：精確命中 `transport.json` 知識庫，提供轉乘關鍵指標與省時建議。
4. 輸入問答：「有沒有適合素食者的拉麵或餐飲推薦？」
   - **驗證點**：辨識飲食限制並給出明確素食選項與日文聲明（「素食（ベジタリアン）」）。

---

### Journey 3: 探索附近與手動地區 Fallback (User Story 3 / P2)

#### 步驟：
1. 點擊首頁「探索附近」入口。
2. 初始畫面顯示「使用我的位置」與「輸入地區」兩大選項（未主動跳出 GPS 彈窗）。
3. 點擊「使用我的位置」並授權地理位置。
   - **驗證點**：顯示當前位置周邊景點、拉麵、便利商店卡片，含距離與營業狀態標示。
4. 清除授權（模擬拒絕位置權限）並點擊「探索附近」。
   - **驗證點**：平滑退回「輸入地區」模式，輸入「淺草」後正常展示淺草周邊熱門地點卡片。

---

### Journey 4: 時間敏感即時資料狀態 (User Story 3 / P2)

#### 步驟：
1. 輸入：「澀谷 Stream 今天的營業時間到幾點？」
2. **驗證點**：
   - 觸發即時資料比對 (`liveDataStatus`)。
   - 顯示狀態標籤：`verified`（已確認）或 `uncertain`（資料不確定）。
   - 當狀態為 `uncertain` 時，提示：「營業時間可能因國定假日調整，建議出發前確認」，並提供後續建議步驟，不捏造虛假事實。

---

### Journey 5: 緊急狀況處理 (User Story 3 / Emergency)

#### 步驟：
1. 輸入：「我剛剛在電車上遺失了護照，該怎麼辦？」
2. **驗證點**：
   - 觸發 `safety: 'emergency'`（`emergency: true`）與 `freshness: 'live_required'` 模式。
   - 介面自動隱藏一般景點、美食推薦等無關操作。
   - 呈現區塊：**1. 現在先做 (immediateAction)**（報案/駐日代表處）、**2. 接著 (nextAction)**（準備大頭照）、**3. 可以直接說的日文 (phrase)**、**4. 重要提醒與緊急電話 (importantNotice)**。

---

## 4. 驗收標準專項驗證 (Specific Acceptance Criteria Verification)

### 4.1 SC-002 端到端 Latency 驗收
- **測試 dataset**：`tests/fixtures/latency-cases.json`（包含 30+ 個固定可重複測試案例）
- **驗收結果輸出**：`docs/verification/latency-report.md`（記錄 date、environment、commit、case id、category、latency milliseconds、pass/fail、p50、p95、maximum、failed/outlier cases）
- **測試環境**：Vercel Preview 或等效 production-like environment
- **網路條件**：正常穩定網路
- **樣本規模**：32 次代表性互動（包含中文→日文翻譯 10 次、日文→中文翻譯 10 次、一般東京旅遊問答 12 次）
- **量測方式**：
  1. 起點：Client 端使用者點擊送出或提交文字。
  2. 終點：主要答案內容已 render 於畫面且使用者可見。
  3. 包含 client、網路傳輸、serverless function、AI provider、response parsing 與 UI render，但不含使用者輸入時間。
   4. 使用 nearest-rank percentile convention；N = 32 時，p95 = sorted latency value #31。計算並如實記錄 p50、p95、maximum 與 outliers，作為 Final MVP performance baseline；p95 <= 5.0 秒不是 MVP blocking acceptance criterion。
   5. 若預期等待超過 1 秒，必須在 1 秒內顯示 processing/loading 狀態；processing/loading <= 1 second 為 blocking acceptance requirement。
   6. Web search、Google Places、語音轉錄 (Whisper STT) 與語音合成 (TTS) 不計入完整 response latency baseline，其耗時獨立記錄。
   7. 不得新增 Analytics/APM platform 或改變既有架構。

### 4.2 FR-017 / SC-009 Session Retention & Privacy 驗證
- **測試步驟**：
  1. 完成 Journey 1～5 所有代表性操作（翻譯、問答、語音、定位探索、緊急求助）。
  2. 開啟瀏覽器 DevTools -> Application 面板。
  3. 依序檢查 `LocalStorage`、`IndexedDB`、`Cache Storage`。
- **驗證點**：
  - `LocalStorage`：無任何對話紀錄、翻譯文字、經緯度座標或語音資料。
  - `IndexedDB`：無任何對話資料庫或歷史記錄。
  - `Cache Storage`：僅包含白名單內之靜態 App Shell、frontend assets 與靜態 Knowledge Base JSON，絕無 `/api/*` 回應、AI 對話或使用者資料。
  - 重新整理 (Reload) 頁面後，暫存的互動狀態完全重設。

### 4.3 FR-020 台灣繁中代表性詞彙 QA 驗證
驗證介面文案、靜態 Knowledge Base 與 AI 產出內容均遵循台灣繁體中文用語：
- 計程車（不使用「出租車」）
- 飯店（不以「酒店」作一般住宿用語）
- 行動電源（不使用「充電寶」）
- 便利商店（不使用「便利店」）
- 網路（不使用「網絡」）
