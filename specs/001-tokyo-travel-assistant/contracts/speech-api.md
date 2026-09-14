# Contract: Speech API (`POST /api/speech`)

**Feature Branch**: `001-tokyo-travel-assistant`  
**Endpoint**: `POST /api/speech`  
**Description**: 接收文字內容、語言與播放速度設定，呼叫 OpenAI Speech API 產生音訊檔，直接串流或回傳音訊 Buffer 供前端 HTML5 Audio 播放。

---

## Request

**Content-Type**: `application/json`

### Request Body
```json
{
  "text": "辛くない牛丼を1つお願いします。",
  "language": "ja",
  "speed": "normal"
}
```

### Field Specifications
| Field | Type | Required | Description | Constraints |
|---|---|---|---|---|
| `text` | string | Yes | 要合成語音的目標文字 | Max 500 characters |
| `language` | string | Yes | 目標語言 | Enum: `"ja"`, `"zh-TW"` |
| `speed` | string | No | 播放速度 | Enum: `"normal"` (1.0x), `"slow"` (0.75x) |

---

## Response

**Content-Type**: `audio/mpeg` (或 `application/json` base64 / audio stream)

### Success Response (`200 OK`)
Binary MP3 Audio Stream or JSON with Base64 audio payload:

```json
{
  "success": true,
  "data": {
    "audioUrl": "data:audio/mp3;base64,SUQ3BAAAAAAA...",
    "mimeType": "audio/mpeg",
    "speed": "normal"
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
    "userTitle": "無法合成語音",
    "userMessage": "發音內容過長或格式不正確。",
    "actionableStep": "請直接展示畫面上的日文字給對方觀看。"
  }
}
```

### `500 Internal Server Error`
```json
{
  "success": false,
  "error": {
    "code": "AI_SERVICE_UNAVAILABLE",
    "userTitle": "語音播放服務暫時無法使用",
    "userMessage": "無法產生語音檔。",
    "actionableStep": "您可以複製日文或直接向對方展示螢幕文字。"
  }
}
```
