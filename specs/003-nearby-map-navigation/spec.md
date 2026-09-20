# Feature Specification: Tokyo Mate 東京通｜Nearby Map & Navigation 探索附近地圖與導航

**Feature Branch**: `003-nearby-map-navigation`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "延伸既有探索附近，讓使用者能透過地圖理解 Nearby search 結果的位置與空間關係，在 map 與 result cards 之間辨識同一個 Selected Place，並在目的地資訊足夠且可靠時，將選定地點交由裝置可用的外部地圖／導航服務繼續處理；Tokyo Mate 本身不提供 App 內路線規劃或逐步導航。"

## Clarifications

### Session 2026-09-20

- Q: 一個 Nearby result 要符合什麼條件，才算具備地圖可呈現的「可靠位置資料」？ → A: 座標存在且非 (0, 0) fallback 值，即視為可靠位置資料；座標缺失或退回 (0, 0) 時，視為缺乏可靠位置資料。
- Q: 使用者選定的 result 要具備哪些資訊，才算符合可啟動「前往此地」的「足夠且可靠目的地資訊」？ → B: 只需具備可靠座標（非 (0, 0) fallback）即可，不檢查地址文字是否為 fallback 預設值。
- Q: 使用者啟動「前往此地」時，Tokyo Mate 應如何進行交接？ → Tokyo Mate 直接嘗試 Google Maps HTTPS handoff；Handoff 之後由瀏覽器、作業系統與 Google Maps 支援的行為繼續處理。Tokyo Mate 不偵測裝置安裝哪些地圖 App、不建立 navigation provider priority chain、不在 Google Maps handoff 失敗後自動切換至第二個 provider、不提供應用內 navigation provider selector，也不保存使用者的 navigation provider preference。
- Q: 使用者點擊「前往此地」時，是否需要 Tokyo Mate 額外跨出確認對話框，還是直接嘗試交接？ → B: 點擊後直接嘗試交接，不額外新增 Tokyo Mate 自訂確認步驟。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 用地圖理解目前位置搜尋出的附近結果 (Priority: P1)

使用者主動選擇使用目前位置，搜尋附近景點、餐飲、購物、便利商店或車站後，除了閱讀既有 result cards，還能透過地圖理解「這些地方在哪裡」與彼此的空間關係。

**Why this priority**: 這是本功能存在的第一個核心理由；沒有地圖理解能力，使用者仍必須自行想像每個 result 的相對位置，Nearby 結果的實用性受限。

**Independent Test**: 測試者以目前位置搜尋出具備可靠位置資料的附近結果，可在不涉及選取或導航的情況下，單純透過地圖確認結果分佈與既有 result cards 一致，即可獨立驗證此價值。

**Acceptance Scenarios**:

1. **Given** 使用者已使用目前位置完成 Nearby 搜尋且結果具備可靠位置資料，**When** 使用者查看搜尋結果，**Then** 可透過地圖理解這些結果的位置。
2. **Given** 地圖上顯示的地點，**When** 與同一次搜尋的 result cards 比對，**Then** 兩者呈現的是同一批結果，不出現任何不屬於本次搜尋的地點。
3. **Given** 使用者在地圖上進行 pan 或 zoom，**When** 操作完成，**Then** 不觸發任何新的 Nearby 搜尋，地圖與既有結果維持不變。
4. **Given** 某個有效 result 缺乏可靠位置資料，**When** 使用者查看地圖，**Then** 系統不得為該 result 猜測或顯示位置，但該 result 仍是既有結果清單中的有效項目。
5. **Given** 使用者完成一次 Nearby 搜尋且成功但回傳 0 筆結果，**When** 使用者查看畫面，**Then** 系統維持既有 Nearby 空狀態呈現與文案，地圖不呈現任何 place marker，Selected Place 維持未選定狀態，且此情境與 Nearby 搜尋失敗、地圖不可用兩種狀態明確不同。

---

### User Story 2 - 選定地點後前往此地 (Priority: P1)

使用者從搜尋結果中選定一個具備足夠且可靠目的地資訊的地點後，可以啟動「前往此地」，由 Tokyo Mate 將該目的地交給使用者裝置上可用的外部地圖／導航服務繼續處理。

**Why this priority**: 這是本功能存在的第二個核心理由；使用者理解位置後，若無法接續行動前往，Nearby 探索仍停留在「知道但去不了」的狀態。

**Independent Test**: 測試者選定一個具備可靠目的地資訊的 result，啟動「前往此地」並確認裝置上的外部地圖／導航服務接手處理，即可獨立驗證此價值，不需要先完成地圖選取流程。

**Acceptance Scenarios**:

1. **Given** 使用者選定的 result 具備足夠且可靠的目的地資訊，**When** 使用者啟動「前往此地」，**Then** Tokyo Mate 直接嘗試將該目的地交由 Google Maps HTTPS handoff 處理，不額外跳出 Tokyo Mate 自訂確認對話框；Handoff 之後由瀏覽器、作業系統與 Google Maps 支援的行為繼續處理，Tokyo Mate 本身不提供 App 內路線規劃或逐步導航，也不建立 navigation provider priority chain。
2. **Given** 使用者選定的 result 目的地資訊不足或不可靠，**When** 使用者查看該 result，**Then** 「前往此地」不可用，且系統不得猜測或虛構目的地資訊。
3. **Given** 「前往此地」在裝置上暫時無法完成交接，**When** 交接失敗，**Then** 系統不得將此失敗呈現為 Nearby 搜尋失敗，且保留目前 Selected Place 與既有搜尋結果。
4. **Given** 使用者沒有目前位置，**When** 使用者對手動地區搜尋出、具備可靠目的地資訊的 result 啟動「前往此地」，**Then** 交接可正常進行，不要求提供目前位置。

---

### User Story 3 - 手動輸入地區也能使用地圖與前往此地 (Priority: P2)

即使沒有目前位置，使用者手動輸入地區完成搜尋後，仍可使用地圖理解結果位置，並對具備可靠目的地資訊的 result 啟動「前往此地」。

**Why this priority**: 手動地區搜尋是既有 Explore Nearby 不依賴定位權限的替代路徑；本功能延伸地圖與導航能力時，不得讓這個既有替代路徑喪失同等能力。

**Independent Test**: 測試者在未授予定位權限的情況下，直接以手動輸入地區完成搜尋，確認可查看地圖並對合格 result 啟動「前往此地」，即可獨立驗證。

**Acceptance Scenarios**:

1. **Given** 使用者未曾使用目前位置，**When** 使用者手動輸入地區並搜尋，**Then** 搜尋、結果呈現與地圖使用均正常運作，不要求目前位置。
2. **Given** 手動地區搜尋結果具備可靠位置資料，**When** 使用者查看地圖，**Then** 地圖呈現與同一次搜尋結果一致。
3. **Given** 手動地區搜尋出具備可靠目的地資訊的 result，**When** 使用者啟動「前往此地」，**Then** 交接正常進行，不因缺少目前位置而被阻擋。

---

### User Story 4 - 定位失敗、地圖不可用或選取來源不同時仍可完成任務 (Priority: P3)

使用者在定位權限被拒絕、取消或無法取得時，可恢復使用手動地區模式；地圖暫時無法載入或使用時，既有 result cards 仍可完成選取與前往此地；不論使用者先從 result 選取或先從地圖選取，都能在另一側辨識出同一個地點；開始新的一次搜尋時，舊的地圖內容或結果不會被誤認為新搜尋的結果。

**Why this priority**: 這些是維持既有 Explore Nearby 可靠度與一致性的必要保護行為，重要但屬於強化既有兩個核心能力（地圖理解、前往此地）的韌性，而非額外的新價值主張。

**Independent Test**: 測試者分別模擬定位被拒絕／取消／無法取得、地圖載入失敗、從地圖開始選取、以及重新開始新搜尋等情境，確認既有結果與選取狀態均未被破壞，即可獨立驗證。

**Acceptance Scenarios**:

1. **Given** 使用者選擇使用目前位置，**When** 定位權限被拒絕、使用者取消或定位無法取得，**Then** 既有搜尋結果不被破壞，且系統恢復為可使用手動地區模式。
2. **Given** 地圖暫時無法載入或無法使用，**When** 使用者查看既有的有效 Nearby 結果，**Then** result cards 仍可讀、可操作，使用者可直接由卡片完成選取，並在合格時啟動「前往此地」。
3. **Given** 使用者先在地圖上選取某個屬於本次搜尋結果的地點，**When** 使用者查看 result cards，**Then** 可辨識出對應同一地點的卡片被標示為目前選定。
4. **Given** 使用者已完成一次搜尋並在地圖或卡片上有目前選定地點，**When** 使用者開始新的一次 Nearby 搜尋，**Then** 舊的地圖內容與舊結果不會被誤認為新搜尋的結果，選定狀態隨新搜尋重新開始。

### Edge Cases

- 使用者尚未在本次搜尋結果中選取任何地點時，不存在任何 Selected Place。
- 多個 result 座標非常接近或重疊時，地圖與 result cards 之間的選取對應仍必須維持一對一、可辨識，不產生混淆或選錯地點；此對應以 `PlaceResult.id` 為準，系統不因此新增 clustering、spiderfy 或第二套選取模型，且此一對一對應規則在地圖從不可用恢復後仍須維持。
- 使用者在地圖上點擊到不屬於本次搜尋結果的地圖底圖內容（例如未被搜尋到的地標）時，不建立新的 Selected Place，也不視為新的搜尋結果。
- Result 具備可靠位置資料，但地圖本身暫時性錯誤或逾時時，不得因此清除或隱藏該 result 既有卡片內容；此暫時性錯誤或逾時可能發生於地圖初次建立／載入期間，或地圖已建立後的使用期間，兩者均適用相同的既有 Map Unavailable recovery；此處「暫時性錯誤或逾時」為系統可觀察到的失敗訊號描述，不設定固定秒數門檻，也不區分 temporary 與 permanent 兩種分類。
- 使用者在「前往此地」交接過程中主動取消（例如取消開啟外部服務的系統對話框）時，維持目前 Selected Place 與既有搜尋結果不變，不視為錯誤或搜尋失敗。
- 使用者尚未選定任何地點就嘗試啟動「前往此地」時，該行動不可用，且不得推測使用者想前往哪一個地點。
- 新一次搜尋已開始但尚未取得結果時，畫面不得繼續呈現上一次搜尋的地圖或結果，讓使用者誤以為是新搜尋已完成。
- 一次 Nearby 搜尋成功完成但回傳 0 筆結果時，不得在地圖上呈現任何 place marker、不得建立或顯示假地點填補空結果、Selected Place 必須維持未選定狀態，也不得繼續呈現上一次搜尋的地圖或結果使使用者誤判為本次搜尋所得；此情境必須能與 Nearby 搜尋失敗、地圖不可用兩種狀態清楚區分。
- 定位失敗、地圖不可用、Navigation handoff 失敗等失敗網域彼此獨立、互不阻斷：地圖不可用不得阻斷既有的有效 result cards 使用，交接失敗不得被呈現為 Nearby 搜尋失敗，定位失敗不得阻止使用者改用手動地區；即使多個失敗同時發生，各自仍維持既有的 recovery 路徑，系統不建立跨網域的全域 failure 優先順序機制。
- 地圖從暫時不可用恢復後，系統必須依目前有效的 Nearby 搜尋結果重新呈現地圖；若目前 Selected Place 仍存在於目前結果中，須維持其在地圖與 result cards 之間的選取對應，不得恢復已屬於上一次搜尋的舊有結果，也不得因地圖恢復而觸發新的 Nearby 搜尋。

## Key Product Concepts *(mandatory)*

<!-- 本節六個概念為本次 Specification 的核心產品邊界，供 Plan / Tasks / Analyze 交叉檢核。 -->

### Selected Place

代表使用者在目前這一次 Nearby search 中，透過 map 或 result card 明確選取、且在兩種呈現方式間維持一致辨識的單一目前選定地點狀態。Selected Place 是 map 與 result cards 之間唯一共用的選取狀態；不存在「地圖選取的地點」與「卡片選取的地點」兩套互不相干的狀態。開始新一次搜尋時，Selected Place 必須重新開始，不得沿用上一次搜尋的選定地點。

### Map Eligibility ≠ Result Validity

地圖能否呈現某個 result 的位置，與該 result 是否為本次 Nearby search 的有效結果，是兩件互不相依的事。一個 result 只要來自本次成功搜尋，即為有效結果，可在 result cards 中完整呈現、選取與（若合格）啟動前往此地；即使它缺乏可靠位置資料而無法在地圖上呈現，也不會因此喪失其有效性。反之，地圖本身暫時無法載入或使用，也不得使原本有效的 result 變成無效或被隱藏。

「可靠位置資料」判定標準：result 的座標存在且非 (0, 0) fallback 值，即視為可靠位置資料；若座標缺失，或因既有資料流程退回 (0, 0) 預設值，即視為缺乏可靠位置資料，不得在地圖上呈現或猜測其位置。

### Navigation Eligibility

「前往此地」是否可對某個 result 啟用，取決於該 result 是否具備足夠且可靠的目的地資訊，而非取決於使用者是否使用了目前位置、是否曾在地圖上選取過它，或搜尋是否來自手動地區。目的地資訊不足或不可靠時，「前往此地」對該 result 不可用；系統不得為了讓「前往此地」可用而猜測、推算或虛構目的地資訊。

「足夠且可靠目的地資訊」判定標準：與 Map Eligibility 採同一套座標可靠性標準，即 result 的座標存在且非 (0, 0) fallback 值時，即視為具備足夠且可靠的目的地資訊，可啟動「前往此地」；不另外要求地址文字非 fallback 值。

### Handoff Failure Recovery

Navigation handoff（Tokyo Mate 直接嘗試將 Selected Place 的目的地交由 Google Maps HTTPS handoff 處理；Tokyo Mate 不偵測裝置安裝哪些地圖 App、不建立 navigation provider priority chain、不在 Google Maps handoff 失敗後自動切換至第二個 provider，也不提供應用內 provider selector 或保存使用者的 provider preference；Handoff 之後由瀏覽器、作業系統與 Google Maps 支援的行為繼續處理）失敗時，屬於「交接失敗」而非「Nearby 搜尋失敗」，兩者必須清楚區分，不得混為一談呈現給使用者。交接失敗後，系統必須保留目前 Selected Place 與既有 Nearby 搜尋結果，並提供使用者可理解的 recovery 狀態（例如顯示「目前無法開啟地圖，請再試一次」等簡短、可理解的提示，此為 UX intent 示例，非固定文案系統），不得因交接失敗而清除既有搜尋狀態。

系統不需辨識或分類交接失敗的成因（例如使用者取消、裝置沒有可用外部地圖服務、瀏覽器阻擋、Google Maps handoff 本身無法完成，或其他環境層原因）；只要 Tokyo Mate 能觀察到交接無法完成，即一律套用同一套 Handoff Failure Recovery，不建立 provider 偵測或第二個 fallback provider。此處「暫時無法完成」係描述一次交接嘗試未成功的可觀察結果，並非以特定秒數門檻判定；系統依實際可觀察的失敗訊號（例如嘗試開啟失敗或例外）處理，不建立 temporary vs permanent 分類器，也不設定固定秒數 timeout 需求。使用者可自行再次啟動「前往此地」重新嘗試；系統不自動重試，也不設定產品層的重試次數上限，不切換第二個 navigation provider。

### Search Transition

使用者開始新一次 Nearby search（不論來自目前位置或手動地區）時，系統必須清楚轉換出「這是新的一次搜尋」的狀態；在新結果就緒之前，舊的地圖內容與舊的 result cards 不得被誤認為屬於新搜尋，也不得將新舊資料混合呈現造成使用者誤判目前結果的來源。

### Map Is Not the Only Interaction Path

地圖是理解結果位置與進行選取的其中一種方式，但不是完成「選取地點」或「啟動前往此地」的唯一路徑。即使使用者從未與地圖互動、或地圖暫時無法載入使用，result cards 本身必須能獨立完成地點選取，並在合格時獨立啟動「前往此地」。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統必須保留既有 Explore Nearby 的目前位置與手動輸入地區兩種入口，以及既有分類與 result cards 呈現內容，不得因加入地圖與導航能力而減少或改變既有可觀察行為。
- **FR-002**: 當一次 Nearby search 成功，且結果具備可靠位置資料時，系統必須讓使用者可以透過地圖理解這些結果的位置。
- **FR-003**: 地圖呈現的地點必須與同一次 Nearby search 的結果完全一致，不得產生第二套獨立搜尋結果；地圖上的 pan 或 zoom 操作本身不得觸發任何新的 Nearby 搜尋。
- **FR-004**: 系統必須維護單一的 Selected Place 狀態，由 map 與既有 result cards 共用；使用者從其中一種呈現方式選取地點後，另一種呈現方式必須能辨識出同一個地點。
- **FR-005**: 手動輸入地區的搜尋、結果呈現與地圖使用，均不得要求或依賴使用者的目前位置。
- **FR-006**: 當定位權限被拒絕、使用者取消，或目前位置無法取得時，系統不得破壞既有的搜尋結果，並必須讓使用者可以恢復使用手動輸入地區模式完成搜尋。
- **FR-007**: 當地圖無法載入或無法使用時，既有的有效 Nearby result cards 必須維持可讀、可操作，使用者必須能單獨透過卡片完成地點選取，不因地圖不可用而被阻斷。「地圖無法載入或無法使用」涵蓋兩種偵測時機：(1) 地圖初次建立／載入期間；或 (2) 地圖已建立後的使用期間；只要 Tokyo Mate 可觀察到地圖載入或執行失敗，導致地圖無法可靠呈現目前 Nearby results，即一律適用本要求與既有 Map Unavailable recovery，不因偵測時機不同而有不同處理方式，也不建立完整 failure cause taxonomy。此處「可操作」係指：既有的有效 result cards 可被閱讀、可被選取，且若該 result 符合 Navigation Eligibility，仍可啟動「前往此地」；本要求不涉及毫秒級效能或 latency 門檻。
- **FR-008**: 有效的 Nearby result 若缺乏可靠的地圖位置資料，系統不得為其猜測或推算位置；該 result 不因此喪失其作為有效搜尋結果的地位，仍必須完整呈現於既有 result cards。
- **FR-009**: 「前往此地」僅能在使用者選定的 result 具備足夠且可靠的目的地資訊時對該 result 可用；資訊不足或不可靠時，「前往此地」對該 result 不可用。
- **FR-010**: 系統不得為了使「前往此地」可用而猜測、推算或虛構目的地資訊；缺乏足夠資訊時必須讓使用者清楚理解該行動目前不可用，而非呈現隱性失敗或錯誤的目的地。
- **FR-011**: 使用者啟動「前往此地」後，系統必須直接嘗試將選定目的地交由 Google Maps HTTPS handoff 處理，不額外新增 Tokyo Mate 自訂確認對話框；Handoff 之後由瀏覽器、作業系統與 Google Maps 支援的行為繼續處理。Tokyo Mate 不負責偵測裝置安裝哪些地圖 App、不建立 navigation provider priority chain、不在 Google Maps handoff 失敗後自動切換至第二個 provider、不提供應用內 navigation provider selector，也不保存使用者的 navigation provider preference；Tokyo Mate 本身不得提供 App 內路線規劃、路線繪製或逐步導航。
- **FR-012**: 「前往此地」不得以目前位置作為前提條件；手動地區搜尋所得、具備可靠目的地資訊的 result，必須與使用目前位置搜尋所得的合格 result 一樣可以啟動「前往此地」。
- **FR-013**: Navigation handoff 失敗時，系統不得將其呈現為 Nearby 搜尋失敗，必須清楚區分「交接失敗」與「搜尋失敗」兩種狀態；系統不需辨識或分類交接失敗的成因（例如使用者取消、裝置沒有可用外部地圖服務、瀏覽器阻擋，或 Google Maps handoff 本身無法完成），只要 Tokyo Mate 能觀察到交接未完成，即一律套用同一套交接失敗處理，不建立 provider 偵測或第二個 fallback provider。
- **FR-014**: Navigation handoff 失敗後，系統必須保留目前的 Selected Place 與既有的 Nearby 搜尋結果，並提供使用者可理解的下一步（例如重新嘗試交接），不得清除既有搜尋狀態；使用者可自行再次啟動「前往此地」重新嘗試，系統不得自動重試，也不得設定產品層級的重試次數上限。
- **FR-015**: 使用者開始新一次 Nearby search 時，系統必須清楚轉換狀態；在新結果就緒之前，不得讓舊的地圖內容或舊的 result cards 被誤認為屬於新搜尋，也不得將新舊資料混合呈現。若本次新的 Nearby 搜尋最終失敗，系統不得將上一次搜尋的地圖內容或結果復原並呈現為本次搜尋的目前結果，必須呈現本次 Nearby 搜尋失敗狀態；使用者可重新搜尋，或視情況改用手動地區，系統不得產生假結果。
- **FR-016**: 地圖不得成為完成地點選取或啟動「前往此地」的唯一路徑；即使使用者從未與地圖互動、或地圖不可用，result cards 本身必須能獨立完成地點選取，並在合格時獨立啟動「前往此地」。
- **FR-017**: 本次擴充不得中斷或改變 Homepage/App Shell、麥克風、即時翻譯、問東京、既有探索附近核心行為、東京百科、緊急協助，以及 Feature 002 拍照翻譯既有的可觀察行為。
- **FR-018**: 本版不得引入地圖 pan/zoom 自動觸發搜尋、位置歷史、背景位置追蹤、即時位置分享、共享行程、社交功能、使用者帳號／登入、我的最愛同步、旅行軌跡紀錄、新的 AI 推薦能力、App 內路線規劃、路線繪製、逐步導航、路況資訊、街景、離線地圖或地圖圖磚預先載入等能力。
- **FR-019**: 當一次 Nearby search 成功完成但回傳 0 筆結果時，系統必須維持既有 Nearby 空狀態呈現與文案；本次搜尋不得在地圖上呈現任何 place marker，Selected Place 必須維持未選定狀態，系統不得建立或顯示假地點以填補空結果，也不得繼續顯示上一次搜尋的地圖或結果使使用者誤以為屬於本次搜尋；此情境必須能與「Nearby 搜尋失敗」及「地圖不可用」兩種狀態清楚區分。

### Key Entities *(include if feature involves data)*

- **Nearby 搜尋結果 (Nearby Result)**: 沿用既有 Explore Nearby 結果，代表一次搜尋回傳的地點；地圖能否呈現其位置與其作為搜尋結果的有效性彼此獨立。
- **Selected Place**: 代表使用者在目前這一次搜尋中，於 map 或 result card 明確選取、並在兩種呈現間保持一致辨識的單一地點狀態；隨新搜尋開始而重置。
- **Nearby 結果地圖呈現 (Map Presentation)**: 代表同一次 Nearby search 結果在地圖上的視覺呈現，僅反映既有結果位置，不代表獨立的第二次搜尋，也不對缺乏可靠位置資料的結果進行推算呈現。
- **目的地資訊 (Navigation Destination)**: 代表使用者選定、供交由外部地圖／導航服務繼續處理的地點目的地資訊；僅在資訊足夠且可靠時存在，不得為猜測產生。
- **Navigation Handoff**: 代表 Tokyo Mate 將 Navigation Destination 轉交給使用者裝置上可用的外部地圖／導航服務繼續處理的一次性動作；其成功與否與 Nearby search 本身或其他結果的有效性無關。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 在保留既有目前位置與手動地區入口的驗收案例中，既有分類與 result cards 欄位 100% 維持可用，未因本次擴充而減少或改變既有可觀察行為。
- **SC-002**: 在至少 5 組具備可靠位置資料的成功 Nearby 搜尋驗收案例中，測試者均可透過地圖理解結果位置，且地圖呈現的地點與同一次搜尋結果完全一致，無新增或缺漏地點。
- **SC-003**: 在地圖 pan 或 zoom 操作的驗收案例中，100% 的操作本身未觸發任何新的 Nearby 搜尋請求。
- **SC-004**: 在至少 3 組「從 result 選取」與 3 組「從 map 選取」的驗收案例中，測試者均能在另一側正確辨識出同一個 Selected Place。
- **SC-005**: 在至少 3 組未使用目前位置、僅以手動輸入地區完成的搜尋驗收案例中，測試者均能完成搜尋、查看結果、使用地圖，並對合格 result 啟動「前往此地」，全程不需要提供或使用目前位置。
- **SC-006**: 在定位權限被拒絕、使用者取消、以及目前位置無法取得各至少 1 組的驗收案例中，既有搜尋結果均未被破壞，且測試者均能成功切換為手動地區模式完成搜尋。
- **SC-007**: 在地圖無法載入或使用的至少 2 組驗收案例中，既有的有效 Nearby result cards 均維持可讀、可操作，測試者均可直接由卡片完成地點選取，並在合格時啟動「前往此地」，不需要任何地圖互動。
- **SC-008**: 在有效 result 缺乏可靠地圖位置資料的至少 2 組驗收案例中，該 result 均未因此從既有結果中消失或被標示為無效，且畫面未顯示任何猜測位置。
- **SC-009**: 在至少 5 組「前往此地」驗收案例中，僅目的地資訊足夠且可靠的 result 顯示並可啟動該行動；所有目的地資訊不足或不可靠的 result 均未顯示或啟用「前往此地」，且無任何猜測目的地的案例。
- **SC-010**: 在至少 2 組模擬 navigation handoff 失敗的驗收案例中，畫面均未將其呈現為 Nearby 搜尋失敗，Selected Place 與既有搜尋結果均維持可用，並提供可理解的下一步，且使用者均可再次啟動「前往此地」重新嘗試；驗收僅需模擬 Tokyo Mate 可觀察到的 handoff 失敗情境，不要求涵蓋每一種作業系統／瀏覽器／外部 App 失敗成因。
- **SC-011**: 在至少 2 組「開始新一次 Nearby 搜尋」的驗收案例中，測試者均不會將舊地圖內容或舊結果誤認為新搜尋的結果。
- **SC-012**: 在涵蓋 Homepage/App Shell、麥克風、即時翻譯、問東京、既有探索附近既有行為、東京百科、緊急協助與 Feature 002 拍照翻譯的既有回歸驗收案例中，100% 保持既有可觀察行為不變。
- **SC-013**: 在至少 2 組「Nearby 搜尋成功但回傳 0 筆結果」的驗收案例中，畫面均維持既有空狀態文案、地圖均呈現 0 個 place marker、Selected Place 均為未選定狀態，未出現任何假地點或前一次搜尋殘留的地圖／結果，且均可與 Nearby 搜尋失敗、地圖不可用兩種狀態明確區分。

## Assumptions

- 地圖呈現與「前往此地」目的地判斷所需的位置資料，沿用既有 Explore Nearby 第三方地點資訊服務所回傳的結果，本功能不新增獨立的位置資料來源。
- 使用者裝置具備至少一種可開啟的外部地圖／導航服務；若裝置完全沒有可用的外部地圖／導航服務，屬於裝置本身限制，不視為 Nearby search 失敗。
- 地圖呈現的資料新鮮度與既有 Nearby search 結果一致，本功能不新增獨立於既有搜尋之外的地圖資料更新機制。
- 精確位置資料的處理範圍與保存原則沿用既有 001 Specification 之隱私與資料保存規則，不因加入地圖與導航能力而放寬。

## Out of Scope

- 重建或取代既有 Explore Nearby 搜尋能力。
- 第二套獨立的 Nearby search 機制。
- 地圖 pan/zoom 自動觸發新搜尋。
- 位置歷史（location history）。
- 背景位置追蹤（background tracking）。
- 即時位置分享（live location sharing）。
- 共享行程（shared itinerary）。
- 社交功能（social features）。
- 使用者帳號／登入（user account / login）。
- 我的最愛同步（favorites sync）。
- 旅行軌跡紀錄（travel trajectory）。
- 新的 AI 推薦能力。
- App 內路線規劃（in-app routing）。
- 路線繪製（route drawing）。
- 逐步導航（turn-by-turn navigation）。
- 路況資訊（traffic）。
- 街景（Street View）。
- 離線地圖（offline map）。
- 地圖圖磚預先載入（tile prefetch）。
