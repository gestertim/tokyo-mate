# Photo Translate｜Phase 12 Mobile / Touch Verification Report（T041）

- 執行日期：2026-09-19
- 驗證對象：`RegionSelector`（Pointer Events + Canvas 自建方案）與 `PhotoTranslateScreen` 的 region selection 生命週期
- 驗證方式：**真實 touch input 派送**（Chrome DevTools Protocol `Input.dispatchTouchEvent`，非滑鼠模擬），非僅 jsdom / unit test / desktop mouse 模擬

## Environment

- 裝置環境：VS Code 內建 Chromium 瀏覽器（無實體行動裝置），透過 CDP 直接派送 touch 事件
- Browser：Chromium（VS Code 整合瀏覽器）
- Viewport：要求 390×844（iPhone 12 尺寸），實際受限於整合瀏覽器視窗高度，最終渲染為 390×676（寬度符合窄螢幕手機情境；高度受限已於下方以捲動驗證涵蓋）
- 實際 touch input：Yes（`pointerType: 'touch'` 已透過事件監聽確認，非 `mouse`）
- 實體 camera 驗證：No — 沙盒環境無法安全存取實體相機硬體，依規定明確標記 **LIMITED**，未虛構 PASS
- 測試素材：`public/icons/icon-512.png`（natural 512×512 px，實際渲染 display 288×288 px，滿足「display size ≠ natural image size」情境要求）
- 後端：本地 `vite dev`（僅前端），OCR API 以 Playwright route 攔截回傳受控假資料驗證 UI 生命週期（不驗證 OCR 辨識品質，OCR 實際能力已於 Phase 11 T040 以真實 API 驗證）

## Region Selection Verification

| 項目 | 結果 | Evidence |
|---|---|---|
| Photo acquisition | PASS（相機 LIMITED） | 進入功能不會自動查詢/請求 camera 權限；「拍攝照片」「從相簿選擇」皆須明確點擊才觸發（相簿選擇以真實 file chooser 驗證成功載入圖片）。相機權限查詢僅發生在按下「拍攝照片」當下（程式邏輯確認），實體相機硬體因沙盒環境無法驗證，標記 LIMITED |
| Initial touch selection | PASS | CDP 派送 touchStart/touchMove/touchEnd，`pointerType` 確認為 `touch`；拖曳後 selection rectangle 依 touch 座標即時變化，放開後保留（rect 元素 boundingBox 與拖曳終點座標一致） |
| Resize handles | PASS | 對 `se` corner handle 派送 touch 拖曳，rect 由 180×165 放大為 222×227，左上角固定不變，無反向/負值產生，`確認選取區域` 全程維持可用 |
| Coordinate correctness | PASS | natural 512×512 vs display 288×288（scale ≈1.778x）情境下，rect 顯示座標（display px）與 touch 拖曳終點座標完全一致，驗證 display→natural→display 座標換算往返正確 |
| Valid / invalid region | PASS | 零面積（單點觸控無拖曳）時「確認選取區域」維持 disabled 且顯示引導文字，不觸發 OCR；有效區域時按鈕啟用並可觸發後續流程 |
| Crop correctness | PASS | 有效區域確認後正確產生裁切預覽圖（`已選取的照片區域` img 顯示），並進入 OCR 呼叫流程 |
| Reselection | PASS | 從既有 OCR 結果（`no_reliable_text` 與 `success` 兩種狀態皆測試）點擊「重新選取區域」，UI 立即（同步）隱藏舊結果並回到 region_selection，原始照片保留；以 touch 重新拖曳選取後確認，`regionVersion` 正確由 1 遞增為 2，新 OCR 結果（新文字）正確顯示，舊結果不復現 |
| Back / recovery | PASS | 重新選取後若未確認新選取（僅離開/更換照片），舊 OCR/翻譯結果不會恢復顯示；「更換照片」以 touch 觸發後正確返回取得照片畫面且無自動請求相機權限，可安全繼續操作 |
| Scroll / touch conflict | PASS | 對 region-selector-surface 派送較大幅度垂直 touch 拖曳（268px），`window.scrollY` 拖曳前後皆為 0，未被 page scroll 搶走；`touchAction: 'none'` 有效阻止瀏覽器手勢衝突；pointer lifecycle（down/move/up）穩定，無需額外 pointer capture 即維持正確行為 |
| 回應式版面 | PASS | 390px 寬窄螢幕下 selector surface 未錯位，圖片與選取框對齊正確 |
| 基本可用性／accessibility | LIMITED | 整體 flow 在 390×676 視窗下可完整操作；但部分下方操作按鈕（如「更換照片」「重新選取區域」於結果畫面）在較短視窗高度下需捲動才能觸及（頁面可捲動，非裁切阻擋，功能仍可完成）；四角控點為 16×16px 圓形按鈕，小於一般建議之 44×44px 觸控目標，本次以精確座標派送 touch 皆操作成功，但實機手指操作之精確度風險無法於此環境完全排除，列為觀察項目而非失敗項目 |

## T041 Guard

- Pointer Events + Canvas sufficient：**Yes**
- crop dependency required：**No**
- T041 completed：**Yes**

## Changes

- production code modified：**No**
- dependency change：No
- architecture change：No
- contract change：No
- Specification change：No
- privacy behavior change：No
- 001 modified：No

## Notes / Follow-up（非阻斷，僅供未來參考，未經批准不得自行修改）

- 四角控點觸控目標尺寸（16×16px）與部分結果畫面操作按鈕於短視窗下需捲動觸及，未達失敗門檻，若未來需要改善需另行提出並經批准。
