# Tokyo Mate 東京通｜002 Photo Translate 拍照翻譯 UX/UI Design Handoff

本文件以已批准的 `specs/002-photo-translate/spec.md` 為 Product Truth。任何與 Specification 衝突的內容一律以 Specification 為準；本文件不得覆寫或修改 001 UX/UI Handoff。

## UX 原則（沿用既有產品方向）

- mobile-first
- action-first
- immediate-use
- low cognitive load
- graceful failure
- privacy by explicit user action

---

## 1｜Homepage Integration

「拍照翻譯」以第五個主要入口的形式加入既有首頁 `nav[aria-label="東京功能入口"]`，與既有「即時翻譯」「問東京」「探索附近」「東京百科」並列，不重新設計首頁版面、不移除或取代既有入口。

入口文字採「拍照翻譯」，並可搭配簡短輔助說明（例如按鈕下方或 `aria-label` 補充「拍照或選圖翻譯文字」），讓使用者清楚理解這是「照片文字翻譯」而非一般拍照或即時翻譯功能。

點選入口只會進入 Photo Translate 的 Photo Acquisition 狀態，不會自動要求相機權限、不會自動開啟相機或相簿。

此列為既有 FR-001 的具體化，不新增 Product Behavior，**不需要 SPEC SYNC**。

---

## 2｜Photo Acquisition（初始狀態）

進入 Photo Translate 後，畫面僅顯示兩個明確 action，不預先請求任何權限：

- 「拍攝照片」
- 「從相簿選擇」

狀態定義：

| 狀態 | 畫面內容 | 後續行動 |
|---|---|---|
| 初始（未取得照片） | 兩個 action 按鈕、簡短說明「拍照或選一張含文字的照片」 | 選擇拍攝或選圖 |
| 相機權限被拒 | 一般人可理解訊息，例如「無法使用相機，你可以改用相簿照片」，不呈現系統技術錯誤 | 提供「從相簿選擇」與「再試一次」 |
| 使用者取消拍照 | 停留在初始狀態，不顯示錯誤 | 可重新選擇拍攝或選圖 |
| 使用者取消選圖 | 停留在初始狀態，不顯示錯誤 | 可重新選擇拍攝或選圖 |
| 不支援／無法讀取的照片 | 說明「這張照片無法使用，請重新拍攝或選擇其他照片」 | 提供重新拍攝或重新選圖 |

僅在使用者按下「拍攝照片」時才觸發相機權限請求；按下「從相簿選擇」時才觸發相簿存取，兩者互不影響彼此狀態。

---

## 3｜Region Selection

取得照片後，直接進入 Region Selection，尚未進行任何 OCR。畫面結構：

- 照片預覽（全寬顯示，可縮放/平移以利選取）
- 可調整的選取框（矩形，具備拖曳調整邊界與位置的控點）
- 主要 action：「確認選取區域」（僅在選取範圍有效，即面積大於最小可辨識門檻時可觸發；無效時呈現 disabled 並附文字提示「請框選要辨識的文字範圍」；有效選取才可確認對應 FR-019，具體門檻數值屬本 UX／實作驗證範疇，非 Specification 數值需求）
- 次要 action：「更換照片」（回到 Photo Acquisition，並依 Photo Lifecycle 規則清除上一張照片內容）
- 「返回」（回到 Photo Acquisition 的初始狀態）

初始選取框不得預設為整張照片；系統可提供一個小於整張照片的建議框作為起點，但使用者仍須按下「確認選取區域」才會進入 OCR，不允許在未經確認前直接以整張照片觸發 OCR。

---

## 4｜OCR Processing / Result

確認選取區域後的狀態：

| 狀態 | 畫面內容 |
|---|---|
| ready for OCR | 顯示選取區域縮圖與「辨識中即將開始」的過渡提示 |
| OCR processing | 顯示處理中指示（非純顏色，含文字「正在辨識文字…」） |
| OCR success | 顯示三個清楚分區（見下） |
| no reliable text | 顯示「沒有辨識到可靠的文字」，保留照片，提供「重新選取區域」「重新拍攝」「重新選擇照片」 |
| OCR failure | 顯示一般化錯誤訊息與「重試辨識」，保留照片與選取區域 |

OCR success 後畫面固定分為三區並各有清楚標題：

**A. 選取的照片區域** — 顯示使用者確認的裁切縮圖（唯讀）。

**B. 辨識原文（OCR）** — 顯示標題「辨識原文」，內容為 OCR 文字，不做任何語言轉換。

**C. 翻譯結果** — 顯示標題「翻譯結果」；在尚未選擇目標語言或尚未完成翻譯前，此區呈現明確的「尚未產生翻譯」狀態文字（例如「請選擇繁體中文或日本語以取得翻譯」），不得留白讓使用者誤以為 B 區內容就是翻譯。

---

## 5｜Translation Target UX

翻譯結果區上方提供兩個目標語言按鈕：「繁體中文」「日本語」（互斥單選，無其他選項）。此處只選擇「翻譯要輸出成什麼語言」，與 OCR 自動判斷的來源語言無關，介面不呈現、也不要求使用者確認來源語言。

**同語言情形**：當可靠 OCR 原文本身已與使用者所選目標語言相同時，系統不得產生或顯示另一份「假翻譯」。翻譯結果區改為顯示同語言提示狀態，例如：「辨識原文已是繁體中文，不需另外翻譯」，並提供切換至另一個目標語言（日本語）的按鈕；使用者切換後才觸發正常翻譯流程。

> **SPEC SYNC：完成** — 同語言不產生假翻譯並提供切換另一目標之行為已回寫 `spec.md` FR-017。

---

## 6｜Translation

翻譯狀態定義：

| 狀態 | 畫面內容 |
|---|---|
| ready | 顯示「尚未產生翻譯」與目標語言選擇 |
| translating | 顯示「翻譯中…」，B 區辨識原文維持顯示不變 |
| success | 顯示翻譯結果文字，並提供播放語音 action |
| failure | 顯示一般化錯誤訊息，保留照片、選取區域與 B 區辨識原文，提供「重新嘗試翻譯」 |
| retry | 使用者按下「重新嘗試翻譯」後直接以既有 OCR 原文重新請求翻譯，不需重新取得照片或重新 OCR |
| switching target | 使用者切換至另一個目標語言時，系統以既有 OCR 原文自動重新請求該目標語言的翻譯 |

**切換 target 時既有翻譯結果的處理**：切換目標語言後，畫面立即進入 translating 狀態；先前目標語言的翻譯內容不得繼續顯示並被誤認為新目標語言的結果（可隱藏或以「翻譯中」覆蓋呈現）。新目標翻譯成功後取代顯示；若新目標翻譯失敗，回復顯示切換前最後一次成功的翻譯結果，並標示「切換翻譯失敗，可重試」。若切換前尚無任何成功翻譯結果（例如切換後首次翻譯即失敗），新目標翻譯失敗時畫面須顯示翻譯失敗狀態，不得顯示任何不存在的翻譯內容，僅保留照片、選取區域與 OCR 原文並提供重新嘗試（對應 FR-020）。

> **SPEC SYNC：完成** — 切換目標語言之重新翻譯、避免沿用舊目標內容誤導、失敗復原前次成功結果並可重試、以及無前次成功結果時不得顯示不存在翻譯內容等行為，已回寫 `spec.md` FR-018 與 FR-020。

---

## 7｜Speech

翻譯成功後，翻譯結果區下方提供「播放語音」action。狀態：

| 狀態 | 畫面內容 |
|---|---|
| speech ready | 顯示「播放語音」按鈕 |
| playing | 顯示播放中狀態（例如按鈕變為「播放中」並提供停止） |
| completed | 回復為可再次播放的狀態 |
| failure | 顯示一般化錯誤訊息，保留照片、選取區域、OCR 原文與翻譯結果，提供「重新嘗試播放」 |
| retry | 使用者按「重新嘗試播放」直接重新播放，不需重新翻譯或重新 OCR |

播放語言固定對應畫面目前實際顯示之成功翻譯結果的目標語言（即使用者最後看到的翻譯內容所屬語言），而非使用者當下選擇但尚未成功套用的目標語言；兩者僅在切換目標語言失敗、畫面回復顯示切換前最後一次成功結果時可能不同，此時語音仍必須對應目前顯示之結果，不另外提供語言選擇（對應 FR-021）。

---

## 8｜Same-photo Recovery（重新選取區域）

在 OCR 結果或翻譯結果畫面提供「重新選取區域」action。選擇後：

1. 保留 original photo（不清除、不要求重新取得照片）。
2. 立即將目前顯示的 OCR 原文與翻譯結果標示為失效並隱藏（不在畫面上繼續呈現），回到 Region Selection，避免使用者將舊結果誤認為新選取範圍的結果。
3. 使用者可在同一張照片上建立新的選取框。
4. 使用者確認新選取區域後，重新觸發 OCR，並依第 4 節流程產生全新的 OCR 原文與翻譯結果。
5. 使用者若在建立新選取框前按下「返回」而未確認新選取，維持照片保留、但不恢復先前已隱藏的舊 OCR／翻譯結果；需重新選取並確認後才會有新結果。

> **SPEC SYNC：完成** — 重新選取區域後立即標示並隱藏舊 OCR 原文與翻譯結果之行為已回寫 `spec.md` FR-016。

---

## 9｜Photo Lifecycle / Privacy UX

- 同一 Photo Translate 任務內（同一張照片，含重新選取區域的情形），保留 original photo、選取區域、OCR 原文與翻譯結果，以支援上述 recovery 行為。
- 使用者按「更換照片」或以任何方式離開 Photo Translate（返回首頁、切換其他入口、關閉頁面）時，立即清除當次原照片、選取區域、OCR 原文與翻譯結果。
- 不建立 history screen、帳號、雲端照片庫、最近照片清單或背景上傳；重新進入 Photo Translate 一律回到 Photo Acquisition 初始狀態。

此為既有 Specification 行為的具體化，**不需要額外 SPEC SYNC**。

---

## 10｜Error / Recovery Matrix

| 情境 | 使用者看到什麼 | 保留內容 | Recovery Action | 是否回到前一步 |
|---|---|---|---|---|
| Camera permission denied | 一般化訊息：「無法使用相機，你可以改用相簿照片」 | 無（尚未取得照片） | 「從相簿選擇」「再試一次」 | 否，停留 Photo Acquisition |
| Photo capture cancel | 停留原畫面，無錯誤訊息 | 無 | 可重新拍攝或選圖 | 否 |
| Photo selection cancel | 停留原畫面，無錯誤訊息 | 無 | 可重新拍攝或選圖 | 否 |
| Unsupported/unreadable photo | 「這張照片無法使用，請重新拍攝或選擇其他照片」 | 無（該照片不採用） | 重新拍攝或重新選圖 | 否，停留 Photo Acquisition |
| OCR no reliable text | 「沒有辨識到可靠的文字」 | 照片 | 重新選取區域／重新拍攝／重新選擇照片 | 可選擇回到 Region Selection 或 Photo Acquisition |
| OCR failure | 一般化錯誤訊息，「重試辨識」 | 照片、選取區域 | 重試辨識 | 否，停留 OCR 狀態 |
| Translation failure | 一般化錯誤訊息，「重新嘗試翻譯」 | 照片、選取區域、OCR 原文 | 重新嘗試翻譯 | 否 |
| Speech failure | 一般化錯誤訊息，「重新嘗試播放」 | 照片、選取區域、OCR 原文、翻譯結果 | 重新嘗試播放 | 否 |
| Network/provider failure | 一般化狀態訊息（例如「目前無法連線，請稍後再試」） | 該失敗前已完成的所有內容（照片／選取區域／OCR 原文／翻譯結果，依失敗發生階段而定） | 依所在階段提供對應重試 action | 否 |

所有錯誤訊息一律使用一般使用者可理解語言，不顯示 provider 錯誤、stack trace 或任何技術性/機密資訊。

---

## 11｜Responsive Behavior

- **narrow phone**：單欄垂直堆疊；照片預覽與選取框以螢幕寬度為準，主要 action 固定於畫面下方可觸及區域。
- **wider phone**：維持單欄，但照片預覽與結果區可有較多留白與較大字級。
- **tablet / desktop**：照片預覽/選取區可置左，OCR 原文與翻譯結果可置右並列，但仍保持 A（照片區）／B（原文）／C（翻譯）三個獨立區塊與標題；選取框互動維持與行動裝置一致的觸控/滑鼠皆可操作。

長 OCR 原文或翻譯文字採可捲動文字區塊呈現，不得撐破版面或推走主要 action 按鈕。

---

## 12｜Accessibility / Educational Usability

- 所有 action 使用明確文字標籤（拍攝照片、從相簿選擇、確認選取區域、更換照片、重新選取區域、重新嘗試翻譯、重新嘗試播放等），不僅依賴圖示。
- Processing 狀態（OCR processing、translating、playing）同時使用文字與非純顏色的視覺提示。
- 錯誤訊息語氣中性、不責備使用者（例如避免「你拍得不好」，改用「這張照片無法使用，請重新拍攝」）。
- 觸控目標大小符合行動裝置可用性慣例，主要 action 位於單手可觸及範圍。
- 照片裁切/選取提供對應文字 action（不僅依賴手勢），並支援鍵盤可操作的替代方式（例如方向鍵微調選取框、Tab 可聚焦控點）。
- OCR 原文與翻譯結果各自有明確標題（`辨識原文`／`翻譯結果`），並使用適當標題階層（heading）供輔助科技辨識。
- Speech 狀態（ready／playing／completed／failure）以文字清楚呈現，並可透過鍵盤觸發播放/停止。
- Loading／retry 行為一律有對應文字說明目前狀態與下一步可執行的 action。

---

## 13｜Logical Interface Structure

```
Home
└─ 拍照翻譯 (Photo Translate)
   ├─ Photo Acquisition
   │   ├─ 初始（拍攝／選圖）
   │   ├─ 相機權限被拒
   │   ├─ 使用者取消（拍攝／選圖）
   │   └─ 不支援／無法讀取的照片
   ├─ Region Selection
   │   ├─ 調整選取框
   │   ├─ 確認選取區域 → 進入 Recognition Result
   │   ├─ 更換照片 → 回 Photo Acquisition（清除上一張照片內容）
   │   └─ 返回 → Photo Acquisition
   ├─ Recognition Result (OCR)
   │   ├─ ready for OCR / processing
   │   ├─ success（A 照片區／B 辨識原文／C 翻譯結果-尚未產生）
   │   ├─ no reliable text → 重新選取區域／重新拍攝／重新選擇照片
   │   ├─ failure → 重試辨識
   │   └─ 重新選取區域 → 回 Region Selection（隱藏舊 OCR／翻譯）
   ├─ Translation Result
   │   ├─ 選擇目標語言（繁體中文／日本語）
   │   ├─ 同語言提示（原文已是所選語言）
   │   ├─ translating / success / failure / retry
   │   └─ switching target（以既有 OCR 原文重新翻譯）
   └─ Speech
       ├─ speech ready
       ├─ playing
       ├─ completed
       └─ failure → 重新嘗試播放
```

離開 Photo Translate（任一路徑回到 Home 或切換其他入口）一律觸發 Photo Lifecycle 清除規則。
