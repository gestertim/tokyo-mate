---
description: "Task list for Tokyo Mate 005：API 防護、核准存取與預算額度"
---

# Tasks: Tokyo Mate 東京通｜005 API 防護、核准存取與預算額度

## 2026-10-08 本機 App 與 Phase B plan handoff 修補（本次現行；外部未執行）

依本次明確授權，只修復可在本機完成的交付缺口；沒有重審結案批次、沒有新增 Task ID。Vite App 已於 `http://127.0.0.1:5173/` 啟動並於瀏覽器操作東京百科及旅遊日文 Public 資料。Phase B CLI 現以 `.specify/phase-b-plan-v5.json` 固定保存非秘密計畫；digest 驗證綁定 namespace、三鍵 inventory、Lua／runner source hashes、操作上限與容量界線。execute 僅在保存計畫 digest 相符且當次四項條件／三筆觀測合格後進入一次性入口，秘密仍為無回顯 TTY 輸入；unknown／失敗不啟動第二批。

- [x] T153 本機子範圍：固定計畫 dry-run 重用、竄改／任意 digest 拒絕、條件式 execute 前置、一次性狀態鎖及現有 mock reserve／unknown／清理路徑回歸。
- [x] TEST_ONLY 瀏覽器／API 驗證：登入／OIDC、管理者、quota、五個付費 endpoint HTTP mock pipeline 與 speech fail-closed targeted suite 通過；production 六端點仍 `live:false`。
- [ ] 本機 API server 未啟動：Vite `/api` proxy 目標 `localhost:3000` 無 listener，因此 UI 額度狀態顯示無法確認；Public 內容可操作。真實登入／管理員互動需後端／OIDC Preview，屬 T154 未完成範圍。
- [x] TEST_ONLY 本機 API 入口（`scripts/005-test-only-server.mjs --test-only`）：session／登入選單／額度／地圖資格／管理端（總覽、名單、待審、稽核、核准、追加）使用記憶體 fixtures；新增 `tests/api/test-only-server.test.ts` 2 tests PASS，並於瀏覽器實測 test-admin 核准 test-pending（US$3／15 額度生效）。未含 `/api/me/requests`、epoch、六個付費端點；真實 OIDC／Redis 仍屬 T154／T153 未完成範圍。

本次 targeted 6 files／222 tests PASS，`npm run build` PASS；未讀取秘密、未連 Redis、未執行 Phase B、未呼叫付費 upstream。T152 保持結案，T153／T154 父項與正式 readiness gate 維持未完成。細節見[本次實際證據](../../docs/verification/005-local-implementation-evidence.md#2026-10-08-本機app與-phase-b-plan-handoff修補本次現行)。

## 2026-10-08 單次 Phase B 三鍵本機準備（現行；子範圍，不是父項結案）

本次使用者已批准 stale-capable 人工用量觀測僅供單次專用 Free DB 試驗提案門檻：commands ≤400,000、bandwidth ≤9GB、storage ≤230MB；每筆觀測須保留來源、擷取時間及時區，不能宣稱即時餘額。production／business runner 的 freshness gate 不變。T152 不重開；T153／T154 父項及正式 gate 保持未完成。

- [x] 本機 plan／digest：只含三鍵 exact inventory、request／response byte cap、兩個 data-bearing keys 的 cardinality 與本次固定包絡；provider 規則回覆已取得、真實執行未驗證，provider storage bytes／費用上界仍為 null。
- [x] 三鍵 reserve worker：沿用既有 business Lua 無 `requestEpoch` 分支；無假 floor／digest，資格、registry、G、日週額度、冪等及首次 grant 檢查全保留；不宣稱 epoch／restore 完成。
- [x] 分支核算與回歸：重新驗證每分支 POST、logical/provider commands、Read Region write multiplier、body bytes、stored-key 數及 exact cleanup；unknown 不重送異動、不退款、不 regrant、不清理可能晚到寫入。
- [x] 一次外部執行清單：外部啟動前要求 owner 確認當次 Free、Tokyo、無 Read Regions、無付款方式、無其他 workload 及三項用量觀測；本次不讀秘密、不連 Redis、不執行 `--execute`。

本機子項完成不代表外部啟動已獲准，也不改變 T153／T154 父項、正式 gate 或 T152 狀態。最終 digest、分支上界、測試結果及外部檢查清單見[本機證據](../../docs/verification/005-local-implementation-evidence.md#2026-10-08-單次-phase-b-三鍵-dry-run-與本機驗證本次現行)。

## 2026-10-08 D01 Places 帳務證據與候選範圍同步（本次現行；文件工作）

本次僅把新提供的帳務證據與已批准的本機候選／mock 範圍同步至既有 D01 文件，沒有重開或勾選任何已完成批次，也沒有重跑應用測試。交易頁明示金額 TWD；官方文件說明台灣帳戶使用新台幣、美元價格換為當地幣別且匯率每月初設定，不隨終端使用者所在地改變。兩個 Places SKU 的帳戶價格 CSV 首階數值各約 1,271.20／1,000 events，但 CSV 未標幣別／匯率，未從 `$` 欄名推定美元或推算匯率。`priceScale=5/4`、50,000 µUSD reservation 與 7 日價表有效期只批准用於本機候選／mock，不構成完整帳單上界或 Google 價格保證；不新增 TWD 額度或換匯 UI。T151 維持未結案；T152 維持結案；T153／T154 與正式 gate 不勾選。production 六端點仍 `live:false`，speech 真實呼叫維持受阻；未知結果仍 uncertain／保留預留／不重試。

## 2026-10-08 D01 Places 文件查核（前次狀態；非 Task 結案，後續由上節補記）

前次已完成 D01 決策包的本機程式唯讀盤點、Google 官方公開欄位／SKU／global 與 India 價格查核，以及 readiness／Plan／contract／evidence 文件同步。當時沒有呼叫 Places API、沒有讀取帳戶或秘密、沒有修改程式、沒有重跑應用測試；該次查核不構成應用測試 PASS 或正式端點／成本上界批准。其本機候選狀態由上節補記更新。T151 維持未結案；T146 不重開、不勾選；T152 維持結案；T153／T154 與正式 gate 不勾選。production 六端點仍 `live:false`，speech 真實呼叫維持受阻。

## 2026-10-08 六端點 mock-success 隔離子範圍（本次現行）

**完成狀態**：五個非 speech route factory 已透過 TEST_ONLY pipeline 完成輸入／method 拒絕及 HTTP success→原子 synthetic reserve→mock→settle；speech 僅 mock descriptor，正式 `POST` 仍 503 fail closed。7 個 targeted API files／164 tests 與 `tsc -b` 通過。這只完成 T146 隔離子範圍，不勾選 T146 整項。

依使用者明確批准的最小 Plan／contract 補充，只完成 T146 的本機隔離子範圍：為六端點定義 tests-only 成功 descriptor；五個非 speech 端點以真實 HTTP pipeline、輸入驗證、原子合成預留、mock upstream、結算及 HTTP response 驗證。所有成本／model／SKU／tier／output cap 僅來自 `TEST_ONLY` fixtures，僅作合成 accounting，不是可信真實成本上界或 D01 證據，production registry 與六端點 `live:false` 不變。speech 僅測輸入與 mock 行為，不成功預留／結算、不派送真實 provider。

本子範圍不重做管理 accessibility、本人申請、地圖或 PWA；不勾選 T146 整項，不重開 T152、不改 T153／T154 父項與其他正式 gate。完成前逐 phase Run→Verify→Fix；完成後同步 targeted tests、型別檢查與本機證據。

## 2026-10-08 獨立本機缺口補足（本次現行）

依本次明確本機 implementation 授權，已核對最新 Tasks／Plan／Readiness／contracts／既存證據，並再次取得 requirements 71 已勾／12 未勾之本機例外確認；沿用已完成 Analyze，不重審已結案批次。不新增或重編 Task ID，T152 不重開，T153／T154 父項及正式 gate 不勾選。

- 已完成 T085／T086 管理確認相關缺口：鍵盤開啟聚焦確認區、送出前取消返回原按鈕、成功刷新後焦點留在詳情確認按鈕；錯誤 alert／處理中 status；未知結果不能取消換鍵，只能明確同鍵確認；未知後再遇撤權拒絕不推論原異動未成立。同步派送鎖及離頁 AbortSignal／晚到防護不代表後端異動回滾。
- 針對本次修改實跑 3 files／19 tests，新增隔離瀏覽器管理恢復＋成功管理回應 PWA cache exclusion 1 test；strict 直接依賴 30 files／0 診斷，既有 Playwright webServer build 成功。全部為本機 mock；完整命令、失敗修補與 Safety 見[本次證據](../../docs/verification/005-local-implementation-evidence.md#2026-10-08-獨立本機管理恢復與可及性補足本次現行)。
- T038 原完成條件只要求暫用示意元件而非正式資產；等效 `StaticTokyoMap` 與既存破圖／alt／公開入口、裁切證據已滿足，故僅補勾該項，不重跑已驗地圖／PWA。T142／T147 本人查詢／申請、T076～T091 管理流程已有本機完成證據，不重做。
- 上述舊狀態由本文件頂端 2026-10-08 本次批准的隔離子範圍補充：只對 tests-only synthetic descriptor 驗證五個非 speech endpoint 的 HTTP 結算 pipeline；production Places-only／live:false 限制、D01 正式參數未決及 speech 真實呼叫受阻均保留，T146／T025／T036／T049 不因子範圍而整項勾選。

正式示意圖原檔／授權、真實 Redis／OIDC／Geoapify／CDN／installed PWA／部署與成本證據仍缺；不以本機 mock 冒充。未連真實 Redis、未執行 Phase B `--execute` 或校準、未讀秘密、未建資源、未呼叫付費 API、未新增 dependency、未提交／推送／部署或切正式模式。production 六端點 `live:false` 不變。

## 2026-10-08 T153 Phase B caller／child transport 七鍵版本（歷史；三鍵續作見本 Tasks 首節）

沿用已完成 Analyze、既有 checklist 例外與本次明確本機批准；requirements 71 已勾／12 正式 gate 未勾，本次再次確認只沿用例外，不重審已結案批次、不新增或重編 Task ID。下列勾選只代表本機子範圍，不是正式 T153／T154 或 gate 完成：

- [x] 本機 caller／worker：各 OS child 自行使用既有 REST transport／reserve adapter，parent barrier 後重查 stop／worker／時間，私密 IPC 交付假秘密；external worker 不使用 parent proxy。
- [x] 本機派送／時間／request／response cap、兩階段中斷、worker 故障、seed／reserve／cleanup timeout／unknown 與唯一有界唯讀確認；不重送異動、不退款、不 regrant，不清理晚到寫入可能未收斂的 inventory。
- [x] 針對性 mock 回歸、direct dependency graph strict／Node 語法及 dry-run／拒絕 execute；成功與失敗包絡、逐檔修改和限制見[證據](../../docs/verification/005-local-implementation-evidence.md)。
- [x] [外部執行方案](contracts/isolated-local-runner.md#2026-10-08-t153-phase-b-callerchild-transport-本機交付現行)、營運者提供的 Upstash 支援回覆、最少前置資料、逐分支 HTTPS POST／logical／provider command 上界、USD 分界、停止／清理與精確外部批准邊界已整理進既有決策包。本輪訊息收件時間記為 2026-10-08 16:27:19.183 +08:00；Upstash 原始寄件時間／寄件者／ticket 未提供。provider 規則已知但用量無 freshness SLA；owner current-state／floor provenance 與 stale-capable 契約批准仍缺，本輪未外部啟動。

Token／憑證補記：營運者於 **2026-10-08 06:28（Asia/Taipei）確認完成** `tokyo-mate-005-test` 重設；實際操作時間未提供。沒有測試舊 token 失效或新 token 可用，沒有索取／輸出／保存新秘密，也沒有為補記追加 Redis 操作。下方「完成證據待補」保留為先前批次歷史，本補記只更新營運者確認狀態，不新增技術驗證或外部授權。

T152 維持結案；T153／T154 父項及 12 項正式 gate 未完成。`providerMetering: "unverified"`、`billableUpperBound: null`、六個 production `live:false`、speech 受阻不變。本次到本機交付與文件同步停止，不連 Redis、校準不重跑、不讀真秘密、不新增套件、不提交／推送／部署。

2026-10-08 外部準備文件補充只界定待提供資料與未來一次性批准範圍；不代表前置已滿足、runner gate 已解除或任何 Task／正式 Readiness gate 已通過。T153／T154 父項 checkbox 與正式 gate checkbox 均維持原狀。

## 2026-10-07 T153 Phase B 本機方案與 mock harness（歷史；現行計量收斂見上節）

本次授權僅涵蓋 Phase B 方案、必要本機 harness／mock 測試與直接文件同步；未連線 Redis、未使用外部帳戶、未讀取或設定秘密、未付費、未部署、未新增 dependency、未提交。完整 seed、exact-key inventory、逐階段 REST／邏輯 command 包絡、unknown／cleanup 與待決計量 gate 見[runner 契約](contracts/isolated-local-runner.md#2026-10-07-t153-phase-b-既有reserve跨process方案本機mock完成外部未執行)。

選定既有 `createRedisSharedStore.reserve`／`REDIS_QUOTA_LUA` 首次 grant，使用同一 synthetic idempotency key，由兩個獨立 OS child 各建立 mock REST client 並發出一個 EVAL wire request；parent 只提供 mock authority，不代送 reserve。mock Lua interpreter 驗證一筆 `executionGrant: true`、一筆 duplicate `executionGrant: false`、日／週 reserve 各僅增加一次；unknown 測試只發一個唯讀 `getReservation`，不重送 reserve、不 cleanup。這是本機 mock，不是 Redis atomicity 或外部執行證據。

T153／T154 父項與全部正式 gate 維持未勾選；T152 維持結案。`providerMetering: "unverified"` 表示未執行真實 provider，`billableUpperBound: null` 不承載 command 數；也不放寬業務 runner verified-metering gate。後續支援回覆已解決計量規則未知項，但外部 Phase B 仍阻擋於 usage 無 freshness SLA／待批准人工觀測契約差異、可信 fresh-namespace floor／authority provenance、資源／憑證狀態及獨立外部執行批准。

## 2026-10-07 T153 限定外部校準子範圍證據（本次現行）

已依本次一次限定外部校準批准，由營運者於互動式無回顯終端機執行既有 caller；成功 JSON 與 21:09（Asia/Taipei）Console 人工後測已取得，見[完整證據](../../docs/verification/005-local-implementation-evidence.md#2026-10-07-限定外部-redis-校準營運者執行與人工-console-證據)。前次 `secret_invalid`／零派送獨立保留，不被成功紀錄覆寫。

本次校準操作及 Console 前後觀測子範圍已完成：4 REST POST、邏輯包絡 10、`written_confirmed`、PTTL 59948 ms、`cleanup: cleaned`、`manualFollowUp: false`。精確操作起訖時間與前次失敗原始 JSON 未取得；token 撤銷／輪替完成證據待補。provider 計量仍 `unverified`、計費上界仍 `null`，Console 差值不作 EVAL 計量公式或費用證明。

不新增／重編 Task ID、不變更任何 checkbox；T152 結案不變，T153／T154 父項與 12 項正式 gate 未完成。不啟動 Phase B 或部署。下方本機批次「外部待批准／未完成」保留為該批歷史，本次限定批准與已取得證據以本節為準，不延伸為其他外部操作授權。

## 2026-10-07 T153 本機子範圍：獨立 Redis calibration caller

不新增或重編 Task ID，不勾 T153／T154 父項或 12 項正式 gate，不重開 T152。

- 本機子項（完成，非 T153 勾選）：test-only 校準 caller `scripts/005-redis-calibration.mjs`（dry-run 預設、digest gate、無回顯秘密輸入、固定 4 script／≤4 REST／≤10 邏輯 commands、exact 1 key、unknown 不重送、未收斂不清理）與 mock 測試 `tests/api/redis-calibration.test.ts`（38 通過）、strict 型別 0 診斷。
- 外部子項（未完成）：以專用 `tokyo-mate-005-test` 執行一次校準並人工記錄 Console 前後用量——**待另批批准**及 owner 當時確認 Free／Tokyo／無 replication／剩餘額度與接受未知計量界線。

## 2026-10-07 Free Redis 外部測試前置核對（本次文件同步）

本次只更新既有 decision／contract／Plan／本機 evidence；不新增、重編或勾選 Task，不重開 T152。已建立的 `tokyo-mate-005-test` Tokyo `ap-northeast-1` Free DB 只記為 owner 提供的資源現況；截圖用量不是即時用量，沒有 Redis 連線、provider command 或 runner 執行。

前置校準提案及限制見[Readiness 決策包](readiness-decisions.md#2026-10-07-free-redis-連線準備與外部測試前置核對本次現行)及[runner 契約](contracts/isolated-local-runner.md#2026-10-07-free-redis-process-only-設定與最小校準提案尚未授權執行)。EVAL 計費細節、Free 超限行為、usage 更新延遲、usage port 與 read-region／replication 均未確認；故沒有可宣稱的 billable upper bound，提案不授權執行。`.env.local` 經檢查不存在、未追蹤且被 ignore；不建立，REST URL／token 只可能在後續另批的 parent process memory 注入既有 `rest.url`／`rest.token`。

T152 維持結案；T153／T154 父任務與 12 項正式 gate 仍未完成；六個 production 付費端點 `live:false`，speech 受阻。本次文件檢查不是應用測試或真實 Redis PASS。

## 2026-10-07 D14 本機工具批次（現行批准）

沿用本次明確 implementation 批准與 checklist 例外確認：12項正式gate保留未完成，不阻擋本批隔離工作、不代表正式Readiness。T152與T155～T161不重開；既有ID最高T161，本批不新增或重編ID。沿T153／T154追蹤下列本機子範圍，父任務仍未完成：

- T153 本機子範圍：`api/_lib/isolated-environment.ts`（schema）、`api/_lib/isolated-composition.ts`（TEST_ONLY factories）、`scripts/005-isolated-runner.mjs`、`scripts/005-isolated-runner.d.mts`與`scripts/005-isolated-worker.mjs`（有限雙process barrier、預算、deadline、確認及inventory清理）。
- T154 本機子範圍：同composition以注入transport連既有OIDC library、state、opaque Session及M1；不接預設HTTP export、不登入Google。
- 驗證：`tests/api/isolated-environment.test.ts`、`tests/api/isolated-composition.test.ts`、`tests/api/isolated-runner.test.ts`及`tests/fixtures/isolated-environment-fixture.ts`；schema±1／family共key／namespace／floor／registry、無memory fallback、真實子process故障／中斷／unknown／預算／清理及輸出去秘密。每phase驗證，再跑strict／build及最後完整回歸；無瀏覽器流程變更，不新增E2E。

具體schema／ports／測試映射以[本批契約](contracts/isolated-local-runner.md)為準。網路預設封鎖、只用合成設定、不讀process.env credentials、不新增套件或正式預設。本批不啟動外部runner、付費上游、Preview或下一批。

本機完成子項（不是新Task IDs，也不勾T153／T154父項）：

- [x] 本機隔離schema（T153／T154子範圍）：四family、namespace／floor／authority／registry／runner驗證。
- [x] 本機composition（T153／T154子範圍）：REST／OIDC library／opaque Session／資格／rate／M1／epoch／lifecycle evidence及exact inventory清理。
- [x] 本機runner（T153子範圍）：有限雙process／IPC barrier、保守計量預留、deadline、worker故障／中斷、unknown唯讀確認與輸出去秘密。
- [x] 本批78實跑／0跳過、strict163 source files／0診斷、Node runner語法、build及最後完整回歸113 files／1365實跑／0跳過；逐檔Safety及失敗修補見[證據](../../docs/verification/005-local-implementation-evidence.md)。

到本批停止點：不啟動外部runner或下一批。T152結案不變，12正式gate／T153／T154與真實Redis／OIDC／restore／Preview等欠項保持未完成。

## 2026-10-07 D01／D14 唯讀查核完成（本次現行）

本次只執行已批准的官方公開文件查核、Safety Guard、現有接線盤點及直接文件同步，結果集中於[既有決策包](readiness-decisions.md#2026-10-07-d01d14-唯讀查核與文件同步本次現行)及[實作證據](../../docs/verification/005-local-implementation-evidence.md)。沒有新增Task、重新規劃、application／tests修改或重跑已結案測試。T152與T155～T161維持已結案；T151公開Places欄位／SKU／價格先備已取得，但帳戶／usage／帳單成本證據仍缺，T153／T154真實整合、restore及Preview仍未完成。

新增正式操作停止條件：Google純`openid`不受Testing名單一般限制、Vercel新project首次deployment為production、Upstash Free DB資格及EVAL內部commands／restore免費條件未確認；須由owner先取得證據／調和，不在本次改產品契約或偷偷接線。舊namespace操作提案須適配現有helper的`{preview-<random-id>}`格式，不改程式schema。公開查核不是應用測試PASS；12項正式gate未勾、六端點`live:false`、speech受阻不變。資源／秘密／runner implementation／付費／Preview與production批准各自分開，本次到文件同步後停止。

## 2026-10-07 T152 本機父任務結案（本次現行）

本次使用者只批准核對與文件結案，以及 D01／D14 具體方案準備。T152 原定義明列「完成 T155～T161 後才勾此本機父任務；真實 Redis／restore 及 production 清除證據不屬本任務完成」。已核對七項勾選、[契約§10](contracts/request-epoch-and-key-lifecycle.md#10-本機實作驗收矩陣本輪執行真實服務項仍未驗)、[既存實作證據及本次核對](../../docs/verification/005-local-implementation-evidence.md)：T152 與對應 implementation 本機子項可結案，沒有把正式 gate 移入或宣稱完成。

T153／T154、T149／T150 部署子範圍、T151 成本證據及其他正式任務仍未完成。D01 優先 Places 的操作清單與 D14 隔離資源／Preview／預算／秘密／驗證／清理補充均沿用[既有決策包](readiness-decisions.md#2026-10-07-t152-文件結案與下一批批准界線本次現行)，不是外部操作、付費或部署批准。12 項正式 gate 未勾、六端點 `live:false`、speech 受阻維持；本次文件檢查不是應用測試 PASS。下方早期「T152 含正式 gate／不勾」描述保留為結案前歷史，以本節與末段 T152 定義為準。

## 2026-10-07 E01～E10 本機實作批次（本輪現行）

已批准E01～E10推薦方案用於本機application／UI／隔離測試與文件，無須逐小任務重問。E08／E09採單一可信管理者分步確認＋逐步重新授權／冪等／理由／證據／audit，不要求第二管理者；E07 30天可配置、可測，正式清除仍受帳單／爭議窗口及退役／restore屏障證據gate限制。source-map-js只定向更新至1.2.2。正式秘密、外部帳戶／服務、付費、正式key輪替／資料清除、legacy cutover／排程、Preview／正式部署／模式切換均未批准。未完成的父任務不得勾選，正式gate checklist維持原12項未勾。

執行順序：T155 文件同步與限定Analyze → T157 authority／encoding → T158 issuance與原子首次grant → T159本人查詢／legacy隔離／手動UX → T160 retention／uncertain／key lifecycle管理流程；T156 source-map-js定向修補可與T157平行。T161在所有本機phase完成後跑targeted、strict型別、build、隔離E2E及適當完整回歸，記錄真實Redis／production限制。每phase遵守Implement→Run→Verify→Fix。

- [x] T155 〔本機已批准〕同步Spec／Plan／data-model／UX／Readiness／契約／Tasks，明列E01～E10本機授權、單管理者分步確認、E07清除證據gate及未批准正式操作；執行唯讀限定Analyze／本機Readiness，不改12項正式checklist狀態。
- [x] T156 [P] 〔source-map-js定向更新已批准〕以npm將lockfile唯一`node_modules/source-map-js` entry更新至1.2.2，由npm生成resolved／integrity；不改manifest、不新增dependency／override、不擴大其他package；保存npm ls／audit結果及限制。
- [x] T157 [P] 〔E01～E05〕沿既有同slot authority與transport完成TEST_ONLY request epoch／capability types、固定canonical encoding／HMAC、時間／generation／revocation／retirement barrier、issuance索引與有界設定；不新增service／package／正式secret。測本人／Session／資格／CSRF／限流及encoding／time界線。
- [x] T158 [US] 〔原子首次grant〕同一次原子邊界整合本人可信資格、epoch／key撤銷、registry／G、日週額度、冪等、handle與首次grant；正常輪替後未grant舊capability可首次grant一次，已有grant duplicate／conflict均零第二grant；測reserve／retire兩種線性順序與unknown。
- [x] T159 [US] 〔E06／E10〕接既有本人status互斥oneOf DTO、410／409／503手動UX與legacy拒絕測試配置；production cutover保持關閉、legacy索引保留；確認成功不自動送付費操作，token／handle不入URL或持久儲存。
- [x] T160 [US] 〔E07～E09〕實作可配置30天retention、uncertain原窗口／tombstone／cleanup及dry-run／拒絕介面；完成單一可信管理者分步確認、每步重新授權／operation ID／理由／證據／冪等／audit、90天本機key rotation參數與引用狀態；缺正式安全證據不得清production資料／key。
- [x] T161 〔本機驗證與證據〕跑契約§10 targeted測試、strict型別、build、必要隔離E2E及最終完整回歸；攔截全部外部網路／付費呼叫，明確區分memory／Lua替身與真實Redis；更新逐檔Safety end-state、命令／失敗修補／測試證據及本機／真實整合／正式Readiness。

本批本機任務完成的既存實跑紀錄：最終 targeted 16 files／222 個實跑、完整回歸110 files／1287 個實跑、均0跳過；新增epoch Lua範圍54實跑／0跳過，strict／build及新舊005隔離E2E14個實跑通過。Safety逐檔證據與失敗→修補見[本輪證據](../../docs/verification/005-local-implementation-evidence.md)。本次依原定義結案 T152 本機父任務；正式退役／清除／跨instance／restore 證據仍由 T153 等既有正式範圍追蹤。歷史批次曾將 T152 誤述為含正式 gate 的父任務，該描述不再適用；12項正式gate未勾，不把本機完成宣稱005整體或production READY。

## 歷史：2026-10-07 Epoch 決策文件批次

本輪當時僅005文件、Safety與唯讀advisory／限定Analyze；沒有application／測試／dependency／epoch實作授權。E01～E10唯一完整推薦、理由／取捨、A／P界線及待執行驗收見[契約§9](contracts/request-epoch-and-key-lifecycle.md#9-e01e10-完整推薦決策包2026-10-07唯一集中答案)。不重審D10／D11、D13或既有71／12例外；實際當批查核證據見[005證據](../../docs/verification/005-local-implementation-evidence.md)。

T152批准後執行順序：E04／E05 authority及固定vectors → E01～E03原子簽發／同命令unknown確認 → E06／E09與T139／T140跨輪替首次grant及legacy拒絕 → E07／E08與T138收斂／對帳 → E10與T141／T142本人唯讀及新操作UX；每phase先Run／Verify／Fix再進下一phase。循環相依的決策可一起批准，但程式依序接線；真實跨instance／restore另依T153，不新增dependency或外部資源。本輪不執行此順序。

必要回歸：capability signing verify-only後有效舊capability未grant可首次grant一次；fingerprint verify-only只比較既有操作、同內容duplicate／不同內容conflict、第二grant為0；撤銷／退役先成立新grant為0，grant先成立原入帳／uncertain占用／保守結算不追溯作廢。候選同命令確認不補簽、不換expiry、不付費；不能用文件驗收欄位代替實測。

**歷史：2026-10-07 批准前任務同步**：D13／D01／D07–D08／D14 提案及限定 Analyze 已記錄於本文件末段新增 T148～T154；T148 已完成文件／Analyze 範圍，T149～T154 仍待各自核准與證據。不得把本機完成狀態解讀成套件安裝、外部操作、付費測試或正式部署授權。

## D10／D11 最新批准執行批次（2026-10-07）

**D13 本輪現行執行狀態**：使用者已批准指定 dependency 的本機安裝／接線／測試；沿用 requirements 71／12 例外與既有限定 Analyze，無需重問。T149／T150 只勾實際完成本機子範圍，整項含 Preview／artifact 仍未勾；T151 只完成 D01 不付費 builder／輸入 gate 證據，非成本上界；T152 僅 [epoch 草案](contracts/request-epoch-and-key-lifecycle.md)，不實作／清除。T153／T154 未授權。本輪命令、逐檔基線及結果見 [最新證據](../../docs/verification/005-local-implementation-evidence.md)；下方各「最新／目前」均為各批歷史。

本節優先於下方歷史「僅方向／待審」。L1～L5及checklist71／12例外持續有效，不重審結案批次。Safety起始master、40 tracked修改／146 untracked、staged0、485檔SHA-256保存於本session。T142／T147已完成本機契約、本人授權、CSRF、限流、有界輸入、原子去重與withdraw／resolve競態、UI；T141既有拒絕與文案契約足以支援免費本人lookup，不解除成本成功整合或外部gate。D01／07／08／13／14仍未決。

本輪最終實跑：99 files／1165 tests PASS（10:12:47／139.25s），app與全部API／support／PWA strict型別exit0，build89 modules exit0，新舊005隔離E2E13 passed（18.1s）。精確命令、中途失敗、變更清單與限制見[本輪證據](../../docs/verification/005-local-implementation-evidence.md)。僅T142／T147本機任務勾選，005整體、正式Redis／OIDC與部署仍非READY。

## 2026-10-07 決策批准同步與連續本機實作（本次最新）

沿用L1～L5、requirements71／12例外與已結案Analyze；Safety起始master、37 tracked修改／130 untracked、staged0，469個既有檔案SHA-256已保存。批准界線與D01／D07／08修訂方案見[readiness-decisions](readiness-decisions.md)，不是整列提案批准。D10／11僅方向，已補完整待審文案／reasonCode／分頁／回應上限稿，不實作尚待批准的產品行為。

| 狀態 | 子範圍 | 本次成果／限制 |
| --- | --- | --- |
| 本機完成、正式仍部分 | T010～T018／T019／T138 OAuth state | 同hash-tag hash＋sorted expiry index、原子create／consume／硬批次cleanup；從未callback到期清理、兩順序／重跑，不新增排程 |
| 本機完成、正式仍部分 | T014／T017／T019 Session | 核准本機composition注入24h絕對期限與過期後24hretention、5minstate、2s依賴；不配置正式flow／keyring |
| 本機部分 | D17 admission／subject等桶 | 原子固定60s limiter、Redis TIME／PX、HMAC去識別化、不同付費endpoint共桶、Retry-After；六HTTP boundary接注入authenticated rate，其他入口正式接線／可信平台來源與HMAC生命週期仍未完成。T020原任務是窗口計算，不能因決策包誤指T020而把它當新增limiter整項完成 |
| 本機部分 | T025／T049～T054／T136 | 共用有界bytes／JSON／multipart，額外欄位、UTF-16、PCM、image envelope／可信decoder port、逐端點lease取代120s fallback；成功descriptor／成本證據／正式handler仍受D01等限制 |
| 本機完成、正式仍部分 | T027／T037／T045／T073／T074／T099～T105 D09 | quota／map／access共用30s freshness、reset較早、offline／pagehide／pageshow／晚到／讀取時clock倒退；eligible DTO補同次authority resetAt，不從browser推算恢復。不以此宣稱所有端點UX正式驗收 |
| 本機完成 | T128 | WebAudio固定PCM／60s／取消釋放、unsupported明示文字、自動停止不自動轉錄；真實browser／mic仍屬T133 |
| 本機完成 | T129 | 裁切原座標保留、送出canvas副本最長邊2048／3MiB、錯誤保留原圖；JSON最壞4194373B與+1測試。trusted image decoder與vision成本仍屬T053／T133受阻 |
| 本機完成 | T076 | 已批准80%預設後端提示，既有整數used＋reserved／有效limit算法與唯讀邊界測試；不改授權 |
| 本機完成、正式仍部分 | T032～T035／T134 D16 | 核准本機tile15s flight／8s timeout／wait／100ms poll／1MiB、原子reservedAt／lease佐證，派送1999／2000／2001ms嚴格判斷；素材權利／CDN／真實外部未驗 |
| 待審／受阻 | T130／T139／T142／T147及成本成功整合 | 完整文字bytes量測不是token核定；有限明細／uncertain封存／最小防重放／HMAC退役只交修訂稿；D10／11新增細節待批，D13／14未批，不擅自開producer或正式查詢 |

本次各階段實跑與最終全套／型別／build／隔離E2E結果見[最新證據](../../docs/verification/005-local-implementation-evidence.md)。只勾完整本機任務，不因fixture通過勾含外部證據的整項。production六端點live:false、Places-only成功限制／speech S1不變，005／真實服務／部署非READY。

最終程式／測試修改後：95 files／1137 tests PASS（09:48:31，131.10s）；app及全部API／support／pwa strict型別exit0；build exit0；隔離E2E12 passed（16.0s）。本次本機範圍結束，不繼續受未決契約影響的成功整合或外部操作。

## 2026-10-07 Readiness決策包與獨立本機文件（本輪最新）

沿用L1～L5授權與requirements71／12例外，不重問已批准政策或重審結案批次。重新Safety保存起始464檔（37 tracked修改／125 untracked），master／HEAD／baseline／PDF不變。完成T001～T008的隔離環境、現況盤點、身分矩陣、等效測試骨架與runner／決策狀態文件；另補T010～T018／T019的OAuth state原子create／consume本機adapter與20個測試，沒有採候選值或接正式factory。

集中交付[剩餘Readiness決策包](readiness-decisions.md)：D01～D17逐項建議數值／依據／取捨／影響Tasks／批准後本機工作／所需驗證；包括T142查詢與T147申請仍未建的契約、保存／輪替與舊key防重放相依、quota／map freshness、T076無預設門檻、真實OIDC binding與隔離Redis／OIDC方案。此包是待批准提案，不改正式產品政策，不批准服務、秘密、dependency或部署；auth contract／data-model／Plan僅同步新增adapter的本機證據界線。

**本輪新實跑**：Service Worker＋六handler拒絕＋OIDC adapter相關回歸 **3 files／74 tests PASS**（09:01:34／3.22s）；不沿用上一輪9檔74、85檔1038或build／11E2E作本輪結果。僅勾完整文件任務；T076／T136／T142／T147與包含正式證據者仍未勾。詳見[本輪證據](../../docs/verification/005-local-implementation-evidence.md)。集中包與剩餘任務表交付後停止，005正式Readiness仍非READY。

OAuth state adapter新增測試先RED（缺module），首次整合2 fail／69 pass是harness以fixtureError回傳而非throw的斷言錯誤；已改成精確錯誤內容並證明碰撞不覆寫／到期不寫入，未放寬程式。最終 **4 files／74 tests PASS**（09:11:39／3.69s），新增state檔20tests；strict noEmit新測試及引用api／helpers與`tsc -b`均exit0。只證明本機Lua替身／port，不是真實Redis跨process／TTL或GoogleJWT；T010～T018／T019整項不勾。

## L1～L5 接續本機執行（2026-10-06～07；最新）

沿用使用者確認仍有效的連續本機授權，不重新批准或重審已結案批次。Safety起始424檔全部保留；Session核對為opaque ID＋逐次store lookup，簽章不取代登出／資格撤銷。週鍵確認僅格式差異，已將管理／engine／契約統一為 `YYYY-Www`，Asia/Taipei週一重置不變。

| 狀態 | Task／子範圍 | 本輪結果／界線 |
| --- | --- | --- |
| 本機程式完成；整項仍部分 | T019／T138／T143～T146、Session shared store | Redis業務Lua／SharedStore／REST／Session adapter、TIME窗口、G／雙封鎖、原窗口結算、uncertain清理與參數化Session清理；實際Lua interpreter＋Redis/cjson替身及engine整合通過，不等同真實Redis／TTL／跨process證據 |
| 完成 | T029～T031 | M1可信allowlist parser、逐請求admin helper、缺失／格式錯誤fail-closed、偽role無效與權限測試；未設定正式env／subject |
| 完成 | T067～T069、T077～T087、T089～T091 | 管理讀取、原子核准／切級／撤銷／追加與audit、CSRF／冪等、完整管理UI、管理者自身額度測試；同authority跨writer／當週／ISO週年案例通過 |
| 本機程式完成；正式仍部分 | T032～T035／T134 | 共享圖磚計數／cache／coalescing／credits／清理，120/min、1,000/day、第9,600筆允許／9,601筆拒絕、7天TTL與完整Session→G→tile管線；沒有真實Geoapify／CDN證據 |
| 本機子範圍完成；正式仍部分 | T010～T018、T027／T073／T099～T105 | OIDC通用library adapter＋claims mock；trusted quota、stale/offline/bfcache/晚到、429 scope與409不重送。真實JWT/JWKS library仍未批准／接線；freshness只可明列注入，不新設正式預設 |
| 正式提示門檻待批准；整項仍部分 | T076 | overview DTO／UI已有可信nearLimits提示；移除未批准的固定80%，改為明列nearLimitPercent而無預設，缺失／非法只拒絕overview。其他管理操作可獨立使用 |
| 受批准參數限制 | 六成功handler、T128～T130／T136／T142 | 未解除Places-only成功限制，production六端點仍live:false；成本／輸入／lease／保存與查詢契約待批准，不用mock當正式上界 |
| 尚未實作且缺producer契約 | 新增T147 | 申請建立／enqueue尚未寫；現有review queue只讀取／處理既存申請，首次登入不自動代提申請。不是單純缺外部來源 |

**本輪整合實跑**：全回歸 **85 files／1038 tests PASS**（124.01秒，最後提示門檻修補前）；`tsc -b` 與涵蓋api/src/tests/pwa的暫存config均exit0；`npm run build` exit0；最終隔離mock Playwright **11 PASS**（13.2秒）。最後門檻修補後相關管理合併回歸 **9 files／74 tests PASS**、兩種型別exit0、結束Safety PASS；詳見[證據](../../docs/verification/005-local-implementation-evidence.md)。首次全回歸84 files／1020 tests有2個跨日quota fixture失敗，已固定測試時鐘並重跑全套，未放寬過期防護。

只有表列完整程式／測試任務新增勾選；其餘包含正式證據或批准欠項者維持未勾。實際測試合併於 `admin-atomic-store`／`admin-redis-integration`／`admin-self-quota` 等既有本輪測試檔，不為原提案檔名複製同一組測試。完整逐檔清單、命令、失敗修補、Safety及剩餘分類見 [本機證據](../../docs/verification/005-local-implementation-evidence.md)。下方執行紀錄為前輪歷史。

## L1L5 本機 Implement 執行紀錄（2026-10-06）

**本節為最新執行狀態，優先於下方各歷史「未授權／未執行」描述。** 使用者明確批准依 Plan §14、Phase 12、統一 Readiness／Analyze 連續執行 L1～L5；本機 `speckit-implement` 與 prerequisites 已執行，FEATURE_DIR＝005。使用者確認保留 requirements 的 12 項未完成，不重複請求例行批准。七檔隔離 pipeline 保持結案，本輪跑相關程式回歸，不重審歷史結案。

| 狀態 | Task／子範圍 | 本輪實際結果 |
| --- | --- | --- |
| 完成 | T009 | Google OIDC 設定介面／名稱／驗證，7 個 config＋未配置 auth GET 拒絕案例通過；不寫正式 env／secret |
| 完成 | T088 | 獨立 `/admin` overview，不在一般 UI 顯示管理入口；fixture 403 無統計外洩，browser 與 UI 測試通過 |
| 部分完成 | T143／T144／T145／T146 | 全集合 bundle／revision／digest、同原子 G／日週／追加／資格／evidence、37 個新增原子 matrix 案例；memory mock，不是 Redis authority；resolve-only 僅保留隔離相容，沒有正式成功授權 |
| 部分完成 | T019／T138 | 單次 EVAL transport、同 hash-tag 與 timeout／無重試 tests；完整業務 Lua／SharedStore adapter／cleanup 尚未實作。Lua 5.4.2 可用；沒有 Redis server／cli／cjson，未安裝或連外 |
| 部分完成 | T010～T018／T029～T031／T135 | OIDC flow／signed Session／逐次查驗／撤銷／登出／可信 admin ports、SDK maxRetries:0 與單次 fetch；真實 token 簽章／JWKS provider 與共享 Session store 尚未實作，正式 TTL／輪替／lease 未決 |
| 部分完成 | T025～T028／T036／T043／T049～T054／T132／T140～T141 | 六真實 POST 拒絕 boundary 已有未配置 503、注入 fixture 401／403／503、上游零次證據；完整合法成功管線未完成，不解除 Places-only 限制。歷史內容 tests 只測 executeUpstream |
| 部分完成 | T027／T073／T076／T082～T084／T089／T099～T106 | 自身額度／overview、權限／CSRF 前置／白名單 projection、stale／offline／晚到回應、Public 六 client 防送出與照片內容保留；完整額度受限 UX／管理操作尚未完成 |
| 部分完成 | T032～T035／T037～T047／T055～T064／T074／T093～T098／T110～T118／T134 | map eligibility／同源 tile ports／cache hit與304重驗／不掛圖／定位與搜尋前重查；4:3／16:9 示意／破圖 fallback、SW API exclusion 與 11 項 browser mock；shared tile writers 未實作 |
| 受影響子範圍停止 | T067～T069 的追加 HTTP 解碼 | admin 範例週鍵 `2026-W39-AsiaTaipei` 與 engine `2026-W39` 不同，未自行選定／轉換，待 artifact reconciliation；不停止其他獨立工作 |
| 尚未實作 | T077～T081／T085～T087／T090～T091 及管理原子異動／audit | 完整 users／detail／review／audit、approval／top-up＋audit 與對應 UI；不是單純缺外部證據 |
| 正式受阻／未授權 | T107～T109／T119～T123、T142 及其他正式 gates | 正式原檔／授權、A1／A3／A4／A5／A7／保存／lease、409 查詢、外部／秘密／付費／提交／推送／部署／模式切換均未自訂或執行 |

**最新實際驗證**：`vitest run --maxWorkers=1 --pool=forks`＝73 files／900 tests PASS；`tsc -b` 與暫存 config 涵蓋 api／src／tests（含 pwa）均 exit 0；`playwright test --config=playwright.config.ts '005-local-protection.e2e.ts'`＝11 PASS。SW controller 與 `/` App Shell cache 確實存在後才驗 API cache 為空；API 為 mock，不是真實 Vercel／CDN／provider 證據。

**結束 Safety**：master／HEAD／baseline／plan.pdf hash 與開始相同；37 tracked 修改／85 nonignored untracked／staged 0，起始 386 檔全保留，新增38檔後424檔。`git diff --check` 通過；套件、env、部署設定、production 價表、001～004、local-only政策不變，暫存型別config已移除。

完整命令、階段結果、失敗修補、修改範圍與 Safety 見 [本機證據](../../docs/verification/005-local-implementation-evidence.md)。只勾完整 T009／T088；其他整項缺工作者保持未勾，requirements 71／12 不變。本輪未完成所有可執行本機範圍，不宣稱 L1～L5 全部、功能 005、真實整合或部署完成。

**輸入文件**：`specs/005-api-protection-access-modes/{spec.md, plan.md, research.md, data-model.md, quickstart.md, contracts/*, ux-ui-design-handoff.md, checklists/requirements.md}`

**狀態**：本文件為 `/speckit.tasks` 產出；Technical Plan 架構與初始額度已核准，本輪已進入 `/speckit.analyze`，並停在 Implementation Readiness Gate；**不構成 Implementation 授權**。未經使用者明確批准 `/speckit.implement`，不得執行任何實作任務或修改 application code；外部服務實際啟用、新 dependency、Geoapify 付費升級、秘密值／環境變數、正式站模式切換與部署仍須分別取得獨立批准。

**測試政策**：spec.md 明確要求可驗收之情境（SC-001～SC-017、quickstart.md 情境 1～17）；因此本文件包含測試任務。所有尚未執行的測試任務一律標示為「待測」，不得標示 PASS。

**2026-10-06 本輪七檔授權**：A6 六列已核准，request 日／週 userMessage 統一為「今日／本週剩餘額度不足以預留這次操作，僅本次操作無法執行；其他功能仍會依各自的資格、額度及防護狀態判斷是否可用。」限定 Analyze 無新增隔離 blocker 後，可執行 Readiness §4～6 七檔及 P01～P22，RED→GREEN→核心回歸→專案／新增測試型別檢查。僅 T014／T017／T025／T026／T028／T136／T140／T141 隔離子範圍，不勾選整項；P-G1／P-G2／P-I1、12正式 gate、核心介面與 production 六端點 live:false 保留。其他未授權描述為前批歷史，不授權 T135、handler／UI、查詢、連外、安裝、提交或部署。

**本輪執行紀錄（僅隔離子範圍完成並停止）**：七檔已實作，P01～P22有實跑證據；最後新增3 files／123 tests與專案／新增測試型別檢查exit0，相關核心合併11 files／334 tests通過。T014／T017／T025／T026／T028／T136／T140／T141整項marker維持未勾選；唯一Task142／已勾10不變。詳細實際命令、逐檔變更、RED→GREEN、Safety與限制見 [Readiness本輪節](checklists/pipeline-readiness-report.md) 與 [Analyze本輪節](checklists/analyze-report.md)；所有正式gate保留，不執行下一批。

**依賴前提（執行任一實作任務前必須成立，本階段僅記錄，不建立）**：
- Technical Plan 架構、兩級日／週額度、圖磚代理初始限額／TTL 與 M1 管理者來源已核准；仍須由使用者明確批准進入 `/speckit.implement`。
- 新 dependency 安裝、真實 Backend shared state resource、OIDC／Geoapify 外部服務啟用、秘密值／環境變數、Geoapify 付費升級、正式站切換與部署仍需獨立批准（Constitution Approval Gate、repo `.github/copilot-instructions.md`）。
- 靜態示意圖正式資產尚未進入 repository；只阻擋 T107-T109 的正式資產整合，不阻擋本機 mock、元件 fallback 與其他隔離測試。
- **2026-10-06 規劃核准同步**：A2（A＝1）、A8（G-B）、A9（S1）、A10（P1）為「規劃已核准」，不等於實作授權；A1／A3–A7 數值待核准；production 價表在 A1 核准與證據完成前須全部 `live: false`。**第一批本機 mock 批次（plan.md §10.3.5）**：T126、T020、T019、T127、T135（可平行）→ T021 → T022 → T023、T131 → T024；不含 T025 以後、T128、T129、T130、T132、T133、T134 與任何 UI／圖磚任務。外部帳戶、靜態示意圖資產、真實瀏覽器證據只阻擋範圍二／三，不阻擋範圍一。
- **2026-10-06 第一批 mock 批次證據**：T126、T020、T019、T127、T021、T022、T023、T131、T024 已完成並勾選（T135 未執行、未勾選）。`node_modules\.bin\vitest.cmd run tests/api api/_lib`＝18 files／180 tests 通過；`tsc -b` exit 0（另以暫存 tsconfig 檢查四個新測試檔、tests/support、tests/fixtures 亦無錯，已刪除暫存檔）。限制：並發／原子性僅由記憶體 mock（`tests/support/in-memory-shared-store.ts`）驗證，**不代表 Upstash Redis 原子性已驗證**；真實價表全部 `live: false`，G＝8,036 等數值僅為 `FIXTURE_` 示意；PCM 以本機合成 fixture 驗證，未驗證瀏覽器錄音或供應商時長相容性；真實 adapter／部署／外部帳戶、範圍二與範圍三仍 BLOCKED，功能 005 整體非 READY。
- **2026-10-06 第一批 mock 審查（唯讀；未改程式）**：T020、T021、T022、T023、T126、T127、T131、T024 於 mock 範圍成立；**T019 更正為未完成**（僅完成介面型別、timeout、測試 mock；缺 Lua／transaction adapter、連線與週追加／撤銷原子操作）。Findings：(H1) `SharedStore` 契約由呼叫端每次傳入 `limitMicroUsd`，無儲存端 limit／top-up／revoke 原子操作，週追加與撤銷無法與新預留共同判斷（讀額度→傳入→預留存在競態）；(H2) `reserve` 的 `duplicate` 在原預留已 settled／released／uncertain 或仍在途時仍回 `ok:true`，handler 若不檢查 `reservation.status` 會重複呼叫上游，第二批須訂定語意（僅首次 `reserved` 可放行）；(M1) 冪等比對不含 `estimateInputs`／請求內容雜湊；(M2) `evaluateAvailability` 的 `costModelVersion` 為選填，地圖 gate 省略時不偵測價表過期，價表亦無有效期欄位；(M3) `reserve` 未驗證 `endpoint` 執行期值；(M4) 預留後故障（process 中斷未結算）無租約／逾時轉 `uncertain` 契約，reserved 保留至窗口結束（保守但未規格化）。mock 限制：原子性僅來自單執行緒同步區段，不能證明 Redis 讀改寫安全。建議下一批：先補 T019（含 limit／top-up／revoke、reserve 狀態語意、reservation lease）並經 analyze；T135 仍待做。
- **2026-10-06 第一批審查修補 R1（僅 mock／隔離模組；未接線 handler、未動 UI／套件）**：H1—`reserve` 改由 store 原子判斷資格／等級／當週有效追加並預留，新增 `addTopUp`／`revokeTopUp`／`setEligibility`／`readQuota`，引擎只呼叫 `store.reserve` 一次（測試以 spy 證明）；H2—`executionGrant` 只存在於建立預留的那一次，`duplicate`（reserved／settled／released／uncertain、lease 到期、跨週）一律不放行，同鍵不同內容為 `idempotency_conflict` 並記錄；M1—新增 `quota-fingerprint.ts`（SHA-256，不含內容）；M2—價表 `effectiveFrom`／`expiresAt`，引擎、`cost-estimators`（`now`）、`quota-threshold`（`now`）皆檢查；M3—新增 `quota-validation.ts` 執行期驗證與 BigInt 運算，無效 store 回傳一律 503；M4—預留 lease：逾期只轉 `uncertain`，不退款不重放；結算高於預留如實計入並封鎖該價表版本。**T019 仍為部分完成**（缺 Lua／transaction adapter、連線、真實 resource；mock 原子性≠Redis 證據）；T135 不執行；範圍二、三仍 BLOCKED。驗證：`npx vitest run tests/api api/_lib`＝18 files／208 tests 通過；`npx tsc -b` exit 0；另以暫存 tsconfig 檢查 `api` 與 `tests` 全部 exit 0（已刪除）。詳見 checklists/analyze-report.md「R1」。
- 任何任務標註「〔需獨立批准〕」者，在取得對應批准前只能完成文件、mock、介面或隔離測試；不得建立真實外部帳戶、安裝套件、填入秘密值或部署。mock／隔離證據不得標為 production PASS。

## 本輪批准來源與歷史驗證證據範圍

- 本輪八項政策來源為使用者訊息「Tokyo Mate 功能 005 — 已批准政策的 Specification Sync」之「已批准政策」第 1–8 項。文件同步授權不等於 `/speckit.implement` 授權；精確 gate 原文與核對來源記於 plan.md §0.1、research.md R14。
- `180 tests`：2026-10-06 第一批 mock 批次；`node_modules\.bin\vitest.cmd run tests/api api/_lib`；18 files／180 tests。只表示該輪本機 mock 範圍。
- `208 tests`：2026-10-06 R1 mock 審查修補；`npx vitest run tests/api api/_lib`；18 files／208 tests。只表示該輪 mock 範圍；`npx tsc -b` 與暫存 tsconfig 檢查為另列 type-check 證據，不是本輪驗證。
- `529 tests`：來源為先前 Chat 的歷史執行回報（`vitest.cmd run` 全套件，52 files／529 tests，exit 0）。本輪未重跑、未獨立核驗；目前本機文件仍無原始 console 輸出附件可追溯細節，因此不得標示為本輪 PASS 證據。
- 本輪不執行應用程式測試；文件檢查與 `/speckit.analyze` 不屬於測試 PASS。T019 維持部分完成，真實 Redis/Lua 證據待取得；H1／H2／M1–M4 不得因文件同步而標為已關閉。mock／隔離證據不得標為 production PASS。

## Format: `[ID] [P?] [Story?] Description`

### 最新限定批次紀錄：2026-10-06 H1-R1 時鐘倒退修補

- **授權／停止點**：使用者明確授權 H1-R1 並再次同意保留 checklist 12 項正式 gate；僅 estimation → command → grant 的可信時鐘修補，不執行 T135／T025、不建立 pipeline、不接 handler／UI、不新增套件、不連外、不提交或部署、不核定正式 lease、不改 plan.pdf。完成 RED→GREEN、回歸及唯讀 Analyze 後停止。
- **歷史更正（附加而非覆寫）**：下節「H1 新 lease command／授權時點驗證」及 Analyze 歷史「H1 已修補」只代表上輪隔離證據；後續 H1-R1 探針發現 estimation＝02:00:00.000Z、command／grant＝01:59:59.999Z 仍有 executionGrant。2026-10-06 18:32:51 精確 RED 重現後，本輪補上 estimation → command 的比較與可信 Date 快照；不宣稱先前已涵蓋此缺口。
- **任務追溯**：沿用 T021／T024／T136 隔離子範圍（FR-052／SC-015）；`tests/api/quota-atomic-evidence.test.ts` 新增 15 cases，不新增／重編 Task ID。T136 正式參數與共用 default 移除未完成，整項不勾選；T019／T138／T140 及全部既有正式 gate 原狀保留。
- **修補**：`quota-engine.ts` 固定每次可信時鐘讀取的 Date 值；command 無效或早於 estimation 時回 503／內部 INVALID_CLOCK，在 store.reserve 前拒絕。既有 grant 無效、倒退／lease 到期拒絕保留；相等不繞過效期／lease。validation、registry、HMAC、shared-store、mock、結算／清理程式未改，歷史預留不套用新授權檢查。
- **RED→GREEN**：本機 `vitest.cmd run tests\api\quota-atomic-evidence.test.ts -t '估算 02:00:00.000Z' --reporter=verbose`＝1 failed／44 skipped，exit 1，實得 ok:true／executionGrant:true；完整 `-t H1-R1 --reporter=dot` 修補前＝2 failed／13 passed／44 skipped，exit 1（含可變 Date）；修補後同命令＝15 passed／44 skipped，exit 0。command 拒絕以 spy 證明未呼叫 store.reserve；grant 拒絕後日／週各保留 5,000 µUSD，相同請求僅 duplicate／executionGrant:false。
- **回歸／型別**：直接相關 5 files／162 tests PASS；隔離 `tests\api api\_lib`＝23 files／332 tests PASS；`tsc.cmd -b` 與五個直接相關測試的 strict noEmit 型別檢查均 exit 0。全部命令與時序詳見 `checklists/analyze-report.md` 最新 H1-R1 節，測試數不取代行為佐證。
- **Analyze／Safety**：唯讀技能核對 FR 56＋SC 17、142 個唯一 Task、引用覆蓋 73／73、懸空 Task 0；本批無新增 CRITICAL／Constitution 衝突。開始／結束均 40 個 untracked，tracked／index 無差異，master／HEAD／baseline 不變，plan.pdf SHA-256 不變；沒有新暫存檔。功能 005、真實整合及部署仍非 READY；本批只代表隔離 mock。

### 現行限定批次紀錄：2026-10-06 C1 收斂＋H1／H2 隔離修補

- **來源／授權**：使用者本次「Tokyo Mate 005 — C1 收斂＋H1／H2 隔離修補」及後續明確同意繼續限定範圍，保留 checklist 12 項正式整合 gate。本節 C1／H1／H2／M1／M2 是上一輪整合複審的 ID，不與歷史同名 findings 混淆；上方初始階段及歷史批次敘述不代表本批狀態。
- **任務盤點**：沿用 T021／T022／T024、T136 的隔離 lease 子範圍、T137、T138 的隔離清理子範圍及 T140 registry 回歸；沒有新增或重編 ID。新測試 `tests/api/quota-atomic-evidence.test.ts` 對應 FR-052／FR-053／FR-056、SC-015／SC-016，T136／T137／T138；registry mutation 回歸對應 FR-051、T140。T136 隔離不依賴或執行 T025／T135。
- **完成範圍**：C1 文件與獨立內部 `settlementStatus`；H1 新 lease command／授權時點驗證；H2 settle／cleanup 同次原子 reservation＋原窗口 usage／身分佐證、狀態轉移及金額下界；M1 快照回歸（現有 clone 已正確，未改 registry）；M2 memory mock 兩種同時發起原子順序、部分／timeout cleanup 重跑、settle 延遲成功重送及跨期不重授權。T137 原有隔離 checkbox 保持完成，不因此擴大為真實服務完成。
- **未完成範圍**：T019 真實 adapter／Redis/Lua；T136 正式逐端點參數及共用 default 移除（通用 default 仍在，測試僅注入 lease）；T138 provider／排程／可信對帳；T140 pipeline／權威 G 整合；T025／T135／T141／T142 均未執行，未接 handler／UI。含未做工作之 T019／T136／T138／T140 整項保持未勾選，production 六端點 live:false。
- **RED**：先以本機 `node_modules\.bin\vitest.cmd run tests\api\quota-atomic-evidence.test.ts tests\api\cost-registry.test.ts --reporter=dot` 取得 2 files、27 failed／48 passed（exit 1）；M1 已通過，無多餘 registry 修補。工具 `runTests` 未找到測試，改用已安裝 CLI，沒有下載套件。
- **修補迭代**：5 files 第一輪回歸 13 failed／121 passed（舊 `ok:true` 斷言）；測試 type-check 首輪報假 store 缺新 scope 及舊 `ok` narrowing，已同步契約，未削弱記帳／封鎖斷言。隨後 5 files／134 tests 通過，再補雙窗口、狀態轉移與 cleanup 歸屬／count 回歸。新 evidence 檔最終 44 cases，registry 新增 1 case（現為 44），新增共 45 cases。
- **最終驗證**：`node_modules\.bin\vitest.cmd run tests\api api\_lib --reporter=dot`＝23 files／317 tests PASS，exit 0；`node_modules\.bin\tsc.cmd -b`＝exit 0；`node_modules\.bin\tsc.cmd --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --types vitest/globals,node --skipLibCheck tests\api\quota-atomic-evidence.test.ts tests\api\cost-registry.test.ts tests\api\quota-reservation.test.ts tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts`＝exit 0，涵蓋新增測試及引用支援／fixtures，無暫存 tsconfig。
- **Analyze／停止**：依本機技能執行唯讀分析，結果依已授權文件同步流程另存 Analyze report；文件檢查不列應用測試 PASS。無連外、套件、服務、金鑰、environment、commit、push 或部署。保留 plan.pdf 與 local-only tooling；005、真實整合及部署非 READY，完成本批後停止。
- **Safety**：開始 39 個 untracked，新增 evidence test 後 40 個，全部原成果保留；先前進度訊息的「36」為計數誤記，以 Safety Guard 與結束命令計數為準。index／tracked working tree 無變更，master／HEAD／baseline 不變；plan.pdf 雜湊與前批紀錄一致。

- **[P]**：可平行執行（不同檔案、無未完成依賴）
- **[Story]**：對應 spec.md 之 User Story（US1～US8）
- 每項任務附精確檔案路徑與最少一項 FR／SC／UX／Plan 或 contract 追溯

## Path Conventions

沿用既有專案結構：`api/`（Vercel Serverless Functions）、`api/_lib/`（共用 helper）、`src/`（React + TypeScript + Vite 前端）、`tests/api/`、`tests/pwa/`。新檔案路徑為 Implement 階段之提案路徑，本階段不建立檔案內容。

---

## Phase 1: Setup（Shared Infrastructure，未涉及應用程式碼）

**目的**：建立隔離測試環境與批准追蹤基礎，不安裝套件、不建立外部帳戶。

- [x] T001 建立本機隔離測試環境檢查清單於 `specs/005-api-protection-access-modes/checklists/isolated-environment.md`：記錄需 mock 之 OIDC provider、shared store、OpenAI／Google Places／Geoapify 上游、時間模擬（`Asia/Taipei` 日／週窗口）與瀏覽器 Network/HAR 工具需求（對應 quickstart.md 前置條件）
- [x] T002 在 `plan.md` §10.2 決策表維護「決策狀態」：保留架構／初始額度已核准，以及外部服務啟用、Geoapify 付費升級、秘密值／環境變數與部署待獨立批准的區分
- [x] T003 [P] 盤點既有六端點現況輸入驗證（`api/assistant.ts`、`api/transcribe.ts`、`api/places.ts`、`api/speech.ts`、`api/photo-ocr.ts`、`api/photo-translate.ts`）並記錄於 `specs/005-api-protection-access-modes/research.md` 附錄（唯讀核對，不修改端點程式碼）
- [x] T004 [P] 盤點既有 `src/service-worker.ts` 對 `/api/` 的排除規則，記錄涵蓋範圍與是否需擴充至 `/api/map/tile/*`、`/api/auth/*`、`/api/me/*`、`/api/admin/*`（唯讀核對）
- [x] T005 [P] 盤點既有 `src/features/nearby/NearbyMap.tsx`、`src/screens/NearbyScreen.tsx`、`src/services/api.ts` 中 Geoapify 直連與 `/api/places` 呼叫路徑，記錄改造範圍清單（唯讀核對，對應 plan.md §6.1）
- [x] T006 建立測試身分矩陣文件 `tests/fixtures/005-identity-matrix.md`（規劃內容，暫不建立 fixture 程式）：未登入、已登入未核准、已撤銷、已到期、第一級、第二級、管理者、非管理者、Session 無效
- [x] T007 [P] 建立 Vitest 測試檔案骨架清單（僅列出待新增檔案路徑，不建立內容）：`tests/api/auth-session.test.ts`、`tests/api/approval-gate.test.ts`、`tests/api/quota-reservation.test.ts`、`tests/api/admin-dashboard.test.ts`、`tests/api/map-tile-proxy.test.ts`；本輪於isolated-environment列出等效既有檔案，不複製相同測試
- [x] T008 確認 `package.json`／`vitest.config.ts`／`playwright.config.ts` 現況是否足以支援上述測試分類；若需新增 test script 或 config 段落，記錄為待批准變更，不在本階段修改設定檔

**Checkpoint**：完成後所有既有現況已唯讀核對並記錄，未變更任何應用程式碼或設定。

---

## Phase 2: Foundational（阻擋所有 User Story；須先取得 Implement 授權，外部啟用另設 gate）

**目的**：身分、Session、核准資格、額度引擎、管理者可信來源與六端點／圖磚共用保護 pipeline，為所有 User Story 的共同前提。**任一 Foundational 任務完成前，不得開始對應 User Story 之實作任務。**

### 身分與 Session（FR-005、FR-006、FR-008；plan.md §3.3；contracts/auth-and-session-endpoints.md）

- [x] T009 於 `api/_lib/oidc-config.ts` 定義已核准之 Google OIDC Authorization Code + PKCE 設定介面與環境變數命名（`OIDC_ISSUER`、`OIDC_CLIENT_ID`、`OIDC_CLIENT_SECRET`），並以 mock 驗證；新增 library、真實 OAuth app／callback／secret 啟用仍需獨立批准
- [ ] T010 於 `api/auth/login.ts` 實作 `GET /api/auth/login`：設定 OAuth 暫存 Cookie（`HttpOnly; Secure; SameSite=Lax`）並導向 OIDC provider（依 contracts/auth-and-session-endpoints.md）
- [ ] T011 於 `api/auth/callback.ts` 實作 `GET /api/auth/callback`：驗證 `state`／PKCE、交換 code、建立 App Session Record（`api/_lib/session-store.ts`）並設定 `HttpOnly; Secure; SameSite=Strict` Session Cookie；不自動補送登入前被拒絕之請求
- [ ] T012 於 `api/auth/logout.ts` 實作 `POST /api/auth/logout`：清除 Cookie 並撤銷 Session Record；操作冪等
- [ ] T013 於 `api/auth/session.ts` 實作 `GET /api/auth/session`：只回傳 `authenticated` 布林值，不揭露核准資格
- [ ] T014 [P] 於 `api/_lib/session-store.ts` 實作 Session 查驗共用函式（供六端點、圖磚代理、管理端共用）：查無、過期、`revokedAt` 有值一律視為未登入
- [ ] T015 [P] 於 `tests/api/auth-session.test.ts` 撰寫（待測）：callback 失敗不建立 Session、logout 冪等、撤銷後下一次查驗回未登入

### 兩級使用資格與核准 Record（FR-005、FR-006、FR-007、FR-009；data-model.md §3；contracts/auth-and-session-endpoints.md）

- [ ] T016 於 `api/_lib/approval-store.ts` 實作 Paid Access Approval 查詢／寫入共用函式：`status`（`pending/approved/rejected/revoked/expired`）、`tier`（`tier1/tier2`）
- [ ] T017 於 `api/_lib/approval-gate.ts` 實作共用「使用者核准資格查驗」helper：非 `approved` 或已撤銷／到期一律回 `403 ACCESS_NOT_APPROVED`；供六端點與圖磚代理共用
- [ ] T018 [P] 於 `tests/api/approval-gate.test.ts` 撰寫（待測）：未核准、已撤銷、已到期、`approved` 四種狀態的授權結果；偽造 request body 中 tier／status 欄位不得生效（FR-008）

### 額度引擎：原子預留與結算（FR-009～FR-023；data-model.md §4-6；plan.md §3.4、§4）

- [ ] T019 〔第一批僅完成「型別契約＋timeout 輔助＋測試用 mock」；R1 已將契約擴充為 store 端原子 reserve／addTopUp／revokeTopUp／lease／executionGrant（仍僅型別與 mock）；原任務之連線、Lua script／transaction 執行、週追加／撤銷原子操作尚未完成，維持部分完成且不得勾選完成〕於 `api/_lib/shared-store.ts` 定義已核准之 Upstash Redis-compatible race-safe shared store client 介面（連線、Lua script／transaction 執行、逾時處理）與 mock 實作；真實 resource／region／budget／credential 啟用仍需獨立批准。後續真實技術驗證須包含 Redis key/hash-slot 配置、單一原子更新涵蓋資格／追加／預留／結算、跨 writer 併發與 TTL／保存策略；需取得可重現的 Redis/Lua 證據，不能以記憶體 mock 代替。
- [x] T020 於 `api/_lib/quota-window.ts` 實作 `Asia/Taipei` 日／週 windowKey 計算與下一次 `resetAt` 計算（不依賴瀏覽器時鐘；對應 FR-022）
- [x] T021 於 `api/_lib/quota-engine.ts` 實作原子預留操作（依 plan.md §3.4 pseudo-code）：同一原子操作檢查並預留日／週額度，任一不足即拒絕，回傳 quota snapshot〔R1：資格／等級／當週追加由 store 同一原子操作判斷；僅首次建立預留取得 `executionGrant`；mock 證據，非 Redis〕
- [x] T022 於 `api/_lib/quota-engine.ts` 實作結算規則（成功／明確未計費失敗／逾時或不確定）依 plan.md §4.4 一致處理，更新 `usedEstimatedUsdMicro`／`reservedEstimatedUsdMicro`〔R1：結算超額如實計入並封鎖價表版本；lease 逾期只轉 uncertain；mock 證據〕
- [x] T023 [P] 於 `api/_lib/cost-estimators.ts` 為六端點分別實作可信最大估算成本函式（assistant/transcribe/places/speech/photo-ocr/photo-translate），依 plan.md §4.2 表一（A＝1）與價表（T126）；無法界定或 `live: false` 的端點（speech／transcribe 在 A9＝S1／A10＝P1 證明完成前，以及 production 預設全部）以內部 `reason: COST_BOUND_UNPROVEN` 拒絕，不進入預留與上游；handler 對外統一回 503 `PROTECTION_SERVICE_UNAVAILABLE`；不寫死任何 G 公式（T131）；依賴 T126；屬第一批 mock（plan.md §10.3.5 2c）
- [x] T024 [P] 於 `tests/api/quota-reservation.test.ts` 撰寫（待測）：並發請求不得共用同一筆剩餘額度（SC-006）、重複提交／多分頁／直接呼叫皆受相同原子檢查、日/週窗口跨期後正確重新計算（含瀏覽器時鐘偏移不影響）

### 成本上界補強（plan.md §4.2、§4.5；決策 A1／A2／A8；A2／A8 已規劃核准、A1 數值待核准；依賴 T023；全部 mock，不安裝套件、不連外）

- [x] T126 [P] 於 `api/_lib/cost-price-table.ts`、`tests/fixtures/cost-price-fixtures.ts`（僅測試，名稱前綴 `FIXTURE_`）與 `tests/api/cost-estimators.test.ts` 建立價表（單價、`S_e`、`live` 旗標、模型白名單）與測試（待測）：**只採 A＝1（A＝3 撤回，不得存在 A＝3 欄位）**；production 價表全部端點 `live: false`（A1 數值未核准）；production 路徑不得載入 fixture；`OPENAI_MODEL` 不在白名單時以內部 `reason: COST_MODEL_UNSUPPORTED` 拒絕、對外映射 503 `PROTECTION_SERVICE_UNAVAILABLE`；表一各 `R_e` 的 ceil 一次算術（僅 mock 算術，不代表真實上界）；prompt／知識 byte 上限對 `catalog` 與最壞字串；各端點最壞轉義請求的 pre-parse 尺寸（FR-017；plan.md §4.2.1、§4.2.3；第一批 mock 1a；先於 T023）
- [ ] T135 [P] 〔A2 規劃已核准；第一批 mock 1e〕於 `api/_lib/openai.ts`（僅加 `maxRetries: 0` 與可選 timeout 參數，不接線數值）與 `tests/api/openai-single-attempt.test.ts` 實作並測試（待測）：mock `fetch` 回 429／5xx／逾時／連線中斷，上游 `fetch` 恰為 1 次；六端點各路徑「一次使用者操作的上游嘗試數 ≤ 1」（plan.md §4.2.6；沿用 `openai-attempt-instrumentation` 計數）；既有 instrumentation 測試不迴歸；不確定是否計費一律保守 `uncertain`；不呼叫付費 API
- [ ] T130 [P] 於 `tests/api/max-output-tokens.test.ts` 撰寫（待測，mock 上游）：核對 `max_output_tokens` 含 reasoning tokens 之官方語意已記錄於 research.md R13；以既有樣本輸出長度分布驗證 2,000／3,072／4,096 不誤傷正常輸出、截斷時回傳狀態可預期（plan.md §4.2.3 表二）
- [x] T131 [P] 於 `api/_lib/quota-threshold.ts` 與 `tests/api/quota-threshold.test.ts` 實作並測試（待測）：**A8＝G-B（G-A／C／D／E 撤回）**，G＝`E_live` 最小 `R_max`，`live` 須同時有可信成本上界且實際啟用；日／週餘額與 `E_live`、預留金額分開計算；四類情況互斥且有優先序：成本模型無效（`E_live` 為空或價表版本不一致→503，不帶 `quotaScope`）、實際額度耗盡（`limit−used≤0`→`all`）、無啟用端點可負擔（`remaining<G`→`all`）、個別請求預留不足（`request`）；任一端點 `R_e` 無法預留不改變其他端點與圖磚 gate；`live: false` 端點價格不影響 G；8,036 僅以 `FIXTURE_ALL_LIVE` 出現且不得出現於 production 常數、不得標為已驗證門檻（plan.md §4.5；第一批 mock 2d；依賴 T126、T021）
- [ ] T134 依賴 T131、T021（A8＝G-B 已規劃核准；不屬第一批，需圖磚管線）：圖磚 eligibility／代理的日／週額度判斷改讀同一權威 snapshot 與 T131 的 G-B（不預留、不扣款），並於 `tests/api/map-quota-gate.test.ts` 撰寫（待測）：與六端點請求預留語意一致、排除 `live: false` 端點、日優先、`reason` 僅於實際額度耗盡或無啟用端點可負擔時為 `daily_quota`／`weekly_quota`，成本模型無效回 503 而非額度狀態（FR-043、FR-045、FR-048；contracts/map-access-contract.md）
### 六個付費端點共用保護 Pipeline（FR-001～FR-004、FR-024～FR-030；contracts/protected-endpoints.md）

- [ ] T025 於 `api/_lib/protected-endpoint-pipeline.ts` 實作共用 pipeline helper：method 檢查（405）→ pre-parse size 檢查（413）→ 匿名 admission 入口限流（429／503；可信 transport key，非匿名付費授權）→ Session（401）→ 目前核准資格（403）→ 已登入者限流 → 有界解析與完整語意／格式／成本相關輸入驗證 → 可信 registry 成本估算／驗證 → 原子預留與冪等檢查（429／409）→ 原子回傳／可信時鐘／lease／首次有效 grant 驗證 → 單次上游 → 結算；資格查驗必須先於冪等重複／衝突回應，不得讓撤銷使用者讀取原 reservation 資訊（FR-049～FR-056）。2026-10-06 僅文件順序核准，非實作授權；下一批隔離子範圍見下方紀錄，A6 gate 保留。
- [ ] T026 於 `api/_lib/error-envelope.ts` 實作共用錯誤信封（`ProductError`／`ErrorEnvelope`）與狀態碼對照表（依 contracts/error-and-quota-contract.md），包含兩個精確 409 文案與唯一對外 503 code／文案；A6 四種語意展開六列 title／message／step，待營運者批准後逐字映射，保留 code／quotaScope，不新增 public state／reason／G；below_floor 不稱耗盡、不保證追加解除日限制，前端不推算／承諾恢復時間。內部成本原因及價表資料不得回傳（FR-011、FR-025、FR-026、FR-049、FR-050；P10／P11／P12／P22）
- [ ] T027 於 `api/me/quota.ts` 實作 `GET /api/me/quota`：回傳自身 tier、日／週 used/reserved/remaining/resetAt；查詢失敗或防護服務故障回 503，不顯示虛假剩餘金額（FR-021）
- [ ] T028 [P] 於 `tests/api/protected-endpoint-pipeline.test.ts` 撰寫（待測）：非 POST 405、缺 Session 401、未核准／撤銷 403、額度不足 429、重複／衝突 409 與成本模型失效 503；驗證先資格後冪等、不洩漏 reservation／價表資訊、不得跳步呼叫上游

### 2026-10-07 新增防護修補與驗證任務（依 FR-049～FR-056）

- [ ] T136 〔不得自訂未核准秒數；本批僅隔離 lease 契約子範圍〕依 `plan.md §4.2.1` 及端點專屬 timeout 定義 `leaseExpiresAt = 端點最長執行時間 + 結算緩衝`，移除 `api/_lib/quota-engine.ts` 的通用固定 lease 預設；只使用另經核准的每端點參數，未有核准值的端點維持 `live:false`。於 `tests/api/reservation-lease-policy.test.ts` 覆蓋全部端點映射、執行上限加緩衝、無固定 120 秒共用值、邊界及錯誤輸入（FR-052、SC-015）；**隔離 mock 驗證**只依賴 T023、T021、T019 契約與注入式測試設定，不依賴或執行 T025／T135。正式參數與整合仍依賴 T025 且須獨立核准；整項保持未勾選。
- [x] T137 〔隔離 mock 完成；不代表 Redis/provider 驗證〕於 `api/_lib/quota-engine.ts`、`api/_lib/shared-store.ts` 與 `tests/api/settlement-idempotency.test.ts` 強化重複結算：相同 transition／金額／reason 語意／可信模型版本才回 `already_applied`；同一 reservation 的金額、結果種類或 reason 不一致須拒絕且不可變更額度；超額回傳可查驗原預留、結算額、超額量與 store 同原子操作之 blocked model version 佐證（FR-053、FR-056、SC-016）；依賴 T019、T022。
- [ ] T138 〔本輪僅完成隔離 mock 子範圍；provider-side／可信對帳及 Redis/Lua 證據待 T019、T136；排程／觸發方式另行批准後執行，本任務不預建服務〕實作 `expireLeases` 的 provider-side 可重複冪等清理與可信對帳流程；到期只轉 uncertain、保留原日／週窗口及預留額度、不退款、不重放；store timeout 視結果未知，不釋額、不重試寫入或上游；晚到結果只留稽核記錄。隔離 mock 測試使用注入時鐘與測試 lease，不代表正式 lease 參數已核定。於 `tests/api/reservation-reconciliation.test.ts` 測重複清理、部分完成後重跑、store timeout、跨窗口、晚到成功／失敗、無可信證據不得退款；另取得 Redis/Lua key/hash-slot／原子寫入證據（FR-052、FR-053、SC-015、SC-016）；依賴 T019、T136、T137。
- [x] T139 於 `api/_lib/quota-fingerprint.ts`、`api/_lib/quota-engine.ts` 與 `tests/api/quota-fingerprint.test.ts` 改用伺服器持有金鑰 HMAC，並為六端點明列 `estimateInputs` 數值與 enum 欄位 allowlist；測試任意字串、未知欄位及內容不進 store／audit、欄位正規化、key 不同結果不可比較、無 key fail-closed。只允許測試注入 fixture key；production key provisioning／rotation 不在本任務自動建立，須另經批准（FR-054、SC-017）；依賴 T019、T021、T023、T126。**2026-10-06 Batch-M2 僅隔離 mock 完成**：分離使用者內容與可信成本參數、上限只用注入式 fixture、speech 維持受阻；不代表正式 key、registry／A4、handler、存取控制或真實持久層完成。
- [ ] T140 〔2026-10-06 Batch-M3a **部分完成**：`api/_lib/cost-registry.ts` 與 engine／fingerprint／SharedStore 型別／memory mock 已完成 registry→估算器→預留綁定、版本及參數摘要雙重原子封鎖契約；`tests/api/cost-registry.test.ts` 43 tests 僅 fixture／mock。**未建立 pipeline、未接線 handler 或狀態查詢，整項不得勾選**〕將可信價表 registry 與 `api/_lib/protected-endpoint-pipeline.ts` 接線：後端自行選版本及計算預留金額，驗證有效期、live、端點適用性、白名單、證據與封鎖狀態；拒絕呼叫端指定金額／版本，模型失效／過期／未證明／封鎖均外部回統一 `503 PROTECTION_SERVICE_UNAVAILABLE`；production 六端點保持 `live:false`。於 `tests/api/cost-registry-pipeline.test.ts` 覆蓋錯版、端點錯配、邊界過期、呼叫端竄改、舊版本封鎖與新版本重新舉證（FR-049、FR-051、FR-056、SC-013）；整合依賴 T023、T025、T126；本批隔離子範圍依賴 T126、T023、T021、T022、T139 與 T019 契約／mock，**不依賴或執行 T025／T135**。Redis/Lua、正式 registry 證據與真實整合另待批准／驗證。
- [ ] T141 於 `tests/api/protected-endpoint-pipeline.test.ts`、`tests/api/error-envelope.test.ts` 驗證 409 精確 code／文案及目前資格優先序：撤銷使用者重送同鍵時回 403 且不含 reservation ID／status；重複與衝突均無第二次 execution grant、不自動重送；成本模型各內部原因外部映射一致且不洩露設定（FR-049、FR-050、FR-055、SC-013、SC-014）；依賴 T025、T026、T140。
- [x] T142 〔D10本機範圍完成〕已先同步已批准非成功承諾契約，再建立`api/me/operation-status.ts`／`api/_lib/me-endpoints.ts`／`me-store.ts`與手動UI：Session／資格／CSRF／30/min／本人projection，零reserve／grant／付費上游，未知／他人同404，settled僅記帳；本機tests／型別／build／隔離E2E通過。依賴T141既有拒絕／文案契約，不解除其成本成功與正式整合未完成部分（FR-050、SC-014）。

### 本輪七檔隔離 pipeline 子範圍（2026-10-06；整項任務仍未完成）

逐檔／介面／測試矩陣見 [Readiness 報告](checklists/pipeline-readiness-report.md)；子範圍不是新 Task 定義，不新增或勾選整項，也不取代 Phase 2 gate。

| 原任務 | 擬議子範圍與本批完成條件 | 依賴／明確未完成 |
| --- | --- | --- |
| T014／T017 | 只定義 Session 注入邊界、重用 engine getSnapshot 資格預檢，以 mock 驗證撤銷／到期／故障；helper 不查 reservation | T019 契約／mock、T021；真實 Session／approval helper 與 auth endpoints 不在本批，不能勾選 |
| T025／T028 | 非路由 helper 的所有檢查及單次 mock 執行／結算；Places tests-only descriptor 為合法代表，其他端點共用拒絕；每項矩陣需 status/body/header、call order/count、原窗口餘額佐證 | T014／T017 注入契約、T019 mock、T020–T024、T126、T131、T136 測試 lease、T137、T138 mock、T139、T140 已完成 registry 核心與先行 cost-context 契約、T026；不是等待整項 T140。六端點實際語意／handler 仍未完成 |
| T026 | 既有共用 ErrorCode／ProductError 最小型別擴充及信封 allowlist；409／503 精確文案與 A6 六列逐字 429 映射、可信分類及恢復條件 | A6 提案已文件同步但尚待營運者批准；共用型別依賴不能省略；其他端點／UI 整合不在本批 |
| T140 | 同次固定 registry context 與 engine 估算／預留接線；mock 權威 G context 排除到期／未核准／未啟用／雙封鎖，禁止 request estimateInputs／model／version／金額權威 | T023、T025、T126、T131、T139、T019 mock；正式來源／雙封鎖讀取 adapter、外部證據與 Redis 原子性未完成 |
| T141 | T025／T026／T140 隔離矩陣全通過，資格優先且入口拒絕不讀預留，duplicate／conflict upstream 零次，超額已入帳仍對外 503 | 不代表六 handler 外顯或正式端點驗收；沒有測試前不得標完成 |
| T142 | 本批明確不新增查詢契約／endpoint／UI 動作，只保留409提示文字與負面斷言 | 正式依賴 T141 保留，不執行、不勾選 |

本批不跳過依賴：以明列 mock contract 取代尚不存在的真實 adapter **只限隔離測試**，不是宣告 T014／T017／T019 已完成。T136 必須顯式注入且測試逐端點 lease，正式值與移除引擎共用 default 仍未完成；T135 在真實 SDK 整合前必做，本批不修改 `openai.ts`。A6 未核准前本批端到端 implementation gate BLOCKED；不得為縮小批次刪掉 below_floor 或可信 G 測試。

**A6 本次文件同步與 Analyze，非實作授權**：FR-011／012／025／027、SC-003 → UX A6 六列表 → Plan §4.5.3／§13 → T026／T065／T028／T141 → P10（日／週 exhausted、below_floor、日週跨類／同類）／P11（request 日／週）／P12（G 與 R_e 邊界、釋放／重置／週追加仍受日限制）／P22（六列逐字 title／message／step、code／quotaScope、無自行推算／確切恢復時間、可靠 Retry-After）。所有 pipeline 案例待實作／待測；本輪不修改測試或勾選任務。七檔範圍與介面待另行審閱批准。

子範圍順序避免循環：既有 T140 registry 核心＋本批 cost-context 介面／fixture 先行 → T026 與 T014／T017 mock 邊界 → T025 拒絕／預留骨架 → T140 pipeline 接線與整合矩陣 → T028／T141 結算及對外完整驗證。T025 不依賴「整項 T140 完成」，T140 接線仍依賴 T025；任何子範圍驗證不會勾選整項或解除正式依賴。

### 管理者可信來源（FR-033；已核准 M1，plan.md §3.3；data-model.md §7）

- [x] T029 於 `api/_lib/admin-principal.ts` 依已核准 M1 env allowlist 架構實作管理者可信來源查驗與 mock；allowlist 缺失或格式錯誤時 fail closed（管理 API 一律 403/503，不得因缺失而預設放行）；真實 subject 與環境設定仍待獨立批准
- [x] T030 於 `api/_lib/admin-auth.ts` 實作管理端逐請求授權 helper：未登入 401、已登入非管理者 403，且回應不得包含任何管理資料（FR-032）
- [x] T031 [P] 於 `tests/api/admin-auth.test.ts` 撰寫（本輪已測）：偽造前端 `role`／`isAdmin` 欄位不得生效；allowlist 缺失時 fail closed 而非預設允許

### 圖磚代理共用管線基礎（FR-043～FR-048；data-model.md §9-13；contracts/map-access-contract.md）

- [ ] T032 於 `api/_lib/tile-proxy-pipeline.ts` 實作逐請求驗證管線骨架（method→座標邊界→Session→核准→日／週 US$ 額度可用性→個人圖磚額度→共用快取→全站 credits 預留→上游→結算），未通過前 6 步不得查快取或呼叫上游（對應 map-access-contract.md 管線表）
- [ ] T033 於 `api/_lib/tile-cache-store.ts` 定義共用快取（`(style,z,x,y)` key、TTL、ETag）介面，`Cache-Control: private, no-cache` 回應 header 常數與 `CDN-Cache-Control: no-store`／`Vercel-CDN-Cache-Control: no-store`
- [ ] T034 於 `api/_lib/tile-quota.ts` 實作三種計數口徑（`userProxyRequestCount`、`sharedCacheHitCount`、`actualUpstreamRequestCount`/`estimatedGeoapifyCredits`）與 request coalescing（同 tile key 併發 miss 只觸發一次上游呼叫與一筆 0.25 credit 預留）
- [ ] T035 [P] 於 `tests/api/map-tile-proxy.test.ts` 撰寫（待測）：未過 Session／核准／日週 US$ 額度／圖磚額度前不得查快取或呼叫上游、快取命中仍計入個人請求數但不消耗 credit、併發 cache miss 僅一次上游呼叫

**Checkpoint**：Foundational 完成後，六端點與圖磚代理才具備可測試之共用授權/額度骨架；任一 User Story 實作前必須先完成本 Phase 對應項目。

---

## Phase 3: User Story 1 - Public 使用公開功能 (P1)

**目標**：Public 免登入僅能使用不呼叫六個付費 API 的功能；地圖位置顯示靜態示意圖。
**Independent Test**：未登入逐一操作六個付費功能入口與地圖位置，確認上游 mock 呼叫數為 0，公開內容仍可用（quickstart.md 情境 1、10）。

- [ ] T036 [US1] 於 `api/assistant.ts`、`api/transcribe.ts`、`api/places.ts`、`api/speech.ts`、`api/photo-ocr.ts`、`api/photo-translate.ts` 套用 T025 pipeline，確保 Public/未登入請求在上游前回 401（FR-002、FR-003；contracts/protected-endpoints.md）
- [ ] T037 [US1] 於 `src/features/nearby/mapEligibility.ts` 新增 `eligibleForInteractiveMap` 查詢邏輯，呼叫 `GET /api/me/map-eligibility`，Public/未登入時回傳受限狀態（FR-043；data-model.md §9）
- [x] T038 [P] [US1] 已以等效 `src/features/nearby/StaticTokyoMap.tsx` 建立靜態東京風格示意圖元件（暫用 placeholder 佔位資產，待 T119 正式資產到位後替換），含繁中「示意圖」標示、替代文字、破圖 fallback、查看東京百科操作（FR-046）；依既存元件測試與隔離瀏覽器裁切證據補勾，不代表正式資產到位，也不重跑已驗範圍。
- [ ] T039 [US1] 於 `src/screens/NearbyScreen.tsx` 依 `eligibleForInteractiveMap` 決定掛載 `NearbyMap` 或 `StaticMapPlaceholder`，Public 狀態不得初始化 Leaflet／圖磚元件（FR-043、FR-044）
- [ ] T040 [US1] 直接對 `GET /api/map/tile/{z}/{x}/{y}.png` 發出未登入請求，驗證回 401 且不查快取不呼叫上游（對應 T032 管線；FR-048）
- [ ] T041 [P] [US1] 於 `tests/api/protected-endpoints-public.test.ts` 撰寫（待測，對應 SC-001）：Public 對六端點逐一呼叫均 401，mock 上游呼叫數為 0
- [ ] T042 [US1] 於 `tests/pwa/nearby-public-network.spec.ts` 撰寫 Playwright 隔離環境測試（待測，對應 SC-011）：Network/HAR 證明 Public 進入探索附近時圖磚請求與 `/api/places` 呼叫數為 0，涵蓋首次進入與重新整理

**Checkpoint**：US1 完成後，Public 路徑可獨立驗證且不影響其他 Story。

---

## Phase 4: User Story 2 - 註冊或登入但未核准者使用公開功能 (P1)

**目標**：已登入但無有效核准者，行為與 Public 付費限制一致。
**Independent Test**：已登入未核准帳號直接呼叫六端點，確認 403 且 mock 上游未被呼叫（quickstart.md 情境 2）。

- [ ] T043 [US2] 於六端點 pipeline 驗證登入但未核准／已撤銷／已到期回 `403 ACCESS_NOT_APPROVED`（FR-003、FR-005；US2 Acceptance 1）
- [ ] T044 [US2] 於 `api/_lib/protected-endpoint-pipeline.ts` 增加測試：使用者於 request body 自稱 email/user ID/tier/額度欄位時，pipeline 僅信任 `identitySubject` 與後端核准紀錄（FR-008；US2 Acceptance 3）
- [ ] T045 [P] [US2] 於 `src/features/nearby/mapEligibility.ts` 確保未核准／撤銷／到期回傳受限狀態，`NearbyScreen.tsx` 立即切換靜態示意圖（US2 Acceptance 4）
- [ ] T046 [P] [US2] 於 `tests/api/protected-endpoints-unapproved.test.ts` 撰寫（待測，對應 SC-001）：已登入未核准／撤銷／到期帳號對六端點均 403，mock 上游呼叫數為 0
- [ ] T047 [US2] 於 `tests/pwa/nearby-unapproved-network.spec.ts` 撰寫（待測，對應 SC-011）：未核准帳號進入探索附近之圖磚與 `/api/places` 請求數為 0，涵蓋舊分頁恢復情境
- [ ] T048 [US2] 於 `docs/verification/005-user-story-2-evidence.md` 建立待測證據佔位文件，記錄需附上之上游 mock 呼叫日誌與 Network/HAR 檔案位置（不得預先填入 PASS）

**Checkpoint**：US2 完成後可與 US1 並存驗證登入狀態邊界。

---

## Phase 5: User Story 3 - 核准等級使用付費 API (P1)

**目標**：第一級／第二級核准使用者在日／週額度內可用六端點；每次請求即時檢查。
**Independent Test**：各級測試帳號逐一呼叫六端點，額度內成功，超額前拒絕（quickstart.md 情境 3、4）。

- [ ] T049 [US3] 於六端點分別套用 T023 成本估算器與 T021 原子預留，確保呼叫前完成日／週雙重檢查（FR-009、FR-015；US3 Acceptance 1-4）
- [ ] T050 [US3] 於 `api/assistant.ts` 新增 `max_output_tokens: 2000`、prompt／知識 byte 上限與模型白名單（現有程式無輸出上限且模型可由 env 覆寫；依 A1／A2，plan.md §4.2.2）
- [ ] T051 [P] [US3] 於 `api/transcribe.ts` 套用價表 `live` 旗標：A10 條件完成前維持 `live:false`，真實呼叫對外回 503 `PROTECTION_SERVICE_UNAVAILABLE`（內部原因 `COST_BOUND_UNPROVEN`；僅 mock）；條件全數通過並另獲啟用核准後才可套用 T127 的 WAV 驗證（沿用 `whisper-1`；FR-017）。不得使用容器時間戳或 US$0.84 作為上界
- [ ] T052 [P] [US3] 於 `api/photo-translate.ts` 新增 `max_output_tokens: 4096` 與模型白名單（FR-017）；`api/speech.ts` 依 T132 維持受阻，不新增任何以假設速率計算之預留
- [ ] T053 [P] [US3] 於 `api/photo-ocr.ts` 套用 `detail: 'high'`、解碼後影像 ≤ 3,145,728 B、pre-parse 4,200,000 B、`max_output_tokens: 3072` 與模型白名單（FR-017；A4；與 T129 前端縮圖搭配）
- [ ] T054 [US3] 於 `api/places.ts` 套用 Google Places SKU 估算，記錄 `editorialSummary` 觸發 Enterprise+Atmosphere 之現況成本影響，不在本任務變更欄位選擇（如需移除需回 spec/UX，屬另案）
- [ ] T055 [US3] 於 `src/features/nearby/NearbyMap.tsx` 改為對 `GET /api/map/tile/{z}/{x}/{y}.png` 建立 tile layer，移除任何指向 `maps.geoapify.com` 的直連 URL／fallback（FR-045、FR-048；plan.md §6.2）
- [ ] T056 [P] [US3] 於 `tests/api/protected-endpoints-approved.test.ts` 撰寫（待測，對應 SC-002）：tier1／tier2 帳號在額度內六端點成功，超額請求不觸發上游
- [ ] T057 [US3] 於 `tests/pwa/nearby-approved-regression.spec.ts` 撰寫（待測，對應 SC-012）：有效核准帳號互動地圖、明確搜尋、選取、導航交接無回歸
- [ ] T058 [US3] 於 `tests/api/map-tile-proxy-eligible.test.ts` 撰寫（待測）：合資格且額度可用者之圖磚請求經代理成功轉發並正確結算 credit

### 成本上界補強：語音、影像與外部證據（plan.md §4.2.4；決策 A4／A9／A10）

- [x] T127 [P] [US3] 〔A10＝P1 規劃已核准；真實啟用另待瀏覽器可行性〕於 `api/_lib/audio-pcm.ts` 與 `tests/api/audio-pcm.test.ts` 實作並測試（待測）：不信任 header 宣告；固定格式 16 kHz／mono／16-bit PCM（無取樣率白名單）；`fmt ` 長度恰 16、`data` 緊接其後、不接受額外 chunk；`RIFF` size＝總長−8、`data` 宣告長度＝實際剩餘 bytes、拒絕 `0xFFFFFFFF`；實際 data bytes 為 2 的倍數（frame 對齊）、>0 且 ≤ 1,920,000 B（60 s；檔案 ≤ 1,920,044 B；皆待核對）；丟棄原 header 並重建標準 44 B header；偽造／矛盾長度、截斷、超長、非 PCM 皆於上游前拒絕；multipart pre-parse 2,000,000 B（待核對，取代任何 1 MiB 提案）。零新 dependency；第一批 mock 1d
- [x] T128 [P] [US3] 〔D03本機數值已批准〕於 `src/services/recorder.ts` 以 Web Audio 產生 16 kHz mono 16-bit PCM WAV 並於 60 s 自動停止；不支援明示文字替代，不改送壓縮格式；等效測試為 `src/services/recorder-pcm.test.ts` 與 `src/features/speech/VoiceInputModal.test.tsx`，涵蓋停止／取消／晚到權限與不自動轉錄；真實瀏覽器仍屬T133。依賴 T127
- [x] T129 [P] [US3] 〔D04本機方向／數值已批准〕裁切原座標保留，以canvas縮送出副本最長邊≤2048、≤3145728B，超限保留原圖並要求重選；等效 `src/services/image-payload.test.ts`／`tests/api/paid-input-boundaries.test.ts` 驗證最壞JSON4194373B、regionVersion10位／+1與3MiB／+1，HTTP拒絕413。不代表T053可信decoder／vision成本或T133真實證據完成
- [ ] T132 [P] [US3] 〔A9＝S1 規劃已核准；其餘端點接線屬 Pipeline，不屬第一批〕於價表與 `tests/api/blocked-endpoints.test.ts` 實作並測試（待測）：`speech`／`transcribe` 在 `live: false` 時真實呼叫對外回 503 `PROTECTION_SERVICE_UNAVAILABLE`（內部原因 `COST_BOUND_UNPROVEN`），不進入 quota 判斷、不影響 G，僅 mock 路徑可通過；逾時、串流中止、經驗速率、校準值、帳戶預算不得使 `live` 變為 true；前端使用指定保護服務文案。
- [ ] T133 〔需獨立批准；外部證據，可能付費〕於 `specs/005-api-protection-access-modes/research.md` 附錄記錄並（取得批准後）蒐集：（a）speech 音訊輸出上界或校準值證據（官方硬上界未查得，S3 僅為校準值）；（b）Chrome／Safari／Firefox 以 16 kHz PCM 產生 WAV 的可行性；（c）vision `usage.input_tokens` 與 tile 數實測。本階段不呼叫付費 API，所有項目維持「未取得」

**Checkpoint**：US3 完成後兩級付費路徑可獨立驗證，且不依賴 US4/US5 已完成。

---

## Phase 6: User Story 4 - 資格與等級變更即時生效 (P1)

**目標**：撤銷、降級、拒絕、到期後下一次請求立即反映。
**Independent Test**：不登出情況下變更資格後再次呼叫端點（quickstart.md 情境 2、10、11 撤銷片段）。

- [ ] T059 [US4] 驗證 T017 核准查驗 helper 每次請求皆重新查 shared store，不快取核准狀態於 Session（FR-006；US4 Acceptance 1-3）
- [ ] T060 [US4] 於 `tests/api/approval-revocation.test.ts` 撰寫（待測，對應 SC-004）：撤銷、等級變更、追加到期或拒絕後，下一次請求反映最新資料
- [ ] T061 [US4] 於 `tests/api/map-tile-proxy-revocation.test.ts` 撰寫（待測，對應 quickstart.md 情境 11）：地圖已掛載且已載入部分圖磚後撤銷資格，下一次平移／縮放觸發的圖磚請求回 401/403，且報告需排除「撤銷前已完成請求」與「裝置上已呈現圖磚」兩類不可回溯情形
- [ ] T062 [US4] 驗證 `Cache-Control: private, no-cache` 與 `ETag` 設定使瀏覽器重新使用快取圖磚前必先送出條件式請求（`If-None-Match`），對應 T033／T062 測試需附 Network/HAR 證據
- [ ] T063 [P] [US4] 於 `src/features/nearby/mapEligibility.ts` 增加 `visibilitychange`／focus 事件重新查詢 eligibility，撤銷後 unmount 互動地圖（FR-044；plan.md §6.7）
- [ ] T064 [US4] 於 `docs/verification/005-revocation-evidence.md` 建立待測證據佔位文件，記錄撤銷情境所需 Network/HAR 與後端 mock/log 附件位置

**Checkpoint**：US4 完成後可與 US3 一起驗證即時性保證。

---

## Phase 7: User Story 5 - 日額度與週額度耗盡後的恢復 (P1)

**目標**：日額度獨立恢復；週額度需管理者追加；追加無固定次數或倍數上限。
**Independent Test**：各級帳號分別耗盡日/週額度，確認狀態與恢復條件（quickstart.md 情境 3、6、7、7a、7b、7c）。

- [ ] T065 [US5] 於 `api/_lib/quota-engine.ts` 確保日額度耗盡回 `429 DAILY_QUOTA_EXHAUSTED`、週額度耗盡回 `429 WEEKLY_QUOTA_EXHAUSTED`；與 T026 使用 A6 待批准六列區分 exhausted／below_floor／request 日週文案，保持可信後端分類，驗證追加不提高日上限及手動恢復條件（FR-011、FR-025）。本次僅文件，不在隔離七檔範圍修改 engine。
- [ ] T066 [US5] 於 `api/_lib/quota-window.ts` 驗證跨日／跨週窗口切換、瀏覽器時鐘偏移與夏令時間不影響後端窗口計算（FR-022；US5 Acceptance 6）
- [x] T067 [US5] 於 `api/admin/top-ups.ts` 實作 `POST /api/admin/top-ups`：管理者對指定使用者、指定週逐次建立追加，正值金額、無固定次數或累計倍數上限，`idempotencyKey` 防重複，僅該週有效（FR-012、FR-038；data-model.md §6）
- [x] T068 [US5] 於 `api/_lib/quota-engine.ts` 實作週有效額度計算：`base weekly limit + 該週所有 active 追加金額加總`，日上限不受影響（plan.md §5.2）
- [x] T069 [US5] 於 `api/admin/top-ups.ts` 增加追加撤銷操作（`topUpId` → `revoked`）：僅影響後續新預留，不追溯作廢已存在 `reserved`／`settled`（FR-037、FR-041）
- [ ] T070 [P] [US5] 於 `tests/api/weekly-topup-concurrency.test.ts` 撰寫（待測，對應 SC-010、quickstart.md 情境 7）：相同 `idempotencyKey` 只套用一次；不同 `idempotencyKey` 的多筆追加皆各自累加，不遺失更新
- [ ] T071 [P] [US5] 於 `tests/api/weekly-topup-tier1.test.ts`、`tests/api/weekly-topup-tier2.test.ts` 撰寫（待測，對應 quickstart.md 情境 7a、7b）：同週多筆追加正確累加，日上限仍獨立有效
- [ ] T072 [US5] 於 `tests/api/weekly-topup-revoke.test.ts` 撰寫（待測，對應 quickstart.md 情境 7c）：撤銷個別追加後週累計立即調整，已存在之 reserved/settled 不被追溯作廢
- [ ] T073 [US5] 於 `src/screens/PaidFeatureQuotaBanner.tsx`（或既有等效元件）顯示日額度已滿／週額度已滿之不同繁體中文文案與恢復條件（FR-025；ux-ui-design-handoff.md 日與週額度狀態表）
- [ ] T074 [US5] 於 `src/features/nearby/mapEligibility.ts` 確保日／週 US$ 額度耗盡時地圖位置切換為靜態示意圖，圖磚與 `/api/places` 請求數為 0（US5 Acceptance 7）
- [ ] T075 [US5] 於 `docs/verification/005-quota-exhaustion-evidence.md` 建立待測證據佔位文件，涵蓋日額度滿、週額度滿、追加後日額度仍滿三種情境

**Checkpoint**：US5 完成後額度耗盡與恢復語意可獨立驗證，管理者追加流程已具備基礎（供 US8 擴充 UI）。

---

## Phase 8: User Story 8 - 管理者透過獨立儀表板掌握核准與用量 (P1)

**目標**：獨立管理者儀表板，逐請求驗證權限，核准/拒絕/切換等級/撤銷/追加皆原子且可稽核。
**Independent Test**：以未登入、一般登入者、tier1、tier2 分別嘗試讀取/異動管理端點皆被拒；管理者身分可正常操作（quickstart.md 情境 8、9）。

- [x] T076 [US8] 於 `api/admin/overview.ts` 實作 `GET /api/admin/overview`：核准狀態統計、日／週估算用量彙總、接近上限提示、防護服務狀態，不顯示供應商實際帳單（FR-034）；D12已批准80%唯讀提示，後端預設與邊界測試完成，正式resource不啟用
- [x] T077 [US8] 於 `api/admin/users.ts` 實作 `GET /api/admin/users`：最少必要識別資訊清單（FR-035）
- [x] T078 [US8] 於 `api/admin/users/[identitySubject].ts` 實作 `GET /api/admin/users/{identitySubject}`：核准等級、日／週已用/預留/剩餘、重置時間、六端點用量摘要；不顯示完整對話/音檔/影像/token/密鑰（FR-035）
- [x] T079 [US8] 於 `api/admin/review-queue.ts` 實作 `GET /api/admin/review-queue`：讀取既存新使用者付費資格申請與週追加申請兩類（FR-036）；申請建立producer另見T147
- [x] T080 [US8] 於 `api/admin/approvals.ts` 實作 `POST /api/admin/approvals`：核准／拒絕／切換等級／撤銷，原子操作並寫入稽核（FR-037、FR-041）
- [x] T081 [US8] 於 `api/admin/audit.ts` 實作 `GET /api/admin/audit`：最少必要欄位（`auditId`/`idempotencyKey`/`adminSubject`/`targetIdentitySubject`/`action`/`createdAt`/`before`/`after`），不記錄敏感內容（FR-041）
- [x] T082 [US8] 於全部 `api/admin/*` 端點套用 T030 `admin-auth` helper，未登入 401、非管理者 403，且拒絕回應不外洩管理資料（FR-032；US8 Acceptance 1-2）
- [x] T083 [US8] 於 `api/admin/approvals.ts`、`api/admin/top-ups.ts` 增加 CSRF 與冪等鍵防重複提交機制（FR-039）
- [x] T084 [US8] 於 `src/screens/admin/AdminOverviewScreen.tsx` 建立管理者總覽頁 UI（獨立於一般使用者介面），對應 T076 資料（ux-ui-design-handoff.md 管理者儀表板專章）
- [x] T085 [P] [US8] 於 `src/screens/admin/AdminUserListScreen.tsx`、`src/screens/admin/AdminUserDetailScreen.tsx` 建立使用者清單與詳情頁 UI（FR-035）
- [x] T086 [P] [US8] 於 `src/screens/admin/AdminReviewQueueScreen.tsx` 建立待審核事項頁 UI，含核准/拒絕/追加操作與明確確認流程（不取代後端授權；FR-039）
- [x] T087 [US8] 於 `src/screens/admin/AdminAuditScreen.tsx` 建立稽核紀錄頁 UI（FR-041）
- [x] T088 [US8] 於 `src/App.tsx`（或既有路由等效機制）確保管理者頁面與資料入口不出現在一般使用者 UI 或 Public 頁面（FR-042）
- [x] T089 [P] [US8] 於 `tests/api/admin-dashboard-permissions.test.ts` 撰寫（本輪已測，對應 SC-009）：未登入 401、一般登入者/tier1/tier2 皆 403，兩者均無管理資料外洩，僅管理者身分可讀取/異動
- [x] T090 [US8] 於 `tests/api/admin-approval-concurrency.test.ts` 撰寫（本輪等效聚合測試已測，對應 SC-010）：同一待審核項目或相同 `idempotencyKey` 的邏輯操作只套用一次；同一使用者不同 `idempotencyKey` 的獨立追加各自原子累加且不遺失更新；本機替身不是正式Redis證據
- [x] T091 [US8] 於 `tests/api/admin-self-quota.test.ts` 撰寫（本輪等效聚合測試已測，US8 Acceptance 8）：管理者本身付費 API 呼叫仍受日／週額度與原子預留機制約束
- [ ] T092 [US8] 於 `docs/verification/005-admin-dashboard-evidence.md` 建立待測證據佔位文件，涵蓋 401/403 無外洩、並發核准僅套用一次、稽核紀錄完整性

**Checkpoint**：US8 完成後管理者儀表板可獨立驗證權限矩陣與併發正確性，且供 US5 週追加流程提供操作介面。

---

## Phase 9: User Story 6 - 防護服務故障 fail-closed (P2)

**目標**：必要防護依賴無法確認時停止新的付費上游呼叫，公開功能不受影響。
**Independent Test**：模擬 Session/核准/額度/shared store 故障，驗證 503 且不呼叫上游（quickstart.md 情境 15）。

- [ ] T093 [US6] 於 `api/_lib/protected-endpoint-pipeline.ts`、`api/_lib/tile-proxy-pipeline.ts` 增加 shared store 逾時／錯誤時回 `503 PROTECTION_SERVICE_UNAVAILABLE` 的 fail-closed 分支（FR-021；contracts/error-and-quota-contract.md）
- [ ] T094 [US6] 於 `api/_lib/admin-principal.ts` 驗證 allowlist 缺失或格式錯誤時管理 API 回 403/503，不得預設放行（US6 對應管理端 fail-closed 延伸）
- [ ] T095 [P] [US6] 於 `tests/api/fail-closed-session.test.ts`、`tests/api/fail-closed-quota.test.ts`、`tests/api/fail-closed-shared-store.test.ts` 撰寫（待測，對應 SC-008）：各依賴故障情境皆回 503，公開功能仍可用
- [ ] T096 [US6] 於 `src/features/nearby/mapEligibility.ts`、`src/screens/PaidFeatureQuotaBanner.tsx` 增加「無法確認使用狀態」顯示，不呈現虛假剩餘金額（FR-021）
- [ ] T097 [US6] 於 `tests/api/no-auto-retry.test.ts` 撰寫（待測，US6 Acceptance 2、FR-027）：故障恢復後系統不自動重送舊請求，需使用者重新明確操作
- [ ] T098 [US6] 於 `docs/verification/005-fail-closed-evidence.md` 建立待測證據佔位文件

**Checkpoint**：US6 完成後可獨立驗證所有防護依賴之故障邊界。

---

## Phase 10: User Story 7 - 查看自身額度狀態與請求結算 (P2)

**目標**：使用者可查看自身核准等級與可信後端額度狀態，結算後即時更新。
**Independent Test**：以有效核准帳號執行成功/未計費失敗/逾時/不確定/查詢故障情境（quickstart.md 情境 5、9）。

- [ ] T099 [US7] 完善 `api/me/quota.ts` 回應內容，確保只顯示該使用者可見範圍，不含邀請名單或他人額度（FR-023）
- [ ] T100 [US7] 於 `src/screens/PaidFeatureQuotaBanner.tsx` 顯示核准等級、日／週已用/預留/剩餘/重置時間，並標示為「內部估算額度」非供應商帳單（FR-020、FR-019）
- [ ] T101 [P] [US7] 於 `tests/api/settlement-success.test.ts`、`tests/api/settlement-unbilled-failure.test.ts`、`tests/api/settlement-timeout-uncertain.test.ts` 撰寫（待測，對應 SC-007）：四類結算情境各自一致規則
- [ ] T102 [US7] 於 `tests/api/quota-display-concurrency.test.ts` 撰寫（待測，US7 Acceptance 6）：多分頁或直接 API 同時送出請求時，額度不足由後端原子拒絕，前端顯示不影響授權結果
- [ ] T103 [US7] 於 `tests/api/quota-query-staleness.test.ts` 撰寫（待測，US7 Acceptance 5、SC-008）：額度查詢失敗、資料過期或分頁閒置過久時顯示「目前無法確認額度狀態」
- [ ] T104 [US7] 於 `src/features/nearby/mapEligibility.ts`／`PaidFeatureQuotaBanner.tsx` 確認資格被撤銷、降級或追加到期後下一次查詢反映最新狀態（US7 Acceptance 7）
- [ ] T105 [US7] 金額顯示精度與單位審查：`src/screens/PaidFeatureQuotaBanner.tsx` 顯示至少美分精度，內部可用 micro-USD（FR-022 額度顯示要求）
- [ ] T106 [US7] 於 `docs/verification/005-quota-display-evidence.md` 建立待測證據佔位文件

**Checkpoint**：US7 完成後額度顯示與結算語意可獨立驗證。

---

## Phase 11: Polish & Cross-Cutting Concerns

**目的**：靜態示意圖正式資產、PWA/快取隔離、繁體中文狀態審查、稽核與隱私、隔離環境測試整合、部署準備（全部待批准或待資產）。

- [ ] T107 取得並審查靜態示意圖原檔：確認聊天附圖僅為視覺參考，**尚未存在於本機 repository**；記錄需向使用者/營運者取得正式原檔、來源、授權與可商用確認於 `specs/005-api-protection-access-modes/research.md` 附錄（FR-047；本任務為待執行項目，不得視為已完成）
- [ ] T108 依 T107 取得之正式資產，於 `public/images/nearby-static-placeholder-mobile.jpg`（`4:3`）與 `public/images/nearby-static-placeholder-desktop.jpg`（`16:9`）建立裁切版本；本任務阻擋於 T107 完成
- [ ] T109 [P] 於 `src/features/map-placeholder/StaticMapPlaceholder.tsx` 串接 T108 正式資產，移除暫用 placeholder（FR-046；阻擋於 T108）
- [ ] T110 於 `src/service-worker.ts` 確認並補齊 `/api/auth/*`、`/api/me/*`、`/api/admin/*`、`/api/map/tile/*` 皆落在既有 `/api/` 排除規則內，不快取憑證或私人回應（FR-028）
- [ ] T111 [P] 於 `tests/pwa/api-cache-exclusion.spec.ts` 撰寫（待測）：驗證上述路徑均未進入 Service Worker Cache Storage
- [ ] T112 於 `tests/pwa/map-tile-cdn-isolation.spec.ts` 撰寫（待測，對應 map-access-contract.md 驗收證據）：確認 `x-vercel-cache` 非 CDN HIT、`CDN-Cache-Control: no-store`、`Vercel-CDN-Cache-Control: no-store` 皆存在
- [ ] T113 繁體中文狀態文案審查：逐一核對 `api/_lib/error-envelope.ts` 401/403/429/503/405/413 文案是否與 contracts/error-and-quota-contract.md 完全一致，且日額度與週額度不共用同一文案（FR-025、FR-026）
- [ ] T114 稽核與隱私審查：核對 `api/_lib/admin-principal.ts`、`api/admin/audit.ts`、`api/_lib/tile-proxy-pipeline.ts` 之日誌內容，確認未記錄 token、secret、完整對話、音檔、影像或完整核准名單（FR-029、FR-041）
- [ ] T115 於 `tests/api/audit-log-minimization.test.ts` 撰寫（待測）：稽核與代理日誌欄位白名單驗證，超出白名單欄位視為失敗
- [ ] T116 執行既有回歸：`npx vitest run --pool=threads` 全量與 `npm run test:pwa-red-gate`，記錄本階段新增測試前既有測試通過基準（quickstart.md 情境 14；本階段僅記錄基準，不代表新測試已通過）
- [ ] T117 於 `docs/verification/005-final-integration-test-evidence.md` 建立待測證據總表，彙整 Phase 3～10 各佔位證據文件連結與完成狀態（全部初始為「待測」）
- [ ] T118 建立 Requirement → UX → Plan → Task → Test/Evidence 對照表於 `specs/005-api-protection-access-modes/checklists/traceability.md`（見下方「追溯總表」章節內容，未執行測試一律標「待測」）
- [ ] T119 〔需獨立批准〕部署準備清單：於 `specs/005-api-protection-access-modes/research.md` 附錄記錄正式站模式切換、外部服務啟用（OIDC provider、shared store、Geoapify 帳戶方案）與環境變數命名之待批准事項清單，不建立任何實際帳戶或環境變數
- [ ] T120 〔需獨立批准〕Geoapify 帳戶方案驗證清單：記錄需營運者於 dashboard 查核之 plan/daily credits/rate limit/usage alert/white label 項目（plan.md §6.6、quickstart.md 情境 11c），本階段不得填入假設值作為已驗證事實
- [ ] T121 〔需獨立批准〕OIDC／Shared Store 外部啟用清單：架構選型已核准；記錄仍需分別批准之 library 安裝、OAuth app／callback、resource、budget、region、credential 與正式服務啟用（plan.md §10.1）
- [ ] T122 於 `specs/005-api-protection-access-modes/research.md` 附錄記錄 Node runtime 版本鎖定之相容性判斷；若需修改 `package.json` 的 `engines.node`，須在 Implement 階段另列變更並驗證，不在 JSON 中寫註解
- [ ] T123 於 `docs/approvals/` 建立 `005-external-activation-approval-template.md` 待簽署範本，供營運者分別批准外部服務啟用、新 dependency、Geoapify 付費升級、秘密值／環境變數、正式模式切換與部署；不得把架構核准誤標為尚未核准
- [ ] T124 最終 Repository Safety Guard 複查：確認本次任務產出未修改 `.git/`、`.github/`、`.specify/`、`src/`、`api/`、`public/`、`specs/001~004`，並記錄結束時 Git 狀態於本文件末尾「執行紀錄」章節
- [ ] T125 提交本 `tasks.md` 與 `/speckit.analyze` 報告供使用者審閱，停在 Implementation Readiness Gate，不觸發 `/speckit.implement`

---

## Dependencies & Execution Order

1. **Phase 1 (Setup)** → 無阻擋依賴，可立即開始（皆為唯讀盤點與文件）。
2. **Phase 2 (Foundational)** → 依賴 Phase 1 唯讀盤點完成；**阻擋 Phase 3～10 全部 User Story**；內部依序：身分/Session（T009-T015）→ 核准資格（T016-T018）→ 額度引擎（T019-T024、成本上界補強 T126→T023、T130、T131、T135）→ per-endpoint lease 與結算／對帳／隱私（T136–T139；隔離 mock 可先行，不需等待真實 Redis 證據）→ 可信 registry 與 pipeline／錯誤優先序（T140–T141）→ 狀態查詢契約（T142）→ 管理者來源（T029-T031）→ 圖磚代理骨架（T032-T035）。
3. **Phase 3 (US1)** → 依賴 Phase 2 全部完成；為最小可獨立驗證之 Public 邊界。
4. **Phase 4 (US2)** → 依賴 Phase 2；可與 Phase 3 平行進行（不同測試身分，共用同一 pipeline）。
5. **Phase 5 (US3)** → 依賴 Phase 2；建議晚於 Phase 3/4，因需驗證「拒絕」邊界已先確立，才驗證「允許」邊界。
6. **Phase 6 (US4)** → 依賴 Phase 5（需先有已核准帳號才能測試撤銷/降級）。
7. **Phase 7 (US5)** → 依賴 Phase 5、Phase 6（額度耗盡建立在額度引擎與資格即時性之上）；先完成本 Phase 的 T067-T069 週追加後端邏輯，再執行 T070-T075；管理者 UI 由 Phase 8 接續整合。
8. **Phase 8 (US8)** → 依賴 Phase 2（管理者來源、pipeline）；T067-T069（週追加端點）與 Phase 7 共用，需先於 Phase 7 對應測試前完成。
9. **Phase 9 (US6)** → 依賴 Phase 2（pipeline 需已具備 fail-closed 分支點）；可與 Phase 3～8 平行進行故障注入測試。
10. **Phase 10 (US7)** → 依賴 Phase 5（額度引擎）與 Phase 7（結算規則）。
11. **Phase 11 (Polish)** → 依賴前述所有 Phase 之測試任務完成或至少建立佔位證據文件；T107-T109（靜態資產）、T119-T123（外部批准）為獨立批准關卡，不阻擋其餘 Polish 任務之文件準備工作。

## Parallel Execution Examples

- Phase 2 內：T014、T015（Session）可與 T023、T024（成本估算/測試）平行；T029-T031（管理者來源）可與 T032-T035（圖磚代理骨架）平行；T126、T130、T131、T135 彼此檔案獨立可平行（T023 須待 T126）。T134 依賴 T131、T021 與 A8。
- Phase 3（US1）：T038（靜態示意圖元件）可與 T041（Public 測試）平行。
- Phase 5（US3）：T050-T053（各端點成本上界）彼此獨立檔案，可平行；T127（A10＝P1 已規劃核准，屬第一批 mock）可開始；T128、T129 待 A4 與實作授權，T132 待實作授權，T133 為獨立批准的外部證據關卡，不阻擋 mock 任務。
- Phase 8（US8）：T085、T086（清單頁/待審核頁 UI）可平行；T089-T091（測試）彼此獨立可平行。
- Phase 11：T111、T112、T115（測試檔案）可平行；T119-T121（待批准清單）彼此獨立可平行。

## Implementation Strategy

**建議最小可行驗證範圍（非產品 MVP，而是安全邊界優先順序）**：Phase 2（Foundational）完成後，優先交付 Phase 3（US1 Public 拒絕）與 Phase 4（US2 未核准拒絕），因這兩者是 Constitution Principle XIII 之核心防護邊界，且不依賴管理者儀表板或週追加即可獨立驗證與部署 gate。

**遞增交付順序建議**：Foundational → US1 → US2 → US3 → US4 → US8（含週追加端點）→ US5 → US6 → US7 → Polish。此順序讓「拒絕」邊界先於「允許」邊界確立，管理者操作能力先於依賴它的週追加驗收確立，最後才處理二級可觀察性（fail-closed 之外部證據、額度顯示細節）與資產/部署收尾。

**未經批准不得執行的邊界（重申）**：本文件所有標註「〔需獨立批准〕」之任務，以及任何實際安裝套件、建立外部帳戶、修改環境變數、正式站切換之動作，均需在 `/speckit.analyze` 完成且使用者明確批准進入 `/speckit.implement` 後，依已核准之 Plan 與批准紀錄才可執行。

---

## 追溯總表（Requirement → UX → Plan → Task → Test/Evidence，全部「待測」）

| Requirement/SC | UX 對應 | Plan/Contract 對應 | Task | Test/Evidence（待測） |
| --- | --- | --- | --- | --- |
| FR-001～FR-004、FR-024、SC-001、SC-003 | 本階段邊界、功能矩陣、日與週額度狀態表 | plan.md §3；contracts/protected-endpoints.md、error-and-quota-contract.md | T025-T028, T036, T041, T043, T046, T065, T113 | tests/api/protected-endpoint-pipeline.test.ts, protected-endpoints-public.test.ts, protected-endpoints-unapproved.test.ts（待測） |
| FR-005～FR-008 | Public 或未核准流程 | plan.md §3.1, §3.3；contracts/auth-and-session-endpoints.md | T009-T018, T044 | tests/api/auth-session.test.ts, approval-gate.test.ts（待測） |
| FR-009、FR-010、FR-011、FR-012、FR-013、FR-014、FR-015、FR-016、FR-017、FR-018、SC-002、SC-006 | 額度呈現規則 | plan.md §3.4, §4；data-model.md §4-5 | T019-T024, T049-T054, T126-T135 | tests/api/quota-reservation.test.ts, protected-endpoints-approved.test.ts（待測） |
| FR-019～FR-023、SC-007、SC-008 | 額度呈現規則、PWA 與可及性 | plan.md §4.3-4.4 | T027, T099-T106 | tests/api/settlement-*.test.ts, quota-query-staleness.test.ts（待測） |
| FR-025～FR-027、FR-011、FR-012、SC-003 | 日與週額度狀態表、A6 六列精確提案 | plan.md §4.5.3／§13；contracts/error-and-quota-contract.md | T026, T065, T113, T028, T141 | P10／P11／P12／P22；tests/api/protected-endpoint-pipeline.test.ts、error-envelope.test.ts（待批准／待測） |
| FR-012、FR-038、FR-040、SC-010 | 管理者儀表板專章第 4 項 | plan.md §5.2-5.3；contracts/admin-dashboard-contract.md | T067-T072, T090 | tests/api/weekly-topup-*.test.ts, admin-approval-concurrency.test.ts（待測） |
| FR-006、SC-004 | 有效核准／撤銷與等級變更 | plan.md §3.2 | T059-T064 | tests/api/approval-revocation.test.ts（待測） |
| FR-031～FR-042、SC-009、SC-010 | 權限矩陣、管理者儀表板專章 | contracts/admin-dashboard-contract.md | T076-T092 | tests/api/admin-dashboard-permissions.test.ts, admin-self-quota.test.ts（待測） |
| FR-043～FR-048、SC-005、SC-011、SC-012 | 靜態東京風格示意圖、權限矩陣、PWA 與可及性 | plan.md §6、§8；contracts/map-access-contract.md | T032-T035, T037-T040, T055, T058, T134, T061-T064, T074, T107-T112, T116 | tests/pwa/nearby-*.spec.ts, api-cache-exclusion.spec.ts, tests/api/map-tile-proxy*.test.ts 與既有回歸（待測） |
| US6 全部、SC-008 | 明確禁止文案 | plan.md §3.5 | T093-T098 | tests/api/fail-closed-*.test.ts（待測） |
| FR-028～FR-030 | PWA 與可及性、正式站邊界 | plan.md §8 | T110-T123 | tests/pwa/api-cache-exclusion.spec.ts, audit-log-minimization.test.ts、外部啟用批准證據與既有回歸（待測／待批准） |
| FR-049～FR-056、SC-013～SC-017 | UX handoff 409／503 狀態、資格優先與非成功承諾提示 | plan.md §0.1、§3.2、§3.5、§4、§10.4；error-and-quota-contract.md、protected-endpoints.md；data-model.md §5、§14～16 | T019、T025、T026、T028、T136～T142 | quota-fingerprint、cost-registry-pipeline、settlement-idempotency、reservation-reconciliation、reservation-lease-policy、error-envelope tests（待測）；真實 Redis/Lua 證據待取得 |

---

## 執行紀錄（本次 `/speckit.tasks` 執行）

- **開始 Git 狀態**：root `C:/Users/geste/spec-kit/tokyo-mate`；remote `origin https://github.com/gestertim/tokyo-mate.git`；branch `master`；HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`；`specs/005-api-protection-access-modes/` 整體 untracked，已追蹤檔案無 staged/unstaged 變更。
- **本次修改檔案**：`specs/005-api-protection-access-modes/spec.md`（更正 Status 與待同步清單為已同步狀態）、`specs/005-api-protection-access-modes/checklists/requirements.md`（更正後續 Artifact Sync 勾選狀態與停止點）、`specs/005-api-protection-access-modes/tasks.md`（新建，本文件）。
- **未修改**：`plan.md`、`research.md`、`data-model.md`、`quickstart.md`、`contracts/*`、`ux-ui-design-handoff.md`、`src/`、`api/`、`public/`、`.github/`、`.specify/`、`specs/001~004`。
- **結束 Git 狀態**：`specs/005-api-protection-access-modes/` 仍整體 untracked（含新建 `tasks.md`）；未執行 `git add`/`git commit`/`git push`。

## 執行紀錄（2026-10-07 文件同步，非 `/speckit.implement`）

- 新增 T126、T127、T128、T129、T130、T131、T132、T133、T134（共 134 個唯一任務 ID，T001–T134），修正 plan.md 所有懸空引用（原 T126–T131、T133 未定義；T132 原僅被規劃）。T023、T049–T053 依 plan.md §4.2／§4.5 改寫；T127、T128 需 A10＝P1、T129 需 A4、T132 需 A9、T131／T134 受 A8 約束、T133 為獨立批准之外部證據關卡。
- 本輪僅修改 `specs/005-api-protection-access-modes/` 內文件；未修改 `api/`、`src/`、`public/`、`.git/`、`.github/`、`.specify/`、`specs/001~004`；所有應用程式測試維持「待測」。

## 執行紀錄（2026-10-06 四項決策同步，非 /speckit.implement）

- 新增 T135（A2，停用 SDK 自動重試；共 135 個唯一任務 ID，T001–T135）。改寫 T023、T126、T127、T128、T131、T132、T134 以反映 A2／A8／A9／A10 規劃已核准；A＝3、G-A／C／D／E、S2–S5、P2–P4 撤回。第一批 mock 批次見 plan.md §10.3.5。
- 僅修改 specs/005-api-protection-access-modes/；所有應用程式測試維持「待測」。

## 執行紀錄（2026-10-07 已批准政策 Specification Sync 與唯讀 Analyze）

- Repository Safety：root `C:/Users/geste/spec-kit/tokyo-mate`；remote `origin https://github.com/gestertim/tokyo-mate.git`；branch `master`；HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`；index 空、tracked 檔無 staged／unstaged 差異。既有 untracked mock／測試及 005 目錄全部保留，`plan.pdf` 未改。
- prerequisites：從 repository root 執行 `.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` 成功，FEATURE_DIR 指向本目錄；`spec.md`、`plan.md`、`tasks.md` 已直接確認存在。`.specify/extensions.yml` 不存在，無 Analyze hooks。
- 本輪文件修改限於 `spec.md`、`ux-ui-design-handoff.md`、`contracts/error-and-quota-contract.md`、`contracts/protected-endpoints.md`、`data-model.md`、`plan.md`、`research.md`、`checklists/requirements.md`、`tasks.md`、`quickstart.md`。未修改程式、測試程式、套件、環境／部署設定或 `checklists/analyze-report.md`。
- 唯讀 Analyze：FR 56、SC 17、Task 142；ID 唯一且 FR／SC 皆有 task trace，005 文件內 T 引用無未定義 ID。剩餘 finding：T019 真實 Redis/Lua 證據未取得；本機無可逐項識別的原始 findings A1–A12 清單。完整分析結果另於本次工作回覆，不覆寫歷史 Analyze 報告。
- 本輪未執行應用程式測試或 T135，未接線 handler；180／208 為歷史 mock 輪次，529 為先前 Chat 回報（`vitest.cmd run` 全套件 52 files／529 tests，exit 0），三者皆非本輪重跑結果且 529 無原始輸出附件可獨立核驗。未 add／commit／push／部署；功能 005、真實整合與部署均非 READY。

## 執行紀錄（2026-10-06 Batch-M1：T137 mock 完成、T138 mock 子範圍）

- **授權範圍**：僅 T137／T138 隔離 mock 修補；未執行 T135、T136、T139–T142，未接線任何 handler，未連接外部服務。
- **T137**：相同 transition／金額／reason／結算模型版本才回 `already_applied`；不一致回 `SETTLEMENT_CONFLICT`，不同終態維持 `INVALID_SETTLEMENT_TRANSITION`。超額成功結果須含 store 原子回傳且與 reservation 價表版本一致的封鎖佐證；缺漏／矛盾回傳 fail closed。完成限 quota engine、SharedStore 契約與記憶體 mock，非 Redis/provider 證據。
- **T138 子範圍**：以注入時鐘／測試 lease 驗證冪等清理、settle 與 cleanup 兩種先後順序、跨日跨週保留原窗口、timeout 後 reserve 延遲成功由 cleanup 轉 uncertain、晚到成功／失敗只記錄、清理後不重發 execution grant。T138 仍未完成：provider-side 實作、可信對帳流程與 Redis/Lua key/hash-slot／原子寫入證據均未取得；T136 正式逐端點 lease 政策亦未執行。
- **本輪 Analyze**：FR 56、SC 17；Task ID 142 個且唯一；FR／SC 均有 task 對應。T137 與 FR-053／FR-056／SC-016、plan §4.4／§10.4、data-model §15–16 對齊；T138 mock 行為與 FR-052／FR-053／SC-015／SC-016、plan §4.4／§10.4、data-model §15–16 對齊。限制及剩餘 finding 見 `checklists/analyze-report.md`「Batch-M1」。
- **驗證**：`node_modules\.bin\vitest.cmd run tests\api\quota-reservation.test.ts tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts`＝3 files／59 tests 通過；`node_modules\.bin\vitest.cmd run tests\api api\_lib`＝20 files／216 tests 通過；`node_modules\.bin\tsc.cmd -b` exit 0；本輪兩個新增測試及 mock 的獨立 `tsc --noEmit --strict ...` exit 0。以上均為本機 mock／程式型別證據，非 Redis 或真實服務證據。
- **狀態邊界**：checklists/requirements.md 71／83 勾選，12 項未完成，保留不變。production 價表未修改，六端點維持 `live:false`；未修改 `plan.pdf`。T019 仍部分完成；A4／HMAC、正式 lease 設定、Redis adapter、T135 與 Batch-M2／M3 均未完成；功能 005 不標 READY。
- **Git**：root、remote、branch、HEAD 與 `mvp-safe-baseline` peeled commit 核對值見本輪 Analyze report；所有既有 untracked 資產保留，未 add／commit／push／部署。

## 執行紀錄（2026-10-06 Batch-M2：T139 隔離 mock）

- **授權**：使用者僅批准 Batch-M2／T139；再次確認 checklist 83 項中 71 已勾、12 未勾後，明確同意保留並繼續。另明確核准使用者內容／可信成本分離參數及注入式測試上限，不建立 registry 或正式上限。
- **完成範圍**：Node HMAC-SHA-256／secret KeyObject 依賴注入、v2 typed canonical encoding、記憶體 content HMAC、無 key／無效 key fail closed、model／standard billing tier／attempts＝1 必填與 endpoint 一致性、六端點 estimateInputs allowlist／注入上限、store／mock／回傳最小化驗證。只有最終 HMAC 與非秘密 key version 進預留；普通 contentDigest、內容與 key 不進 store command／稽核 dump。T139 checkbox 僅代表此隔離契約與 mock 驗證完成。
- **Batch-M1 保留**：歷史測試經測試專用 adapter 將 fixture 成本移至分離參數；結算、清理、timeout、跨窗口、衝突與 duplicate 不重授執行權的情境保留。T137 狀態不變，T138 仍部分完成且不勾選。
- **實際驗證**：
  - `node_modules\.bin\vitest.cmd run tests\api\quota-fingerprint.test.ts`：修補前 RED，10 tests 中 9 failed／1 passed（符合舊程式未實作 HMAC／可信參數契約的預期）。
  - 修補迭代中四檔回歸曾出現 3 failed（舊 SHA-256 測試與非 allowlisted fixture 尚未適配）及型別錯誤；已修正，不將該輪標 PASS。
  - `node_modules\.bin\vitest.cmd run tests\api\quota-fingerprint.test.ts tests\api\quota-reservation.test.ts tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts`：第一輪修正後 4 files／69 tests 通過；之後再補 3 項邊界／損壞回傳測試，納入下列最終全 API 範圍。
  - `node_modules\.bin\vitest.cmd run tests\api api\_lib`：最終 21 files／229 tests 通過，包含最終 T139 13 tests 與 Batch-M1 回歸。
  - `node_modules\.bin\tsc.cmd -b`：最終 exit 0。
  - `node_modules\.bin\tsc.cmd --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --types vitest/globals,node --skipLibCheck tests\api\quota-fingerprint.test.ts tests\api\quota-reservation.test.ts tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts tests\support\in-memory-shared-store.ts tests\support\quota-fixture-engine.ts tests\fixtures\quota-fingerprint-fixtures.ts`：最終 exit 0。未下載／安裝套件，未產生暫存 tsconfig。
- **Analyze**：依本機 `speckit-analyze` 執行唯讀語意核對與本機機械檢查；FR 56＋SC 17、唯一 Task 142、追溯總表涵蓋 73／73、懸空 ID 0。單一 task 行的顯式引用不等於整張追溯表，不能把整組 FR-049～FR-056 都宣稱由 T139 完成。詳見 analyze-report Batch-M2 節；本紀錄為 Analyze 結束後的已授權證據保存，不改 checklist。
- **狀態**：A7／歷史審查 M1 的 HMAC／欄位最小化缺口已在隔離 mock 處理；正式稽核讀取限制與持久層證據仍缺。A4 是可信 registry finding，與 HMAC 分開，仍 OPEN。T019、T138 未完成部分、T136／正式 lease、T135 與 Batch-M3 都不改完成狀態。speech／production 六端點 `live:false` 保留；功能 005／真實整合／部署非 READY。
- **Safety／停止點**：root `C:/Users/geste/spec-kit/tokyo-mate`；remote fetch／push 均 `https://github.com/gestertim/tokyo-mate.git`；master；HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`；index 與 tracked working tree 無變更。baseline peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7` 保留（tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8` 不等於 commit，未移動 tag）。既有 32 個 untracked 檔案保留，新增 4 檔後為 36 個；未修改 plan.pdf、六 handler、openai.ts、UI／Service Worker、套件／環境／部署設定；未連外、add／commit／push／部署。`.specify/extensions.yml` 不存在，無 implement／analyze hooks。本批完成後停止，不接續 Batch-M3。

## 執行紀錄（2026-10-06 Batch-M3a：A4 registry 隔離修補）

- **批准**：使用者僅授權 A4；明確同意保留 12 個未完成 checklist gate，另批准 options 注入 registry／reserve 只接 allowlisted 估算輸入／後端 stable digest／store 原子版本及摘要封鎖。T140 包含 pipeline，沒有獨立整項涵蓋本批，故只記錄部分完成、不勾選、不新增整合工作。
- **完成**：可信 registry→內建估算器→金額／HMAC／reservation 綁定；效期、live、端點、模型、tier、attempts、價格、上界、核准 metadata 與 blocked 驗證；後端計算成本摘要，與核准 metadata 比對；原子預留同查版本＋端點摘要一致性、版本封鎖、摘要封鎖；超額原子結算提供兩種相符封鎖佐證；保留既有預留保守結算、清理、timeout、HMAC、最小化資料及 duplicate 不重授執行權。詳細設計見 plan §10.4.2、data-model §14.1。
- **行為修正**：歷史「改版本即可放行相同成本參數」測試改為拒絕，另測試真正新版本／改變參數／重新綁定核准與上界 fixture metadata 才可放行。token 估算接受 M2 明列的 inputTokens＝0，但仍預留可信最大輸出成本；不核准 handler 的真實輸入行為。
- **修改清單**：新增 `api/_lib/cost-registry.ts`、`tests/api/cost-registry.test.ts`、`tests/fixtures/cost-registry-fixtures.ts`；修改 `api/_lib/{cost-estimators.ts,quota-engine.ts,quota-fingerprint.ts,quota-validation.ts,shared-store.ts}`、`tests/api/{cost-estimators.test.ts,quota-fingerprint.test.ts,quota-reservation.test.ts}`、`tests/support/{in-memory-shared-store.ts,quota-fixture-engine.ts}`，以及 005 的 `spec.md`、`plan.md`、`data-model.md`、`tasks.md`、`research.md`、`quickstart.md`、`contracts/{protected-endpoints.md,error-and-quota-contract.md}`、`checklists/analyze-report.md`。共新增 3 檔、修改 19 檔，全部仍未追蹤。
- **實際驗證命令**（使用已安裝本機工具，不用 npx、不下載套件）：

```powershell
.\node_modules\.bin\vitest.cmd run tests\api\cost-registry.test.ts tests\api\quota-fingerprint.test.ts tests\api\quota-reservation.test.ts tests\api\cost-estimators.test.ts tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts
.\node_modules\.bin\vitest.cmd run tests\api api\_lib
.\node_modules\.bin\tsc.cmd -b
.\node_modules\.bin\tsc.cmd --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --types vitest/globals,node --skipLibCheck tests\api\cost-registry.test.ts tests\api\quota-fingerprint.test.ts tests\api\quota-reservation.test.ts tests\api\cost-estimators.test.ts tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts tests\fixtures\cost-registry-fixtures.ts tests\support\quota-fixture-engine.ts tests\support\in-memory-shared-store.ts
.\.specify\scripts\powershell\check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks
```

- **結果與迭代**：IDE runTests 未找到 runner 測試，改用既有本機 Vitest。初次 targeted 136 tests 有 3 failed（歷史 adapter 把字串金額轉數值、指紋測試預設值、舊換版本放行預期）；修正後 136 tests 有 1 failed（被原子觀察過的版本不得再換摘要，新核准情境須另用真正新版本）；上述失敗均保留為迭代紀錄、不標 PASS。最終 targeted **6 files／139 tests PASS**，其中 registry **43 tests**；最終回歸 **22 files／272 tests PASS**；build 與獨立測試 type-check 均 exit 0。未建立暫存 tsconfig。
- **Analyze**：依本機技能執行唯讀語意核對及 Python 本機 stdin 機械檢查，無檔案產生／外部呼叫；FR 56＋SC 17、唯一 Task 142、追溯 73／73、懸空 ID 0。A4 隔離契約與 Specification／Plan／Tasks 一致，未新增 Constitution MUST 衝突；Analyze 完成後依本批既有授權保存此證據與 report，未由 Analyze 修改產品來源。詳細限制見 report「Batch-M3a」。
- **未完成**：T140 部分完成且 checkbox 保持未勾選；T019 真實 Redis/Lua、T138 provider／對帳部分、T136 正式 lease、T135、T025 pipeline、T141 外部錯誤／handler、T142 狀態查詢均未執行或未完成。核准 references／上界 flags 只驗證 metadata 契約，**不代表真實成本上界已證明**；mock 原子性不代表 Redis/Lua。正式 key／TTL／輪替、真實服務與部署仍需獨立批准。
- **Safety／停止點**：root `C:/Users/geste/spec-kit/tokyo-mate`、origin fetch／push URL `https://github.com/gestertim/tokyo-mate.git`、master、HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`；index 空、tracked working tree 無差異。原 36 檔 untracked 全保留，新增 3 檔後為 39。baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`、peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7` 不變。plan.pdf 保留（728,757 bytes；本輪結束 SHA-256 `0A3D951ECED180AF04B665CADF0D92B09A71861B563E1A84CF6A1EFE5A552FFB`，未修改／重產）；production 價表未改、六端點 live:false。未修改六 handler、openai.ts、UI、Service Worker、套件、環境或部署設定；未連外、add／commit／push／部署。extensions.yml 不存在，無 implement／analyze 前後 hooks。功能 005／真實整合維持非 READY；本批至此停止。

## Phase 12: Convergence（剩餘實作收斂）

**2026-10-06 本輪最新、優先於歷史批次範圍**：七檔隔離 pipeline 已結案，不重審、不重跑。本輪只做文件同步、任務收斂與限定唯讀 Analyze，沒有新程式或測試證據。開始盤點唯一 Task 142、最大 ID T142、Phase 11；本節追加 T143～T146，不重編原任務、不改原 checkbox。原已勾 10 項仍只代表各自既有隔離範圍；未完成 Task 及 12 正式 gate 不因規劃收斂勾選。A6 已批准，舊 T026／追溯表的「待批准」為歷史狀態。

**本輪 Convergence Findings（依必要唯讀介面盤點；非重新審查七檔）**：

| ID | Gap type／嚴重度 | 來源與目前證據 | 剩餘工作 |
| --- | --- | --- | --- |
| P-G1 | partial／HIGH | FR-051／SC-013；registry 現為逐端點 resolve，pipeline 有 cloned context，未與當下共享 revision 綁定 | T143：全集合權威快照與更新／封鎖契約 |
| P-G2 | partial／HIGH | FR-010／FR-015／SC-006；store command 無 G，memory reserve／engine denied 只比較 R_e | T144：原子 G＋日週與內部佐證 |
| C-GR | missing／HIGH | FR-013／FR-051／SC-006／SC-015；本輪新原子契約尚無新實跑證據 | T145：可變成本與 registry／G 競態矩陣 |
| C-GS | partial／HIGH | FR-043／FR-048／FR-056；map 原子 G 與六端點後續接線未完成，現 handler 無 pipeline import | T146：共用原子結果與相關接線驗收 |

- [ ] T143 依 FR-051、FR-049、SC-013 與 plan.md §14.1，於 `api/_lib/cost-registry.ts`、`api/_lib/quota-threshold.ts` 及相關 fixtures 定義完整可信 registry bundle／單調 revision／bundleDigest／E_live／G context；重用成本摘要及估算器，發布／停用／超額封鎖與 reserve 共用權威，半開效期以原子可信時間判斷，舊快照 fail-closed、不自動刷新重試；production 全 `live:false`。依賴已存在 T126／T023／T139、T140 registry 核心子範圍與 T019 契約／mock，**不要求 T140 或 T019 正式整項完成**。（partial）
- [ ] T144 依 FR-010、FR-011、FR-013、FR-015、FR-055、FR-056 與 plan.md §14.2，擴充 `api/_lib/shared-store.ts`、`api/_lib/quota-engine.ts`、`api/_lib/quota-validation.ts` 與 `tests/support/in-memory-shared-store.ts`：同次原子 reserve 核對當下 registry／時間、資格／追加與兩窗口 G／R_e；`R_e ≤ remaining < G` 無 grant，成功只扣 R_e；回傳並驗證完整內部 evidence，分類優先與冪等／uncertain 保留。真實 adapter 的同契約實作沿用 T019，本任務本機證據不能代替 Redis；依賴 T143、已存在 T021／T022／T137 核心與 T019 契約。（partial）
- [ ] T145 依 SC-006、SC-013、SC-015、SC-016 與 quickstart.md 新增 P-G1／P-G2 矩陣，於 `tests/api/quota-atomic-evidence.test.ts`、`tests/api/quota-reservation.test.ts`、`tests/api/quota-threshold.test.ts` 及相關 registry tests 新增可變成本合法 fixtures 與 barrier 排序：日／週／雙窗口 G−1／G、R_e−1／R_e、`R_e < G` 成功只扣 R_e；registry 改價／停用／非目標封鎖／目標封鎖、效期、跨窗口、追加／撤回／資格與 reserve 兩種順序；矛盾 evidence／timeout 無上游、不退款、不重授權。跑最小合併 selectors 與相關型別檢查，保存本輪實際證據，不沿用 334；真實跨 writer 另附 T019 證據。依賴 T144；本機與真實證據分開。（missing）
- [ ] T146 依 FR-001、FR-025、FR-043、FR-045、FR-048、FR-056、SC-003、SC-005 與 plan.md §14.2，將 T025／T140／T141 pipeline 分類及 T134 eligibility／tile gate 改用同次權威原子結果，移除非原子 G 授權缺口，不新增 public 欄位；先完成本機 mock 接線與拒絕／恢復驗證。擴大 production 成功端點須各自合法輸入、上界政策及正式批准；2026-10-08 明確批准的隔離子範圍只准使用 tests-only synthetic descriptor／reservation，不能取消 production Places-only／live:false 限制。六 handler 正式接線沿用 T036／T043／T049～T054，map 沿用 T032～T035／T134，正式模式／外部啟用不在本任務。依賴 T145、T025 骨架、T140 registry 核心；map 子範圍另依賴 T032，正式成功接線另依賴各端點參數批准及 T135／T136。（partial；隔離子範圍另列本次證據）

### 現行剩餘依賴與四類任務

- [x] T147 〔D11本機範圍完成〕依FR-036已先同步批准producer／清單／撤回契約，實作server owner白名單、有界輸入／限流、同authority原子enqueue／pending去重／冪等／最小user event、withdraw／admin resolve競態及手動UI；完整JSON≤65536 bytes縮頁有效續頁／單筆超限503。依賴T079／T080／T083既存管理處理，保留管理者自主決定追加，不登入代提、不新設保存／輪替；本機tests／strict型別／build／隔離E2E通過，不等同正式Redis／OIDC驗收。

下表取代「Phase 2 全部完成才可做任何 User Story」的過度全域阻擋解讀：仍逐 phase 驗證，但以實際子範圍依賴為準；本機可注入 adapter 的工作不等待外部 Redis／OIDC／付費上界證據。**可實作不等於已授權**；本輪尚未取得新的 `/speckit.implement` 授權。細節、證據與停止條件見 [統一 Readiness](checklists/pipeline-readiness-report.md)。

| 類別 | 原 Task／子範圍 | 前提與完成證據 |
| --- | --- | --- |
| a 本機可連續實作 | T143→T144→T145；T019 adapter 程式／注入 transport、T138 原子清理 adapter；T135；T009～T018／T029～T031 的 mock Session／核准／管理者；T025～T028／T140～T141／T146 本機整合 | 一次 Implement 授權；每 phase 真正 Run→Verify→Fix；不連外、不安裝、不寫正式 env／secret；各核心子範圍可獨立驗證 |
| a 本機後續完整路線 | T036／T043／T044／T049／T051／T052 受阻路徑／T132 的六 handler 拒絕接線；T067～T072／T076～T091 管理端與 UI；T027／T099～T106 自身額度 UI；T032～T035／T037～T047／T055～T064／T134 圖磚及 map；T038 fallback；T093～T098／T110～T118 回歸與 PWA | 各自需 Session／pipeline／store 契約與相應前置測試；上游 mock、fixture、臨時靜態示意圖可用。正式數值、權威查詢動作／敏感保存不可擅定；依賴未決者只完成可獨立子範圍 |
| b 已定方向、待外部或隔離環境證據 | T019 真實 Redis/Lua、T014 Session／T010～T015 真實 OIDC、T138 provider 對帳；T133 瀏覽器 PCM／vision usage；T062／T112 CDN／304／HAR；T107～T109 正式靜態資產；T120～T121／T117 正式證據 | 架構已批准不重批；外部啟用／秘密／付費呼叫尚未授權，先取得對應批准。單純本機瀏覽器 mock Network 可先做，不等於真實 CDN／provider PASS |
| c 新產品／費用／保存決策 | A1／A3／A4／A5／A7；T128／T129／T050／T053／T054 成功路徑、T130 數值驗收、T136 正式 lease；六端點限流、TTL／HMAC 輪替、T142 查詢契約、T119～T123 帳戶預算與資源啟用 | 不要求已批准額度／週追加／M1／G-B／圖磚初始控制再批准；待決只阻擋採用該新值或新行為的子範圍。本機可完成參數化介面與 fixture，但不自動決定正式值 |
| d 正式部署／模式切換 | T119～T123 的正式啟用與簽署、T117 完整驗收後的部署／切換 | 另行明確批准；所有相應正式證據與 rollback plan 齊備，功能 005 未完成不得宣稱 production acceptance |

**引用與追溯校正（不改原 ID／marker）**：T038 的正式資產依賴為 T107→T108→T109，不是 T119 部署清單；T062 的自我引用不構成前置，實際依賴 T033／T055／T061 並附 HAR；T142 依賴 T141 的契約／文案，不能反向阻擋原子 G、Session 或單純拒絕接線。T124 的「不得修改程式」僅適用 Tasks 文件階段；日後 Implement 安全檢查應比對獲授權程式白名單，而非禁止已授權實作。

| Requirement／SC | UX／Contract／Plan | Task | 本輪／未來證據 |
| --- | --- | --- | --- |
| FR-051／FR-049／SC-013 | UX 額度／防護分離；protected contract；Plan §14.1；data-model 本輪補充 | T143／T140／T019 | 本輪只文件與唯讀介面盤點；revision／效期／E_live／雙封鎖實跑待 T145 |
| FR-010／FR-011／FR-013／FR-015／SC-006 | A6；error contract；Plan §14.2 | T144／T145／T021／T024 | 可變成本 `R_e ≤ remaining < G` 與原子追加／撤回驗收待測 |
| FR-055／FR-056／SC-013／SC-015／SC-016 | protected／error contract；Plan §14.1～14.2 | T144／T145／T137／T138 | 資格優先／單 grant／timeout／保守結算回歸待測；Redis 證據另待 T019 |
| FR-001／FR-025／FR-043／FR-045／FR-048／SC-003／SC-005 | UX 狀態切換；map contract；Plan §14.2～14.3 | T146／T025／T036／T134 | 同次原子分類與 map gate／handler 接線待測；七檔歷史不是新證據 |

新增四項均為未勾選；未完成原任務不重複產生新 ID。新方案只有規劃收斂，P-G1／P-G2 實作與證據仍 OPEN；真實整合與部署未完成。本輪完成限定 Analyze／Safety 後停止，不進入實作。

## 2026-10-07 D13／D01／D07–D08／D14 後續工作（本輪新 Task IDs）

以下任務只表達批准後工作，**不構成 dependency、外部資源、付費測試或 production 執行授權**。任一 gate 未取得時維持 pending；production 六端點 `live:false`。

- [x] T148 完成本輪 005 決策包、文件追溯同步、唯讀限定 Analyze 與 Safety end-state 比對；保留歷史 findings／provenance，確認 Task ID／引用、變更白名單及所有待批數值沒有變成生效設定。本輪文件與限定 Analyze 已完成；未完成的實裝及外部工作分列 T149～T154。
- [ ] T149 〔本機已批准並完成；部署子範圍未批准／未驗〕安裝 `openid-client@6.8.8` 並鎖定 `jose@6.2.12`／`oauth4webapi@3.8.8`，接既有 OIDC port；測 discovery、PKCE、code exchange、signature／JWKS／claims、strict TS、Vercel preview artifact。依賴 T148；runtime／architecture 只阻擋部署驗證。
  - [x] T149 本機子範圍：精確版本／combined binding／library authorization URL／code grant／JWKS signature、issuer／audience／azp／nonce／exp／iat、PKCE／state／code重放、discovery污染／JWKS錯誤／timeout與strict TS證據。
  - [ ] T149 部署子範圍：owner runtime／architecture、Preview serverless artifact 與真實 Google整合；本輪不執行。
- [ ] T150 〔本機已批准並完成；部署子範圍未批准／未驗〕安裝 `sharp@0.35.5` 與平台適用 optional dependencies，接既有 `images.verify` seam；測格式／真實 dimensions、malformed／truncated／超限圖，保留 notices、檢查 artifact size／cold start。依賴 T148；未手動安裝 Linux binary。
  - [x] T150 本機子範圍：Windows x64 native loader、三格式、完整raw解碼、單頁／動畫拒絕、格式偽裝／truncated／像素／尺寸／bytes±1、HTTP seam零上游／strict TS與notices保留。
  - [ ] T150 部署子範圍：實際 native target、壓縮／解壓artifact、cold start／timeout及LGPL發佈義務；本輪不執行。
- [ ] T151 〔production 逐 endpoint 成本上界與 evidence 待批准；付費呼叫另批〕分別補齊 `places`、`photo-translate`、`assistant`、`transcribe`、`photo-ocr` 的 request→provider billing 上界，`speech` 僅在出現可信硬上界時重開；每端點記錄 production model／SKU／service tier、最大 request／output、官方計費規則、usage／invoice reconciliation 與停止條件。Places 的本機候選／mock 批准不代表 T151 完成；無供應商證據的端點保持 `live:false`。
  - [x] D01 不付費子範圍：共用 builder 最大合法 travel／translation／photo-translate Unicode與跳脫、knowledge／文字上限±1、未知env model的成本拒絕與HTTP零上游；bytes不等於tokens，既有輸出cap候選未採用。
- [x] T152 〔本機E01～E10完成並經本次核對結案；正式清除／輪替／cutover仍未批准〕依本機批准契約完成atomic detail→tombstone、uncertain對帳、跨輪替duplicate與retired epoch拒絕；不以TTL單獨刪除仍可接受的重放紀錄。T155～T161均已完成，依原定義勾此本機父任務；真實Redis／restore及production清除證據不屬本任務完成，仍由T153等正式範圍追蹤。
  - [x] D07／D08 文件子範圍：[完整契約草案](contracts/request-epoch-and-key-lifecycle.md) 含簽發／本人／CSRF／限流、bindings、authority／跨instance、到期／輪替／legacy相容、清除前提、故障／晚到／uncertain／撤銷及E01～E10；此文件批次當時尚未實作、未設期限、未清記錄或key，保留歷史；後續本機批准與完成見T155～T161及下列implementation子項。
  - [x] 2026-10-07文件子範圍：verify-only語意與E01～E10本機批准範圍同步至Spec／Plan／data-model／UX及相關contracts；決策／依賴／驗收已映射。此勾選只表示文件交付，不表示任何epoch測試PASS。
  - [x] T152本機implementation：原子簽發／同命令確認、正常signing輪替後未grant舊capability首次執行、fingerprint舊版本比較／零二次grant、原子退役／restore拒絕、legacy及到期後本人lookup、最小保存／uncertain review／錯誤UX；依T019／T138、T139／T140、T141／T142接縫及T155～T161完成。restore拒絕僅為本機替身驗證；真實外部證據另屬T153／D14，非正式清除或啟用。
- [ ] T153 〔待批准：隔離外部資源／帳戶操作；付費升級與Preview部署各自另批〕依 D14 建立 test-only Upstash／Preview namespace，兩個獨立 process 驗證真實 Redis atomicity／同 slot／TTL／timeout／cleanup及epoch retirement／restore，再回收 DB／token；依賴既有 T019 adapter 可供測試與明確 resource approval。T153 的跨 process 證據要求每個獨立 OS process／instance 自己建立 REST client 並送出 Redis request；現有 `005-isolated-runner` child 僅負責 IPC/barrier、`ports.execute` 在 parent 執行，不能單獨滿足或宣稱此證據。restore／durability／獨立manifest／全部instance拒舊版本與正式清除前提證據仍未完成，不能以T152本機結案代替。
- [ ] T154 〔`openid-client`本機安裝已完成；待批准Google test resource／account operation與Preview部署；付費 API call另批〕依 D14 建隔離 Google OAuth client／測試身分及 HTTPS Preview callback，驗登入／signature／JWKS／state／PKCE／logout／replay，再撤銷 client、清理 Preview bindings。依賴 T149本機binding、runtime evidence 及明確外部操作／Preview approval；不改 production OAuth client，不要求重批已完成安裝。
