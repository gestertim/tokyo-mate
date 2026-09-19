# Phase 1 Data Model: Photo Translate 拍照翻譯

**Feature Branch**: `002-photo-translate`

本檔案定義前端 runtime state 型別（非資料庫 schema）。實體語意依 `spec.md` Key Entities 為 Product Truth；本檔案僅定義技術層級欄位與狀態轉換機制。

---

## 1. `PhotoTranslateTaskState`（拍照翻譯任務）

代表使用者主動開始的一次當次任務；離開功能或更換照片即整個捨棄，不持久化。

```ts
interface PhotoTranslateTaskState {
  phase: PhotoTranslatePhase;
  photo?: {
    objectUrl: string;       // URL.createObjectURL(file)，離開/更換照片時必須 revoke
    fileName: string;
    mimeType: string;
  };
  regionVersion: number;      // 每次「確認選取區域」+1；0 代表尚未有任何確認過的選取
  region?: {
    version: number;          // 建立當下的 regionVersion
    rect: { x: number; y: number; width: number; height: number }; // 原圖像素座標
    croppedObjectUrl: string; // 裁切後影像預覽，唯讀顯示於 A 區
  };
  ocr?: OcrState;
  translation?: TranslationState;
  speech?: SpeechState;
}

type PhotoTranslatePhase =
  | 'acquisition'
  | 'region_selection'
  | 'ocr_processing'
  | 'ocr_result'
  | 'translation_result'
  | 'error';
```

## 2. `OcrState`（OCR 原文）

```ts
interface OcrState {
  forRegionVersion: number;   // 此結果所屬的 regionVersion，用於 stale 判斷
  status: 'processing' | 'success' | 'no_reliable_text' | 'failure';
  sourceText?: string;        // 僅 status === 'success' 時存在
}
```

**Stale invalidation 規則**：畫面只顯示 `ocr.forRegionVersion === task.regionVersion` 的 `ocr`；一旦使用者重新選取並確認新區域（`regionVersion` 遞增），舊 `ocr`（與其衍生之 `translation`）即視為 stale，UI 必須立即隱藏，不得誤認為新選取範圍的結果（對應 FR-016）。

## 3. `TranslationState`（翻譯結果）

```ts
interface TranslationState {
  selectedTarget: 'zh-TW' | 'ja';         // 使用者目前選擇的目標語言（可隨時切換）
  forOcrText: string;                      // 產生下列 displayed 內容所依據的 OCR 原文（用於 target 切換時比對是否需要重新請求）
  status: 'idle' | 'translating' | 'success' | 'same_language' | 'failure';
  displayed?: {
    target: 'zh-TW' | 'ja';                // 目前實際顯示之翻譯結果所屬 target（可能 ≠ selectedTarget，切換失敗時的復原狀態）
    text?: string;                          // status 為 'success' 時存在；'same_language' 時不存在（不得虛構翻譯）
  };
}
```

**Target 切換規則**（對應 FR-018 / spec Acceptance Scenario 3.7）：

1. 使用者切換 `selectedTarget` 時，`status` 立即轉為 `translating`；`displayed` 暫時保留切換前內容但 UI 不得將其誤呈現為新 target 的結果（前端以 `displayed.target !== selectedTarget` 判斷應覆蓋顯示「翻譯中」而非直接顯示舊文字）。
2. 新 target 翻譯成功：`displayed = { target: selectedTarget, text }`，`status = 'success'`。
3. 新 target 翻譯失敗且切換前 `displayed` 已存在（曾有成功結果）：`status = 'failure'`，`displayed` **維持切換前最後一次成功結果不變**（`displayed.target` 仍是舊 target），並附帶「切換翻譯失敗，可重試」提示；系統必須清楚呈現「目前選擇的 target（`selectedTarget`）」與「目前顯示翻譯的實際 target（`displayed.target`）」不一致。
4. 新 target 翻譯失敗且切換前 `displayed` 不存在（尚無任何成功翻譯）：`status = 'failure'`，`displayed` 維持 `undefined`；UI 不得顯示任何翻譯內容，僅保留照片、選取區域與 OCR 原文，並提供重新嘗試翻譯（對應 FR-020）。
5. 可靠 OCR 原文與 `selectedTarget` 相同語言：`status = 'same_language'`，`displayed` 不含 `text`，UI 顯示「原文已是所選語言」提示（對應 FR-017）。

## 4. `SpeechState`（語音播放）

```ts
interface SpeechState {
  forTarget: 'zh-TW' | 'ja';               // 必須等於 translation.displayed.target，不得直接採用 selectedTarget（對應 FR-021）
  status: 'ready' | 'playing' | 'completed' | 'failure';
}
```

## 5. 狀態轉換總覽

```
acquisition
  → (拍攝/選圖成功) region_selection
region_selection
  → (確認選取區域, regionVersion++) ocr_processing
  → (更換照片) acquisition（清除 photo/region/ocr/translation/speech）
ocr_processing
  → (success) ocr_result（ocr.status='success'）
  → (no reliable text) ocr_result（ocr.status='no_reliable_text'）
  → (failure) error（可重試 ocr_processing）
ocr_result / translation_result
  → (重新選取區域) region_selection（regionVersion 尚未遞增，待新確認時才 ++；先前 ocr/translation 立即標記 stale 並隱藏）
translation_result
  → (切換 target) translation_result（見 Target 切換規則）
```

## 6. Photo Lifecycle 對應（FR-014 / FR-016）

| 事件 | 清除範圍 |
|---|---|
| 使用者按「更換照片」 | `photo`、`region`、`ocr`、`translation`、`speech` 全部清除並 revoke object URLs，回到 `acquisition` |
| 使用者離開 Photo Translate（返回首頁／切換其他入口／關閉頁面） | 同上，並卸載 `PhotoTranslateScreen`（React `useEffect` cleanup 負責 revoke object URLs） |
| 使用者「重新選取區域」但尚未確認新選取框 | 保留 `photo`；`ocr`/`translation`/`speech` 立即標記為不可顯示（stale），但物件可暫留於 state 直到新 `region` 確認後被整體覆蓋，不得殘留顯示於畫面 |

不建立任何跨任務的 history 陣列或 IndexedDB／LocalStorage 持久化，符合 Out of Scope。
