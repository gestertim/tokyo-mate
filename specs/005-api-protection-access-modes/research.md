# Phase 0 Research: 005 API 防護、核准存取與預算額度

## D13 現行本機查證（2026-10-07）

指定版已實裝，registry integrity／必要傳遞依賴、Windows x64 native loader、local signed RSA/JWKS 與 raw image decode 實跑見 [證據](../../docs/verification/005-local-implementation-evidence.md)。`sharp@0.35.5` 實際依賴 `semver`／`@img/colour`／`detect-libc`；`jose@6.2.12` 此次 registry 未宣告 engines，不把舊表的 engine 當新證據。libvips Windows bundle 同樣有 LGPL-3.0-or-later，notices 保留、部署交付義務仍待查驗。Vercel runtime 未確認只阻擋部署；openid binding不連Google帳戶，單次config刻意不做跨請求JWKS cache。

下方「目前／最新／尚未實作／待 dependency 批准」均是各批歷史快照，不覆蓋現行 D13 本機批准；D01 成本與 output cap、D07／D08 [epoch 草案](contracts/request-epoch-and-key-lifecycle.md)、D14、正式 gate 未解除。

## 歷史：D10／D11 最新批准（2026-10-07）

本人端點、reasonCode／狀態文案、body與response上限、限流及分頁／去重／撤回已批准，本機沿用既有atomic authority與Session／reader／limiter，不新增dependency。完整JSON上限測量含success／data／nextOffset；縮頁後以實際items數續頁，單筆超限503，不把字元數當bytes。D01／D07／D08／D13／D14仍未決；下方待審描述為批准前歷史，不解除正式gate。

## R15. D13 套件、runtime 與 D14 資源價格查核（2026-10-07；批准前歷史）

官方 registry metadata 查核精確版、license、直接依賴、Node engine、unpacked size 與 SRI；這些是研究資料，不是安裝授權或 Vercel artifact size。

| 套件／來源 | 查核事實 |
| --- | --- |
| [`openid-client@6.8.8`](https://registry.npmjs.org/openid-client/6.8.8)／[官方 repository](https://github.com/panva/openid-client) | MIT；ESM、附 `.d.ts`；直接 runtime dependencies 為 `jose@^6.2.12`、`oauth4webapi@^3.8.8`；registry 精確版 unpacked 221,768 B。該版 registry 未宣告自身 Node engine。 |
| [`jose@6.2.12`](https://registry.npmjs.org/jose/6.2.12) | MIT；ESM、附 `.d.ts`；Node `>=20.19.0`；unpacked 210,660 B。 |
| [`oauth4webapi@3.8.8`](https://registry.npmjs.org/oauth4webapi/3.8.8) | MIT；ESM、附 `.d.ts`；unpacked 326,361 B。 |
| [`sharp@0.35.5`](https://registry.npmjs.org/sharp/0.35.5)／[official installation](https://sharp.pixelplumbing.com/install/) | Apache-2.0；TypeScript／ESM exports；Node-API v9，Node `>=20.9.0`；Linux x64 glibc platform packages are optional native packages. |
| [`@img/sharp-linux-x64@0.35.5`](https://registry.npmjs.org/@img/sharp-linux-x64/0.35.5) | Apache-2.0；Linux x64／glibc `>=2.28`；unpacked 427,138 B；optional dependency on `@img/sharp-libvips-linux-x64@1.3.4`. |
| [`@img/sharp-libvips-linux-x64@1.3.4`](https://registry.npmjs.org/@img/sharp-libvips-linux-x64/1.3.4) | LGPL-3.0-or-later；Linux x64／glibc `>=2.28`；unpacked 18,711,101 B. The three Linux x64 packages total 20,100,407 B unpacked; deployment artifact must be measured after an approved install/build. |
| [Vercel Node.js version docs](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) | Last updated 2026-02-27; lists 24.x default and 22.x／20.x available; the separate [Node 20 deprecation announcement](https://vercel.com/changelog/node-js-20-is-being-deprecated-on-october-1-2026) is past its announced date. Owner must verify project setting and deploy eligibility, not infer current runtime from these generic docs. |
| [Upstash Redis pricing](https://upstash.com/pricing/redis) | Accessed 2026-10-07: Free includes 256 MB／500K commands per month; upgrade to Pay-as-you-go requires a credit card; PAYG command rate is US$0.20／100K, bandwidth 200 GB/month included then US$0.03/GB, storage first 1 GB included then US$0.25/GB. The free tier has no PAYG budget; PAYG budget cap rate-limits when exceeded. Recheck at operation approval; not a spend authorization. |

Vercel file-level runtime settings and the deployed Function architecture are not published by generic docs. Current repo `package.json` has no `engines.node`, while `vercel.json` lacks a Node runtime selection; local Node version is not production evidence. Need owner-provided Vercel Project Settings screenshot/export (Node.js Version, project setting), preview build/runtime version, and function architecture before either package approval. No Vercel/Google/Upstash account was queried or modified in this review.

## 2026-10-07 決策同步後本機證據

原附錄是前輪現況，不作本輪新結果。D02解析／輸入限制、D03 PCM60秒／bytes、D04送出副本、D05逐端點lease、D06期限、D09UI30秒、D12提示、D16／17本機參數已批准；D01、D07／08、registry7天、D10／11具體細節、D13／14仍依[決策界線](readiness-decisions.md)。

完整builder對應既有travel／translation／photo-translate送出字串；本機Node唯讀量測：travel固定875 B、額外包裝36 B、16384 B知識＋1000 UTF-16最大3000 B時完整文字20295 B；若固定prompt允許到4096 B，僅文字容量候選23516 B。photo-translate最大instruction1058 B、原文包裝99 B、原文6000 B合計7157 B；OCR instruction627 B，不含影像tokens／message框架。這些是bytes量測與組裝一致性，不是tokenizer、service tier、vision成本或新的核定上界。舊24100與相關預留數字不可據此轉為live；六production端點仍停用。

前端改為WebAudio固定16 kHz mono PCM、最長60秒，採已存在ScriptProcessor API以避免新dependency／Worklet部署面；API已deprecated，真實Chrome／Safari／Firefox可行性與取樣率仍待T133，無支援就明示文字替代，不fallback壓縮格式。自動停止只停止／保存本輪暫存音訊，不自動送付費轉錄。照片裁切原座標不变，送出副本縮至2048最長邊、3 MiB上限，不反覆降品質；backend只接受可信decoder port的實際尺寸，未注入時503，不用header sniff或前端宣告冒充完整解碼。decoder選擇與新dependency仍待批。

OAuth清理有sorted expiry index硬批次上限、兩順序／重跑測試；rate以Redis TIME／PX固定窗口；圖磚leader回傳原子時間並嚴格檢查派送剩餘。Lua interpreter＋Redis/cjson／TTL替身不是正式Redis。正式外部來源／SDK／price／CDN證據均未新增；最終實跑結果見[本輪證據](../../docs/verification/005-local-implementation-evidence.md)。

## 歷史：2026-10-07 本機現況附錄（T003～T005／T008；不作現行狀態）

本次只盤點最新程式，不重審已結案批次。已批准政策不重新詢問；尚未核准的參數／契約集中於[決策包](readiness-decisions.md)。所有六個HTTP `POST` exports現在先經[paid boundary](../../api/_lib/paid-endpoint-boundary.ts)，未配置回503，已注入者仍僅可拒絕；下表`executeUpstream`是保留的內容實作，不代表HTTP可成功呼叫，也不是完整成功管線。

### T003：六端點現況輸入／呼叫限制

| 檔案 | 保留內容實作的現況檢查 | 真正剩餘工作 |
| --- | --- | --- |
| [assistant](../../api/assistant.ts) | text非空且≤1,000 UTF-16 units；既有路由／語氣檢查，無max_output_tokens | 完整envelope／prompt／catalog上界、白名單／輸出cap／成功descriptor |
| [transcribe](../../api/transcribe.ts) | FormData audio非空≤10 MiB，MIME五種容器、arrayBuffer二次大小檢查；whisper-1 | 尚未接固定PCM helper／重建WAV；前端仍MediaRecorder、無60秒上限；正式成本與數值待批准 |
| [places](../../api/places.ts) | coordinates有限／範圍，manualArea非空≤50；category allowlist；query trim但無長度上限；Nearby或Text單次擇一，fieldMask含editorialSummary | query100／envelope／timeout待批准；不變更既有欄位SKU |
| [speech](../../api/speech.ts) | text1～500、ja／zh-TW、speed enum，gpt-4o-mini-tts／MP3 | 沒有可信輸出計費上界，依已批准S1維持受阻，不補假設速率 |
| [photo-ocr](../../api/photo-ocr.ts) | regionVersion正整數但無10位上限、JPEG／PNG／WebP data URL、base64 decoded≤10 MiB | 尚無dimensions／3 MiB／2,048邊長／detail-high／輸出cap可信成功接線 |
| [photo-translate](../../api/photo-translate.ts) | sourceText非空≤2,000、zh-TW／ja；無max_output_tokens | 完整envelope、模型白名單／輸出cap／成功descriptor |

[OpenAI helper](../../api/_lib/openai.ts)已有`maxRetries:0`，timeout只在options明列時傳入；保留executeUpstream尚未逐端點傳正式timeout。`getOpenAIModel`仍可由env覆寫；不能把fixture白名單當HTTP正式上界。production價表全live:false保持原狀。

### T004：Service Worker排除面

[service-worker.ts](../../src/service-worker.ts)在fetch handler最前面排除pathname `/api/`，`isCacheableRequest`也拒絕`/api/`；因此涵蓋六端點與map/tile、auth、me、admin，不需要新增逐類排除或新offline架構。排除在navigation fallback之前；App Shell／靜態百科／公開音檔邊界保留。這是本機程式盤點，不證明CDN headers／既有裝置cache／正式HAR。

### T005：Geoapify與Places最新路徑

- [NearbyMap](../../src/features/nearby/NearbyMap.tsx)的tile URL已是同源`/api/map/tile/{z}/{x}/{y}.png`；Geoapify／OSM attribution連結不是直連tile fallback。
- [NearbyScreen](../../src/screens/NearbyScreen.tsx)由map eligibility判斷是否掛圖；定位、明確搜尋／emergency操作前重新查access，受限保留示意及公開入口，不在mount時自動定位。
- [api client](../../src/services/api.ts)六操作共用request，先loadOwnQuota再單次fetch；Places送`/api/places`。前端檢查只是UX，不能取代server reserve。
- 改造剩餘是通用access hook的明列maxAge／pageshow／bfcache與正式圖磚資源參數、六handler成功接線及真實CDN／Network證據；不是仍需移除舊直連。既有同源map與PWA不重做。

### T007／T008：骨架與runner

現有test script／Vitest React-jsdom／Playwright Chromium與`*.e2e.ts`足夠本機分類；無新增script／config／dependency需要。歷史提案檔名與等效現有測試的對應、隔離限制見[環境檢查表](checklists/isolated-environment.md)。本輪最小回歸3檔74tests，不是全套或真實服務驗證。

**狀態**：Technical Plan 架構與初始額度已核准；外部服務實際啟用、付費升級、秘密值與部署仍待獨立批准；本文件不構成 implementation 授權。查核日期：2026-09-25。

本文件同步最新版 canonical specification 與 UX handoff。舊草稿中的 Public 付費 API、匿名付費 Session、全站軟／硬停止、部分端點停止與 Geoapify A/B 待決結論均已撤回。

---

## R1. Public 邊界與付費 API 授權

- **Decision**：Public 僅可使用完全不呼叫六個付費 API 的公開功能。六個端點一律需要有效登入 Session、有效核准資格，以及可用日／週額度。
- **Rationale**：canonical spec 已明確撤回 Public 付費 API 與匿名付費 Session；Constitution XIII 要求後端在上游前執行授權與成本控制。
- **Alternatives considered**：
  - Public 額度內可呼叫六端點：已撤回，拒絕。
  - 匿名 Session 作為付費額度歸屬：已撤回，拒絕。

## R2. 身分驗證與 Session

- **Decision**：採 OAuth 2.0 Authorization Code + PKCE 對接單一 OIDC 供應商；callback 成功後由後端建立 app-owned opaque Session，Session 有效性每次查 shared store。
- **Rationale**：避免自製密碼系統，同時滿足登出、Session 失效與資格撤銷後下一次請求即生效。
- **Alternatives considered**：
  - 純 JWT 且不查 server-side state：撤銷或登出後無法下一次請求立即拒絕，拒絕。
  - 商用全功能會員平台：可能超出本功能「核准資格與額度」範圍；可作未來選項但非第一版推薦。

## R3. 管理者可信來源

- **Decision**：Checkpoint 提三案：M1 server-side allowlist（推薦第一版）、M2 shared store Admin Principal Record、M3 OIDC provider group/claim。不得信任前端 role。
- **Rationale**：FR-033 要求管理者身分來自可信且不可由使用者自行提升權限的來源；M1 最小依賴且容易審查，M2 稽核性較高但 bootstrap 較複雜。
- **Alternatives considered**：
  - 前端傳 `isAdmin` 或 localStorage role：明確違反 spec，拒絕。
  - 只用確認對話框保護管理操作：UX 防誤操作而非授權，拒絕。

## R4. Shared Store 與原子預留

- **Decision**：推薦單一 race-safe shared store，候選 Redis-compatible KV；以 Lua script、transaction 或等效原子 primitive 同時預留日／週額度。
- **Rationale**：Vercel serverless 多執行個體下，記憶體計數不能防併發超額。Vercel Storage overview（last updated 2026-09-03）說明 Marketplace key-value stores 適用 session storage 與 rate limiting。
- **Alternatives considered**：
  - 單程序記憶體：違反 race-safe 要求，拒絕。
  - Postgres transaction：可行但第一版比 Redis-style 原子計數更重；若 Checkpoint 已偏好 relational audit/query，可改採。

## R5. 成本估算與結算

- **Decision**：每次付費呼叫前使用可信最大估算成本原子預留；成功後依 usage 或既定估算結算；明確未計費失敗可釋放；逾時或不確定保守保留。具體上界、公式與數值見 R13 與 plan.md §4.2。
- **Rationale**：規格要求不得先呼叫供應商再更新用量；同時要求區分內部估算、已預留金額與供應商實際帳單。
- **Alternatives considered**：
  - 呼叫後才記帳：會在併發與失敗情境下超額，拒絕。
  - 不確定是否計費時立即釋放：可能低估實際帳單，拒絕。

## R6. 時間窗口

- **Decision**：以 `Asia/Taipei` 作權威時區；日窗口每日 00:00，週窗口每週一 00:00，由後端計算並回傳 reset time。
- **Rationale**：canonical spec 已定案；瀏覽器時鐘不可影響恢復。
- **Alternatives considered**：
  - UTC 或使用者所在地時區：與 spec 衝突，拒絕。

## R7. 供應商與平台事實查核

| 來源 | 查核結果 | 未確認處 |
| --- | --- | --- |
| Vercel Request headers（last updated 2025-12-13） | `x-forwarded-for` 由 Vercel 覆寫，不轉發外部 client 偽造 IP；Enterprise Trusted Proxy 是例外 | 帳戶是否啟用 Trusted Proxy 需專案擁有者確認 |
| Vercel Functions Limits（last updated 2026-08-24） | request/response body 最大 4.5 MB；超過可回 `413 FUNCTION_PAYLOAD_TOO_LARGE`；Hobby Node 最大 300s | 帳戶方案、memory、region 未由 repo 判斷 |
| Vercel Storage overview（last updated 2026-09-03） | Marketplace storage 可 provision Neon/Upstash/Supabase 等；KV/Redis 適合 session storage 與 rate limiting | provider 定價與原子能力待選定後查 |
| OpenAI pricing / deprecations | `gpt-4o-mini`、`gpt-4o-mini-tts` 與 Whisper 有官方價格；`whisper-1` 於 2027-02-26 下架 | 本專案帳戶可用性、實際 token/usage 分布需測 |
| Google Places data fields（last updated 2026-09-19） | `editorialSummary` 對 Nearby/Text Search 屬 Enterprise + Atmosphere | 若移除此欄位需產品決策 |
| Google Maps pricing（last updated 2026-09-14） | Places Nearby/Text Search Enterprise + Atmosphere 首層 US$40/1000 | 免費額度、折扣、稅與帳戶彙總需帳戶確認 |
| Geoapify pricing | Free plan 3,000 credits/day；可 production/commercial；超額為 soft limit；map tile rate limit 可高於一般 API | tile tokenization/revocation、每 tile credit 與 API key restriction 未由本頁確認 |

## R8. Geoapify 方案 A 可行性與圖磚代理（本次已同意架構方向）

- **Decision**：採後端圖磚代理（G1）取代純前端 gating。`NearbyMap` 改為向 `GET /api/map/tile/{z}/{x}/{y}.png` 取圖磚，Geoapify API key 只存在伺服器端；代理逐請求驗證 Session、核准資格、六端點日／週 US$ 額度可用性與獨立圖磚額度後才查快取或呼叫 Geoapify 上游。前端 gating（不掛載受限狀態地圖）保留作為第一層 UX，但不再是達成「下一筆請求即反映最新狀態」的唯一手段。
- **Rationale**：現有 `NearbyMap` 一掛載即建立 browser-direct tile layer，後端無法攔截已排程或正在進行的 Geoapify 網域請求，此為前一版阻擋項 G-001 的根因。改由代理逐請求驗證後，撤銷或額度耗盡生效後的下一筆圖磚請求（含舊分頁下一次平移／縮放觸發的請求）必然被拒絕，不查快取、不呼叫上游；但仍無法追溯撤回撤銷生效前已完成的請求，或已呈現於裝置上的圖磚影像位元組——這是所有伺服器架構共通的物理限制，非本設計特有缺陷。
- **Alternatives considered**：
  - CSS 隱藏地圖：不會停止 tile request，拒絕。
  - 僅在 `/api/places` 後端加授權：能保護 Places，但不能保護 Geoapify tile，拒絕作為完整達標方案。
  - 純前端 gating、不做後端代理：無法保證已掛載舊分頁「狀態變更後」零請求，已於前一版列為阻擋項 G-001，現已由代理設計取代。
  - 供應商 tokenized tile 或短效簽章 URL（原 G2）：官方文件查無此能力（見 R11），拒絕作為第一版方案；若未來 Geoapify 提供此能力可重新評估。
  - 放棄互動圖磚、全面改用靜態示意圖（原 G3）：屬重大產品行為變更，需回 spec/UX；本次使用者已同意採 G1，故不採 G3。

## R11. Geoapify 圖磚代理之計費、快取與 ToS 事實查核

- **Decision**：圖磚代理成本以 Geoapify「credit」計費（1 次圖磚請求 = 0.25 credit），非直接美元單價；第一版採獨立、有界的圖磚額度與代理端共用快取，不併入既有六端點 US$ 日／週預算。計數口徑需分離為：每位使用者向代理提出的請求次數（含 cache hit/304，供個人 rate/volume 使用）、共用快取命中次數、實際上游請求與預估 credits（供全站 upstream credit 上限使用）。初始數字皆為待批准提案：120 proxy requests/min/user、1,000 proxy requests/day/user、Free 帳戶 2,400 upstream credits/day（API 10 則 8,000/day）、共用快取 TTL 7 天。
- **Rationale／來源（查核日期 2026-09-25）**：
  - `apidocs.geoapify.com/docs/maps/map-tiles/`：Pricing 章節列出「1 request = 0.25 credits」「100 map tiles cost 25 credits」；FAQ 明確允許快取、儲存與再散布產生的圖磚（"Can I cache or redistribute map tiles? Yes"），並說明底層地圖資料每月更新一次；attribution 規則要求 Geoapify（Free plan）、OpenStreetMap 與 OpenMapTiles（除 osm-carto 外）歸屬。
  - `www.geoapify.com/pricing/`：Free plan 3,000 credits/day，可用於商用與正式站；超額為 soft limit（Geoapify 會聯絡要求升級，非立即封鎖）；FAQ 說明「圖磚請求較一般 API 輕量，rate limit 可用約 4 倍換算」。
  - `www.geoapify.com/map-tiles/`：付費方案範例 API 10 = US$59/月、10,000 credits/day（40,000 張圖磚/日）。
  - `apidocs.geoapify.com/docs/maps/map-tiles/`：官方估算公式為 `MAP_WIDTH * MAP_HEIGHT / (256 * 256) * NUMBER_OF_USERS * USER_ACTIVITY_COEFF`，並例示 800×600 約 8–10 tiles、1200×800 約 15–20 tiles；此支撐 Plan 中低／中／高使用量試算。
  - Vercel CDN Cache（last updated 2026-09-14）：Vercel Function response 若含 `private`、`no-cache` 或 `no-store`，不符合 CDN cacheable criteria；因此圖磚代理仍須用 Network/HAR、`x-vercel-cache` 與後端 mock/log 證明每筆重新驗證抵達代理，而不能只因 header 存在就標 PASS。
  - MDN Cache-Control（last modified 2026-09-17）：`no-cache` 代表可儲存但 reuse 前需 revalidate，不等於 `no-store`；但對 back/forward cache 或歷史導覽不保證重新驗證。MDN ETag/If-None-Match 說明條件式 GET 可由 server 在資源未變時回 304。
  - **未確認處**：三個查核來源均未提及任何供應商端「短效 tokenized tile」、逐請求撤銷或個人化 tile URL 能力；因此撤銷保證只能由本代理（非 Geoapify）強制執行。實際帳戶方案、region、白牌（White label）設定與確切 rate limit 數值仍需帳戶擁有者確認。
- **Alternatives considered**：
  - 直接把圖磚成本換算為 USD 並併入既有 tier1/tier2 日／週額度：因 Free/大多數付費方案以帳號層級 credits/月計費，非可信的單一請求 USD 上界，拒絕在無明確 $/credit 定價前這樣做。
  - 不設任何圖磚額度、只靠代理驗證授權：無法防止已核准使用者集體用量意外超過 Geoapify 帳號日額度，拒絕。

## R12. 005 首選服務方案（待批准）

- **Decision**：OIDC 第一版建議 Google OAuth/OIDC + Authorization Code + PKCE + app-owned opaque Session；shared counting/session/invite/approval store 建議 Upstash Redis via Vercel Marketplace Pay as You Go；管理者可信來源建議 M1 server-side OIDC subject allowlist；Geoapify 需先驗證實際帳戶方案，若中高用量成立則建議 API 10（US$59/month、10,000 credits/day）。
- **Rationale／來源（查核日期 2026-09-25）**：
  - Auth.js deployment docs 說明 OIDC provider 需要 client id/secret/issuer、serverless callback URL 與 secret；本專案不是 Next app，Plan 僅採 OIDC flow 原則與 provider env 需求，不在本階段安裝 Auth.js。
  - Vercel Storage overview（last updated 2026-09-03）列 Marketplace storage 可 provision key-value stores，適用 session storage 與 rate limiting，且會注入環境變數。
  - Upstash Redis pricing：Pay as You Go 為 US$0.20/100K commands，前 1GB storage free、200GB bandwidth/month free，可設定 budget；Free tier 500K commands/month、256MB，但 production 控制面不應假設永遠免費足夠。
  - Vercel Request headers（last updated 2025-12-13）說明 `x-forwarded-for` 由 Vercel 覆寫，Trusted Proxy 為 Enterprise 例外；若未來要用 IP 輔助 abuse detection，仍須先確認帳戶未啟用 Trusted Proxy。
- **Alternatives considered**：
  - Auth0/Clerk：產品化程度高，但新增會員平台、供應商 lock-in 與可能月費；第一版不作首選。
  - Neon/Postgres：ACID 與稽核查詢較佳，但對高頻 tile counters/rate limit 較重；若營運者優先關聯查詢與報表，可在 Checkpoint 改選。
  - Vercel Global Config：適合低頻設定讀取，不適合高頻原子計數與 Session 寫入。
  - OIDC group/claim 管理者：集中管理，但 provider-specific，且需證明 claim 不可由使用者自助修改；第一版以 env allowlist 較小。

## R13. 六端點成本上界：官方依據、查核與取捨（2026-10-06）

- **Decision**：每個端點以「可由後端強制的計費參數上界 × 官方單價 × 嘗試次數 A × 價格係數 S」預留（公式與數值見 plan.md §4.2）；無法建立可信上界者在付費上游前拒絕；模型以白名單釘選。
- **官方來源與查核日期（皆為 2026-10-06 當日抓取）**：
  | 項目 | 來源 | 查得內容 |
  | --- | --- | --- |
  | `gpt-4o-mini` 文字價格 | developers.openai.com/api/docs/pricing 與 models/gpt-4o-mini | 標準 US$0.15 輸入／US$0.60 輸出（每 1M tokens）；Fast 層級 US$0.25／US$1.00；最大輸出 16,384 tokens；Responses API 受支援；文件註明區域處理端點對 2026-03-05 之後發布的模型加價 10%（`gpt-4o-mini` 為更早模型，是否適用需帳戶確認，故 S 仍涵蓋） |
  | 影像 token | developers.openai.com/api/docs/guides/images-vision | `gpt-4o-mini` 屬 tile 計價：base 2,833、每 tile 5,667；`high`／`auto` 規則：先縮至 ≤ 2048×2048，再把最短邊縮至 ≤ 768，以 512px tile 覆蓋；`low` 為固定 base tokens；預設 `detail` 為 `auto`；支援 JPEG／PNG／WEBP／非動畫 GIF |
  | `gpt-4o-mini-tts` | models/gpt-4o-mini-tts、pricing | 文字輸入 US$0.60／1M tokens、音訊輸出 US$12.00／1M tokens；模型頁標示最大輸入 2,000 tokens；**未提供音訊 token／秒**；預設 snapshot `gpt-4o-mini-tts-2025-12-15` |
  | Whisper | pricing、models/whisper-1 | US$0.006／分鐘 |
  | 停用公告 | developers.openai.com/api/docs/deprecations | `whisper-1` 2027-02-26 停用（建議 `gpt-live-transcribe` 或 `gpt-transcribe`）；`gpt-4o-mini-tts-2025-03-20` 與 `gpt-4o-mini-tts-2025-12-15` 2027-01-06 停用（建議 `gpt-realtime-2.1-mini`）；`gpt-4o-mini` 未見於停用清單 |
  | Google Places (New) | developers.google.com/maps/billing-and-pricing/pricing（上次更新 2026-09-14）、places/web-service/data-fields（上次更新 2026-10-01） | Nearby／Text Search Enterprise + Atmosphere 首層 US$40／1,000；Pro US$32／1,000；`editorialSummary` 對 Nearby 與 Text Search 皆屬 Enterprise + Atmosphere；`businessStatus`、`displayName`、`formattedAddress`、`location`、`types`、`id` 分屬 Pro 或較低層級（Nearby 的 `id` 為 Pro）。計價單位為「請求」，與回傳筆數無關 |
  | Vercel 請求大小 | 沿用 2026-09-25 查核（Functions Limits，last updated 2026-08-24） | request／response payload 4.5 MB；本輪未重新抓取，實作前需再核對 |
- **關鍵推導與判斷**：
  - **輸入 token 上界**：byte-level BPE 下 token 數 ≤ UTF-8 byte 數，故以完整送出文字的 byte 數作為嚴格上界，無需 tokenizer dependency。
  - **影像 token 上界**：依官方 tile 規則，輸出尺寸必為「最短邊 ≤ 768、最長邊 ≤ 2048」，tile 數 ≤ ceil(768/512)×ceil(2048/512)＝2×4＝8，故 token ≤ 2,833＋8×5,667＝48,169，與原始像素數無關。這使「解析度」不需再作成本變數，但前提是模型固定為 `gpt-4o-mini` 且 `detail` 為 `high`／`auto`；任何 `detail: 'low'` 或換模型都需重算。現有 `MAX_IMAGE_BYTES` 為 10 MiB，但 Vercel 4.5 MB 平台上限使它實際不可達，故以 3 MiB 收斂。
  - **現況 A=3（待 T135 改為 A=1）**：`api/_lib/openai.ts` 以 SDK 預設建立 client（註解明示 `maxRetries` 與 timeout 維持預設）。OpenAI Node SDK 預設重試與 10 分鐘 timeout 已於 2026-10-06 唯讀核對本機 `node_modules/openai`（版本 7.15.0，`client.js` 預設 `maxRetries = 2`、`DEFAULT_TIMEOUT` 10 分鐘）。**A2 規劃已核准停用自動重試，A＝1；A＝3 撤回**；完整呼叫鏈核對見 plan.md §4.2.6，平台層是否另行重送與逾時後是否計費未查得，一律保守 `uncertain`。
  - **TTS 音訊長度**：官方價格頁與模型頁都沒有「每秒音訊 token 數」；公開資料常見的約 US$0.015／分鐘（約 20 tokens／秒）未在本輪抓取的官方頁面出現，故不得當作已驗證事實。**2026-10-07 修訂**：`gpt-4o-mini-tts` 模型頁只列「最大輸入 2,000 tokens」，未查得最大輸出 tokens 或音訊時長上限；先前 50 tokens／秒、2.0 字／秒為假設值，**已撤回為預留依據**。speech 真實呼叫標示受阻（只允許 mock），處置選項見 plan.md §4.2.4（A9）。**A9＝S1 規劃已核准（S2–S5 撤回）**：維持受阻、可 mock；逾時、串流中止、經驗速率、校準值、帳戶預算皆不得當成計費上界。
  - **2026-10-07 本輪新增查核**：（1）OpenAI Images and vision 頁：`gpt-4o-mini` 為 base 2,833／tile 5,667，支援 `low／high／auto`，`high` 與 `auto` 用 tile 規則；（2）Responses API reference：`max_output_tokens` 含 reasoning tokens、`service_tier` `default` ＝ 標準計價、回應實際層級可能不同；（3）Vercel 「4.5 MB」未定義 MB／MiB，保守取 4,500,000 B；（4）本機唯讀量測完整提示詞：`travelInstruction` 875 B、`translationInstruction` 404 B、`photoOcrInstruction` 627 B、`photoTranslateInstruction` ≤ 1,058 B、知識背景最大 525 B；（5）whisper-1／gpt-4o-mini-tts 停用日期本輪**未重新查核**。
- **音訊時長**：現有前端錄音器無時長與位元率限制；MediaRecorder 的 WebM 輸出常缺 Segment Duration，不能只讀 header。偽造容器的最壞情境無法靠不解碼證明。**2026-10-07 修訂**：不再接受「US$0.84 殘餘風險」或容器時間戳作為依據；改提 P1（前端固定格式 PCM WAV＋後端驗證與重建）、P2～P4（已撤回），見 plan.md §4.2.4（A10）。**A10＝P1 規劃已核准（P2／P3／P4 撤回）**：固定 16 kHz mono 16-bit PCM WAV；後端不信任 header 宣告，驗證實際 PCM 資料、固定格式與 frame 對齊並重建 44 B header；60 秒資料量 1,920,000 B 加標頭＝1,920,044 B 取代任何 1 MiB 提案（待核對）。**2026-10-06 唯讀查核**：MDN `AudioContext()` 指出 `sampleRate` 不被支援時丟 `NotSupportedError`、支援度因瀏覽器而異，故瀏覽器可行性（Chrome／Safari／Firefox）仍須真實驗證；OpenAI STT 指南列 `wav` 為支援格式、檔案上限 25 MB，並提示現推薦模型為 `gpt-transcribe`（模型白名單屬 A1，不在本輪變更）。
  - **價格係數 S**：OpenAI 文字端點 2.0＝Fast 層級（×1.667）×區域處理加價（×1.10）＝1.833，再留進位餘裕；Whisper 1.5、Places 1.25、TTS 1.25（其不確定性已改由 token／秒與說話速率假設承擔）。
- **Alternatives considered**：
  - 用歷史平均單價預留：違反 FR-017「不得以平均價格代替上界」，拒絕。
  - 以檔案大小推估音訊時長：位元率可任意壓低，不是上界，拒絕。
  - 對 photo-ocr 改用 `detail: 'low'`（固定 2,833 tokens）：成本最低但可能傷害 OCR 準確度，屬產品行為變更，需另案評估，本輪不採用。
  - 移除 `editorialSummary` 以降 Places SKU：屬產品行為變更（`whyRecommended` 內容），需回 spec／UX，本輪不採用。
  - 以每個端點各自的 `R_e` 判斷地圖可用性：會使昂貴端點的預留失敗關閉整個地圖與較低成本功能，拒絕；另提全域地板值 G；舊文 `G ＝ min` 涵蓋六端點在 speech／transcribe 無可信 `R_max` 時不可計算，故 2026-10-07 改為 G-A～G-E 五個候選比較，建議 G-B，待 A8 核准（plan.md §4.5.2）。**A8＝G-B 已規劃核准，G-A／C／D／E 撤回**（plan.md §4.5）。
- **仍需外部證據**：TTS 音訊 token／秒實測；Chrome／Safari／Firefox 錄音容器解析可行率；`max_output_tokens` 實測不誤傷正常輸出（官方 Responses API reference 已於 2026-10-07 核對：「包含可見輸出與 reasoning tokens」）；speech 輸出上界或校準值；vision `usage.input_tokens` 實測；本專案帳戶實際服務層級與 usage 欄位；OpenAI／Google 專案層級預算告警。

## R9. 靜態示意圖資產

- **Decision**：聊天中的圖不是 repository 資產；Plan 只列取得、授權、壓縮、響應式裁切、替代文字與 fallback 任務，不聲稱已整合。
- **Rationale**：spec FR-047 明確要求正式資產另行取得與整合。
- **Alternatives considered**：
  - 直接假設圖片已存在於 `public/`：事實不符，拒絕。

## R10. 撤回研究結論

下列舊 research 結論已失效：Public 可成功呼叫六端點、匿名 Session 付費額度、全站軟／硬停止、四端點軟停止、Public/Invite-only 付費模式切換、「不建管理者儀表板」，以及「Geoapify 只能靠前端 gating best-effort、達標架構待決（G1/G2/G3 並列）」。現行結論為圖磚代理（G1）已同意作為架構方向，見 R8、R11。

## R14. 005 已批准防護政策、隱私與技術證據界線

**批准來源與 gate 原文**：

- 本輪產品政策批准來源：使用者訊息「Tokyo Mate 功能 005 — 已批准政策的 Specification Sync」中「已批准政策」第 1–8 項；批准範圍為文件同步與 Analyze，並非應用程式實作授權。訊息原文限制：「本輪只修改指定規格文件，不修改程式、不執行 T135、不接線 handler、不提交或部署。」
- `.github/copilot-instructions.md` §Implementation Authorization 原文：「只有在使用者明確批准進入 `/speckit.implement`，且已完成 `/speckit.analyze` 與 Implementation Readiness Gate 後，才可依已批准的 Specification、Plan 與 Tasks 修改 application code。」
- `.specify/memory/constitution.md` §XI Authorization Boundary 原文：「Specify、Clarify、UX/UI、Plan、Checklist、Tasks、Analyze 階段本身皆不構成 implementation 授權。只有在 `/speckit.implement` 已通過 Implementation Readiness Gate，並取得成人教育者明確批准後，才可依已批准的 Specification、Plan 與 Tasks 修改 App implementation。」
- 因此本輪僅同步 005 文件與執行唯讀 Analyze；T135、handler wiring、外部服務、測試程式與任何部署均未執行。

**已批准政策的現行處置**：503 外部統一 `PROTECTION_SERVICE_UNAVAILABLE`；409 文案與不重送／不授權重放；可信 registry 產生估算並驗證有效期／live／封鎖／端點且 production 六端點 `live: false`；逐端點 lease 與結算緩衝（無秒數決定）；冪等過期清理與可信對帳；uncertain 原窗口保留、晚到結果只記錄；伺服器持有金鑰 HMAC 與估算欄位 allowlist；資格驗證優先於冪等結果揭露。具體契約見 canonical `spec.md` FR-049～FR-056。

**政策同步當時的唯讀 mock／測試核對與未解差異（歷史快照；最新批次狀態見下節與 Analyze report）**：

- `api/_lib/quota-fingerprint.ts` 目前為未加金鑰 SHA-256，且 `EstimateInputs` 接受 number/string/boolean 的任意鍵；不符合 HMAC 與逐端點 allowlist 要求。
- `api/_lib/quota-engine.ts` 有共用 `DEFAULT_LEASE_MS = 120_000`；不得視為已符合逐端點 lease 政策，後續須移除通用固定值。
- `api/_lib/quota-engine.ts` 對 store `already_applied` 只有在新狀態為 `applied` 時核對 settlement amount；對 `already_applied` 尚未充分比對金額／語意。測試目前有相同結果冪等及不同 transition 拒絕，仍須加入「同一 transition、不同金額／reason」測試。
- `api/_lib/shared-store.ts` 是介面；`tests/support/in-memory-shared-store.ts` 的原子與封鎖行為是單程序 mock，不能作為 Redis/Lua 原子、跨 slot、多 writer 或資料保存證據。T019 尚未完成。
- reservation 已記錄原日／週窗口，且 mock 對 lease 過期轉 `uncertain`、晚到結果只記錄、超額如實計入並封鎖版本；這僅限 mock 層。需測試 cleanup 重複執行與 store timeout 的結果未知語意。
- `PRODUCTION_COST_PRICE_TABLE` 為六端點 `live:false` 且空有效期，這是目前 fail-closed 設定；不得因 mock fixture 可估算而轉為 live。

**歷史 findings A1–A12 對照限制**：本機目前可讀的 `checklists/analyze-report.md` 記錄的是 B1–B5、C1–C5、M1–M4 與 R1 H1／H2／M1–M4；A1–A12 清單來源為使用者在本 Chat 貼入之「Tokyo Mate 005 — 歷史唯讀複審交接」（含 A1–A12 定義與歷史測試回報），非 repository 內獨立檔案。此處不把 plan 中決策代號 A1–A10 誤認為 findings，也不推定 A1–A12 已修復；逐項狀態須在本輪 Analyze 中另立來源與狀態表。

**測試結果 provenance**：

- 180 tests：tasks.md「2026-10-06 第一批 mock 批次證據」記錄命令 `node_modules\.bin\vitest.cmd run tests/api api/_lib`，18 files／180 tests；限定當時 mock 範圍，不是本輪測試。
- 208 tests：tasks.md／既有 analyze-report.md「R1 第一批 mock 審查修補」記錄命令 `npx vitest run tests/api api/_lib`，18 files／208 tests；限定 mock 修補範圍，不是本輪測試。
- 529 tests：來源為先前 Chat 執行回報 `vitest.cmd run`（全套件，52 files／529 tests，exit 0）。本輪未重跑、未獨立核驗；目前本機文件無原始輸出附件可供逐行追溯，因此不得標示為本輪 PASS 證據。

本輪未跑應用程式測試；文件一致性檢查不標示為測試 PASS。保存期限、HMAC 金鑰輪替與真實 Redis key/hash-slot／原子保存策略仍待決或待取得證據，未新增 secret、金鑰或外部服務。

### R14.1 Batch-M2／T139 更新（2026-10-06，僅隔離 mock）

使用者明確批准分離參數與注入式測試上限：已改為 Node HMAC-SHA-256，內容 keyed digest 僅留記憶體；store 不接受普通 contentDigest。六端點欄位與型別限制見 data-model §15.1，技術界線見 plan §10.4.1。key 為 secret KeyObject，由伺服器依賴注入，測試只用公開 TEST_ONLY 材料；無正式 key、環境設定、TTL、production 上限 fallback 或輪替政策。T139 的隔離資料最小化與指紋測試完成，不代表 A4 registry、正式稽核存取權限或真實持久層證據；speech、production `live:false`、T019／T138 未完成部分、T135 與 Batch-M3 保持原狀。

### R14.2 Batch-M3a／A4 更新（2026-10-06，僅隔離修補）

使用者批准 registry 由 server options 注入、reserve 只接收 allowlisted 估算輸入、內建估算器產生金額，並再次要求成本摘要由後端穩定計算、store 原子同查版本／摘要封鎖及版本一致性。現行入口取代 M2 任意 trustedCost 參數；技術契約見 plan §10.4.2、data-model §14.1 及 protected-endpoints contract。核准／上界 references、live entry、價格與 token 算術僅存在於 tests fixture；metadata 通過不證明原始資料上界、官方成本或供應商帳單。Node 內建 crypto 沿用，不新增 package、store resource、金鑰或 architecture layer。T140 只完成 registry 隔離子範圍，pipeline／handler／狀態查詢、T135 與真實服務仍未執行；Redis/Lua、正式逐端點 lease、正式批准與外部成本證據仍待取得。
