# Contract: Photo OCR API (`POST /api/photo-ocr`)

**Feature Branch**: `002-photo-translate`
**Endpoint**: `POST /api/photo-ocr`
**Description**: 接收使用者已確認選取並裁切之影像，reuse 既有 OpenAI Responses API（vision-capable model）辨識影像中的文字，回傳可靠 OCR 原文或「無可靠文字」狀態。不進行任何語言翻譯、不做任何持久化儲存。

---

## Request

**Content-Type**: `application/json`

### Request Body
```json
{
  "imageDataUrl": "data:image/jpeg;base64,/9j/4AAQSkZJ...",
  "regionVersion": 3
}
```

### Field Specifications
| Field | Type | Required | Description | Constraints |
|---|---|---|---|---|
| `imageDataUrl` | string | Yes | 使用者確認選取後裁切出的影像（base64 data URL） | MIME 限定 `image/jpeg`／`image/png`／`image/webp`；解碼後大小上限（實作時依 `research.md` §7 訂定，量級與既有 `transcribe.ts` 10MB 一致） |
| `regionVersion` | number | Yes | 前端目前的選取區域版本號，原樣回傳供前端比對 stale 狀態 | 整數，>= 1 |

---

## Response

**Content-Type**: `application/json`

### Success Response — 可靠文字 (`200 OK`)
```json
{
  "success": true,
  "data": {
    "reliableTextFound": true,
    "sourceText": "牛丼並盛 490円",
    "regionVersion": 3
  }
}
```

### Success Response — 無可靠文字 (`200 OK`)
```json
{
  "success": true,
  "data": {
    "reliableTextFound": false,
    "regionVersion": 3
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
    "userTitle": "無法辨識這個選取範圍",
    "userMessage": "影像格式或大小不符合需求。",
    "actionableStep": "請重新選取範圍或重新選擇照片。"
  }
}
```

### `500 Internal Server Error`
```json
{
  "success": false,
  "error": {
    "code": "AI_SERVICE_UNAVAILABLE",
    "userTitle": "辨識服務暫時無法使用",
    "userMessage": "目前無法完成文字辨識。",
    "actionableStep": "請稍後重試辨識，或重新選取範圍。"
  }
}
```

---

## Behavioral Notes

- 不得將原文以外的內容（例如猜測性描述）填入 `sourceText`；`reliableTextFound: false` 時 `sourceText` 不得出現。
- `regionVersion` 僅供前端比對「此結果是否仍對應目前選取框」，伺服器不需理解其業務語意，只需原樣回傳。
- 伺服器不得將 `imageDataUrl` 寫入任何持久化儲存體或記錄檔；僅存在單次 request 記憶體處理範圍內。
- provider 失敗時一律回傳一般化 `ProductError`，不得包含 OpenAI 原始錯誤訊息或 stack trace。
