# Phase 1 Data Model: 005 API 防護、核准存取與預算額度

## 2026-10-07 Epoch 語意與候選資料對照（本輪現行）

**本機模型已接線**：authority包含revision／generation／watermark／revokedKids與UTC epoch定義；restore floor由獨立可信composition注入，不從舊Redis backup自證。immutable issuance以command index存原bytes，handle index只供本人派生lookup；grant同次寫本人accounting index及原窗口reservation。30天detail收斂成comparison tombstone；uncertain保留原lease、金額、窗口、settlement去重／late reference，沒有TTL退款。terminal在可信retirement屏障後才可去comparison；accounting與legacy索引仍保留。window reset＋30天只收斂非必要欄位，未結案保留最小數值；缺帳單／屏障證據不刪aggregate。管理命令保留每步binding，audit本來只保存必要actor／operation／reason／evidence reference，不保存內容或secret。正式schema／保存仍未生效。

E01～E10推薦方案已批准供本機程式與隔離測試使用，非production schema或保存生效。issuance、epoch authority、comparison與accounting仍須分離；新增狀態採本機介面可配置，不新增資料庫／服務。30天保存與90天key輪替週期皆只作可注入本機參數；不生成正式秘密、不執行正式資料／key清除。正式清除須帳單／爭議窗口、退役屏障、完整引用歸零及restore／rollback證據；證據不足只能拒絕或dry-run。欄位／編碼詳見[契約§9.1～§9.2](contracts/request-epoch-and-key-lifecycle.md#91-e01e04-候選精確編碼與接線)。

| 概念／狀態 | 語意／資料邊界 |
| --- | --- |
| capability signing verify-only（已批准語意） | 驗證輪替前已簽發且仍有效capability；不簽新capability。尚無grant者在全部gate成立後可原子首次grant，不能把issuance record誤認成reservation。 |
| fingerprint verify-only（已批准語意） | 只比較既有operation所記載的version／fingerprint／原pinned cost；不建立新binding，不把重送當新operation。首次執行的舊capability以當時current fingerprint key綁定。 |
| revoked／retired（已批准語意） | 擋新grant；既有accounting reference／原window／amount、uncertain占用及保守結算不追溯作廢。key狀態不等於secret已實際刪除。 |
| issuance（P候選） | owner scope／version、epoch／generation、command index、immutable capability bytes、handle、signing version、issuedAt／expiresAt；同命令回原bytes，不補簽。 |
| epoch authority（P候選） | 同slot的current／單調generation／retirement watermark／revoked versions；非個人永久deny屏障與獨立manifest／restore floor，不增加identity資料庫。 |
| comparison與accounting（P候選） | tombstone可清與accounting可清分開；retire只解除comparison必要性，不釋放reserved或uncertain。原窗口及settlement去重／可信evidence reference依對帳保存。 |

30天／90天僅為本機程式及測試參數，不代表正式保存政策或已輪替key；`retired` 不等於secret已清。legacy／D11自由key不因本機epoch測試而清除；正式cutover與清理仍未批准。

**2026-10-07 D13／D07–D08 現行界線**：OIDC library binding與可信decoder本機接線不新增持久資料；provider token只在交換驗證區域暫用，不保存，影像只做記憶體完整解碼。Session仍opaque ID＋逐請求lookup，無Session簽章key欄位。[Epoch／key生命週期草案](contracts/request-epoch-and-key-lifecycle.md) 只列候選資料／清除前提，未加入schema／TTL、未清除既有索引或key。下方「state清理未實作」是各批歷史；現行已批准期限不變。

## D10／D11 已批准資料擴充（2026-10-07，優先於歷史）

AdminReview新增reasonCode、weekWindowKey（pending去重當週；top-up公開）、withdrawn終態與withdrawnAt；targetIdentitySubject／reviewId／createdAt／status由server產生。申請索引按owner＋idempotencyKey保存內容指紋與reviewId；pending按owner／kind／canonical當週去重，同次EVAL寫申請、索引及最小user actor event（enqueue／withdraw、subject、reviewId、時間），不寫admin audit。使用者DTO僅contract白名單、不保存自由文字／申請金額／tier。管理resolve與withdraw共用admin-reviews hash；無新增TTL／保存／epoch政策。狀態查詢從本人reservation索引唯讀projection，updatedAt採最後狀態異動時間；不回原內容或grant。本人清單按reviewId排序、owner filter後分頁，完整成功信封bytes上限與nextOffset由HTTP層核對。

## 2026-10-07 本次批准與本機資料同步（優先於歷史）

- Session絕對24小時、無滑動續期；expiresAt後24小時才清除，revokedAt不改expiresAt。
- OAuth state有效5分鐘。`oauth-states` hash與`oauth-state-expiry` sorted set同hash-tag，create同EVAL寫record／expiry score、consume同EVAL移除兩者。cleanup依Redis TIME以`ZRANGEBYSCORE ... LIMIT`限制實際處理筆數，先驗整批再刪，不用HSCAN COUNT冒充硬界線；可注入batchSize、可重跑，不保存provider token或清理內容log。失效時間是expiresAt；實際清除時間是cleanup的cleanedAt，沒有批准scheduler。
- 本機rate key為server HMAC去識別化入口／subject＋固定bucket，Redis TIME決定60秒窗口；string counter以PX保留當前窗口加60秒緩衝，來源未核定不猜client IP。HMAC正式生命週期待D08，不接正式factory或生成正式secret。
- eligible map DTO增加同次authority日／週reset較早者`resetAt`，只讓UI失效，不宣告資格恢復；不是新增grant。
- tile首次leader回傳reservedAtMs／leaseExpiresAtMs，用以核對15秒lease與派送剩餘預算；不把時間帶入公開PNG。
- D11 reasonCode／withdrawn／本人分頁等資料新增已明確批准，依最上方本機擴充；不接正式store。D07／08有限明細、最小tombstone、uncertain封存與HMAC退役方案見[決策修訂](readiness-decisions.md)，不套90／180天或輪替預設、不刪既有冪等索引。

**2026-10-07 D07／D08 生命週期候選（待批准，非本資料模型生效欄位）**：本輪建議的 30 天 detail／aggregate／review retention、30 天人工 uncertain escalation、detail-before-delete 的最小 replay tombstone，以及 current／verify-only／retired key 狀態與 request-epoch 依賴，完整欄位最小化及競態要求僅見[最新決策包](readiness-decisions.md)。此處不新增正式 schema、TTL、epoch 欄位或 cleanup 行為；原已批准 Session 24 小時與 state 5 分鐘政策維持不變，無安全清除前提時不允許只靠 TTL 刪除。

**2026-10-07本機state port儲存對照**：沿用`OAuthStateRecord`的`state`／`nonce`／`verifier`／`expiresAt`，新增[可注入Redis adapter](../../api/_lib/redis-oauth-state-store.ts)以同hash-tag的`oauth-states` hash保存；state為隨機opaque值，不是identity／approval或provider token。`create`拒絕到期／碰撞；`consume`同次EVAL HGET＋HDEL，依Redis TIME拒絕到期，後續callback只得null。nonce／PKCE verifier只供本輪交換，不輸出UI／audit；未使用state的到期清理仍待接續工作。未核定期限／保存／輪替、未建立正式resource、未設定secret、未接線正式flow；20個新增本機tests不是真實Redis／TTL證據。

**狀態**：Technical Plan 架構與初始額度已核准；本文件不建立資料表、外部服務或秘密值，且不構成 implementation 授權。

本資料模型以每位核准使用者獨立日／週額度為核心；不包含匿名付費 Session 或全站停止旗標。

**2026-10-06 接續本機儲存對照**：可注入 Redis adapter 使用同 hash-tag 的 registry/users/sessions hashes。users 的 subject 欄位保存資格、原窗口用量、reservation、冪等索引與週追加；管理異動與 audit 同次 Lua 完成。週 key 一律 `YYYY-Www`，不含時區 suffix；台北週一重置不變。Session 仍為 opaque ID 的逐請求 lookup。expiry 清理不釋放 uncertain，Session 保存期僅可參數化注入，沒有正式 TTL 或永久保存預設。本機 Lua/cjson 替身證據不能替代正式共享資源驗證。

**2026-10-06 隔離 pipeline 資料邊界補充（僅文件）**：匿名 admission 只有可信 transport 產生的入口限流 key，不是 Identity Principal、匿名 Session 或付費額度；不信任客戶端 IP／代理 Header。解析與語意／格式／成本驗證先於預留，可信 registry 與後端衍生 estimateInputs 才能進入 engine；預留後仍驗證原子回傳／時間／lease。HTTP 不得接受客戶端 estimateInputs 作成本依據，也不持久化原始 request／精確位置。擬議同次成本 context、mock 邊界及 timeout 注意事項見 [Readiness 報告](checklists/pipeline-readiness-report.md)；不新增存量欄位、保存期限、正式 key 或資料服務。

---

## 本輪補充：原子 registry／G 成本快照（2026-10-06，待實作）

此為 [Plan §14](plan.md#14-剩餘實作收斂與統一-readiness-gate) 的資料契約，不表示現有型別已包含欄位，不核定保存期限、不建立服務。舊 §14.1 隔離契約保留，新增規則適用後續原子 G 任務 T143～T146。

| 內部資料 | 必要欄位／約束 |
| --- | --- |
| Registry bundle | 不可 ABA 重用的單調 `registryRevision`、`bundleDigest`、同一價表版本／半開效期、完整端點成員、逐端點成本摘要／可信 R_max／核准及啟用證據；bundle 不含 request 原文。效期只作有效性核對，不藉此解除原成本摘要封鎖 |
| 權威狀態 | 當前 bundle 指標、版本封鎖與成本摘要封鎖；發布／停用及超額雙封鎖與 revision 改變在同一原子邊界寫入 |
| 單請求 pinned context | bundle 的不可變副本；與 R_e、G、HMAC、reserve command 綁定，不等於可略過當下權威核對 |
| Reserve command | 原可信金額／摘要／HMAC／窗口外，加 expected revision／bundleDigest 與必要成本綁定；HTTP 不提供這些權威欄位 |
| 原子 grant／denied evidence | 同次 revision／bundleDigest、有效成員綁定、G、可信決策時間、usage／limits；denied 有內部分類與 window，grant 只在首次新預留成立；不足／unknown 不補 read 拼證 |
| Reservation | 保留原價表、成本摘要、原窗口與 lease，加授權時 revision／bundleDigest／G 綁定以驗證首次 grant；後續 registry 變更不改原預留或保守結算，不含可還原內容 |
| 原子 map snapshot | 同次 registry 與資格／日週 usage 分類，不預留或扣六端點 US$；僅供當次 map gate，不授權後續 Places／tile |

G 由原子決策時仍可信、有效、已啟用且未封鎖的集合計算；非目標明確失效成員排除，目標失效、空集合或矛盾資料 503。時間自然到期不必自動增 revision，仍須每次以原子可信時間重驗集合／G。store 對兩窗口在預留前檢查 G 與 R_e，只扣 R_e；跨類優先／同類日優先與日限制獨立有效。revision 改變的舊快照一律 fail-closed，不自動刷新重試。

欄位均不新增至 public 信封／查詢 DTO；不改 HMAC 成本內容、key 版本政策或現有 `costParametersDigest` 定義。TTL、audit 保存、HMAC 輪替與正式 keys 尚未定案；本機只使用明確 fixture。真實 key/hash-slot 必須容納 registry、封鎖、資格、追加及日週用量的同一原子操作，證據另屬 T019。

## 1. Identity Principal

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `identitySubject` | `string` | OIDC provider 驗證後的穩定 subject；授權唯一可信主鍵之一 |
| `displayName` | `string?` | 管理者顯示用最少必要資訊 |
| `maskedContact` | `string?` | 遮蔽後 email 或聯絡資訊；不得作為授權主鍵 |
| `createdAt` | ISO timestamp | 第一次登入或建立紀錄時間 |

## 2. Authenticated Session

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `sessionId` | `string` | 隨機 opaque key；Cookie 只存此值與簽章 |
| `identitySubject` | `string` | 對應 Identity Principal |
| `createdAt` | ISO timestamp | 建立時間 |
| `expiresAt` | ISO timestamp | 過期時間；shared store 查詢為權威 |
| `revokedAt` | ISO timestamp? | 登出或管理撤銷 Session 時填入 |

狀態：不存在／過期／`revokedAt` 有值皆視為未登入，對受保護端點回 401。

## 3. Paid Access Approval

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `identitySubject` | `string` | 目標使用者 |
| `status` | `'pending' \| 'approved' \| 'rejected' \| 'revoked' \| 'expired'` | 付費 API 使用資格 |
| `tier` | `'tier1' \| 'tier2' \| null` | 只有 `approved` 可有 tier |
| `approvedAt` | ISO timestamp? | 核准時間 |
| `expiresAt` | ISO timestamp? | 若核准有期限 |
| `statusChangedAt` | ISO timestamp | 最近狀態變更 |
| `statusChangedByAdminSubject` | `string?` | 執行異動的管理者 |

狀態轉換需由管理者儀表板原子操作完成。登入不會自動建立 `approved`。

## 4. User Quota Window

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `identitySubject` | `string` | 每位使用者獨立額度 key |
| `windowType` | `'day' \| 'week'` | 日或週窗口 |
| `windowKey` | `string` | 以 `Asia/Taipei` 計算，例如 `2026-09-25`、`2026-W39` |
| `limitEstimatedUsdMicro` | `integer` | tier base limit 加該週所有 `status: active` 週追加金額加總（週窗口才有追加；無固定次數或倍數上限） |
| `usedEstimatedUsdMicro` | `integer` | 已結算估算額度 |
| `reservedEstimatedUsdMicro` | `integer` | 在途預留估算額度 |
| `resetAt` | ISO timestamp | 後端計算之下一次重置時間 |
| `updatedAt` | ISO timestamp | 最近更新 |

金額建議以 micro-USD 或等效整數單位儲存，避免浮點誤差；UI 顯示再格式化為 US$0.00。

`G`（全域不可用地板值）不是儲存欄位，而是依當下權威 registry／價表、有效期、實際啟用與版本／摘要封鎖狀態，按 A8＝G-B 計算可用端點之最小 `R_max`；不得固定於建置期或使用歷史 fixture G 作正式門檻。限額判斷以 `remaining_day`＝`limit − used − reserved`、`remaining_week`＝`base limit + active 追加 − used − reserved` 與 `G` 比較（plan.md §4.5）。正式權威來源整合尚未完成。

## 5. Quota Reservation

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `reservationId` | `string` | 原子預留產生 |
| `idempotencyKey` | `string` | 防重複提交 |
| `identitySubject` | `string` | 使用者 |
| `endpoint` | `ProtectedEndpoint` | 六端點之一 |
| `estimatedCostUpperBoundUsdMicro` | `integer` | 呼叫前可信最大估算成本 `R_e`（公式與數值見 plan.md §4.2） |
| `costModelVersion` | `string` | 價表／公式版本（含模型白名單、單價、`S`、`A`），使結算與稽核可重現 |
| `estimateInputs` | endpoint-specific allowlisted object | 僅 §15.1 明列數值／detail enum；未知鍵、任意字串、對話、音訊或圖片內容不得保存 |
| `requestFingerprint` | HMAC-SHA-256 hex | v2 最終 keyed 指紋；不保存內容 HMAC 中間值或普通內容摘要 |
| `fingerprintKeyVersion` | opaque version string | 非秘密 key 版本識別；不是金鑰，也不代表輪替政策已批准 |
| `settlementEstimateUsdMicro` | `integer?` | 結算估算（依 usage／解析時長／固定 SKU）；與預留、供應商實際帳單為三個不同數值，不得互相取代 |
| `quotaScopeOnReject` | `'all' \| 'request'?` | 預留被拒時記錄範圍；`all` 表示 exhausted 或 below_floor，`request` 僅本次預留不足（plan.md §4.5）；不能僅據 scope 選耗盡文案，A6 六列為本次待批准方案，不新增持久欄位 |
| `status` | `'reserved' \| 'settled' \| 'released' \| 'uncertain'` | 預留生命週期 |
| `dayWindowKey` | `string` | 日窗口 |
| `weekWindowKey` | `string` | 週窗口 |
| `createdAt` | ISO timestamp | 建立時間 |
| `settledAt` | ISO timestamp? | 結算時間 |
| `settlementReason` | enum? | 僅允許明列結算語意（例如 `success`、`explicit_unbilled_failure`、`timeout_uncertain`、`lease_expired`）；不得接受呼叫端任意字串 |
| `leaseExpiresAt` | ISO timestamp | 端點最長執行時間加結算緩衝；不使用所有端點共用的固定秒數，具體秒數尚未核准 |
| `settledChargeUsdMicro` | `integer?` | 實際入帳的內部估算金額；重複結算須與原金額及結算語意相同才可回報已套用 |
| `overrunMicroUsd` | `integer?` | 超出原預留的金額；超額結算須可由紀錄查驗 |
| `lateOutcomeObserved` | minimal enum + timestamp? | `uncertain` 後的晚到結果僅記錄，不改餘額、不退款 |

## 6. Weekly Top-Up Grant

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `topUpId` | `string` | 追加核准 ID |
| `targetIdentitySubject` | `string` | 指定使用者；不可跨使用者 |
| `weekWindowKey` | `string` | 僅指定 `Asia/Taipei` 週有效 |
| `amountUsdMicro` | `integer` | 追加金額（正值）；管理者逐次決定，無預設固定次數或累計倍數上限（2026-09-25 已由營運者核准，見 plan.md §5.2） |
| `scope` | `'all_protected_endpoints'` 或 endpoint list | 第一版建議全六端點共用 |
| `status` | `'active' \| 'revoked' \| 'expired'` | 狀態；同一使用者同一週可同時存在多筆 `active` 紀錄，週累計為所有 `active` 金額加總 |
| `approvedByAdminSubject` | `string` | 管理者可信 subject |
| `createdAt` | ISO timestamp | 建立時間 |
| `expiresAt` | ISO timestamp | 最晚該週週一 00:00 後的新週開始時到期 |
| `idempotencyKey` | `string` | 防重複提交；同一 key 只套用一次 |

追加只增加週可用額度；每日上限不變。撤銷（`status → revoked`）僅自週累計上限移除該筆金額並影響後續新預留判斷；已存在之 `reserved`／已結算之 `settled` 金額不因撤銷而追溯作廢。

## 7. Admin Principal

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `adminSubject` | `string` | 管理者可信 subject |
| `source` | `'env_allowlist' \| 'admin_record' \| 'oidc_claim'` | Checkpoint 決定 |
| `active` | `boolean` | 是否有效 |
| `createdAt` | ISO timestamp | 建立時間 |
| `revokedAt` | ISO timestamp? | 撤銷時間 |

第一版推薦 `env_allowlist` 作 bootstrap；若採 `admin_record`，異動本身也需稽核。

## 8. Admin Audit Entry

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `auditId` | `string` | 稽核 ID |
| `idempotencyKey` | `string` | 操作冪等鍵 |
| `adminSubject` | `string` | 操作者 |
| `targetIdentitySubject` | `string` | 目標使用者 |
| `action` | `'approve' \| 'reject' \| 'change_tier' \| 'revoke' \| 'top_up' \| 'top_up_revoke'` | 操作類型 |
| `before` | minimal object | 最少必要前狀態，不含敏感內容 |
| `after` | minimal object | 最少必要後狀態 |
| `createdAt` | ISO timestamp | 操作時間 |
| `reasonCode` | string? | 管理者選擇或系統原因碼 |

不得記錄完整對話、音檔、影像、token、secret、完整邀請名單匯出。

## 9. Map Eligibility Snapshot

非授權來源本身，而是後端回給前端的顯示判定，只影響前端是否掛載互動地圖元件；真正授權判斷在每一筆圖磚代理請求時重新執行（見第 10～12 節）。

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `eligibleForInteractiveMap` | `boolean` | 僅資格有效、必要額度可用（`remaining_day ≥ G` 且 `remaining_week ≥ G`）且防護狀態可確認時 true；單一端點預留不足不影響此值 |
| `reason` | `'eligible' \| 'auth_required' \| 'not_approved' \| 'daily_quota' \| 'weekly_quota' \| 'map_tile_quota' \| 'protection_unavailable' \| 'unknown'` | 前端切換靜態示意圖用；圖磚代理 request 額度與六端點 US$ 額度分開 |
| `quotaSnapshot` | object? | 可顯示之額度狀態；不得授權 Places |
| `fetchedAt` | ISO timestamp | 狀態時間 |

舊分頁仍需重新查詢；snapshot 不可持久化為授權依據。

## 10. Tile Proxy Request（不落地持久化，僅描述逐請求驗證所需輸入輸出）

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `identitySubject` | `string` | 來自 Session，決定核准資格與圖磚額度歸屬 |
| `style` | `string` | 伺服器端固定常數（對齊既有 `osm-bright`），不接受前端輸入 |
| `z` / `x` / `y` | `integer` | Slippy Map XYZ 座標；`z` 介於 `0`–`20`，`x`/`y` 需滿足 `0 <= x, y < 2^z` |
| `cacheKey` | `string` | 由 `style`、`z`、`x`、`y` 組成，用於第 11 節共用快取查詢 |
| `decision` | `'served_cache' \| 'served_upstream' \| 'rejected_auth' \| 'rejected_quota' \| 'rejected_upstream'` | 本次請求結果，用於稽核與監控 |
| `countingOutcome` | object | 同步回傳或記錄本次請求是否增加 `userProxyRequestCount`、`sharedCacheHitCount`、`actualUpstreamRequestCount` 與 `estimatedGeoapifyCredits`；三者不得混用 |

## 11. Tile Cache Entry（代理端共用快取）

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `cacheKey` | `string` | `(style, z, x, y)` 組合 |
| `bodyRef` | 二進位或物件儲存參照 | 圖磚 PNG 位元組；不記錄於稽核日誌 |
| `etag` | `string` | 供瀏覽器條件式請求使用 |
| `sourceCreditCost` | `number` | 該筆快取由上游取得時消耗之 Geoapify credit（固定 0.25） |
| `cachedAt` | ISO timestamp | 寫入時間 |
| `expiresAt` | ISO timestamp | TTL 到期時間；初始基準為已核准的 7 天 |
| `hitCount` | `integer` | 代理共用快取命中次數，用於計算 `sharedCacheHitCount` 與快取效益；不等於使用者請求數，也不等於上游請求數 |

快取命中不代表略過授權；每次回應仍須先通過 Session／核准／額度檢查（見 contracts/map-access-contract.md）。

## 12. Tile Quota Window（獨立於 US$ 額度）

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `scope` | `'user' \| 'site'` | 每位使用者上限或全站防護性上限 |
| `identitySubject` | `string?` | `scope = 'user'` 時填入 |
| `windowType` | `'minute' \| 'day'` | rate（分鐘）或 volume（日）窗口 |
| `windowKey` | `string` | 依 `Asia/Taipei` 計算之窗口識別 |
| `userProxyRequestCount` | `integer` | `scope = 'user'` 時使用；通過 Session／核准後的所有代理請求皆計入，包含快取命中、條件式請求與 304 |
| `sharedCacheHitCount` | `integer` | 可於 site/day 或觀測資料中彙總；代表代理共用快取命中，不消耗 Geoapify credit |
| `actualUpstreamRequestCount` | `integer` | `scope = 'site'` 時使用；實際呼叫 Geoapify 的圖磚請求數 |
| `estimatedGeoapifyCredits` | `number` | `actualUpstreamRequestCount * 0.25`，另含不確定是否已計費而保守結算的預留 |
| `limitRequests` | `integer?` | user proxy request 上限；已核准初始值 120/min、1,000/day |
| `limitCredits` | `number?` | site upstream credit 上限；已核准 Free 初始值 2,400/day；API 10 升級後 8,000/day 仍以付費升級另行批准為前提 |
| `resetAt` | ISO timestamp | 下一次重置時間 |

圖磚維持獨立 credit／request 計價模型，不併入 tier1/tier2 US$ 用量扣除；但互動地圖仍受日／週 US$ availability gate 約束。使用者代理請求、公用快取命中與上游 credit 必須明確分離。

## 13. Tile Upstream Credit Reservation

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `reservationId` | `string` | 快取 miss 後、呼叫 Geoapify 前產生的全站 credit 預留 |
| `cacheKey` | `string` | `(style, z, x, y)`；同一 in-flight tile key 應共用單一預留與上游呼叫 |
| `creditAmount` | `number` | 固定 0.25 credit；若 Geoapify 未來變更需回 Plan 更新 |
| `siteDayWindowKey` | `string` | 以 `Asia/Taipei` 計算的 site-wide credits 日窗口 |
| `status` | `'reserved' \| 'settled' \| 'released' \| 'uncertain'` | 成功轉 settled；明確未送達／未計費可 release；逾時或不確定是否計費轉 uncertain |
| `createdAt` | ISO timestamp | 預留時間 |
| `settledAt` | ISO timestamp? | 結算時間 |
| `settlementReason` | string? | `upstream_success`、`explicit_unbilled_failure`、`timeout_uncertain`、`network_uncertain` 等 |

此預留只用於全站 Geoapify upstream credits，不得替代每位使用者的 proxy request rate/volume 計數。

## 14. Trusted Cost Model Registry

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `version` | `string` | 由可信後端發布與選用；呼叫端不得指定 |
| `effectiveFrom` / `expiresAt` | UTC timestamp | 半開有效區間 `[effectiveFrom, expiresAt)`；過期或無效即不可使用 |
| `endpoint` | `ProtectedEndpoint` | 此 registry entry 明確適用的端點 |
| `live` | `boolean` | 只有上界證據、核准及實際啟用皆有效才可為 true；production 六端點目前全部 false |
| `blocked` | `boolean` / registry state | 結算超額後該版本封鎖；換版本字串不得移除封鎖 |
| `pricing` / `modelAllowlist` | 明列數值與列舉 | 可信估算器使用的 SKU、限制、單價與白名單；由後端持有，不接受呼叫端覆寫 |
| `approvalEvidenceRef` | opaque reference | 指向可稽核的核准與上界證據；不含 secret |
| `costParametersDigest` | SHA-256 hex | 後端穩定編碼計算之成本設定摘要；不包含請求內容、版本或效期；與核准 metadata、HMAC、預留及原子封鎖綁定 |

估算器必須先驗證 registry 的版本、有效期、端點、`live`、封鎖狀態與證據，再依驗證後請求資料計算預留金額。registry 無效時對外統一回 `503 PROTECTION_SERVICE_UNAVAILABLE`，內部原因不得洩露。

### 14.1 Batch-M3a registry 與原子封鎖（現行隔離契約）

- `CostRegistryEntry` 含 endpoint／version／table、model、billingTier、attempts、estimateBounds、detailAllowlist、blocked 與 approval。approval 須有 approved／activated／upperBoundProven／singleAttemptVerified＝true，priceSourceRef／approvalEvidenceRef／boundEvidenceRef 與相符 parametersDigest；它們是可信伺服器 metadata，tests references 並非正式批准或真實證據。
- 成本摘要涵蓋所有影響估算的模型／白名單、tier、attempts、價格、安全係數、pricing 上界、estimateBounds、detail allowlist；集合排序、係數約分。版本／效期／核准標籤更名不產生新解封鍵。摘要不由 request 提供；reserve 第二參數只有 allowlisted estimateInputs，後端 registry 選參數且估算器算金額。
- reservation 保存 `costParametersDigest`；store 的內部 ReserveCommand 由可信 engine 產生金額與摘要，不是新 HTTP API。store 原子判斷 `(version, endpoint) → digest` 不可變綁定與版本／摘要兩種封鎖；同版本同端點換摘要拒絕，相同摘要換版本仍封鎖。無新 execution grant 的 duplicate 語意保留。
- 超額結算同時封鎖原版本與原摘要；SettleResult 的 `blockedCostModelVersion`／`blockedCostParametersDigest` 必須均吻合 reservation，重送保留相同佐證。既有預留到期／封鎖後仍可依原窗口保守結算，不要求重新通過 registry；lease／uncertain／晚到結果規則不變。
- 真實 adapter 尚未完成，此處只有型別與 memory mock。隔離 state shape 不核定 Redis keys／hash-slot／TTL 或跨 writer 原子性；舊預留格式沒有正式存量／遷移證據。

## 15. Request Fingerprint、Lease 與存取界線

- 請求內容指紋以伺服器持有金鑰的 HMAC 產生，儲存 HMAC 結果而非內容；不得儲存原文、完整對話、音訊或圖片。指紋包含冪等比對所需的主體、端點、可信估算金額、可信價表版本、allowlisted estimate inputs 與內容 HMAC。
- `estimateInputs` 採端點欄位 allowlist；數值欄位須為有限且受界限的整數／數值，enum 欄位只接受指定 literal。不得使用任意字串欄位。
- `uncertain` 保留於記錄的 `dayWindowKey`／`weekWindowKey`；窗口到期不移轉扣額至新窗口。自動清理只可將逾 lease 的 `reserved` 轉成 `uncertain`，重複執行結果須一致。
- store timeout 是未知結果：不得假定 reserve／settle 未完成，不釋放額度、不重放上游；後續必須以可信 store 狀態對帳。
- 只有 quota service 與明確授權的對帳／稽核流程得讀取 reservation；不得提供一般前端、客服或管理 UI 任意查閱 request fingerprint 的能力。稽核輸出限最小必要欄位。
- 保存期限與金鑰輪替機制尚未核准，屬待決事項；不得自行加入期限值、建立金鑰或保存秘密值。

### 15.1 Batch-M2／T139 estimateInputs allowlist（僅隔離契約）

| 端點 | 可保存數值欄位 | 可保存 enum |
| --- | --- | --- |
| assistant | `inputTokens`、`maxOutputTokens` | 無 |
| photo-translate | `inputTokens`、`maxOutputTokens`、`imageBytes` | `detail`: `low`／`high`／`auto` |
| photo-ocr | `inputTokens`、`maxOutputTokens`、`imageBytes` | `detail`: `low`／`high`／`auto` |
| transcribe | `audioDataBytes`、`billedMinutes` | 無 |
| places | 無（僅空物件；query／area／座標等語意內容只參與記憶體 HMAC） | 無 |
| speech | `characterCount`、`speed`（有限正數） | 無；speech 維持受阻 |

- 數值上限必須逐端點由可信參數注入，每個明列數值欄位都需有上限設定；缺少設定不得套用 fixture。數值上限須為有限正值、不超過安全整數範圍；除 speed 外皆為安全整數。
- 各數值輸入須有限且不超過注入上限；除 speed 外皆為非負安全整數，只有 `inputTokens`／`characterCount` 可為 0。speed 必須 > 0；`audioDataBytes` 為正偶數（P1），與 `billedMinutes` 同時存在時須符合 `ceil(bytes / 1,920,000)`。未知鍵、boolean、自由字串、非法 enum、符號鍵、getter 與超界資料均拒絕，不靜默去除。
- 輸入欄位可省略（例如歷史最大上界 mock 使用空物件），但可信上限設定不得省略；這不證明估算器／內容／registry 綁定正確。必要 model、tier、attempts、金額、價表與 endpoint 位於分離的可信參數，不允許塞入 estimateInputs。
- 此表只定義隔離模組的資料型別詞彙，不核准正式端點行為／參數或數值；photo detail 正式選用與 speech 上界仍依原待決政策。測試數值僅在 fixture 中，沒有 production fallback。
- 原始文字、完整語意物件／對話或 binary 只供記憶體 canonical HMAC；store command、reservation 與 mock 稽核輸出只含最終 HMAC 與以上 allowlist。真實服務存取權限／稽核管道仍未接線。

## 16. Cost Model 與 Reservation 狀態轉移

### Cost model registry

| 目前狀態 | 允許的轉移 | 條件／外部行為 |
| --- | --- | --- |
| `draft` | `approved` | 提供端點上界證據、價格來源與審核紀錄；缺任一項不得啟用 |
| `approved` | `live` | 有效期間內，端點適用性與核准條件仍成立，且營運者完成實際啟用；production 目前六端點皆非此狀態 |
| `live` | `blocked` | 結算出現超額時，原子記錄超額與版本封鎖；對外仍統一回 `503 PROTECTION_SERVICE_UNAVAILABLE` |
| `approved` / `live` | `expired` | 時間到達 `expiresAt` 或 registry 區間無效；立即 fail-closed |
| `blocked` / `expired` | 無直接解封轉移 | 不允許改版本字串或更新輸入解封；須建立新版本並重新具備證據、核准、效期及實際啟用 |

### Reservation

| 目前狀態 | 事件 | 下一狀態 | 額度／執行權效果 |
| --- | --- | --- | --- |
| `reserved` | 可信上游成功且結算有效 | `settled` | 核對金額及語意後按原窗口入帳；若高於預留，完整計入並封鎖價表版本 |
| `reserved` | 有可信證據確認未送達且未計費 | `released` | 只在原窗口釋放本筆預留 |
| `reserved` | lease 到期、store timeout 或計費結果不確定 | `uncertain` | 保留原日／週窗口扣額；不退款、不重放、不重新發 execution grant |
| `uncertain` | 收到晚到成功／失敗 | `uncertain` | 僅記錄晚到結果與稽核資料，不更改額度或自動退款 |
| `settled` / `released` / `uncertain` | 同冪等 key 再次 reserve | 狀態不變 | 回 409；不重新取得上游執行權 |

清理器對已處理項目重複執行須保持同一終態與額度；任何狀態或結算證據無法確認時 fail-closed。狀態查詢端點尚未定義，不可由此表推定對一般使用者暴露內部狀態欄位。

**2026-10-06 timeout 讀法澄清**：上表的 store timeout 與 uncertain 並列不能解讀為「timeout 本身已證明或已完成轉態」。依 FR-052 與本文件 §15，timeout 僅表示結果未知，可能未寫入、仍 reserved、已 settled／released／uncertain；只在可信原子結果／後續對帳證明後才能認定狀態。不因 timeout 額外重試寫入、退款或重送上游。本輪不改 store／engine，也不新增對帳服務。

### 16.1 C1／H1／H2 隔離結果契約

結算使用 `settlementStatus: accounted` 或 `accounted_cost_bound_exceeded`，不以通用 `ok:true` 表示成功。後者須如實記帳且同次佐證雙封鎖，原 API 對外 503；usage 或佐證矛盾亦為 503，但不得推論尚未入帳。原子佐證包含 reservation、usage、identitySubject、dayWindowKey、weekWindowKey；settled used 至少涵蓋本筆 charge，reserved／uncertain reserved 至少涵蓋本筆預留，允許其他請求的總量。cleanup 逐筆佐證只涵蓋本次處理項目，可重跑；不可由額外 read 補證。

新預留須核對 command 時間與注入 lease 的精確一致性，授權時已到達 leaseExpiresAt 須拒絕；不要求歷史預留尚未過期。測試 lease 不核定正式秒數，正式 lease、排程、Redis adapter 與可信對帳保持未完成。
