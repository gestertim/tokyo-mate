# Contract: Geoapify 圖磚代理與靜態示意圖（提案）

**狀態**：Technical Plan 架構與初始額度已核准；此 contract 描述後續實作與驗收邊界，不代表現行 application 已符合。外部服務實際啟用、Geoapify 付費升級、秘密值與部署仍待獨立批准。

**2026-10-06 接續本機 writer**：新增可注入 Redis 業務 Lua／TileStore adapter，包含已批准 120/min、1,000/day、9,600 quarter-credit/day（2,400 credits）、7 天 cache、跨 writer flight/coalescing、uncertain 不退款／不接管與 cache 清理。正式 transport／resource 未配置，不呼叫 Geoapify；本機 Lua interpreter＋Redis/cjson 替身與 mock pipeline 測試不等於正式 Redis／CDN 證據。flight lease、等待與資料上限維持參數化，不自行批准正式值。

**本輪本機進度（2026-10-06）**：已有同源 tile route／Session→原子 G→計數→cache／coalescing→credits→單次上游的可注入管線與 fixtures，前端已移除 Geoapify 直連。共享計數／cache／credits writer 未實作；真實 Geoapify／Redis／CDN／304／HAR 均未驗證。map 限制狀態、4:3／16:9 暫用示意、破圖文字與 SW API exclusion 有本機證據；正式素材尚缺。詳見 [本機證據](../../../docs/verification/005-local-implementation-evidence.md)。

**本輪最新（2026-10-06）**：A6 六列已批准，歷史待批准語句不重開文案 gate。P-G1／P-G2 依 [Plan §14](../plan.md#14-剩餘實作收斂與統一-readiness-gate)：eligibility 與每筆 tile gate 必須取得同次當下 registry／雙封鎖、資格、追加、日週 usage 的原子 snapshot，從仍有效 E_live 計算 G；不以早先 eligibility 或 build-time table 授權，不預留／扣六端點 US$。每筆 tile 在 cache／304 前重驗；registry 變更使舊 snapshot 失效，不自動重送 Places。全域不足與個別 request 不足的 UX 不變；圖磚初始限制、TTL、credits 及快取政策已批准，不重新列待決。

## 架構總覽

**2026-10-07 D09／D16本機批准**：eligibility快照30秒且遇恢復／離線／隱藏／晚到失效。為實現已批准「不晚於後端reset」，eligible回應同步加入`resetAt`（同次authority snapshot日／週reset較早者），前端缺失／非法／已過期則unknown，不從瀏覽器自行推算額度重置。tile upstream8000ms、派送2000、settlement5000、flight lease15000、wait8000、poll100、PNG≤1048576 B；z0～20、全球合法x/y，不加關東裁切。flight剩餘不足execution＋settlement時拒絕，不接管uncertain或退款。7天cache原批准不變；正式素材權利、Geoapify與CDN證據未批准。

- 前端不再直連 `maps.geoapify.com`；`NearbyMap`（Implement 階段）改為對 `GET /api/map/tile/{z}/{x}/{y}.png` 建立 tile layer。
- Geoapify API key 只存在伺服器端環境變數；不透過任何 `VITE_` 前綴變數暴露於前端 bundle。
- 代理固定使用單一伺服器端設定的 Geoapify 樣式（對齊既有 `osm-bright`）；不接受前端指定 `style`、host 或其他可導向任意上游位置的參數，避免 open proxy／SSRF 風險。

## 受限狀態（前端第一層 UX，仍應遵守）

以下狀態不得掛載 `NearbyMap`、Leaflet 或任何會呼叫圖磚代理的元件：

- Public / 未登入
- 已登入但未核准
- 核准撤銷或到期
- 當日或每週 US$ 額度全域不可用（exhausted 或 below_floor，見 plan.md §4.5）；週追加只能影響週 remaining，不提高日上限，也不保證日／週皆回到 G 以上；單一 request 預留不足不屬此類
- 額度或資格狀態無法確認
- 離線恢復但尚未取得可信後端狀態

受限狀態 `/api/places` 呼叫數必須為 0；直接對 `/api/map/tile/*` 發出請求也必須被代理拒絕（見下方逐請求驗證管線），不得依賴前端是否記得先查詢 eligibility。

## Eligibility API（前端第一層 UX）

前端進入探索附近前，先呼叫 `GET /api/me/map-eligibility`。只有回傳：

```json
{
  "success": true,
  "data": {
    "eligibleForInteractiveMap": true,
    "reason": "eligible",
    "fetchedAt": "2026-09-25T10:00:00+08:00"
  }
}
```

才可掛載互動地圖。任何錯誤、503、stale、未知或 `eligibleForInteractiveMap: false` 都必須走靜態示意圖。此查詢只影響前端是否掛載地圖元件，不具授權效力；真正的授權判斷在每一筆圖磚代理請求時重新執行。

**A6 本次待營運者批准方案**：日／週 exhausted 與 below_floor 均沿用既有 `daily_quota`／`weekly_quota` reason，不新增查詢欄位或 endpoint；reason 不足以區分兩者，前端不得自行推算或套用「已滿」。付費 API 完整文案由可信後端依 [錯誤契約六列](error-and-quota-contract.md) 選定；查詢 UI／文案接線另循批准流程，不屬本次或隔離七檔批次。圖磚額度 code／快取政策不變。

## 圖磚代理端點：`GET /api/map/tile/{z}/{x}/{y}.png`

### 逐請求驗證管線

| 步驟 | 檢查 | 失敗時處理 |
| --- | --- | --- |
| 1 | Method 必須為 `GET` | `405 METHOD_NOT_ALLOWED` |
| 2 | `z` 為 `0`–`20` 整數；`x`、`y` 滿足 `0 <= x, y < 2^z`；可另加寬鬆關東地區 bounding box | `400 INVALID_TILE_COORDINATE` |
| 3 | Session 有效（未過期、未登出） | `401 AUTH_REQUIRED` |
| 4 | 核准資格為 `approved` 且未撤銷未到期 | `403 ACCESS_NOT_APPROVED` |
| 5 | 六端點日／週 US$ 額度「全域可用性」：以權威 snapshot 判斷 `remaining_day ≥ G` 且 `remaining_week ≥ G`（G 規則 **A8＝G-B 規劃已核准**：僅計入價表 `live: true`［有可信成本上界且實際啟用］端點的最小 `R_max`；排除受阻或僅 mock 的 speech／transcribe；8,036 µUSD 只是 mock fixture `FIXTURE_ALL_LIVE` 的算術，**不得標為已驗證門檻**，數值待 A1；`E_live` 為空＝成本模型無效，回 `503 PROTECTION_SERVICE_UNAVAILABLE`，不帶 `quotaScope`、不呼叫上游；見 plan.md §4.5）。圖磚不預留、不扣除此額度；**單一端點的 `R_e` 無法預留不影響此判斷**，不得因 speech 等昂貴端點剩餘不足而拒絕圖磚 | `429 DAILY_QUOTA_EXHAUSTED` 或 `429 WEEKLY_QUOTA_EXHAUSTED`（`quotaScope: 'all'`），不查快取、不呼叫上游 |
| 6 | 每位使用者圖磚代理請求 rate/volume 可用；以 shared store 原子計數，且包含 cache hit、條件式請求與 304 | `429 MAP_TILE_QUOTA_EXHAUSTED` |
| 7 | 代理共用快取查詢（命中則可回 200 或 304，仍需先通過第 3–6 步） | 命中即回應並記錄 `sharedCacheHitCount`，未命中進入步驟 8 |
| 8 | 快取 miss 後、呼叫 Geoapify 前，全站 upstream credits 以 shared store 原子預留 0.25 credit | 預留失敗回 `503 PROTECTION_SERVICE_UNAVAILABLE`，不得呼叫上游 |
| 9 | 呼叫 Geoapify 上游；回應大小、逾時皆有上限 | 逾時／異常回 `503`／`502`，不得回傳部分或不明資料 |
| 10 | 結算與快取寫回；成功轉 settled，不確定是否計費轉 uncertain | 寫入共用快取並回應；不確定狀態保守占用 site credits |

第 1–6 步任一失敗，一律不得進入第 7–10 步：不得查快取、不得呼叫 Geoapify 上游、不得回傳圖磚位元組。第 8 步預留失敗時，不得進入第 9 步。

### 計數契約

| 計數 | 契約 |
| --- | --- |
| `userProxyRequestCount` | 每位使用者、每分鐘／每日；通過 Session 與核准後即計入，包含代理共用快取命中、`If-None-Match` 條件式請求與 304。用於已批准的 120/min、1,000/day 初始上限。 |
| `sharedCacheHitCount` | 代理共用快取命中時增加；用於快取效益與容量觀測；不得當成使用者請求數，也不得當成 Geoapify 上游請求數。 |
| `actualUpstreamRequestCount` / `estimatedGeoapifyCredits` | 只有實際呼叫 Geoapify 或不確定是否已計費而保守結算時增加；1 upstream tile request = 0.25 credit。全站每日 credits 必須在上游呼叫前原子預留。 |

同一 tile key 的並發 cache miss 必須 request coalescing：最多一個 in-flight 上游呼叫與一筆 0.25 credit 預留，等待者共用結果。

### 回應快取政策

- 代理回應設定 `Cache-Control: private, no-cache` 並附 `ETag`；瀏覽器可保留位元組節省頻寬，但正常重新使用同一快取項目前需向代理送出條件式請求，代理在回應 304 之前仍先執行完整驗證管線。
- 同步設定 `CDN-Cache-Control: no-store` 與 `Vercel-CDN-Cache-Control: no-store`；禁止 `Cache-Control: public`、`s-maxage` 或任何允許 CDN／中介快取跳過驗證的設定。
- 驗收不得只以 header 存在標示 PASS；需證明 `If-None-Match` 抵達代理、`x-vercel-cache` 非 CDN HIT、Service Worker Cache Storage 未保存 `/api/map/tile/*`，且撤銷後同一快取圖磚請求回 403 而非 304。
- 圖磚代理路徑落在 `/api/` 之下，沿用既有 PWA Service Worker 不快取 `/api/` 回應的規則；Implement 階段須確認排除邏輯確實涵蓋 `/api/map/tile/*`。

## 撤銷與舊分頁：精確保證

- **可保證**：撤銷、到期或額度耗盡生效後，下一筆抵達代理並完成 Session／核准檢查的圖磚請求，一律得到 401／403／429，不查快取、不呼叫上游。因回應採 `no-cache`，此保證涵蓋已掛載但未卸載的舊分頁下一次平移／縮放／重新取得圖磚時的行為。
- **不可保證／不宣稱**：撤銷生效前已送達代理且已完成回應的請求無法追回；已呈現於裝置記憶體、磁碟快取或畫面上的圖磚影像位元組無法遠端清除。此為所有伺服器架構共通的物理限制，不是本設計缺陷。
- 對外驗收語意建議統一為：「下一筆抵達代理且完成授權檢查的圖磚請求必然被拒絕，不產生新的 Geoapify 上游呼叫；不宣稱能追溯撤回已完成的請求或已交付的圖磚影像。」

## 圖磚成本控制（獨立於 US$ 計價，但受日／週 US$ availability gate 約束）

- Geoapify 以 credit 計費（1 次圖磚請求 = 0.25 credit），非每人可信 USD 上界，故第一版不併入 tier1/tier2 的 US$ 日／週額度。
- 已核准三層初始控制：
  1. 全站每日 Geoapify upstream credits 上限（防護性；已核准 Free 初始值 2,400 credits/day；API 10 8,000/day 僅在付費升級另行批准後適用；觸發回 `503`，地圖切換為與六端點一致之「防護服務暫時無法確認使用狀態」狀態）。
  2. 每位核准使用者每分鐘／每日圖磚代理請求數上限（已核准初始值 120/min、1,000/day，包含 cache hit/304；觸發回 `429 MAP_TILE_QUOTA_EXHAUSTED`）。
  3. Geoapify 帳戶層級用量提醒或方案門檻，作為獨立防線。
- 代理端共用快取（依 `(style, z, x, y)` 為 key）是主要成本槓桿：同一圖磚被多位使用者或多次瀏覽重複命中時，只有第一次未命中消耗 Geoapify credit。
- Free plan 標稱 3,000 credits/day 不得被視為本專案帳戶已設定的硬上限；營運者需在 Geoapify dashboard 驗證實際 plan、daily credits、rate limit、usage alert、white label/attribution 狀態。
- 共用快取 TTL 已核准初始值 7 天，依 Geoapify 每月更新地圖資料與實際命中率提出後續調整；此 TTL 不改變瀏覽器端逐次重新驗證授權的要求。

## 狀態切換（前端第一層 UX，實際保證見代理管線）

| 情境 | 要求 |
| --- | --- |
| 首次進入 | 查 eligibility 前不得 mount `NearbyMap`；不得預取 tile |
| 重新整理 | 不使用舊前端狀態放行；查詢完成前顯示非互動狀態 |
| 舊分頁恢復 | focus/visibility 恢復後重新查前端 eligibility；即使前端未 unmount，該分頁下一次圖磚請求仍受代理逐請求驗證拒絕 |
| 資格撤銷或到期 | 下一次後端狀態更新後切換靜態示意圖；後續 `/api/map/tile/*` 與 `/api/places` 皆由代理拒絕 |
| 某一端點預留不足、但剩餘 ≥ `G` | 地圖維持互動，圖磚照常服務；僅該端點功能區塊顯示 `quotaScope: 'request'` 文案 |
| 使用者圖磚額度耗盡 | 地圖可維持掛載，但圖磚代理回 429；`NearbyMap` 既有 `tileerror` 處理可呈現局部錯誤 |
| 全站圖磚防護性上限觸發 | 建議整頁面切換為靜態示意圖，顯示與六端點一致的 503 防護服務故障文案 |
| 離線恢復 | 未重新確認前不得掛載互動地圖；離線時圖磚請求本就無法送達代理 |

## 靜態示意圖

- 圖片來源、授權、壓縮與檔案路徑待 Implement 前取得；聊天附圖不得視為 repository 資產。
- mobile `4:3`、desktop `16:9`；主要視覺元素不可只在邊緣。
- UI 可見標示「示意圖」，不依賴圖片內嵌文字。
- 替代文字：「東京街區風格示意圖，非即時地圖或真實地理資料。」
- 破圖 fallback：「地圖示意圖目前無法顯示，你仍可查看東京百科。」
- 不提供 pan、zoom、marker、導航、即時位置、地點點選。

## 驗收證據

- 受限狀態：以真實瀏覽器 Network/HAR 證明無 `/api/map/tile/*` 與 `/api/places` 請求；也可直接對 `/api/map/tile/*` 發出請求驗證回應為 401/403，且無對應 Geoapify 上游呼叫（可由後端 log／mock 驗證），不再需要仰賴瀏覽器對外部 Geoapify 網域的直連 Network 證據。
- 撤銷情境：驗證撤銷生效後，同一分頁下一次平移／縮放觸發的圖磚請求被拒絕；同時需在報告中明確排除「撤銷前已完成的請求」與「裝置上已呈現圖磚」兩類無法追回的情形，不得宣稱絕對零殘留。
- CSS 隱藏、DOM 不可見、單元 mock 或截圖仍不足以證明零圖磚請求。
