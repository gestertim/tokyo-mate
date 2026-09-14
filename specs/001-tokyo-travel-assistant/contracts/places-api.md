# Contract: Places API (`POST /api/places`)

**Feature Branch**: `001-tokyo-travel-assistant`  
**Endpoint**: `POST /api/places`  
**Description**: 接收使用者地點座標（GPS）或手動輸入地區，呼叫 Google Places API (New) 檢索附近景點、餐廳、便利商店、車站與店家資訊。

---

## Request

**Content-Type**: `application/json`

### Request Body

#### 情況 A：使用 GPS 經緯度
```json
{
  "location": {
    "type": "coordinates",
    "coordinates": {
      "latitude": 35.690921,
      "longitude": 139.700258
    }
  },
  "category": "food",
  "query": "拉麵"
}
```

#### 情況 B：手動輸入地區
```json
{
  "location": {
    "type": "manual",
    "manualArea": "淺草"
  },
  "category": "attraction"
}
```

### Field Specifications
| Field | Type | Required | Description | Constraints |
|---|---|---|---|---|
| `location` | object | Yes | 使用者位置 | Must be provided |
| `location.type` | string | Yes | 位置類型 | Enum: `"coordinates"`, `"manual"` |
| `location.coordinates` | object | Optional | GPS 座標 | `{ "latitude": number, "longitude": number }` |
| `location.manualArea` | string | Optional | 手動地區名稱 | Max 50 chars |
| `category` | string | No | 探索分類 | Enum: `"food"`, `"shopping"`, `"attraction"`, `"convenience"`, `"station"`, `"all"` |
| `query` | string | No | 搜尋關鍵字 | Max 100 chars |

---

## Response

**Content-Type**: `application/json`

### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "places": [
      {
        "id": "ChIJbU6A122LGGAR123456",
        "name": "一蘭 新宿中央東口店",
        "category": "拉麵店",
        "address": "東京都新宿區新宿3-34-11",
        "location": {
          "latitude": 35.6901,
          "longitude": 139.7020
        },
        "distanceMeter": 250,
        "openNowStatus": "open",
        "whyRecommended": "距離您 250 公尺，知名豚骨拉麵，支援個人獨立座位與單人用餐。"
      },
      {
        "id": "ChIJc89B999LGGAR987654",
        "name": "7-Eleven 新宿三丁目店",
        "category": "便利商店",
        "address": "東京都新宿區新宿3-17-5",
        "location": {
          "latitude": 35.6912,
          "longitude": 139.7015
        },
        "distanceMeter": 120,
        "openNowStatus": "open",
        "whyRecommended": "提供 Suica/PASMO 儲值、ATM 提款與 24 小時補給。"
      }
    ]
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
    "userTitle": "無法取得位置資訊",
    "userMessage": "請提供有效的 GPS 座標或手動輸入區域。",
    "actionableStep": "請輸入您想搜尋的地區名稱，例如「新宿」或「淺草」。"
  }
}
```

### `500 Internal Server Error`
```json
{
  "success": false,
  "error": {
    "code": "PLACES_SERVICE_UNAVAILABLE",
    "userTitle": "附近探索服務暫時無法連線",
    "userMessage": "無法取得周邊景點與店家資料。",
    "actionableStep": "請輸入地區名稱重新搜尋，或前往東京百科查看區域景點介紹。"
  }
}
```
