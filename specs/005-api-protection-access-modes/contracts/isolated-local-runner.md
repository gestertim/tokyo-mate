# D14｜隔離本機環境、composition 與有界 runner 契約

## 2026-10-08 單次 Phase B 三鍵本機準備（現行；外部尚未啟動）

本節取代本檔較早 2026-10-08 Phase B 七鍵／floor 前置與 89-command 包絡，僅限本次使用者批准的單次本機準備。它不是外部執行授權。usage freshness 差異只適用此單次試驗：使用來源可核對、附觀測時間與時區、但可能過期的人工觀測，提案門檻為 commands ≤400,000、bandwidth ≤9GB、storage ≤230MB。數值不是即時剩餘額度保證；不改 production／business runner freshness gate。provider 的 EVAL 計量／Read Region／Free 規則已由營運者回覆；真實 runner／Redis execution 仍未驗證，`providerMetering: "unverified"` 與 `billableUpperBound: null` 保持原義。

### 三鍵 scope 與業務 reserve 不變式

- 使用 `createRedisSharedStore({ namespace, transport, timeoutMs, audit })` 的既有無 `epochFloor` 分支；keys 必須恰為 `REDIS_QUOTA_KEYS(namespace)`：`<namespace>:registry`、`<namespace>:users`、`<namespace>:sessions`，同一 Redis hash slot。inventory 僅此三鍵，先作一次 exact preflight。
- reserve fixture 不帶 `requestEpoch`；不傳 synthetic floor／digest，`rejectLegacy` 不啟用。既有 `REDIS_QUOTA_LUA` 只在 `requestEpoch` 存在時讀寫 `KEYS[4..7]`；此分支在三鍵上執行，不觸及其餘鍵。若執行條件不滿足此分支，停止，不以假 floor、legacy bypass 或改寫 Lua 達成。
- 沿用同一原子 reserve 內既有 eligibility、registry／cost binding、G、day／week usage、idempotency 與首次 grant 檢查；兩 writer 同一 synthetic operation 預期一筆 grant 與一筆 duplicate。此測試不驗證、不宣稱 request epoch／restore 完成。
- 固定一批、最多兩個 child；先後只允許一次 registry publish、一次 eligibility seed、兩次相同 reserve、一次 usage read；成功且 usage 符合才進一次 exact cleanup。unknown 的異動不重送、不退款、不重新授權；reserve unknown 最多一次 readonly getReservation，observed 仍不能證明晚到寫入已收斂，故停止且不 cleanup。cleanup unknown 最多一次 exact EXISTS；不重送 DEL。禁止 SCAN、wildcard、KEYS、FLUSH 及額外查詢。

### 逐分支計量及大小包絡

以下 provider commands 使用營運者回覆的公式：每個外層 EVAL 計 1，加 Lua 實際執行的每個 `redis.call`／`redis.pcall`；無 Read Region 時等於 logical commands，一個 Read Region 時每個 write call 再加 1。內部 HA 不倍增。所有上界只適用此固定程式、單批、無其他 writer／隱含派送；本次外部前置要求無 Read Regions。

3-key business Lua 的 common preamble 是 `TIME`＋3 次 `TYPE`。Preflight／cleanup／confirm 是另一支 Lua，各自對三個 inventory keys 執行 `EXISTS`／`DEL`。`publish` 為 EVAL＋TIME／3 TYPE／2 HGET／1 HSET＝8 logical commands、1 write；eligibility 為 EVAL＋TIME／3 TYPE／HGET user／HSET user＝7、1 write；`readQuota` 的 unknown confirmation 最多為 EVAL＋TIME／3 TYPE／HGET user＝6，並在 registry projection 前 return；registry snapshot 為 EVAL＋TIME／3 TYPE／4 HGET＝9。Reserve 成功分支為 EVAL＋TIME／3 TYPE／HGET user／5 registry HGET／digests HGET／HSET user＝13、1 write；同一 operation 的另一 writer 走 duplicate，為 12、0 write，故 race 合計 25 commands／1 write。`readUsage` 與 `getReservation` 各為 6、0 write。

| 分支（互斥） | HTTPS POST max | Logical commands max | Write calls max | Provider：無 Read Region | Provider：1 Read Region | Request body max | Response body max | 後續 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Gate／中斷／秘密失敗 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 不讀秘密、不 spawn、不連網。 |
| Preflight 非空／unknown／timeout | 1 | 4 | 0 | 4 | 4 | 131,072 B | 32,768 B | 停止，不 seed／cleanup。 |
| Registry seed unknown／timeout | 3 | 21 | 1 | 21 | 22 | 393,216 B | 98,304 B | 一次 registrySnapshot readonly confirm；仍停止，不 race／cleanup。 |
| Eligibility seed unknown／timeout | 4 | 25 | 2 | 25 | 27 | 524,288 B | 131,072 B | 一次 readQuota readonly confirm；仍停止，不 race／cleanup。 |
| Seed 後 worker／barrier／deadline／request cap stop | 3 | 19 | 2 | 19 | 21 | 393,216 B | 98,304 B | 不派送 reserve；保留 inventory。 |
| Reserve unknown／timeout／worker crash | 6 | 50 | 3 | 50 | 53 | 786,432 B | 196,608 B | 兩 reserve 後最多一次 getReservation；停止、不 cleanup。 |
| 明確 terminal 矛盾／第二階段 abort | 5 | 44 | 3 | 44 | 47 | 655,360 B | 163,840 B | 不追加讀取／異動／cleanup。 |
| Usage unknown／矛盾，或 cleanup 前中斷／時間不足 | 6 | 50 | 3 | 50 | 53 | 786,432 B | 196,608 B | 不 cleanup，保留 inventory。 |
| 成功；含 cleanup unknown 後 exact confirm | 8 | 58 | 6 | 58 | 64 | 1,048,576 B | 262,144 B | 三鍵 exact DEL 一次；三鍵 EXISTS 一次；全不存在才記 cleaned。 |
| Cleanup／readonly confirm 未收斂 | 8 | 58 | 6 | 58 | 64 | 1,048,576 B | 262,144 B | 不重送 DEL；停止並保留 exact inventory。 |

逐筆計數：preflight＝EVAL＋3 EXISTS＝4；成功前 seed＝preflight 4＋publish 8＋eligibility 7＝19；registry unknown＝4＋8＋snapshot 9＝21；eligibility unknown＝4＋8＋7＋readQuota 6＝25；reserve unknown＝seed 19＋grant／duplicate 13＋12＋getReservation 6＝50；usage unknown＝19＋13＋12＋readUsage 6＝50；成功＝19＋13＋12＋readUsage 6＋cleanup (EVAL＋3 DEL) 4＋confirm (EVAL＋3 EXISTS) 4＝58。Read Region write 增量分別為 0、1、2、2、3、3、6；最大值 64。超時／runtime error 仍按該分支已到達的最大 calls 計，不重送。

每 POST 強制 request body ≤131,072 bytes、response body ≤32,768 bytes；成功分支 client body 合計最多 1,048,576／262,144 bytes，合計 1,310,720 bytes，不含 HTTP／TLS framing，亦不是 provider bandwidth 上界。一次空 inventory 只有三個 exact keys；registry 與 users 兩個 hash 接收資料，sessions 不寫入。registry 最多寫四個 hash fields（bundle、revision、bindings、digests），users 僅一個 synthetic subject field；reserve 將該 field 更新為 eligibility／windows／single reservation 狀態。固定 fixture 下的實際序列化 payload 會由本機測試核對上限；真實 Redis encoding／metadata／provider storage bytes 未經測量，`providerStorageBytesUpperBound: null`，不能由 mock 宣稱 storage 上界；≤230MB 只作 owner 人工觀測門檻。

### 外部啟動前置（未授權／本次不執行）

owner 須在任何秘密讀取、spawn 或網路前，針對當次確認：專用且隔離 DB 為 Free、Primary 為 Tokyo、Read Regions 明確為無、無付款方式、無其他 workload／writer；並提供 commands、bandwidth、storage 各自可核對來源、數值、觀測時間及時區。觀測可能過期；分別須 ≤400,000、≤9GB、≤230MB 才符合本次提案門檻，但不能解讀為即時餘額／保證剩餘容量。任何缺項、矛盾、超門檻、非預期 keys 或 unknown 均 fail closed。

一次外部清單只包括：三鍵 exact preflight；一次 TEST_ONLY registry publish；一次 eligibility seed；兩個獨立 OS child 各送一次相同 reserve；明確 terminal 後一次 usage read；只有成功／用量合格才一次三鍵 exact cleanup 與一次 exact EXISTS 確認。無論 usage 表現如何均不重跑異動、不退款、不 regrant；有 unknown 即停止並保留 inventory。所有外部帳戶／Redis 動作仍需另外明確批准。

**2026-10-08 接續狀態**：營運者已另行核准一次三鍵 Phase B 上述限定批次，沒有 Read Regions；但當次詳細 Read Regions 清單、無付款方式、無其他 workload／writer 及有來源／時間／時區的用量觀測仍須在執行當下確認。本機 CLI 已提供固定 plan／digest 與條件式 execute；只有全部當次條件合格才讀取無回顯秘密並進入既有 runner。任何缺項均零 secret read／zero dispatch；plan digest 綁定全部操作與限制；本機一次性 state lock 阻止同一批准的第二批。此輪僅以 mock 驗證，沒有實際外部執行；unknown／失敗後不自動重跑，仍遵守上述保留 inventory／不清理等既有分支語意。舊版「外部仍未批准／CLI 無條件拒絕」敘述為歷史，不覆蓋本段現況。

## 2026-10-08 T153 Phase B caller／child transport 七鍵版本（歷史；三鍵現行契約見本檔首節）

本節是本次明確批准的本機子範圍，不重審已結案批次、不授權外部操作。下方 2026-10-07 IPC wire mock 保留為歷史；現行 child 改用既有 `createRedisRestTransport`＋`createRedisSharedStore.reserve`。不改業務 Lua、七鍵 inventory、production factories、成本表或既有 metering gate。

### 接線、秘密及啟動界線

- [caller](../../../scripts/005-phase-b-caller.mjs) 管理 preflight、seed、barrier、只讀確認與 exact cleanup；[worker](../../../scripts/005-phase-b-worker.mjs) 各自在獨立 OS process 建立既有 transport／adapter，只送同一 reserve 一次。external worker 分支使用自身 `fetch`，不發 writer envelope 給 parent、不使用 parent proxy。
- 本輪實跑 **mock 模式**：child 的既有 transport 以注入 mock fetch，透過 private IPC 將 body 交給 parent 的 Lua 替身 authority。這是測試橋接，沒有 socket／HTTP endpoint／Redis；不能當成 external 分支實跑或真實跨 process Redis 原子性證據。舊 wire mock 的成功／unknown 情境仍保留在測試。
- [runtime 載入器](../../../scripts/005-phase-b-runtime.mjs) 使用本機已安裝 Node `v24.19.0` 的 `registerHooks`／`stripTypeScriptTypes`，只處理 repository `api/_lib` 的既有 TS 與相對 import；不新增套件、不產生編譯檔、不改正式 runtime／bundle。MJS 另作語法與實際 child 測試，不以 declaration 的 strict 檢查冒稱 MJS strict。
- parent 的安全來源 port／既有無回顯 TTY helper 已接出，但 **現行 external API 與 CLI 無條件拒絕啟動**：營運者提供的回覆已確認 provider 計量規則，惟當次 Free／region／用量觀測及其 stale-capable 風險處置、epoch floor／authority provenance、外部執行批准仍未齊；在讀秘密、spawn、網路前停止。沒有可強制放行的旗標、假 ruleRef／digest／usage 或新秘密設定。取得證據及另批批准後，仍須先批准 freshness 契約差異並限定接入可信來源與驗證 gate；不能直接改一個 boolean 放行。
- 本機來源只接受假 URL `https://phase-b-mock.upstash.io` 與假 token `FAKE_PHASE_B_ONLY`。真實秘密本輪完全未讀。日後秘密限 parent 記憶體及 private IPC dispatch payload；不進 argv、environment、檔案、stdout／stderr、exception、IPC log 或 report。init／ready 不含秘密，只有 barrier 後完成重查才交給各 child。child 環境只繼承 PATH／SystemRoot／WINDIR／TEMP／TMP，`execArgv: []`、輸出忽略；不繼承 `NODE_OPTIONS` 或帳戶憑證。結束後釋放引用並停止自有 child，不宣稱 JS 字串已安全抹除。

### 可強制上限與派送前重查

固定一批、兩 writer、每個異動一次；caller 先凍結 plan 並複製 fixture，僅允許既有七鍵同 hash-tag exact inventory。固定 REST 派送額度 ≤8、logical envelope ≤89；每次 request body ≤131,072 bytes、response ≤32,768 bytes，每操作 ≤2,000 ms，總視窗 ≤20,000 ms，ready ≤3,000 ms。confirmation 預留 2,000 ms、cleanup＋confirm 預留 4,000 ms。worker 自身強制 reserve 單次與 request cap；response／HTTP／redirect／timeout 沿用既有 transport，不重試。

barrier 完成後、交付秘密與 reserve 派送前重新檢查：stop／abort、兩 worker 存活、剩餘時間 **>8,000 ms**（操作 2,000＋確認 2,000＋清理 4,000）。等於或小於門檻不派送；測試涵蓋 7,999／8,000／8,001 ms。request 測試涵蓋 131,071／131,072／131,073 bytes；response 涵蓋 32,768／32,769 bytes。child 停止最多先等 250 ms，再 SIGKILL 並有界等待 250 ms；此本機 process teardown 不增加 REST 預算。

### 可審閱外部執行方案（未授權／不可啟動）

沿用下方既有 seed、七鍵、Lua 與逐操作 logical 算術。兩 writer 只能使用完全相同 synthetic reserve；2,400 µUSD 是 fixture，不是正式成本。外部當次窗口須由可信 server 時間重建，不能沿用 mock 日期；若取得該時間需要追加 Redis 操作，須先重新明列包絡並批准，不能暗加 TIME／校準。

營運者需提供的專用 DB 方案、region／Read Region、當下用量與剩餘容量、namespace-matched floor／authority 證據，以及本批一次性操作與批准邊界，集中列於[Phase B readiness 決策包](../readiness-decisions.md#一次限定-phase-b-外部執行清單目前未批准未啟動)。不得在此契約或報告中記錄 token／REST credential。執行前須另批批准；當前 external API／CLI gate 仍在讀秘密、spawn、network 前拒絕。

以下拆開記錄 HTTPS REST POST、logical commands、依支援公式推導的 provider commands 與 USD 費用。Upstash 營運者提供的支援回覆確認 EVAL／EVALSHA 每次計 1，加上實際執行的每個 `redis.call`／`redis.pcall`；因此表中的 provider command 上界只在本表明列的 script、最多一個 Read Region、無其他隱含派送及固定單批條件下成立。無 Read Regions 時，provider commands＝logical commands；有一個 Read Region 時，每個實際寫入 call 在 replica 再計一次。Free 最多一個 Read Region。支援來源與完整回覆紀錄見 [readiness 決策及證據](../readiness-decisions.md#2026-10-08-upstash-支援回覆與-phase-b-計量收斂)。

`readQuota` 的 `readQuota` script 先執行共同 `TIME`＋七鍵 `TYPE`、讀 user，接著只驗證當日／當週窗口並回傳；它在 `readQuota` 分支提前 return，不執行後續 registry projection。故最大為 EVAL＋9 calls＝10，原 seed-unknown 計數正確。兩 writer 的 reserve 在相同原子 Lua 下至多一筆 grant 寫入、另一筆 duplicate；這使單一 Read Region 條件下 race 的 reserve 包絡為 33，而不是把兩次各按 grant 重複計算。runtime error／timeout 前已執行的 calls 仍落在各操作完整上界內；較早 return 只計已到達的 calls。

| 分支 | HTTPS POST 上界 | logical commands | provider commands：0 Read Region | provider commands：1 Read Region | 停止／確認／清理 |
| --- | ---: | ---: | ---: | ---: | --- |
| 外部 gate／已中斷／秘密失敗 | 0 | 0 | 0 | 0 | 不讀真秘密、不 spawn、不連網；無 cleanup。 |
| preflight 非空／unknown／timeout | 1 | 8 | 8 | 8 | 不 seed、不刪除既有 key。 |
| registry seed unknown／timeout | 3 | 33 | 33 | 34 | preflight 8＋publish 12／13＋一次 `registrySnapshot` 13；無第二 seed／race／cleanup，確認 observed 仍停止。 |
| eligibility seed unknown／timeout | 4 | 41 | 41 | 43 | preflight＋兩 seed 31／33＋一次 `readQuota` 10；無 race／cleanup。 |
| seed 後 worker 故障／barrier 中斷／時間或 request 超界 | 3 | 31 | 31 | 33 | reserve 零派送；已 seed inventory 保留，人工另批處置。 |
| reserve unknown／timeout／worker crash，或 graceful stop 遇 unknown | 6 | 73 | 73 | 76 | 31／33＋兩 writer reserve 32／33＋一次 `getReservation` 10；先停止 child。只讀 observed 也不能證明沒有晚到寫入；不 verify usage／cleanup。 |
| graceful stop，兩 writer 已知 terminal；race 結果矛盾 | 5 | 63 | 63 | 66 | 不新增異動、不 cleanup。 |
| 第二階段強制 abort（派送後） | 5 | 63 | 63 | 66 | 立即停止自有 child；不追加確認／usage／cleanup。 |
| usage unknown／timeout／數值矛盾，或 cleanup 前中斷／時間不足 | 6 | 73 | 73 | 76 | 31／33＋兩 writer reserve 32／33＋readUsage 10；不 cleanup。 |
| 成功，包含 cleanup unknown／timeout 後確認成功 | 8 | 89 | 89 | 99 | 31／33＋兩 writer reserve 32／33＋usage 10＋exact DEL 8／15＋exact EXISTS 8；全部 keys 不存在才記 cleaned。 |
| cleanup 或其唯讀確認未收斂 | 8 | 89 | 89 | 99 | 同上限；DEL 不重送，停止／保留 inventory 清單，cleanup 未證實。 |

這些是依程式及 Lua 靜態推導的**provider command 數量上界**，不是 HTTPS 請求數，也不是 USD 費用上界。現行建議 go 條件要求營運者在當次證明無額外 Read Regions，故採用 89 commands；若有一個 Read Region，則改按表中上界評估並須在另批執行批准中明確接受，不能沿用 89。USD 費用需分開處理：僅在當次確認 Free 且沒有付款方式時，支援回覆保證不會自動升級／產生費用，方可記錄 USD 上界 US$0；付款方式狀態未知或不符時不得推定零費用。`billableUpperBound` 不承載 command 數，仍為 `null`（USD 金額尚未由帳戶條件確認）。

每次最多 8 個 HTTPS POST、每 body 131,072 bytes、每 response 32,768 bytes；若每次都達 byte cap，應用層 request＋response payload 合計最多 1,310,720 bytes（1.25 MiB），但不含 HTTP／TLS／provider 計法與額外跨區複寫，不能當 bandwidth provider 上界。Redis storage 峰值亦未由此推出。程式另強制 operation／總時間及 barrier 後剩餘時間限制，詳見本節「可強制上限與派送前重查」。目前 `providerMetering: "unverified"` 是未執行真實 provider 的狀態；mock、Console 差值及此靜態推導均不代表實際用量或 USD 帳單。

分支互斥，不能把表格相加作新預算。兩 writer 的額度在 go 前一起保守預留：report 的 `restRequestsUpperBound`／`logicalCommandsUpperBound` 是**派送額度上界**，worker 可能在真正 fetch 前死亡，因此不冒稱逐筆實際 HTTP 次數。mock authority 的 request 記錄另外驗證實際本機 body 數；成功 mock 為八筆。這些均不是 provider 計量或 billable upper bound。

第一階段 stop 禁止新異動，已派送 writer 等待有界 terminal／unknown，可在時間內作契約允許的一次唯讀確認；第二階段 abort 結束 child 並禁止後續請求。所有異動 unknown／timeout／格式或大小錯誤都不重送、不退款、不重新 grant。seed unknown 的唯一確認對應該 seed，不繼續第二 seed；reserve unknown 的唯一確認核對同 subject／reservation／idempotency／fingerprint／amount／日週窗口。presence 只記 observed，不當成安全清理的收斂證據。只有一 grant／一 duplicate、兩 PID 不同及日／週各一次 amount 的已知成功路徑才可 cleanup；只限 frozen 七鍵逐一 DEL，確認僅七鍵 EXISTS，不用 SCAN、wildcard、KEYS 或 FLUSH。

型別、命令、結果、限制與逐檔紀錄見[本輪證據](../../../docs/verification/005-local-implementation-evidence.md)。provider 維持 `unverified`、`billableUpperBound: null`；T152 不重開，T153／T154 父項與 12 項正式 gate 不勾選。

## 2026-10-07 T153 Phase B：既有 reserve 跨 process 方案（本機 mock 完成；外部未執行）

本節只批准／記錄本機 harness 與方案，不授權真實 Redis。T153／T154 父項與正式 gate 維持未完成，T152 不重開。Phase B 外部執行須另行批准，且不得繞過既有 metering gate。

> 歷史算術保留供追溯；下方舊表只稱 logical envelope。請以本文件上方 2026-10-08 現行表的 provider rule／Read Region 條件為準。

### 選定原子操作與 seed

使用既有 `createRedisSharedStore.reserve` 呼叫 `REDIS_QUOTA_LUA` 的 `operation: "reserve"`，不帶 `requestEpoch`，只測第一次 quota reservation／execution grant。兩個 writer 以完全相同的 synthetic idempotency key、reservation ID、fingerprint、cost model 與 estimate 同時送出；不得各自生成不同操作或由 parent 代送 writer request。

seed 限定 TEST_ONLY、無上游呼叫：

| Seed 欄位 | 固定值／規則 |
| --- | --- |
| Namespace | 每次新建 `{preview-<16 個隨機字元>}`；生成後即凍結，本機 fixture 使用 `{preview-phasebtest000001}`／`{preview-phasebtest000002}`。 |
| 完整 key inventory | 使用既有 `REQUEST_EPOCH_KEYS(namespace)` 的七個同 hash-tag keys：`<namespace>:registry`、`<namespace>:users`、`<namespace>:sessions`、`<namespace>:request-epoch-authority`、`<namespace>:request-epoch-issuances`、`<namespace>:request-epoch-unused`、`<namespace>:request-epoch-owner-counts`。`createRedisSharedStore` 注入 `epochFloor` 時固定傳七鍵，即使本 reserve command 不帶 `requestEpoch`；四個 epoch keys 只經 TYPE guard，不建立內容。沒有動態 rate key。啟動前只對此七 key 做 exact `EXISTS`；任何一個已存在即停止、不清除。 |
| Registry | 既有測試 fixture 結構，revision 1、六 endpoint 完整 bundle，僅 `assistant` 為 TEST_ONLY live，其餘不 live；不引用 production price table，也不把 fixture amount 當 provider 成本。 |
| Identity／eligibility | `phase-b-synthetic-subject`，status `approved`、tier `tier1`、無 expiry；不使用真實 subject。 |
| Reserve command | idempotency `phase-b-synthetic-operation`、reservation `phase-b-synthetic-reservation`、endpoint `assistant`、fingerprint 為固定 64 個 hex 字元、fingerprint key version `TEST_KEY_v1`、`inputTokens=0`、estimate `2,400` µUSD、lease `60,000 ms`。 |
| Quota／time | TEST_ONLY tier1／tier2 day 與 week base limit 各 `10,000` µUSD；mock clock 固定 `2026-10-06T02:00:00.000Z`。外部方案須於當次依 server time 重建當日／當週窗口，不重用此 mock 日期。 |
| Epoch floor input | Lua envelope 僅帶 namespace-matched、synthetic shape 的 floor（generation／revision 1、retiredThrough 0、空 revokedKids、synthetic digest）；`requestEpoch` 不帶入，authority/issuance keys 不 seed。此 mock floor 不是可信 restore-floor evidence，不能供外部 composition 使用或代表 T152 驗收。 |

先以同一 Lua／REST adapter 的 seed requests 執行 registry publish 與 eligibility set，各一次；reserve 前不呼叫付費 handler／provider。成功標準是兩個 child 分別取得 `reserved`／`executionGrant: true`、`duplicate`／`executionGrant: false`；其後一個唯讀 `readUsage` 證明日／週 `reservedMicroUsd` 都恰為一次 estimate（2,400），不得為兩倍。上游呼叫數必須為 0。

### 外部階段 REST 次數與 logical command 包絡

下列 Redis command 數是 outer EVAL 加 source-visible 內層 `redis.call` 的保守 logical envelope，不是 provider billing 保證、不是 billable upper bound。每一流程只可選成功或 unknown 分支；不能把互斥分支合計成允許多跑的預算。

| 階段 | REST EVAL POST | 每次 EVAL 的 logical Redis commands 上界 | 備註 |
| --- | ---: | ---: | --- |
| Exact-key preflight | 1 | 8（EVAL + 7 EXISTS） | 僅 inventory 七個 key；非空即停。 |
| Seed registry publish | 1 | 12（EVAL + TIME + 7 TYPE + 2 HGET + HSET） | 唯一 revision/bundle/digests。 |
| Seed eligibility | 1 | 11（EVAL + TIME + 7 TYPE + HGET + HSET） | 合成 subject，approved fixture。 |
| Seed unknown readonly confirm | ≤2 | ≤23（`registrySnapshot` 13 + `readQuota` 10） | 每個 unknown seed mutation 對應一次唯讀確認；不進 race、不重送、不 cleanup，確認後仍停止。 |
| 雙 writer reserve | 2 | ≤32（每 writer ≤16：EVAL + TIME + 7 TYPE + user HGET + registry 5 HGET + 最多 1 HSET） | 每 process 自己建立 `createRedisRestTransport`，各送同一 reserve EVAL 一次；邏輯 operation count 只以 source 可見呼叫估算。 |
| 成功後 usage verify | 1 | 10（EVAL + TIME + 7 TYPE + HGET） | 僅已知兩個 writer response 後執行，核對 daily／weekly amount。 |
| Reserve unknown readonly confirm | ≤1 | ≤10（EVAL + TIME + 7 TYPE + HGET） | 與成功後 verify／cleanup 路徑互斥；`getReservation` 只讀同一 synthetic reservation。 |
| Exact cleanup（只限完全已知成功路徑） | 1 | 8（EVAL + 7 exact DEL） | 只對完整 frozen inventory 七個 key逐一 DEL，一次；不使用 wildcard／SCAN／FLUSH。 |
| Cleanup unknown readonly confirm | ≤1 | ≤8（EVAL + 7 exact EXISTS） | cleanup POST timeout/unknown 時只確認一次；不重送 DEL。 |

成功完整流程最多 **8 REST POST／89 logical commands**：preflight 8 + seed 23 + reserve 32 + usage verify 10 + cleanup 8 + cleanup confirm 8。Reserve unknown 流程最多 **6 REST POST／73 logical commands**：preflight 8 + seed 23 + reserve 32 + `getReservation` confirm 10，之後停止；不得再 verify usage／cleanup。Seed unknown 流程最多 **5 REST POST／54 logical commands**：preflight 8 + seed 23 + 至多兩次唯讀確認 23，確認後停止，無 reserve／cleanup。計數以程式可見呼叫封包為準，最多一批、不 retry；不得宣稱這些數字就是供應商計費上界。

### Timeout／unknown、停止與 cleanup

- 所有異動 operation 每次最多 POST 一次；timeout、斷線、非成功 HTTP、redirect、格式錯誤或 response 過界皆為 unknown，不重送 seed／reserve／cleanup，不退款、不重新 grant。
- reserve 任一 writer unknown 時，停止新派送並等待兩 child 結束；僅可對相同 subject／reservation ID 作一次唯讀 `getReservation`。record 完整吻合只證明當下存在該 reservation，不代表未知 client request 已無晚到可能；record 缺漏、矛盾、讀取失敗或逾時均維持 unresolved。所有 reserve unknown 路徑都停止，不做 usage verify 或 cleanup，保留 exact inventory 供另批唯讀確認／處置。
- 只有兩 writer 都取得明確 terminal responses，且結果恰為一 grant、一 duplicate，`readUsage` 符合單次 amount，才可對 frozen 七-key inventory 做一次 cleanup。cleanup unknown 僅做一次唯讀七-key `EXISTS`；全不存在才確認清理完成，其餘一律停止／unresolved，不重送 DEL。
- Seed 任一寫入 unknown 時不得進入競態或重送 seed；僅可用既有唯讀 snapshot／eligibility read 確認。無法證明狀態一致即停止，不能藉 cleanup 隱藏部分 seed。

### 秘密與 process 傳遞

未來另批 external caller 的 parent 以無回顯 TTY／本機安全秘密來源取得當次 REST URL／token，僅暫存記憶體；不得放 argv、environment、檔案、stdout／stderr、exception、IPC log 或報告。parent 先啟動兩個獨立 child，清除 `NODE_OPTIONS` 與帳戶憑證的環境繼承；兩個 child ready 後由 parent 僅發 barrier，再透過 private IPC 將 URL／token 與必要無秘密 command 各自傳給 child。每個 child 在自身 process 建立既有 `createRedisRestTransport` 並直接送 reserve EVAL；parent 不代送或 proxy writer REST request。IPC payload 與結果均不得被 dump／記錄；report 只保留兩個不同 PID 的 boolean 證明、slot、enum 結果與數字。結束後盡力清理 process memory，由 owner 依另批範圍撤銷／輪替 credential。

本機 [`005-phase-b-worker.mjs`](../../../scripts/005-phase-b-worker.mjs) 僅建 mock client，經 child IPC 將 REST wire envelope 交予測試 mock；全程不開 socket、不讀 credential、不觸外網。它不是 external caller，也不能當作真實 REST／Redis proof。`providerMetering: "unverified"`、`billableUpperBound: null` 與業務 runner verified-metering gate 原封不動。

## 2026-10-07 本次限定外部校準批准與結果補記

本次一次外部校準已另獲營運者明確批准並執行，未知計量／Free 超限／Console 延遲界線已接受；不改下方固定 script、操作包絡、unknown／秘密契約或業務 runner gate。營運者提供成功 JSON：4 REST POST、marker 確認、PTTL 59948 ms、exact cleanup 成功；前次 `secret_invalid`／零派送及人工 Console 前後值分開保留於[證據](../../../docs/verification/005-local-implementation-evidence.md#2026-10-07-限定外部-redis-校準營運者執行與人工-console-證據)。

無額外跨區 Read Region 的 Console 證據不代表沒有供應商內部高可用性複本；不要求或宣稱驗證「無任何 replication」。provider 計量仍 `unverified`，計費上界仍 `null`。本次批准不延伸至 Phase B 或其他外部操作；T153／T154 父項及正式 gate 不勾選。下方「本次批准只限本機／外部未授權」保留為本機實作批次的歷史界線。

本次批准只限本機工具、測試與文件。T152維持結案；沿T153／T154的本機子範圍，不勾父項／12正式gate，不修改正式成本／模式／預設HTTP exports。

## 2026-10-07 獨立 Redis calibration caller（本機實作完成；外部執行未授權）

本節取代下方 2026-10-07「校準 batch A」作為 Phase A 現行校準設計；下方原文保留為歷史，不再作為待批准執行方案。既有 `runIsolatedBatches` 的 verified-metering gate（`metering.ruleRef`、usage port、`U` 上界、`totalCommands`）**不變、不削弱**：業務 runner 仍在任一上界未知時拒絕啟動。校準不經 runner，改由獨立 test-only caller [`scripts/005-redis-calibration.mjs`](../../../scripts/005-redis-calibration.mjs) 執行，它不 import runner、composition、worker 或 production transport，也不填入假 `U`、假 provider rule 或虛構 usage。目的就是取得「EVAL 與內層 calls 實際如何計量」的人工觀測，解除「校準前必須已知待校準規則」的循環。

### 三種數字分開定義

| 類別 | 內容 | 性質 |
| --- | --- | --- |
| a. 程式可強制上限 | HTTP POST 最多 4 次（每個固定 op 至多 1 次、不重試、不轉址）；script 內容須與計畫 SHA-256 完全一致；每 op 恰 1 個 exact key、inventory 共 1 key；request body ≤ 2,048 bytes；response ≤ 4,096 bytes；每 op timeout 2,000 ms；秘密輸入完成後整體視窗 20,000 ms；marker 32 字元、TTL 60,000 ms。 | 由 dispatcher 在 `fetch` 前同步計數與驗證，超界即拒絕、不派送。 |
| b. 邏輯 Redis commands | 外層 EVAL＋明列內層 `redis.call`：probe 2（EVAL＋TIME）、write 2（EVAL＋SET NX PX）、verify 3（EVAL＋GET＋PTTL）、cleanup 3（EVAL＋GET＋DEL）＝最多 10。 | 由固定 script 推得的邏輯包絡；**不是** provider 計量或計費上界。 |
| c. provider 計量與費用 | EVAL 是否逐項計內層 calls、read region／replication 倍率、Free 超限行為、usage 更新延遲。 | **未知**。報告固定 `providerMetering: "unverified"`、`billableUpperBound: null`；只允許 owner 在 Console 前／後人工記錄，不自動 polling、無 usage API 為安全開關。 |

不得把 a 或 b 宣稱為 c；c 需由營運者在外部執行前明確接受其未知界線。

### 固定操作與確認語意

每次執行產生唯一 namespace `{preview-<16 字元 random>}`，唯一 key `<namespace>:calibration:marker` 於啟動前凍結；計畫 JSON（namespace 以 `{preview-<random-id>}` 代入）的 SHA-256 即 `templateDigest`，`--execute` 必須提供相同 digest。順序固定 probe → write → verify → cleanup，皆為單 key `EVAL`：

1. **probe**：唯讀 `TIME`；只證明當時連線／EVAL 可用。
2. **write**：`SET KEYS[1] <marker> PX 60000 NX`；marker 為 32 字元一次性 base64url 合成值。回 0 → `write_conflict`，不寫、不清理他人值。**write unknown 一律不重送。**
3. **verify**：同一唯讀 Lua 內 `GET`＋`PTTL`，核對 marker 相符且 `0 < PTTL ≤ 60000` 才為 `written_confirmed`。
4. **cleanup**：只在 marker 已確認時執行 compare-and-delete（`GET` 相符才 `DEL`），回 1 才記 `cleaned`。

- 再查 `TIME` 只證明新查詢成功，不確認任何先前請求。`PTTL` 只代表查詢當下 TTL，不能單獨證明原 SET；確認一律以 marker GET＋PTTL 在同一唯讀 script 中判定。
- verify 回不存在、已到期、不符或 TTL 異常時：write 為 unknown → `write_unresolved`；write 已回成功卻不存在 → `contradiction`；verify 本身失敗／逾時 → `confirmation_unknown`。以上皆**保留 unknown**：不推論未寫入、不退款、不重授權、不重寫。
- 未收斂 unknown 時 cleanup 記 `withheld_unresolved`，不執行可能與晚到寫入競爭的清理；60 秒 TTL 不當作已完成清理的證據，報告列出 exact key 供人工後續處置。cleanup 失敗／不符／不存在記 `cleanup_unconfirmed`。
- 禁止 SCAN、wildcard、KEYS、FLUSHDB／FLUSHALL；只可對 inventory 中的 exact key 操作。

### 中斷、逾時與晚到結果

- 第一次 SIGINT（stop）：不再派送新的 probe／write；已派送的 write 仍做至多一次 verify，及 marker 已確認時的一次 cleanup。第二次 SIGINT（abort）：中止 in-flight 並停止一切後續派送。
- 逾時以 race 結束該 op 並記 unknown；晚到回應被丟棄，不改狀態、不追加派送。write 需剩餘視窗 ≥ 3 個 timeout、probe 需 ≥ 4 個 timeout，才保留 verify／cleanup 時間。
- 非 200、`redirected`、跨 origin、超過 bytes、JSON 解析失敗或 provider `error` 一律記固定分類 `unknown`，不回傳 provider 原文。

### 秘密與網路邊界

- import／建立工具不讀 env、檔案、秘密，也不連線；無參數執行為 dry-run，只輸出計畫、限制、digest 與 `networkDispatched: 0`、`secretsRead: false`。
- `--execute --plan-digest=<digest>` 是唯一執行參數；URL／token 只能在啟動後由 TTY raw-mode 無回顯輸入（非 TTY 拒絕，Ctrl-C／ESC 取消）或測試注入的可信 provider 取得，不從 env／`.env*`／檔案自動載入，不進 argv、stdout、stderr、錯誤、報告或 fixtures。
- 目標必須是 `https://*.upstash.io` origin（無 port、帳密、path、query、hash）；`redirect: "error"`、`cache: "no-store"`、`Authorization: Bearer`。
- 本 caller 只產生校準觀測；不證明業務 atomicity、跨 process、restore，不勾 T153／T154 父項或任何正式 gate。

## 2026-10-07 Free Redis process-only 設定與最小校準提案（尚未授權執行）

> 2026-10-07 註：本節「校準 batch A」（2 key、13 邏輯 commands、`27+2U`、confirm 重查 TIME／PTTL）已由上方獨立 calibration caller 取代，僅保留為歷史；其「confirm 只重查 TIME 或 PTTL」不足以確認原請求，不再採用。下方 Phase B 與 runner gate 仍有效。

既有 REST 設定入口是 `rest.url`／`rest.token`，由 `validateIsolatedEnvironment` 驗證並注入 `createRedisRestTransport`／`createIsolatedComposition`；transport 以 EVAL REST POST 執行。`UPSTASH_REDIS_REST_URL`／`UPSTASH_REDIS_REST_TOKEN` 是舊決策文件提出、但 repo 尚未接線的 binding 名稱，不是現有自動環境變數。runner 僅 export `runIsolatedBatches(plan, ports)`，沒有 CLI／usage reader／已批准的外部 invocation。不得新增 env loader 或把秘密寫入檔案作為本批設定方式。

Guard 確認 `.env.local` 路徑不存在、`git ls-files` 未列入追蹤且 `git check-ignore` 命中；因無 loader 不應建立。若另批批准並提供 caller：owner 從 secure prompt／本機 secret manager 取值；只在 one-shot parent process 暫存兩個既有 proposed names；caller 在記憶體映射至 `rest.url`／`rest.token`；不得放命令列、Vite／`VITE_*`、`.env*`、source、log 或輸出；結束後清除 parent process 值並撤銷／輪替專用 token。child worker 僅依 runner 現有 OS 環境 allowlist 建立，不傳憑證。未有 caller 前不得宣稱能以這兩個名稱直接啟動測試。

### 校準 batch A

此提案只給 owner／reviewer 核准；不是本次外部命令授權。使用單一專用 Free DB、唯一 `{preview-<random-id>}`、兩個 synthetic exact keys，不建立 restore target。採 `maxBatches=1`、10 分鐘 deadline、既有 2 秒 REST operation timeout、`confirmationReserveMs=30000`、`cleanupReserveMs=30000`、60 秒 TTL、1 MiB response cap。兩個 child 只同步 IPC/barrier；slot 0／1 的 `ports.execute` 均由 parent 呼叫各自獨立 REST transport：一個 `EVAL`＋`TIME`，以及一個短 Lua `EVAL`，只對 scratch key 做 `SET KEYS[1] <synthetic> PX 60000 NX` 及 `PTTL KEYS[1]` 檢查。最多兩個 execute；unknown 最多各做一次 readonly EVAL confirm，不重送寫入；usage port 最多 baseline／post-batch 各一次；清理只可由 composition 的 exact inventory cleanup 每 key 一次 `EVAL`＋`DEL`，無 wildcard／SCAN／FLUSH。這只能證明 parent-side transport slots，不能證明兩個 OS process 各自連 Redis。

| 固定 key template | 操作 |
| --- | --- |
| `{preview-<random-id>}:probe:time:0` | 唯讀 TIME probe，未寫入。 |
| `{preview-<random-id>}:probe:ttl:1` | 唯一 synthetic SET／PTTL key，值最多 16 bytes，60 秒 TTL。 |

若只按外層 EVAL 加明列內層 Redis calls 作邏輯包絡：execute 最多 5、readonly confirmation 最多 4、exact cleanup 最多 4，合計 13 個邏輯 Redis commands；最多 6 個 Redis REST EVAL POST。此數字假設沒有 read-region replication；官方 pricing 說明 Global DB 寫入會複製至 read regions，replication 也算 commands，但目標 DB read-region 設定及 EVAL／nested write 計量倍率未核實。runner budget 候選為 `execute=3`、`confirm=2`、`cleanupPerKey=2`、`reserves.cleanup=4`、`reserves.confirmation=4`、`reserves.usage=2U`、`reserves.uncertainty=13`；`U` 是每次 usage reader 的已證明上界，尚未確認。`totalCommands` 候選為 `27+2U`，需不高於 `min(10,000, owner 當時確認可用的剩餘 Free commands)`；僅有依據證明 `U=1` 時，算術候選為 29，並非 provider 計費保證。Upstash 官方文件沒有證明 EVAL 的內層呼叫如何計量、Free 超限行為或 usage 更新延遲；usage reader 未核實、任一上界未知或 owner 當時剩餘額度無證據時，runner 必須拒絕啟動。

### 分階段驗證與停止／清理

1. **Phase A** 僅做上述連線／TIME／TTL／Lua 相容校準；不包含業務競態、restore、OIDC、Preview 或付費 upstream。
2. **Phase B** 必須等 Phase A 結果及 meter／usage 解讀完成審查、另獲外部試驗批准後才規劃。一筆 TEST_ONLY 合成操作由兩個獨立 OS process 各自建立 client，同時派送一次既有原子 reserve／grant；最多一個 batch／兩個 execute，僅 readonly confirm。現有 runner child 不執行 network ports，因此它本身不是此階段的跨 process Redis proof；若沒有已批准且可稽核的獨立 process caller／harness，停止並保留 T153 未完成。初始化 key／script、確切 command bound 與完整 inventory 尚待從選定的既有 composition operation 落實；未能逐一列出及計量即不派送。
3. 正常收斂時，只對本批啟動前凍結的完整 inventory 呼叫 `cleanupInventory`，每 key 至多一個 DEL；unknown 操作經一次 readonly confirm 仍不確定時，不清理可能晚到寫入，停止並將 cleanup 記為 unknown，待後續另批 readonly／人工處置。不得縮小 inventory、增加 key、wildcard、SCAN、FLUSHDB 或 FLUSHALL。
4. 任意失敗、未知計量／usage、quota 下降／超界、worker／deadline／signal、非預期輸出、未知 inventory 或需付款／升級時立即停止，不重試異動、不退款／regrant、不擴大範圍。任何 runner report 只可作試驗證據，不能標記 12 項正式 gate 或真實 Redis 整合整體 PASS。

## Schema 與可信來源

`validateIsolatedEnvironment(unknown)`只接受顯式server-side options，不讀process.env、檔案credentials或request。缺漏／額外欄位／非法／矛盾全部throw固定分類錯誤，不附原值。

| 欄位 | 契約 |
| --- | --- |
| scope／network | 固定TEST_ONLY／blocked；外部模式沒有預設或CLI入口 |
| rest | url／token；沿HTTPS Upstash host及既有2秒／1MiB transport限制，無非標準port。token不入log |
| oidc | config／clientSecret／policy；Google issuer／JWKS、演算法白名單、明確age／bytes／code限制；HTTPS origin與同源`/api/auth/callback`無query／hash；state 300秒、timeout2秒沿已批准常數 |
| adminSubjects | M1非空唯一合成subject清單；不是frontend role |
| keyrings | capability、fingerprint、oauth_state、rate四獨立family；每ring明列current及entries(version／32-byte key／current、verify_only或revoked)。恰一current且映射一致、同family版本唯一、所有key bytes不可重用。capability version沿22字元kid；其他沿既有version格式 |
| namespace | 必須`{preview-<合法random-id>}`、總tag≤64；呼叫既有helper生成same-tag keys，不另改schema |
| epochFloor／authority | 獨立可信floor（含evidenceDigest）、同namespace及不倒退generation／revision／retiredThrough／revokedKids；authority引用版本須已載入，owner-scope引用fingerprint family，不另增key family |
| registry | TEST_ONLY明列完整RegistryBundle及digest；沿既有validator，speech不得live。不修改production價表 |
| runner | 有限batch及operation timeout、總commands＝min(10,000, owner確認剩餘容量)、窗口≤2h；cleanup／usage reads／confirmation／uncertainty命令與cleanup／confirmation時間預留皆明列；provider規則ref及每operation conservative bound必填，未知不啟動 |

## Composition

`createIsolatedComposition(input, ports)`：ports明列`scope:TEST_ONLY`、REST fetch／OIDC custom fetch／clock／ingress／已批准tierLimits／audit／lifecycleEvidence，缺port拒絕，不退memory。接既有Redis shared store、Session／資格、rate、OAuth state、openid-client、epoch store／verifier／issuance、M1及TEST_ONLY lifecycle store；可信evidence不由HTTP布林自報。opaque Session只查store，不新增Session signing key。付費ports只回TEST_ONLY mock或speech拒絕，不import Places／OpenAI／Geoapify。所有transport keys必須同tag並列入已批准隔離inventory，未明列動態rate key則在REST派送前拒絕。清理另用`cleanupInventory(keys, signal)`，要求完整exact inventory，不接受額外key、子集合或wildcard；每key最多一次DEL，不重試。

composition建立時無網路／異動副作用，不自動publish registry／authority、不從backup自證floor；測試只對Lua替身seed metadata後呼叫既有publishRegistry與資格介面。未來真實authority初始化／發布仍須獨立外部批准與可信屏障證據，不能使用測試seed作正式工具。

## Runner

`runIsolatedBatches(plan, ports, signal)`只供顯式import，無外部CLI自動啟動。兩個獨立child process／IPC client跨有限batch存活，ready barrier後才release；父端以slot選各自獨立composition client，提供bounded execute、read-only confirm、usage及exact-inventory cleanup。worker不讀credential／不連網，IPC不傳secret、subject或payload；僅slot／sequence及有限狀態。child不繼承NODE_OPTIONS或account credentials，只帶OS啟動必要環境；stdout／stderr不透傳，report以固定enum和數字重建。此設計沒有宣稱兩個真實Redis process各自建立REST連線，該證據仍待外部T153。

provider規則為可信ref及每operation最壞計量command成本，包含內部commands及replication，不以HTTP次數替代。`runner.metering`為execute／confirm／usage／cleanupPerKey的保守command上界；`reserves`為四類總預留，batch commands＝2×execute。usage預留至少(maxBatches＋1)×usage，confirmation至少2×maxBatches×confirm，cleanup至少inventory數×cleanupPerKey；總預留先扣，全部有限batch上界必須容納，超界或未知拒絕啟動。時間含request handshake＋operation的2×operationTimeoutMs、confirmation及cleanup預留；用monotonic clock停止新batch。每個已派送command即使unknown也計入；unknown／timeout／worker失敗不重送、不退款、不regrant。

停止新batch後有界收斂已派送操作、readonly確認與清理。readonly仍unknown或確認容量不足時不刪可能晚到寫入的inventory，report保留cleanup unknown，交由日後另批唯讀／人工處理。cleanup只接受明列inventory，無SCAN wildcard／FLUSHALL；usage回報未知、倒退或超界停止後續batch，不可信provider錯誤文字不輸出。AbortSignal須由可信port遵守；不把provider abort當「未寫入」證據。report只含固定scope／evidence／status／reason／計數／chargedUpperBound／cleanup狀態，無subject／token／cookie／code／nonce／keys或provider原文。

## 逐檔與測試映射

| 程式／測試 | 驗收 |
| --- | --- |
| isolated-environment.ts／isolated-environment.test.ts | 缺漏、額外欄位、REST／OIDC、四keyring重用、namespace、floor／authority、registry、runner限制拒絕及±1 |
| isolated-composition.ts／isolated-composition.test.ts | factories接線、opaque Session、M1／資格、same-tag inventory、missing ports拒絕、default exports未接、付費零真實呼叫、失敗無fallback |
| 005-isolated-runner.mjs／005-isolated-worker.mjs／isolated-runner.test.ts | 真實兩process barrier、worker故障／中斷、command／deadline／cleanup預留、unknown僅確認、輸出allowlist、inventory限制 |

本機替身不能宣稱Redis跨instance原子性、TIME／TTL／restore或OIDC callback已驗。最後跑相關tests、strict型別、Vite build及完整回歸；無瀏覽器變更不新增E2E。

## 未來外部操作（尚未授權）

設定名稱對應本schema：`rest.url/token`、`oidc.config/clientSecret/policy`（既有環境名稱OIDC_ISSUER／OIDC_CLIENT_ID／OIDC_CLIENT_SECRET）、`adminSubjects`、四`keyrings.<family>.current/entries`、`namespace`、`epochFloor.namespace/highestGeneration/authorityRevision/retiredThrough/revokedKids/evidenceDigest`、`authority`、`registry.scope/bundle`、`runner.maxBatches/totalCommands/windowMs/operationTimeoutMs/cleanupReserveMs/confirmationReserveMs/reserves/metering/inventory`。必要可信ports如前節；不是新增自動env loader，無秘密值範例。

本機驗證使用既有runner：`npm exec --no -- vitest run tests\api\isolated-environment.test.ts tests\api\isolated-composition.test.ts tests\api\isolated-runner.test.ts`。只讀合成fixture並封鎖出站；直接`node scripts\005-isolated-runner.mjs`不會啟動任何測試或外部資源。

owner先交隔離帳戶／Free資格／剩餘commands與storage／bandwidth／EVAL計量規則及restore資格、Google純openid隔離存取措施、Vercel首次deployment target／protection／runtime證據；分別另批資源、秘密、付費及部署。取得實際命令保守上界及cleanup inventory後才能組外部ports；先小有界批次再雙writer，unknown僅唯讀確認，freeze＋獨立manifest驗restore，最後exact inventory清理與credential撤銷／舊deployment關閉。此批不提供外部執行批准或秘密值。
