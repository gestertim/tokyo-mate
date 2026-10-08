# 005｜隔離測試身分矩陣（T006）

**2026-10-07。規劃資料，不建立真實帳號／subject／credential，也不宣稱所有矩陣本輪已測。**

Session有效性、付費資格、tier與管理者來源必須獨立測試。管理者身分不自動授予付費資格或免額度。

| TEST_ONLY身分 | Session／資格 | 六付費端點／tile授權的必要結果 | 管理端必要結果 |
| --- | --- | --- | --- |
| public | 無cookie | 可確定未登入時401、上游0；Public公開功能可用 | 401、無管理資料 |
| unapproved | 有效opaque Session、未核准 | 403、reserve／上游0；不查tile cache | 非M1：403 ADMIN_REQUIRED |
| revoked | 有效Session、資格撤銷 | 下一請求403；同冪等key也不得揭露reservation | 非M1：403 |
| expired | 有效Session、核准已到期 | 403；不靠舊tab／snapshot放行 | 非M1：403 |
| tier1 | 有效Session、active tier1 | 已批准US$3/day／US$15/week內仍需當次G／R_e／限流／成本驗證 | 非M1：403 |
| tier2 | 有效Session、active tier2 | 已批准US$10/day／US$50/week內仍需全部保護檢查 | 非M1：403 |
| admin-approved | 有效Session、可信M1、active tier1或tier2 | 與同tier一般使用者相同，日週仍受限 | 允許相應讀取／CSRF／原子異動 |
| admin-unapproved | 有效Session、可信M1、無付費核准 | 403，不能以admin繞過quota | 管理操作不要求自身付費核准，仍逐請求驗M1 |
| non-admin | 有效Session、前端偽role／isAdmin、非M1 | 只按真實資格判斷，不受偽role影響 | 403，不能外洩統計／名單／audit |
| invalid-session | 篡改／重複cookie、store無紀錄、登出或Session到期 | 可確定無效時401，不授權 | 401 |
| protection-unavailable | Session／資格／registry／store狀態無法可信確認 | 相应必要依賴故障503；未知不是未登入／未核准；上游0 | 依管理契約fail-closed，無資料 |

## 正交情境

- tier1／tier2／admin-approved各測：日耗盡、週耗盡、日／週below_floor、單一request不足、週追加後日仍不足。
- 登出→401與資格撤銷→403不混為同一狀態；有效Cookie每次查store。
- 同key同內容／不同內容、輪替／跨日週／late outcome必須先檢查目前Session／資格，不恢復executionGrant。
- Public／未核准／額度全域不可用／offline／unknown不掛互動圖、不自動定位、不送Places／tile。受限狀態不是精確導航地圖。
- T147若批准：未核准者可明確申請paid_access，只有active者可申請當週top-up；申請不是核准。T142若批准：本人有效資格才可查，其他subject／不存在同樣404。

最後兩項新增契約情境仍是[待批准提案](../../specs/005-api-protection-access-modes/readiness-decisions.md)，不得據此接線endpoint。
