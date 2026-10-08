# 005｜L1～L5 本機實作與實際證據

## 2026-10-08 本機 App 與 Phase B plan handoff 修補（本次現行）

### 本機 App 與 Public 瀏覽

- 沿用既有 `npm run dev -- --host 127.0.0.1` 啟動 Vite；`http://127.0.0.1:5173/` 回 HTTP 200，無需新增套件。
- 隔離瀏覽器可由首頁開啟東京百科，看到本機知識庫項目；旅遊日文可切換「餐廳點餐」，讀取本機日文／中文句子、收藏按鈕可操作。兩者不需登入、不呼叫付費 API。
- 觀察到額度查詢 `/api/me/quota` 透過 Vite proxy 回 502，因本次只啟動 frontend Vite、`localhost:3000` API server 未啟動。UI 明確顯示無法確認額度且仍允許 Public 內容；本次不建立 TEST_ONLY 正式 fallback。實際登入／管理員 API UI 仍需獨立 API／OIDC Preview，未以瀏覽器冒充通過。

### TEST_ONLY 本機 API 入口（後續補充）

新增 [005-test-only-server.mjs](../../scripts/005-test-only-server.mjs)：需 `--test-only`，拒絕 production／Vercel／非 loopback origin，只用記憶體 store 與固定測試身分，不讀秘密、封鎖 `fetch`。透過 Vite proxy 實測：未登入 401、`test-pending` 403、`test-tier1` 額度 US$3／15、非管理者 403、`test-admin` 總覽／名單 200；瀏覽器內 `test-admin` 於 `/admin` 核准 `test-pending` 後其額度顯示 US$3／15。`tests/api/test-only-server.test.ts` 2 tests PASS、`tsc -b` exit 0。此入口不含 `/api/me/requests`、epoch 與六個付費端點，不是 production factory fallback。

### Phase B 固定計畫與條件式入口

- `scripts/005-phase-b-caller.mjs` 使用 ignored local `.specify/phase-b-plan-v5.json` 固定保存一份非秘密 plan；dry-run 讀取既有 plan，不重新抽 namespace／digest；檔案缺失才以 exclusive-create 建立，不覆蓋既存內容。
- plan 明列 preflight／cleanup／confirm Lua，並保存 caller、worker、runtime、Redis Lua／store／transport 與 TEST_ONLY fixture source hashes。載入驗證依 namespace 重建完整 canonical expected plan 並精確比較，所以三鍵 inventory、script、操作包絡、byte／request 上限、容量界線或任何 source 變更均拒絕；執行參數必須提供該保存 plan 的精確 digest，任意／錯誤 digest 不會讀取條件、秘密或網路。
- 條件式 execute 先確認無 Read Regions、無付款方式、無其他 workload／writer，且 commands／bandwidth／storage 三筆人工觀測各有來源及含時區時間並在上限內；其後才讀取既有無回顯 TTY credential port。非 TTY、任一 gate 缺項、錯誤 plan 或錯 digest 均不讀秘密。全域一次性 state lock 於派送前建立；之後不重試第二批。
- 沿用兩個獨立 child 的既有 REST transport／原子 reserve、固定 8 POST／58 logical commands、既有中斷／unknown／確認／exact cleanup 保護；provider metering 仍 `unverified`、billable upper bound 仍 `null`。mock tests 不代表真實 Redis/provider 證據。

### 本次驗證及未執行範圍

| 驗證 | 結果 |
| --- | --- |
| `npm test -- tests/api/phase-b-process.test.ts tests/api/oidc-flow.test.ts tests/api/admin-auth.test.ts tests/api/quota-reservation.test.ts tests/api/protected-endpoint-pipeline.test.ts tests/api/protected-endpoint-success.integration.test.ts` | 6 files／222 tests PASS；Phase B dry-run 固定 plan、digest 竄改拒絕、gate-before-secret、一次性 execute lock、兩 child mock／unknown／cleanup，OIDC mock 登入、admin auth、quota 及六端點 TEST_ONLY pipeline 均覆蓋。 |
| `npm run build` | `tsc -b` 與 Vite production bundle PASS。 |
| 本機瀏覽器 | Vite 首頁 HTTP 200；Public 東京百科及旅遊日文分類內容可操作；額度 API 502 限於本機 API server 未啟動。 |
| production 設定 | 六端點保持 `live:false`；speech 實際 POST fail-closed，不做付費 upstream 呼叫。 |

沒有執行 Phase B `--execute`、沒有連 Redis／provider、沒有讀取秘密、沒有登入真實 Google、沒有部署／commit／push。執行前仍需操作者在本機確認 Manage Regions 完整清單（無 Read Regions）、無付款方式、無其他 workload／writer，並輸入每項具來源、時間、時區的用量觀測；條件未齊時不讀秘密。T152 保持結案；T153／T154 父項及正式 readiness gate 維持未完成。

## 2026-10-08 D01 Places 帳務證據與本機候選同步（本次現行；非應用測試）

### 來源與觀測

本次只核對使用者提供的帳戶截圖、官方文件截圖、帳戶價格 CSV 與現有 005 D01 文件；觀測日為 2026-10-08。Google Cloud 交易頁在「金額」欄明示 TWD。Google 官方[Cloud Billing 帳戶幣別文件](https://docs.cloud.google.com/billing/docs/resources/currency?hl=zh-tw)說明台灣使用新台幣、美元價格換為當地幣別，匯率於每月初設定，不隨終端使用者所在地改變。

帳戶價格 CSV 中 Nearby SKU `F20E-7034-0EF7` 與 Text SKU `120C-BEC3-B48F` 的首個付費級距均約為 1,271.20／1,000 events。CSV 未明列該價格的幣別或匯率；只記錄數值與 SKU，不由欄名 `$` 推定美元或台幣，也不反推匯率。這項 CSV 觀測與交易頁 TWD 幣別、官方匯率政策是相互補充但不同性質的證據，不是對 request 實際費用或完整帳單上界的證明。

### 已批准的本機候選／限制

使用者已批准 `priceScale=5/4`、reservation `50,000 µUSD`（US$0.05）及價表有效期 7 日，範圍僅限本機候選／mock；權威額度仍以 USD／µUSD 計算，不新增 TWD 額度或自動換匯 UI。25% 是候選緩衝，不是完整帳單上界證明；7 日是應用程式重新查核期限，不是 Google 價格固定保證。候選批准不變更 production 設定或 D01 正式 gate。

T151 維持未結案；T152 維持結案；T153／T154 與正式 gate 不提前勾選。production 六端點維持 `live:false`，speech 真實呼叫仍受阻。錯誤／timeout 是否計費未確認；未知結果沿用 uncertain／保留預留／不重試。沒有呼叫付費 API、讀取秘密或帳戶登入，沒有重跑應用測試、執行 Redis Phase B、安裝套件、提交、推送或部署。本節為文件證據紀錄，不是測試執行紀錄，不標 PASS。

## 2026-10-08 D01 Places 公開價與程式查核（前次狀態；非應用測試）

### 範圍與結果

依使用者限定，只唯讀檢查本機 handler／request validation／protected boundary／TEST_ONLY pipeline 及 Google 官方公開文件，並同步既有 D01、Plan、Tasks、protected-endpoints contract。未呼叫 Places API、未登入或查看帳戶、未讀秘密、未改程式、未啟用端點；依要求不重開或例行重跑六端點 mock-success 測試。**本節不是測試執行紀錄，不標 PASS。**

- `api/places.ts` 目前的 request mask 為固定七欄；coordinates 一次 Nearby Search（500 m、依 category 可送 `includedTypes`），manual 一次 Text Search（`manualArea` 錨定 query、`zh-TW`／`JP`）；不設定分頁或 fallback。呼叫鏈沒有自動重試，但 helper 的原生 `fetch` 無 AbortSignal／8 s timeout。
- `local-protection-policy.ts`／`paid-input-validation.ts`／protected pipeline 定義 body 2,048 B、query 100、manualArea 50、座標／類別／欄位驗證、reader 5 s、depth 8／nodes 256；這些限制在 configured boundary 生效，不可歸因給 `executeUpstream` helper。production `POST` 未配置 options 仍 fail closed；TEST_ONLY pipeline timeout 不等同 production 接線。
- Google 官方 Nearby、Text、Usage and Billing、Global price list、India price list 與 SKU details 於 2026-10-08 公開查核。完整 field mask 依最高欄位觸發 Enterprise + Atmosphere；Global SKU 為 `F20E-7034-0EF7`／`120C-BEC3-B48F`，India 區域 SKU 為 `1DC0-87A6-65E7`／`0FD0-B42B-DFDA`。Global 最高首階公開價格 US$40／1,000 events、free cap 1,000；India 價格 US$12／1,000、free cap 7,000；適用帳戶地區與費用仍缺 operator 證據。
- 本機 code 中 D05 8 s execution＋5 s dispatch＋5 s settlement＝18 s lease 為政策設定；實際 Places helper 未使用上游 deadline。`A=1` 已批准；其後已批准的 `priceScale=5/4`、50,000 µUSD 預留、7 日價表有效期僅限本機候選／mock，不證明帳戶硬成本上界。錯誤／timeout 計費未確認，不用 free cap／折扣抵減預留。

### 後續界線

仍缺可支持完整成本上界的去識別適用價表／費用邊界、跨 project aggregation 與官方錯誤／timeout 計費語意；CSV 幣別／匯率也未標明。free cap 剩餘／折扣資料只供實際帳單預測，不是上界必要證據。`T151` 未結案、production 六端點維持 `live:false`、speech 真實呼叫受阻，T146／T152／T153／T154 狀態不變。詳細來源與單一決策表見 [readiness-decisions.md D01](../../specs/005-api-protection-access-modes/readiness-decisions.md#d01places-決策包2026-10-08-本次更新)。

## 2026-10-08 六端點隔離 mock-success 本機實作（本次現行）

### 範圍、核准與 Places-only 理由

使用者核准 Plan／protected-endpoints contract 的最小隔離測試補充。Places-only 原成功代表採固定 request SKU／空估算輸入；其他 token、audio、image endpoint 缺逐端點合法成本前提及完整 model／SKU／輸出 cap／成本上界證據，D01 未決，speech 官方最大輸出／audio token per second 未查得。此批以 `TEST_ONLY` synthetic accounting fixture 只驗程式順序，不視為可信真實成本上界、D01、正式參數或端點核准。

五個端點 `assistant`、`transcribe`、`places`、`photo-ocr`、`photo-translate` 由各自 `createHandler` factory 注入 TEST_ONLY pipeline，驗證 HTTP request→有界解析／端點輸入驗證→原子 reserve→mock upstream→settle→HTTP response。speech descriptor 僅為 mock-only；不建立 lease、不預留／結算、不呼叫真實 provider。未配置的實際 `POST` exports 仍 fail closed。

### 變更面

- `api/_lib/paid-endpoint-boundary.ts`：production settings 型別與明確 TEST_ONLY handler-factory 注入分離；預設／未配置 route 仍拒絕。影像 verifier 改用獨立 `PaidImageVerifier` 型別以維持正式設定型別安全。
- `api/_lib/protected-endpoint-pipeline.ts`：加上 endpoint-specific bounded parser seam；除 Places 外只有 `scope: TEST_ONLY` context 可跑合成成功 descriptor，不放寬正式成本驗證。
- `api/_lib/paid-input-validation.ts`：抽出共用 PCM multipart parse，回傳驗證後重建 WAV、bytes、duration、language、idempotency handle；拒絕 boundary 沿用相同 parser。
- `tests/fixtures/paid-endpoint-success-descriptors.ts`、`tests/support/paid-endpoint-success-fixture.ts`、`tests/api/protected-endpoint-success.integration.test.ts`：六 descriptor；五 route factory 成功／非法輸入／method 路徑；speech mock-only／真實 handler fail-closed。模型、價表、output cap、tier 與 synthetic accounting 僅在 tests fixtures。
- `specs/005-api-protection-access-modes/plan.md`、`tasks.md`、`contracts/protected-endpoints.md`、`checklists/pipeline-readiness-report.md`：同步本次明確測試 scope 與仍未完成的 formal gate；不勾 T146 整項或 checklist。

### 驗證

| 命令 | 結果 |
| --- | --- |
| `.\node_modules\.bin\vitest.cmd run tests\api\protected-endpoint-success.integration.test.ts tests\api\protected-endpoint-pipeline.test.ts tests\api\cost-registry-pipeline.test.ts tests\api\paid-handlers-rejection.test.ts tests\api\paid-input-boundaries.test.ts tests\api\speech.test.ts tests\api\transcribe.test.ts` | 7 files／164 tests PASS。mock tests 以 `globalThis.fetch` spy 證明成功路徑未連外。 |
| `.\node_modules\.bin\tsc.cmd -b` | PASS（exit 0）。 |
| `.\node_modules\.bin\tsc.cmd --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --types vitest/globals,node --skipLibCheck tests\api\protected-endpoint-success.integration.test.ts tests\fixtures\paid-endpoint-success-descriptors.ts tests\support\paid-endpoint-success-fixture.ts` | PASS（exit 0）。 |
| `PRODUCTION_COST_PRICE_TABLE` 六端點檢查 | 6／6 `live:false`；預設 speech POST 回 503，fetch 0 次。 |

未新增 dependency、未讀秘密／正式環境、未連外／付費、未部署／提交。此證據為 local memory-store／TEST_ONLY fixture，不證明 Redis／provider atomicity、真實費用、D01 或 production acceptance；12 個 requirements gate、T146 整項與正式 Readiness 均維持未完成。

## 2026-10-08 獨立本機管理恢復與可及性補足（本次現行）

### 授權與最新缺口核對

使用者明確批准接續已批准、無外部依賴的本機 implementation；真實 Redis Phase B 單獨暫停。先核對最新版 Tasks／Plan／Readiness、protected／auth／admin／map／epoch contracts、已完成 Analyze 與實作證據；prerequisites 以 process-only `SPECIFY_FEATURE=005-api-protection-access-modes` 指向 005，不建立環境檔。requirements checklist 為83項／71已勾／12未勾，使用者再次確認沿用本機例外；其他三份 checklist 無 checkbox。extensions.yml 不存在，無 pre／post hooks。

既有本人查詢 T142、申請／withdraw T147、管理後端與 UI T076～T091、epoch T152／T155～T161已有本機完成證據，不重做、不重開或例行複審。`StaticTokyoMap` 的暫用 SVG、明確 alt／示意標示／破圖 fallback／公開入口已有元件證據，mobile 4:3／desktop 16:9、受限零 Places／tile 與 PWA API exclusion 已有隔離瀏覽器證據。本次不重跑這些範圍；T038 原條件僅要求暫用元件，故以等效元件既存證據補勾，不宣稱正式資產完成。

六端點成功 pipeline 的現行契約與程式仍限定 Places fixture；其他五端點欠成功 descriptor／HTTP 預留→上游→結算接線，D01 model／SKU／service tier／output cap／成本上界仍待批准，speech 真實呼叫維持受阻。既有 D02～D05 輸入／lease批准不自動解除此限制；本次不填新候選參數、不移除 Places-only guard、不將 mock 當正式成本或上線證據。該子項保留為批准／實作缺口，其他獨立本機工作照常完成。

### 修改與可觀察結果

| 檔案 | 本次精確變更 |
| --- | --- |
| `src/screens/admin/AdminMutationPanel.tsx` | 開啟有名稱的非 modal 確認區時聚焦；送出前取消回原按鈕；alert錯誤與status處理中。未知保留完整 command／原操作鍵、停用取消換鍵、只有明確手動確認；未知後再被撤權拒絕不清除未知。同步 AbortController ref 阻止同React批次重複派送；卸載中止等待、忽略晚到結果。 |
| `src/screens/admin/AdminUserDetailScreen.tsx` | 成功刷新前將焦點交給仍存在的「重新確認詳情」按鈕，避免確認區消失後焦點遺失。 |
| `src/services/admin-api.ts` | `submitAdminMutation` 接可選 AbortSignal並傳給既有send；不改 method／path／body／credentials／no-store或後端授權。 |
| `src/screens/admin/AdminMutationPanel.test.tsx`（新增） | 8個測試：鍵盤開啟／Tab／取消回焦、未知同鍵恢復、明確輸入拒絕、invalid response／503／unavailable、未知後撤權、同批次連點與卸載晚到。全部client mock。 |
| `src/screens/admin/admin-ui.test.tsx` | 沿用真正AdminApiError的partial mock、更新錯誤alert與同鍵手動確認斷言、新增成功刷新焦點回歸；既有管理清單／詳情／review／audit回歸保留。 |
| `src/services/admin-api.test.ts` | 新增取消signal傳遞、不換鍵、不自動重送的client測試。 |
| `tests/pwa/005-admin-recovery.e2e.ts`（新增） | 真Chromium鍵盤操作，HTTP mock503→明確同鍵duplicate、成功刷新焦點；確認成功管理GET／POST回應不在SW Cache Storage，且外部／六付費端點／圖磚呼叫零次。 |
| 005 Tasks／Plan／Readiness／Spec／UX／admin contract與本文件 | 同步既有FR-039的恢復／焦點落實、完成狀態與限制；只補勾符合原條件的T038，T153／T154及正式gate保留。 |

「取消」只在未有未知結果且沒有in-flight時可用；首次明確輸入／權限／限流等拒絕仍可取消修正。未知後手動確認被拒絕，不推論原異動未成立。AbortSignal只取消client等待，**不是後端rollback、退款或取消原異動**。操作鍵仍僅在目前元件記憶體；本次沒有持久儲存／跨頁恢復承諾，也不取代每次server授權。

### 最後實跑結果

| 命令／檢查 | 最後結果 |
| --- | --- |
| `npm exec --no -- vitest run src\screens\admin\AdminMutationPanel.test.tsx src\screens\admin\admin-ui.test.tsx src\services\admin-api.test.ts --maxWorkers=1 --pool=forks --reporter=default --reporter=json --outputFile=<本session>\files\admin-targeted.json` | 2026-10-08 14:22:22（Asia/Taipei）起跑，3 files／19 passed、0 failed／0 skipped，6.13秒、exit0。 |
| `npm exec --no -- playwright test --config=playwright.config.ts 005-admin-recovery.e2e.ts` | 1新增情境／1 passed，10.2秒、exit0。只選新增檔，不重跑既有地圖、本人、epoch或PWA例行範圍。 |
| Playwright既有webServer | `reuseExistingServer:false`；先執行既有`npm run build`（`tsc -b && vite build`）再啟動本機preview，成功後才跑browser。不是Vercel Function／Linux artifact／部署驗證；結束後4174無listener。 |
| TypeScript API strict noEmit（下列命令） | 30個非declaration直接依賴source files／0診斷、exit0；沒有新增config或降低strict。 |
| VS Code problems（7份本次程式／測試） | 0 errors。 |
| `git diff --check` | exit0；新增文字另檢查conflict markers與直接local links。 |

strict可重現命令：

```text
node --input-type=module -e "import ts from 'typescript'; const roots=['src/test/setup.ts','src/screens/admin/AdminMutationPanel.test.tsx','src/screens/admin/admin-ui.test.tsx','src/services/admin-api.test.ts','tests/pwa/005-admin-recovery.e2e.ts']; const options={noEmit:true,strict:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,esModuleInterop:true,resolveJsonModule:true,jsx:ts.JsxEmit.ReactJSX,lib:['lib.es2022.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts'],types:['node','vitest/globals']}; const p=ts.createProgram(roots,options); const ds=ts.getPreEmitDiagnostics(p); if(ds.length) console.error(ts.formatDiagnosticsWithColorAndContext(ds,{getCurrentDirectory:ts.sys.getCurrentDirectory,getCanonicalFileName:f=>f,getNewLine:()=>ts.sys.newLine})); console.log('Dependency source files: '+p.getSourceFiles().filter(f=>!f.isDeclarationFile).length+'; diagnostics: '+ds.length); process.exitCode=ds.length?1:0;"
```

JS module specifier使用必要`/`literal；terminal檔案引數使用Windows路徑。測試全程不呼叫Redis、OIDC、Geoapify或OpenAI；Vitest沿既有block-external-network setup，Chromium僅允許127.0.0.1且API由route.fulfill替身回應。PWA證據是本機browser Cache Storage，不是installed PWA／真CDN／正式network acceptance。

### 失敗→修補→重驗

1. VS Code `runTests`回報No tests found，不作PASS；改用已安裝Vitest。初版2檔7tests有5個RED：缺焦點／alert、同React批次重複派送、未傳取消signal，保留失敗證據，不裝套件。
2. 新實作首個3檔回歸13 passed／1 failed並有unhandled rejection：舊admin mock缺AdminApiError。改為沿真實class的partial mock，不放寬異常分類；加入未知後撤權不可清除未知的回歸，18tests通過。
3. 成功刷新焦點case新增後揭露子元件success回焦覆寫父頁焦點；移除success子元件回焦，cancel回焦保留，由詳情頁接管success焦點。最終19tests通過。
4. 第一次strict roots未納入既有Vitest setup，jest-dom matchers型別缺失；改納入`src/test/setup.ts`（其既有vitest augmentation），最終0診斷。未修改setup或型別規則。
5. 第一次Playwright傳入Windows路徑被當regex而No tests found，不作PASS；改用唯一檔名selector，不改config；最終1實跑通過。沒有因此重跑既有全套。

### Safety與完成界線

起始Safety使用`git status --short --untracked-files=all`逐檔列出251筆；546份非env Git tracked／untracked檔案SHA-256與branch／HEAD／index／baseline存於本session `files\safety-start.json`，不讀真實env／秘密。結束253筆，新增兩份測試；原546份全存在，僅本次列明12份既有檔變更，其餘534份hash不變。沒有遺失或覆寫其他dirty／untracked成果。

`master`、HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`、index tree `e391eb727c4072b321bf400e7997adc149a9bb2f`及baseline commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`不變。001～004、PDF、tooling、dependencies、env／正式價表與所有其他既有成果保留；沒有建立`.vscode`。原始dirty狀態不等於本次修改清單；逐檔對照另存`files\safety-end.json`。

| 結束分類 | 狀態 |
| --- | --- |
| 本次完成 | 管理確認恢復／可及性／連點與晚到防護、相關19tests與1新browser情境、strict／webServer build、直接文件同步；T038以既存placeholder證據補勾。 |
| 仍缺本機實作 | 六端點完整成功descriptor與HTTP→預留→mock upstream→結算接線；非Places子項須先有D01批准，不把未寫程式說成只有Redis證據不足。已完成本人／管理／地圖本機範圍不重開。 |
| 需外部證據 | Upstash可信metering／usage／floor authority、真Redis跨writer／restore；真Google OAuth、Geoapify／CDN、正式示意圖原檔／授權、真裝置installed PWA與部署runtime、provider usage／invoice。 |
| 需產品決策 | D01逐端點model／SKU／tier／output cap與可信上界、成功接線批准；speech沒有可信硬上界仍受阻。資源／秘密／付費／部署各自另批。 |

T152維持結案；T153／T154父項與12項正式gate未完成，requirements仍71／12。production六端點`live:false`、`providerMetering:"unverified"`／`billableUpperBound:null`、speech受阻不變。本次未連真實Redis、未執行Phase B `--execute`／校準、未讀秘密、未建外部資源、未呼叫付費API、未新增dependency、未提交／推送／部署或切正式模式。

## 2026-10-08 T153 外部準備決策文件補充（非執行證據）

依現有 runner 契約及本機實作證據，已在[readiness 決策包](../../specs/005-api-protection-access-modes/readiness-decisions.md#一次限定-phase-b-外部執行清單目前未批准未啟動)整理 Upstash 支援問題草稿、營運者最少待確認資料、一次限定 Phase B 操作／inventory、互斥分支 REST 派送與 logical command 包絡、程式強制時間／大小限制、unknown／唯讀確認／cleanup／人工跟進，以及未來外部批准的精確範圍。草稿未發送。

本補充僅同步決策文件，沒有新增實作或驗證證據；未連 Redis、未執行 `--execute`、未讀秘密、未重跑已完成測試或校準。Upstash account／plan／region／Read Region／當下用量與可信剩餘容量、EVAL／replication 計量與超限政策、usage source／成本上界及 namespace-matched trusted floor／authority provenance 仍缺。既有 mock、Console 差值、token 重設確認與先前 calibration 均不取代這些證據。`providerMetering: "unverified"`、`billableUpperBound: null` 維持不變；T152 維持結案，T153／T154 父項與正式 gate 不勾選。

## 2026-10-08 T153 Phase B caller／child transport 本機交付

本次依明確本機授權接續，不重新規劃或重審已結案批次。沿用已完成 Analyze／checklist 例外；唯讀核對 requirements 為 71 已勾／12 未勾，使用者確認只沿用本機例外，正式 gate 不改。prerequisites 以 process-only `SPECIFY_FEATURE=005-api-protection-access-modes` 指向 005，FEATURE_DIR 正確；extensions.yml 不存在，無 pre／post hooks。未建立環境檔或改正式設定。

### Token 重設補記（與技術驗證分開）

營運者已確認 `tokyo-mate-005-test` 的 Token／憑證重設**完成**，確認回報時間為 **2026-10-08 06:28（Asia/Taipei）**；實際操作時間未提供。本次只記「營運者確認完成」，沒有測試舊 token 失效或新 token 可用，不宣稱已有該驗證。不索取、輸出或保存新秘密，不為補證據追加 Redis 操作；此補記不擴大外部授權。下方先前批次「撤銷／輪替待補」及 21:37 回報保留為歷史。

已完成的限定真 Redis 校準不重跑：4 REST POST、logical envelope 10、marker 確認、PTTL 59948 ms、cleanup cleaned。Console 差值不是 provider 公式／計費上界。`providerMetering: "unverified"`、`billableUpperBound: null` 不變。

### 本機接線與可觀察結果

兩個 OS child 各自在自身 process 載入並建立**既有** `createRedisRestTransport`／`createRedisSharedStore`，各直接呼叫同一原子 `reserve` 一次，不帶 requestEpoch。保留先前同一 wire reserve／unknown 情境，另新增完整 caller failure matrix。parent 不具 external writer proxy；external worker 路徑使用自身 fetch，但**本輪沒有執行該網路分支**。

本輪全部為 fake-secret／mock：parent 只由 fake source 取得假 URL／token，barrier 後透過 private IPC 交付；child transport 的 mock fetch 以 IPC 將 body 交 parent Lua 替身 authority。沒有 socket／REST endpoint／Redis／付費上游。因此成功 mock 只證明 child 的 adapter／transport 程式路徑、兩個不同 PID、fixture 一 grant／一 duplicate 及日／週各一次 2,400 µUSD；不是實際 REST／Redis 跨 process 原子性、provider metering、TTL／restore 或 production acceptance。

完整 caller mock 成功為八個本機 REST-format body，exact 七鍵 cleanup＋唯讀 EXISTS 後空。unknown／timeout／worker 故障／兩階段中斷均不重送異動、不退款、不重新 grant；seed 或 reserve unknown 的一次有界唯讀確認即使 observed 也停止，不清理可能仍有晚到寫入的 inventory。cleanup unknown 只確認一次 exact EXISTS，不再 DEL。report 只含固定 scope／enum、數字、inventory 與 worker PID／boolean，假秘密也未進 report。

request cap 131,071／131,072／131,073 bytes、response cap 32,768／32,769 bytes、barrier 後時間 7,999／8,000／8,001 ms 已實測門檻，不以一般成功測試代替。每 writer 一次、總 REST 派送額度 ≤8、logical envelope ≤89；child 在 fetch 前死亡時額度不回補，故 report 明確命名 `restRequestsUpperBound`，不是實際外部 HTTP 次數，也不是 provider 計費。完整成功與失敗分支的停止／清理方式見[現行契約](../../specs/005-api-protection-access-modes/contracts/isolated-local-runner.md#2026-10-08-t153-phase-b-callerchild-transport-本機交付現行)。

external API／CLI 在讀秘密／spawn／network 前拒絕；仍缺可信 provider 計量、floor／authority provenance、usage reader／上界，沒有假 ruleRef／digest／usage 或 bypass flag。既有業務 runner metering gate 未修改。既有無回顯 TTY helper 只保留為後續安全來源 port，本輪未讀真秘密、未操作帳戶；JS 字串只釋放引用，不宣稱已安全抹除。

### 實際驗證命令與結果

VS Code `runTests` 對此 Node mock 檔回報「No tests found」，沒有當成 PASS；改用已安裝 Vitest，未安裝套件。分階段新增修改後依序實跑 Phase B 2 tests、22 tests、三檔 51 tests、補足時間門檻後 55 tests；最後 reader 取消及 fixture guard 修改後重新取得下列 **最終版本**結果。沒有例行重跑歷史全套、校準、PWA、browser 或 paid-provider 測試。

| 命令／檢查 | 最終結果 |
| --- | --- |
| `npm exec --no -- vitest run tests\api\phase-b-process.test.ts tests\api\redis-shared-store.test.ts tests\api\redis-atomic-transport.test.ts` | 2026-10-08 06:46:58（Asia/Taipei）起跑；3 files／55 passed、0 failed／0 skipped，exit 0。Phase B 36 項，其餘為直接 adapter 回歸。 |
| 下列 TypeScript API strict 命令 | 23 個非 declaration dependency source files／0 診斷，exit 0；roots 只選 Phase B test／新 declaration，未掃全 repo。 |
| `node --check scripts\005-phase-b-caller.mjs`；`node --check scripts\005-phase-b-worker.mjs`；`node --check scripts\005-phase-b-runtime.mjs` | 各 exit 0。MJS 沒有冒稱 strict type-check。 |
| `node scripts\005-phase-b-caller.mjs` | dry-run exit 0，`secretsRead: false`、`networkDispatched: 0`；七鍵及固定 limits 可檢閱。 |
| `node scripts\005-phase-b-caller.mjs --execute` | **預期 exit 1**／execute-blocked；`provider_metering_floor_authority_usage_unverified`、秘密未讀／網路零派送。不是 Redis 測試失敗，也不是外部批准。 |
| VS Code problems（Phase B test／declaration） | 0 errors。 |
| `git diff --check`、直接新增文字 conflict marker／繁體檢查、文件 local-link 檢查 | 通過；不修改歷史 artifacts 的其他文字。 |

可重現 strict 命令（既有 TypeScript，無新增 config／emit）：

```text
node --input-type=module -e "import ts from 'typescript'; const roots=['tests/api/phase-b-process.test.ts','scripts/005-phase-b-caller.d.mts']; const options={noEmit:true,strict:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,esModuleInterop:true,resolveJsonModule:true,jsx:ts.JsxEmit.ReactJSX,lib:['lib.es2022.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts'],types:['node','vitest/globals']}; const p=ts.createProgram(roots,options); const ds=ts.getPreEmitDiagnostics(p); if(ds.length) console.error(ts.formatDiagnosticsWithColorAndContext(ds,{getCurrentDirectory:ts.sys.getCurrentDirectory,getCanonicalFileName:f=>f,getNewLine:()=>ts.sys.newLine})); console.log('Dependency source files: '+p.getSourceFiles().filter(f=>!f.isDeclarationFile).length+'; diagnostics: '+ds.length); process.exitCode=ds.length?1:0;"
```

命令中 JS／TypeScript module specifier 使用必要 `/` literals；終端機檔案引數使用 Windows 路徑。Node 本機 `v24.19.0` 的 transform／hook 只用於 test-only child；不證明部署平台 runtime。

### 逐檔修改與保留範圍

| 檔案 | 本次修改 |
| --- | --- |
| [005-phase-b-caller.mjs](../../scripts/005-phase-b-caller.mjs) | 新增 fixed plan、強制派送／大小／時間上限、完整 seed→child race→confirmation／cleanup、本機 fake-source／兩階段停止、external gate 與 dry-run。 |
| [005-phase-b-caller.d.mts](../../scripts/005-phase-b-caller.d.mts) | 新增 ports／control／fixture／report 型別。 |
| [005-phase-b-runtime.mjs](../../scripts/005-phase-b-runtime.mjs) | 新增既有 TS adapter 的 Node 24 in-memory loader；不生成檔案。 |
| [005-phase-b-worker.mjs](../../scripts/005-phase-b-worker.mjs) | 保留雙 OS child 目的；mock-only 自製 client 改為既有 REST transport／reserve adapter，秘密只收 private IPC，每 child 單次有界 reserve，固定 enum 結果。 |
| [phase-b-process.test.ts](../../tests/api/phase-b-process.test.ts) | 保留既有成功／unknown 語意，新增 34 項 caller／transport／故障／中斷／timeout／大小與時間精確門檻 mock。 |
| [isolated-local-runner.md](../../specs/005-api-protection-access-modes/contracts/isolated-local-runner.md) | 同步新接線、秘密、限制、分支最大包絡、停止／確認／清理及 external 拒絕啟動。 |
| [plan.md](../../specs/005-api-protection-access-modes/plan.md) | 補記已授權技術實作，不替換 stack、不重新規劃。 |
| [tasks.md](../../specs/005-api-protection-access-modes/tasks.md) | 只勾完成的本機子範圍；不改父項／正式 gate／已結案批次。 |
| [readiness-decisions.md](../../specs/005-api-protection-access-modes/readiness-decisions.md) | Token 確認補記、最小待決清單及可由營運者提交的五類 Upstash 支援問題，未發送。 |
| 本文件 | 如實保存本輪實作／驗證／限制與 Safety Guard，不覆寫歷史證據。 |

[Lua harness](../../tests/support/lua-redis-harness.ts)、業務 Lua／REST transport／adapter、production code、dependencies、正式 Spec、001～004 與既有其他 tracked／untracked 工作均未修改。沒有新增套件、真實 Redis／外部帳戶／秘密設定、付費、commit／push／部署／模式切換。

### Repository Safety Guard 與停止點

起始及結束皆執行 **`git status --short --untracked-files=all`**。本次起始 248 筆（43 tracked modifications／205 untracked），結束 251 筆（43／208），所有起始 status 路徑保留、缺少 0；新增差異恰為三個 caller／declaration／runtime 檔。這是本次 Safety 清單，不重開已結案 193／246 目錄折疊核對，不推論先前批次計數。

branch `master`、HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`、origin `https://github.com/gestertim/tokyo-mate.git` 均符合預期；staged 0。baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`、peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7` 維持保護，沒有 reset／clean／還原／branch 切換／提交／推送。未建立 `.vscode`，extensions.yml 仍不存在，無 post hooks。

本機程式、針對性 mock、外部執行方案及最小待決清單交付後停止。T152 結案不變；T153／T154 父項與 12 正式 gate 未完成，production 六端點 `live:false`／speech 受阻。下一步僅是營運者取得[可信計量／usage 與 floor／authority 證據](../../specs/005-api-protection-access-modes/readiness-decisions.md#2026-10-08-phase-b-最小待決事項與-upstash-支援問題現行)及另批批准；本交付不授權下一批外部操作。

## 2026-10-07 T153 Phase B 雙 process 本機 mock（非 Redis 證據）

在明確限定本機 harness／mock 的範圍內，新增 [`005-phase-b-worker.mjs`](../../scripts/005-phase-b-worker.mjs) 與 [`phase-b-process.test.ts`](../../tests/api/phase-b-process.test.ts)。兩個 OS child 各自建立 mock REST client，ready barrier 後各送一次相同 `REDIS_QUOTA_LUA` reserve EVAL wire envelope；parent 不代送 reserve。parent mock authority 以既有 Lua interpreter 執行既有業務 Lua，seed／Lua request／結果皆為合成 fixture。Lua harness 補上 `EXISTS` 與多 key `DEL` 語意以支援 exact inventory preflight／cleanup。

驗證指令：

```text
npm exec --no -- vitest run tests\api\phase-b-process.test.ts tests\api\redis-shared-store.test.ts tests\api\isolated-runner.test.ts
```

結果：3 files／47 tests passed。Phase B 成功 mock 驗證兩個不同 child PID 各有 client、恰一筆 `reserved`／`executionGrant: true` 及一筆 `duplicate`／`executionGrant: false`，日／週 reserved 均為單次 2,400 µUSD fixture 值，exact 7-key cleanup 後 inventory 空；沒有 paid-upstream operation。Unknown mock 令兩 reserve 已執行但 response unknown，再令單次 readonly `getReservation` unknown；驗證不重送 reserve、不 cleanup。

Vitest network guard 阻止 loopback HTTP 測試，因此 worker 僅以 IPC 將 REST wire envelope 交給 mock authority；整個驗證沒有 socket／外網／Redis。這證明 process-originated mock requests 和本機 Lua fixture 行為，不證明真實 REST client、Redis atomicity、TIME／TTL、跨 instance 或 provider metering。維持 `providerMetering: "unverified"`、`billableUpperBound: null`；T153／T154 父項與 12 項正式 gate 未勾，T152 不重開。外部執行待決事項見[Readiness](../../specs/005-api-protection-access-modes/readiness-decisions.md)。

## 2026-10-07 限定外部 Redis 校準（營運者執行與人工 Console 證據）

本節為本次外部操作的現行紀錄；下方本機批次及先前「未連線／未授權／尚缺」敘述保留為各批歷史，不覆寫。本次已有明確的一次限定外部校準批准，營運者接受 EVAL 內層計量、Free 超限行為與 Console 更新延遲仍未知。工具無法安全交接互動式無回顯輸入，因此由營運者在本機終端機執行既有 caller；agent 未取得 REST URL／token，未改 caller、秘密載入方式或 application code。

### 執行前核對與兩筆獨立紀錄

- 起始 Safety Guard：root `C:\Users\geste\spec-kit\tokyo-mate`；origin `https://github.com/gestertim/tokyo-mate.git`；branch `master`；HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`；staged 0。2026-10-07 20:52:16（Asia/Taipei）核對 porcelain 246 筆；文件同步前 21:11:00 核對為 43 tracked／203 untracked，合計 246 筆。baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`，peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`。
- 已讀取最新 [caller](../../scripts/005-redis-calibration.mjs) 及[直接契約](../../specs/005-api-protection-access-modes/contracts/isolated-local-runner.md)，固定操作包絡與本次批准相符；未重跑已完成的本機審查或完整測試。
- 本次 `node scripts\005-redis-calibration.mjs` dry-run exit 0，`networkDispatched: 0`、`secretsRead: false`；digest 精確為 `fd1f6a4b789f41a12da249f123088904e8da846decf72fee63ad18bb0103b4c2`，沒有更新批准 digest。20:52:16 為核對時間，不是外部執行時間。

| 獨立紀錄 | 來源／時間 | 結果與界線 |
| --- | --- | --- |
| 前次失敗 | 營運者於 2026-10-07 21:06 回報；未提供該次原始 JSON 或精確起訖時間 | `secret_invalid`、零派送。保留為獨立失敗，不以本次成功覆寫；其 namespace、其他欄位及秘密失敗細節未取得，不補造。 |
| 本次成功 | 營運者於 2026-10-07 21:06 提供下列 caller JSON；精確執行起訖時間未提供 | `completed`／`finished`；4 REST POST、邏輯 commands 包絡 10；marker 確認、PTTL 59948 ms、exact cleanup 成功。這是營運者提供的 caller 證據，不是 agent 自行連線重驗。 |

```json
{
  "scope": "TEST_ONLY_CALIBRATION",
  "evidence": "calibration_caller_report",
  "mode": "execute",
  "templateDigest": "fd1f6a4b789f41a12da249f123088904e8da846decf72fee63ad18bb0103b4c2",
  "namespace": "{preview-3EnT08JgFFYnxvLi}",
  "inventory": [
    "{preview-3EnT08JgFFYnxvLi}:calibration:marker"
  ],
  "status": "completed",
  "reason": "finished",
  "restRequests": 4,
  "restRequestsMax": 4,
  "logicalCommandsUpperBound": 10,
  "logicalCommandsMax": 10,
  "providerMetering": "unverified",
  "billableUpperBound": null,
  "operations": {
    "probe": "ok",
    "write": "completed",
    "verify": "present",
    "cleanup": "cleaned"
  },
  "write": "written_confirmed",
  "observedPttlMs": 59948,
  "cleanup": "cleaned",
  "manualFollowUp": false
}
```

### Console 人工觀測（與 caller 結果分開）

營運者提供的專用 DB 為 `tokyo-mate-005-test`，Free Tier、AWS Tokyo（`ap-northeast-1`）。本次只沿用人工證據，沒有登入帳戶、自動 polling 或 usage API。

| 時間（2026-10-07，Asia/Taipei／UTC+8） | 頁面／證據 | 觀測值 |
| --- | --- | --- |
| 約 20:34–20:35 | DB 詳細頁 | Commands `1 / 500,000 per month`；Bandwidth `416 B / 10 GB`；Storage `0 B / 256 MB`；Cost `US$0.00`。 |
| 前測，精確時間未提供 | 帳戶總覽 | Commands `0`；與 DB 詳細頁 Commands `1` 分開記錄，不推論即時一致性。 |
| 約 20:34–20:35 | 付款介面 | Subscription 選中 Free；付費 Choose Plan 停用；顯示「Add a payment method for paid plans」。營運者不新增付款方式、不升級或啟用付費功能；介面不是完整超限／自動升級政策證據。 |
| 約 20:40 | Manage Regions | 唯一標籤 `Primary: Tokyo`；Manage 中沒有已選取 Read Region，欄位 `Select a region`、Update 停用；營運者未修改設定。支持當時無額外跨區 Read Region，不證明供應商內部沒有高可用性複本。 |
| 21:09；DB 截圖 21:07:25，另有系統時鐘 21:09 截圖 | 後測 DB 詳細頁，頁面標籤 `Global` | Free Tier、AWS Tokyo, Japan（`ap-northeast-1`）；Commands `11 / 500K per month`；Bandwidth `2 KB / 10 GB`；Storage `90 B / 256 MB`；Cost `US$0.00`。後測未提供帳戶總覽數字。 |

以上截圖資訊由營運者回報，本次未將影像存入 repository。Commands 顯示差值為 10，僅為兩個觀測值的算術差，不證明 EVAL 計量規則、即時完整計費或確定費用上界。`Global` 標籤不單獨證明新增 Read Region。Storage `90 B` 不解讀為 marker 未清理；caller 的 `cleanup: "cleaned"` 與 Console Storage 各自記錄，不以其中一項覆寫另一項。

### 停止點與剩餘缺口

本次只支持這一次 REST／Lua／TIME／marker GET＋PTTL／compare-and-delete 流程成功；不證明跨 process 業務原子性、真實 timeout 行為、restore 或功能 005 完成。`providerMetering: "unverified"`、`billableUpperBound: null` 維持不變；EVAL 內層計量、Free 超限行為及 Console 更新延遲仍未確認。精確執行起訖時間與前次失敗原始報告未取得，token 撤銷／輪替尚無完成證據；提醒營運者於結束後撤銷或輪替本次 token，agent 不執行帳戶操作。

`manualFollowUp: false`，沒有待追加清理的項目；不追加任何 Redis 操作、不重新執行 caller。T152 維持結案；T153／T154 父項及 12 項正式 gate 維持未完成。文件同步後停止，不啟動 Phase B、業務 runner、OIDC、付費 API、Preview／production 部署或正式模式切換；不新增套件、不 commit／push。

結束 Safety Guard（2026-10-07 21:12:29，Asia/Taipei）：root、origin、branch、HEAD、baseline tag object／peeled commit 與起始相同；staged 0；porcelain 維持 246 筆（43 tracked／203 untracked）。本次僅在既有五份直接文件新增紀錄：本文件、[Tasks](../../specs/005-api-protection-access-modes/tasks.md)、[Readiness](../../specs/005-api-protection-access-modes/readiness-decisions.md)、[Plan](../../specs/005-api-protection-access-modes/plan.md)、[runner 契約](../../specs/005-api-protection-access-modes/contracts/isolated-local-runner.md)，沒有新增檔案、reset／clean 或變更 baseline。文件內成功 JSON 的 digest／派送數／PTTL／cleanup／未知計量欄位與營運者報告核對通過，新增段落沒有 task checkbox 或衝突標記，`git diff --check` 無輸出；未重跑應用測試或 build。

## 2026-10-07 獨立 Redis calibration caller（本機 mock 證據，非 Redis 測試）

> 日期校正：本節原標為 2026-10-07，屬誤植。依本機檔案時間，`scripts\005-redis-calibration.mjs`（20:07–20:11）、`.d.mts`（20:08–20:09）、`tests\api\redis-calibration.test.ts`（20:10）均建立／修改於 2026-10-07，早於 21:06 的真實校準；故改為 2026-10-07，五份文件的標題與錨點已同步。這是由檔案時間推得的日期，各 mock 命令的精確執行時刻未留存，標註待確認；測試結果內容未改寫。精確執行起訖時間、前次失敗原始 JSON、token 撤銷／輪替證據仍缺（由營運者處理，不索取秘密）。

全部測試以 mock fetch 執行，vitest setup 封鎖出站網路；未連線 Redis、未讀取／設定秘密、未執行外部校準、未新增套件、未提交／推送。這不是真實 Redis PASS，不改 T153／T154 父項或正式 gate。

| 命令 | 結果 |
| --- | --- |
| `node --check scripts\005-redis-calibration.mjs` | exit 0 |
| `npm exec --no -- vitest run tests\api\redis-calibration.test.ts` | 1 file／38 tests passed |
| 暫時把 verify `absent` 視為已收斂（mutation）後重跑，再還原（hash 相同） | 3 tests failed（write timeout unknown、contradiction、晚到結果），證明 unknown 測試有效 |
| strict `tsc --noEmit --strict …` 對測試檔＋`scripts\005-redis-calibration.d.mts` | exit 0，0 診斷 |
| `vitest run` calibration＋isolated-runner／composition／environment＋redis-atomic-transport | 5 files／125 tests passed（既有 runner 未改、未受影響） |
| `node scripts\005-redis-calibration.mjs`（dry-run） | exit 0；`networkDispatched: 0`、`secretsRead: false`；`templateDigest` `fd1f6a4b789f41a12da249f123088904e8da846decf72fee63ad18bb0103b4c2` |
| `node scripts\005-redis-calibration.mjs --token=abc` | exit 2，只輸出 `CALIBRATION_ARGUMENTS_INVALID`，不回顯 argv |

mock 覆蓋：import 無副作用、dry-run 零 fetch、計畫與實際 script／REST 次數／內層 calls 一致、秘密不出現在輸出／錯誤／報告、非 HTTPS／非 upstash／帶 path／query 目標拒絕、額外 key／args／重複 op／超過 4 次拒絕、redirect／超大 response／provider error 記 unknown、視窗不足不派送、兩階段中斷、timeout 不重送、marker 相符／不符／過期／矛盾、確認 unknown、`write_conflict`、cleanup 成功／逾時／不符／不存在、晚到結果不追加異動、TTY 無回顯／非 TTY 拒絕／取消、digest 不符拒絕、CLI execute 注入 mock。

尚缺真實 Redis 證據：EVAL 內層實際計量、Console 前後差值、Upstash TLS／EVAL／cjson 相容性、真實 timeout 行為、Free 超限行為、usage 延遲、跨 process atomicity（T153 Phase B）。

## 2026-10-07 Free Redis 連線前置核對（本次文件檢查，非測試）

依使用者授權只做 readonly Safety Guard、官方文件查核、本機設定／runner／REST adapter 盤點與直接文件同步。未連線 Redis、未送 provider command、未啟動 runner、未讀取／輸出／設定秘密、未執行測試／build、未安裝套件、未付費、未提交／推送／部署；沒有新增 application 或 test code。這不是 Redis test PASS，也不改正式 gate。

| 查核面 | 結果 |
| --- | --- |
| Safety 起始狀態 | root `C:\Users\geste\spec-kit\tokyo-mate`；origin `https://github.com/gestertim/tokyo-mate.git`；branch `master`；HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`；staged 0；porcelain 243 筆（43 tracked status records、200 untracked）。baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`，peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`。 |
| 本機介面 | `createRedisRestTransport` 收顯式 `url`／`token` 並送 EVAL REST POST；`validateIsolatedEnvironment`／`createIsolatedComposition` 收 `rest.url`／`rest.token`。`runIsolatedBatches(plan, ports)` 無 CLI；沒有已批准的外部 `ports` caller／可信 usage reader。 |
| 本機 secrets target | 只查 `.env.local` 路徑：目前不存在、`git ls-files` 未列入追蹤、`git check-ignore` 命中；沒有讀內容或建立檔案。既有 proposed `UPSTASH_REDIS_REST_URL`／`UPSTASH_REDIS_REST_TOKEN` 未被程式讀取，不可視為既有 env binding。 |
| 官方計量 | 2026-10-07 查 [pricing FAQ](https://upstash.com/pricing/redis)、[EVAL](https://upstash.com/docs/redis/commands/scripting/eval)、[REST API](https://upstash.com/docs/redis/features/restapi)。Free FAQ 明列 256MB／500K commands 與 operational command exclusions；沒有明確 EVAL nested-call 計量、Free 超限行為或 usage 更新延遲。 |
| 試驗提案 | 階段 A 一批／兩個 child 僅做 IPC barrier，parent ports 最多兩個 execute EVAL、兩個 readonly confirm EVAL、兩個 usage reads、兩個 exact inventory key cleanup（每 key EVAL＋DEL）。外層加已列內層 calls 的邏輯包絡最多 13 個 Redis commands、最多 6 個 Redis REST EVAL POST；usage 成本及實際 billable semantics 未核實，故不是保證上界，現在不能執行。Phase B 真正跨 process 業務競態須另有可驗證的獨立 process caller／harness；restore 排除。 |

Safety end-state 再核對：243 筆 porcelain records／43 tracked status records／200 untracked paths／staged 0，五份文件仍是既存 untracked 白名單內修改，沒有新檔；root、remote、branch、HEAD、baseline tag object／peeled commit 均與起始相同。

T152 保持結案；T153／T154 及 12 項正式 gate 仍未完成；production 六端點 `live:false`、speech 受阻。本次僅文件核對，沒有重跑前批任何測試，亦未把截圖 `0/500K`、`0/256MB`、`0/10GB` 或 US$0 當即時使用量／帳單／真實服務證據。

## 2026-10-07 D14 runner 派送前限定修補（本次最新）

### 批准、契約核對與範圍

接續使用者明確批准的 D14 本機限定修補，不重新規劃。先讀本機最新 Tasks、Plan、Spec、Constitution、[runner 契約](../../specs/005-api-protection-access-modes/contracts/isolated-local-runner.md)、runner／測試及本文件既存證據，執行 prerequisites 與 Repository Safety Guard。限定一致性核對：既有「中斷／worker 失敗停止新 batch、保留 confirmation／cleanup 時間」契約對應 T153 本機 runner；本次修補實作缺口，不改產品、架構、介面或已派送語意。沿用本機批准與正式 checklist 例外，requirements 仍為 71 已勾／12 未勾；不是正式 READY。

本次只修改 [runner](../../scripts/005-isolated-runner.mjs)、[直接測試](../../tests/api/isolated-runner.test.ts)與本證據文件。Tasks／契約及其勾選不變：T152 結案，T153／T154 父項及 12 項正式 gate 未完成。不連外、不讀或設定真實秘密、不安裝套件、不付費、不提交、推送或部署；不啟動外部 runner、E2E 或下一批。

### 修補及確定性回歸

缺口：原程式在 `await Promise.all(requests)` 等待 barrier 回覆後，未重新檢查中斷／worker 存活／剩餘時間，即計量並派送兩次 execute。

修補：barrier 等待完成後、execute 計量與派送前，依序重查 AbortSignal、barrier 失敗或 worker 已死亡、monotonic 剩餘時間。已中斷回報 `interrupted`；worker 失敗回報 `worker_failure`；剩餘時間 `<= operationTimeoutMs + confirmationReserveMs + cleanupReserveMs` 回報 `deadline`，皆不派送或計入 execute 成本。barrier 前原有 `2 × operationTimeoutMs`（handshake＋operation）檢查保留，barrier 後只需尚未執行的 operation 加收斂預留；沒有新增設定或更動預留值。

確定性 barrier 測試使用可控制 IPC 的 ChildProcess 替身與 microtask 次序，不用 sleep 猜競速；只有相關案例替換 fork，測後還原。其餘既有及派送後中斷測試仍使用實際 OS 子 process。

| 新增驗收 | 最後結果 |
| --- | --- |
| 兩 worker 尚未回覆 execute barrier 時 Abort，再完成回覆 | execute 0、batch 0、unknown 0、confirm 0；只計 baseline usage 與 exact-inventory cleanup。 |
| barrier 回覆齊全後、runner 派送前 worker exit | execute 0、batch 0、unknown 0、confirm 0；回報 worker_failure。 |
| barrier 後剩餘時間相對 operation＋confirmation＋cleanup 界線 −1／0／+1 ms | 前兩者 execute 0／deadline；+1 ms 可派送一個雙操作 batch；三者 cleanup cleaned。 |
| 已派送後 Abort，execute 回 unknown、唯讀確認 confirmed | execute 2／不重送，unknown 2／confirmed 2，保留已計成本，exact-inventory cleanup 一次。 |
| 已派送後 Abort，execute 回 unknown、唯讀確認仍 unknown | execute 2／不重送，unknown 2／confirmed 0；cleanup 不呼叫、report cleanup unknown，保留原成本，不退款或重授權。 |

已派送者原有 timeout／unknown、獨立唯讀確認、未確認不刪 inventory 的控制流程未修改；沒有把 Abort 當成「未寫入」證據。

### RED → GREEN 與最後版本驗證

修正測試替身的未初始化 send 後，原 runner 實跑 28 項：24 通過／4 失敗，確定重現 Abort 與 worker 失敗仍派送 2 次，以及 deadline −1／0 ms 仍派送。新增兩種已派送後 unknown 收斂與 +1 ms 正例當時已通過。之後補派送前檢查；strict 發現測試 mock 與 ChildProcess.send overload 不相容，改用明確 Serializable 參數的函式，不加 cast、不放寬 strict；修正編輯時括號錯誤後，以下結果均重新取得自最後程式／測試版本。

| 實際命令／檢查 | 最後結果 |
| --- | --- |
| `.\.specify\scripts\powershell\check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` | FEATURE_DIR 為 005，必要 artifacts 存在。 |
| `node .\node_modules\vitest\vitest.mjs run tests\api\isolated-environment.test.ts tests\api\isolated-composition.test.ts tests\api\isolated-runner.test.ts --reporter=default --reporter=json --outputFile=<session>\files\d14-abort-final-targeted.json` | 19:18:16 開始；3 files／85 passed／0 failed／0 skipped：schema 49、composition 8、runner 28（既有 21＋新增 7），exit0。 |
| 既有 TypeScript API `createProgram`，roots 為上述三份測試，其餘 options 同本文件 D14 原 strict 命令（含 noEmit／strict／Bundler／ES2022） | 完整相關 dependency graph：63 非 declaration source files／0 診斷，exit0；包含 runner declaration，MJS 不冒稱已 strict 檢查。 |
| `node --check scripts\005-isolated-runner.mjs` | exit0。 |
| VS Code Problems／`git diff --check`／Safety 逐檔比對 | 無程式診斷或格式衝突；逐檔結果如下。 |

`runTests` 回報無可探索測試，因此直接使用已存在的本機 Vitest，不執行 npm 安裝或可能下載套件的命令。既有 setup 封鎖 fetch／HTTP／HTTPS／TCP／TLS，composition 仍只注入合成替身。此次按限定範圍只跑上述回歸及型別／語法，不重新跑完整 regression、build、瀏覽器或正式整合；下方舊批次完整測試結果僅為歷史，不冒充本次結果。

### Repository Safety Guard 與停止點

起始 SHA-256 manifest 涵蓋 573 份既有 tracked／untracked 及本機 tooling 檔案，存於本 session `3b55b1e0-9ba2-43c9-b50b-8df42d619493` 的 `files\d14-abort-safety-before.json`。前後全部存在；僅上述 runner／測試／本文件 3 檔 hash 改變，其餘 570 檔保持不變，沒有新增或刪除 repository 檔案。比較結果存於 `files\d14-abort-safety-after.json`，RED／最後回歸 JSON 也保存在同一 session。

`.git`／`.github`／`.specify`／001 資產保留，`.vscode` 起始不存在且未建立，ignore policies 已符合本批。baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8` 與 peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7` 不變；HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`、branch `master`、staged 0，所有既有 dirty／untracked 成果保留。`.specify/extensions.yml` 不存在，前後 hooks 無可執行項。

**停止於本機限定修補與驗證完成**。T152 維持結案；T153／T154 父項、12 項正式 gate、真實 Redis／OIDC／restore／Preview 欠項仍未完成。本機替身／子 process 不構成真實服務證據。

## 2026-10-07 D14 本機契約／composition／有界 runner（本次現行）

### 批准、限定 Analyze 與停止界線

使用者明確批准本機程式、相關測試及直接文件同步，並確認requirements的71已勾／12未勾只保留正式gate，不阻擋本批隔離工作。T152／T155～T161不重審或重開；沿T153／T154本機子範圍，不新增或重編Task ID（盤點最高T161）。本次沒有外部網路／資源／帳戶、真實秘密、套件安裝、付費、正式清除／輪替／restore／cutover、提交／推送／部署或模式切換。

先執行Safety Guard與本機prerequisites，讀現行Tasks／readiness／Plan／Spec、auth／protected／epoch契約及Constitution 2.1.0，同步[本批contract](../../specs/005-api-protection-access-modes/contracts/isolated-local-runner.md)。再執行唯讀限定Analyze：FR-013／SC-015→T153雙process工具，FR-049～056／SC-013、015～017→fail closed／unknown／四keyring／最小輸出，FR-032／033及auth→T154 M1／OIDC／opaque Session。三項本批交付均有檔案／介面／測試映射，無實質衝突、CRITICAL／HIGH為0、未映射子範圍0；僅通過本批可開始實作Gate，非正式READY。`.specify/extensions.yml`不存在，before／after Analyze及Implement hooks皆無可執行項。既有ignore policies符合本批、不新增.vscode或ignore檔。

### 逐檔交付

| 檔案 | 本次變更／驗收 |
| --- | --- |
| [isolated-environment.ts](../../api/_lib/isolated-environment.ts) | 顯式TEST_ONLY／blocked schema，缺／非法／未知／矛盾throw固定分類；REST／OIDC既有validator、四ring版本／current／32-byte獨立key、M1、namespace、floor／authority／registry／runner預留。無env讀取、正式預設或secret產生。 |
| [isolated-composition.ts](../../api/_lib/isolated-composition.ts) | 現有REST／Redis／Session／資格／rate／state／openid-client／epoch／M1／lifecycle evidence factories接線；opaque Session無signing key；paid僅mock、speech blocked；未知inventory keys在REST前拒絕、explicit exact inventory逐key DEL及AbortSignal。無自動seed／publish或memory fallback。 |
| [005-isolated-runner.mjs](../../scripts/005-isolated-runner.mjs) | 有限batch、兩個真實child／IPC client barrier、計量規則ref／保守command成本、四類命令預留、monotonic deadline／時間預留；中斷／worker故障停止新batch，已派送與unknown有界處理、獨立readonly確認、不重送／退款／regrant。未確認收斂不刪inventory。 |
| [005-isolated-runner.d.mts](../../scripts/005-isolated-runner.d.mts) | RunnerPlan／ports／固定allowlist report的TypeScript介面。MJS實體另以Node語法及實際process測試驗證，不把TS declaration冒稱JS strict檢查。 |
| [005-isolated-worker.mjs](../../scripts/005-isolated-worker.mjs) | 固定slot／sequence IPC protocol，無secret payload；HTTP／HTTPS／fetch／TCP／TLS封鎖；不繼承credentials或NODE_OPTIONS，stdout／stderr不透傳。 |
| [isolated-environment.test.ts](../../tests/api/isolated-environment.test.ts) | 49實跑；缺漏、額外設定、非法REST／OIDC、family共key、current／version、namespace／floor／authority／registry、超出Date範圍及commands／deadline±1。 |
| [isolated-composition.test.ts](../../tests/api/isolated-composition.test.ts) | 8實跑；opaque Session／lookup／logout、M1／no fallback／paid零呼叫、library替身port、exact inventory DEL及雙process＋獨立composition clients→REST／Lua替身首次grant一次。 |
| [isolated-runner.test.ts](../../tests/api/isolated-runner.test.ts) | 21實跑；不同child PID、barrier／有限batch、worker實際終止／Abort、預算及unknown上界拒絕、deadline停止、timeout／readonly／cleanup容量、用量未知／超界、輸出去秘密及inventory限制。 |
| [isolated-environment-fixture.ts](../../tests/fixtures/isolated-environment-fixture.ts) | 四獨立合成key及TEST_ONLY client／subjects／floor／registry／runner設定；無正式秘密。 |
| [isolated-local-runner.md](../../specs/005-api-protection-access-modes/contracts/isolated-local-runner.md) | 本批schema／ports／逐檔與測試矩陣，有限命令與時間算式，unknown安全清理，未來外部設定名稱／步驟／欠項及不授權聲明。 |
| [tasks.md](../../specs/005-api-protection-access-modes/tasks.md) | 只勾既有T153／T154本機子項；父項與12正式gate仍未完成，T152保持結案。 |
| [plan.md](../../specs/005-api-protection-access-modes/plan.md) | 沿用stack及factories、四family／opaque Session、子process／IPC邊界、有限預留與本機完成結果；無正式入口接線。 |
| [readiness-decisions.md](../../specs/005-api-protection-access-modes/readiness-decisions.md) | 本批批准／完成／正式未READY；歷史待批敘述不覆蓋本次授權，外部先備與欠項保留。 |
| [spec.md](../../specs/005-api-protection-access-modes/spec.md) | 同步本機工具邊界與unknown不退款／重grant，不改FR／SC、正式產品行為或已結案語意。 |
| 本文件 | 本次實跑、失敗修補與Safety前後結果，區分替身及真實證據。 |

### 最後版本實跑命令與結果

環境：Windows x64，Node `v24.19.0`、npm `11.11.0`。本次未執行npm install／audit／官方查詢，不新增套件。`runTests`工具回報無discoverable tests，改用既有Vitest runner，沒有安裝測試工具。

| 實際命令／檢查 | 最後結果 |
| --- | --- |
| `.\.specify\scripts\powershell\check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks`（Implement及限定Analyze各一次） | FEATURE_DIR為005，必要artifacts存在；最高Task T161。 |
| `npm exec --no -- vitest run tests\api\isolated-environment.test.ts tests\api\isolated-composition.test.ts tests\api\isolated-runner.test.ts --reporter=default --reporter=json --outputFile=<session>\files\d14-final-targeted.json` | 最後lifecycle evidence與Date非法邊界修補後重跑：19:00:43開始，3 files／78 passed／0 failed／0 pending，success:true。 |
| Node TypeScript API `createProgram`：API／tests API／support／PWA，options=`noEmit,strict,skipLibCheck,target ES2022,module ESNext,moduleResolution Bundler,esModuleInterop,resolveJsonModule,jsx react-jsx,lib ES2022+DOM+DOM.Iterable,types node+vitest/globals` | 163 root source files、0診斷、exit0；避免Windows長命令限制，不降低strict。 |
| `node --check scripts\005-isolated-runner.mjs`及`node --check scripts\005-isolated-worker.mjs` | 兩者exit0。 |
| `npm run build`（既有`tsc -b && vite build`） | exit0，Vite v8.3.0／92 modules。僅本機browser bundle，不等於Linux Function artifact／Preview。 |
| `npm test -- --reporter=default --reporter=json --outputFile=<session>\files\d14-final-regression.json` | **最後全部程式／測試修補後重跑**：19:00:49開始、144.86s，113 files／1365 passed／0 failed／0 pending，success:true、exit0。 |
| VS Code Problems／`git diff --check`／直接文件link與範圍檢查 | 無診斷／格式衝突；Safety逐檔另見下節。 |

完整回歸出現既有jsdom `HTMLMediaElement.pause()`未實作訊息及測試內預期錯誤輸出，但0測試失敗，未擴大修補無關程式。前兩輪完整回歸也通過，但之後補齊lifecycle evidence port及Date非法邊界，分別保存為`d14-pre-lifecycle-regression.json`、`d14-pre-date-boundary-regression.json`，不將其當最後版本證據。最後JSON位於本session `e6b37d10-776f-4e87-a5b8-161105bfe724`的`files`，均保留作本機證據。

### 失敗→修補→重驗

1. schema首跑41通過／2失敗：fixture用了空registry entries；沿既有contract補完整六端點entries，重跑43通過。正式成本沒有變更。
2. composition首跑2失敗：錯將SharedStoreUnavailableError的reason當message、state keys未列inventory導致OIDC在library前拒絕。修正錯誤型別斷言及明列state keys，49個合併測試與strict通過，不鬆綁inventory。
3. runner首跑timeout case把結果誤標worker failure：done等待計時從operation前開始，與operation timeout競態。將done等待移到結果回傳前，維持獨立operation deadline；補確認仍unknown不cleanup與時間／清理timeout測試。
4. strict揭示vi.fn的Promise literal widening：以RunnerPorts method generic維持精確union，不使用any或關閉strict。
5. 雙process整合測試先誤期望issuance 200，沿既有契約修為201；Lua替身REST wrapper又把DEL numeric結果當string，修正替身wire shape。程式仍拒絕錯誤cleanup reply，不用成功fallback掩蓋。
6. 最後接線盤點補必填lifecycleEvidence並接既有TEST_ONLY lifecycle factory，缺port立即拒絕；全部targeted、strict／build及完整回歸重新取得最後結果。
7. 最後非法邊界盤點補Date可表達範圍，避免安全整數時間仍超出Date範圍而逃逸成RangeError；新增固定錯誤分類case後重跑78 targeted、strict／build與1365完整回歸。文件語言檢查初版誤把共用字「格／行」當簡體，修正檢查pattern後24個本批local links、語言及conflict marker檢查通過，沒有因誤判改無關內容。

### Safety前後比對

起始root `C:\Users\geste\spec-kit\tokyo-mate`，origin fetch／push皆`https://github.com/gestertim/tokyo-mate.git`，branch `master`，HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`，43 tracked修改／190逐檔untracked、staged0。起始status／remote／branch／HEAD／baseline記錄於本session的`files\safety-start.json`，529個既有檔案SHA-256及index記錄於`files\safety-hashes-start.json`；不是從舊聊天假定起始狀態。

最後原529檔全存在；只修改上表五份既有文件（Tasks／Plan／readiness／Spec／本verification），其餘524檔hash不變。另新增上表9份程式／test／fixture及1份contract，共10檔；43 tracked修改／200逐檔untracked，全部起始dirty／untracked仍保留、staged0。branch／HEAD／remote／index tree `e391eb727c4072b321bf400e7997adc149a9bb2f`不變。baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`及peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`不變。

`.git`／`.github`／`.specify`／001歷史均保留；12份PDF、001～004資產、local-only政策、manifest／lockfile／env templates、原application／UI／tests／production價表／requirements checklist未修改；`.vscode`不存在、不建立。沒有讀取真實.env／Vercel帳戶binding或設定credentials。build產物由既有build命令產生且不納入Git交付；無本批repo暫存config待刪。最後逐檔manifest及Safety比對保存於`files\safety-end.json`。

### 本機證據、正式欠項與停止

本機使用全出站封鎖的Vitest setup、合成REST／OIDC ports、實際OS子process及既有Lua interpreter的Redis／cjson替身；兩個IPC client由父端選各自獨立composition，替身history序列化。**首次grant恰一次只證明本機接線／替身契約，不證明真實Redis跨process／instance原子性或兩個真實REST writer連線。**

本批strict的可重現完整命令（既有TypeScript API，無新增config）：

```powershell
node --input-type=module -e "import ts from 'typescript'; const dirs=['api','tests\\api','tests\\support','tests\\pwa']; const roots=dirs.flatMap(d=>ts.sys.readDirectory(d,['.ts','.tsx'])); const options={noEmit:true,strict:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,esModuleInterop:true,resolveJsonModule:true,jsx:ts.JsxEmit.ReactJSX,lib:['lib.es2022.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts'],types:['node','vitest/globals']}; const p=ts.createProgram(roots,options); const ds=ts.getPreEmitDiagnostics(p); if(ds.length) console.error(ts.formatDiagnosticsWithColorAndContext(ds,{getCurrentDirectory:ts.sys.getCurrentDirectory,getCanonicalFileName:f=>f,getNewLine:()=>ts.sys.newLine})); console.log('Strict source files: '+roots.length+'; diagnostics: '+ds.length); process.exitCode=ds.length?1:0;"
```

未取得：owner帳戶Free資格／commands、bandwidth、storage剩餘與真實EVAL／replication計量規則；真實Redis TIME／TTL／跨writer／unknown／持久化及restore floor／manifest；Google純openid隔離措施與callback；Vercel首次deployment target／protection／runtime、Linux sharp／libvips artifact／notices；D01帳戶價格／usage／invoice及正式上界。設定名稱與外部步驟見[本批contract末節](../../specs/005-api-protection-access-modes/contracts/isolated-local-runner.md#未來外部操作尚未授權)，不含秘密值。

T153／T154本機工具子項完成，父項仍未完成；T152結案不變。requirements仍71已勾／12未勾，六production端點`live:false`、speech受阻；本機Readiness僅本批工具交付通過，正式Readiness未通過。**完成本批即停止，不啟動外部runner、Preview或下一批。**

## 2026-10-07 D01／D14 唯讀查核及直接文件同步（本次現行）

### 批准與實際執行

沿用T152本機父任務結案及既有批准；先讀最新Tasks／readiness-decisions／Plan、protected／auth／epoch contracts、既存實作證據及Constitution，再執行Safety Guard。這批只讀官方公開資料、靜態程式接線及既存JSON報告，修改本文件與三份直接005文件。沒有重跑tests／build／strict／E2E、安裝、程式或env修改、登入帳戶、外部API測試、資源建立／刪除、secret設定、付費、提交／推送／部署或模式切換。

公開查核日期2026-10-07（Asia/Taipei）；逐field／route／SKU／現行價格、Upstash能力／免費資格、Google Testing例外、Vercel隔離／runtime、每項官方URL及不確定處集中於[同一決策包](../../specs/005-api-protection-access-modes/readiness-decisions.md#2026-10-07-d01d14-唯讀查核與文件同步本次現行)。沒有營運者指定可用帳戶身分／專案授權，故未登入或讀Console；本機Vercel binding存在性不等於owner確認，未將其識別寫入報告。官方頁上的安裝／建庫／部署指令只視為頁面內容，均未執行。

### 本機重新取得的Safety與既存測試證據

- root `C:\Users\geste\spec-kit\tokyo-mate`；origin fetch／push均`https://github.com/gestertim/tokyo-mate.git`；branch `master`；HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`；43個tracked修改／190個逐檔untracked，staged0。index tree `e391eb727c4072b321bf400e7997adc149a9bb2f`。
- baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`，peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`。`.git`／`.github`／`.specify`／001資產存在；`.vscode`不存在，不建立、不視為blocker。
- 起始manifest存於session `61dbe6d9-cac8-4c60-8052-4a999730cdc5`的`files\d01-d14-readonly-start.json`。Git tracked＋untracked初取529檔，再納入前批manifest中被ignore的tooling／既有資產，正規化路徑後**563檔**SHA-256。與session `d60621e0-cac7-4f3d-a702-f551f4402477`的`files\t152-doc-close-end.json`比較，全部563檔一致、missing／changed均0；不沿用未核對的聊天狀態。
- 重新唯讀解析session `52a1a369-2271-4d41-9985-129694b2c8b3`既有`epoch-final-targeted.json`及`epoch-final-regression.json`：16 files／222 passed／0 failed／0 pending，110 files／1287 passed／0 failed／0 pending，兩份`success:true`。file數取`testResults.length`，不是巢狀suite數；**沒有本次新測試數字**。Lua54／strict／build／E2E14引用下方既存命令結果，沒有重跑或當真實provider證據。
- requirements本機實數71已勾／12未勾；唯讀核對[production成本表](../../api/_lib/cost-price-table.ts)仍為六端點共用`live:false`、空效期及未批准價格；speech受阻。這是靜態核對，不是應用驗收PASS。

### 本次成果、未完成與文件差異

| 本次修改文件 | 差異／不變範圍 |
| --- | --- |
| [readiness-decisions.md](../../specs/005-api-protection-access-modes/readiness-decisions.md) | 增補既有D01／D14公開查核、七field及兩route最高SKU、現行全球分階價格；免費資格／EVAL計量與restore未證、openid Testing例外、首次deploy target、namespace適配；必要本機接線清單、分項批准及清理，不採正式成本值。 |
| [tasks.md](../../specs/005-api-protection-access-modes/tasks.md) | 只加本次查核狀態及阻擋，不新增Task／改勾選／重開T152；T151／T153／T154及正式gate仍未完成。 |
| [plan.md](../../specs/005-api-protection-access-modes/plan.md) | 同步官方先備及技術接縫缺口／批准邊界，不變更architecture／runtime／schema。 |
| 本文件 | 重新取得Safety與既存報告數字，記錄唯讀查核及文件範圍，不寫新應用測試PASS。 |

**未完成**：實際帳戶Free資格／剩餘用量／billing適用條件、EVAL內部計量規則、free backup／restore資格、可信隔離composition／runner、真實Redis跨writer／TIME／TTL／restore、Google callback、Preview隔離／首次target、Linux native artifact及provider帳單。US$0／2h／10,000 commands及cleanup預留仍僅候選操作界線，未達可啟動條件；12項正式gate未勾，六端點`live:false`、speech受阻。

### 文件檢查與Safety end-state

- 新增四節的18個local Markdown links／anchors均存在，26個官方URL引用及Task references已檢查；T152／T155～T161保持勾選，T149／T150／T151／T153／T154父項保持未勾。新段落無衝突marker／行尾空白／檢查到的簡體字；未新增或改動任務勾選。
- 四份修改文件的VS Code Problems無診斷；`git diff --check` exit0。這些只作文件一致性／修改範圍檢查，**不是應用測試PASS**。
- 起始563檔全部存在，只有上表四份文件hash不同，其他559檔hash完全不變；43個tracked修改／190個untracked逐檔狀態保留，staged0。branch／HEAD／remote／index tree／baseline tag不變，不新增或刪除repository成果、不建立`.vscode`。application／tests／public／manifest／lockfile／env／001～004／`.github`／`.specify`及requirements／production成本表均未變。
- session `61dbe6d9-cac8-4c60-8052-4a999730cdc5`的`files\d01-d14-readonly-end.json`保存最後manifest及文件／Safety檢查結果；requirements仍71已勾／12未勾。既存測試報告只讀，不列本次新實跑結果。

**停止點已到達**：唯讀查核與直接文件同步完成即停止。尚缺營運者去識別化帳戶證據與下一批各項明確批准，不建立／設定／寫入／測試／部署外部資源；T152不重開，12項正式gate未完成、六端點`live:false`、speech受阻。

## 2026-10-07 T152 本機父任務文件結案（本次現行）

### 授權、現況與核對方法

使用者本次只批准：核對T155～T161、結案T152本機父任務、同步直接文件及準備D01／D14具體操作清單。不重新規劃、不重問既有批准、不修改application／tests、不重跑已結案測試、不安裝、不對外查詢／操作、不生成或設定秘密、不付費、不提交／推送／部署。下方各批證據保留原樣，結案前「T152含正式gate／不勾」判讀由本節修正，並非刪除歷史。

- 先讀本機最新Tasks、readiness、epoch／protected／auth contracts、既存證據、Plan Safety與Constitution 2.1.0，再保存本次起始manifest。root `C:\Users\geste\spec-kit\tokyo-mate`、branch `master`、HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`；現況43個tracked修改／190個逐檔untracked、staged0，563個unique檔案SHA-256。這是本次重新取得，不沿用聊天狀態。
- `mvp-safe-baseline` tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`，peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`；index tree `e391eb727c4072b321bf400e7997adc149a9bb2f`。`.git`／`.github`／`.specify`／001等資產存在；`.vscode`與`.specify\extensions.yml`不存在，不建立、不視為blocker。
- 本次起始`files\t152-doc-close-start.json`保存在session `d60621e0-cac7-4f3d-a702-f551f4402477`。與既存實作session `52a1a369-2271-4d41-9985-129694b2c8b3`的`files\epoch-continuation-end.json`核對，絕對／相對路徑正規化後563個檔案hash全部一致、差異0；因此沒有把舊報告套用到已變更的程式。首版比對因路徑表示不同而誤列差異，修正正規化後才採結果。
- 實際讀取同一既存session的`epoch-final-targeted.json`及`epoch-final-regression.json`：前者`testResults`16 files／222 passed／0 failed／0 pending，開始17:47:41；後者110 files／1287 passed／0 failed／0 pending，開始17:47:39，兩者`success:true`且所有file status為passed。Vitest `numTotalTestSuites`含巢狀suite，不能用37／286代替實際file數。本次只讀報告，沒有重新實跑。
- Lua54／strict／build／隔離E2E14／source-map-js1.2.2及npm audit等，引用下方已存命令與結果，不冒稱本次新驗證；memory／Redis-cjson替身不等於真實Redis／restore／provider證據。

### T152 原完成條件與逐項對照

| 已完成Task | T152所需本機證據／引用 |
| --- | --- |
| T155 | E01～E10批准範圍同步、限定Analyze／本機Readiness；下方中間狀態與契約§9保留紀錄。 |
| T156 | source-map-js唯一定向更新1.2.2；下方既存lockfile／npm ls／audit證據；本次manifest／lockfile不改、不再audit。 |
| T157 | 原子簽發／同命令確認、canonical encoding、可信authority／時間／撤銷／退役與有界限制。 |
| T158 | verify-only未grant舊capability首次grant一次、原fingerprint版本／pinned context比較、duplicate／conflict零第二grant、unknown不猜失敗。 |
| T159 | 本人oneOf查詢、到期後accounting lookup、TEST_ONLY legacy隔離、手動確認／新操作UX與不持久保存token／handle。 |
| T160 | atomic detail→tombstone、uncertain原窗口守恆／review、單管理者逐步再授權／冪等／audit、四family引用與dry-run／缺證據拒絕。 |
| T161 | 契約§10矩陣、最後targeted／完整回歸JSON與strict／build／隔離E2E紀錄、逐檔Safety；正式限制均明列。 |

[T152原定義](../../specs/005-api-protection-access-modes/tasks.md)明列「完成T155～T161後才勾此本機父任務；真實Redis／restore及production清除證據不屬本任務完成」。七項已勾、證據齊且與本次起始內容一致，故本次將T152父項及對應implementation本機子項勾選；不以新增外部證據為本機結案條件，也不擴張本機完成至正式清除。詳細驗收仍引用[契約§10](../../specs/005-api-protection-access-modes/contracts/request-epoch-and-key-lifecycle.md#10-本機實作驗收矩陣本輪執行真實服務項仍未驗)。

### 逐檔文件差異與剩餘任務

| 檔案 | 本次差異 |
| --- | --- |
| [tasks.md](../../specs/005-api-protection-access-modes/tasks.md) | T152父項與implementation子項結案；修正T152含正式gate的現行描述、保留歷史；T153明列restore等未完成證據與Preview另批；T154只校正已完成安裝不再待批，外部／Preview仍pending。 |
| [readiness-decisions.md](../../specs/005-api-protection-access-modes/readiness-decisions.md) | 沿原D01矩陣／D14操作包補Places逐route／七field SKU、價格／帳戶／成本公式／2-attempt付費提案，以及隔離資源、Preview、US$0候選預算／用量／停止、秘密名稱／binding缺口、驗證／清理；沒有新批准或生效值。 |
| [plan.md](../../specs/005-api-protection-access-modes/plan.md) | T152由本機執行中更新為本機已結案，T153正式證據界線與既有操作包引用；不改架構。 |
| [pipeline-readiness-report.md](../../specs/005-api-protection-access-modes/checklists/pipeline-readiness-report.md) | 加本次結案核對與現行限制，早期快照保留；不重新Analyze、不解除正式Readiness。 |
| 本文件 | 保存本次原始現況、既存JSON／hash核對、T152對照與文件檢查／Safety結果。 |

仍未完成：T149／T150部署artifact／runtime／native證據、T151逐端點成本及帳單、T153真實Redis／跨instance／restore、T154真實Google／Preview，以及T019／T138正式服務證據、T119～T123等正式secret／預算／部署／模式切換範圍。T152本機clear／retire測試不批准production清除／輪替／legacy cutover；原12項正式gate、六端點`live:false`、speech受阻全部保留。

### 本次文件檢查與Safety結果（不是應用測試）

- 已執行新增／同步8個文件片段的本機引用檢查：最終23個local Markdown links／anchors、117個Task references均有對應（初輪106個，補齊結案紀錄後再查）；T152／T155～T161與implementation子項已勾，T149／T150／T151／T153／T154父項仍未勾。T153描述補充仍使用既有ID，不新增任務；新段落無衝突marker／行尾空白／簡體字。
- 五份修改文件的VS Code Problems沒有診斷；`git diff --check` exit0。這不是build／type check／應用測試，沒有新測試PASS數。
- 起始manifest的563個既有檔案全部仍存在，只有上表五份文件hash不同；沒有新增或刪除repository檔案。application／tests／public／package manifest／lockfile／env／ignore／PDF／001～004／`.github`／`.specify`逐檔不變。全部43個既有tracked修改及190個untracked保留，staged0；HEAD／branch／index tree／baseline tag不變，沒有建立`.vscode`。
- requirements原71已勾／12未勾且檔案hash不變；production成本價表hash不變、六端點共用`live:false`項，speech受阻。無外部服務／帳戶、secret／付費／正式清除／輪替／cutover／提交／推送／部署／模式切換。
- 本session `files\t152-doc-close-end.json`保存最後逐檔manifest、changed／missing／added及Git／gate比較結果；以實際end-state核對，不以聊天敘述代替。session檔不加入repository。

**本次停止點**：文件結案與[既有D01／D14具體操作清單](../../specs/005-api-protection-access-modes/readiness-decisions.md#2026-10-07-t152-文件結案與下一批批准界線本次現行)交付後停止。文件一致性／Task引用／修改範圍檢查只作文件驗證，不標應用測試PASS。

## 2026-10-07 Epoch 接續完成：T157～T161（僅本機）

沿用使用者已批准E01～E10本機授權，未重新規劃或重問。先讀本機Tasks／契約／已有證據，執行Repository Safety Guard，保留T155／T156及全部dirty／untracked成果。下方「中間狀態；尚未完成」和早期批次保留為歷史，不覆寫。

### 逐項完成／正式受阻

| 任務 | 已完成本機範圍 | 正式限制 |
| --- | --- | --- |
| T157 | canonical capability、可信floor／authority publication、UTC next／TIME切換、immutable命令索引、簽發與確認邊界；同命令確認重驗當下資格／撤銷／退役／到期，零補簽／grant | 真實Redis／獨立restore manifest／全部部署證據未驗；正式入口未配置 |
| T158 | capability、資格、registry／G、日週、冪等、首次grant、unused與accounting index同次reserve EVAL；正常signing verify-only可初grant一次，原fp version／pinned cost比較；committed response unknown不猜未成立 | 六端點production `live:false`；原Places-only成功限制保留；沒有真實上游 |
| T159 | 本人status oneOf、四狀態projection、本人／他人／403優先、TEST_ONLY legacy拒絕；六client共用記憶體-only簽發／確認panel及明確新操作UX | 不啟用legacy cutover、不清legacy索引；token／handle不入URL／storage／SW |
| T160 | 可注入30天detail／review／audit／aggregate收斂；uncertain原窗口／最小tombstone／晚到守恆；24h／7d／30d review、90d rotation及四family引用；單管理者inspect／confirm、每步重新授權／冪等／理由／必要證據／audit | 缺帳單／爭議窗口及retirement／restore／引用證據不清comparison／aggregate／secret；正式輪替／清除／排程未批准。人工review不結帳、不釋額 |
| T161 | 完整本機矩陣、全部API strict、app strict／build、新舊005隔離E2E、最後版本完整回歸、直接文件同步及逐檔Safety | fixture／Lua interpreter與Redis/cjson替身不是真實跨instance／durability／部署證據；005整體與正式Readiness仍非READY |

### 最後版本實際驗證（跳過不算PASS）

| 命令／範圍 | 最後結果 |
| --- | --- |
| 契約targeted，精確16-file selector見[Quickstart](../../specs/005-api-protection-access-modes/quickstart.md#e01e10-本機完成與重現)，加default／json reporter | 17:47:41，16 files／222個實際通過，0失敗、0跳過，19.74s |
| `npm test -- --reporter=default --reporter=json --outputFile=<session>\files\epoch-final-regression.json` | 17:47:39，110 files／1287個實際通過，0失敗、0跳過，179.36s；**全部code／tests最後修改後再跑** |
| 新增epoch Lua四suite：redis-request-epoch-store／request-epoch-reserve／epoch-engine-integration／epoch-lifecycle的Lua describe | **54實際執行通過、0跳過**；另lifecycle HTTP 1案例不算Lua；`skipIf(!luaAvailable)`保留 |
| 全部API／tests API／support／PWA strict，精確指令如下 | exit0 |
| `npm run build`（app `tsc -b`＋Vite） | exit0，92 modules；不是部署 |
| `npm exec -- playwright test --config=playwright.config.ts 005-epoch.e2e.ts 005-self-service.e2e.ts 005-local-protection.e2e.ts` | 14實跑通過、0跳過，18.0s；含unknown→原bytes確認→再次明確送出、唯讀lookup、focus／online／reload、URL／storage／SW檢查 |
| `git diff --check` | exit0 |

```powershell
$sources = Get-ChildItem api,tests\api,tests\support,tests\pwa -Recurse -File -Filter *.ts |
  ForEach-Object { $_.FullName }
node .\node_modules\typescript\bin\tsc --noEmit --strict --skipLibCheck `
  --target ES2022 --module ESNext --moduleResolution Bundler `
  --esModuleInterop --resolveJsonModule --lib ES2022,DOM,DOM.Iterable `
  --types node,vitest/globals @sources
```

Vitest新增本機network guard預設阻擋fetch／HTTP／HTTPS／TCP／TLS；mock注入才可得到回覆。Playwright攔截全部非127.0.0.1請求，唯一paid POST是本機route fixture，不接付費provider；Vite preview由既有runner啟閉且page流程證實有回應。Lua使用本機interpreter，Redis/cjson仍是替身，沒有連Redis server。JSON reports保存在本session `files\epoch-final-targeted.json`及`files\epoch-final-regression.json`。

### 中途失敗→修補（未混入最後PASS數）

- 新增test曾誤嵌於另一case，修正describe結構；strict指令原缺`DOM.Iterable`、fixture回傳status widening及client string／ProductError union已修正，不以關閉strict掩蓋。
- cjson空array會成`{}`，authority改用固定encoder維持`revokedKids:[]`及safe integers；未以decode fallback吞錯。
- lifecycle review／audit loops插入位置與aggregate changed計數曾不正確，已移至user loop後／正確分支，實跑30天−1／等值／+1、24h／7d／30d／90d界線。cleanup先預驗序列化／時間／audit collision，uncertain必要材料保留；dry-run不落資料異動。
- 第一輪epoch E2E的mock狀態文案不符合既有嚴格DTO，修正fixture為原canonical文案，未放寬client驗證。committed unknown的store port會以既有去識別化錯誤拋出，不要求洩露transport訊息；以原tombstone／duplicate／窗口守恆驗實質結果。
- 第一輪完整回歸：1282通過／1失敗／0跳過。admin-self-quota舊fixture錯把admin keys整組傳quota Lua，新增key-type guard拒絕；改用各adapter正確同slot key組，未放寬guard。Places守恆新assert先漏掉既有5/4 scale，核對fixture價格40000×5/4＝50000後修正。其後完整回歸1286全實跑通過；最後補齊batch預驗案例後再跑1287全實跑通過，不以此前失敗算PASS。
- full suite的既有jsdom media not-implemented提示仍如實保留，沒有當正式麥克風／音訊或外部服務證據。
- 最後收斂另補「全部batch預驗」：後一user損壞record時，在任何detail／tombstone寫入前拒絕；case驗前一user原reservation與窗口完整不變。此code／test最後修改後，重新跑222 targeted、strict／build、14隔離E2E及1287完整回歸；此前1286不是最後版本證據。
- Safety初版判讀腳本把預期不存在的extensions誤判為失敗，實際hash／git／checklist均無異常；改用明確`vscodeAbsent`／`extensionsAbsent`條件後重新執行。逐檔數量另明列entries與unique files，避免將起始tooling重複path算成不同檔案。

### Repository Safety 最後結果

- 起始manifest `epoch-continuation-start.json`含557筆SHA-256 entries（重複列入tooling的path去重後545個檔案）；全部原檔仍存在。end manifest／changed／added／missing／protected comparison保存在本session `files\epoch-continuation-end.json`；沒有刪除、還原或清理既有成果。
- root `C:\Users\geste\spec-kit\tokyo-mate`、branch `master`、HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`、index tree `e391eb727c4072b321bf400e7997adc149a9bb2f`維持；未stage／commit／push。baseline peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`及tag未移動。
- `.github`／`.specify`、specs001～004及全部PDF逐檔hash不變；本接續批package manifest／lockfile／ignore／env不變，source-map-js1.2.2保留。
- `.vscode`未存在也未建立；`.specify\extensions.yml`仍不存在，前／後hooks無可執行項。沒有新branch、dependency、service、資料庫或排程。
- requirements **71已勾／12未勾**、production六端點`live:false`、speech受阻維持。無外部帳戶／服務操作、正式清除／輪替、legacy cutover、付費、提交、推送或部署。

本機T157～T161完成後停止；T152／T153及其他含正式gate的父任務不勾。真實Redis／restore／secret／成本／帳單／cutover與部署受阻只影響各自正式範圍，不用來掩蓋未做本機工作。

## 2026-10-07 E01～E10 本機實作接續（中間狀態；尚未完成）

本節更新僅記錄本輪已實際執行的子範圍；不得取代下方歷史紀錄，也不代表E01～E10整體完成。

- Repository Safety 起始狀態與逐檔快照見本session `005-round-start`：root `C:\Users\geste\spec-kit\tokyo-mate`、`master`、HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`、staged 0、既有42個tracked修改及164個untracked檔案。未執行reset／clean，未覆寫、清除或還原既有檔案；baseline tag、001～004、PDF及local-only政策均保留。
- 已同步E01～E10本機批准及正式操作限制，並完成限定Analyze；修正Plan內要求重新批准T152本機實作的過期段落。正式requirements checklist原有12項仍未勾選。
- `source-map-js`唯一定向更新為1.2.2；`package.json`未由本輪修改。lockfile僅`node_modules/source-map-js`的version、resolved及integrity欄位改變；integrity為`sha512-KGj/8Y43x35aZVDtt+J4mK1hoLGHULMYfSkODJNQjNDC3oW1PqPoxMwo0pLUsWM/UEGzON/NxeHywEfNXNP3Vw==`。`npm ls source-map-js --all`顯示三條既有父依賴皆解析至1.2.2；`npm audit --audit-level=low`回報0 vulnerabilities。
- 本輪新增固定canonical HMAC capability編碼／驗證helper、E01簽發endpoint與同slot Redis Lua store；quota回應新增可選request-epoch hint。正式handler未配置可信選項時仍fail closed。Lua測試使用repository既有Redis/cjson替身，不是真實Redis原子性證據。
- 已跑：`npm exec -- vitest run tests/api/request-epoch.test.ts tests/api/redis-request-epoch-store.test.ts tests/api/request-epoch-endpoints.test.ts tests/api/protected-endpoint-pipeline.test.ts tests/api/me-endpoints.test.ts tests/api/map-quota-gate.test.ts tests/api/redis-shared-store.test.ts`，7 files／128 tests PASS；`npm run build`（`tsc -b`與Vite build，89 modules）PASS；`git diff --check` PASS。
- 尚未完成且不可宣稱通過：paid pipeline capability驗證及reserve同一Lua首次grant、E06 operation-status oneOf／legacy gate、E07～E09狀態機／受保護管理流程、E10前端手動確認UX、完整E01～E10驗收矩陣、隔離E2E及最終完整回歸。故T157～T161維持未勾選；本機Readiness尚未完成評估，真實Redis／正式Readiness仍未就緒。

## 2026-10-07 Epoch 決策具體化＋advisory 唯讀（本輪現行）

### 授權與開始 Safety

- 使用者本輪僅授權同步已批准verify-only、E01～E10完整推薦及advisory唯讀查核；只修改直接相關005文字文件。沒有application／測試／dependency／epoch／key／資料清除／外部資源／付費／提交／推送／部署授權。D10／D11與D13本機批次不重審、不例行重跑測試。
- Root `C:\Users\geste\spec-kit\tokyo-mate`、origin `https://github.com/gestertim/tokyo-mate.git`、branch `master`、HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`；staged 0，起始42個tracked修改、118個untracked status entries（含折疊目錄）、逐檔164個untracked，nonignored manifest共503檔。不得把status entries與檔案數混用，這些全部是本輪開始前成果。
- `mvp-safe-baseline` tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`、peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`已核對；001～004無本輪修改。所有PDF保留，含005 `plan.pdf`；`.vscode`不存在且未建立。`.specify`／`.github\skills`仍由既有ignore作local-only；不調整政策。
- 起始逐檔SHA-256、status、HEAD／branch／index tree保存在本session `files\005-safety-start.json`；另存`.specify`／`.github`既有34檔的SHA-256於`files\005-local-assets-start.json`，含ignored tooling／PDF。不備份或讀取外部帳戶secret，不清理既有成果。
- `.specify\extensions.yml`不存在，前置hooks無可執行項；唯讀執行一次 `check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks`，FEATURE_DIR正確為005、spec／plan／tasks存在。文件收斂後的限定Analyze唯讀，不把skill作implementation授權。

### 已批准語意與完整決策包

- 同步 [Spec](../../specs/005-api-protection-access-modes/spec.md)、[Plan](../../specs/005-api-protection-access-modes/plan.md)、[data-model](../../specs/005-api-protection-access-modes/data-model.md)、[UX](../../specs/005-api-protection-access-modes/ux-ui-design-handoff.md)、[readiness-decisions](../../specs/005-api-protection-access-modes/readiness-decisions.md)、[Tasks](../../specs/005-api-protection-access-modes/tasks.md)及四份直接contracts：epoch／protected／auth／error。
- capability signing verify-only禁止新簽，不禁止已簽有效capability、尚未grant時的原子首次grant；全部本人Session／資格／限流／成本／epoch authority gate仍必須成立。fingerprint verify-only只比較已存在操作，原version／cost binding不改，重送不當新操作、第二grant為0。洩漏撤銷／epoch退役擋新grant，不追溯作廢原used／uncertain占用或保守結算。
- [E01～E10唯一完整推薦](../../specs/005-api-protection-access-modes/contracts/request-epoch-and-key-lifecycle.md#9-e01e10-完整推薦決策包2026-10-07唯一集中答案)均包含具體路徑／DTO／值／演算法、理由／取捨、A／P、任務與批准後範圍、可執行驗收與證據。所有新值／410／cutover／review權限皆P；沒有寫入程式或生效設定。T152只完成文件子範圍，整項仍未完成。
- 唯讀prior art核對：既有fingerprint `canonicalContent`／HMAC v2、`REDIS_QUOTA_KEYS`同slot namespace、Redis TIME／Lua first grant與me lookup接縫。推薦重用，沒有新package／資料庫／queue／通知服務。原命令嵌可信epoch hint、同入口確認immutable token，避免去重刪除後舊命令重建，也避免verify-only key補簽。

### npm high advisory 查核（2026-10-07；不修補）

| 項目 | 實際證據／判讀 |
| --- | --- |
| audit | 實跑`npm audit --json`：1 high、0 critical／moderate／low；exit非0是命中公告，不是安裝或修復。查前確認lockfile187個resolved URL為公開npm registry，未見private registry；只傳公開dependency metadata，不傳source／secret。 |
| ID／官方來源 | `source-map-js`、audit source `1241209`、`GHSA-68fv-2mgg-jv7q`、`CVE-2026-93749`、CWE-1284、CVSS3.1＝7.5。[GitHub公告](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)2026-10-05更新；`isDirect:false`、`via`直接指該公告、`nodes:["node_modules/source-map-js"]`、effects空。公告high不是本專案已證實可被一般使用者利用的結論。 |
| 受影響／修補 | npm audit範圍`>=1.0.0 <1.2.2`，實際鎖定`1.2.1`；第一修補版`1.2.2`、fixAvailable true。[官方registry1.2.2](https://registry.npmjs.org/source-map-js/1.2.2) integrity為`sha512-KGj/8Y43x35aZVDtt+J4mK1hoLGHULMYfSkODJNQjNDC3oW1PqPoxMwo0pLUsWM/UEGzON/NxeHywEfNXNP3Vw==`。 |
| 必要條件 | 攻擊者可控制含極大section offset line的indexed source map，且該map被SourceMapConsumer解析；可造成同步event-loop阻塞／DoS。不執行攻擊payload。 |
| 本機路徑 | 實跑`npm explain source-map-js`：`vite@8.3.0 → postcss@8.5.28（^8.5.28）→ source-map-js@1.2.1（^1.2.1）`；`jsdom@30.0.1 → css-tree@3.2.1（^3.2.1）→ source-map-js（^1.2.1）`；`@vitest/coverage-v8@5.0.0 → magicast@0.5.5（^0.5.4）→ source-map-js（^1.2.1）`。PostCSS的前置source-map解析可到SourceMapConsumer；不因dev-only就宣稱無風險。完整分支見下表。 |
| build／dev server | 有PostCSS解析面；惡意indexed map進入trusted build／dev server的實際外部入口未確認，不能宣稱已可達或無風險。依賴／CSS供應鏈及外部素材輸入需治理。 |
| test | 依賴樹含該套件；是否有攻擊者可控indexed map輸入未確認，未重跑測試或PoC。 |
| server runtime／frontend bundle | `npm ls --omit=dev source-map-js --all`空，api／src沒有直接import；沒有已確認的production入口。這是依賴盤點，不是重新build／serverless artifact掃描，既有bundle是否含parser未重新驗證。 |
| provenance | HEAD lockfile已有`1.2.1`；前批D13證據ID與版本一致。未發現ID校正需要；新增CVE／條件／可達性分層，不能把前輪audit摘要當本輪完整安全保證。 |
| 精確最小提案（P） | 僅將lockfile `node_modules/source-map-js`從1.2.1升至1.2.2，resolved改`https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.2.tgz`、integrity改上列SRI；保留dev／license與其他entry。既有parent範圍可容納patch，不新增直接dependency或override、不改package.json。預期只有此node的version／resolved／integrity三欄；若npm產生其他diff即停止檢視，不全樹更新。 |
| 批准後驗證（未執行） | 先另批dependency修補；採用npm lockfile-only的定向更新且不跑lifecycle，核對diff只該node，再還原安裝環境與targeted source-map／PostCSS、build／type-check及npm audit。若parent range不容納或需更多包則重新提案，不執行audit fix、不連服務或部署。 |

本輪沒有修patch、改package／lockfile、更新node_modules或新增依賴；公告信心與產品可利用性信心分開，不以1筆公告當完整資安審查。前輪「既有high」紀錄保留，不改成已修復。

官方 [v1.2.2 release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2)於2026-09-30發布，notes明列malicious indexed source maps DoS修復；[修補commit cf7658058ceeaa8619d5ae0ec90be6905209d016](https://github.com/7rulnik/source-map-js/commit/cf7658058ceeaa8619d5ae0ec90be6905209d016)標題對應CVE-2026-93749，與GHSA／registry一致。公告與鎖定版本判定信心10/10；本專案遠端可利用性未確認，不能把10/10套到外部可達性。

| explain完整來源分支 | parent要求／鎖定版本 |
| --- | --- |
| root→vite→postcss→source-map-js | root `vite:"latest"`鎖8.3.0；vite要求postcss `^8.5.28`鎖8.5.28；postcss要求source-map-js `^1.2.1`鎖1.2.1。 |
| root→jsdom→css-tree→source-map-js | root `jsdom:"latest"`鎖30.0.1；jsdom要求css-tree `^3.2.1`鎖3.2.1；css-tree要求source-map-js `^1.2.1`。 |
| jsdom→dom-selector→css-tree | jsdom要求`@asamuzakjp/dom-selector ^8.3.0`鎖8.3.2；dom-selector要求css-tree `^3.2.1`。 |
| jsdom→specificity→css-tree | jsdom要求`@bramus/specificity ^2.4.2`鎖2.4.2；specificity要求css-tree `^3.0.0`鎖3.2.1。 |
| jsdom→css-syntax-patches→css-tree | jsdom要求`@csstools/css-syntax-patches-for-csstree ^1.1.7`鎖1.1.13；該包對css-tree `^3.2.1`是peerOptional，不誤寫為一般dependency。 |
| root→coverage-v8→magicast→source-map-js | root `@vitest/coverage-v8 ^5.0.0`鎖5.0.0；coverage-v8要求magicast `^0.5.4`鎖0.5.5；magicast要求source-map-js `^1.2.1`。 |
| peer連結（不是source-map-js直接來源） | plugin-react6.1.1要求vite `^8.0.0`；vitest5.0.0要求vite `^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0`、peerOptional jsdom `*`及coverage-v8 `5.0.0`；@vitest/mocker5.0.0 peerOptional vite `^6.0.0 \|\| ^7.0.0 \|\| ^8.0.0`。 |

原始audit與逐字explain分別保存本session `files\005-npm-audit-source-map-js.json`／`files\005-npm-explain-source-map-js.txt`。audit只跑一次；等待補充時沒有重跑audit，只重取唯讀explain／公開官方公告。以上依賴版本／range由實際輸出核對，不推測新bundle。

### 逐檔變更與限定 Analyze

| 本輪檔案（相對repository root） | 本輪變更 |
| --- | --- |
| `specs/005-api-protection-access-modes/spec.md` | 已批准語意及首次grant／二次grant／撤銷兩順序驗收；候選不生效。 |
| `specs/005-api-protection-access-modes/plan.md` | 既有架構接縫、T152依賴、同入口unknown與restore證據界線。 |
| `specs/005-api-protection-access-modes/data-model.md` | signing／fingerprint狀態分離、issuance不等reservation、comparison／accounting分離。 |
| `specs/005-api-protection-access-modes/ux-ui-design-handoff.md` | 正常輪替不新增錯誤，確認／查狀態／新操作手動流程的P候選。 |
| `specs/005-api-protection-access-modes/readiness-decisions.md` | 完整推薦入口／摘要及歷史verify-only／retired語意校正，保持已批准gate。 |
| `specs/005-api-protection-access-modes/tasks.md` | T152文件子範圍、未完成實作／phase與驗收，無實作checkbox冒充完成。 |
| `specs/005-api-protection-access-modes/contracts/request-epoch-and-key-lifecycle.md` | 各章／狀態表／首次grant同步，完整E01～E10、DTO／canonical／保存／文案及回歸矩陣。 |
| `specs/005-api-protection-access-modes/contracts/protected-endpoints.md` | 首次grant與舊fingerprint比較／原accounting相容。 |
| `specs/005-api-protection-access-modes/contracts/auth-and-session-endpoints.md` | E01同入口confirm、E06本人唯讀候選，不改D10／D11既有契約。 |
| `specs/005-api-protection-access-modes/contracts/error-and-quota-contract.md` | 正常輪替與409／503、待批410界線；已批准文案不改。 |
| `docs/verification/005-local-implementation-evidence.md` | 本節的Safety／advisory／逐檔變更／限定Analyze證據，保留全部前批成果。 |

限定Analyze僅本輪文件與直接依賴的狀態／grant／重送／保存／跨輪替／unknown／UX，不計算005全套coverage或重審D10／D11／D13：

| ID | 類別／嚴重度 | 位置 | 結論／處置 |
| --- | --- | --- | --- |
| E-A01 | Inconsistency／HIGH（已修正文案） | epoch §5／§6；readiness D07／D08 | 原「verify-only不可新grant」混淆不可新簽與不可首次執行；逐份分離並加入未grant舊capability首次成功／零第二grant驗收。 |
| E-A02 | Inconsistency／HIGH（已修正文案） | epoch §4／E01／E04 | 確認若補簽會違反verify-only，去重若不綁epoch則有限刪除後可重建。推薦預簽候選→原子commit存原bytes、同命令confirm、epoch hint＋永久屏障；全P，不假裝實作完成。 |
| E-A03 | Evidence gap／HIGH（仍是批准與驗收gate） | E05／E07／E09 | restore屏障真實durability、provider爭議保存窗口、legacy安全有限清除沒有實測證明；有具體方案與停止條件，不允許刪除／清key或宣稱READY。 |
| E-A04 | Boundary／MEDIUM（已明列） | E06／E10 | 到期免費查狀態與新操作、410與既有409／503需分流；新增行為全P，D10／D11正式DTO不改。 |

Coverage：E01～E10共10／10完整推薦、10／10有T152與既有接縫映射、10／10有驗收／證據；不代表批准10／10或測試10／10 PASS。無新Constitution衝突；沒有未映射的新實作Task ID。候選相依不阻擋已完成本機成果，但阻擋採候選implementation、清除與production。最終Safety與文件引用查核以本session的end-state紀錄及本輪交付摘要為準；不新增測試PASS。

### 本輪文件驗證與結束 Safety

- 決策表實際解析恰E01～E10十列；引用的T019／T138／T139／T140／T141／T142／T152／T153均有既有任務定義，沒有新增或重編Task ID。新決策錨點§9／9.1／9.2／9.3核對有效。
- 僅Node記憶體計算候選最大DTO形狀（不產key、不簽token、不測epoch程式）：101字元命令、154B請求、431Bpayload、645B假MAC token、911B完整成功信封，分別低於候選1024B／1024B／4096B上限。這是候選大小可行性證據，不是正式encoder或實作測試。
- 檔案引用掃描：本輪新增相對連結有效；全量掃描既有證據發現兩個前批session絕對連結的檔案目前不在本機，均在本輪開始前已存在，沒有刪除／改寫歷史provenance或當成現行驗證證據。非本輪新broken link，不擴大修復範圍。
- 最終503候選表逐字沿既有error契約的`userTitle=無法確認使用狀態`／userMessage／actionableStep，unknown只增加P畫面補充，未覆寫已批准信封。epoch token的不可變generation與authority最新generation／revision分開，舊有效verify-only epoch不因generation較小被誤拒絕；本人accounting lookup不依comparison key恢復而grant。
- 結束root／remote／master／HEAD／baseline tag及peeled commit不變，staged0；原42 tracked修改／118 untracked status entries／164 untracked檔維持，503檔manifest無missing／新增。只有上列11份既有005文字文件相對本輪起點改變；application／tests／package／lockfile／001～004／全部PDF／ignore與34份local-only tooling雜湊不變，`.vscode`仍不存在。end-state及逐檔before／after SHA-256保存本session `files\005-safety-end.json`。
- `git diff --check` exit0；沒有執行全套或targeted測試、build、installation、audit fix、epoch實作、key輪替／刪除、外部服務建置／登入、付費／提交／推送／部署。readonly npm／官方公開來源查閱不是外部服務啟用。

真正剩餘：E01～E10全部P部分、advisory定向修補授權；原D01、D14、正式secret／付費／部署／模式gate維持獨立。本輪停止於決策包；005整體／真實整合仍非READY。

## 2026-10-07 D13 本機實作＋D01 證據＋D07／D08 草案（現行）

### 授權與 Safety Guard

- 使用者已批准指定套件本機安裝、OIDC／可信 decoder 既有 seam、測試與直接文件；D01 僅不付費取證，D07／D08 僅契約草案。沿用 L1～L5、已結案限定 Analyze、requirements 71 checked／12 unchecked 例外，不修改 checklist markers、不重問已批准範圍。
- Start：root `C:\Users\geste\spec-kit\tokyo-mate`、origin `https://github.com/gestertim/tokyo-mate.git`、`master`、HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`、staged 0。40 tracked modifications；`git status --short` 的 untracked 含目錄折疊，為 114 entries；逐檔 nonignored manifest 共498 files（含既有005成果），不把status entries當逐檔數。
- `mvp-safe-baseline` tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`，peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`；兩者不混稱。001～004、全部既有PDF、005 `plan.pdf`、`.git`／`.github`／`.specify`／local-only ignores保留；`.vscode`不存在且未建立。
- 起始498檔SHA-256、raw status、tracked／staged binary diff存於本session `files\d13-start-baseline.csv`、`d13-start-status.txt`、`d13-start-tracked.diff`、`d13-start-staged.diff`。原package／lockfile沒有既有diff。未清理、提交、推送、切branch、重建或移動tag。
- 本輪相對起始manifest：17個既有檔修改、5個新檔（下方逐檔列出）；無missing file、無授權範圍外內容變更。結束hash／Safety摘要保存在session，不把其他40個既有tracked修改歸因本輪。hook設定檔不存在，前後無hook；沒有外部操作。

### 實際安裝版本、registry 與傳遞依賴

環境：Windows `win32`／`x64`，Node `v24.19.0`、npm `11.11.0`，沿用 npm／`package-lock.json`。先查指定版本 metadata／SRI／scripts／engines，再改manifest及安裝：

```powershell
npm view openid-client@6.8.8 version engines dependencies dist scripts license --json
npm view jose@6.2.12 version engines dependencies dist scripts license --json
npm view oauth4webapi@3.8.8 version engines dependencies dist scripts license --json
npm view sharp@0.35.5 version engines dependencies optionalDependencies dist scripts license --json
npm install --include=optional --foreground-scripts --loglevel=http
npm ls openid-client jose oauth4webapi sharp --all
```

| 套件 | 實際版本／關係 | registry／lockfile integrity |
| --- | --- | --- |
| openid-client | 6.8.8，直接dependency | `sha512-ZsucJA5Ad04Uv7YN4ql+s4GXNmb9uAYQwyJTsJx7CH/MX3JZioLE2pVKi1SC+YrbSLA4Px3Gi30dMjgOZtb6pA==` |
| jose | 6.2.12，openid-client transitive／scoped override；無直接import | `sha512-9NiFmJEex0sy2Dk58j2UGBSHgUs2ypF9eZSu4L6vjOX3Dp96Sw1F3uL+H+D1sx02jZZdzUT0HgvCy59CuvXcWw==` |
| oauth4webapi | 3.8.8，同上 | `sha512-8N28E+a/oxfXWBgOMt+ZP/JUf/XR+IFbvkAEPP3gznXOMv9BpAAwiIj0TFNz3tGTPc0ZQ8zmWBNgN1nAys0gng==` |
| sharp | 0.35.5，直接dependency；Node≥20.9.0 | `sha512-Ywn4OnzGukp7CDMrp08RQ50YKmuwG47brZgIVPTvBaaAfQlRlygrRqSrxdCiL9M+LlzLBiJ68IR1QqvzHyjC7g==` |
| Windows native | @img/sharp-win32-x64 0.35.5，npm自動optional | `sha512-x76eH0vEiHlcMQu8Y8IenntaACtddpT6W0wmXtWrnKcnKI7ME5DdgqhAD6SEWOEl1v2zDvkZDhFA9KnURwpfqg==` |

重新查核修正歷史metadata：sharp必要JS dependencies實為 `semver@7.8.5`、`@img/colour@1.1.0`、既有 `detect-libc@2.1.2`。npm另外自動取得optional `@img/sharp-wasm32@0.35.5`、`@emnapi/runtime@1.11.3`，重用既有 `tslib@2.8.1`。10個實際新增安裝包；lockfile新增34個entries（含其他OS／CPU的optional metadata，不代表在Windows載入Linuxbinary）。沒有手動安裝Linuxbinary或新增未批准的直接package。

既有lockfile entries無version／integrity異動、無刪除；僅root dependencies及detect-libc由dev-only變共用runtime metadata。所有新增entries的SRI由npm寫入lockfile；registry download／cache紀錄保存在session `d13-npm-install.log`。本次log未顯示dependency lifecycle script執行，sharp使用prebuilt native loader；不宣稱從source編譯。`jose`此次registry未宣告engine，舊研究的≥20.19.0不是此次metadata證據；本機載入／測試通過才證明本機相容。不改runtime／`engines`／framework。

原生載入顯示sharp0.35.5／libvips8.18.7。MIT／Apache／Windows native package的Apache-2.0 AND LGPL-3.0-or-later notices均保留在安裝資產，未刪授權文件。部署交付檢查必須保留實際native／libvips notices、辨識適用LGPL義務及對應來源可取得性，不把npm安裝視為發佈合規已驗。

npm audit回報1個high：既有`source-map-js@1.2.1`（GHSA-68fv-2mgg-jv7q），由起始HEAD lockfile比對確認本輪未新增／換版；結果保存在session `d13-npm-audit.json`。不執行`npm audit fix`、不擴大本輪範圍；這不是完整安全審查或新套件無漏洞聲明。

### OIDC 本機 library 證據

- `openid-client-binding.ts`接既有provider／flow與local composition；combined exchange＋verify port讓library處理code grant＋PKCE、state／nonce、claims及JWKScrypto。明確啟用`enableNonRepudiationChecks`，不能只依token endpoint HTTPS或decode宣稱已驗簽。原mock port保留，既有測試仍可用。
- discovery issuer／authorization／token／JWKS endpoints精確固定；攔截transport不允許其他host。每操作獨立config／abort／timeout，沒有共享可變transport、持久provider tokens或自製JWT驗簽。library使用零clock tolerance，adapter保留alg allowlist、aud／azp、nonce、exp／iat、maxTokenAge及token／codebytes限制，驗證後再次核對當下時計。
- 實際測試使用Node產生local RSA key／signed JWT與攔截discovery／token／JWKS response；code exchange body核對verifier／callback／client／scope，state單次consume成功及失敗都測、provider以invalid_grant拒絕code重用。錯issuer／audience／nonce／azp／exp／iat／missingiat／signature／algorithm／kid／malformedJWT、JWKS503、discovery污染、各network階段timeout均拒絕；不建Session或給晚到成功。
- opaque Session仍每請求server-side lookup；登入成功不給付費資格。App Session沒有簽章key，OAuth state-cookie HMAC與其他families分開。實際Google帳戶、callback／consent、Googlekey輪替與正式Redis都**未驗**；預設HTTP auth exports仍未配置。

### 可信影像 decoder 本機證據

- local composition的`createLocalImageVerifier()`注入既有`images.verify(bytes,mime)`；3 MiB是base64還原後的壓縮影像bytes，不是raw pixel buffer大小。最長邊2048、像素2048²、raw4-channel最多16,777,216 B；後兩值由既有尺寸上限推導，非新產品數值。
- sharp設定failOn warning／sequential read／limitInputPixels／保留native安全限制與既有2秒dependency budget的native timeout。metadata僅做先拒絕，必須`raw().toBuffer()`走完整像素解碼才回尺寸；不存原圖、不擴格式、不呼叫vision。PNG structural check拒絕截斷／APNG，不把只讀第一幀當單頁。
- JPEG／PNG／WebP合法樣本；格式偽裝、半截、metadata可讀但IDAT損壞、缺IEND、WebP動畫／APNG、2047／2048／2049、2048²合法／更大像素拒絕、合法PNG3MiB−1／等值／+1、空資料／未知格式／缺timeout；實接HTTP seam，合法仍503、壞圖400且audit，零reserve／vision。沒有Vercel native平台／cold start／hard platform termination證據。

### D01 不付費證據與仍未證明的輸出控制

- 相同實際builder逐字驗證travel／translation／photo-translate，最大合法1000／2000 UTF-16、三byte BMP、surrogate語意與JSON escape bytes分離、三tone／兩target、knowledge16383／16384／16385及文字±1，不截斷。
- 實測travel固定prompt875 B＋knowledge16384 B＋text3000 B＋wrapper36 B＝20,295 B；photo-translate最大完整7,157 B／instruction1,058 B；OCRinstruction627 B。不把4096B prompt候選算式23,516 B當現行實測或token上界，不以測試平均值推上界。
- 未知env model在現有fixture estimator被拒絕；實際HTTP boundary仍503、零reserve／上游／fetch。production六端點`live:false`／`pricing:null`保持；speech受阻。
- 完整provider framing／tokenization、影像計費、output cap與reasoning涵蓋、SKU／tier／usage／invoice未取得。保留內容`executeUpstream`不是成功HTTP管線，尚無批准的2,000／4,096／3,072輸出cap；本輪不偷偷套候選cap或以本機樣本聲稱上游輸出有界。T151／T130／成功整合仍未完成，付費取證及啟用另批。

### D07／D08 完整草案與文件同步

[完整request-epoch／key契約](../../specs/005-api-protection-access-modes/contracts/request-epoch-and-key-lifecycle.md)交付簽發入口／本人／CSRF／防濫用、owner／endpoint／handle bindings、可信time／跨instance authority、重送／輪替／legacy相容、tombstone及verify-only清除前提、fault／late／uncertain／revocation；唯一集中E01～E10待批清單。沒有實作epoch、設新TTL／期限、輪替或刪除既有key／idempotency。

同步Spec／Plan／Tasks／contracts／data-model／quickstart／readiness／research／README；research的重複R13已分為成本R13與套件查核R15，Plan引用校正。過時「目前」明列歷史；移除現行Session signingkey假設，保留歷史provenance。T149／T150整項含部署不勾，只勾本機子範圍；T151僅不付費、T152僅文件子範圍。

### 命令與實際結果（不沿用歷史測試數）

| 命令／階段 | 結果 |
| --- | --- |
| Spec Kit `check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` | FEATURE_DIR為005；spec／plan／tasks可用；Safety及readiness沿既有批准／例外 |
| IDE `runTests` 指定adapter tests | 無測試被runner發現，改用既有Vitest，未加工具 |
| 初次5檔targeted Vitest（11:38:33） | 1 fail／82 pass；WebP fixture兩幀完全相同被encoder折成靜態，改用不同像素幀；未放寬decoder |
| 首次targeted strict TS | CustomFetch Uint8Array body與DOM BodyInit型別不符、fixtureissuer literal過窄；改用型別安全buffer copy及可污染test metadata，未cast any |
| `vitest.cmd run tests\api\openid-client-binding.test.ts tests\api\sharp-image-verifier.test.ts tests\api\oidc-provider.test.ts tests\api\oidc-flow.test.ts tests\api\paid-input-boundaries.test.ts tests\api\upstream-text-inputs.test.ts --maxWorkers=1 --pool=forks`（11:39:37） | 6 files／96 tests PASS，4.76s |
| targeted strict `tsc.cmd --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --esModuleInterop --lib ES2022,DOM,DOM.Iterable --types node,vitest/globals`＋上列6test paths | exit0 |
| 最終補缺state／code／token bytes與algorithm／kid／malformedJWT後，`vitest.cmd run --maxWorkers=1 --pool=forks`（11:44:35） | **101 files／1208 tests PASS，133.37s，exit0**；jsdom既有HTMLMediaElement pause未實作提示不是test failure |
| 全API／tests／support／PWA strict透過`.cmd` | Windows command line too long，非程式診斷；改以下Node方式，不改compiler要求 |
| PowerShell `$sources = Get-ChildItem api,tests\api,tests\support,tests\pwa -Recurse -File -Filter *.ts \| ForEach-Object { $_.FullName }`；`node .\node_modules\typescript\bin\tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --esModuleInterop --resolveJsonModule --lib ES2022,DOM,DOM.Iterable --types node,vitest/globals @sources` | **exit0**（含最終新增tests） |
| `npm run build`＝`tsc -b && vite build` | **exit0，89 modules**；appTS與Vite產物通過，不是Vercel serverless artifact驗證 |
| IDE Problems＋`git diff --check` | 相關7個API／test檔無diagnostic；tracked diff whitespace檢查通過 |

最終程式修改後只跑上述一次完整回歸；沒有重複全面複審或再跑歷史E2E。full regression／build／npm logs保存在本session。文件-only後續同步不需再跑程式全套。

### 逐檔修改清單（相對本輪498檔起始基線）

既有17檔：

- `package.json`、`package-lock.json`。
- `api/_lib/local-protection-adapters.ts`、`api/_lib/oidc-flow.ts`、`api/_lib/oidc-provider.ts`。
- `tests/api/upstream-text-inputs.test.ts`。
- `README.md`、本證據文件。
- 005 `spec.md`、`plan.md`、`tasks.md`、`readiness-decisions.md`、`research.md`、`data-model.md`、`quickstart.md`。
- 005 `contracts/auth-and-session-endpoints.md`、`contracts/protected-endpoints.md`。

新5檔：

- `api/_lib/openid-client-binding.ts`、`api/_lib/sharp-image-verifier.ts`。
- `tests/api/openid-client-binding.test.ts`、`tests/api/sharp-image-verifier.test.ts`。
- 005 `contracts/request-epoch-and-key-lifecycle.md`。

### 停止點與三種證據狀態

- **本機library／decoder：已完成指定可執行子範圍。** T149／T150本機接線、targeted／最終回歸、strict／build與Safety證據。D01僅bytes／拒絕控制；D07／D08僅草案。
- **真實服務：未驗／NOT READY。** Google帳戶／OAuth client／Redis跨instance、供應商usage／invoice未驗；T153／T154／D14不執行。
- **部署：未驗／NOT READY。** Vercel實際runtime／architecture、Linuxnative打包／artifact大小／coldstart、LGPL交付未驗；不讀帳戶識別、不設定正式秘密、不付費、不Preview／正式部署、不切mode。
- 005整體不是READY。六端點live:false、speech受阻、既有MVP baseline／正式驗收缺口保留；完成以上本機範圍後停止。

## 歷史：2026-10-07 D13／D01／D07–D08／D14 收斂與限定 Analyze（批准前）

### Safety Guard 與變更範圍

- Start：repo root `C:\Users\geste\spec-kit\tokyo-mate`；remote `gestertim/tokyo-mate`；branch `master`；HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`；40 tracked modifications、159 nonignored untracked、staged 0。這些是本輪開始前既有工作，不歸因於本輪且未清理／覆寫。
- `mvp-safe-baseline` peeled commit 維持 `fb09a41182bcc639a9335adbd0e1f84405a1bba7`；001～004 及其 `plan.pdf`、005 `plan.pdf` 保留；`.github`／`.specify` 的 ignored local tooling 未追蹤／重建；`.vscode` 不存在且未建立。
- 為 13 個授權範圍／保護參考文件保存起始 SHA-256（含 005 PDF）於本 session state；end comparison 只允許 readiness package、Spec／Plan／Tasks／Research／data model、直接相關 contracts 與 verification artifacts，且不允許 app／runtime／price／dependency／deployment changes。詳細 end manifest 以 session snapshot 為準，不把已存在的其他 dirty files 誤列成本輪變更。
- End：仍為 `master`／相同 HEAD、origin remote、peeled baseline；40 tracked modifications、159 nonignored untracked、staged 0。13 份 SHA-256 比對結果為 11 份授權文件內容改變、`error-and-quota-contract.md` 與 `plan.pdf` 不變；沒有 application／dependency／environment／deployment 資產改變，沒有刪除或 missing snapshot file。end hashes 存於本 session state。

### 本輪文件結果與測試來源

- 唯一新增的決策詳情在 `specs/005-api-protection-access-modes/readiness-decisions.md`：D13 exact packages／runtime gate；D01 六端點成本證明與啟用順序；D07／D08 保存、uncertain、tombstone 與 key epoch 提案；D14 Redis／OIDC 隔離操作及四種獨立批准 gate。
- 同步 Spec、Plan、Research、data-model、auth／protected contracts、Tasks、Readiness／Analyze report 與本證據文件。所有新保存期限、epoch、套件、runtime binding、外部資源、付費測試與 production 操作明確標記待批准；不重審 D10／D11，也未更改其批准契約。
- 唯一本機測試：既有 `vitest.cmd run tests/api/upstream-text-inputs.test.ts --maxWorkers=1 --pool=forks`，1 file／4 tests PASS。實際 builder 量測：travel 固定 prompt 875 B、額外包裝 36 B、目前 prompt 完整文字 20,295 B；4096 B prompt 假設情境 23,516 B；photo-translate instruction 1,058 B、完整文字 7,157 B；OCR instruction 627 B。bytes 只證明組裝大小，不轉換為 tokens、image cost 或帳單上界。
- 沒有重跑全套應用測試／build／E2E；文件分析不宣稱測試 PASS。沒有安裝／更新 dependency、讀取／設定正式 secret、登入或建立外部資源、連接帳戶、付費上游呼叫、修改 app／正式設定、提交／推送／部署。

### Readiness 區分

- **本機文件／邊界**：此輪新增的提案與追溯完成；受限 builder test 通過。本機檔案／測試不證明 vendor billing、真實 Redis、Google OIDC 或正式 runtime。
- **真實整合**：NOT READY。D13 需 package／Vercel runtime owner evidence 與各自批准；D01 缺端點級成本上界前提／供應商 usage／invoice；D14 無外部資源或真實 service tests。
- **正式部署**：NOT READY。production 六端點維持 `live:false`；沒有 production secrets、價格表數值、部署或模式切換授權。

## 2026-10-07 D10／D11 批准同步與本機實作（本輪最新）

使用者明確批准最新D10／D11草案的具體路徑／欄位／reasonCode／狀態／文案／大小／限流／分頁，並指定完整清單JSON上限65536 bytes、超限縮頁不漏項、單筆超限fail-closed。先讀最新Spec／contracts／Plan／Tasks／readiness及既有證據、執行Safety，再同步文件與分階段Implement→Run→Verify→Fix。沿用L1～L5、已結案Analyze與checklist71／12例外，沒有重審結案批次。

### 任務與本機交付

- **T142本機完成**：POST本人操作狀態factory；目前Session與有效資格、同源／CSRF、30/min、1024-byte有界輸入、4096-byte回應、owner lookup；只回四狀態／updatedAt／已批准userMessage。未知／他人同404；資格撤銷即403，即使初次access與lookup間撤銷亦拒絕。查詢branch不建立reservation／grant、不呼叫付費上游、不還原內容；settled僅記帳。
- **T147本機完成**：POST／GET本人申請及POST撤回factory；Session本人subject、嚴格白名單、2048-byte輸入、有界reader、異動共10/min／清單60/min。未核准／拒絕／撤銷／到期可申請paid_access，有效核准者週耗盡可申請weekly_top_up；tier與追加金額只由管理者決定。
- 與既有管理者共用same-slot Lua authority；enqueue／owner冪等／本人-kind-當週pending去重／最小user event同次寫入。管理resolve與withdraw兩種順序、跨週拒絕舊申請套新週。resolved／withdrawn終態不改已核准權利，終態後可新key再提；pending去重不限制管理追加次數／累計。user event不是admin audit。
- 完整清單序列化UTF-8 JSON信封≤65536 bytes；縮頁`nextOffset=offset+實際items.length`，未回傳項目留在續頁，單筆超限503。threshold測試直接走HTTP所使用的serializer：65535／65536／65537 bytes、多byte／JSON跳脫、105筆續頁全集不漏項；測試大項目是人工serializer邊界資料，不是新增允許大欄位。HTTP另驗證owner／DTO白名單／續頁一致性。
- 首頁新增手動本人入口；進頁／focus不申請、不自動清單或狀態查詢、不polling。申請網路不確定後保留相同command／key，只有明確手動確認才再查；離頁abort、晚到隔離、401／403清除舊本人資料。追加所需週key由手動取得的可信quota DTO提供，不以browser時計推算。原operation key放POST body、不進URL。
- 管理審核顯示reason／申請週；withdrawn排除pending queue。既有已批准管理政策與權利到期時間不偷偷延長。預設HTTP exports仍未配置、503 fail-closed，沒有接正式服務。

### 精確修改清單（相對本輪485檔起始manifest）

**25個既有檔修改／13個新檔**：

- 修改7個API helper：admin-endpoints、admin-redis-script、admin-store、error-envelope、local-protection-adapters、redis-rate-limiter、self-service-endpoints；新增me-endpoints、me-store及三個本人route（operation-status、requests、requests/[reviewId]/withdraw）。
- 修改5個src檔：App、AdminReviewQueueScreen、admin-api、access types、error types；新增SelfServiceScreen及測試、self-service-api及測試、self-service types。
- 新增tests/api的me-endpoints／me-requests-store，以及tests/pwa的005-self-service隔離E2E。
- 修改005之Spec／Plan／Tasks／readiness／data-model／UX／research／quickstart與auth／error／admin三份contracts，另更新README與本證據；001～004／PDF／dependencies／lockfile／ignore／environment／部署設定不變。

### 本輪實際命令與結果

selectors有重疊，不把每階段tests相加當唯一數；只有下列最後全套為本輪總數。

| 命令／階段 | 實際結果 |
| --- | --- |
| IDE `runTests` 指定新增store test | 無測試被runner發現；改用既有Vitest，未安裝新工具 |
| `vitest.cmd run tests\api\me-requests-store.test.ts --maxWorkers=1 --pool=forks`（10:04:02） | RED：缺me-store module，1 suite失敗 |
| store／管理2個相關selector（共3檔，10:05:02） | 1 fail／19 pass；新測試把transport物件誤當mock函式，改查transport.eval |
| store／管理／error共4檔（10:05:59） | 29 tests PASS；首次API strict查出rate arity、Request.url誤當function與union narrow，已修正 |
| HTTP／store／管理／rate共5檔（10:07:48） | 43 tests PASS；新測試literal widening與pagination型別需補，已修正 |
| 本人UI／client／HTTP／store／管理quota／管理UI／管理client共7檔（10:10:33） | 34 tests PASS；app tsc發現Testing Library不接受exact選項，已移除。當時串接命令最後exit0**不代表app型別已通過** |
| 相同7檔補授權競態與三個申請資格案例（10:12:04） | **38 tests PASS**，10.04s |
| `tsc.cmd -b`後檢查exit；`node node_modules\typescript\bin\tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --jsx react-jsx --types vitest/globals,node --skipLibCheck`＋全部api／tests/api／support／pwa `.ts`（10:12） | **兩者exit0**，無新增暫存config或.vscode |
| `vitest.cmd run --maxWorkers=1 --pool=forks`（10:12:47） | **99 files／1165 tests PASS**，139.25s，exit0；為管理authority與首頁影響升級全套回歸，不重開已結案治理審查 |
| `npm run build` | **exit0**，Vite89 modules；production型態bundle建置不代表正式live切換 |
| `playwright.cmd test --config=playwright.config.ts 005-local-protection.e2e.ts 005-self-service.e2e.ts` | **13 passed**，18.1s，exit0；既有webServer再次build，API明列mock、全部非localhost請求abort |
| IDE problems（api／src／tests）；`git diff --check` | 無diagnostics；exit0 |

Vitest仍有6則jsdom `HTMLMediaElement.pause()`未實作提示，無失敗；不是實體音訊證據。Playwright新增本人流程驗證5次明確手動request、續頁offset1（不是猜25）、零六端點付費POST；既有12個隔離案例亦通過。

### 證據限制／停止點

- Lua interpreter＋Redis/cjson／時間替身只能證明本機script branch與順序；Promise.all enqueue是同process替身序列化，不是真實Redis跨process或網路故障取證。HTTP單元測試注入Session／store，E2E是HTTP mock，不是GoogleJWT／JWKS、OIDCcallback或Vercel部署驗收。
- D01成本、D07／D08保存／輪替／epoch、D13library與D14外部操作仍未決；不採成本新值、不建立TTL／scheduler／epoch、不新增dependency。不解除六端點production `live:false`或成功整合其他受阻項。
- 本輪沒有付費呼叫、正式秘密設定、連外啟用、提交、推送、部署或模式切換；005整體／真實服務／部署仍非READY。
- 開始／結束均master；HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`；baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`與peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`不變。Git **40→40 tracked修改、146→159 nonignored untracked、staged0→0**；485個起始檔全保留、missing0，結束498檔。既有001～004／plan.pdf沒有修改。
- start／end Safety manifests及逐檔SHA-256保存在本session `files\005-d10-d11-start-safety.json`與`files\005-d10-d11-end-safety.json`，不提交。extensions.yml仍不存在，before／after hooks均無；.vscode仍不存在且未建立。無本輪repo暫存config需清理。

## 2026-10-07 決策批准同步與連續本機實作（本次最新，優先於歷史紀錄）

沿用既有L1～L5、已結案Analyze及requirements71／12例外，先同步批准界線再分階段實作。沒有重做結案審查、安裝dependency、變更正式env／秘密、啟用服務、付費呼叫、提交、推送、部署或模式切換。[決策批准矩陣與修訂方案](../../specs/005-api-protection-access-modes/readiness-decisions.md)只承認使用者明列子範圍，不把原提案整列批准。

### 完成／部分／受阻

| 狀態 | Task／子範圍 | 本次成果 |
| --- | --- | --- |
| 本機完成；正式仍部分 | T010～T019／T138 OAuth state與Session | D06本機composition注入24h絕對Session、5min單次state、過期後24h清理；state增加同slot sorted expiry index，原子create／consume／硬批次cleanup，Redis TIME驗證到期、重跑及競態；未建立排程或正式flow |
| 本機部分 | D17／T025～T054／T136 | 共用核准policy、固定60s共享limiter、HMAC去識別化、可信Retry-After；六HTTP拒絕boundary接注入rate與有界JSON／multipart／PCM／影像port；移除120s通用lease。其他入口正式限流接線、成功descriptor與HTTP成功結算仍未完成 |
| 本機完成；正式仍部分 | T027／T037／T045／T073／T074／T099～T105 | 共用30s freshness、不晚於authority reset、offline／pagehide／pageshow／晚到；map eligible DTO含可信resetAt，缺失不掛圖；29999／30000ms卸載與不自動Places／付費POST |
| 本機完成 | T128 | 固定16kHz mono16-bit PCM WAV、60s／960000samples、取消釋放、晚到media取消、unsupported明示文字替代；自動停止不自動轉錄 |
| 本機完成 | T129 | 保留原裁切座標，canvas送出副本最長邊2048、≤3MiB；失敗保留原圖；最壞JPEG JSON恰4194373B與3MiB+1拒絕 |
| 本機完成 | T076 | D12批准80%後端唯讀提示與測試，不變更授權或額度 |
| 本機完成；正式仍部分 | T032～T035／T134／D16 | 15s tile lease、8s execution、5s settlement、2s dispatch及1MiB；原子reservedAt／lease佐證；1999ms允許、2000／2001ms保守uncertain。REST整體2s期限與1MiB回應，忽略abort或取消掛住仍有界 |
| 待審／受阻 | D01／T130、D07／D08／T139、T142／T147 | 完整request文字量測及有限明細／uncertain封存／最小防重放／HMAC退役方案已交；不採新成本或保存輪替值，不建立待審狀態查詢／申請producer |

只新增勾選完整本機T076／T128／T129。含正式證據或未建整合的T019／T134／T136／T138／T142／T147仍不勾；本機fixture通過不等於整項驗收。

### D01與D07／D08修訂交付

- D01：相同文字builder接入保留的assistant／photo-translate helper，維持原字串；分離固定prompt4096B、knowledge16384B與輸入。實測travel固定875B、包裝36B，最大合法現有文字20295B；photo最大7157B，OCR instruction627B。23516B容量候選及另加100的23616假設**不是**token／成本批准；撤回24100作上界。尚缺tokenizer、message框架、影像detail／tiles／費率、output cap與版本證據，合法輸入也不啟用成功handler。
- D07／D08：詳細記錄有限保存期限待定；uncertain原窗口占用守恆、可信對帳／封存；刪明細前原子最小tombstone，不能刪索引讓舊請求再取得grant。另待審可驗證退役epoch／時效請求屏障，以及current／verify-only／retired金鑰生命週期。沒有批准90／180天保存或90天輪替，未套正式設定。
- OAuth `expiresAt`是失效時間，實際清除時間取決於未批准觸發方式。sorted expiry index硬批次清理不使用SCAN COUNT提示當界線；尚未建立正式存量index遷移或scheduler。

### 修改清單

以下是相對本次469檔起始SHA-256，而不是把既有dirty worktree全部算成本輪成果；完整逐檔雜湊及差異保存於本session Safety JSON。

- 修改44檔：
  - `api/_lib/`：admin-redis-store、audio-pcm、paid-endpoint-boundary、protected-endpoint-pipeline、quota-engine、redis-oauth-state-store、redis-quota-script、redis-rest-transport、redis-tile-store、self-service-endpoints、tile-proxy-pipeline；另修改`api/assistant.ts`與`api/photo-translate.ts`。
  - 005：spec、plan、tasks、UX、readiness-decisions、data-model、research、quickstart，以及admin／auth／error／map／protected五份contracts；本evidence。
  - `src/`：useAccessQuery、usePaidAccessQuota、access-api、access types、NearbyScreen、recorder、RegionSelector、VoiceInputModal；NearbyScreen／nearby-access／NearbyEmergencyJourney三份測試。
  - `tests/`：admin-overview-policy、map-quota-gate、redis-oauth-state-store、redis-tile-store、005-local-protection E2E、lua-redis-harness。
- 新增16檔：
  - [核准policy](../../api/_lib/local-protection-policy.ts)、[本機composition](../../api/_lib/local-protection-adapters.ts)、[共享limiter](../../api/_lib/redis-rate-limiter.ts)、[bounded reader](../../api/_lib/bounded-request.ts)、[input validator](../../api/_lib/paid-input-validation.ts)、[相同文字builder](../../api/_lib/upstream-text-inputs.ts)。
  - [freshness policy](../../src/hooks/accessFreshness.ts)、[image payload](../../src/services/image-payload.ts)。
  - VoiceInputModal、useAccessQuery、image-payload、recorder-pcm四份src測試；approved-local-identity、paid-input-boundaries、redis-rate-limiter、upstream-text-inputs四份API測試。

### 本輪命令與結果

階段selectors有重疊，不能加總成唯一tests。中途失敗及修正也保留：

| 命令／範圍 | 實際結果 |
| --- | --- |
| OAuth相關3檔（09:26:41） | 57 tests PASS，2.96s |
| 清理／rate／lease／authority5檔（09:28:43） | 114 tests PASS，7.92s；同批型別曾因policy literal過窄失敗，已修正 |
| freshness／map／UI7檔（09:30:40） | 1 fail／52 pass；修通用錯誤文案及跨await visibility型別 |
| input／prompt／freshness7檔（09:33:40） | 1 fail／128 pass；完整builder包裝實測36B，不是人工估33B；修公式與斷言 |
| PCM／image／translation／photo／prompt／boundary7檔（09:35:55） | 83 tests PASS，11.13s；app及相關strict型別exit0 |
| Session／admin／rate／OAuth4檔（09:37:36） | 59 tests PASS，4.72s；strict型別exit0 |
| tile／REST／mapbudget／identity／prompt5檔（09:39:25） | 26 tests PASS，7.75s；strict型別exit0 |
| `vitest.cmd run --maxWorkers=1 --pool=forks` 最終重跑（09:48:31） | **95 files／1137 tests PASS**，131.10s，exit0；包含最後decoder尺寸2048／2049及明確非法解碼null拒絕測試 |
| `tsc.cmd -b`；`node node_modules\typescript\bin\tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --jsx react-jsx --types vitest/globals,node --skipLibCheck`＋全部api／tests/api／support／pwa `.ts` | 最後測試修改後兩者exit0；不建立暫存config或.vscode |
| `npm run build` | exit0，Vite86 modules；Playwright最終重跑亦由既有webServer重新build |
| `playwright.cmd test --config=playwright.config.ts 005-local-protection.e2e.ts` 最終重跑 | **12 passed，16.0s，exit0**；初次也12 passed，但發現未mock quota引發localhost代理拒絕，已補API fixture後重跑，最終無proxy error |

IDE對api／src／tests無diagnostics。Vitest的六則`HTMLMediaElement.pause()`是jsdom限制，沒有失敗，但不是實體browser音訊證據。E2E全部非localhost請求abort、API明列fixture；不能當真實身分、供應商或CDN驗收。

### 結束Safety與真正未決事項

- Git起始／結束：master；HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`不變；**37→40 tracked修改、130→146 nonignored untracked、staged 0→0**。起始469檔全部保留、missing0，結束485檔；本輪44修改／16新增。計數使用`status --porcelain=v1 --untracked-files=all`，不以聚合目錄數代替檔案數。
- baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`、peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`及PDF SHA-256 `0A3D951ECED180AF04B665CADF0D92B09A71861B563E1A84CF6A1EFE5A552FFB`不變。未修改001～004、package／lock／env／production價表或requirements markers；`.vscode/`仍不存在。
- 本session `206ba26d-c25c-4a77-a85b-e3fbf566d507/files`保存start／end manifest、Safety JSON與final-vitest／typecheck／build／e2e logs。結束`git diff --check`exit0、relative links broken0、147個Task ID且唯一147、requirements仍71 checked／12 unchecked；extensions.yml不存在，無後置hooks。4174無殘留listener。
- 部分證據：Lua interpreter＋Redis/cjson／TTL替身不是跨process真Redis；可信影像decoder僅port，缺實際decoder仍503；WebAudio ScriptProcessor為既有API且已deprecated，真實16kHz／mic可行性待T133；cross-tab尚無broadcast producer，只有30s及focus／pageshow失效，不宣稱即時跨分頁撤銷。
- 真正未決：D01完整成本證據／數值；D07／08保存、防重放、HMAC生命週期；D09 registry7天；D10／11具體新增契約；D13精確套件／decoder／JWT依賴；D14外部操作／正式秘密／排程；素材權利、CDN、真實OIDC／Redis／provider與browser音訊驗收。

已完成本次可執行本機範圍後停止。production六端點`live:false`、Places-only成功限制與speech S1不變；**功能005、真實服務與部署仍非READY**。下方均為歷史，不沿用其中數量或待批准描述作本輪狀態。

## 2026-10-07 08:58接手：剩餘Readiness決策包（本輪最新）

本輪沿用L1～L5本機授權，使用繁體中文；已讀最新Tasks／Plan／research／data-model相關保存條款／auth、error、admin、map contracts與quickstart。不重開七檔結案／既有批准，不採未批准參數。下節85檔1038、9檔74、build／11E2E均是歷史報告，沒有冒充本輪結果。

### 起始Safety

- `check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks`重新執行，FEATURE_DIR＝005；extensions.yml不存在，前後hooks略過。
- requirements83／71／12，既有例外沿用；checklist markers不修改。
- master、HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`、staged0；37 tracked修改／125 nonignored untracked。保存464檔起始SHA-256 manifest於本session；所有既有成果保留。
- baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`，peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`；PDF SHA-256 `0A3D951ECED180AF04B665CADF0D92B09A71861B563E1A84CF6A1EFE5A552FFB`。
- `.git/`、`.github/`、`.specify/`、`specs/`存在；`.vscode/`不存在且不建立。既有ignore／private package足夠，不建立新publishing／container／formatter工具或設定。

### 本輪獨立完成工作

| 任務 | 成果 | 證據界線 |
| --- | --- | --- |
| T001／T007／T008 | [隔離環境、等效測試骨架、runner檢查表](../../specs/005-api-protection-access-modes/checklists/isolated-environment.md) | 文檔盤點，不是新runtime或全情境PASS；既有Playwright只選e2e.ts |
| T002 | Plan §10.2最新決策狀態與集中包連結 | 保留架構／額度批准，外部／新dependency／秘密／部署仍未授權 |
| T003～T005 | research最新六端點、SW、Geoapify／Places現況附錄 | 明確區別POST拒絕boundary與保留executeUpstream；不宣稱六handler成功已接線 |
| T006 | [測試身分矩陣](../../tests/fixtures/005-identity-matrix.md) | 規劃内容，不建立帳號／fixture程式／秘密 |
| OAuth state／T010～T018／T019子範圍 | [redis-oauth-state-store.ts](../../api/_lib/redis-oauth-state-store.ts)與[20個tests](../../tests/api/redis-oauth-state-store.test.ts) | 沿用已批准OAuthStateStore port，單次EVAL create／consume、Redis TIME期限、同hash-tag；不注入新預設期限、不接正式factory、不建立resource／秘密；未使用state的清理仍待保存／排程契約 |
| Readiness交付 | [17項集中決策與剩餘任務表](../../specs/005-api-protection-access-modes/readiness-decisions.md) | 每項具建議值、依據、取捨、影響Tasks、批准後工作與驗證；未採用任何候選值 |

只勾完整T001～T008文件任務；T076／T136／T142／T147等整項仍保持未勾。仍有可續作的本機證據索引／整理與待契約批准後程式工作，不宣稱全部本機實作完成，也不把全部未建工作歸因於外部。

### 本輪實際驗證

- `runTests`指定三個absolute paths仍回No tests found；改用已安裝CLI，沒有安裝工具。
- `.\node_modules\.bin\vitest.cmd run src\service-worker.test.ts tests\api\paid-handlers-rejection.test.ts tests\api\oidc-provider.test.ts --maxWorkers=1 --pool=forks`：**3 files／74 tests PASS**、exit0；09:01:34開始、3.22 s。覆蓋SW API排除、六handler拒絕與OIDC library adapter防護；不是上一輪管理9檔74。
- 已查本機Node v24.19.0、Lua5.4.2工具存在、redis-server／redis-cli未找到；這只供隔離方案依據，不代表正式runtime或Redis服務。
- OAuth state RED：09:08:59新增測試缺module，1 suite fail／0 tests；建立adapter後09:09:25整合4檔71tests，2 fail／69 pass。失敗是harness以`fixtureError`回傳而不是throw，改為精確碰撞／到期錯誤及不覆寫／不寫入斷言，沒有放寬程式防護。
- 最終`.\node_modules\.bin\vitest.cmd run tests\api\redis-oauth-state-store.test.ts tests\api\oidc-flow.test.ts tests\api\oidc-provider.test.ts tests\api\redis-shared-store.test.ts --maxWorkers=1 --pool=forks`＝**4 files／74 tests PASS**，09:11:39／3.69s；state檔20tests，包括實際Lua interpreter／替身authority兩adapter writer合計只消耗一次、expiry等值、collision、malformed輸入／回應、無內容audit、create／consume timeout不重試。不是真實跨processRedis。
- `.\node_modules\.bin\tsc.cmd --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --types vitest/globals,node --skipLibCheck tests\api\redis-oauth-state-store.test.ts`與`.\node_modules\.bin\tsc.cmd -b`均exit0；前者涵蓋新backend、test與引用helpers，無暫存config。
- 本輪修改文件與一個不預設期限／未接正式factory的adapter；沒有重跑全套／build／E2E，也沒有真實Redis／OIDC／CDN／provider證據。3檔74與4檔74含重疊selectors，不能宣稱148個唯一tests。

### 結束Safety與文件驗證

- 起始464檔全部保留、missing0；結束469檔，本輪7檔修改／5檔新增。37 tracked修改仍為既有起始數，nonignored untracked由125至130，staged0；branch／HEAD／baseline tag object與peeled commit／PDF SHA-256均不變。
- 本輪modified：本evidence、005 Tasks／Plan／research／data-model／auth contract／pipeline-readiness-report。新增：集中decision包、isolated-environment、identity矩陣、Redis OAuth state adapter及其test。未改其餘application、package／lock、env、部署設定、production價表、001～004或requirements。
- 文件relative links broken0；決策表17列；Tasks147個ID且唯一147；requirements仍71checked／12unchecked。IDE對新增程式／測試與相關文件無diagnostics；`git diff --check`exit0。沒有重做Analyze或宣稱正式Gate通過。
- 本session `C:\Users\geste\.copilot\session-state\18657b36-ee62-4b20-aaa7-505c782a6cd8\files`保存`005-readiness-start-manifest.json`／`005-readiness-start-safety.json`與`005-readiness-end-manifest.json`／`005-readiness-end-safety.json`；記錄逐檔SHA-256與Safety，不把manifest當測試log。extensions.yml結束仍不存在，無後置hooks；沒有自建暫存repo config需要清理。

集中包交付後停止；不安裝、新建服務、設定正式secret／env、付費呼叫、提交／推送／部署／模式切換。功能005與正式Readiness仍非READY。

## 2026-10-06～07 接續本機執行（本節優先於下方前輪紀錄）

沿用使用者明確確認仍有效的 L1～L5 本機授權；不重新批准已結案批次、不重新展開全量 Analyze。下方原有 **73 files／900 tests／11 E2E** 是上一輪結果，不當成本輪證據。正式功能、成本上界、服務與部署仍非 READY。

### 起始 Safety 與契約核對

- 已載入 `speckit-implement`，重新執行 `check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks`，FEATURE_DIR＝005；extensions.yml 不存在，無前後 hooks。
- requirements 唯讀統計仍為 83／71／12；沿用既有例外、不修改 checklist markers。
- 起始 master、HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`、staged 0；37 tracked 修改與85 nonignored untracked成果全部保留。保存424檔起始manifest／SHA-256於本輪session。
- baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`、peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`；PDF SHA-256仍為 `0A3D951ECED180AF04B665CADF0D92B09A71861B563E1A84CF6A1EFE5A552FFB`。
- `.git/`、`.github/`、`.specify/`、`specs/` 均存在；`.vscode/` 不存在且不建立。既有 ignore 已涵蓋 node_modules、build、env、local tooling；private package不增加 npm publishing設定。
- Session Cookie是隨機opaque ID＋HMAC，不含subject／role。有效Cookie每次查store，logout撤銷store紀錄；付費資格另逐請求查驗，簽章不授予資格。
- 管理週鍵差異確認只是格式：統一 `YYYY-Www`，保留ISO週年、Asia/Taipei週一00:00；拒絕舊suffix／過去或未來週／延長resetAt。已同步Spec／Plan／管理契約，沒有自行改重置政策。

### 已補本機程式與證據邊界

| 範圍 | 本機程式 | 限制 |
| --- | --- | --- |
| Redis authority | 業務Lua、SharedStore adapter、同slot registry/users/Session、Redis TIME台北窗口、G與日週、版本與摘要雙封鎖、原窗口結算、uncertain清理 | 真實Redis server/sandbox／跨process／TTL與供應商證據未執行 |
| 最小REST transport | 單次EVAL fetch、有界回應、timeout、禁止redirect/retry；設定由可信options注入 | 沒有設定正式URL/token、啟用資源或連外 |
| 精確儲存 | registry保留原JSON（空陣列不被cjson改形）；業務JSON精確保存safe-integer micro-USD | 沒有降低週追加政策上限或自訂正式保存期 |
| Session shared store | 逐次lookup、create/revoke、明列保存參數的過期清理；首次登入初始化最少identity，不自動核准或代提申請 | 正式TTL／輪替未批准，未建立清理排程 |
| 圖磚 shared writer | 120/min、1,000/day、9,600 quarter-credit/day、7天cache與清理、固定style key、共享flight/coalescing、等待者只讀、uncertain不退款／不接管 | lease／等待／bytes上限參數化；沒有Geoapify/CDN實測 |
| OIDC／額度UX | 可注入通用library provider adapter、配置／claims防護、失敗不建Session；stale/offline/bfcache/晚到／429 scope／409不重送 | 不自製JWT crypto取代核准library；真實library批准／接線與外部驗證未完成 |
| 管理API／audit／UI | 清單／詳情／兩類既存review queue／核准與切級及撤銷／週追加及撤銷／audit／完整管理UI；M1可信來源、逐請求Session／CSRF／冪等，資格與追加跟audit同次EVAL，與engine同users authority | 申請producer尚未實作，待契約核定；正式subject／保存與nearLimitPercent待批准，不設80%正式預設 |

### 本輪已實跑階段命令

所有 Vitest selectors皆使用 `.\node_modules\.bin\vitest.cmd run … --maxWorkers=1 --pool=forks`。原生unit-test tool未辨識測試，改用既有CLI，不安裝工具。

| selectors／型別命令 | 實際結果 |
| --- | --- |
| `tests\api\redis-shared-store.test.ts tests\api\redis-atomic-transport.test.ts`；`tsc -b` | 2 files／14 tests PASS，型別exit0 |
| `redis-shared-store.test.ts redis-tile-store.test.ts map-quota-gate.test.ts` | 修補後3 files／26 tests PASS；同時編輯中的UX hook曾有TS2367，子範圍修補後型別通過 |
| `redis-shared-store.test.ts redis-tile-store.test.ts reservation-reconciliation.test.ts` | adapter→engine修補後3 files／25 tests PASS；同時編輯中的管理hook曾有.ts內JSX解析錯誤，後續專案型別通過 |
| `redis-shared-store.test.ts redis-tile-store.test.ts atomic-registry-g.test.ts map-quota-gate.test.ts` | 修補後4 files／69 tests PASS，含真正第9,600／9,601筆門檻 |
| `redis-shared-store.test.ts redis-tile-store.test.ts reservation-reconciliation.test.ts`；`tsc -b` | 精確整數／JSON修補後3 files／29 tests PASS，型別exit0 |
| `redis-shared-store.test.ts redis-tile-store.test.ts` | 大型合法週追加完整MAX_SAFE_INTEGER驗證後2 files／26 tests PASS |
| `redis-shared-store.test.ts redis-tile-store.test.ts session.test.ts` | 首次登入不核准整合後3 files／34 tests PASS |
| 身分／UX子範圍合併runner | 7 files／92 tests PASS；`npx tsc --noEmit --pretty false` exit0 |
| `src\hooks\usePaidAccessQuota.test.tsx` | TS2367修補後11 tests PASS |
| `redis-tile-pipeline.test.ts redis-shared-store.test.ts redis-tile-store.test.ts` | 完整共享Session／quota／tile adapter管線3 files／27 tests PASS，並發上游只一次、304重驗、撤銷403與登出401 |
| `npm run build` | exit0；84 modules、production build完成，不部署 |
| `playwright test --config=playwright.config.ts '005-local-protection.e2e.ts'` | 本輪重新實跑11 PASS，14.6秒；API mock、外部網路阻擋、SW controller與App Shell cache存在後檢查API cache |
| 首次全套 `vitest run --maxWorkers=1 --pool=forks` | 84 files／1 fail，1020 tests／1018 PASS／2 FAIL，116.67秒；非最終結果，失敗為跨日的quota UI fixture |
| 管理最後整合focused：`admin-atomic-store.test.ts admin-redis-integration.test.ts admin-endpoints.test.ts admin-self-quota.test.ts` | 4 files／43 tests PASS；管理test型別修補後擴大型別exit0 |
| 整合全套 `vitest run --maxWorkers=1 --pool=forks`（提示門檻最後修補前） | 85 files／1038 tests PASS，124.01秒；本輪實跑，不沿用73／900 |
| `tsc -b`；`tsc -p tsconfig.005-continuation-check.json --pretty false` | 均exit0；後者含api/src/全部tests/pwa，不只src |
| 最後 `npm run build`；隔離Playwright `005-local-protection.e2e.ts` | build exit0、84 modules／608ms；11 PASS、13.2秒，不部署 |
| 最後提示門檻修補：`admin-overview-policy.test.ts admin-redis-integration.test.ts admin-endpoints.test.ts admin-atomic-store.test.ts`（子範圍） | 4 files／37 tests PASS；全部api/tests型別exit0 |
| Parent最後管理合併回歸：上述四檔＋`admin-self-quota.test.ts admin-auth.test.ts admin-dashboard-permissions.test.ts src\screens\admin\admin-ui.test.tsx src\services\admin-api.test.ts` | **9 files／74 tests PASS**，08:41:46開始、65.82秒；缺失／非法門檻、差一micro／MAX_SAFE_INTEGER／唯讀、其他管理操作、跨writer與UI完整相關範圍 |
| 最後修補後 `tsc -b`；`tsc -p tsconfig.005-continuation-check.json --pretty false` | **兩者exit0**；設定原檔另存session，已刪repo內自己建立的暫存config |

最後修補僅影響管理Lua／adapter唯讀提示與測試，未改frontend bundle、圖磚／quota writer或六handler；因此在完整整合1038與build／11 E2E之後，重跑相關管理9檔／74及兩種型別，不把先前全套宣稱為修補後再次全跑。jsdom既有HTMLMediaElement.pause未實作警告不代表真實音訊驗證。

本輪原始log與逐檔SHA-256均保存在`C:\Users\geste\.copilot\session-state\415bb037-fad4-47f8-ad17-ea7d0e845bb5\files`：`005-unit-regression-final.log`、`005-build-final.log`、`005-e2e-final.log`、`005-admin-final.log`、`005-types-final.log`、`005-typecheck-config.json`、`005-start-manifest.json`、`005-end-manifest.json`、`005-changed-files.json`與`005-final-safety.json`。文件中的前輪數字保留為歷史，沒有沿用成接續執行結果。

### 結束 Repository Safety Guard 與逐檔修改清單

- 起始424檔全部存在，結束464檔；相對本輪起始 **26檔修改／40檔新增／0檔遺失**。Git worktree為37 tracked修改／125 nonignored untracked、staged0；沒有reset、clean、覆寫或刪除既有成果。
- master／HEAD／baseline object及peeled commit／005 PDF SHA-256均與起始相同；001～004、package／lockfile／env example／deployment／production價表／README等受保護起始檔變更0。
- `git diff --check` PASS；`.git/`、`.github/`、`.specify/`與`specs/`保留，未建立`.vscode/`。
- 自建`tsconfig.005-continuation-check.json`已單檔刪除，原設定保存session；`.specify/extensions.yml`仍不存在，前／後hooks依規則略過。
- 以下完整逐檔清單以本輪起始manifest為比較基準，不把前輪既有成果算成新增。原始SHA-256對照與新增檔hash見[本輪逐檔JSON](C:/Users/geste/.copilot/session-state/415bb037-fad4-47f8-ad17-ea7d0e845bb5/files/005-changed-files.json)及[結束Safety JSON](C:/Users/geste/.copilot/session-state/415bb037-fad4-47f8-ad17-ea7d0e845bb5/files/005-final-safety.json)。

**26檔修改**

```text
api/_lib/admin-auth.ts
api/_lib/oidc-config.ts
api/_lib/oidc-flow.ts
api/admin/overview.ts
docs/verification/005-local-implementation-evidence.md
specs/005-api-protection-access-modes/checklists/analyze-report.md
specs/005-api-protection-access-modes/checklists/pipeline-readiness-report.md
specs/005-api-protection-access-modes/contracts/admin-dashboard-contract.md
specs/005-api-protection-access-modes/contracts/auth-and-session-endpoints.md
specs/005-api-protection-access-modes/contracts/map-access-contract.md
specs/005-api-protection-access-modes/data-model.md
specs/005-api-protection-access-modes/plan.md
specs/005-api-protection-access-modes/quickstart.md
specs/005-api-protection-access-modes/spec.md
specs/005-api-protection-access-modes/tasks.md
specs/005-api-protection-access-modes/ux-ui-design-handoff.md
src/App.tsx
src/screens/PaidFeatureQuotaBanner.tsx
src/screens/access-ui.test.tsx
src/screens/admin/AdminOverviewScreen.tsx
src/services/access-api.ts
src/services/paid-access.test.ts
tests/api/admin-dashboard-permissions.test.ts
tests/api/oidc-config.test.ts
tests/api/oidc-flow.test.ts
tests/api/session.test.ts
```

**40檔新增**

```text
api/_lib/admin-endpoints.ts
api/_lib/admin-principal.ts
api/_lib/admin-redis-script.ts
api/_lib/admin-redis-store.ts
api/_lib/admin-store.ts
api/_lib/oidc-provider.ts
api/_lib/redis-quota-script.ts
api/_lib/redis-rest-transport.ts
api/_lib/redis-session-store.ts
api/_lib/redis-shared-store.ts
api/_lib/redis-tile-store.ts
api/admin/approvals.ts
api/admin/audit.ts
api/admin/review-queue.ts
api/admin/top-ups.ts
api/admin/users.ts
api/admin/users/[identitySubject].ts
src/hooks/usePaidAccessQuota.test.tsx
src/hooks/usePaidAccessQuota.ts
src/screens/admin/admin-ui.test.tsx
src/screens/admin/AdminAuditScreen.tsx
src/screens/admin/AdminDashboardScreen.tsx
src/screens/admin/AdminMutationPanel.tsx
src/screens/admin/AdminReviewQueueScreen.tsx
src/screens/admin/AdminUserDetailScreen.tsx
src/screens/admin/AdminUserListScreen.tsx
src/screens/admin/useAdminData.tsx
src/services/admin-api.test.ts
src/services/admin-api.ts
tests/api/admin-atomic-store.test.ts
tests/api/admin-auth.test.ts
tests/api/admin-endpoints.test.ts
tests/api/admin-overview-policy.test.ts
tests/api/admin-redis-integration.test.ts
tests/api/admin-self-quota.test.ts
tests/api/oidc-provider.test.ts
tests/api/redis-shared-store.test.ts
tests/api/redis-tile-pipeline.test.ts
tests/api/redis-tile-store.test.ts
tests/support/lua-redis-harness.ts
```

**本輪失敗與修補，不掩蓋為第一次即成功**：
- registry整合測試發現cjson重新encode會改空陣列、破壞bundleDigest；改保存原始registry JSON，adapter→engine重驗通過。
- 大型Lua fixture批次碰到interpreter的local variable上限；測試harness改共用invoke函式，實跑9,601筆後通過，沒有縮小要求門檻。
- 新增擴大型別檢查涵蓋api/src/tests/pwa；中途指出管理test fixture的literal widening／Header union錯誤，交由管理子範圍修補，不能只以src型別通過宣稱新增tests通過。
- 完整tile管線fixture首次漏掉必填tierLimits，被引擎正確拒絕；補明列已批准兩級上限，完整adapter管線重驗通過。
- 執行跨到2026-10-07後，首次全套回歸發現兩個舊quota UI fixture沒有確定時鐘，resetAt已過期而正確顯示未知額度。修補方向為固定測試時鐘，不放寬過期保護或新增正式freshness預設。

Lua是本機既有5.4 interpreter；Redis命令與cjson是明列測試替身。測試不呼叫Redis、Google、OpenAI或Geoapify，不等同正式跨writer／provider證據。

### 管理與政策界線

- 正值週追加不新設次數或累計倍數上限；金額以safe-integer micro-USD精確保存，超出可表達安全整數時明確拒絕，不截斷或降低政策上限。
- 相同冪等鍵只套用一次；不同追加累加、日上限不變。當週／ISO週年／台北週一邊界、過期或未來週與舊suffix拒絕已測。撤銷只影響後續新預留，不退款或作廢既存reserved／settled。
- 核准／切級只接受tier1／tier2；reject／revoke不得帶tier。切級／撤銷保留既有到期時間，不延長成永久；禁止任意修改expiresAt。
- 首次登入只初始化最少identity、eligibility=null。讀取／處理既存申請不等於申請提出／enqueue已完成；新增T147依賴既存管理讀取／原子處理，先核定producer契約，再實作，不先自建endpoint。
- 最後精確marker核對發現overview原採UX示例0.8，不能當正式批准值；移除固定值，改明列可信nearLimitPercent而無default，缺失／非法時只拒絕overview，其他管理讀取／異動不受阻。提示以安全整數計算，不用於額度或資格授權；fixtures80不是正式設定，T076保持部分。
- Production價表六端點仍live:false，沒有放寬Places-only成功限制；所有fixture／mock／注入參數均不作正式服務、最大成本／輸入、保存期限或freshness預設。

### 剩餘項目：依阻礙種類拆分，不歸咎全部外部證據

| 種類 | 具體剩餘工作／決策 |
| --- | --- |
| 尚未實作 | 真實OIDC JWT/JWKS library binding（先批准既定library dependency）；T147申請producer／enqueue及提出申請UI（先核定契約）；受未批准政策限制的其餘合法成功handler／T142狀態查詢；正式清理排程／對帳接線須先核定參數與來源 |
| 缺外部證據 | 真實Redis sandbox／TIME／TTL／跨process writers與故障證據；OIDC token／JWKS整合；Geoapify／CDN／304／HAR；PCM／vision真實usage與輸入成本上界；正式示意圖原檔／授權與最佳化 |
| 缺批准參數／契約 | A1／A3／A4／A5／A7正式成本／輸入與穩定參數；逐端點lease與圖磚lease／等待／bytes；Session與audit保存、HMAC輪替、quota freshness、管理nearLimitPercent；T142查詢／T147申請producer契約 |
| 實質契約衝突 | 本輪優先核對未發現：週鍵只是格式差異且已同步，不改台北週一政策。不代表重新全量審查或宣稱全功能零衝突 |

上述批准／外部證據只停止其依賴範圍，已批准本機adapter、原子管理與共享tile等程式已接續完成。005／正式服務／成本上界／部署仍非READY；本輪未新增dependency、未啟用外部服務、未設定正式秘密、未付費呼叫、未提交／推送／部署或切正式模式。

---

## 前輪歷史證據（保留，不作本輪結果）

**日期**：2026-10-06。**結論**：部分完成；功能 005、真實整合與部署均非 READY。本文件只記錄本輪實際執行，不把 mock／port／transport 當成正式服務完成。

## 授權與 Safety

- 使用者明確批准依 Plan §14、Tasks Phase 12、統一 Readiness／Analyze 進入本機 `speckit-implement`，連續執行 L1～L5。已載入本機技能、執行 prerequisites，FEATURE_DIR 為 005；extensions.yml 不存在，無前後 hooks。
- requirements 83 項：71 已勾、12 未完成；使用者確認保留 12 項，繼續已授權本機工作。未變更 checklist markers。
- 開始：`master`、HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`；tracked 修改只有 `src/types/error.ts`，47 個 nonignored untracked。起始 386 檔 manifest／SHA-256 已保存於本機 session。
- baseline tag object：`073f04ffd505a92c516f3b3fbfdd0a87088472e8`；peeled commit：`fb09a41182bcc639a9335adbd0e1f84405a1bba7`。
- `plan.pdf` SHA-256：`0A3D951ECED180AF04B665CADF0D92B09A71861B563E1A84CF6A1EFE5A552FFB`；保留、不重產。
- 結束：同一 `master`／HEAD／baseline；**37 個 tracked 修改、85 個 nonignored untracked、staged 0**。起始 386 檔全部存在，新增 38 檔後 424 檔；57 個起始檔有本輪修改，沒有刪除起始檔或遺失原 47 個 untracked 成果。
- 結束 Safety Guard 與 `git diff --check` 通過；dependencies／lockfile／`.gitignore`／`.env.example`／部署設定／production 價表與 001～004 歷史 artifacts 未改。暫存型別 config 已移除，extensions 與 `.vscode/` 仍不存在。逐檔 end manifest／SHA-256、完整修改清單保存於本機 session，不提交。
- 未安裝 dependency、啟用服務、建立正式秘密／環境值、呼叫付費 API、提交、推送、部署或切正式模式。未建立 `.vscode/`；既有 local-only tooling 政策保留。

## 分階段結果

| 階段 | 已完成且驗證的本機子範圍 | 部分完成／尚未實作／正式限制 |
| --- | --- | --- |
| L1／T143～T145 | 全集合 bundle、SHA-256 digest、單調 revision、R_max／G；memory 原子資格／追加／日週／G／R_e 與 evidence；改價／停用／雙封鎖、追加／撤回／資格撤銷排序、G 與 R_e 邊界、跨日／週／效期、錯誤 evidence、timeout 不退款／不再 grant | 37 項新原子矩陣是 memory evidence，不是跨 writer Redis。T019 只有單次 EVAL transport；完整業務 Lua、SharedStore adapter、TIME／TTL、T138 清理 adapter 尚未實作，不得全歸因於缺少外部環境 |
| L2／T009～T018、T135 | Google 設定介面與名稱；PKCE／state／nonce／claims mock；signed opaque Session、逐次查驗／撤銷／登出、參數化 TTL／金鑰／clock／store；SDK `maxRetries:0`、429／5xx／timeout／斷線單次 fetch | 真實 JWT 簽章／JWKS provider 與共享 Session store 尚未實作；正式 TTL／輪替／lease 未批准；未宣稱六端點正式成功／計費上界證明。T009 完成，其他整項保留未勾 |
| L3／T025～T028、T036 等、T146 | 六個真實 `POST` export 接拒絕 boundary；未配置 503、method mismatch 405；注入 Session／admission／quota 可驗證 401／403／503，拒絕上游零次；自身 quota／map query factories | 完整合法成功 pipeline 尚未完成，沒有移除 Places-only 限制；原內容邏輯為非 HTTP `executeUpstream`。單元實際呼叫 handler 函式，不是已部署 Vercel HTTP 證據 |
| L4／T067～T106 | 可信 `isAdmin(subject)`、逐請求權限／CSRF 前置、401／403 不外洩；overview 白名單 projection 與獨立 UI；自身估算額度、stale／offline／晚到回應防護；六付費 client Public 防送出、照片內容保留 | users／detail／review／audit、原子 approval／top-up／audit 與完整 UI 尚未實作；不是單純外部 gate。週追加 HTTP 週鍵存在 artifact 差異，受影響子範圍停止。完整耗盡／below_floor 入口 UX 未完成；未用顯示金額作授權。T088 完成 |
| L5／T032～T064、T107～T118、T134 | eligibility 限制不掛地圖；明確定位／搜尋前重查；同源 tile proxy 可注入管線、cache hit／304 重驗、uncertain 不重試；靜態示意 4:3／16:9、固定 alt／標示、同源 fixture／破圖 fallback；SW 先排除 API navigation；11 個本機瀏覽器情境 | tile shared counter／cache／coalescing／credits writer 尚未實作；真實 Geoapify／CDN／304／HAR 未驗證；正式原檔與授權尚缺。現有示意 SVG 不是真實地圖或正式素材 |

**整項 checkbox**：只新增勾選 T009、T088；原已勾項與 requirements 12 未完成標記不變。T143～T146 等包含未完成工作者保持未勾，不能把本機子範圍 PASS 等同整項完成。

## 實際命令與結果

使用既有已安裝工具；原生 unit-test tool 無法識別測試後改用既有 Vitest CLI，未安裝替代 runner。

| 命令／階段 | 實際結果 |
| --- | --- |
| L1 registry／quota 合併 selectors＋型別 | 5 files／190 tests PASS，專案及 API／測試型別 exit 0 |
| L2 Session／OIDC／SDK 合併 selectors | 3 files／15 tests PASS |
| handler／pipeline 合併 selectors | 4 files／150 tests PASS |
| admin／UI／error-envelope 合併 selectors | 4 files／24 tests PASS |
| L5 map／SW 合併 selectors | 6 files／81 tests PASS；後續修正 test literal 型別並重驗通過 |
| transport／Session／map／SW selectors | 5 files／60 tests PASS、tsc exit 0；該 shell 最後查不存在的 redis tools 使 exit 1，不是測試失敗 |
| 大合併 `vitest run tests\api api\_lib` 與相關 UI／map／SW selectors | 40 files／601 tests PASS、tsc exit 0（本輪中間版本） |
| `.\node_modules\.bin\vitest.cmd run --maxWorkers=1 --pool=forks` | 最新最終程式版本 **73 files／900 tests PASS**，119.05 秒；jsdom 的 HTMLMediaElement pause 未實作警告不視為實際音訊驗證 |
| `.\node_modules\.bin\tsc.cmd -b` | exit 0 |
| `.\node_modules\.bin\tsc.cmd -p tsconfig.005-local-check.json` | exit 0；涵蓋 api、src、tests/api、support、fixtures、pwa；暫存 config 結尾移除 |
| `.\node_modules\.bin\playwright.cmd test --config=playwright.config.ts '005-local-protection.e2e.ts'` | **11 PASS**，18.7 秒；runner build／preview 成功，API fixture＋外部網路阻擋 |
| Public／照片／map／OIDC focused 回歸 | 9 files／107 tests PASS、擴大 tsc exit 0；後續新增矩陣及照片案例納入最終 900 tests |

以上反斜線 selectors 為 Windows 檔案路徑；Playwright 用 basename，避免 Windows 反斜線被 regex selector 當 escape。

### 已失敗、修補後重驗的真實紀錄

- 初次 Vitest threads worker timeout：改為既有 forks／單 worker，後續驗證通過。
- 純 server Session／SDK tests 在 jsdom 遇跨 realm／browser SDK 限制：使用 Node test environment，沒有啟用 dangerouslyAllowBrowser。
- Playwright 完整 Windows path selector 無匹配：改 basename selector，未下載瀏覽器。
- 強化 SW 驗證第一次 7 FAIL／1 PASS：controller 接管觸發既有 reload，使 evaluate context 消失；改用可跨 navigation 等待的 waitForFunction，重跑通過。
- 固定正式 alt 後 1 個舊示意圖 assertion 失敗：更新為已批准文字，重跑通過。
- 照片首次新增提示造成 3 個 duplicate-alert 回歸：改為既有 OCR／翻譯錯誤區塊內呈現、保留原一般化 provider 文案，重跑通過。
- 改價 fixture 首次沿用同版本造成 503：遵守既有版本綁定，改價同時換版本，沒有放寬核心防線。
- 新 time-evidence 變造測試找到 memory fixture 回傳 evidence 共用保存參照：回傳 clone，避免變造污染 authoritative fixture；最終全回歸通過。

### 瀏覽器證據範圍

- 7 種受限 map reason：零 Places、tile proxy、Geoapify；focus／reload 後仍受限；手機 390px 的實際框比 4:3、桌面 1280px 為 16:9。
- SW 必須有 controller 且 Cache Storage 確實包含 `/` App Shell，再檢查 API entries 為空；不是空 cache 的 vacuous PASS。
- 管理者 fixture 403 不顯示統計，一般 UI 沒有管理入口。
- Public 401／403／503：保留輸入、付費 POST 零次、focus／online 不補送；401 提供受控登入入口。
- 全部 API 為 mock；沒有真實 OIDC、Redis、Geoapify、CDN、跨裝置／Installed PWA 或付費供應商驗收。

## 修改檔案範圍

| 群組 | 路徑／用途 |
| --- | --- |
| registry／quota／pipeline | `api/_lib/{cost-registry,quota-threshold,shared-store,quota-engine,quota-validation,protected-endpoint-pipeline,error-envelope}.ts`；保留既有其他 untracked 核心 |
| SDK／Session／邊界 | `api/_lib/openai.ts`；新增 `session.ts`、`session-endpoints.ts`、`oidc-config.ts`、`oidc-flow.ts`、`self-service-endpoints.ts`、`paid-endpoint-boundary.ts`、`admin-auth.ts`、`tile-proxy-pipeline.ts`、`redis-atomic-transport.ts` |
| 真實 exports／端點 | 六個既有 handler；新增 `api/auth/*`、`api/me/*`、`api/admin/overview.ts`、`api/map/tile/[...coordinates].ts` |
| UI／狀態 | `src/App.tsx`、`screens/{HomeScreen,NearbyScreen,PhotoTranslateScreen}.tsx`、`features/nearby/{NearbyExplorer,NearbyMap,StaticTokyoMap}.tsx`、`features/photo-translate/{OcrResultPanel,TranslationPanel}.tsx`；新增 quota banner、admin overview、access types／API／hook；更新 `services/api.ts`、styles 與 error type |
| PWA | `src/service-worker.ts` 與其 tests；保留既有 offline 架構 |
| 測試 | 新增 atomic registry／SDK／Session／OIDC config＋flow／真實 handler 拒絕／admin／map／transport tests；Public client／UI／static／Playwright tests；更新 memory fixture、12 檔歷史 API 內容回歸及相關 nearby／photo tests |
| 文件 | 005 Spec／Plan／Tasks／Readiness／Analyze／quickstart／UX／五 contracts；README 本機狀態提示；本證據文件。001～004 歷史 artifacts 不修改 |

## 剩餘決策與下一步

1. **尚可本機實作、此次未完成**：完整 Redis 業務 Lua／adapter 與清理、真實 OIDC provider 程式、完整合法成功 pipeline、tile shared writers、管理讀取／原子異動／audit／相應 UI、完整受限額度入口 UX。不能聲稱本輪已完成所有可執行本機工作。
2. **契約 reconciliation**：admin 週鍵範例與 engine 窗口鍵差異；只停止受影響 HTTP 追加子範圍，未自行覆寫任一契約。
3. **既有待決值／行為**：A1／A3／A4／A5／A7、正式逐端點 lease、Session／reservation／audit 保存、HMAC 輪替、T142 查詢方式；沒有擅定值或新端點。
4. **外部證據／批准**：真實 Redis／Google OIDC／PCM／vision usage、CDN／304／HAR、正式圖片來源與授權、營運預算與資源啟用；提交／推送／部署／正式切換未授權。

本輪交付的是可重現的**部分本機實作**，不是功能 005、全部 L1～L5、真實整合或正式部署完成證明。

## 2026-10-08 Upstash 營運者提供的支援回覆及 Phase B 計量收斂

### 來源與收件資訊

- 性質：**營運者提供的支援回覆**；以下保存營運者在本輪訊息提供的完整英文原文，未聲稱由本機直接向 Upstash 驗證。
- 可取得來源：本輪營運者提供的回覆文字。本輪訊息收件時間為 **2026-10-08 16:27:19.183 +08:00（Asia/Taipei）**（對話時間資料）；Upstash 原始寄件時間、寄件者、ticket ID 未提供。沒有保存私人 Messenger 連結或秘密。
- 回覆內可公開核對連結：Upstash Developer API 文件 `https://upstash.com/docs/devops/developer-api/introduction`。回覆提及的 test DB 顯示名稱 `tokyo-mate-005-test` 不是完整帳戶識別資訊；本紀錄不含完整帳戶 ID 或其他完整帳戶識別資訊。

### 支援回覆原文

> Here is the official clarification regarding Upstash Redis Free tier metering, replication, limits, and usage reporting for your integration test.
>
> ## 1. EVAL Command Counting
>
> - **Metering Formula:** Lua scripts executed via **EVAL** or **EVALSHA** (including over the REST API) are metered using a **1 + X** formula, where **1** command is counted for the script invocation itself, and **X** is the number of internal **redis.call()** (or **redis.pcall()**) operations executed inside the script.
> - **Inner vs. Outer:** Both are counted. The outer **EVAL** invocation counts as 1 command, plus each individual command executed inside counts toward your quota.
> - **Early Returns:** Only the internal commands actually reached and executed before the return statement are metered (plus the base **1** for invocation).
> - **Errors and Failed Requests:**
>
> - Because Redis executes commands sequentially without rollback, any **redis.call()** operations completed before a runtime error or timeout are metered, alongside the base **EVAL** command.
> - Requests rejected prior to execution at the gateway level (e.g., HTTP payload exceeding the 10 MB request size limit or quota rejection) do not execute internal commands.
> - **Operational Commands:** Administrative commands like **PING**, **AUTH**, and **INFO** are free and non-billable.
>
> ## 2. Replication
>
> - **Internal High-Availability (HA) Replicas:** If no additional Read Regions are configured, the internal multi-AZ standby replicas deployed for high availability do **not** multiply your command count. Writes are counted once at the primary.
> - **Read Regions:** On Global databases with secondary Read Regions configured:
>
> - Write operations replicate to every secondary region. Each write counts once in the primary region plus once for each configured read replica (e.g., 1 primary + 1 read region = 2 commands per write).
> - Read operations are routed to the nearest region and count as 1 command.
> - Cross-region data transfer between regions is added to your bandwidth usage.
> - The Free tier supports a maximum of **1 read region**.
> - **Verifying Region Configuration:** You can verify your active primary and replica regions in the Upstash Console by navigating to **Redis > your database > Settings tab > Manage Regions**.
>
> ## 3. Free Tier Limits and Charges
>
> - **Plan Limits:** The Free tier includes **500,000 commands/month**, **10 GB monthly bandwidth**, and **256 MB data storage**.
> - **Quota Exhaustion Behavior:** When the monthly command limit (500K) is reached, subsequent requests are rejected with a quota-exceeded error until the reset. If monthly bandwidth exceeds 10 GB, the database is suspended from accepting traffic. At the 256 MB storage limit, new writes are rejected unless key eviction is enabled.
> - **No Automatic Upgrades or Charges:** Without a payment method on file, the Free tier has an automatic hard stop (kill switch). The database will never automatically upgrade to a paid tier, and you cannot incur unexpected charges or financial debt.
> - **Guaranteeing No Paid Usage:** Keeping no credit card on file in your billing settings ensures your database cannot incur charges under any circumstances.
>
> ## 4. Console Usage Reporting
>
> - **Update Frequency:** The summary cards on the **Details** and **Usage** tabs (Commands, Bandwidth, Storage) display cumulative usage and update live upon page load/refresh. Time-series charts in the **Usage** tab update continuously.
> - **Reporting Delay:** Aggregated metrics typically reflect within a few minutes. However, there is **no documented maximum reporting delay SLA or real-time guarantee** for console analytics.
> - **Period and Timezone:** Monthly allowances (Commands and Bandwidth) reset on the **1st day of each calendar month at 00:00 UTC**. Daily usage charts (e.g., Daily Commands by Regions) aggregate by **UTC calendar day (UTC+0)**. Granular time-series charts (such as latency or throughput) render timestamps converted to your browser's local timezone with UTC offsets.
> - **Metric Differences:** Database-level summary cards track real-time counter data, whereas account-level views (such as Cost Explorer) aggregate across all services and may experience slight processing delays.
>
> ## 5. Usage API and Pre-Test Verification
>
> - **Usage API:** Upstash provides the [Developer API](https://upstash.com/docs/devops/developer-api/introduction) with an endpoint to fetch database stats programmatically (**GET /v2/redis/stats/:databaseId**). There is no documented latency SLA or guaranteed reporting delay for API stats.
> - **API Quota Cost:** Querying the Developer API or viewing the console is an out-of-band administrative action. It does **not** consume Redis command quota, bandwidth, or incur charges.
> - **Recommended Pre-Test Verification:**
>
> 1. Navigate to **Console > Redis > tokyo-mate-005-test > Details tab** and check the **COMMANDS**, **BANDWIDTH**, and **STORAGE** cards to confirm your current consumed baseline.
> 2. Confirm in **Settings > Manage Regions** that no unnecessary secondary read regions are attached (ensuring writes count as 1 command rather than multiplying).
> 3. Calculate your test budget assuming **1 + (internal calls)** per REST **EVAL** request.

上方完整保留支援回覆的所有內容及數值，只按原回覆保存 test DB 顯示名稱；未添加未提供的寄件者、ticket ID、回覆收件時間或私人訊息連結。

### 005 Phase B 靜態計量核對（七鍵歷史；現行三鍵證據見下節）

支援回覆只核實計量規則與 Free 條件，不代表本機曾連 Redis、測得真實 provider usage 或取得額度新鮮度保證。Read Regions 的寫入倍率是 per-inner-write；內部 HA 在無 Read Regions 時不倍增。Developer API／Console 查詢不耗 Redis commands，但沒有最大延遲 SLA，所有 usage 觀測都可能過期。

檢視當前 `005-phase-b-caller`、worker、Redis REST/shared-store adapter、`REDIS_QUOTA_LUA` 及三個直接 cleanup/preflight script：每個派送一次 HTTPS POST，沒有 retry／EVALSHA 或隱藏額外 REST request；實際 Lua 含 common `TIME`、七鍵 `TYPE` 與各 operation 的內部 calls。逐行核對 eligibility seed-unknown 的 `readQuota` 確認在一個 user `HGET` 後執行窗口檢查並提前 return，不執行 registry projection；其上界為 EVAL＋9 calls＝10，現有 caller 計數及 regression assertion 正確，該分支仍為 41（無 Read Regions）。其他 operation envelope 均涵蓋完整成功及錯誤前已執行 calls。完整 per-branch HTTPS POST／logical／provider command 上界、單 Read Region 寫入倍率和條件以[現行 D14 表](../../specs/005-api-protection-access-modes/contracts/isolated-local-runner.md#2026-10-08-t153-phase-b-callerchild-transport-本機交付現行)為準。

總成功路徑在無 Read Regions 時是最多 **8 HTTPS POST、89 provider commands**；最多一個 Read Region 時，publish／eligibility／唯一 reserve grant／七個 exact DEL 的實際 writes 合計再加 10，最高 **99 provider commands**。HTTP POST、Redis provider commands、USD 費用是不同單位：目前不把 command count 填入 `billableUpperBound`；Free 且執行當時確認沒有付款方式時，支援回覆才可支持 USD US$0，否則仍未知。8 次 ×（131,072-byte request＋32,768-byte response）=1,310,720-byte 應用層 payload cap，不包括 wire overhead，亦非 provider bandwidth/storage 上界。

### 本輪限制與 gate

沒有連線 Redis、送出 HTTP／Redis request、讀取秘密、讀取帳戶、操作帳戶或啟動 `--execute`。T152 不重開；T153／T154 父項、12 項正式 gate、production `live:false` 及 speech 阻擋維持不變。provider 規則未知已解除，但本機 `providerMetering: "unverified"` 表示未做真實 provider 執行；`billableUpperBound` 仍為 `null`，不宣稱實測費用。

Upstash usage 無最大延遲 SLA，既有 D14 usage freshness／最壞上界前置無法由此回覆滿足。本輪不改 verified-metering／freshness gate、不使用 bypass 或假 evidence。推薦的單次試驗需先批准窄化的 stale-capable 人工觀測契約差異、保留 Free quota hard stop、無付款方式、無 Read Regions、專用 DB 無其他 writer、程式固定派送上限及 unknown／cleanup fail-closed。全新隔離 namespace 的可信初始化 provenance 與 production restore 的完整防 rollback 屏障分開；目前尚無可信 fresh-namespace bootstrap evidence／port，亦不以 production restore 的所有條件代替它。具體前置、建議餘裕、阻擋及待批准差異見[readiness](../../specs/005-api-protection-access-modes/readiness-decisions.md#2026-10-08-upstash-支援回覆與-phase-b-計量收斂)。

### 2026-10-08 單次 Phase B 三鍵 dry-run 與本機驗證（本次現行）

依使用者本次明確批准，完成三鍵、無 `requestEpoch` 的本機 caller／worker、mock regression、計量／大小／清理包絡及直接相關文件同步。Reserve 使用既有 `createRedisSharedStore` 無 `epochFloor` 分支及原業務 `REDIS_QUOTA_LUA`；保留 eligibility、registry／cost binding、G、日／週額度、idempotency 與首次 grant 檢查。不傳假 floor／digest、不啟用 legacy bypass，也不驗證或宣稱 epoch／restore 完成。具體分支與計數依[現行 D14 三鍵契約](../../specs/005-api-protection-access-modes/contracts/isolated-local-runner.md#2026-10-08-單次-phase-b-三鍵本機準備現行)。

最終安全 dry-run 命令：`node scripts\005-phase-b-caller.mjs`。結果為 `mode: "dry-run"`、`reason: "owner_current_state_usage_observations_and_separate_execution_approval_missing"`、`networkDispatched: 0`、`secretsRead: false`。計畫 digest 為 **`f224b665221d43fe49e710656dd418dd4a2386e0a359010bc0a53a5be3430235`**；此 digest 僅識別該次含隨機 namespace 的 dry-run 計畫，不是外部執行授權、真實 inventory 或 gate 證據。該次列出的三鍵為 `{preview-tYRdoR7H_APrX0yV}:registry`、`{preview-tYRdoR7H_APrX0yV}:users`、`{preview-tYRdoR7H_APrX0yV}:sessions`；只屬 dry-run 輸出，未連 Redis、未建立或清理任何 key。

成功／cleanup-confirmation 分支上界為 **8 HTTPS POST、58 logical/provider commands（無 Read Region）、64 provider commands（單一 Read Region 敏感度上界）、6 write calls**。每次 request／response 分別 ≤131,072／32,768 bytes；分支總上界 ≤1,048,576 request bytes、≤262,144 response bytes，合計 1,310,720 應用層 bytes，不含 HTTP／TLS framing，也不是 provider bandwidth 上界。其他分支的 POST、commands、write calls、bytes 逐列見上方現行契約；未沿用七鍵 89-command 上界。最終計畫門檻為 commands ≤400,000、bandwidth ≤9GB、storage ≤230MB，僅依有來源、擷取時間及時區但可能過期的人工觀測作單次試驗提案門檻，非即時餘額保證。

三鍵本機 mock regression 驗證 reserve／duplicate race 只 grant 一次、unknown 不重送、不退款、不重新授權，且不清理可能晚到寫入；cleanup unknown 僅 exact readonly 確認、不重送 DEL。fixture 的 storage 測試核對最多兩個 data-bearing hash keys、registry 最多四欄、user 一欄、sessions 不寫入及應用 payload byte cap；這不是 Redis encoding 或 provider storage 實測，`providerStorageBytesUpperBound: null`。  

驗證證據：

- `node .\node_modules\vitest\vitest.mjs run tests\api\phase-b-process.test.ts tests\api\redis-shared-store.test.ts tests\api\request-epoch-reserve.test.ts --reporter=default`：3 files、62 tests 通過。
- `node --check scripts\005-phase-b-caller.mjs` 與 `node --check scripts\005-phase-b-worker.mjs`：通過。
- `node .\node_modules\typescript\bin\tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --types vitest/globals,node --skipLibCheck tests\api\phase-b-process.test.ts scripts\005-phase-b-caller.d.mts`：通過；編輯器 Problems 對兩個 MJS、型別宣告與測試檔均無診斷。
- 上述測試採 local/mock／Lua interpreter harness，非真實 Redis 或 provider execution。營運者提供的 EVAL／內層 calls 及 Read Region 計量規則已取得；真實 runner／Redis 執行未驗證，`providerMetering: "unverified"`、`billableUpperBound: null`，不推論真實費用或帳戶用量。

外部啟動前一次性檢查清單（本次不執行；仍須另行明確批准）：

1. owner 在任何讀取秘密、spawn 或連線前，當次確認專用 DB 為 **Free**、primary 為 **Tokyo**、**無 Read Regions**、**無付款方式**、**無其他 workload／writer**。
2. owner 提供 commands、bandwidth、storage 三項各自可核對的來源、觀測值、擷取時間與時區；可接受該觀測可能過期，且各自不超過 400,000、9GB、230MB 提案門檻。缺項、超限或矛盾即停止，不將數值解讀成即時剩餘量。
3. 取得本次專用 namespace／三鍵 exact inventory 與另一次外部執行明確批准後，才可按契約固定序列一次 preflight、一次 registry publish、一次 eligibility seed、兩個獨立 OS child 各一次相同 reserve、一次 usage read；只有成功且用量合格才可一次 exact 三鍵 cleanup 與一次 exact EXISTS 確認。
4. 任何異動 unknown 均不重送、不退款、不 regrant；reserve unknown 僅可按契約作一次 readonly reservation confirmation，仍不清理可能晚到寫入。cleanup unknown 不重送 DEL，只作一次 exact EXISTS 確認；未收斂即停止並保留 exact inventory。

本次沒有讀真秘密、連 Redis、送出外部 HTTP／Redis request、查閱或操作帳戶、執行 `--execute`、安裝 dependency、提交、推送或部署。`--execute` 仍由 caller fail closed；production／business runner freshness gate 未改。T152 維持結案；T153／T154 父項與正式 gate 維持未完成。
