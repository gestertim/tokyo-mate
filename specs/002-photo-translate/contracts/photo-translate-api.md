# Contract: Photo Translate API (`POST /api/photo-translate`)

**Feature Branch**: `002-photo-translate`
**Endpoint**: `POST /api/photo-translate`
**Description**: 接收既有 OCR 原文與使用者選擇的目標語言，reuse 既有 OpenAI Responses API 將任意可辨識來源語言翻譯為繁體中文或日本語；若原文本身已與目標語言相同，不產生假翻譯，改回傳 `sameLanguage: true`。不做任何持久化儲存。

---

## Request

**Content-Type**: `application/json`

### Request Body
```json
{
  "sourceText": "牛丼並盛 490円",
  "targetLanguage": "zh-TW"
}
```

### Field Specifications
| Field | Type | Required | Description | Constraints |
|---|---|---|---|---|
| `sourceText` | string | Yes | 既有 OCR 原文（任何可辨識來源語言） | 非空字串，長度上限（建議 2000 字元，涵蓋菜單/招牌等短篇文字） |
| `targetLanguage` | string | Yes | 使用者選擇的翻譯目標 | Enum: `"zh-TW"`, `"ja"`（第一版不支援其他目標） |

---

## Response

**Content-Type**: `application/json`

### Success Response — 一般翻譯 (`200 OK`)
```json
{
  "success": true,
  "data": {
    "sameLanguage": false,
    "translatedText": "牛肉蓋飯 (大碗) 490日圓",
    "targetLanguage": "zh-TW"
  }
}
```

### Success Response — 原文已是目標語言 (`200 OK`)
```json
{
  "success": true,
  "data": {
    "sameLanguage": true,
    "targetLanguage": "zh-TW"
  }
}
```

---

## Error Responses

### `400 Bad Request`
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "userTitle": "無法翻譯",
    "userMessage": "翻譯內容或目標語言不正確。",
    "actionableStep": "請重新選取文字區域後再試一次。"
  }
}
```

### `500 Internal Server Error`
```json
{
  "success": false,
  "error": {
    "code": "AI_SERVICE_UNAVAILABLE",
    "userTitle": "翻譯服務暫時無法使用",
    "userMessage": "目前無法完成翻譯。",
    "actionableStep": "請重新嘗試翻譯。"
  }
}
```

---

## Behavioral Notes

- `sameLanguage: true` 時 `translatedText` 欄位不得出現，前端須顯示「原文已是所選語言」提示並提供切換至另一個目標語言的行動（FR-017）。
- 目標語言切換時，前端以既有 `sourceText` 重新呼叫本 endpoint；本 endpoint 為 stateless，不記得前一次呼叫的結果，「切換失敗時回復顯示前一次成功結果」完全由前端 `TranslationState.displayed` 負責（見 `data-model.md`）。
- 若切換前前端 `displayed` 尚無任何成功結果（即本次為切換後首次翻譯即失敗），前端不得顯示不存在的翻譯內容，僅顯示失敗狀態並提供重試；本 endpoint 行為不變，僅回傳一般化失敗（對應 FR-020）。
- 播放語音之語言由前端 `translation.displayed.target` 決定，並非 `selectedTarget`；本 endpoint 不涉及語音播放，僅提供 `targetLanguage` 供前端寫入對應 `displayed.target`（對應 FR-021）。
- 翻譯語氣沿用既有 Constitution VIII：繁體中文避免大陸慣用詞，日文輸出符合自然禮貌語境，而非逐字翻譯。
- provider 失敗時一律回傳一般化 `ProductError`，不得包含 OpenAI 原始錯誤訊息。
