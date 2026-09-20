# Phase 0 Research: Nearby Map & Navigation

本文件解析 Technical Context 中已由使用者（成人教育者）預先批准的技術決策，記錄選擇理由與已評估的替代
方案。所有 NEEDS CLARIFICATION 項目均已由使用者在本次對話中的 Technical Truth 直接解決，故不存在待研究
的未知項；以下為將已批准決策落地所需的具體作法確認。

## 1. React 與 Leaflet 的整合方式

- **Decision**: 不使用 `react-leaflet`，改以單一 `NearbyMap.tsx` component，內部以 `useRef` 持有 DOM
  container、`useEffect` 呼叫 Leaflet 原生 API（`L.map()` / `L.tileLayer()` / `L.marker()` /
  `map.fitBounds()`）建立與清理地圖實例，並依 `places` / `selectedPlaceId` props 變化更新 marker。
- **Rationale**: 使用者已明確要求「預設 None wrapper，直接以 Leaflet framework-agnostic API 封裝」，且
  `react-leaflet` 會新增一個間接抽象層與版本相容性風險，不符合 Simplest Sufficient Technology 與
  Maintainability 原則。目前需求（multiple markers、selected marker、marker click、pan/zoom、fit
  results、responsive、graceful failure、attribution）以原生 Leaflet API 皆可直接達成，無需額外 wrapper
  library。
- **Alternatives considered**:
  - `react-leaflet`：提供宣告式 API，但引入額外 dependency 與版本鎖定成本；使用者已預先否決，僅在
    「implementation evidence 顯示必須」時才可 STOP 並申請批准。本 Plan 階段未發現此類必要性證據。
  - `maplibre-gl` / vector tile 方案：使用者已明確排除，且與既有 Geoapify raster tile 決策不符。

## 2. Geoapify raster tile 存取方式

- **Decision**: 使用 Geoapify 官方 raster XYZ tile endpoint（例如
  `https://maps.geoapify.com/v1/tile/{style}/{z}/{x}/{y}.png?apiKey={VITE_GEOAPIFY_API_KEY}`），由瀏覽器
  直接向 Geoapify 請求圖磚，透過 `L.tileLayer(url, { attribution, maxZoom })` 掛載。
- **Rationale**: 使用者已明確排除新增 tile proxy；Geoapify 圖磚服務本身設計為 client-side 直連並搭配
  Origin/HTTP Referrer 限制，是此類服務的標準用法（與地圖圖磚服務常見的 API key 管理慣例一致）。
- **Alternatives considered**:
  - Server-side tile proxy（`/api/tiles/...`）：可隱藏 key，但需新增 endpoint、增加 server 負載與延遲，
    且被使用者明確排除（"不得把 Geoapify tile requests 經 server proxy，除非另有批准"）。
  - 靜態地圖圖片（無互動）：不符合 pan/zoom/fit results 的既有需求。
- **附帶事項**：正式環境需在 Geoapify 帳戶設定 Origin/HTTP Referrer 限制；若流量超出免費方案需要付費升級，
  屬於 Approval Required 項目（見 plan.md）。

## 3. 座標可靠性判定（Map Eligibility = Navigation Eligibility）

- **Decision**: 單一共用判定函式，檢查 `location.latitude` 與 `location.longitude` 均為有限數值，且不同時
  等於 `(0, 0)`。此判定同時作為 `isMapEligible()` 與 `isNavigationEligible()` 的依據。
- **Rationale**: 依 spec Clarifications，兩者採同一套座標可靠性標準；且 `api/places.ts` 第 138–139 行在
  `googlePlace.location` 缺失時已明確 fallback 為 `Number(googlePlace.location?.latitude ?? 0)` /
  `longitude ?? 0`，故 `(0, 0)` 是既有系統中可辨識的「不可靠」訊號，不需新增額外資料欄位或後端變更。
- **Alternatives considered**:
  - 另外檢查地址文字是否為 fallback 預設值（如 `'東京都'`）：spec Clarification 已明確排除（「不另外要求
    地址文字非 fallback 值」）。
  - 以距離資料（`distanceMeter`）判斷有效性：與座標可靠性無必然關�是，且手動地區搜尋本就無
    `distanceMeter`，會誤判有效結果為不合格。

## 4. Google Maps HTTPS Navigation Handoff

- **Decision**: 使用 Google Maps 對外開放的 HTTPS 導航連結格式（不需要 API key、不需要 Directions API），
  以合格座標與可讀地點名稱組成 URL，並以 `window.open(url, '_blank', 'noopener,noreferrer')` 嘗試開啟。
- **Rationale**: 使用者已明確指定「Google Maps HTTPS URL」交接，且排除 Google Maps JavaScript SDK、
  navigation API key、Directions API、路線計算。HTTPS deep link 是 Google 官方支援、無需額外憑證的公開
  介接方式，符合「不新增 navigation provider priority chain」與「不建立第二個 provider fallback」的限制。
- **Alternatives considered**:
  - Google Maps JavaScript SDK + Directions API：被使用者明確排除（成本、複雜度與 App 內路線規劃範圍外）。
  - Universal link 偵測裝置已安裝地圖 App 並建立 provider chain：被使用者明確排除。

## 5. jsdom 環境下的 Leaflet 單元測試策略

- **Decision**: 單元測試以 `vi.mock('leaflet', ...)` 模擬 `L.map` / `L.tileLayer` / `L.marker` 等 API，
  驗證 `NearbyMap.tsx` 依 props 呼叫正確的 Leaflet API（建立/銷毀/更新 marker、fitBounds），而非依賴真實
  DOM 版面配置。Playwright regression（若涉及地圖可視驗證）於瀏覽器環境執行，非 jsdom 限制範圍。
- **Rationale**: 既有 `vitest.config.ts` 使用 `environment: 'jsdom'`；jsdom 不提供真實版面配置
  （`getBoundingClientRect` 恆為 0），Leaflet 在無版面配置的容器中初始化容易產生非預期行為或警告。Mock
  Leaflet module 可穩定驗證元件邏輯，不受 jsdom 限制影響，符合既有 repository test 慣例（沿用 Vitest +
  React Testing Library）。
- **Alternatives considered**:
  - 於 jsdom 中使用真實 Leaflet 並手動 stub `getBoundingClientRect`：可行但脆弱、易受 Leaflet 版本內部
    實作變動影響，維護成本高於 mock 策略。
  - 僅以 Playwright 端到端測試涵蓋地圖行為、略過 unit test：不符合 Testability 原則要求的可驗證情境分層
    （unit + regression 兩層）。

## 未列入本次研究範圍

以下項目由使用者 Technical Context 直接決議，無需研究：Backend／Database／Authentication／Routing engine
均為 None；State 沿用既有 screen-level React local state；依賴新增僅限 `leaflet`（+ 視需要
`@types/leaflet`）。
