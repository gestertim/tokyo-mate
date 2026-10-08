# D07／D08｜Request-epoch 與金鑰生命週期契約草案

**狀態：E01～E10 推薦方案已批准供本機程式、隔離測試、UI及文件實作；正式服務／帳戶操作與清除仍未批准。** 本機可實作本契約列明的endpoint、schema、可配置期限／限額、狀態機及錯誤UX，但不得設定正式secret、呼叫付費服務、啟用排程、切換legacy或部署。E07清除須有帳單／爭議窗口、retirement barrier、全部key引用歸零與restore／rollback證據；不足只可拒絕或dry-run。E08／E09單一可信管理者分步確認，每步重新授權、驗操作識別／必要證據／冪等並寫audit；不要求第二管理者，確認本身不替代帳務證據。既有D10／D11契約維持相容；完整界線見[決策包](../readiness-decisions.md)。

**2026-10-07 本輪批准來源**：使用者明確批准 verify-only 語意及E01～E10推薦方案的本機程式／隔離測試。capability signing key轉為verify-only後，不可簽發新capability，但有效舊capability仍可在本人Session、資格、限流、成本、epoch authority及原子首次grant全部成立時首次執行；已grant操作不得二次grant。fingerprint verify-only只比較既有版本／pinned context，不能把重送當新操作。洩漏撤銷／epoch退役拒絕新grant，不追溯作廢既有入帳、uncertain占用或保守結算。候選30天保存／90天正常輪替週期僅可作本機可配置參數，非production生效值。

## 1. 目的與適用範圍

建立可由可信後端獨立驗證「某個舊操作永遠不再取得新 grant」的屏障，才可能安全刪除該 epoch 的最小 comparison tombstone／verify-only key。期限到期本身不證明可以刪資料；成本、資格、限流、原子 reservation、單次 grant 與保守結算仍不可省略。

草案僅涵蓋六付費端點的操作 handle；不自動延伸到申請、管理追加、OAuth state、Session 或圖磚。`speech` 仍受阻；簽發 capability 不解除任何端點的 `live:false`、成本或使用資格 gate。

## 2. 簽發入口、本人授權與防濫用

本機入口為 `POST /api/me/request-epochs`，採本節DTO；production factory未配置時fail-closed。只由明確手動操作觸發；登入、focus、polling、網路恢復、epoch輪替不得代簽或補送。

- 入口順序：method／有界 header 檢查 → 可信 transport admission → opaque Session 的當次 server-side lookup → 當下本人資格 → same-origin／CSRF → 已登入者共享限流 → 有界解析／欄位白名單 → 原子簽發記錄。
- Session subject 是唯一 owner authority；不接受 body owner、role、tier、client clock、成本、epoch 或 key version。有效登入不等於付費資格；未核准、撤銷、到期不簽付費操作 capability。週額度等成功 gate 仍在真正付費請求重新驗證。
- CSRF 沿用既有可信 origin／同源方法，不以 CORS 或 Cookie 存在當證明；入口、callback 與 Session Cookie 不混用 OAuth state。
- 本機 body 僅含endpoint與簽發命令識別；命令帶可信epoch hint，僅供authority核對，不能由caller指定權威epoch。依E03限制大小、速率、issuance保存與handle囤積；正式factory缺可信配置或authority故障時拒絕。
- 簽發不讀取原內容、不預留金額、不建立 execution grant、不呼叫付費上游；不接收照片、音檔、精確位置或對話。

## 3. Capability 與不可變綁定

本機capability payload包含schema version、不可重用epoch ID、獨立signing key version、keyed owner scope、endpoint、server-issued opaque operation handle及可信`issuedAt`／`expiresAt`；採E04固定HMAC-SHA-256編碼。owner不公開raw subject。key只從本機test fixture或既有可信server-side注入取得，production缺可信設定時fail-closed。

- operation handle 與 epoch 關聯不可換 owner／endpoint／idempotency handle。付費端點另以相同 operation handle 綁完整內容 fingerprint、成本 context 與原窗口；capability 不取代內容比較。
- 不接受任意外部 issuer、algorithm 或 URL；version／epoch／key 必須屬可信 authority。簽章驗證不能只 decode；未知 key／不一致 payload／到期／退役均 fail closed。
- capability 是 bearer proof 的一部分，**不是獨立授權**；每次仍需本人 Session lookup／資格／限流。偷得 capability 的另一個 subject 不能執行或查詢他人操作。
- 本機request／response依E01使用capability header、原body handle及D10互斥epoch lookup DTO；不得把capability／raw handle／原內容放URL、PWA cache、持久前端storage或log。

## 4. 可信簽發與跨 instance 一致性

共享 authority 提供時間、單調 generation、current／verify-only／retired 狀態及不可 ABA 重用的版本；所有 instance 使用同份權威狀態。不得以本機 clock／process cache 判斷可簽新 epoch。

P具體區分：token的`generation`是不可變epoch序號；authority另有最新`highestGeneration`與變更用`authorityRevision`。verify-only舊epoch的token序號可以小於current，僅須仍屬已發布、未到期／未撤銷且高於retirement watermark的有效epoch，**不能要求token generation等於最新generation**。restore最低floor核對整份authority的highestGeneration／revision／watermark，不是把所有舊token作廢。current與預先發布的next epoch由權威TIME核對半開區間；缺下一epoch不自動捏造，維持503。

1. 本機協定先讀可信authority的current epoch／key／時間，製作只存在記憶體的候選handle、payload與簽章；這不是已簽發capability，不能回caller，並遵守E02 pre-sign時限。
2. 同次原子操作先重驗本人資格，再查同 owner／epoch／命令記錄：命中且endpoint相同只取回原 immutable capability bytes，endpoint不同回conflict；未命中才驗證current epoch／key、可信時間、生效區間及候選 binding，寫入完整簽發記錄。首次持久化是簽發線性化點，不採「先記錄、之後用可能已 verify-only 的 key 補簽」。
3. 回應前核對撤銷／退役／到期與 payload binding；正常輪替本身不取消已成立的簽發。不回傳半成品；confirm 不重算 expiry、不簽新 capability。輪替先成立則拒絕舊候選；簽發先成立則可回原結果。secret 已載入不等於有新簽發資格。
4. 共享store timeout／unknown：對外保護服務不可用；不猜成功、不改命令、不讓晚到簽發繞過退役。沿同一免費簽發入口、同一命令手動確認；若原操作未成立且authority仍current，只可由同命令原子成立一次，不另開unknown查詢endpoint。

不得設定「讀不到 authority 就接受 cache」的 fallback。authority 時計倒退／generation rollback、restore 或 split-brain 不能回到可重用舊 epoch；故障恢復需證明屏障，否則停止新簽發及新 grant。

## 5. 到期、重送、輪替及相容性

- 本機時間語意為`issuedAt ≤ authorityNow < expiresAt`，authority使用Redis TIME；capability age／epoch／重疊依E02設定，時計容忍為0、pre-sign提交上限2000ms。既有Session 24小時不是此設定的依據。
- 同一操作重送使用原 handle／capability／內容；**已有 grant** 且相同指紋只得到既有 duplicate 語意，沒有第二個 grant。不同內容仍是 conflict，資格失效優先，不洩漏 reservation。僅簽發 capability 不代表已 reserve／grant，不能把從未取得 grant 的首次送出誤判為 duplicate。
- 正常輪替後，未退役且未到期的舊 capability 可用 capability signing verify-only key 驗證；若從未取得 grant，仍可在本人 Session、當下資格、限流、成本、epoch authority 及原子首次 grant 全成立後首次執行。已有操作比較則用其記載的 fingerprint key version，不以 current key 重算後當成新操作。capability signing 與 fingerprint 的用途、key version、request epoch 分開，不能混成一個 TTL。
- capability到期／epoch退役後，不延長原expiry、不自動換新handle；本人仍可依D10互斥DTO唯讀查詢，不能重放。真正新操作必須明確建立新命令／新handle，UX明示可能另占額／計費。
- 同命令重新簽發不得把已過期舊操作升級成新epoch的新grant。E03命令去重與屏障規則阻止清除後重建。
- 既有無epoch自由key不可當新key；legacy deny-new-grant僅在本機隔離測試以明確設定啟用，production cutover未批准。保留既有legacy比較材料／索引，不清legacy tombstone或key。

## 6. 金鑰家族與生命週期

App Session 是 opaque ID＋逐請求 store lookup，**沒有 Session 簽章 key 輪替假設**。OAuth state-cookie HMAC、request fingerprint HMAC、rate pseudonym HMAC、候選 epoch capability signing 分開管理、domain-separated，不互相替代。Session 登出／撤銷不靠 key rotation。

| 狀態 | 可做 | 不可做 |
| --- | --- | --- |
| capability signing：current | authority 授權的新 capability 簽發、既有 capability 驗證 | 遇 store 故障離線簽發、重用舊 epoch |
| capability signing：verify-only | 驗證輪替前已簽發且仍有效的 capability；未 grant 者通過全部 gate 後可首次 grant | 簽發新 capability、補簽確認結果、延長 expiry、第二次 grant |
| request fingerprint：current | 新操作首次綁定；按記載版本比較既有操作 | 用新版本改寫舊操作並視為新操作 |
| request fingerprint：verify-only | 依既有操作記載版本比較指紋；維持 duplicate／conflict | 將重送當新操作、建立新 fingerprint binding 或第二次 grant |
| retired／compromise-revoked | authority 拒絕受影響版本／epoch 的新 grant；保留原 accounting authority | 復用版本、restore 成 current、把既有入帳／uncertain 占用追溯作廢 |

本機key狀態機以90天正常輪替週期作可配置參數；實際正式輪替仍須先安全載入新材料至所有需用instance，再原子發布current，舊材料依family用途降為verify-only。缺current或仍需舊比較key時fail-closed。key material僅安全隨機來源／server-side secret store，不進source、frontend、log或artifact；本輪不生成、輪替或設定正式secret。

洩漏時 authority 立即撤銷受影響版本／epoch，不等待正常重疊期限；安全優先於舊操作可用性。撤銷／退役禁止新 grant（包含尚未首次執行者），不是撤回已線性化的 grant、入帳或原窗口 uncertain 占用；既有保守結算仍依原 accounting authority。OAuth state-cookie key 洩漏處置不能宣稱撤銷 opaque Session；Session 要由 store 獨立 revoke。fingerprint key 失去可信性時不可重新比較並授權新執行。

## 7. Tombstone／verify-only key 安全清除的必要條件

清除前須同時證明：

1. 可信共享authority原子建立並持久化retired epoch屏障；每個新grant在讀冪等資料前核對。採單調retirement watermark或最小deny set，不保留原內容；本機可測狀態不證明正式持久性。
2. 所有 instance／部署版本／舊 route 都強制該屏障；未接 epoch 的 legacy 路徑不能接受已清材料的舊 key。restore／rollback 不會重新放行。
3. 相應 epoch 不再有可被接受的 capability／簽發競態／未知簽發；不存在需 comparison key 的合法既有操作。單純等待固定時間或明細 TTL 不足。
4. reserved／uncertain 與原窗口金額、結算去重、晚到證據的最小關聯均已保留在不需要原內容比較的 accounting record；屏障不能造成退款或失去對帳關聯。
5. detail → 最小 tombstone 在同一次原子操作完成，成功才刪 detail；timeout／unknown 保留原 detail。tombstone → 屏障驗證 → comparison material 清除也須可重跑、不可產生接受重放的空窗。
6. key 可能跨多個 epoch／用途：只有全部引用都滿足清除條件，才刪 secret。OAuth state-cookie／rate family 另依各自仍有效記錄及窗口驗證，不借 epoch 退役直接刪除。

未具備以上證據時，保留最小防重放材料；這是阻擋清除的安全前提，不是批准永久保存所有個人明細。保存必要性、期限及最小欄位仍須 D07／D08 批准。本輪不執行清除。

## 8. 故障、晚到、uncertain 與撤銷

- 簽章／keyring／authority缺失或矛盾：503保護服務不可用、零新grant；可信且已識別的本人操作在expired／retired時依E10回410，未知狀態不得回成功形狀。
- 新 grant 前 owner 資格或 epoch 已撤銷：拒絕；原子 reserve 與撤銷兩順序必須驗證。已派送 grant 不因 key 退役重送、不換窗口、不自動取消計費。
- grant 存在但結果未知／timeout／lease 到期：維持原日週占用並原子進 uncertain，不退款、不重新簽發來規避去重；epoch 到期不釋放占用。
- 晚到結果僅附原操作可信證據；既有結算 authority 決定是否已入帳，不重複增減餘額。key 洩漏／退役也不能把記帳完成當 API 成功。
- 過期或退役狀態不能查到detail時，不宣稱「未執行」；只能說目前無法確認，維持可追溯accounting reference。人工對帳使用E08本機可配置24h／7d／30d工作節奏；正式帳務結案仍需可信證據。

## 9. E01～E10 完整推薦決策包（2026-10-07；唯一集中答案）

**批准標記**：A＝既有產品語意／政策；L＝本輪批准的本機程式、隔離測試及UI範圍；G＝正式執行、真實服務或資料/key清除仍須獨立證據與批准。下表E01～E10方案的本機範圍皆為L；任何部署、付費、正式秘密、key輪替／資料清除、cutover及排程屬G，不因L通過而啟用。承接任務為[T152](../tasks.md)，沿用T019／T138、T139／T140、T141、T142接縫，不另建平行系統。

本決策包先前以「P」標記的推薦細節，現已批准用於本機實作／隔離驗證；該標記不再代表本機尚未授權。任何需要正式持久性、帳單／爭議窗口、外部管理者／secret、production資料清除、部署或服務啟用的證據，仍屬G gate。

| ID | 唯一推薦答案（P；A 另列） | 理由與取捨 | 批准界線／任務與實作範圍 | 可執行驗收與必要證據（未執行） |
| --- | --- | --- | --- | --- |
| E01 | 同一 `POST /api/me/request-epochs` 接 `{endpoint,issuanceCommandId}`，新建 201／同命令確認 200，回 `{capability,operationHandle,requestEpochId,issuedAt,expiresAt}`；可信 epoch hint 由既有 `GET /api/me/quota` 新候選欄位 `requestEpoch:{epochId}` 提供，命令格式為 `<epochId>.<UUIDv4>`。付費 POST 用單一 `X-Request-Capability` header，既有 body 的 `idempotencyKey` 等於 server handle，不搬動影像／multipart／文字 body。明確點原「送出」才簽發並執行一次；簽發 unknown 停止付費送出，顯示「確認簽發結果」，只手動以原命令確認，確認成功也須再次手動送出。 | 不新增確認 endpoint；命令內的可信 epoch hint 解決去重記錄刪除後舊命令被當新命令的問題。增加一次免費 quota／簽發往返；不能靠登入／網路恢復自動代送。hint 是回傳值而非授權，所有 epoch 判斷仍由 authority。 | A：手動、本人 Session、資格優先、簽發不 reserve／grant／付費。P：入口／DTO／header／quota 擴充／同命令協定。T152→T140／T142 接縫及六 handler／paid UI；不改 D11。依賴 E02～E06、E10。 | 注入 store 在寫前／寫後 timeout；手動 confirm 回完全相同 capability bytes 與 handle，最多一筆 issuance、零 grant。不同 endpoint 同命令 409；不同 owner 不命中他人；confirm 成功不自動付費。附 HTTP DTO／bytes、兩 instance 原子紀錄及 UI Network 證據。 |
| E02 | capability age＝24 小時；epoch＝UTC 每日 00:00 起 24 小時簽發區間，舊 epoch 在簽發區間結束後再保留 24 小時有效重疊，屆時原子退役。時間皆 Redis `TIME` 毫秒、安全整數、`issuedAt≤now<expiresAt`；時計容忍＝0。pre-sign 至提交最多 2,000 ms，且提交時 current epoch／key 與效期必須仍一致；不合即 503、不自動刷新。已 grant 的晚到 accounting evidence 不設以 capability expiry 為限的丟棄窗口。 | 24 小時便於一次旅遊操作確認，與 Session 同數值但**不是由 Session 壽命推導**；最多約兩個有效日 epoch，降低資料面。UTC 只作 epoch 時間，日／週額度仍 Asia/Taipei。較短期限可能中斷隔日恢復，較長則延後清除。 | A：到期不延長、已 grant 不重授、晚到／uncertain 原窗口守恆。P：24h／UTC／重疊／0／2,000ms。T152／T019／T138 接時間與退役；不改 Session24h、state5min、各端點 lease。依賴 E05。 | now＝issuedAt−1／issuedAt／expiresAt−1／expiresAt；pre-sign 1999／2000／2001ms；epoch 邊界兩順序、時間倒退、晚到跨退役。時間矛盾503／零新 grant；晚到不二次入帳、不退款。附權威 TIME／generation／原窗口前後快照。 |
| E03 | issuance body≤1,024 B、完整成功信封≤4,096 B、capability ASCII≤1,024 B；單一 capability header、拒絕重複／合併值。handle 用32隨機bytes的base64url（43字元）；epochId≤64、命令≤101字元。簽發與確認共用每本人10次／固定60秒桶；全六端點合計最多20個未到期且未 grant handle，每 owner 每 epoch 最多100個新簽發。命令去重保存至 epoch 已退役後24h，刪除前先有 E05 永久拒絕屏障；命令指定的 epoch 非 current 且記錄不在時拒絕，不重建。 | 回應上限沿 D10 同量級但為獨立新決策；10／20／100 防免費入口／囤積濫用，也可能限制大量手動使用。確認占速率但不增加 handle／新簽發計數。固定桶不是任意連續60秒上限。有限去重靠 epoch 屏障，不靠 client UUID 時間。 | A：缺設定 fail-closed、共享限流、不靠登入取代限流。P：上述新數字／索引保存，D10 30/min、D11 10/min 與清單60/min不變。T152／既有 limiter／store；依賴 E01／E02／E05。 | body／完整response／token上限±1，header兩個值、11th request、21st unused、101st issuance；duplicate不增量。清去重後送原epoch命令不得再簽發；兩instance同時第20／100筆只有一筆成立。附 counters 與 no-store 證據。 |
| E04 | capability 使用 HMAC-SHA-256、32隨機bytes signing key；固定陣列 UTF-8 JSON 與無padding canonical base64url，詳 §9.1。request fingerprint 保留既有 `canonicalContent`＋HMAC v2，不改文字／binary／cost binding；owner scope／operation index 以 fingerprint family 的**不同 domain** HMAC 派生，payload明列scope key version，不新增全域identity資料庫。OAuth state-cookie、fingerprint、rate pseudonym、capability四family各自獨立32bytes key／不可重用version；不共享root secret。 | 重用既有Node crypto／fingerprint encoding，不增套件／JOSE wrapper／自製通用JWT。owner scope會與fingerprint key生命週期耦合，E09必須按全部引用保存；避免另加第五個secret family，但不混用digest domain。 | A：HMAC、防還原內容、opaque Session無簽章key、各family分開。P：capability wire format／32bytes／owner-index domains／version治理。T152／T139／既有state／rate接縫，secret僅server-side既有安全注入；不生成key、不改env。依賴 E05／E09。 | 固定 vectors：物件換鍵序同fingerprint；array次序／`-0`／binary與字串不同；token重編碼不一致／padding／未知kid／wrong MAC／scope version拒絕。secret／raw內容／handle不進log、URL、frontend bundle／SW。附vectors與產物／日誌掃描。 |
| E05 | 延伸現有同hash-tag Redis authority：增加epoch authority hash、issuance hash與必要expiry／unused索引；與users／registry同slot。reserve同次EVAL先驗epoch／key revocation與單調generation，再查操作／首次grant，retire同authority原子增加**連續retirement watermark**；非連續撤銷另留最小deny set。發布先載key、驗全部服務版本，再切current；故障不cache fallback。restore／rollback先停新簽發及新grant，核對獨立保存的非個人`namespace/generation/watermark/revokedVersions`發布manifest與server trusted最低generation設定；只能恢復不低於屏障的authority及epoch-aware版本，缺證明維持503。 | 不加database／microservice；最小永久屏障不含owner。Redis舊backup自身無法證明未倒退，所以不能只比backup內generation；操作manifest及部署最低floor是必要防回滾證據，不宣稱單一Redis有不可回復保證。發布、外部持久性及恢復程序仍需真實證據。 | A：跨instance race-safe、unknown fail-closed、屏障先於清除。P：具體hash／watermark／manifest／發布與restore協定。T152／T019／T138，真實共享驗證另T153／D14；使用既有可信配置／保管，不建新服務。 | reserve／retire兩順序：reserve先僅一grant並保留accounting；retire先零grant。兩instance舊keyring／舊app拒絕；回灌舊snapshot、舊floor、缺manifest、split-brain全停。清除後重放不需comparison key即可拒絕。附同slot EVAL、恢復演練、發布版本及floor證據；本機替身不能替代。 |
| E06 | 本機實作既有 `POST /api/me/operation-status` 的互斥oneOf：原`{endpoint,idempotencyKey}`或epoch `{endpoint,requestEpochId,operationHandle}`，不能混欄位；新分支不要求未到期capability，沿Session／資格／rate／CSRF及owner lookup，僅回四狀態projection。legacy拒絕新grant只以明確config供隔離測試；production cutover維持關閉，不刪legacy索引。 | 不新增狀態查詢入口，過期後本人仍可唯讀；正式cutover會改變相容行為，須另批。legacy沒有可信epoch，有限安全刪除不能由本次epoch自動證明。 | A：D10免費唯讀、不grant、403優先／未知他人同404、既有操作不二次grant。L：oneOf DTO／隔離legacy拒絕測試。G：production cutover及資料清除未批准。T152／T142／T140／UI。 | 原legacy lookup、未知legacy拒絕、混欄位400；epoch過期／retired後本人四狀態、他人同404、資格撤銷403。查詢前後usage／grant相同、上游0；缺記錄404不推論未執行。 |
| E07 | 終態detail／review／audit與window aggregate依各自可信終結點保存30天；設定可注入並可測。reserved／pending及uncertain最小accounting不得以TTL刪除；unknown保留原窗口。 | 30天是本機批准的可配置保存參數，不得直接當production保存政策。供應商帳單／爭議窗口、retirement barrier、全部部署拒絕能力、restore／rollback防護及所有key引用歸零證據未齊前，正式清除只能拒絕或dry-run。legacy／D11自由key索引不清。 | A：不留原文／照片／音訊；uncertain保留原窗口；detail→tombstone須原子且unknown不刪。L：30天配置與狀態／競態測試。G：正式清除未批准且須外部證據。T152／T138／T139；依賴E05／E06／E08／E09。 | 各保存起點30天−1／等值／+1；tombstone寫入失敗／unknown、清除與reserve競態；保留uncertain必要accounting而清非必要detail。正式清除缺任一證據必拒絕／dry-run；本機替身不算正式清除證據。 |
| E08 | uncertain依可信lease到期原子記錄；24h首次review、每7天覆核、第30天升級皆為本機可配置值。沿既有管理者接縫，由單一可信管理者分步確認；每步重新驗admin權限、operation ID、理由、冪等與該步必要accounting evidence，且各自寫audit。人工review結束不代表帳務結案；無可信結果保留uncertain與原窗口，不釋額。 | 單人分階段降低操作摩擦但不把UI confirmation當帳務證據；不新增通知服務、第二管理者或退款流程。 | A：晚到只記錄，不自動退款／重放／搬窗口。L：分步workflow、權限重驗、證據／冪等／audit測試。G：真實帳務調整與正式secret操作未批准。T152／T138既有admin與audit接縫。 | 24h／7d／30d邊界；非admin拒絕；第一步確認不能直接close；缺accounting evidence不得結案；同管理者第二步須重新授權並以同operation ID冪等；audit記錄actor／reason／evidence reference；晚到不改餘額。 |
| E09 | 正常key rotation 90天作本機可配置參數；key family各自維護current／verify-only／retired引用。單一可信管理者分步確認撤銷／退役，步驟間重新授權並各自稽核；不要求另一管理者。舊key不得按90天固定刪除，須全部操作／epoch／counter引用解除且屏障成立；缺證據只拒絕或dry-run。 | 90天只驗證本機策略參數與狀態機，不觸碰正式key或secret store。signing verify-only舊capability仍能在全gate成立時首次grant；fingerprint verify-only只按記載version比較，不授第二次grant。 | A：key family分離、撤銷／退役擋新grant但不追溯帳務。L：90天配置、狀態轉移、分步確認及audit。G：正式key產生／輪替／刪除未批准。T152／T139；依賴E04／E05／E07。 | 跨輪替未grant舊capability首次grant一次；第二次grant為0；同內容duplicate／異內容conflict；缺必要key拒絕；90天邊界不自動刪除；單管理者撤銷各階段重新授權／冪等／稽核；引用或retirement barrier證據不足時dry-run／拒絕。 |
| E10 | 本機實作手動確認／lookup／新操作分流及錯誤UX；保留既有401／403／400／413／429／兩種409／503，可信已知但不可執行的本人操作可回410 `OPERATION_NO_LONGER_EXECUTABLE`。未知簽發、authority或必要key故障回503，不猜未執行；confirm與status分開，新操作須明示可能另占額／計費，不自動換handle或送出。 | 錯誤與操作不能把unknown偽裝成未執行；410僅限可信本人binding可確認的已知操作。 | A：不自動送出、503不宣稱未入帳、settled非內容成功、資格優先。L：410／手動UX與測試。G：正式切換／付費不啟用。T152／T141／T142。 | 撤銷資格403優先；缺key／unknown503；可信不可執行410；已有grant409；confirm不付費、status不grant、新操作有獨立命令；前端token／handle不入URL、storage、log或SW。 |

### 9.1 E01／E04 本機批准編碼與接線

以下為已批准的本機HTTP schema／可注入設定；不得把測試fixture當正式設定：

```ts
type IssueRequest = { endpoint: ProtectedEndpoint; issuanceCommandId: string };
type IssueResponse = {
  capability: string;
  operationHandle: string;
  requestEpochId: string;
  issuedAt: string; // canonical UTC ISO 字串，僅顯示
  expiresAt: string;
};
type EpochOperationLookup = {
  endpoint: ProtectedEndpoint;
  requestEpochId: string;
  operationHandle: string;
};
```

- `epochId` 候選為 `g<十進位generation>_<16隨機bytes之base64url>`，generation為正safe integer、namespace不可復用，總長≤64。`issuanceCommandId` 的UUIDv4為手動操作時建立；epoch前綴只能回傳authority已發出的hint。從舊分頁取得hint不得自動換成current hint重送；缺／舊hint要求重新手動確認新操作。
- 新命令miss只有**該命令指定epoch仍current**才可成立。命中舊命令可返回原有效token，即使signing key已verify-only；expired／retired不回新token。若刪除後命令所屬epoch已retired，watermark／deny set先拒絕，不能因資料不存在重建。
- 新capability signing `kid`為16隨機bytes的無padding base64url（22字元、無`.`），version不可復用；不改既有fingerprint／state／rate版本格式。這個key識別值與32bytes secret本體分開，避免token分隔符碰撞。
- Token：`v1.<kid>.<base64url(payloadUtf8)>.<base64url(mac32)>`。payload固定陣列為 `["tm/request-capability/v1",generation,epochId,kid,scopeKeyVersion,ownerScope,endpoint,operationHandle,issuedAtMs,expiresAtMs]`；所有識別字串只允許有界ASCII，時間／generation是safe integer。`JSON.stringify`固定欄位次序，不使用任意物件鍵排序或Unicode正規化；驗證須解碼、逐欄位白名單、重新編碼與原bytes一致，再以constant-time比較MAC。MAC輸入為UTF-8 `["tm/capability-sign/v1",kid,payloadBase64url]` 的固定JSON，不接受caller選algorithm／issuer／URL。
- `ownerScope=HMAC(fpScopeKey, JSON.stringify(["tm/owner-scope/v1",scopeKeyVersion,subject]))`；epoch authority在建立epoch時pin不可變scopeKeyVersion，正常fingerprint輪替不更改該epoch的owner／command索引。operation index用 `"tm/operation-index/v1"` domain、ownerScope／endpoint／epoch／handle；issuance index用 `"tm/issuance-index/v1"` domain、ownerScope／epoch／完整command，**不含endpoint**，命中後才比較record endpoint以回409 conflict。domain不是新key family；scope比較只能用記載版本，缺key拒絕，不能用current猜owner。scope key洩漏須撤銷全部引用epoch。
- 指紋沿用 [現有 v2 encoder](../../../api/_lib/quota-fingerprint.ts)，包括typed tags、物件鍵排序、array次序、binary bytes、完整內容與可信成本綁定。未grant的舊capability首次執行用**current fingerprint key**建立新binding；已有grant則依原版本及原pinned cost context比較，不能以新價表／新key重算成另一操作。此處不改既有演算法，也不主張fixture是跨輪替實測。
- E06候選唯讀lookup在既有users authority的本人bucket內，用`SHA-256(JSON.stringify(["tm/accounting-lookup/v1",epochId,operationHandle]))`索引最小accounting projection；它只雜湊server隨機識別，不雜湊請求內容、不代替HMAC fingerprint、不供公開查詢。首次grant原子建立此關聯，收斂時保留必要projection，讓comparison／scope key安全清除後仍可本人查帳；Session subject owner filter仍先成立，不能由caller給owner。不存在關聯仍同404，不推論未執行。
- 所有request／response no-store；token／命令／handle僅當次UI記憶體，不放URL、localStorage、IndexedDB、SW、telemetry。離頁或記憶體遺失不自動產生替代命令；無原識別不能宣稱原操作未成立。原照片／文字保留僅沿既有當頁非敏感內容政策。

### 9.2 E07 本機保存參數、最小欄位與清除條件

全表是 P；已批准Session與state政策只引用、不重批。安全前提阻擋清除，不構成永久留存個人明細授權。

| 類型 | 最小欄位（內部；不等於公開DTO） | 候選保存／清除 |
| --- | --- | --- |
| issuance record | keyed owner scope／scope version、endpoint、epoch／generation、command index、handle／index、原capability bytes、signing version、issuedAt／expiresAt；不存原內容 | epoch退役後24h，且unknown簽發已由同authority線性化／屏障攔截；刪前永久拒絕該epoch命令miss。確認不得重新簽章。 |
| reservation detail | 原operation reference、owner scope、endpoint、原日／週window、amount／charge、state／updatedAt、lease、fingerprint／key version、pinned cost／registry binding、settlement dedupe與可信evidence reference | settled／released最後**首次結案時間**起30天；重送不延長。reserved不可刪，uncertain僅收斂非必要detail、保留下一列。先原子寫comparison／accounting必要材料，成功才刪detail。 |
| uncertain／accounting record | 原operation reference／owner authority reference、原日週window、reserved／accounted amount、狀態、settlement去重、必要成本佐證reference、late-evidence reference／updatedAt | 未可信帳務結案不設自動刪除TTL；每7天檢查必要性。可信結案後30天且供應商爭議窗口已證實足夠才清，不以人工review結束冒充結案；不留照片／位置／prompt。 |
| comparison tombstone | owner scope／version、endpoint、epoch／handle index、fingerprint／key version、原pinned comparison context的最小digest／數值、deny-second-grant、accounting reference | 先有永久epoch屏障且全部部署／restore均拒絕新grant後，comparison部分可刪；accounting部分依上一列。未retire不能僅因30天刪。legacy無屏障者維持現行暫不清。 |
| aggregate | 必要owner authority reference、window、used／reserved、必要reconciliation reference；不留內容或永久匿名日彙總 | window reset後30天，若仍有未結案關聯只保留對應最小數值／關聯，不重建新窗口；爭議窗口前提同上。 |
| resolved／withdrawn review detail | 既有reviewId、owner authority reference、kind／reasonCode、week key、status／createdAt／resolvedAt／withdrawnAt、必要actor reference | 首次resolved／withdrawn起30天；pending不刪。文字／個人顯示detail可收斂，但既有D11自由key索引與去重不得本輪加TTL；要有限清除須獨立拒絕屏障規格。 |
| admin audit／uncertain review | eventId、operation reference、actor／reviewer受限reference、action／result、authority time、必要amount／window變更與evidence reference；不留原內容 | event起30天；若關聯未結案只保留必要accounting audit subset，逐7天必要性覆核；權限／不可篡改證據未成立不能宣稱安全刪除。 |
| retirement／revocation authority | namespace、單調generation、連續watermark、必要非連續deny versions、發布／restore evidence digest；不含subject／handle／原內容 | 最小非個人永久拒絕屏障，不設TTL；不能刪後允許ABA。獨立可信manifest與部署floor需同樣不可倒退。 |
| App Session／OAuth state | 沿既有Session／state模型，不新增Session signing key | A：Session絕對24h、expiresAt後24h清理；state5min且consume一次，到期即失效。排程授權未增加。 |
| rate counters | 既有pseudonym／固定bucket／count／expiry | 沿原固定60s桶與窗口＋60s緩衝；換key不清有效counter。E09新輪替時機未批准。 |

### 9.3 E10 本機批准文案與操作分流

| 情境 | HTTP／code或UI狀態 | userTitle | userMessage | actionableStep／手動操作 |
| --- | --- | --- | --- | --- |
| 已可信確認本人操作不可再執行 | 本機：410 `OPERATION_NO_LONGER_EXECUTABLE` | 這個操作已不能再送出 | 這個操作目前不能取得新的執行授權；既有記帳或預留不會因此取消。 | 請手動查看原操作狀態；若確實需要再次處理，請明確建立新操作。 |
| 簽發unknown／authority或必要key故障 | 503 `PROTECTION_SERVICE_UNAVAILABLE`，既有三欄文案不改 | 無法確認使用狀態 | 保護服務暫時無法確認使用狀態，付費功能先暫停。請稍後再試。 | 目前無法確認簽發是否成立。請使用原命令手動確認；不要建立新命令或自動送出。按「確認簽發結果」只呼叫E01，不把原信封的手動重試誤做新命令。 |
| 已grant／相同內容 | A：409 `DUPLICATE_REQUEST` | 沿既有錯誤契約 | 此操作已送出，請查看目前狀態。 | 只手動「查看操作狀態」；不再grant、不把settled說成內容成功。 |
| 已grant／不同內容 | A：409 `IDEMPOTENCY_CONFLICT` | 沿既有錯誤契約 | 操作識別碼與原請求不一致，請重新確認操作。 | 保留當頁輸入，不換handle冒充重送。 |
| 使用者明確決定新操作 | 本機新操作確認UI，不是原操作的retry | 建立新的付費操作 | 新操作不是原操作的重送；即使原操作結果尚未確認，新操作仍可能另外占用額度並產生費用。 | 「取消」／「確認建立新操作」；確認後新命令、新handle，仍逐gate驗證，不能繼承舊grant。 |
| 本人status404或內容遺失 | 既有404／projection及本機UX補充 | 沿既有D10契約 | 沿既有D10契約，不增加第五種projection。 | 查不到紀錄不代表原操作沒有執行；請勿自動重送。無識別時不得猜結果。 |

410只能在本人與binding可可信確認時回傳；未知key／epoch、signature／authority故障不能以410成功形狀掩蓋，沿400（確定非法輸入）或503（無法可信確認）。403永遠優先於操作資訊。capability到期不是reconciliation evidence到期；簽發確認成功不代表付費操作已執行。

P錯誤優先：沿既有入口method／大小／admission→Session／資格／rate後，先驗capability格式／binding與可信authority；有效capability才進既有操作comparison及成本／原子首次grant。expired／revoked／retired且本人已簽發可確認回410，即使原操作已有grant仍不再執行；有效且已有grant則409。必要key已安全清除不能驗簽時回503，使用者仍可手動D10唯讀查詢，不需要恢復舊key。本文的「403優先」是對操作資訊優先，不改既有入口可先拒絕的順序。

本機shared key沿[既有namespace](../../../api/_lib/redis-shared-store.ts)同slot，authority／issuance hashes與expiry／unused索引按E05接線；首次grant同原子邊界寫accounting lookup、標記handle並移除unused索引，duplicate不再grant。正式退役／revocation需freeze、持久化非個人manifest、核對全部部署及可信floor；缺正式durability／restore證據不得清comparison或secret。本機Lua替身只驗程式狀態，不證明真實Redis原子性。

免費簽發入口沿D17既有可信transport admission固定60秒桶；同六付費入口共用60/min admission bucket，不另取client IP；另有E03本人10/min桶與簽發數量限制，確認不增加簽發計數。header fail-fast後有界body reader沿既有D02的5秒／depth8／nodes256；必要來源／限流authority未知503。

本機E01～E10實作依已同步Spec／Plan／data-model／Tasks與限定Analyze執行；本機Readiness可在隔離驗證完成後評估。外部服務／帳戶操作、正式秘密／付費／部署／模式切換及D14真實跨instance驗證仍各自未批准。

## 10. 本機實作驗收矩陣（本輪執行；真實服務項仍未驗）

### 2026-10-07 最後版本本機證據

T157～T161本機子範圍完成，未變更§9批准值。targeted 16 files／222實跑通過、0跳過；完整回歸110 files／1287實跑通過、0跳過。新增epoch四個Lua suites合計54實跑、0跳過，保留`skipIf(!luaAvailable)`；interpreter搭配Redis/cjson替身，不是Redis server。strict、build與14個隔離E2E通過，精確命令／Safety與歷程見[verification](../../../docs/verification/005-local-implementation-evidence.md)。

| 批准要求 | 本機實作／可重現測試 |
| --- | --- |
| E01～E04 immutable bytes、本人資格／CSRF、bounded encoding／time | `request-epoch`固定vector；`request-epoch-endpoints`的1023／1024／1025 B、same-command重驗／零補簽；`redis-request-epoch-store`的1999／2000／2001ms、20unused／100issuance、可信publication／UTC next／rollback |
| E05～E06 同次原子首次grant | `request-epoch-reserve`的registry／G／日週、verify-only初grant、撤銷／退役兩排序；`epoch-engine-integration`實際adapter→verifier→HTTP pipeline→engine→reserve／settle Lua，mock上游恰一次；committed response unknown仍503、後續只duplicate |
| E06 本人oneOf與legacy隔離 | `me-endpoints`互斥DTO／403優先；`me-requests-store`四狀態、capability早已到期仍本人可讀、他人／未知同not_found；`protected-endpoint-pipeline`與實際接線測TEST_ONLY拒legacy，不啟用production cutover |
| E07 detail／review／audit／aggregate | `epoch-lifecycle`的首次終結30天−1／等值／+1、window reset＋30天、pending／reserved／legacy保留、uncertain最小值與原窗口、committed cleanup response unknown保持tombstone；`epoch-engine-integration`清理→reserve與reserve→清理後比較／晚到守恆 |
| E08～E09 單管理者／key引用 | `epoch-lifecycle`的24h／7d／30d／90d界線、每步再驗權、same-operation冪等／conflict／audit，四family引用非零拒絕、歸零＋可信屏障才本機退役；沒有實際secret刪除 |
| E10 手動UX／隱私 | service／panel／管理UI unit tests及`005-epoch.e2e.ts`：unknown零付費、原命令確認零付費、再次手動送出才唯一mock POST、唯讀狀態與reload零重送；URL／storage／SW沒有token／handle |

**正式受阻**：真實跨instance Redis、restore／durability／獨立manifest、全部部署拒絕能力、實際provider帳單／爭議窗口與secret引用歸零未驗且未批准操作；不得將上述本機矩陣當正式清除／輪替／legacy cutover或deployment證據。comparison與accounting的正式清除仍分離，12項正式gate未勾。

本人／非本人、CSRF／不同 origin、額外欄位、未知 endpoint／key／epoch、大小及時間上限±1、重複簽發命令、store unknown、簽發與退役兩順序、兩 instance 不同 keyring、同操作跨輪替 duplicate／不同內容 conflict、legacy 重送、detail→tombstone 與 reserve兩順序、屏障→清 key 與晚到兩順序、restore／rollback、撤銷優先、uncertain／原窗口占用守恆。所有拒絕皆證明零新 grant／零付費上游；清除需真實共享 authority 的跨 instance 證據，不以 fixture 或本文件當驗收完成。

**已批准語意的必要回歸（本機已執行；下表不是正式服務驗收）**：

| 事件／原狀態 | 正確結果 |
| --- | --- |
| 正常signing key輪替，舊capability有效、epoch未退役、從未grant，全部gate成立 | 舊signing key僅驗證；原子首次grant成立一次，首次fingerprint用當時current fingerprint key；不是重新簽capability。 |
| 同操作已grant，signing／fingerprint均經正常輪替 | 原fingerprint version比較；同內容409 duplicate、不同內容409 conflict、零第二grant。 |
| 舊capability尚未grant，但epoch退役或相關key洩漏撤銷先線性化 | 拒絕首次grant，不以正常verify-only重疊放行。 |
| grant先線性化，之後epoch退役／key撤銷 | 不派送第二次；原入帳／uncertain占用／保守結算不追溯作廢，晚到僅原accounting reference。 |
| 正常輪替後同簽發命令確認 | 返回原有效token bytes，不用verify-only key補簽、不延長expiry；命令miss的舊epoch拒絕。 |
