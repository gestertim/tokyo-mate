# 005｜剩餘 Readiness 集中決策包

## 2026-10-08 單次 Phase B stale-capable 三鍵準備核准（現行；非外部執行授權）

使用者已批准僅為單次、專用 Free DB 試驗採用有來源、擷取時間及時區，但可能過期的人工 usage observation；提案門檻 commands ≤400,000、bandwidth ≤9GB、storage ≤230MB。它們不是即時餘額保證，也不宣稱 provider storage／bandwidth 的本機硬上界。production／business runner 的 verified-metering／freshness gate 不變。provider 計量規則已取得營運者提供的回覆；真實 Redis／runner 執行仍未驗證，因此 `providerMetering: "unverified"`、`billableUpperBound: null` 不變。

Reserve 子範圍改用既有 `REDIS_QUOTA_KEYS` 三鍵與 `REDIS_QUOTA_LUA` 無 `requestEpoch` 適用分支；不傳 floor／digest，且不得啟用 `rejectLegacy`。該 branch 仍執行資格、registry／成本綁定、G、日週額度、idempotency 與首次 grant 原子檢查。若不能按此既有分支執行，停止並提出最小差異，不建立 fake floor／digest 或 bypass。這不是 request-epoch、restore 或 T152 驗收。

新包絡取代本決策包稍後保留的 7-key／89-command Phase B 提案數字，完整分支表見[D14 三鍵契約](contracts/isolated-local-runner.md#2026-10-08-單次-phase-b-三鍵本機準備現行)：最多 8 HTTPS POST、無 Read Region 成功最大 58 provider commands；若 Read Region 存在則不符合本次啟動條件（表列一個 Read Region 敏感度上界 64）。最大 request／response body 合計 1,048,576／262,144 bytes，不等於 provider bandwidth 上界。最多兩個 data-bearing exact keys（registry、users），sessions 不寫；實際 provider storage 大小未由 mock 驗證。

**外部啟動仍未批准／未執行**：owner 必須在任何讀秘密／spawn／network 前，確認當次專用 Free、Tokyo、無 Read Regions、無付款方式、無其他 workload／writer，並提交三項有來源、數值、觀測時間及時區的人工用量觀測，符合上述 proposal threshold。資料仍可能過期，不能稱即時餘額。本次只更新本機契約、dry-run digest、mock 接線與測試；不讀秘密、不連 Redis、不操作帳戶、不執行 `--execute`、不部署。T152 維持結案；T153／T154 父項及正式 gate 未完成。

## 2026-10-08 獨立本機工作收斂（現行）

Upstash 支援尚未回覆只暫停受影響真實 Redis Phase B，不暫停已批准獨立本機工作。本次沿既有 Analyze 與已確認 checklist 例外，完成管理確認的同鍵未知恢復／焦點／client 取消與新增管理成功回應 PWA cache exclusion；詳見[本次證據](../../docs/verification/005-local-implementation-evidence.md#2026-10-08-獨立本機管理恢復與可及性補足本次現行)。T038 依既存暫用元件證據補勾，既有本人申請、地圖與 PWA 範圍不重做。

**同日 D01 進度**：Places 官方公開價格／SKU 與本機 handler 唯讀查核、候選參數和 operator evidence 要求見下方[2026-10-08 D01 Places 決策包](#d01places-決策包2026-10-08-本次更新)。這是文件交付，不是應用測試、正式成本上界或端點啟用批准。

**2026-10-08 D01 帳務證據補記（本次現行）**：Google Cloud 交易頁顯示「金額 (TWD)」；官方[Cloud Billing 帳戶幣別文件](https://docs.cloud.google.com/billing/docs/resources/currency?hl=zh-tw)說明台灣使用新台幣、美元價格換為當地幣別，匯率於每月初設定，且不隨終端使用者所在地改變。帳戶價格 CSV 的 Nearby `F20E-7034-0EF7` 與 Text `120C-BEC3-B48F` 首個付費級距數值均約為 1,271.20／1,000 events；CSV 未標幣別或匯率，不從 `$` 欄名或數值推定美元、台幣或匯率。觀測來源為使用者提供的 Cloud Billing 交易／價格頁截圖、官方文件截圖及帳戶價格 CSV，觀測日 2026-10-08。使用者已批准的 `priceScale=5/4`、reservation `50,000 µUSD`（US$0.05）與價表 7 日有效期，範圍僅限本機候選／mock；25% 是候選緩衝而非完整帳單上界，7 日是應用程式重新查核期限而非 Google 價格固定保證。幣別確認與 CSV 價格觀測不構成真實 request 計費、錯誤／timeout 計費或成本上界證明；production 六端點維持 `live:false`、speech 真實呼叫受阻、未知結果仍 uncertain／保留預留／不重試。

| 分類 | 本次核對後狀態 |
| --- | --- |
| 本次完成 | 管理未知結果不能取消換鍵、先前未知不因後續撤權拒絕消失、鍵盤焦點、處理中／錯誤語意、同步防連點、離頁取消等待與晚到防護；3 files／19 targeted tests、1 新增隔離 browser test、strict 0 診斷與 webServer build。 |
| 仍缺本機實作 | 六端點成功 descriptor／HTTP→預留→單次 mock upstream→結算接線尚未完整；非 Places 成功路徑受既有批准 gate 阻擋。本次不將未寫接線誤標為「只差 Redis」。 |
| 需外部證據 | Phase B 可信計量／usage／floor authority、真 Redis 跨 writer／restore；真 OIDC／Geoapify／CDN、正式圖像原檔／授權、installed PWA／部署 runtime 與供應商 usage／invoice。 |
| 需產品決策 | D01 逐端點正式 model／SKU／service tier／output cap／可信成本上界與成功接線批准，speech 硬上界；不能用 mock 或新填候選參數解除現行 Places-only。資源／秘密／付費／部署仍各自另批。 |

本次管理恢復只落實既有明確確認、防重複提交與未知同鍵契約，不新增管理權限、額度、保存或重試政策。取消 client 等待不代表 server rollback，不新增操作鍵持久儲存。requirements 71／12、T152 結案、T153／T154 未完成、production 六端點 `live:false`／speech 受阻均不變。沒有真實 Redis／Phase B execute／校準／秘密／外部資源／付費 API／dependency／提交／推送／部署。

## 2026-10-08 Phase B 最小待決事項與 Upstash 支援問題（現行）

本次僅完成已授權的 caller／child transport 本機實作、fake-secret mock 與直接文件同步；不重新規劃、不重審 T152 或已結案批次。現行 child 使用既有 REST transport／reserve adapter；mock 仍由 IPC 接 parent Lua 替身 authority，沒有 socket／外部 Redis，不把它或先前四 POST 校準視為真實跨 process 原子性證據。可審閱分支包絡見[現行契約](contracts/isolated-local-runner.md#2026-10-08-t153-phase-b-callerchild-transport-本機交付現行)，實跑結果見[證據](../../docs/verification/005-local-implementation-evidence.md)。

### Token 重設補記

`tokyo-mate-005-test` 的 Token／憑證重設由**營運者確認完成**；回報時間 **2026-10-08 06:28（Asia/Taipei）**，實際操作時間未提供。先前 2026-10-07 21:37 回報及校準批次待補描述保留為歷史，本次更新營運者確認，不新增 Redis 技術驗證。未另行測舊 token 失效或新 token 可用，不宣稱已有此證據；不索取、輸出或保存新秘密、不為補記追加 Redis 操作。此補記不擴大外部授權。

### 最小待決清單

1. **provider rules known; execution unverified**：EVAL／inner-call／Read Region／Free cap behavior 已有 operator-provided response；本機 dry-run／mock 不代表真實 provider execution。`providerMetering: "unverified"` 與 `billableUpperBound: null` 保持不變。
2. **stale-capable usage observation**：已批准僅供單次試驗 proposal threshold 使用；owner 仍須提交 commands／bandwidth／storage 的來源、觀測值、擷取時間及時區。無最大報告延遲 SLA，任何讀數仍可能過期，不能稱即時餘額。
3. **fresh-namespace floor／restore 不屬本次三鍵 branch 前置**：本次 fixture 無 `requestEpoch`，使用既有三鍵 business reserve branch；不提供 floor／digest，也不代表 request-epoch restore 完成或 T152 驗收。production restore 仍須完整獨立證據。
4. **外部啟動尚未批准**：owner 當次確認 DB／region／付款／workload 與用量門檻後，仍須另批一次外部操作及安全 credential input。external API／CLI 現在仍在讀秘密／spawn／network 前拒絕，不接受假 ruleRef／digest／usage 或放行旗標。

### 2026-10-08 Upstash 支援回覆與 Phase B 計量收斂（現行）

營運者在本輪提供 Upstash 支援完整書面回覆；原文保存於[005 實作證據](../../docs/verification/005-local-implementation-evidence.md#2026-10-08-upstash-營運者提供的支援回覆及-phase-b-計量收斂)。可取得來源為「營運者提供的支援回覆原文」；本輪訊息收件時間為 **2026-10-08 16:27:19.183 +08:00（Asia/Taipei）**（對話時間資料），Upstash 原始寄件時間、寄件者、ticket ID 及私人訊息來源連結未提供，不推定或補造。回覆中唯一保留的 URL 是公開 Developer API 文件。

**已解除的供應商規則未知項**：EVAL／EVALSHA 計 1＋實際執行的 `redis.call`／`redis.pcall`；early return 只計已到達的 calls，runtime error 前已完成的 calls 仍計量；無額外 Read Regions 時內部 HA 不倍增；Console／Developer API stats 不消耗 Redis commands；Free cap 為 500K commands／月、10GB bandwidth／月、256MB storage；無付款方式不自動升級／新增費用；commands／bandwidth 每月 1 日 00:00 UTC 重置。用量報告沒有最大延遲 SLA，不是即時剩餘額度。

依現行三鍵契約逐行靜態核算：無 Read Regions 時成功／cleanup 完整路徑為 8 HTTPS POST、58 provider commands；一個 Read Region 敏感度上界為 64，因逐個實際 write call 再計。Eligibility seed unknown 的 `readQuota` readonly confirmation 在 `TIME`＋3×`TYPE`＋user `HGET` 後、registry projection 前 return，最多 6 commands。各互斥分支、寫入倍率及 body size 見[現行 D14 三鍵契約](contracts/isolated-local-runner.md#2026-10-08-單次-phase-b-三鍵本機準備現行)；先前七鍵／89-command 數字僅為歷史，不再適用。

**仍未解除的執行前置**：

| 項目 | 狀態／要求 |
| --- | --- |
| Free／region | owner 須在啟動前確認當次專用 Free DB、Tokyo Primary、Read Regions 明確為「無」，並提供可判讀來源／時間；任一 Read Region 即停止本方案。 |
| 付款／workload | owner 須確認無付款方式、無其他 workload／writer；不得假設或推導 US$0 以外的費用上界。 |
| 用量觀測 | commands／bandwidth／storage 各自提供來源、數值、觀測時間與時區；分別 ≤400,000、≤9GB、≤230MB 才通過本次人工 proposal threshold。讀值仍可能過期，不是即時餘額。 |
| Namespace | 本次由 caller 凍結全新三鍵 namespace；preflight 任一鍵非空／unknown 即停止。無 requestEpoch，不要求 synthetic／restore floor；不得以此宣稱 epoch／restore 完成。 |
| 外部批准／credential | 本次未授權外部 Phase B。另行明確批准前不讀／接收秘密、不 spawn、不連網；不得由 dry-run digest 推定批准。 |

**單次小型試驗範圍已批准供本機準備；外部仍未批准／未執行**：當次限定一個專用 Free Tokyo DB、無 Read Regions、無付款方式、無其他 workload；一個全新三鍵 namespace、最多兩個相同 reserve writer。硬限制最多 8 HTTPS POST／58 provider commands（one Read Region 僅作敏感度值 64，實際啟動須無 Read Regions），禁止 retries。人工觀測門檻為 commands ≤400,000、bandwidth ≤9GB、storage ≤230MB，須各有可核對來源、數值、時間與時區；觀測可能過期，不是 provider 餘額保證。保留 Free caps 500K／10GB／256MB 的硬停止語意。quota error、來源／數字矛盾、timeout、unknown、超限、額外 writer／region、非預期 key、非一 grant＋一 duplicate、usage 非單次 estimate、清理未證實均停止；不重送異動、不退款、不 regrant、不再次 cleanup、不從 console 差值估費。HTTP body／response cap 不能替代 provider bandwidth／storage 上界。

本次已明確批准上述 stale-capable 人工觀測作為單次試驗 proposal gate；它不是即時餘額，也不建立 freshness SLA 或放寬 production/business runner。provider 的實際 requests、命令與 usage 仍未驗證。現有 external API／CLI 仍阻擋讀秘密／spawn／network，本次不解除該 gate、不執行。

**Floor／authority 不可混為 production restore**：本次已批准且實作的無 `requestEpoch` 3-key reserve branch 不呼叫 epoch authority、不需要 fake／synthetic floor，也不驗證 restore；不以此替代或宣稱 T152／production restore 完成。若三鍵無法符合既有 business Lua 適用條件，停止此子範圍並提出最小差異，不能用 fake floor／digest 或 bypass。Production restore 仍須完整 frozen manifest、monotonic generation／retirement／revocation 防 rollback 及跨 instance 拒舊證據。

沒有真實 Redis／OIDC／付費上游／帳戶操作、沒有新套件、秘密設定、提交／推送／部署。T153／T154 父項與 12 項正式 gate 未完成；T152 維持結案；production 六端點 `live:false`，speech 受阻。

### 支援問題清單（先前未發送，現已由營運者提供回覆）

以下為先前待提交問題的歷史記錄，本輪沒有聯絡支援；現已收到[營運者提供的支援回覆](../../docs/verification/005-local-implementation-evidence.md#2026-10-08-upstash-營運者提供的支援回覆及-phase-b-計量收斂)。回覆解決計量公式／Read Region／Free 行為問題，但明確沒有 usage reporting 最大延遲 SLA；不把歷史問題清單當成尚未取得整份答覆。

| 主題 | 提交問題／需要的證據 |
| --- | --- |
| EVAL 內層計量 | 一次 REST EVAL 的 Free monthly commands／billable commands 如何計數？外層 EVAL、每次 `redis.call`／`redis.pcall`、重複讀取／寫入、失敗／提早返回／Lua error 是否各自計入？能否提供明確公式與最壞上界，並區分 logical command、REST request 與計費 command？ |
| replication 計量 | 沒有額外 Read Region 時，內部高可用性複本是否另計 commands／bandwidth？增加 Read Region 時，寫入 replication、讀取與 EVAL 內層 calls 的倍率為何？`Global` Console 標籤如何解讀，應從何取得當次可稽核的 region／replication 配置？ |
| Free 超限行為 | commands、storage 或 bandwidth 達上限時，是否必定拒絕／限流／停用？會否自動升級、產生費用或等待下個月？未新增付款方式時是否有其他收費可能？超限／失敗請求本身如何計量，能否配置 hard cap／拒絕付費的明確政策？ |
| Console 更新延遲 | DB 詳細頁 Commands／Bandwidth／Storage／Cost 與帳戶總覽各自的更新頻率、最壞延遲、時間範圍／時區為何？頁面不同步時如何判讀？cleanup 後 Storage 延遲與 Commands 差值能否代表完整操作計量，哪些限制不可推論？ |
| 可信用量取得 | 是否有官方、具時間戳／新鮮度與完整範圍定義的 usage API／export 或其他可信來源？查詢自身計費／限流／更新延遲的最壞上界為何？如何取得當月已用量、尚未反映的用量及剩餘容量的保守上界，供有限 runner 的 fail-closed stop gate 使用？ |

### 營運者最少須提供／確認的資料（不含秘密）

請以去識別化證據或文字確認提供下列資料；不要傳送或記錄 token、REST credential、URL 中的認證資訊、subject 或其他秘密：

1. **DB／方案**：確認當次目標為隔離、專用 Free DB，不與 production 或其他測試 workload 共用。
2. **Region**：確認 Primary 為 Tokyo、Read Regions 明確為「無」，附來源與觀測時間；任何 Read Region 均停止本次方案。
3. **付款／workload**：確認無付款方式、無其他 workload／writer；不提供 credential 或秘密。
4. **三項用量觀測**：commands、bandwidth、storage 各提供可核對來源、觀測數值、擷取日期時間及時區。需分別 ≤400,000、≤9GB、≤230MB；其意義只是單次試驗 proposal threshold，觀測可能過期，不能稱即時餘額或保證剩餘容量。Developer API／Console stats 查詢本身不耗 Redis commands，但沒有最大延遲 SLA。
5. **外部批准**：本次尚未批准外部操作；owner 狀態確認與三項觀測齊備後，仍須另行明確批准單次執行及安全輸入流程。不得記錄 URL／token／subject 等秘密。

### 一次限定 Phase B 外部執行清單（前置待 owner 確認；本次未啟動）

**執行前 go／no-go**

- [ ] Owner 已針對當次確認：專用 Free、Tokyo、無 Read Regions、無付款方式、無其他 workload／writer。
- [ ] Owner 已提供三項用量觀測之來源、數值、觀測時間與時區，且分別符合 ≤400,000 commands、≤9GB bandwidth、≤230MB storage；觀測仍標示為可能過期，不推論即時餘額。
- [ ] 凍結本次 dry-run digest 及其單一 `{preview-<16 字元>}` namespace；當次 exact preflight 僅對三鍵執行，任一鍵存在／unknown 即停止。
- [ ] 另有明確、獨立的一次外部執行批准及 owner 安全輸入安排。當前不讀秘密、不 spawn、不連網；digest 不是批准。
- [ ] 無新增 query、calibration、TIME 操作或未列異動；採下表硬上限與 unknown／cleanup stop rules。

**精確操作與 inventory**

1. 使用上述已確認 DB，凍結一個全新 `{preview-<16 個隨機字元>}` namespace 及三鍵 exact inventory：`<namespace>:registry`、`<namespace>:users`、`<namespace>:sessions`。僅此三鍵執行一次 exact preflight；任一鍵存在、結果 unknown 或 timeout 即停止。
2. 使用 TEST_ONLY fixture 各執行一次 registry publish 與 eligibility seed；使用 synthetic subject／operation／reservation／fingerprint，不呼叫任何付費上游。seed unknown 僅一次對應 readonly confirmation；仍停止、不重送、不進 race、不清理。
3. 兩個不同 OS child 各自建立既有 REST client，對同一 synthetic reserve 各派送一次；預期一筆 `executionGrant: true`、一筆 duplicate `executionGrant: false`。明確 terminal 且 race 結果一致後，一次 readUsage 核對日／週額度各僅保留一份 estimate。reserve unknown 最多一次同 reservation readonly confirmation，之後停止。
4. 只有明確成功且 usage 核對通過才對三鍵 exact inventory 做一次 DEL EVAL；cleanup unknown／timeout 最多一次三鍵 EXISTS confirmation。全部不存在才記 cleaned；否則保留 inventory。禁止 SCAN、wildcard、KEYS、FLUSH、異動重送、退款、regrant 或未列入包絡的讀取。

**分支最大派送額度與停點**（分支互斥，不可加總）

| 分支 | POST | Logical | Provider：無 Read Region | Provider：1 Read Region 敏感度 | Write calls | 停止／後續 |
| --- | ---: | ---: | ---: | ---: | --- |
| Gate／中斷／秘密失敗 | 0 | 0 | 0 | 0 | 0 | 不讀秘密、不 spawn、不連網。 |
| Preflight 非空／unknown／timeout | 1 | 4 | 4 | 4 | 0 | 不 seed／cleanup。 |
| Registry seed unknown／timeout | 3 | 21 | 21 | 22 | 1 | 一次 registrySnapshot confirm；仍停止。 |
| Eligibility seed unknown／timeout | 4 | 25 | 25 | 27 | 2 | 一次 readQuota confirm；仍停止。 |
| Seed 後 worker／barrier／deadline／request cap stop | 3 | 19 | 19 | 21 | 2 | 不 reserve；保留 inventory。 |
| Reserve unknown／timeout／worker crash | 6 | 50 | 50 | 53 | 3 | 至多一次 getReservation；不 cleanup。 |
| Terminal 矛盾／第二階段 abort | 5 | 44 | 44 | 47 | 3 | 不追加讀取、異動或 cleanup。 |
| Usage unknown／矛盾／cleanup 前 stop | 6 | 50 | 50 | 53 | 3 | 不 cleanup；保留 inventory。 |
| Success；含 cleanup unknown 後 exact confirm | 8 | 58 | 58 | 64 | 6 | 一次三鍵 exact DEL＋一次三鍵 EXISTS。 |
| Cleanup／readonly confirm 未收斂 | 8 | 58 | 58 | 64 | 6 | DEL 不重送；保留 inventory。 |

**三種上界不可混稱**

- **程式 body cap**：最多 8 POST；每 request ≤131,072 B、response ≤32,768 B。成功分支 body 最多 1,048,576／262,144 B（合計 1,310,720 B），不含 HTTP／TLS framing，不能當 provider bandwidth 上界；總視窗 20,000 ms、operation 2,000 ms、ready 3,000 ms、barrier 派送前 >8,000 ms，超界 fail closed。
- **Provider commands**：依支援回覆的 EVAL＋實際內層 calls 與 read-region write multiplier 靜態推導；本方案啟動要求無 Read Regions。以上不代表已在真實 provider 執行或觀測到相同計量。
- **Storage／USD**：exact inventory 三鍵；registry 最多四個 hash fields、users 一個 synthetic subject field，sessions 不寫；local Lua fixture snapshot 驗證兩個 data-bearing keys 的應用資料 payload <131,072 B。這不涵蓋 Redis/provider metadata，故 `providerStorageBytesUpperBound` 仍為 null，不能宣稱 provider storage bytes 上界。`billableUpperBound` 為 null，不承載 command 數；Free／無付款方式只有於當次被 owner 確認後才適用費用硬停止語意。

任何異動 unknown／timeout、格式或大小錯誤均不重送、不退款、不 regrant。唯讀確認若 observed，仍不證明沒有晚到寫入；清理未收斂時保留 exact inventory、最後狀態與時間，交營運者安排另批唯讀檢視／處置，不在本批追加操作。

**一次外部執行批准邊界**：本次僅批准 stale-capable usage threshold 與三鍵本機準備，不批准外部 command。未來即使前置全數成立，也須另行批准「一個已確認專用 Free Tokyo DB、三鍵 preflight、兩個 TEST_ONLY seed、兩個 child 各一次相同 reserve、一次 usage read，以及只在明確成功時的一次 exact cleanup／契約允許的一次 readonly confirmation」。不含 DB 建立／升級、額外 calibration／usage polling、Redis 操作、OIDC／Google、付費上游、deployment、credential rotation、T152 重驗或正式 gate 勾選。任何 unknown 均依本契約停止，不能推定此批准。

## 2026-10-07 T153 Phase B 本機方案與計量停止條件（歷史；計量未知項已由 2026-10-08 回覆更新）

本次已完成 Phase B 本機方案與兩 OS process／mock REST request harness；未連線 Redis、未讀取／注入秘密、未聯絡外部服務、未付費或部署。操作選定為既有 `REDIS_QUOTA_LUA` reserve 首次 execution grant；兩個獨立 child 各自行建立 mock client 並各送一個相同 EVAL，parent 不代送 reserve。seed、exact inventory、command 算術、unknown 與 cleanup 規則見[runner 契約](contracts/isolated-local-runner.md#2026-10-07-t153-phase-b-既有reserve跨process方案本機mock完成外部未執行)及[mock evidence](../../docs/verification/005-local-implementation-evidence.md#2026-10-07-t153-phase-b-雙process本機mock非redis證據)。

### 外部執行最小待決事項與建議

1. **歷史狀態**：撰寫當時 EVAL／內層 calls／replication／Free 行為及 usage 延遲尚未確認；2026-10-08 營運者提供的回覆已解決前述規則未知項，但 usage 沒有最大延遲 SLA，因此 freshness／容量 gate 仍未通過。仍不以 mock／Console 差值或 calibration delta 換算 USD 上界，不放寬業務 runner verified-metering gate。
2. **可信 epoch floor／authority runtime input**：既有 isolated composition 會要求 namespace-matched floor／authority，並因此固定使用七個 `REQUEST_EPOCH_KEYS`。本機 mock 的 synthetic floor digest 不是 restore-floor evidence。後續若沿用 composition，owner 必須提供符合既有 contract 的獨立可信 floor／authority evidence；不得以 mock digest、Redis backup 自證或本次 reserve 結果取代。此 reserve 測試刻意不帶 `requestEpoch`，不重開／不宣稱 T152 驗收。
3. **憑證狀態不可推論**：owner 於 2026-10-07 21:37（Asia/Taipei）回報 `tokyo-mate-005-test` 憑證重設成功，但沒有以 Redis request 驗證舊 token，也沒有提供新秘密。此紀錄不代表舊 token 已撤銷、未撤銷或新 REST credential 可用；後續若另批執行，只能由 owner 經安全輸入提供當時有效的專用 REST credential，並先確認適用的 credential／撤銷狀態。不讀取、保存或索取秘密值。
4. **逐次操作仍須另批**：本次只批准本機 harness／文件；外部 Redis 資源、秘密處理與 Phase B execution 仍須一次明確、限定的外部批准。不得把先前限定校準批准延伸至 Phase B。

本機 mock 只證明兩 OS process 各自建立 mock client 並送出一次 REST wire-format reserve request，及現有 Lua 在本機 interpreter fixture 中的結果；不是兩個真實 Redis client／instance、Redis atomicity、provider metering 或 production acceptance。`providerMetering: "unverified"`、`billableUpperBound: null`、T152 結案、T153／T154 父項及 12 項正式 gate 狀態不變。

## 2026-10-07 已批准限定外部校準結果（本次現行）

營運者已明確批准一次限定校準，並接受 EVAL 內層計量、Free 超限行為與 Console 延遲未知；不再要求重複授權。前測 Free／Tokyo／付款介面及無已選取額外 Read Region 證據、獨立 `secret_invalid`／零派送紀錄、本次成功 caller JSON 與 21:09 人工後測集中於[證據](../../docs/verification/005-local-implementation-evidence.md#2026-10-07-限定外部-redis-校準營運者執行與人工-console-證據)。

成功報告為 4 REST POST、邏輯包絡 10、marker 確認且 PTTL 59948 ms、exact cleanup 成功。DB Commands 前測 1／後測 11、後測 Storage 90 B 與 Cost US$0.00 只記作 Console 觀測，不能推導計量公式、marker 殘留或費用上界；後測沒有帳戶總覽數字。無額外跨區 Read Region 的人工證據不等於沒有供應商內部高可用性複本；付款介面不等於完整超限／自動升級政策。

`providerMetering: "unverified"`、`billableUpperBound: null` 不變，業務 runner verified-metering gate 不變。精確執行起訖時間、前次失敗原始 JSON 與 token 撤銷／輪替完成證據仍缺。T152 結案不變；T153／T154 父項及 12 正式 gate 未完成。到文件同步停止，不啟動 Phase B、OIDC、付費上游或部署。下方「外部需另批／未執行」為先前批次歷史，本次批准只涵蓋本次限定操作，不授權後續外部操作。

## 2026-10-07 本機校準 caller 與 unknown 語意收斂（本次現行）

本批已批准範圍內完成 test-only 獨立校準 caller、型別、mock 測試與文件同步；未連線 Redis、未讀取／設定秘密、未執行外部校準、未新增套件、未修改 production factory／價表／handler／UI／部署、未提交／推送。設計見[runner 契約新節](contracts/isolated-local-runner.md#2026-10-07-獨立-redis-calibration-caller本機實作完成外部執行未授權)。

- **循環解除方式**：業務 runner 的 verified-metering gate 保持不變；校準改走獨立 caller，不需要事先已知 provider rule／`U`，也不填假值。安全性由專用 Free DB、固定 4 個 script、本機派送計數（≤4 REST POST、≤10 邏輯 commands、1 exact key、20 秒視窗）保障；provider 計量與費用維持**未知**，`billableUpperBound: null`。
- **取代**：2026-10-07 提案的「2 key／13 邏輯 commands／`27+2U`／confirm 重查 TIME 或 PTTL」改列歷史；TIME 與單獨 PTTL 不能確認原請求，確認改為同一唯讀 Lua 的 marker GET＋PTTL。
- **unknown**：SET unknown 不重送；不存在／到期／矛盾／確認逾時保留 unknown，不推論未寫入、不退款、不重授權；未收斂時不清理，TTL 不是清理證據。
- **外部執行仍需另批**，且 owner 須於執行當時確認：DB 仍為 Free／Tokyo、無 read regions／replication、Console 當時用量與剩餘額度、帳戶不會自動升級或產生費用；營運者須書面接受 EVAL 內層計量、Free 超限行為、usage 延遲未知的界線；執行後撤銷／輪替 token。
- T152 維持結案；T153／T154 父項與 12 項正式 gate 未完成。

## 2026-10-07 Free Redis 連線準備與外部測試前置核對（本次現行）

本次只核對本機最新契約／接線、Upstash 官方公開資料並同步 005 文件；沒有連線、送出 Redis command、啟動 runner、讀取或設定秘密、付費、修改 application／測試程式、提交／推送／部署。此文件提供待另批批准的校準試驗提案，不構成外部測試授權或真實 Redis 測試 PASS。

### 資源現況與官方證據

- owner 已建立專用 `tokyo-mate-005-test`，Tokyo `ap-northeast-1`、Free Tier。使用者提供的截圖時點為 `0/500K commands`、`0/256MB storage`、`0/10GB bandwidth`、US$0；流量圖另有少量紀錄。這些不是即時剩餘量、帳戶計費狀態或命令計量證據；截圖之外的目前用量、是否有 read regions／replication、超限行為都未核實。沒有登入 Console 或查帳戶。
- 2026-10-07 查閱 [Upstash Redis pricing](https://upstash.com/pricing/redis)：官方 FAQ 明列 Free Tier 256MB、500K commands／月；AUTH、HELLO、SELECT、COMMAND、CONFIG、INFO、PING、RESET、QUIT 等 operational commands 不收費。頁面沒有明確說明 Free 超限後行為或用量面板更新延遲，不能假設必定拒絕、限流或即時顯示。
- [EVAL 文件](https://upstash.com/docs/redis/commands/scripting/eval)證明 EVAL 以單一原子 Lua script 執行，且 `redis.call` 會呼叫內部 Redis commands；文件沒有說明 Upstash Free 計量是只算外層 EVAL、逐項算內層 calls，或另有其他規則。[Pricing FAQ](https://upstash.com/pricing/redis)也未給 EVAL 專屬計量定義。因此**不採「一次 EVAL 等於一個計費 command」**；本文件的 outer EVAL + 明列內層 commands 僅是保守的邏輯命令包絡，不是已確認的 billable upper bound。
- [REST API 文件](https://upstash.com/docs/redis/features/restapi)與 [EVAL REST 範例](https://upstash.com/docs/redis/commands/scripting/eval)確認以 REST URL 對 EVAL 送 POST。未找到官方明確的 EVAL 計量細則、Free 超限行為或 usage 更新延遲證據，列為未確認，不以價格頁沒有提及推導免費或安全。

### 本機設定入口與秘密處理

既有 [REST transport](../../api/_lib/redis-rest-transport.ts) 只接受顯式 `url`、`token`、timeout／response limit 與 fetch；[isolated schema](contracts/isolated-local-runner.md) 的真實欄位為 `rest.url`／`rest.token`，由 `validateIsolatedEnvironment` 驗證後交給 `createIsolatedComposition`。程式沒有 Upstash environment loader；現有文件曾提出 `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN` 作為未來 binding 名稱，但它們**不是目前已接線的變數**。`runIsolatedBatches(plan, ports)` 是 import API，沒有外部 CLI；本機也沒有已批准的 `ports` invocation／usage reader。

Repository Safety Guard 只查路徑屬性，未讀檔案內容：`.env.local` 路徑目前不存在，`git ls-files` 未列入追蹤，`git check-ignore` 命中。因現有程式不讀它，**不要建立 `.env.local`**，也不要改用 Vite／`VITE_*`／`.env.example`。安全設定步驟只適用於日後另批外部試驗：

1. owner 從本機 password manager／secure prompt 取得該專用 DB 的 REST URL 與 token；不在本次讀取／設定。
2. 只在提供並批准的 one-shot parent caller process 暫存既有 proposed names `UPSTASH_REDIS_REST_URL`／`UPSTASH_REDIS_REST_TOKEN`；不能在命令列、檔案、測試輸出、log、chat 或前端保存／顯示值。
3. caller 在 parent process 記憶體中把兩值映射成既有 `rest.url`／`rest.token`，交給 `validateIsolatedEnvironment`／composition；不得新增 env loader。child worker 沿既有 allowlist 不繼承帳戶憑證。
4. 結束後清除 parent process 值，由 owner 撤銷／輪替 token。由於 caller、環境 binding 與可信 usage source 尚不存在，現在不能宣稱已完成可用的連線設定。

### 最小校準試驗提案（只供另批批准，現在不執行）

僅使用該專用 Free DB、一個新且唯一的 `{preview-<random-id>}` namespace、合成短值；不建新 DB／restore target、不做付費上游、不啟用 PROD PACK。沿既有 `createRedisRestTransport`／`runIsolatedBatches` port 介面；不得直接執行 runner 檔案。候選設定限 `maxBatches=1`、`windowMs=600000`（10 分鐘）、既有 REST operation timeout 2 秒、`confirmationReserveMs=30000`、`cleanupReserveMs=30000`、TTL 60 秒、REST response 上限 1 MiB。namespace 與 exact inventory 須在啟動前生成並凍結：

| 階段 | 最大派送／內容 | 唯讀確認與清理 | 邏輯命令上界（非官方計費結論） |
| --- | --- | --- | --- |
| A 連線／TIME／TTL／Lua 校準 | runner 一批；兩個 child 只同步 IPC/barrier，`ports.execute` 在 parent 依 slot 各用一個獨立 REST transport 發送：slot 0 一個 `EVAL` 執行 `TIME`；slot 1 一個 `EVAL`，在唯一 scratch key 上執行 `SET KEYS[1] <synthetic> PX 60000 NX` 後呼叫 `PTTL KEYS[1]` 並驗證 `0 < ttl <= 60000`。最多 2 個 execute EVAL、1 個 batch；不共享 key、不競爭、不執行業務原子流程。這只驗 parent 內兩個 transport slot 的服務相容性，不是兩個 OS process 各自連 Redis 的證據。 | 最多 2 個 readonly confirm EVAL（每個只重查 TIME 或該 key 的 PTTL，未知異動絕不重送）；`ports.usage` 最多 2 次（baseline／batch 後）；clean 僅使用下列 2-key exact inventory，每 key最多一個 cleanup EVAL＋DEL。 | execute：2 個外層 EVAL + TIME 1 + SET／PTTL 2 = 5；最壞確認：2 個外層 EVAL + 2 個 readonly calls = 4；清理：2 個外層 EVAL + 2 個 DEL = 4；合計最多 **13 個邏輯 Redis commands**。最多 6 個 Redis REST EVAL POST；usage reader 另最多 2 次。若 usage reader 會送 DB command，其上界必須先納入，現在未確認。 |

13 個邏輯 command 只計外層 EVAL 及明列內層 calls，**假設沒有 read-region replication**；官方 pricing 說明 Global DB 寫入會複製至 read regions，replication 也算 commands。目標 DB 的 read-region 設定尚未核實；如有 read region，須另核實各類 EVAL／內層寫入的計量倍數，不能仍報 13 為完整包絡。

候選 runner budget 可按既有驗證器表達為 `execute=3`、`confirm=2`、`cleanupPerKey=2`、`reserves.cleanup=4`、`reserves.confirmation=4`、`reserves.usage=2U`、`reserves.uncertainty=13`、`maxBatches=1`、`inventory` 恰為兩 key；`U` 是每次 usage reader 的已證明上界，仍未知。候選 `totalCommands = 6 + 4 + 4 + 2U + 13 = 27 + 2U`，且必須不高於 `min(10,000, owner 當時確認可用的剩餘 Free commands)`；僅在 `U=1` 有可信依據時，算術候選才是 29，並非 provider 計費保證。若 EVAL 規則、usage 讀取來源／延遲或 read-region replication 任一仍不明，即不啟動；不以事後 dashboard 更新當同步硬停。

目前無法給出 verified billable command 或美元成本上界：13 是無 read-region 前提下的邏輯包絡，`27+2U` 是待核實 usage bound 的 runner budget 算術，usage 更新延遲及 Free 超限反應也未確認；US$0 截圖不是目前帳戶計費狀態。不得把候選數字對外描述為 provider 保證或費用上限。

| exact inventory key pattern（執行時代入唯一合法 random-id） | 用途／限制 |
| --- | --- |
| `{preview-<random-id>}:probe:time:0` | TIME probe 的合法同 tag inventory；不寫入資料。 |
| `{preview-<random-id>}:probe:ttl:1` | 唯一 Lua／TTL synthetic key；值最多 16 bytes，PX 60 秒；清理只可對此 exact key 執行一次 DEL。 |

先決停止條件：owner 在另批執行前確認 DB 仍是指定 Free 資源、目前用量／剩餘額度與帳戶不會自動升級／產生未批准費用；確認 read regions／replication；找到可界定且有時效說明的 usage source；核准上述固定 dispatch／logical budget；建立可注入但不讀取秘密的 parent caller，且精確輸出已由 reviewer 核對。任何條件缺漏、`usage` unknown／倒退／超界、timeout／worker failure、未預期 key／response、計量與包絡不符即停止，不重送異動；readonly confirm 若仍 unknown，按 runner 契約不清理可能晚到的寫入並回報 cleanup unknown。清理不可用 `SCAN`／wildcard／`FLUSHDB`／`FLUSHALL`。

### 後續業務原子競態（與校準分開、另批）

只有階段 A 成功且其實際計量、usage 延遲及 adapter 證據經審查後，才可另批一個 TEST_ONLY 業務競態：以既有 `createIsolatedComposition` 對同一筆合成 request／idempotency identity 同時執行一次既有原子 reserve／grant 操作；最多一個 batch、兩個 execute，不呼叫任何付費 upstream。預期一個成功、另一個 duplicate／conflict，最終只有一次 grant；只能用獨立 readonly confirm 核對。**目前 `runIsolatedBatches` 的兩個 child 僅做 IPC/barrier，`ports.execute` 在 parent 執行；它本身不能證明兩個 OS process 各自建立 REST client 並跨 process 操作 Redis。**T153 若要求兩個真實 process，必須另有經批准、可證明 process 各自發出 Redis request 的 caller／harness；本次不建立。seed／authority／registry 初始化本身不由 composition 自動執行，須預先界定並納入同一 namespace／inventory／commands 清單。其內部 EVAL 命令數、所有初始化與 cleanup key 數尚未形成 billable 上界，故不包含在階段 A 的 13-command 包絡內，不可現在合併批准或執行。Restore 為可能清空 target 的破壞性操作，完全排除本提案。

本次到此停止。T152 維持結案；T153／T154 父項、12 項正式 gate、真實 Redis／OIDC／restore／Preview 證據仍未完成；六個 production 付費端點維持 `live:false`、speech 受阻。

## 2026-10-07 D14 本機 implementation 批准（現行）

使用者已批准本機environment contract、TEST_ONLY composition、有界雙process runner及相關測試／文件，並確認71已勾／12未勾checklist例外只限隔離本機工作。不重審T152或D01／D14唯讀查核；外部帳戶／資源、真實秘密、費用、部署及模式切換仍未批准。下方必要本機工作「只盤點／待批」為歷史，不再阻擋本批。

[本批契約](contracts/isolated-local-runner.md)集中schema、介面、逐檔範圍及測試映射；沿T153／T154本機子範圍，父任務未結案。只用明確注入合成值及網路替身，不自讀env／帳戶credentials；六端點live:false、speech受阻、12正式gate不變。限定Analyze／Readiness只評估本批，真實Redis／Google／restore／Preview仍缺證據。

本批本機工具已完成：78 targeted／113 files共1365完整回歸實跑、0跳過，strict／build通過；[逐檔Safety與修補證據](../../docs/verification/005-local-implementation-evidence.md)。本機Readiness限已批准工具交付通過，正式Readiness未通過；unknown未確認收斂時不清理inventory。沒有外部連線／真實秘密／新增套件／費用／提交／推送／部署，完成後停止。外部所需設定名稱、owner證據與分步操作保留於[契約末節](contracts/isolated-local-runner.md#未來外部操作尚未授權)，不是啟動批准。

## 2026-10-07 D01／D14 唯讀查核與文件同步（本次現行）

本次已批准公開官方文件查核、Repository Safety Guard、現有契約／接線盤點及直接文件同步；不是 implementation、外部異動或測試批准。T152本機父任務保持結案，不重新規劃、不重跑已結案測試。下方「待批准外部唯讀／本次未重查」是前批歷史，**本節已取得的公開證據取代那些現行性限制，但不取代帳戶證據**。12項正式gate保持未完成，六端點`live:false`、speech受阻，T151／T153／T154未結案。

查核日期均為 **2026-10-07（Asia/Taipei）**。只讀官方公開頁面；未登入Console、未測外部API、未呼叫任何付費上游。營運者未指定可存取的Google／Upstash／Vercel帳戶身分與專案；本機有Vercel binding檔不構成營運者身分或存取授權證據，因此不讀取其帳戶識別、不推測登入其他帳戶。帳戶資格、剩餘用量與實際價格全部標為缺資料；不將帳戶ID、subject、秘密或帳單原件寫入本包。

### D01｜Places 決策包（2026-10-08 本次更新）

本節集中取代本文件先前 D01 對「執行日公開價格、帳戶價、50,000 µUSD 與待查項目」的現行性描述；保留歷史批次作追溯。本次僅唯讀核對本機程式、Google 官方公開文件與直接文件同步，不呼叫 Places API、不讀帳戶／秘密、不改程式、不啟用端點、不執行應用測試。生效日為 **2026-10-08（Asia/Taipei）**。下列公開價不構成營運帳戶適用性、實際帳單或硬成本上界證明。

#### 現行程式行為與輸入強制位置

唯讀檢查 [handler](../../api/places.ts)、[paid-input-validation](../../api/_lib/paid-input-validation.ts)、[protection policy](../../api/_lib/local-protection-policy.ts)、[protected pipeline](../../api/_lib/protected-endpoint-pipeline.ts) 與 [route boundary](../../api/_lib/paid-endpoint-boundary.ts) 得到：

| 面向 | 現行程式／證據 | 待實作或待批准界線 |
| --- | --- | --- |
| route、body 與搜尋分支 | `coordinates` 分支只送 `POST https://places.googleapis.com/v1/places:searchNearby`；Nearby 半徑固定 500 m，`food`／`shopping`／`attraction`／`convenience`／`station` 各送固定 `includedTypes`，`all` 不送。`manual` 分支只送 `POST https://places.googleapis.com/v1/places:searchText`，`manualArea` 錨定 `textQuery`，query 或分類關鍵字附加，`languageCode: zh-TW`、`regionCode: JP`。不設定 `maxResultCount`、page token 或分頁。 | 維持目前產品欄位、兩條分支及使用者明確搜尋觸發；不新增 route、欄位、分頁或 fallback。 |
| Field mask | 兩分支目前共用完整固定 mask：`places.displayName,places.formattedAddress,places.location,places.businessStatus,places.editorialSummary,places.types,places.id`。 | 候選正式核准仍固定此 mask；未知／增加欄位應阻止放行並重新核價，不可靜默擴充。 |
| 每次操作上游數、重試 | helper 只執行選中的一個 `fetch`，沒有程式層 retry、SDK retry、第二分支 fallback 或分頁。這是靜態呼叫鏈證據，不是 Google usage／帳單證明。 | `A=1` 已由 Plan／A2 核准，Places 無 SDK；需在未來已核准的整合驗收中證明一筆操作最多一次派送，任何重送須是新的明確使用者操作。 |
| 上游逾時與 lease | `executeUpstream` 目前呼叫 `fetch` 未帶 `AbortSignal`，也未建立上游 timer；故 helper 本身沒有執行中的 8 s timeout。已批准 D05／contract 的參數是 execution 8,000 ms＋dispatch margin 5,000 ms＋settlement buffer 5,000 ms＝lease 18,000 ms；TEST_ONLY pipeline 以注入 signal／deadline 驗流程，不等於 production helper 已接線。production `POST` 現在沒有設定，boundary 先 fail closed。 | 沿用已批准 D05 數值，不重批；未來批准程式工作需把 8 s deadline 接到實際 fetch signal，並確保 timeout 後不重送、以 uncertain 保留預留。 |
| 輸入限制與後端位置 | 有界 boundary／pipeline 對 Places 設 JSON body ≤2,048 B、reader timeout 5,000 ms、depth≤8、nodes≤256；`validatePaidJson` 強制 query≤100 UTF-16 units、manualArea≤50、有限座標範圍、category enum 與精確允許欄位。這些在解析／驗證完成後、reserve 與 upstream 前生效；但目前實際 production `POST` 未設定 options，會先回 503。`executeUpstream` helper 本身只明確檢查 location/category 及 manualArea≤50，沒有 query≤100 或 bounded 2,048 B reader；不能把 boundary 限制說成 helper 本身的驗證。 | 將已批准輸入契約接入未來正式成功路徑；測試必須證明所有越界輸入在 reserve／上游前拒絕。此項文件盤點不是測試結果。 |

#### 官方公開 field → SKU → 價格（查核日 2026-10-08）

Google [Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search) 與 [Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search) 欄位清單支持下表；[Usage and Billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing) 明定依 request field mask 所觸發的**最高 SKU**計費，非逐欄位價格相加。

| Field | Nearby Search (New) | Text Search (New) |
| --- | --- | --- |
| `places.displayName` | Pro | Pro |
| `places.formattedAddress` | Pro | Pro |
| `places.location` | Pro | Pro |
| `places.businessStatus` | Pro | Pro |
| `places.editorialSummary` | Enterprise + Atmosphere | Enterprise + Atmosphere |
| `places.types` | Pro | Pro |
| `places.id` | Pro | Essentials (IDs Only) |

因此，**完整 mask** 對兩條分支皆由 `places.editorialSummary` 觸發 Enterprise + Atmosphere；Text Search 的 IDs Only 價格不適用完整 mask，Nearby Search 的 `places.id` 也列在 Pro。公開 SKU／價表（USD、每 1,000 billable events）如下：

| 適用公開價表／route | SKU ID | 每月 free usage cap | 首個付費階（至100,000） | 100,001–500,000 | 500,001–1,000,000 | 1,000,001–5,000,000 | 5,000,000以上 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Global／Nearby Enterprise + Atmosphere | `F20E-7034-0EF7` | 1,000 | US$40 | US$32 | US$24 | US$12 | US$3.40 |
| Global／Text Enterprise + Atmosphere | `120C-BEC3-B48F` | 1,000 | US$40 | US$32 | US$24 | US$12 | US$3.40 |
| India／Nearby Enterprise + Atmosphere | `1DC0-87A6-65E7` | 7,000 | US$12（至5,000,000） | 同一價格階 | 同一價格階 | 同一價格階 | US$3.40（5,000,000以上） |
| India／Text Enterprise + Atmosphere | `0FD0-B42B-DFDA` | 7,000 | US$12（至5,000,000） | 同一價格階 | 同一價格階 | 同一價格階 | US$3.40（5,000,000以上） |

來源：[Global price list](https://developers.google.com/maps/billing-and-pricing/pricing)、[India price list](https://developers.google.com/maps/billing-and-pricing/pricing-india)、[SKU details](https://developers.google.com/maps/billing-and-pricing/sku-details)。價表註明價格單位為每 1,000 events、幣別 USD；global 價表說明同一 customer billing account 連結的所有 projects 按月彙總決定 volume tier。India 是另一份區域價表，公開資料未提供此專案的 billing address／該帳戶資格，因此不得由東京搜尋、語系或 repo 推測適用價表；應由營運者提供去識別化帳戶地區資格。每月免費量、折扣與合約優惠會影響**實際帳單**，不作預留減免或硬上界。官方 usage 頁所載舊 US$200 monthly credit 截止日期為 2025-02-28，不列入現行估算。

#### 集中決策表

「已批准」僅標示既有政策，不延伸為本次程式或端點啟用批准。整體 D01、成本參數、帳戶證據及 production `live` 仍未完成。

| 項目 | 候選／已批准值 | 推導與來源 | 狀態 | 批准後程式工作 | 驗收條件 |
| --- | --- | --- | --- | --- | --- |
| 固定 request／mask／SKU | 每次只送 Nearby 或 Text 其中一條；維持上述七欄 mask。Nearby `F20E-7034-0EF7`、Text `120C-BEC3-B48F`（global）；India 對應 `1DC0-87A6-65E7`、`0FD0-B42B-DFDA`。 | `editorialSummary` 把兩 route 提升至 Enterprise + Atmosphere；官方最高 SKU 規則。 | mask／分支為現行程式與產品契約；SKU mapping 為**官方公開資料已查**；帳戶 CSV 有兩 SKU 首階約 1,271.20／1,000 events 的數值，但幣別／匯率未標，不能視作正式幣別價表或上界。 | 將固定 mask 與 route→SKU allowlist 綁入正式 cost registry；未知 mask/SKU fail closed。 | 分別驗證兩個 request body、完整 header mask 逐字一致；route/field/SKU 對照覆蓋所有七欄，無 page/fallback。 |
| 上游嘗試數 | `A=1`，不得自動重試。 | 已批准 A2；helper 現行各分支一筆 fetch，無 retry。 | **已批准政策**；正式成功路徑尚未接線；供應商對逾時計量仍未確認。 | 對一次使用者操作只派送一次；timeout／錯誤不得自動再送。 | mock 呼叫計數為 1； timeout／exception 不出現第二次；後續重送須新明確操作。 |
| 輸入限制 | body 2,048 B；query≤100 UTF-16 units；manualArea≤50；valid coordinates；既有 category enum；JSON depth≤8、nodes≤256、reader 5 s。 | D02／protected input contract；`INPUT_POLICY`、`validatePaidJson`。 | 限制值**已批准**；route helper 的 query/body cap 覆蓋不足，production boundary 未配置。 | 確保正式端點由同一 boundary 在 reserve 前執行限制，且實際 bounded reader 生效。 | 各欄上限、+1、malformed body／oversize／slow reader 均上游呼叫 0；不能只測 helper。 |
| Timeout／lease | execution 8,000 ms；dispatch margin 5,000 ms；settlement buffer 5,000 ms；lease 18,000 ms。 | 既有批准 D05／contract，`EXECUTION_POLICY.places`；8+5+5。 | **已批准，不重批**；production Places fetch 尚未連 timeout signal；TEST_ONLY fixture 不作上線證據。 | 實際 fetch 使用 AbortSignal/deadline；deadline後最多一次派送、清算狀態 uncertain 並保留預留。 | timeout 確實 abort fetch、無重試；lease timing 邊界及晚到 response 不釋額／不二次 settle。 |
| 公開基價與預留 | Global 公開首階最高價 US$40/1,000＝40,000 µUSD/event。`priceScale=5/4`、reservation 50,000 µUSD（US$0.05）為**已批准本機候選／mock 值**；僅作整數算術候選，不由帳戶 CSV 推導。 | Global／India 官方價表；帳戶交易頁 TWD 幣別欄；台灣匯率政策；帳戶 CSV 的兩個 Places SKU 數值。CSV 未標幣別／匯率，以上來源不可混為同一幣別或上界證據。 | 候選值僅本機／mock 已批准；25% 不是完整帳單上界，帳戶附加費及 billable event 數仍未完全確認。 | 不寫入 production price table；任何正式 reservation／`live` 另需 T151 證據與批准。 | 本機 fixture 保持 USD／µUSD 權威單位，不新增 TWD quota／自動換匯 UI；production 仍 fail closed。 |
| 成功結算估算 | 50,000 µUSD reservation 為本機候選值；帳戶 CSV 首階數值約 1,271.20／1,000 events，但幣別／匯率未標示，不能轉換成 USD／µUSD estimate。 | 帳戶 CSV 與交易頁、官方每月初設定換匯規則分別記錄；request response 不提供 account invoice linkage。 | 本機／mock 候選批准不代表實際成功結算價或帳單核對完成；一次 API response 不等於已核實帳單。 | 綁定成本版本及 SKU；只按可信 usage／price estimate settle，不把估算說成 invoice。 | request→SKU count→usage report→invoice 對得上；缺 usage／矛盾不得樂觀釋額。 |
| 成功／失敗／timeout／retry 計費 | 已知價目以 billable events／SKU 計價，但本次所查公開文件沒有足夠明確地把此 route 的每種 HTTP 成功狀態、空結果、4xx／5xx、連線失敗及 client timeout 對應到實際 billable event。若完成一次成功回應且帳單確認為一個事件，候選基價如上；helper 現行無自動 retry，第二次派送只能由另一筆明確操作產生。 | 官方 [Usage and Billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)、[SKU details](https://developers.google.com/maps/billing-and-pricing/sku-details)、[Nearby](https://developers.google.com/maps/documentation/places/web-service/nearby-search)、[Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search)。 | **逐結果計費語意缺證據**；不假設 HTTP failure 免費、不假設 timeout/abort 未計費，也不把一次本機 fetch 等同一個已核實供應商事件。 | 依既有 uncertain contract：dispatch 後未取得可信「未計費」證明則保留原預留、不退款、不重試；錯誤回應維持 fail closed。 | 後續 mock 驗證 HTTP error／timeout／abort 僅一筆派送、uncertain、無 second attempt；真實計費語意須官方書面說明或去識別化 SKU usage／invoice 核對，本輪沒有測試。 |
| 價表有效期 | 從核准時 `effectiveFrom` 起 7 日，半開區間 `[effectiveFrom, expiresAt)`；逾期 fail closed，不自動延長。 | D09 7 日有效期已批准作本機候選／mock 查核期限；非供應商價格保證。 | 本機候選／mock 已批准；此期限不代表 Google 於 7 日內固定價格。 | production 若採用仍須另行明確批准；逾期不得自動延長。 | 生效前、到期時間、失效後全部拒絕；舊版本不可自動續期；檢查 SKU／價格來源版本。 |
| 帳戶上界證據 | 已確認 Cloud Billing 交易頁顯示 TWD；官方政策說明台灣使用 TWD、美元價格按月初設定匯率換為當地幣別；CSV 列出兩個 Places SKU 首階約 1,271.20／1,000 events。 | 2026-10-08 使用者提供截圖、官方文件截圖及帳戶價格 CSV；CSV 無幣別／匯率標示。 | 幣別與價表數值有直接觀測；CSV 金額幣別、適用費用邊界、稅／附加費、各結果計費及錯誤／timeout 語意仍未確認，不能宣稱完整上界。 | 不從 `$` 欄名推定貨幣、不自行換算；成本上界與正式啟用保持 T151／獨立批准 gate。 | 後續 redacted review 必須可核對 SKU、有效價表／金額單位及額外費用邊界；任一未知阻擋正式上界。 |
| free cap／discount／實際 bill | 帳戶本月各 SKU 使用量、free cap 剩餘、discount/credit 與 billing export/report，可供預測本期實際帳單。 | global cap 1,000、India cap 7,000；帳戶跨 project 按月聚合；折扣／free usage 降低實際支出。 | **只影響實際帳單，不是成本上界必要證據**；不得用其折抵正式 reservation 或證明未計費。 | 不因 free/discount 調低成本上界；真實付費測試、啟用 export/quota/API key 仍另批。 | 去識別 reconciliation 說明成本、usage 與 invoice 差異；未查明差異不啟用。 |

#### 營運者最少需提供的去識別化證據

**成本上界必要**：① 適用 billing country/region 與是否符合 India 專屬價表的確認（不需地址或帳戶 ID）；② 兩個實際 SKU ID／名稱及未折扣公開或合約單價、適用幣別，所有可能稅、換匯或額外費用是否包含／有上限；③ 專案是否使用其他價表／合約與同帳戶跨 project 聚合規則的去識別摘要；④ 官方對錯誤／timeout 計費的明確說明或支援回覆；⑤ 若另行批准低量真實測試，專用隔離 project 的時間窗、兩個 SKU 的 request/usage 計數與 invoice/billing export 摘要，用於核對一次操作最多一個事件。這些資料不得含 API key、token、完整 billing account ID、email、subject 或原始帳單識別欄位。

**只影響實際帳單、不作上界證據**：當月 free cap 剩餘、其他 project 已耗量、promotion／credit、折扣、實際預計使用量。可提供去識別的 usage／invoice 摘錄做帳單預測與後續對帳，但不能據此把 formal reservation 降低或宣稱有硬上限。新建 billing export、改 quota／budget、建立／限制 API key、任何 Places API 真實測試及 `live` 切換皆不在本次授權。

#### 批准後工作與停止點

完整 field mask／region→SKU／price/scale/validity 有明確批准與上界必要帳戶證據後，再依原 Spec Kit approval flow 更新 formal Spec／Plan／contract／Task，另取得實作授權；實作後才安排 field mapping、input boundary、single-attempt/timeout/lease、cost registry 與 settlement 的 targeted tests。通過條件包括：每 route 完整 mask 僅映射一個已核准 SKU；所有限制在 reserve/upstream 前強制；至多一個 upstream attempt、8 s timeout 與既有18 s lease一致；cost estimate 不超過批准 reserve；failure/timeout unknown 保守記帳；到期或證據缺漏 fail closed。這些均是**未來驗收條件，不是本次應用測試 PASS**。

本次完成的只是公開資料與本機程式盤點及文件同步。`T151` 仍未結案；`T146` 不重開、不勾選；`T152` 維持結案；`T153`／`T154` 與 12 項正式 gate 不勾選；production 六端點維持 `live:false`、speech 真實呼叫受阻。完成決策包後停止，待營運者提供上列最少證據並決定 1.25 scale／50,000 µUSD 候選、7 日有效期及是否進入 formal Spec/Plan/Task approval flow。

### D14｜公開免費資格及能力查核

下表每列查核日期均為2026-10-07；「公開支持」不等於本帳戶實測。

| 官方URL／查核項 | 支持結論 | 不確定處／執行影響 |
| --- | --- | --- |
| [Upstash Redis Pricing](https://upstash.com/pricing/redis)（FAQ及公開瀏覽器Free比較表） | Free為256MB、500K commands/月，Free表另列10GB/月bandwidth及1個Free DB。PAYG為US$0.20／100K commands；升級後不沿用Free的500K免費commands，monthly budget僅PAYG可用。 | FAQ「最多10個DB免費建立」與Free表「1 Free DB」不是10個Free DB保證；帳戶是否仍有Free DB名額、月剩餘額度與是否連信用卡皆未確認。不得升級或走頁面提供的無帳戶POST建庫捷徑。 |
| [同一pricing FAQ](https://upstash.com/pricing/redis)（commands計費） | 讀／寫同價；AUTH、HELLO、SELECT、COMMAND、CONFIG、INFO、PING、RESET、QUIT等operational commands不收費；Global多read region的寫入replication亦算commands。 | 公開FAQ未明確界定EVAL本身與每個內部`redis.call`如何併計，以及用量面板延遲。10,000限制不得以HTTP requests／EVAL次數代替；內部命令暫作保守控量，不冒稱已確認計費定義。需owner提供官方說明／支援回覆與日後隔離計數證據。 |
| [Compatibility](https://upstash.com/docs/redis/overall/compatibility)、[EVAL](https://upstash.com/docs/redis/commands/scripting/eval)、[REST](https://upstash.com/docs/redis/features/restapi) | 支援TCP／HTTPS REST；EVAL以script、numkeys、KEYS／ARGV傳入，預設global lock，單次原子執行，REST JSON回應有`result`。 | 不能由文件推論本機全部Lua／cjson、`TIME`在script中、動態key、error／unknown、兩writer及實際same-slot均已驗。文件的可選key-locking不成為本次改script授權；維持既有same-tag設計。 |
| [TIME](https://upstash.com/docs/redis/commands/server/time)、[TTL](https://upstash.com/docs/redis/commands/generic/ttl)、[PTTL](https://upstash.com/docs/redis/commands/generic/pttl) | TIME回server Unix seconds＋microseconds；TTL為秒、PTTL為毫秒；−1是存在但無到期、−2是不存在，不當合法期限。 | 支援文件不是本DB實測；精度、script組合、cleanup邊界、provider response皆待T153。2小時內長TTL只驗合成record／截止邊界，不宣稱已等待24h／7d。 |
| [Durability](https://upstash.com/docs/redis/features/durability)、[Backup／Restore](https://upstash.com/docs/redis/features/backup) | 官方描述持久化一直啟用；可backup及restore至account／team內DB。restore前會刪除target全部既有資料；backup期間一般Redis commands仍可寫。 | 不等於SLA、獨立可信floor或一致freeze snapshot。頁面未證明本Free帳戶backup／restore免費或可用；不得以persistence冒充restore演練。沒有free資格及獨立manifest證據就保留restore未驗，不建第二DB／升級。 |
| [Google Audience／Testing](https://support.google.com/cloud/answer/15549945) | 一般Testing上限100 test users、授權7天，但僅`openid`／email／profile子集合為例外：不要求在test-user名單、無該警告、無7天到期。 | 本repo只`openid`，故**Testing＋test users不是登入隔離保證**。仍只使用批准測試身分，需獨立Preview存取控制；登入不等於paid eligibility。若原提案把名單當硬拒絕邊界，須先由owner調和，不能偷加scope／登入allowlist或修改既有auth契約。 |
| [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect)、[Web server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server) | `scope`需含openid；ID token `sub`為stable identity，callback必須exact match authorized redirect URI，否則redirect_uri_mismatch。 | 不申請email／profile／offline；server code flow的redirect登記不同於JavaScript authorized origin。本機另強制HTTPS／同origin／`/api/auth/callback`無query/hash；實際client／consent／Workspace限制／callback皆未知，未code exchange或token保存。 |
| [Vercel Hobby](https://vercel.com/docs/plans/hobby) | Hobby免費，限非商業個人用途；月included usage包括4 CPU-hrs、360 GB-hrs、1M Function invocations。超限可能暫停，非無限免費。 | Tokyo Mate／owner實際用途、plan／現有共同耗量未知；2h窗口不是2 CPU-hrs保證，更不是免費證據。資格不符即停，不升級。 |
| [Vercel Environments](https://vercel.com/docs/deployments/environments)、[Env scoping](https://vercel.com/kb/guide/how-to-add-vercel-environment-variables) | 標準Preview全plans可用；custom environments需Pro／Enterprise。branch-specific Preview會繼承一般Preview設定；team／integration env亦須盤點。新project**第一次deployment為production**。 | 專用project不自動保證第一次是Preview；本批准禁止production部署，首次部署target須先取得可驗證方案及明確調和，不能直接執行原C階段。env改動只影響新deployment；移除binding不撤回舊deployment已持有的值，清理須同時撤銷隔離credential及關閉舊部署。 |
| [Deployment Protection](https://vercel.com/docs/deployment-protection)、[Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication) | Vercel Authentication全plans可用；有部署view access者可進。Password Protection不支援Hobby。 | Google test-user資格不等於Vercel view access；需owner證明operator／各test users的授權及callback仍受保護、無公開bypass。不為US$0方案購買Password／其他方案、不關閉防護。 |
| [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)、[Node20退役公告](https://vercel.com/changelog/node-js-20-is-being-deprecated)、[Function limits](https://vercel.com/docs/functions/limitations)、[Sharp install](https://sharp.pixelplumbing.com/install/) | Node版本頁列24.x default／22.x／20.x，但較具日期的公告明列2026-10-01起Node20不接受新部署，舊部署不影響。標準Node Function uncompressed bundle上限250MB。Sharp要求Node-API v9及符合target OS／CPU／libc的native binaries（如Linux x64 glibc≥2.28）。 | 不把舊版本清單當現行Node20新部署授權；本project runtime／架構／build image、sharp＋libvips實際bundle／notices／cold start均未驗。Windows tests及Vite build不是Linux Function artifact證據；本次不改engines／runtime、不裝Linux binary或新架構。 |

### D14｜US$0／2小時／10,000 commands與清理預留的可執行性

**結論：公開功能先備部分成立，實際啟動條件未成立；不得開跑。** 候選限制原樣保留，沒有批准新額度或放寬時間。US$0是人工執行政策，不是帳戶硬billing cap；免費quota、storage、bandwidth、Function CPU／memory與DB名額都須同時成立，不能只檢查commands。

1. owner先交去識別化日期／來源證據：Upstash帳戶／team權限已確認的聲明、Free名額／plan／region／read regions、月commands／bandwidth／storage實耗與剩餘、auto-upgrade／credit card狀態、EVAL內部計數規則及面板延遲、backup／restore資格與是否收費。Google交test project為隔離資源的聲明、External／Testing／scope摘要、測試身分以A／B／Admin代號、client type及callback合法性；不交email／sub／client secret。Vercel交Hobby非商業資格聲明、plan／月餘量、Preview protection／view access、team／project／integration env的**名稱與scope**、無production依賴／秘密繼承聲明、runtime／架構／首次deploy target。未提供就停該子範圍，其他公開查核可完成。
2. command容量公式：`C_total=min(10,000, owner確認的剩餘Free commands)`；`C_test=C_total−C_cleanup−C_usage_reads−C_confirmation−C_uncertainty_margin`。cleanup、用量讀取、unknown後確認與計量延遲裕度全部在總量內；`C_test≤0`／任何項未知即不啟動。每batch最壞commands必須先有界，扣除後才派送；provider面板僅事後佐證，不能靠延遲面板當硬cap。EVAL外層＋內部命令及replication按已確認規則與保守量取較高，未確認前不得填成1。
3. 清理容量須在另批的有界先導批次量測，先導本身也算commands／時間；若需先導，owner須先批准其max command及清理保守上限，不能為取得上限無界開跑。本次沒有建立runner或計量。synthetic payload≤1MiB仍須另估Redis JSON／indexes／snapshot overhead與REST bandwidth，不把payload當DB總size。
4. `t0+2h`是流量及資源操作窗口上限；開始前指定cleanup時間預留，最遲在`deadline−cleanup預留時間`停止新batch。batch無法在deadline前連同有界清理／unknown確認完成即不派送。2h不足以完整驗長TTL實際經過，也不保證backup／restore在時限內結束；分項缺證據保留pending，不延長、不冒稱完成。

### 必要本機接線清單（只盤點，不實作）

| 缺口／現有接縫 | 下一批必要工作；不得於本次實作 |
| --- | --- |
| environment contract | [.env.example](../../.env.example)只有既有provider名稱；OIDC名稱常數不等於env loader。需正式明列隔離schema：REST URL／token、OIDC config／secret／policy、HTTPS origin／callback、M1來源、四keyring version／current映射、namespace／epochFloor／獨立manifest、registry TEST_ONLY、截止及計量限制。缺／非法fail closed，無production fallback；值不寫文件／repo／log，不新增Session signing key。 |
| namespace | [REDIS_QUOTA_KEYS](../../api/_lib/redis-shared-store.ts)實際只接受`{[A-Za-z0-9_-]{1,64}}`。舊提案`tokyomate:{preview-<random-id>}`**不可直接當namespace傳入**；適配現有契約應傳`{preview-<random-id>}`（placeholder需代入合法值），由helper產生同tag keys。本次只修正操作文字，不改程式regex／key schema；每個EVAL實際KEYS仍需T153核對。 |
| trusted composition | [local adapters](../../api/_lib/local-protection-adapters.ts)、[REST transport](../../api/_lib/redis-rest-transport.ts)、[OIDC config](../../api/_lib/oidc-config.ts)及library binding已有注入接縫；[callback export](../../api/auth/callback.ts)仍未配置。需僅隔離server-side composition把store／Session／rate／state-HMAC／OIDC provider／epoch floor／lifecycle evidence ports連到既有factories；不因放env自動完成，不接付費executeUpstream。 |
| runner／實際證據 | [package scripts](../../package.json)只有既有Vitest／Vite／mock E2E，沒有真實REST雙process／預算停止／cleanup runner。需沿現有工具建立有限先導與兩writer barrier、command上界／deadline、output去秘密、failure/unknown不retry及獨立讀取確認；upstream全部mock，不加SDK／dependency。 |
| restore／native／Preview | restore須在writer freeze後由隔離backup＋獨立可信manifest／floor驗拒倒退；不能從舊backup自證floor。Linux native artifact／size／notices與固定部署callback／存取防護另取證；首次deploy target未調和前不部署。 |

### 下一批具體批准範圍與清理（仍待批准）

不另增Task／決策包：沿T151／T153／T154及既有A～G階段。建議先批准**本機environment contract＋TEST_ONLY composition／bounded runner**，按既有Readiness flow實作／驗證，不重開T152。接著只有owner身分／資格／餘量與上述三項阻擋（openid隔離、首次deploy target、commands／restore資格）調和後，才分別批准：

- **隔離資源／秘密**：指定owner、1個符合Free資格的Upstash DB、1個Google test project／Web OAuth client、A／B／Admin測試身分、四family隔離key與Preview-only bindings、exact callback、namespace、start／deadline／cleanup責任人。只`openid`，無production資料／credential、無其他API啟用；若需額外restore DB另批，不從「1個DB」推導。
- **Redis先導及T153測試**：有限synthetic寫入／雙process EVAL／TIME／TTL／cleanup、明列計量與清理預留、US$0／總≤10,000 commands／≤2h／payload≤1MiB、paid upstream零次。backup／restore是**清空target的破壞性隔離操作**，須精確source／target與獨立manifest、免費資格及另行明確批准；缺則只完成其他證據，restore保留未驗。
- **Preview與T154 Google流程**：專用固定HTTPS deployment、確認target不是未批准production、無秘密繼承、Vercel存取控制及測試身分view access；最多10次人工login attempts含失敗，不自動重試、不保存provider tokens。此部署批准不含production、模式切換、live或paid upstream。
- **D01另批**：兩route至多各一次的Places真實attempt、API/key與binding異動、已核定帳戶最壞USD金額／停止門檻、去識別化SKU／usage／帳單取證；與D14 US$0批次完全分開。沒有成本核定就不啟動。

到STOP／deadline前停止新流量、freeze runner並完成unknown唯讀確認；只對inventory明列的隔離資源移除callback／Preview bindings與測試存取、撤銷OAuth client／secret及Redis token、關閉所有持有舊設定的隔離deployment、刪除隔離records／DB及backup／export（若已另批建立），最後由owner確認project／test-user相關資料處置及用量／帳單。不得使用FLUSHALL／掃除production／刪repository；既有真實帳號不刪。保留無秘密的撤銷／刪除／用量證據；清理失敗立即人工處置、pending，不宣稱US$0或已清除。

本次文件查核及Safety實際結果見[既有實作證據的新批次](../../docs/verification/005-local-implementation-evidence.md)。查核完成後停止，不詢問重新批准已結案工作、不執行上述下一批操作。

## 2026-10-07 T152 文件結案與下一批批准界線（本次現行）

本次只批准文件核對、T152本機父任務結案與D01／D14方案準備。依[Tasks原定義](tasks.md#2026-10-07-t152-本機父任務結案本次現行)，T155～T161本機完成已滿足T152；真實Redis／restore／production清除不是其完成條件。核對依據與本次Safety見[實作證據](../../docs/verification/005-local-implementation-evidence.md)。正式12項gate維持未勾，六端點`live:false`、speech受阻；T153／T154與成本、部署等正式範圍未完成。

不另造決策包：沿用下方[D01成本矩陣](#d01六端點成本上界證明矩陣)與[D14隔離操作包](#d14隔離外部驗證操作包本輪不建立不登入不連線)，只補[Places下一批操作清單](#d01places-下一批操作清單本次補充待批准)及[D14執行補充](#d14-下一批執行補充本次補充待批准)。下方早期「T152正式父任務不勾」為結案前歷史；歷史價格／free tier記錄沒有在本次對外重查，不可當執行日有效價格。

| 類別 | 批准現況與操作界線 |
| --- | --- |
| 已批准本機工作 | T155～T161既存成果與本次文件結案；保留原批准，不重問、不例行重跑已結案測試。本次不修改application code。 |
| 待批准外部唯讀 | 公開官方文件查核、登入Console唯讀檢視SKU／billing／帳戶／runtime與既有用量；本次均未執行，唯讀不代表本次已授權外部服務操作。 |
| 待批准外部異動 | Google／Upstash隔離資源、OAuth test users、隔離secret／Preview bindings、隔離資料寫入與資源清理；不可觸碰production。 |
| 待批准付費測試 | 任何Places真實請求，即使估計落在free cap，也按可能產生費用處理；Redis／Vercel升級與其他付費上游另批，不由資源批准推導。 |
| 待批准部署／啟用 | 專用Preview部署需獨立批准，與production部署／secret／live／模式切換分開。成本數值審核也不是啟用批准。 |

## 2026-10-07 Epoch 本機完成評估

T157～T161已完成原批准的可執行本機範圍並實跑：targeted222、完整回歸1287、隔離E2E14通過，新增epoch Lua54實跑／0跳過。strict／build通過，Safety與命令見[最新證據](../../docs/verification/005-local-implementation-evidence.md)。本機子範圍完成不代表005／真實整合／正式Readiness READY；本次依原定義結案T152本機父任務，正式證據仍留T153等既有任務，12項gate仍未勾，production六端點`live:false`、speech受阻。沒有新增外部操作或正式輪替／清除／cutover／部署授權。先前將T152描述為正式父任務且不勾的判讀，現已由本次核對修正；既存實跑數字不是本次新測試。

下方P／未實作／advisory標籤保留為各批歷史；E01～E10明列參數已可在批准的本機composition使用，**不**可作production生效設定。source-map-js既有1.2.2成果保留，本接續批次沒有修改manifest／lockfile或重新對外audit。

## 2026-10-07 Epoch 完整推薦與 advisory 唯讀查核（本輪現行）

本輪已批准 E01～E10 推薦方案的本機程式、隔離測試、UI與文件實作。這不批准正式環境啟用或證據：外部服務／帳戶操作、正式秘密、付費呼叫、正式key輪替／資料清除、legacy cutover、排程啟用、Preview／正式部署、正式模式切換及D01 production價表／成本上界仍未批准。signing verify-only只禁止新簽，不禁止仍有效舊capability在本人Session／資格／限流／成本／epoch authority／原子首次grant全部成立後首次執行；fingerprint verify-only只比較既有操作；已grant不得二次grant，撤銷／退役不追溯作廢入帳、uncertain占用或保守結算。

**一次審閱的唯一完整答案**：[E01～E10推薦表與DTO／保存／文案](contracts/request-epoch-and-key-lifecycle.md#9-e01e10-完整推薦決策包2026-10-07唯一集中答案)。表內每項均有理由／取捨、A已批准部分、P待批准部分、任務與批准後範圍、可執行驗收與證據。P值尚未生效，不可採作技術常數。

| ID | 唯一推薦摘要（P；詳細界線以契約表為準） |
| --- | --- |
| E01 | 本機實作同一POST簽發／同命令確認；body只endpoint＋可信epoch hint命令；未知結果不付費送出；正式入口仍停用。 |
| E02 | capability24h／UTC日epoch24h／最後簽發後最多24h重疊，Redis TIME、0容忍、pre-sign提交≤2000ms；accounting晚到不受capability期限截斷。 |
| E03 | body1024B／完整response4096B／token1024B，10次固定60s、20未用handle、100新簽發／owner／epoch；去重至退役後24h，刪後屏障拒絕原命令。 |
| E04 | 獨立四key families、32bytes HMAC-SHA-256、固定陣列canonical token；重用fingerprint v2，不新增套件；owner/index domain分離。 |
| E05 | 現有同slotRedis原子authority／連續watermark＋例外deny set，獨立發布manifest／最低generation與freeze後restore；無證明維持503。 |
| E06 | 本機隔離測試oneOf DTO與明確legacy拒絕配置；不啟用production cutover、不刪legacy索引；狀態查詢免費唯讀。 |
| E07 | 30天規則可配置／測試；uncertain保留原窗口；正式清除需帳單／爭議窗口、退役屏障與引用歸零證據，不足只dry-run／拒絕。 |
| E08 | 24h首次review／每7d覆核／30d升級的本機參數；單一可信管理者分步確認、每步重新授權及完整audit，無第二管理者要求。 |
| E09 | 90天正常輪替週期作本機配置參數；不生成／輪替正式key、不按固定期限清舊key；單一可信管理者分步確認並稽核撤銷／退役操作。 |
| E10 | 本機錯誤／手動UX；unknown只用原命令確認，不自動重試；新操作提示可能另占額／計費，production行為不切換。 |

本機E01～E10程式與隔離驗收是本輪執行項，不需逐項重批；正式Readiness仍受前述獨立gate限制。D01成本／輸出上界、D14外部資源與真實跨instance、正式秘密／付費／部署／模式切換不因本機PASS而READY。Advisory的定向修補亦已批准，僅升級 `source-map-js` 至1.2.2。詳見[最新005證據](../../docs/verification/005-local-implementation-evidence.md)。

## 2026-10-07 D13 本機批准與 D01／D07–D08 限定收斂（現行）

使用者已批准 `openid-client@6.8.8`、lockfile 鎖定 `jose@6.2.12`／`oauth4webapi@3.8.8`、`sharp@0.35.5` 與平台 optional dependencies 的本機安裝、既有 adapter 接線、測試及文件同步。D01 僅不付費取證；D07／D08 僅 [完整契約草案](contracts/request-epoch-and-key-lifecycle.md)，真正待批 E01～E10 集中於該文件，不採新成本／保存／epoch 值。

本機 Windows x64／Node v24.19.0／npm 11.11.0 已實裝上述精確版本；`jose`／`oauth4webapi` 無直接程式 import，僅 transitive＋scoped overrides。registry 重新核對：`sharp` 必要 JS dependencies 實為 `semver@7.8.5`、`@img/colour@1.1.0`、既有 `detect-libc@2.1.2`；Windows 自動取得 `@img/sharp-win32-x64@0.35.5`，optional wasm32／`@emnapi/runtime@1.11.3`／既有 `tslib@2.8.1` 由 npm 處理，未手動安裝 Linux binary。registry 此次未回傳 `jose` engine，舊表的 `>=20.19.0` 不是此次 metadata 證據；本機實跑才是相容性證據。

OIDC 使用 library discovery／authorization URL／code grant＋PKCE／nonce／state／`enableNonRepudiationChecks` JWKS 簽章驗證，再核對既有 claims policy；不自行 decode／verify JWT。decoder 接 `images.verify`、三格式／單頁／3 MiB／2048、像素上限由 2048² 推導，raw 完整解碼及 native timeout，缺設定拒絕。所有預設 HTTP factory 仍未配置，六端點 `live:false`、登入不等於資格、opaque Session逐請求 lookup 不變。精確命令與結果見 [本輪證據](../../docs/verification/005-local-implementation-evidence.md)。

Vercel runtime／architecture 未確認**只阻擋部署驗證**，不再是相容本機安裝的 gate。外部帳戶／資源、正式秘密、付費呼叫、Preview／正式部署、正式模式與新参数未批准；D14 不執行。LGPL notices 保留，正式交付須完成 native bundle 的 notices／可用對應來源及適用 LGPL 義務檢查，不以本機 build 冒充部署。

## 歷史：2026-10-07 D13／D01／D07–D08／D14 收斂提案（批准前）

本節是本輪新查證的現行提案，優先於本文件下方相同 ID 的歷史候選值；它不改已批准政策，也不構成套件、程式、外部資源、付費測試或部署授權。D10／D11、D02–D06、D09、D12、D15–D17 等已批准方向維持原狀，無須重批。任何本節候選數字在明確批准前均非生效設定；production 六端點仍 `live:false`。

### D13｜精確依賴建議

查核日：2026-10-07。來源為 npm 官方 registry 與各套件官方 repository／安裝文件。Recommendation ≠ package installation approval。

| 用途 | 唯一推薦套件與版本 | 授權／Node、TypeScript、ESM | 直接與必要傳遞依賴／體積 | 部署及維護取捨 |
| --- | --- | --- | --- | --- |
| Google OIDC 真實 binding | `openid-client@6.8.8`；鎖定 `jose@6.2.12`、`oauth4webapi@3.8.8` | 三者 MIT；`openid-client` 為 ESM 並附 TypeScript declarations；官方 API 有 discovery、authorization URL 與 Authorization Code + PKCE。`jose@6.2.12` registry 的 Node engine 為 `>=20.19.0`。Vercel 文件列 Node 24 預設、22 可用，亦列 20；另有 Node 20 自 2026-10-01 deprecated 的公告，故實際部署 eligibility 須由 owner 確認。 | `openid-client` 必要 runtime dependencies 為 `jose`、`oauth4webapi`，目前 registry latest 與範圍解出的精確版本如左；三包 registry unpacked size 合計 758,789 B，不含專案 bundler overhead。純 JS／Web API，無原生 binary。 | ESM 與現行 `package.json` 的 `type: module`、TS `moduleResolution: Bundler` 相容；須驗證函式 runtime 及 serverless fetch timeout／JWKS cache 行為。升級須重新審查 lockfile、API breaking changes 與 token 驗證測試。 |
| 後端可信影像 decoder | `sharp@0.35.5`；目標 Linux glibc x64 時含 `@img/sharp-linux-x64@0.35.5`、`@img/sharp-libvips-linux-x64@1.3.4` | `sharp` 與 native binding 為 Apache-2.0；Linux x64 libvips bundle 為 LGPL-3.0-or-later，須保留 notices 並做發佈授權檢查。附 TS declarations、ESM export；Node-API v9，官方安裝文件要求 Node `>=20.9.0`。Vercel Node 22／24 符合套件下限。 | 無一般 JS runtime dependency；有平台專屬 optional native packages。Linux x64 registry unpacked size 約 20,100,407 B（sharp 962,168 + binding 427,138 + libvips 18,711,101）；此為套件解壓大小，不是實際函式 bundle。Linux arm64 套件不同，且 runtime 架構未確認。 | 增加約 19.2 MiB Linux x64 native/package payload、native loader／平台打包風險與 LGPL 依賴審查；完整解碼及像素處理成熟，但須限制輸入格式／像素／單頁並測 malformed image。不得因支援格式較多而擴大既有 JPEG／PNG／WebP 契約。 |

**Vercel runtime 未確認**：本機 Node 為 `v24.19.0`，只代表本機工具；`package.json` 未設定 `engines.node`，`vercel.json` 沒有 runtime 設定。repo 有 `.vercel/project.json`，但未讀取帳戶識別或連接 dashboard。官方文件說新專案預設採當時最新 LTS 並可在 project setting 覆寫，不能據此推斷本專案函式現行 runtime／架構。套件批准前須由 project owner 提供 Vercel Project Settings 的 Node.js Version、實際 Function runtime／architecture 及 preview build 證據；若不是 Node 22／24 或 native Linux target 未知，STOP，不安裝、不改 `engines` 猜相容性。

**接線界線與批准後驗證**：

- `openid-client` 只實作既有 `OidcClientLibrary`／`oidc-provider.ts` 與 `oidc-flow.ts` 接縫：以 discovery 取得可信 Google metadata，交由 library 建 authorization URL、處理 authorization-code + PKCE 與經 library 驗證的 ID-token claims。若現有 port 的分離 `exchangeAuthorizationCode`／`verifyIdToken` 迫使呼叫端自行解 JWT 或 JWKS，先調整 adapter interface 再接 library；不得用 JWT decode 或自製 crypto 代替。保留既有 issuer、audience／`azp`、nonce、`iat`／`exp`、state 單次消耗、5 分鐘 state、opaque Session、逐次 store lookup、logout 與 fail-closed。
- `sharp` 接到現有 `PaidBoundaryOptions.images.verify(bytes, mime)` port；驗證真實 decode、格式與 dimensions，僅接 JPEG／PNG／WebP，遵守已批准 3 MiB／2,048 px 上限；不接新 endpoint、不存檔、不信任 client dimensions。沒有 decoder、解碼錯誤、逾時／超限皆 fail-closed。
- 安裝前後須保存 package／lockfile diff 與 registry integrity；跑 targeted adapter／輸入測試、strict type-check、Vercel preview build，並檢查 serverless artifact 含正確 Node/Linux binary、壓縮／解壓大小、cold start、timeout。OIDC 另測 code exchange／signature／JWKS／claims；image 另測截斷／格式偽裝／極端 dimensions／單頁與 bytes±1。Rollback 僅反向移除該套件與本次 adapter diff，不回復其他工作樹變更；目前不得執行安裝、移除或程式修改。

### D01｜六端點成本上界證明矩陣

`api/_lib/cost-price-table.ts` 現行 production table 六端點全部 `live:false`、`pricing:null`、`priceScale:null`、allowlist 為空；故目前沒有可用 production cost estimate。`tests/fixtures/cost-price-fixtures.ts` 的 live flags、價格、`24,100`、`10,400`、`52,369`、係數與金額全是 fixture，不可當核准價格或上界。`api/_lib/cost-estimators.ts` 的數值算術不補足缺失的供應商計費前提。

| 端點 | 已核准／現行可強制的限制 | 尚未批准的數值／模型選項 | 最新本機證據（不是成本證明） | 尚缺的可信上界前提 | 不連外可完成 | 必須取得真實供應商證據 |
| --- | --- | --- | --- | --- | --- | --- |
| `assistant` | body 16,384 B；文字最多 1,000 UTF-16 units；共享文字 builder 限定 prompt／knowledge bytes；A=1 方向已批准。emergency branch 不呼叫模型，不可代表 travel 成本為零。 | `gpt-4o-mini` 是預設但 `OPENAI_MODEL` 可覆寫；正式白名單、輸出上限 2,000 tokens、S 值、24,100／23,516 等 tokens／bytes 值均不得視為核准成本上界。 | `buildTravelInput` 真實 builder 最大目前 prompt＋knowledge＋使用者文字＋包裝為 20,295 UTF-8 B；若 prompt 上限取 4,096 B，算術候選為 23,516 B。兩者都不是 token 上界。 | travel／translation 路徑完整序列化、系統 prompt／knowledge 與 Responses API 框架 tokenization；輸出 cap 是否含 reasoning；model／service tier／區域價、實際 usage 對照及供應商帳單。 | 同一 builder 量兩路徑及最大 UTF-16／knowledge／逃脫樣本；驗證 preparse cap、上限±1、unknown env model 零上游；不可把 bytes 換成 tokens。 | 由隔離帳號確認實際 model／tier、Responses usage、輸出／reasoning 行為、request ID 對應 usage 與帳單價格；需要付費呼叫時另批。 |
| `photo-translate` | body 16,384 B；`sourceText` 最多 2,000 UTF-16 units；`zh-TW`／`ja` allowlist；共享 builder 組完整 instruction＋三反引號資料包裝。 | `gpt-4o-mini` allowlist、`max_output_tokens:4096`、S 值及 `10,400` tokens／相關預留均待批准。 | 實際 builder 最壞完整文字 7,157 B，最長 instruction 1,058 B；非 token／價格證明。 | Responses API message framing／tokenizer、模型／tier 與輸出 cap；完成產生文字的最大 output tokens；真實 usage／invoice 關係。 | builder byte 組裝、最大合法 Unicode／escape、cap±1、正常樣本／truncate contract 測試。 | 以隔離 OpenAI project 取可追溯 usage／tier 與帳單；付費測試另批。 |
| `photo-ocr` | body 4,200,000 B；JPEG／PNG／WebP；解碼後 ≤3,145,728 B、最長邊≤2,048、`regionVersion≤9,999,999,999`；後端必須用可信 decoder。 | `detail:'high'`、`max_output_tokens:3072`、模型白名單、8 tiles／48,169 image tokens、52,369 total tokens、S 與預留都不是目前已證明／批准值。現行內容路徑仍 `auto`／無 output cap，HTTP boundary 缺 decoder 時 503。 | instruction 627 B；最壞 image JSON 外殼算術 4,194,373 B；只測 bytes，不代表 image decode、pixels、tiles 或計費。 | 可信 decoder 實際格式／dimensions／像素、模型實際 image resize／detail／tile billing 規則、文字與 message 框架、輸出 cap、service tier、實際 vision usage。 | 接線前以現有 decoder port 的 contract fixtures 驗格式／dimensions／bytes；測 malformed／truncated image、3 MiB／2,048±1 和 JSON envelope，不送上游。 | 廠商官方 image billing／SKU 規則 + 隔離真實 vision usage 對 tile／detail 的核對；任何真實 vision 呼叫需另批付費測試。 |
| `places` | body 2,048 B；query≤100 chars、manualArea≤50；只允許 Nearby 或 Text Search 單次其一、無分頁；field mask 固定含 `places.editorialSummary`。 | `priceScale=5/4`、50,000 µUSD reservation、7 日有效期已批准為本機候選／mock；正式 SKU 價格、billable event 數與上界未批准。 | 實際 field mask／route 可唯讀核對；TWD 交易頁、官方換匯政策及兩 SKU CSV 首階數值已記錄，但 CSV 未標幣別／匯率，不能證明供應商帳單上界。 | `editorialSummary` 所觸發 SKU 與所有 fields 的 SKU union、帳戶適用 tier／費用邊界、錯誤／timeout 計費與同一次操作最多一筆 billable event。 | 對 field mask 做 deterministic SKU allowlist／拒未知欄位測試；建立最大合法請求和單一上游呼叫測試。 | 營運帳戶 billing SKU report、Google Cloud billing export／實際 request count 與帳單核對；不是單看公開單價。 |
| `transcribe` | P1 PCM：16 kHz／mono／16-bit；60 s、data≤1,920,000 B、WAV≤1,920,044 B、multipart≤2,000,000 B；後端重建 WAV；A=1 方向已批准。 | Whisper 單價／計費分鐘取整／priceScale／9,000 µUSD fixture 不批准；真實 endpoint 仍 `live:false`。 | PCM helper 能由 data bytes 建 WAV；測試輸入容量不是供應商採計時長證據。 | provider 按實際 audio duration 的 rounding／minimum billable duration、重建後音訊長度、request retry／timeout 計費語意與 tier／帳單。 | 最大／最短 PCM 及 header／duration mismatch／multipart overhead、瀏覽器支援可離線／本機驗；核對重建聲音長度，不付費。 | OpenAI 官方對 Whisper billing duration 的現行說明與有授權的低量隔離 usage／invoice；另批准真實瀏覽器麥克風測試。 |
| `speech` | `text≤500`、語言／speed enum、模型字面值 `gpt-4o-mini-tts`；D01 明確沿用已批准 S1，真實呼叫受阻。 | 可用音訊輸出上限／audio tokens-per-second／字速／輸出時長／任何 S 及 reserve 值均未核准且無官方上界證據。 | mock／timeout／平均語速／stream abort 不是計費證據。production `live:false`。 | 官方、可由後端強制的輸出音訊計費上界或可靠硬輸出限制。僅 input≤500 不能界定 output billing。 | 維持 503／零上游；只可 mock rejection；不得把 timeout 或中止視作成本上界。 | 只有供應商提供可驗證輸出計費硬上限並完成隔離證據、另行決策後才可重開；不得用付費實測校準值取代硬上界。 |

OpenAI 官方 pricing 頁於 2026-10-07 可查 `gpt-4o-mini` Standard input／output 價格，但當前 repo 仍無 production price entries；價格頁不能決定本帳戶實際 tier、優惠／區域附加或實際帳單。預留 `R_e`（呼叫前額度保留）、結算估算（依可得 usage 記帳）、供應商帳單（供應商最終 billing）是三個不同量，不得互相冒充或聲稱彼此構成硬上界。

**最小分端點啟用順序提議**（每一項需獨立完成其數值批准、證據與 live decision；不要求六端點一起解鎖）：
1. `places`：固定單請求／field mask／SKU 可驗證後先單端點 review。
2. `photo-translate`：文字 builder／output cap／model 與價格證據完成後 review。
3. `assistant`：travel 與 translation 兩條路徑均完成上界，不能只開低成本分支而忽略同一端點另一分支。
4. `transcribe`：P1 WAV 最長時長與供應商實際 billing-duration rounding 證明後 review。
5. `photo-ocr`：完成 D13 decoder、實際 image billing 證據及 output cap 後 review。
6. `speech`：繼續 S1 `live:false`；只有新的可證明硬上界提案獲批後才重新排序。

以上僅為成本證據的 review 次序，不是啟用批准；目前六端點仍全 `live:false`，且真實整合不 READY。

#### D01｜Places 下一批操作清單（2026-10-07 歷史提案；由 2026-10-08 決策包更新）

本段僅保留歷史操作提案供追溯。其「SKU 待執行日查核／價格尚未取得」及帳戶證據描述已由上方 2026-10-08 D01 查核更新，不再代表目前公開文件查核狀態；帳戶適用性與真實 usage／invoice 證據仍缺。

沿用矩陣及T151／T054／T130／T133，不移除`editorialSummary`、不變更產品欄位、不採50,000 µUSD fixture。SKU名稱以下是待以執行日官方資料及帳戶report核對的識別目標，不是本次新查證結果；沒有可靠價格就不填數字。

| 順序／操作類別 | 具體操作與應交證據 | 完成條件／停止點 |
| --- | --- | --- |
| 1 本機唯讀盤點（本次已做） | 核對[places handler](../../api/places.ts)：coordinates→`POST /v1/places:searchNearby`，manual→`POST /v1/places:searchText`，單次其一、無分頁。兩路徑相同mask：`places.displayName,places.formattedAddress,places.location,places.businessStatus,places.editorialSummary,places.types,places.id`；Nearby半徑500m。 | 保留全部七欄位、類別／文字限制與A=1；沒有真實request或帳單證據。 |
| 2 外部公開資料唯讀（另批） | 查[Nearby Search fields](https://developers.google.com/maps/documentation/places/web-service/nearby-search)、[Text Search fields](https://developers.google.com/maps/documentation/places/web-service/text-search)、[Places usage／billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)及[官方price list](https://developers.google.com/maps/billing-and-pricing/pricing)。交日期／URL／引用段落、逐field→SKU映射、兩路徑billing SKU ID／名稱；重點核對`Nearby Search Enterprise + Atmosphere`及`Text Search Enterprise + Atmosphere`與`editorialSummary`觸發規則。 | 證明所有fields的SKU union及最終計費選階規則；不可把所有field價格自行相加或只查其中一個route。未知field／SKU、New與Legacy混用即停。 |
| 3 帳戶Console唯讀（部分證據已提供；完整範圍仍另批） | 已有交易頁「金額 (TWD)」、官方台灣帳戶幣別／每月初匯率規則，以及兩個 Places SKU 首階價格 CSV 數值；CSV 未標幣別／匯率。仍需去識別化適用價表／contract／tier／volume aggregation、稅／附加費適用性、usage／invoice 對帳等必要證據。不得讀取秘密；不啟用 export、不改 quota／budget、不新建 key。 | 已確認帳務幣別，不等於 CSV 金額單位或完整上界已確認；不同 test／目標帳戶條件仍須說明。新 export／帳戶設定另走外部異動批准。 |
| 4 本機文件成本演算（資料齊後） | 對每 route 列計費事件數上界 `A=1`、單事件適用最大價格 `P_route`（µUSD 向上取整）、無 retry／page／fallback 證據及 timeout 仍可能計費語意。`C_places=max(P_nearby,P_text)`；記錄本機候選 `R_places=50,000 µUSD`（`priceScale=5/4`），不可由 CSV 數值推算換匯或成本；另列有效期、版本及輸入 SKU allowlist。 | 本機／mock fixture 可用已批准候選；只有在價格涵蓋可能 tier 與全部計費事件後，才可另議 production reservation。若有額外事件／價格無有限上界／未知費用，維持 `live:false`，回 T151 補證；不改 code／production registry 或 G。 |
| 5 低量真實測試（付費＋資源另批） | 候選只在D14隔離資源執行一次Nearby＋一次Text，最多2個上游attempt、0retry／page；合成公開地點、不用瀏覽器精確定位，使用者明確操作。申請單需填每route核定上界、總USD上限`B_places≥P_nearby+P_text`、操作窗口、operator、request count／SKU usage／billing核對方式與帳單到齊期限。 | 金額未填且未批准不執行；每次失敗／timeout也消耗attempt與最壞預算。預算不足、SKU異常、結果unknown、第三個attempt需求即停；billing延遲時保留pending，不能以未顯示charge當免費。 |
| 6 帳單核對與單端點review（另案） | 去識別化request時間／route／provider request ID（若有）、key／project測試標籤、request count、SKU units／price／帳單期間；若無逐request ID linkage，用專用隔離project、僅此2次attempt及相同時間窗的SKU aggregate交叉核對，不宣稱逐筆invoice。整理上界／reserve／usage／invoice四欄差異。 | 任一超界或無法對帳即拒絕啟用；少量實測只核對規則，不能推導硬上界。證據齊全後才提Places數值及live決策；其餘五端點不連帶啟用，speech持續受阻。 |

**現有／欠缺**：已具備本機route／mask盤點與單次呼叫mock證據；尚缺執行日兩SKU價格、全部field映射、帳戶適用性／已耗free cap、可靠計費事件上界、核定`S_places`／`R_places`及真實SKU／invoice reconciliation。上列2～3純唯讀；5即使可能免費也屬付費風險測試。4若未來需新增驗證程式或價表接線，另依原implementation flow，本次不授權。

### D07／D08｜保存、清除、uncertain 與 key policy

以下新期限都是**具體待批准候選**，不覆蓋已批准的 Session 24 小時、OAuth state 5 分鐘／單次消耗、state 到期即失效、Session 到期後 24 小時清理。原始表中的 90／180 天保存、90 天輪替、每 5 分鐘 cleanup 與 SCAN batch 建議均不生效，本提案不採用。

| 資料 | 建議保存／清除規則（待批准） | 理由、最小化取捨與驗證 |
| --- | --- | --- |
| App Session | 沿用已批准 24 小時絕對期限、logout／revoke 即刻邏輯失效；expiresAt 後 24 小時清除。不得把 revoke 時間當新 TTL 起點。 | 不延長登入資料；測期限邊界、登出後下一請求拒絕、過期清理分頁／重跑。 |
| OAuth state／nonce／PKCE verifier | 沿用 5 分鐘、callback 單次 consume；expiresAt 到即拒絕，cleanup 只能刪 `expiresAt≤Redis TIME`，有界 batch 可重跑。不得因 cookie 尚在而延長；無 scheduler 批准不保證物理刪除時間。 | verifier／nonce 只為一次交換，成功 consume 即刪；測重複 callback、到期／時計、清理兩順序。 |
| reservation detail／request fingerprint | 候選：自 `settled`／`released` 結案起保存 30 天；`reserved` 不刪。到 30 天須在同一原子操作把 detail 收斂成最小 replay tombstone 後才可刪。 | 30 天涵蓋一個月內的操作問題回溯，同時避免長期保留細節；對帳需檢查合法爭議窗口。測 detail→tombstone 競態、tombstone write fail／unknown 時不刪 detail。 |
| 日／週 aggregate usage／已結算帳務摘要 | 候選：個人／端點明細與 aggregate 均於窗口結束後 30 天刪除；不保留無期限匿名 aggregate。尚有 reservation／uncertain 關聯時不可清除該筆所需金額、原窗口、狀態及 reconciliation evidence reference。 | 30 天供近期 reconcile 並採最少留存；實際供應商月帳單可用期尚需查證，若超過 30 天，只能另提最小欄位及必要期限，不自動延長。測窗口關閉與晚到結果先後、摘要不會把舊 `uncertain` 搬到新窗口。 |
| 已處理 paid-access／top-up 申請明細 | 候選：`resolved`／`withdrawn` 後 30 天刪除個人／管理文字（現行 contract 本來不收自由文字／金額），以最小 tombstone 保留 owner-scope hash、kind、week key、dedupe index、終態。pending 不刪。 | 30 天供申請處理疑義回看；subject／reviewer 可識別欄位不延長。測本人隔離、30 天前後 list／重提、刪 detail 前同 authority 寫 tombstone。 |
| Admin audit 明細 | 候選：事件後 30 天刪除 subject／個人明細，不保留永久日彙總。若業務／法務要求更長，須另證必要性及批准期限；不採歷史 90／180 天值。 | 30 天供近期異動事故檢視，較短降低管理者／使用者關聯資料暴露；需確認法務／營運保存義務，測 role access、30 天精確 cutoff 與不可殘留可識別彙總。 |
| `uncertain`／人工對帳 | lease 到期原子改 `uncertain`，原日週額度保留、不退款、不再 grant、不移至新窗口。候選：結案目標 30 天；24 小時內首次列入對帳，之後每 7 天提醒／人工覆核；第 30 天由授權營運者升級處置。逾 30 天未結案仍保留最小占用與 reconciliation reference，絕不自動退款或只因 TTL 刪除。 | 24 小時提供及時察看，7 天節奏降低重複人工作業，30 天升級而非自動釋放；新增人工負擔但不掩蓋未計費風險。驗證超額／晚到／未知 usage 都不改原窗口與餘額。 |
| 最小防重放 tombstone | 欄位僅 keyed owner scope、endpoint、HMAC idempotency index、fingerprint／key version、原窗口、終態／uncertain 金額關聯、deny-new-grant marker；不保存原文、raw key、影像、音檔或可公開查詢欄位。原子先寫 tombstone 再刪 detail；寫入錯誤／timeout 結果未知則保留 detail、無新 grant。 | 減少內容但保持「舊請求不得重新授權」；同一 script/hash-slot 寫入。重放兩種先後、跨 process、cleanup 重跑與 unknown EVAL 必須驗證。 |

**Current／verify-only／retired 語意校正（2026-10-07）**：capability signing `current` 可新簽，`verify-only` 可驗證輪替前已簽發且仍有效capability、不可新簽；未grant者通過全部gate後仍可首次執行。fingerprint `current` 可首次綁定，`verify-only` 僅依舊版本做既有comparison、不可將重送當新操作；既有grant永不二次grant。`retired` 是權威拒絕新grant的屏障狀態，**不是secret已實際清除的同義詞**；秘密清除另須全部引用安全解除。key families分開：OIDC state-cookie、request fingerprint、rate pseudonym、候選capability signing；opaque Session不是簽章key。安全隨機、server-side保管、不進repo／log不變；E04／E09長度／輪替數值僅待批。正常輪替先載新key再原子切current；缺current／必要verify-only key fail-closed。洩漏立即撤銷相關version／epoch，擋新grant但保留原入帳／uncertain占用／保守結算。

**跨輪替冪等與安全永久拒絕舊請求**：舊 key 保持 verify-only 時，重複請求必須用 reservation/tombstone 記載的 key version 比對，duplicate 不取得新 grant；找不到舊 key／記錄／一致 fingerprint 時一律 fail-closed（目前對外沿用 503，不猜 duplicate/conflict）。現行自由 `idempotencyKey` 沒有可信簽發時間或 epoch，無法證明某個舊請求已永遠不再被接受。因此建議另提 server-signed request-epoch/freshness capability：綁定 owner、endpoint、idempotency handle 與簽發／到期，API 每次驗簽與 expiry，退休 epoch 進不可清除的最小 deny set；只有舊 epoch 永久拒絕已可獨立證明後，才可清該 epoch 的 comparison tombstones／舊 verify key。24 小時僅可作為E02獨立取捨的候選capability age，不由已批准Session壽命推導，**這仍是新產品契約，未批准，不得套用**。在該契約未獲批前，最小 tombstone／必要 verify key 不得僅靠 TTL 刪除，且不得自動回收冪等索引。

### D14｜隔離外部驗證操作包（本輪不建立、不登入、不連線）

**先決條件與資源隔離**

1. **Redis**：另由 owner 在 Upstash 建立 1 個專用 test database／namespace，僅供 isolated Vercel Preview；不可共用 production DB、token、namespace 或資料。邀請限定 operator／reviewer；不呼叫 Upstash API、不執行 credential-provisioning shortcut。測試用短生命週期合成 subject／approval／state，不載入真實使用者資料。
2. Upstash 官方 pricing（2026-10-07 查核）：Free tier 256 MB、500,000 commands/month；Free 超限後的具體行為未由本次查到的官方 FAQ 明確說明，不假設會 rate-limit／服務不可用或即時重設。Pay-as-you-go 有需信用卡的情形，可設 monthly budget；官方頁目前標示 US$0.20／100K commands，超過 200 GB/月 bandwidth 為 US$0.03/GB，storage 首 1 GB 免費、其後 US$0.25/GB。Free tier 不能設定 PAYG budget。若需要信用卡、升級、預算值未獲批、free limit 不足、或測試可能影響 production，停止；不得自行升級。價格與限額執行前由 owner 再核對。本段 Free 超限結論以本文件最前方 2026-10-07 Free Redis 前置核對為準。
3. **OIDC**：另建 Google Cloud test project／OAuth consent configuration 與獨立 OAuth client（Web application），只加測試 user，不沿用 production client／branding／secret。只要求現行 `scope=openid`，不啟用 Google API、不申請額外 profile／email scope；建立前由 owner 確認當前 consent Testing／test-user 限制、redirect URI／branding 條件及是否產生任何費用。至少兩個專用測試身分加一個只供 M1 allowlist 驗證的 test admin subject；不得用真實使用者做 fixture。Google Console 有權 owner 執行 API／consent／credential 操作；本輪不登入帳戶或建立 client。
4. **Callback／origin**：採專用、HTTPS、無 production 環境變數的 Preview origin；Google authorized origin=`<ISOLATED_PREVIEW_ORIGIN>`，redirect URI=`<ISOLATED_PREVIEW_ORIGIN>/api/auth/callback`。兩者都必須與 `oidc-config.ts` 的 exact same-origin／path 檢查一致。不要假定本機 HTTP localhost 可用（現有 validator 要求 HTTPS）。真實 origin 待另行核准／建立 Preview 後填入，不能先填正式網域。Redis namespace 建議 `tokyomate:{preview-<random-id>}`，所有實際傳入同一 Lua/EVAL 的 key 必須攜帶同一 hash tag；本地列出的 key names 並不自動保證 Redis Cluster 同 slot，必須以實際組合與 slot calculation 驗證後才可連線。
5. **秘密名稱（值不寫入文件）**：現有程式常數 `OIDC_ISSUER`（非 secret，固定 Google issuer）、`OIDC_CLIENT_ID`（識別值）、`OIDC_CLIENT_SECRET`（secret）。Redis adapter 接受 `url`／`token`，repo 尚未定 environment binding 名稱；建議 Preview-only `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`，其中 token 為 secret。`stateSigningKey`、request `fingerprintKey`、`rateHmacKey` 目前是 factory injection，沒有已批准 env names；只能在獨立 environment contract 批准後命名。值只放隔離 Vercel Preview secret settings／owner password manager，禁止 `.env.example`、source、PR、logs、chat、artifact。Production env 完全不動。

**Redis 實證腳本／停止條件**

- 以兩個獨立 process／function instance、兩個獨立 Redis REST client，barrier 同時呼叫 quota reserve、duplicate、admin mutation、OAuth consume；核對恰一個 linearization result、usage／reservation 不雙扣／不雙 grant。檢查全部 `REDIS_*_KEYS` 實際生成 key 的 hash-tag／Redis Cluster slot 相同；至少要覆蓋 quota registry/users、sessions、oauth state+expiry index、admin 同 authority 所需 keys。不同 slot／CROSSSLOT／不同 authority 時 STOP，回到 Plan，不拆成非原子多次操作。
- TTL／期限逐類驗證：OAuth state `expiresAt`／單次 consume；Session 24h absolute + 過期後 24h retention；已批准 tile cache 7d。D07 reservation、audit、uncertain、申請 tombstone 仍未批准，禁止對這些資料套 TTL 清理。以 provider `PTTL`／keys、cleanup 兩順序、重跑與 Redis TIME 為證據。
- Timeout／錯誤：測 2s dependency timeout、1 MiB REST body limit、拒 redirect、timeout／斷線前後 EVAL 狀態未知時 503、不 retry、不 refund、不 grant；於獨立資料中重新讀取狀態確認原子結果，不可以 mock completion 冒充服務證據。清理採既有有界批次／硬筆數 cap，證明重跑不略過到期項目。
- 每一步留去識別化 command id、timestamp、所用 database plan／limits、process 數／slot 證據、結果摘要；不得記錄 token、完整輸入、cookie、state、nonce、code 或個人帳務。超過免費額度、出現帳單／信用卡需求、需跨至 production origin、首次真實付費上游呼叫、未知結果不能安全復核時立即 STOP。

**OIDC 隔離驗證**：先用 offline tests 驗 issuer discovery metadata schema、authorization URL、PKCE S256、state＋cookie 綁定／單次 consume、nonce、signature、`kid`／JWKS rotate／unknown kid／timeout、`iss`／`aud`／`azp`／`iat`／`exp` 及 code exchange replay。另行批准真實 Google test project 後，只以測試身分執行登入、callback、logout 後下一次 Session lookup 立即拒絕、同 state replay 拒絕；OIDC provider token revoke 不屬現行 contract（只要求 app-owned Session revoke），不得擴 scope 或保存 provider token。

**回滾／資源清除**：先停止 Preview 測試、撤銷 Google client secret／OAuth client、移除 Preview env bindings、停用並刪除 isolated Upstash DB、撤銷剩餘 token、確認 test user／mock records 清除；保留不含秘密的操作記錄及帳單／刪除確認。若測試導致功能或資料異常，先 fail closed 並停 Preview；不回滾、覆寫或改動 production。資源無法證明已清除時維持 incident／人工處置，不做成功形狀宣告。

**批准切分（彼此不可推導）**：① exact dependency/version install approval；② Google／Upstash isolated external resource/account operation approval；③ 任何 OpenAI、Google Places 或其他有成本的 real upstream call 之付費測試 approval；④ production environment／secret、六端點 `live`、部署與模式切換 approval。任一批准不自動批准其他項。

#### D14 下一批執行補充（本次補充；待批准）

沿用上方隔離資源、same-slot、timeout、OIDC及清理操作包與T153／T154，不重新選stack或另建決策包。上方歷史「D07仍未批准」現應讀作：E07～E09的本機TEST_ONLY參數／dry-run已批准並完成，但真實Redis資料清理、retirement／restore、正式key操作仍未批准。本機binding安裝已完成，不重批T149的本機工作；真實服務與Preview仍欠證據。

**先取得分項批准並填清單**：operator／owner、test project／DB識別、namespace、Preview URL／deployment ID、執行開始與到期時間、runtime／architecture、free plan與現有耗量證據、秘密名稱到factory injection的binding表、最大用量／預算、失敗聯絡人及清理責任人。未填者不是可直接執行的命令。

| 階段 | 執行方式與範圍（全部待對應批准） | 應交證據與停止條件 |
| --- | --- | --- |
| A 外部唯讀 | owner以Console檢視Upstash最新plan／command計費定義／TIME及EVAL支援／durability、Google consent Testing與test-user規則、Vercel專用Preview免費資格與Function runtime／native target。 | 日期、去識別化頁面摘錄、現有用量；歷史256MB／500,000 commands與價格不當現行保證。需信用卡／付費方案／不支援必需原子能力即停，不自行升級。 |
| B 隔離資源／帳戶異動 | owner手動建1個專用Upstash test DB；Google專用test project、Testing consent、Web OAuth client，只`openid`、兩test users＋一test admin。Redis採`tokyomate:{preview-<random-id>}`同slot，不複製production資料／token／project；Google不啟用Places或其他API。 | resource inventory、DB隔離／權限、test-user限制、精確callback；API啟用或Places key另依D01批准，不以OAuth資源批准推導。 |
| C 專用Preview部署／秘密 | **另批Preview部署**，僅一個專用HTTPS origin、固定deployment／callback；限制存取給operator／test users。建議專用隔離Vercel project，避免既有production env繼承；若必須沿用既有project，先證明無production env／secret繼承與branch-scoped bindings，無法證明即停。callback為`<ISOLATED_PREVIEW_ORIGIN>/api/auth/callback`。 | runtime／architecture、native artifact／notices（T149／T150部署子範圍）、env scope／secret掃描、deployment ID。default exports目前未配置，單放env不能讓factory接線；缺已批准的server-side composition／environment contract時停在資源盤點，不現場修code。 |
| D 真實Redis驗證 | 先不部署，以已批准的隔離runner＋兩個獨立process／REST clients測T153；要新增runner／composition code須另取得implementation批准。barrier同時執行reserve／duplicate／admin mutation／OAuth consume；再測epoch簽發／confirm、正常verify-only首次grant、reserve↔retire兩排序、cleanup↔reserve、late accounting。上游一律mock，不接Places／OpenAI／Geoapify。 | 每個EVAL實際key組與slot、Redis TIME、provider計數、單grant／窗口守恆；測2秒timeout／1MiB回應／unknown後唯讀確認，不重送paid操作。fixtures的幾個Lua命令不等於provider計費commands，要以provider定義及實測計數控量。 |
| E 期限／restore驗證 | OAuth5分鐘／單次consume、Session24h絕對期限＋expiresAt後24h清理、tile7d；長期限用獨立合成過期record＋Redis TIME驗拒絕／有界cleanup，不更改正式TTL、不宣稱已實際等待7d。隔離snapshot／restore需獨立manifest及可信floor、freeze後拒舊generation／舊keyring／舊版本；只在已批准合成資料操作。 | PTTL與record／expiry index證據、兩順序／重跑、不回收uncertain占用。provider沒有免費restore或真實演練未批准時保留T153 restore未驗，不以故障注入替代durability；不得清production comparison／key／legacy索引。 |
| F 真實Google流程 | C完成後以專用test users手動login→callback→Session lookup→logout→下一請求拒絕，同state replay拒絕；核對PKCE／nonce／issuer／audience與library signature/JWKS流程。scope只`openid`，不保存provider tokens，不呼叫付費API。 | 去秘密的流程／狀態／request count、Session revoke證據。live provider未必可控制JWKS輪替，unknown kid／rotate注入須標為隔離故障證據，不能假稱Google已輪替；測試到期／權限／origin不符即停。 |
| G 清理／結案 | 到期或任一STOP即停止runner／Preview流量，撤銷隔離OAuth client／secret與Redis tokens，移除Preview bindings／authorized redirect及測試存取，刪除隔離DB／test records與專用測試資源；關閉隔離Preview。 | owner取得resource deletion／revocation／bindings移除確認及最終用量／帳單，不輸出secret或真實subject。不刪production key／資料／網域；清理失敗維持pending／人工處置，不能標已回收。 |

**候選預算／停止界線（待批准，非production policy）**：D14 Redis＋OAuth批次新增費用上限US$0，不附信用卡、不升級／啟用付費plan；Vercel免費資格不成立即停。單一操作窗口最多2小時，合成資料最多1MiB、最多10,000 provider計費commands（含EVAL內部命令、讀取、cleanup，如何計数須先核對），以較小的provider剩餘free cap為硬停止量。候選最多10次人工OAuth登入attempt（含失敗），不自動重試。開始前預留已量測的清理command容量，容量未知不啟動；每一有限batch前後owner查用量，量測延遲或無法界定下一batch最壞量即停。雲端budget告警不是硬cap，US$0是執行前資格／停止政策，不宣稱帳戶已設定硬上限。結束或到期當日清理；刪除／撤銷失敗立即人工處置，不無限延長。Places測試不包含於US$0批次，另按D01核定USD金額。

**秘密／設定名稱清單（僅名稱，無值；命名提案不等於已接線）**

| 名稱 | 現況／用途／批准要求 |
| --- | --- |
| `OIDC_ISSUER`、`OIDC_CLIENT_ID`、`OIDC_CLIENT_SECRET` | 現有config名稱；前兩者為issuer／client識別，第三者為secret。只綁隔離client，secret值不進source／log／chat。 |
| `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN` | 沿既有D14建議名稱，尚非已接線env contract；可信server-side映射至adapter `url`／`token`，token為secret。 |
| `ADMIN_SUBJECT_ALLOWLIST` | 沿Plan M1名稱，隔離test admin stable subject屬敏感設定；真實subject與env設定另批，不用前端role、不要求第二管理者。 |
| `TEST_ONLY_OAUTH_STATE_HMAC_KEYRING` | 本次待批binding名稱提案，對應state-cookie signing injection；與其他family不共key。 |
| `TEST_ONLY_REQUEST_FINGERPRINT_KEYRING` | 本次待批binding名稱提案，對應fingerprint family及分domain owner／operation index；不是另加第五family。 |
| `TEST_ONLY_RATE_HMAC_KEYRING` | 本次待批binding名稱提案，對應`rateHmacKey`，與state／fingerprint／capability獨立。 |
| `TEST_ONLY_CAPABILITY_SIGNING_KEYRING` | 本次待批binding名稱提案，對應epoch `signingKeys`；32bytes／不可重用版本及current／verify-only／revoked語意依契約E04／E09。 |
| `GOOGLE_PLACES_API_KEY` | 既有handler名稱，但**不放入D14 Redis／OAuth批次**；只有D01付費測試／API啟用／key建立與隔離binding另獲批准後使用。 |

四family的keyring序列化schema、version映射、namespace／floor／origin及registry配置仍須environment contract／可信composition批准；不得把上述名稱貼進Console就宣稱可驗證。本次沒有生成key、設定env或命名生效；Session為opaque ID，不新增Session signing secret。六端點production `live:false`，隔離成功fixture亦不能啟用production。

**待取得證據總表**：Upstash服務及free cap／slot／TIME／EVAL／PTTL／unknown／跨process／restore、Google test project／callback／Session revoke、Vercel環境隔離／runtime／artifact／秘密掃描，以及最終資源撤銷／刪除／用量。現有memory／Lua替身、library JWT簽章及browser mock只作本機先備。資源、隔離secret、runner implementation、Preview部署、付費測試、production啟用須各自明確批准；本次只交付本操作清單並停止。

### 本輪批准後可立即進行的工作

| 決策 | 最早可執行工作 | 必須先有的明確批准 | 本地／外部驗證 |
| --- | --- | --- | --- |
| D13 OIDC | 加精確版 `openid-client`／lockfile，接現有 adapter；不加新 endpoint | 新 dependency + runtime evidence + `/speckit.implement` | targeted OIDC unit／type tests；隔離 Google 驗證另需 D14 resource approval |
| D13 image | 加精確版 `sharp`／正確 Linux binary 接 existing `images.verify` | 新 dependency + Vercel architecture evidence + `/speckit.implement` | image malformed/limit matrix、artifact size／cold-start preview |
| D01 | 無付費先做各路徑 byte／builder、schema、mock cap／±1 證據；按單端點審價表 | 每端點的成本數值／model／SKU policy approval；任何 live vendor test 另需 paid-test approval | builder／fixture 測試、供應商 SKU／usage／billing export 和實帳核對 |
| D07／D08 | 先批准 data lifecycle／epoch contract，再改 Spec、Plan、data-model／contract；最後才實作 atomic migration／cleanup | 新 retention／privacy／request-epoch 行為 approval + implementation gate | race／tombstone/key rotation／epoch retired／uncertain accounting regression；外部 Redis 證據另走 D14 |
| D14 Redis／OIDC | 僅在批准後建立隔離資源與 test users，綁 Preview-only secrets，按上列清單執行 | 外部資源／帳戶操作 approval；可能費用另付費測試 approval；正式部署仍另批 | 真實跨 process Redis／hash-slot／TTL／timeout；Google signature/JWKS／state／PKCE／logout；完成資源清理 |

**本輪實際狀態**：僅唯讀盤點與一個既有 request-builder targeted test（1 file／4 tests PASS）；沒有安裝／更新 dependency、修改 application code／正式數值、設定環境變數／秘密、建立資源、連接帳戶、付費呼叫、提交、推送或部署。

## 2026-10-07 D10／D11 最新明確批准（優先於下方歷史）

使用者批准本稿 D10／D11 的路徑、欄位、reasonCode、四種操作狀態、錯誤文案、大小、限流、分頁及 pending 去重／撤回。本機 L1～L5 授權持續有效；下方「僅方向／待審」為批准前歷史。

- D10：POST `/api/me/operation-status`，body ≤1024 bytes、完整回應 ≤4096 bytes；Session→當下有效資格→30/min→本人 lookup，同源／CSRF、no-store；零 reserve／grant／付費上游。
- D11：POST／GET `/api/me/requests` 與 POST `/api/me/requests/{reviewId}/withdraw`。POST body ≤2048 bytes；異動共用10/min，一般本人清單60/min。paid_access reasonCode 僅 `paid_feature_access`；weekly_top_up 僅 `weekly_limit_review`／`weekly_floor_review`，須帶 canonical 當週 key。
- 清單 offset 預設0、範圍0～999999；limit 預設25、範圍1～100。**完整序列化成功信封 ≤65536 bytes**；超限減少項目，nextOffset 為 offset＋實際回傳筆數，不跳項、不截斷 JSON。單筆即超限或無法提供有效續頁時503 fail-closed。
- 本人 DTO 僅 reviewId、kind、reasonCode、createdAt、status（pending／resolved／withdrawn）及 top-up 的 weekWindowKey。subject／idempotency／audit／管理金額不輸出。withdraw 本文為 `{}`；只撤回 pending，其他終態409，未知／他人同404。
- 原子去重按本人／kind／當週 pending；同 key 同內容200、不同內容409，新建201。resolved／withdrawn 後可新 key 再提。最小使用者 event 與申請／去重同次寫入，不冒充管理 audit。
- 未核准／撤銷／到期者仍可提出 paid_access；weekly_top_up 必須有效核准但不檢查額度門檻。管理審核與撤回共用同一 authority；跨週 pending top-up 不可套新週追加；paid_access 重新核准保留既有到期政策，不暗中延長資格。
- 所有提出、清單、撤回及狀態查詢皆明確手動觸發；不在登入時自動提出、不 polling／自動補送。settled 僅記帳，不承諾內容成功。

D01、D07／D08、D13／D14仍未決；不設定保存／輪替／epoch、不安裝 dependency、不連外啟用、不付費、不設定正式秘密、不提交／推送／部署／模式切換。

**日期：2026-10-07。狀態：部分批准；以本節批准界線為準，下方原提案保留歷史，不是整列批准或功能驗收。**

## 2026-10-07 決策批准同步（優先於原提案表）

沿用 L1～L5 本機授權、既有 Analyze 與 requirements 71／12 例外，不重做結案審查。批准參數僅供本機程式與隔離測試，不授權真實服務、production 價表或部署。

| 決策 | 本次明確批准 | 未批准／限制 |
| --- | --- | --- |
| D02 | 原表輸入／讀取限制，UTF-16 units、額外欄位拒絕、5秒 reader、depth8／nodes256 | 不構成 token／成本上界證明 |
| D03 | 60秒、16 kHz mono 16-bit PCM、data／WAV／multipart 大小 | 轉錄價格、付費取證、真實啟用 |
| D04 | 最長邊2048、3 MiB、版本上限、三格式、可信後端尺寸驗證方向 | 成本上界、新 decoder dependency、真實 vision |
| D05 | 原表逐端點 execution／派送／結算／lease、2秒 store、1 MiB REST response | speech 無可執行 lease；平台／真實延遲未驗 |
| D06 | 24小時絕對 Session、5分鐘單次 state、Session 過期後24小時清理 | 排程觸發方式、正式秘密／flow |
| D09 | UI freshness 30秒，不晚於後端日週 reset | registry 7天效期未批准，不能代替價格證據 |
| D10／D11 | 具體路徑／code／文案／reasonCode／分頁／回應限額／去重／撤回已明確批准，見最上方最新節 | 僅本機授權；完整清單65536 bytes縮頁續頁，不批准保存／輪替或正式外部啟用 |
| D12 | 80% 管理提示，僅提示 | 不改任何授權或額度 |
| D15 | 005 不暗中遷移模型，另案處理 | 不自行鎖定／更換 runtime |
| D16 | 原表圖磚 timeout／lease／wait／poll／bytes／座標，本機實作 | 正式素材權利、外部服務、CDN 驗收 |
| D17 | 原表限流初始值、共享固定60秒窗口、當前窗口加60秒緩衝 | 固定窗口交界可在短時間接受最多兩窗口配額，不是 sliding window；正式可信入口取證與 HMAC 生命週期仍待決 |
| D01／D07／D08 | 僅授權修訂方案與本機證據，不批准新值 | 24,100 不再作有效候選上界；90／180天保存、90天輪替均不套正式設定 |
| D13／D14 | 未批准 | 不安裝、新增 dependency、啟用服務、付費、設定正式秘密、提交／推送／部署 |

### D01 修訂方案：完整上游請求而非片段加總（待審）

實際 travel input 是 `travelInstruction(contextSummary) + "\n使用者問題：" + text + "\n語氣：" + tone`，知識已包含於 instruction。批准的 prompt 4096 B 必須定義為**不含知識的固定 prompt 部分**，知識獨立16384 B；若把兩者合成的 instruction 也限制4096 B，便與原候選公式混用。UTF-16輸入1000 units最多3000 UTF-8 B，既有包裝實測合計36 B（最長 tone=`default`）。所以僅文字 bytes 候選最壞合計為 **4096＋16384＋3000＋36＝23516 B**，舊提案另加100 tokens也只是23616的假設，與24100不一致。本輪不批准23516／23616為 token或成本上界；本輪首次測試查出人工包裝計算少3 B，已依完整builder實際量測修正，不沿用錯值。

photo-translate 必須量測 instruction＋三反引號資料包裝＋2000 units原文；OCR 必須包含627 B instruction、message/content框架、實際image detail／縮放／tiles／模型的計費規則；不能用3 MiB或2048 pixels推論tiles≤8。JSON transport bytes不是 provider billing tokens；Responses框架、tokenizer性質、service tier、image費率與output cap均須有版本化可信證據。emergency目前不呼叫模型，不能用其零呼叫證明travel成本。

方案：共用實際 request builder量測所有送出文字／包裝；分離固定prompt、knowledge與user bytes，於上游前核對可信核定的完整上界。沒有可信成本批准、任何輸入超過核定上界或未知模型均拒絕；不以價格係數補救缺失證據。本輪保持production六端點`live:false`與成功管線受阻；候選公式、最大合法樣本、上限±1與實際request捕捉測試送審後，才能更新registry／估算器，不自行換成本數字。

### D07／D08 修訂方案：有限明細與最小防重放生命週期（待審）

1. 分開詳細reservation／封閉usage／已處理申請／管理audit的有限保存期限，各期限未定；不是永久保存全部內容，亦不套90／180天。
2. reserved逾lease原子轉uncertain，原日週占用不變；人工對帳僅接受可信usage／帳務證據，晚到只附證據不退款。對帳結案後可將必要金額、原窗口、狀態與證據索引封存，移除不必要詳細metadata；未結案也須有有界檢視／封存流程，不以不退款推導永久保留所有明細。提醒與檢視期限另待批准。
3. 詳細記錄刪除前，原子寫入最小防重放tombstone：去識別化owner scope、endpoint、idempotency索引、fingerprint version／key version、終態或uncertain占用關聯、拒絕新grant的狀態；不留原內容。舊key無法比較時一律503，不猜duplicate／conflict，更不能把unknown視為新請求。
4. tombstone不得單靠TTL刪除：先批准可驗證的新請求epoch／有時效簽章token契約，可信後端永久拒絕已退役epoch，才可刪相應tombstone與比較材料。尚無此契約時保留最小拒絕索引，不清空現有idempotency。epoch是新產品行為，必須另審，不能偷偷改現有自由idempotencyKey。
5. capability signing verify-only只能驗舊有效capability、不能新簽，但未grant者仍可通過全部gate首次執行；fingerprint verify-only只比較既有操作、不建立新binding或二次grant。retired是authority拒絕新grant，secret實際清除另須全部引用安全解除。uncertain最小accounting與原占用保留；不能只依明細TTL或固定90天清除。
6. App Session 為 opaque ID＋逐請求 store lookup，沒有 Session 簽章 key；OAuth state-cookie HMAC、內容 fingerprint HMAC、rate HMAC 與候選 epoch signing 分開。Session 撤銷／登出由 store 生效，不靠簽章 key 輪替。各 family 生成、保管、輪替週期及正式操作另批。
7. 待審矩陣：詳細→tombstone與reserve兩順序、輪替→duplicate/conflict兩順序、未知／retired key零grant、對帳／晚到／封存兩順序、占用守恆、清理重跑、退役epoch不可重放。尚未採用保存／輪替正式設定。

OAuth state與上述明細保存不同：`expiresAt`到期立即失效；可注入清理以Redis TIME核對、到期才刪、單次有界。每批原子移除已處理的expiry index成員，下次重新取得最早到期批次即可續跑，不另使用cursor。實際清除時間取決於尚未批准的觸發方式，不能保證到期即物理刪除；不建立排程。

本包依本機最新 [Tasks](tasks.md)、[Plan](plan.md)、[本機實作證據](../../docs/verification/005-local-implementation-evidence.md) 與 contracts 整理；保留既有 L1～L5 本機授權與 requirements 71／12 例外。不重開七檔結案批次、不重新詢問已批准政策。每列可獨立批准；批准參數不等於批准外部操作。產品契約須先同步 Specification／contracts／UX，技術設定須同步 Plan，再於既有授權範圍實作及驗證。

## 1. 不列入待決的已批准基線

Google OIDC＋PKCE、opaque Session＋逐請求 server-side lookup、M1 管理者來源、共享 Redis 原子 authority、G-B、兩級日／週額度、管理者逐次決定追加且無固定次數／倍數上限、日上限獨立、`YYYY-Www`＋Asia/Taipei 週一重置、A＝1、speech S1 受阻、transcribe P1 固定 PCM 方向、A6 六列文案、503／409／uncertain 政策、圖磚代理與已批准 request／credit／7 天 cache 均保持原決定。下表沒有要求重新批准這些政策。

production 六端點仍 `live:false`；四個文字／影像／Places 的建議數字並非已證明成本上界。正式啟用必須另批准且先有證據。歷史 85 檔／1038 tests、9 檔／74 tests、build／11 mock E2E 不列為本輪新結果。

## 2. 集中決策表

以下保留**批准前原始提案表**供追溯；不是現行批准狀態，也不可逐列整包採用。以開頭本次批准界線為準，已批准子範圍可寫入本機application；未配置正式環境／production價表。秒數不能代替計費上界，保存期限不能代替重放防護。

| ID／待決項 | 建議方案／具體值 | 依據 | 取捨／影響 | 影響任務 | 批准後可完成的本機工作 | 所需驗證／另行批准 |
| --- | --- | --- | --- | --- | --- | --- |
| D01／A1 成本、模型與輸出 | 沿用 Plan 提案：初始白名單 `gpt-4o-mini`；assistant／photo-translate／photo-ocr 的最大輸入 token 上界 24,100／10,400／52,369，輸出 2,000／4,096／3,072；OpenAI 係數 2.0、Places 1.25；最大預留依序 9,630／8,036／19,398／50,000 µUSD；OCR `detail:high`。只核准這組候選控制，不自動啟用 | Plan §4.2.1～3、[價表 fixture](../../tests/fixtures/cost-price-fixtures.ts)；算術已有歷史本機證據，不是正式價表 | 較保守、可能截斷長輸出；係數不是供應商價格不變的保證。框架 token／byte≥token、影像 tile≤8 與服務層級仍須證明 | T023／T025／T049～T054／T126／T130／T140～T146 | 補各端點 descriptor／output cap／白名單、bounded input、單次執行及結算接線；擴充目前 Places-only 的成功管線；正式價表仍停用 | 最壞合法輸入、上限±1、完整 prompt／catalog bytes、正常樣本截斷、未知模型零上游；官方現價與 service tier、真實 usage 另驗。付費取證與 `live` 切換另批 |
| D02／A1、A5 輸入與讀取上界 | pre-parse bytes：assistant 16,384、photo-translate 16,384、photo-ocr 4,200,000、places 2,048、speech 4,096（仍受阻）、transcribe 2,000,000。prompt 4,096 B、知識背景 16,384 B；文字長度明定 UTF-16 units，assistant 1,000／photo-translate 2,000／speech 500／query 100／manualArea 50。新增 reader deadline 5,000 ms、JSON depth 8／nodes 256；額外欄位拒絕，不截斷輸入 | Plan §4.2.1；[管線](../../api/_lib/protected-endpoint-pipeline.ts) 已能注入 bytes／depth／nodes／deadline，但 handler 未接成功流程 | 字元單位須清楚；慢連線會提早拒絕；nodes 限制是 envelope 防濫用，不是管理追加累計上限 | T025／T050／T052～T054／T126／T129／T141 | 六端點完整有界解析與欄位驗證；multipart 用獨立有界 reader，不套 JSON parser | 無 Content-Length、偽造長度、chunked／slow stream、非法 UTF-8、跳脫字元、巢狀／節點±1、取消失敗；全部在 reserve／上游前拒絕 |
| D03／A3 錄音數值 | P1 方向不重問；批准 60 s 自動停止、16 kHz／mono／16-bit、data≤1,920,000 B、WAV≤1,920,044 B、multipart≤2,000,000 B。轉錄成本另建候選：US$0.006/min、按分鐘向上取整、係數 1.5、最大 9,000 µUSD；不得因已存在 fixture 就採用 | Plan §4.2.4、[PCM helper](../../api/_lib/audio-pcm.ts)、既有轉錄 fixture 算術 | 增加檔案大小、改變原 MediaRecorder 路徑；不支援時明示改文字，不改送壓縮格式；需獨立核准成本數字 | T051／T127／T128／T133／T136 | recorder PCM、60 s 停止／取消、後端重建 WAV 接線、mock 整合；T127 已有 helper 不重寫 | 60 s±1 frame、header 偽造／額外 chunk／截斷、multipart 開銷；Chrome／Safari／Firefox 真實麥克風與採樣驗證須另取得操作同意，付費 STT／啟用另批 |
| D04／A4 影像上界 | 最長邊≤2,048、解碼後≤3,145,728 B、`regionVersion` 正整數≤9,999,999,999；只接受既有 JPEG／PNG／WebP；base64＋允許 JSON 欄位≤4,194,373 B，再受4,200,000 B envelope 限制。實際影像尺寸必須由後端可信驗證，不信前端 canvas 宣告 | Plan §4.2.1／3；既有 executeUpstream 仍為10 MiB且無 dimensions 保證；bytes 不足以證明 tile≤8 | 對002照片流程有相容性影響，需維持原圖裁切語意／非敏感原輸入；不能靜默壓縮到不可讀。若可信格式驗證需要新 library，另提 dependency，不自行加入 | T053／T129／T130／T133 | 前端縮圖／大小檢查、後端版本／格式／尺寸驗證與 OCR descriptor，保留錯誤恢復 | 2,048±1、3 MiB±1、三格式／旋轉／細字、實際 dimensions／tile 上界、破損影像、base64與最壞包裝；真實vision usage與付費另批 |
| D05／逐端點 timeout、lease 與 store | assistant／photo-ocr／photo-translate execution30,000 ms＋派送餘裕5,000＋settlement buffer10,000＝lease45,000 ms；places8,000＋5,000＋5,000＝18,000 ms；transcribe候選45,000＋5,000＋10,000＝60,000 ms；speech不配置可執行lease、不派送。store／dependency deadline2,000 ms；Redis REST回應≤1,048,576 B。lease自原子reserve時間起算，grant後剩餘時間必須嚴格大於execution＋settlement buffer | FR-052、[engine](../../api/_lib/quota-engine.ts)、[管線](../../api/_lib/protected-endpoint-pipeline.ts)；engine仍有通用120秒fallback，不能聲稱完成T136 | 派送餘裕納入總結算緩衝，可保留現有嚴格比較，不需放寬安全檢查；grant回傳耗盡餘裕仍拒絕。超大store回應fail-closed而非截斷／限制追加金額 | T019／T025／T135／T136／T138 | 移除通用lease正式fallback、明列端點政策、驗證grant時效、超時／晚到／清理整合；不得先套候選秒數 | 執行＋結算＋派送／store延遲總預算、lease−1／等值／+1、grant耗盡餘裕、command／grant倒退、晚到保留原窗口；平台maxDuration／region延遲正式證據另驗 |
| D06／Session與OAuth保存 | App Session絕對有效期24 h，無滑動續期；OAuth暫存5 min、單次使用；Session紀錄過期後保存24 h再清理（撤銷不延長原expiresAt）。OAuth state cookie max-age300 s、Session86400 s | 現有 Session／OIDC config 皆接受明列期限、Redis Session有retention參數；opaque lookup／立即撤銷不變 | 每日需重登，較少長期identity metadata；OAuth慢操作需重新開始；不保存provider token／照片／對話 | T009～T018／T019／T138 | 注入期限、無滑動續期、清理scan／重跑驗證；需補OAuth state replay實測，不因cookie簽章就當單次已證明 | 期限±1、已撤銷下一筆401、Session TTL／HSCAN、並發callback同一state僅一次；不能只用mock作真實TTL證據 |
| D07／reservation、audit、申請保存與清理 | 已結算／釋放reservation詳細摘要、封閉日週usage與resolved／withdrawn申請保存90天；管理audit保存180天。每5 min掃描lease／Session／cache，單次SCAN COUNT建議100（是提示非硬筆數上限）。uncertain每24 h列入人工檢視，30天升級提醒，**不自動刪除／退款**。idempotency tombstone暫不GC：先批准並證明拒絕舊key的機制，才可另核定終止期限 | FR-053～55、data-model §14～16；現有key無可信最大重放年齡，刪掉index會使舊key重新grant；部分資料置於同user hash，不能對整個hash設90天TTL | 精簡明細可降低資料量，但防重放最小metadata與uncertain暫須保留較久。本列不宣稱所有資料都有90天TTL；營運者須明確接受這項保存取捨，若要求全部有限期，需先另定key生命週期契約 | T019／T022／T024／T138／T139／T142／T147／T092 | 明細壓縮與最小tombstone、分類cleanup／cursor續跑／內部對帳；批准保存不等於建立排程服務 | 重複cleanup、HASH中live／uncertain／tombstone保留、跨日週、舊key不重grant、斷線重跑。實際排程啟用、provider對帳與人工處置權限另批 |
| D08／金鑰輪替（已校正） | App Session 是 opaque ID，沒有 Session 簽章 key；OAuth state-cookie、request fingerprint、rate HMAC 與候選 epoch signing 分開。輪替／verify-only／retirement 與清除前提依 [完整草案](contracts/request-epoch-and-key-lifecycle.md)，新期限／長度／週期均待批准 | [HMAC helper](../../api/_lib/quota-fingerprint.ts)已有version；Session逐請求store lookup，登出／撤銷不靠簽章輪替 | 舊候選90天／Session舊key假設不生效；材料必要性及最小保存仍須批准 | T014／T017／T019／T024／T139／T142／T152 | 本輪僅補契約，不實作keyring／epoch，不設定正式secret或清key | 跨輪替duplicate／conflict、退役拒絕、authority／清除／晚到兩順序；外部證據及正式操作另批 |
| D09／價表與UX freshness | registry核准有效期候選7天，至少每日人工核對價格與封鎖；過期503，不能自動延長。UI quota／map eligibility maxAge30,000 ms，以取得回應時起算，且不超過後端日週reset；focus／online／pageshow／bfcache重新查，offline／hidden／晚到回應使舊狀態失效；無背景自動補送付費操作 | [quota hook](../../src/hooks/usePaidAccessQuota.ts)已有明列freshness可注入；[通用access hook](../../src/hooks/useAccessQuery.ts)尚無同等maxAge／pageshow處理；快照不是授權 | 30秒後呈現未知並要求確認，增加免費狀態查詢；前端時鐘只能使顯示失效，不能宣告reset／資格恢復。7天不是上游不改價保證 | T020／T027／T037／T045／T073／T074／T099～T105／T140 | 統一quota／map／一般access查詢freshness與晚到／恢復處理；發布有界期的本機fixture | 29,999／30,000 ms、reset較早、clock倒退、offline／bfcache／跨分頁、舊回應不覆蓋新值；server每筆仍查authority |
| D10／T142查詢契約 | 推薦唯讀語意的`POST /api/me/operation-status`，JSON `{endpoint,idempotencyKey}`，避免key進URL／access log；只限本人。目前Session→有效資格→讀取限流→owner lookup，無reserve／grant／上游。200僅回`{success:true,data:{state,updatedAt,userMessage}}`，state明列`reserved/settled/released/uncertain`，settled只代表記帳不是內容成功。未知／非本人一律404 `OPERATION_NOT_FOUND`；失效Session401、失效資格403、依賴故障503；no-store | FR-050／056、[錯誤契約](contracts/error-and-quota-contract.md)；現有409只批准文字，沒有查詢endpoint | 使用POST是隱私選擇，不是重送原付費POST；需same-origin／CSRF與1,024 B、每人30/min讀取限流候選。無結果內容復原、無自動polling，不揭露reservationId／價格／摘要／內部原因 | T141→T142／T027／T099～T105 | 先同步Spec／錯誤契約／UX新code與文案，再做owner查詢、手動「查看狀態」UI及四狀態投影；不改409原文 | 未登入／撤銷／猜測他人key／不存在同信封、403在任何reservation資訊之前；手動一次query零reserve零上游、時限／存量明細過期行為與CSRF |
| D11／T147申請契約 | 明確使用者操作才提出。候選`POST /api/me/requests`；`{kind:"paid_access"|"weekly_top_up",idempotencyKey,reasonCode}`，top-up另含當週`weekWindowKey`；`GET /api/me/requests`只列本人，`POST /api/me/requests/{reviewId}/withdraw`撤回pending。沒有email／自由文字／圖片／位置／requestedTier／requestedAmount；subject、createdAt、status由server寫。登入未核准／撤銷／到期可申請paid_access；top-up須當下有效核准，但週額度耗盡可申請 | FR-036、[管理契約](contracts/admin-dashboard-contract.md)、既有AdminReview只有pending／resolved且無producer | 每人／類型／當週最多一筆pending只防重複排隊，**不限制管理追加次數／累計**；resolved後可再提，撤回不撤銷已核准權利。每人10/min、body2,048 B候選；不在首次登入代提 | T079／T080／T083→T147；T099～T105 | 先同步Spec／data-model／contracts／UX，擴充withdrawn與reasonCode；同次EVAL enqueue／去重／最少user actor event，UI提出／本人清單／撤回；不把user操作冒充admin audit | CSRF、資格矩陣、當週key、非法欄位、同key異內容409、同內容duplicate；withdraw／admin resolve兩順序、一筆pending競態。新建201／duplicate200、不存在或非本人404、已resolved撤回409候選文案須同步批准 |
| D12／T076管理提示門檻 | 推薦`nearLimitPercent=80`，使用`used+reserved`對當下有效limit，day／week各自比較，週limit含active追加；BigInt整數`(used+reserved)*100 >= limit*80`，不得以UI四捨五入判斷。不新增較高警戒tier、不改授權 | 既有overview Lua／DTO可注入門檻；UX80只是例子，仍未正式批准 | 含reserved較早提示，但uncertain可能使提醒常駐；只是管理提示，不能被解讀為供應商帳單或全站停止 | T076／T084／T092 | 明列配置與正式文案同步、overview完整驗收；未配置仍只拒絕overview，不牽連其他管理操作 | 80%−1µ／等值／+1µ、day／week、reserved／uncertain、追加／撤回、MAX_SAFE_INTEGER、缺失／非法與非管理者無外洩 |
| D13／OIDC真實library binding | 推薦`openid-client` 6.x實作既有`OidcClientLibrary` port，不另加第二套JWT library；精確patch／lock須先查官方release與runtime相容後單独批准。Google issuer／JWKS保持既定；候選RS256-only、ID token≤16,384 B、code≤4,096 B、maxTokenAge300 s、clock skew0、整體exchange＋verify deadline10,000 ms；JWKS refresh必須有界、禁止自動重送code exchange | [通用provider adapter](../../api/_lib/oidc-provider.ts)、OIDC config；目前全為library替身，沒有真實JWT／JWKS驗證實作 | 成熟library避免自製crypto；Google正常JWT、kid輪替／網路故障可能拒登，Public仍可用。現有adapter的signatureVerified只在port有可信library時才成立 | T010～T018／T029／T133 | **dependency明確批准且manifest更新後**才安裝、實作exchange／nonce／PKCE／alg／claims binding與簽章fixture測試；不建OAuth app或正式secret | 真正簽章／壞簽章／alg-none／錯issuer／aud／azp／nonce／exp／iat／未知kid／JWKS timeout，code exchange≤1次；真實Google callback與登出另批 |
| D14／隔離Redis與OIDC外部驗證 | 先做已有本機mock；第二階段另批准一次性Upstash Free隔離resource＋獨立Google OAuth測試app／測試帳號，絕不使用正式resource／subject／secret。優先同Vercel region的可用region、無自動升級，付費預算0；資源／callback精確值在啟用前由擁有者確認。沿用REST transport，不需`@upstash/redis`；兩個獨立Node process共享測試namespace執行真實EVAL／TIME／cjson／TTL證據 | T019與T133／T134正式欠項、Plan §10.3.3；本機有Lua5.4替身，但沒有redis-server／cli | Free是否支援所需script／TIME／大小／網路限制需查核，不保證免費方案足夠；不夠就停止、另批費用。OIDC與Redis分開取證，不混入付費OpenAI／Places／Geoapify | T019／T010～T018／T033～T035／T133／T134／T138／T143～T146 | 本機可先寫經批准契約的隔離驗證runner／redaction／結果格式；resource啟用後才能執行遠端matrix。當前只交付方案，沒有連線 | 跨process競爭兩順序、原子失敗不部分更新、TIME台北日週、TTL／HSCAN／大整數與空陣列、Session撤銷／登出、真正Google簽章／JWKS／state replay；去識別化log／HAR與資源清理須明列授權 |
| D15／模型遷移邊界與runtime | 推薦A7：005不更換現有模型；模型停用遷移另案，先重查官方停用資訊，不把歷史日期當本輪查核。binding沿用專案runtime；本機Node v24.19.0已可用，但沒有正式runtime鎖定證據，若library要求改Vercel runtime，另批准，不在本輪調整 | Plan §10.2／A7、Constitution stack stability；本輪僅查本機工具版本 | 不把遷移混入005，亦不靠將來可用性猜測啟用。真實模型停止支援可能使端點持續受阻 | T009／T051／T132／T133／T121 | 記錄精確library／runtime相容矩陣與另案範圍；仍不換模型或部署 | 官方deprecation／帳戶可用性與Vercel runtime／bundle驗證；新runtime／模型變更另走批准 |
| D16／圖磚剩餘資源參數與正式素材 | 候選tile upstream8,000 ms＋派送餘裕2,000＋settlement buffer5,000＝flight lease15,000 ms、wait deadline8,000 ms、poll interval100 ms、PNG回應≤1,048,576 B；z保留本機0～20與全球`0≤x,y<2^z`，第一版不加關東裁切。正式示意圖優先repository-owned原創不含真實路網、4:3／16:9兩裁切、文字alt與「示意圖」標示；具體原檔與權利聲明仍須交付／批准 | Plan §10.2／§7、[tile adapter](../../api/_lib/redis-tile-store.ts)／map contract；已批准7天cache與credit不重問 | wait超時／flight uncertain不退款不接管；100ms polling的Redis命令數須列入隔離資源容量。全球合法座標不等於自動定位。原創示意不得被當成精確導航圖，不沿用第三方圖磚截圖 | T032～T035／T106～T118／T119～T120／T134 | 明列bytes／flight／wait與座標政策、cache測試；取得原檔後替換placeholder及資產核驗 | 大PNG／壞格式／coalescing／cache hit／304仍先驗Session與G；跨process與CDN另驗。素材D1～D5／授權、Geoapify實際方案／key／付費升級仍另批 |
| D17／admission與身分限流數值 | 候選匿名admission每可信入口key60/min（六付費入口合計）；active subject六端點合計20/min；OAuth login每可信入口key10/min；callback每state只一次且入口60/min；管理讀取每admin60/min／異動10/min；一般me查詢每subject60/min，D10查詢30/min、D11異動10/min獨立桶。共享原子固定60秒窗口、提供可信Retry-After；key以server HMAC去識別化，counter只保留當前窗口加60秒緩衝 | Plan §3.2入口先admission／資格後user rate已批准，但正式數字與adapter未批准；不能由前端IP header授權 | 共享IP可能讓同行者共同限流，需測突發；只限制請求頻率，不改日週額度或追加次數。HMAC key與privacy生命週期須與D08同步 | T020／T025／T009～T018／T082／T142／T147／T121 | 參數批准後補共用原子limiter／trusted ingress port與入口整合，無須真實服務才能測程式 | 60／61、20／21、窗口切換、不同端點共同桶、未知來源／store timeout503、Session／資格／duplicate優先序；Vercel覆寫header與Trusted Proxy正式證據另驗 |

### 決策收斂的必要細節

- **D05**：lease總緩衝拆成「派送餘裕＋settlement buffer」，保留pipeline嚴格`>`驗證；例如45秒lease中，30秒execution＋10秒settlement留下5秒派送餘裕。grant往返達5秒時仍必須拒絕，不能為套用建議值放寬比較。平台或真實延遲無法滿足時維持停用，不自行加秒數。
- **D07／D08**：保存與輪替不能各自實作後才發現舊冪等鍵失去比較能力。先定最小tombstone與舊key生命週期；在拒絕舊key的可信機制未批准／證明前，不刪idempotency索引，不將unknown當新操作。uncertain不因90天或換key而釋額。這是未建的本機治理／程式工作，不只是外部取證。
- **D10**：`success:true`僅表示查詢成功；例如settled文案候選「此操作已有記帳紀錄；這不代表結果內容已成功取得。」reserved「此操作已預留額度，目前尚未確認完成。」released「此操作的預留已釋放；這不代表已有結果內容。」uncertain「目前無法確認此操作結果，預留仍保留；請勿自動重送。」404候選「找不到可供此帳號查詢的操作紀錄。」所有新增title／actionableStep須與正式錯誤契約一起批准。
- **D11**：reasonCode候選paid_access=`paid_feature_access`，top-up=`weekly_limit_review`／`weekly_floor_review`。明列enum而非自由文字，不要求申請人輸入金額；實際tier／追加仍由管理者逐次決定。本人GET分頁沿用管理端0／25、limit1～100的形狀，但須獨立授權filter；不將未核准者擋在付費額度gate，否則無法提出paid_access。
- **D13／D14**：真實簽章fixture測試可以在library批准後、不連Google的情況下完成；Google OAuth整合則必須另外批准外部操作。Redis可透過已存在REST port，沒有為取證而安裝新Redis SDK的必要。

## 3. 剩餘任務表：程式未建、參數待決與外部證據分開

以下是批准前歷史盤點，保留追溯；本次完成／部分／受阻狀態以[Tasks最新表](tasks.md)與[最新證據](../../docs/verification/005-local-implementation-evidence.md)為準，不能沿用本表已被本次實作取代的「尚未完成」描述。

本表以「整項」追蹤，不因本機子範圍通過就勾完正式任務；完整ID原文以[Tasks](tasks.md)為準。

| 分類／任務 | 已有成果 | 真正剩餘工作 | 前置／可執行界線 | 完成證據 |
| --- | --- | --- | --- | --- |
| 本輪獨立本機文件 T001～T008 | 本輪新增隔離環境／identity矩陣，research現況附錄，Plan決策狀態同步 | 這八項盤點／規劃文件任務已完成；不等於對應runtime或正式服務完成 | 文件不採未批准數值／外部前置；另有下列OAuth state本機程式子範圍 | 文件欄位、引用、唯一Task ID與Safety核對；3檔74tests僅相應現況回歸 |
| 六handler T025／T036／T043／T049～T054／T056／T135／T136／T140／T141 | 真實POST拒絕boundary、單次SDK／helper與Places-only fixture成功管線 | **尚未完成**六端點成功descriptor、完整bounded input、輸出／影像／PCM限制、逐端點lease與HTTP結算／恢復 | D01～D05；speech依既定S1不開成功路徑。參數批准後可本機mock，不必等真實服務 | 六HTTP exports成功／拒絕、call order/count、上游≤1、original windows、超額雙封鎖、409零重放；正式上界另驗 |
| recorder／image／樣本 T128～T130 | PCM後端helper、現有裁切與照片內容保留 | **尚未實作**前端PCM60秒停止、縮圖／尺寸驗證、正常樣本輸出與截斷行為矩陣 | D01～D04；不是外部服務導致不能寫程式 | mock＋真實瀏覽器錄音／細字影像分開；不新添decoder dependency |
| shared authority T019／T138／T143～T146 | Lua／REST／SharedStore／Session／原子G／跨writer替身；本輪另補可注入OAuth state原子create／consume adapter | 明細保存／tombstone／輪替／scan／對帳runner、未使用state的到期清理與正式跨process／TIME／cjson／TTL證據 | 本機剩餘程式受D05～D08；外部取證受D14，兩者不混為一個blocker | 本機重放／並發／清理矩陣；遠端使用獨立process與原始redacted結果 |
| OIDC T010～T018 | flow／通用library adapter／claims mock、opaque Session逐次lookup；新增共享state單次consume Lua與adapter | **尚未實作**具體library exchange／JWT／JWKS binding、正式flow組裝／state清理及keyring；真實Google callback未驗 | state子範圍沒有新增期限預設；D06／D08／D13後可先本機library fixture；D14才可外部OAuth | 真簽章負面矩陣、PKCE／nonce／state、callback不自動代提申請、不自動補送付費POST |
| admission／user rate T020 | RateLimiter ports與mock優先序 | **尚未實作**正式共享limiter與trusted Vercel ingress接線 | D17數值／D08去識別化key後可先本機；平台來源取證另驗 | 跨writer／固定窗口／多端點共桶、可信Retry-After、錯誤先後與fail-closed |
| quota／map freshness T027／T037／T045／T073／T074／T099～T105 | quota hook可注入maxAge、stale／offline／晚到測試 | **尚未完整接線**一致30秒政策、一般map access hook的maxAge／pageshow／bfcache；六端點完整恢复UX | D09，相關endpoint決策D01～D05；可獨立mock | 快照過期／恢復／unknown不掛圖、重新查後手動送出；每筆server authority不變 |
| T142查詢 | 指定409提示、不得自動重送已實作 | **尚未實作**query contract／owner查詢／DTO／手動UI | D10先同步正式規格；T141依賴保留 | 403優先、無他人紀錄、無結果成功承諾、零reserve／零上游 |
| T147申請 | 管理端可讀／處理既存review queue | **尚未實作**申請producer／enqueue／撤回／本人清單／UI／原子user event | D11先核定契約；既有T079／T080／T083可沿用 | 去重／衝突／競態、權限／CSRF、週鍵與資料白名單，不以首次登入補洞 |
| T076提示、管理剩餘證據 T092 | 管理原子異動／audit／UI與nearLimits計算；其他管理程式任務已勾 | 正式提示值配置與文案；最終管理證據整理；真實subject／Redis證據 | D12可先本機；真實allowlist／secret／資源另外批准 | 提示閾值精確邊界、管理者自身quota、無外洩、review producer整合另驗 |
| tile／PWA／素材 T032～T035／T106～T120／T134 | 同源proxy／共享tile／cache／flight與SW排除；暫用示意與mock E2E | 明列remaining資源參數、真實cache／CDN／HAR、正式素材原檔／D1～D5；未完成整項不能勾 | D16可本機控制；D14或素材交付才正式取證。沒有新PWA架構 | 首次／refresh／舊分頁／304都重驗；API不進cache；正式授權／素材與零外部請求證據 |
| 可繼續的本機證據文件 T048／T075／T092、回歸整理 T124／T125 | 集中本機evidence已存在 | 尚可拆出指定user-story／quota／admin證據索引，及最終doc／trace整理；不需外部啟用，不先寫PASS | 既有本機授權可續；本輪以集中包交付停止，沒有假稱全部本機工作完成 | 精確引用本輪與歷史命令、子範圍／正式欠項分開；全套回歸留待相關程式變更完成 |
| 正式證據／營運 T107～T109／T119～T123／T133／T134 | 方案與部分本機觀察 | provider usage／帳戶預算／CDN／部署／真實瀏覽器／素材權利等正式證據 | 外部／秘密／付費／提交／推送／部署／模式切換均仍未授權 | 逐項批准後執行；mock／文件檢查不可替代production acceptance |

## 4. 真實隔離驗證方案的操作邊界

1. **目前可做**：本機TEST_ONLY fixture／Lua替身／mock HTTP，外部網路禁止；不設定正式env。既有Vitest、Playwright已足夠，Playwright只支援`*.e2e.ts`，不為tasks歷史提案`.spec.ts`另建config。
2. **dependency單獨gate**：確認`openid-client`精確版本與runtime後取得批准，更新manifest再安裝；寫真實簽章fixture。不得用`decode`或自製JWT驗證掩飾未binding。
3. **外部資源單獨gate**：批准一次性resource、region、測試app、HTTPS callback exact origin、測試帳號、secret存放方式與可允許endpoint host。不存在TLS callback時先停止，不自動新增tunnel服務或部署Preview。
4. **共享authority驗證**：兩獨立process各建REST transport，使用同一隔離namespace；barrier測reserve／update兩順序；真實Redis TIME／Lua cjson／TTL／key slot／HSCAN／timeout結果未知／cleanup重跑。對record分別驗保存，不對含current users／tombstone的整個hash設過期。記錄server時間、writer ID、狀態／amount evidence與upstream mock count，不記identity raw subject或secret。
5. **OIDC驗證**：真實code exchange／JWKS／claims；同state replay／失效／logout／revoke下一請求、M1 allowlist缺失；callback只建未核准identity。匿名admission必須使用可信平台來源，不能把客戶端header作正式IP；本機不能證明Vercel ingress，留在T121。
6. **費用與清理**：只接Redis／OIDC核准host；OpenAI／Places／Geoapify仍mock、禁止付費呼叫。紀錄resource ID與redacted取證位置；清理僅針對本次namespace／resource，亦需事先明列授權，不執行全庫FLUSH或廣域刪除。Free不符需求即停止，不自動升級。

## 5. 本輪證據與停止狀態

本節是批准前批次的歷史證據與停止狀態；本次已完成可執行本機子範圍並重跑全套／型別／build／隔離E2E，詳見[最新證據](../../docs/verification/005-local-implementation-evidence.md)，仍不構成正式READY。

- 已執行Safety：master／HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`、baseline peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`、staged0；起始37 tracked修改／125 nonignored untracked／464檔manifest全部保留。PDF SHA-256 `0A3D951ECED180AF04B665CADF0D92B09A71861B563E1A84CF6A1EFE5A552FFB`；`.vscode/`不存在且不建立。
- requirements維持83／71／12，既有例外沿用；沒有變更requirements markers、001～004、baseline tag或既有成果。
- 本輪新驗證：原生unit-test工具未辨識檔案，改用既有CLI，`vitest.cmd run src\service-worker.test.ts tests\api\paid-handlers-rejection.test.ts tests\api\oidc-provider.test.ts --maxWorkers=1 --pool=forks`＝**3 files／74 tests PASS**，09:01:34開始／3.22 s，僅盤點相應回歸。與上一輪9檔／74不同，不混用。
- 本輪另依既有授權補OAuth state adapter與測試，無新增期限預設、正式設定或provider binding；相關新增回歸與型別結果見[本機證據](../../docs/verification/005-local-implementation-evidence.md)。沒有重跑全套／build／E2E，也沒有宣稱正式驗證完成。
- 本包交付後停止，不在本輪逐項要求批准、不採用候選值、不安裝、不啟用服務、不寫正式secret、不付費、不提交／推送／部署／切模式。功能005與正式Readiness仍非READY。
