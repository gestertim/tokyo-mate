# 005｜隔離 pipeline 實作前方案與 Readiness Gate

## 2026-10-08 六端點隔離 mock-success 子範圍批准（本次現行）

使用者核准 Plan／protected-endpoints contract 的最小補充，限於 T146 本機隔離子範圍：`assistant`、`transcribe`、`places`、`photo-ocr`、`photo-translate` 使用 `TEST_ONLY` descriptor／合成 accounting fixture，驗證 Request→有界輸入驗證→同一原子 reserve→mock upstream→settle→Response；`speech` 僅驗證 input／mock 行為，不 grant、不 settle、不呼叫真實 provider。該 fixture 不代表可信真實成本上界、D01 或正式端點參數批准。

五個端點由各自 `createHandler` factory 注入 TEST_ONLY pipeline 的拒絕與成功路徑、speech mock-only 例外及未配置 production `POST` fail-closed 已通過針對性驗證：7 API files／164 tests、`tsc -b` exit 0。這僅是本機子範圍驗收，不是全功能 Analyze／正式 Readiness READY，也不關閉 12 項正式 gate。

本子範圍不改 `PRODUCTION_COST_PRICE_TABLE`、不把 fixtures 載入 production registry、不設定 endpoint live、無新 dependency／環境／秘密／外部服務。production 六端點 `live:false`、speech 真實呼叫受阻及 requirements 12 項未完成 gate 保留；不表示功能 005、T146 整項、真實整合或正式 Readiness READY。測試與命令以最新本機證據記錄。

## 2026-10-07 T152 文件結案核對（本次現行）

依[Tasks原定義與結案](../tasks.md#2026-10-07-t152-本機父任務結案本次現行)、[契約§10](../contracts/request-epoch-and-key-lifecycle.md#10-本機實作驗收矩陣本輪執行真實服務項仍未驗)及[本次證據](../../../docs/verification/005-local-implementation-evidence.md)，T155～T161完成足以結案T152本機父任務與implementation子項。核對既存JSON reports及最後Safety manifest，不重跑測試；本次結果僅為文件一致性／引用／修改範圍核對，**不是應用測試PASS，也不是重新Analyze或正式Readiness通過**。

T149／T150部署子範圍、T151／D01成本與帳單、T153／D14真實Redis／跨instance／restore、T154真實Google OAuth／Preview、既有正式清除／secret／cutover／部署任務維持未完成。requirements原71已勾／12未勾完全不動，production六端點`live:false`、speech受阻。D01／D14下一批操作沿[既有決策包補充](../readiness-decisions.md#2026-10-07-t152-文件結案與下一批批准界線本次現行)，外部唯讀帳戶查核亦需另批；資源、秘密、付費與Preview部署均未授權。下方「最新／本輪」保留各批歷史。

## 2026-10-07 剩餘正式整合條件（最新狀態）

本輪只處理 D13／D01／D07–D08／D14 的未決條件，未重開已完成 D10／D11。具體候選與批准界線集中於[最新決策包](../readiness-decisions.md)；Spec、Plan、Tasks、Research、data-model、auth／protected contracts 與本地證據已加入追溯。Task T148 對應本輪文件與限定 Analyze；T149～T154 為待批准後才可執行的後續工作，不代表 package、外部資源、付費呼叫或 production 批准。

本輪受限本機 request-builder selector 為 1 file／4 tests PASS；它只量文字 bytes 組裝。production 成本價表六端點 `live:false`；未取得供應商帳單／usage、Vercel Project Settings／Function runtime、真實 Redis／OIDC 證據。沒有 dependency、app、env／secret、外部資源、部署或 production 價表變更。本機文件工作已完成；**真實整合 NOT READY、正式部署 NOT READY**。

## 2026-10-07 集中決策交付（本輪最新）

既有L1～L5本機授權、已批准政策與requirements71／12例外保持不變；不重審結案批次。[集中決策包](../readiness-decisions.md)只列尚未批准的數值／契約與外部操作，包含T142／T147、保存／key防重放與輪替相依、freshness與真實binding／隔離驗證；均是候選，不構成批准。

本輪獨立完成T001～T008規劃／盤點文件，另補無期限預設的OAuth state原子create／consume adapter與20tests；不把尚未寫的成功handler／recorder／image／query／enqueue／keyring／cleanup／freshness／limiter接線都歸因於外部缺證據。現況回歸3檔74tests，新增state相關回歸4檔74tests、strict noEmit與`tsc -b`exit0；兩組不同selectors不相加為148唯一tests，也不是重跑歷史全套／build／E2E。requirements markers與正式gates未解除；完整Safety及本輪命令見[證據](../../../docs/verification/005-local-implementation-evidence.md)。決策包及剩餘任務表交付後停止，功能005、真實整合與部署仍非READY。

## 接續本機進度（2026-10-06；不重開已結案批次）

既有 L1～L5 授權與 requirements 71／12 例外沿用；接續 Safety Guard 已確認 master／HEAD／baseline／PDF 不變，保存 424 檔起始 manifest。Session 是 opaque ID＋逐次 server-side lookup，簽章不替代 store、logout 或付費資格查驗。管理週鍵確認僅格式差異，正式契約已統一為 `YYYY-Www`，台北週一重置不變，並非實質政策衝突。

已補可注入 Redis 業務 Lua／SharedStore／REST／Session adapters、原子 G／TIME／雙封鎖及 uncertain 清理，以及共享圖磚計數／cache／flight／quarter-credit writer；實際使用既有 Lua interpreter與 Redis/cjson 替身測試，不再把「尚未寫 adapter」全部列成外部缺證據。OIDC library adapter與額度 UX 亦已接續本機驗證；真實 token/JWKS library 接線仍受 dependency 批准限制。完整本輪命令與最終狀態以 [本機證據](../../../docs/verification/005-local-implementation-evidence.md) 接續節為準，下方數字與欠項屬上一輪歷史。

管理讀取／原子異動／audit與完整UI已補本機程式／測試，T029～31、T067～69、T077～87、T089～91新增勾選；T076因正式提示門檻待核定保持部分，80僅明列fixture而無正式預設。申請producer尚未實作，具體依賴已追加T147，不說成單純缺外部來源。

正式值、保存／輪替／逐端點 lease、freshness、T142查詢／T147申請契約、真實服務及部署仍OPEN；production六端點`live:false`，未解除成功管線Places-only限制，未新增依賴或啟用外部服務。requirements markers不變。本節為接續Implement狀態同步，非重新Analyze或正式READY。

## 最新 L1～L5 本機實作狀態（2026-10-06）

使用者已明確批准本機連續 Implement，並確認保留 requirements 的 12 項未完成。下方「僅文件／未接 handler／未獲實作授權」屬前批歷史；七檔結案不重審。本輪實際全回歸 73 files／900 tests、專案與 API／tests 型別通過；11 個 mock 瀏覽器情境通過。詳見 [命令、失敗修補與證據限制](../../../docs/verification/005-local-implementation-evidence.md)。

| 範圍 | 最新狀態 |
| --- | --- |
| P-G1／P-G2 | registry／G／原子 evidence 與 memory 競態矩陣已實作驗證；共享 Redis authority、Lua／TIME／跨 writer 未完成，finding 不關閉 |
| Session／A＝1 | 可注入設定、OIDC flow／Session／SDK mock 通過；真實簽章／JWKS provider 與共享 Session store 未實作，正式 TTL／lease 未決 |
| 六 handler | 真實 POST exports 已有 401／403／503 拒絕函式證據，未配置 fail-closed；沒有完整成功管線。executeUpstream 的歷史內容回歸不算 HTTP 成功 |
| admin／quota／Public | overview／逐請求權限／CSRF 前置、估算額度與 Public 六 client 防送出已驗證；完整讀取、原子異動／audit 與 UI 未實作 |
| map／tile／PWA | 同源 proxy ports、原子 map gate、受限不掛圖、示意裁切／破圖、SW exclusion 通過；shared tile writers 與正式素材／CDN／HAR 未完成 |
| 本機尚未實作 | 完整 Lua／adapter／清理、真實 OIDC provider 程式、成功 pipeline、tile writers、管理端／UI、完整額度受限 UX；不得全部歸因於外部 gate |
| 契約衝突 | admin 範例週鍵與 engine 不同，受影響追加 HTTP 子範圍停止待 reconciliation；未自行轉換 |

T009、T088 整項完成；其他包含缺項者保持未勾。功能 005、真實整合與部署仍非 READY。本輪未完成全部可執行本機範圍，交付為部分完成，不是正式驗收。

## 本輪統一 Readiness：剩餘實作收斂（2026-10-06）

本節是本輪最新交付，優先於下方各歷史批次狀態；**七檔隔離 pipeline 已結案，不重審**。下方 11 files／334 tests、型別檢查與其他歷史數字均為既有執行報告，本輪未重跑、不冒充本輪 PASS。功能 005、真實整合及部署仍未完成；六個既有 handler 仍直接呼叫上游，**尚未受新 pipeline 保護**。

本輪授權只含 Safety、必要唯讀程式盤點、005 文件同步、任務收斂與限定 Analyze。不修改 application／tests、不安裝、不連外、不建帳戶或 key、不接 handler／UI、不切模式、不提交／推送／部署。文件同步與 Analysis 分開：先修改文件 → Analyze 期間唯讀 → 結束後依本輪報告保存授權記錄結果。採 convergence 的 intent inventory／append-only tasks 方式，不把本輪當成全功能 converge 或七檔重新驗收。

### 1. P-G1／P-G2 解法與最小變更

權威契約：[Spec FR-015／FR-051／SC-006](../spec.md)、[Plan §14](../plan.md#14-剩餘實作收斂與統一-readiness-gate)、[data-model](../data-model.md)、[protected](../contracts/protected-endpoints.md)、[error](../contracts/error-and-quota-contract.md)、[map](../contracts/map-access-contract.md)。

- **P-G1**：後端完整 registry bundle、不可 ABA 重用的 revision／bundleDigest、單請求固定快照；發布／停用／超額雙封鎖與 reserve 共用原子邊界。G 依原子時間當下可信、有效、已批准及啟用且未封鎖集合的最小 R_max。reserve 重驗 revision、完整成員、當下時間／效期與封鎖；舊快照統一 503，不自動刷新重試。非目標便宜端點封鎖也影響 G。
- **P-G2**：同次原子 reserve 檢查資格／等級／當週 active 追加、registry／G、日／週 usage；兩窗口在預留前皆足 G 與 R_e 才給首次 grant，僅扣 R_e。可變成本 `R_e ≤ remaining < G` 仍 429 all／below_floor，上游零次。回傳同次完整內部 evidence，由 engine 驗證，pipeline／map 不補額外 read。
- **生效界線**：變更先於 reserve → 舊快照拒絕；reserve 先成立 → 原 grant 沿原成本／窗口／lease 單次執行，不追溯作廢，後續新 reserve 採最新狀態。既有保守結算、冪等、資格優先、追加／撤回原子性與 fail-closed 保留。
- **驗收**：G−1／G、R_e−1／R_e、R_e<G 只扣 R_e、日／週／雙窗口區間；barrier 控制改價／停用／雙封鎖／追加／撤回與 reserve 的兩順序；原子時間效期／窗口、錯誤 evidence／timeout，mock grant／上游次數。真實跨 writer／Lua／TIME／keys／TTL 證據分開取得。

最小程式範圍為 registry／threshold、engine／validation／SharedStore、memory mock／既定真實 adapter、pipeline／map gate 及相應 targeted tests；不更換 stack、不增新架構。原估算器／成本摘要／HMAC／錯誤信封可重用，除契約必要擴充不重寫核心。七檔历史驗收保持結案；未來程式變更須跑相关回歸，但不是重新批准或重審既有結案。

### 2. 剩餘任務、依賴與完成證據

| 路線／分類 | Task（整項仍未完成者） | 實際前置 | 可獨立完成證據／正式欠項 |
| --- | --- | --- | --- |
| 原子 G／a | T143→T144→T145，T146 相應子範圍 | 既有 T126／T023／T021／T022／T139／T140 核心及 T019 契約；不需真實帳戶 | 新可變成本與 race tests、內部 evidence／型別回歸待測；不沿用 334 |
| 真實 store adapter 程式／a，環境證據／b | T019、T138 | T144 新契約、原子 keys/hash-slot 設計；正式 TTL 待決 | 本機可完成 protocol／Lua／transport adapter／故障測試；跨 writer、TIME、TTL、真實 resource 尚無證據，整項不能勾選 |
| Session／核准／a，本機限期參數化；OIDC／b | T009～T018、T029～T031、T059～T060 | 身分／Session 契約、shared store 介面與可注入 transport | mock state／PKCE／claims／Session 撤銷、403 優先、管理來源／無外洩待測；真實帳戶／callback／secret 尚未授權，保存期限不得自訂 |
| 單次嘗試／a | T135 | A2 已批准、既有 SDK／instrumentation | mock fetch 429／5xx／timeout／斷線每操作 ≤1 次，instrumentation 回歸；未執行，不需付費 API |
| 六端點接線／a＋c | T025～T028、T036／T043～T044／T049～T054／T132／T140～T141／T146 | 原子 G 已驗證、Session／資格、各端點驗證；成功另需 A1／A3～A5、T135／T136 | 可先本機拒絕接線與六端點 mock；合法成功不可只移除 Places 限制。production 全 live:false；speech／transcribe 受阻；真實成功未完成 |
| lease／對帳／a＋b＋c | T136／T138 | 端點政策與注入時間；正式秒數／保存／觸發待定 | 可完成參數化 lease、冪等 cleanup adapter；真實 provider 對帳／排程批准／Redis evidence 未取得 |
| 自身額度／409／a＋c | T027／T065～T066／T099～T106、T142 | Session／原子 snapshot、已批准 A6；新查詢動作先收斂 T142 契約 | 額度 stale／失敗／多分頁／no auto retry 待測；409 只顯示既定提示，不假定新 endpoint 或成功 |
| 管理者儀表板／a＋b | T067～T092、T114～T115 | Session／M1／核准與追加原子契約，API 先於對應 UI | mock 401／403 無外洩、CSRF／確認／冪等、不同追加各自累加、audit 最小化；真實管理者 subject／env 尚未授權 |
| 圖磚代理／a＋b | T032～T035／T055／T058／T061～T062／T134／T146 | Session／核准、原子 G snapshot、獨立圖磚計數／credits | mock cache hit／304 也重驗、coalescing／上游零次；真實 credits／CDN／304／HAR 證據待驗，不因 Redis 未驗證停止骨架 |
| map UI／靜態圖／a＋b＋c | T037～T047／T057／T063／T038／T107～T109 | eligibility／fallback；正式資產 T107→T108→T109 | placeholder／破圖／不掛 Leaflet 可本機測；原檔授權尚缺。FR-044 口徑確認只影響對外零請求 acceptance，不改可完成的拒絕／fallback |
| PWA／回歸驗收／a＋b | T093～T098／T110～T118、T042／T047／T057／T112 | 對應路線完成並逐 phase 驗證 | 本機 SW exclusion／Network／mock 回歸可做；正式 CDN／provider／完整 UI acceptance 待證據，不新增 offline 架構 |
| 正式啟用／部署／d | T119～T123、T117 完整證據 | 相關服務／參數／秘密批准、正式證據、回滾方案 | 未授權，沒有部署／模式切換；獨立決策，不能包在本機 Implement 中 |

T001～T008／T002／T118／T124～T125 文件／盤點沿原 ID 保留，未執行項不假勾；T038 資產誤指 T119、T062 自我引用、舊 Phase 2 全域阻擋以 [Tasks Phase 12 校正](../tasks.md#phase-12-convergence剩餘實作收斂) 解釋。沒有讓整項 T140→T025→T140 的循環阻擋：先 registry 核心與 T025 骨架，再 T146 接線／T141 驗收；T142 不是其他基礎工作的前置。

### 3. 已批准／待決／待證據

| 狀態 | 清單／對應阻擋 |
| --- | --- |
| **已批准** | React／TypeScript／Vite／Vercel、既有 provider／PWA；Google OIDC code＋PKCE／opaque Session、Upstash Redis-compatible、M1；tier1 US$3/day＋15/week、tier2 US$10/day＋50/week；當週逐次追加不設固定次數或倍數上限、日上限不變；圖磚代理／7天TTL／120/min／1,000/day／Free 2,400 credits/day；A2＝1／maxRetries:0、A8 G-B、A9 S1、A10 P1、A6 六列；八項防護政策及 C1／HMAC／雙封鎖／資格優先。上述不重新請求架構／額度批准 |
| **待營運者決定（只阻擋採用者）** | A1 成本係數／輸出／pre-parse／timeout／白名單數值；A3 60秒／PCM大小；A4 照片縮圖及3MiB相容性；A5 Places 100／50字；A7 模型停用／另案範圍。正式匿名／登入限流值、逐端點結算緩衝／lease、Session／reservation／audit 保存與HMAC輪替、cleanup觸發方式、供應商預算／告警與資源費用、真實帳戶／keys／env、資產來源授權、FR-044對外驗收口徑；speech解除受阻若要進行屬另案，非本機路線必要決策 |
| **契約收斂而非預設新產品批准** | T142 的查詢方式／欄位／授權需先完成契約；不預建新 endpoint 或 UI 行為，不使已批准409文案重新待決。原子keys／hash-slot／transport屬已批准架構內技術工作；若做不到同一原子邊界才回 Plan，不要求選型重批 |
| **已批准方向、待證據** | P-G1／P-G2 的新實作、可變成本／registry races；T019 真實 Redis/Lua／TIME／跨writer；可信輸入token／vision tile／R_max／供應商價格／A＝1實際生效；P1後端／真實瀏覽器PCM；真實Session／OIDC／callback／管理者；CDN／304／SW Cache Storage／HAR；正式圖資授權及完整六端點／admin／UI回歸。沒有現成外部環境授權紀錄，不能把「方向已批准」當「可連外操作」 |

**授權區分**：本機連續實作尚未授權；架構／政策已授權的方向仍缺實作與證據，不能稱為架構未核准。真實外部啟用、安裝 dependency、秘密值、付費 API 與部署動作目前尚未授權；只有取得對應明確批准後，才會成為「已授權但待取得證據」。不捏造批准紀錄，也不把所有缺證據自動等同必須重批。

### 4. 統一 Gate 與建議一次連續 Implement 範圍

| Gate | 本輪判定 | 實際阻擋範圍 |
| --- | --- | --- |
| 七檔歷史 | **CLOSED／不重審** | 無新阻擋，不等於功能完成 |
| P-G1／P-G2 文件方案 | **規劃已收斂；實作／證據 OPEN** | 可進入本機授權交付；不能當正式G已完成 |
| 本機連續路線 | **可交付 `/speckit.implement` 授權；本輪未授權執行** | 限定 Analyze 若無新增本機 blocker，一次批准後可例行修改／測試／文件同步，不每小任務重批 |
| 數值／新行為 | **對應子範圍 BLOCKED** | 只阻擋正式值／新行為，保留 fixture／參數化／拒絕路線 |
| 真實 store／外部整合 | **正式證據 BLOCKED** | 不阻擋adapter程式與本機工作；不能勾選T019或宣稱跨實例正式安全 |
| 完整驗收／正式模式／部署 | **未完成、未授權** | 全部相關正式gate與獨立批准仍須成立 |

**建議授權文字**（本輪只提出，不執行）：批准依本機最新 Spec／Plan §14／Tasks Phase 12 與本報告進入 `/speckit.implement`，連續完成下列已批准契約內的本機工作；允許 routine code、相關 targeted tests、型別檢查及文件／證據同步；不連付費 API、不新增 dependency、不寫正式 env／secret、不部署／切換模式。每個 phase Run→Verify→Fix 完成才往下走。

1. **L1 原子基礎**：T143→T144→T145；T019 adapter 程式／可注入 transport／Lua、T138 清理 adapter。包含可信全集合／revision、同原子 G／日週、全部競態與失敗佐證。
2. **L2 Session／資格與單次嘗試**：T009～T018／T029～T031 mock 及 T135、T136 參數化、T138 冪等恢復。與 L1 無實際依賴的 T135／Session 可獨立驗證；不被真實 Redis 阻擋。正式 lease／Session TTL 不定值，只有明列測試 fixture。
3. **L3 本機六端點／query**：T025／T140／T146／T028／T141，T036／T043／T044／T049 相應拒絕路徑、T051／T052 受阻路徑／T132；用真實 handler 加 mock 上游驗證（不是只呼叫 helper）。成功端點只有完成合法輸入驗證並獲相關數值批准的路徑才展開；production 全 live:false。T027自身額度依既有契約；T142未收斂前只顯示409提示，不建查詢動作。
4. **L4 管理者／額度 UI**：T067～T092、T065～T066／T099～T106 及最小化audit；Session→管理API→對應UI順序、週追加與資格競態、CSRF／無外洩／手動重試。以 fixture／mock 驗證、不設定真實M1 subject。
5. **L5 圖磚／靜態圖／PWA／回歸**：T032～T035／T134／T146 map 子範圍→T037～T047／T055～T064／T038→T093～T098／T110～T118，mock cache／credits／Network／SW與既有功能回歸。正式資產未到位只阻擋T107～T109；先完成placeholder／破圖fallback，不冒用聊天附圖。

**停止條件**：未取得一次明確 Implement 授權；artifact 實質衝突；所需新正式數值／產品行為未批准；需要新dependency、外部帳戶／隔離環境、secret／env或付費呼叫；keys／hash-slot不能同原子操作；scope／stack／隱私／位置／語音／AI行為超出已批准契約；上一phase驗證失敗未修復；正式部署或模式切換。遇到只影響子範圍的待決／待證據，標明欠項並跳過相應工作，繼續無依賴的本機任務，不將全部路線BLOCKED。

### 5. 本輪驗證／限定 Analyze／Safety

限定 Analyze 結果見 [本輪報告](analyze-report.md)。僅分析本輪契約、依賴與追溯；不做七檔 review、不跑應用測試或 type-check。P-G1／P-G2 的「規劃缺口」收斂不等於 implementation finding 關閉；P-I1與正式證據保留。

- 開始 root `C:\Users\geste\spec-kit\tokyo-mate`；remote `origin https://github.com/gestertim/tokyo-mate.git`；branch `master`；HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`。staged 0；tracked 既有 `src/types/error.ts` 修改1檔；untracked 47檔。
- 開始 manifest **386檔**：以 `git ls-files`＋`git ls-files --others --exclude-standard` 聯集逐檔SHA-256；與歷史527／533不同是範圍不同，非成果丟失。另核對 `.gitignore`、`.git/info/exclude`、本機repo指引、Constitution雜湊。local-only為 `.github/skills/`、`.github/copilot-instructions.md`、`.specify/`、`.vscode/`；`.vscode`不存在不建立，hooks不存在。001～004、全部tracked／untracked與plan.pdf保留。
- baseline annotated tag `073f04ffd505a92c516f3b3fbfdd0a87088472e8`、peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7` 不改。
- 本輪只修改12個既有005 Markdown：spec、plan、data-model、tasks、UX、quickstart、protected／error／map contracts、requirements／本報告／Analyze。auth／admin契約只讀，其既有行為不變；無新路徑、刪除或程式變更。
- session 證據目錄 `C:\Users\geste\.copilot\session-state\090223d8-6ce5-47a9-b69c-ef617ab1c95c\files`，開始 `005-convergence-safety-start.json`；結束保存 `005-convergence-safety-end.json`／`005-convergence-safety-result.json` 與文件限定分析結果。最終Git與差異須以實際結束檢查為準，不能僅引用預期白名單。
- **結束實際比對**：386檔同範圍manifest，12個白名單005 Markdown修改、0新增／0刪除／0非預期變更；Git porcelain與開始相同，staged 0、tracked仍只有開始已存在的 `src/types/error.ts` 修改、untracked仍47，HEAD／branch／baseline與local-only雜湊不變。既有所有程式／測試、001～004及plan.pdf雜湊未變；`git diff --check` exit0（只檢查tracked diff，不用它替代untracked manifest）。報告保存後再次複核同一白名單，不把文件檢查當應用測試。

本輪交付完成後停止；不開始L1，不執行T135，不接線handler／UI，不提交或部署。

## 本輪最新交付：七檔 tests-only 隔離實作與停止（2026-10-06）

本節優先於下方歷史「未授權／待批准」狀態。使用者已核准 A6 六列與日／週 request 同文修正，明確授權七檔；`speckit-analyze` 限定唯讀分析未辨識新增隔離 blocker，再由本機 `speckit-implement` 執行。requirements checklist **71／83、12項正式 gate** 未完成，使用者再次確認僅在隔離範圍繼續；marker 未修改。

### 本輪 Git／Repository Safety Guard

- branch `master`、HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`；baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`、peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`，不變。
- 開始 staged／tracked diff 空白、untracked **41**；結束 staged 空白、tracked 只變更 `src\types\error.ts`，untracked **47**。這些數字由本輪命令重新核對。
- `.git`（需 `Get-Item -Force`）、`.github`、`.specify`、`specs` 保留；`.vscode` 原本不存在，沒有建立。extensions hooks 檔不存在，Analyze／Implement 前後均無 hook。
- 開始 manifest **527**、結束 **533**（排除 `.git`／`node_modules`／`dist`）；預期且限定 **6新增＋8修改＋0刪除**：七個程式／測試路徑＋Spec／UX／error contract／Plan／Tasks／本報告／Analyze。最終逐檔比對結果存 `pipeline-safety-result.json`，不僅以 Git diff 判斷。
- 核心 engine／store／registry／estimator／threshold、六 handler、所有001～004、plan.pdf、SDK／UI／dependency manifests 與其他成果以開始 SHA-256 保護。無 git add、提交、branch／tag 變更或連線。

### 七檔逐檔變更／介面

| 檔案 | 本輪隔離內容／驗證 |
| --- | --- |
| [protected-endpoint-pipeline.ts](../../../api/_lib/protected-endpoint-pipeline.ts) | 非路由 DI `createProtectedEndpointPipeline(deps).execute(request, context, policy)`；method／length→可信 admission→Session→engine getSnapshot資格→subject rate→bounded bytes／deadline／depth／nodes／schema→同次 cloned registry/table／雙封鎖證據→engine reserve／grant→單次 mock→engine settle。沒有 env／SDK／fetch／fixture import。合法成功硬限制 Places；其他端點只共用拒絕。 |
| [error-envelope.ts](../../../api/_lib/error-envelope.ts) | `toProductError(TrustedPublicRejection)`／`errorResponse`；A6六列逐字映射、409／503、public白名單、可靠 Retry-After header／body 同步、no-store；不轉送內部 outcome。 |
| [error.ts](../../../src/types/error.ts) | 既有 ErrorCode 最小擴充，ProductError 增可選 quotaScope／retryAfterSeconds；既有欄位、UI與既有呼叫保持相容。 |
| [protected-pipeline-fixture.ts](../../../tests/support/protected-pipeline-fixture.ts) | tests-only Session／transport／rate／pinned cost／mock；直接重用 memory store、registry fixtures與既有 TEST_ONLY HMAC key。每端點顯式 fixture execution／buffer／lease，不使用 engine default。Places schema只有query、完整語意留記憶體、estimateInputs固定{}；不將任意 fixture金額轉token作HTTP證據。 |
| [protected-endpoint-pipeline.test.ts](../../../tests/api/protected-endpoint-pipeline.test.ts) | **83 tests**；入口、解析、身份／資格／競態、grant／clock、並發／冪等、timeout／晚到／結算／超額、欄位白名單。 |
| [cost-registry-pipeline.test.ts](../../../tests/api/cost-registry-pipeline.test.ts) | **31 tests**；同次成本metadata／效期／版本／雙封鎖、原子拒絕snapshot、六列分類、G與R_e邊界、context變動／恢復／追加撤回、換版本不解封、重新舉證。P12以3組合法SKU證明 **R_e＝R_max,places≥G**。 |
| [error-envelope.test.ts](../../../tests/api/error-envelope.test.ts) | **9 tests**；Spec／UX／contract六列逐字一致、request日週同文、每列完整信封、Retry-After及409／503精確文案。 |

T014／T017／T025／T026／T028／T136／T140／T141 只完成上述子範圍；T065 僅文案／測試追溯，engine未改。**整項任務均不因此勾選**。T019／T138正式adapter／對帳、T135、T142／handler／UI全未執行。

### RED→GREEN／Run→Verify→Fix 本輪實際命令

下列均由 repository root 執行既有本機 runner，無安裝／下載。logs 保存於本輪 session `files`：

1. IDE `runTests` 指定新增信封測試：`No tests found`，不算 PASS。
2. `node_modules\.bin\vitest.cmd run tests\api\error-envelope.test.ts --reporter=dot`：RED缺module，exit1（19:52:52）；新增共用型別／信封後 GREEN **1 file／9 tests、exit0**（19:53:24）。
3. `node_modules\.bin\vitest.cmd run tests\api\protected-endpoint-pipeline.test.ts --reporter=dot`：RED缺helper module，exit1（19:54:19）；入口實作後與信封合跑 **2 files／45 tests、exit0**（19:55:09）。
4. `node_modules\.bin\vitest.cmd run tests\api\cost-registry-pipeline.test.ts -t 剩餘 --reporter=dot`：RED **6 failed、exit1**（19:55:59）；初次GREEN仍6失敗，型別檢查定位 pinCost scope 問題，修正後 **6 passed／15 skipped、exit0**（19:57:36）；這是階段 selector，不當完整suite PASS。第一次含`|`的selector經Windows cmd誤解析exit255，未執行測試，改單一selector。
5. `node_modules\.bin\vitest.cmd run tests\api\protected-endpoint-pipeline.test.ts -t P14 --reporter=dot`：RED **3 failed／61 skipped、exit1**（19:58:42）；單次mock／保守結算實作後，修正fixture spy原implementation、reserved discriminator與SKU settlement observation；完整新增測試最終無skipped。
6. `node_modules\.bin\vitest.cmd run tests\api\protected-endpoint-pipeline.test.ts tests\api\cost-registry-pipeline.test.ts tests\api\error-envelope.test.ts tests\api\quota-atomic-evidence.test.ts tests\api\quota-reservation.test.ts tests\api\cost-registry.test.ts tests\api\quota-fingerprint.test.ts tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts tests\api\quota-threshold.test.ts tests\api\cost-estimators.test.ts --reporter=dot`：**11 files／334 tests、exit0**，20:03:23、11.36s。本輪新增123＋未修改核心8檔211；僅memory／fixture，不是正式服務證據。
7. 最後 fixture逐端點明列與audit最小化後：`node_modules\.bin\vitest.cmd run tests\api\protected-endpoint-pipeline.test.ts tests\api\cost-registry-pipeline.test.ts tests\api\error-envelope.test.ts --reporter=dot --reporter=json --outputFile.json='C:\Users\geste\.copilot\session-state\f0f2f8b1-8f7f-449b-a691-51959be62d28\files\pipeline-cases.json'`：**3 files／123 tests、exit0**，20:04:56、1.83s。
8. `node_modules\.bin\tsc.cmd --noEmit --incremental false --pretty false`：專案 **exit0**。`node_modules\.bin\tsc.cmd --project 'C:\Users\geste\.copilot\session-state\f0f2f8b1-8f7f-449b-a691-51959be62d28\files\pipeline-tests-tsconfig.json' --noEmit --pretty false`：新增測試入口及transitive引用 **exit0**。曾遇session config找不到root types、readQuota多參數型別錯誤，分別用既有node typeRoots與完整args修正後重新通過；不加dependency、不改專案config。

session config extends現有tsconfig、incremental:false、types:node、typeRoots指向repository既有node_modules，files明列3測試＋1support；完成後刪除暫存config，保留實際命令／logs。未執行build、完整application suite、瀏覽器／Network／HAR、Vercel ingress或真實provider驗證。

### P01～P22／限定 Analyze／保留 gate

逐案例 `pipeline-cases.json` 驗證123個assertion全passed，22個P識別均有案例。P10／P11以同次原子denied snapshot分類，不能用舊read授權；P12涵蓋G−1／G／R_e−1／R_e、便宜端點封鎖重算、釋放／結算／uncertain、日重置／週追加不提高日上限、撤回追加與改版不解封；P17晚到僅audit不再settle；P18超額完整入帳且雙封鎖有效仍503；P20／P21未知或矛盾不拼read佐證、不退款或重試。

| 範圍 | 本輪狀態 | 保留限制 |
| --- | --- | --- |
| A6六列 | 已核准、精確信封通過 | 非UI驗收 |
| 七檔隔離pipeline | **本批完成並停止** | Places固定SKU／mock-only；非正式端點 |
| 真實服務整合 | **BLOCKED** | P-G1／P-G2／P-I1皆HIGH OPEN |
| 完整驗收／部署 | **BLOCKED** | 全部12項正式gate |

[Analyze 本輪節](analyze-report.md)保存前後唯讀結論與追溯。沒有新增隔離blocker，沒有關閉正式finding。production六端點維持live:false。沒有T135、handler／UI／map／query／SDK接線、連外、安裝、秘密／env、提交或部署；到此停止，不啟動下一批。

## 本次最新交付：A6 額度文案收斂（2026-10-06；未授權實作）

此節與下方更新後 §4～§6 為本次可審閱方案；其餘前批 Safety／測試數字保留為歷史，不當成本次新證據。四種語意（日耗盡、週耗盡、below_floor、request 不足）展開六列精確文案，已同步 [Spec](../spec.md)、[UX](../ux-ui-design-handoff.md)、[錯誤契約](../contracts/error-and-quota-contract.md)、[Plan](../plan.md)、[Tasks](../tasks.md)。**全為本次待營運者批准方案**，未核定生效、未授權 pipeline；HTTP／code／quotaScope／G-B 不變。

### 本次重新核對的來源與驗證

- Git 開始：root `C:\Users\geste\spec-kit\tokyo-mate`、branch `master`、HEAD `3afb239a37cfe905e3100be83739671c0dde0e75`，staged／tracked diff 空白；`git ls-files --others --exclude-standard` 實數 **41檔**。未追蹤成果全部保留。
- baseline tag object `073f04ffd505a92c516f3b3fbfdd0a87088472e8`，peeled commit `fb09a41182bcc639a9335adbd0e1f84405a1bba7`；annotated tag object 與 commit 不同屬正常。未變更 tag。
- `.git`／`.github`／`.specify`／`specs` 存在；`.vscode` 不存在，不建立、不視為 blocker。hooks 檔案不存在。Constitution 2.1.0 與 Analyze prerequisites 重新讀取／執行一次，FEATURE_DIR 正確。
- 本次開始 manifest 為 **527檔**（排除 `.git`／`node_modules`／`dist`），位置 `C:\Users\geste\.copilot\session-state\937eb662-a0fe-4288-96d0-5531edf852d5\files\a6-safety-start.json`；以 SHA-256 核對未追蹤與已追蹤成果，不只看空白 diff。
- `plan.pdf` 僅核對 SHA-256 `0A3D951ECED180AF04B665CADF0D92B09A71861B563E1A84CF6A1EFE5A552FFB`，不改內容。local-only 政策不變，未 git add／提交／連外／安裝／部署。
- IDE `runTests` 指定原八檔得到 `No tests found`，不算通過；改用既有 `node_modules\.bin\vitest.cmd run` 與下方歷史§1相同八個 selectors，**本次實跑**開始 **19:22:54**、duration **49.22s**、exit **0**、**8 files／211 tests 通過**。這是既有核心 memory／fixture 回歸，**不是 pipeline、A6 信封、UI、正式服務或完整 application acceptance PASS**；未改程式／測試，未跑 build 或沿用歷史 type-check。
- 唯讀程式核對 `quota-threshold.ts` 的分類、跨類優先／同類日優先，engine／shared-store 的拒絕邊界及既有 threshold 測試；共用 `ProductError` 尚無005新增欄位，仍是下一批 T026 工作。沒有 handler／UI 接線。
- 文案來源以可信後端原子拒絕 snapshot＋固定成本 context 為準。`all` 同時表示 exhausted 或 below_floor，不能單靠 scope／code 區分；不新增 public state／reason／G。週追加不提高日上限，也不保證足夠恢復；G 仍是最大合法輸入預留門檻，不改成最小輸入成本。可靠後端秒數以外不宣稱恢復時間。

### 本次分範圍 Readiness 與停止

| 範圍 | 判定 | 尚待事項 |
| --- | --- | --- |
| A6 文件／七檔方案 | **可審閱；提案未生效** | 審閱六列逐字文案、四種完整信封、§4 介面／完整路徑／可信邊界、§5 P01～P22 及 §6 Task 子範圍 |
| 隔離 pipeline | **BLOCKED（批准／授權）** | 營運者批准 A6 文案＋另行批准七檔具體 `/speckit.implement` 範圍；本次 Analyze 不授權實作 |
| 真實服務整合 | **BLOCKED** | P-G1／P-I1、T014／T017／T019、T135／T136／T138／T140 真實證據及既有正式參數／秘密／外部批准；不以 mock 替代 |
| 完整驗收／部署 | **BLOCKED** | 六 handler／UI／SW／map／admin／query、Network/HAR、成本／供應商防線及全部 **12** 正式 gate |

本次一致性 finding 與覆蓋核對見 [Analyze 最新 A6 節](analyze-report.md)。沒有把正式 G／整合欠項歸零；在七檔、tests-only Places、注入式 mock／fixture 邊界內，除文案批准及明確實作授權外，是否有額外阻擋以該節唯讀分析結論為準。完成文件後停止，不建立任何下方預計程式／測試，不執行 T135，不接 handler／UI，不開始下一批。

**唯讀 Analyze 完成後保存的結論**：限定七檔／固定 SKU Places 合法代表內，除 A6 文案批准及具體實作授權外，未辨識額外阻擋該隔離批次的 finding。這不是六端點通用完成：**P-G2（HIGH／正式整合 OPEN）**指出現有原子 reserve 僅比較 `R_e` 與 remaining，未接 G；可變成本端點若 `R_e ≤ remaining < G`，只在 reserve 拒絕後分類不能強制全域 G-B。Places 固定 SKU 有 `R_e = R_max,places ≥ G`，不存在此放行區間；P12 必須驗證此同成本 context 不變量。本次不修改核心介面、不設計或批准真實原子 G 解法；擴大到其他成功端點前須回 Plan／Tasks reconciliation。P-G1／P-I1 與全部12正式 gate 仍保留。

**本次文件機械檢查（非應用測試 PASS）**：FR56＋SC17＝73、唯一 Task142／已勾10、requirement 引用73／73、checklist83／已勾71／未完成12；六列文案在 Spec／UX／contract 逐字相同，四個 JSON 完整信封均匹配六列表及白名單，P01～P22共22組、七個完整預計路徑；懸空 Task／缺失相對文件連結均0。語意追溯只對本次 A6／隔離子範圍審查，不把引用率當實作完成率。

**本次結束 Safety Guard**：保存 Analyze 後重新逐檔比對，預期僅以下12個既有005 Markdown變更：spec、UX、plan、tasks、data-model、quickstart、error／protected／map contracts、requirements／pipeline-readiness／analyze reports；無新增或刪除。最終實際比對於 session `files\a6-safety-end.json` 與 `files\a6-safety-result.json` 保存；若檢查不符即不能宣稱保護完成。不沿用前批「9修改＋1新增」結果。

## 前批歷史：隔離 pipeline 實作前方案（Safety／測試證據保留）

**日期**：2026-10-06；以本次本機內容為準，不以 Chat 的 HEAD／檔案數／測試數推定現況。  
**授權**：唯讀盤點、限定既有工具驗證及 005 文件更新；沒有 pipeline、測試或 handler 實作授權。  
**結論**：方案可審閱；完整端到端隔離 pipeline 的實作 gate **BLOCKED（A6 尚需 reconciliation）**。真實整合、完整驗收／部署亦 **BLOCKED**。下列待新增程式與測試均未建立。

## 1. Safety Guard 與審查來源

### 開始狀態

| 項目 | 實際值 |
| --- | --- |
| root | `C:\Users\geste\spec-kit\tokyo-mate` |
| origin fetch／push | `https://github.com/gestertim/tokyo-mate.git`，只讀設定，未連線 |
| branch／HEAD | `master`／`3afb239a37cfe905e3100be83739671c0dde0e75` |
| staged／tracked diff | 均空白；不能據此推論未追蹤成果未改變 |
| untracked | `git ls-files --others --exclude-standard` 實際 **40檔**；005整個目錄與隔離模組／測試均為未追蹤成果 |
| baseline tag object | `073f04ffd505a92c516f3b3fbfdd0a87088472e8` |
| baseline peeled commit | `fb09a41182bcc639a9335adbd0e1f84405a1bba7`，與保護基線吻合；tag object 不等於 commit 不是異常 |
| 保護目錄 | `.git` 為隱藏目錄；`.github`、`.specify`、`specs` 存在；`.vscode` 不存在，未建立、不作 blocker |
| hooks | `.specify\extensions.yml` 不存在；Analyze 前後無可執行 hook |

**開始來源 manifest**：session `files\safety-start-hashes.json` 保存 **526檔**的相對路徑與 SHA-256，涵蓋未追蹤成果；排除 `.git`、`node_modules` 與 `dist`。位置為 `C:\Users\geste\.copilot\session-state\e5409a55-0406-445a-a3c4-f5dadf8714db\files\safety-start-hashes.json`。此 manifest 是 session 審查證據，不是產品資產或秘密；結束採同範圍逐檔比對，不僅看 git diff。

必要核心來源雜湊（開始快照）：

| root-relative 來源 | SHA-256 |
| --- | --- |
| `api\_lib\quota-engine.ts` | `C60DB32A1DB3ED20B87B78294A065282FBAFFFA16285B744D99F20F19E1DB763` |
| `api\_lib\quota-validation.ts` | `7739F6D341AAA80CD6C33287688CBAD0AEBDB673F38C84B6C06D42BFD8C5DF68` |
| `api\_lib\shared-store.ts` | `132AF51552E6A3F494D6809A5B35EDBC1FD1648F4A8B7990F84B19F578F04C37` |
| `api\_lib\cost-registry.ts` | `3605B6151EBE84FD99C1692A0E87844696EEF26A6C05038E462220CE7256C7E8` |
| `api\_lib\cost-estimators.ts` | `9B70E3C1404005602A6D45E892C6456C9E8AD1ABCF9C10B2C19EBA368E4191BC` |
| `api\_lib\cost-price-table.ts` | `A8999A76FB12D9397E949596576546254A1D7612E92E998D5DEF4C45F1423EA8` |
| `api\_lib\quota-fingerprint.ts` | `3BF65FA3A990C678F911D4F315819A40383C2AFBAEA66F4F98B11D148A3F1ED1` |
| `api\_lib\quota-estimate-inputs.ts` | `503309E29BFF9EDCDA0783B5E98B9C5523A4A3F49493B52252B3FE813EF0EB52` |
| `api\_lib\quota-threshold.ts` | `9F96C1C3CE3D035899D5486F10332AD279E6F4AE82E15087A80E083150BC97AF` |
| `005\plan.pdf`（僅保護雜湊，不讀內容） | `0A3D951ECED180AF04B665CADF0D92B09A71861B563E1A84CF6A1EFE5A552FFB` |

### 實際讀取內容

- 治理：本機 Constitution 2.1.0、repository Copilot 指引、已安裝 `speckit-analyze` 技能指示及可用技能清單；Analyze prerequisites 執行一次，FEATURE_DIR 指向005且 tasks 存在。
- 正式005：`spec.md` 的政策／FR／SC／使用者情境、`ux-ui-design-handoff.md` 的狀態與恢復、`plan.md` 的架構／順序／成本／結算／G／gate、`data-model.md` 的 Session／資格／預留／registry／資料最小化、`tasks.md` 的任務定義／依賴／追溯／批次紀錄、`checklists/requirements.md` 全部83個checkbox與12個未完成gate、`checklists/analyze-report.md` 現行H1-R1／C1／H2及既有 findings。
- 五份 contract 均核對相關段落：protected-endpoints、error-and-quota、auth-and-session、admin-dashboard、map-access。後三者不改；本批不含 auth／admin／map endpoints。
- 隔離核心：quota-engine／validation／shared-store、cost-registry／estimators／price-table、quota-fingerprint／estimate-inputs／threshold；另核對 engine 的 quota-window 引用與窗口回歸。
- 測試來源：quota-atomic-evidence、quota-reservation、cost-registry、quota-fingerprint、cost-estimators、quota-threshold、settlement-idempotency、reservation-reconciliation；核對直接相關案例／fixtures並執行下列整組。support 的 in-memory-shared-store／quota-fixture-engine 與 fixtures 的 cost-price／cost-registry／quota-fingerprint 均唯讀。
- 最小 prior art：`api/places.ts` 的輸入與原服務錯誤、`api/_lib/http.ts` 的既有信封及非有界 JSON reader、`src/types/error.ts` 的現有 ErrorCode／ProductError、package 與 Vitest 設定。
- 未讀 `plan.pdf` 內容、未進行線上研究，未把引用覆蓋當正式測試。

### 必要命令與結果

1. `git rev-parse --show-toplevel`、`git remote -v`、`git branch --show-current`、`git rev-parse HEAD`、`git status --short --untracked-files=all`、`git diff --stat`、`git diff --cached --stat`、`git rev-parse refs/tags/mvp-safe-baseline`、`git rev-parse 'refs/tags/mvp-safe-baseline^{}'`：開始結果如上。
2. `.specify\scripts\powershell\check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks`：exit 0，005 FEATURE_DIR 正確；僅一次初始化，無 hooks。
3. `Get-FileHash -Algorithm SHA256`：保存包括未追蹤檔案的開始 manifest；不包含 provider credential／環境值。
4. IDE `runTests` 指定8個絕對路徑：`No tests found`，**不算PASS**。改用既有本機 runner，沒有安裝／下載。
5. `node_modules\.bin\vitest.cmd run tests\api\quota-atomic-evidence.test.ts tests\api\quota-reservation.test.ts tests\api\cost-registry.test.ts tests\api\quota-fingerprint.test.ts tests\api\settlement-idempotency.test.ts tests\api\reservation-reconciliation.test.ts tests\api\quota-threshold.test.ts tests\api\cost-estimators.test.ts --reporter=dot`：**8 files／211 tests PASS，exit 0**，開始18:47:13、duration 8.91s。這是本次實跑數，不沿用歷史332等數字。
6. 唯讀 Node stdin 解析 FR／SC、Task 定義／引用範圍與 checklist markers：開始 FR56＋SC17＝73、唯一Task142、已勾選Task10；checklist83／已勾71／未完成12。更新後 Analyze 結果保存於 [analyze-report.md](analyze-report.md)。

### 核心依賴核對

| 要求 | 程式／現有可重現證據 | 本次結論 |
| --- | --- | --- |
| estimation ≤ command ≤ grant | engine clock 複製 Date；command 比較在 store.reserve 前；atomic-evidence H1-R1 精確倒退／可變Date／相等／跨期案例 | 隔離回歸通過，無本次反例 |
| grant 拒絕不退款、不重授權 | grant 時間／lease 檢查；測試原日週各保留5,000、重送duplicate | 隔離回歸通過，不代表真實store |
| 只有首次新預留給 executionGrant | store 原子 reserved；duplicate所有狀態false；engine 驗證回傳 | memory並發／終態案例通過 |
| registry決定成本、不接受request金額／model／version | reserve request exact keys、第二參數allowlist、estimateRegistryCost；cost-registry注入拒絕spy | 通過；但現有engine單獨不能證明HTTP estimateInputs provenance，後續helper須補 |
| 正常內部入帳≠API成功 | `settlementStatus: accounted` 不帶ok；原請求結果需由helper保留 | 內部契約通過，HTTP未實作 |
| 超額完整入帳＋雙封鎖仍503 | engine核對版本／摘要佐證；settlement與registry超額／重送／換名封鎖案例 | 內部503通過，handler未接線 |
| store矛盾fail closed | reservation／usage／歸屬／不可變欄位／transition／封鎖佐證驗證；atomic-evidence與reservation fault injection | 通過；不額外read拼佐證 |

不修改任何反例或程式。檢查範圍內無上述核心不變量的失敗案例；不宣稱窮盡所有輸入。

## 2. 已批准澄清與仍未批准事項

本次使用者明確批准：

- 所有有界解析、語意／格式與成本相關輸入驗證在預留前；預留後仍驗證原子回傳、可信時間與 lease，確認首次有效 grant 才單次執行 mock，結算／錯誤處理不省略。
- method／解析前大小 → 匿名 admission → Session → 有效資格 → 已登入者限流。入口過載429／故障503可先於401／403；不得藉匿名 admission 授權付費API或建立匿名付費額度。
- transport限流key不能來自客戶端偽造IP／代理Header；入口拒絕不能讀／洩漏原預留。正常請求依然需Session／有效資格、限流、registry、日週額度全部通過。

以上只同步文件。不核定限流、body、timeout、lease、prompt／照片／語音或價表正式數值，不批准新dependency、真實adapter、服務／金鑰／部署。

**尚未批准**：A6 `below_floor` 的完整外部文案。既有 `quotaScope: all`「已滿」無法同時合法表示耗盡與尚未耗盡；Plan §4.5.3／FR-025已明列待決。本輪只揭露衝突並保留gate，不自行選用新文案。

## 3. 最小 pipeline 邊界與順序（待另行授權）

不建立HTTP route。預計 `createProtectedEndpointPipeline(deps)` 回傳 `execute(request, trustedContext, endpointPolicy)`；只有可信server composition能提供deps／context／policy，HTTP body不能選它們。Vitest直接呼叫helper，mock upstream無網路。

| 順序 | 責任／權威來源 | 失敗／資源限制 |
| --- | --- | --- |
| 1 | method只接受POST；endpoint從可信policy固定 | 405；body reader／Session／store／upstream零次 |
| 2 | Content-Length fail-fast；缺失不能視為零；不據header相信body實際長度 | 明顯超界413；非法宣告400；缺失／低報仍於step7逐chunk限bytes；此時不解析body |
| 3 | 匿名admission，以可信transport context入口key原子consume測試計數 | 超載429 RATE_LIMITED；故障503；不查Session／資格／預留；header偽造不能換key |
| 4 | opaque session cookie lookup；每次檢查exists／expiresAt／revokedAt，subject僅取lookup結果 | 401或依賴故障503；cookie／subject／token不回傳 |
| 5 | 有效資格預檢重用engine.getSnapshot（store.readQuota）；不讀原reservation | missing／pending／rejected／revoked／expired 403，錯誤503；不是額度放行權威 |
| 6 | 已登入者rate limit，用可信subject，與入口限流分開 | 429或503；不讀原reservation、不預留 |
| 7 | bounded reader：實際bytes、read deadline、JSON depth／nodes、schema／文字／binary bounds；validate純函式不連外 | 400／413；讀deadline為INVALID_INPUT 400（非store timeout）；取消reader，不預留、不釋額；所有resource值tests-only明確注入 |
| 8 | 完整已驗證語意內容留記憶體；server policy衍生estimateInputs，Places為空物件。body的estimateInputs／amount／model／version／tier／attempts／digest等拒絕400 | 不做Object spread至engine options；不把客戶端數字當可信計費量；文字／影像／音訊真實adapter不在本批 |
| 9 | 同次成本context：固定registry/table版本、核對metadata／effectivity／live／封鎖。重用estimateRegistryCost作可信估算預檢；engine仍以同一固定registry重新估算 | 無效／未證明／到期／查詢故障503；沒有成本fallback。G輸入須同版本、未封鎖且有效；不得直接裸用computeGlobalFloor |
| 10 | engine.reserve一次：同原子操作重查資格、tier、追加、成本版本／摘要封鎖、冪等及日週remaining | 403、409、429或503；429只用此次原子拒絕snapshot＋固定成本context分類，不用step5舊快照授權 |
| 11 | engine驗證同次reservation／usage／limits、精確command與lease、有效且不倒退的grant時間 | 沒有有效首次executionGrant不得呼叫mock；未知／矛盾503；不退款、不重授權 |
| 12 | mock upstream最多一次；沒有SDK、fetch、loop／retry；執行deadline加結算緩衝小於lease | 拒絕前呼叫數0；首次合法1；逾時不假定未送達／未計費 |
| 13 | success／explicit_unbilled_failure／uncertain對應engine.settle；結算版本來自預留，非request；驗證同次usage／封鎖佐證 | 正常accounted依原mock結果；超額、衝突、lease錯誤、store未知一律原請求503，不退款／重送 |
| 14 | error-envelope明列欄位輸出，status／header與body一致；minimal audit事件 | 不散佈engine outcome；不洩漏reason／registry／digest／reservation／usage／cookie／內容；所有私人回應no-store，無SW接線 |

**為何先驗證**：malformed、超長、格式不合、偽造成本的請求不應占日週額度，更不能先reserve再「驗證失敗即退款」。body read本身也須受入口限流、byte／時間／解析結構上限限制，不能把成本移到無界解析。Content-Length是fail-fast，不是唯一防線；不呼叫現有無界 `readJsonBody`。

**資格競態**：step5與step10之間撤銷，step10原子結果403；不以Session或預檢cache提高權限。撤銷線性化後的新reserve必拒絕；不追溯撤銷先前已取得grant的預留。store的冪等／封鎖內部順序不在本批重寫。

**G證據**：候選cost context依賴須同時提供registry、當下可用table及版本／摘要未封鎖證據；測試adapter顯式控制兩種封鎖與變更，不宣稱讀到真實權威。跨版本、封鎖證據缺失／矛盾、E_live空一律503；正式adapter仍待T019／T140。atomic denied回傳snapshot不足以自行推知G。

## 4. 函式介面、資料邊界與逐檔計畫

以下是本次沿用、待審閱且待另行授權的介面，不是既有函式或程式實作。A6 文案已提出完整提案，批准前不得自行定案：

| 介面 | 可信／不可信邊界 |
| --- | --- |
| `execute(request: Request, context: TrustedIngressContext, policy: EndpointPolicy<Input, Output>): Promise<Response>` | Request含不可信headers/body/cookie；context由可信transport產生不可由header替代；policy由server固定endpoint、schema、資源上限與mock，不能由URL/body任選 |
| `SessionVerifier.lookup(opaqueCookie, now): Promise<authenticated(subject) \| unauthenticated \| unavailable>` | cookie不可信；subject只取經查驗結果。timeout／無效lookup shape＝503，不是authenticated fallback |
| `RateLimiter.consume(key, endpoint, now): Promise<allowed \| limited(retryAfterSeconds?) \| unavailable>` | admission key來自context，subject key來自Session；limit只由server注入；可靠秒數才同時輸出header/body |
| `EndpointPolicy.validate(body: unknown): Validated<Input> \| InputFailure` | bounded parse後檢查，拒絕權威成本欄位；validated content含所有影響語意的accepted fields；驗證不能網路／store／改計費 |
| `EndpointPolicy.deriveEstimateInputs(input: Input, pinnedCost): EstimateInputs` | 只接受validated Input；Places固定{}，不接受request第二參數；未來token／PCM／影像adapter須另驗證provenance |
| `CostContextProvider.resolve(endpoint, now): Promise<PinnedCostContext \| unavailable>` | tests-only權威來源；registry選模型／版本，same-version table與雙封鎖證據不可分叉；重用現有估算／threshold驗證，不接受任意金額bypass |
| `MockUpstream.execute(input, signal): Promise<MockObservation<Output>>` | tests-only可信adapter；不接受request附帶的settlement金額／version；可信觀測轉成SettleOutcomeInput，catch未知錯誤只可uncertain，不視為unbilled |
| `toProductError(rejection: TrustedPublicRejection): ProductError` | rejection 只能由 helper 可信判斷建立，429 含內部 window／exhausted 或 below_floor 或 request 分類；採六列待批准精確文案，不能只從 code／scope 選文案。使用共用型別、明列 public keys，內部 reason 不送 client；不以 cast 容納未知 code |

預計檔案（**本次全部不建立／不修改**）：

| 預計檔案完整路徑 | 變更／完成條件與主要介面 | Task |
| --- | --- | --- |
| `C:\Users\geste\spec-kit\tokyo-mate\api\_lib\protected-endpoint-pipeline.ts` | `createProtectedEndpointPipeline(deps)` → `execute(request, context, policy)`；非路由 generic helper、bounded reader、上述 DI、成本 context 與原子／結算接線；沒有 fixture import、route export、env 或真實 upstream | T025；T140部分 |
| `C:\Users\geste\spec-kit\tokyo-mate\api\_lib\error-envelope.ts` | `toProductError(rejection: TrustedPublicRejection): ProductError`；明列 public keys，重用 failure／success 形狀與共用型別；no-store、可靠 Retry-After；四種語意六列逐字文案待批准後實作，不增加 public state | T026 |
| `C:\Users\geste\spec-kit\tokyo-mate\src\types\error.ts` | 既有 `ErrorCode`／`ProductError` 最小擴充 code 及可選 retryAfterSeconds／quotaScope；不改 UI、不另造平行 ProductError 或 as any | T026直接型別依賴 |
| `C:\Users\geste\spec-kit\tokyo-mate\tests\support\protected-pipeline-fixture.ts` | `createProtectedPipelineFixture(options: FixtureOptions): ProtectedPipelineFixture`，回傳 deps／context／policy／spies／clock／store；tests-only Session／transport／rate／pinned-cost／mock 與 Places schema，重用 memory store／registry fixtures，不將 fixture 金額轉 token 當 HTTP 成本證據 | T014／T017契約子範圍；T025／T140 |
| `C:\Users\geste\spec-kit\tokyo-mate\tests\api\protected-endpoint-pipeline.test.ts` | Vitest 直接呼叫 fixture 的 `execute`；step order/count、bounded input、資格競態、grant／settlement；P01～P08、P10／11、P13～P21 主矩陣 | T028／T141 |
| `C:\Users\geste\spec-kit\tokyo-mate\tests\api\cost-registry-pipeline.test.ts` | Vitest 透過 fixture 注入 pinned context；provenance、registry／G／雙封鎖／clock 與竄改；P08／09／12／18～20 | T140 |
| `C:\Users\geste\spec-kit\tokyo-mate\tests\api\error-envelope.test.ts` | Vitest 呼叫 `toProductError` 並核對 helper Response；status/body/headers、409／503、A6 六列逐字／可信分類及敏感欄位 negative assertions；P07／P10～12／P22 | T026／T141 |

核心engine、validation、registry、estimators、fingerprint、threshold、既有support／fixtures與回歸測試預計**不修改**。若方案必須更改核心store／engine介面才能成立，不能臨場擴大批次，需回Plan／Tasks另行批准。

**代表輸入範圍**：Places tests-only descriptor依既有 `api/places.ts` 的manual／coordinates、category、query語意，不新增地理能力；大小與query等新上限只用fixture，不作產品核准。合法mock只走Places固定SKU；assistant／photo／transcribe／speech共用method／admission／Session／資格拒絕可參數化驗證，但不宣稱其六組真實schema／上界／成功路徑完成。speech即使fixture metadata宣稱可用仍不得grant。

**P-G2 隔離適用前提**：合法 Places 固定 SKU 在同次 context 下必須滿足 `R_e = R_max,places ≥ G`（由現有 per-request estimator 與同表 min 定義可核對），P12 對每個合法 fixture 斷言此式。可變成本端點 `R_e < G` 的成功流程不在本批；現有 reserve 沒有原子 G gate，不能把本批結果宣稱六端點已完整實施 G-B。若 fixture／方案需要改 engine／store 以成立，即停止回 Plan／Tasks，不擴大七檔。

**明確排除**：六個handler、T135／openai.ts、UI與SW、auth/admin/map routes、OIDC／Redis／付費服務、正式Session／approval／rate adapter、正式金鑰／TTL／rotation／秘密／env／部署／模式、狀態查詢endpoint與查詢UI、可信provider對帳／排程、001～004與plan.pdf。core engine通用lease預設仍是正式T136欠項，本批不能用它代替顯式fixture lease。

## 5. 可執行測試矩陣（pipeline 全部待測）

每案直接 `execute(new Request(...), fixtureTrustedContext, fixturePolicy)`；spy Session／readQuota／registry／reserve／settle／getReservation／mockUpstream，收集call order與mock state。結算本身需要getReservation，故「不讀原預留」斷言針對入口／Session／資格拒絕，不禁止正常結算讀取。使用fake timers／注入時鐘，拒絕自行等待真實秒數或連外。

| ID | 輸入／故障注入 | 必要可觀察結果 | 證據 |
| --- | --- | --- | --- |
| P01 | 非POST；Content-Length明顯超限 | 405／413精確信封；reader／Session／store／mock零次 | helper待測 |
| P02 | 缺length、低報length、chunked bytes超界、malformed JSON、過深／過多nodes、reader逾時 | 超bytes413；其餘400；預留／settle／mock零次；reader取消 | helper待測，非Vercel ingress證據 |
| P03 | 入口rate limited／unavailable，附偽造IP／Forwarded／X-Forwarded-For | 429／503優先；改header不換可信key；Session與原預留查詢零次 | memory rate mock待測 |
| P04 | 缺cookie、unknown／expired／revoked Session | 401；readQuota／reserve／getReservation／mock零次 | Session mock待測，非OIDC |
| P05 | authenticated但missing／pending／rejected／revoked／expired資格，重送既有鍵 | 403；不含reservation ID/status；registry／reserve／getReservation／mock零次 | readQuota memory mock待測 |
| P06 | Session／資格／rate store故障或無效shape | 統一503無內部reason；reserve／mock零次；不能假裝有資格或餘額 | memory fault injection待測 |
| P07 | 有資格但subject rate超限 | 429 RATE_LIMITED；可靠Retry-After header/body相等，不可靠省略；預留／mock零次 | memory mock待測 |
| P08 | schema不合／文字越界／偽造identity、tier、estimateInputs、amount、model、version、attempts、digest | 400或413；reserve／mock零次；不存在body spread；完整內容只留記憶體 | helper待測 |
| P09 | registry缺漏／未核准／到期邊界／unproven／live:false／blocked／故障 | 唯一503 code／逐字文案；不含價表或封鎖原因；mock零次 | pinned fixture待測，非正式成本證據 |
| P10 | 全域日耗盡／週耗盡／日或週未耗盡但 remaining<G；日週同類／跨類 | 429 all；exhausted／below_floor 與 day/week 正確分類，跨類取較高／同類日優先；採 A6 六列表逐字信封，below_floor 不稱已滿；mock零次 | **完整預期已提出、文案待批准／pipeline待測**；既有 threshold 數學分類回歸通過 |
| P11 | 日週皆 remaining≥G 但本請求 R_e>日／週remaining | 429 request 日／週逐字文案；僅本次操作不可預留，其他較低成本 fixture／地圖維持可用；mock零次；用 atomic denied snapshot，非舊read；減量後仍由後端確認 | memory mock待測；不保證所有功能可用 |
| P12 | G-1／G／R_e-1／R_e；context 錯版、缺雙封鎖證據、E_live空；較便宜端點撤下／封鎖；釋放／結算／重置／有效週追加後再判定 | 邊界正確；context 不可信＝503；同版重算 G、無硬常數；日耗盡不因釋放恢復、uncertain 不自動釋額；週追加不提高日上限，日 below_floor＋週追加仍不可用，不足追加亦不保證恢復；mock零次或首次合法一次 | fixture context／恢復矩陣待測；非真實權威 G，不核定正式值 |
| P13 | 同鍵同指紋；同鍵不同指紋；reserved／settled／released／uncertain／跨期重送 | 409 DUPLICATE_REQUEST／IDEMPOTENCY_CONFLICT逐字文案；mock零次、不新占額；不輸出內部reservation | memory mock待測 |
| P14 | 首次合法Places；並發同鍵N次、不同鍵競爭不足額 | 首次mock恰1次；同鍵N次共1次，其餘409；不同鍵call≤有效grant數且used+reserved不超當下額度 | 單程序memory mock，非Redis |
| P15 | readQuota後撤銷／降tier／撤追加，在reserve線性化前改store | 403或權威429；不能用預檢快照授權；mock零次 | memory受控排程待測 |
| P16 | mock成功／可信明確未計費失敗／一般5xx無未計費證據 | success→settled；unbilled→released且原服務錯誤仍非成功；一般5xx→uncertain保留占額，原錯誤不改成功 | mock觀測，不證明供應商計費 |
| P17 | 上游deadline／連線中斷／unknown結果；之後晚到success或unbilled | uncertain保留原日週；原mock服務失敗；晚到只稽核、不退款、不重送／不重settle；mock共1次 | memory timers待測 |
| P18 | 結算額R_e+1且同次雙封鎖佐證有效；重送 | used完整加額、兩種封鎖；原Response503、不回upstream成功body；不退款／重送 | memory內部回歸通過，HTTP待測 |
| P19 | estimation→command倒退／無效、重用Date；grant倒退／恰lease／逾lease | command拒絕reserve零次；grant拒絕可能已占額、不refund；全部mock零次；相等仍查效期 | H1-R1內部通過，helper待測 |
| P20 | reserve／settle改身分／窗口／fingerprint／usage／transition／版本或摘要封鎖佐證 | 503；不額外read拼佐證、不推論尚未入帳、不退款／重送 | 內部矛盾回歸通過，HTTP待測 |
| P21 | store.reserve timeout（含已寫入）；settle timeout（含已入帳）；lease結算逾期 | 原Response503；不retry write／mock、占額／入帳保留；逾期依engine轉uncertain，不假定退款 | memory fault injection待測 |
| P22 | 所有拒絕／結算結果序列化與headers；A6 四種語意六列逐字矩陣 | {success:false,error:allowlisted fields}；逐字 code／scope／title／message／step；無可信秒數時省略，可靠 Retry-After header/body 相等且不保證恢復；409／503不變；no-store；無 token、secret、內容、精確位置、HMAC、state／reason／G／version／reservation／usage；不由 client 金額／scope 推算、不自動查詢 T142 | 完整文案提案待批准；helper待測，非UI／SW |

隔離runner（未建立測試前不得執行後宣稱PASS）：

`node_modules\.bin\vitest.cmd run tests\api\protected-endpoint-pipeline.test.ts tests\api\cost-registry-pipeline.test.ts tests\api\error-envelope.test.ts --reporter=dot`

下一批若獲授權，分階段 Implement→Run→Verify→Fix：先共用型別／信封及DI／bounded拒絕路徑，再registry／atomic預留與grant，最後mock執行／結算。每階段先跑對應cases，最後合併3個新檔與本次8個核心檔回歸；對新增程式與直接引用做 `tsc --noEmit` 型別驗證。任何階段需擴大範圍或遇契約衝突即停止。

## 6. Task 子範圍、追溯與排除依賴

原Task仍是唯一任務清單，子範圍見 [tasks.md](../tasks.md)；整項不得因隔離代表成功而勾選。

- T014／T017 尚未實作；本批只定義Session注入與資格預檢mock，沒有OIDC endpoints，不跳過Session／資格行為。
- T019仍部分；T020–T024／T126／T131／T137／T139及H1-R1為隔離依賴，本次211回歸佐證不擴大其證據種類。
- T136必須使用逐endpoint明列fixture lease／deadline／buffer且做邊界測試；不等待或核定正式秒數，不移除core default。T138只利用已完成的memory保守狀態契約，provider／排程仍未完成。
- T025／T026先有契約、A6及共用型別，再做helper；T140須接同次cost context與可信估算量，不能只轉發HTTP body；T028／T141覆蓋上述完整矩陣。
- 防止循環依賴：T140已完成registry核心＋cost-context介面／fixture先行，再T026／Session契約、T025骨架、T140接線、T028／T141完整矩陣；不讓T025等待整項T140。子範圍只改執行順序，不勾選整項。
- T142的正式依賴T141保留；本批不新增查詢契約／路由／UI，只做不提供查詢動作／不承諾成功的負面斷言，不算T142完成。
- T135未執行，不修改openai.ts。純mock無SDK不需T135；真實OpenAI單次嘗試前提仍必須T135及六端點完整呼叫鏈證據，不以mock一次替代。

| Requirement | UX | Plan／Contract | Task | Test／Evidence |
| --- | --- | --- | --- | --- |
| FR-001～006、008、024、055／SC-001、013 | 本階段邊界、401／403／短時限流、資格優先 | §3.2／§13；protected-endpoints／error contract的本輪澄清 | T014、T017、T025、T028、T141 | P01～07、P13、P15；pipeline待測 |
| FR-009～018、021、022、051／SC-002、004、006、007 | 日／週、估算、其他功能仍可用 | §3.4、§4.2～4.5；data-model §4／14 | T019～024、T126、T131、T140 | P09～18、P21；核心memory回歸，不等於Redis |
| FR-025～027、049、050、056／SC-003、013、014、016 | 429細分、409非成功提示、503、C1 | §4.4、§4.5.3；error contract | T025、T026、T028、T140～142 | P10／11、P13、P16～18、P20～22；A6／T142保留 |
| FR-052、053／SC-015、016 | 不確定、不退款／不重送 | §4.4；data-model §15～16 | T136～138、T025、T141 | P17～21；H1-R1／C1／H2核心通過，正式lease／Redis待辦 |
| FR-008、029、054／SC-017 | 不洩漏／非成功承諾 | §10.4.2／§13；allowlist／HMAC契約 | T139、T140、T026、T141 | P03／08／22；正式key／TTL／存取策略未批准 |

此表為本批追溯，不移除管理者／地圖／UI／PWA／狀態顯示需求與原任務。73項引用覆蓋不等於73項測試或功能完成。

## 7. Readiness、阻擋與停止

| 範圍 | 判定 | 仍缺條件 |
| --- | --- | --- |
| 本批文件方案可審閱 | **可審閱；非授權** | 使用者審閱七檔方案、interfaces／mock boundary與task拆分 |
| 完整隔離pipeline可立即授權實作 | **BLOCKED** | A6 below_floor完整文案需先同步Spec→UX→contract→Task→test預期，再唯讀Analyze／Readiness；不縮批跳過。後續須明確 `/speckit.implement` 授權 |
| 真實服務整合 | **BLOCKED** | T014／T017真實身分資格、T019 Redis/Lua／keys/hash-slot／跨writer原子性／保存策略、正式rate與trusted ingress來源、T135、T136、T138、T140 registry/G與真實成本上界、正式批准／key與外部帳戶證據 |
| 完整驗收／部署 | **BLOCKED** | 六handler／UI／SW／map／admin／查詢工作、瀏覽器Network/HAR、正式資產、供應商預算防線、全部12正式checklist gate，外部啟用／模式切換／部署獨立批准 |

不修改checker原有83個checkbox；不把文件一致性或211個既有memory／fixture回歸當正式驗收。不把production六端點 `live:false` 說成既有API已受保護：既有handler尚未接線此engine／pipeline，本批不改這個事實。

**本次文件變更**：spec、UX handoff、plan、data-model、tasks、protected-endpoints／error-and-quota contracts、requirements checklist；新增本報告；唯讀Analyze結束後依005文件更新授權保存結果至analyze-report。其餘資產不改。

**結束Safety Guard／Analyze結果**：在唯讀分析及授權的報告保存完成後，以開始manifest逐檔驗證，結果附於本報告末節；未完成比對前不能宣稱程式／測試未變。

完成可審閱方案後停止。不建立pipeline、不接線handler／UI、不開始下一批、不提交／推送／部署。

## 8. 結束 Safety Guard 與保存證據

- 最後逐檔比對：開始 **526** → 結束 **527**；既有來源修改 **9檔**，全為上述005 Markdown；新增 **1檔**（本報告）。刪除 **0**、005外變更／新增 **0**。application code／測試／UI／SW／設定及001～004的來源SHA-256與開始一致；不僅依據空白git diff。
- 開始／結束root、origin、branch、HEAD均與§1相同；staged／tracked diff仍空白。untracked **40→41**，唯一新增為本報告，不刪除或暫存既有未追蹤成果。
- baseline tag object／peeled commit與開始相同；005 plan.pdf雜湊維持§1值，不讀內容、不更動。`.vscode`未建立，tooling／local-only政策未更動。
- 開始manifest SHA-256：`59CDE7AC64FF03AB8A1249827CEA75CA39B1D1550FD9F336B312C697D2CA42EE`。結束manifest保存於同一session `files\safety-end-hashes.json`；本末節保存後再更新manifest，使其對應最終文件內容，不在本文件放自身hash造成循環。
- 最終唯讀Analyze：FR56／SC17、唯一Task142、requirement引用覆蓋73／73、懸空Task引用0、相對文件連結缺失0、checklist71／83且12未完成；詳見 [analyze-report.md](analyze-report.md)。`git diff --check` exit0只涵蓋tracked，不冒充untracked內容審查。
- 本輪實際核心回歸仍為 **8檔／211測試通過**。P01～P22全部仍是待實作／待測pipeline矩陣；本次無新增application測試或正式驗收PASS。
- 停止狀態：方案已持久化；完整隔離實作gate因A6仍BLOCKED；真實整合、完整驗收／部署BLOCKED。未執行任何下一批或外部動作。
