# Contract: 共用錯誤信封、額度與 Retry-After

**本機已驗分流**：可信本人操作不可再執行410；已有grant且有效capability的duplicate／conflict409；authority／必要key／committed response unknown503、不猜未成立或自動重送。same-command確認仍驗當下資格、撤銷、退役及到期；免費status不要求capability並沿四狀態原文案，settled不等於內容取得。缺next epoch的新簽發503，不捏造generation／授權。401／403／400／413／429與原既有入口優先序、信封及Retry-After維持；詳見[最後矩陣](request-epoch-and-key-lifecycle.md#10-本機實作驗收矩陣本輪執行真實服務項仍未驗)。

**2026-10-07 Epoch本機文案界線**：正常signing key轉verify-only不阻擋仍有效、未grant且全部gate成立的舊capability首次執行。已有grant同內容409 duplicate／異內容409 conflict，fingerprint verify-only不重授；撤銷／退役擋新grant，不追溯取消原入帳／uncertain占用。本機採E10 410 `OPERATION_NO_LONGER_EXECUTABLE`及unknown同命令手動確認／新操作提示；正式服務仍停用，既有D10／D11文案不改。authority／必要key故障仍503、資格403優先。

**狀態**：A6 已批准；共用信封與拒絕 handler／fixture 的相應行為已有本機測試。其餘正式／成功／恢復情境並未全部驗證；保留原契約，不因本機 PASS 解除正式 gate。詳見 [本機證據](../../../docs/verification/005-local-implementation-evidence.md)。

**2026-10-06 A6 本輪已批准**：下方六列與完整信封已核准，request 日／週 userMessage 採相同修正；HTTP／code／quotaScope／G-B 不變。僅七檔隔離實作獲授權，UI／handler／正式整合及上線未授權；下文待批准敘述為前批歷史。

## 共用錯誤信封

### D10／D11 已批准文案（2026-10-07）

| code／狀態 | userTitle | userMessage | actionableStep |
| --- | --- | --- | --- |
| `OPERATION_NOT_FOUND`／404 | 找不到操作紀錄 | 找不到可供此帳號查詢的操作紀錄。 | 請確認目前帳號與原操作；不要自動重送付費請求。 |
| `REQUEST_NOT_FOUND`／404 | 找不到申請 | 找不到可供此帳號查看的申請。 | 請重新查詢本人申請清單。 |
| `REQUEST_ALREADY_RESOLVED`／409 | 申請已處理 | 此申請已處理，無法撤回。 | 請確認最新申請狀態；撤回不會撤銷已核准權利。 |
| reserved | 操作尚未確認完成 | 此操作已預留額度，目前尚未確認完成。 | 請稍後手動查看狀態，不要自動重送。 |
| settled | 操作已有記帳紀錄 | 此操作已有記帳紀錄；這不代表結果內容已成功取得。 | 請確認原畫面；不要因記帳狀態自動重送。 |
| released | 預留已釋放 | 此操作的預留已釋放；這不代表已有結果內容。 | 請確認目前資格與額度，再決定下一步操作。 |
| uncertain | 操作結果尚未確認 | 目前無法確認此操作結果，預留仍保留；請勿自動重送。 | 請稍後手動查看狀態或聯絡管理者。 |

非法reasonCode／額外欄位採既有400 INVALID_INPUT；Session401、資格403、故障503沿用既有信封。本節已明確批准加入型別／UI，既有409文字不改。撤回已resolved或withdrawn均409；未知／他人同404。操作projection只含state／updatedAt／userMessage，採上表userMessage，不回結果／價格／reservationId。

```ts
interface ProductError {
  code: ErrorCode;
  userTitle: string;
  userMessage: string;
  actionableStep: string;
  retryAfterSeconds?: number;
  quotaScope?: 'all' | 'request'; // 僅日／週額度 code 使用；all＝exhausted 或 below_floor，request＝僅本次預留不足
}

interface ErrorEnvelope {
  success: false;
  error: ProductError;
}
```

## 狀態碼

| HTTP | code | userMessage 要求 |
| --- | --- | --- |
| 401 | `AUTH_REQUIRED` | 需要登入才能使用這項付費功能。 |
| 403 | `ACCESS_NOT_APPROVED` | 此帳號目前沒有有效的付費功能核准資格。你仍可查看公開內容。 |
| 403 | `ADMIN_REQUIRED` | 你沒有管理者權限。 |
| 405 | `METHOD_NOT_ALLOWED` | 此功能僅接受應用程式內既有的操作方式。 |
| 413 | `PAYLOAD_TOO_LARGE` | 檔案或請求內容過大，無法處理。 |
| 429 | `RATE_LIMITED` | 短時間內請求太多，請稍後再試。 |
| 429 | `DAILY_QUOTA_EXHAUSTED`／`WEEKLY_QUOTA_EXHAUSTED`，`quotaScope: 'all'` | 依可信內部分類分別使用下方日／週 exhausted 或 below_floor 精確文案，不由 code 自行推論耗盡。 |
| 429 | `DAILY_QUOTA_EXHAUSTED`／`WEEKLY_QUOTA_EXHAUSTED`，`quotaScope: 'request'` | 僅本次操作不足，使用下方日／週 request 精確文案。 |
| 429 | `MAP_TILE_QUOTA_EXHAUSTED` | 今天的互動地圖載入次數已達上限。你仍可查看下方地點清單，或稍後再試。 |
| 409 | `DUPLICATE_REQUEST` | 此操作已送出，請查看目前狀態。 |
| 409 | `IDEMPOTENCY_CONFLICT` | 操作識別碼與原請求不一致，請重新確認操作。 |
| 410 | `OPERATION_NO_LONGER_EXECUTABLE` | 這個操作目前不能取得新的執行授權；既有記帳或預留不會因此取消。 |
| 503 | `PROTECTION_SERVICE_UNAVAILABLE` | 保護服務暫時無法確認使用狀態，付費功能先暫停。請稍後再試。 |

成本模型無效、過期、上界未證明、端點未啟用、封鎖、store 不可用或無效資料等內部原因，對外一律回 `503 PROTECTION_SERVICE_UNAVAILABLE`，不帶 `quotaScope`，不顯示額度文案；不得輸出內部原因、價表版本、端點設定或封鎖細節。對外 `userTitle`、`userMessage`、`actionableStep` 採同一保護服務狀態文案。不得因換版本字串解除封鎖；新版本須由可信後端 registry 驗證有效期、核准證據、live 狀態與端點適用性。

`409 DUPLICATE_REQUEST` 與 `409 IDEMPOTENCY_CONFLICT` 均不授予執行權且不得自動重送。前者只代表識別碼已被使用，不表示原操作成功；「查看目前狀態」不能暗示已有成功結果。手動狀態查詢的 method、路徑、資料欄位與授權方式已依[本人契約](auth-and-session-endpoints.md)批准；只查記帳projection，不還原內容、不授予執行權。必須先查驗目前 Session 與有效核准資格；撤銷或失效資格回 403，不得透露原 reservation 的 ID／status。

不得使用全站停止 code 或文案。不得把日額度與週額度合併成「當期額度」。`quotaScope: 'request'` 不得使用「額度已滿」文案；「額度不可用」的判斷以 plan.md §4.5 為唯一定義（`remaining < G` 或實際額度耗盡）。

## Retry-After

**2026-10-06 隔離錯誤優先序（使用者已批准，未實作）**：六端點共用 helper 先做 method／解析前大小 → 匿名 admission（429／503）→ Session（401／503）→ 有效資格（403／503）→ 已登入者限流（429／503）→ 有界解析及完整輸入驗證 → registry／原子預留。入口拒絕不查 reservation，不信任客戶端 IP／代理 Header。anonymous admission 不授權付費使用、不建立匿名額度；本規則不改管理／圖磚契約。下游依賴尚未執行時不推測其結果；403 優先於任何 duplicate／conflict 洩露。

**A6 本輪核准 gate**：完整 userTitle／userMessage／actionableStep 已批准並同步 Spec／UX／Plan／Tasks，僅七檔隔離實作獲授權；正式 gate 保留，不以通用信封、成功 fallback 或跳過案例解除。`quotaScope: 'all'`「已滿」只可用於 `exhausted`。

- 短時限流若可可靠計算，MUST 同時提供 HTTP `Retry-After` 與 body `retryAfterSeconds`。
- 日額度與週額度若可由後端窗口可靠計算，MAY 提供秒數；不可可靠計算時 MUST 省略，不得猜測。
- 503 不應提供精確恢復時間，除非後端確有可信維護窗口。

## 額度顯示 contract

- `usedEstimatedUsd`：已結算內部估算額度。
- `reservedEstimatedUsd`：已預留但尚未結算。
- `remainingEstimatedUsd`：後端依 used + reserved 計算的可用估算額度。
- `resetAt`：後端以 `Asia/Taipei` 計算。
- 所有金額 UI 顯示至少到美分；內部可用 micro-USD。
- 回應與 UI 必須標示為內部估算，不可稱為供應商實際帳單。

## A6 精確文案（本輪已批准）

以下均為 HTTP 429；四種語意展開日／週變體共六列，與 Spec／UX 逐字相同。

| 語意／窗口 | code | quotaScope | userTitle | userMessage | actionableStep |
| --- | --- | --- | --- | --- | --- |
| 日耗盡／day | `DAILY_QUOTA_EXHAUSTED` | `all` | 當日額度已滿 | 當日額度已滿，請在下一個日額度週期後再試。你仍可查看公開內容。 | 請在下一個日額度週期後確認最新額度，再手動重試。 |
| 週耗盡／week | `WEEKLY_QUOTA_EXHAUSTED` | `all` | 每週額度已滿 | 每週額度已滿，本週需由管理者核准追加額度才能繼續使用付費功能。你仍可查看公開內容。 | 請聯絡管理者申請本週追加額度；核准或進入下一個週額度週期後，確認日／週額度均足夠再手動重試。 |
| below_floor／day | `DAILY_QUOTA_EXHAUSTED` | `all` | 今日剩餘額度不足預留門檻 | 今日額度尚未用完，但剩餘額度不足目前可用付費功能的預留門檻，付費功能暫時無法使用。你仍可查看公開內容。 | 請稍後確認最新額度，或在下一個日額度週期後再確認；週額度追加不會提高當日上限。額度足夠後再手動重試。 |
| below_floor／week | `WEEKLY_QUOTA_EXHAUSTED` | `all` | 本週剩餘額度不足預留門檻 | 本週額度尚未用完，但剩餘額度不足目前可用付費功能的預留門檻，付費功能暫時無法使用。你仍可查看公開內容。 | 請稍後確認最新額度，或聯絡管理者申請本週追加額度；追加不保證恢復，仍須確認日／週額度均足夠，再手動重試。 |
| request 不足／day | `DAILY_QUOTA_EXHAUSTED` | `request` | 今日剩餘額度不足以處理這次請求 | 今日／本週剩餘額度不足以預留這次操作，僅本次操作無法執行；其他功能仍會依各自的資格、額度及防護狀態判斷是否可用。 | 請依這項功能支援的方式減少輸入量，或改用其他較低成本功能；確認最新額度後再手動重試。 |
| request 不足／week | `WEEKLY_QUOTA_EXHAUSTED` | `request` | 本週剩餘額度不足以處理這次請求 | 今日／本週剩餘額度不足以預留這次操作，僅本次操作無法執行；其他功能仍會依各自的資格、額度及防護狀態判斷是否可用。 | 請依這項功能支援的方式減少輸入量，或改用其他較低成本功能；確認最新額度後再手動重試。 |

可信邊界：先確認成本 context 有效，再以同次原子拒絕 snapshot 分類；`limit − used ≤ 0` 為 exhausted，未耗盡且 `remaining < G` 為 below_floor，日／週皆全域可用但本次 `R_e` 不足才為 request。G 沿用最大合法輸入預留門檻，不改為最小輸入成本。跨類取 exhausted > below_floor > request，同類日優先。public 信封不增加 state／reason／window／G；後端直接選文案，前端不得從 code／quotaScope／金額自行重建狀態。

恢復條件與 [Spec A6](../spec.md) 一致：日耗盡只待新日窗口；週耗盡待該週有效追加或新週窗口，仍檢查日上限。below_floor 可能因可信結算／釋放預留、重置或週追加恢復；uncertain 不自動釋額，且**週追加不提高日上限，也不保證追加金額足夠**。request 可減少該功能支援的輸入量或等待餘額恢復；不新增縮圖／錄音處理行為。每次恢復皆重新確認資格、成本 context 與日／週額度，手動重試，不承諾確切恢復時間。

## 範例（四種 A6 提案完整信封；待批准、待測）

### 429 日額度

```json
{
  "success": false,
  "error": {
    "code": "DAILY_QUOTA_EXHAUSTED",
    "userTitle": "當日額度已滿",
    "userMessage": "當日額度已滿，請在下一個日額度週期後再試。你仍可查看公開內容。",
    "actionableStep": "請在下一個日額度週期後確認最新額度，再手動重試。",
    "quotaScope": "all"
  }
}
```

### 429 request 不足：本週僅本次操作無法預留（其他較低成本功能與地圖不受影響）

```json
{
  "success": false,
  "error": {
    "code": "WEEKLY_QUOTA_EXHAUSTED",
    "userTitle": "本週剩餘額度不足以處理這次請求",
    "userMessage": "今日／本週剩餘額度不足以預留這次操作，僅本次操作無法執行；其他功能仍會依各自的資格、額度及防護狀態判斷是否可用。",
    "actionableStep": "請依這項功能支援的方式減少輸入量，或改用其他較低成本功能；確認最新額度後再手動重試。",
    "quotaScope": "request"
  }
}
```

### 429 週額度

```json
{
  "success": false,
  "error": {
    "code": "WEEKLY_QUOTA_EXHAUSTED",
    "userTitle": "每週額度已滿",
    "userMessage": "每週額度已滿，本週需由管理者核准追加額度才能繼續使用付費功能。你仍可查看公開內容。",
    "actionableStep": "請聯絡管理者申請本週追加額度；核准或進入下一個週額度週期後，確認日／週額度均足夠再手動重試。",
    "quotaScope": "all"
  }
}
```

### 429 below_floor：今日尚有額度但不足預留門檻

```json
{
  "success": false,
  "error": {
    "code": "DAILY_QUOTA_EXHAUSTED",
    "userTitle": "今日剩餘額度不足預留門檻",
    "userMessage": "今日額度尚未用完，但剩餘額度不足目前可用付費功能的預留門檻，付費功能暫時無法使用。你仍可查看公開內容。",
    "actionableStep": "請稍後確認最新額度，或在下一個日額度週期後再確認；週額度追加不會提高當日上限。額度足夠後再手動重試。",
    "quotaScope": "all"
  }
}
```

以上刻意省略 `retryAfterSeconds`，不假造秒數；其他日／週變體依六列表逐字輸出。非 A6 的既有 503／圖磚範例如下，不變更其契約。

### 503 防護服務故障

```json
{
  "success": false,
  "error": {
    "code": "PROTECTION_SERVICE_UNAVAILABLE",
    "userTitle": "無法確認使用狀態",
    "userMessage": "保護服務暫時無法確認使用狀態，付費功能先暫停。請稍後再試。",
    "actionableStep": "你仍可查看公開內容，稍後再手動重試付費功能。"
  }
}
```

### 429 互動地圖載入次數

```json
{
  "success": false,
  "error": {
    "code": "MAP_TILE_QUOTA_EXHAUSTED",
    "userTitle": "互動地圖載入次數已達上限",
    "userMessage": "今天的互動地圖載入次數已達上限。你仍可查看下方地點清單，或稍後再試。",
    "actionableStep": "請稍後再試，或改用下方地點清單。",
    "retryAfterSeconds": 60
  }
}
```

`MAP_TILE_QUOTA_EXHAUSTED` 屬圖磚代理獨立 request 額度，不代表六個付費 API 的 US$ 日／週額度耗盡；若是全站 upstream credits 上限或 shared store 無法確認，使用 `503 PROTECTION_SERVICE_UNAVAILABLE`。

## 內部額度引擎結果（審查修補 R1；僅 mock 契約，handler 尚未接線）

**本輪原子 G 補充（2026-10-06，待實作）**：429 denied 不再限於 `R_e > remaining`；`remaining < G` 即使能負擔 R_e 仍須拒絕。新 store／engine 回應須以同次原子 G、registry 綁定、usage／limits 與明確內部分類驗證；先 exhausted、再 below_floor、最後 request，跨類取較高、同類日優先。只有兩窗口在預留前同時足 G 與 R_e 且成本／資格有效才有首次 grant，僅扣 R_e。詳見 [Plan §14](../plan.md#14-剩餘實作收斂與統一-readiness-gate)。

revision 不符、當下成本／G 失效、封鎖、原子時間或佐證矛盾一律共用既有 503；不新增 public reason／G／revision、不揭露內部成本、不改 A6 六列、409 或 Retry-After。不得以額外 read 重新分類，亦不得把「已預留」包裝成未知狀態的成功。既有 handler 尚未受新 pipeline 保護；本輪未執行測試。

以下為 `quota-engine` 回給 handler 的內部結果，handler 對外仍須對應回共用錯誤信封：

| 內部結果 | 對外 HTTP／code | 說明 |
| --- | --- | --- |
| `ok:true`＋`executionGrant:true` | 放行 | 唯一可呼叫上游的結果（建立預留的那一次） |
| 409 `DUPLICATE_REQUEST`（內部 `executionGrant:false`；reservation status 不轉送給呼叫端） | 409 | 同鍵同內容重複；reserved／settled／released／uncertain 一律不放行。狀態查詢契約完成前不得假設有查詢動作或成功結果 |
| 409 `IDEMPOTENCY_CONFLICT` | 409 | 同鍵不同內容（金額、指紋、價表版本、輸入） |
| 403 `ACCESS_NOT_APPROVED`（`reason`） | 403 | store 內判斷的資格缺失、未核准、撤銷或到期 |
| 429 insufficient（`deniedWindow`） | 429 | 以 store 當下實際上限（含當週追加）判斷 |
| 503 `reason`：`STORE_UNAVAILABLE`／`INVALID_STORE_DATA`／`COST_MODEL_INVALID`／`COST_MODEL_BLOCKED`／`COST_MODEL_UNSUPPORTED`／`COST_BOUND_UNPROVEN`／`COST_REGISTRY_UNAVAILABLE`／`USAGE_OVERFLOW`／`INVALID_CLOCK`／`FINGERPRINT_CONFIG_INVALID`／`TRUSTED_COST_INVALID` | 503 `PROTECTION_SERVICE_UNAVAILABLE` | `reason` 僅供內部稽核，不對外揭露細節；Batch-M2／M3a 原因尚未接線 handler |
| 409 `RESERVATION_LEASE_EXPIRED` | 原付費 API 為 503 `PROTECTION_SERVICE_UNAVAILABLE` | 409 僅內部結算端；逾 lease 才回報，預留已轉 uncertain，餘額保留 |
| 409 `SETTLEMENT_CONFLICT` | 原付費 API 為 503 `PROTECTION_SERVICE_UNAVAILABLE` | 409 僅內部結算端；同一 reservation 的已套用 transition 相同、但金額／reason 語意／結算模型版本不同；不得改變額度或回成功形狀 |
| 409 `INVALID_SETTLEMENT_TRANSITION` | 原付費 API 為 503 `PROTECTION_SERVICE_UNAVAILABLE` | 409 僅內部結算端；reservation 已進入不同終態，uncertain 後到達的結果僅記錄，不改變額度 |

### C1 核准收斂（2026-10-06；僅建立隔離契約，不實作 handler）

| 內部結算狀態 | 佐證與原付費 API 對外語意 |
| --- | --- |
| `settlementStatus: accounted` | 正常狀態轉移與 usage 佐證有效；代表內部已套用記帳（含釋放或保留），不帶通用 `ok:true`；原 API 依原請求結果處理 |
| `settlementStatus: accounted_cost_bound_exceeded` | 超額完整入帳，版本與摘要雙封鎖佐證有效；內部明確為「已入帳，但成本上界遭突破」，帶 `ok:false`、503、`PROTECTION_SERVICE_UNAVAILABLE` 與內部 `COST_BOUND_EXCEEDED`；不得當成一般成功 |
| 驗證失敗／結果未知 | usage 或任一佐證矛盾／缺漏、store timeout 等仍回 503；未帶已入帳狀態不等於尚未入帳，不退款、不重送上游 |

只有 store 在同一原子結算結果中回傳與該筆超額相符的 `blockedCostModelVersion` 及 `blockedCostParametersDigest`，引擎才可標示超額已入帳。缺少或矛盾的任一封鎖佐證必須 fail closed。所有有 reservation 的結算結果須同次提供原窗口 usage 與身分／日週窗口歸屬，核對原預留不可變資料及狀態轉移；`settled` 的兩窗口 used 至少涵蓋本筆 charge，`reserved`／`uncertain` 的 reserved 至少涵蓋本筆預留，不要求總計等於單筆。applied、already_applied、lease_expired、衝突／晚到結果均適用，不得額外非原子 read 拼湊佐證。cleanup 同次提供逐筆 uncertain 與原窗口 usage；部分完成或 timeout 後可重跑，不退款、不重授執行權。

新預留的 createdAt 須等於可信 command 時間，leaseExpiresAt 須等於該時間加注入 lease；收到回應並授權時若已到達 leaseExpiresAt 即拒絕。歷史預留可過期讀取／保守結算，不套用新授權的即時有效性要求。既有結算／清理的 lease 邊界語意維持不變，正式逐端點秒數待 T136。

版本與摘要在原子預留內共同判斷，不接受相同參數改版本解封，也不接受同版本同端點不同摘要。型別／記憶體 mock 證據不代表 Redis/Lua 已驗證；既有預留保守結算不因當前 registry 到期、封鎖或故障而受阻。
