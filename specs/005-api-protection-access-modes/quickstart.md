# Quickstart: 005 API 防護、核准存取與預算額度（驗證指引草案）

## 2026-10-08 TEST_ONLY 本機驗證與可操作 Public App（現行）

啟動既有 Vite 前端：

```powershell
npm run dev -- --host 127.0.0.1
```

預設 URL 為 `http://127.0.0.1:5173/`。東京百科與旅遊日文使用 repository-local assets，可由 Public 入口直接瀏覽、切換分類／情境、搜尋及收藏。Vite 的 `/api` proxy 指向 `localhost:3000`；若 API server 未啟動，額度狀態會明確顯示無法確認，不影響 Public 內容。不得把 TEST_ONLY fixtures 接成正式 route factory fallback。

**TEST_ONLY 本機 API（可操作登入／額度／管理者）**：另開終端機執行 `node scripts\005-test-only-server.mjs --test-only`（綁 127.0.0.1:3000；缺旗標或 production／Vercel 環境拒絕；僅記憶體 fixtures，不讀秘密、不連外）。開啟 `http://127.0.0.1:5173/api/auth/login` 選擇身分：`test-pending`（403 未核准）、`test-tier1`（US$3／15）、`test-tier2`（US$10／50）、`test-revoked`、`test-admin`（可進 `http://127.0.0.1:5173/admin` 核准／拒絕／追加）、或未登入。此入口不含 `/api/me/requests`、epoch 與六個付費端點。驗證：`npm test -- tests/api/test-only-server.test.ts`。

以下 selectors 將 OIDC 登入、管理員授權、quota reservation 與六端點成功／拒絕 pipeline 限定在測試 fixtures；Vitest setup 阻擋外部網路，六端點 mock 不會呼叫付費 provider：

```powershell
npm test -- tests/api/phase-b-process.test.ts tests/api/oidc-flow.test.ts tests/api/admin-auth.test.ts tests/api/quota-reservation.test.ts tests/api/protected-endpoint-pipeline.test.ts tests/api/protected-endpoint-success.integration.test.ts
npm run build
```

Phase B dry-run 會在 `.specify/phase-b-plan-v5.json` 建立或重用同一份非秘密計畫；digest 綁定 Lua／runner source hashes、操作內容及所有上限。Execute 必須提供保存計畫的精確 digest，並於讀取秘密前確認無 Read Regions、無付款方式、無其他 workload／writer，且三項用量觀測均有來源、時間與時區並未超過本次上限。條件不完整時不讀秘密、不連線；秘密只用本機 TTY 無回顯輸入。執行狀態鎖定一次性批次；派送後 unknown／失敗不會自動重送或開始第二批。production 六端點維持 `live:false`，speech 真實呼叫受阻。

## E01～E10 本機完成與重現

使用已安裝runner，不連外、不安裝或啟用正式服務：

```powershell
npm exec -- vitest run tests\api\request-epoch.test.ts tests\api\redis-request-epoch-store.test.ts tests\api\request-epoch-endpoints.test.ts tests\api\request-epoch-reserve.test.ts tests\api\epoch-engine-integration.test.ts tests\api\epoch-lifecycle.test.ts tests\api\protected-endpoint-pipeline.test.ts tests\api\me-endpoints.test.ts tests\api\me-requests-store.test.ts tests\api\redis-shared-store.test.ts tests\api\admin-self-quota.test.ts tests\api\paid-input-boundaries.test.ts tests\api\paid-handlers-rejection.test.ts src\services\request-epoch-api.test.ts src\screens\RequestEpochPanel.test.tsx src\screens\admin\EpochLifecycleScreen.test.tsx
npm run build
npm exec -- playwright test --config=playwright.config.ts 005-epoch.e2e.ts 005-self-service.e2e.ts 005-local-protection.e2e.ts
npm test
```

Vitest setup預設阻擋fetch／HTTP／HTTPS／TCP／TLS，測試只可注入mock；Playwright只允許本機host、其他請求攔截。Lua使用`skipIf(!luaAvailable)`，缺interpreter必須列為跳過、不可計PASS。最後實跑222 targeted／1287全回歸／14 E2E通過，新增epoch Lua54實跑、0跳過。全部API／support／PWA strict精確命令與失敗修補見[最新證據](../../docs/verification/005-local-implementation-evidence.md)。下方epoch「未實作」及早期驗證敘述保留為歷史；正式六端點`live:false`、speech受阻，12項正式gate未解除。

## D13 現行本機重現（2026-10-07）

已安裝批准版本後，使用既有runner：

```powershell
.\node_modules\.bin\vitest.cmd run tests\api\openid-client-binding.test.ts tests\api\sharp-image-verifier.test.ts tests\api\oidc-provider.test.ts tests\api\oidc-flow.test.ts tests\api\paid-input-boundaries.test.ts tests\api\upstream-text-inputs.test.ts --maxWorkers=1 --pool=forks
```

OIDC transport全部攔截，RSA key僅測試產生，沒有Google帳戶；影像fixtures在記憶體生成，沒有vision／存檔。精確版本／傳遞依賴／strict TS／build與回歸見[證據](../../docs/verification/005-local-implementation-evidence.md)。下方decoder未配置／library待安裝及早期目前敘述是歷史；HTTP預設仍未配置fail-closed，本機fixture通過不是production READY。[Epoch草案](contracts/request-epoch-and-key-lifecycle.md) 未實作，不執行D14外部或部署步驟。

## D10／D11 最新本機驗證（2026-10-07）

具體契約已批准，取代下方歷史「producer待核定」。使用既有Vitest測試`me-endpoints`／`me-requests-store`／`SelfServiceScreen`／`self-service-api`；隔離Playwright selector `005-self-service.e2e.ts`。核對401／403優先序、未知／他人同404、CSRF、額外欄位／reason、共用限流、去重／冪等、withdraw／resolve兩順序、跨週與週耗盡、完整UTF-8 JSON65535／65536／65537及縮頁續頁全集、手動一次操作不補送。本機Lua/cjson及HTTP mock不是真實Redis／OIDC或部署驗收；實跑結果只見最新verification evidence。

**2026-10-07本次優先說明**：最新批准與限制見[決策同步](readiness-decisions.md)；80%提示／30秒UI／Session24小時等已批准，但不等於服務已啟用。下方全情境「待測」與舊門檻待批是歷史；本輪實跑只以[最新證據](../../docs/verification/005-local-implementation-evidence.md)為準。

### 本次新增精確本機邊界

1. OAuth從未callback：expiresAt−1保留、等值清理、兩writer消耗最多一次、cleanup先／consume先及create兩順序、有界batch與重跑；不啟動scheduler。
2. fixed-window rate：各桶上限／+1、59.999秒至下一分鐘的兩窗口突發、不同endpoint共subject桶、可信Retry-After、timeout不重試；正式入口／HMAC輪替未驗。
3. JSON depth8／9、nodes256／257、UTF-16單位、無／偽Content-Length、非法UTF-8與5秒慢stream；全部reserve／上游零次。
4. UI29999／30000ms、較早後端reset、offline／pagehide／pageshow／晚到／clock倒退；僅免費查詢，互動圖過期卸載。
5. PCM960000samples／+1frame、60000ms自動停止、取消／離開釋放track；自動停止不自動轉錄。真實麥克風未操作。
6. image2048／2049、3 MiB／+1、版本9999999999／+1；原圖保留，可信decoder未配置503。
7. tile15秒flight：派送1999ms可用、2000／2001ms拒絕且保守uncertain，不放寬嚴格比較。

**狀態**：已同步本輪八項已批准政策；以下情境目前均未執行，不得標示 PASS。外部帳戶情境仍受獨立啟用／部署批准阻擋。

**最新接續本機證據（2026-10-07）**：沿用 L1～L5 授權，Redis業務Lua／共享Session與tile／REST adapter、管理原子異動／audit／完整UI、OIDC通用library adapter／額度UX已補本機程式與測試。73 files／900 tests是前輪歷史；本輪最終命令與結果見[證據接續節](../../docs/verification/005-local-implementation-evidence.md)，不能以mock當真實Redis／OIDC／CDN或成本上界證據。申請producer尚未寫且契約待核定；提示門檻無正式預設，80只是fixture，T076維持部分。六端點live:false、不解除Places-only成功限制，上句「均未執行」僅指原完整正式情境，不能全部標PASS。

僅使用已安裝工具重現：

```powershell
.\node_modules\.bin\vitest.cmd run --maxWorkers=1 --pool=forks
.\node_modules\.bin\tsc.cmd -b
.\node_modules\.bin\playwright.cmd test --config=playwright.config.ts '005-local-protection.e2e.ts'
```

Playwright 使用 API mock 並阻擋外部網路，runner build／preview 不代表 Vercel API 已部署。完整 API／tests 型別曾以一次性 config 執行，已於本輪結束清理；不得因此新增套件或正式環境值。

## 前置條件（待批准後才建立）

**本輪統一 Gate（2026-10-06）**：七檔結案歷史不重跑，A6 六列已批准，歷史待批准字樣不重新開 gate；本輪僅文件與限定 Analyze，沒有應用程式測試 PASS。後續獲一次 `/speckit.implement` 明確授權後，可按 [Readiness](checklists/pipeline-readiness-report.md) 連續完成無連外、無新 dependency 的本機 phases；真實 Redis 證據只阻擋正式共享控制驗收，不阻擋可獨立完成的本機程式／mock 測試。以下完整情境與正式 gate 仍待驗證。

### P-G1／P-G2 驗證矩陣（T143～T146，本機子範圍已有證據，正式仍待驗）

| 情境 | 必要觀察 |
| --- | --- |
| 可變成本合法輸入，日／週／雙窗口 `R_e ≤ remaining < G` | 429 all／below_floor，無新預留、無 grant、上游零次；不可只測固定 SKU |
| G−1／G、R_e−1／R_e；兩窗口皆足額且 R_e < G | 等值邊界正確，成功僅 reserved += R_e；預留後可低於 G，下一請求重判 |
| registry 改價／停用／換版、非目標便宜端點封鎖提高 G | barrier 控制「更新先／reserve 先」；舊 revision 不放行，不自動刷新重試；下一明確操作讀新 context |
| 半開效期到期與跨日／週、原子可信時間矛盾 | 當下 E_live／G 重算，目標失效或空集合 503，無 grant；舊窗口不得被授權 |
| 超額雙封鎖／追加／撤回／資格撤銷與 reserve 競態 | 同一原子排序，403 先於 duplicate；週追加不提高日上限、不追溯取消已成立預留 |
| 原子回傳 G／revision／digest／時間／usage 不符或 timeout | 統一 503，無上游、不退款、不重授 grant、不補 read 拼佐證 |
| map eligibility／tile cache hit／304 | 當次原子 G 檢查在 cache 前，不扣 US$；舊查詢不授權後續 tile |
| 真實 adapter 跨 writer／Lua／TIME／keys／TTL | 另附獲准隔離環境實際證據；memory fixture 與文件檢查不能替代 |

- 隔離本機或 Preview 環境，不連正式供應商大量呼叫。
- 測試 OIDC provider 或 mock identity。
- 隔離 shared store 或 in-memory race-safe mock。
- Mock OpenAI、Google Places 與 Geoapify tile 請求觀測機制。
- 測試身分：未登入、已登入未核准、第一級、第二級、撤銷、到期、管理者、非管理者。

## 驗證情境

### 1. Public 只能使用公開功能

1. 未登入進入 App Shell、東京百科、旅遊日文與公開 MP3。
2. 嘗試觸發六個付費 API。
3. 預期：公開內容可用；六端點均在上游前回 401；mock 上游呼叫數為 0。

### 2. 已登入但未核准／撤銷／到期

1. 以已登入但無有效 approval 的身分呼叫六端點。
2. 將已核准帳號撤銷或設為到期後，不登出再次呼叫。
3. 預期：均回 403；下一次請求即反映最新狀態；mock 上游呼叫數為 0。

### 3. 第一級與第二級額度

1. 第一級帳號在 US$3/day、US$15/week 內呼叫六端點。
2. 第二級帳號在 US$10/day、US$50/week 內呼叫六端點。
3. 預期：額度內允許；超過日上限回 `429 DAILY_QUOTA_EXHAUSTED`；超過週上限回 `429 WEEKLY_QUOTA_EXHAUSTED`；超額不呼叫上游。

### 3a. 成本上界與受阻端點（待測；全部 mock，不呼叫付費 API）

1. 對 assistant、photo-translate、photo-ocr、places 以最壞合法輸入計算 `R_max`，驗證 A=1（A2 規劃已核准；A=3 撤回）算術（9,630、8,036、19,398、50,000）與 plan.md §4.2.3 表一一致（僅為 mock fixture 算術，不代表真實上界成立）；另以單次嘗試計數器驗證「一次使用者操作的上游嘗試數 ≤ 1」（T135）；模型白名單外（`OPENAI_MODEL` 被覆寫）對外回 503 `PROTECTION_SERVICE_UNAVAILABLE`（內部原因 `COST_MODEL_UNSUPPORTED`）且上游零呼叫。
2. photo-ocr：解碼後 3,145,728 B 影像加 base64／JSON 包裝後 ≤ 4,194,373 B 可通過；超過 4,200,000 B 回 413。
3. `speech`、`transcribe` 在 `live: false`（A9＝S1 已規劃核准維持受阻；A10＝P1 已規劃核准但後端驗證與瀏覽器可行性未完成）時真實呼叫對外回 503 `PROTECTION_SERVICE_UNAVAILABLE`（內部原因 `COST_BOUND_UNPROVEN`），上游零呼叫，不影響其他端點與圖磚 gate。P1 mock 測試：偽造 header 時長／長度、截斷、額外 chunk、奇數位元組、dataBytes > 1,920,000、非 16 kHz／mono／16-bit 皆於上游前拒絕，且交付上游者為重建的 44 B header。
4. 預期：所有項目為「待測」；真實 usage、speech 校準與瀏覽器 PCM 錄製屬外部證據（T133），目前未取得。

### 3b. 「額度不可用」門檻 G（A8＝G-B 規劃已核准；數值待 A1；待測）

1. 依 G-B（僅計入 `live: true` 端點），以 plan.md §4.5.5 mock 驗證例對圖磚 gate 參數化測試；fixture 必須明確標示為測試資料，不得據此聲稱真實成本上界成立。
2. 預期四類分開：個別請求預留不足只回 `quotaScope: 'request'`，圖磚與較低成本端點維持可用；`remaining < G`（無啟用端點可負擔）與實際額度耗盡（`limit−used≤0`）回 `quotaScope: 'all'` 並切為靜態示意圖；`live: false` 端點價格不影響 G；`E_live` 為空＝成本模型無效，回 503（不帶 `quotaScope`）並 fail-closed。

### 4. 原子預留與併發競爭

1. 將測試帳號剩餘額度設為只足夠一次高成本請求。
2. 同時送出多個相同請求。
3. 預期：最多一個成功進入上游；其他在上游前 429；used/reserved 不超過上限。

### 5. 結算規則

1. 分別 mock 上游成功且有 usage、成功但 usage 不完整、明確未計費失敗、逾時、不確定是否計費。
2. 預期：quota snapshot 正確更新已用／預留中／剩餘；不確定情境不得立即恢復額度；UI 不稱估算為實際帳單。

### 6. Asia/Taipei 日／週重置

1. 以後端時間模擬每日 00:00 與週一 00:00。
2. 調整瀏覽器時鐘與時區。
3. 預期：恢復時間只由後端 `Asia/Taipei` window 決定；前端時鐘不影響授權。

### 7. 週追加核准（2026-09-25 政策更新：無固定次數或累計倍數上限）

1. 週額度耗盡後，由管理者對指定使用者與指定週逐次建立追加（每次金額由管理者輸入正值）。
2. 對同一使用者同一週重複提交相同 `idempotencyKey`，或兩位管理者並發送出不同 `idempotencyKey` 的兩筆獨立追加申請。
3. 預期：相同 `idempotencyKey` 只套用一次；不同 `idempotencyKey` 的兩筆追加皆各自累加至週累計，不互相拒絕、不遺失更新；追加只對指定使用者該週有效，日上限仍照常生效；稽核紀錄完整（含每筆金額與生效當下之週累計）。

### 7a. 第一級同週多次追加，日上限仍有效

1. 第一級帳號（base weekly US$15）本週已用滿週額度。
2. 管理者對該使用者於同一週分別核准兩筆追加：US$10、US$8（無次數或倍數上限）。
3. 預期：週累計 = US$15 + US$10 + US$8 = US$33，週額度檢查通過；但當日若已用滿 US$3，仍回 `429 DAILY_QUOTA_EXHAUSTED`，需等隔日重置才能再次呼叫，週剩餘額度不受影響。

### 7b. 第二級同週多次追加，日上限仍有效

1. 第二級帳號（base weekly US$50）本週已用滿週額度。
2. 管理者對該使用者於同一週分別核准三筆追加：US$20、US$15、US$25。
3. 預期：週累計 = US$50 + US$20 + US$15 + US$25 = US$110，週額度檢查通過；但當日若已用滿 US$10，仍回 `429 DAILY_QUOTA_EXHAUSTED`，週剩餘額度不受影響。

### 7c. 追加撤銷與競態驗收

1. 對已有多筆 `active` 追加的使用者，管理者撤銷其中一筆 `topUpId`。
2. 預期：該筆金額立即自週累計移除，僅影響後續新的預留判斷；先前已 `reserved` 或 `settled` 的金額不因此撤銷被追溯作廢或造成使用中請求被拒絕。
3. 併發驗收：對同一使用者同一週同時送出多筆不同 `idempotencyKey` 的追加請求，shared store 之原子累加須確保最終週累計等於所有成功套用之追加金額總和，不得因併發讀改寫而遺失任一筆。

**A6 本次文件提案（待營運者批准，全部待測）**：日耗盡、週耗盡、below_floor、request 不足的六列 title／message／step 與四種完整信封依 [錯誤契約](contracts/error-and-quota-contract.md)，詳細 22 組隔離矩陣見 [Readiness](checklists/pipeline-readiness-report.md) P10／P11／P12／P22。驗證 below_floor 尚未耗盡且不得稱已滿；釋放／重置／有效週追加只能在可信後端確認足夠後恢復，週追加不提高日上限，uncertain 不自動釋額；request 不足不使其他較低成本功能／地圖全域不可用。不得由前端 code／scope／金額推算狀態或承諾恢復時間。本輪只交付文件，不執行本節應用／瀏覽器驗證。

### 8. 管理者儀表板權限

1. 未登入或 Session 無效呼叫管理讀取與異動端點。
2. 已登入非管理者、第一級、第二級帳號呼叫同端點。
3. 管理者呼叫同端點。
4. 預期：未登入為 401；非管理者為 403；管理者可讀取與異動；拒絕回應不洩漏管理資料。

### 9. 管理異動安全

1. 偽造前端 role、request body `isAdmin`、Header 權限欄位。
2. 對撤銷、降級、追加操作測試缺少 CSRF/idempotency/確認所需資料。
3. 預期：前端自報 role 無效；後端逐請求驗證管理者；重複提交不造成重複追加。

### 10. Geoapify 圖磚代理：受限狀態

1. 對 Public、未登入、未核准、撤銷、到期、日額度滿、週額度滿逐一進入探索附近。
2. 覆蓋首次進入、重新整理、舊分頁恢復、資格／額度變更與離線恢復。
3. 直接對 `/api/map/tile/{z}/{x}/{y}.png` 發出請求（不經前端 UI），驗證未登入／未核准／撤銷／到期回 401 或 403，日／週 US$ 額度不可用回對應 429，且皆不查快取、無對應 Geoapify 上游呼叫（以後端 mock/log 驗證）。
4. 預期：不掛載 `NearbyMap`；顯示靜態示意圖；`/api/places` 呼叫數為 0；`/api/map/tile/*` 對受限身分的直接請求也一律被拒絕，不查快取、不呼叫上游。

### 11. Geoapify 圖磚代理：合資格狀態與撤銷後即時拒絕

1. 第一級／第二級且日／週額度可用時進入探索附近。
2. 預期：可掛載既有互動地圖，圖磚經 `/api/map/tile/*` 代理取得；只有使用者明確搜尋才呼叫 `/api/places`；`/api/places` 仍需後端授權與額度預留。
3. 在地圖已掛載且已載入部分圖磚後，將該使用者核准撤銷或使其到期（不重新整理、不關閉分頁）。
4. 在同一分頁對地圖執行平移或縮放，觸發尚未快取的圖磚座標請求。
5. 預期：撤銷後的下一筆圖磚請求回 401/403，不查快取、不呼叫上游；報告須明確排除「撤銷前已完成的請求」與「裝置上已呈現圖磚影像」兩類不宣稱可追回的情形。
6. 驗證代理回應 `Cache-Control: private, no-cache` 與 `ETag`，確認瀏覽器對已快取圖磚的重複使用仍會先送出條件式請求並被代理重新驗證。

### 11a. Geoapify 圖磚代理：成本控制與快取

1. Mock 多位使用者對相同 `(z, x, y)` 座標重複請求。
2. 預期：每一筆通過 Session／核准的代理請求都增加該使用者 `userProxyRequestCount`，包含代理共用快取命中與 304；僅第一次未命中消耗 Geoapify credit（mock 上游呼叫數為 1、`estimatedGeoapifyCredits += 0.25`），後續由代理共用快取命中回應並增加 `sharedCacheHitCount`。
3. 模擬全站每日上游 credits 上限與單一使用者每分鐘／每日 proxy request 上限觸發。
4. 預期：全站 upstream credit 預留在呼叫 Geoapify 前以 shared store 原子完成；全站上限觸發回 503，個別使用者上限觸發回 429 `MAP_TILE_QUOTA_EXHAUSTED`；兩者皆不呼叫上游。
5. 模擬同一 tile key 多個並發 cache miss。
6. 預期：只有一個 in-flight 上游呼叫與一筆 0.25 credit 預留；等待者共用結果，不重複預留、不放大上游請求。
7. 模擬上游成功、明確未送達／未計費失敗、逾時與不確定是否計費。
8. 預期：成功轉 `settled`；明確未計費可 `released`；逾時或不確定轉 `uncertain` 並保守占用當日 site credit，不立即恢復。

### 11b. Geoapify 圖磚代理：瀏覽器／Service Worker／Vercel CDN 隔離

1. 合資格使用者載入互動地圖，記錄 `/api/map/tile/*` response headers。
2. 預期：`Cache-Control: private, no-cache`、`ETag`、`CDN-Cache-Control: no-store`、`Vercel-CDN-Cache-Control: no-store`；不得有 `public`、`s-maxage` 或 CDN cache-enabling header。
3. 重新請求同一張圖磚，確認瀏覽器送出 `If-None-Match`，代理先執行 Session／核准／個人 proxy request 計數，再回 304 或 200。
4. 撤銷使用者資格後，再請求同一張已快取圖磚。
5. 預期：代理回 403，不回 304、不回圖磚位元組、不查代理共用快取、不呼叫 Geoapify；報告需明確排除已顯示圖磚與瀏覽器歷史快照。
6. 檢查 Service Worker Cache Storage 與 `x-vercel-cache`。
7. 預期：`/api/map/tile/*` 不存在於 SW cache；Vercel 不以 CDN HIT 直接服務受保護圖磚。不得只以 header 存在標示 PASS，必須附 Network/HAR 與後端 mock/log 證據。

### 11c. Geoapify 帳戶方案與估算對帳

1. 由營運者在 Geoapify dashboard 查核實際 plan、daily credits、rate limit、white label/attribution 與 usage alert 設定。
2. 以低量測試呼叫比對 App `actualUpstreamRequestCount * 0.25` 與 Geoapify dashboard credit 增量。
3. 預期：差異在可解釋範圍內；若差異超過 10%，先調查 retina tile、重試、統計延遲、其他 Geoapify API 或計數錯誤，再調整上限。Free 3,000 credits/day 不得被當作已設定帳戶硬上限。

### 12. 靜態示意圖資產與 fallback

1. 驗證 mobile `4:3`、desktop `16:9` 裁切。
2. 驗證可見「示意圖」、替代文字、破圖 fallback、查看東京百科操作。
3. 預期：無 pan/zoom、marker、定位、導航或地點點選能力。

### 13. PWA 與快取

1. 檢查 Service Worker cache storage。
2. 離線或舊 App Shell 中嘗試呼叫付費 API。
3. 預期：`/api/` 私人回應與 credentials 不被快取；公開靜態內容可用；付費 API 仍需即時後端判定。

### 14. 既有回歸

1. 執行既有 API 測試與 PWA red gate。
2. 預期：在實作完成後不回歸既有公開內容與六端點 schema；新增拒絕情境另有測試。

### 15. OIDC／Shared Store／管理者來源故障

1. 模擬 OIDC callback state 失效、token exchange 失敗、shared store timeout、管理者 allowlist 缺失或格式錯誤。
2. 預期：不建立 Session；受保護 API 與圖磚代理在無法可信確認時 fail closed（401/403/503），不呼叫上游；管理 API 不允許異動；Public 靜態功能仍可用。

## 建議命令（待 Implement 後確認）

### 16. 409、403 優先序與統一 503（FR-049、FR-050、FR-055；待測）

1. 同一有效使用者重複送出同鍵同內容、同鍵不同內容；再撤銷資格並以原 key 重送。
2. 模擬成本模型無效、過期、未證明、端點未啟用、版本封鎖與 store unavailable。
3. 預期：前者精確回 `409 DUPLICATE_REQUEST`／`409 IDEMPOTENCY_CONFLICT` 及指定繁中訊息，不自動重送、不重新授權；撤銷資格先回 403 且不含原 reservation ID／狀態。所有內部成本原因對外僅回 `503 PROTECTION_SERVICE_UNAVAILABLE` 指定文案，不含價表版本、內部設定或 `quotaScope`，上游呼叫為零。「查看目前狀態」不表示成功，具體查詢方式尚未定義。

### 17. Trusted registry、lease、對帳與隱私（FR-051～FR-056；待測）

1. 由可信 registry 驗證有效期、端點適用性、`live`、封鎖狀態與證據；試圖由呼叫端指定金額、版本或自由字串估算欄位。
2. 逐端點以已核准的最長執行時間加結算緩衝計算 lease；不使用共同固定期限，本輪不指定秒數。
3. 重複執行到期清理，模擬 store timeout、窗口跨期、晚到結果、重複結算及結算超過預留。
4. 預期：production 六端點保持 `live:false`；到期轉 `uncertain` 並保留原窗口／預留、不退款、不重放；store timeout 不代表寫入未完成；晚到結果只記錄；重複結算需核對金額及語意；超額可驗證並封鎖版本；請求指紋用伺服器持有金鑰 HMAC、`estimateInputs` 僅允許逐端點數值／enum。保存期限與金鑰輪替待決，不建立 production key。
5. 真實 Redis/Lua key/hash-slot、原子更新與保存策略須以 T019 後續技術驗證取得證據；mock 不算證據。

```powershell
npx vitest run --pool=threads tests/api
npm run test:pwa-red-gate
```

### 17a. Batch-M3a A4 隔離結果（2026-10-06）

- 本輪只測 `cost-registry.test.ts` 的可信依賴／估算器／store mock：拒絕金額、version、model、tier、attempts 與摘要注入；拒絕未核准、live:false、尚未生效、到期、缺上界或矛盾價格／核准摘要；封鎖與預留競態、改版本／等值係數仍封鎖、同版本異摘要拒絕、既有預留在封鎖／到期／registry 故障後仍可保守結算。speech 持續受阻。
- targeted 6 files／139 tests；`tests/api api/_lib` 回歸 22 files／272 tests；build 與受影響測試獨立 type-check 均通過。精確本機命令、修補迭代與限制見 tasks 的 Batch-M3a 執行紀錄及 Analyze report。
- 僅代表程式契約已修補；尚未證明真實輸入上界、真實成本上界、Redis/Lua 或 handler 保護。T140 部分完成、T019／T138 未完成部分、12 個 checklist gate、T135 與正式整合均保留，production 六端點 live:false，功能 005 非 READY。

## 完成判準

所有情境需有自動化測試或可稽核人工證據。文件同步檢查不等於應用程式測試 PASS；目前停在 Implementation Readiness Gate，未進入 Implement。

### 17b. C1 收斂＋本輪 H1／H2／M1／M2（2026-10-06，限定隔離修補）

- C1：正常佐證有效使用 `accounted`；超額完整入帳且版本／摘要雙封鎖佐證有效使用 `accounted_cost_bound_exceeded`，原 API 契約仍為 503。佐證／usage 矛盾亦 503、不退款、不重送；handler 未接線，不把此契約測試當成端點外顯證據。
- H1／H2：command 時間與注入 lease 精確一致，回應延遲至新授權時 lease 失效即拒絕；結算／cleanup 的原窗口 usage 與歸屬須同次原子佐證。歷史預留可過期讀取／保守結算。
- M1／M2：registry 原物件估算後修改不污染快照；memory mock 同時發起 cleanup／settle 並控制兩種原子順序；部分完成或 timeout 後 cleanup 重跑、settle timeout 後延遲成功與同語意重送、跨日週及不重授執行權。
- 本批新增 `tests/api/quota-atomic-evidence.test.ts`（44 cases），registry 新增 1 case；API 回歸 23 files／317 tests，專案與本批測試獨立 TypeScript 均 exit 0。精確命令見 tasks／Analyze report。
- T136／T138／T019／T140 保持部分完成、未勾選，T135 未執行。上述通過只限本機隔離契約；正式參數、Redis、排程、可信對帳、權威 G、handler／UI、真實服務及部署未完成，005 非 READY。
