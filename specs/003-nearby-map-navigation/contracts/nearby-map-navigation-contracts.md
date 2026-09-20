# UI / Module Contracts: Nearby Map & Navigation

本 feature 不新增 `/api/*` HTTP endpoint，因此不提供傳統 API contract。以下記錄前端新增 module 對外暴露的
函式與 component 介面契約，作為 `/speckit.tasks` 與 implementation 的依據。

## 1. `src/features/nearby/mapEligibility.ts`

```ts
export function isMapEligible(place: PlaceResult): boolean;
export function isNavigationEligible(place: PlaceResult): boolean;
```

**Contract**:
- 純函式，無副作用，不進行網路呼叫。
- 輸入 `place.location` 缺失、非有限數值，或恰為 `{ latitude: 0, longitude: 0 }` → 兩函式皆回傳 `false`。
- 不得檢查 `address` 是否為 fallback 文字（依 spec Clarification，僅檢查座標）。
- 兩函式目前邏輯相同（見 research.md #3），但維持獨立具名 export，呼叫端不得互相替代假設「未來一定相同」。

## 2. `src/features/nearby/navigation.ts`

```ts
export function buildGoogleMapsHandoffUrl(place: PlaceResult): string | undefined;
export function openNavigationHandoff(place: PlaceResult): { success: boolean };
```

**Contract**:
- `buildGoogleMapsHandoffUrl`：僅在 `isNavigationEligible(place)` 為 `true` 時回傳有效 HTTPS URL；否則回傳
  `undefined`。不得回傳以猜測值組成的 URL。
- `openNavigationHandoff`：
  - 內部呼叫 `buildGoogleMapsHandoffUrl`；若為 `undefined`，回傳 `{ success: false }` 且不呼叫
    `window.open`（呼叫端不應在此情況下觸發此函式，UI 層須先以 `isNavigationEligible` 隱藏/停用按鈕）。
  - 呼叫 `window.open(url, '_blank', 'noopener,noreferrer')`；若拋出例外或回傳 `null`（例如彈跳視窗被封鎖、
    使用者取消系統對話框），回傳 `{ success: false }`，不得拋出未捕捉例外。
  - 成功呼叫 `window.open` 且未拋出例外 → 回傳 `{ success: true }`。**不保證**外部服務實際完成導航（超出
    Tokyo Mate 責任邊界）。
- 呼叫端（`NearbyScreen.tsx`）依 `success` 決定是否設定 `navigationNotice`；`success: false` 不得清除
  `selectedPlaceId` 或 `places`。

## 3. `src/features/nearby/NearbyMap.tsx`（Component Contract）

```ts
interface NearbyMapProps {
  places: PlaceResult[];            // 呼叫端已以 isMapEligible 過濾
  selectedPlaceId?: string;
  onSelectPlace: (id: string) => void;
  onMapUnavailable?: () => void;
}
```

**Contract**:
- 元件內部負責 Leaflet 地圖生命週期（掛載／解構／更新），使用原生 Leaflet API，不依賴 `react-leaflet`。
- 顯示 Geoapify raster tile layer，並附上 provider 要求的 attribution（不得省略）。
- `places` 變化時更新 marker 集合；初次取得非空 `places` 時呼叫 `fitBounds` 使所有 marker 可見。
- marker 點擊時呼叫 `onSelectPlace(place.id)`；`selectedPlaceId` 對應的 marker 須有可辨識的選定樣式（非唯一
  依賴顏色，例如額外圖示或 z-index 提升＋樣式差異）。
- 地圖初始化或 tile 載入發生無法復原錯誤時，內部須自行 catch，呼叫一次 `onMapUnavailable?.()`，並以「不渲染
  地圖／顯示簡短不可用文字」取代拋出例外，不得使父層元件（`NearbyScreen`）crash。
- 點擊地圖底圖上不屬於 `places` 的內容（例如底圖本身的地標標籤）不得觸發 `onSelectPlace` 或產生新的
  Selected Place。
- Pan／zoom 操作本身不得觸發任何資料請求（不得呼叫 `requestPlaces` 或任何 `/api/*`）。

## 4. `src/features/nearby/NearbyResults.tsx`（擴充既有 Contract）

```ts
interface NearbyResultsProps {
  places: PlaceResult[];              // 既有：完整結果，不因 map eligibility 過濾
  loading?: boolean;                  // 既有
  error?: string;                     // 既有
  selectedPlaceId?: string;           // 新增
  onSelectPlace?: (id: string) => void;      // 新增
  onNavigate?: (place: PlaceResult) => void; // 新增
}
```

**Contract**:
- 既有 `loading` / `error` / 空結果分支行為不變（FR-001）。
- 每張卡片可獨立完成選取（呼叫 `onSelectPlace(place.id)`），不依賴地圖是否已渲染或可用。
- 「前往此地」按鈕僅在 `isNavigationEligible(place)` 為 `true` 時顯示為可用；不合格時不得顯示為可點擊的
  guessed destination（可完全隱藏，或顯示為 disabled 且不觸發 `onNavigate`）。
- 選定卡片必須有非純色彩的可辨識標示（例如文字標籤「目前選定」、`aria-pressed="true"` 或 icon），滿足
  Accessibility：Selected state 不只依靠顏色。

## 5. `src/screens/NearbyScreen.tsx`（既有元件，擴充內部邏輯 Contract）

- 新搜尋觸發（`handleUseMyLocation` / `handleManualAreaSearch`）時，於送出請求前同步重置
  `selectedPlaceId = undefined` 與 `navigationNotice = undefined`。
- `navigationNotice` 與既有 `error`（Nearby 搜尋失敗）、`notice`（定位失敗）為三個獨立狀態，UI 呈現時必須
  可區分文案，不得合併為單一 generic 錯誤訊息。
- `NearbyMap` 的 `onMapUnavailable` 僅影響地圖區域本身的呈現（例如顯示「地圖暫時無法使用」提示），不得
  觸發 `error` 或影響 `NearbyResults` 的可操作性。
