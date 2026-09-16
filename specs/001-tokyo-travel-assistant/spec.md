# Feature Specification: Tokyo Mate 東京通

**Feature Branch**: `[001-tokyo-travel-assistant]`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "產品名稱：Tokyo Mate 東京通\n\n請以台灣繁體中文建立正式 Specification。本階段只定義 WHAT / WHY、使用情境、產品行為、requirements、acceptance criteria 與 out of scope，不自行更換或加入 Technical Plan。\n\n## Product Vision\n\nTokyo Mate 是專門服務台灣自由行旅客的東京 AI 旅遊助手。\n\n定位：\n「東京在地私人導遊 × 台日雙語口譯員 × 東京旅遊知識顧問」\n\n核心承諾：\n「使用者不需要懂日文，也不需要懂東京，就可以更放心地在東京行動。」\n\n本專案複雜度為 C｜AI-Powered App，因為 Generative AI 是核心產品體驗。\n\n## Core Capability 1：中日雙向 AI 即時口譯\n\n支援文字與語音輸入。\n\n使用者可以輸入或說出台灣繁體中文或日文，不要求每次手動選擇翻譯方向。\n\n系統需要理解：\n- 輸入語言\n- 使用者意圖\n- 旅遊情境\n- 適合的禮貌程度\n\n繁體中文→日文：\n不得只逐字翻譯，應產生日本人在餐廳、飯店、商店、車站、機場、醫療、警察等實際情境自然會使用的日文。\n\n日文→繁體中文：\n使用自然台灣繁體中文，不使用不必要的中國大陸慣用詞。\n\n預設語氣：\n自然、友善、禮貌。\n\n可以依使用者要求調整：\n- 更禮貌\n- 更口語\n\n翻譯結果需要支援：\n- 正常語音播放\n- 慢速播放\n- 更禮貌\n- 更口語\n- 複製\n- 適合直接給對方看的高可讀性目標語言結果\n\n現場口譯模式應保持畫面簡潔，不加入大量無關旅遊資訊。\n\n## Voice Input Requirement\n\n語音流程：\n說話 → 語音辨識 → 顯示辨識文字 → 使用者可修正 → 判斷語言/情境/意圖 → 翻譯或回答 → 文字結果 → 可播放語音。\n\n使用者不需要每次選擇語言方向。\n\n只有使用者主動使用語音功能時才要求麥克風權限。\n\n如果麥克風權限遭拒絕，使用者仍可改用文字完成翻譯與旅遊問答。\n\n## Core Capability 2：東京 AI 私人導遊\n\n使用者可直接詢問東京景點、交通、美食、購物、文化、行程與旅遊情境問題。\n\n系統要理解使用者問題中的：\n- 地點\n- 時間\n- 同行者\n- 偏好\n- 限制\n- 真正意圖\n\n一般旅遊回答優先：\n結論 → 建議/怎麼做 → 注意事項 → 必要時提供實用日文。\n\n避免先產生大量百科式東京背景介紹。\n\n## Core Capability 3：Tokyo Knowledge Assistant\n\n建立東京旅遊結構化 Knowledge Base，至少涵蓋：\n\n### 區域指南\n新宿、澀谷、原宿、表參道、銀座、東京站/丸之內、淺草、上野、秋葉原、池袋、六本木、台場、築地、豐洲、吉祥寺、下北澤、中目黑、惠比壽。\n\n每個區域可包含：\n適合族群、主要特色、景點、美食、購物、交通、建議停留時間、白天/晚上差異、重要注意事項。\n\n### 東京交通\nJR、東京 Metro、都營地下鐵、私鐵、Suica、PASMO、羽田、成田、東京站、新宿站、澀谷站，以及搭乘、轉乘、車票、IC 卡、行李、常見錯誤與省時方法。\n\n### 餐飲\n拉麵、壽司、燒肉、居酒屋、天婦羅、蕎麥麵、烏龍麵、咖啡廳、甜點、早餐，以及點餐、排隊、預約、付款、小費、過敏、素食與常用日文。\n\n### 購物\n藥妝、百貨、電器、精品、日本品牌、動漫、二手店、超市，以及免稅、付款、包裝、退換貨與常用日文。\n\n### 日本文化與禮儀\n電車、排隊、垃圾、溫泉、神社、寺院、餐廳、飯店、小費、公共場所音量等。\n\n### 緊急資訊\n生病、遺失護照、遺失手機、遺失行李、失物招領、警察、醫療、災害、地震等。\n\nKnowledge Assistant 不是只做關鍵字搜尋。需要理解問題中的地點、時間、偏好與意圖，再找出最相關資訊。\n\n## Home Experience\n\n首頁提供四個主要開始入口：\n\n- 🎙 即時翻譯\n- 🗼 問東京\n- 🗺 探索附近\n- 📚 東京百科\n\n首頁同時提供通用文字/語音輸入。\n\n使用者可以直接輸入中文、日文、翻譯需求或東京旅遊問題，不需要先選擇翻譯模式或導遊模式。\n\n四個入口是不同的開始方式，不是四套彼此隔離的 AI 系統。\n\n## Explore Nearby\n\n使用者可以：\n- 主動允許目前位置\n- 或手動輸入地區\n\nApp 啟動時不得立即索取位置。\n\n只有使用者主動選擇「使用我的位置」時才觸發位置權限。\n\n拒絕位置權限後：\n- 不視為產品錯誤\n- 提供手動輸入地區\n- 翻譯、問東京、東京百科仍正常可用\n\n探索附近可回答景點、餐廳、購物、咖啡廳、車站、便利商店等附近需求，並考量地點、時間、偏好、交通便利與安全等條件。\n\n## Live Information\n\n第一版支援即時網路/外部資料查詢。\n\n以下資訊可能需要最新資料：\n營業時間、休館、交通異常、車班、票價、活動、展覽、天氣、訂位、商品價格、店家是否仍營業。\n\n系統必須區分：\n- Knowledge Base 一般資料\n- 已取得的即時資料\n- 無法確認的最新資訊\n\n如果即時搜尋失敗或資料不確定，不得把 Knowledge Base 或模型既有知識冒充為已確認最新資料。\n\n需要讓使用者知道目前狀態，並提供合理下一步，例如重新查詢或查看可靠官方資訊。\n\n## Emergency Experience\n\n護照遺失、手機遺失、生病、受傷、警察協助、地震、災害、失物及其他緊急問題採特殊行動優先回答。\n\n回答優先順序：\n現在先做 → 接著做 → 可以直接使用的日文 → 重要提醒。\n\n緊急模式不顯示一般美食、景點、娛樂等不相關快捷操作。\n\n## Data and Privacy\n\n第一版不建立長期旅遊聊天紀錄。\n\n可以在本次使用期間暫存目前答案或互動狀態，但不承諾永久保存。\n\n不要求建立公開個人資料才能使用核心能力。\n\n位置、語音及對話資料只處理完成當次功能所必要的範圍。\n\n精確位置不得預設永久保存。\n\n## User-Facing Language\n\n主要介面及 AI 回答使用台灣繁體中文。\n\n風格：\n親切、簡潔、可靠、像熟悉東京的朋友但保持專業。\n\n避免：\n中國大陸用語、過度正式、冗長百科回答、機械翻譯、不自然日文。\n\n## Acceptance Criteria\n\n1. 使用者輸入台灣繁體中文旅遊句子，系統能產生符合情境的自然日文。\n2. 使用者輸入日文，系統能產生自然台灣繁體中文。\n3. 使用者不需手動指定翻譯方向。\n4. 翻譯結果可以播放目標語言語音。\n5. 可以要求慢速播放。\n6. 可以調整更禮貌/更口語。\n7. 語音辨識結果對使用者可見且可以修正。\n8. 麥克風拒絕後可以改用文字。\n9. 首頁通用輸入可以直接處理翻譯或東京問題，不要求先選模式。\n10. 東京問題以可採取行動的答案優先。\n11. Knowledge Assistant 能根據意圖檢索區域、交通、餐飲、購物、文化或緊急內容。\n12. 系統能辨識何時需要即時資料。\n13. 即時資料無法確認時，不把舊資料表示成最新事實。\n14. 第一次開啟 App 不主動要求位置。\n15. 使用者主動選擇使用位置時才要求位置權限。\n16. 位置被拒絕後可手動輸入地區。\n17. 緊急問題與一般旅遊問題呈現明顯不同的 action-first 回答順序。\n18. 目標語言翻譯結果具有足夠視覺優先級，適合現場直接展示給對方。\n19. 第一版不建立長期聊天歷史。\n20. 所有主要 user-facing 介面使用台灣繁體中文。\n\n## Out of Scope\n\n第一版不包含：\n帳號/Authentication、社群、公開貼文、旅伴配對、多人共同編輯行程、永久聊天歷史、帳號型永久收藏、廣告、遊戲化排行榜、付款、電商、完整訂房平台、完整餐廳訂位平台、完整地圖替代品、複雜會員制度，以及其他無核心 requirement 理由的功能。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 即時旅遊翻譯與口譯（Priority: P1）

旅客在東京餐廳、車站、商店或醫療場景中，透過文字或語音輸入中文或日文，系統能直接理解語境與意圖，產生自然、適合現場使用的目標語言內容，且讓旅客可檢視、修正與播放語音。

**Why this priority**: 這是產品最核心的使用價值，也是使用者在東京行動時最直接的需求；若翻譯品質不可靠，其他功能價值會被大幅削弱。

**Independent Test**: 可以由一位旅客在餐廳或車站使用中文與日文互相問答，完成一次有效翻譯並播放語音，確認可以在現場使用。

**Acceptance Scenarios**:

1. **Given** 使用者在餐廳說出「我想點一份不辣的牛丼，麻煩幫我點一份」，**When** 系統接收繁體中文語音或文字輸入，**Then** 系統能辨識語言與情境，產出自然、適合餐廳場景的日文，並提供可播放的目標語言語音。
2. **Given** 使用者收到對方說出的日文，**When** 系統偵測出是日文輸入且語境為旅遊場景，**Then** 系統會輸出自然的台灣繁體中文，且不要求使用者手動選擇翻譯方向。
3. **Given** 使用者選擇語音輸入並講完話，**When** 系統完成辨識，**Then** 辨識文字必須顯示給使用者檢視與修改，且修改後可重新進行翻譯或回答。
4. **Given** 使用者要求「更禮貌」或「更口語」，**When** 產生翻譯結果時，**Then** 系統需依據需求調整語氣與禮貌程度。
5. **Given** 使用者拒絕麥克風權限，**When** 他仍需要完成翻譯或旅遊問答，**Then** 系統須允許改用文字輸入且保持完整功能。

---

### User Story 2 - 東京旅遊知識與行動建議（Priority: P1）

旅客在東京旅遊期間可直接問關於景點、交通、餐飲、購物、文化、時間安排與緊急情境的問題，系統會以結論、建議、注意事項與必要日文為主，提供可執行的行動建議，而不先給冗長背景說明。

**Why this priority**: 在旅遊中，使用者最需要的是「下一步該怎麼做」，而非大量百科內容；這是東京 AI 私人導遊的核心價值。

**Independent Test**: 使用者詢問例如「今天晚上澀谷適合兩個人吃什麼、怎麼從新宿到那裡最省時？」可以得到結論、路線建議與注意事項。

**Acceptance Scenarios**:

1. **Given** 使用者問「我今天下午想去淺草和上野，怎麼安排比較省時？」，**When** 系統分析問題中的地點、時間與偏好，**Then** 會給出具體的建議順序、交通方式與注意事項。
2. **Given** 使用者詢問「這裡有沒有適合素食的餐廳？」，**When** 問題包含地點與飲食限制，**Then** 系統會識別飲食限制與所在區域，並提供符合條件的建議與必要用語。
3. **Given** 使用者詢問「新宿站怎麼轉乘最簡單？」，**When** 系統判斷需求屬於交通資訊，**Then** 會先提供實際可執行的轉乘方式，再補充注意事項與必要日文。
4. **Given** 使用者的問題含有地點、時間、族群與限制條件，**When** 需要回答旅遊推薦，**Then** 系統必須綜合這些資訊而非僅做關鍵字搜尋。

---

### User Story 3 - 東京區域探索、即時資訊與緊急處理（Priority: P2）

旅客可利用首頁入口或「探索附近」功能，依照現在位置或手動輸入區域，查詢附近景點、餐廳、購物與交通，以及在需要時獲得即時資訊狀態與緊急應變指引。

**Why this priority**: 探索附近和緊急情況是高價值場景，能提升旅遊安全與現場決策效率，但它們是建立在核心翻譯與知識能力之上的補強體驗。

**Independent Test**: 使用者可以允許位置權限並檢索附近商店或發生護照遺失時，獲得適合緊急指引與下一步行動。

**Acceptance Scenarios**:

1. **Given** 使用者首次開啟 App，**When** 系統啟動時，**Then** 不得立即要求位置權限，並應讓使用者可直接使用主要功能。
2. **Given** 使用者主動選擇「使用我的位置」並授權，**When** 進入探索附近，**Then** 系統可根據地點、時間與偏好提供附近建議。
3. **Given** 使用者拒絕位置權限，**When** 需要使用附近探索，**Then** 系統提供手動輸入地區的替代方案，且其他核心能力不受影響。
4. **Given** 使用者詢問營業時間、車班、活動或店家是否營業等可能變動資訊，**When** 系統需要最新資料，**Then** 它必須辨識為即時資料需求，並明確區分已確認資訊與不確定資訊。
5. **Given** 使用者描述護照遺失、手機遺失、受傷、地震或警察協助等緊急狀況，**When** 系統給出回應，**Then** 會先提供立即行動、接著做什麼、可直接使用的日文與重要提醒，而不是一般旅遊推薦。

---

### Edge Cases

- 當使用者在地鐵站、機場或醫療院所內說話時，系統如何判斷語境並避免產生不自然或過度禮貌的翻譯？
- 當語音辨識結果不準確或含有口語省略時，系統如何保留使用者可修正的機會，而不直接送出錯誤翻譯？
- 當即時資料查詢失敗、資料不一致，或無法確認最新資訊時，系統如何避免誤導使用者並提供下一步？
- 當使用者拒絕位置權限且未提供地區時，系統如何維持主要功能可用並引導使用者手動搜尋？
- 當緊急情況與旅遊問答混合出現在同一對話中時，系統應如何確保先顯示安全優先指引？
- 當使用者在沒有網路或網路不穩定的環境中開啟 App 時，系統如何讓已可用的內容保持可讀，並清楚說明哪些功能需要重新連線？
- 當新版內容或 App 更新可用時，系統如何避免在使用者正在翻譯、查看緊急資訊或展示日文時突然中斷？
- 當使用者從主畫面啟動、瀏覽器分頁啟動或返回已開啟的 App 時，系統如何維持一致的目前狀態與導覽？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統必須支援台灣繁體中文與日文的文字輸入，並在不要求使用者手動選擇方向的情況下自動判斷輸入語言與翻譯方向；語言與文字規範引用 FR-019/FR-020。
- **FR-002**: 系統必須在旅遊情境中產生自然、情境化、符合旅遊場合的翻譯品質，避免僅進行逐字翻譯；語言風格規範引用 FR-019/FR-020。
- **FR-003**: 系統必須提供繁體中文到日文與日文到繁體中文的雙向翻譯能力；中文與日文輸出之語言規範引用 FR-019/FR-020。
- **FR-004**: 系統必須支援語音輸入流程，包括語音辨識、辨識文字顯示、使用者修正、翻譯或回答，以及目標語言語音播放。
- **FR-005**: 系統必須允許使用者要求語音播放速度更慢，並調整更禮貌或更口語的語氣。
- **FR-006**: 系統必須提供複製功能與高可讀性目標語言輸出，以支援現場直接展示給對方。
- **FR-007**: 使用者在麥克風權限拒絕後，仍必須能使用文字輸入完成翻譯與旅遊問答。
- **FR-008**: 系統必須基於地點、時間、同行者、偏好、限制與真正意圖來理解東京旅遊問題，而非僅依賴關鍵字搜尋。
- **FR-009**: 對於一般旅遊問題，系統必須優先以結論、建議/怎麼做、注意事項與必要日文的順序進行回答，避免先給出冗長背景介紹。回答結構至少支援 conclusion（結論）與 action（可採取行動），並依情境支援可選的 caution（注意事項）與 phrase（實用日文）；phrase 為 optional，只有當使用者完成建議行動很可能需要與現場日本人溝通時才顯示（例如飯店櫃台、餐廳、商店、車站、計程車、警察、醫療等），純比較、區域介紹或一般推薦等問題不要求產生日文 phrase。
- **FR-010**: 系統必須提供區域導覽、交通、餐飲、購物、文化與緊急資訊的東京知識檢索能力，覆蓋至少指定區域與核心主題。
- **FR-011**: 系統必須在首頁提供共用輸入入口，讓使用者可直接輸入中文、日文、翻譯需求或東京旅遊問題，而不需要先選擇模式。
- **FR-012**: 系統必須支援「探索附近」功能，讓使用者可依目前位置或手動輸入地區尋找景點、餐廳、購物、咖啡廳、車站與便利商店等需求。
- **FR-013**: 系統必須在首次啟動時不主動要求位置權限，且只有在使用者主動選擇使用我的位置時才要求權限。
- **FR-014**: 當使用者拒絕位置權限時，系統必須提供手動輸入地區的替代方案，且不視為產品錯誤。
- **FR-015**: 系統必須採用唯一的 Freshness 決策維度，包含五個狀態：`not_required`、`live_required`、`verified`、`unavailable`、`uncertain`。
  - 以下情況 MUST 判定為 `live_required` 並觸發即時資料處理：使用者詢問今天/今晚/現在/目前/最新、營業/休館狀態、交通延誤/中斷/臨時異常、車班/時刻、當期票價或費用、天氣、當期活動或展覽、訂位/名額/可用性、商品/服務目前價格、店家目前是否存在或營業。
  - 以下預設判定為 `not_required`（除非使用者明確要求最新）：區域特色、一般交通使用方法、日本一般禮儀、一般點餐方式、常用旅遊日文、歷史文化背景。
  - 狀態與 nextAction 規則：
    - `verified`：只有取得與問題直接相關、足以支持目前回答的外部最新資料才成立；顯示最新結果並明確標示最新查詢資訊。不可因搜尋成功返回任意結果就視為 `verified`。
    - `unavailable`：查詢/provider 失敗或沒有取得可用資料；明確說目前無法確認，提供重新查詢、官方資訊或一般非即時建議。
    - `uncertain`：取得部分資料，但來源衝突、時間性不足、內容不足或仍無法可靠確認；明確說資訊不夠確定，說明不確定性，並提供官方確認或替代方案。
  Live-data 回應至少支援 liveDataStatus、message 與 nextAction。
- **FR-016**: 系統必須採用獨立的 Safety 決策維度（`normal`、`emergency`）。Safety 與 Freshness 為兩個獨立維度且可同時成立（例如護照遺失為 `emergency` + `live_required`；JR 班次延誤為 `normal` + `live_required`；不得將兩者合併為單一模式）。在 Safety 為 `emergency` 情境中，系統必須優先產出緊急指引結構，至少支援 `immediateAction`（現在先做）、`nextAction`（接著行動），以及可選的 `phrase`（現場溝通日文，僅在現場需要與人溝通時顯示）與 `importantNotice`（重要提醒/官方聯絡管道），且不顯示不相關的旅遊快捷操作。當為 `emergency` + `live_required` 時，系統不得等待 live lookup 完成才顯示安全行動，必須先呈現 `immediateAction`（現在先做）與 `nextAction`（接著行動），再補充即時資料查詢結果。
- **FR-017**: 系統第一版不建立長期旅遊聊天紀錄。允許暫存的 user interaction state（包含當前輸入 current input、當前 AI 回答 current AI answer、當前翻譯 current translation、本次暫存答案與 temporary UI / permission state）僅為目前執行階段的暫時狀態，不建立長期持久化，頁面 reload 或 App process 結束後即可消失。預設不得將這些 user interaction data 寫入 LocalStorage、IndexedDB、Cache Storage 或任何應用程式資料庫。詳細 Interaction／Permission／Network 狀態機與暫存資料範圍定義於下方「Session UI State Contract」。
- **FR-018**: 系統必須限制位置、語音與對話資料的處理範圍為完成當次功能所必要的最小範圍；精確位置資訊不得持久化至 LocalStorage、IndexedDB、Cache Storage 或伺服端資料庫。
- **FR-019**: 作為 Language Quality Contract 的 canonical source。所有主要 user-facing UI 與 AI 回答使用自然台灣繁體中文，維持友善、簡潔、可靠的語氣；繁體中文到日文的結果必須符合自然、適合實際日本旅遊情境的自然語氣與禮貌程度。本需求專注於整體介面與回答的語言風格與溝通語氣。
  - **Tone QA（可驗證規則）**：
    - `default`、`polite`、`casual` 三種語氣對同一輸入，核心語意與資訊內容必須保持一致，不得改變使用者原始意圖。
    - `default`：呈現一般旅遊情境可直接使用的自然禮貌語氣。
    - `polite`（更禮貌）：在 `default` 基礎上提升禮貌／敬語程度，但不得改變原始意圖或增減資訊。
    - `casual`（更口語）：可使用較口語化表達，但仍須保持基本禮貌，不得產生粗魯或命令式語氣。
    - 日文→繁體中文輸出一律使用自然台灣繁體中文語氣，並依 FR-020 之詞彙規範。
    - Tone QA fixture 至少涵蓋餐廳、飯店、購物、交通四類情境，每類至少 2 組案例（合計至少 8 組），用以驗證上述語氣規則與語意一致性；驗證結果須產出可審查之驗證證據，不建立複雜 linguistic scoring engine。
- **FR-020**: 系統必須以代表性台灣繁中詞彙進行內容與介面 QA 及一致性檢查，避免不必要的中國大陸慣用詞，至少包含以下 QA fixture：「計程車」（不使用「出租車」）、「飯店」（不以「酒店」作一般住宿用語）、「行動電源」（不使用「充電寶」）、「便利商店」（不使用「便利店」）、「網路」（不使用「網絡」）；本需求專注於詞彙 QA 與一致性檢驗，不建立大型語言規則 engine，且與 FR-019 職責劃分明確。
- **FR-021**: Tokyo Mate v1 MUST 提供支援平台所需的 installable Web App manifest、icons 與 standalone launch experience。
- **FR-022**: 完成至少一次線上載入後，在沒有網路時 MUST 能重新啟動 App Shell，並閱讀批准離線使用的靜態 Tokyo Knowledge Base。
- **FR-023**: Generative AI、Speech-to-Text、Text-to-Speech、web search、第三方地點資訊服務 與其他需要 server/external service 的能力不承諾離線執行。離線使用這些功能時 MUST 顯示清楚的「需要網路」狀態與恢復方式，不得假裝成功。
- **FR-024**: Service worker / App 更新不得在沒有適當處理的情況下強制中斷使用者目前任務。新版本可以提示稍後更新或在安全時機套用。
- **FR-025**: installed standalone App 在批准的手機 viewport、方向與 safe area 下 MUST 維持主要 controls 與內容可操作。Acceptance baseline 為以下代表性 viewport matrix，並不代表產品只支援這些尺寸：
	- 360 × 800：小型手機直向
	- 390 × 844：一般手機直向
	- 430 × 932：大型手機直向
	- 844 × 390：一般手機橫向
	每個測試情境 MUST 驗證 top safe area 不遮擋重要內容、bottom safe area 不遮擋主要 input/mic/CTA、軟體鍵盤顯示時主要輸入仍可操作、主要翻譯內容無水平捲動、主要 touch targets 不重疊，以及 installed standalone 模式可正常操作。
- **FR-026**: PWA Cache Storage 僅允許持久化批准的公共靜態 App assets 與離線 static Knowledge Base。嚴禁將聊天內容、翻譯結果、使用者語音 blob、transcription、TTS audio、精確位置、Places 個人情境結果、即時 web search/API response 或 credentials/secrets 寫入 Cache Storage、LocalStorage 或 IndexedDB。

### Key Entities *(include if feature involves data)*

- **決策狀態 (Decision State)**: 包含兩個獨立維度：
  - **Safety**: `normal` | `emergency`
  - **Freshness**: `not_required` | `live_required` | `verified` | `unavailable` | `uncertain`
  兩者互相正交且可同時成立（例如護照遺失為 emergency + live_required）。
- **使用者旅遊情境**: 代表正在東京旅遊中的使用者，包含當前語言、需求類型、地點、時間、同行者、偏好與限制等上下文資訊。
- **翻譯請求**: 代表一次文字或語音輸入，包含來源語言、目標語言、語境、使用者意圖、禮貌程度與是否需要播放語音。
- **東京知識項目**: 代表東京區域、交通、餐飲、購物、文化與緊急資訊中可檢索的結構化資訊，包含地點、適合族群、注意事項與實用日文。
- **即時資訊快照**: 代表外部資料查詢結果，包含資訊來源、查詢時間、Freshness 狀態（verified/uncertain/unavailable）與後續建議。
- **緊急事件**: 代表護照、手機、健康、失物、警察、災害或地震等高優先級需求，與需要優先處理的動作順序相關。
- **附近探索條件**: 代表使用者選擇的位置、搜尋區域、時間、偏好與安全性條件，供附近景點與服務建議使用。

## Session UI State Contract

本節定義使用者互動、權限請求與網路狀態之標準狀態機，以及本次 session 暫存資料範圍，作為 FR-017、FR-018、FR-026 與 SC-009 之驗證依據；不引入長期儲存或新技術架構。

### Interaction 狀態

`idle → typing → recording → transcribed → submitting → success ｜ error`

- **idle**：等待使用者輸入。
- **typing**：使用者正在輸入文字。
- **recording**：使用者正在使用語音輸入。
- **transcribed**：語音已轉換為可編輯文字，等待使用者確認或修改後再送出。
- **submitting**：已送出翻譯或旅遊問答請求，等待 AI／伺服端回應。
- **success**：已取得可呈現結果（翻譯、旅遊回答、緊急指引或即時資料狀態）。
- **error**：請求失敗或逾時，須顯示可行動之錯誤說明與重試選項。

### Permission 狀態（麥克風、位置各自獨立追蹤）

`unknown → requesting → granted`
或
`unknown → requesting → denied → manual_fallback`

- 僅在使用者主動觸發語音輸入或「使用我的位置」時，才從 `unknown` 進入 `requesting`。
- `denied` 後必須進入 `manual_fallback`（改用文字輸入，或手動輸入地區），且不得阻斷其他核心功能。

### Network 狀態

`online ｜ offline`

- **offline** 時：
  - 靜態 Tokyo Knowledge Base（東京百科／區域、交通、餐飲、購物、文化、緊急資訊）內容仍可讀取瀏覽。
  - AI 回答、語音辨識／合成與 Nearby Explorer（Places）等需伺服端／外部服務之功能，必須顯示「需要網路」狀態與可執行的下一步，不得假裝成功或無限等待。
  - 使用者目前輸入（current input）必須被保留，不得因離線而清空。
  - 網路恢復後，使用者可重新送出（retry）先前操作，不需重新輸入。

### Temporary Session Data（僅為當次執行階段的暫時狀態，不建立長期持久化）

- 當前輸入（current input）
- 當前 AI 回答（current answer）
- 當前翻譯（current translation）
- 本次暫存答案（temporary saved answer，僅限當次 session，非長期收藏）
- 暫時的位置／地區情境（temporary location context，僅限當次 session 使用，不持久化精確座標）

以上資料於頁面 reload 或 App process 結束後即消失，不得寫入 LocalStorage、IndexedDB、Cache Storage 或任何應用程式資料庫，與 FR-017、FR-018、FR-026 一致；不建立長期聊天紀錄。

## Naming Glossary

為避免命名歧異，spec.md、plan.md、tasks.md 與相關驗收文件統一使用以下命名：

| 名稱 | 類型 | 定義 |
|---|---|---|
| Translator | 產品能力 | 即時翻譯能力（對應 Core Capability 1：中日雙向 AI 即時口譯） |
| Tokyo Guide | 產品能力 | 東京 AI 導遊能力（對應 Core Capability 2：東京 AI 私人導遊，action-first 旅遊問答與建議） |
| Tokyo Knowledge Assistant | 產品能力 | AI 知識能力（對應 Core Capability 3：理解問題後從 Tokyo Knowledge Base 檢索並整合回答，而非單純關鍵字搜尋） |
| 東京百科 | user-facing UI 入口 | 首頁四大入口之一，讓使用者瀏覽 Tokyo Knowledge Base 結構化內容的畫面入口 |
| Tokyo Knowledge Base | 底層結構化資料 | 支援東京百科與 Tokyo Knowledge Assistant 之結構化靜態知識資料（涵蓋區域、交通、餐飲、購物、文化、緊急資訊），為兩者共用之資料來源 |
| Nearby Explorer | 產品能力 | 附近探索能力（首頁「探索附近」入口，依定位或手動地區搜尋周邊景點／餐飲／購物／交通） |
| Emergency Answer | 產品能力／呈現 | 緊急結果呈現（Safety = `emergency` 時 immediateAction／nextAction 優先指引卡片） |

以上名稱在後續文件與驗收內容中應保持一致引用，不另創同義詞。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 測試者依序完成「從首頁輸入中文或日文旅遊句子」、「送出」、「檢視翻譯結果」、「複製或播放結果」四個使用者操作步驟，即可完成一次中文與日文互轉；流程不需手動選擇翻譯方向。
- **SC-002**: 依正式化固定驗收流程與 artifact 量測端到端 latency：
  - **測試 dataset**：固定可重複測試案例集合（至少 30 組）
  - **驗收結果輸出**：可審查之驗證證據，記錄 date、environment、commit、case id、category、latency milliseconds、pass/fail、p50、p95、maximum、failed/outlier cases
  - **測試環境**：production-like environment，並可重複驗證
  - **網路條件**：正常穩定網路
  - **樣本數**：至少 30 次代表性互動
  - **樣本涵蓋**：中文→日文翻譯、日文→中文翻譯、一般東京旅遊問答
  - **latency 起點**：client 提交 request
  - **latency 終點**：主要答案內容已 render 且使用者可見
  - **latency 定義**：為 end-to-end latency，包含 client 處理、網路傳輸、server function、AI provider、response parsing 與 UI render，但不包含使用者輸入時間
  - **Final MVP performance baseline**：完整 Generative AI response latency 的 p50、p95、maximum 與 outliers MUST 如實記錄為 Final MVP performance baseline；p95 <= 5.0 秒不是 MVP blocking acceptance criterion。每次回應均可被檢視為可直接用於現場對話、詢問或說明的結果或明確失敗狀態
  - **percentile convention**：使用 nearest-rank；N = 32 時，p95 為排序後 latency value #31
  - **排除基準**：web search、即時地點資訊查詢、語音轉錄 (STT) 與語音合成 (TTS) 不納入完整 response latency baseline，其耗時另外記錄
  - **視覺回饋（blocking）**：任何預期超過 1 秒的等待必須在 1 秒內顯示明確 processing/loading 狀態；此 processing/loading <= 1 second 為 blocking acceptance criterion。不得新增 Analytics/APM platform 或改變既有架構
- **SC-003**: 對一般東京旅遊問題，AI 成功回答後 MUST 滿足以下首屏主要內容順序：
	1. 第一個主要內容區塊 MUST 為「最推薦」或等效的直接結論（conclusion）。
	2. 第二個主要內容區塊 MUST 為「怎麼做」或等效的可採取行動（action）。
	3. 「注意事項」（caution）若存在，必須位於上述兩個區塊之後。
	4. 「實用日文」（phrase）僅在對現場行動有幫助時顯示，不強制所有旅遊問答皆產生日文。
	5. 使用者不得需要點擊展開或切換第二畫面，才能看到主要結論與第一個可採取行動。
	6. 驗收至少包含區域選擇、交通、美食與雨天活動代表性案例。
- **SC-004**: 依 quickstart Journey 5，輸入護照遺失、受傷或災害等 emergency 情境後，首屏必須先顯示「現在先做」（immediateAction）與正式求助方向，再顯示後續步驟（nextAction）、可選的必要日文與重要提醒（importantNotice）；一般景點、餐飲與購物推薦不得出現在 emergency 首屏優先區域。
- **SC-005**: 位置權限被拒絕時，至少仍可使用手動輸入地區與全部非定位核心功能，且不被視為系統失敗。
- **SC-006**: 使用者在高價值即時資料不確定時，能清楚辨識資訊狀態（Freshness）並收到合理下一步建議，而不誤判為已確認最新事實。
- **SC-007**: 首次啟動時不主動要求位置權限，且使用者可直接使用核心旅遊功能。
- **SC-008**: 主要 user-facing 介面與回應在可見範圍中均使用台灣繁體中文，且語氣符合親切且專業的旅遊顧問風格。驗證方式包含 FR-019 Tone QA fixture（餐廳／飯店／購物／交通各至少 2 案例）之 `default`／`polite`／`casual` 語意一致性與禮貌程度檢查，以及 FR-020 台灣繁中詞彙 QA fixture 檢查，並產出可審查之驗證證據。
- **SC-009**: 完成代表性互動流程後進行驗收檢查，驗證 LocalStorage、IndexedDB 與 Cache Storage 中完全不包含聊天內容、翻譯結果、精確位置或語音資料；第一版產品不建立長期聊天歷史，且僅存在於當次執行階段的暫時狀態，不建立長期持久化，頁面 reload 或 App process 結束後可消失。
- **SC-010**: 在支援 PWA installability 的 browser/platform 上，可安裝並以 standalone App 啟動。
- **SC-011**: 完成首次線上載入後，模擬 offline 並重新開啟 App，App Shell 與批准的靜態 Knowledge Base 仍可讀取。
- **SC-012**: offline 狀態嘗試 AI/Speech/Places/live-data 功能時，不出現無限 loading 或 raw network error，而是顯示需要網路與重試行動；網路恢復後可再次使用。
- **SC-013**: 偵測新版本時不得無提示強制 reload 中斷目前任務。
- **SC-014**: 在 FR-025 定義的 acceptance baseline viewport matrix（360 × 800 小型手機直向、390 × 844 一般手機直向、430 × 932 大型手機直向、844 × 390 一般手機橫向）中，installed standalone App 的主要 controls 與內容不被裁切並可正常操作；此 matrix 不限制其他支援尺寸。每個測試情境均須確認 top/bottom safe area 不遮擋重要內容與主要 input/mic/CTA、軟體鍵盤顯示時主要輸入仍可操作、主要翻譯內容無水平捲動、主要 touch targets 不重疊，且 standalone 模式可完成操作。

## Assumptions

- 使用者主要是在東京旅遊期間需要即時溝通、資訊查詢與行動建議，且大多數情境都集中在手機使用場景。
- 系統將以台灣繁體中文作為主要顯示語言與回應語言，並在必要時提供自然、可直接對話的日文。
- 旅遊知識資料將以區域與主題為核心，並以一般旅遊需求優先，而非以完整城市資訊庫為目標。
- 即時資訊查詢僅在關鍵資料可能變動時才需要，並必須清楚區分已確認與未確認狀態。
- 東京第一版僅在高價值旅遊場景中整合動態資料來源（例如營業時間、車班、活動狀態與店家異動），其餘內容維持穩定知識庫；當資料無法確認時，系統必須明確標示不確定性。
- 使用者可能在不同情境中需要不同語氣，從更禮貌到更口語都應可調整，但預設值維持自然且友善。
- 產品 v1 不要求使用者建立帳號或公開個人資料，以維持低門檻與最小資料處理原則。
- PWA 的離線能力以「可啟動、可瀏覽已批准的靜態 Tokyo Knowledge Base、可理解地回報限制」為目標，不承諾離線執行 AI、語音、外部地點搜尋或即時資料查詢；不新增離線 AI/語音模型、聊天資料庫、背景同步、推播或未批准的 user-data persistence。
- 安裝提示是否由瀏覽器顯示、可用的背景更新能力與部分平台行為，會依瀏覽器與作業系統支援程度而不同；不支援安裝的環境仍須保留完整 Web 使用路徑。

## Clarifications

### Session 2026-09-12

- Q: 東京第一版是否需要整合真實的即時動態資料來源，例如營業時間、車班、活動狀態與店家異動，來支援現場判斷？ → A: 只在高價值場景整合動態資料，並明確標示不確定資訊。

## Out of Scope

- 帳號/Authentication 與個人化會員系統
- 社群、公開貼文、旅伴配對與共同協作旅遊規劃
- 永久聊天歷史、帳號型永久收藏與長期旅行資料庫
- 廣告、遊戲化排行榜與其他商業化互動功能
- 付款、電商、完整訂房平台與完整餐廳訂位平台
- 完整地圖替代品與高度複雜的路徑規劃系統
- 離線執行生成式 AI、語音辨識、語音合成、即時資料查詢或第三方地點搜尋
- 跨裝置同步離線資料、永久收藏、背景定位與背景錄音
- 任何無法直接證明為核心旅遊需求的額外功能

## Specification Quality Checklist

### Result Summary

The specification was reviewed against the quality checklist and all required items passed.

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified
- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

### Validation Notes

- The specification aligns with the Product Vision, user journeys, privacy constraints, and emergency-first behavior described in the project constitution.
- The user-facing content is written in Taiwan Traditional Chinese and focuses on what the product must do and why, without specifying implementation details.
- Scope is explicitly bounded to v1 travel assistance behaviors and excludes unrelated platform features.
- No unresolved clarification markers remain; all critical assumptions are documented in the Assumptions section.
