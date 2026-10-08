# Contract: 身分驗證、Session 與額度狀態端點（提案）

**E01／E06最後版本本機狀態**：T157～T161已接線並隔離驗證。`POST /api/me/operation-status` body互斥`{endpoint,idempotencyKey}`或`{endpoint,requestEpochId,operationHandle}`，混欄位400；原1024 B／4096 B、Session／資格／CSRF／限流及四projection文案不變。epoch查詢不帶capability、不檢查其到期、不授grant，由本人accounting index查reservation／tombstone／accounting，非本人與未知同404。簽發同命令確認仍重驗當下資格、撤銷、退役及到期，不補簽／延期。production export仍503，legacy索引未清，沒有cutover。下方epoch尚未接線敘述是歷史。

**2026-10-07 Epoch本機批准界線**：[E01／E06](request-epoch-and-key-lifecycle.md#9-e01e10-完整推薦決策包2026-10-07唯一集中答案)已批准同一簽發入口以原命令手動確認unknown，並於既有D10本人status加入互斥epoch／handle lookup DTO。本機可實作與隔離測試，不改原D10／D11分支、不啟用production factory或legacy cutover。正常signing verify-only不阻擋仍有效且未grant舊capability首次執行，惟本人Session／資格／限流／成本／epoch authority／原子首次grant須全部成立。本人status唯讀、不grant；到期／退役不追溯作廢accounting，未知／他人同404、403優先。

**2026-10-07 D13 現行本機狀態**：指定 `openid-client@6.8.8` binding 已安裝及本機驗證，以library discovery／URL／code grant＋PKCE／nonce／state與強制JWKS簽章驗證接既有flow。所有期限與claims policy仍明列注入，未採D13歷史候選預設；opaque Session每次查store，無Session簽章key，OAuth state-cookie HMAC獨立。下方真實library「待安裝／未接線」是批准前歷史；本機簽章證據不是真實Google帳戶／Redis／部署驗收，正式exports仍未配置。[Epoch草案](request-epoch-and-key-lifecycle.md) 不改本契約D10／D11或新增入口。

**狀態**：本輪已取得 L1～L5 本機實作授權，並建立可注入的 auth／Session／quota／map endpoint factories；預設未配置均 fail-closed。本機 mock 不代表真實 Google token 簽章／JWKS、共享 Session store 或 OAuth 整合完成；OAuth app／callback／secret 與外部啟用仍待獨立批准。詳見 [本機證據](../../../docs/verification/005-local-implementation-evidence.md)。

**2026-10-07 D13／D14 同步**：`openid-client@6.8.8`（依賴鎖定 `jose@6.2.12`、`oauth4webapi@3.8.8`）為待批准真實 binding 建議，非目前已安裝 package 或 auth 契約；runtime 證據、Google test project、client、secret 與 Preview callback 均待各自批准。驗證範圍、操作包及安裝 gate 見[最新決策包](../readiness-decisions.md)。

## 原則

**本次D06已批准**：Session24小時絕對有效、無滑動續期，cookie86400秒；OAuth state5分鐘單次有效、cookie300秒。SessionexpiresAt＋24小時才可清理，撤銷不延長。未callback之state到期即失效，由可注入有界原子清理在expiresAt≤Redis TIME時刪除；create／consume／cleanup序列化，清理不刪有效state、不退還callback資格。實際清除時間由尚未批准的排程決定。

## D10／D11 契約（2026-10-07 最新明確批准）

本節具體契約已取得 L1～L5 本機實作授權；外部啟用仍未批准。D10 查詢30/min、D11異動共用10/min、清單60/min，共享固定60秒桶。所有操作明確手動觸發、不自動 polling／重送。

| 面向 | 已批准具體契約 |
| --- | --- |
| 本人狀態查詢 | `POST /api/me/operation-status`，`{endpoint,idempotencyKey}`；Session→有效資格→限流→owner lookup；same-origin／CSRF、no-store；不reserve、grant、還原結果或自動poll |
| 狀態projection | 只回state、updatedAt、userMessage；reserved／settled／released／uncertain；未知／非本人同404，不洩露id、價格或摘要 |
| 查詢大小 | body1024 B、response4096 B；超限明確拒絕，不截斷 |
| 提出申請 | `POST /api/me/requests`；paid_access／weekly_top_up、idempotencyKey、reasonCode，top-up帶當週key；201新建／200duplicate |
| reasonCode白名單 | paid_access僅`paid_feature_access`；weekly_top_up僅`weekly_limit_review`／`weekly_floor_review`；其他400，不存自由文字、requestedAmount、tier、照片或位置 |
| 本人清單 | `GET /api/me/requests`，offset預設0（0～999999）、limit預設25（1～100）、nextOffset；必須owner filter而非管理端權限；完整JSON信封≤65536 B，減少項目並以offset＋實際回傳筆數續頁，不漏項、不截斷；單筆即超限503 |
| 撤回 | `POST /api/me/requests/{reviewId}/withdraw`只pending；不存在／非本人同404，已處理409；withdrawn不撤銷已核准權利 |
| 大小與排隊 | body2048 B；本人／類型／當週一筆pending，只防重複排隊，不限制管理者追加次數／累計 |
| 權限 | 有Session但未核准／撤銷／到期可提出paid_access；top-up需目前有效資格但不以週額度gate阻擋；不在login代提 |

上表「候選／待審」為歷史提案標籤，本次均已批准。withdraw body `{}`。本人DTO僅reviewId／kind／reasonCode／createdAt／status及top-up weekWindowKey；withdrawn為終態。按reviewId穩定排序後owner filter分頁；nextOffset不能超過合法offset。申請冪等與pending去重／最小user event同次原子寫入；撤回與管理resolve同authority線性化。跨週top-up不能核准到新週；不限制管理者自主追加次數或累計金額，不新增保存／輪替設定。所有回應no-store。

**2026-10-07既有port本機補足**：新增可注入[Redis OAuth state store](../../../api/_lib/redis-oauth-state-store.ts)，依既有record的明列expiresAt執行單次原子create／consume，state碰撞不覆寫、同state只可消耗一次、到期無交換資格；尚未組裝正式factory或配置正式期限，未使用state的清理與真實Redis／OIDC仍待接續。本機E01簽發入口不等於正式auth factory啟用，也不把mock當真實JWT／JWKS或Redis驗證。

**2026-10-06 接續本機實作**：Session 已有可注入 Redis lookup/create/revoke 與參數化過期清理；每次有效 opaque Cookie 都查共享 store，簽章不取代此查詢、登出或目前付費資格檢查。OIDC provider 程式以可注入通用 library adapter 執行 code exchange／token 驗證與 claims 防護，不自製 JWT crypto 取代已批准 library 架構。真實 library 安裝／JWKS、外部 OAuth 與正式期限仍待各自批准或證據。

- 登入不等於付費 API 核准。
- Session 有效性每次由後端查 shared store；App Cookie 僅 opaque ID，不假設簽章 key。OAuth 暫存 Cookie 的 HMAC 只保護 state，不取代單次 consume。
- 前端取得的 session/quota/map 狀態只供 UX 顯示，不授權六個付費 API。
- eligible map回應同步包含同次authority日／週reset較早者`resetAt`，落實已批准30秒／reset失效；缺失／非法時UI不得掛圖。
- 所有 `/api/auth/*` 與 `/api/me/*` 回應不得進 PWA cache。

## Cookie

| Cookie | 用途 | 屬性提案 | 備註 |
| --- | --- | --- | --- |
| OAuth 暫存 Cookie | callback 比對 `state`/PKCE | `HttpOnly; Secure; SameSite=Lax`，短效、單次有效 | 不可用 `Strict`，否則 OIDC 跨站導回可能不帶 cookie |
| App Session Cookie | 同源 API Session | `HttpOnly; Secure; SameSite=Strict` | 內容為 opaque `sessionId`；每次查 shared store |

## `GET /api/auth/login`

導向 OIDC provider。設定 OAuth 暫存 Cookie；`state` 僅可包含受控 return target 索引，不得包含任意 URL。

回應：`302 Found`。

## `GET /api/auth/callback`

1. 驗證 `state` 與 PKCE。
2. 交換 authorization code，驗證 OIDC claims。
3. 建立 Session Record，設定 App Session Cookie。
4. 導向受控 return target；無效則回首頁。
5. 不自動補送登入前被拒絕或未完成的付費請求。

回應：`302 Found`。

## `POST /api/auth/logout`

清除 Session Cookie 並刪除或撤銷 Session Record。此操作冪等；無 Session 也回成功。

成功回應：

```json
{ "success": true, "data": { "loggedOut": true } }
```

## `GET /api/auth/session`

供 UI 顯示登入狀態，不揭露核准資格細節。

```json
{
  "success": true,
  "data": {
    "authenticated": true
  }
}
```

未登入不是錯誤：

```json
{
  "success": true,
  "data": {
    "authenticated": false
  }
}
```

## `GET /api/me/quota`

D11本機整合：weekly另回`weekWindowKey`，採同次authority窗口`YYYY-Www`，供手動申請本週追加，不從browser時計推算；查詢不以額度耗盡阻擋。

回傳目前使用者自身可見額度狀態。未登入回 401；已登入但未核准回 403；防護依賴故障回 503。

```json
{
  "success": true,
  "data": {
    "tier": "tier1",
    "currency": "USD",
    "timezone": "Asia/Taipei",
    "daily": {
      "limitEstimatedUsd": "3.00",
      "usedEstimatedUsd": "0.45",
      "reservedEstimatedUsd": "0.10",
      "remainingEstimatedUsd": "2.45",
      "resetAt": "2026-09-26T00:00:00+08:00"
    },
    "weekly": {
      "baseLimitEstimatedUsd": "15.00",
      "activeTopUpEstimatedUsd": "0.00",
      "limitEstimatedUsd": "15.00",
      "usedEstimatedUsd": "2.30",
      "reservedEstimatedUsd": "0.10",
      "remainingEstimatedUsd": "12.60",
      "resetAt": "2026-09-28T00:00:00+08:00"
    }
  }
}
```

金額為內部估算額度，不是供應商實際帳單。

## `GET /api/me/map-eligibility`

供探索附近決定是否可掛載互動地圖。不得當作 `/api/places` 授權；Places 搜尋仍需自己的後端預留。

```json
{
  "success": true,
  "data": {
    "eligibleForInteractiveMap": false,
    "reason": "weekly_quota",
    "fetchedAt": "2026-09-25T10:00:00+08:00"
  }
}
```

`reason` 可為 `eligible`、`auth_required`、`not_approved`、`daily_quota`、`weekly_quota`、`map_tile_quota`、`protection_unavailable` 或 `unknown`。`map_tile_quota` 代表圖磚代理 request 額度已滿，與六端點 US$ 額度分開；`protection_unavailable` 代表 shared store 或全站 upstream credits 狀態無法可信確認。

若額度或資格狀態無法確認，必須回受限狀態或 503，前端不得掛載 `NearbyMap`。
