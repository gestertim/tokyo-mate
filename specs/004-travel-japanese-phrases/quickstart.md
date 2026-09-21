# Quickstart: Travel Japanese 驗證指引

本指引用於 implementation 完成後驗證 Feature 004 是否符合 spec.md 的可觀察行為；不包含實作程式碼。

## 前置準備

無需新增依賴、無需新增環境變數。

```powershell
npm run dev
```

## 驗證場景（對應 spec.md Acceptance Scenarios / Success Criteria）

### 1. 情境瀏覽與句子卡（User Story 1）

- 進入「旅遊日文」，確認可看到 7 個正式情境（機場、飯店、餐廳點餐、購物、交通、求助／緊急狀況、
  日常溝通）。
- 進入任一情境，確認至少 20 筆句子卡，且每張同時顯示日文、繁中翻譯與播放操作。
- 確認同一句子若出現在多個情境（例如「カードで払えますか？」出現在餐廳點餐與購物），其日文／繁中／
  收藏狀態一致，非各自獨立內容。

### 2. 語音播放與單一 active playback（User Story 2）

- 對句子 A 觸發播放，確認可觀察到「已要求播放」→「播放中」狀態轉換。
- 於句子 A 播放中對句子 B 觸發播放，確認句子 A 的播放停止、句子 B 開始播放，同一時間僅一句處於
  active playback。
- 於裝置／瀏覽器停用或模擬 Speech Synthesis 不可用時，確認播放按鈕呈現不可用但有說明文字，其餘功能
  （文字、搜尋、分類、收藏）不受影響。
- 觸發播放後立即切換情境或離開 Feature，確認播放不會殘留於背景繼續佔用 active playback。

### 3. 搜尋（User Story 3）

- 輸入部分繁體中文關鍵字，確認符合的正式句子出現在結果中。
- 輸入部分日文關鍵字，確認符合的正式句子出現在結果中。
- 確認搜尋結果可直接播放、收藏，不需進入額外詳細頁面。
- 輸入無符合內容的關鍵字，確認顯示可理解空白狀態，且未出現任何非 dataset 的句子。

### 4. 收藏常用句（User Story 4）

- 對任一句子收藏，進入「我的常用句」確認出現；取消收藏後確認自「我的常用句」移除。
- 在情境 A 收藏某句子後，於搜尋結果或情境 B 中查看同一句子，確認顯示為已收藏。
- 重新整理頁面（模擬重開 App），確認先前收藏的句子仍在「我的常用句」中。
- 尚未收藏任何句子時進入「我的常用句」，確認顯示空白狀態並提供回到瀏覽或搜尋的路徑。

### 5. 求助／緊急狀況與安全提醒（User Story 5）

- 進入「求助／緊急狀況」情境，確認 5 秒內可辨識出至少一個 safety-critical 句子（例如排列在清單前段、
  具圖示＋文字標示）。
- 確認 safety-critical 標示不僅依賴顏色（例如以黑白截圖或色盲模擬工具檢視，仍可辨識）。
- 確認進入該情境時，畫面上**直接可見**安全提醒文字，不需點擊「更多資訊」或其他額外操作。
- 查看醫療／過敏相關句子，確認呈現方式未暗示翻譯必然準確、醫療診斷已完成、緊急服務必定成功，或食品
  安全已確認。

## Dataset 驗證

```powershell
npx vitest run src/services/travelJapanese.test.ts
```

確認測試涵蓋：7 情境存在、unique phrase >= 100、總 placements >= 140、每情境 placements >= 20、id
唯一、日文／繁中非空、category 合法引用、無重複內容灌注 unique 數。

## 回歸驗證

```powershell
npx vitest run
npm run build
npm run test:pwa-red-gate
```

確認：

- Feature 001（MVP）、Feature 002（拍照翻譯）、Feature 003（Nearby Map & Navigation）既有可觀察行為
  與既有自動化測試維持通過。
- 既有 PWA 行為（App Shell、offline fallback、update prompt）不受影響。

## 通過標準

以上場景全部通過、既有單元測試與既有 Playwright regression 套件全數通過，且未修改
`specs/001-tokyo-travel-assistant/`、`specs/002-photo-translate/`、`specs/003-nearby-map-navigation/`
內容，視為本 quickstart 驗證通過。
