# Contract: Transcribe API (`POST /api/transcribe`)

**Feature Branch**: `001-tokyo-travel-assistant`  
**Endpoint**: `POST /api/transcribe`  
**Description**: 接收瀏覽器錄製的音訊檔 (Audio Blob / FormData)，呼叫 OpenAI Whisper API 進行語音轉文字辨識，回傳辨識文字供前端檢視與修正。

---

## Request

**Content-Type**: `multipart/form-data`

### Form Fields
| Field Name | Type | Required | Description | Constraints |
|---|---|---|---|---|
| `audio` | File / Blob | Yes | 錄製的音訊檔案 | Max size 10MB, Supported MIME: `audio/webm`, `audio/mp4`, `audio/m4a`, `audio/wav`, `audio/aac` |
| `language` | string | No | 提示語言 (Optional) | e.g. `"zh"`, `"ja"` |

---

## Response

**Content-Type**: `application/json`

### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "text": "請問這附近哪裡有牛肉飯？",
    "detectedLanguage": "zh"
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
    "userTitle": "音訊檔案無效",
    "userMessage": "無法讀取錄音檔案，請重新錄音。",
    "actionableStep": "請確認麥克風功能正常後再試一次，或改用文字輸入。"
  }
}
```

### `500 Internal Server Error`
```json
{
  "success": false,
  "error": {
    "code": "TRANSCRIPTION_FAILED",
    "userTitle": "語音辨識失敗",
    "userMessage": "目前無法辨識語音內容。",
    "actionableStep": "請改用文字輸入，或至安靜環境重新錄音。"
  }
}
```
