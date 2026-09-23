# Tokyo Mate 東京通｜004 旅遊日文 Travel Japanese UX/UI Design Handoff

本文件以已批准的 `specs/004-travel-japanese-phrases/spec.md` 為 Product Truth，以
[plan.md](./plan.md) 為 Technical Truth。任何與 Specification 或 Plan 衝突的內容一律以該二者為準；
本文件不重新設計產品、不新增 requirement、不修改 Spec Kit 本體，僅整理目前已批准的 UX/UI 決策，供
`/speckit-tasks` 與 `/speckit-implement` 階段參考。本文件不假設任何官方 Spec Kit command 會自動讀取
此檔案。

所有會影響產品行為的 requirement 已存在於 `spec.md`；本文件僅為 UX/UI reference，不構成
implementation 授權（Constitution XI. Authorization Boundary）。

**Maintenance Amendment（2026-09-21，Documentation-Only）**：「Audio（語音播放）」章節已依成人教育者
批准之 Maintenance Technical Direction 更新為三層 fallback 敘述（App-bundled 音檔 Primary → 瀏覽器原生
`SpeechSynthesis` Fallback → 日文文字 Final fallback），並新增「PWA Update UX」章節；其餘章節未變更。
本次更新不新增 `spec.md` 之外的產品行為，不承諾「安裝 PWA 後所有 108 句第一次離線使用時皆可播放」。

## 核心體驗

旅行情境 → 快速找到一句 → 看繁體中文確認意思 → 看日文 → 必要時播放。

此流程對應 spec.md User Story 1、2（P1）與 User Story 3、4、5（P2），為 Phrase Card、情境瀏覽、搜尋、
收藏、語音播放共同服務的單一核心體驗，各項功能皆圍繞此流程展開，不新增與此流程無關的次要體驗。

## 主要 Views

- **Travel Japanese home**：Search、7 個情境（含 Help & Emergency）、我的常用句。
- **Category phrase list**：單一情境下的 Phrase Card 清單（`emergency` 情境另含 Safety Reminder）。
- **Search results**：與 Category phrase list 共用 Phrase Card 呈現與互動方式。
- **Favorites（我的常用句）**：已收藏 Phrase Card 清單，含空狀態。

不新增第 5 個 view，亦不新增任何 phrase 專屬的 detail page（見下方「Phrase Card」與「不新增 detail
page」）。

## 首頁（Travel Japanese Home）

- Search（可理解 label 的搜尋輸入）。
- 7 個情境入口（機場、飯店、餐廳點餐、購物、交通、求助／緊急狀況、日常溝通）。
- 「我的常用句」入口。
- Help & Emergency（求助／緊急狀況）為 spec.md 定義的 7 個正式旅行情境之一，與其他 6 個情境並列於
  情境清單中，採相同的原生 `<button>` 互動模式，不採用需要額外確認才能點擊的樣式。
- Help & Emergency 入口本身 MUST 清楚、容易辨識、容易操作，與其他 6 個情境入口具有相同的可辨識標準
  （例如清楚的文字標籤與可點擊區域），但本 handoff 不額外要求該入口的 category card 比其他 6 個情境
  具有更高的版面位置或視覺權重。
- 進入 Help & Emergency 情境後，safety-critical phrase 的資訊優先級與呈現方式（例如排列順序、辨識度）
  依 spec.md FR-025～FR-028、FR-035 落實，見下方「Safety」章節；此優先權僅適用於情境內容呈現，不回推
  至首頁入口本身的視覺權重。
- 安全提醒（Safety Reminder）MUST 明確可見的要求依 spec.md FR-035 落實，見下方「Safety」章節。

此首頁作為既有 App 導覽結構中的第 6 個功能入口，比照既有 5 個入口（`nav[aria-label="東京功能入口"]`）
之呈現與互動方式，不重新設計既有首頁版面（見 plan.md §0.2 / §Regression 保護）。

## Phrase Card

固定顯示以下四項，不因所在 view（情境清單／搜尋結果／我的常用句）而有欄位差異：

- 日文（`lang="ja"`）
- 繁體中文
- Play（播放語音）
- Favorite（收藏／取消收藏）

**不新增 detail page**：使用者可直接在卡片上完成查看、播放、收藏，不需要點擊進入額外的句子詳細頁面
（對應 spec FR-017，並延伸適用於情境瀏覽與收藏清單，非僅搜尋結果）。

## Audio（語音播放，Maintenance Amendment 更新，2026-09-21）

**Formal Production Approval（2026-09-23）**：

- Provider：`VOICEVOX Nemo`
- Voice：男声1（ノーマル）／CV レナード・ジン
- Fixed parameters：Speed 0.80、Pitch 0.00、Intonation 1.00、Volume 1.00、Pause length 1.00、
  Start silence 0.10、End silence 0.10
- Master：WAV；App delivery：MP3
- Runtime architecture：static MP3 Primary → `SpeechSynthesis` fallback → text fallback
- Runtime MUST NOT depend on：VOICEVOX / Nemo engine、OpenAI TTS、Cloud TTS API、API key
- 108 unique phrases 全量人工聽檢，OpenAI 不作為正式 production provider
- 正式公開／merge 前，必須依 VOICEVOX Nemo 官方規約加入可見 attribution

**播放流程（三層 fallback）**：

使用者按播放 → `requested`（含優先嘗試 bundled audio 載入）→ 優先嘗試 App-bundled 日文音檔 → 成功則
`playing` → bundled audio 失敗時自動嘗試瀏覽器原生 `SpeechSynthesis` fallback → fallback 也成功則
`playing` → fallback 也失敗則 `failed` → 日文文字（`lang="ja"`）與繁中翻譯始終可閱讀與展示，不因語音
失敗而不可見。

- 狀態：`idle`／`playing`／`failed`（另有內部 `requested` 過渡狀態，涵蓋 bundled asset 載入中，使用者
  可理解為「已要求播放」）。
- 同一時間僅一個 active playback；新播放請求取代舊播放（不論舊播放處於 bundled 或 fallback 層）。
- 播放失敗（`failed`）不影響：該卡片文字、繁中翻譯、收藏按鈕、搜尋、分類瀏覽、其他句子的播放；不得因
  單一句子播放失敗而整卡或整頁 disabled。
- **若第一次 bundled audio 尚未被裝置 runtime-cache 且使用者處於離線狀態**：不承諾「一定可播放」；可嘗試
  `SpeechSynthesis` fallback，若仍不可用則進入 `failed`，日文文字仍保持可讀與可展示。
- **不要求**使用者進入手機系統設定安裝 voice／語音套件；**不顯示**任何品牌或裝置特定的安裝指示；語音
  失敗**不阻塞**整個 App 的其餘功能。
- 語音技術方案（App-bundled MP3 為 Primary、瀏覽器原生 `SpeechSynthesis` 為 Fallback、日文文字為 Final
  fallback）與其 Escalation Gate 條件，見 [plan.md](./plan.md)「九、Audio Strategy Escalation Gate」，
  本文件不重複定義技術層級細節（例如 timeout 數值、cache namespace）。

## PWA Update UX

維持現有非阻塞 update notification：偵測到新版本時，以既有 `UpdatePrompt` 呈現不阻擋操作的提示，
不強制中斷使用者當下操作。使用者需明確按下「立即更新」後，才會啟動 waiting worker 的
`SKIP_WAITING` 與後續 `controllerchange` reload；**不**改為使用者未操作時自動 reload。App 從背景回到
前景時可能更即時偵測到新版本（見 [plan.md](./plan.md)「十四、PWA Update Reliability」），但呈現方式
與使用者互動流程不變，仍以同一個非阻塞 `UpdatePrompt` 呈現。

## Search（搜尋）

- 支援繁體中文關鍵字、日文關鍵字、部分關鍵字（partial keyword）。
- 無符合結果時顯示可理解的空白狀態（no-result empty state）。
- 尚未輸入任何關鍵字時（搜尋輸入為空字串），畫面呈現與「已輸入但無符合結果」不同的中性提示狀態
  （例如「輸入繁中或日文關鍵字以搜尋」），避免使用者在尚未輸入前就誤以為 App 已判定「沒有結果」。
- 不生成 dataset 之外的新 phrase 或新翻譯；搜尋結果一律來自正式 dataset。

## Favorites（我的常用句）

- 可收藏／取消收藏任一正式句子。
- 尚未收藏任何句子時顯示可理解的空白狀態，並提供回到情境瀏覽或搜尋的方式。
- 同一 phrase 跨多個情境或搜尋結果收藏時，收藏狀態一致呈現（multi-category favorite consistency），
  不因所在 view 不同而出現各自獨立的收藏副本。

## Safety（求助／緊急狀況安全呈現）

- Safety-critical phrase（警察／救護車／要求對方停止／身體不舒服／遺失重要物品／醫院或警察或藥局）於
  `emergency` 情境中具較高資訊優先級，不被一般內容淹沒。
- 安全提醒（Safety Reminder）MUST 明確可見：直接呈現於 `emergency` 情境句子清單上方，不得包在需額外
  點擊才展開的區塊、不得僅存在於「更多資訊」或 README 之類的說明文件、不得僅有 accessibility-only 而
  視覺隱藏。
- 安全提醒 MUST NOT 成為 blocking UX：不得是 blocking modal、不得要求 mandatory confirmation、不得
  要求 checkbox acknowledgement、不得每次進入該情境都強迫再次確認、不得阻擋或延遲使用者先看到或播放
  緊急 phrase。完整條件與例外流程見 [plan.md](./plan.md) 「十、Safety Reminder Escalation
  Constraint」。
- 不以顏色作為 safety-critical 辨識或安全提醒呈現的唯一依據；需搭配可讀文字（圖示僅為輔助）。

## Mobile-first

- 單手操作：主要 action（Play、Favorite、情境切換）需可在單手持機、拇指觸及範圍內操作，不要求雙手或
  精細操作。
- Touch target：Play、Favorite 等可互動元素之觸控區域需足以避免誤觸相鄰元素（不因兩者相鄰而共用單一
  觸控熱區）；不引入新增 CSS framework 達成此要求，沿用既有元件與樣式慣例。
- 日文文字清楚可讀：日文為 Phrase Card 的主要閱讀資訊，字級與行距需確保可直接展示給日本人閱讀。
- 不需要 horizontal scrolling：情境清單、Phrase Card 清單、搜尋結果、我的常用句於行動裝置寬度下皆不
  產生水平捲動，內容需在垂直方向自然換行或堆疊呈現。
- Play／Favorite 不易誤觸：兩者需有可辨識的視覺區隔與足夠間距，避免使用者原意收藏卻誤觸播放（或反之）。

## Accessibility

- 日文文字節點具 `lang="ja"` 語意標記。
- 收藏按鈕具可辨識的 accessible state（`aria-pressed`）與可理解的 accessible name。
- 播放狀態以文字＋語意標記（例如 `aria-live`）呈現，非純顏色。
- Focus-visible：沿用既有全域樣式，不新增 CSS framework。
- Keyboard 支援：情境切換、Play、Favorite、搜尋輸入皆使用原生可鍵盤操作元素（`<button>`／`<input>`），
  不需額外自訂 keyboard handler。
- 安全提醒使用語義化標記（例如 `role="note"` 或等效可被 assistive technology 辨識的結構）。
- 不以顏色作為任何狀態（播放狀態、收藏狀態、safety-critical 標示）辨識的唯一依據。

## 與 Spec / Plan 的關係

- 本文件不新增 `spec.md` 之外的產品行為；若本文件與 `spec.md` 或 `plan.md` 有任何實質衝突，須 STOP
  並透過正式 artifact 更新流程解決，不得由本文件默默覆寫。
- 本文件不構成 `/speckit-tasks` 或 `/speckit-implement` 授權。
