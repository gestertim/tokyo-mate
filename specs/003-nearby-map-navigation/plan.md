# Implementation Plan: Tokyo Mate 東京通｜Nearby Map & Navigation 探索附近地圖與導航

**Branch**: `003-nearby-map-navigation` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-nearby-map-navigation/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

延伸既有 Explore Nearby（`NearbyScreen.tsx` / `NearbyExplorer.tsx` / `NearbyResults.tsx` / `requestPlaces()`），
新增兩項能力並沿用既有搜尋結果，不建立第二次搜尋：

1. **地圖理解**：以 Leaflet 封裝一個 framework-agnostic React component（`NearbyMap.tsx`），使用 Geoapify raster
   XYZ tiles 呈現同一次 Nearby search 結果中「具備可靠位置資料」的地點；map 與既有 result cards 共用單一
   `selectedPlaceId` local state 達成 Selected Place 一致辨識。
2. **前往此地**：對「座標可靠」的 result 啟用「前往此地」，直接建立 Google Maps HTTPS handoff URL 並嘗試
   開啟；不使用任何 Directions API、routing engine 或第二個 navigation provider。

「可靠位置資料」= 「足夠且可靠目的地資訊」，統一以同一個座標驗證函式判定（座標存在、有限數值，且非
`(0, 0)` fallback），對應既有 `api/places.ts` 正規化流程在缺少 provider 座標時所留下的 `(0, 0)` 預設值。

## Technical Context

**Language/Version**: TypeScript 5.6（沿用既有 `tsconfig.json` 設定），React 18.3

**Primary Dependencies**: React、Vite；新增 `leaflet`（runtime）與視需要新增 `@types/leaflet`（devDependency，
僅在 TypeScript 型別整合確實需要時新增）。既有 `openai` 依賴不受影響。不新增 `react-leaflet`、狀態管理或
routing library。

**Storage**: N/A（無新增資料庫；沿用既有 `/api/places` 回傳的 in-memory `PlaceResult[]`）

**Testing**: Vitest + React Testing Library（沿用既有 `vitest.config.ts` / `src/test/setup.ts`），必要時沿用既有
Playwright 設定（`playwright.config.ts`）做端到端 regression 驗證。

**Target Platform**: 既有 Vite + Vercel 部署的行動優先 Web App（既有 PWA 能力不變）

**Project Type**: 既有 single-page web application（`src/` frontend + `api/` Vercel serverless functions）；本
feature 僅新增 frontend module，不新增 `/api/*` endpoint。

**Performance Goals**: 沿用既有畫面反應標準；地圖初始化與 marker 渲染不得阻塞既有 result cards 顯示（cards
仍可獨立完成選取與前往此地，即使地圖尚未就緒或失敗）。

**Constraints**: 不新增 tile proxy；Geoapify tile 請求維持 network-dependent、不快取離線；不得將
`GOOGLE_PLACES_API_KEY`（server-only secret）移至 frontend；新增的 `VITE_GEOAPIFY_API_KEY` 為 client-side map
憑證，須以 provider 端 Origin/HTTP Referrer 限制降低風險（詳見下方 Constitution Check 例外說明）。地圖不可用
偵測必須涵蓋地圖初次建立／載入失敗，以及地圖已建立後使用期間可觀察到的執行失敗兩種時機；不設定固定秒數
timeout、不建立 failure cause taxonomy、不新增 monitoring 架構。

**Scale/Scope**: 1 個既有 screen（`NearbyScreen.tsx`）擴充；新增約 3–4 個 frontend module（地圖元件、座標
eligibility 判定、navigation handoff 建構）；不新增 backend endpoint、不新增資料模型持久化。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 檢查結果 | 說明 |
|------|---------|------|
| I. Specification Before Implementation | 通過 | 本 Plan 完全依 spec.md 已批准條款展開，未新增或縮減產品行為。 |
| II. Simplest Sufficient Technology | 通過 | Leaflet 直接封裝，不引入 `react-leaflet`／routing engine／狀態管理套件。 |
| III. A/B/C Complexity Discipline | 通過 | 未新增 Cloud 基礎設施、multi-user、Authentication 或後端權限架構；地圖與 handoff 均為既有前端層級能力擴充。 |
| IV. Incremental Enhancement | 通過 | 延伸既有 `NearbyScreen` / `NearbyResults` / `requestPlaces()` 資料流，不建立第二套 Nearby search 或平行資料來源。 |
| V. Technology Stack Stability | **有條件通過（需記錄例外）** | 新增 `VITE_GEOAPIFY_API_KEY` 屬前端可見的 map tile credential。此為使用者（成人教育者／product owner）於本次對話中明確批准的 Technical Truth，且為 Geoapify/多數 raster tile 供應商的標準用法（key 搭配 Origin/Referrer 限制，非 server secret）。與 001 `tasks.md` 中「API keys 不得使用 VITE_ 前綴」之既有工程慣例字面上不同，故在此明確記錄為已批准例外，範圍限定於「Geoapify 地圖圖磚 client credential」，不擴及 `GOOGLE_PLACES_API_KEY` 或任何其他 server secret。 |
| VI. Privacy & Educational Safety | 通過 | 不新增位置歷史、背景追蹤或個資保存；地圖僅呈現既有搜尋結果，不新增資料蒐集。 |
| VII. Testability | 通過 | 見下方 Testing Plan，涵蓋正常流程、failure/recovery 與 regression。 |
| VIII. Maintainability | 通過 | 座標 eligibility 判定集中於單一 module，避免重複邏輯；不新增 global state。 |
| IX. Incremental Implementation | 通過 | Implementation phases 採 Phase 1–5，每 phase 皆為 Implement → Run → Verify → Fix。 |
| X. Repository Safety | 通過 | 不修改 `specs/001-*`／`specs/002-*`；不移動 baseline tag。 |
| XI. Authorization Boundary | 通過 | 本 Plan 不授權 implementation；仍須待 `/speckit.tasks` 與 `/speckit.implement` 批准流程。 |
| XII. 繁體中文交付 | 通過 | 本 Plan 與相關 artifacts 均以繁體中文撰寫。 |

**Approval Required 追蹤項（記錄理由、影響、批准者、後續期限）**：
- **理由**：Geoapify raster tile 服務要求 client 端直接以 URL 帶入 API key 存取圖磚，這是此類服務的標準架構；
  無法在不新增 server-side tile proxy（本次明確排除）的前提下改為純 server-side 憑證。
- **影響**：`VITE_GEOAPIFY_API_KEY` 將出現在 frontend bundle 與瀏覽器網路請求中，可能被檢視或複製；風險已知
  且業界慣例以 Origin/HTTP Referrer 限制緩解，而非隱藏 key 本身。
- **批准者**：使用者於本次 `/speckit.plan` 對話中以成人教育者（product owner）身分明確核准（"新增 public
  browser credential：VITE_GEOAPIFY_API_KEY"）。
- **後續期限／待辦**：正式上線前，MUST 在 Geoapify 帳戶設定 Origin/HTTP Referrer 限制；若 production 流量需要
  升級付費方案，MUST 另行 STOP 並取得批准（見下方 Geoapify billing boundary）。

## Project Structure

### Documentation (this feature)

```text
specs/003-nearby-map-navigation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── screens/
│   └── NearbyScreen.tsx              # 既有；State owner，擴充 selectedPlaceId / navigationNotice /
│                                      # 新搜尋開始時的 selection 重置
├── features/
│   └── nearby/
│       ├── NearbyExplorer.tsx        # 既有，不變更（位置／地區／分類輸入）
│       ├── NearbyResults.tsx         # 既有；擴充卡片選取狀態、「前往此地」啟用判斷與 handoff 呼叫
│       ├── PlaceCard.tsx             # 既有但目前非實際 renderer；本次不整合，維持現狀
│       ├── NearbyMap.tsx             # 新增；Leaflet framework-agnostic 封裝（無 react-leaflet）
│       ├── mapEligibility.ts         # 新增；isMapEligible() / isNavigationEligible() 共用座標驗證
│       ├── navigation.ts             # 新增；buildGoogleMapsHandoffUrl() + openNavigationHandoff()
│       └── distance.ts               # 既有，不變更
├── types/
│   └── place.ts                      # 既有 PlaceResult，不新增欄位（沿用既有 location 結構）
└── services/
    └── api.ts                        # 既有 requestPlaces()，不變更、不新增第二個 endpoint 呼叫

api/
└── places.ts                        # 既有，不變更（(0,0) fallback 正規化邏輯為本次驗證依據來源）

tests/
├── (unit) src/features/nearby/*.test.ts(x)   # 新增：eligibility、NearbyMap（mock leaflet）、
│                                              # NearbyResults 選取／handoff 互動
├── (unit) src/screens/NearbyScreen.test.tsx  # 新增：search transition／selected place 重置
└── (e2e) 既有 Playwright regression 套件擴充  # 001 MVP + 002 Photo Translate 回歸涵蓋
```

**Structure Decision**: 採既有 single Vite frontend + Vercel serverless `api/` 結構（無 frontend/backend 分離
目錄），與 001／002 一致。本 feature 僅在 `src/features/nearby/` 下新增純前端 module，不新增 `api/` 路由、
不新增後端目錄。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `VITE_GEOAPIFY_API_KEY` 為 client-side 可見 credential（see Constitution Check V. 例外說明） | Geoapify raster XYZ tile 服務要求瀏覽器直接以 URL 帶 key 存取圖磚；本次批准明確排除新增 tile proxy | 「經 server proxy 轉發 tile 請求」需新增 `/api/*` endpoint、增加 server 負載與 latency，且已被本次 Technical Truth 明確排除；改用「不顯示地圖」則不符合 spec 的核心價值主張，非可接受替代方案 |

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1（data-model.md / contracts / quickstart.md 完成後）*

Phase 1 設計未新增任何 Phase 0 之外的架構元素：仍為 1 個 Leaflet 封裝 component、1 個座標 eligibility
module、1 個 navigation handoff module，皆為既有 `NearbyScreen` 的前端擴充；未新增 `/api/*` endpoint、
資料庫、Authentication 或 state 管理套件。Constitution Check 結果與 Phase 0 一致，**通過**，僅維持前述
`VITE_GEOAPIFY_API_KEY` 例外記錄於 Complexity Tracking，待實作前續由 `/speckit.tasks` 與
`/speckit.implement` 的 Implementation Readiness Gate 一併確認。

## Module Responsibilities（彙總）

| Module | 責任 | 變更類型 |
|--------|------|----------|
| `src/features/nearby/mapEligibility.ts` | `isMapEligible()` / `isNavigationEligible()` 座標可靠性判定（純函式） | 新增 |
| `src/features/nearby/navigation.ts` | `buildGoogleMapsHandoffUrl()` / `openNavigationHandoff()` | 新增 |
| `src/features/nearby/NearbyMap.tsx` | Leaflet 地圖生命週期、marker 呈現、選取回報、graceful failure | 新增 |
| `src/features/nearby/NearbyResults.tsx` | 既有 result cards 呈現 + 選取狀態呈現 + 「前往此地」啟用判斷 | 擴充 |
| `src/features/nearby/PlaceCard.tsx` | 既有獨立元件，目前非 NearbyScreen 實際 renderer | 不變更（維持現狀，不整合） |
| `src/screens/NearbyScreen.tsx` | Selected Place / navigationNotice state owner、search transition 重置、串接 NearbyMap 與 NearbyResults | 擴充 |
| `src/services/api.ts` / `api/places.ts` | 既有 Nearby search 資料來源 | 不變更 |

## External-Service Boundary

| 服務 | 呼叫方 | 憑證 | 邊界說明 |
|------|--------|------|----------|
| Google Places API (New) | Server（`api/places.ts`） | `GOOGLE_PLACES_API_KEY`（server-only） | 不變更，本 feature 不新增第二次搜尋。 |
| Geoapify raster tile | Browser（`NearbyMap.tsx` 內 Leaflet `tileLayer`） | `VITE_GEOAPIFY_API_KEY`（client-side，需 Origin/Referrer 限制） | 直連，不經 server proxy；network-dependent，不快取離線。 |
| Google Maps HTTPS handoff | Browser（`navigation.ts` 呼叫 `window.open`） | 無需 API key | 一次性、無回傳追蹤；成功僅代表「嘗試開啟」，交由瀏覽器／OS／Google Maps 後續行為。 |

## Credential / Env Plan

| 變數 | 位置 | 用途 | 備註 |
|------|------|------|------|
| `GOOGLE_PLACES_API_KEY` | server-only（既有） | Nearby search | 不變更，不移至 frontend。 |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | server-only（既有） | 既有 AI 能力 | 不受本 feature 影響。 |
| `VITE_GEOAPIFY_API_KEY` | frontend 可見（新增） | Geoapify raster tile 請求 | Client-side map credential；需於 Geoapify 帳戶設定 Origin/HTTP Referrer 限制；`.env.example` 須同步新增此變數名稱（不含實際值），於 implementation 階段執行。 |

## Failure / Recovery Plan（六個獨立網域）

| 網域 | 觸發情境 | 呈現方式 | 對其他網域影響 |
|------|----------|----------|----------------|
| 定位失敗 | 權限被拒絕／取消／逾時 | 既有 `notice` 狀態 | 不影響既有結果，可切換手動地區 |
| Nearby 搜尋失敗 | `/api/places` 錯誤 | 既有 `error` 狀態 | 不影響地圖／選取模組本身邏輯 |
| 無結果 | 搜尋成功但空結果 | 既有 `NearbyResults` 空狀態文案 | 地圖不渲染（無 eligible places） |
| 地圖不可用 | 地圖初次建立／載入失敗，或地圖已建立後使用期間可觀察到的 Leaflet／Geoapify tile 載入或執行失敗（不限初次載入） | `NearbyMap` 內部 fallback 文案，`onMapUnavailable` 回報 | 不設定 `error`；result cards 維持完整可操作 |
| 前往此地不合格 | `isNavigationEligible` 為 false | 「前往此地」隱藏或 disabled | 不顯示錯誤訊息，不阻擋其他 result 的選取／導航 |
| Navigation handoff 失敗 | `window.open` 失敗／使用者取消系統對話框 | 獨立 `navigationNotice` 狀態，文案明確區分於「搜尋失敗」 | 保留 `selectedPlaceId` 與 `places`，不清除既有搜尋狀態 |

## Testing Plan

沿用既有 Vitest + React Testing Library + repository test patterns，必要時沿用既有 Playwright regression。
對應使用者要求的 14 項情境：

| # | 情境 | 測試層級 |
|---|------|----------|
| 1 | 有效座標 result → map eligible | Unit（`mapEligibility.test.ts`） |
| 2 | 無效／不可靠座標 → map ineligible | Unit（`mapEligibility.test.ts`） |
| 3 | map-ineligible result 仍為有效卡片 | Unit（`NearbyResults.test.tsx`） |
| 4 | 卡片選取 → Selected Place | Unit（`NearbyScreen.test.tsx` 或 `NearbyResults.test.tsx`） |
| 5 | marker 選取 → 同一 Selected Place | Unit（`NearbyMap.test.tsx`，mock leaflet） |
| 6 | map／card 以穩定 id 對應 | Unit（跨 `NearbyMap` / `NearbyResults` 共用 `selectedPlaceId`） |
| 7 | 地圖不可用時卡片仍可用 | Unit（`NearbyScreen.test.tsx`，模擬 `onMapUnavailable`） |
| 8 | 導航合格 → 正確 handoff 產生 | Unit（`navigation.test.ts`） |
| 9 | 導航不合格 → 不猜測目的地 | Unit（`navigation.test.ts` / `NearbyResults.test.tsx`） |
| 10 | handoff 失敗 → 保留選定與結果 | Unit（`NearbyScreen.test.tsx`，mock `window.open` 失敗） |
| 11 | 手動地區不需定位即可運作 | Unit（既有 `NearbyScreen` 流程擴充） |
| 12 | 新搜尋清除／更新 stale 選定與地圖狀態 | Unit（`NearbyScreen.test.tsx`） |
| 13 | 原 MVP（001）回歸 | 既有 Playwright / Vitest regression 套件 |
| 14 | Feature 002 拍照翻譯回歸 | 既有 Playwright / Vitest regression 套件 |

`NearbyMap.tsx` 單元測試以 `vi.mock('leaflet')` 驗證呼叫行為（見 research.md #5），不依賴 jsdom 真實版面
配置。

## Implementation Phases

*本 Plan 不授權執行；以下為 `/speckit.tasks` 展開任務時的階段依據，每 phase 皆須 Implement → Run → Verify → Fix。*

1. **Phase 1 — Data eligibility / validation**：`mapEligibility.ts`（`isMapEligible` / `isNavigationEligible`）
   與對應單元測試。
2. **Phase 2 — Leaflet map 呈現 + Geoapify tiles**：`NearbyMap.tsx` 基本渲染、tile layer、attribution、
   graceful failure；`VITE_GEOAPIFY_API_KEY` 環境變數導入。
3. **Phase 3 — Selected Place + map/card correlation**：`NearbyScreen.tsx` 新增 `selectedPlaceId`，串接
   `NearbyMap` marker 點擊與 `NearbyResults` 卡片選取。
4. **Phase 4 — Google Maps HTTPS navigation handoff**：`navigation.ts` 與 `NearbyResults` 「前往此地」按鈕
   串接、`navigationNotice` 狀態。
5. **Phase 5 — Responsive + accessibility + failure handling + regression verification**：地圖 responsive
   樣式、非純色彩選定標示、六個 failure 網域驗證、001／002 regression 套件執行。

## Repository Safety Confirmation

- 未修改、未移動 `specs/001-tokyo-travel-assistant/` 或 `specs/002-photo-translate/`。
- 未移動或重建 `mvp-safe-baseline`（`fb09a41182bcc639a9335adbd0e1f84405a1bba7`）或 `002-safe-baseline`。
- 未執行任何 destructive scaffolding、reset、rebase、amend、force push 或 history rewrite。
- 本 Plan 僅新增 `specs/003-nearby-map-navigation/` 下的 `plan.md`、`research.md`、`data-model.md`、
  `quickstart.md`、`contracts/nearby-map-navigation-contracts.md`；未修改任何既有 `.git/`、`.github/`、
  `.specify/`、`.vscode/`、`specs/` 下既有檔案。
- 本 Plan 不構成 implementation 授權；`leaflet` 依賴尚未安裝、任何 `src/` 或 `api/` 程式碼均未變更。

## Remaining Approval Required Items

1. **`VITE_GEOAPIFY_API_KEY` 例外**：已於本次對話中由使用者以成人教育者身分核准（見 Constitution Check
   V.）；仍需在正式上線前完成 Geoapify Origin/HTTP Referrer 限制設定。
2. **Geoapify 付費方案／billing commitment**：若 production 流量需要升級付費方案，MUST 另行 STOP 並取得
   批准，本次批准範圍不包含自動升級。
3. **`/speckit.tasks` 與 `/speckit.implement` 批准**：本 Plan 完成後仍須經使用者明確批准才可進入
   `/speckit.implement`（依 Authorization Boundary 原則）。
