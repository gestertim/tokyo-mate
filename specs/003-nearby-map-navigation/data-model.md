# Phase 1 Data Model: Nearby Map & Navigation

本 feature 不新增後端資料庫或持久化模型，沿用既有 `PlaceResult`（[src/types/place.ts](../../src/types/place.ts)）
與既有 `/api/places` 回應。以下記錄新增的前端 in-memory 狀態、衍生判定邏輯與驗證規則。

## 1. 沿用既有實體

### Nearby Result（`PlaceResult`，既有，不變更）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | `string` | Map／card correlation identity；本 feature 以此作為 marker 與卡片對應的唯一鍵值。 |
| `name` | `string` | 顯示名稱；用於 Google Maps handoff 的可讀地點名稱。 |
| `address` | `string` | 顯示地址；不參與 map/navigation eligibility 判定。 |
| `location.latitude` / `location.longitude` | `number` | 座標；由 `api/places.ts` 正規化，缺失時 fallback 為 `0`。 |
| `distanceMeter?` | `number` | 既有欄位，不參與本次判定。 |
| `category` / `openNowStatus?` / `whyRecommended?` | — | 既有欄位，不變更。 |

**本次不新增欄位。** `isMapEligible` / `isNavigationEligible` 皆為衍生判定（純函式），不寫回 `PlaceResult`。

## 2. 新增衍生判定邏輯

### `hasReliableCoordinates(place: PlaceResult): boolean`

```text
回傳 true，若且唯若：
  place.location 存在
  且 Number.isFinite(location.latitude) 且 Number.isFinite(location.longitude)
  且 NOT (latitude === 0 且 longitude === 0)
否則回傳 false。
```

- **來源依據**：`api/places.ts` 第 138–139 行 `Number(googlePlace.location?.latitude ?? 0)` /
  `longitude ?? 0`，是既有系統中「provider 未回傳座標」的可辨識訊號。
- **`isMapEligible(place)`**：`= hasReliableCoordinates(place)`。決定該 result 是否可在地圖上呈現 marker。
- **`isNavigationEligible(place)`**：`= hasReliableCoordinates(place)`。決定「前往此地」是否對該 result 可用。
- 兩者依 spec Clarification 採同一套標準，故實作上共用同一底層判定函式，但以兩個具名 export 呈現，保留
  「Map eligibility 與 Navigation eligibility 各自明確驗證」的可讀性與未來若標準分歧時的擴充點（Testability
  / Maintainability 原則）。
- **不變式**：`isMapEligible` / `isNavigationEligible` 為純函式，不得有副作用、不得對缺失座標做估算或猜測。

### `buildGoogleMapsHandoffUrl(place: PlaceResult): string | undefined`

```text
若 isNavigationEligible(place) 為 false → 回傳 undefined（呼叫端不得使用推測值建立 URL）
否則回傳以合格 latitude/longitude + 可讀 name 組成的 Google Maps HTTPS 導航連結。
```

- 僅在 `isNavigationEligible(place)` 為 true 時才建構 URL；不得為不合格 result 產生任何 URL（即使部分欄位
  存在）。

## 3. 新增前端 in-memory 狀態（`NearbyScreen.tsx`）

| 狀態 | 型別 | 生命週期 |
|------|------|----------|
| `selectedPlaceId` | `string \| undefined` | 由 map marker 點擊或 card 選取設定；開始新一次搜尋（`handleUseMyLocation` / `handleManualAreaSearch` 呼叫時、送出請求前）立即重置為 `undefined`。 |
| `navigationNotice` | `string \| undefined` | 僅在 navigation handoff 失敗時設定；不與既有 `error`（Nearby 搜尋失敗）或 `notice`（定位失敗）共用同一欄位，避免失敗網域混淆。設定新搜尋開始時一併清除。 |

既有狀態 `places` / `loading` / `error` / `notice` 不變更型別，僅在「新搜尋開始」時機新增
`setSelectedPlaceId(undefined)` 與 `setNavigationNotice(undefined)` 呼叫。

### 狀態轉換：Search Transition

```text
使用者觸發新搜尋（use my location 或 manual area）
  → 立即：selectedPlaceId = undefined, navigationNotice = undefined, error = undefined, loading = true
  → NearbyResults 與 NearbyMap 於 loading = true 期間不呈現上一次搜尋的地圖／清單內容
     （沿用既有 NearbyResults `if (loading) return <p>正在搜尋附近地點…</p>` 提前 return 慣例）
  → 請求完成：loading = false，places 以新結果整批取代（既有行為，不變更）
```

此設計不需要清空 `places` 陣列本身，僅需在 `loading` 為 true 時於呈現層提前 return，即可同時滿足「舊結果
不被誤認為新搜尋結果」（FR-015）與「不變更既有可觀察行為」（FR-001，既有 NearbyResults loading 分支已是
如此）。

## 4. 元件 Props（介面，不含實作）

### `NearbyMap`

```text
places: PlaceResult[]          // 呼叫端先以 isMapEligible 過濾後傳入
selectedPlaceId?: string
onSelectPlace: (id: string) => void
onMapUnavailable?: () => void  // 地圖初始化或渲染失敗時呼叫一次，不拋出未捕捉例外
```

### `NearbyResults`（擴充既有 props）

```text
places: PlaceResult[]           // 既有，未過濾，維持完整結果清單（含 map-ineligible 項目）
loading?: boolean                // 既有
error?: string                   // 既有
selectedPlaceId?: string         // 新增
onSelectPlace?: (id: string) => void   // 新增：card 點擊回報選取
onNavigate?: (place: PlaceResult) => void // 新增：「前往此地」點擊，僅在 isNavigationEligible 時可觸發
```

## 5. 驗證規則彙總

| 規則 | 責任模組 |
|------|----------|
| 座標存在、有限、非 `(0,0)` 才視為可靠 | `mapEligibility.ts`（`hasReliableCoordinates` / `isMapEligible` / `isNavigationEligible`） |
| 不得為不合格 result 猜測位置或目的地 | `NearbyMap.tsx`（僅渲染 eligible 子集）、`navigation.ts`（`buildGoogleMapsHandoffUrl` 對不合格 result 回傳 `undefined`） |
| Selected Place 為 map／card 唯一共用狀態 | `NearbyScreen.tsx`（`selectedPlaceId` 為單一事實來源，向下傳遞） |
| 新搜尋必須重置選取與交接通知 | `NearbyScreen.tsx`（於 `handleUseMyLocation` / `handleManualAreaSearch` 起始處重置） |
| 地圖不可用不得影響 result cards 可用性 | `NearbyResults.tsx` 不依賴 `NearbyMap` 是否成功渲染 |
| Handoff 失敗需與搜尋失敗分離顯示 | `NearbyScreen.tsx`（獨立 `navigationNotice` 狀態與訊息文案） |
