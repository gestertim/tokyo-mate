# Implementation Plan: Tokyo Mate 東京通｜005 API 防護、核准存取與預算額度

## 2026-10-08 單次 Phase B 三鍵本機準備（現行；外部仍未授權）

本次只為單次、專用 Free DB 試驗準備本機 dry-run／mock 證據；provider 計量規則已有營運者提供的 Upstash 回覆，但真實 runner／Redis 執行尚未驗證。usage 是有來源、擷取時間及時區、但可能過期的人工觀測。候選啟動門檻為 observed commands ≤400,000、bandwidth ≤9GB、storage ≤230MB；不視為即時餘額或硬保證。此例外僅適用單次 Phase B；production／business runner 的 freshness／verified-metering gate 完全不變。

Reserve 使用既有 `createRedisSharedStore` 無 `epochFloor` 分支與 `REDIS_QUOTA_LUA`，固定三鍵 `<namespace>:registry`、`users`、`sessions`，合成 command 不含 `requestEpoch`，不設定 `rejectLegacy`。Lua 只在 `requestEpoch` 存在時進入 epoch authority／issuance 分支；一般 reserve 仍於同一 Lua 原子操作檢查資格、registry 與 cost binding、G、日／週額度、冪等衝突及首次 `executionGrant`。不使用 synthetic floor／digest、不略過業務檢查，也不代表 epoch／restore 完成。若實際條件無法使用這個既有分支，停止三鍵範圍並回報最小差異，不改用 bypass。

三鍵包絡：最多 8 HTTPS POST；無 Read Region 成功／cleanup 完整路徑 58 provider commands，單一 Read Region 敏感度上界 64（每個列明的 write call 加計一次）；分支計數、request／response bytes、寫入數及 exact cleanup 見[D14 契約](contracts/isolated-local-runner.md#2026-10-08-單次-phase-b-三鍵本機準備現行)。每 POST request ≤131,072 bytes、response ≤32,768 bytes，8 POST 的 HTTP body 上限分別為 1,048,576／262,144 bytes；合計 1,310,720 bytes 不包含 HTTP／TLS framing，不能當 provider bandwidth 上界。exact inventory 為三鍵；最多兩個 data-bearing hash keys：registry 四欄、users 一個 synthetic subject 欄位，sessions 不寫。provider storage bytes／內部開銷不由 local mock 證明；storage ≤230MB 仍須 owner 觀測確認。

Dry-run digest 綁定單次隨機 namespace、三鍵 inventory、硬限制、分支包絡及候選用量門檻；只作本機計畫識別，不是執行批准或外部 gate 證據。外部啟動仍須 owner 當次確認專用 Free、Tokyo、無 Read Regions、無付款方式、無其他 workload，並提供三項有來源／時間／時區的人工用量觀測；本次不讀秘密、不連 Redis、不執行 `--execute`。T152 維持結案；T153／T154 父項與正式 gate 不完成、不勾選。

## 2026-10-08 Phase B 固定 plan／條件式 execute 接續（本次現行）

CLI 預設在 ignored local state `.specify/phase-b-plan-v5.json` 建立或重用同一份 TEST_ONLY plan；不覆寫既存檔案。digest 驗證以固定 namespace 重建完整計畫並逐欄精確比對，綁定三鍵 inventory、明列 Redis Lua scripts、runner／Redis Lua／REST transport／synthetic fixtures source hashes、POST／command／byte 上限、分支包絡與容量門檻；改動任何計畫欄位或提供任意 digest 均 fail closed。Execute 只接受已保存計畫及相符 digest；先在本機確認無 Read Regions、無付款方式、無其他 workload／writer，以及 commands／bandwidth／storage 三筆具來源與含時區時間的人工觀測符合本次上限，全部成立後才讀取無回顯 TTY 秘密並進入既有 bounded runner。execution state 以非秘密一次性鎖保存；一旦開始即不自動重試第二批。既有中斷、unknown、唯讀確認、cleanup withholding／exact confirmation 與秘密隔離不放寬。

本次只驗證上述 CLI／條件 gate 與 mock runner；沒有真實 `--execute`、Redis 或 provider 呼叫。當次 Read Regions 詳細清單與其他外部條件仍待營運者於本機確認。T152 維持結案；T153／T154 父項、production gate 與六 endpoint `live:false` 狀態不變。

## 2026-10-08 D01 Places 本機候選帳務補證（現行）

使用者已批准 `priceScale=5/4`、reservation `50,000 µUSD`（US$0.05）及價表有效期 7 日，**僅限本機候選／mock**；權威額度仍以 USD／µUSD 計算，不新增 TWD 額度或自動換匯 UI。25% 是候選緩衝，不是完整帳單上界；7 日是應用程式重新查核期限，不是 Google 價格固定保證。2026-10-08 提供的 Cloud Billing 交易頁顯示「金額 (TWD)」；Google 官方[帳戶幣別文件](https://docs.cloud.google.com/billing/docs/resources/currency?hl=zh-tw)說明台灣使用新台幣，美元價格轉為當地幣別、匯率於每月初設定且不隨終端使用者所在地改變。帳戶價格 CSV 中 Nearby `F20E-7034-0EF7` 與 Text `120C-BEC3-B48F` 首階數值各約 1,271.20／1,000 events，但 CSV 未明列幣別／匯率，不能用 `$` 欄名推定美元，也不能由此推算匯率或 50,000 µUSD 上界。

此補證只更新本機候選核准範圍，不批准正式價表、成功路徑或 production endpoint。未知計費結果仍 uncertain／保留預留／不重試；production 六端點維持 `live:false`，speech 真實呼叫受阻。T151 未結案、T152 維持結案、T153／T154 與正式 gate 不變。

## 2026-10-08 六端點隔離 mock-success 子範圍（本次批准）

本次只補成功 descriptor 與隔離 HTTP pipeline，不批准任何正式成本、model、SKU、tier、output cap、D01 或 production endpoint。`assistant`、`transcribe`、`places`、`photo-ocr`、`photo-translate` 透過各 API `createHandler` factory 明確注入標記 `TEST_ONLY` 的 descriptor／合成 reservation context，驗證有界解析、端點輸入驗證、同一原子 reserve、mock upstream、結算與 HTTP response；production `POST` export 仍未配置、維持 fail closed。fixture 僅提供合成測試 accounting 值以驅動流程，不是可信的真實成本上界；不得載入 production registry、替換正式價表或推論供應商帳單。

`speech` 只允許驗證輸入及明確 mock 的輸出形狀；不建立可執行 lease、不做成功 reserve／settle，也不呼叫 OpenAI 或其他真實 provider。Places-only 原限制是其固定 request 費用能作為有限的本機示意，而其他 token／audio／image 端點欠缺逐端點合法成本上界、model/SKU/output cap 與完整 request/envelope 前提證據；D01 正式 gate 未決（本機候選／mock 數值另見上方現行補記），speech 官方最大輸出／audio token per second 亦未查得。此處僅新增 TEST_ONLY 測試流程，不改正式限制。production 六端點維持 `live:false`，正式輸入／成本上界、lease、真實 Redis／provider 證據及所有外部啟用 gate 不變。此為 T146 的隔離子範圍，不代表 T146、T025、T036 或任何正式驗收整項完成。

## 2026-10-08 獨立本機管理恢復補足（現行）

沿用已批准管理確認／冪等契約與 React local state，不新增架構或 dependency。`AdminMutationPanel` 以同步 AbortController ref 阻擋同批次連點，卸載取消 client 等待並忽略晚到；client `submitAdminMutation` 接可選 AbortSignal，不改 HTTP schema／後端授權。取消等待不代表 server rollback，操作鍵只保留在目前元件記憶體，不新增持久儲存。

未知回應在原確認區保留同鍵並停止取消換鍵；後續手動確認被拒絕亦不抹除先前未知。首次明確輸入／權限／限流等拒絕仍可取消修正。非 modal 確認區聚焦並保留正常 Tab 順序；取消回原按鈕，成功刷新由詳情頁將焦點交給保留的確認按鈕。錯誤 alert、處理中 status 沿既有 UX。

只對修改範圍跑 targeted、strict 與新增隔離 browser／成功管理回應 SW exclusion；既有地圖裁切／fallback／受限 PWA 不重跑。六端點成功 descriptor／HTTP 結算仍未補齊，D01 正式計費證據與 production gate 仍未完成；Places-only 限制不變。本機候選參數現況見本 Plan 上方補記；不碰真實 Phase B、正式 `live` 或外部設定。結果與限制見[本次證據](../../docs/verification/005-local-implementation-evidence.md#2026-10-08-獨立本機管理恢復與可及性補足本次現行)。

## 2026-10-08 T153 Phase B caller／child transport 七鍵版本（歷史；三鍵範圍見本 Plan 首節）

沿用既有 stack、原子 reserve、七鍵 inventory 與 TEST_ONLY fixture，不重新規劃或重審已結案批次。新增[caller](../../scripts/005-phase-b-caller.mjs)及其[型別](../../scripts/005-phase-b-caller.d.mts)，將既有[worker](../../scripts/005-phase-b-worker.mjs)改接自身 `createRedisRestTransport`／`createRedisSharedStore.reserve`；[runtime helper](../../scripts/005-phase-b-runtime.mjs)只利用已安裝 Node 24 的 in-memory TS transform 載入既有 adapter，不生成編譯資產、不改正式 runtime 或新增 dependency。

parent 只做 seed、barrier、bounded readonly confirmation 與 exact cleanup；external worker 使用自身 fetch，不經 parent writer proxy。本輪只實跑 fake-secret／IPC mock authority；它證明 child 的實際 adapter／transport 程式路徑與本機 fixture，不證明外部 HTTP／Redis 原子性。舊 wire mock 證據保留。

固定一批、最多八次 HTTPS POST；在本次程式／Lua complete envelope 下，無 Read Regions 為 89 provider commands，有一個 Read Region 時最多 99（內部 HA 不倍增，只有實際寫入 calls 在 replica 再計）。Upstash 營運者提供的支援回覆已確認 EVAL＋實際內層 calls、early return／runtime error、Free caps、無付款方式費用硬停止及用量報告無最大延遲 SLA；完整回覆／來源限制見[證據](../../docs/verification/005-local-implementation-evidence.md#2026-10-08-upstash-營運者提供的支援回覆及-phase-b-計量收斂)，逐分支算術見[現行契約](contracts/isolated-local-runner.md#2026-10-08-t153-phase-b-callerchild-transport-本機交付現行)。逐行檢查確認 eligibility seed unknown 的 `readQuota` confirmation 在 7×`TYPE`＋`TIME`＋user `HGET` 後提前 return，最大 10 commands；現有 caller 計數正確，無需改動。provider command 上界不等於 USD／bandwidth／storage 上界；`billableUpperBound` 不填 command 數且仍為 `null`。

external API／CLI 仍在讀秘密／spawn／network 前拒絕。當次 Free／Tokyo／Read Regions、付款方式、其他 workload、來源可核對但可能過期的 commands／bandwidth／storage 觀測及 fresh-namespace floor／authority provenance 仍須 owner 提供；usage 無最大延遲 SLA，現行 freshness／worst-case gate 不能判 READY。本次不採 bypass／假 evidence；若要以 stale-capable 人工觀測執行單次測試，須先批准 readiness 所列精確契約差異及另外的外部執行授權。全新隔離 namespace trusted bootstrap 與 production restore 屏障分開；production restore 完整證據仍屬未完成的 T153，不要求以 T152 代替。

本次只對 Phase B caller 的阻擋原因、相應 mock regression 核對及直接相關 D14／Plan／Tasks／Readiness／evidence 文件作限定本機修正；不改產品行為／正式 gate／production code／成本／HTTP exports、dependencies、env 或部署。沒有連線 Redis、讀秘密／帳戶、啟動 `--execute` 或外部操作。T152 結案；T153／T154 父項、12 正式 gate、六 production `live:false`／speech 受阻均不變。

## 2026-10-08 D01 Places 決策包同步（前次文件查核；候選狀態由上節更新）

依 [readiness-decisions.md 的 D01 集中決策表](readiness-decisions.md#d01places-決策包2026-10-08-本次更新)同步技術基線。公開官方欄位表確認目前七欄完整 mask 的 Nearby／Text 分支均由 `places.editorialSummary` 觸發 Enterprise + Atmosphere；global SKU 分別為 `F20E-7034-0EF7`／`120C-BEC3-B48F`，India 區域價表另有 SKU ID。Global 公開最高價 US$40／1,000 events（1,000 free cap），India 公開最高價 US$12／1,000 events（7,000 free cap）；地區帳戶適用性、額外費用與錯誤／timeout 計費未確認。價格表與 SKU 於 2026-10-08 重查，數值與 2026-10-07 D01 摘錄相同；Pro SKU 價格不得套用至目前完整 mask。

本機行為必須和候選設定分開：`api/places.ts` 的 helper 只呼叫其中一個 route、沒有自動重試／分頁，但 fetch 無 timeout signal；`query≤100`／2,048 B 限制由 configured boundary 的 validator/parser 強制，helper 本身沒有完整 query/body 上限。production `POST` 未配置 options，仍 fail closed；TEST_ONLY timeout／lease 不證明 production 接線。沿用既批准 D05 8 s execution＋5 s dispatch＋5 s settlement＝18 s lease 及 A=1，不重批。其後使用者已批准 `priceScale=5/4`、50,000 µUSD、7 日價表有效期**僅作本機候選／mock**，不是已證明的硬成本上界。2026-10-08 帳務補證見本節上方；operator 費用邊界與實際計費證據仍不足。T151、正式 live gate 不變。本前次查核未呼叫 API、未重跑測試、未改程式。

## 2026-10-07 T153 Phase B 本機方案（外部未執行）

本次僅補足 T153 Phase B 的可審閱方案與 IPC-only 本機 mock harness，不改 stack／production code／正式成本或 gate。選定既有 `createRedisSharedStore.reserve` → `REDIS_QUOTA_LUA` `operation: "reserve"` 首次 grant；兩個獨立 OS process 各自建立 client、各送一次相同 command。舊 `005-isolated-runner` 仍只由 parent 執行 ports；不得將其當成真實跨 process REST 證據。

具體 seed、既有 `REQUEST_EPOCH_KEYS` 七鍵 complete inventory、單次成功／unknown 分支的 REST 次數與每階段邏輯 command 算術、私密值 IPC 傳遞、exact cleanup 與目前 external blocker，統一以[runner 契約](contracts/isolated-local-runner.md#2026-10-07-t153-phase-b-既有reserve跨process方案本機mock完成外部未執行)為準。本機 mock 的兩 child 僅經 IPC 將 REST EVAL envelope 交給 Lua harness；沒有 socket、REST endpoint、Redis 或上游。它只證明各 process 確實各自發出一個 mock request，不能證明真 Redis atomicity。

必要驗收：結果恰一筆 `reserved`／`executionGrant: true` 與一筆 `duplicate`／`executionGrant: false`；只讀 `readUsage` 證明 day／week reserved 各等於一次 2,400 µUSD fixture 值；沒有 paid-upstream port。任何 reserve unknown 最多用同一 reservation identity 執行一次唯讀 `getReservation`；不重送異動，未明確收斂即停止並保留 inventory，不 cleanup。已知成功才對啟動前凍結的 7 個 exact keys 執行一次精確清理，並以一次唯讀 inventory 確認；cleanup unknown 不重送。

計數只列程式／Lua 可見 logical envelope，不是 provider metering 或費用上界；維持 `providerMetering: "unverified"`、`billableUpperBound: null`，既有 verified-metering gate 完全不變。因此本文件與 mock PASS 不授權外部 Phase B。T153／T154 父項、正式 gate 不勾選，T152 不重開。

## 2026-10-07 限定外部校準執行紀錄補記（本次現行）

本次營運者已批准並自行在互動式無回顯終端機執行既有獨立 caller，沒有改技術設計、caller、application code、秘密載入方式或 dependency。成功報告與前次 `secret_invalid`／零派送獨立紀錄、Console 人工前後觀測見[證據](../../docs/verification/005-local-implementation-evidence.md#2026-10-07-限定外部-redis-校準營運者執行與人工-console-證據)。

本次只支持 REST／Lua／TIME／marker／PTTL／exact cleanup 流程成功，不是跨 process 原子性或供應商計量驗證；`providerMetering: "unverified"`、`billableUpperBound: null`、業務 runner verified-metering gate 均不變。T153／T154 父項與 12 正式 gate 未完成，文件同步後停止，不啟動 Phase B 或部署。下方未授權外部執行的敘述為先前批次歷史，本次限定批准不延伸至其他操作。

## 2026-10-07 獨立 Redis calibration caller（本機技術決策）

不改 stack、不新增 dependency、不改 production code。新增 test-only `scripts/005-redis-calibration.mjs`（Node 內建 `crypto`／`fetch`／TTY）與 `.d.mts` 型別、`tests/api/redis-calibration.test.ts` mock 測試。caller 與 `runIsolatedBatches` 完全分離，業務 runner 的 verified-metering gate 不變；caller 預設 dry-run，僅接受 `--execute --plan-digest=<digest>`，秘密只由啟動後無回顯 TTY 輸入，固定 probe／write／verify／cleanup 四個單 key EVAL（≤4 REST、≤10 邏輯 commands），provider 計量標為 unverified、無計費上界。2026-10-07 的 13 commands／`27+2U` 校準提案改列歷史。細節見[runner 契約](contracts/isolated-local-runner.md#2026-10-07-獨立-redis-calibration-caller本機實作完成外部執行未授權)與[readiness](readiness-decisions.md#2026-10-07-本機校準-caller-與-unknown-語意收斂本次現行)。

## 2026-10-07 Free Redis 外部測試前置核對（本次文件同步）

本次沿用既有批准架構與 D14 runner／composition 契約，不重新規劃、不改 stack／schema／runtime／application code，也不新增 task ID。Redis adapter 的實際設定仍是顯式 `rest.url`／`rest.token`，runner 是 `runIsolatedBatches(plan, ports)` import API；`UPSTASH_REDIS_REST_URL`／`UPSTASH_REDIS_REST_TOKEN` 僅是未接線的既有 proposed names。repo 沒有 env loader、外部 CLI 或可信 usage reader，故安全設定限於日後另批 process-only parent injection，不建立 `.env.local`。

外部證據依序提案為單一批次校準（TIME、短 TTL Lua smoke、exact inventory cleanup），審查官方 EVAL／Free 計量定義與 usage 更新方式後，才另批雙 process 業務原子競態。現有 runner child 只做 IPC/barrier、network ports 在 parent 執行，故它不能單獨證明兩個 OS process 各自連 Redis；真實 T153 跨 process proof 還需要經批准的獨立 process caller／harness。包含外層 EVAL 與明列 nested Redis calls 的 13 個邏輯 commands 僅供無 read-region 情境校準估算，Upstash 未明示 EVAL 子命令計費；usage reads、read regions／replication 也未確認，故目前沒有可確認的 billable command upper bound，runner 不可啟動。禁止把此提案記作 real Redis PASS。

此新增只補 external evidence 前置與 stop conditions，不改既有技術決策。T152 維持結案；T153／T154 與 12 個正式 gate 未完成，六個 production 付費端點仍 `live:false`、speech 受阻。細節以[本次 readiness 決策](readiness-decisions.md#2026-10-07-free-redis-連線準備與外部測試前置核對本次現行)及[隔離 runner 契約](contracts/isolated-local-runner.md#2026-10-07-free-redis-process-only-設定與最小校準提案尚未授權執行)為準。

## 2026-10-07 D14 本機工具批准（現行）

本批已明確批准本機schema、TEST_ONLY composition、有界雙process runner、測試及直接文件同步，取代下方歷史「本機接線待批」的授權狀態，不重新規劃T152。沿用既有REST transport／Redis factories／openid-client及Node child_process；不新增dependency、不接production入口、不改runtime／成本值。詳細逐檔／介面／schema見[契約](contracts/isolated-local-runner.md)。

新增程式逐檔：`api/_lib/isolated-environment.ts`、`api/_lib/isolated-composition.ts`；runner的ESM實體及TypeScript介面為`scripts/005-isolated-runner.mjs`、`scripts/005-isolated-runner.d.mts`、`scripts/005-isolated-worker.mjs`。測試為三份`tests/api/isolated-*.test.ts`及合成`tests/fixtures/isolated-environment-fixture.ts`。只注入REST／OIDC替身、OS child環境白名單，不讀真實credentials；接線不自動publish或seed authority。既有Session／OIDC／epoch／cost檔案及所有production exports未修改。

Session以既有Redis SessionStore保存opaque ID並逐次lookup／revoke；不採Session HMAC輪替假設。四family為capability／fingerprint／oauth_state／rate，owner-scope沿既有fingerprint key version與domain。runner以父process可信ports管理兩個獨立child／client；本機跨process替身不證明真實Redis原子性。計量為每操作明列保守上界，外層EVAL＋內部commands＋replication規則由可信設定注入，不假設EVAL計1。總10,000／2h上限內先扣cleanup／usage／confirmation／uncertainty及時間預留；未知上界拒絕啟動。timeout／unknown不retry異動或退款／regrant，僅獨立唯讀確認。預設不提供外部啟動入口。

本批已完成本機工具與驗證：[最後證據](../../docs/verification/005-local-implementation-evidence.md)為78 targeted、163 strict files、build及113 files／1365完整回歸；0失敗／0跳過。不重開T152、不勾正式gate或T153／T154父項；沒有瀏覽器變更，因此未新增或重跑E2E。

## 2026-10-07 D01／D14 唯讀查核同步（本次現行）

已依批准完成官方公開資料及本機接線唯讀盤點，集中結果／日期／URL／不確定處見[既有決策包](readiness-decisions.md#2026-10-07-d01d14-唯讀查核與文件同步本次現行)，Safety及既存測試報告核對見[證據](../../docs/verification/005-local-implementation-evidence.md)。不另造規劃、不改架構／技術常數／程式／env／dependency、不重跑T152已結案測試。正式成本表仍六端點`live:false`，speech S1及12項未完成gate不變。

Places兩route固定七欄位均選Enterprise + Atmosphere；公開US$40／1,000 events只是全球基價，未核定帳戶成本或50,000 µUSD預留。Google純`openid`的Testing例外表示test-user名單不是隔離保護；Vercel首次新project deployment為production，不能直接套「專用project即Preview」；Node20自2026-10-01不接受新部署，不能沿用較舊版本清單。下一批須先由owner確認帳戶身分／免費資格／剩餘量／存取控制／deploy target及runtime，衝突透過原批准流程調和，不能據此自行加scope、改登入契約或runtime。

必要本機工作僅列清單：隔離environment schema／四keyring及可信floor、既有factories的TEST_ONLY server-side composition、有限先導／雙writer／計量及cleanup runner；現有env名稱與local adapter不等於完整composition。namespace應傳helper允許的`{preview-<random-id>}`，不直接傳歷史`tokyomate:{preview-<random-id>}`。真實Redis EVAL／TIME／TTL／restore、Linux sharp／libvips artifact及Google callback仍待T153／T154和T149／T150部署子範圍；資源／秘密／implementation／付費／部署各自另批，US$0批次尚不可啟動。

## 2026-10-07 Epoch 本機實作方案與批准界線（本輪現行）

**本機接線完成**：沿既有同hash-tag的authority／issuance與原reserve EVAL，原子更新grant、unused及本人accounting index；正常輪替重送使用原fingerprint version與pinned cost。可信composition可publish已載入key的UTC current／next；由authority TIME切換，缺next新簽發503、不生成epoch。lifecycle factory限`scope:TEST_ONLY`，可信evidence port不可由HTTP提交布林偽造；管理命令／audit同slot，沒有正式排程或secret操作。詳見[契約接線](contracts/request-epoch-and-key-lifecycle.md)與[實跑證據](../../docs/verification/005-local-implementation-evidence.md)。

本輪已批准 E01～E10 推薦方案供本機 application、隔離測試、UI及文件實作；不得新增database／router／queue／service／dependency，沿既有同slot Redis authority、Node crypto、authenticated本人入口及transport接縫。本機測試以TEST_ONLY memory／Lua替身，不得宣稱真實Redis原子性。簽發unknown僅原命令、同入口手動確認；不補簽、不延長expiry、不自動付費重送。完整介面與推薦參數見[契約§9](contracts/request-epoch-and-key-lifecycle.md#9-e01e10-完整推薦決策包2026-10-07唯一集中答案)。

E07 30天保存參數必須可注入、可測；正式清除須先具備帳單／爭議窗口證據、可信retirement barrier、全部引用歸零與restore／rollback防護，缺證據只拒絕或dry-run。E08／E09用單一可信管理者分步操作；每步後端重新驗權、核對操作ID／冪等／理由／必要證據並寫audit event，不要求第二管理者，人工review結束不代表帳務結案。E09正常輪替週期90天只作本機批准參數；不得生成／輪替正式key，舊key不可僅按週期刪除。

未批准項目仍包括外部服務／帳戶操作、正式秘密、付費呼叫、正式key輪替／資料清除、legacy cutover／排程啟用、Preview／正式部署、模式切換及D01 production價表／成本或輸出上界。production六付費端點維持 `live:false`、speech受阻。restore／rollback缺獨立可信manifest與最低generation證據即拒絕；不得以舊backup自行證明未倒退。

已批准語意與 [Spec](spec.md) 一致：signing key降verify-only後，不可新簽capability，但已簽發且仍有效、未grant的舊capability，在本人Session／資格／限流／成本／epoch authority／原子首次grant全部成立時可首次執行。首次fingerprint綁定使用當時current fingerprint key；已有操作依原version及原cost binding比較，verify-only fingerprint不能建立新binding或二次grant。洩漏撤銷／retired拒絕新grant，不撤回原used／uncertain占用或保守結算。

T152的E01～E10本機子範圍已依原批准、文件同步及限定Analyze完成逐phase實作；本次只核對T155～T161既存證據並依原Task定義結案本機父任務，不重新規劃或重複批准。實作沿用T019／T138共享原子authority、T139／T140指紋／pipeline、T141錯誤／T142本人查詢接縫。T153／D14所需真實跨instance及restore證據仍屬正式Readiness gate，不屬T152完成條件，也不得由本機測試冒充。正常輪替未grant舊capability首次成功、第二grant為0、撤銷／退役兩順序與原窗口守恆的本機證據見[契約§10](contracts/request-epoch-and-key-lifecycle.md#10-本機實作驗收矩陣本輪執行真實服務項仍未驗)。D01／D14下一批操作只補充[既有決策包](readiness-decisions.md#2026-10-07-t152-文件結案與下一批批准界線本次現行)，不變更架構或授權外部／付費／Preview部署。

## 2026-10-07 D13 現行本機技術接線與授權

指定 `openid-client@6.8.8`、`sharp@0.35.5` 已獲本機安裝／接線／測試批准；`jose@6.2.12`／`oauth4webapi@3.8.8` 只作 lockfile transitive＋scoped overrides，程式未直接 import，故不列直接 dependency。不改 `engines`、runtime 或 framework。`sharp` 的必要傳遞依賴及 Windows optional packages 依 registry／npm 實際結果見 [證據](../../docs/verification/005-local-implementation-evidence.md)；先前「無一般 JS dependency」是歷史查證錯誤。

新增 [openid-client binding](../../api/_lib/openid-client-binding.ts) 接既有 OIDC adapter／flow：採一次 combined exchange＋verify port，避免拆開 code grant 迫使手動解 JWT；保留原 mock port 供既有回歸。library discovery／URL／PKCE／state／nonce／ID token claims 與 `enableNonRepudiationChecks` JWKS crypto 同一操作。discovery metadata 與出站 URL 固定可信 Google endpoint；每操作獨立 config／abort，沒有跨請求可變 transport 或隱性 JWKS cache，timeout 沿既有 config，無自動 code retry。`maxTokenAgeSeconds`／token bytes／code bytes／algorithms 仍由可信 port 明列，不採舊 D13 候選數字為正式預設；library clock tolerance 為零並保留 adapter exp／iat 即時核對。預設 auth exports 不接正式 secret／帳戶。

[Sharp verifier](../../api/_lib/sharp-image-verifier.ts) 由本機 composition 的 `createLocalImageVerifier()` 注入既有 `images.verify`：既有 3 MiB、單頁、JPEG／PNG／WebP、真實尺寸≤2048；像素≤2048²、4-channel raw buffer≤16,777,216 B 均由尺寸上限推導，不是新產品參數。`failOn:warning`／sequential read／保留原生安全限制／native timeout 沿本機既有 store deadline；metadata 只先拒絕格式／頁數，必須完成 raw 解碼才成功，不存圖、不呼叫 vision。PNG 額外檢查完整 chunk envelope 與 APNG chunks，避免 decoder 只讀第一幀冒充單頁。

D01 只補共用 builder 最大合法 Unicode／跳脫／±1／未知 model 拒絕證據；不改價格、token 估算或 output cap。D07／D08 的 [完整 epoch 草案](contracts/request-epoch-and-key-lifecycle.md) 不成為技術常數、schema 或清理程式。Vercel runtime／architecture、Linux bundle、cold start、部署大小及 LGPL 發佈檢查未驗，只阻擋部署；本機 Windows tests／Vite build 不等於 Vercel serverless 驗收。六端點 `live:false`、opaque Session lookup、speech 受阻、外部及部署 gate 不變。

下方所有較早「目前／本輪／最新」工程描述是該批歷史；授權與實際狀態以本節、[Tasks](tasks.md)、[決策包](readiness-decisions.md) 及最新證據為準。

**Branch**: `master`（`005-api-protection-access-modes` 僅為規格目錄；本階段不建立或切換 Git branch）  
**Date**: 2026-09-25  
**Spec**: [spec.md](./spec.md)  
**狀態**: Technical Plan 架構與初始額度已核准；本機E01～E10依本輪批准實作。外部服務實際啟用、Geoapify付費升級、正式站模式切換與部署仍待獨立批准。

本 Plan 以本機最新版 `spec.md`、`ux-ui-design-handoff.md` 與 `checklists/requirements.md` 為準。此前草案允許 Public 使用付費 API、匿名付費 Session、全站軟／硬停止、只停部分端點，以及 Geoapify A／B 待決的內容，均已撤回，不得作為現行技術政策。

**2026-10-07 決策批准同步與本機實作（本次最新）**：§0已同步本次明列批准子範圍，沿用L1～L5；本機成果與限制以[Tasks最新狀態](tasks.md)及[最新實際證據](../../docs/verification/005-local-implementation-evidence.md)為準。最終95 files／1137 tests、strict型別、build及12隔離E2E通過；D01／D07／D08等未決事項只停止相關子範圍。下列「本輪」「最新」標籤是歷史批次，不覆蓋本次批准；005／真實服務／部署非READY。

**2026-10-06 本輪狀態優先說明**：七檔隔離驗收已結案；本輪只收斂 P-G1／P-G2、同步文件與限定 Analyze，不修改程式或重跑歷史測試。現行剩餘路線與按範圍 Readiness 以 §14 為準；§13 的「不得修改核心介面」僅是已結案七檔批次限制，不限制日後另獲授權的原子 G 工作。A6 六列已批准；既有架構、兩級額度、週追加、圖磚初始控制不需重新批准。

**2026-10-06 L1～L5 本機 Implement 執行狀態（最新）**：使用者已明確批准本機連續實作，並確認保留 12 項未完成 checklist。本輪已修改相關程式與測試；上述「只做文件」是前批歷史，不是本輪授權。已完成的子範圍、實際命令與未完成工作見 [本機證據](../../docs/verification/005-local-implementation-evidence.md) 及 [Tasks 執行紀錄](tasks.md#l1l5-本機-implement-執行紀錄2026-10-06)。功能 005、真實整合與部署仍非 READY；未安裝、連外啟用、設定正式秘密、提交或部署。

上述為 Plan 初始階段紀錄；後續階段狀態以各自執行紀錄為準。`plan.pdf` 保留為未追蹤檔案，但不是正式 Plan 來源。

**歷史：2026-10-07 剩餘條件提案同步（批准前）**：D13 精確 package versions／license／transitive dependencies、實際 Vercel runtime 待證要求、接線範圍及 D14 操作隔離見[決策包](readiness-decisions.md)及 [Research R15](research.md)。本段的安裝／runtime gate 已由本文件現行D13節限定為部署gate；D01成本與D07／D08新保存／epoch值仍未批准，speech S1、六端點`live:false`不變。

**2026-09-25 第三次修訂（週追加政策，營運者已核准）**：營運者核准本 Plan 建議之整體架構，但修正週追加政策：追加次數與累計金額改由管理者對指定使用者、指定週逐次決定，不設固定次數上限，亦不設累計金額之倍數上限；每日上限仍獨立有效。本次修訂取代 §5.2 舊草案之「每週最多一次 active 追加」與「單次／累計最多 1× base weekly limit」設計（見 §5.2／§5.3 全新內容）。本次同步 `spec.md`、`ux-ui-design-handoff.md`、`checklists/requirements.md`、`plan.md`、`data-model.md`、`quickstart.md` 與 `contracts/admin-dashboard-contract.md`、`contracts/error-and-quota-contract.md`；後續 Tasks 與 Analyze 狀態以本文件開頭及 §12 的現行標籤為準。

**2026-10-06 修訂（六端點成本上界與 Readiness 再審）**：新增 §4.2（六端點成本上界、公式、數值、官方來源與最壞情境試算）、§4.5（「額度不可用」權威定義與圖磚 gate 關係）、§7（靜態示意圖資產交付項 D1–D5）、§10.3（已核准架構與待授權動作分離、待核准決策 A1–A7、mock-first 範圍、外部證據清單）；改寫 §3.2 第 5／6 步與 §3.5、§6.3 第 5 步、§6.7。未修改 application code、未安裝套件、未建立外部資源。§4.2 數值為**提案**，未經營運者核准前 Readiness Gate 維持 BLOCKED。

**決策同步（本機系統日期 2026-10-06；規劃層級核准，非實作授權）**：營運者已**規劃核准** A2（停用 OpenAI SDK 自動重試，A＝1）、A8（G-B，只納入有可信成本上界且實際啟用的端點）、A9（speech 維持受阻＝S1，僅可 mock）、A10（transcribe＝P1 固定格式 PCM WAV）。已同步 §4.2.1、§4.2.3、§4.2.4、§4.2.6（新增：A＝1 呼叫鏈核對）、§4.5、§10.3。核准內容**只涵蓋方案方向**，三類狀態分開記錄：（一）**數值待核准**（A1、A3、A4、A5、A6 的數字與文案）；（二）**前提待證明**（上界前提、byte≥token、tile 8、`maxRetries: 0` 實際生效、P1 後端驗證完整性）；（三）**外部整合待驗證**（真實瀏覽器 16 kHz PCM、供應商 usage／帳單、帳戶預算）。被取代而**撤回**的選項（A＝3、G-A／G-C／G-D／G-E、S2–S5、P2–P4）不再列為待決。第一批 mock 實作範圍見 §10.3.5。

**2026-10-07 修訂（已批准防護政策同步，非實作授權）**：新增 §10.4 與 §1.1 對 FR-049～FR-056／SC-013～SC-017 的追溯，記錄統一 503／409 外顯、可信成本 registry、逐端點 lease、uncertain 清理／對帳、HMAC／資料最小化與資格優先等實作約束；T019 維持部分完成、T135 未執行、production 六端點 `live:false`。本輪只修改 005 文字文件並執行唯讀 Analyze，不改程式、不執行應用程式測試、不提交或部署。

---

## 0. Repository Safety Guard

### D10／D11 最新批准本機執行（2026-10-07）

先同步正式文件再Implement→Run→Verify→Fix。沿用Session factory／Redis atomic transport／有界reader／共享固定窗口limiter／同slot admin-reviews與quota users；本人store擴充同authority enqueue／withdraw／lookup，不另建資料服務。HTTP factories預設未配置fail-closed，不接正式secret／Redis／OIDC。清單owner filter＋reviewId排序後，HTTP按完整UTF-8 JSON信封實測≤65536，nextOffset以實際items數續頁，單筆超限503。管理審核識別withdrawn與舊週top-up；再申請paid_access可審核未核准／撤銷／到期狀態，保留原expiresAt不偷偷延長。前端獨立手動本人入口、共用typed client，不新增Router／dependency。不重審已結案批次；D01／07／08／13／14維持受阻。

### 2026-10-07 本次決策同步

本次沿用L1～L5實作授權，批准集合以[readiness-decisions](readiness-decisions.md#2026-10-07-決策批准同步優先於原提案表)為準，不把原提案表整列批准。D02／03／04／05／06與D12／16／17明列參數可作本機共用policy；D09只UI30秒，不改registry效期。D10／11只方向，具體新增契約仍待審。舊§4.2之24100與相關成本數字不是可信核定上界；完整上游文字須由相同builder量測，影像decoder與token／價格證據未定前不解除成功管線。

OAuth清理使用可注入單次EVAL，Redis TIME只刪expiresAt≤now；ZRANGEBYSCORE LIMIT硬限制實際處理筆數，每批移除已處理的expiry index成員後重新查詢續跑，不使用cursor或把SCAN COUNT提示當硬界線。不新增scheduler。Session24小時絕對期限、過期後24小時清除，retention不自撤銷日起重算。D07／08保存／防重放與key退役不可拆開採設定，詳見待審生命週期。

限流共享原子固定60秒窗口，後端authority時計、可信Retry-After與當前窗口加60秒緩衝；不同付費端點共享admission／subject桶。入口只能由可信port提供，不採client IP Header；HMAC版本／secret生命週期與平台來源取證未決，不接正式factory。固定窗口交界短時間最多可通過兩窗口額度，不宣稱sliding-window保證。

### 0.1 本輪政策批准與 implementation gate

本輪批准來源為使用者訊息「Tokyo Mate 功能 005 — 已批准政策的 Specification Sync」之「已批准政策」第 1–8 項：503 對外統一 `PROTECTION_SERVICE_UNAVAILABLE` 且不洩露內部原因；兩種 409 採指定 code／文案、不得自動重送或重新授予執行權，狀態查詢方式待契約；可信後端 registry 驗證價表版本／有效期／live／封鎖／端點適用性並自行估算，production 六端點維持 `live: false`；lease 依端點最長執行時間加結算緩衝且本輪不定秒數；冪等清理與對帳、store timeout fail-closed、到期轉 uncertain 並保留、不退款不重放；uncertain 保留原日／週窗口、晚到結果只記錄且不自動退款；伺服器金鑰 HMAC、`estimateInputs` 僅明列數值／列舉欄位，資料期限與金鑰輪替待決；每次先驗證目前身分／資格，撤銷者即使重複請求仍回 403 且不洩露原預留。

這項批准僅授權本輪修改 005 規格文件及執行唯讀 Analyze。精確限制原文：「本輪只修改指定規格文件，不修改程式、不執行 T135、不接線 handler、不提交或部署。」

Repository implementation gate 的來源與原文：
- `.github/copilot-instructions.md` §Implementation Authorization：「只有在使用者明確批准進入 `/speckit.implement`，且已完成 `/speckit.analyze` 與 Implementation Readiness Gate 後，才可依已批准的 Specification、Plan 與 Tasks 修改 application code。」
- `.specify/memory/constitution.md` §XI Authorization Boundary：「Specify、Clarify、UX/UI、Plan、Checklist、Tasks、Analyze 階段本身皆不構成 implementation 授權。只有在 `/speckit.implement` 已通過 Implementation Readiness Gate，並取得成人教育者明確批准後，才可依已批准的 Specification、Plan 與 Tasks 修改 App implementation。」
- 因此本輪不屬於 `/speckit.implement` 授權，不得開始任何程式修補。

- **Root**: `C:/Users/geste/spec-kit/tokyo-mate`
- **Branch**: `master`
- **Remote tracking**: `origin/master`，目前分支顯示 up to date
- **開始 Git 狀態（2026-09-25）**: 已追蹤檔案無 staged／unstaged 變更；`specs/005-api-protection-access-modes/` 整體為 untracked
- **本階段允許寫入**: 僅 `specs/005-api-protection-access-modes/{plan.md,research.md,data-model.md,quickstart.md,contracts/*}` 與必要 Plan 階段文件
- **本階段禁止且未執行**: 修改 `spec.md`、UX handoff、checklist、`api/`、`src/`、`public/`、dependencies、環境變數、部署設定；刪除或覆寫未追蹤 `plan.pdf`
- **2026-10-06 本輪（成本上界與 Readiness 再審）**: 開始 Git 狀態為 `master`、HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`、僅 `specs/005-api-protection-access-modes/` untracked；允許寫入僅限功能 005 文件（spec／UX／checklist／plan／research／data-model／quickstart／contracts／tasks／analyze-report）；未修改 `api/`、`src/`、`public/`、dependencies、環境變數、部署設定，`plan.pdf` 保留。上一行「本階段禁止修改 `spec.md`、UX handoff、checklist」僅適用 2026-09-25 Plan Checkpoint。
- **Spec Kit 技能核對**: 已讀取 `speckit-plan` 技能；本輪不重新執行 `setup-plan.ps1`，避免在已存在文件上造成不必要 churn；`.specify/extensions.yml` 先前已記錄不存在，無 plan hooks 可觸發

### 0.2 本輪 Repository Safety Guard

- Root：`C:/Users/geste/spec-kit/tokyo-mate`；remote：`origin https://github.com/gestertim/tokyo-mate.git`；branch：`master`；HEAD：`3afb239a37cfe905e3100be83739671c0dde0e75`。
- Index 為空；開始時 tracked 檔無 staged／unstaged 變更。開始時全部 untracked 項目已識別並保留：`api/_lib/{audio-pcm.ts,cost-estimators.ts,cost-price-table.ts,quota-engine.ts,quota-fingerprint.ts,quota-threshold.ts,quota-validation.ts,quota-window.ts,shared-store.ts}`、`tests/api/{audio-pcm.test.ts,cost-estimators.test.ts,quota-reservation.test.ts,quota-threshold.test.ts}`、`tests/fixtures/cost-price-fixtures.ts`、`tests/support/in-memory-shared-store.ts`，以及 `specs/005-api-protection-access-modes/` 內既有所有文件（含 `plan.pdf`）。
- 本輪可寫入範圍限於 `specs/005-api-protection-access-modes/` 文字文件；不修改 `.git/`、`.github/`、`.specify/`、application code、tests code、環境／部署設定、套件或 `plan.pdf`，不 add／commit／push／deploy。
- 本機指引 `.github/copilot-instructions.md`、Constitution `.specify/memory/constitution.md` 與已安裝 `.github/skills/speckit-analyze/SKILL.md` 已核對；`.specify/extensions.yml` 不存在，無 before/after analyze hooks。
- 結束狀態複查：root、origin、`master` 與 HEAD `3afb239a37cfe905e3100be83739671c0dde0e75` 未變；index 空、tracked 檔無差異。既有 untracked mock／測試與整個 005 規格目錄均保留；僅 005 文字文件為本輪寫入範圍，`plan.pdf` 未改。

## 1. Canonical 對照與撤回政策

### 1.1 FR／SC／UX 到 Plan／Contract 追溯

| Canonical 要求 | UX 對應 | Plan / contract 對應 | Checkpoint 狀態 |
| --- | --- | --- | --- |
| FR-001～FR-008：六端點後端強制、Public／未核准不得觸發上游、登入不等於核准 | 本階段邊界、權限矩陣、功能矩陣 | 本 Plan §3；[contracts/protected-endpoints.md](./contracts/protected-endpoints.md) | 架構已核准；待 Implement 授權與隔離驗證 |
| FR-009～FR-023：兩級每位使用者日／週額度、原子預留、結算、Asia/Taipei 重置、額度顯示 | 額度呈現規則、日與週額度表 | 本 Plan §4；[contracts/error-and-quota-contract.md](./contracts/error-and-quota-contract.md)；[data-model.md](./data-model.md) | 架構與初始額度已核准；待 Implement 授權與隔離驗證 |
| FR-024～FR-030：401／403／429／503 區分、PWA `/api/` 不快取、日誌最小化、正式站另行批准 | 日與週額度狀態表、登入／PWA 與可及性 | 本 Plan §3.5、§8；contracts 全部 | 技術契約已核准；正式站事項維持獨立 gate |
| FR-031～FR-042：獨立管理者儀表板、逐請求管理權限、追加／撤銷可稽核、防 CSRF／防重複提交 | 管理者儀表板專章 | 本 Plan §5；[contracts/admin-dashboard-contract.md](./contracts/admin-dashboard-contract.md) | 架構已核准；真實管理者 subject 與環境設定待獨立批准 |
| FR-043～FR-048：Geoapify 方案 A、圖磚代理、受限狀態零圖磚與零 `/api/places`、靜態示意圖資產 | 靜態東京風格示意圖、實作階段驗收 | 本 Plan §6（含已同意之圖磚代理架構）、§7；[contracts/map-access-contract.md](./contracts/map-access-contract.md) | 架構與初始限額已核准；付費升級、實際帳戶設定與正式資產待獨立批准／交付 |
| FR-049～FR-056、SC-013～SC-017：保護服務錯誤外顯、冪等重複／衝突、可信成本 registry、逐端點 lease、uncertain／對帳、HMAC 與資格優先 | UX handoff 的 409／503 狀態表與非成功承諾提示 | 本 Plan §3.2、§3.5、§4、§10.4；contracts/error-and-quota-contract.md、contracts/protected-endpoints.md；data-model.md §5、§14～16 | 政策已核准並同步；實作與測試待做，Redis/Lua 與保存／金鑰細節待證據或決策 |
| SC-001～SC-003：六端點拒絕、兩級額度、錯誤語意可驗收 | 實作階段驗收候選 | [quickstart.md](./quickstart.md) | 待 Implement 後驗證，不得標 PASS |
| SC-009～SC-010：管理者資料與操作權限 | 管理者儀表板權限驗證 | [quickstart.md](./quickstart.md)、admin contract | 待 Implement 後驗證，不得標 PASS |

### 1.2 舊 Plan 撤回清單

以下內容在本 Plan 中全部撤回；若舊文件或草稿有相反敘述，以本節為準並視為需修正殘留：

- `Public` 或未登入訪客可在「額度內」成功呼叫六個付費 API。
- 匿名付費 Session、匿名 Session 付費額度、匿名 Session 核發頻率作為付費 API 控制。
- `Public`／`Invite-only` 二元模式中 Public 仍有付費正向流程。
- US$3／US$5 每日、US$50／US$80 每月的全站軟／硬停止。
- 只停止四個高成本端點、保留部分端點繼續付費呼叫的軟停止。
- 「初版不需要會員管理後台」或不建立管理者儀表板。
- Geoapify 方案 A／B 待決；最新 canonical spec 已核准方案 A。
- 以 CSS 隱藏、前端旗標或已初始化 map 元件作為受限狀態零圖磚請求證明。
- 「前端 gating 為 best-effort、Geoapify 直連架構維持不變」的舊結論；本 Plan 已改採後端圖磚代理（見 §6）作為已同意架構方向。
- 週追加「每週最多一次 active 追加」與「單次／累計金額最多 1× base weekly limit」的固定上限設計；2026-09-25 已由營運者核准修正為管理者對指定使用者、指定週逐次決定金額與次數，不設固定次數或累計倍數上限（見 §5.2／§5.3）。

## 2. Technical Context

**Language / runtime**: TypeScript、React、Vite、Vercel Serverless Functions，沿用既有 stack。Node runtime 版本目前未於 `package.json` 鎖定，若新增 OIDC／KV client，需在 Checkpoint 決定是否加 `engines.node`；這是技術相容性提案，不是本階段變更。

**既有付費端點**: `POST /api/assistant`、`/api/transcribe`、`/api/places`、`/api/speech`、`/api/photo-ocr`、`/api/photo-translate`。現況只讀核對：六者目前未實作本功能的身分、核准、額度或原子預留。

**既有地圖現況**: `src/features/nearby/NearbyMap.tsx` mount-only effect 立即呼叫 `L.map(...)`、建立 Geoapify `L.tileLayer(...)` 並 `addTo(map)`；`src/screens/NearbyScreen.tsx` 在 `!loading && !error` 時即掛載 `NearbyMap`，即使 `places` 為空也會初始化圖磚層。

**已核准架構能力（仍須另取得 Implement 授權；真實外部啟用分開批准）**:

- Google OAuth/OIDC + 自管 opaque Session；真實 OAuth app、callback domain、secret 與新增套件安裝仍待獨立批准。
- Upstash Redis-compatible shared store 架構，用於 Session、核准資格、每位使用者額度、預留／結算與管理稽核索引；真實 resource、region、budget、credential 與套件安裝仍待獨立批准。
- 獨立管理者儀表板資料與操作 API。
- 地圖資格狀態查詢與靜態示意圖資產整合；正式資產尚未交付。

**Constitution gate**: Authentication、shared backend state、新 dependency、外部服務啟用、正式站切換均需 approval gate。本 Plan 只提出方案，不安裝、不啟用。

## 3. 六個付費 API 後端控制架構

### 3.1 Public 與登入狀態政策

- Public 只可使用不呼叫六個付費 API 的公開功能：App Shell、東京百科、旅遊日文、公開 MP3、icons、manifest、既有公開資料。
- 完成註冊或登入不等於付費 API 核准。
- 未登入或 Session 無效：六個付費 API 回 `401 AUTH_REQUIRED`，不得呼叫上游。
- 已登入但未核准、資格撤銷、資格到期：六個付費 API 回 `403 ACCESS_NOT_APPROVED`，不得呼叫上游。
- 已核准但日／週額度不可用：六個付費 API 回 `429 DAILY_QUOTA_EXHAUSTED` 或 `429 WEEKLY_QUOTA_EXHAUSTED`，不得呼叫上游。

### 3.2 共用保護 Pipeline

六個端點共用單一 server-side helper 或 middleware-like helper；不得由前端判定授權。

1. Method 檢查：非 `POST` 回 `405 METHOD_NOT_ALLOWED`，不解析 body。
2. 解析前大小預檢：使用 `Content-Length` fail-fast；缺失時仍以 bounded read 或平台限制保護。
   - **2026-10-06 文件核准澄清**：大小預檢後、Session 前加入匿名 admission 入口限流（429；故障 503），Session／有效資格後加入已登入者限流。兩者均須通過才可繼續；入口 key 只能來自可信伺服器 transport context，不信任 IP／代理 Header。不是匿名付費授權或匿名付費額度，正式值／adapter 待核准。
3. Session 查驗：讀取 HttpOnly cookie 內 opaque `sessionId`，每次查 shared store；查無、過期、登出皆為 401。
4. 使用者核准資格查驗：每次以可信 identity subject 查詢 Approval Record；非 `approved` 或 expired/revoked 皆為 403。
5. 有界解析與完整輸入驗證後才估算：先檢查語意／格式及端點輸入／輸出／時長／影像邊界，再由可信後端從已驗證內容產生估算量，依 §4.2 registry 計算 `R_e`；客戶端 `estimateInputs` 不具成本權威。任何限制不成立、模型不在白名單或無法建立可信上界，皆在此步以 `413`／`400`／`503` 拒絕，不預留、不呼叫上游。所有可能拒絕請求的輸入驗證須在預留前完成（2026-10-06 使用者批准之文件順序澄清，未改任何上限）。
6. 日／週原子預留：同一原子操作同時檢查並預留日額度與週額度；任一不足即拒絕且不呼叫上游；429 回應須依 §4.5 標示 `quotaScope`（`request` 或 `all`）。
7. 核對原子回傳、可信時間與 lease；只有首次有效 `executionGrant` 可往下執行。不能把新順序誤解為省略 engine 的回傳驗證，拒絕／未知結果不退款、不重授權。
8. 上游單次呼叫（本次提出之隔離子範圍只使用 mock，不接既有 handler）。
9. 呼叫後結算：成功、明確未計費失敗、逾時、不確定是否計費各依 §4.4 規則處理。

### 3.3 可信身分、管理者身分與 Session

- 推薦 OIDC Authorization Code + PKCE；callback 成功後由後端建立 app-owned opaque Session，不直接用供應商 token 當 Session。
- OAuth 暫存 cookie 使用 `HttpOnly`、`Secure`、`SameSite=Lax`、短效、單次有效；避免 callback 跨站頂層導覽收不到 `state`。
- App Session cookie 使用 `HttpOnly`、`Secure`、`SameSite=Strict`；有效性仍以 shared store 每次查詢為準。
- 管理者身分不可來自前端 `role`、request body 或 localStorage。Checkpoint 建議選擇其一：
  - **方案 M1（推薦）**：server-side allowlist 環境變數或 Vercel protected env，列出 OIDC subject；優點是最小依賴、不可自助提權；缺點是變更需部署或環境設定流程。
  - **方案 M2**：shared store 中的 Admin Principal Record，只能由既有管理者或 out-of-band maintenance script 異動；優點是可稽核且不需 redeploy；缺點是 bootstrap 與防誤操作較複雜。
  - **方案 M3**：OIDC provider group/claim；優點是集中管理；缺點是 provider-specific，且必須驗證 claim 來源不可由使用者自行修改。
- M1 已核准作第一版 bootstrap，並在資料模型保留遷移至 M2 的空間；真實管理者 subject 與環境設定仍待獨立批准。

### 3.4 Shared Store 與 race-safe 操作

推薦單一 Redis-compatible shared store，因 Vercel 官方 storage 文件將 Marketplace key-value stores 用於 session storage 與 rate limiting；實際 provider-specific 價格與限制仍待批准。

原子預留必須由單一 Lua script、transaction 或 provider 原子 primitive 完成：

```text
input: userId, endpoint, estimatedCostUpperBound, dayWindow, weekWindow, idempotencyKey
read: approval tier, daily used/reserved, weekly used/reserved, weekly top-up records
check: status active, day remaining >= estimate, week remaining + active top-up remaining >= estimate
write: reservation record + daily reserved += estimate + weekly reserved += estimate
return: allow/deny with authoritative quota snapshot
```

不得以「讀取目前值 → application 判斷 → 寫回」跨多次網路 round-trip 達成額度控制；那會在 serverless 併發下放行共同花用同一筆餘額。

**審查修補 R1（2026-10-06，僅 mock 契約；真實 adapter 未完成）**：

- **資格、等級與週追加由 store 原子判斷**：`reserve` 指令只帶營運設定的 `tierLimits`（兩個等級的日額度與週基準）與窗口 key；store 在同一原子操作內讀取資格（status／tier／到期）與當週 active 且未到期的追加，計算 `dayLimit`／`weekLimit = 週基準 + 追加加總` 再預留。呼叫端不得先讀追加再以舊值預留。追加、撤銷與新預留由 store 線性化：撤銷之前已成功的預留不追溯作廢；撤銷之後的新預留一律看到較低上限；追加於該週結束（下週一 00:00，Asia/Taipei）自動失效。
- **一次上游執行權**：`executionGrant: true` 只存在於「建立預留」的那一次原子操作。同一冪等鍵同一請求指紋再次提交一律為 `duplicate`（`executionGrant: false`，引擎回 409 `DUPLICATE_REQUEST`），不論原預留為 reserved、settled、released 或 uncertain；lease 到期、跨日跨週也不恢復執行權。同一冪等鍵但內容不同為 `idempotency_conflict`（409 `IDEMPOTENCY_CONFLICT`），store 記錄 `conflictCount`／`lastConflictAt`／`lastConflictFingerprint`，不預留、不放行。
- **請求指紋**：SHA-256（identity、endpoint、金額、價表版本、排序後 estimateInputs、內容摘要）；只保存雜湊，稽核資料不含完整對話、音訊或圖片。
- **價表版本與有效期**：`CostPriceTable` 具 `effectiveFrom`／`expiresAt`（半開區間 [from, until)）；預留時引擎以時鐘檢查，無效時記錄內部 `reason: COST_MODEL_INVALID`，對外回 503 `PROTECTION_SERVICE_UNAVAILABLE`；production 價表為空區間且全 `live: false`。
- **執行期驗證**：引擎驗證 endpoint、身分、金額（安全整數）、冪等鍵、指紋、價表、store 回傳的 reservation／usage／limits（與營運 tierLimits 比對）；加總與餘額以 BigInt 計算，無效狀態一律 503 `INVALID_STORE_DATA`，不產生成功快照。
- **結算高於預留**：如實計入 `used`（不截斷）、記錄 `overrunMicroUsd`、將該價表版本加入 store 封鎖集合，之後該版本的新預留以內部 `reason: COST_MODEL_BLOCKED` 拒絕，對外回 503 `PROTECTION_SERVICE_UNAVAILABLE`；需發布並重新確認新版價表才能放行；不宣稱可追回已發生的上游費用。success 結算須帶 `costModelVersion`，與預留版本不同時保守按較高者。
- **預留 lease（中斷政策）**：每筆預留具 `leaseExpiresAt`。逾 lease 後才回報結果，store 原子轉為 `uncertain`（餘額保留、不退款、不重放，回 409 `RESERVATION_LEASE_EXPIRED`）；`expireLeases` 只做同樣的轉換。`uncertain` 之後才到的成功／失敗只記 `lateOutcomeObserved`，不改餘額；任何自動退款或人工處置機制屬後續批次。
- 以上於測試僅由記憶體 mock（單執行緒同步區段）驗證，**不等同 Redis／Lua 原子性證據**；T019 的 Lua／transaction adapter 與連線仍未完成。

**本輪政策同步之現行規則（取代上方 R1 舊措辭，不等於 mock 已符合）**：上方 R1 段落中的 `COST_MODEL_INVALID`、`COST_MODEL_BLOCKED` 等名稱只描述當時 mock／引擎的內部原因，不是對外 response code；所有成本模型內部原因的外部映射依下列統一規則。

- R1 所述 SHA-256 指紋僅是既有 mock 的狀態，不符合現行政策；正式契約改為伺服器持有金鑰 HMAC，`estimateInputs` 改採端點欄位 allowlist，只准數值與明列 enum。保存期限與金鑰輪替待決，不建立 key。
- cost registry 必須由後端持有與選擇，估算值由可信估算器產生；驗證版本、有效區間、端點、`live`、封鎖狀態與核准證據。呼叫端不得傳入可改變金額／版本／live 的權威值。production 六端點保持 `live: false`。內部成本錯誤外部統一映射至 `503 PROTECTION_SERVICE_UNAVAILABLE`。
- lease 僅依端點最長執行時間加結算緩衝；不得使用固定 120 秒作為所有端點設定。本輪不核定秒數。到期清理與對帳需冪等、可重複執行並保留原窗口；排程／觸發留待後續，不在本輪建立服務。store timeout 結果未知，不釋額、不重送上游。
- 重複結算需對照原金額與 transition／reason 語意；異同不符不得回 `already_applied` 成功。超額需能查驗原預留、實際結算、超額值與封鎖版本。晚到結果只記錄，`uncertain` 不退款且保留原日／週窗口。
- 目前 pipeline 順序必須先驗證當前 Session 與資格，再向外回應冪等重複／衝突；撤銷者回 403，不揭露 reservation 資訊。兩種 409 的外部文案依 `contracts/error-and-quota-contract.md`，不暗示成功、不自動重送、不重新授予執行權。
### 3.5 HTTP 錯誤語意

| HTTP | code | 適用情境 |
| --- | --- | --- |
| 401 | `AUTH_REQUIRED` | 未登入、Session 無效或已登出 |
| 403 | `ACCESS_NOT_APPROVED` | 已登入但未核准、撤銷、到期 |
| 403 | `ADMIN_REQUIRED` | 已登入但非管理者讀取或操作管理端點 |
| 405 | `METHOD_NOT_ALLOWED` | 六端點非 `POST` |
| 413 | `PAYLOAD_TOO_LARGE` | request envelope、檔案、音訊時長或輸出邊界超過上限 |
| 429 | `RATE_LIMITED` | 短時請求過多 |
| 429 | `DAILY_QUOTA_EXHAUSTED` | 使用者當日剩餘額度不足；`quotaScope: 'all'`（`remaining_day < G`，全部付費功能不可用）或 `'request'`（僅此請求之最大預留超過剩餘，見 §4.5） |
| 429 | `WEEKLY_QUOTA_EXHAUSTED` | 使用者本週剩餘額度不足且無足夠有效追加；`quotaScope` 同上 |
| 503 | `PROTECTION_SERVICE_UNAVAILABLE` | 驗證／防護服務或 shared store 發生故障，致目前狀態無法可信確認；可確定的未登入仍回 401，可確定的未核准／撤銷／到期仍回 403 |

不得再使用 `SITE_SOFT_STOPPED`、`SITE_HARD_STOPPED` 或全站停止文案。所有成本模型相關內部錯誤（無效／過期／未證明／不支援／封鎖）外部映射為同一 `503 PROTECTION_SERVICE_UNAVAILABLE` 及指定文案，不含版本、價格、原因或設定。`409 DUPLICATE_REQUEST`／`IDEMPOTENCY_CONFLICT` 使用錯誤契約指定文案；重複回應前須完成當前資格驗證。

## 4. 每位核准使用者的兩級付費額度

### 4.1 額度政策

| 等級 | 日上限 | 週上限 | 歸屬 |
| --- | --- | --- | --- |
| 第一級 | US$3 / day | US$15 / week | 每位核准使用者獨立計算 |
| 第二級 | US$10 / day | US$50 / week | 每位核准使用者獨立計算 |

- 權威時區為 `Asia/Taipei`。
- 日窗口於每日 00:00 重置；週窗口於每週一 00:00 重置。
- 後端決定 window key 與下一次重置時間；瀏覽器時鐘不可作為恢復依據。
- 週追加不提高或取消每日上限，除非未來規格另行批准。

### 4.2 六端點成本上界（2026-10-07 修訂提案；**全部數值待營運者核准，核准前不得進入實作**）

每次呼叫前須產生可信最大估算成本；若無法界定，必須先限制輸入、輸出、時長或 SKU，仍無法界定時於付費上游前拒絕。**不得以平均單價、經驗速率或「通常用量」取代上界。** 官方來源與查核日期見 [research.md](./research.md) R13。

本節把每項主張分成三種狀態，並分開記錄「目前程式行為」與「未來建議」：

| 狀態 | 意義 |
| --- | --- |
| **公式算術已核對** | 只代表在「假設前提成立」時，公式與乘法／進位無誤（已以 Node 逐式重算）。**不代表前提已被證明**。 |
| **輸入／輸出上界待證明** | 前提（byte 上限、官方語意、供應商係數、實測 usage）尚未取得證據。 |
| **尚待營運者批准** | 屬行為、成本政策、dependency 或部署的變更，核准前不得實作（A1–A10，§10.3.2）。**A2、A8、A9、A10 已規劃核准（方向）**；A1、A3、A4、A5、A6、A7 仍待核准；規劃核准不等於數值、前提或外部整合已驗證，也不是 implementation 授權。 |

#### 4.2.1 通用公式、單位與全域前提

- 單位 µUSD（1 US$ = 1,000,000 µUSD），整數運算，僅在最後以 `ceil` 進位一次。
- **應用程式預留** `R_e = ceil(A × S_e × C_ub,e)`：
  - `C_ub,e`：後端可強制之計費參數上界 × 官方單價。
  - `A`：單次請求的上游嘗試次數上界。**目前程式行為**：`api/_lib/openai.ts` 以 `new OpenAI({ apiKey, fetch })` 建立 client，未設 `maxRetries`／`timeout`，沿用 SDK 預設（`maxRetries` 2、timeout 10 分鐘，已於 `node_modules/openai` 7.15.0 核對）→ `A = 3`。**規劃已核准（A2）**：每個 OpenAI 呼叫明確傳入 `maxRetries: 0` 與端點專屬 timeout → 規劃採 `A = 1`。**A＝3 方案已撤回**，不再列為待決；現況 A＝3 僅作為「目前程式行為」記錄。A＝1 是**待驗收要求**而非已成立事實：「一次使用者操作的上游嘗試數 ≤ 1」須由 §4.2.6 的呼叫鏈核對與 mock 測試（T126）證明；證明前估算器不得以 A＝1 作為 live 放行依據。**不確定計費時保守結算**（§4.4）：逾時、連線中斷、無回應皆視為「上游可能已計費」，維持預留並標 `uncertain`，不因 `maxRetries: 0` 而釋放。Google Places 使用原生 `fetch`、無自動重試，`A = 1`。
  - `S_e`：價格係數（見 4.2.3 各端點；涵蓋價目表變動、服務層級加價與進位）。
- **模型白名單（逐端點）**：
  | 端點 | 目前程式行為 | 未來建議（待 A2） | 白名單 |
  | --- | --- | --- | --- |
  | assistant、photo-ocr、photo-translate | `getOpenAIModel()` ＝ `process.env.OPENAI_MODEL ?? 'gpt-4o-mini'`，環境變數可任意覆寫，價格不可預知 | 估算器以「模型 → 官方單價」白名單查價；不在白名單者於付費上游前回 `503 PROTECTION_SERVICE_UNAVAILABLE`（內部原因 `COST_MODEL_UNSUPPORTED`） | 初始僅 `gpt-4o-mini` |
  | transcribe | 程式固定字面值 `whisper-1` | 維持固定；真實呼叫另受 §4.2.4 阻擋 | `whisper-1`（`live: false` 直到 A10＝P1 的後端驗證與瀏覽器可行性皆證明） |
  | speech | 程式固定字面值 `gpt-4o-mini-tts` | 維持固定；真實呼叫受阻 | `gpt-4o-mini-tts`（`live: false` 直到 A9 解除） |
  | places | 不適用（Google Places API (New)） | 欄位常數對照 SKU 表 | 不適用 |

  改模型屬另案，須同步更新價表與測試。
- **輸入 token 上界方法**：OpenAI tokenizer 為 byte-level BPE，單一 token 至少代表 1 個 UTF-8 byte，因此「完整送出之輸入文字的 UTF-8 byte 數」是 token 數的上界（JavaScript `string.length` 為 UTF-16 code unit，每 unit 最多 3 bytes）。需加上訊息框架餘量（取 100 tokens）。此「byte ≥ token」性質為**待證明**（以建置期對 `catalog` 與最壞字串的測試佐證，不自行宣稱官方保證）。
- **完整提示詞實測（唯讀量測，2026-10-07）**：`travelInstruction('')` 875 B、`translationInstruction` 404 B、`photoOcrInstruction` 627 B、`photoTranslateInstruction` 最大 1,058 B；知識背景只序列化 `area｜title：summary`，現況 catalog（19 筆）最大 5 筆合計 525 B（遠小於 16,384 B 上限；上限保留供未來擴充，並以建置期測試強制）。
- **MB／MiB 與實際 bytes（統一以 bytes 表達，不再使用裸「MB」）**：1 MiB ＝ 1,048,576 B；3 MiB ＝ 3,145,728 B；10 MiB ＝ 10,485,760 B。Vercel 官方僅寫「4.5 MB」且**未定義是十進位或二進位**（`FUNCTION_PAYLOAD_TOO_LARGE`，2026-10-06 查核），本計畫保守取 4,500,000 B；4,200,000 B 在兩種解讀（4,500,000／4,718,592）下皆低於上限。
- **Pre-parse 請求大小上限**（Pipeline 第 2 步；`Content-Length` 預檢加 bounded reader，缺 `Content-Length` 亦須中止）：

  | 端點 | pre-parse 上限（bytes） | 推導 | 狀態 |
  | --- | --- | --- | --- |
  | assistant | 16,384 | `text` ≤ 1,000 units；最壞全以 `\uXXXX` 跳脫＝6,000 B ＋其餘欄位 | 待證明（其餘欄位最壞值待建置期測試） |
  | photo-translate | 16,384 | `sourceText` ≤ 2,000 units；最壞跳脫 12,000 B ＋其餘欄位 | 待證明 |
  | speech | 4,096 | `text` ≤ 500 units；最壞跳脫 3,000 B ＋欄位 | 待證明 |
  | places | 2,048 | `query` ≤ 100、`manualArea` ≤ 50；最壞跳脫 900 B ＋座標等欄位 | 待證明 |
  | photo-ocr | 4,200,000 | 解碼後影像 ≤ 3 MiB ＝ 3,145,728 B → base64 字元 `4×⌈3,145,728/3⌉` ＝ 4,194,304；加 `data:image/jpeg;base64,`（23，png 為 22）；JSON 外殼 `{"imageDataUrl":"`（17）＋`","regionVersion":`（18）＋ 位數 d ＋ `}`（1）。總計 ＝ 4,194,363 ＋ d ＝ **4,194,373（d＝10）**，餘裕 5,627 B；<4,500,000 | **公式算術已核對**；`regionVersion` 位數上限（建議 ≤ 10 位）與其他欄位須納入驗證（待證明） |
  | transcribe（A10 P1 方案） | 2,000,000 | 見 §4.2.4：WAV ≤ 60 s × 32,000 B/s ＋ 44 B header ＝ 1,920,044 B；加 multipart 餘裕 ≥ 65,536 B ＝ 1,985,580 ≤ 2,000,000 | 公式算術已核對；multipart 實際開銷待測 |

  超過回 `413 PAYLOAD_TOO_LARGE`。
- **上游逾時**（`AbortSignal`／SDK `timeout`，需小於平台 `maxDuration`）：assistant／photo-ocr／photo-translate 30 s、places 8 s；transcribe／speech 逾時值待 A9／A10 決定。逾時一律依 §4.4 轉 `uncertain`。Vercel Functions 官方（2026-10-06 查核）：Hobby `maxDuration` 上限 300 s、Pro 800 s；bundle 未壓縮 250 MB。

#### 4.2.2 逐端點「目前程式行為」與「未來建議」

| 端點 | 目前程式行為（唯讀核對） | 未來建議（皆待核准） |
| --- | --- | --- |
| assistant | `body.text` ≤ 1000；travel：`responses.create({ model, reasoning:{effort:'low'}, text:{verbosity:'low'}, input })`，input ＝ `travelInstruction(contextSummary)` ＋ 問題 ＋ 語氣；translation：`{ model, input: translationInstruction(tone) + text }`；**無** `max_output_tokens`；單次請求至多 1 次上游呼叫（emergency 路由不呼叫；`detectEmergency`／`detectLiveData` 無外部呼叫）；無影像、無工具呼叫 | `max_output_tokens: 2000`；prompt ≤ 4,096 B、知識背景 ≤ 16,384 B（建置期測試強制）；模型白名單；`max_output_tokens` 含 reasoning tokens（官方 Responses API reference 已於 2026-10-07 核對文字）；實測不誤傷正常輸出屬 T130 |
| photo-ocr | `responses.create` 內含 `input_text`＋1 張 `input_image(imageDataUrl)`；未指定 `detail`（官方預設 `auto`）、未指定 `max_output_tokens`；`MAX_IMAGE_BYTES` ＝ 10 MiB（**超過 Vercel 4.5 MB 上限，實際不可達**）；前端以 canvas 依原圖座標裁切輸出 JPEG，不縮圖 | 明確 `detail: 'high'`；影像恆 1 張；解碼後影像 ≤ 3 MiB；前端送出前縮至最長邊 ≤ 2048；`max_output_tokens: 3072`；模型白名單 |
| photo-translate | `sourceText` ≤ 2000；`responses.create({ model, input })`；無影像、無工具；無 `max_output_tokens` | 沿用 ≤ 2000；`max_output_tokens: 4096`；模型白名單 |
| places | `api/places.ts` helper：coordinates 僅呼叫 Nearby Search、manual 僅呼叫 Text Search；固定七欄完整 mask，含 `places.editorialSummary`；一個 branch 一次原生 `fetch`，無程式重試／分頁。helper 對 manualArea≤50 有檢查，但沒有 query≤100 或 bounded 2,048 B reader，也未將 `AbortSignal` 傳給 fetch。query/body 限制在 configured protected boundary 的 parser/validator，不是 helper 本身保證；目前 production `POST` 未配置，先 fail closed。 | 待正式成功路徑授權與接線：固定 fieldMask→SKU allowlist，未知欄位拒絕；query≤100、manualArea≤50、pre-parse 2,048 B；沿用已批准 8 s execution timeout／18 s lease，實際 fetch 應 abort、不得重試。具體 SKU 價格／帳戶適用性見 readiness-decisions.md D01（2026-10-08）；不得把 TEST_ONLY timeout 或 fixture 當正式證據。 |
| transcribe | 固定 `whisper-1`；檔案 ≤ 10 MiB；MIME `audio/webm｜mp4｜m4a｜wav｜aac`；`src/services/recorder.ts` 用 MediaRecorder（webm／opus、mp4、aac），**無時長、位元率上限** | 見 §4.2.4（A10＝P1 已規劃核准）；後端驗證與瀏覽器可行性證明前真實呼叫受阻（`live: false`） |
| speech | 固定 `gpt-4o-mini-tts`；`text` ≤ 500；`speed` 1 或 0.75；`response_format: 'mp3'`；回傳 base64 data URL；API 無輸出長度參數 | 見 §4.2.4（A9）；上界未建立前真實呼叫受阻 |

#### 4.2.3 成本推導

單價來源與日期分開記錄。OpenAI 價格仍依既有官方資料核對狀態；Google Places 公開全球價於 2026-10-08 重新核對：Nearby／Text Search Enterprise + Atmosphere 首階 US$40／1,000 events，Global free cap 1,000；India 區域價表為 US$12／1,000 events、free cap 7,000，兩者另有不同 SKU ID。詳見 [D01 決策包](readiness-decisions.md#d01places-決策包2026-10-08-本次更新) 的 tier 表與來源。公開價不是本帳戶完整費用或上界證據；本帳戶交易幣別為 TWD，但 CSV 金額幣別／匯率未標，詳見本 Plan 上方 D01 補記。`priceScale=5/4 (1.25)` 與 50,000 µUSD 僅批准為本機候選／mock，不是 production 設定或硬上界。價格層級（Standard／Fast `priority`／Flex／區域加價）係數與 OpenAI 的官方數值狀態仍待證明；未來建議可明確傳入 `service_tier: 'default'`（官方文件：`default` ＝ 該模型標準計價），但回應實際層級可能不同，故不依賴它降低 `S_e`。

**表一：公式算術已核對**（前提見表二；A=1 欄僅在 A2 核准時適用）

| 端點 | `Tin` 推導（tokens） | `Tout` | `C_ub,e` | `S_e` | `R_e` A=1（A2 規劃已核准；數值待 A1） | `R_e` A=3（**已撤回**，僅歷史對照，不得用於放行） |
| --- | --- | --- | --- | --- | --- | --- |
| assistant | text 1,000 units×3 ＝ 3,000 B ＋ prompt 上限 4,096 ＋ 知識上限 16,384 ＋ 問題／語氣標籤 35 ＋ 框架 100 ＝ 23,615，加餘裕至 **24,100** | 2,000 | 24,100×0.15 ＋ 2,000×0.60 ＝ 3,615 ＋ 1,200 ＝ 4,815 | 2.0 | 9,630 | 28,890 |
| photo-translate | 2,000 units×3 ＝ 6,000 ＋ prompt 上限 4,096 ＋ 框架 100 ＝ 10,196，加餘裕至 **10,400** | 4,096 | 1,560 ＋ 2,457.6 ＝ 4,017.6 | 2.0 | 8,036 | 24,106 |
| photo-ocr | 影像 ≤ 2,833 ＋ 8×5,667 ＝ 48,169（1 張）＋ 文字 prompt 上限 4,096 ＋ 框架 100 ＝ 4,196 → **4,200**；合計 **52,369** | 3,072 | 7,855.35 ＋ 1,843.2 ＝ 9,698.55 | 2.0 | 19,398 | 58,192 |
| places | 1 個候選 billable event，無 token | — | Global 公開最高階 40,000 µUSD／event；India 區域價最高 12,000 µUSD／event | 5/4（1.25，已批准本機候選／mock；非硬上界證明） | 50,000（已批准本機候選／mock） | 50,000（僅本機候選；成本上界仍未證） |

- 影像 token（`gpt-4o-mini`：base 2,833、每 tile 5,667；`low／high／auto` 皆支援）已於官方 Images and vision 頁（2026-10-07）核對；tile 數上限 8（最長邊縮至 ≤ 2,048、最短邊 ≤ 768 → ⌈2048/512⌉×⌈768/512⌉ ＝ 4×2）為由該縮放規則推得，建置期須以實際 `usage.input_tokens` 驗證（待證明）。**解碼後 3 MiB 限制只決定傳輸大小，不影響 token 上界。**
- 實測最壞情境（未乘 S）與 `R_e` 對照：assistant（含實際 catalog 最大知識 525 B）遠小於 4,815；photo-ocr 約 49,029×0.15 ＋ 3,072×0.60 ＝ 9,197；photo-translate 7,603×0.15 ＋ 2,457.6 ＝ 3,598。**皆小於 `R_e`，但此對照不是上界證明。**
- 預留金額隨實際輸入縮放；上表為「合法輸入上限下」的 `R_max,e`。
- 三個層次分開記錄：（1）應用程式預留 `R_e`（呼叫前原子預留，只用於額度閘門）；（2）結算估算（呼叫後依 `response.usage` 與固定 SKU 計算；僅 `attempts == 1` 且標準層級才可低於預留釋放差額，否則維持預留）；（3）供應商實際帳單（受 Fast、區域加價、折扣、稅影響，**不保證與前兩者相等或為其上限**，帳戶層級預算告警／硬上限仍為獨立防線，§4.4、§10.2）。

**表二：輸入／輸出上界待證明**

| 項目 | 缺少的證據 | 證據取得方式 | 對應任務 |
| --- | --- | --- | --- |
| prompt／知識背景 byte 上限（4,096／16,384）與「byte ≥ token」 | 建置期對 catalog 與最壞字串的測試 | mock 測試（不呼叫付費 API） | T126 |
| 各端點 pre-parse 上限內的其餘欄位最壞值、`regionVersion` 位數 | 最壞請求構造測試 | mock | T126、T129 |
| `max_output_tokens` 實測不截斷正常輸出 | 既有樣本輸出長度分布 | 先 mock／樣本測試；真實 usage 屬外部證據 | T130 |
| tile 上限 8、`usage.input_tokens` 與估算一致 | 真實 vision 呼叫 usage | 外部證據（付費，需另批） | T133 |
| Fast／Flex／區域加價係數（`S_e`＝2.0、1.25） | 官方價表現值與帳戶設定 | 營運者提供 | A1 |
| `maxRetries` 實際生效與 `attempts` 計數 | instrumentation 測試 | mock | T126 |
| transcribe／speech 上界 | 見 §4.2.4 | 見 §4.2.4 | T127、T128、T132、T133 |

**表三：批准狀態（2026-10-06）**：A2（重試政策＝A＝1）、A8（G-B）、A9（S1）、A10（P1）**規劃已核准**（方向，非數值／前提／外部證明）；A1（數值）、A3（60 s／1,920,044 B 限制值待核對）、A4（photo-ocr 3 MiB／縮圖）、A5（places）、A6（429 `quotaScope` 與文案）、A7（模型停用遷移範圍）**尚待核准**。見 §10.3.2。

#### 4.2.4 transcribe 與 speech：上界未成立，真實呼叫受阻

**不採用的依據**：（一）容器宣告的時間戳（WebM Cluster、MP4 `moov`、ADTS frame 計數）——可被偽造，且 MediaRecorder 輸出常缺 Duration；（二）「US$0.84 殘餘風險接受」——該數字依「1 kbps」假設，不是上界；（三）以檔案大小除以假設位元率。三者都不是硬上界，**不得作為放行依據**。

**transcribe（供應商以音訊時長計價）：A10 已規劃核准採 P1；P2／P3／P4 為被取代的選項，已撤回、不再列為待決**（下表保留比較紀錄與撤回理由）

| 方案 | 內容 | 新 dependency | 部署限制 | 上界是否可證明 | 評估 |
| --- | --- | --- | --- | --- | --- |
| **P1（A10 規劃已核准）** | 前端以 Web Audio（`AudioWorklet` 或等效）直接產生**固定格式**：16 kHz、mono、16-bit little-endian PCM WAV（32,000 B/s），**取代 MediaRecorder 壓縮格式**；後端依 §4.2.4.1 完整驗證並**重建** WAV 再送上游；單檔 ≤ 1,920,044 B（＝1,920,000 B 資料＋44 B 標準標頭；**待核對的限制值**） | 無（Node `Buffer`＋瀏覽器內建 API） | 單檔 ≈ 1.92 MB，低於 4,500,000 B；不需新 `maxDuration`；Safari／Firefox 的 `AudioContext({sampleRate:16000})` 支援度與 AudioWorklet 行為**未查得**（MDN 僅載明不支援的 sampleRate 會丟 `NotSupportedError`），須真實瀏覽器實測（T133） | **後端驗證完成前不成立**：上界由「實際驗證過的 PCM bytes」決定，重建 header 後上游看到的時長即驗證值；不信任任何 header 宣告 | 改變錄音實作與檔案格式，屬語音行為變更（已核准方向） |
| P2（**已撤回**） | 伺服器端真實解碼（`ffmpeg-static`／`@ffmpeg/ffmpeg`） | 是 | 授權、體積、Vercel 相容性未查核 | 是 | 被 P1 取代；不引入新 dependency |
| P3（**已撤回**） | `music-metadata` 類只解析 header | 是 | 同上 | **否**（header 可偽造） | 不採 |
| P4（**已撤回**，但其「未證明即受阻」語意由 P1 的 `live: false` 保留） | 維持受阻 | 無 | 無 | 不適用 | 由 P1 的驗證關卡取代 |

- **P1 的 `live` 條件**（缺一不可，否則 `live: false`，真實呼叫對外回 503 `PROTECTION_SERVICE_UNAVAILABLE`；內部原因 `COST_BOUND_UNPROVEN`，只允許 mock）：（a）§4.2.4.1 後端驗證與重建已實作且測試通過；（b）真實瀏覽器 16 kHz PCM 可行性已驗證（T133（b））；（c）供應商以時長計價與分鐘進位規則已核對；（d）A1 數值（`C_ub`、`S_e`）已核准；（e）營運者明確啟用。**A10 核准本身不使 transcribe `live`。**
- 若 P1 條件全部成立，`C_ub` ＝ 1 分鐘 × US$0.006 ＝ 6,000 µUSD，`S_e` 1.5 → `R_e`（A＝1）＝ 9,000 的**公式算術已核對**；A＝3 的 27,000 已撤回。前提仍屬待證明。

##### 4.2.4.1 P1 後端驗證與重建規格（待實作；全部為待測；限制值待核對）

後端**不信任**任何 header 宣告的時長、取樣率以外的欄位、`data` chunk 長度或 `RIFF` size 以外的描述；只信任「實際收到的 bytes」。依序：

1. 請求端 bounded reader：整份 multipart ≤ 2,000,000 B（pre-parse，§4.2.1）；檔案 part ≤ 1,920,044 B。
2. 檔案 ≥ 44 B；位元組 0–3＝`RIFF`、8–11＝`WAVE`；之後 chunk 順序限定為 `fmt `（長度恰 16）→ `data`；其他 chunk（`LIST`、`fact`、`JUNK` 等）一律拒絕（固定格式，不做彈性解析）。
3. `fmt `：`audioFormat`＝1（PCM）、`numChannels`＝1、`sampleRate`＝16,000、`bitsPerSample`＝16、`blockAlign`＝2、`byteRate`＝32,000；任一不符拒絕（不再有取樣率白名單）。
4. 實際資料量 `actualData` ＝ 檔案總長 − 44；`data` chunk 宣告長度必須**等於** `actualData`（不得大於、小於；不接受 `0xFFFFFFFF` 串流佔位值）；`RIFF` size 必須等於 `檔案總長 − 8`；`data` 長度必須為 2 的倍數（frame 對齊，mono 16-bit 每 frame 2 B）；不接受奇數長度所需的 pad byte。
5. `actualData` ＞ 0 且 ≤ 1,920,000 B（時長 ＝ `actualData / 32,000` ≤ 60 s）；超限回 `413`／`400`（沿用既有 `INVALID_INPUT`／`PAYLOAD_TOO_LARGE` 語意），於付費上游與預留之前。
6. **重建**：丟棄原 header，只取驗證過的 PCM 樣本，以標準 44 B header 重新產生 WAV（`File` 名稱固定 `recording.wav`、type `audio/wav`）送上游；`RIFF` 與 `data` 長度由後端計算。
7. 預留金額由 `actualData`（驗證後）決定上限；不使用客戶端宣告值。

偽造 header（宣告值與實際長度矛盾）、截斷、超長、非 PCM、非 16 kHz／mono／16-bit、含額外 chunk、奇數 data bytes 一律於上游前拒絕並**不預留**。僅 header 驗證（P3）不足以成立上界，故 6 為必要步驟。

**speech（輸入文字 ≤ 500；輸出為音訊）**

- 官方 `gpt-4o-mini-tts` 模型頁（2026-10-06 查核）只列「最大輸入 2,000 tokens」，**未查得**最大輸出 tokens、音訊 token／秒或輸出時長上限。先前提案的「50 audio tokens／秒、2.0 字／秒」為假設值，**不得冒充硬上界，已自本計畫移除作為預留依據**。
- 處置（**A9 已規劃核准＝S1**）：`speech` 價表 `live: false`，真實呼叫受阻（對外回 503 `PROTECTION_SERVICE_UNAVAILABLE`；內部原因 `COST_BOUND_UNPROVEN`），**只允許 mock**。S2（接受無硬上界）、S3（校準值）、S4（改 `speechSynthesis`）、S5（串流中止）皆**已撤回**，不再列為待決；未來若要解除受阻，須另提新決策並提供官方輸出上界證據。**逾時、串流中止、經驗速率（audio tokens／秒、字／秒）、校準值與供應商帳戶預算都不得當成計費上界或 `live` 依據**；speech 不進入 quota 判斷、不納入 `E_live`、不影響 G。

#### 4.2.5 與既有 Pipeline 的關係

- Pipeline 第 5 步「成本上界估算」包含：以 bounded reader 取出估算所需欄位、檢查上表限制、計算 `R_e`；任何限制不成立或參數不可信一律回 `413`／`400`（沿用既有 `INVALID_INPUT` 語意）／`503`（模型不在白名單），**且不進入預留與上游**。第 7 步的「既有輸入驗證」若在預留成功後判定輸入不合法，該預留視為明確未計費失敗並釋放（§4.4）。
- 預留記錄須保存 `costModelVersion`（價表版本）與計算輸入摘要，使結算與稽核可重現（見 data-model.md §5）。

#### 4.2.6 A＝1 完整呼叫鏈核對（唯讀，2026-10-06；A2 規劃已核准）

核對範圍：`api/*.ts` 六端點、`api/_lib/openai.ts`、`api/_lib/openai-attempt-instrumentation.ts`、`src/services/api.ts`、`node_modules/openai/client.js`（7.15.0）。

| 層級 | 現況發現 | A＝1 所需處置（待實作） |
| --- | --- | --- |
| OpenAI SDK | `maxRetries` 預設 2（client.js L240）、timeout 預設 10 分鐘（L1256）；SDK 對可重試回應／連線錯誤自動重送；`createOpenAIClient()` 未覆寫 → 現況 A＝3 | 每個呼叫傳 `maxRetries: 0` 與端點 timeout（建議在 client 建立處統一設定，並以測試鎖定）；SDK 層測試以 mock `fetch` 回 429／5xx／連線錯誤，斷言上游 `fetch` 次數＝1 |
| 應用程式層 | assistant／photo-ocr／photo-translate／transcribe／speech 每個 handler **各只有一個** `create` 呼叫，無 `for`／`while`／遞迴重送；catch 後直接回錯誤或本機 `fallbackTranslation`（純本機字串，不呼叫上游）；places 依有無座標只走 `searchNearby` **或** `searchText` 其中之一，原生 `fetch`、無重試 | 保持單呼叫；以測試鎖定「任何分支下上游呼叫數 ≤ 1」，不得新增第二次呼叫（例如以不同 prompt 或模型重試） |
| Fallback | `requestProviderTravel`／`requestProviderTranslation` 在 `output_text` 為空或 JSON 解析失敗時回 `undefined` 並走本機 fallback，**不再次呼叫上游** | 維持；解析失敗仍視為「上游已計費、已結算」 |
| 前端 | `src/services/api.ts` 的 `request()` 單次 `fetch`，無自動重試；使用者按「重試」是**新的使用者操作**，各自獨立預留 | 維持；前端不得加入自動重送；快速連按／多分頁屬併發預留問題（T024），不計入單次操作嘗試數 |
| 驗證用 instrumentation | `openai-attempt-instrumentation.ts` 是一次性驗證用 fetch 包裝，記錄每次 attempt 序號 | 可作為 mock 測試計數器的參考；是否保留於 production 屬實作期決定，需不影響 request 語意 |
| 平台層 | 平台是否對同一次請求自動重送、以及逾時中止後上游是否已計費，本輪**均未查得官方保證** | 不假設平台不重送；逾時／中斷一律 `uncertain`，保守保留預留（§4.4）；平台重送屬外部整合待驗證（Preview 實測） |

**待驗收要求（A＝1）**：對六端點各自的任一路徑，「一次使用者操作造成的上游嘗試數」必須 ≤ 1，且 mock 測試必須在 SDK 回 429、5xx、逾時、連線中斷時皆證明上游 `fetch` 恰為 1 次；任一證明失敗則估算器不得以 A＝1 計算（該端點維持 `live: false`，而非自動採 A＝3）。**目前以上皆待測；`maxRetries: 0` 尚未實作。**

### 4.3 預留、併發與顯示

後端 quota snapshot 至少回傳：

- `tier`: `tier1` 或 `tier2`
- `daily`: `usedEstimatedUsd`、`reservedEstimatedUsd`、`remainingEstimatedUsd`、`limitEstimatedUsd`、`resetAt`
- `weekly`: 同上，另包含 `baseLimitEstimatedUsd`、`activeTopUpEstimatedUsd`
- `currency`: `USD`
- `timezone`: `Asia/Taipei`
- `precision`: 對 UI 顯示為美分；內部可用更細單位如 micro-USD 避免浮點誤差

同一使用者多分頁、重新整理、重複提交與直接 API 呼叫都必須在同一 shared store 原子預留下競爭，不得共同花用同一剩餘額度。前端 quota snapshot 只供顯示，不具授權效力。

### 4.4 結算規則

**2026-10-06 已批准 C1／H1／H2 收斂**：結算正常佐證有效回內部 `settlementStatus: accounted`（不帶通用 `ok:true`），原 API 依原請求結果處理；超額如實入帳且原子版本／摘要雙封鎖佐證有效回 `accounted_cost_bound_exceeded`，內部標示已入帳但上界遭突破，原 API 對外仍為 503。usage／佐證矛盾亦 503，不推論 store 未入帳、不退款、不重送。settle 各 reservation 結果及 cleanup 逐筆結果，同次回傳原窗口／身分歸屬與 usage；核對不可變資料、轉移及 settled used／uncertain reserved 至少涵蓋本筆，不要求等於單筆，不追加 read 拼湊佐證。

新授權須核對 createdAt＝可信 command 時間、leaseExpiresAt＝該時間＋注入 lease；回應延遲至授權時已到達到期時間亦拒絕。歷史預留不必仍有效才能讀取／保守結算，既有結算／清理邊界維持不變。本批 T136 僅隔離子範圍，不依賴或執行 T025／T135；正式參數、Redis、排程與可信對帳仍未完成。不接 handler／UI，不建立 pipeline，功能 005 非 READY。

**2026-10-06 H1-R1 限定補充（使用者明確授權）**：保留上輪 H1 修補歷史；後續探針發現 estimation＝02:00:00.000Z、command／grant＝01:59:59.999Z 仍授權的缺口。`quota-engine.ts` 每次讀取可信時鐘後固定 Date 快照，避免注入來源重用可變物件改寫先前佐證；command 無效或早於 estimation 回內部 `INVALID_CLOCK`／503，且不呼叫 store。既有 grant 無效檢查、grant 早於 command／lease 到期拒絕及 store 結果未知時不退款、不重放行為保留；時間相等允許但不繞過效期／lease。只沿用 T021／T024／T136 隔離子範圍，不改 validation 的歷史結算契約、不核定正式 lease、不執行 T135 或 pipeline。

| 結果 | 結算處理 | 顯示影響 |
| --- | --- | --- |
| 上游成功且可得 usage | 預留轉已用；若可安全低於預留，釋放差額 | 已使用增加，預留中下降，剩餘更新 |
| 上游成功但 usage 不完整 | 依既定保守估算結算，不聲稱等同帳單 | 顯示估算已用 |
| 明確未計費失敗 | 釋放或調整預留 | 預留中下降，已用不增加或依規則調整 |
| 逾時、連線中斷或不確定是否已計費 | 保守保留預留於建立時的日／週窗口並標記 `uncertain`，不得立即恢復額度；store timeout 不等於操作未完成 | 顯示預留中或不確定狀態，不顯示虛假剩餘 |
| lease 到期 | 按端點最長執行時間加結算緩衝後，冪等清理轉為 `uncertain`，不退款、不移至新窗口、不重放 | 顯示狀態未能確認；由使用者自行查看，不暗示已成功 |
| uncertain 後收到晚到結果 | 僅記錄可信來源、結果類別及稽核時間；不自動改額度或退款 | 不將晚到結果直接呈現為已結算成功 |
| 重複結算 | 原 transition、金額及結算語意相同才可回已套用；不一致則拒絕，不改額度 | 不回成功形狀的 fallback；顯示保護服務無法確認並供內部稽核 |

供應商帳戶層級仍需獨立預算告警或用量限制；App 內估算不是帳單封頂。

### 4.5 「額度不可用」的權威定義與其與六端點請求預留的關係（A8 已規劃核准＝G-B；數值與前提待證明）

舊文以「日／週額度可用／不可用」同時描述端點授權與圖磚／互動地圖 gate，卻未定義判斷門檻，易使「某一昂貴端點無法預留」被誤讀為「所有功能與地圖都不可用」。本節為唯一定義，spec、UX、contracts、quickstart 與 tasks 均引用此處。**A8 規劃核准的是規則（G-B），不是任何具體 G 數值**；數值取決於 A1 與各端點上界前提，均待核准／待證明。

#### 4.5.1 端點層級（不依賴 G 數值）

- `remaining_day` ＝ 日窗口 `limit − used − reserved`；`remaining_week` ＝ 週窗口 `base limit ＋ 所有 active 追加 − used − reserved`（皆為 µUSD，取自 shared store 權威 snapshot）。
- 端點 `e` 的**預留金額** `R_e ＝ ceil(A × S_e × C_ub,e)`，A＝1（A2），`C_ub,e` 以**後端驗證後的實際輸入**計算（輸入越小越低）；`R_max,e` 為該端點在**合法輸入上限**下的預留（A＝1）。圖磚 gate 不預留、不扣款，只讀同一權威 snapshot。
- 端點 `e` 可取得首次 grant ⟺ `e ∈ E_live`、同次 registry 快照在原子決策仍有效，且預留前兩窗口皆 `remaining ≥ G`、`remaining ≥ R_e`，並以單一原子操作完成。僅增加 reserved 的 `R_e`；G 是放行門檻，不是最低扣款或預留後須保留的餘額。完整競態語意見 §14。

#### 4.5.2 G-B 規則（**A8 規劃已核准**）

- **`E_live`（啟用端點集合）**：依當下權威 registry／價表決定 `live: true`、有效期間內且版本／成本參數摘要皆未封鎖的端點；不得以建置期快照或環境變數覆寫。須**同時**滿足：（1）該端點的成本上界前提已有證據（表二對應項目已解除，含外部證據項目）；（2）A＝1 驗收（§4.2.6）已通過；（3）該端點已**實際啟用**（營運者明確啟用，而非僅有 mock 實作）；（4）該端點的 A1 數值已核准。**受阻端點（speech、transcribe）與僅有 mock 的端點一律不在 `E_live`**；狀態變動須有稽核紀錄。正式權威來源／G 接線仍待整合，不由 fixture 宣稱完成。
- **`G ＝ min { R_max,e ∣ e ∈ E_live }`**（µUSD 整數）；`E_live` 為空時 G **未定義**，屬「成本模型無效」（§4.5.3），不是額度問題。
- **日／週判斷**：日窗口「全域不可用」⟺ `remaining_day < G`；週窗口 ⟺ `remaining_week < G`；兩者同時成立日優先。其他窗口條件與追加規則不變。
- **預留金額的計算位置**：Pipeline 第 5 步（成本上界估算）由驗證後輸入算出 `R_e`，與當下 `E_live`／價表版本一併寫入預留記錄（`costModelVersion`）；G 由同一價表同一版本重算，不得使用兩份不同價表。
- G-A（舊文，`min` 涵蓋六端點）、G-C（凍結常數）、G-D（最小合法輸入）、G-E（圖磚不綁額度）**已撤回**，不再列為待決，也不需 Specification Sync（G-B 沿用 FR-043／045／048 語意）。

#### 4.5.3 四種「不可用」情況（必須分開判定、分開文案、分開測試）

| 情況 | 判定（優先序由上而下） | 端點回應 | 地圖／圖磚 |
| --- | --- | --- | --- |
| **成本模型無效** | `E_live` 為空；價表缺失／版本不符；價表數值非有限正整數；模型不在白名單；端點 `live: false`（含 speech／transcribe）；A＝1 驗證未通過 | `503 PROTECTION_SERVICE_UNAVAILABLE`（內部原因 `COST_MODEL_INVALID`／`COST_MODEL_UNSUPPORTED`／`COST_BOUND_UNPROVEN`）；**不帶 `quotaScope`、不顯示額度文案**；不進入預留與上游 | 無法確認安全 → fail-closed，使用靜態示意圖；不顯示額度文案 |
| **實際額度耗盡** | `limit − used ≤ 0`（已用金額本身已達窗口上限；釋放預留也不會恢復） | `429 DAILY_QUOTA_EXHAUSTED`／`WEEKLY_QUOTA_EXHAUSTED`＋`quotaScope: 'all'`，內部原因 `exhausted` | 不可用，靜態示意圖；逐字採已批准 A6 日／週耗盡列 |
| **無啟用端點可負擔** | 未耗盡，且 `remaining < G`（可能因預留釋放或窗口重置而恢復） | 同上 code＋`quotaScope: 'all'`，內部原因 `below_floor` | 不可用，靜態示意圖；逐字採已批准 A6 below_floor 日／週列，不得說「已用完」 |
| **個別請求預留不足** | `remaining ≥ G` 但 `R_e > remaining`（日或週較先不足者，日優先） | 同上 code＋`quotaScope: 'request'` | **維持可用**；其他較低成本端點可用；文案不得使用「額度已滿」 |

- Eligibility API 的 `reason` 僅在「實際額度耗盡」與「無啟用端點可負擔」時回 `daily_quota`／`weekly_quota`；「成本模型無效」回防護服務不可用語意。reason 本身不能區分 exhausted／below_floor，前端不得據此重建文案（見 contracts/map-access-contract.md）；查詢契約與 UI 接線不屬隔離批次。
- **A6 已批准**：四種額度語意（日耗盡、週耗盡、below_floor、request 不足）展開為六列完整 title／message／step，已逐字同步 [Spec](spec.md)、[UX](ux-ui-design-handoff.md) 與 [錯誤契約](contracts/error-and-quota-contract.md)。保留既有 code／quotaScope／reason 及本節**判定邏輯**；批准文案不等於 UI／handler 已整合。
- 分類來源是同次原子拒絕 snapshot＋同版本可信成本 context；跨類 exhausted > below_floor > request，同類日優先。public 信封不新增內部分類／G。日限制不能靠週追加解除；below_floor 可能恢復但不保證追加足夠；uncertain 不自動釋額。前端不推算狀態或確切恢復時間，後端可靠秒數以外不送 Retry-After。各次手動重試仍檢查資格、registry、日／週額度。
- 因 `G` 取自最大合法輸入，`remaining` 略低於 `G` 時極短輸入理論上仍可預留；此情形仍視為全域不可用（單一、與內容無關、偏保守的門檻）。

#### 4.5.4 8,036 µUSD 的狀態（**不得提前標為已驗證門檻**）

- 8,036 µUSD ＝ photo-translate 的 `R_max`（A＝1，表一）。它只有在 photo-translate ∈ `E_live` 且為最小者時才會成為 G；而其依賴的 `S_e`＝2.0、`Tout`＝4,096、prompt／知識上限等**均待 A1 核准與表二前提證明**，photo-translate 目前**未啟用**。
- 因此 8,036 僅是「**mock 測試資料**」：測試以明確命名的 fixture 價表（例如 `FIXTURE_ALL_LIVE`）餵入，驗證 G 的**計算、原子性與判定分類**；**不得**據此宣稱真實成本上界成立，不得寫成契約常數，不得出現在 UI 或 production 設定。A＝3 的 24,106 已撤回。

#### 4.5.5 mock 驗證例（fixture：`E_live` ＝ {assistant、photo-translate、photo-ocr、places}，A＝1，僅示意算術）

| `remaining_day`／`remaining_week`（`limit − used` 均 > 0） | places 50,000 | photo-ocr 19,398 | assistant 9,630 | photo-translate 8,036 | 分類／地圖 |
| --- | --- | --- | --- | --- | --- |
| 200,000／300,000 | 允許 | 允許 | 允許 | 允許 | 可用 |
| 15,000／3,000,000 | 429 `request` | 429 `request` | 允許 | 允許 | 個別請求預留不足；地圖可用 |
| 8,100／3,000,000 | 429 `request` | 429 `request` | 429 `request` | 允許 | 地圖可用（`8,100 ≥ G`） |
| 8,000／3,000,000（`limit − used` > 0） | 全部 429 `all` | 同左 | 同左 | 同左 | 無啟用端點可負擔；地圖不可用 |
| `limit − used ＝ 0`（reserved 任意） | 全部 429 `all`（`exhausted`） | 同左 | 同左 | 同左 | 實際額度耗盡；地圖不可用 |
| 3,000,000／7,000（週） | 全部 429 `all`（週） | 同左 | 同左 | 同左 | 無啟用端點可負擔（週，除非有 active 追加） |
| fixture `E_live` ＝ ∅ | 全部 503 | 同左 | 同左 | 同左 | 成本模型無效；靜態示意圖，不顯示額度文案 |

- 測試義務（tasks T131、T134）：參數化證明（1）任一端點 `R_e` 無法預留不改變其他端點與圖磚 gate；（2）G 隨價表 `live` 旗標與單價變動自動重算；（3）圖磚 gate 對 `live: false` 端點的價格完全不敏感；（4）`E_live` 為空時回「成本模型無效」而非額度錯誤；（5）四類情況判定互斥且優先序正確；（6）mock fixture 與 production 價表物理分離（fixture 不可被 production 路徑載入）。

## 5. 管理者儀表板與追加核准

### 5.1 管理端 contract

- 未登入或 Session 無效呼叫任一管理資料／異動端點：`401 AUTH_REQUIRED`。
- 已登入但非管理者：`403 ADMIN_REQUIRED`。
- 後端每次查驗管理者可信來源，不信任前端 role。
- 讀取端點僅回最少必要資料：核准狀態、等級、日／週已用／預留／剩餘、端點用量摘要與防護服務狀態。
- 異動端點：核准、拒絕、切換等級、撤銷、週追加；均需原子執行、可稽核、防 CSRF、防重複提交。
- 一般使用者 UI 與 Public 頁面不得顯示管理資料或管理操作入口。

### 5.2 週追加政策（營運者已核准，2026-09-25）

管理者可對指定使用者、指定 `Asia/Taipei` 週別，逐次決定追加金額與追加次數；**不設預設固定次數上限，也不設累計金額之倍數上限**。每日上限（第一級 US$3、第二級 US$10）與此政策無關，維持獨立有效。此政策取代舊草案「每週最多 1 次 active 追加」與「單次／累計最多 1× base weekly limit」之設計。

| 決策項 | 政策 | 理由 |
| --- | --- | --- |
| 每次追加金額 | 管理者逐次輸入正值金額（US$，換算 micro-USD 儲存）；無單次金額上限 | 授權管理者依實際情境（例如延長測試、活動、客訴處理）判斷所需之延伸額度 |
| 每週追加次數 | 同一使用者同一週可有多筆 `status: active` 追加；無固定次數上限 | 移除「同週僅 1 次」限制，改由管理者依需要決定是否多次追加 |
| 累計金額 | 有效週上限 = base weekly limit（US$15 或 US$50）+ 該週所有 `status: active` 追加金額加總；無累計倍數上限 | 移除固定天花板，改由管理者裁量並以稽核紀錄完整追溯 |
| 有效期限（到期規則） | 僅限指定使用者與核准當下所屬之 Asia/Taipei 週窗口；最晚於下一週一 00:00 前自動失效，不得延續到下一週，也不得由使用者或管理者手動延長超過週界 | 符合 FR-038；避免永久豁免；到期由後端窗口計算，不由前端或管理者輸入的日期決定 |
| 適用範圍 | 預設六端點共用同一 weekly pool，不做單端點豁免；圖磚代理額度（§6.6）為獨立資源，不受此追加影響 | 簡化第一版；若需限制特定端點或納入圖磚，需 UX 與 contract 額外呈現 |
| 日上限 | 不變；追加只增加本週可用週額度，當日 US$3／US$10 上限不受影響 | 符合 canonical spec |
| 每次追加操作要求 | 須由可信管理者於後端操作；輸入正值金額；指定適用 `weekWindowKey`；帶 `idempotencyKey`；以 shared store 原子更新該週額度；記錄 `adminSubject`、`createdAt`、`targetIdentitySubject`、`amountUsd`、`reasonCode` | 對應 FR-037／FR-038／FR-041 |
| 重複操作與競態防護 | 同一 `idempotencyKey` 只套用一次；不同管理者對同一使用者同一週分別以不同 `idempotencyKey` 建立的追加，皆各自累加至週累計，不視為衝突（因已無次數或倍數上限）；shared store 須以原子操作（如 Lua script／transaction）序列化「讀取累計→寫入新累計」，避免併發讀改寫造成遺失更新 | 對應 FR-037／SC-010；因移除次數上限，語意由「拒絕第二筆」改為「原子累加」 |
| 更正／撤銷 | 管理者可對個別 `topUpId` 執行撤銷（`status: active → revoked`）；撤銷後該筆金額立即自週累計上限移除，僅影響後續新預留判斷；**已完成之 `settled` 結算與已存在之 `reserved` 預留不追溯作廢**，避免撤銷造成使用中請求被回溯拒絕；若撤銷後 `used + reserved` 已超過新（較低）週上限，僅擋新的預留，不影響已存在的 reserved／settled 金額 | 對應 FR-037／FR-041；避免撤銷造成不一致或需要複雜回滾 |
| 管理者可信來源 | 第一版推薦 M1 server-side allowlist；M2 作後續可稽核擴充 | 最小依賴，避免前端自報提權 |
| 稽核欄位 | `auditId`、`idempotencyKey`、`adminSubject`、`targetUserId`、`action`、`amountUsd`、`cumulativeWeeklyTopUpUsd`（該筆生效當下的週累計）、`scope`、`effectiveWeekKey`、`createdAt`、`reasonCode` | 能追溯每筆追加與撤銷，含當下累計金額；不記錄完整對話、音檔、影像、token、secret |

**同週多次追加範例**（示意用途，非上限規則；日上限仍獨立有效）：

- 第一級：base weekly US$15。管理者本週對同一使用者分別核准兩筆追加 US$10 與 US$8（次數與金額皆無上限），週累計 = US$15 + US$10 + US$8 = **US$33**。當日仍受 US$3 上限限制：即使週剩餘充足，若當日已用滿 US$3，該日仍回 `429 DAILY_QUOTA_EXHAUSTED`，直到隔日重置。
- 第二級：base weekly US$50。管理者本週分三次追加 US$20、US$15、US$25，週累計 = US$50 + US$20 + US$15 + US$25 = **US$110**。當日仍受 US$10 上限限制：當日用滿 US$10 後，即使週剩餘遠大於 0，仍回 `429 DAILY_QUOTA_EXHAUSTED`，直到隔日重置。

**額度顯示**：quota snapshot 之 `weekly` 至少包含 `baseLimitEstimatedUsd`、`cumulativeTopUpEstimatedUsd`（該週所有 active 追加加總）、`usedEstimatedUsd`、`reservedEstimatedUsd`、`remainingEstimatedUsd`；管理者儀表板須顯示個別追加筆數與各筆金額，不得只顯示加總後數字。

### 5.3 風險與營運提醒（無週追加累計上限）

- **無法僅靠個人週額度保證整站帳單上限**：移除次數與倍數上限後，單一使用者之週有效額度理論上可被管理者逐次追加至任意金額；個人日／週額度機制僅能限制「單一使用者在單一日／週窗口內」的估算用量，不構成整站（所有使用者加總）估算成本或供應商實際帳單之上限保證。此點必須在管理者儀表板與內部文件中如實揭露，不得暗示或宣稱週追加已被限制為固定上限。
- **管理者操作提醒（部署決策待後續）**：建議在管理者儀表板追加表單顯示「本次追加後之週累計金額」與「此使用者近期累計追加次數／金額」供管理者參考判斷，但這只是提示，不是後端強制上限；是否加入軟性警示（例如單日追加總額異常提醒）留待後續部署決策，本階段不實作或承諾。
- **供應商帳戶用量監控**：仍需獨立於 App 內估算之供應商帳戶層級用量告警或預算上限（OpenAI、Google Places、Geoapify），作為整站實際帳單的最終防線；App 內個人額度與供應商帳戶監控是兩層不同機制，不得互相取代。
- **緊急暫停方案（供後續部署決策）**：建議保留由可信管理者手動將特定使用者核准狀態設為 `revoked`，作為異常追加或異常用量之應變手段；若需全域緊急暫停開關，須另案批准，本階段僅記錄此需求方向，不建立新的全站停止旗標，不得與已撤回的「全站軟／硬停止」政策混淆。
- **不得暗中恢復固定上限**：任何後續實作、contract 或程式碼皆不得未經營運者重新批准就悄悄恢復「每週最多一次」或「最多 1× base weekly limit」等已撤回之固定上限設計。
- **不得宣稱供應商告警等於硬性阻擋**：供應商帳戶用量告警／預算通知多為事後或非即時生效，不能保證在達到門檻的當下就攔截下一筆請求；App 內原子預留與日／週額度機制才是唯一在請求當下可信的攔截點，供應商層級監控僅作為輔助與人工介入依據。

## 6. Geoapify 圖磚代理（本次已同意之 Plan 架構方向）

**狀態**：後端圖磚代理（下稱 G1）、獨立 credit/request 額度、初始限額與 7 天 TTL 已核准，取代前一版「前端 gating best-effort、阻擋項 G-001 待決」的結論。Geoapify 實際帳戶設定、付費升級、秘密值與部署仍待獨立批准；本節不構成安裝、啟用或 Implement 授權。

### 6.1 現況分析（只讀核對，未變更）

- `NearbyScreen.tsx` 在 `!loading && !error` 時掛載 `NearbyMap`。
- `NearbyMap.tsx` mount 後立即以 `L.tileLayer('https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey={apiKey}', { attribution, maxZoom: 20 })` 建立 tile layer 並 `addTo(map)`；`apiKey` 讀自 `VITE_GEOAPIFY_API_KEY`，屬 frontend-visible key。
- 因為瀏覽器直接向 `https://maps.geoapify.com/...` 請求圖磚，請求不經過六個 serverless API 或任何本功能後端邊界；後端無法在每張圖磚前執行資格或額度檢查，也無法攔截已掛載舊分頁對 Geoapify 網域的直接請求。
- 這正是前一版阻擋項 G-001 的根因：前端 gating（不掛載受限狀態的 `NearbyMap`）可防止「新載入、受控狀態」初始化圖磚層，但無法對「已掛載且尚未重新整理或聚焦」的舊分頁強制執行「狀態變更後零請求」。

### 6.2 端點設計：後端圖磚代理

- **路徑**：`GET /api/map/tile/{z}/{x}/{y}.png`（z/x/y 為 Slippy Map XYZ 座標；副檔名固定 `.png`）。
- **上游樣式固定**：伺服器端寫死對應既有視覺的單一 Geoapify 樣式 `osm-bright`（與現行 `NearbyMap.tsx` 相同），前端不可傳入 `style`、host、protocol 或任何足以指定其他上游位置的參數；避免代理淪為可被使用者導向任意上游的 open proxy 或 SSRF 入口。
- **API Key 位置**：Geoapify API key 只存在於伺服器端環境變數；不再透過 `VITE_GEOAPIFY_API_KEY` 暴露於前端 bundle。既有 `VITE_GEOAPIFY_API_KEY` 慣例（見 repo 記憶）在此設計下屬待撤換項目，須於已批准 Implement 階段處理，本 Plan 不現在變更。
- **前端唯一合法路徑**：`NearbyMap`（Implement 階段）改為對 `/api/map/tile/{z}/{x}/{y}.png` 建立 Leaflet `tileLayer`，不得保留任何指向 `maps.geoapify.com` 的直連 URL、fallback 或除錯開關，避免留下可繞過代理的直連路徑。

### 6.3 逐請求驗證管線（GET，高頻、無副作用）

圖磚請求與六個付費 API 不同——它是高頻、冪等的 GET，不適用「原子預留＋結算」的完整 pipeline，但仍需逐請求授權與有界用量控制：

1. **Method 檢查**：非 `GET` 回 `405 METHOD_NOT_ALLOWED`。
2. **座標邊界檢查**：`z` 必須是 `0`–`20` 的整數（對齊既有 `maxZoom: 20`）；`x`、`y` 必須是滿足 `0 <= x, y < 2^z` 的整數；不符合格式回 `400 INVALID_TILE_COORDINATE`，不呼叫上游。可另加寬鬆的關東地區 bounding box 檢查（而非嚴格鎖死東京行政界線，避免使用者平移地圖到鄰近地區時被誤拒），超出邊界回同一 400 語意。
3. **Session 查驗**：與六端點共用同一 Session 查驗邏輯；缺失、過期、已登出回 `401 AUTH_REQUIRED`，不呼叫上游、不查快取。
4. **核准資格查驗**：非 `approved`、已撤銷、已到期回 `403 ACCESS_NOT_APPROVED`，不呼叫上游、不查快取（即使該圖磚已在代理快取中存在有效副本，也不得回傳給不合格身分）。
5. **六端點日／週 US$ 額度「全域可用性」查驗（定義見 §4.5）**：以 shared store 的權威 quota snapshot 計算 `remaining_day` 與 `remaining_week`，**僅在 `remaining_day < G` 或 `remaining_week < G`**（`G ＝ min_e R_max,e`）時視為額度不可用：日不可用回 `429 DAILY_QUOTA_EXHAUSTED`，週不可用回 `429 WEEKLY_QUOTA_EXHAUSTED`（皆 `quotaScope: 'all'`），並在查快取前拒絕。**不得**以任何單一端點（例如 speech 的 `R_max`）的預留是否成功作為判斷；某一昂貴端點無法預留時，圖磚仍可服務。圖磚本身不預留或扣除 US$ 額度。
6. **每位使用者圖磚代理請求計數**（見 §6.6）：以 shared store 原子遞增並檢查「短時 rate」與「每日 volume」；此計數涵蓋所有抵達代理且通過 Session／核准／日週額度檢查的圖磚請求，包含代理共用快取命中、瀏覽器條件式請求與後續可能回 304 的請求。超過回 `429 MAP_TILE_QUOTA_EXHAUSTED`，不查快取、不呼叫上游。
7. **代理端共用快取查詢**：以 `(style, z, x, y)` 為 key 查詢伺服器端共用快取；命中且未過期時，依 `If-None-Match` 可回 `304 Not Modified` 或回 `200` 圖磚位元組。快取命中次數單獨計為 `sharedCacheHitCount`，不消耗 Geoapify credits，但仍已計入第 6 步的個人代理請求計數。
8. **快取未命中時全站上游 credits 原子預留**：在任何 Geoapify 呼叫前，以 shared store 對當日 site-wide upstream credit window 原子預留 0.25 credit；預留失敗回 `503 PROTECTION_SERVICE_UNAVAILABLE`，不得呼叫上游。Free plan 標稱 3,000 credits/day 不是帳戶硬上限，因此此 App 內上限只是防護性預算閘門，仍須另驗證帳戶方案與供應商端限制。
9. **呼叫 Geoapify 上游**：以伺服器端 API key 呼叫 `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=...`；回應大小超過保守上限（建議 512KB／單張 256×256 PNG）即中止並回 `502 UPSTREAM_RESPONSE_INVALID`；逾時（建議初始 3s，上限不得超過 serverless duration）回 `503 PROTECTION_SERVICE_UNAVAILABLE`。
10. **併發與 request coalescing**：同一 tile key 短時間內的多個並發未命中請求，必須共用單一 in-flight 上游請求；等待者不得各自再預留 0.25 credit 或重複呼叫上游。若 coalescing lock 取得失敗，請求可短暫等待已在途結果，逾時則回 503，不放大上游請求。
11. **結算、寫回快取並回應**：成功取得上游圖磚時，預留轉為 `settled`、`actualUpstreamRequestCount += 1`、`estimatedGeoapifyCredits += 0.25`，寫入共用快取並設定 TTL（見 §6.4）；明確未送達上游或明確未計費失敗可釋放預留；逾時、連線中斷或不確定供應商是否已計費時，預留保守轉為 `uncertain` 並計入當日防護性 credit 使用，不得立即恢復額度。
12. **稽核與日誌**：只記錄 `identitySubject`、`endpoint = map_tile`、`z`（不需記錄精確 x/y 以免變相記錄使用者瀏覽路徑細節，除非另有稽核需求）、`cacheHit`（boolean）、`httpStatus`、`createdAt`；不得記錄圖磚影像本身或完整 URL query string（避免意外記錄 key）。

未通過第 1–6 步的請求，一律不得觸發第 7–11 步（即不得查快取、不得呼叫 Geoapify）。快取 miss 未完成第 8 步全站 credits 預留者，也不得觸發第 9 步。這是圖磚代理相對於現行前端直連架構的核心改善：**任何一筆抵達代理並完成上述檢查的圖磚請求，都會在當下即時反映最新 Session／核准／日週 US$ 額度與圖磚額度狀態，而不是仰賴前端是否記得先查詢 eligibility**。

### 6.4 快取政策：代理端、瀏覽器端與 Service Worker

- **代理端共用快取**：允許依 Geoapify 官方政策快取與再散布圖磚（見 §6.6 來源查核）。初始 TTL 已核准為 7 天；因 Geoapify 官方說明其底層地圖資料每月更新一次，過短 TTL 對地圖準確性沒有實益，只會增加不必要的上游呼叫與成本。後續調整須以命中率與新鮮度證據重新審查。
- **瀏覽器端 Cache-Control**：代理回應應設定 `Cache-Control: private, no-cache`（而非 `no-store`）並附 `ETag`。`no-cache` 允許瀏覽器保留位元組以節省頻寬，但正常重新使用快取項目前必須先送出條件式請求（`If-None-Match`）到代理；代理在回應 304 之前，仍會先執行第 3–6 步的 Session／核准／日週 US$ 額度／圖磚額度檢查。撤銷或額度耗盡後，代理必須回 401/403/429，不回 304、不夾帶圖磚位元組。
- **瀏覽器歷史快取邊界**：MDN 說明 `no-cache` 不保證瀏覽器 back/forward cache 或歷史導覽一定重新驗證；因此驗收語意不得說「已顯示圖磚會消失」。保證範圍限於「撤銷後新發出並抵達代理的請求」與「重新使用快取圖磚時送出的條件式請求」。已顯示圖磚、瀏覽器歷史快照與撤銷前完成的回應不宣稱可追回。
- **Vercel CDN 與中介快取**：不得使用 `public`、`s-maxage`、`CDN-Cache-Control: max-age`、`Vercel-CDN-Cache-Control: max-age` 或任何會讓 CDN 直接回應圖磚的設定。建議同時回 `CDN-Cache-Control: no-store` 與 `Vercel-CDN-Cache-Control: no-store`，並以 Vercel `x-vercel-cache: MISS/BYPASS`、無 `s-maxage`、無 CDN cache hit 作為隔離證據。Vercel 官方文件列明含 `private`、`no-cache` 或 `no-store` 的 response 不符合 CDN cacheable criteria；不得只因 response header 寫了 `private, no-cache` 就把驗收標 PASS，仍需以 Network/HAR 與後端 mock/log 證明每筆條件式請求抵達代理且先授權後才回 304/200。
- **Service Worker**：圖磚代理路徑落在 `/api/` 之下，直接沿用既有 FR-028「PWA 不得快取 `/api/` 回應」的排除規則；本 Plan 不需新增 PWA 快取規則，但須在 Implement 階段確認既有 Service Worker 的 `/api/` 排除邏輯確實涵蓋 `/api/map/tile/*`（含查詢字串與路徑參數變化）。
- **離線行為**：離線時瀏覽器連 Service Worker 都無法連上代理，圖磚請求會直接失敗；`NearbyMap` 沿用既有 `tileerror` 事件處理，不新增離線特例。

### 6.5 撤銷與舊分頁：精確保證邊界

圖磚代理把 G-001 從「前端 best-effort、無法承諾」轉為「後端逐請求授權、有明確且可解釋的殘餘限制」，但仍必須精確區分三種情形，不得含糊宣稱「已交付內容也能追回」：

1. **新的代理請求會被拒絕（可保證）**：撤銷、到期或額度耗盡生效後，下一筆抵達 `/api/map/tile/*` 並完成 Session／核准檢查的請求，一律得到 401/403/429，不會查快取、不會呼叫 Geoapify、不會回傳圖磚位元組。因 `Cache-Control: private, no-cache` 讓瀏覽器在正常重新使用快取圖磚時送出條件式請求，這個保證同時涵蓋「已掛載但未卸載的舊分頁」在其下一次平移／縮放／重新取得圖磚時的行為；瀏覽器歷史快照與已顯示圖磚仍不在此保證範圍內。
2. **撤銷生效前已送達代理、且代理已完成處理並回應的請求（無法追回）**：任何伺服器架構都無法讓「已經送出且已經完成」的網路回應被撤銷；這與 Session 撤銷後其他 API 的「下一次請求拒絕」語意一致，不是圖磚代理特有的缺陷。
3. **裝置上已經呈現或快取的圖磚影像位元組（無法遠端清除）**：一旦圖磚位元組已進入瀏覽器記憶體、磁碟快取或畫面渲染，本設計與任何前端架構一樣無法遠端刪除或使其在使用者裝置上失效；只能保證「下一次要新取得或重新驗證同一圖磚時」被拒絕。這與規格既有「已下載或已快取內容不宣稱可遠端收回」的原則一致。

Plan 對外的精確用語建議：「圖磚代理保證撤銷或額度耗盡後，下一筆抵達代理且完成授權檢查的圖磚請求必然被拒絕，不會產生新的 Geoapify 上游呼叫；但無法追溯撤回撤銷生效前已完成的請求或已呈現於裝置上的圖磚影像。」不得宣稱「絕對物理零殘留」。

### 6.6 圖磚成本控制：獨立、有界的圖磚額度（不併入 US$ 日／週預算）

**官方查核（2026-09-25，Geoapify 官方文件）**：

| 事實 | 來源與查核結果 |
| --- | --- |
| 計費單位 | Geoapify 以「credit」為通用計費單位；1 次圖磚請求 = 0.25 credit（100 張圖磚 = 25 credits） |
| Free plan | 3,000 credits／日（帳號層級，非每位使用者），即最多 12,000 張圖磚請求／日；可用於正式／商用專案，超額為 soft limit（Geoapify 會聯絡要求升級，非立即阻擋） |
| 付費 plan 範例 | API 10：US$59／月、10,000 credits／日（40,000 張圖磚／日）；API 25／API 50／API 100 依用量遞增 |
| Rate limit | Free plan 一般 API 上限約 5 requests/sec；圖磚請求較輕量，官方 FAQ 說明圖磚可用約 4 倍於一般 API 的速率換算（約 20 requests/sec 量級） |
| 快取／再散布政策 | 官方明確允許快取、儲存與再散布產生的圖磚（"Can I cache or redistribute map tiles? Yes"），且說明底層地圖資料每月更新一次 |
| 歸屬（attribution） | Free plan 需顯示 Geoapify 及 OpenStreetMap／OpenMapTiles 歸屬；付費方案可選 White label 略過 Geoapify 歸屬 |
| 未確認事項 | 目前查得之 Geoapify 官方頁面未提供任何「短效 tokenized tile」或供應商端逐請求撤銷能力；因此撤銷仍必須完全由本代理（而非 Geoapify 本身）強制執行 |

**三種已核准計數口徑**：

| 計數 | 英文欄位建議 | 何時增加 | 用途 | 是否消耗 Geoapify credit |
| --- | --- | --- | --- | --- |
| 每位使用者向代理提出的請求次數 | `userProxyRequestCount` | 通過 Session／核准後、第 5 步原子計數；包含快取命中、條件式請求與 304 | 個人短時 rate limit、個人每日 volume、防濫用與公平性 | 否，不一定 |
| 共用快取命中次數 | `sharedCacheHitCount` | 第 6 步代理共用快取命中，含 200 from cache 或 304 | 衡量快取效益與容量 | 否 |
| 實際上游請求與預估 credits | `actualUpstreamRequestCount` / `estimatedGeoapifyCredits` | 第 8 步確實呼叫 Geoapify，或第 10 步不確定是否計費而保守結算 | 全站 Geoapify 防護性 credits 上限、帳戶方案規劃 | 是，1 request = 0.25 credit |

個人短時／每日限流必須涵蓋快取命中，否則單一使用者可藉由熱快取對代理造成高頻負載；全站上游 credits 上限只在快取 miss 且準備呼叫 Geoapify 前預留，避免把不耗供應商成本的 cache hit 錯算為 Geoapify credit。所有上游 credit 預留與結算必須是 shared、atomic、cross-instance 的操作；serverless instance 記憶體不得作為權威計數。

**已核准結論與初始基準**：

1. **圖磚成本不可靠折算為 US$ 上界，故不併入既有第一／第二級每人日／週 US$ 預算**：Geoapify Free plan 以「帳號層級 credits／日」計費，不是每位使用者的美元單價；即使升級付費方案，其定價也是整體 credits／月的月費（例如 US$59／月 = 10,000 credits／日），並非可直接切分給單一使用者、單一請求的可信 USD 上界。若日後改用有明確每 credit 美元價格的方案，才適合換算並併入既有六端點 US$ 預算；在此之前，把圖磚硬套進 tier1/tier2 的 US$3–US$10 日額度或 US$15–US$50 週額度，會混淆「已核准的六端點成本模型」與「未驗證的圖磚換算假設」。
2. **改為獨立、有界的圖磚額度＋供應商端用量控制**，建議三層：
    - **全站每日上游 credits 上限（防護性、site-wide）**：初始建議若帳戶仍為 Geoapify Free，App 內預留上限設為 2,400 credits/day（約 9,600 次上游圖磚請求，Free 標稱 3,000 credits/day 的 80%），為 Places、人工測試、估算誤差與供應商 soft-limit 行為保留 20% 安全邊際；一旦達到，全站圖磚代理回 `503 PROTECTION_SERVICE_UNAVAILABLE`，既有互動地圖切換為與六端點一致之「防護服務暫時無法確認使用狀態」靜態示意圖／錯誤狀態。若營運者批准 Geoapify API 10（US$59/月、10,000 credits/day），建議 App 內上限可提升至 8,000 credits/day（約 32,000 次上游圖磚請求）。
    - **每位核准使用者圖磚代理請求上限（rate + volume）**：初始建議每位使用者 120 proxy requests/minute、1,000 proxy requests/day，且兩者都包含代理快取命中與 304。120/min 可覆蓋初始載入、快速平移與縮放突發；1,000/day 約等於 20 個中等互動 map sessions（每 session 50 張 proxy tile request），遠高於正常旅遊查詢但可阻擋腳本化掃圖。超過回 `429 MAP_TILE_QUOTA_EXHAUSTED`，不查快取、不呼叫上游。
   - **供應商帳戶層級防線**：獨立於 App 內計數，於 Geoapify 帳戶設定用量提醒或方案升級門檻，作為 App 內圖磚額度失準時的最後防線；此為既有 FR-019／FR-030 精神在圖磚上的延伸，具體門檻待帳戶擁有者設定。
3. **共用代理快取是主要成本控制槓桿**：因官方明確允許快取與再散布，且東京核心範圍加上限定的縮放層級，理論上相異 `(z, x, y)` 組合數量有限；同一張圖磚被多位使用者、多次瀏覽重複命中時，只有第一次未命中會消耗 Geoapify credit，後續命中一律為代理端命中、零額外供應商成本。這使得即使核准使用者人數增加，圖磚代理對 Geoapify 帳號的實際請求量也遠低於「使用者數 × 平移次數」的天真估算。
4. **共用快取 TTL 初始建議 7 天**：Geoapify 官方說明底層資料約每月更新一次；7 天 TTL 能讓東京核心熱門圖磚在一週內重複命中，同時保留比月更新更保守的新鮮度。TTL 到期只影響代理共用快取，瀏覽器端仍需 `private, no-cache` 逐次重新驗證授權。若營運者優先降低 Geoapify 成本，可提案升至 14 天；若優先資料新鮮度，可降至 24 小時，但須接受上游 credits 上升。
5. **本節之獨立 credit／request 額度、Free 初始 2,400 credits/day、每人 120/min 與 1,000/day、7 天 TTL 已核准為初始基準。** 這不核准 Geoapify API 10 付費升級，也不把公開 pricing 當成實際帳戶證據；實作後仍須依隔離測試與 dashboard 證據校正，任何提高上限或付費升級須另行批准。

**圖磚載入量與快取敏感度試算（待測，估算用）**：Geoapify 官方建議粗估公式為 `map width * map height / (256 * 256) * users * activity coefficient`，且官方文件例示 800×600 約 8–10 tiles、1200×800 約 15–20 tiles。本 Plan 以「一次旅遊查詢 map session」約 30／50／80 張 proxy tile requests 作為低／中／高互動估算，已包含初始載入與少量平移縮放。

| 情境 | 假設 | 每日 proxy tile requests | 快取命中率 | 實際上游 tile requests | 預估 credits/day | 對 Free 3,000 credits/day 的解讀 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 低 | 20 位核准使用者 × 2 sessions × 30 tiles | 1,200 | 80% | 240 | 60 | 充裕；主要驗證授權與快取行為 |
| 中 | 100 位 × 3 sessions × 50 tiles | 15,000 | 70% | 4,500 | 1,125 | 落在建議 2,400 credits/day App 上限內 |
| 高 | 300 位 × 4 sessions × 80 tiles | 96,000 | 85% | 14,400 | 3,600 | 超過 Free 標稱；需 API 10 或降低個人/全站上限 |
| 高且快取較差 | 300 位 × 4 sessions × 80 tiles | 96,000 | 60% | 38,400 | 9,600 | 接近 API 10 10,000 credits/day；不建議 Free |

敏感度：同樣 15,000 proxy tile requests/day 時，50% hit = 1,875 credits、70% hit = 1,125 credits、90% hit = 375 credits。初期營運應每日比對 `userProxyRequestCount`、`sharedCacheHitCount`、`actualUpstreamRequestCount` 與 Geoapify dashboard 帳戶用量；若差異超過 10%，需先調查計數、retina tile、重試、供應商統計延遲與其他 API 使用量，再調整額度。

**超額後繁體中文 UI 行為（待 UX 批准）**：

| 後端狀態 | 建議 UI 文案 | 地圖狀態 |
| --- | --- | --- |
| 429 `MAP_TILE_QUOTA_EXHAUSTED` | `今天的互動地圖載入次數已達上限。你仍可查看下方地點清單，或稍後再試。` | 地圖可保留已顯示內容；新圖磚失敗處顯示局部錯誤，不呼叫 `/api/places` |
| 503 `PROTECTION_SERVICE_UNAVAILABLE`（全站 credits 或 shared store 無法確認） | `防護服務暫時無法確認地圖使用狀態。你仍可查看東京百科與已公開內容。` | 切換靜態示意圖；不得嘗試直連 Geoapify |
| 401/403 | `請先登入並取得核准後，再使用互動地圖。`／`此帳號目前未核准使用互動地圖。` | 靜態示意圖；不掛載 `NearbyMap` |

**實際帳戶方案與供應商端限制驗證（待營運者執行）**：登入 Geoapify dashboard，擷取目前 plan、daily credits、rate limit、billing currency、white label/attribution 狀態、usage alert 或 soft-limit 說明；以低量測試呼叫比對 dashboard 計數與 App `actualUpstreamRequestCount`；不得把公開 pricing 頁面的 3,000 credits/day 當作本專案帳戶已設定的 hard cap。

### 6.7 地圖 UX 狀態機（更新版：含代理層拒絕）

沿用前端 gating 作為第一層使用者體驗（避免受限狀態的使用者看到不必要的地圖初始化閃爍），但實際授權保證改由代理逐請求驗證：

| 情境 | 前端層行為 | 代理層保證 |
| --- | --- | --- |
| 首次進入探索附近 | 先查 `eligibleForInteractiveMap`；受限顯示靜態示意圖，合格才 mount `NearbyMap` | 即使前端誤判合格而 mount，代理仍逐請求驗證，不合格得到 401/403，不呼叫上游 |
| 重新整理 | 查詢完成前顯示非互動 placeholder | 同上 |
| 舊分頁恢復（未重新整理） | `visibilitychange`/focus 時重新查 eligibility 並視情況 unmount | 即使前端沒有主動 unmount，該分頁下一次平移／縮放觸發的圖磚請求仍會被代理依當下狀態拒絕 |
| 資格撤銷／到期 | 下一次 eligibility 查詢或 API 403 後 unmount，顯示靜態示意圖 | 下一筆圖磚請求 403，不查快取、不呼叫上游 |
| 使用者日／週 US$ 額度全域不可用（六端點，定義見 §4.5：`remaining < G`） | unmount 互動地圖並切換靜態示意圖；不得自動重送舊搜尋 | 下一筆圖磚請求回對應 `429 DAILY_QUOTA_EXHAUSTED`／`WEEKLY_QUOTA_EXHAUSTED`（`quotaScope: 'all'`），不查快取、不呼叫上游；圖磚不扣 US$，但互動地圖 eligibility 受此 gate 約束 |
| 某一端點的最大預留超過剩餘（`G ≤ remaining < R_e`，例如剩餘 US$0.20 時 speech 500 字） | 地圖維持互動；僅該功能區塊顯示「目前剩餘額度不足以處理這次請求」並引導縮短內容；其他功能不受影響 | 該端點 429（`quotaScope: 'request'`）；圖磚代理正常服務，不受影響 |
| 使用者圖磚額度耗盡（§6.6 每位使用者上限） | 沿用地圖仍掛載，但圖磚載入失敗；`NearbyMap` 既有 `tileerror` 處理可顯示局部錯誤，不必等同全頁級靜態示意圖切換 | 代理回 429，不查快取、不呼叫上游 |
| 全站圖磚防護性上限觸發（§6.6） | 建議整頁面地圖切換為靜態示意圖並顯示既有「防護服務暫時無法確認使用狀態」文案，與六端點 503 一致 | 代理回 503，不呼叫上游，不論個別使用者資格為何 |
| 離線恢復 | 未重新確認前不得掛載互動地圖；離線時任何圖磚請求本就無法送達代理 | 不適用（無網路） |

### 6.8 剩餘外部阻擋與驗證事項

- 圖磚代理已解決 G-001 的核心訴求（「下一筆抵達代理的請求必然反映最新狀態」），但仍不能宣稱「狀態變更當下瞬間，物理上不存在任何殘留圖磚位元組」；此為所有架構共通限制，須在對外驗收語意中如實反映（見 §6.5 與下方 Specification Sync 建議）。
- `Cache-Control: private, no-cache`、7 天代理共用快取 TTL 與獨立 credit／request 額度已核准為初始基準；實作後仍需 Network/HAR、CDN 與命中率證據，不得因文件核准即標 PASS。
- Geoapify 實際帳戶方案、rate limit、usage alert 與 attribution 狀態仍待帳戶擁有者提供 dashboard 證據；API 10 付費升級仍待獨立批准。
- 全站防護性上限觸發時使用既有 503 防護服務文案並切換靜態示意圖；正式站啟用與部署仍另設 gate。

## 7. 靜態示意圖資產交付

聊天中產生的圖目前不在 repository（已於 2026-10-06 重新核對：`public/` 只有 `audio/`、`icons/`、`manifest.webmanifest`，無靠近示意圖的影像檔），不能宣稱已整合。後續 Implement 前必須建立以下任務與驗收，**資產交付項（都未完成）**：

| 交付項 | 內容 | 狀態 |
| --- | --- | --- |
| D1 原檔 | 由使用者將原始圖檔（建議保留最高解析度原始 PNG／最高品質輸出）放入本機 repository 指定位置；本聊天附圖不會自動進入 repository | **未取得** |
| D2 可用條件 | 記錄來源工具、產生日期、提示詞或來源、服務條款是否允許商用／再散布、是否須標示、是否含可辨識第三方商標或人像；由有權限人確認 | **未確認** |
| D3 最佳化 | 平面設計上輸出 mobile `4:3` 與 desktop `16:9` 兩組 WebP（含 JPEG fallback），預設以 1x／2x 兩段解析度；單檔預算建議 ≤ 150 KB（mobile）／≤ 250 KB（desktop）（建議值，需依實際像素確認）；禁止實作時自行重繪或重新生成 | 未執行 |
| D4 裁切驗證 | 在 `4:3` 與 `16:9` 以中心為焦點裁切後，主要東京街景元素不得僅位於邊緣；以 `public/` 內最終檔重新量測長寬比與主體位置，並以 Playwright 截圖（375×667 與 1280×720）作實機證據 | 未執行 |
| D5 整合／驗收 | T107–T109 與 SC-005、SC-011、SC-012 的 UI 驗收均依賴 D1–D4；在 D1–D4 完成前，任何 UI 驗收一律標為「阻擋」，不得標 PASS | **阻擋** |

其餘要求：

- 取得正式原檔，記錄來源與使用權；若為生成圖，保留生成來源、授權條款與可商用確認。
- 壓縮與輸出尺寸：至少提供 mobile `4:3` 與 desktop `16:9` 可裁切版本，確認主要東京街景元素不只位於邊緣。
- 整合路徑需在已批准 Implement 階段決定；本 Plan 不虛構檔名。
- 可見繁中標示「示意圖」由 UI 呈現，不依賴圖片內嵌文字。
- 替代文字：「東京街區風格示意圖，非即時地圖或真實地理資料。」
- 破圖 fallback：「地圖示意圖目前無法顯示，你仍可查看東京百科。」並保留前往公開內容操作。
- 禁止 pan/zoom、marker、導航、即時位置、地點點選或任何暗示真實地圖的 affordance。

## 8. PWA、公開靜態內容與正式站邊界

- 既有公開靜態內容與 PWA App Shell 維持公開；已下載公開內容不宣稱可遠端收回。
- `/api/` 私人回應與 credentials 不得進 PWA cache；新增 auth、quota、admin API 皆落在 `/api/` 排除邊界。
- 正式站模式切換、外部服務啟用、供應商帳戶預算告警／限制設定與部署，皆需獨立批准；本 Plan 不核准。
- API keys、OIDC secrets、shared store credentials、admin allowlist 不得進 frontend bundle 或 public source。

## 9. 官方資料查核（2026-09-25；OpenAI／Google Places 列已於 2026-10-06 重新查核）

| 來源 | 查核結果 | 未確認處 |
| --- | --- | --- |
| Vercel Storage overview（last updated 2026-09-03） | Marketplace storage 可提供 relational、key-value、NoSQL；Redis/key-value 適合 session storage 與 rate limiting | provider-specific 價格、region、原子 script 支援需選定供應商後查 |
| Vercel Request headers（last updated 2025-12-13） | `x-forwarded-for` 由 Vercel 覆寫，不轉發外部偽造 IP；Trusted Proxy 是 Enterprise 例外 | 本專案是否啟用 Enterprise Trusted Proxy 需帳戶確認，現有 repo 無證據 |
| Vercel Functions Limits（last updated 2026-08-24） | request/response payload 4.5 MB；Node/Bun/Python Hobby max duration 300s；成本依 active CPU/provisioned memory | 帳戶方案與實際函式區域、memory 設定需帳戶確認 |
| Vercel CDN Cache（last updated 2026-09-14） | Function response 若含 `private`、`no-cache` 或 `no-store`，不符合 CDN cacheable criteria；Vercel Functions 可用 response headers 控制 CDN/browser cache | 實作後仍需以 `x-vercel-cache`、Network/HAR 與後端 log 驗證未被 CDN HIT 直接服務 |
| Auth.js deployment（last updated 2026-06-12） | OIDC provider 需 client id/secret/issuer、serverless callback URL、`AUTH_SECRET` 或等效 secret；Vercel 可由平台環境推斷 trust host | 本專案非 Next app；是否採 Auth.js 或低階 OIDC library 需另行批准 |
| Upstash Redis pricing（查核 2026-09-25） | Pay as You Go：US$0.20/100K commands、前 1GB storage free、200GB bandwidth/month free；可設定 monthly budget；Prod Pack/SLA/HA 需付費 | 實際 atomic script/transaction、region、strong consistency 與月成本需 PoC 驗證 |
| MDN Cache-Control / ETag / If-None-Match（Cache-Control last modified 2026-09-17；ETag 2025-07-28；If-None-Match 2025-07-04） | `no-cache` 可儲存但 reuse 前需 revalidate；ETag/If-None-Match 支援條件式 GET 與 304；`no-cache` 不保證 bfcache/歷史導覽重新驗證 | 瀏覽器行為需以 Playwright/HAR 驗證，撤銷保證不得涵蓋已顯示圖磚或歷史快照 |
| OpenAI API pricing / models / deprecations / images guide（查核 2026-10-06，詳見 research.md R13） | `gpt-4o-mini` US$0.15 輸入／US$0.60 輸出（每 1M tokens，標準層級；Fast 層級 US$0.25／US$1.00）；`gpt-4o-mini-tts` 文字輸入 US$0.60、音訊輸出 US$12.00（每 1M tokens）、模型頁標示最大輸入 2,000 tokens；Whisper US$0.006／分鐘；`gpt-4o-mini` 影像為 tile 計價（base 2,833、每 tile 5,667；最長邊先縮至 ≤ 2048、最短邊縮至 ≤ 768）；官方公告 `whisper-1` 2027-02-26 停用，`gpt-4o-mini-tts-2025-03-20` 與 `gpt-4o-mini-tts-2025-12-15` 兩個 snapshot 2027-01-06 停用（建議替代 `gpt-realtime-2.1-mini`） | 未取得 TTS 音訊 token／秒的官方數值；本帳戶實際 usage 欄位、層級（標準／Fast）與折扣需實測；`max_output_tokens` 是否涵蓋 reasoning tokens 需以官方 reference 於實作前再核對 |
| Google Places data fields（last updated 2026-10-01）與 pricing（last updated 2026-09-14），查核 2026-10-06 | `editorialSummary` 於 Nearby／Text Search 皆屬 Enterprise + Atmosphere；Nearby／Text Search Enterprise + Atmosphere 首層 US$40/1000；`displayName`、`formattedAddress`、`location`、`businessStatus`、`types`、`id` 屬較低層級，但整個請求依欄位中最高層級計價 | 帳戶免費額度、折扣、稅、實際帳單彙整需帳戶確認 |
| Geoapify Map Tiles pricing／FAQ（apidocs.geoapify.com/docs/maps/map-tiles、www.geoapify.com/map-tiles、www.geoapify.com/pricing，查核 2026-09-25） | 1 次圖磚請求 = 0.25 credit；Free plan 3,000 credits/day（帳號層級，非每人）＝最多 12,000 張圖磚/日，可用於 production／commercial，超額為 soft limit；官方明確允許快取、儲存與再散布圖磚；地圖資料每月更新一次；付費 API 10 方案 US$59/月＝10,000 credits/day | 未查得任何 tokenized tile／供應商端逐請求撤銷能力；帳戶實際 rate limit、region 與是否啟用 White label 需帳戶確認 |

不得把舊草稿中的價格、服務可用性或供應商能力當成已驗證現況。

## 10. 已核准 Technical Plan 與獨立批准事項

### 10.1 已核准架構方案（不代表已建立帳戶、安裝套件、設定秘密值或啟用服務）

| 項目 | 首選方案 | 必要成本 | 故障時行為 | 最少必要設定 | 捨棄方案與取捨 |
| --- | --- | --- | --- | --- | --- |
| OIDC | Google OAuth/OIDC + 後端 Authorization Code + PKCE；實作層使用通用 OIDC client library（如 `openid-client`，套件需另行批准）並建立 app-owned opaque Session | Google OAuth/OIDC 本身無固定月費；需維護 Google Cloud OAuth consent/app；新增 npm dependency 待批准 | OIDC callback 或 token exchange 失敗時不建立 Session；受保護 API 回 401；既有 Public 靜態功能可用 | `OIDC_ISSUER`、`OIDC_CLIENT_ID`、`OIDC_CLIENT_SECRET`、callback URL、`SESSION_COOKIE_SECRET`、allowed redirect origins | Auth0/Clerk：功能完整但新增外部會員平台與潛在月費；自製密碼：安全負擔高；純 JWT 不查 store：撤銷不即時 |
| 共享計數／Session／邀請與核准資料 | Upstash Redis via Vercel Marketplace，Pay as You Go 起步；用 Redis hash/set/sorted set + Lua/transaction 實作 Session、approval、quota、tile counters、idempotency、invite/admin audit index | Upstash PAYG 官方價 US$0.20/100K commands，前 1GB storage free、200GB bandwidth/month free；可設定 monthly budget；Prod Pack/SLA/HA 需付費加購 | shared store 不可用時，六端點與圖磚代理 fail closed：401/403/429 無法可信判定則回 503，不呼叫上游；Public 靜態功能可用 | Vercel Marketplace Upstash resource、REST URL/token、monthly budget、region 靠近 Vercel function、Lua/transaction 支援驗證、備份/匯出策略 | Neon/Postgres：ACID 與查詢好，但 rate limiting/高頻 tile counters 成本與延遲較重；Vercel Global Config：讀取快但不適合高頻寫入與原子計數；記憶體：serverless 併發不可靠 |
| 管理者可信來源 | M1 server-side env allowlist，以 OIDC stable subject 列出初始管理者；shared store 可記錄 audit，但不可由前端 role 提權 | 無服務月費；需環境變數管理與部署流程 | allowlist 缺失或 parse 失敗時 fail closed：管理 API 回 403/503，不允許任何管理異動；一般 API 不受管理端開啟影響 | `ADMIN_SUBJECT_ALLOWLIST`、subject 格式驗證、雙人審核環境變更流程、管理操作 idempotency/audit | M2 store-backed admin record：可動態稽核但 bootstrap 複雜；OIDC group/claim：集中管理但 provider-specific 且需證明 claim 不可自助修改 |
| Geoapify 帳戶方案 | 初始以現有帳戶實際 plan 驗證為準；若預期達中高用量，建議批准 API 10（US$59/month、10,000 credits/day）作為營運方案；若仍在 Free，App 內上限維持 2,400 credits/day | Free 無月費但 soft limit；API 10 官方標價 US$59/month，稅費另計 | Geoapify 逾時／429／5xx 或 App 上游 credits 上限達標時，代理回 503 並切靜態示意圖，不直連或繞過 | dashboard plan 截圖、daily credits/rate limit、usage alert、API key server-side only、attribution/white-label 狀態 | 直接依 Free 3,000 credits/day 當硬上限：官方說明是 soft limit，不足以作營運保證；Custom dedicated server：起步過重 |

### 10.2 決策狀態與驗證缺口

**2026-10-07 T002狀態維護**：既有架構、兩級額度、追加、Session／週鍵、A2／A6／A8／A9／A10方向與圖磚初始控制不重問；L1～L5本機實作授權持續有效。剩餘數值／契約／外部操作集中於[Readiness決策包](readiness-decisions.md)，其中新增建議仍待批准，不取代本Plan或正式契約。已存在REST transport，不需為Redis取證新增SDK；具體OIDC library binding尚未實作、新dependency仍需獨立批准。真實資源、region／budget、OAuth app／callback／subject、正式secret／env、付費、提交／推送／部署／模式切換均未授權。下表的歷史缺證據描述不撤回最新本機成果；完整本機／正式分類見集中包剩餘任務表。

| 決策項 | 核准基準 | 估算依據 | 成本／風險 | 決策狀態 | 仍缺證據 |
| --- | --- | --- | --- | --- | --- |
| 圖磚計數口徑 | 分離 `userProxyRequestCount`、`sharedCacheHitCount`、`actualUpstreamRequestCount/estimatedGeoapifyCredits` | Geoapify credit 只對上游 tile request；個人限流需防代理濫用 | 實作需 shared atomic counters；資料儀表板需避免混淆 | **已核准** | Implement 後 mock/log 與 dashboard 對帳 |
| 每人圖磚 rate | 120 proxy requests/minute，包含 cache hit/304 | Geoapify 800×600 約 8–10 tiles、1200×800 約 15–20 tiles；快速平移縮放保留突發 | 太低會影響地圖體驗，太高增加代理負載 | **初始值已核准** | 真機 Leaflet/HAR 載入量 |
| 每人每日圖磚 volume | 1,000 proxy requests/day，包含 cache hit/304 | 約 20 個中等 session × 50 tiles | 高用量使用者可能提前遇限；腳本化掃圖被限制 | **初始值已核准** | beta 使用者實際分布 |
| 全站每日上游 credits | 現有 Free 帳戶驗證前採 2,400 credits/day；若另行批准 API 10 升級則採 8,000 credits/day | Geoapify Free 3,000/day、API 10 10,000/day；保留 20% buffer | Free 為 soft limit，不保證硬擋；太高可能收到升級要求 | **Free 初始值已核准；API 10 付費升級待獨立批准** | Geoapify dashboard plan/rate limit/alert 證據 |
| 共用快取 TTL | 7 天 | Geoapify 地圖資料約每月更新；官方允許 cache/store/redistribute | TTL 長資料較舊；TTL 短 credits 升高 | **初始值已核准** | 一週快取命中率統計 |
| 瀏覽器/CDN/SW 快取 | `Cache-Control: private, no-cache` + `ETag`；`CDN-Cache-Control: no-store`；`Vercel-CDN-Cache-Control: no-store`；SW 排除 `/api/` | MDN no-cache/ETag/If-None-Match；Vercel CDN 不快取 private/no-cache/no-store；現有 SW 排除 `/api/` | bfcache/已顯示圖磚不可追回；需測試隔離 | **已核准** | Playwright/HAR、`x-vercel-cache`、Cache Storage 證據 |
| 上游預留與結算 | cache miss 後、上游前原子預留 0.25 credit；成功 settle；不確定轉 uncertain 並保守占用 | Geoapify 1 tile = 0.25 credit；serverless 併發需 shared atomic | 不確定計費可能保守占用過多；需人工 reconcile | **已核准** | Geoapify 失敗/逾時是否計費的帳戶測試 |
| OIDC | Google OIDC + opaque Session | 單一 OIDC、低固定成本、stable subject 可 allowlist | OAuth consent/callback 設定錯誤會阻擋登入 | **架構已核准；套件安裝、OAuth app／callback／secret 啟用待獨立批准** | Google Cloud app 設定截圖與測試帳號 |
| Shared store | Upstash Redis PAYG via Vercel Marketplace | Redis 適合 session/rate limiting；Upstash PAYG US$0.20/100K commands | strong consistency 非全部場景保證；需 atomic script 驗證 | **架構已核准；resource／budget／region／credential 啟用待獨立批准** | 實測 Lua/transaction、延遲、月成本估算 |
| 管理者來源 | M1 env allowlist | 最小依賴、不可由前端自助提權 | 變更需環境流程；誤刪會鎖住管理端 | **架構已核准；真實 subject 與環境設定待獨立批准** | 實際 OIDC subject 取得方式 |
| 週追加政策 | 管理者對指定使用者、指定週逐次決定金額與次數，不設固定次數或累計倍數上限；日額度不變（見 §5.2／§5.3） | 避免固定上限限制管理者營運彈性；對齊 Asia/Taipei 週窗口 | 無累計上限代表無法僅靠個人額度保證整站帳單上限，需搭配管理者提醒、供應商用量監控與緊急曫停方案 | **已於 2026-09-25 由營運者核准**，不再待批准 | 並發／idempotency／跨週／同週多筆追加累加測試 |

供應商價格、條款與平台限制查核日期均為 2026-09-25；正式採購或部署前需重新查核官方頁面與帳戶 dashboard。

1. Google OIDC + opaque Session 與 M1 管理者來源架構已核准；新增套件安裝、真實 OAuth app、callback domain、管理者 subject、secret 與環境設定仍待獨立批准。
2. Upstash Redis-compatible shared store 架構已核准；真實 resource、budget、region、credential 與服務啟用仍待獨立批准。
3. 各端點必須具備最大估算成本上界、輸入／輸出限制、保守係數與 display precision；**2026-10-06 已於 §4.2 提出可實作、可測試的完整數值（待營運者核准，且 speech 音訊 token／秒與 transcribe 容器解析可行性仍待校正證據，見 §4.2.4）**；初始值可在隔離 mock 實作中驗證，正式供應商校正證據仍待外部條件。
4. 週追加政策已於 2026-09-25 由營運者核准：管理者對指定使用者、指定週逐次決定追加金額與次數，不設固定次數或累計倍數上限，日上限仍獨立有效（見 §5.2／§5.3 完整政策與風險描述）。本項不再列入待批准事項。
5. **圖磚代理（G1）、獨立 credit／request 額度、7 天 TTL、每人 120/min 與 1,000/day、Free 初始 2,400 credits/day、快取 header 與 503 降級已核准**；實際帳戶方案證據、API 10 付費升級與正式啟用仍待獨立批准。
6. 靜態示意圖正式資產來源與授權路徑。
7. 供應商帳戶層級預算告警或 hard limit 的具體門檻與驗證證據（含 Geoapify 帳戶用量提醒設定）。
8. `whisper-1` 下架前的轉錄模型遷移是否納入本功能之外的另案。
9. Node runtime 版本是否鎖定。
10. 正式站切換與部署是否完全延後至 Implement 後另行批准。
11. `/api/map/tile/*` 端點的座標邊界（z 範圍、關東 bounding box 寬鬆度）與回應大小上限的具體數字。

### 10.3 已核准架構 ≠ 已授權動作；本輪新增待批准決策；mock-first 範圍與外部證據（2026-10-06）

### 10.3.1 已核准架構／初始額度（開發規劃基線）與仍待獨立授權的實際動作

| 領域 | 已核准（規劃基線，僅文件層級） | 仍需獨立批准或證據的實際動作（各自為獨立關卡） |
| --- | --- | --- |
| 身分 | Google OIDC Authorization Code + PKCE＋app-owned opaque Session | 安裝具體 OIDC 套件（如 `openid-client`，新 dependency）；建立真實 OAuth app／callback domain／client secret；測試帳號 |
| Shared store | Upstash Redis-compatible store 架構與原子 script 需求 | 安裝具體 client 套件（如 `@upstash/redis`）；建立真實 Upstash／Vercel Marketplace resource；region、monthly budget、credential；啟用付費服務 |
| 管理者來源 | M1 env allowlist | 真實管理者 subject；環境變數設定 |
| 圖磚 | 代理架構、7 天 TTL、120/min、1,000/day、Free 2,400 credits/day 初始值 | Geoapify 實際方案證據；API 10 付費升級；API key 設定 |
| 六端點成本上界 | 公式與架構（§4.2）**自 2026-10-06 起為提案**，不是已核准 | 營運者核准 §4.2 數值（見 10.3.2）；真實供應商校正證據 |
| 啟用／切換 | — | 正式站模式切換、部署、供應商帳戶預算告警或硬上限設定、`/speckit.implement` 授權 |

### 10.3.2 決策 A1–A10：最新條文、建議數字、理由與批准狀態（2026-10-06）

狀態分類：**規劃已核准**＝方向已核准（非 implementation 授權）；**數值待核准**；**前提待證明**；**外部整合待驗證**；**撤回**＝被已核准決策取代，不再待決。

| ID | 最新條文 | 建議數字／內容 | 理由 | 批准狀態 |
| --- | --- | --- | --- | --- |
| A1 | 採用 §4.2.3 表一的 `S_e`、`R_e`（A＝1），以及 §4.2.1 的 pre-parse、timeout，並含自 A2 拆出的 OpenAI 呼叫參數：`max_output_tokens`（assistant 2,000／photo-ocr 3,072／photo-translate 4,096）、`detail: 'high'`、模型白名單（初始僅 `gpt-4o-mini`，`OPENAI_MODEL` 不在白名單即拒絕）。**不含 G（A8）、不含 transcribe／speech（A9／A10）** | `S_e`：OpenAI 2.0、Places 1.25；`R_e`（A＝1）：assistant 9,630、photo-translate 8,036、photo-ocr 19,398、places 50,000（µUSD）；pre-parse：16,384／16,384／4,200,000／2,048（assistant／photo-translate／photo-ocr／places）；timeout：OpenAI 30 s、places 8 s | 讓每次呼叫前有可信上界；係數吸收價表變動與層級加價 | **數值待核准**；上界前提（表二）**待證明**；供應商層級係數**外部整合待驗證** |
| A2 | OpenAI SDK 自動重試停用：每個呼叫 `maxRetries: 0`，規劃採 A＝1；**A＝3 撤回**。A2 其餘子項（`max_output_tokens`、timeout、`detail`、白名單）已移入 A1 數值 | `maxRetries: 0`；單次使用者操作上游嘗試數 ≤ 1（§4.2.6 待驗收要求） | SDK 預設 2 次重試使最壞成本 ×3；停用後預留較低且可預測；不確定計費時保守結算 | **規劃已核准**；「`maxRetries: 0` 生效且嘗試數 ≤ 1」**前提待證明**（T135、T126） |
| A3 | transcribe 單次錄音 ≤ 60 s；前端達 60 s 自動停止並提示；檔案上限隨 P1 為 1,920,044 B（1,920,000 B PCM 資料＋44 B 標準標頭）；統一取代先前 1 MiB 提案；不提供「接受容器偽造殘餘風險」選項 | 60 s；1,920,000 B 資料；1,920,044 B 檔案；multipart pre-parse 2,000,000 B | 60 s × 32,000 B/s ＝ 1,920,000；上限由 bytes 決定 | **數值待核准**（限制值**待核對**）；與 A10 一致 |
| A4 | photo-ocr：前端送出前縮圖至最長邊 ≤ 2,048、解碼後影像 ≤ 3 MiB、`MAX_IMAGE_BYTES` 由 10 MiB 降為 3 MiB | 3,145,728 B；base64＋JSON 包裝 ≤ 4,194,373 B（`regionVersion` ≤ 10 位）< 4,200,000 | 10 MiB 超過 Vercel 4.5 MB 平台上限而不可達；縮圖使 token 有上界 | **待核准**（對 002 既有行為有相容性影響） |
| A5 | places：`query` ≤ 100 字；`manualArea` ≤ 50；`editorialSummary` 欄位不動 | 100／50；pre-parse 2,048 B | 限制輸入邊界，不改產品欄位與 SKU | **待核准** |
| A6 | 保留 429 `quotaScope`（`all`／`request`）與既有 code；四種額度語意展開六列完整文案已同步 Spec／UX／error contract（成本模型無效仍為 503，不帶 quotaScope） | 日耗盡、週耗盡、below_floor 日／週、request 日／週；「已滿」只用耗盡，追加不保證恢復 | 不誤示全站不可用、不改 G-B、不讓前端推算或承諾恢復時間 | **已批准**；隔離證據已結案，UI／handler／正式整合仍未完成 |
| A7 | `whisper-1`（2027-02-26）與 `gpt-4o-mini-tts`（2027-01-06）停用的遷移另案處理，005 不更換模型；2026-10-06 官方 STT 指南已推薦 `gpt-transcribe`，亦屬另案 | 005 固定現有模型 | 範圍界定；改模型須同步價表與測試 | **待核准**；停用日期**實作前須重新查核** |
| A8 | 「全域不可用」門檻採 **G-B**：`G ＝ min { R_max,e ∣ e ∈ E_live }`，`E_live` 只含「有可信成本上界且實際啟用」的端點；受阻與僅 mock 端點不納入；§4.5.3 四類情況分開 | 規則核准；**無任何固定 G 數值**（8,036 僅 mock 測試資料，§4.5.4） | 與預留語意一致、不受受阻端點影響、可由價表旗標決定性測試 | **規劃已核准**；G 數值依賴 A1 與上界前提，**數值待核准、前提待證明**；G-A／G-C／G-D／G-E **撤回** |
| A9 | speech 維持受阻（S1）：真實呼叫對外回 503 `PROTECTION_SERVICE_UNAVAILABLE`（內部原因 `COST_BOUND_UNPROVEN`），可 mock；逾時、串流中止、經驗速率、校準值、帳戶預算**不得**當成計費上界 | `live: false` | 官方輸出上界**未查得** | **規劃已核准**；S2–S5 **撤回**；解除受阻須另提決策＋官方上界證據（**外部整合待驗證**） |
| A10 | transcribe 採 P1：前端固定格式 16 kHz／mono／16-bit PCM WAV；後端依 §4.2.4.1 驗證實際 PCM 並**重建** WAV；須完成可信後端驗證**及**瀏覽器可行性驗證才可 `live` | 1,920,000 B 資料；1,920,044 B 檔案；pre-parse 2,000,000 B（待核對） | 零新 dependency；上界由實際 bytes 決定，不信任 header | **規劃已核准**；後端驗證**前提待證明**；真實瀏覽器 16 kHz PCM **外部整合待驗證**；P2／P3／P4 **撤回** |

### 10.3.3 可先以 mock 完成的任務範圍（需 `/speckit.implement` 授權；不需任何外部帳戶、不新增 dependency）

所有工作僅用既有 Vitest、TypeScript 與自寫工具，不安裝套件、不連外、不讀秘密：

1. **成本模型與估算器**：價表常數、`R_e` 公式（A＝1）、`G`（G-B）的計算與四類情況判定、白名單、各端點限制與最壞情境單元測試（T126、T023、T131；T130 待端點 mock 接入）。
2. **額度引擎**：in-memory race-safe mock store 實作原子預留／結算／`Asia/Taipei` 窗口（T019–T022、T024；不得宣稱等同 Upstash 行為）。
3. **A＝1 單次嘗試鎖定**：SDK `maxRetries: 0` 與嘗試數測試（T135）。
4. **WAV PCM 驗證器**（A10＝P1 已規劃核准）：以合成 WAV 向量驗證 §4.2.4.1（T127）；真實瀏覽器 16 kHz PCM 錄製可行性屬外部證據，不在此範圍。
5. **Pipeline／端點限制、圖磚代理管線、前端行為、靜態示意圖元件**：皆使用 mock／jsdom，屬後續批次（§10.3.5 批次 2 以後）；正式資產整合不得標完成（T107–T109 仍阻擋）。

mock 成本引擎可用**明確標示的 fixture 價表**驗證原子性與判定分類，但**不得據此聲稱真實成本上界成立**；mock 證據也不得取代供應商 dashboard、Preview／production CDN、真實 OIDC callback、真實 Upstash 原子性、真實 Geoapify 計費或 `speech` 校正證據。

### 10.3.4 真實整合缺少的帳戶／外部證據清單

| 項目 | 需要的證據 | 持有者 | 目前狀態 |
| --- | --- | --- | --- |
| Google OAuth／OIDC | OAuth consent 與 app 設定截圖、允許的 callback／origin、測試帳號、client secret 存放位置證明（不得貼值） | 營運者 | 未取得 |
| Upstash／Vercel Marketplace | resource 建立證明、region、monthly budget、Lua／transaction 原子性實測、延遲與月成本估算 | 營運者 | 未取得 |
| 管理者 subject | 實際 OIDC stable subject 取得與 allowlist 流程 | 營運者 | 未取得 |
| Geoapify | 實際 plan、daily credits、rate limit、usage alert、attribution／white label dashboard 截圖；是否升級 API 10 | 帳戶擁有者 | 未取得 |
| OpenAI | 專案層級預算上限／告警設定；usage 欄位實測（含 `service_tier`）；`speech` 音訊輸出上界證據（官方硬上界**未查得**；A9＝S1 維持受阻，校準值、逾時、串流中止、帳戶預算皆不得當成上界）；Chrome／Safari／Firefox 以固定格式 16 kHz PCM 產生 WAV 的可行性（T133；A10＝P1）；tile 數與 `usage.input_tokens` 實測 | 營運者／實測 | 未取得 |
| Google Places | 專案預算告警／配額上限、實際計費 SKU 對帳 | 營運者 | 未取得 |
| 供應商層級硬上限／告警 | 各供應商帳戶層級預算與通知（App 內額度不是帳單封頂） | 營運者 | 未取得 |
| 靜態示意圖 | D1–D4（§7） | 使用者／營運者 | 未取得 |
| 部署／CDN | Vercel Preview 的 `x-vercel-cache`、Network／HAR、Cache Storage 證據 | 實作後 | 未取得 |

### 10.3.5 第一批 mock 實作方案（待使用者審閱；**未授權、未實作**）

**批次名稱**：成本與額度核心（純 `api/_lib` 單元，全部 mock，無端點接線、無 UI、無新 dependency、不連外、不讀秘密）。

| 順序 | Task | 檔案範圍 | 依賴 | 測試（全部待測） |
| --- | --- | --- | --- | --- |
| 1a | T126 | `api/_lib/cost-price-table.ts`；`tests/fixtures/cost-price-fixtures.ts`（僅測試，標示 `FIXTURE_*`）；`tests/api/cost-estimators.test.ts` | 無 | 價表 production 版全部端點 `live: false`；A＝1 下表一各 `R_e` 的 ceil 一次算術；白名單外以內部原因 `COST_MODEL_UNSUPPORTED` 拒絕，對外統一映射依 §3.5；prompt／知識 byte 上限對 `catalog` 與最壞字串；fixture 與 production 價表物理分離（production 路徑無法載入 fixture）；A＝3 欄位不存在 |
| 1b | T020 | `api/_lib/quota-window.ts` | 無 | 併入 T024：`Asia/Taipei` 日／週 key 與 `resetAt`、跨午夜／週一 00:00、不依賴瀏覽器時鐘 |
| 1c | T019 | `api/_lib/shared-store.ts`（介面＋in-memory race-safe mock；標示非 Upstash 行為） | 無 | 併入 T024：mock 在並發下的原子性（以明確標示的測試資料） |
| 1d | T127 | `api/_lib/audio-pcm.ts`；`tests/api/audio-pcm.test.ts` | 無（A10＝P1 已規劃核准） | §4.2.4.1 全部規則：合法 60 s 邊界（1,920,044 B）通過；1,920,046 B 超限拒絕；header 宣告長度與實際不符、`RIFF` size 矛盾、`0xFFFFFFFF`、截斷、額外 chunk、非 PCM／非 16 kHz／非 mono／非 16-bit、奇數 data bytes、0 bytes 皆拒絕；重建 header 的位元組與期望完全相等；時長以 `actualData/32,000` 計算而非宣告值 |
| 1e | T135（**新增**） | `api/_lib/openai.ts`（僅加 `maxRetries: 0` 與可選 timeout 參數，不接線數值）；`tests/api/openai-single-attempt.test.ts` | 無（A2 已規劃核准） | mock `fetch` 回 429／5xx／逾時／連線中斷，斷言上游 `fetch` 恰為 1 次；六端點各路徑單次呼叫（沿用 `openai-attempt-instrumentation` 計數）；既有 `openai-attempt-instrumentation.test.ts` 不迴歸 |
| 2a | T021 | `api/_lib/quota-engine.ts`（預留） | T019、T020、T126 | 併入 T024：日／週任一不足即拒絕、單一原子操作、`R_e ≤ remaining` 邊界 |
| 2b | T022 | `api/_lib/quota-engine.ts`（結算） | T021 | 併入 T024：成功釋放差額（僅 `attempts==1` 且標準層級）、明確未計費失敗釋放、逾時／不確定保守保留並標 `uncertain` |
| 2c | T023 | `api/_lib/cost-estimators.ts` | T126 | 四端點 `R_max`、`live: false` 端點（speech／transcribe 與全部 production 預設）以內部原因 `COST_BOUND_UNPROVEN` 拒絕、不進預留；對外錯誤依 §3.5；不含任何 G 公式 |
| 2d | T131 | `api/_lib/quota-threshold.ts`；`tests/api/quota-threshold.test.ts` | T126、T021 | G-B 計算；§4.5.3 四類情況互斥與優先序；`E_live` 為空→成本模型無效（非 429）；G 隨 fixture `live`／單價重算；`live: false` 價格不影響 G；8,036 僅以 `FIXTURE_ALL_LIVE` 出現，不得出現於 production 常數 |
| 3 | T024 | `tests/api/quota-reservation.test.ts` | T019–T022 | 並發不共用剩餘額度（SC-006）、重複提交／多分頁、窗口跨期；明確標示「mock store，不代表 Upstash」 |

**平行**：1a–1e 可同時進行；2a→2b；2c、2d 待 1a（2d 另待 2a）；3 最後。
**不納入**：T025 以後 Pipeline（需 Session／核准 mock）、T130（需端點 mock）、T132／T134（需 Pipeline／圖磚管線）、T128／T129（前端）、T133（外部證據）、所有 UI 與圖磚任務。
**停止點**：每個任務 Implement → Run → Verify → Fix；批次最後以 `npx vitest run`（僅 `tests/api/` 與 `api/_lib/`）與 `npx tsc -b` 驗證，再報告並**停止等待審閱**；不 commit／不 push／不部署、不接線任何端點、不呼叫付費 API、不安裝套件。批次完成不改變 Readiness 範圍二、三的判定。

### 10.3.6 Readiness 三範圍判定（2026-10-06；皆**非** implementation 授權）

| 範圍 | 判定 | 阻擋（影響範圍） | 不阻擋的項目 |
| --- | --- | --- | --- |
| **一、第一批本機 mock 實作**（§10.3.5） | **可授權審閱**（待使用者明確批准 `/speckit.implement` 此批次） | 僅：（1）使用者尚未批准實作授權；（2）T135 為新增任務，須審閱；（3）production 價表須維持全部 `live: false`（A1 數值待核准，不得作為放行依據） | A1／A3–A7 數值未核准（fixture 與 `live: false` 隔離）；外部帳戶（Google OIDC、Upstash、Geoapify、OpenAI 預算）；靜態示意圖資產；真實瀏覽器 16 kHz；speech 上界；plan.pdf |
| **二、真實服務整合** | **BLOCKED** | A1／A3–A7 未核准；表二前提待證明（影響各端點 `live`）；外部帳戶與預算證據（OIDC、Upstash、Geoapify、OpenAI／Places 預算告警）；新 dependency 批准；T133（vision usage／tile、真實瀏覽器 16 kHz PCM）；speech 上界（A9 受阻） | — |
| **三、完整功能驗收／部署** | **BLOCKED** | 範圍二全部＋靜態示意圖資產 D1–D4（T107–T109）；Preview／production CDN 與 HAR 證據；正式站切換與部署批准；plan.pdf 是否重生成（M2）；所有應用程式測試現為「待測」 | — |

### 10.3.7 本輪同步後 Readiness 差異

本輪只核准與執行文件同步及唯讀 Analyze；不構成任何實作授權。新增 FR-049～FR-056／SC-013～SC-017 及 T136–T142 後，相關工作仍待實作、隔離測試或技術證據，並須依 `.github/copilot-instructions.md` §Implementation Authorization 通過 Analyze 與 Readiness Gate 並取得明確 `/speckit.implement` 批准後才可開始。T019 維持部分完成、T135 未執行；production 六端點 `live:false`；真實 Redis/Lua、handler 接線、保存策略、外部整合、整體驗收與部署均非 READY。歷史 mock 數字不改變本結論。

### 10.4 已批准防護政策之實作約束（本輪文件同步；非實作授權）

- **請求決策順序與外顯**：每次受保護請求先驗證目前 Session 與核准資格，再處理冪等重複／衝突；資格已撤銷或無效時回 403，不得透露原預留資料。成本 registry、上界、store 或狀態無法可信確認時，拒絕上游呼叫並統一回 `503 PROTECTION_SERVICE_UNAVAILABLE` 與 spec／error contract 指定的繁體中文文案；內部失敗原因、版本、價格及設定不得對外揭露。409 `DUPLICATE_REQUEST`／`IDEMPOTENCY_CONFLICT` 使用指定文案，不自動重送或重新授予 execution grant；「查看目前狀態」在查詢契約核准前只是提示，不代表成功或存在查詢動作。
- **成本 registry**：估算金額由可信後端估算器計算；後端須驗證 registry 版本、有效期間、核准證據、live／blocked 狀態及端點適用性。呼叫端不得指定金額或版本，也不得以新版本字串清除舊版本封鎖。超額結算須產生可查驗的實際入帳、超額及被封鎖版本結果；只有重新具備證據與核准的新版本才可另行啟用。production 六個端點維持 `live:false`，直至各自滿足核准及驗證條件。
- **Lease、清理與結算**：lease 依端點最長執行時間加結算緩衝設計，不採全端點共用固定秒數；本輪不填入未核准值。清理／對帳必須可重複執行且具冪等性；到期轉 `uncertain`，保留原日／週窗口及扣額，不退款、不重放。store timeout 是結果未知，不得推定未完成、釋放額度、重試寫入或再次呼叫上游。晚到結果只留稽核紀錄；重複結算只有在金額及結算語意一致時才可視為已套用，否則拒絕且不得改變額度。清理排程／觸發方式屬後續實作與驗證任務，尚未建立。
- **指紋與最小資料**：請求內容指紋使用伺服器持有金鑰 HMAC；`estimateInputs` 僅保存逐端點明列之數值與列舉欄位，不保存任意字串、完整對話、音訊或圖片。只允許執行授權、額度及稽核所需主體存取必要資料；保存期限與金鑰輪替細節仍待決，不建立金鑰或寫入秘密值。
- **證據邊界**：T019 維持部分完成；mock 不證明 Redis/Lua 的 key/hash-slot、原子更新或保存策略。T135 本輪未執行；所有新增測試情境仍待測，文件檢查與 Analyze 不算測試 PASS。細項依賴 T136–T142 與 data-model.md §14～16。

### 10.4.1 Batch-M2／T139 隔離契約（2026-10-06）

- 使用者本輪明確批准 T139 與「分離參數／注入式測試上限」方案；checklist 71／83 勾選、12 項未完成仍保留。只處理 HMAC／allowlist，不執行 T135、T140–T142／Batch-M3 或任何 handler 接線。
- 沿用已安裝 Node `node:crypto`：`createHmac('sha256', KeyObject)`，伺服器可信依賴注入 secret KeyObject 與非秘密版本識別；不讀環境變數、不生成正式 key、不退回 SHA-256。模組檢查 secret key 型別及至少 32 bytes 的 key 材料；這不是正式 key provisioning／輪替政策。
- `reserve(request, trustedCost)` 分離使用者語意內容與後端成本參數；request 只接受 `identitySubject`、`endpoint`、`idempotencyKey`、`content`，其他欄位明確拒絕。identity 仍須由日後可信 Session 邊界提供，不代表已完成 pipeline 身分接線。
- trustedCost 必須含相符 endpoint、正安全整數金額、有效價表區間／版本、model（places 為 null）、`billingTier: 'standard'`、`attempts: 1`、明列估算輸入與端點數值上限。未知估算鍵、任意字串、非有限／非安全／超界數值及矛盾 audio bytes／billed minutes 拒絕；上限全由可信參數注入，沒有 production 預設。
- v2 canonical encoding 以型別標籤保留文字／number／boolean／null／binary、物件鍵排序與陣列順序；拒絕循環、非 JSON 物件、getter、undefined 與非有限數字。內容先以相同 key 計算 domain-separated HMAC；此中間值不傳 store。最終 HMAC 涵蓋主體、端點、金額、價表版本／效期、model、tier、attempts、allowlisted estimate inputs 與內容 HMAC。
- store 僅保存最終 HMAC、非秘密 `fingerprintKeyVersion` 與 allowlisted 數值／enum；不保存原始內容、key 或普通內容 digest。新預留／duplicate 回傳亦核對 key version 與估算輸入；額外 reservation 欄位及不合法 estimate inputs 回 503。舊 R1 非 HMAC 記錄沒有遷移／正式存量證據；本批不宣稱能跨 key／format 版本維持冪等。
- 這只是隔離的可信參數契約，**不是可信 registry**；價表 live／核准證據／估算器來源與可信 provenance 仍待 T140／A4。speech 的欄位只可作隔離驗證，engine 不授予 speech 執行權；production 六端點 `live:false` 不變。
- 測試 adapter `tests/support/quota-fixture-engine.ts` 只負責把歷史 mock 測試資料轉入分離參數；application code 不得引用。Batch-M1 的結算、timeout、清理與重複請求測試保留，fixture 適配不是正式安全接線。
- 保存期限、TTL、正式 key provisioning／輪替、跨輪替冪等性、正式 lease 與真實 Redis/Lua 證據均未定案／未驗證；功能 005 與真實整合不標 READY。實際本輪測試與 Analyze 結果記於 tasks 及 analyze-report 的 Batch-M2 節。

### 10.4.2 Batch-M3a／T140 registry 子範圍（2026-10-06）

- **授權與依賴拆分**：使用者明確批准 A4 隔離修補及介面調整；requirements checklist 12 個未完成 gate 保留。此子範圍依賴 T126／T023／T021／T022／T139 的隔離模組與 T019 型別／mock，不依賴 T025 或 T135；T140 的 pipeline 接線部分仍依賴 T025，整項保持部分完成、未勾選。未建立 pipeline、handler 或狀態查詢，未連外、提交或部署。
- **現行邊界取代 M2 暫時入口**：`QuotaEngineOptions.costRegistry` 是伺服器依賴；`reserve(request, estimateInputs)` 不再接受任意 `trustedCost`。request 仍只接受主體、endpoint、idempotency key 與 content；第二參數只接受 data-model §15.1 allowlist。registry 自行選定版本、model、`billingTier: 'standard'`、attempts＝1、價格、安全係數、數值上界及 detail allowlist，engine 呼叫內建估算器，不提供自訂 estimator 或任意金額 bypass。
- **可信資料驗證**：`api/_lib/cost-registry.ts` 拒絕未知／缺漏／矛盾 entry、非純資料／getter、endpoint／version 錯配、效期失效、live:false、blocked、模型白名單／tier／attempts 不符、計價種類與端點不符、缺少數值上限、核准／啟用／上界／單次嘗試的旗標或 references 缺失、以及核准摘要不符。lookup 失敗／逾時明確回內部 `COST_REGISTRY_UNAVAILABLE`，不使用預設成本；lookup 後於預留前再查可信時鐘，跨過有效期即拒絕。
- **穩定成本綁定**：後端使用 typed canonical encoding 與 SHA-256 計算非內容的 `costParametersDigest`，包含 endpoint、model／模型白名單、tier、attempts／價表 attempts 上界、pricing 全部欄位、priceScale、estimateBounds、detail allowlist；模型及 detail 集合排序、安全係數約分，等值係數（2/1 與 4/2）不會產生新解封鍵。版本、效期、核准標籤不作為此摘要的一部分。approval 的 `parametersDigest` 必須吻合當下成本參數；HMAC 與 reservation 同時綁定此摘要。這是設定與核准 metadata 的程式契約，不是核准文件內容或真實上界已獨立驗證。
- **原子 store 契約**：reserve 在同一原子操作內判斷目前資格、版本＋端點→摘要一致性、版本封鎖與成本參數摘要封鎖，再判斷額度／建立預留；禁止只在 engine 先讀後放行。同版本同端點第一次原子觀察的摘要不可覆寫（包含拒絕預留的情境）。相同冪等鍵與內容仍無第二次 execution grant。超額 settle 同一操作如實入帳並封鎖 reservation 的版本及摘要，回傳兩者相符佐證；缺少或矛盾佐證回 503。既有預留結算不依賴當前 registry 的可用性／效期／封鎖。production store 仍只含介面／timeout／拒絕設定，未加入 Map；memory mock 仍限 tests。
- **allowlist 與估算綁定**：token／PCM 上限必須與 pricing 一致；衍生 `maxOutputTokens` 由 registry 決定，傳入不同值拒絕，不因宣告較小輸出降低預留；billedMinutes 由 bytes 推導，矛盾值拒絕。沿用 M2 `inputTokens` 可為 0 的型別契約，估算器仍按可信最大輸出預留正值，相關算術測試同步。photo imageBytes／detail 型別與上限不代表影像 token 上界或真實內容驗證已完成。
- **歷史測試適配與證據**：`tests/support/quota-fixture-engine.ts` 用固定 tests-only token 價表將歷史金額轉成 token 輸入，仍經正式 registry 驗證與估算；沒有正式 bypass。`tests/fixtures/cost-registry-fixtures.ts` 的核准與上界 references 全是示意。最終 targeted 6 files／139 tests、API 回歸 22 files／272 tests、build 與受影響測試獨立 type-check 通過；詳見 tasks 執行紀錄及 Analyze。所有 live 測試資料限 tests fixture；speech、production 六端點 live:false、正式 lease、T135、Redis/Lua 與完整功能 gate 均保持原限制，整體非 READY。

## 11. Post-Design Constitution Check

| 原則 | 文件層級檢查 | 說明 |
| --- | --- | --- |
| I Specification Before Implementation | 草案符合，含 Sync 建議 | 依本機 005 spec/UX/checklist；圖磚代理架構方向已提出對應 Specification Sync 建議（見報告），未自行默默改規格 |
| II Simplest Sufficient Technology | 符合，外部啟用仍需 gate | OIDC/shared store/admin API/圖磚代理對應已批准需求；新 dependency、真實 service 與部署仍須獨立批准 |
| V Stack Stability | 需批准 | 新 dependency、Auth、Backend shared state、新增 `/api/map/tile/*` 端點屬 approval gate；本 Plan 不安裝不啟用 |
| VI Privacy & Safety | 草案符合 | 不新增長期對話、音檔、影像或位置歷史；稽核欄位最小化；圖磚代理日誌不記錄完整座標路徑 |
| VII Testability | 草案符合 | quickstart 僅列待驗證情境，不標示應用程式測試通過 |
| X Repository Safety | 草案符合 | 僅 Plan 階段文件；不碰 app code 與既有 specs 001～004 |
| XI Authorization Boundary | 符合 | 停在 Implementation Readiness Gate，未取得 `/speckit.implement` 授權 |
| XIII API Protection | 草案符合，含待決項 | 六端點與圖磚代理後端保護均可設計；圖磚代理已大幅收斂 G-001，殘餘限制見 §6.5；2026-10-06 已補六端點成本上界提案（§4.2）與「額度不可用」定義（§4.5），數值待核准（A1／A3–A7）、前提待證明、speech／transcribe 真實呼叫受阻（A9＝S1 已規劃核准、A10＝P1 已規劃核准但未 live），G 規則 A8＝G-B 已規劃核准（無固定數值） |

## 12. 停止點

本文件的架構與初始額度已核准，且 `/speckit.tasks` 已完成；本次停在 **Implementation Readiness Gate**，不進入 `/speckit.implement`。外部服務實際啟用、新 dependency 安裝、真實秘密值／環境變數、Geoapify 付費升級、正式站模式切換與部署仍須分別取得獨立批准；靜態示意圖正式資產仍待交付。未取得外部條件前，日後若另獲 Implement 授權，只能先以本機 mock 與隔離測試完成不需真實帳戶的工作，不得把 mock 證據當成 production 驗證。

## 13. 七檔隔離 pipeline：本輪限定授權（2026-10-06）

**本輪更新優先於前批授權狀態**：營運者已核准 A6 六列及本節七檔隔離範圍，先同步文件與測試預期、唯讀限定 Analyze，無新增隔離 blocker 才執行。request 日／週 userMessage 均為「今日／本週剩餘額度不足以預留這次操作，僅本次操作無法執行；其他功能仍會依各自的資格、額度及防護狀態判斷是否可用。」P-G1／P-G2／P-I1、12正式 gate 保留；不得修改核心 engine／store／registry 介面，P12 同次 context 證明 R_e＝R_max,places≥G。完成本批驗證即停止，不執行 T135、不接 handler／UI、不連外、安裝、提交或部署。下文未授權描述為歷史。

最小批次、可信／不可信介面、逐檔範圍、task 完成條件、可執行測試矩陣及來源證據見 [隔離 pipeline Readiness 報告](checklists/pipeline-readiness-report.md)。本節只將方案納入 Technical Truth 的審閱範圍；只有 §3.2 的驗證順序與 admission 優先序已獲本輪文件批准，其餘介面／檔案方案待審閱。

- 使用可信依賴注入的非路由 helper，測試入口直接呼叫 helper；唯一合法執行代表為 tests-only Places descriptor，固定 SKU、`estimateInputs = {}`。其他端點只驗證共用拒絕路徑；不宣稱完成六端點語意驗證。
- Session lookup 以測試 adapter 注入；資格預檢重用 engine `getSnapshot`／store `readQuota`，不查 reservation。真正資格、tier、追加及額度仍由 reserve 的同一原子決策重查；預檢不能取代原子授權。
- 可信成本 context 必須固定同次 registry／table 版本，先驗證效期、核准 metadata、實際啟用與版本／摘要封鎖，再將同一 context 提供 engine 與 G 計算。現有 `quota-threshold` 本身不驗證 registry／雙封鎖，不能直接把任意價表當權威。只在測試中模擬權威 context；真實來源待 T019／T140。
- 預留拒絕的 429 使用同次 reserve 回傳 snapshot 分類，不以早先 snapshot 或額外 read 替換。成本失效優先於額度文案；同類日／週拒絕日優先，跨類依 §4.5.3。
- lease／store timeout／body bytes、深度、節點及 reader deadline 必須顯式由測試政策注入且驗證；不使用通用 lease 預設，不把 fixture 數字核定為產品值。正式逐端點 lease 仍待 T136。
- 重用既有 `src/types/error.ts`、`api/_lib/http.ts` 的型別／信封形狀；後續 T026 須最小擴充共用 ErrorCode／可選欄位，不用 cast 或另造互斥的 ProductError。現有 `readJsonBody` 非有界 reader，本批 helper 的 bounded reader 不得以它冒充。
- 隔離依賴拆分不等於完成 T014／T017／T019／T136／T140，亦不撤回 Foundational 與 User Story gate。T135 是真實 OpenAI 整合必要前提，但不屬純 mock helper 批次。
- **本次 A6 文件交付**：四種完整信封、六列精確文案、七個完整路徑／介面／可信邊界及 P01～P22 待測矩陣見 [Readiness 報告](checklists/pipeline-readiness-report.md)。T026／T065／T028／T141 已明列逐字與恢復條件驗收，不新增程式或測試。
- **Readiness**：文件方案可審閱；隔離 pipeline 實作仍 **BLOCKED**，待營運者批准 A6 六列文案並另行批准七檔具體 `/speckit.implement` 範圍。文案提案完整不等於已批准；不以通用 fallback、刪案例或勾選任務越過 gate。正式 G／Session／Redis 等欠項屬真實整合 gate，隔離只以明列 mock 邊界驗證，不能把 fixture 宣稱正式完成。真實整合及完整驗收／部署亦 **BLOCKED**。

## 14. 剩餘實作收斂與統一 Readiness Gate

本節是本輪 Technical Truth 補充，非實作執行紀錄。七檔與 P01～P22 結案證據不重審；只讀其與 registry／G／engine／store 的必要介面。完整工作分類、完成證據與停止條件見 [統一 Readiness](checklists/pipeline-readiness-report.md)；[Tasks Phase 12](tasks.md#phase-12-convergence剩餘實作收斂) 沿用原 ID，新增 T143～T146，均未完成。

### 14.1 P-G1：權威 registry 與單請求固定快照

1. 沿用已批准 Upstash Redis-compatible 共享邊界，不新增資料庫、service 或 dependency。`CostRegistry` 增加可信全集合快照；現有逐端點 `resolve` 可保留為相容介面，但不足以獨立授權 G。快照只能由伺服器依賴提供，HTTP 不接受 revision、G、金額或摘要。
2. 發布一份不可變 registry bundle：`registryRevision`（單調增加、不可 ABA 重用）、`bundleDigest`（覆蓋成員、價表版本／效期、核准與啟用 metadata、每端點成本摘要與 R_max）、同一價表版本及完整端點資料。R_max 由既有可信最大成本估算器計算；數字仍須 A1 等核准與上界證據，fixture 不是正式證據。`costParametersDigest` 維持原用途，不以 revision 或效期重新命名解除封鎖；不新增請求原文存量。
3. 發布／停用必須以共享 store 原子操作寫入整份 bundle 與 revision；超額結算的版本／摘要雙封鎖與 revision 變更也在同一原子操作完成。封鎖任何 G 成員皆會失效舊快照；清理、追加與用量變動不改 registry revision，但與 reserve 同一原子邊界排序。
4. 請求解析驗證後只固定一份快照，估算 R_e、G、HMAC 與 command 都使用它。store.reserve 先判斷當下資格，再核對 command 的 expected revision／bundleDigest、目標端點摘要／效期、當下封鎖與完整 registry；不同或無法確認一律 503，無 grant，不在同一使用者操作自動重新 resolve／reserve。即使價格數字未變，revision 不符仍拒絕。
5. 原子決策時間必須取共享邊界可信時間（真實 adapter 用 Redis TIME 或同等可信原子時間），重驗半開效期、資格／追加到期及日週窗口。跨窗口或可信時間矛盾拒絕，不能沿用舊窗口或 clamp；授權回傳需包含決策時間，沿用 estimation ≤ command ≤ decision ≤ grant 與未過 lease 的核對。本機用明列注入時鐘驗證，不宣稱 Redis 時間已驗證。
6. 在原子時間，明確停用、到期或雙封鎖的非目標端點從 E_live 排除；目標端點不合格或 E_live 空即 503。宣稱啟用但缺少／矛盾 metadata、摘要或上界的 bundle 屬無效，不可當成正常停用偷偷略過。不以部署時價表、env 或 process cache 當權威。
7. reserve 是新執行授權的線性化點：更新／封鎖先完成 → 舊快照無 grant，下一次明確操作讀新快照並重算 G；reserve 先完成 → 已取得的首次 grant 按原成本／窗口／lease 單次執行，不追溯取消、不重估、不退款、不重放。既有預留仍能保守結算，即使目前 registry 過期、故障或被封鎖；不承諾收回既有呼叫。快照只固定單次成本語意，不凍結後續請求政策。

### 14.2 P-G2：同一次原子 reserve 強制 G、日額度與週額度

同一 script／transaction 完成以下步驟，禁止 application `read → 判斷 → reserve`：

1. 驗證目前資格／等級與到期，計算當週 active 追加及有效上限；資格拒絕先於任何 duplicate／conflict 資訊。
2. 核對 §14.1 的當下 registry revision、bundle、效期及雙封鎖，從可信有效 E_live 算 `G = min(R_max,e)`；目標不可用／無有效集合／資料矛盾回統一 503。
3. 保留既有冪等比較與原預留語意：duplicate／conflict 不產生新預留或 grant，不因目前額度恢復、換週或 lease 到期重新放行。
4. 對首次新預留，在同一當下 usage／limits 依序分類 `exhausted > below_floor > request_insufficient`，跨類取較高、同類日優先；兩窗口皆 `remaining ≥ G` 且 `remaining ≥ R_e` 才放行。`R_e ≤ remaining < G` 必須 below_floor／all，不能因 R_e 較低取得 grant。
5. 僅原子增加日／週 reserved 的 R_e 與建立 reservation。剩餘剛好等於 G 或 R_e 均可通過相應比較；成功後餘額可低於 G，後續新請求重新判斷。週追加只增加當週週上限，撤回／到期影響後續 reserve，不抹除已成立預留，不提高日上限。
6. 同次回傳 grant／拒絕的 usage、limits、revision、bundleDigest、G、有效成員綁定與原子決策時間；429 再帶明確內部分類與 window。engine 驗證全部佐證，將 G／R_e 比較納入 denied 判定，不再假定只有 R_e 不足才合法拒絕；pipeline 採同次結果，不以額外 read 或本機重算替代。public 不新增 revision／G／state／reservation／內部原因。
7. map eligibility／每筆 tile gate 重用相同 registry 與資格／usage 的原子讀取分類，但不預留、不扣六端點 US$；圖磚個人計數與 site credits 沿用獨立契約。查詢不是 grant，每筆 tile 在查快取前重新檢查；既有 cache hit／304 與撤銷保證不變。

### 14.3 最小程式變更與證據邊界（下一輪取得 Implement 授權後才執行）

| Surface | 必要變更 | 原 Task／新增 Task |
| --- | --- | --- |
| `cost-registry.ts`／`quota-threshold.ts` | 全集合可信 context、不可變 revision／bundle、G 共用分類；既有估算與 digest helper 重用 | T140／T131、T143 |
| `shared-store.ts`／memory mock／真實 adapter | registry 發布／封鎖與 reserve 同一原子權威；G、日週 usage 與追加共同判斷；內部佐證與時間 | T019／T021／T022、T144 |
| `quota-engine.ts`／`quota-validation.ts` | command 成本快照綁定、全域 G 拒絕驗證及時間／窗口佐證；既有 HMAC、結算與 unknown fail-closed 保留 | T021／T139、T144 |
| pipeline／map gate | 只使用新原子結果分類，日後移除 Places-only 成功限制須先具端點合法驗證與新證據；不可直接放寬條件 | T025／T140／T141／T134、T146 |
| focused tests／文件 | 新增原子 G 與 registry race 案例、與原核心回歸；不重開七檔歷史驗收 | T024／T131／T134、T145 |

T019 分為「真實 adapter 程式與可注入 transport／script 測試」及「真實 Redis 執行證據」：前者可本機完成，不安裝新 client 套件；利用既有能力或可注入最小 transport，實作既定 Redis-compatible protocol／Lua。正式共享 key/hash-slot、跨 writer 原子性、TIME、TTL／保存策略與錯誤行為須在獲准隔離環境驗證，未取得前不可把 T019 整項勾選。單一原子操作涉及 registry／全域封鎖與使用者 keys，key 配置必須確保同一 EVAL／transaction 可處理全部 keys；若既定服務不能提供，STOP 回 Plan，不拆成有競態的多次操作或擅自換架構。

P-G1／P-G2 現為「規劃已收斂、實作與證據 OPEN」，不再是阻擋本機工作的未定義方案；P-I1／正式 gate 仍 OPEN。本機連續範圍依 [Readiness](checklists/pipeline-readiness-report.md) 一次授權、逐 phase Implement → Run → Verify → Fix，不逐小任務重複批准。

### 14.4 本輪本機實作對照與技術邊界

**2026-10-07接手補充**：T010～T018／T019的既有OAuthStateStore port已新增可注入[Redis state adapter](../../api/_lib/redis-oauth-state-store.ts)：同namespace hash-tag的`oauth-states` hash存state／nonce／PKCE verifier／expiresAt，單次EVAL讀取並消耗，Redis TIME到期即回null，不以cookie簽章取代消耗。期限仍由既有flow record明列，沒有正式預設；沒有factory接線、未使用state清理排程、真實Redis／JWT／JWKS證據。新增20tests與相關4檔74回歸／strict型別通過，不勾整項。保存與正式binding等提案見[集中決策包](readiness-decisions.md)。

**2026-10-07 接續最新狀態**：原子業務Lua／SharedStore／Session／tile／REST adapter、管理原子異動／audit／完整管理UI與OIDC通用library adapter／額度UX已補程式及本機測試。Session仍為opaque ID＋每次lookup，不以HMAC取代撤銷。管理與quota共用users authority；追加／撤銷與audit同一EVAL。核准／切級只接受tier1／tier2，切級不延長既有期限，週鍵與resetAt採同一server clock。`nearLimits`門檻只接受可信options明列`nearLimitPercent`（整數1～100）而不設預設，缺失／非法只拒絕overview；安全整數計算唯讀提示，不改動額度授權。80%只是UX示例／fixture，正式值待批准。申請producer／enqueue尚未實作，需先核定T147契約；真實OIDC JWT/JWKS binding需先批准既定library dependency。下方原有未完成敘述保留為前輪歷史，最新子範圍與證據以[本機報告](../../docs/verification/005-local-implementation-evidence.md)與[Tasks](tasks.md)為準；正式Redis／TTL、成本／輸入上界與部署仍非READY。

**2026-10-06 接續格式核對**：週鍵差異僅為呈現格式，不構成政策衝突。以既有 `getWeekWindow` 的 `YYYY-Www` 統一管理 HTTP／store／engine，保留 ISO 週年與 Asia/Taipei 週一重置；後端推導當週及 resetAt，拒絕舊 suffix／非當週／延長期限。下方停止描述為前輪歷史。

**接續本機 adapter 技術契約**：
- 使用既有 `fetch` 能力提供可注入 Upstash REST `EVAL` transport，不新增 client 套件、不讀正式 env、不啟用服務；單次 fetch、禁止 redirect／retry、有界回應與 timeout。結果未知不補償退款或重授權。
- `redis-shared-store.ts` 將 registry 與 users authority 放於同一明列 hash-tag；users hash 的 subject 欄位包含資格、窗口、預留、冪等鍵與追加。管理 writer 只在同次 Lua 改動資格／追加並寫 audit，不另以讀→寫串接 quota。Session hash 只存 opaque ID 對應的 SessionRecord。
- 原子時間使用 Redis `TIME`，Lua 自行推導台北日／ISO 週窗口；預留對照完整 pinned bundle 與權威成員／版本／摘要雙封鎖，從當下集合計算 G。發布／封鎖與預留共用同一原子 authority；封鎖使 revision 增加，後端 snapshot projection 重新產生完整 digest，舊 snapshot 拒絕且不刷新重試。
- registry 保留原 JSON，避免 Redis cjson 將空陣列轉為空物件、破壞 digest。業務資料使用精確 safe-integer JSON encoder，避免 cjson 預設有效位數截短大型 micro-USD。
- lease 清理只轉 uncertain，保留原窗口預留；Session 清理接受明列保存參數，圖磚 cache 可依已批准 7 天 TTL 清理。沒有正式保存預設、排程或 uncertain 自動刪除。
- 圖磚共享 writer 採固定 `osm-bright/z/x/y` cache key、每人分鐘／日計數、全站 quarter-credit 預留、共享 flight；逾 lease 不接管，未知結果保留 credits。等待者只輪詢共享結果，不重送上游。lease／等待／payload 上限須注入，fixture 不作 production 預設。
- 本機執行既有 Lua 5.4 interpreter，Redis 與 cjson 使用明列測試替身；並非真實 Redis 5.1 sandbox、跨 process Redis writers、TTL／CDN 或 provider 證據。T019 正式子範圍仍 OPEN。

**以下為前輪實作紀錄（不作接續最新欠項）**：

- registry bundle／同次 G、日週與 evidence 已在型別、engine、memory fixture 實作；新增 `createAtomicQuotaEngine` 強制需要全集合 snapshot。原 resolve-only 路徑僅保留隔離相容，不用它完成正式成功接線。真實共享 authority、業務 Lua／TIME、TTL、跨 writer 證據均未完成。
- `redis-atomic-transport.ts` 是可注入的單次 EVAL transport，驗證同 hash-tag、明確 timeout、無重試；不是完整 SharedStore adapter。不得以此取代 T019／T138 業務實作。既有 Lua 5.4.2 可用，但本機缺少 Redis server／cli 與 cjson；未安裝或連外。
- Session 與 endpoint factory 共用 `session.ts`／`session-endpoints.ts`，不另建重複的 session-store 層；TTL、金鑰、時鐘與 store 必須注入，fixture 數值不作正式預設。OIDC flow 已有 PKCE／state／nonce／claims mock，真實 Google token 簽章／JWKS provider port 尚未實作。
- 六 handler 的 `POST` 已接拒絕 boundary；預設未配置回 503，注入本機依賴可驗證 401／403／503。原內容邏輯保留為非 HTTP 的 `executeUpstream`，歷史內容測試改用該 export，不算新 HTTP 成功證據；未解除 Places-only 成功限制。
- 前端在每次明確付費操作前 GET 自身 quota，以阻止 Public／未核准／未知狀態的付費 POST。它只確認 UX 資格，不比較四捨五入金額、重算 G 或取代每次後端原子預留。資格恢復只重新查詢，不自動重送。未完成所有額度受限入口的完整 UX。
- 管理者只有 overview 與可信逐請求 admin gate／CSRF 前置完成；完整清單、詳情、審核、audit、原子異動與相應 UI 尚未完成。管理契約週鍵範例 `2026-W39-AsiaTaipei` 與 engine `2026-W39` 的差異未自行解碼，受影響的追加 HTTP 子範圍停止待 reconciliation。
- map 以 eligibility query 決定是否掛載 lazy 互動元件；定位／搜尋前重新查詢。前端圖磚僅用同源 proxy；proxy 的共享計數／cache／coalescing／credits 仍為 ports＋fixtures，未提供真實 Redis writer。
- 暫用 inline SVG 不冒用正式素材；本機元件有 4:3／16:9 中心裁切、固定標示、同源 `/images/` fixture 與破圖 fallback。T107～T109 正式資產仍未完成。SW 先排除所有 `/api/` 再處理 navigation；不新增 offline 架構。
