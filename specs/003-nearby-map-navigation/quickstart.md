# Quickstart: Nearby Map & Navigation 驗證指引

本指引用於 implementation 完成後驗證 Feature 003 是否符合 spec.md 的可觀察行為；不包含實作程式碼。

## 前置準備

1. 安裝依賴（實作階段執行）：
   ```powershell
   npm install leaflet
   npm install -D @types/leaflet   # 僅在 TypeScript 型別整合確實需要時
   ```
2. 於本機 `.env`（不進版控）新增：
   ```
   VITE_GEOAPIFY_API_KEY=<開發用 Geoapify key>
   ```
   `.env.example` 需同步新增 `VITE_GEOAPIFY_API_KEY=` 這一行（不含實際值）。
3. 啟動開發伺服器：
   ```powershell
   npm run dev
   ```

## 驗證場景（對應 spec.md Acceptance Scenarios / Success Criteria）

### 1. 地圖理解目前位置搜尋結果（User Story 1）
- 於 Explore Nearby 使用「使用我的位置」搜尋，確認具備可靠座標的結果同時出現在地圖與既有 result cards。
- 對地圖執行 pan／zoom，確認未觸發新的網路請求（可用瀏覽器 DevTools Network 面板確認無新增
  `/api/places` 呼叫）。
- 確認地圖上出現的地點與 result cards 完全一致，無新增或缺漏。

### 2. 選定地點後前往此地（User Story 2）
- 選定一個座標可靠的 result，點擊「前往此地」，確認嘗試開啟 Google Maps HTTPS 連結（新分頁或系統對話框）。
- 對座標不可靠的 result 確認「前往此地」不可用（隱藏或 disabled），且未顯示任何猜測位置。
- 模擬 handoff 失敗（例如封鎖彈跳視窗），確認畫面顯示「交接失敗」而非「搜尋失敗」，且 Selected Place 與
  既有結果不受影響。

### 3. 手動輸入地區（User Story 3）
- 在未授予定位權限的情況下，直接以手動地區搜尋，確認地圖與「前往此地」皆正常運作，且流程未要求目前位置。

### 4. 韌性場景（User Story 4）
- 模擬定位權限被拒絕／取消／逾時，確認既有結果不受破壞，並可切換手動地區完成搜尋。
- 模擬地圖載入失敗（例如封鎖 Geoapify tile 網域），確認 result cards 仍可讀、可操作，可直接完成選取與
  合格情況下的「前往此地」。
- 先從地圖選取地點，確認對應 result card 顯示為目前選定；反向操作（先選卡片）確認地圖 marker 同步反映。
- 完成一次搜尋並有 Selected Place 後，開始新一次搜尋，確認舊地圖內容／舊結果不會被誤認為新搜尋結果，
  Selected Place 隨新搜尋重置。

## 回歸驗證

- 執行既有單元測試：
  ```powershell
  npx vitest run --pool=threads
  ```
- 執行既有 build 確認型別與打包無誤：
  ```powershell
  npm run build
  ```
- 依既有 Playwright regression 設定，確認：
  - Feature 001 MVP（Homepage/App Shell、麥克風、即時翻譯、問東京、探索附近既有行為、東京百科、緊急協助）
    可觀察行為不變。
  - Feature 002 拍照翻譯既有可觀察行為不變。

## 通過標準

以上場景全部通過、既有單元測試與既有 Playwright regression 套件全數通過，且未修改
`specs/001-tokyo-travel-assistant/` 或 `specs/002-photo-translate/` 內容，視為本 quickstart 驗證通過。
