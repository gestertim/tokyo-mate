# Tokyo Mate 東京通｜UX/UI Design Handoff

本文件以已同步完成的 Specification 為 Product Truth，不得新增與 Specification 衝突的產品行為。

## UX 原則

Tokyo Mate 主要用在旅途中時間短、環境吵雜、需要單手操作、可能正在直接與日本人溝通的情境。

介面遵守：
- mobile-first
- action-first
- immediate-use
- one conversation, multiple AI capabilities
- minimum cognitive load
- graceful failure
- privacy by user action

## Home

首頁顯示：
- Tokyo Mate 東京通品牌
- 簡短定位
- 大型通用文字輸入
- 麥克風入口
- 四個主要入口：
  - 即時翻譯
  - 問東京
  - 探索附近
  - 東京百科

首頁不要求登入、不強制 onboarding、不先索取位置或麥克風權限。

輸入 placeholder 可使用：
「想問東京什麼？也可以直接輸入要翻譯的話。」

## Translation Result

中文→日文時，目標日文為主要視覺內容，適合直接向日本店員或當地人展示。

主要 actions：
- 播放
- 慢速
- 更禮貌
- 更口語
- 複製

避免同時顯示大量旅遊說明。

日文→繁中時，主要顯示自然台灣繁體中文及必要播放操作。

## Voice Flow

使用者主動按麥克風後：
錄音 → 顯示「正在聽你說話」 → 停止 → 顯示辨識文字 → 可修正 → 送出 → AI 處理 → 結果 → 播放。

麥克風拒絕：
顯示一般人可理解訊息並提供「改用文字」。

## Ask Tokyo

一般旅遊回答版型：
1. 最推薦
2. 怎麼做
3. 注意
4. 需要時才顯示「你可能會用到的日文」

回答後只提供少量 contextual actions，例如：
- 怎麼去
- 附近美食
- 相關日文
- 本次暫存

不得將「本次暫存」呈現為永久帳號收藏。

## Explore Nearby

初始畫面先顯示：
- 使用我的位置
- 輸入地區

只有點「使用我的位置」後才觸發 browser geolocation permission。

拒絕後：
「沒問題，你也可以直接輸入現在所在的地區。」

附近結果卡片優先：
- 地點名稱
- 為什麼適合
- 地區/距離
- 必要時營業狀態
- 怎麼去

若無法確認最新營業狀態，不顯示確定的「營業中」。

## Tokyo Encyclopedia

第一層分類：
- 區域指南
- 交通
- 餐飲
- 購物
- 文化與禮儀
- 緊急資訊

各區域頁採一致資訊順序：
適合誰 → 特色 → 怎麼逛 → 美食/購物 → 交通 → 建議停留時間 → 注意。

## Live Data States

需要即時資料時顯示：
「正在確認最新資訊…」

狀態必須可區分：
- 查詢中
- 已確認
- 無法確認
- 資料不確定
- 不需要即時資料

失敗文案不可暴露 technical error。

可提供：
- 再試一次
- 查看官方資訊
- 先看一般旅遊建議

## Emergency Mode

版型：
1. 現在先做
2. 接著
3. 可以直接說
4. 重要提醒

隱藏一般景點、美食、娛樂推薦快捷操作。

## Responsive

手機：
- 單欄
- 大型觸控目標
- 重要結果靠上
- 翻譯文字支援給對方看的大字閱讀
- 語音與播放可單手操作

平板：
維持相同核心流程，利用寬度增加閱讀空間。

桌面：
適合行前查詢，但不可改變主要資訊架構與產品邏輯。

## Failure States

至少設計：
- microphone denied
- transcription failed
- AI unavailable
- network unavailable
- geolocation denied
- geolocation failed
- live search failed
- Places unavailable
- uncertain live data

每一個 failure state 都需要：
發生什麼 → 使用者現在可以做什麼。

不得只留下 spinner 或 provider error。
