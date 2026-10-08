# 005｜本機隔離測試環境檢查表（T001／T007／T008）

**2026-10-07。這是執行環境盤點，不是 requirements-quality reviewer checklist；不使用批准勾選marker，不代替正式驗收。**

| 檢查範圍 | 已有工具／替身 | 本機隔離要求 | 未完成／外部界線 |
| --- | --- | --- | --- |
| OIDC／Session | config／flow／library port、Session lookup／create／revoke fixtures；本輪新增共享state create／consume adapter | issuer／aud／nonce／PKCE／期限測試；TEST_ONLY簽章材料，不放正式subject／secret；同state原子消耗一次 | 真實library binding、JWT／JWKS、Google callback與未使用state清理另待接續；decode不能替代verify |
| shared authority | memory store、Lua5.4.2 interpreter＋Redis/cjson harness、REST transport mock | 同authority測registry／G／資格／追加／日週／結算／cleanup；測timeout未知結果不退款 | 本機沒有redis-server／cli；替身不是Redis原子／TIME／TTL／跨process證據 |
| 付費provider | OpenAI SDK mock fetch、Places fetch mock、tile bytes mock | 上游call count≤1；拒絕零上游；不用真實API keys | 所有production `live:false`；付費、真實usage與帳單取證未授權 |
| 時間 | 測試固定時鐘、Asia/Taipei window helper | 日00:00／週一00:00／ISO週年、效期半開區間、lease等值／倒退、跨日週late outcome | fixture數值不變成正式lease／保存／freshness |
| 身分 | [identity矩陣](../../../tests/fixtures/005-identity-matrix.md) | Session與資格／tier／admin三軸獨立；撤銷後下一請求先403 | 真實subject與M1 env不配置 |
| 瀏覽器／PWA | 既有Playwright Chromium、loopback4174、[005 mock E2E](../../../tests/pwa/005-local-protection.e2e.ts) | 外部route abort、API mock、SW controller與App Shell存在後檢查API cache為空 | HAR若保存須去除cookie／token／subject；真實CDN／Safari／Firefox未驗 |
| repo safety | Git唯讀檢查、逐檔SHA-256 manifest | 保留dirty／untracked、index0、HEAD／tag／PDF不動；不scaffold、不建立.vscode | 不install／env／service／branch／commit／push／deploy／模式切換 |

## 已有測試骨架與等效路徑（T007）

Tasks歷史路徑是提案，不為相同證據複製測試。未建範圍留在集中決策包，不把測試檔存在當成整項完成。

| 原提案骨架 | 現有等效檔案／範圍 | 尚缺 |
| --- | --- | --- |
| `tests/api/auth-session.test.ts` | [session.test.ts](../../../tests/api/session.test.ts)、[oidc-flow.test.ts](../../../tests/api/oidc-flow.test.ts)、[oidc-provider.test.ts](../../../tests/api/oidc-provider.test.ts)、[redis-oauth-state-store.test.ts](../../../tests/api/redis-oauth-state-store.test.ts) | 真實library／JWT／JWKS、輪替／期限接線 |
| `tests/api/approval-gate.test.ts` | [paid-handlers-rejection.test.ts](../../../tests/api/paid-handlers-rejection.test.ts)、[protected-endpoint-pipeline.test.ts](../../../tests/api/protected-endpoint-pipeline.test.ts) | 六HTTP完整成功管線 |
| `tests/api/quota-reservation.test.ts` | [quota-reservation.test.ts](../../../tests/api/quota-reservation.test.ts)、[quota-atomic-evidence.test.ts](../../../tests/api/quota-atomic-evidence.test.ts) | 正式端點lease、參數与真實authority證據 |
| `tests/api/admin-dashboard.test.ts` | [admin-endpoints.test.ts](../../../tests/api/admin-endpoints.test.ts)、[admin-redis-integration.test.ts](../../../tests/api/admin-redis-integration.test.ts)、[admin-ui.test.tsx](../../../src/screens/admin/admin-ui.test.tsx) | 正式near-limit門檻、申請producer整合 |
| `tests/api/map-tile-proxy.test.ts` | [redis-tile-pipeline.test.ts](../../../tests/api/redis-tile-pipeline.test.ts)、[redis-tile-store.test.ts](../../../tests/api/redis-tile-store.test.ts)、[map-quota-gate.test.ts](../../../tests/api/map-quota-gate.test.ts) | 剩餘圖磚資源參數、Redis／CDN／HAR |

## Runner適用性（T008）

- [package.json](../../../package.json)為private package，既有test／build／test:pwa-red-gate即可使用，不需要新dependency／script。
- [vitest.config.ts](../../../vitest.config.ts)支援`*.test.ts`／`*.test.tsx`、React、jsdom、既有setup；可命令列選`--pool=forks --maxWorkers=1`。Lua harness使用既有interpreter；未找到interpreter時不得把skip當Lua PASS。
- [playwright.config.ts](../../../playwright.config.ts)只選`*.e2e.ts`，現有005檔符合；Tasks歷史`.spec.ts`提案須用現有命名，不新增平行config。runner自動build＋loopback preview，不是Vercel API server。
- Vite preview不提供Vercel serverless端點；HTTP exports以Vitest Request／factory測試，browser API用明列mock。真實跨process REST／OIDC runner與環境另循[決策包](../readiness-decisions.md)。
- Network觀測使用Playwright request event／route與browser Cache Storage檢查；HAR不是既有mock觀察的同義詞。正式HAR／帳戶／CDN證據仍待取得。

本輪現況回歸3檔／74tests、新增state相關回歸4檔／74tests PASS；兩組有重疊，不相加作唯一tests。詳見[證據](../../../docs/verification/005-local-implementation-evidence.md)。本文件僅完成環境、骨架與runner盤點，不代表上述尚缺正式測試已通過。
