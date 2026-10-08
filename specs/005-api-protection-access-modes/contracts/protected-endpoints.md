# Contract: 六個既有付費端點保護 Pipeline

**E05／E06最後版本本機狀態**：capability／本人handle驗證已接原protected pipeline，JSON的body handle必須等於`Idempotency-Key`；六boundary的格式／CSRF／資格／拒絕路徑及client共用接線已驗。首次grant的epoch、資格、key、registry／G、日週額度與冪等都在原reserve單一EVAL重驗；前置lookup不授權。已有operation以原fingerprint version／pinned cost比較，duplicate／conflict零第二grant。HTTP→verifier→engine→Lua→mock上游恰一次／settle僅在本機Places fixture成立，原Places-only成功限制未解除，其他五個真實成功路徑仍受各自正式gate阻擋。production六端點`live:false`、speech受阻，legacy拒絕只在注入TEST_ONLY配置啟用。

**2026-10-08 隔離 mock-success 子範圍批准**：僅允許 `assistant`、`transcribe`、`places`、`photo-ocr`、`photo-translate` 由各自 `createHandler` factory 注入明確 `TEST_ONLY` descriptor／合成 accounting fixture，驗證 HTTP request→輸入驗證→原子預留→mock upstream→結算→HTTP response。production `POST` export 未配置時仍 fail closed。這些數值只用於隔離程式流程，不能視為可信真實成本上界、正式端點／參數批准或 D01 證據，亦不可進 production registry；production 六端點仍 `live:false`。`speech` 只測輸入與 mock 行為，沒有 lease／成功預留／結算或真實 provider 呼叫。此子範圍不解除任何正式成功限制，不代表 T146 整項完成。

**2026-10-07 Epoch本機批准範圍**：正常輪替後capability signing verify-only可驗證仍有效舊capability、不可簽新capability；尚未grant者在本人Session／資格／限流／成本／epoch authority／原子首次grant全成立後仍可首次執行一次。首次fingerprint用當時current key綁定；已有操作按原fingerprint version／cost binding比較，verify-only fingerprint不把重送當新操作、零第二grant。撤銷／退役擋新grant，不追溯取消原入帳／uncertain占用／保守結算。E01～E10 route／DTO／time／pipeline已批准供本機程式與隔離測試；production六端點仍`live:false`，正式secret／價表／cutover／部署未批准。

**2026-10-07 D13 現行本機狀態**：`sharp@0.35.5` 已批准並接既有 `images.verify`：只接受JPEG／PNG／WebP、3 MiB／2048／單頁，必須完成raw像素解碼；錯誤／截斷／偽裝／動畫／超限／缺設定拒絕。只在本機注入factory驗證，無vision呼叫、存圖或production啟用。D01共用builder／輸入±1／未知model零上游證據不是tokens／影像計費或帳單上界；輸出cap數值仍未批准。六端點`live:false`、speech S1、Places-only成功限制不變。下方decoder「待dependency批准」是歷史；[Epoch完整草案](request-epoch-and-key-lifecycle.md) 尚未生效，不改現行HTTP schema／冪等／清理。

**狀態**：本輪六個真實 `POST` handler 已接拒絕 boundary；未配置 503，注入 fixture 的 401／403／503 有實際函式測試，拒絕不執行上游。尚未完成可成功呼叫上游的完整 pipeline，不能以非 HTTP `executeUpstream` 的歷史內容回歸宣稱完成。原子 registry／G 只有 memory fixture 證據；production 六端點價表仍 `live: false`。詳見 [本機證據](../../../docs/verification/005-local-implementation-evidence.md)。

**2026-10-07 D01／D13 同步**：六端點的 request-size／文字／影像限制不等於上游 token、image billing、SKU 或帳單硬上界。完整逐端點成本前提、本機 bytes 證據、真實供應商 evidence 與最小 review 順序見[最新決策包](../readiness-decisions.md)。影像 decoder 建議 `sharp@0.35.5` 只可接既有 `PaidBoundaryOptions.images.verify(bytes, mime)` seam，仍待 dependency/runtime 批准；不擴大 endpoint／輸入格式契約。六端點 production `live:false`、speech S1 維持。

## 適用端點

**2026-10-07本次批准**：D02解析bytes／depth8／nodes256／5秒reader、UTF-16文字限制與額外欄位拒絕；D03 PCM60秒／大小、D04三格式／2048／3 MiB／regionVersion≤9999999999及後端可信尺寸方向；D05 assistant／photo端點30秒execution＋5秒派送＋10秒settlement＝45秒lease、Places8＋5＋5＝18秒、transcribe45＋5＋10＝60秒；store2秒、REST回應1 MiB。speech不派送，不給可執行lease。grant剩餘必須嚴格大於execution＋settlement。D01尚待完整request／token／影像成本證據，以上限制不解除production停用或原Places-only成功限制。

- `POST /api/assistant`
- `POST /api/transcribe`
- `POST /api/places`
- `POST /api/speech`
- `POST /api/photo-ocr`
- `POST /api/photo-translate`

## 共用 Pipeline

**本輪最新（2026-10-06）**：七檔隔離 helper 已結案，六個既有 handler 尚未接線，仍未受新 pipeline 保護。以下正式管線仍待實作；A6 已批准，下方歷史待批准字樣不重新開 gate。P-G1／P-G2 規劃依 [Plan §14](../plan.md#14-剩餘實作收斂與統一-readiness-gate) 及本節補充，並不宣稱原 engine／store 已完成原子 G。

C1：結算內部 `accounted` 不等於原 API 成功；`accounted_cost_bound_exceeded` 表示已完整入帳但成本上界遭突破，原 API 對外一律 503 `PROTECTION_SERVICE_UNAVAILABLE`。佐證／usage 矛盾亦為 503，不得推論尚未入帳、退款或重送上游。不得以通用 `ok:true` 判斷結算的對外成功。本批僅驗證隔離契約，未建立下列 pipeline 或 handler 回應。

```text
1. Method check: non-POST -> 405 METHOD_NOT_ALLOWED
2. Pre-parse size check: Content-Length + bounded reader -> 413 PAYLOAD_TOO_LARGE
   Header fail-fast precedes Session; actual bounded body read is after eligibility. After the header check, anonymous admission uses trusted transport context only -> 429 RATE_LIMITED / 503; never trusts client IP/proxy headers or reads reservations.
3. Session check: missing/invalid/expired -> 401 AUTH_REQUIRED
4. Approval check: not approved/revoked/expired -> 403 ACCESS_NOT_APPROVED
   Then authenticated rate limit -> 429 RATE_LIMITED / 503.
   Bounded parsing + all semantic/format/cost-related input validation precede reservation -> 400 INVALID_INPUT / 413; derive estimate inputs server-side, never from client estimateInputs.
5. Trusted cost registry + estimate (backend-selected approved version; verify effective interval, live/block state and endpoint applicability; derive amount from allowlisted numeric/enum inputs):
   limit exceeded -> 413 / 400 INVALID_INPUT; invalid/unapproved/expired/unproven/blocked model -> 503 PROTECTION_SERVICE_UNAVAILABLE; never trusts caller amount/version, reserves or calls upstream
6. Atomic registry revision + G + daily + weekly reservation of R_e, after current identity/eligibility validation: insufficient -> 429 DAILY_QUOTA_EXHAUSTED or WEEKLY_QUOTA_EXHAUSTED;
   duplicate -> 409 DUPLICATE_REQUEST; same key/different fingerprint -> 409 IDEMPOTENCY_CONFLICT; neither grants execution or discloses original reservation before eligibility check
   (quotaScope 'all' when remaining < G; 'request' when only this request's R_e exceeds remaining)
7. Validate atomic return, trusted estimation <= command <= grant clock, exact command/lease binding and unexpired first executionGrant; failure/unknown outcome never refunds or regrants
8. Upstream paid call (endpoint-specific maximum execution time; retries disabled per approved plan)
9. Settlement: verify idempotent amount and semantic outcome; update original day/week window; overrun is recorded and blocks the cost-model version with a verifiable result
10. Expiry/reconciliation: repeatable idempotent cleanup converts expired reservations to uncertain; retains reserved amount, never refunds/replays, and records late outcomes without balance mutation
```

Public、未登入、未核准、撤銷、到期、日額度不可用、週額度不可用者皆不得觸發第 8 步。

### 本輪 P-G1／P-G2 原子契約（待實作與驗證）

- 後端固定單請求完整 registry bundle；同份 context 產生 R_e、G、HMAC 與 command。reserve 在同一共享原子邊界核對當下 revision／bundleDigest／可信時間／效期／成員與版本及摘要封鎖，並判斷資格、當週追加、日／週 usage。快照不符、目標失效、空集合或矛盾回統一 503，不自動 resolve／reserve 重試。
- 首次 grant 必須兩窗口在預留前皆 `remaining ≥ G` 且 `remaining ≥ R_e`；`R_e ≤ remaining < G` 仍為 below_floor 的 429 all，無預留／grant／上游。成功只預留 R_e，不扣 G 或 max(R_e,G)。分類 exhausted > below_floor > request，同類日優先，採同次原子佐證；不得只在 R_e reserve 被拒後才補 G。
- 發布、停用、超額雙封鎖與 reserve 線性化：變更先成立則舊快照拒絕；reserve 先成立的首次 grant 沿原成本／窗口／lease 單次執行及保守結算，後續新 reserve 採最新狀態。非目標成員失效／封鎖可能提高 G，不能只驗證請求 endpoint 的封鎖。
- 同次回傳的 revision／G／分類／時間皆是內部佐證，engine 須驗證，不能轉送 public。目前資格先於 duplicate／conflict，409 無新 grant；store timeout／unknown 不退款、不重送；既有結算不用重新取得當前 registry 授權。
- 移除 helper 的 Places-only 成功限制之前，須完成 T143～T146、各成功端點合法輸入／成本驗證與 mock 整合。production 六端點 `live:false`、speech S1、transcribe P1 前提與既有額度均不變。

**2026-10-06 使用者批准之文件順序澄清**：有界解析與所有可拒絕請求的輸入驗證移至預留前；預留後原子回傳／時鐘／lease／首次 grant 驗證及結算仍保留。匿名 admission 是登入前入口防濫用限流，不授權匿名付費 API、不建立匿名付費額度；其拒絕也不得讀／洩漏預留。通過入口檢查者仍依 Session → 有效資格 → 已登入者限流 → 輸入／registry → 預留執行。method、解析前大小及入口 admission 可先拒絕；一般未登入 401、未核准 403 規則不變。正式限流數值、transport adapter、上限與程式均未核准。

下一批僅為 [隔離 helper 提案](../checklists/pipeline-readiness-report.md)，不接六 handler。A6 四種語意展開六列精確文案已同步為 [本次待營運者批准方案](error-and-quota-contract.md)，不能以「額度已滿」替代 below_floor；本次不自行核准 A6 或狀態查詢。429 分類僅使用同次原子拒絕 snapshot 與固定可信成本 context；public 不新增 state／reason／G，前端不得自行推算狀態或恢復時間，週追加不提高日上限。

### T139 隔離 HMAC 呼叫邊界（Batch-M2 歷史；現行入口見 Batch-M3a）

- 本機隔離 engine 使用 `reserve(request, trustedCost)`，不是新 HTTP API。request 只接受主體、endpoint、idempotency key 與完整語意 `content`；body 的 model／tier／attempts／金額／價表／estimateInputs 宣告均不得直接傳入可信參數。
- trustedCost 只能由後端可信依賴提供；必要欄位、endpoint 一致性與數值上限均檢查。model、`billingTier: 'standard'`、`attempts: 1` 不得以 estimateInputs 自由字串補入。欄位 allowlist 與 fixture 邊界見 data-model §15.1。
- HMAC key 從 engine 的可信依賴注入；缺少／無效 key 或可信設定回內部 503，對外仍須統一 `PROTECTION_SERVICE_UNAVAILABLE`。無普通 SHA-256 fallback，原始內容／普通 contentDigest／key 不送入 store。
- speech 維持拒絕；production 六端點 `live:false` 不變。本批不建立 registry 或接線第 5～8 步；A4／T140 provenance、Session 與 handler precedence、正式稽核存取控制仍待驗證，不得以分離參數宣稱已完成真實保護。
- key 版本欄位只保留未來版本化介面；不定 TTL／輪替，不宣稱跨 key 或舊 SHA-256 format 的冪等性。

### Batch-M3a A4 隔離 registry 契約（T140 部分完成，未接線 Pipeline）

- 現行 engine 使用 `reserve(request, estimateInputs)`；不接受 M2 的任意 trustedCost。成本 registry 只能由伺服器 options 注入，request／estimateInputs 注入金額、version、model、tier、attempts 或成本摘要皆拒絕。identity 仍須由後續 Session 邊界提供，本批不構成 handler 保護。
- registry 選定版本及成本參數，驗證 endpoint、有效期、live、核准／實際啟用／上界／單次嘗試 metadata、模型白名單、standard tier、attempts＝1、計價種類／安全係數／allowlist 上限一致性與封鎖；內建估算器計算預留。unknown、矛盾或 lookup 失敗／逾時 fail closed。photo 的型別與 fixture 上限不證明真實影像／token 上界。
- 後端穩定編碼計算成本參數摘要，與核准 parametersDigest、HMAC 與預留綁定；store 原子檢查版本／摘要封鎖及同版本同端點摘要一致性，不能只在 engine 查驗。相同參數改版本或等值安全係數不得解封；新版本、改變參數仍需重新符合核准與上界 metadata。
- 超額結算同時回傳相符的版本與摘要封鎖佐證；封鎖、registry 不可用或成本過期不妨礙既有預留保守結算。M1 清理／lease／uncertain／晚到結果與 M2 HMAC／資料最小化不變，duplicate 不重授執行權。
- 內部拒絕 reason 只供 engine／稽核；未建立對外錯誤信封／pipeline 或狀態查詢。production 六端點仍 live:false，speech 即使測試 metadata 宣稱有證據仍拒絕。43 個 registry 測試只驗證 fixture 與 memory mock，不是 Redis/Lua 或正式成本證據。

## 端點成本上界（2026-10-07 修訂提案，數值待營運者核准；完整推導與三種狀態分類見 plan.md §4.2、research.md R13）

單位 µUSD。`R_e = ceil(A × S × C_ub)`。**A＝1 規劃已核准（A2：停用 SDK 自動重試，`maxRetries: 0`；A＝3 撤回）**；目前程式行為仍為 SDK 預設 A＝3，須由 T135 實作並以「一次使用者操作的上游嘗試數」驗收，未實作前一律視為 `uncertain` 保守結算。下表「公式算術已核對」僅代表在前提成立時算術無誤，前提見 plan.md §4.2.3 表二（待證明）。

| 端點 | 強制輸入／輸出限制（建議，待核准） | 模型／SKU | Pre-parse（bytes） | `R_max`（A=1／A=3） | 狀態 |
| --- | --- | --- | --- | --- | --- |
| assistant | `text` ≤ 1000；`max_output_tokens` 2000；prompt ≤ 4,096 B；知識背景 ≤ 16,384 B | `gpt-4o-mini`（白名單；現況 `OPENAI_MODEL` 可覆寫） | 16,384 | 9,630／28,890 | 算術已核對；上界待證明 |
| photo-translate | `sourceText` ≤ 2000；`max_output_tokens` 4096 | `gpt-4o-mini`（白名單） | 16,384 | 8,036／24,106 | 同上 |
| photo-ocr | 影像 1 張、解碼後 ≤ 3,145,728 B；`detail: 'high'`（影像 token ≤ 48,169）；`max_output_tokens` 3072 | `gpt-4o-mini`（白名單） | 4,200,000（含 base64／JSON 後 ≤ 4,194,373） | 19,398／58,192 | 同上 |
| places | `query` ≤ 100、`manualArea` ≤ 50；`fieldMask` 單一常數對照 SKU | Enterprise + Atmosphere（`editorialSummary` 觸發）；Global Nearby/Text SKU ID `F20E-7034-0EF7`／`120C-BEC3-B48F`；India 區域 SKU 另見 D01 | 2,048 | 40,000 µUSD/event global public base；50,000 µUSD reservation 為已批准的本機候選／mock 值，不是硬上界 | 交易頁幣別 TWD、官方台灣換匯政策及兩 SKU CSV 首階數值已記錄；CSV 未標幣別／匯率，正式計費邊界與上界仍未完成 |
| transcribe | **真實呼叫受阻**（A10＝P1 規劃已核准，但後端驗證與瀏覽器可行性未完成）；P1：固定 16 kHz mono 16-bit PCM WAV、實際 `dataBytes` 偶數且 ≤ 1,920,000（待核對）、不信任 header 宣告、丟棄原 header 後重建 44 B 標準 header | `whisper-1`（固定） | P1：2,000,000 | P1 前提成立時 9,000／27,000（僅算術） | 受阻，僅 mock |
| speech | **真實呼叫受阻（A9＝S1 規劃已核准；逾時、串流中止、經驗速率不得當成計費上界）**；官方最大輸出／音訊 token 每秒**未查得**，不採假設速率 | `gpt-4o-mini-tts`（固定） | 4,096 | 無可信值 | 受阻，僅 mock |

- 無法建立可信上界（時長不可證明、模型不在白名單、欄位 SKU 未知、影像超出上限、speech／transcribe `live: false`）者，**一律在付費上游前拒絕**；成本／價表內部原因（例如 `COST_BOUND_UNPROVEN`／`COST_MODEL_UNSUPPORTED`）對外統一映射為 503 `PROTECTION_SERVICE_UNAVAILABLE`，不得以平均價格或經驗速率代替。輸入格式／大小錯誤仍依契約回 413／400。
- `R_e` 隨實際輸入縮放；`R_max,e` 僅為合法輸入上限下的最大值，供 G 計算（G 規則待 A8）。
- 三層分開：應用程式預留（`R_e`）、結算估算（usage／固定 SKU；僅 `attempts == 1` 且標準層級才可低於預留）、供應商實際帳單（不保證與前兩者相等或為其上限）。

## 額度不可用的判斷（權威：plan.md §4.5）

- 端點層級（已定）：`R_e ≤ remaining_day` 且 `R_e ≤ remaining_week` 才可預留；否則 429＋`quotaScope: 'request'`（A6 待核准）。
- 全域層級：**A8＝G-B 規劃已核准（G-A／C／D／E 撤回）**：G ＝ 價表 `live: true`（有可信成本上界且實際啟用）端點之最小 `R_max`；受阻或僅 mock 的端點不納入。四類情況分開：①成本模型無效（`E_live` 為空或價表版本不一致）→ 503 `COST_MODEL_UNSUPPORTED`／`PROTECTION_SERVICE_UNAVAILABLE`，不帶 `quotaScope`；②實際額度耗盡（`limit−used≤0`）→ 429＋`quotaScope: 'all'`；③無啟用端點可負擔（`remaining<G`）→ 429＋`quotaScope: 'all'`；④個別請求預留不足 → 429＋`quotaScope: 'request'`。圖磚代理與互動地圖只依②③與①判斷。G 的具體數值待 A1 與真實證據，不得標為已驗證（plan.md §4.5）。
- 單一端點因 `R_e` 過大而被拒，不得使圖磚代理、`/api/me/map-eligibility` 或其他較低成本端點判為不可用。
## `/api/places` 特別規則

- 互動地圖可用不代表 `/api/places` 已授權。
- `/api/places` 只能由使用者明確搜尋觸發。
- 每次仍須完整 Pipeline 與原子預留。
- 受限狀態下 `/api/places` 呼叫數必須為 0；前端不得自動補送舊搜尋。

### D01 Places 成本與執行界線（2026-10-08 文件查核）

- **2026-10-08 帳務證據／候選範圍補記**：Google Cloud 交易頁顯示「金額 (TWD)」；[官方帳戶幣別文件](https://docs.cloud.google.com/billing/docs/resources/currency?hl=zh-tw)說明台灣使用新台幣，美元價格轉為當地幣別，匯率於每月初設定，且不隨終端使用者所在地改變。帳戶價格 CSV 中 Nearby `F20E-7034-0EF7` 與 Text `120C-BEC3-B48F` 的首個付費級距各約 1,271.20／1,000 events；CSV 未標明幣別／匯率，不由 `$` 欄名推定美元，也不從此值推算匯率或 USD 成本。`priceScale=5/4`、50,000 µUSD（US$0.05）reservation、7 日價表有效期已批准，**只限本機候選／mock**；25% 不是完整帳單上界，7 日是應用程式重新查核期限、不是 Google 固定價格保證。權威額度維持 USD／µUSD，不新增 TWD 額度或自動換匯 UI。未知計費結果維持 uncertain／保留預留／不重試；六個 production endpoint `live:false`、speech 真實呼叫仍受阻。
- 固定 mask 為 `places.displayName,places.formattedAddress,places.location,places.businessStatus,places.editorialSummary,places.types,places.id`。完整 mask 在 Nearby Search (New) 與 Text Search (New) 均由 `places.editorialSummary` 觸發 Enterprise + Atmosphere，request 按最高 SKU 計價、不逐欄位加總。Global SKU 分別為 `F20E-7034-0EF7`／`120C-BEC3-B48F`；India 區域價表 SKU 為 `1DC0-87A6-65E7`／`0FD0-B42B-DFDA`。欄位與公開價來源、查核日期、帳戶證據清單及待批准決策以 [readiness-decisions.md D01](../readiness-decisions.md#d01places-決策包2026-10-08-本次更新) 為準。
- 已批准 A=1、不分頁／不自動重試；D05 execution timeout 8 s、dispatch margin 5 s、settlement buffer 5 s、lease 18 s 沿用，不重批。這些參數是已批准規劃，不代表目前 helper 已實作 timeout：`api/places.ts` 的原生 `fetch` 未帶 AbortSignal；production `POST` 未配置仍 fail closed。TEST_ONLY timeout／fixture 不證明正式上游或 provider billing。
- JSON≤2,048 B、query≤100 UTF-16 units、manualArea≤50、depth≤8、nodes≤256 與 5 s reader deadline 必須由正式 protected boundary 在 reserve／upstream 前強制。`executeUpstream` helper 不是完整 enforcement point，尤其 helper 本身沒有 query≤100／bounded body reader；目前不得稱 production 成功路徑已驗證。
- Global price list 所列最高單價為 US$40／1,000 events；India public list 為 US$12／1,000 events，價表 eligibility 依帳戶適用條件確認。`priceScale=5/4`、50,000 µUSD、7 日 effective window 已批准為本機候選／mock，不是 production 價格或成本上界；free cap、折扣不構成硬成本上界。錯誤／timeout 是否計費尚未確認，dispatch 後若無可信未計費證據，沿用 uncertain／保留預留／不重試。
- 本節是文件契約同步，不是應用測試 PASS、production acceptance 或端點啟用。六 production endpoints 維持 `live:false`。

## 非 POST

六端點對 `GET`、`PUT`、`PATCH`、`DELETE`、`OPTIONS` 等非 `POST` 回 405。現有程式尚未實作明確 405，後續需測試涵蓋。

## 結算回應

成功或可恢復錯誤後，若前端需要更新額度顯示，回應 body 可包含最新 quota snapshot；若結算尚不確定，必須顯示預留中或無法確認，而不是舊剩餘額度。

## PWA 與 cache

所有六端點回應皆為私人 API 回應，不得由 Service Worker 或 HTTP cache 持久化。舊 App Shell 不得繞過後端 Pipeline。
