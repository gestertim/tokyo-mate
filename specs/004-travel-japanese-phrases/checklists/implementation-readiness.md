# Implementation Readiness Checklist: Tokyo Mate 東京通｜旅遊日文 Travel Japanese

**Purpose**: 驗證 Feature 004（旅遊日文）在 Clarify + Technical Plan 完成後的 requirements/plan 品質是否已足以進入 `/speckit-tasks` 前的 Gate；本 checklist 檢驗規格與計畫本身的完整性、清晰度、一致性，**不驗證 implementation 是否正確**（implementation 尚未授權）。
**Created**: 2026-09-21
**Feature**: [spec.md](../spec.md) ｜ [plan.md](../plan.md) ｜ [research.md](../research.md) ｜ [data-model.md](../data-model.md) ｜ [quickstart.md](../quickstart.md) ｜ [contracts/travel-japanese-contracts.md](../contracts/travel-japanese-contracts.md)

**Note**: 本 checklist 由 `/speckit-checklist` 產生，依據目前 repository 中「Clarify + Technical Plan 後最新版」artifacts；若稍早 conversation／draft 與目前 spec.md + plan.md 不一致，一律以目前 spec.md + plan.md 為準。
**Review Ownership**: 本 checklist 為 reviewer-owned requirements-quality review artifact。`[x]` 僅代表審查者確認該 requirements-quality 項目已滿足，**不代表 implementation 已完成**。
**Marker Semantics**: 所有項目產生時皆為未勾選 `[ ]`；本次產生程序不勾選任何項目，勾選狀態留待審查者後續操作。**2026-09-21 Planning Artifact 補強後審查更新**：對原本標記為 `[Gap]`／`[Ambiguity]` 且已在 plan.md、
`ux-ui-design-handoff.md`（新增）或 `contracts/travel-japanese-contracts.md` 中找到明確書面依據的 15 個項目（CHK006、
CHK021、CHK022、CHK027、CHK052、CHK060、CHK068、CHK070、CHK071、CHK093、CHK100、CHK110、CHK126、CHK130、
CHK140）勾選為 `[x]` 並附上「已補強：...」説明。
**2026-09-21 Analyze Remediation 逐項複查更新（M2）**：對其餘 125 個項目逐項比對 spec.md／plan.md／
data-model.md／contracts／research.md／quickstart.md／tasks.md／ux-ui-design-handoff.md 的實際書面內容，
確認 121 項具明確書面依據並勾選為 `[x]`；CHK009、CHK032、CHK069、CHK119 共 4 項逐項核對後**仍未找到足夠
書面依據**，維持 `[ ]` 未勾選，不得視為已通過。當時狀態為 **136/140 `[x]`，4 項 `[ ]`**，非 140/140。
**2026-09-21 M2 最終複查更新（Remaining 4 items closure）**：針對 CHK009 已於 plan.md 新增「十三、
Dataset Runtime Anomaly Handling」並於 tasks.md 新增 T045 對應 graceful-failure 測試責任，裁決為
`PASS`；CHK032 逐項確認現有 `searchPhrases` contract（contracts §1）已完整涵蓋 search input／empty
query／partial matching／result／no-result／dataset-only search 之 observable behavior，裁決為
`N/A`（SearchBar 屬 UI implementation component，不需獨立 domain contract）；CHK069 逐項確認現有
artifacts（ux-ui-design-handoff.md「Mobile-first」章節、tasks.md T040 responsive 複查）已涵蓋
mobile-first／可讀日文／可用觸控目標／無 horizontal scrolling／Play-Favorite 不易誤觸／可見安全提醒／
responsive verification 全部面向，裁決為 `N/A`（固定版面比例／字級數值為 implementation styling
細節，非 Specification 基礎）；CHK119 已於 plan.md Testing Strategy §B 與 tasks.md T019 補入「播放失敗
時該卡片文字與收藏按鈕仍可操作、其他句子與 Search／情境瀏覽不受阻斷」之明確測試斷言要求，裁決為
`PASS`。**目前狀態為 140/140 `[x]`（既有 136 項 PASS／已補強 ＋ 本輪新增 CHK009、CHK119 共 2 項
`PASS` ＋ CHK032、CHK069 共 2 項 `N/A`）**，0 項 `[ ]`、0 項 FAIL、0 項 GAP。完整結果見文檔最後「Gap
Re-Review 總結」「二次逐項複查總結（2026-09-21）」與「三次複查總結（2026-09-21，M2 最終收斂）」章節。
---

## 1. Product / Specification Completeness

- [x] CHK001 - Feature 004 的 5 項正式核心功能（情境分類、Phrase Card、語音播放、快速搜尋、收藏常用句）是否已在 spec.md 中各自有對應的 User Story 與 Acceptance Scenarios，且未隱含第 6 項核心功能？[Completeness, Spec §User Scenarios]
- [x] CHK002 - Spec 是否明確定義 7 個正式旅行情境名稱與範圍（機場、飯店、餐廳點餐、購物、交通、求助／緊急狀況、日常溝通），避免情境邊界模糊？[Clarity, Spec §FR-001]
- [x] CHK003 - Success Criteria（SC-001~SC-011）是否皆為可客觀量測或可觀察驗證的敘述，而非主觀形容詞？[Measurability, Spec §Success Criteria]
- [x] CHK004 - Spec Assumptions 是否已明確排除語音技術方案與收藏保存方式的規格層級鎖定，並正確留給 Technical Plan 決定？[Consistency, Spec §Assumptions]
- [x] CHK005 - Plan 是否忠實對應 spec.md 全部 35 條 FR，未新增或縮減未經批准的產品行為？[Traceability, Plan §Constitution Check]
- [x] CHK006 - Feature 004 目前缺少獨立的 `ux-ui-design-handoff.md`（不同於 001/002/003 既有前例），Plan 是否已明確記錄此差異並取得審查者對「以 prompt 內容替代正式 UX/UI handoff」的明確確認？[Ambiguity, Plan §0.8]（已補強：`ux-ui-design-handoff.md` 已建立，Plan §0.8 已更新為引用該正式文件，不再依賴 prompt 內容替代）
- [x] CHK007 - Spec 與 Plan 之間對「語音播放技術」「收藏保存方式」等留給 Technical Plan 決定的項目，是否在 Plan 中已有唯一且明確的決策（無殘留待決定歧義）？[Consistency, Spec §Assumptions / Plan §八]
- [x] CHK008 - Key Entities（Phrase／Category／Category Placement／Favorite）定義是否與 data-model.md 的型別／欄位一致，無命名或語意落差？[Consistency, Spec §Key Entities / data-model.md]
- [x] CHK009 - Edge Cases 章節列出的 5 種情境是否皆能對應到至少一條 FR 或明確的 UI/測試要求，未有僅描述但無對應驗收依據的邊界情況？[Coverage, Spec §Edge Cases]（**PASS**：「正式資料異常導致某情境無法顯示應有內容」邊界情況已於 Plan §十三「Dataset Runtime Anomaly Handling」具體化為 build-time 驗證優先＋runtime graceful-failure 之技術要求，並於 tasks.md 新增 T045 對應測試責任；非新增 Product Requirement，屬既有 graceful-failure／FR-002/FR-003/FR-034 要求之 technical completion）
- [x] CHK010 - Plan「Remaining Approval Required Items」列出的待批准事項，是否已清楚指出批准對象（Audio Technology Decision、`/speckit.tasks`+`/speckit.implement` 授權），且未與其他章節內容衝突？[Clarity, Plan §Remaining Approval Required Items]

## 2. Dataset Correctness

- [x] CHK011 - Spec/Plan/data-model 是否一致定義 unique phrase 數量門檻（>=100）與 category placement 總數門檻（>=140）為兩個獨立且不得混淆的指標？[Clarity, Spec §FR-004/FR-034]
- [x] CHK012 - 每個正式 category 至少 20 個 placements 的門檻，是否在 data-model.md 與 contracts 的 `validateTravelJapaneseDataset()` 契約中皆有可驗證的定義？[Completeness, data-model.md §1 / contracts §1]
- [x] CHK013 - "unique phrase" 與 "category placement" 的定義是否清楚到可避免審查者誤解（例如同一 phrase 跨 3 個情境時如何計數）？[Clarity, Spec §FR-004/FR-005]
- [x] CHK014 - phrase ID 唯一性、japanese/traditionalChinese 非空字串、categories 合法引用等驗證規則，是否皆已在 data-model.md 明確列出且可轉換為自動化測試？[Measurability, data-model.md §1]
- [x] CHK015 - Spec/data-model 是否明確允許同一 phrase 合理跨多個 category，且未對「單一 phrase 最多可跨幾類」設下未經需求佐證的人為上限？[Consistency, Spec §FR-005]
- [x] CHK016 - FR-030（不得為湊數量保留低價值句子）與 FR-002/FR-003 的數量門檻之間，是否有明確的優先順序敘述，避免審查者誤以為數量門檻可凌駕內容品質？[Consistency, Spec §FR-030]
- [x] CHK017 - "duplicate phrase content 不得用來灌 unique count" 的規則，是否已有明確且可自動驗證的判斷依據（例如 japanese+traditionalChinese 完全相同視為重複）？[Measurability, data-model.md §1]
- [x] CHK018 - Dataset validation strategy（`validateTravelJapaneseDataset`）的失敗訊息格式，是否已定義到足以讓審查者／未來內容維運者定位問題（例如指出哪個 category 缺口）？[Clarity, contracts §1]
- [x] CHK019 - Spec Assumptions 是否已明確聲明「正式 dataset 最終內容留待內容製作與審查階段完成」，避免目前任何 candidate/草稿內容被誤認為不可修改的正式資料？[Clarity, Spec §Assumptions]
- [x] CHK020 - FR-029 列出的內容品質審查面向（日文自然度、禮貌程度、旅客可直接使用性、繁中自然度、實際旅行價值、不必要重複、multi-category 適用性、醫療/過敏/緊急用語安全性）是否已完整涵蓋使用者要求的全部審查面向，無遺漏？[Completeness, Spec §FR-029]
- [x] CHK021 - Plan/Spec 是否定義當內容品質審查（FR-029/FR-030）淘汰句子後，導致某 category 低於 20 placements 門檻時的因應流程（例如需要新增候選句子並重新審查）？[Gap]（已補強：Plan §十一「Dataset Quality Review 未達門檻之處理流程」明確定義 MUST/MUST NOT 與重複執行至三項門檻全部 PASS 的流程）
- [x] CHK022 - "正式 dataset 有內容品質 review 計畫" 是否已指出審查時機（例如內容製作階段 vs. implementation 階段）與審查責任歸屬，而非僅列出審查面向？[Gap, Spec §FR-029]（已補強：Plan §十一 明確指出此流程屬 dataset production／validation 階段之責任，非 Plan 本身執行，並定義補件→再審查→再驗證的重複執行時機）
- [x] CHK023 - Multi-category phrase 的合法性規則（categories 陣列僅能引用 7 個正式情境值）是否已在 data-model.md 與 contracts 一致定義，無兩處敘述不一致之虞？[Consistency, data-model.md §1 / contracts §1]

## 3. Search Behavior

- [x] CHK024 - 繁體中文搜尋、日文搜尋、部分關鍵字比對三項需求，是否已在 spec FR-013~FR-015 與 contracts `searchPhrases` 明確一致定義比對邏輯（例如 `includes` 部分比對）？[Consistency, Spec §FR-013-015 / contracts §1]
- [x] CHK025 - "搜尋結果僅來自正式 dataset、不得即時生成 dataset 外句子" 的要求（FR-016）是否有對應的技術決策記錄（research.md 搜尋技術決策）說明為何此架構天然滿足此限制？[Traceability, research.md §2]
- [x] CHK026 - 搜尋為 deterministic 的要求，是否已在 contracts 中明確排除任何隨機排序或非決定性行為（例如去重複規則、比對欄位順序）？[Clarity, contracts §1]
- [x] CHK027 - 無搜尋結果時的空白狀態要求（FR-018），是否已定義與「輸入空字串」情境的差異（例如空字串是否等同無結果）？[Ambiguity, contracts §1]（已補強：contracts §1 新增「UI 呈現區分」段落，並於 Plan Testing Strategy §B 增列對應測試項目）
- [x] CHK028 - Plan/research 是否已明確排除 fuzzy-search dependency、external translation API、Backend search 的必要性，並記錄理由（避免日後被誤判為缺漏而新增）？[Completeness, research.md §2]
- [x] CHK029 - 搜尋結果可直接播放、直接收藏、不需額外詳細頁面的要求（FR-017），是否已在 PhraseCard contract 中與情境瀏覽結果共用相同元件行為，避免兩處實作不一致？[Consistency, contracts §4]
- [x] CHK030 - 是否已定義搜尋結果中「同一 phrase 出現於多個比對欄位時只回傳一次」的去重複規則，並可轉換為自動化測試？[Measurability, contracts §1]
- [x] CHK031 - Spec/Plan 是否已排除「搜尋需要 Generative AI」的可能性，並在 architecture 決策中明確記錄未使用 AI 搜尋？[Consistency, research.md §2 / Plan §Constitution Check]
- [x] CHK032 - 搜尋輸入框的 accessible label 要求，是否已在 UX/Accessibility 相關章節與 contracts 中一致提及（非僅出現於其中一份文件）？[Consistency, Plan §Testing Strategy]（**N/A** — SearchBar 是 UI implementation component，不需要獨立 domain contract；其 observable search behavior（search input／empty query／partial matching／result／no-result／dataset-only search）已由現有 `searchPhrases` contract（contracts §1）覆蓋，accessible label 之 UI 細節另由 ux-ui-design-handoff.md「Accessibility」章節、Plan Testing Strategy §C 與 tasks.md T021 追蹤，不需為此新增 architecture artifact）
- [x] CHK033 - 搜尋門檻（例如最小關鍵字長度、trim/lowercase 正規化）是否已完整定義，避免不同 reviewer 對「部分關鍵字」有不同理解？[Clarity, research.md §2]

## 4. Favorites Behavior

- [x] CHK034 - 收藏／取消收藏、「我的常用句」瀏覽、空白狀態（FR-019~FR-024）是否皆有對應的 Acceptance Scenario，且未有僅在 FR 出現但無情境驗證依據的需求？[Coverage, Spec §User Story 4]
- [x] CHK035 - 跨情境／搜尋結果收藏狀態一致性（FR-022）的技術實現方式，是否已在 data-model.md 明確說明「共用同一 `favoriteIds` state」而非各 view 各自維護副本？[Clarity, data-model.md §4]
- [x] CHK036 - 收藏保存的是 stable phrase id 而非整筆 phrase 內容，是否已在 data-model.md 與 contracts 的 `favorites.ts` 契約中一致確認？[Consistency, data-model.md §4 / contracts §2]
- [x] CHK037 - local-first persistence（`localStorage`）是否已在 Plan 中明確記錄為目前批准的 simplest sufficient 方案，並排除帳號／Cloud DB／multi-device sync 的必要性？[Traceability, Plan §Summary / research.md §3]
- [x] CHK038 - Persistence unavailable（例如 localStorage 被封鎖）時的 graceful fallback 行為，是否已在 contracts 中明確定義「不得拋出例外」且結果為安全降級？[Measurability, contracts §2]
- [x] CHK039 - Malformed persistence（例如內容非合法 JSON 或型別不符）不會造成 Feature crash 的要求，是否已在 contracts `loadFavoriteIds()` 契約中具體定義所有失敗情境的回傳值？[Completeness, contracts §2]
- [x] CHK040 - Favorites empty state 的要求（FR-024）是否已明確定義需提供「回到情境瀏覽或搜尋的方式」，而非僅顯示空白訊息？[Clarity, Spec §FR-024]
- [x] CHK041 - Plan 是否已明確排除因 favorites 需求而新增 IndexedDB library、persistence framework、Backend 或 account system，並記錄排除理由？[Completeness, research.md §3]
- [x] CHK042 - 收藏狀態一致性要求是否涵蓋「同一 phrase 在多個 category 中被收藏」與「同一 phrase 於搜尋結果中被收藏」兩種情境皆已納入驗證？[Coverage, Spec §FR-022 / Acceptance Scenario 4]
- [x] CHK043 - Plan 是否已定義收藏資料在 `onBack` 或畫面切換時不被清除，僅 session 暫時狀態（如 `view`/`searchQuery`）重置？[Clarity, contracts §6]
- [x] CHK044 - 是否已排除「收藏需要帳號」「收藏需要多裝置同步」等超出 FR-023 範圍的隱含期待，避免審查者誤解收藏範圍？[Consistency, Spec §FR-023 / Plan §Privacy]

## 5. Audio Behavior

- [x] CHK045 - 語音播放狀態（idle／requested／playing／failed）是否已在 data-model.md 與 contracts 一致定義為互斥的有限狀態機，無未定義的中間狀態？[Consistency, data-model.md §5 / contracts §3]
- [x] CHK046 - 「同一時間僅一個 active playback，新播放取代前一個」的要求（FR-010/FR-011），是否已在 contracts `speakJapanese` 明確定義為「先 `cancel()` 再 `speak()`」的具體實作契約？[Clarity, contracts §3]
- [x] CHK047 - 離開 Feature／unmount 時的 cleanup 行為，是否已在 Plan 與 contracts 中一致要求呼叫 `cancelSpeech()`，避免背景殘留播放？[Consistency, Plan §八 Fallback / contracts §6]
- [x] CHK048 - Speech synthesis 不可用時的 graceful fallback（播放按鈕 disabled + 說明文字，而非隱藏）是否已具體定義，並確保不影響日文文字、繁中、搜尋、分類、收藏？[Completeness, Plan §八 Fallback / Spec §FR-012]
- [x] CHK049 - Plan 是否已避免宣稱「所有 browser/device 都一定有 Japanese voice」，並以「不保證」用語呈現？[Clarity, Plan §八 比較表]
- [x] CHK050 - Plan 是否已避免宣稱「audio 一定 offline 可用」，並以條件式敘述（取決於裝置/瀏覽器能力）呈現？[Clarity, Plan §PWA / Offline]
- [x] CHK051 - Plan 是否明確排除目前導入 OpenAI Cloud TTS、其他 Cloud TTS 或預錄 MP3 的必要性，並記錄與既有 Cloud TTS 能力比較後的理由？[Traceability, Plan §八 決策]
- [x] CHK052 - **若實際 implementation 過程中發現瀏覽器原生 SpeechSynthesis 無法滿足 Specification（例如日文 voice 覆蓋率過低）**，Plan 是否已明確記錄「必須 STOP 並重新進入 approval，不得自行改為其他語音方案」此一觸發條件？[Gap, Plan §八]（已補強：Plan §九「Audio Strategy Escalation Gate」明確定義觸發條件、STOP 程序與 MUST NOT 清單）
- [x] CHK053 - Audio failure 不影響其餘功能（文字、搜尋、分類、收藏、其他句子播放）的要求（FR-012），是否已於 contracts 明確要求「該卡片文字與收藏按鈕維持可操作，不得整卡 disabled」？[Clarity, contracts §4]
- [x] CHK054 - 語音技術決策（research.md／Plan §八）是否已完整比較「重用既有 Cloud TTS」與「瀏覽器原生 SpeechSynthesis」兩方案的隱私、成本、離線、可靠性面向，供審查者判斷？[Completeness, research.md §1 / Plan §八]
- [x] CHK055 - 是否已定義測試環境（jsdom）下如何驗證 SpeechSynthesis 行為（mock 策略），確保「播放狀態」相關需求可被自動化驗證？[Measurability, research.md §6]
- [x] CHK056 - 播放失敗狀態呈現方式是否已排除純顏色作為唯一辨識依據，並要求文字＋語意標記？[Coverage, Plan §Testing Strategy C]

## 6. Safety / Emergency Behavior

- [x] CHK057 - 「求助／緊急狀況」安全提醒文字為 MUST 顯示的可見 UI 需求（FR-035），是否已明確排除「僅存在 README」「僅存在 hidden help」「需額外展開才可見」等不合格呈現方式？[Clarity, contracts §5]
- [x] CHK058 - Safety reminder 的語意標記要求（例如 `role="note"`）是否已具體定義，確保其可被 assistive technology 理解，而非僅一般使用者可見？[Completeness, contracts §5]
- [x] CHK059 - Safety reminder 的呈現方式是否已明確排除「僅以顏色作辨識」，並要求可讀文字本身作為主要依據？[Consistency, contracts §5]
- [x] CHK060 - Spec/Plan/contracts 是否已明確排除將 safety reminder 升級為 blocking modal、mandatory confirmation、checkbox acknowledgment 或每次進入強迫互動的 gating？此為目前僅由元件設計（無 props、非 modal）隱含達成，尚未見到明確書面「MUST NOT」敘述。[Gap, Spec §FR-035 / contracts §5]（已補強：Plan §十「Safety Reminder Escalation Constraint」與 ux-ui-design-handoff.md「Safety」章節皆已明確列出 MUST NOT 清單）
- [x] CHK061 - Safety-critical phrase（警察／救護車／停止／醫院／遺失重要物品）在 Help & Emergency 中具較高資訊優先級的呈現方式，是否已在 contracts 明確定義為「排列於清單前段」等可驗證規則？[Measurability, contracts §1]
- [x] CHK062 - Safety-critical 標示不依賴顏色作唯一辨識的要求，是否已具體定義視覺呈現方式（例如圖示＋文字）？[Clarity, contracts §4]
- [x] CHK063 - Spec FR-028 對「不得暗示醫療診斷、緊急服務保證、食品安全確認、翻譯絕對準確、對方必定理解接受」等禁止敘述，是否已完整涵蓋使用者列出的全部禁止項目？[Completeness, Spec §FR-028]
- [x] CHK064 - FR-035（安全提醒）與 FR-028（呈現方式限制）之間的關係是否已清楚定義為互補而非取代（即 FR-035 不因 FR-028 已存在而被省略）？[Consistency, Spec §FR-035]
- [x] CHK065 - Safety reminder 的內容要求（提醒翻譯僅供參考、緊急狀況仍須尋求正式協助）是否已具體到可轉換為元件測試斷言，而非僅抽象敘述？[Measurability, contracts §5]
- [x] CHK066 - Testing Strategy 是否已包含「safety reminder 存在於 DOM 且可見（非 `display:none`／`aria-hidden`）」的具體測試要求，可作為 regression 防護避免未來被意外移除？[Coverage, Plan §Testing Strategy B]
- [x] CHK067 - FR-025 列出的 6 類 safety-critical 句子（警察／救護車／要求停止／身體不舒服／遺失重要物品／醫院或警察或藥局）是否已在 dataset 驗證測試（Testing Strategy A）中列為明確斷言項目？[Traceability, Plan §Testing Strategy A]
- [x] CHK068 - Spec/Plan 是否已排除「安全提醒需要使用者主動關閉或確認才能繼續使用」的隱含期待，避免未來 implementation 誤加不必要摩擦？[Gap, Spec §FR-035]（已補強：Plan §十 明確排除 mandatory confirmation／checkbox acknowledgement／emergency gating）

## 7. UX / Accessibility

- [x] CHK069 - Mobile-first、Phrase Card 以日文為主要閱讀資訊、繁中容易確認等 UX 原則，是否已具體到可供審查（例如版面比例、字級層級），而非僅抽象敘述？[Clarity, Plan §Project Structure]（**N/A** — fixed layout ratios／font-size values are implementation styling details without Specification basis；最終 CSS 數值應延續既有 design system 並由 viewport verification 驗證。現有 artifacts（ux-ui-design-handoff.md「Mobile-first」章節、tasks.md T040）已涵蓋 mobile-first、可讀日文、可用觸控目標、無 horizontal scrolling、Play／Favorite 不易誤觸、可見安全提醒與 responsive verification 等 observable responsive behavior 要求）
- [x] CHK070 - Play／Favorite 操作的可辨識性與 touch target 尺寸要求，是否已有具體定義或明確標示為延後至 implementation 階段的細節？[Gap, Plan]（已補強：ux-ui-design-handoff.md「Mobile-first」章節已定義 touch target 與 Play/Favorite 不易誤觸之約束條件；精確像素數值留待 implementation 階段）
- [x] CHK071 - "不需要 horizontal scrolling" 的要求是否已在任一 artifact 中明確記錄為約束條件，而非僅隱含於 mobile-first 假設？[Gap]（已補強：ux-ui-design-handoff.md「Mobile-first」章節已明確列出「不需要 horizontal scrolling」為約束條件）
- [x] CHK072 - Search／Favorites／Emergency category 目需「容易取得」的要求，是否已具體定義其在既有導覽結構中的進入方式（例如與 HomeScreen 既有 5 個入口一致）？[Clarity, Plan §Module Responsibilities]
- [x] CHK073 - "不新增不必要 detail page" 的要求是否已與 FR-017（搜尋結果不需額外詳細頁）一致，並延伸至情境瀏覽與收藏清單？[Consistency, Spec §FR-017 / Plan §Project Structure]
- [x] CHK074 - 日文文字節點需要 `lang="ja"` 語意標記的要求，是否已在 contracts 與 Testing Strategy 兩處一致要求？[Consistency, contracts §4 / Plan §Testing Strategy C]
- [x] CHK075 - 搜尋輸入需可理解 label 的要求，是否已具體到「使用 `<label>` 元素」而非僅 placeholder？[Clarity, Plan §Testing Strategy C]
- [x] CHK076 - Category controls 可 keyboard 操作的要求，是否已明確要求採用原生 `<button>` 元素（沿用既有 tablist pattern），而非自訂需額外 keyboard handler 的元件？[Clarity, Plan §Project Structure]
- [x] CHK077 - Favorite 的 accessible state（`aria-pressed`）與 accessible name 要求，是否已具體到可轉換為元件測試斷言？[Measurability, contracts §4]
- [x] CHK078 - Playing／failed 狀態需以 `aria-live` 或等效語意呈現（非純顏色）的要求，是否已在 Testing Strategy C 中列為明確驗證項目？[Coverage, Plan §Testing Strategy C]
- [x] CHK079 - Focus-visible 要求是否已明確定義為「沿用既有全域樣式，不新增 CSS framework」，避免 implementation 階段誤解為需要新增樣式方案？[Clarity, Plan §Testing Strategy C]
- [x] CHK080 - 是否所有「狀態呈現不得僅以顏色作唯一辨識」的要求（safety-critical、播放狀態、收藏狀態）已在同一份文件中一致列出，無遺漏任一狀態類別？[Consistency, contracts §4]

## 8. Privacy / Secrets

- [x] CHK081 - Plan 是否已明確確認 Feature 004 不需要 microphone、camera、location、Authentication、account、profile 或 cloud phrase history？[Completeness, Plan §Privacy / Secrets]
- [x] CHK082 - 搜尋關鍵字僅於 frontend runtime 記憶體使用、不持久化、不上傳的要求，是否已在 Plan 與 research.md 中一致確認？[Consistency, Plan §Privacy / research.md §2]
- [x] CHK083 - Favorites 僅保存 phrase id（非整筆內容）的隱私邊界，是否已在 data-model.md、contracts 與 Plan 三處一致確認，無任一文件描述為儲存完整句子內容？[Consistency, data-model.md §4 / contracts §2 / Plan §Privacy]
- [x] CHK084 - Plan 是否已明確確認不新增 secret、不 hard-code API key、不 commit credentials、不將 secret 放入 frontend bundle？[Completeness, Plan §Privacy / Secrets]
- [x] CHK085 - 語音採瀏覽器原生合成、句子文字不需離開瀏覽器的隱私優勢，是否已與既有 Cloud TTS 的既有行為做出明確區隔（避免誤解為既有 Cloud TTS 隱私狀況也因此改變）？[Clarity, Plan §八 比較表]
- [x] CHK086 - 若未來 implementation proposal 需要 external service/API，Plan/Constitution 是否已明確要求此類變更需重新取得 approval（而非默默實作）？[Traceability, Plan §Constitution Check / Constitution §V]
- [x] CHK087 - Plan 是否已確認本 feature 不蒐集或建立任何長期聊天紀錄、精確位置或其他個資，符合既有 Constitution VI. Privacy & Educational Safety？[Consistency, Plan §Privacy / Constitution §VI]

## 9. Architecture Discipline

- [x] CHK088 - Plan 是否已逐項確認未無理由新增 React Router、Redux、Zustand、global state library、Backend、Cloud Database、Authentication、Generative AI、新 translation API、Cloud TTS、UI framework、Tailwind 或 CSS-in-JS framework？[Completeness, Plan §Constitution Check / §二十三]
- [x] CHK089 - Plan 對「沿用既有 screen 本地 state 切換 view」pattern 的延伸，是否已具體對照既有 `HomeScreen.tsx` 現有 3 個入口的實作方式，證明架構一致性而非新模式？[Traceability, Plan §0.2]
- [x] CHK090 - Dataset + service 層 + feature 元件的資料夾慣例，是否已具體對照既有 `src/features/knowledge/` 前例，確認延伸而非平行系統？[Traceability, Plan §0.3]
- [x] CHK091 - Plan 對「Favorites 使用 localStorage」是否已明確論證與既有 001 FR-017/018/026（禁止持久化聊天內容/翻譯結果/位置）不衝突，並具體區分保存範圍（僅 phrase id）？[Consistency, Plan §0.4]
- [x] CHK092 - Audio Technology Decision（不重用既有 Cloud TTS）是否已在 Constitution Check 表格中明確標示為「有條件通過」並要求 Conformance Check 明確確認，而非默默視為完全通過？[Traceability, Plan §Constitution Check]
- [x] CHK093 - 若未來 Tasks／Implementation 階段出現任何本節列出的禁止項目，Plan 是否已建立可依循的「標記為 deviation / escalation」機制（而非自動視為通過）？[Gap]（已補強：Plan §十二「Escalation Mechanisms for Future Deviations」明確定義 architecture drift 標記與 STOP 機制）
- [x] CHK094 - Plan 的 A/B/C Complexity 判斷（維持 A｜Frontend-first）是否已對照 Constitution III 的升級條件（Cloud 基礎設施、multi-user、Authentication、Backend 權限架構、Generative AI 核心能力）逐一確認皆未觸發？[Consistency, Plan §Constitution Check / Constitution §III]
- [x] CHK095 - Plan 是否已明確排除「因應 Feature 004 而修改既有 `service-worker.ts`」的必要性，並提供具體理由（既有 allowlist 已涵蓋）？[Clarity, Plan §PWA / Offline]

## 10. Dependencies

- [x] CHK096 - Plan 是否明確聲明新 runtime dependency 為 0，並列出語音／持久化改用瀏覽器原生 API 而非 npm package 的具體理由？[Clarity, Plan §Dependencies]
- [x] CHK097 - research.md 是否已針對 fuzzy-search（例如 Fuse.js）等候選 dependency 明確記錄「未被選用」及理由，而非略過不提？[Completeness, research.md §2]
- [x] CHK098 - research.md 是否已針對 IndexedDB 抽象層等候選方案明確記錄「對簡單 id 陣列過度設計」而未被選用？[Completeness, research.md §3]
- [x] CHK099 - Accessibility 需求（lang 標記、aria-pressed、aria-live、keyboard 操作）是否已確認皆可用既有 HTML/JSX 原生能力達成，不需新增 accessibility framework？[Consistency, Plan §Testing Strategy C]
- [x] CHK100 - 若 Tasks 階段後續提出任何新 dependency，Plan 是否已建立要求「說明對應 requirement 與現有能力不足原因」的審查機制，否則視為 FAIL？[Gap]（已補強：Plan §十二「Dependency escalation」明確定義審查機制與 FAIL 條件）
- [x] CHK101 - Plan 是否已確認測試層面（Vitest mock `speechSynthesis`）不需要新增測試 dependency，僅使用既有 `vi.stubGlobal` 等既有工具鏈能力？[Consistency, research.md §6]

## 11. PWA / Offline Implications

- [x] CHK102 - Plan 是否已具體確認新 dataset 路徑（`src/data/tokyo/travel-japanese-phrases.json`）落在既有 `APPROVED_STATIC_PREFIXES` 涵蓋範圍內，並提供對應程式路徑佐證？[Traceability, Plan §0.6]
- [x] CHK103 - Plan 是否已明確排除「假設一定需要修改 Service Worker」的預設立場，並說明現有 allowlist 已足夠的具體理由？[Clarity, Plan §PWA / Offline]
- [x] CHK104 - Plan 是否已避免宣稱 SpeechSynthesis audio 一定 offline 可用，並將其列為「取決於裝置／瀏覽器能力」的條件式敘述？[Consistency, Plan §PWA / Offline]
- [x] CHK105 - Plan 是否已明確排除「為 audio offline guarantee 自動加入 MP3 或 Cloud service」的必要性？[Completeness, Plan §PWA / Offline]
- [x] CHK106 - Category／文字／搜尋／收藏功能不依賴 external API 的離線可用性敘述，是否已具體說明其技術基礎（build-time bundle 進 JS 的靜態 import）？[Clarity, Plan §PWA / Offline]

## 12. Testing Coverage

- [x] CHK107 - Testing Strategy 是否已涵蓋 dataset validation 全部項目（7 情境、unique>=100、placements>=140、每類>=20、id 唯一、必要文字非空、合法 category、重複防護、safety metadata）？[Completeness, Plan §Testing Strategy A]
- [x] CHK108 - Testing Strategy 是否已涵蓋 component/behavior 測試全部項目（情境渲染、Phrase Card 渲染、繁中搜尋、日文搜尋、部分搜尋、無結果、收藏切換、收藏空狀態、跨情境收藏一致性、持久化還原、malformed persistence fallback、audio 不可用、playing/failed 狀態、新播放取代前一個、safety-critical 可辨識性、可見安全提醒）？[Completeness, Plan §Testing Strategy B]
- [x] CHK109 - Testing Strategy 是否已涵蓋 accessibility 測試全部項目（lang 語意、favorite accessible state、audio 狀態、safety reminder 語意、keyboard/focus、無純顏色狀態）？[Completeness, Plan §Testing Strategy C]
- [x] CHK110 - Testing Strategy 是否已明確列出 `HomeScreen.tsx` 新增導覽入口後，既有 `HomeScreen.test.tsx` 需同步更新以涵蓋新入口且不破壞既有 3 個入口斷言？[Gap, Plan §Module Responsibilities]（已補強：Plan Testing Strategy §E「Home Integration Regression Test」明確指出更新 `src/screens/HomeScreen.test.tsx` 並列出至少驗證項目）
- [x] CHK111 - Dataset validation 測試（Testing Strategy A）是否已具體引用 FR-025 列出的 6 類 safety-critical 句子作為明確斷言依據？[Traceability, Plan §Testing Strategy A]
- [x] CHK112 - Testing Strategy 是否已定義 Vitest（jsdom）環境下如何 mock `window.speechSynthesis`（含 `onstart`/`onend`/`onerror` 觸發），以驗證播放狀態轉換？[Measurability, research.md §6]
- [x] CHK113 - Regression 測試是否已明確要求執行既有全部 Vitest 套件與既有 Playwright regression（`npm run test:pwa-red-gate`），並以「維持通過」為驗收標準？[Measurability, Plan §Testing Strategy D]
- [x] CHK114 - Testing Strategy 是否已要求執行 `npm run build` 以驗證型別檢查與打包無誤，作為 implementation 完成前的必要步驟？[Completeness, Plan §Testing Strategy D]
- [x] CHK115 - quickstart.md 列出的驗證場景是否與 spec.md 的 Acceptance Scenarios 逐一對應，無遺漏任一 User Story 的驗證步驟？[Traceability, quickstart.md]
- [x] CHK116 - 是否已定義「同一 phrase 跨多個情境時內容一致」此一需求的具體測試方式（例如挑選一個已知跨情境 phrase 作為固定測試案例）？[Measurability, Spec §Acceptance Scenario 1.5]
- [x] CHK117 - Favorites 測試是否已具體要求驗證「重新掛載 screen 後先前收藏仍存在」與「localStorage 內容非法 JSON 時安全降級」兩種情境皆有獨立測試案例，而非合併為單一模糊斷言？[Coverage, Plan §Testing Strategy B]
- [x] CHK118 - 是否已定義安全提醒（SafetyReminder）測試需驗證「不需互動即可見」與「非僅 accessibility-only 而視覺隱藏」兩個面向，皆有獨立可執行的測試斷言？[Measurability, contracts §5]
- [x] CHK119 - Testing Strategy 是否已涵蓋「播放失敗時該卡片文字與收藏按鈕仍可操作（不得整卡 disabled）」的具體測試案例？[Coverage, contracts §4]（**PASS**：Plan Testing Strategy §B 與 tasks.md T019 已補入明確斷言——播放失敗時該卡片自身日文／繁中文字與收藏按鈕仍可操作、使用者仍可操作其他句子、Search／情境瀏覽不因單一播放失敗而被阻斷，補入既有 Audio／Phrase Card 測試任務，未新增架構）
- [x] CHK120 - 是否已定義何謂測試「通過」的量化標準（例如 100% 既有測試維持通過、新測試全數通過），避免驗收標準模糊？[Measurability, quickstart.md §通過標準]

## 13. Regression Protection

- [x] CHK121 - Plan 是否已明確列出 Feature 004 不得修改的既有檔案清單（`AssistantScreen.tsx`／`AudioPlayer.tsx`／`api/speech.ts`／`NearbyScreen.tsx`／`PhotoTranslateScreen.tsx`／`KnowledgeBrowser.tsx`／既有 `/api/*`／`service-worker.ts`）？[Completeness, Plan §Regression 保護]
- [x] CHK122 - FR-031（不得破壞 001/002/003 既有可觀察行為、API endpoints、PWA behavior、既有自動化測試）是否已在 Plan 的 Regression 保護章節有對應的具體落實方式（而非僅重述 FR）？[Traceability, Plan §Regression 保護]
- [x] CHK123 - Plan 是否已明確排除「把 Feature 001–003 重新設計為 Feature 004 一部分」的可能性，並將 004 定位為既有 App 的第 6 個功能入口？[Consistency, Plan §Summary]
- [x] CHK124 - `HomeScreen.tsx` 擴充方式（新增 1 個按鈕＋1 個 boolean state）是否已明確論證與既有 3 個入口的擴充模式完全相同，將既有入口回歸風險降到最低？[Clarity, Plan §Regression 保護]
- [x] CHK125 - Regression 驗證是否已定義明確的執行指令與通過標準（`npx vitest run`、`npm run build`、`npm run test:pwa-red-gate`），可供 Tasks 階段直接引用？[Measurability, quickstart.md §回歸驗證]
- [x] CHK126 - 是否已定義若 regression 測試發現 001/002/003 既有行為受影響時的處理流程（例如 STOP 並回報，而非自行調整既有功能以配合新功能）？[Gap]（已補強：Plan §Regression 保護「Regression Failure Handling」明確定義預設視為 regression blocker 與 MUST NOT／例外處理流程）

## 14. Repository Safety

- [x] CHK127 - Plan 是否已明確確認未修改、未移動 `specs/001-tokyo-travel-assistant/`、`specs/002-photo-translate/`、`specs/003-nearby-map-navigation/` 任何既有檔案？[Completeness, Plan §Repository Safety Confirmation]
- [x] CHK128 - Plan 是否已明確確認未移動或重建 `mvp-safe-baseline`、`002-safe-baseline`、`003-safe-baseline` 任何 tag？[Completeness, Plan §Repository Safety Confirmation]
- [x] CHK129 - Plan 是否已明確列出本次僅新增 `specs/004-travel-japanese-phrases/` 下的文件（`plan.md`／`research.md`／`data-model.md`／`quickstart.md`／`contracts/`），未觸碰 `.git/`／`.github/`／`.specify/`／`.vscode/`？[Clarity, Plan §Repository Safety Confirmation]
- [x] CHK130 - 若未來 Plan／Tasks 需要任何 destructive operation（force push、history rewrite、tag 移動），是否已建立明確的「必須標記 STOP」機制？[Gap]（已補強：Plan §十二「Destructive operation」明確要求先 STOP 並取得批准）
- [x] CHK131 - Checklist／Plan 是否已確認目前 Feature branch（`004-travel-japanese`）與 spec 目錄命名（`004-travel-japanese-phrases`）差異已被記錄為既存事實，不影響治理判斷？[Clarity, Plan 標頭]

## 15. Authorization Boundary

- [x] CHK132 - Plan 是否已明確聲明本文件不構成 implementation 授權，且 `src/`、`api/`、`package.json` 均未變更？[Completeness, Plan §Repository Safety Confirmation]
- [x] CHK133 - Plan 是否已列出仍需經審查者明確批准的項目清單（Audio Technology Decision、`/speckit.tasks` 與 `/speckit.implement` 批准），且未與已完成批准項目混淆？[Clarity, Plan §Remaining Approval Required Items]
- [x] CHK134 - Checklist 本身（本文件）是否已明確聲明不構成 implementation 授權，且僅為 requirements-quality review artifact？[Consistency, 本文件標頭]
- [x] CHK135 - 是否已確認目前尚未安裝任何 dependency、尚未建立 dataset 正式內容檔案之外的程式碼、尚未修改 environment variables？[Completeness, Plan §Constitution Check]
- [x] CHK136 - 是否已確認 Specify、Clarify、UX/UI、Plan、Checklist、Tasks、Analyze 皆非 implementation 授權，僅 `/speckit-implement` 於 Implementation Readiness Gate PASS 且經明確批准後方可進行？[Consistency, Constitution §XI]

## 16. Language Policy

- [x] CHK137 - spec.md、plan.md、research.md、data-model.md、quickstart.md、contracts 是否皆以繁體中文撰寫使用者需閱讀／審閱／批准的內容，僅程式 identifier／path／API 保留英文？[Consistency, 全部 artifacts]
- [x] CHK138 - 本 checklist 自身是否符合語言政策，所有需要作者閱讀與勾選的項目文字皆為繁體中文？[Consistency, 本文件]
- [x] CHK139 - Contracts 文件中的程式碼片段（型別、函式簽章）保留英文是否符合政策例外範圍（code identifiers／API/schema keys），且周邊說明文字皆為繁體中文？[Consistency, contracts]
- [x] CHK140 - 若未來 Tasks／Implementation 產出的 user-facing planning artifacts 被改為英文，是否已建立可依循的「標記為需要修正」機制？[Gap]（已補強：Plan §十二「Language policy」明確定義需標記修正並改回繁體中文）

---

## Notes

- 本 checklist 檢驗的是 spec/plan/data-model/contracts/quickstart **本身的需求品質與完整性**，不是 implementation 是否正確；`/speckit-implement` 讀取本 checklist 勾選狀態作為 Gate 依據，但不得修改勾選標記。
- 標記 `[Gap]` 的項目代表目前 artifacts 中**尚未找到明確書面依據**，建議在進入 `/speckit-tasks` 前由審查者確認是否需要補充於 spec.md／plan.md，或由審查者判斷可接受現況並勾選通過。
- 標記 `[Ambiguity]` 的項目代表存在合理但未完全消歧的敘述，建議審查者明確裁決後勾選。
- 新增項目一律從 CHK001 開始編號（本檔案為首次建立）；若後續新增項目，須接續現有最大編號。
- `checklists/requirements.md` 為 `/speckit-specify` 與 `/speckit-clarify` 維護的既有內建 spec-quality checklist，與本檔案為不同生命週期，互不覆蓋。

---

## Gap Re-Review 總結（2026-09-21，Planning Artifact 補強後）

本輪僅補強 planning artifacts（`plan.md` 新增第九～十二節與 Testing Strategy／Regression 保護段落、
新增 `ux-ui-design-handoff.md`、`contracts/travel-japanese-contracts.md` 微幅補充搜尋空字串行為），
未修改 `src/`、`api/`、`package.json`，未安裝 dependency，未執行 `/speckit-tasks` 或
`/speckit-implement`。

| CHK | 原標記 | 新書面依據 | 結論 |
|-----|--------|------------|------|
| CHK006 | Ambiguity | `ux-ui-design-handoff.md`（新增）／Plan §0.8 | 已關閉 |
| CHK021 | Gap | Plan §十一 Dataset Quality Review 未達門檻之處理流程 | 已關閉 |
| CHK022 | Gap | Plan §十一（審查時機與責任歸屬） | 已關閉 |
| CHK027 | Ambiguity | contracts §1 UI 呈現區分／Plan Testing Strategy §B | 已關閉 |
| CHK052 | Gap | Plan §九 Audio Strategy Escalation Gate | 已關閉 |
| CHK060 | Gap | Plan §十／ux-ui-design-handoff.md「Safety」 | 已關閉 |
| CHK068 | Gap | Plan §十 | 已關閉 |
| CHK070 | Gap | ux-ui-design-handoff.md「Mobile-first」 | 已關閉 |
| CHK071 | Gap | ux-ui-design-handoff.md「Mobile-first」 | 已關閉 |
| CHK093 | Gap | Plan §十二 Architecture drift | 已關閉 |
| CHK100 | Gap | Plan §十二 Dependency escalation | 已關閉 |
| CHK110 | Gap | Plan Testing Strategy §E Home Integration Regression Test | 已關閉 |
| CHK126 | Gap | Plan §Regression 保護「Regression Failure Handling」 | 已關閉 |
| CHK130 | Gap | Plan §十二 Destructive operation | 已關閉 |
| CHK140 | Gap | Plan §十二 Language policy | 已關閉 |

**與原始狀態回報的數量差異說明**：本次審查前的狀態摘要指出「14 項為 Gap／Ambiguity」；實際逐項比對本
checklist 全文後，明確標記 `[Gap]` 或 `[Ambiguity]` 的項目共 15 項（如上表）。本次已將此 15 項全數
比對新增之書面依據並關閉，未發現遺漏或無法關閉之項目。

**其餘 125 項**（CHK001–CHK140 扣除上述 15 項）原本即標記為「已有明確書面依據」，本輪未變更其內容
或勾選狀態。

**結論**：原 15 個 Gap／Ambiguity 已全部找到對應書面依據並關閉，0 項仍為 Gap。

---

## 二次逐項複查總結（2026-09-21，Analyze Remediation M2）

本輪為 Feature 004 Analyze findings（M2）之逐項複查，非機械式全數勾選。逐一比對 CHK001–CHK140 每一項
文字內容與 spec.md／plan.md／data-model.md／contracts/travel-japanese-contracts.md／research.md／
quickstart.md／tasks.md／ux-ui-design-handoff.md 之實際書面內容，結果如下：

- **已核實有明確書面依據並勾選為 `[x]`**：121 項（CHK001–CHK005、CHK007、CHK008、CHK010–CHK020、
  CHK023–CHK026、CHK028–CHK031、CHK033–CHK051、CHK053–CHK059、CHK061–CHK067、CHK072–CHK092、
  CHK094–CHK099、CHK101–CHK109、CHK111–CHK118、CHK120–CHK125、CHK127–CHK129、CHK131–CHK139）。
- **先前已關閉之 15 項**：CHK006、CHK021、CHK022、CHK027、CHK052、CHK060、CHK068、CHK070、CHK071、
  CHK093、CHK100、CHK110、CHK126、CHK130、CHK140，維持 `[x]`。
- **逐項核對後仍缺乏足夠書面依據，保留 `[ ]`**：4 項，詳見下表。

| CHK | 說明 | 未關閉原因 |
|-----|------|-----------|
| CHK009 | Edge Cases 5 種情境是否皆對應至少一條 FR 或明確 UI/測試要求 | 「正式資料異常導致某情境無法顯示應有內容」此邊界情況目前無對應 FR 編號，亦無對應 runtime fallback 測試任務，僅有 build-time dataset 門檻驗證（FR-002/FR-003），未涵蓋 runtime 資料異常時的畫面降級行為 |
| CHK032 | 搜尋輸入框 accessible label 要求是否在 UX/Accessibility 章節與 contracts 中一致提及 | `ux-ui-design-handoff.md` 與 Plan Testing Strategy §C 皆有提及，但 `contracts/travel-japanese-contracts.md` 目前無獨立的 `SearchBar.tsx` component contract 章節，故「contracts 中一致提及」之條件未完全滿足 |
| CHK069 | Mobile-first／Phrase Card 版面原則是否具體到版面比例、字級層級等可供審查的程度 | 目前僅有質性約束（不需 horizontal scrolling、touch target 需可辨識等），無具體版面比例或字級層級數值，此類細節依 CHK070 既有結論留待 implementation 階段決定 |
| CHK119 | Testing Strategy 是否涵蓋「播放失敗時該卡片文字與收藏按鈕仍可操作」的具體測試案例 | `contracts §4` 與 tasks.md T018 已定義此實作要求，但 Plan Testing Strategy §B 與對應測試任務（T019）僅明確測試「播放失敗不影響其他句子播放」，未見獨立列出「本卡片自身文字／收藏按鈕於播放失敗時仍可操作」之測試斷言 |

**目前實際狀態**：136/140 `[x]`，4/140 `[ ]`。**非 140/140**，不得宣稱全數 PASS。上述 4 項均為
requirements-quality 層級的文件補強建議，非 implementation 缺陷，亦未被原始 Analyze 標記為 Blocking；
是否需要在 `/speckit-tasks` 前補充相關 artifacts 或由審查者判斷可接受現況，留待審查者決定。

## Tasks 前 Readiness Review：136/140（4 項待審查者確認，非 Blocking）

---

## 三次複查總結（2026-09-21，M2 最終收斂：CHK009／CHK032／CHK069／CHK119）

本輪針對「二次逐項複查總結」遺留之 4 項逐一裁決，皆為 planning-level 補強或審查結論，**未新增
Product Requirement、未修改 `src/`／`api/`／`package.json`、未安裝 dependency、未執行
`/speckit-implement`**。

| CHK | 裁決 | 依據 |
|-----|------|------|
| CHK009 | `PASS` | plan.md 新增「十三、Dataset Runtime Anomaly Handling」明確定義 build/test 階段優先攔截、runtime graceful-failure（不得顯示虛構／半有效 phrase、受影響 view 呈現可理解狀態、未受影響功能不受波及）；tasks.md 新增 T045 對應測試責任，並納入 T041 執行清單 |
| CHK032 | `N/A` | SearchBar 為 UI implementation component，不需要獨立 domain contract；search input／empty query／partial matching／result／no-result／dataset-only search 之 observable behavior 已由現有 `searchPhrases` contract（contracts §1）完整覆蓋，未建立新 architecture artifact |
| CHK069 | `N/A` | fixed layout ratios／font-size values 屬 implementation styling 細節，無 Specification 基礎；現有 artifacts（ux-ui-design-handoff.md「Mobile-first」章節、tasks.md T040）已涵蓋 mobile-first、可讀日文、可用觸控目標、無 horizontal scrolling、Play／Favorite 不易誤觸、可見安全提醒與 responsive verification，最終 CSS 數值延續既有 design system 並由 viewport verification 驗證，未新增固定數值 Product Requirement |
| CHK119 | `PASS` | plan.md Testing Strategy §B 新增明確斷言（播放失敗時該卡片文字與收藏按鈕仍可操作、其他句子與 Search／情境瀏覽不受阻斷）；tasks.md T019（既有 Audio／Screen 測試任務）擴充對應斷言描述，未建立新測試架構 |

**結論**：CHK009、CHK032、CHK069、CHK119 全數裁決完成，0 項 FAIL、0 項 GAP。連同先前已確認之 136
項，Feature 004 Implementation Readiness Checklist 現為 **140/140 已裁決**（PASS 138 項＋N/A 2 項，
0 項 `[ ]`），不存在遺留 Gap／Ambiguity／Blocking 項目。

## Tasks 前 Readiness Review：140/140（0 項待確認，0 Blocking）
