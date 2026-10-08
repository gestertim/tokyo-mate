# 005 Specification Analysis Report（2026-10-06 四項決策同步後重新分析）

## 2026-10-07 限定 Analyze：D13／D01／D07–D08／D14（最新）

### 範圍與方法

唯讀檢查本輪變更的 decision package、Spec、Plan、Research、Tasks、data-model、auth／protected contracts、Readiness 與 implementation evidence，並僅追到直接依賴：現有 production price table、cost estimators、shared text request builder、OpenAI model selection、Places field mask、image verification seam、OIDC adapter／flow、Redis key factories、Node／Vercel設定及既有測試 provenance。D10／D11 與歷史 findings 僅檢查沒有被本輪改寫，不重新複審；沒有重跑應用程式全套測試或服務驗收。

### 發現與一致性結果

| ID | 類別／狀態 | 證據與影響 |
| --- | --- | --- |
| A-005-01 | D13 runtime evidence／OPEN | Local Node 24 與 generic Vercel defaults 不能證明 project override／deployed Function runtime。Decision package 將部署 project setting、preview runtime／architecture 明列為 package approval 前提；因此不安裝 dependency、不設定 `engines`，六端點狀態不變。 |
| A-005-02 | D01 cost upper bound／OPEN | Production price table 六 endpoint 均 `live:false`、無價目／scale／model allowlist。實測 request builder 只提供 bytes；OIDC／decoder／fixtures 亦不構成 billing evidence。六端點矩陣把限制、未核定值、本機量測與供應商前提分開；speech S1、production 六 endpoint 停用。 |
| A-005-03 | D07／D08 retention／epoch／OPEN | 本輪提出的 30 天候選期限及 epoch freshness 均非已批准政策；要先產品／隱私批准，tombstone 先原子寫入後才可刪 detail，未知狀態 fail-closed。沒有加入生效 schema／TTL。 |
| A-005-04 | D14 external operation／NOT RUN | Redis／OIDC resource、account、secret 與測試操作各自列 gate、隔離原則、實證與 rollback；沒有建立 resource／登入／連線。Redis hash-slot 驗證要求實際 generated key，同 namespace 單看 adapter fixture 不算 PASS。 |
| A-005-05 | Task／link traceability／PASS | 本輪新增 T148～T154，task declaration ID 與既有 tasks 不重複；T148 已完成，T149～T154 留 pending 並在 task 內列明批准／依賴。 |

**一致性結論**：本輪新增 0 項已生效產品行為／production 數值；D02／D03／D04／D06 的既有批准限制沒有被重寫；歷史 evidence／findings 保留。Package versions、候選 retention／epoch、redis plan、預算與操作皆有來源／理由／範圍／批准狀態標註。未發現必須停止 reconciliation 的新衝突；高層 Readiness 仍 **本機文件完成、真實整合 NOT READY、正式部署 NOT READY**。本分析沒有宣稱歷史 findings 全關閉或全功能沒有其他缺陷。

### 限定變更與驗證

- 允許文件：本輪限於 005 decision package、Spec／Plan／Tasks／Research／data-model／direct contracts、Readiness／Analyze／verification evidence；001～004、PDF、app code、dependencies、env／deployment 均不得更動。
- 測試來源：僅既有 request-builder test 1 file／4 tests PASS；不把 bytes 換算成 tokens／image billing，不把 mock／文件同步當真實服務證據。
- Stops respected：未安裝 dependency、未更動正式參數／production table、未登入或建立外部資源、未作付費呼叫／提交／推送／部署。

## 接續 Implement 同步（2026-10-06；非重新 Analyze）

沿用既有 L1～L5 本機授權與已完成 Analyze，不重審七檔或已結案批次。Session opaque＋逐次 store lookup 已核對；週鍵停止點確認是格式差異，已同步管理 contract／Spec／Plan 為 `YYYY-Www`，Asia/Taipei週一重置政策不變，無新增實質契約衝突。

本機 Redis 業務 adapter／Lua／TIME／uncertain 清理、共享 Session與圖磚 writer 已補程式及測試；OIDC library port／額度 UX已接續驗證。R-E1 現為真實 Redis sandbox／跨 writer／TTL 外部證據缺口，不再混稱 adapter 程式未寫。P-G1／P-G2 的正式 acceptance不因此關閉；成功管線仍受未批准成本／輸入政策限制。最新命令、管理工作與剩餘分類見 [接續實作證據](../../../docs/verification/005-local-implementation-evidence.md)，下方 73／900／11 為前輪報告，不是本輪結果。

## 最新 Implement 證據同步（2026-10-06；非重新 Analyze）

**本節以下為前輪歷史**。2026-10-07接續已完成管理讀取／原子異動與audit／完整UI、本機shared adapters與額度UX；T076正式門檻未核定，程式不設80%預設，缺配置只拒絕overview。申請producer／enqueue仍尚未實作，新增T147先核定契約，不掩蓋成外部證據不足。實際最新命令見上方接續證據；未重新進行全量Analyze，沒有宣稱正式finding／成本上界／部署結案。

使用者已另批准 L1～L5 本機實作，並確認 12 項 checklist 例外；前次唯讀 Analyze 與七檔結案保留。本節只同步其後實際程式狀態，不把測試當成重新分析或正式 acceptance。最新 73 files／900 tests、專案／測試型別 exit 0、11 項 mock 瀏覽器 PASS；完整證據與限制見 [本機執行報告](../../../docs/verification/005-local-implementation-evidence.md)。

- P-G1／P-G2：memory／engine 的實作及新原子矩陣已有證據；正式共享 authority 仍 OPEN，不宣稱 finding 全關閉。
- P-I1：六 POST 已接拒絕 boundary，不能再以「完全未保護」描述本機現況；完整成功管線／管理端／tile writers 仍未實作，正式整合 OPEN。
- R-E1：單次 EVAL transport 不等於完整 Lua adapter；本機缺 Redis server／cli／cjson，但已有 Lua 5.4.2。adapter 業務與清理未完成，不以缺少環境掩蓋未寫程式。
- R-D1／R-Q1／R-B1：正式數值、期限、T142、新版素材、真實 provider／CDN 等 gate 不變；未自行決策。
- 新增受影響契約差異：admin 範例 `2026-W39-AsiaTaipei` 與 engine `2026-W39`；追加 HTTP 解碼停止待 artifact reconciliation，其他獨立範圍持續實作驗證。
- T009、T088 勾選；requirements 71／12 不變，未把部分任務勾為完成。此批不是全部本機工作結案；剩餘程式欠項明列於執行報告。

## 本輪限定 Analyze：剩餘實作收斂與統一 Readiness（2026-10-06）

本節優先於下方歷史批次的 readiness／批准描述。**七檔隔離 pipeline 已結案，不重審**；只盤點其與本輪 registry／G／engine／store 契約有關的必要介面及六 handler 是否接線，不評價已結案的 P01～P22 或重新跑 334 tests。功能 005、真實整合與部署仍未完成。

### 執行邊界與來源

- 本機 Constitution 2.1.0、005 Spec、Plan、Tasks、data-model、UX handoff、五份 contracts、requirements、Readiness／Analyze 重新讀取；必要程式為 registry／threshold／engine／SharedStore／memory mock、pipeline 成本快照與 reserve 呼叫邊界、六 handler import／上游路徑及 OpenAI client。
- prerequisites 本輪執行一次，FEATURE_DIR 為 005、spec／plan／tasks 均存在；本機 `speckit-analyze` 可用、extensions.yml 不存在，前後無 hooks。
- 先按本輪明確文件授權同步契約與追加任務，再進行**唯讀限定 Analyze**；分析期間未修改 repo artifacts。分析結束後才依本輪報告保存授權寫入本節。沒有進入 `/speckit.implement`，沒有程式、測試、dependency、env／secret、網路、提交或部署動作。
- 限定 26 個 FR／SC 及本輪相關依賴，不把其引用覆蓋率當成全功能語意驗收；原始73項與歷史findings保留，不宣稱全功能零缺陷。

### Specification Analysis Report

| ID | 類別 | 嚴重度／狀態 | 位置 | 結論與實際阻擋 |
| --- | --- | --- | --- | --- |
| P-G1 | 可信狀態／競態 | HIGH；**規劃已收斂、實作／證據 OPEN** | [Plan §14.1](../plan.md#14-剩餘實作收斂與統一-readiness-gate)、[data-model](../data-model.md)、T143／T019／T140 | 全集合 bundle／revision／成本摘要、原子時間與動態封鎖已有可執行契約；現程式只有逐端點 resolve／固定 clone，尚非共享權威。阻擋正式 G／成功整合完成，不阻擋本機實作 |
| P-G2 | 原子全域門檻 | HIGH；**規劃已收斂、實作／證據 OPEN** | [FR-015／SC-006](../spec.md)、[Plan §14.2](../plan.md#14-剩餘實作收斂與統一-readiness-gate)、T144～T146 | 現 reserve command 無 G、engine denied 假設 R_e 不足；新契約明訂同原子檢查兩窗口 G＋R_e、只扣 R_e、可變成本區間拒絕及完整 evidence。T145 新案例待測，不重開 Places 七檔驗收 |
| R-E1 | 真實技術證據 | HIGH／OPEN | T019／T138、SC-015；[Readiness §2](pipeline-readiness-report.md) | Lua／TIME／keys/hash-slot／跨 writer／TTL 實際證據缺少；只阻擋真實共享控制與相關正式驗收。adapter 程式／注入 transport／mock 可持續，不能把 memory 當 Redis PASS |
| R-D1 | 未批准數值／行為 | HIGH／OPEN（限定子範圍） | A1／A3／A4／A5／A7、T128～T130／T136；[Plan §10.3.2](../plan.md) | 成本／影像／錄音／Places新限制與正式lease／保存未核定；只阻擋採用正式值或新行為。A2／A6／A8／A9／A10、額度／週追加／圖磚初始控制不重批 |
| R-Q1 | 查詢契約 | MEDIUM／OPEN | FR-050／SC-014、T142、[error contract](../contracts/error-and-quota-contract.md) | 409 查詢方式與授權尚未定義，不預建 endpoint／動作；既定提示可以保留。不阻擋原子 G、Session、T135 或單純拒絕接線 |
| P-I1 | handler／UI／整合 | HIGH／OPEN | T036／T049～T054／T135／T134／T117；[Readiness §2](pipeline-readiness-report.md) | 六既有 handler 仍直接呼叫 SDK／fetch，未接新 pipeline；Session／admin／map／UI／PWA完整整合與正式防線未完成。阻擋功能完成與部署，不將所有本機工作一律 BLOCKED |
| R-B1 | 外部驗收／追溯標籤 | MEDIUM／OPEN（既有） | FR-044／SC-011／requirements；T062／T107～T109／T112／T133 | FR-044措辭確認仍保留，不用checklist的已批准精確保證擅自取消該待確認標籤；資產／CDN／PCM／vision／HAR證據缺少。只影響相應正式acceptance，不擋fallback、mock代理、SW或拒絕路徑 |

**限定結論**：新增 Constitution MUST 衝突0、新增本機實作 blocker0。P-G1／P-G2 不再是「解法未定義」的規劃阻擋，現為已追溯的未完成實作／證據；未宣稱關閉原 implementation finding。SC-002的六端點成功驗收仍未完成，不能以S1／P1或production live:false拒絕測試假充全六端點成功。需先取得本輪建議的**一次明確 `/speckit.implement` 授權**；正式值／外部／部署只擋相應子範圍。

### Coverage Summary（本輪26項語意分組）

| Requirement Key | 有 Task？ | Task IDs | 限定檢查與尚缺證據 |
| --- | --- | --- | --- |
| FR-051／FR-049／SC-013 | 是 | T143／T140／T019／T145 | 可信全集合／revision／效期／雙封鎖→Spec／Plan／model／protected／Tasks一致；新實跑待測 |
| FR-010／FR-011／FR-013／FR-015／SC-006 | 是 | T144／T145／T021／T024 | 同原子 G與日週／可變成本區間／僅扣R_e，沿用quota及追加政策；新實跑待測 |
| FR-006／FR-008／FR-012／FR-055 | 是 | T009～T018／T059～T060／T067～T072／T144～T145 | Session subject／目前資格優先、當週有效追加與撤回／原子排序；正式身份未取得證據 |
| FR-052／FR-053／FR-056／SC-015／SC-016 | 是 | T136～T138／T144～T145／T019 | 原子可信時間、lease、unknown、保守結算與封鎖維持；正式秒數／對帳／Redis待辦 |
| FR-054／SC-017 | 是 | T139／T143～T144／T114～T115 | HMAC／成本摘要不藉revision解封、最小資料；無新public欄位或原文存量，保存／輪替仍待決 |
| FR-001／FR-025／SC-003 | 是 | T025～T028／T036／T049～T054／T135／T140～T141／T146 | A6已批准、409／503不變；同次拒絕分類與六handler未保護如實區分 |
| FR-043／FR-045／FR-048／SC-005 | 是 | T032～T035／T037～T047／T134／T146／T110～T112 | map當次原子snapshot／cache前重驗、不扣US$；不把query當grant，正式Network／CDN待證據 |

### Constitution Alignment／Unmapped Tasks／Metrics

- I／XI：文件先於實作；本輪沒有程式授權，交付連續範圍後停止。新契約不偷偷改應用行為。
- II／V／VIII：沿用已批准stack／共享store，不加入架構層或dependency；使用既有estimator／threshold／digest／HMAC／error helper，權威不分散。
- VI／XIII：可信身份與registry、同原子額度／G／封鎖、資格先於冪等資訊、未知fail-closed；不新增request原文保存、不聲稱追回已交付內容，真實原子證據不以mock代替。
- VII／IX：新增具體可變成本與race／失敗／回歸矩陣；按L1～L5分階段驗證，不在本輪預標PASS。
- X／XII：保存tracked／untracked、001～004、plan.pdf、baseline及local-only政策；台灣繁中交付。
- 本輪治理檢查11項原則（I、II、V、VI、VII、VIII、IX、X、XI、XII、XIII）；技術決策5組（權威來源、pinned／線性化、原子G分類、可信時間／窗口、failure／既有結算相容）。
- 文件FR56＋SC17＝73；本輪scope26、已映射26／26，**100%只表示本輪有task覆蓋，不是實作完成率**。Task146／唯一146，新增4項T143～T146均未勾；既有已勾10、未勾136。requirements83／已勾71／未完成12不變。
- 懸空Task ID0、缺失相對文件／anchor0；新鏈T143→T144→T145→T146無循環，原T140／T025以核心／骨架／接線子範圍拆開。T038正式資產／T062自我引用的補充校正可追溯；T142不是基礎工作的反向前置。
- 新增未映射Task0；新規劃歧義0、重複任務0、CRITICAL0。本報告7組findings保留OPEN的實作、決策或證據，不用「零新blocker」掩蓋它們。

### 本輪真正執行的文件檢查（非應用程式測試 PASS）

本機 Node stdin 唯讀解析Task定義與引用、FR／SC、Markdown相對文件／anchor、marker及三份A6六列逐字一致性。第一次A6 checker錯把表內列名假定為exhausted／request，只匹配2列而exit1；窄讀Spec六列表後改為實際列名（日／週耗盡、below_floor、request不足），再次檢查6／6／6逐字一致，errors0、exit0。只修正session檢查命令，未改A6內容或測試。依賴及契約語意另由本輪限定人工分析，不將字串引用當成完整驗收。

session `C:\Users\geste\.copilot\session-state\090223d8-6ce5-47a9-b69c-ef617ab1c95c\files` 保存 `005-convergence-document-check-first.json`（checker失敗）、`005-convergence-document-check.json`（最終機械結果）、開始／結束Safety manifests。未跑Vitest、tsc、build、瀏覽器或付費API；歷史334與型別檢查不是本輪結果。

### Next Actions／停止

建議採 [統一 Readiness §4](pipeline-readiness-report.md) 的一次連續授權範圍L1～L5：原子G→adapter／Session與T135→本機六handler拒絕與合規成功子範圍→admin／quota UI→map／placeholder／PWA／回歸。例行修改、相關測試及文件同步不逐小任務重批；遇到真正新產品／費用／保存、外部啟用、秘密、stack或部署決策，只停止受影響子範圍。

本輪到文件與限定Analyze交付即停止；不開始T143、不執行T135、不接handler／UI、不提交／推送或部署。報告保存是本輪明確文件授權，不是Analyze自行修補或新的Implementation授權。

## 本輪最新：七檔隔離 pipeline 限定 Analyze 與驗證（2026-10-06）

本節優先於下方歷史授權狀態。營運者本輪明確核准 A6 六列、統一日／週 request 修正文案及七檔 tests-only 範圍，並再次確認保留12項未完成正式 gate。流程為 Safety Guard → 文件同步 → **唯讀限定 Analyze** → 已安裝 `speckit-implement` → 分階段 RED／GREEN → 核心回歸與型別檢查 → **唯讀限定 post-implementation Analyze** → 依報告保存授權寫入本節。Analyze 執行期間沒有修改 artifacts。

### Specification Analysis Report

| ID | 類別 | 嚴重度／狀態 | 位置 | 本輪結論與限制 |
| --- | --- | --- | --- | --- |
| P-A6 | 文案批准／一致性 | **CLOSED（限定文案）** | [Spec A6](../spec.md)、[UX A6](../ux-ui-design-handoff.md)、[contract](../contracts/error-and-quota-contract.md)、[Plan §13](../plan.md)、[Tasks](../tasks.md) | 六列逐字一致；日／週 request message 都是「今日／本週剩餘額度不足以預留這次操作，僅本次操作無法執行；其他功能仍會依各自的資格、額度及防護狀態判斷是否可用。」9個信封測試通過。不關閉 UI／正式整合 gate。 |
| P-G1 | 可信成本／G | **HIGH／OPEN（正式整合）** | Plan §4.5.2／§13；T019／T140；P09／P12 | 隔離驗證同次 cloned registry／table、效期、metadata、live、版本與摘要雙封鎖證據；正式權威來源與外部成本證據仍未完成。mock 不替代正式 G。 |
| P-G2 | 原子 G-B 覆蓋 | **HIGH／OPEN（正式整合）** | 原 engine／store reserve；Plan §13；P12 | 核心介面不變，仍僅原子比較 R_e。合法成功只有固定 SKU Places；同次 context 以3組 SKU 價格證明 **R_e＝R_max,places≥G**。其他端點只測共用拒絕，不宣稱解決可變成本 R_e≤remaining<G 缺口。 |
| P-I1 | 真實整合／驗收 | **HIGH／OPEN** | T014／T017／T019／T135／T136／T138／T140～142；requirements | 真實 Session／Redis／SDK、正式 lease／限流／成本上界、可信對帳、六 handler／UI／map／query／瀏覽器與供應商防線皆未放行；12項正式 gate 全保留。 |

**進入實作前限定結論**：本輪 A6 與七檔授權已成立；沒有新增阻擋七檔／固定 SKU Places／tests-only 邊界的契約缺口，CRITICAL 0。**實作後限定結論**：P01～P22 均有實際通過案例，未辨識新增隔離 blocker；不宣稱全面零缺陷或功能005正式完成。

### Coverage Summary

| Requirement Key | 有 Task？ | Task IDs | 本輪證據／未完成 |
| --- | --- | --- | --- |
| FR-011／012／025／027、SC-003 | 是 | T026／T065／T028／T141 | A6六列 → UX／contract → Plan §4.5.3／§13 → P10／P11／P12／P22；精確信封與恢復案例通過。未改 T065 engine／UI。 |
| FR-008／010／015／051、SC-013 | 是 | T019～024／T126／T131／T140 | 同次 pinned context＋原子 snapshot；G−1／G／R_e−1／R_e、封鎖／釋放／結算／重置／週追加。正式 P-G1／P-G2 未完成。 |
| FR-024／026／049／050／055／056、SC-013／014／016 | 是 | T025／T026／T028／T140／T141 | bounded reader、403優先、409非成功、統一503、C1超額雙封鎖、no-store／白名單；不建立 T142 查詢。 |
| FR-052～054、SC-015～017 | 是 | T136～139／T141 | fixture逐端點 lease、grant／clock、unknown／late observation、timeout已寫入／已入帳、內容不進 store／audit；正式 provider／排程仍未完成。 |

### Constitution Alignment／Unmapped Tasks／Metrics

- I／XI：產品與技術契約先同步；限定 Analyze 通過與使用者再次確認後才實作。整項 Task 不因子範圍通過而勾選。
- II／V／VIII：無新 package／架構層；沿用 ProductError、http 信封、registry estimator、quota engine／threshold。engine／store／registry 介面及內容均未改。
- VI／XIII：可信 transport key／Session subject，不讀取偽造 IP 作入口權威；mock 成功只限 Places；拒絕前上游零呼叫，unknown 保守結算，不重送／退款；audit 只記 stage／固定 outcome，不記原文或外部 error message。
- VII／IX：三階段 RED→GREEN，新增123測試與核心回歸、專案與測試型別檢查均有本輪證據；不是 production acceptance。
- X／XII：Safety 逐檔 SHA-256 覆蓋 tracked／untracked；001～004、plan.pdf、baseline／本機工具保留；台灣繁中交付。
- 文件機械核對：FR56＋SC17＝73；唯一 Task142、已勾10；requirements83、已勾71、未完成12；A6六列一致、P01～P22共22組。不把全文件引用率當完整語意分析或完成率。
- 限定 findings：批准項1已關閉，正式整合3 OPEN；新增隔離 blocker 0、CRITICAL 0、新增未映射工作0。舊 finding／正式 gate 不歸零。

### 本輪實際驗證與可重現來源

- 新增測試最終：**3 files／123 tests，exit0**，20:04:56、1.83s；protected pipeline83、cost registry pipeline31、error envelope9。逐案例 JSON `pipeline-cases.json` 解析確認全部 passed、涵蓋 P01～P22，無 skipped／failed。
- 相關核心合併回歸：**11 files／334 tests，exit0**，20:03:23、11.36s；其中新增123、既有8檔211（由本輪合併結果與逐案例結果核對，不沿用舊 Chat）。最後逐端點 fixture lease 明列與 audit 最小化後，另重跑新增3檔123及雙型別檢查，均通過；核心檔未修改。
- 專案 `tsc --noEmit --incremental false --pretty false` **exit0**；session 暫存 tsconfig 指定4個新增 test／support 入口及 transitive dependencies，`tsc --project <session-config> --noEmit --pretty false` **exit0**。不更新既有 tsbuildinfo、不跑 Vite build／瀏覽器。
- RED、GREEN、實際完整命令、修正過程及逐檔表見 [Readiness 本輪節](pipeline-readiness-report.md)。IDE `runTests` 的 `No tests found` 不算 PASS。session 型別解析與 readQuota 參數錯誤曾失敗，修正後重新通過，未安裝任何套件。
- 證據目錄：`C:\Users\geste\.copilot\session-state\f0f2f8b1-8f7f-449b-a691-51959be62d28\files`；保存 `pipeline-safety-start.json`、`pipeline-safety-end.json`、`pipeline-safety-result.json`、RED／GREEN logs、`pipeline-core-final.log`、`pipeline-final.log`、`pipeline-cases.json`、兩個最終 type logs。測試 tsconfig 為暫存檔，完成後刪除，不成為 repository 資產。

### Next Actions／停止

本批僅完成七檔隔離子範圍並停止。**真實整合與完整驗收／部署仍 BLOCKED**。沒有執行 T135、沒有接 handler／UI／map／query、沒有連外、安裝、秘密／env、commit／push 或部署。後續需先完成正式 P-G1／P-G2／P-I1 與12項 gate 的獨立 reconciliation／批准，不在本輪開始。

## 本次最新 A6 Analyze：四種額度文案與隔離授權前交付（2026-10-06）

此節為本次本機重新讀取及分析結果；下方歷史報告／測試／來源 manifest 全數保留，不當作本次執行數字。執行已安裝 `speckit-analyze`：prerequisites 一次，005 FEATURE_DIR 正確、必要 artifacts 與 tasks 存在；Constitution 2.1.0、repository 指引與前後 hooks 檔案不存在均重新核對。

工作分開：依明確文件同步授權提出 A6 六列文案及七檔方案 → 唯讀 Analyze（不修改任何文件）→ 分析結束後依005文件交付授權保存本節與 Readiness 結論。A6 **本次待營運者批准方案**不核定生效，不是 implementation 授權。沒有新程式、測試、handler／UI、T135、連外、安裝、提交或部署。

### Specification Analysis Report

| ID | 類別 | 嚴重度／狀態 | 位置 | 摘要 | 建議／阻擋範圍 |
| --- | --- | --- | --- | --- | --- |
| P-A6 | 文案批准 | **HIGH／OPEN（待批准）** | spec FR-025／A6；UX A6；Plan §4.5.3／§13；error contract；T026／T065／T028／T141；P10～12／P22 | 前批缺少 below_floor 完整信封／誤用「已滿」的文件缺口已收斂為六列逐字提案；四種語意、code／scope／恢復條件一致，但營運者尚未批准 | 先審閱批准六列文案，再另行批准七檔 `/speckit.implement`；不得用提案或 Analyze 自動放行 |
| P-G1 | 可信成本／G 證據 | **HIGH／OPEN（正式整合）** | Plan §4.5.2／§13；quota-threshold；T019／T131／T140；P09／P12 | threshold 本身只處理價表；正式 registry／實際啟用／雙封鎖權威來源仍未整合 | 隔離使用明列 pinned mock context，缺證據503；不當正式 G 完成，不額外阻擋此明列隔離子範圍 |
| P-G2 | G-B 放行覆蓋邊界 | **HIGH／OPEN（正式整合；本次新增辨識）** | Plan §4.5.2～3／§13；quota-engine reserve；SharedStore ReserveCommand；memory store reserveSync；Readiness §4／P12 | 原子 reserve 只比較 R_e 與 remaining，未接 G；可變成本若 R_e≤remaining<G，僅拒絕後分類不能強制全域不可用。既有數學分類測試不證明原子 G 放行 | 限定本批合法代表為固定 SKU Places，R_e＝R_max,places≥G，P12 明列不變量；其他成功端點／原子 G 解法須回 Plan／Tasks reconciliation，不修改核心介面或擴批 |
| P-I1 | 正式整合／驗收 gate | **HIGH／OPEN（既有）** | T014／T017／T019／T135／T136／T138／T140～142；requirements12gate | 真實 Session／資格／Redis、SDK 單次、逐端點正式lease／rate／成本上界、可信對帳／G、handler／UI／query／瀏覽器證據仍缺 | 真實整合與完整驗收／部署 BLOCKED；隔離只測明列 mock contract，不跳過或勾選正式工作 |

**限定隔離結論**：除文案批准與具體實作授權外，沒有辨識其他阻擋**七檔／固定 SKU Places 合法代表／tests-only注入邊界**的 finding。P-G2 不適用該固定 SKU 的合法成功區間，但必須列為正式整合欠項，不宣稱六端點已可整合。這是限定一致性分析，不是全面零缺陷、安全驗收或 application acceptance。

### Coverage Summary

| Requirement Key | 有 Task？ | Task IDs | Requirement → UX → Plan → Test／限制 |
| --- | --- | --- | --- | --- |
| FR-011／012／025／027、SC-003 | 是 | T026／T065／T028／T141；既有T113不撤回 | A6六列 → UX日週／A6表 → §4.5.3／§13／error contract → P10／P11／P12／P22；待批准、待測 |
| FR-008／010／015／051、SC-013 | 是 | T019～024／T126／T131／T140 | 原子snapshot＋同版可信context、非前端推算 → P08／P09／P12／P15；正式G與P-G2未完成 |
| FR-024／026／049／050／055／056、SC-013／014／016 | 是 | T025／T026／T028／T140～142 | 既有順序、403優先、409非成功、統一503／C1 → P01～P09／P13／P16～P22；query不預建 |
| FR-052～054、SC-015～017 | 是 | T136～139／T141 | 時鐘／lease／uncertain／保守結算、資料最小化 → P17～P22；既有memory回歸非正式provider證據 |
| 其餘正式需求與驗收 | 保留原追溯 | 原142項定義不刪除 | 未擴大此次語意分析；原管理／地圖／UI／PWA／正式證據仍待辦，引用覆蓋不算完成 |

### Constitution Alignment／Unmapped Tasks

- I／XI：既有判定、code／scope／G-B 不變；新文字只是待批准提案，未由 code 覆蓋契約，未取得或暗示 implementation 授權。
- II／V／VIII：沿用現有 stack／helper／共用 ProductError；七檔只列計畫，未新增 dependency、provider 或 architecture layer。
- VI／XIII：可信後端決定狀態、同次原子 snapshot、統一503與欄位白名單；週追加不提高日上限；不額外持久化或洩漏內部分類。memory mock 不替代正式共享控制。
- VII／IX：22組矩陣全部待測；211是本次實跑的既有隔離核心回歸，與文件機械檢查、pipeline、UI、正式驗收分離。
- X／XII：未追蹤、001～004、baseline／plan.pdf／local-only保護；全部新交付採台灣繁體中文。歷史證據不刪除、不覆寫為本輪結果。
- 未辨識新增 Constitution MUST 違反；CRITICAL 0。七個預計檔案全部映射既有 Task 子範圍，**本次新增未映射工作0**。未把142項機械引用當完整語意品質認證。

### Metrics 與本次可重現驗證

- 實際解析：FR **56**、SC **17**，共 **73**；唯一 Task **142**、已勾選 **10**；含原追溯表的 requirement 引用 **73／73（100%）**。這是引用覆蓋，不是實作完成率。
- requirement checklist **83**：已勾 **71**、未完成 **12**；全部正式 gate／任務 checkbox 未變。A6六列逐字一致；JSON完整信封 **4**；矩陣 **22組**；預計完整路徑 **7**；懸空Task **0**、缺失相對文件連結 **0**。
- 本次範圍 findings **4 OPEN**：批准1、正式整合3（含新增P-G2）；阻擋限定隔離批次的新增契約缺口 **0**；未解文案內容歧義 **0**、新增重複需求 **0**、CRITICAL **0**。待批准不等於內容缺漏，也不等於已完成。歷史其他finding不歸零。
- IDE `runTests` 指定8個現有路徑：`No tests found`，不算PASS。改用既有本機 `node_modules\.bin\vitest.cmd run` 與 Readiness 所列八個selectors：本次開始 **19:22:54**、duration **49.22s**、**8 files／211 tests通過、exit0**。沒有下載／安裝；不是pipeline或A6新信封測試。
- 唯讀 Node stdin 文件解析命令 exit0：六列表逐字比對、四種信封JSON／public keys／文案一致、需求／任務range引用、相對文件連結、22組與7完整路徑檢查。**文件檢查不標應用測試PASS**。本次未跑build／type-check／瀏覽器或新pipeline測試。
- Git與manifest精確來源見 [Readiness最新節](pipeline-readiness-report.md)：開始527檔／41 untracked，HEAD／branch／baseline重新核對。保存後另作最終逐檔SHA-256比對，不只依賴空白tracked diff；plan.pdf不改。

### Next Actions／分範圍 Readiness 與停止

| 範圍 | Readiness | 下一個獨立批准／證據 |
| --- | --- | --- |
| A6文件與七檔方案審閱 | **可審閱；提案未生效** | 六列完整文案／四種信封／七檔介面／Task子範圍／22組矩陣 |
| 限定隔離pipeline實作 | **BLOCKED（批准／授權）** | A6營運者批准＋明確七檔 `/speckit.implement`；需以本次Analyze／Readiness為前提 |
| 真實服務整合 | **BLOCKED** | P-G1／P-G2／P-I1；可用 `/speckit.plan` 明確原子G-B接線與依賴，另走正常批准流程，不能擴大本批 |
| 完整驗收／部署 | **BLOCKED** | 全部12正式gate與handler／UI／瀏覽器／外部防線；部署／模式／服務各自獨立批准 |

依使用者停止點到此結束。等待文案與具體實作範圍審閱；不啟動pipeline、不執行T135、不接handler／UI、不連外／安裝／提交／部署，不把分析完成當實作授權。

## 前批歷史報告（保留原有來源與數字，不作本次結果）

## 最新規劃批次：隔離 pipeline 實作前方案（2026-10-06，非實作授權）

本節取代歷史批次的現況推定，不刪除後方證據。本輪使用本機已安裝 `speckit-analyze`：prerequisites 執行一次、FEATURE_DIR 正確、Constitution 2.1.0、前後 hooks 不存在。唯讀分析與文件同步分開：先唯讀盤點／辨識缺口，結束該輪分析後依使用者授權同步文件，再對更新後契約／Task依賴作最後唯讀分析；本節是在最後分析結束後按005文件更新授權保存，不是 Analyze 實作授權。

完整Safety來源、逐檔計畫、介面、22組待測矩陣、task子範圍與結束比對見 [pipeline-readiness-report.md](pipeline-readiness-report.md)。未建立pipeline／測試／handler，未執行T135／更動openai.ts，未連外／安裝／提交／部署。

### Specification Analysis Report

| ID | 類別 | 嚴重度／狀態 | 位置 | 摘要 | 建議 |
| --- | --- | --- | --- | --- | --- |
| P-A6 | 契約不完整／既有文案衝突 | **HIGH／OPEN** | spec FR-025；UX日週表；plan §4.5.3；error contract all範例；T026／T141 | below_floor尚未耗盡，舊all文案卻寫已滿；A6仍待核准完整title／message／step，本輪不能自行選擇一方覆寫 | 保留gate；先走A6 Specification→UX→contract→Task→test預期reconciliation，再Analyze／Readiness；完整隔離實作BLOCKED |
| P-G1 | 權威來源／證據限制 | **HIGH／OPEN（正式整合）；隔離方案已列工作** | spec政策11／FR-051；plan §4.5.2／13；data-model §4／14；quota-threshold；T019／T131／T140 | computeGlobalFloor／evaluateAvailability只接價表，不自行驗證registry核准／雙封鎖；既有mock數學回歸不等於當下權威G | 隔離先做同版本pinned context、缺證據503及雙封鎖mock測試；不把裸價表或fixture G當正式權威，真實來源另設gate |
| P-I1 | 尚未建置／正式gate | **HIGH／OPEN（既有）** | T014／T017／T019／T025／T135／T136／T138／T140–T142；checklist12gate | Session／approval正式adapter、Redis/Lua、單次SDK、正式lease／rate／輸入上界、可信對帳／G、handler／UI／query未完成 | 分階段授權，不跳過正式依賴、不整項勾選；真實整合及完整驗收／部署BLOCKED |
| P-U1 | 狀態措辭歧義 | **MEDIUM／文件澄清完成，runtime回歸保留** | data-model §15／16；FR-052；P21 | 狀態表把store timeout與uncertain並列，不能據timeout推論已完成轉態或尚未入帳 | 已補unknown讀法；只有可信原子結果或後續對帳才能確認；不退款／不重試寫入／不重送 |
| P-D1 | 執行順序 | **HIGH／文件 reconciliation 完成** | spec FR-024／055；plan §3.2；protected／error contract；T025；UX | 舊step7於預留後驗證輸入，缺匿名admission錯誤優先序；本輪使用者明確批准前移驗證及入口限流 | 已同步；不省略預留後原子回傳／時鐘／lease／grant／結算，不授權程式 |
| P-D2 | 依賴／共用型別 | **MEDIUM／規劃澄清完成，程式待辦** | plan §13；tasks子範圍；pipeline報告 §4／6；src/types/error.ts／http.ts | 若T025等待整項T140會循環；現有ErrorCode不含005錯誤，另造平行ProductError會失去型別一致性 | 先registry核心／cost-context契約→信封／Session mock→T025骨架→T140接線→T141；明列共用型別最小擴充，不cast／不改UI |

本輪核心不變量核對未發現測試反例：H1-R1三階段時間不倒退、command拒絕先於reserve、grant拒絕不退款／不重授權、首次grant、registry成本權威、C1內部／外部分離、超額完整入帳＋雙封鎖仍503、矛盾store fail closed。此為限定核對結論，不是零缺陷／全面安全驗收。

### Coverage Summary

| Requirement Key | 有Task | Task IDs | 證據／缺口 |
| --- | --- | --- | --- |
| FR-001～008、024、055／SC-001、013 | 是 | T009～018、T025、T028、T036、T043、T141 | 本輪同步pipeline順序／身分與資格優先；mock adapter仍待實作，真實auth未完成 |
| FR-009～019、021、022、051／SC-002、004、006、007 | 是 | T019～024、T126、T131、T135、T140 | 既有核心memory／fixture回歸通過；G權威／成本上界／SDK／Redis未完成 |
| FR-025～027、049、050、056／SC-003、013、014、016 | 是 | T025、T026、T028、T140～142 | 409／503與C1已有契約；A6完整信封、HTTP外顯／查詢仍未完成 |
| FR-029、052～054／SC-015～017 | 是 | T136～139、T114、T115、T140、T141 | HMAC／H1-R1／結算memory證據；正式lease、key／TTL／rotation與存取策略保留gate |
| FR-020、023、028／SC-005、008 | 是 | T027、T099～106、T110～112 | 狀態顯示／查詢與PWA驗收不在本批，不引用core測試替代 |
| FR-031～042／SC-009、010 | 是 | T029～031、T076～092 | 管理者需求與任務保留，不在隔離helper範圍 |
| FR-030、043～048／SC-011、012 | 是 | T032～035、T037～042、T055～064、T107～125、T134 | 地圖、正式資產、Network/HAR、服務／模式／部署gate保留，不能用memory mock驗收 |

表格為語意群組摘要；完整需求引用覆蓋以原Task定義／追溯總表唯讀解析。任何「有Task」都不等於完成或PASS。

### Constitution Alignment／未映射工作

- I／XI：兩項順序澄清已經使用者明確批准，只更新正式005文件；A6未批准不自行定案，停在Readiness，不授權application code。
- II／V／VIII：沿用React／TypeScript／Vite／Vercel與既有helpers／types；沒有新dependency／layer／service；新增helper與測試只列方案。
- VI／XIII：anonymous admission非匿名付費額度；不信任client IP/proxy Header；最小資料／統一503／race-safe正式gate保留，memory mock不是正式shared control。
- VII／IX：本輪必要核心回歸及22組待測矩陣分清；下一批分階段Verify／Fix，不把引用覆蓋當驗收。
- X：開始SHA256 manifest涵蓋未追蹤來源；最後逐檔比對結果見pipeline報告；001～004／plan.pdf／baseline保留。
- 本輪無新增Constitution MUST衝突／CRITICAL。新增檔案計畫全部映射T014／T017契約子範圍、T025／T026／T028／T140／T141；**新增未映射工作0**。此不宣稱以機械引用證明所有142項的語意品質。

### Metrics 與實際驗證

- FR **56**＋SC **17**＝**73**，Task定義**142**且唯一142；checkbox仍10個已勾選，沒有因本輪計畫勾選任務。
- Tasks含原追溯總表的requirement引用覆蓋 **73／73（100%）**；005 Markdown懸空Task引用**0**、相對文件連結缺失**0**。這些是文件機械檢查，不是需求實作完成率。
- Checklist **83**，已勾選**71**／未完成**12**；全部既有正式gate保留。
- 本輪限定高訊號findings **6**；其中3個OPEN（A6／正式G／正式整合），3個文件／規劃澄清完成。歧義辨識2（A6完整文案仍未定、timeout已澄清）；新增重複需求0；CRITICAL0。不是把既有分析其他gate歸零。
- 本次既有工具回歸：**8 files／211 tests PASS，exit0**。IDE runTests 的 `No tests found` 不算PASS；改本機Vitest，無下載安裝。精確命令、來源雜湊與memory證據限制見pipeline報告。
- 前後`.specify/extensions.yml`皆不存在。無TypeScript／application code變更，未重跑build／全面測試，不沿用歷史type-check當本次執行。

### Next Actions／分範圍 Readiness

1. **文件方案可審閱**；不是 `/speckit.implement` 授權。
2. **完整隔離pipeline實作 gate BLOCKED**：先針對P-A6走 Specification／UX／contract 的批准同步（可用 `/speckit.clarify` 或 `/speckit.specify`），同步Plan／Tasks及測試預期後重新 `/speckit.analyze`／Readiness；本輪不執行這些下一步。
3. **真實整合 BLOCKED**；**完整驗收／部署 BLOCKED**。P-G1／P-I1與全部12checklist gate保留，不以mock／引用覆蓋替代。
4. 本次按使用者停止點結束：不補程式、不預建query／服務、不執行T135、不提交／推送／部署；後續補救需新的明確授權。

## 最新限定批次：H1-R1 時鐘倒退修補（2026-10-06）

> 本節保存唯讀 `/speckit.analyze` 完成後的結果，依本次使用者對 005 證據文件的同步授權附加；Analyze 執行期間沒有寫檔。後方所有歷史證據保留。本批僅代表隔離 mock，**005／真實服務整合／部署仍非 READY**。

### 授權、Safety Guard 與修復時序

- 使用者明確授權 H1-R1，並再次同意保留 12 項正式 checklist gate。不執行 T135／T025、不建立 pipeline、不接 handler／UI、不新增套件、不連外、不提交或部署、不核定正式 lease、不修改 plan.pdf。
- Root `C:/Users/geste/spec-kit/tokyo-mate`；origin fetch／push 設定 `https://github.com/gestertim/tokyo-mate.git`（僅讀設定，未連線）；branch `master`；HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`。開始／結束均 **40 個 untracked**，tracked working tree／index 無差異；沒有新增、刪除或暫存未追蹤成果。
- baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`，peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7` 不變。plan.pdf SHA-256 `0A3D951ECED180AF04B665CADF0D92B09A71861B563E1A84CF6A1EFE5A552FFB` 不變。`.vscode` 不存在、未建立；`.specify/extensions.yml` 不存在，implement／analyze 前後 hooks 均無可執行項目。
- 初次 `Get-Item .git` 未包含 `-Force` 而找不到隱藏項目；隨後以 `Get-Item -Force .git` 確認 Hidden Directory，並以 `git rev-parse --git-dir` 確認 `.git`；不是缺少 repository，也沒有初始化／重建。
- **歷史 H1 更正**：下方「H1 隔離已修補」保留為上輪 command／lease／grant 證據。後續 H1-R1 探針揭露 estimation → command 尚缺不倒退檢查；不得把上輪結論解讀成已完整涵蓋三階段。
- **18:32:51 RED**：估算 `2026-10-06T02:00:00.000Z`，command／grant `2026-10-06T01:59:59.999Z`，實際仍回 `ok:true`／`executionGrant:true`，reservation.createdAt 為倒退時間、leaseExpiresAt 為 `02:00:59.999Z`。
- **18:33:56 擴充 RED**：15 個 H1-R1 cases 中 2 failed／13 passed；另一失敗為注入時鐘重用同一可變 Date，使先前 estimation 佐證被改寫。
- 依本次批准先補正式 FR-052 與 Plan §4.4，再最小修改 engine：讀取時鐘時建立 Date 快照、command 與 estimation 比較；既有 grant／lease 檢查與錯誤分類保留。**18:34:28 GREEN**：15／15 通過，精確案例 spy 證明 store.reserve 未呼叫。

### Specification Analysis Report（限定受影響範圍）

| ID | 類別 | 嚴重度／狀態 | 位置 | 摘要 | 建議／剩餘界線 |
| --- | --- | --- | --- | --- | --- |
| H1-R1 | 可信時鐘／歷史證據校正 | **隔離已修補** | FR-052；plan §4.4；T021／T024／T136；engine；atomic-evidence tests | estimation ≤ command ≤ grant；無效／倒退拒絕，不 clamp；command 拒絕在 store 前，grant 拒絕不退款／重授權 | 正式 lease、逐端點 timeout／buffer、共用 default 移除仍待 T136 |
| I1 | 既有真實整合 gate | **HIGH／OPEN（既有）** | T019／T025／T135／T136／T138／T140–T142 | Redis/Lua、pipeline、handler／錯誤外顯、可信 provider 對帳及正式 registry／G 未完成 | 不在本批執行，不改未完成 checkbox |
| I2 | 既有正式啟用 gate | **OPEN（既有）** | checklist；A1／A3–A7；production 價表 | 71／83 checklist、12 項未勾選；正式數值、外部預算／啟用與隱私期限未核定 | 六端點 live:false；不得宣稱真實服務 READY |

| Requirement | 有 Task | Task | 本批行為證據 |
| --- | --- | --- | --- |
| FR-052／SC-015 | 是 | T021／T024／T136（隔離子範圍） | 精確 estimation→command 倒退、command→grant 倒退、三階段無效、相等／正常前進、跨日／週、lease 邊界 |
| FR-050／FR-053／FR-056 | 是 | T021／T022／T137／T138（既有） | 所有拒絕均無 executionGrant；store 已預留後日／週保留 5,000 µUSD，同鍵重送為 duplicate／executionGrant:false；既有 C1／H2 結算／清理回歸 |
| FR-051／FR-054 | 是 | T139／T140（既有） | registry／HMAC 模組不改，隔離核心回歸保持通過；不代表正式來源／上界已驗證 |

- **Constitution**：I（產品／技術文件先同步）、VII／IX（RED→GREEN 與分階段驗證）、X／XI（Safety 與明確限定授權）、XIII（fail closed／不誤稱 mock 為真實共享控制）一致；本批無新增 MUST 衝突／CRITICAL。無新增 stack、dependency、秘密或儲存行為。
- **Metrics**：FR 56＋SC 17＝73；Task 定義 142、唯一 142；Tasks 含追溯總表的 requirement 引用覆蓋 73／73；005 Markdown 懸空 Task 引用 0。此為引用覆蓋，不是實作完成率。H1-R1 範圍新增歧義 0、重複需求 0、未映射工作 0；不是重新宣告整體功能零缺陷。
- **歷史預留**：新三階段檢查只增加於 reserve；validation／settle／cleanup 沒有加入新的即時授權要求。既有到期、registry 封鎖／故障後保守結算及原窗口清理回歸保持通過。

### 實際命令與結果

所有 Vitest／TypeScript 命令均使用已安裝本機工具，沒有 npx／安裝或下載套件。

1. Safety：`git --no-pager status --short --untracked-files=all`、`git branch --show-current`、`git rev-parse HEAD`、`git rev-parse --git-dir`、`git rev-parse mvp-safe-baseline`、`git rev-parse 'mvp-safe-baseline^{commit}'`、`git remote -v`、`git --no-pager diff --stat`、`git --no-pager diff --cached --stat`、`git ls-files --others --exclude-standard | Measure-Object`、`Get-FileHash specs\005-api-protection-access-modes\plan.pdf -Algorithm SHA256`：結果如上。`git diff --check` exit 0 僅涵蓋 tracked，不把它誤當 untracked patch 檢查。
2. Implement／Analyze 初始化各執行一次 `.specify\scripts\powershell\check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks`：exit 0，FEATURE_DIR 正確；checklist 71／83，使用者確認保留全部 12 項 gate 後續行。
3. IDE `runTests`（精確案例）回 No tests found，不算 PASS；改用本機 CLI。
4. RED：`node_modules\.bin\vitest.cmd run tests\api\quota-atomic-evidence.test.ts -t '估算 02:00:00.000Z' --reporter=verbose`：**1 failed／44 skipped，exit 1**，實得 executionGrant:true。
5. 擴充 RED／GREEN 同命令：`node_modules\.bin\vitest.cmd run tests\api\quota-atomic-evidence.test.ts -t H1-R1 --reporter=dot`：修補前 **2 failed／13 passed／44 skipped，exit 1**；修補後 **15 passed／44 skipped，exit 0**。
6. 直接回歸：`node_modules\.bin\vitest.cmd run tests\api\quota-atomic-evidence.test.ts tests\api\quota-reservation.test.ts tests\api\cost-registry.test.ts tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts --reporter=dot`：**5 files／162 tests PASS，exit 0**。
7. 隔離核心：`node_modules\.bin\vitest.cmd run tests\api api\_lib --reporter=dot`：**23 files／332 tests PASS，exit 0**，包含既有 registry、HMAC、C1／H2、結算與清理。
8. 型別：`node_modules\.bin\tsc.cmd -b`：**exit 0**；`node_modules\.bin\tsc.cmd --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --types vitest/globals,node --skipLibCheck tests\api\quota-atomic-evidence.test.ts tests\api\cost-registry.test.ts tests\api\quota-reservation.test.ts tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts`：**exit 0**，包含引用的 engine／validation／support／fixtures，未建立暫存 tsconfig。
9. Analyze：本機 Node stdin 唯讀解析 spec 的 FR／SC 定義、tasks 定義與 requirement range／references、全部 005 Markdown 的 Task 引用及 checklist marker；結果如 Metrics，不列為應用測試 PASS。hooks 不存在，無可執行項目。

### 修改位置、限制與停止

- 程式只改 `api/_lib/quota-engine.ts` 的 clock 快照與 estimation→command 比較；測試只改 `tests/api/quota-atomic-evidence.test.ts`（setup 支援注入 clock、新增 15 cases）。
- 文件只在 `spec.md` FR-052、`plan.md` §4.4、`tasks.md` 最新限定批次、此 report 附加補充；沒有覆寫／刪除舊證據。validation、shared-store、mock、registry、HMAC、handler／UI、001–004、套件、環境、部署及 plan.pdf 均未改。
- 時間相等通過正向授權案例，但不豁免價表失效；lease 恰到期／超過均拒絕。跨日／週前進可授權，使用 command 對應原窗口，不把 grant 跨期誤當時鐘倒退。
- 不核定正式秒數；通用 default 與正式逐端點 lease 仍待 T136。沒有 Redis/Lua、真實 provider、handler 外顯、瀏覽器或部署證據。
- **Next Actions／停止**：本批完成並停止，不進入 pipeline 或下一批；正式整合全部既有 gate 保留。測試總數不取代 H1-R1 行為佐證，隔離 mock PASS 不等於真實服務 READY。

## 現行限定批次：C1 收斂＋H1／H2 隔離修補（2026-10-06）

> 本節為本次唯讀 Analyze 完成後，依使用者文件同步授權保存的結果；Analyze 本身不修改來源。以下 C1／H1／H2／M1／M2 指上一輪整合複審，不與後方保留的歷史同名 findings 混淆。本批已獲隔離修補授權；後方初始 Readiness／未授權敘述僅為歷史。**005、真實整合與部署仍非 READY／BLOCKED**。

### Repository Safety Guard 與精確來源

- Root `C:/Users/geste/spec-kit/tokyo-mate`；origin fetch／push `https://github.com/gestertim/tokyo-mate.git`；branch `master`；HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`。index 與 tracked working tree 始終無差異。開始 **39** 個 untracked，新增 evidence test 後 **40** 個，原成果全部保留；進度訊息「36」為計數誤記，不作證據。
- baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`，peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`；未移動。plan.pdf 保留 728,757 bytes，SHA-256 `0A3D951ECED180AF04B665CADF0D92B09A71861B563E1A84CF6A1EFE5A552FFB` 與前批一致。`.vscode` 不存在，未建立；`.specify/extensions.yml` 不存在，implement／analyze 前後 hooks 無可執行項目。
- 治理來源：[Constitution](../../../.specify/memory/constitution.md) I（L21）、VII（L49）、IX（L57）、X（L61）、XI（L66）、XIII（L77）與 Delivery and Quality Gates（L120）；[repo instructions](../../../.github/copilot-instructions.md) Implementation Authorization（L34）、Repository Safety（L42）、Incremental Implementation（L130）、Baseline Protection（L138）；[local-only ignore](../../../.gitignore) L18–21。上述規則未修改。
- 批准來源為本次使用者「C1 收斂＋H1／H2 隔離修補」訊息及確認保留 12 項 gate 的續行訊息：超額如實入帳、原 API 503、內部完成不得當成對外成功。本次不重問 C1、不執行 T135／T025、不建立 pipeline、不接 handler／UI／查詢、不連外、不安裝、不提交或部署。

### Specification Analysis Report

| ID | 類別 | 嚴重度／狀態 | 位置 | 摘要 | 剩餘界線 |
| --- | --- | --- | --- | --- | --- |
| C1（本輪） | 跨文件語意 | **隔離已收斂** | FR-056／SC-016；plan §4.4；error contract C1；data-model §16.1；UX；T022／T137 | 正常 `accounted` 不含通用 ok:true；超額 `accounted_cost_bound_exceeded` 完整入帳且同次雙封鎖佐證、ok:false／503；矛盾佐證 503 不推論未入帳、不退款、不重送 | 原付費 API 503 是已批准契約，handler 實際外顯尚未實作／測試 |
| H1（本輪） | 新授權 lease | **隔離已修補** | engine／validation；T021／T136 子範圍 | createdAt＝可信 command 時間；expires＝command＋注入 lease；授權時已到期或時鐘倒退拒絕；歷史預留仍可過期讀取／結算 | 正式 lease、逐端點 timeout／緩衝與通用 default 移除未完成，T136 未勾選 |
| H2（本輪） | 原子記帳佐證 | **隔離已修補** | SharedStore／validation／engine／mock；T022／T137／T138 子範圍 | applied／already_applied／lease_expired／conflict／late-result 同次核對原 reservation、usage、身分與原日週窗口、轉移；settled used ≥ charge、uncertain reserved ≥ reserve；cleanup 逐筆佐證與 count／歸屬／保留總量驗證 | Redis adapter 須實作新原子結果契約，沒有真實原子性證據 |
| M1（本輪） | registry 快照回歸 | **回歸通過，無多餘程式改動** | cost-registry test；FR-051／T140 | 估算後到預留間修改原 registry 物件不污染已驗證快照；現有 structuredClone 已正確 | 真實 registry／批准資料與 handler 綁定未完成 |
| M2（本輪） | 競態與恢復回歸 | **memory mock 通過** | evidence／reconciliation tests；T137／T138 | 同時發起兩種 cleanup／settle 原子順序；partial／timeout cleanup 重跑；settle timeout 後延遲成功同語意重送；跨日週、不二次執行 | 不代表 Redis、排程或可信 provider 對帳 |
| G1 | 權威 G 整合 | **HIGH／OPEN（既有整合 gate）** | spec 政策11；plan §4.5；data-model §4；T131／T134／T140 | 文件明確依當下 registry／價表、效期、實際啟用、版本／摘要封鎖計算；非建置期固定值、非 fixture 門檻 | 本批不接正式權威來源／圖磚 gate，既有 threshold 僅 fixture 證據 |
| I1 | 真實技術與端點證據 | **HIGH／OPEN（既有）** | T019／T025／T135／T136／T138／T140–T142 | 真實 Redis/Lua、逐端點參數、單次 SDK 嘗試、資格優先與對外信封、pipeline／查詢未完成 | 全部保持未完成／部分完成；不得因本批通過勾選整項 |
| I2 | 正式啟用與隱私政策 | **既有 Gate 保留** | B1–B4；T133；data-model §15；checklist | A1／A3–A7、真實上界、外部帳戶／預算、TTL／key／輪替及實際瀏覽器證據未取得 | 六端點 production live:false；71／83 checklist，12 項未勾選；plan.pdf 保留非正式來源 |

### Coverage Summary

| Requirement | 有 Task | Task | 本批證據／未做項目 |
| --- | --- | --- | --- |
| FR-051 | 是 | T140（部分） | M1 registry 原物件修改回歸；非真實上界 |
| FR-052／SC-015 | 是 | T021／T136（部分）／T138（部分）／T019（部分） | 新授權 lease、cleanup／跨期／timeout；正式 lease、Redis、排程未做 |
| FR-053／FR-056／SC-016 | 是 | T022／T137／T138（部分） | C1 獨立狀態、雙封鎖、原子 usage／歸屬／轉移、晚到與冪等重送 |
| FR-049／SC-013 | 是 | T025／T026／T140／T141 | 只建立內部503契約，未實作原 API handler 回應 |
| FR-050／FR-055／SC-014 | 是 | T025／T028／T141／T142 | duplicate 不二次 grant 回歸保留；資格優先／查詢未接線 |
| FR-054／SC-017 | 是 | T139／T140 | 既有 HMAC／最小化回歸保留；正式 key／權限／TTL 未做 |

### Constitution 與機械核對

- C1 產品契約先同步，再取得 RED／修補／驗證，對應 I／VII／IX；只在明確授權的隔離範圍工作，不把 Analyze 當 implementation 授權，符合 XI。無新 stack、dependency、服務、秘密或個資儲存；production Map 不存在，符合 II／V／VI／VIII／X／XIII；繁中交付符合 XII。
- 本批未新增 MUST 衝突、未新增 CRITICAL、未新增未映射實作工作。T136 隔離依賴 T023／T021／T019 契約及注入設定，不依賴 T025／T135；正式部分仍依賴整合，checkbox 不勾選。T019／T138／T140 部分狀態保留。FR-052 的「不得據 timeout 重試寫入」仍有效：本批測試的清理重跑／同語意重送是明確再次發起的冪等驗證，不是引擎在 timeout 後自動或盲目重試；引擎沒有自動重試。
- 唯讀 Node 機械檢查：**FR 56＋SC 17＝73**；**142** 個 Task 定義且唯一；005 Markdown 懸空 Task 引用 **0**；Tasks 含追溯總表之引用覆蓋 **73／73**（100% 引用覆蓋，非實作完成率／非應用 PASS）。新增歧義 **0**、新增重複需求 **0**；未映射工作 **0**（新增 test 對應 T136／T137／T138，registry test 對應 T140）。正式整合 B1–B4 等 gate 不消失。
- 12 個正式 gate 已經使用者再次同意保留；checklist markers 無更動。Analyze／文件解析不列應用測試 PASS，完整功能驗收仍待測。歷史章節及歷史同名 findings 保留，以本節限定範圍為本批狀態。

### 實際命令與測試結果

1. `git --no-pager rev-parse --show-toplevel`、`remote -v`、`branch --show-current`、`rev-parse HEAD`、`status --short --untracked-files=all`、`diff --cached --stat`、`diff --stat`、`rev-parse 'mvp-safe-baseline^{commit}'`：開始／結束 Safety Guard 如上，未 add／commit／push。
2. `.specify\scripts\powershell\check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks`：開始及 Analyze 初始化 exit 0，FEATURE_DIR 正確；hooks 無可執行項目。
3. IDE `runTests` 未找到 tests，改本機 CLI；沒有 npx／套件下載。本機 `node_modules\.bin\vitest.cmd run tests\api\quota-atomic-evidence.test.ts tests\api\cost-registry.test.ts --reporter=dot`：**RED 27 failed／48 passed，2 files，exit 1**；M1 通過。
4. `node_modules\.bin\vitest.cmd run tests\api\quota-atomic-evidence.test.ts tests\api\cost-registry.test.ts tests\api\quota-reservation.test.ts tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts --reporter=dot`：首次 13 failed／121 passed（舊 ok:true 斷言），契約同步後 **5 files／134 tests PASS**。再增加雙窗口／轉移／cleanup scope 測試，包含於下列最終回歸。
5. `node_modules\.bin\vitest.cmd run tests\api api\_lib --reporter=dot`：最終 **23 files／317 tests PASS，exit 0**。新增 evidence **44 cases**＋registry **1 case**＝新增 **45 cases**。記帳／預留／雙封鎖斷言保留，非只測結果形狀。
6. `node_modules\.bin\tsc.cmd -b`：最終 **exit 0**。
7. `node_modules\.bin\tsc.cmd --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --types vitest/globals,node --skipLibCheck tests\api\quota-atomic-evidence.test.ts tests\api\cost-registry.test.ts tests\api\quota-reservation.test.ts tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts`：最終 **exit 0**；首輪缺新 scope 與舊 ok narrowing 已修正。涵蓋本批新測試及引用 fixtures／support，未建立暫存 tsconfig。
8. 本機 Node stdin 唯讀解析 FR／SC、Task ID／range 與引用：文件核對結果如上，不是應用測試。

### 修改檔案與停止

- 隔離模組：`api/_lib/quota-engine.ts`、`quota-validation.ts`、`shared-store.ts`；mock：`tests/support/in-memory-shared-store.ts`。
- 測試：新增 `tests/api/quota-atomic-evidence.test.ts`；修改 `cost-registry.test.ts`、`quota-reservation.test.ts`、`settlement-idempotency.test.ts`、`reservation-reconciliation.test.ts`。registry production 模組／fixtures／dependencies 未改。
- 005 文件：spec、plan、data-model、UX、error／protected contracts、tasks、quickstart、requirements checklist（只說明、不動 markers）、本 Analyze report。
- 六 handler／openai.ts／UI／Service Worker／環境／部署設定與 specs 001–004 均未改。**真實服務證據：本批沒有取得；端點外顯／Redis／瀏覽器／部署：未測**。mock 競態不是 Redis 證據；SDK attempts metadata 不是 T135 證據。
- **Next Actions／停止**：本批完成後停止；如需後續工作須另行授權與整合 gate，不自動修補正式參數、不建立 pipeline／handler／UI／服務，不作狀態查詢、不連外、不提交／部署。功能 005／真實整合／部署維持非 READY。

---

**Implementation Readiness Gate（分範圍）**：

| 範圍 | 判定 |
| --- | --- |
| 一、第一批本機 mock 實作（plan §10.3.5） | **可授權審閱**；待使用者明確批准 `/speckit.implement` 此批次 |
| 二、真實服務整合 | **BLOCKED** |
| 三、完整功能驗收／部署 | **BLOCKED** |

本報告不是 implementation 授權；所有應用程式測試維持「待測」。

## 執行方式

- 本輪先人工同步文件（plan、tasks、spec、ux、contracts、research、data-model、quickstart、requirements checklist），之後才機械重算本報告。Analyze 本身唯讀。
- 機械檢查：tasks.md 定義 T001–T135 共 135 個、無重複；全部 005 文件中的 `T###` 引用皆有定義（懸空 ID＝0）；spec.md 為 FR 48＋SC 12＝60，皆被 tasks.md 以 ID 或範圍引用（僅代表有任務對應，不代表已實作或測試）。
- 本輪無修改 `api/`、`src/`、`public/`，無安裝套件、無付費 API 呼叫、無 commit；`plan.pdf` 保留，未重新產生。

## 四項決策同步結果

| 決策 | 狀態 | 已同步文件 | 仍待 |
| --- | --- | --- | --- |
| A2：停用 SDK 自動重試（A＝1；A＝3 撤回） | 規劃已核准 | plan §4.2.1／§4.2.6、tasks T135／T126、contracts、research、quickstart | 前提待證明：`maxRetries: 0` 生效、一次使用者操作上游嘗試數 ≤ 1（T135，待測）；平台層重送與逾時計費未查得，保守 `uncertain` |
| A8：G-B（G-A／C／D／E 撤回） | 規劃已核准 | plan §4.5、tasks T131／T134、contracts、data-model、quickstart、ux | 數值待 A1；8,036 僅 mock fixture，非已驗證門檻 |
| A9：speech＝S1（S2–S5 撤回） | 規劃已核准（維持受阻，可 mock） | plan §4.2.4、tasks T132、contracts、research | 外部整合：官方輸出上界未查得（T133） |
| A10：transcribe＝P1（P2–P4 撤回） | 規劃已核准 | plan §4.2.4.1、tasks T127／T128、contracts、research、ux、quickstart | 外部整合待驗證：後端驗證實作（待測）與 Chrome／Safari／Firefox 16 kHz 可行性（MDN 指 `sampleRate` 不支援會丟 `NotSupportedError`） |

## Findings

| ID | 類別 | 嚴重度 | 位置 | 摘要 | 影響範圍 |
| --- | --- | --- | --- | --- | --- |
| B1 | Blocker | CRITICAL（Gate） | plan §10.3.2 | A1、A3–A7 數值／行為未核准（A1＝上限、`max_output_tokens`、timeout、`detail`、白名單；A3 時長；A4 影像；A5–A7 其餘） | 範圍二、三。範圍一以 fixture＋production `live: false` 隔離，**不阻擋** |
| B2 | Blocker | HIGH | plan §4.2.3 表二 | 成本上界前提（tile 上限、Fast／區域係數、`max_output_tokens` 不誤傷等）待證明 | 範圍二、三；範圍一不得宣稱真實上界成立 |
| B3 | Blocker | HIGH | plan §10.3.4、T133 | speech 上界、vision usage、真實瀏覽器 16 kHz、供應商預算證據未取得 | 範圍二、三；不阻擋 mock |
| B4 | Approval | HIGH | A10、spec FR-044／FR-025 | 語音行為變更與 spec 措辭（A6 兩種全域不可用文案）需使用者確認 | 範圍二、三（T128 前端不屬第一批） |
| B5 | Blocker | 非 Critical／High | 外部帳戶、靜態示意圖資產 D1–D4 | OIDC、Upstash、Geoapify、OpenAI 預算；圖片未入庫 | 僅範圍二、三；**不阻擋**範圍一 |
| M1 | Staleness | MEDIUM | `plan.pdf` | 與更新後 plan.md 不一致，依指示保留不重生成 | 範圍三 |
| M2 | Inconsistency | MEDIUM | research／plan | whisper-1／gpt-4o-mini-tts 停用日期未重查；OpenAI STT 指南現推薦 `gpt-transcribe`（模型白名單屬 A1） | 範圍二 |
| L1 | Terminology | LOW | 各文件 | 既有文件含「2026-10-07」字樣，系統日期為 2026-10-06 | 無 |
| L2 | Ordering | LOW | tasks.md | T126／T130／T131／T134／T135 編號大於 Phase 2 後段，依賴已說明 | 無 |

已解決：上一輪 C1–C5（懸空引用、speech／transcribe 假設上界、G 不可算、FR-044 口徑、checklist 過時）仍成立；上一輪 M4（錯誤碼未列入契約）已於 error-and-quota-contract 新增 `COST_MODEL_INVALID`／`COST_MODEL_UNSUPPORTED`／`COST_BOUND_UNPROVEN`。

## Metrics

- FR＋SC：60（FR 48、SC 12）；有任務對應：60
- Tasks：135（T001–T135）；懸空引用：0
- Critical：1（B1，限範圍二／三）；High：3（B2、B3、B4）；Medium：2；Low：2
- 憲章衝突：未發現新的 MUST 衝突（新 dependency、語音行為變更均未自行採用）

## R1 第一批 mock 審查修補（2026-10-06）

> 本段的 H1／H2／M1–M4 為「程式審查」ID，與上方 Findings 表的 M1／M2 不同；舊 ID 不改寫。

| 審查 ID | 處置（僅 mock／隔離模組） | 證據（`tests/api/quota-reservation.test.ts` 等） | 剩餘 |
| --- | --- | --- | --- |
| H1 週追加／撤銷／預留 TOCTOU | `reserve` 於 store 同一原子操作判斷資格、tier、當週有效追加與預留；新增 `addTopUp`／`revokeTopUp`／`setEligibility`／`readQuota`；引擎只呼叫 `store.reserve` 一次 | spy 證明不先讀追加；追加前拒絕／後放行；撤銷後新預留看到較低上限且既有預留不追溯；追加／撤銷／預留並發不變式；追加冪等與衝突；追加不跨週；資格 403 與 tier 變更 | Lua／transaction adapter 未完成，mock 原子性≠Redis |
| H2 重複預留第二次執行權 | `executionGrant` 僅建立預留那次；`duplicate` 在 reserved／settled／released／uncertain／lease 到期／跨週皆不放行；同鍵不同內容 409 並記 `conflictCount` 等 | 10 併發恰一個 grant；各終態 duplicate 且餘額不變；衝突四種變體 | 真實 store 需同樣原子語意 |
| M1 請求指紋 | `quota-fingerprint.ts`（SHA-256 canonical；只存雜湊） | 稽核資料 dump 不含原文；canonical／欄位變動測試 | handler 如何取得 `contentDigest` 屬接線批次 |
| M2 價表版本／有效期 | 價表 `effectiveFrom`／`expiresAt`（[from, until)）；引擎、估算器、threshold 皆檢查；production 為空區間 | 邊界測試、早於／晚於區間 503 `COST_MODEL_INVALID`、estimator `now` | 真實價表日期待 A1 核准 |
| M3 執行期驗證 | `quota-validation.ts`＋引擎全面驗證；BigInt 加總／餘額；結算超額如實計入並封鎖價表版本 | 竄改 identity／金額／指紋／status／窗口／usage／limits／denied／duplicate／null 回傳皆 503 `INVALID_STORE_DATA`；超額與封鎖；溢位 | 無 |
| M4 中斷與 lease | `leaseExpiresAt`；逾期只轉 `uncertain`（不退款不重放）；`expireLeases`；晚到結果只記錄 | lease 到期後成功／失敗、邊界、sweep、晚到成功、settle 逾時 fail closed | 人工處置 uncertain 的機制與 lease 長度（須大於上游逾時）待後續批次與 A1 |

驗證：`npx vitest run tests/api api/_lib`＝18 files／208 tests 通過；`npx tsc -b` exit 0；暫存 tsconfig 檢查 `api`＋`tests` exit 0（已刪除）。T019 維持部分完成、T135 未執行；範圍二、三仍 **BLOCKED**；未接線六個 handler、未動 UI／`openai.ts`／套件／環境，未連外、未 commit。
## Git 狀態

- 開始：`master`，HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`，僅 `?? specs/005-api-protection-access-modes/`。
- R1 修補後：`master`，HEAD `3afb239a…` 不變，`mvp-safe-baseline` 仍為 `fb09a411…`；僅 untracked 的 005 檔案（`api/_lib` 新增 `quota-fingerprint.ts`、`quota-validation.ts`）與測試／文件變動；未 add／commit／push。

## Next Actions

請審閱 plan.md §10.3.5 第一批 mock 方案。批准後才可進入 `/speckit.implement`（僅該批次）。目前不得實作。

---

## 005 文件收斂＋Analyze（2026-10-06，本輪唯讀複核）

> 本節為本輪增補，專門對照「審查 findings A1–A12」。  
> **A1–A12 為歷史審查 finding ID，非 plan.md 的 A1–A10 決策代號。**

### Repository Safety Guard

- Git 現況：`master...origin/master`，僅 untracked（含 `specs/005-api-protection-access-modes/` 與既有 mock/測試檔）；未刪除任何 untracked 檔。
- `plan.pdf` 保留未改。
- prerequisites：`.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` 成功，`FEATURE_DIR=specs/005-api-protection-access-modes`。
- `.specify/extensions.yml` 不存在，無 analyze hook。

### A1–A12 來源與逐項狀態（四欄分離）

| Finding | 來源（本輪採信） | 文件同步 | 程式修補 | mock 測試證據 | 真實整合證據 |
| --- | --- | --- | --- | --- | --- |
| A1 Coverage gap | 本 Chat「歷史唯讀複審交接」 | 已同步（FR-049～FR-056、SC-013～SC-017） | 部分（多數尚未接線） | 部分（歷史 mock） | 無（BLOCKED） |
| A2 Inconsistency | 同上 | 已同步（外部 503 統一） | 部分（pipeline 未接線） | 部分 | 無 |
| A3 409 UX underspec | 同上 | 已同步（兩種 409 文案） | 部分（查詢契約待 T142） | 部分 | 無 |
| A4 Trusted registry/estimator 綁定 | 同上 | 已同步 | 未完成（T140 待做） | 無獨立證據 | 無 |
| A5 Lease/uncertain/cleanup | 同上 | 已同步（逐端點 lease 原則） | 部分（仍有 `DEFAULT_LEASE_MS=120000`） | 部分（lease 測試在 quota-reservation） | 無 |
| A6 Data model 欄位 | 同上 | 已同步（data-model 補欄位） | 部分（實際持久層待做） | 部分 | 無 |
| A7 Privacy/HMAC/allowlist | 同上 | 已同步 | 未完成（`quota-fingerprint.ts` 仍 SHA-256 非 HMAC） | 無（對應測試檔尚未建立） | 無 |
| A8 Orphan reservation/timeout reconciliation | 同上 | 已同步 | 部分（`expireLeases` 存在，完整對帳語意待 T138） | 部分 | 無 |
| A9 測試 provenance staleness | 同上＋本輪校正 | 已同步（已改為歷史回報註記） | N/A | N/A | N/A |
| A10 Redis/Lua evidence gap | 同上 | 已同步（T019 部分完成註記） | 未完成（真實 adapter 未完成） | 僅 mock | 無（BLOCKED） |
| A11 資格優先序 | 同上 | 已同步（契約要求資格優先） | 部分（需 pipeline 驗證） | 部分 | 無 |
| A12 blocked version / already_applied 語意 | 同上 | 已同步 | 部分（already_applied 僅部分核對） | 部分 | 無 |

> 判定原則：文件同步≠程式缺陷已關閉；mock 證據≠真實整合證據。

### 歷史測試 provenance 修正（本輪不重跑）

- `180 tests`：歷史回報，`node_modules\.bin\vitest.cmd run tests/api api/_lib`，18 files／180 tests。
- `208 tests`：歷史回報，`npx vitest run tests/api api/_lib`，18 files／208 tests。
- `529 tests`：歷史回報來源更正為先前 Chat 記錄：`vitest.cmd run` 全套件，52 files／529 tests，exit 0。
- 限制：本輪未重跑、未獨立核驗；目前 repository 內無該次 529 的原始 console log 附件，因此不可標示為本輪 PASS。

### T136–T142 依賴重判（本輪修正）

1. 真實 Redis/Lua 證據（T019 完成態）**阻擋真實整合 readiness**，但**不阻擋隔離 mock 修補設計與測試注入**。  
2. T136 已改註：隔離 mock 可用注入式測試設定驗證逐端點 lease 映射；未核准秒數不得導向 production 啟用。  
3. lease 任務（T136/T138）不再要求先執行 T135；T135 維持獨立待辦。  
4. 下列可作為下一批最小 mock 修補：T137（重複結算語意）、T138（孤兒預留清理/對帳語意）、T139（HMAC/allowlist）、T140（trusted registry 綁定）、T141（409/503 映射驗證）；T142 保持契約先行。

### Analyze 分離判定（本輪）

| 面向 | 判定 | 說明 |
| --- | --- | --- |
| 文件一致性 | **部分 READY** | A1–A12 對應條文大多已寫入 spec/plan/tasks/contracts，但仍有歷史段落需持續去陳（本節已補主要來源與 provenance） |
| 隔離 mock 修補 readiness | **READY（待授權）** | 可在不接線 handler、不跑 T135、不連外前提下執行最小 mock 修補批次 |
| 真實整合 readiness | **BLOCKED** | T019 真實 Redis/Lua 證據、外部整合批准、production 參數核准與驗證均未完成 |

### 下一批「最小 mock 修補」提案（僅提案，不授權執行）

1. **Batch-M1：結算一致性與孤兒清理語意（隔離）**  
   - 任務：T137、T138  
   - 檔案：`api/_lib/quota-engine.ts`、`api/_lib/shared-store.ts`、`tests/api/settlement-idempotency.test.ts`、`tests/api/reservation-reconciliation.test.ts`
2. **Batch-M2：隱私指紋與估算輸入最小化（隔離）**  
   - 任務：T139  
   - 檔案：`api/_lib/quota-fingerprint.ts`、`api/_lib/quota-engine.ts`、`tests/api/quota-fingerprint.test.ts`
3. **Batch-M3：可信 registry 與錯誤映射（隔離到 pipeline 測試）**  
   - 任務：T140、T141、T142（先契約）  
   - 檔案：`api/_lib/protected-endpoint-pipeline.ts`、`contracts/error-and-quota-contract.md`、`tests/api/cost-registry-pipeline.test.ts`、`tests/api/protected-endpoint-pipeline.test.ts`、`tests/api/error-envelope.test.ts`

> 停止點：本輪僅完成文件收斂與 Analyze；未執行應用程式測試、未標示測試 PASS、未進入實作授權。

---

## 2026-10-06 Batch-M1 Analyze（T137／T138 隔離 mock）

### 本輪範圍與一致性判定

- 依最新 `spec.md`、`plan.md`、`tasks.md`、`data-model.md` 與 quota contract 核對：T137 對應 FR-053／FR-056／SC-016、plan §4.4／§10.4、data-model §15–16；T138 的清理語意對應 FR-052／FR-053／SC-015／SC-016 與相同設計章節，未發現本批新增的產品規格衝突。
- 重新計數：56 個 FR、17 個 SC、142 個唯一 Task ID；FR／SC 均可在 Tasks 找到對應。requirements checklist 為 83 項，71 項已勾選、12 項未勾選；保留未完成狀態。
- **T137 狀態**：隔離 engine／store contract／memory mock 一致性已由本輪測試驗證。相同 transition、結算金額、reason 與 settlement model version 才回 `already_applied`；不同語意回衝突且不變更額度。超額只有在 store 同原子結果提供相符 `blockedCostModelVersion` 時才回成功形狀。此結論限 mock，並不代表 provider atomicity。
- **T138 狀態**：只驗證 mock 清理子範圍。timeout 後延遲成功的 reserve 能由清理轉 `uncertain`；到期預留留在原日／週窗口，不退款、不重放；晚到結果不改額度；重複清理冪等。兩種 settle／cleanup 順序皆有測試。

### 本輪 Findings 狀態

| Finding／事項 | 狀態 | 證據與限制 |
| --- | --- | --- |
| T137 重複結算語意 | mock 範圍已處理 | `SETTLEMENT_CONFLICT`、不一致 store 回傳 fail-closed、重複超額封鎖佐證均有本機測試；沒有 Redis/Lua 證據 |
| A8／T138 timeout、孤兒預留與清理 | mock 範圍部分處理 | 測試涵蓋 timeout 後 reserve 延遲成功、跨日／週、晚到成功／失敗及兩種操作順序；provider-side 實作及可信對帳仍未完成 |
| T019／Redis atomicity | **OPEN／BLOCKED** | 目前僅 in-memory mock 的單一 JS 執行緒證據；未驗證 Redis/Lua、key/hash-slot 或跨 writer 原子操作 |
| T136 正式逐端點 lease | **OPEN** | 本輪僅注入測試時鐘與測試 lease；未核定正式秒數，既有通用預設未移除 |
| A4／T139 HMAC 與欄位 allowlist | **OPEN／未處理** | Batch-M2 不在授權範圍 |
| T135 SDK 單次上游嘗試 | **OPEN／未執行** | 本輪未修改 `openai.ts` 或相關 handler |
| T140–T142 pipeline／409 接線／查詢契約 | **OPEN／未處理** | Batch-M3 不在授權範圍；未接線 handler |

### 本輪驗證證據

- `node_modules\.bin\vitest.cmd run tests\api\quota-reservation.test.ts tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts`：3 files／59 tests 通過。
- `node_modules\.bin\vitest.cmd run tests\api api\_lib`：20 files／216 tests 通過。
- `node_modules\.bin\tsc.cmd -b`：exit 0。
- `node_modules\.bin\tsc.cmd --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --types vitest/globals,node --skipLibCheck tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts tests\support\in-memory-shared-store.ts`：exit 0。
- Repository Safety Guard：root `C:/Users/geste/spec-kit/tokyo-mate`；remote `origin https://github.com/gestertim/tokyo-mate.git`；branch `master`；HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`；baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`，peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`。Analyze 前 index 空；既有 untracked 檔案全部保留。

### Readiness 與停止點

Batch-M1 的 T137 mock 子工作完成；T138 仍為部分完成且 checkbox 保持未勾選。T019、T136、A4／HMAC、production lease、Redis adapter 與真實服務證據均未完成。production 價表未變更，六端點仍 `live:false`。功能 005 整體不標 READY。未執行 T135、Batch-M2／M3、handler 接線、外部呼叫、commit 或 deploy；本輪至此停止。

---

## 2026-10-06 Batch-M2 Analyze（T139；僅隔離 mock）

> 本節保存已完成的唯讀 Analyze 結果；證據同步為使用者本批已授權的文件動作，Analyze 本身不修改來源。歷史段落保留，最新狀態以本節為準。歷史 M1 在此指 R1「請求指紋」finding，不是 PDF staleness 或管理者來源 M1；A7 為 HMAC／allowlist，A4 則是可信 registry，兩者不可混用。

### 範圍、契約與 Constitution

- 批准限 T139；使用者同意保留 12 個未勾選 checklist 項目，並核准 `reserve(request, trustedCost)` 分離參數與 fixture 上限方案。FR-054／SC-017 → plan §10.4.1 → data-model §15.1 → T139 → quota-fingerprint tests／store dump 檢查追溯成立。
- 原始內容僅進記憶體 typed canonical／HMAC。model／billing tier／attempts 只在可信參數，request 或 estimateInputs 冒用即拒絕。每個數值欄位的上限必須注入；不從 fixture 建立 production fallback。speech 仍不授予執行權。
- Node 內建 crypto 不增加 dependency／架構；無正式 key、環境讀取、TTL 或輪替政策。Constitution I／VI／VII／IX／X／XI 的來源、隱私、驗證、分批、Safety 與授權界線符合本批；XIII 的真實共享原子性、來源驗證與 pipeline 保護仍是整合 gate，不能由 mock 代替。

### Findings／剩餘限制

| ID | 類別 | 嚴重度 | 位置 | 結論 | 後續 |
| --- | --- | --- | --- | --- | --- |
| A7／歷史 M1 | 隱私／指紋 | 本批隔離缺口已處理 | quota-fingerprint／engine／validation；data-model §15.1 | HMAC、型別穩定 canonical、allowlist、key 缺漏／可信設定 fail closed、store／audit dump 最小化均有測試；只有最終 HMAC 進 store | 正式讀取權限／稽核管道／持久層仍未接線，不宣稱整體 finding 已 production 關閉 |
| A4 | 可信來源 | HIGH（既有） | FR-051、plan §10.4、T140 | 分離參數不證明 registry／估算器來源、live／核准／blocked 綁定；仍 OPEN | Batch-M3 須另取得授權，本批不做 |
| A10／T019 | 真實原子性 | HIGH（既有） | T019、SharedStore | 只有 memory mock 單一 JS 執行緒；無 Redis/Lua、hash-slot、多 writer 證據 | 真實整合 BLOCKED |
| A8／T138 | 對帳／清理 | 既有部分完成 | FR-052～FR-053、T138 | Batch-M1 行為回歸通過；provider-side 可信對帳仍缺 | checkbox 保持未勾選 |
| T136／T135 | 執行前提 | 既有 OPEN | lease 設定／SDK | 正式逐端點 lease 與實際上游 attempts 未驗證；fingerprint 的 attempts＝1 不能當成 SDK 單次嘗試證據 | 不執行 T135，不核定秒數 |
| P-M2-01 | 未決政策 | MEDIUM（整合前） | FR-054、data-model §15 | key provisioning／輪替、保存期限／TTL、跨 key 或 v1→v2 冪等性未決；key version 只供版本化 | 不自行定案，不宣稱跨輪替已驗證 |

本批未發現新增的 MUST 衝突、CRITICAL blocker、重複需求或未分派工作。既有 production 上限／外部證據／正式批准等 Gate blocker 不因本次測試消失；完整功能與真實整合維持 **非 READY／BLOCKED**。

### Coverage Summary

| Requirement | 有 Task | Task | 本輪證據／界線 |
| --- | --- | --- | --- |
| FR-054／SC-017 | 是 | T139 | 13 個 T139 測試、store command／dump 不含原始內容或 key；正式存取權限仍待整合 |
| FR-053／SC-016 | 是 | T137／T138 | Batch-M1 結算／清理回歸，非本批新增實作 |
| FR-051 | 是 | T140／T025 | A4 維持 OPEN，本批未執行 |
| FR-052／SC-015 | 是 | T136／T138／T019 | 正式 lease、provider 對帳／原子性仍未完成 |
| FR-049～FR-050／SC-013～SC-014 | 是 | T141／T142／T025～T028 | 內部錯誤原因有文件同步，外部信封／handler／狀態查詢未接線 |

### Metrics

- FR 56、SC 17，共 73 個可建置需求；Task 定義 142 個且唯一；005 文件懸空 Task 引用 0。
- 追溯總表涵蓋 73／73（100%）；只計單個 task 行顯式引用為 57／73，其餘由階段／追溯表與語意映射，不是新增零 coverage。總表分組引用不代表 T139 承擔全部 FR-049～FR-056。
- 本批新增未映射 Task 0；沒有新增需求歧義／重複需求／Constitution CRITICAL 衝突。正式保存／輪替等明列未決事項保持未決，不當成已解決。
- checklist 83：71 已勾、12 未勾（不改）。T139 僅 mock 完成；T019／T138／T135／T140–T142 markers 保持原狀。

### 本輪實際測試與 type-check

- 修補前 `node_modules\.bin\vitest.cmd run tests\api\quota-fingerprint.test.ts`：9 failed／1 passed（RED）。
- 四檔 targeted 命令：`node_modules\.bin\vitest.cmd run tests\api\quota-fingerprint.test.ts tests\api\quota-reservation.test.ts tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts`。迭代中先 3 failed／66 passed（舊 SHA-256／非法 fixture），修正後 4 files／69 tests 通過；再新增 3 個邊界／損壞回傳情境。
- 最終 `node_modules\.bin\vitest.cmd run tests\api api\_lib`：**21 files／229 tests 通過**，包含最終 T139 13 tests。測試只代表本機 mock／程式回歸，非 Redis、真實 API、部署或 production acceptance。
- 最終 `node_modules\.bin\tsc.cmd -b`：exit 0。
- 最終 `node_modules\.bin\tsc.cmd --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --types vitest/globals,node --skipLibCheck tests\api\quota-fingerprint.test.ts tests\api\quota-reservation.test.ts tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts tests\support\in-memory-shared-store.ts tests\support\quota-fixture-engine.ts tests\fixtures\quota-fingerprint-fixtures.ts`：exit 0。
- 本機 Analyze prerequisites 命令 `.specify\scripts\powershell\check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` 成功；另以本機 Node `fs` 唯讀解析 requirement／Task ID、range 與追溯表。無套件下載、外部呼叫或暫存 tsconfig。

### Repository Safety Guard／停止點

Root `C:/Users/geste/spec-kit/tokyo-mate`；origin fetch／push 完整 URL 均為 `https://github.com/gestertim/tokyo-mate.git`；branch `master`；HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`。index 與 tracked working tree 無變更；既有 32 個 untracked 檔案保留，新增 4 個（quota-estimate-inputs、quota-fingerprint test、fingerprint fixture、fixture engine），結束 36 個。baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`，解參照 commit 仍 `fb09a41182bcc639a9335adbd0e1f84405a1bba7`，未移動。plan.pdf／六 handler／openai.ts／UI／Service Worker／套件／環境／部署設定未改；無 add／commit／push／部署，無連外。extensions.yml 不存在，implement／analyze 前後 hooks 均無可執行項目。

**Next Actions／停止**：本批結束，只供審閱；不自動補未決政策、不進入 Batch-M3、不接線 handler 或啟用真實服務。若另行授權，A4／T140、正式資料與 key 政策、T019／T138 真實證據須各自依正式 artifact／approval flow 處理。功能 005 不標 READY。

---

## 2026-10-06 Batch-M3a Analyze（A4；T140 registry 隔離子範圍）

> 本節保存本批唯讀 Analyze 的結果；證據保存依使用者既有文件同步授權另行執行，不是 Analyze 自動修改來源。歷史段落不覆寫，現行 registry 子範圍以本節為準；A4 是歷史 finding，不是成本決策 A4。

### Specification Analysis Report

| ID | 類別 | 嚴重度／狀態 | 位置 | 摘要 | 建議／停止界線 |
| --- | --- | --- | --- | --- | --- |
| A4 | 可信成本契約 | **本批隔離缺口已處理** | spec FR-051；plan §10.4.2；data-model §14.1；T140；cost-registry／engine／store mock | reserve 不再接受任意 trustedCost；options registry 選定參數、內建估算器算金額，後端 stable digest 綁定核准 metadata／HMAC／預留；原子版本與摘要封鎖、同版本同端點不同摘要拒絕均有測試 | 不代表 production finding 已完整關閉；pipeline／handler、正式核准文件與真實成本上界待整合 |
| A10／T019 | 真實原子性 | **HIGH／OPEN（既有）** | shared-store；T019 | Map 僅位於 tests；原子結果仍是單程序 memory mock，同版異摘要／超額封鎖競態不構成 Redis/Lua 證據 | 真實 adapter／key/hash-slot／多 writer／保存策略仍 BLOCKED |
| T135／T136 | 執行與 lease 前提 | **OPEN（既有）** | plan §4.2／§10.4；T135／T136 | attempts metadata＝1 不是 SDK 實際單次嘗試證據；正式逐端點 lease 未核定／實作 | 本批不執行 T135、不核定秒數、不啟用真實服務 |
| T140–T142 | 未做整合 | **OPEN／部分完成（既有）** | T140；contracts；plan §10.4.2 | registry 隔離可先依賴 T126／T023／T021／T022／T139／T019 契約，不依賴 T025／T135；T140 整合仍需要 T025 | T140 未勾選；pipeline、handler、外部錯誤信封、409 接線與狀態查詢全未做 |
| B1–B4 | 正式成本／上界及外部證據 | **既有整合 Gate 保留** | plan §4.2／§10.3；spec FR-049／FR-051 | flags／reference／digest 的吻合只證明程式設定契約；不證明 token、image、PCM 真實上界、官方價格或帳單；speech 仍受阻 | production 六端點 live:false；完整功能與真實整合非 READY／BLOCKED |
| P-M2-01／T138 | 隱私／對帳待決 | **OPEN／部分完成（既有）** | data-model §15；T138 | TTL、正式 key／輪替、跨格式／key 冪等、正式讀取管道與可信對帳未完成 | 保留 gate，不自行指定政策或建立服務 |

### Coverage Summary

| Requirement | 有 Task | Task | 本輪證據／範圍 |
| --- | --- | --- | --- |
| FR-051 | 是 | T140（部分）／T023／T126／T021／T019 | 43 個 registry tests；注入拒絕、metadata／上限／參數綁定、原子封鎖與新版本條件；非真實上界證據 |
| FR-053／FR-056／SC-016 | 是 | T022／T137／T138／T140 | 超額兩種封鎖佐證、到期／封鎖／lookup 故障仍能保守結算；M1 回歸通過，provider 部分未完成 |
| FR-054／SC-017 | 是 | T139／T140 | HMAC 同時綁定成本摘要、allowlist、最小化資料與受損回傳拒絕；M2 回歸通過，正式讀取權限未接線 |
| FR-049／SC-013 | 是 | T025／T026／T140／T141 | 只驗證 engine 內部 fail-closed；對外信封／handler 不在本批 |
| FR-050／FR-055／SC-014 | 是 | T025／T028／T141／T142 | duplicate 無二次 execution grant 回歸保留；Session／handler 優先序與查詢未完成 |
| FR-052／SC-015 | 是 | T019／T136／T138 | M1 cleanup／lease mock 回歸，非正式 lease 或 Redis 證據 |

### Constitution、覆蓋與不一致檢查

- 本批契約追溯：FR-051 → plan §10.4.2 → data-model §14.1／contracts → T140 部分範圍 → cost-registry tests。使用者明確批准介面及成本摘要／原子雙重封鎖；不以 application code 默改已批准產品契約，符合 I／XI。
- 沿用 Node crypto／既有 estimator／HMAC／store，不引入 stack、dependency 或額外 architecture layer，符合 II／V／VIII。內容只在記憶體 HMAC，digest 是成本設定摘要而非內容摘要，符合 VI；metadata 與 getter／未知／矛盾資料 fail closed。
- 本批已經 Implement → Run → Verify → Fix，targeted／回歸／type-check 均通過，符合 VII／IX。Safety Guard 與原未追蹤資產／baseline 保留符合 X；文件以台灣繁中同步符合 XII。XIII 的正式 shared state 與六 handler 逐請求保護仍是整合 gate，不由 mock 或 live flags 宣稱已完成。
- M2 的 `reserve(request, trustedCost)` 只留作歷史紀錄，現行 M3a 入口已明確標示取代；舊「換版本即可放行」測試已更正，未將 allowlist 型別或核准 metadata 宣稱為真實上界證明。未新增 MUST 衝突、核心需求零 coverage 或無對應子工作；未新增任務 ID。
- 機械結果：FR **56**＋SC **17**，Task 定義 **142**且唯一；005 Markdown 懸空 Task ID **0**；Tasks 全文及追溯總表覆蓋 **73／73（100% 引用覆蓋，非實作完成率）**。本批新增歧義 **0**、新增重複需求 **0**、本隔離範圍新增 CRITICAL **0**；既有整合 Gate 不消失。requirements checklist **71／83**，**12**項未勾選，使用者同意保留；T019／T138／T140／T135 均未勾選。

### 本輪實際驗證

- `node_modules\.bin\vitest.cmd run tests\api\cost-registry.test.ts tests\api\quota-fingerprint.test.ts tests\api\quota-reservation.test.ts tests\api\cost-estimators.test.ts tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts`：最終 **6 files／139 tests PASS**（registry 43 tests）。
- `node_modules\.bin\vitest.cmd run tests\api api\_lib`：最終 **22 files／272 tests PASS**。
- `node_modules\.bin\tsc.cmd -b`：最終 exit **0**。
- `node_modules\.bin\tsc.cmd --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --types vitest/globals,node --skipLibCheck tests\api\cost-registry.test.ts tests\api\quota-fingerprint.test.ts tests\api\quota-reservation.test.ts tests\api\cost-estimators.test.ts tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts tests\fixtures\cost-registry-fixtures.ts tests\support\quota-fixture-engine.ts tests\support\in-memory-shared-store.ts`：最終 exit **0**。
- Analyze prerequisites `.specify\scripts\powershell\check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` 成功；以本機 Python stdin 唯讀解析 FR／SC、Task 定義／範圍引用及 checklist，無暫存檔、套件安裝或連外。IDE runTests 無法辨識 runner、前兩輪 targeted 失敗與修正紀錄見 tasks Batch-M3a，不以失敗輪次當 PASS。

### Repository Safety Guard／停止點

- 開始與結束：root `C:/Users/geste/spec-kit/tokyo-mate`、remote origin fetch／push `https://github.com/gestertim/tokyo-mate.git`、branch master、HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`；index 空、tracked working tree 無差異。原 **36** 個 untracked 檔案全保留，新 registry／test／fixture **3**檔後共 **39**。完整修改檔案清單與精確命令見 tasks Batch-M3a。
- baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`、peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7` 不變；plan.pdf 保留，728,757 bytes，未重產。production 價表未變，六端點 live:false；正式 store 未加入 Map。
- 未執行 T135；沒有 pipeline、狀態查詢、handler 接線、UI、Service Worker、套件、環境或部署設定變更；未連外、add／commit／push／部署。extensions.yml 不存在，implement／analyze 前後 hooks 均無可執行項目。

**Next Actions／停止**：A4 **程式契約的隔離修補完成**，但**真實成本上界尚未證明**；T140 **部分完成**，功能 005／真實整合／部署 **非 READY／BLOCKED**。本批停止，不自動執行任何整合或剩餘工作；後續只能另行取得對應 artifact／approval flow 授權。