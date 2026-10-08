# Contract: 獨立管理者儀表板 API（提案）

## 2026-10-08 管理確認本機恢復與可及性

沿既有 FR-039／管理 client 未知同鍵契約補足 UI，不改 API body／後端授權。鍵盤開啟聚焦有名稱的非 modal 確認區，Tab 可到確認／取消；送出前取消回原按鈕；成功異動刷新後焦點留在詳情確認按鈕。錯誤使用 alert、處理中使用 status。

網路、無法驗證回應或503等未知結果保留原完整 command／操作鍵，不允許取消後換鍵；只提供明確手動同鍵確認，沒有自動派送。後續確認若被撤權或其他明確拒絕，不代表先前未知異動未成立。首次明確輸入／權限／限流等拒絕仍可取消修正。同步派送鎖保證同React批次不重複送出；離頁 AbortSignal 只取消 client 等待，忽略晚到 UI 更新，不保證 server rollback。操作鍵仍僅在目前元件記憶體，不新增持久儲存或跨頁恢復承諾。

本機 targeted／browser／SW exclusion 證據見[本次紀錄](../../../docs/verification/005-local-implementation-evidence.md#2026-10-08-獨立本機管理恢復與可及性補足本次現行)。本人 producer／申請 UI 的 T147 與原管理後端已於前批完成，不重開；下方尚未實作之字樣屬歷史。本次不授權正式服務、資料清除、key操作或新增參數。

## E07～E09 本機已接線介面

`POST /api/admin/epoch-lifecycle`僅可由可信composition注入`scope:TEST_ONLY`，預設export未配置503。此入口不是正式清除／輪替授權。

Body為`{operationId,idempotencyKey,step,action,target,reasonCode,dryRun,evidenceRef?,nextVersion?}`；只接受列出欄位。`step`是`inspect|confirm`；`action`是`review_uncertain|retire_epoch|revoke_key|rotate_key|retire_key|cleanup`。三個識別／理由均為1～128字元白名單代碼，target至多256字元；本文、成功信封各4096 B，depth8／nodes256／reader5秒。`actor`與`auditId`由server決定，不接受caller提供。

同operation ID＋step綁定管理者、action／target／理由／evidence reference／next version／dry-run／該步冪等；confirm必須對應同管理者inspect。每次呼叫重新Session／admin／CSRF／限流／可信evidence。reference經server port查驗，不接受client證據布林。duplicate回原audit ID而不二次異動；conflict409、未知404、缺證據／authority503，no-store。每個成立步驟保存必要audit，沒有第二管理者要求。

清理本機batch限100 users、每user100相關reservation records及各100 review／admin-audit；超限拒絕、不部分清理。window aggregate依原Asia/Taipei reset，uncertain只覆核／必要性最小化、不釋額或搬窗口；尚未可信結案的tombstone保留晚到與去重材料。90天輪替只切換預先載入本機key version的權威狀態，四family分離、引用未歸零不退役；`retired`不是secret已刪除。具體模型與矩陣見[Epoch契約](request-epoch-and-key-lifecycle.md)。

**狀態（2026-10-07 接續）**：沿用 L1～L5 本機授權，管理讀取、原子異動／audit、可信逐請求權限、CSRF／冪等與管理 UI 已實作並本機驗證。真實管理者 subject／環境、Redis／TTL 證據與正式提示門檻仍待批准或驗證，不代表正式服務已啟用。申請 producer／enqueue **尚未實作**，須先核定提出申請契約；現有 review queue 只讀取／處理既存申請。詳見 [本機證據](../../../docs/verification/005-local-implementation-evidence.md)。

**2026-10-07 E08／E09本機批准**：uncertain review與key lifecycle採單一可信管理者分步確認；每一異動步驟均由後端重新驗admin subject／當下權限、操作識別、理由、冪等與該步必要帳務／retirement證據，並各自寫audit。無第二管理者要求；UI confirm不取代可信accounting evidence。E07／E08／E09的30天保存、24h／7d／30d review與90天輪替週期均為本機可配置測試參數；不執行正式清除或key輪替，正式帳單／爭議窗口與retirement／restore屏障證據不足時只拒絕或dry-run。

**2026-10-06 週鍵格式統一**：核對後確認只是格式差異，並無週期政策衝突。所有管理追加、額度 engine 與共享 store 均使用 `YYYY-Www`（例如 `2026-W39`），週年及週次採 ISO 8601，窗口仍為 `Asia/Taipei` 週一 00:00 至下一週一 00:00。時區不附加在 key，亦不可由客戶端選擇。只接受核准當下的 canonical 當週 key；舊 suffix、過去／未來週一律拒絕，不做模糊轉換。`expiresAt` 由後端窗口推導；若 request 帶此欄位，只能核對同一個重置瞬間，不得延長期限。

## 權限契約

**D11最新批准（2026-10-07）**：本人producer／清單／withdraw契約已批准，見[auth contract](auth-and-session-endpoints.md)。reasonCode／weekWindowKey進管理審核projection；withdrawn不再出現在pending queue。withdraw與resolve共用原子authority，舊週top-up不得核准為新週；有效核准與金額仍由管理者自主決定，不新增次數／累計上限。paid_access重新申請可審核rejected／revoked／expired，保留expiresAt。使用者event不冒充管理audit。下方待審／尚未授權為歷史。

**2026-10-07 D12批准**：nearLimitPercent＝80，used＋reserved對有效limit，日／週獨立整數比較、週含active追加；僅管理提示、不改授權。下方80%尚待批准敘述為歷史。D11申請producer方向已批准，但reasonCode、本人分頁／回應限額、去重／撤回／錯誤文案是[待審契約](auth-and-session-endpoints.md#d10d11-契約補齊稿方向批准以下細節待審)，不建立新行為或把使用者event冒充admin audit。

- 未登入或 Session 無效：所有管理讀取與異動端點回 `401 AUTH_REQUIRED`。
- 已登入但非管理者：回 `403 ADMIN_REQUIRED`。
- 管理者身分由後端可信來源判定；不得信任前端 role、request body、Header 或 localStorage。
- 所有異動必須防 CSRF、防重複提交，並寫入稽核紀錄。

## 既定端點與本機實作

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/admin/overview` | 核准狀態統計、估算用量彙總、接近上限提示、防護服務狀態 |
| `GET` | `/api/admin/users` | 使用者清單與最少必要識別資訊 |
| `GET` | `/api/admin/users/{identitySubject}` | 單一使用者詳情、日／週額度、六端點摘要 |
| `GET` | `/api/admin/review-queue` | 新使用者付費資格申請與週追加申請 |
| `POST` | `/api/admin/approvals` | 核准、拒絕、切換等級、撤銷 |
| `POST` | `/api/admin/top-ups` | 對指定使用者與指定週建立追加 |
| `GET` | `/api/admin/audit` | 管理異動稽核摘要 |

## 異動 request 共通欄位

```json
{
  "idempotencyKey": "uuid-or-random-string",
  "targetIdentitySubject": "oidc-subject",
  "confirmed": true,
  "reasonCode": "operator_selected_reason"
}
```

`confirmed` 只代表 UI 防誤操作，不能取代後端授權、CSRF 或 idempotency 檢查。

### 核准／拒絕／切級／撤銷

`POST /api/admin/approvals` 除共通欄位外，必填 `action`：

- `approve`／`change_tier`：必填 `tier`，僅接受 `tier1`／`tier2`。
- `reject`／`revoke`：不得帶 `tier`，否則回 400。
- 可帶 `reviewId` 處理對應既存申請；不以首次登入自動建立申請。
- 不接受任意修改 `expiresAt`；切級／撤銷保留既有到期時間，不延長成永久。
- 原子操作在同次 EVAL 同時更新資格／申請狀態與 audit；不得把讀→寫或第二次 audit 寫入當成原子異動。

### 分頁讀取

users、review-queue、audit 使用 `offset`（0～999999）與 `limit`（1～100），預設0／25；非法範圍拒絕而非截斷。回應為 `{success:true,data:{items,nextOffset}}`。只輸出各端點白名單欄位，不回傳原始 store 整筆紀錄。

### 總覽提示門檻

`nearLimits` 由可信後端計算，前端不以四捨五入金額自行判定。UX handoff 的80%是示例，**不是已核准正式門檻**；本機 adapter 只接受明列的可信 `nearLimitPercent`，不設預設。未配置或非法時明確拒絕 overview，不回「沒有人接近上限」的成功假象，其他讀取／異動可獨立使用。fixtures 的80不作正式設定；正式門檻待營運者核定，T076仍部分完成。此提示不參與付費資格或額度授權。

## 週追加 request

```json
{
  "idempotencyKey": "uuid-or-random-string",
  "targetIdentitySubject": "oidc-subject",
  "weekWindowKey": "2026-W39",
  "amountEstimatedUsd": "15.00",
  "scope": "all_protected_endpoints",
  "confirmed": true,
  "reasonCode": "weekly_limit_review"
}
```

建立可省略 `action`（視為 `top_up`）；`expiresAt` 由後端推導，可選值僅供核對同一重置瞬間。可選 `reviewId` 只供既存申請處理。

若提供`expiresAt`，必須為可由`Date.parse`解析的string，與server resetAt同一瞬間；number／null拒絕。當前不是ISO文字文法限定，後端保存canonical UTC ISO字串。不因等價時區文字差異延長期限。

撤銷使用同端點、`action:"top_up_revoke"`，共通欄位外必填 `topUpId`／`weekWindowKey`；不得帶金額。可選 `scope` 僅允許 `all_protected_endpoints`，可選期限僅核對當週 resetAt。建立／撤銷都拒絕非 canonical 或非當週 key。

### 異動成功與重送

approve與top-up均回HTTP200、`{success:true,data:{outcome:"applied",auditId:"..."}}`；相同邏輯操作重送為`outcome:"duplicate"`並沿用auditId。成功body不另回資格／topUpId／額度明細，UI需明確重新查詢而非推算。未知結果不自動重送。

Checkpoint 建議值（2026-09-25 已由營運者核准）：管理者可對指定使用者、指定 `Asia/Taipei` 週別逐次決定追加金額（正值）與追加次數；**不設預設固定次數上限，亦不設累計金額之倍數上限**。同一使用者同一週可同時存在多筆 `active` 追加，週有效額度 = base weekly limit + 該週所有 `active` 追加金額加總。每筆追加僅對指定使用者及該週有效，不跨週；日上限不變。同一 `idempotencyKey` 只套用一次；不同管理者以不同 `idempotencyKey` 建立的追加皆各自累加，不視為衝突。管理者可對個別 `topUpId` 執行撤銷，撤銷僅自週累計移除該筆金額並影響後續新預留，不追溯作廢已存在之 `reserved`／`settled` 金額。因無累計上限，個人週額度機制不保證整站估算成本或供應商實際帳單之上限，須配合供應商帳戶用量監控與管理者操作提醒（見 plan.md §5.3）。

## 稽核紀錄

每次核准、拒絕、切換等級、撤銷、追加與追加撤銷至少記錄：

- `auditId`
- `idempotencyKey`
- `adminSubject`
- `targetIdentitySubject`
- `action`
- `createdAt`
- `before` / `after` 最少必要狀態
- 追加操作的 `amountEstimatedUsd`、`scope`、`weekWindowKey`、`expiresAt`
- 追加操作的同週累計金額、active 追加狀態、冪等結果與跨週到期判定

不得記錄或回傳完整對話、音檔、影像、token、secret、完整邀請名單匯出。

## 非管理者資料外洩限制

401/403 回應不得包含管理資料、使用者清單、quota 明細、稽核摘要或「此帳號是否為管理者候選」等可推論資訊。
