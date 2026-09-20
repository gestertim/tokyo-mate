# Tokyo Mate 東京通

Tokyo Mate 東京通是一款陪你在東京旅行的中文小幫手：不需要懂日文，也不需要熟悉東京，就能即時翻譯、詢問旅遊問題、拍照翻譯看不懂的文字，以及探索附近的景點、美食與車站，並直接前往目的地。

## ✨ 主要功能

### 💬 即時翻譯與東京旅遊助手
- 語音或文字輸入，中日文雙向即時翻譯，並可播放語音
- 針對東京旅遊情境的智能問答，包含緊急情況協助（遇事、迷路、醫療、交通等）
- 查詢營業時間、聯絡方式、票價等即時資訊

### 📖 東京旅遊知識庫
- 離線可瀏覽的東京百科知識內容
- 依類別、距離篩選景點、餐廳、車站與緊急設施
- 可複製地址、電話，或查看路線

### 📷 Photo Translate 拍照翻譯
- 拍攝新照片或從相簿選擇既有照片（不會主動要求相機權限）
- 取得照片後，先框選要辨識的文字區域，再進行辨識
- 辨識出的原文可翻譯成繁體中文或日本語，兩者可清楚分辨並隨時切換
- 翻譯完成後可播放對應語言的語音
- 適合菜單、招牌、車站資訊、商品標示等現場文字
- 離開功能或更換照片時，該次照片、原文與翻譯會立即清除，不建立永久照片或翻譯歷史

### 🗺️ Nearby Map & Navigation 探索附近地圖與導航
- 使用目前位置，或手動輸入地區（例如淺草、上野、新宿）探索附近
- 依景點、美食、購物、便利商店、車站等類別篩選
- 搜尋結果同時以 result cards 與地圖呈現，兩者為同一批結果
- 在 card 或地圖上選取地點時，另一側會同步標示同一個 Selected Place
- 對具備可靠位置資訊的地點，可一鍵「前往此地」，交由 Google Maps（HTTPS handoff）接手

> Tokyo Mate 不提供 App 內逐步導航、路線繪製或即時交通資訊，「前往此地」之後的導航行為由 Google Maps 與裝置作業系統負責，也不提供 Street View 或社交／即時位置分享功能。

## 🚀 如何使用

1. 打開 Tokyo Mate，在首頁輸入想說的話，或點選「麥克風」以語音輸入
2. 點選「即時翻譯」或「問東京」，取得翻譯或旅遊建議
3. 點選「探索附近」，尋找附近的景點、美食或車站，並可前往目的地
4. 點選「拍照翻譯」，翻譯看不懂的菜單、招牌或標示
5. 點選「東京百科」，離線瀏覽旅遊知識內容

## 🗺️ Nearby Map 使用方式

1. 進入「探索附近」，選擇「使用我的位置」或手動輸入地區並選擇類別搜尋
2. 在下方 result cards 或上方地圖查看搜尋結果
3. 點選任一張 card 或地圖上的地點，選定同一個地方
4. 對已選定且具備可靠位置資訊的地點，點選「前往此地」
5. 系統會開啟 Google Maps 繼續導航

若目前位置無法取得或地圖暫時無法載入，仍可直接使用 result cards 完成選取與前往此地。

## 📷 Photo Translate 使用方式

1. 進入「拍照翻譯」，選擇「拍攝照片」或「選擇既有照片」
2. 在照片上框選要辨識的文字範圍並確認
3. 系統辨識選取範圍內的文字，顯示 OCR 原文
4. 選擇翻譯目標語言（繁體中文或日本語），查看翻譯結果
5. 點選播放，聽取與翻譯結果相同語言的語音
6. 若辨識或翻譯結果不理想，可重新框選範圍再次辨識，不必重新拍照

## 🛡️ Privacy & Safety

- 麥克風只在使用者主動點選「語音輸入」時才請求權限
- 定位只在使用者選擇「使用我的位置」時才請求權限，也可以改用手動輸入地區
- 相機只在使用者主動選擇「拍攝照片」時才請求權限
- 不建立長期聊天記錄、照片歷史或位置歷史，也不做背景定位追蹤
- 拍照翻譯的照片、原文與翻譯結果只存在於當次任務，離開或更換照片即清除
- 所有 API 金鑰與服務憑證僅存放於 server-side environment variables，不會出現在前端程式碼中

## 🧰 Technology

- React + TypeScript
- Vite
- Leaflet（地圖呈現）
- Geoapify（地圖圖磚）
- Google Places API（附近地點搜尋）
- Google Maps HTTPS handoff（前往此地）
- OpenAI API（翻譯、旅遊問答、OCR、語音）
- Vercel Serverless Functions（後端 API）

## 💻 Local Development

### Prerequisites

- Node.js >= 18
- npm >= 9

### Install dependencies

```bash
npm install
cp .env.example .env.local
```

### Environment variables

依 `.env.example` 在 `.env.local` 設定以下變數名稱（僅本機使用，不會被提交）：

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GOOGLE_PLACES_API_KEY=
VITE_GEOAPIFY_API_KEY=
```

- `OPENAI_API_KEY`、`OPENAI_MODEL`、`GOOGLE_PLACES_API_KEY`：server-side secrets，僅供 `api/` 目錄下的 serverless functions 使用，不會暴露給瀏覽器
- `VITE_GEOAPIFY_API_KEY`：browser-visible 設定，用於前端載入地圖圖磚
- 請勿在任何地方填入真實金鑰後提交至版本控制

### Development server

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Tests

```bash
npm run test
npm run coverage
```

## 🧪 Verification

Tokyo Mate 以 Vitest + React Testing Library 撰寫自動化單元／整合測試，並以 Playwright 進行 PWA 相關驗證，涵蓋主要使用者流程與各功能的成功／失敗情境。詳細驗證紀錄可見於 [docs/verification](docs/verification/)。

## 📁 Project Structure

```
api/            Vercel serverless functions（翻譯、OCR、語音、地點查詢等後端 API）
src/screens/    App 的主要畫面（首頁、助手、探索附近、拍照翻譯、知識庫）
src/features/   各功能的元件與邏輯（emergency、nearby、photo-translate、speech、translation、travel、knowledge）
src/services/   前端與 API 溝通、定位等共用服務
src/data/tokyo/ 東京旅遊知識庫內容
specs/          各功能的規格、計畫與驗收文件
docs/verification/ 驗證報告
```

## 📌 Project Status

Tokyo Mate 目前已整合 Original MVP（即時翻譯、AI 旅遊助手、東京百科知識庫）、Photo Translate 拍照翻譯，以及 Nearby Map & Navigation 探索附近地圖與導航三項功能，持續以 specification-driven development 方式維護與擴充。
