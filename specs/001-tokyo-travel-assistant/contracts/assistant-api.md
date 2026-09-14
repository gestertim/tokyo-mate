# Contract: Assistant API (`POST /api/assistant`)

**Feature Branch**: `001-tokyo-travel-assistant`  
**Endpoint**: `POST /api/assistant`  
**Description**: 接收使用者輸入文字、情境與語氣需求，呼叫 OpenAI Responses API 進行意圖判斷、雙語翻譯、東京旅遊問答、知識庫 Context 整合、即時資料判斷與緊急指引輸出。

---

## Request

**Content-Type**: `application/json`

### Request Body
```json
{
  "text": "我想點一份不辣的牛丼，麻煩幫我點一份",
  "inputType": "text",
  "tone": "default",
  "location": {
    "type": "manual",
    "manualArea": "新宿"
  },
  "context": {
    "previousIntent": "travel",
    "currentArea": "新宿"
  }
}
```

### Field Specifications
| Field | Type | Required | Description | Constraints |
|---|---|---|---|---|
| `text` | string | Yes | 使用者輸入的文字或語音辨識文字 | 1 ~ 1000 characters |
| `inputType` | string | Yes | 輸入來源 | Enum: `"text"`, `"voice"`, `"quick_action"` |
| `tone` | string | No | 期望語氣 | Enum: `"default"`, `"polite"`, `"casual"` (Default: `"default"`) |
| `location` | object | No | 使用者位置資訊 | Optional |
| `location.type` | string | Required if location provided | 位置類型 | Enum: `"coordinates"`, `"manual"` |
| `location.coordinates` | object | Optional | GPS 經緯度 | `{ "latitude": number, "longitude": number }` |
| `location.manualArea` | string | Optional | 手動輸入地區 | Max 50 chars |

---

## Response

**Content-Type**: `application/json`

### Success Response (`200 OK`)

#### 範例 1：中日翻譯與語氣（Translation Result）
```json
{
  "success": true,
  "data": {
    "id": "asst-1726100000000",
    "safety": "normal",
    "freshness": "not_required",
    "intent": "translation",
    "sourceLanguage": "zh-TW",
    "targetLanguage": "ja",
    "answerType": "direct_translation",
    "primaryContent": "辛くない牛丼を1つお願いします。",
    "translation": {
      "sourceText": "我想點一份不辣的牛丼，麻煩幫我點一份",
      "targetText": "辛くない牛丼を1つお願いします。",
      "pronunciation": "Karaku nai gyudon o hitotsu onegaishimasu",
      "toneUsed": "default"
    },
    "liveDataStatus": "not_required",
    "suggestedActions": [
      {
        "id": "act-tts",
        "label": "播放日文語音",
        "actionType": "tts",
        "payload": { "text": "辛くない牛丼を1つお願いします。", "language": "ja" }
      },
      {
        "id": "act-polite",
        "label": "更禮貌",
        "actionType": "adjust_tone",
        "payload": { "tone": "polite" }
      }
    ],
    "emergency": false
  }
}
```

#### 範例 2：一般旅遊問答（Travel Result - 最小契約：結論 → 行動 → 可選注意 → 可選日文）
```json
{
  "success": true,
  "data": {
    "id": "asst-1726100000001",
    "safety": "normal",
    "freshness": "not_required",
    "intent": "travel",
    "sourceLanguage": "zh-TW",
    "targetLanguage": "zh-TW",
    "answerType": "action_plan",
    "primaryContent": "下午建議先逛淺草寺雷門周邊，傍晚再前往上野阿美橫町用餐，動線最順暢。",
    "travelAnswer": {
      "conclusion": "建議「先淺草、後上野」，搭乘東京 Metro 銀座線僅需 5 分鐘。",
      "action": [
        "13:30 - 16:00：逛淺草寺雷門、仲見世通與隅田川步道",
        "16:00 - 16:15：搭銀座線從淺草站直達上野站",
        "16:30 - 19:00：逛上野公園與阿美橫町吃晚餐"
      ],
      "caution": [
        "淺草寺仲見世通商店多於 18:00 前打烊，務必排在下午前半段",
        "阿美橫町人潮擁擠，請留意隨身貴重物品"
      ],
      "phrase": {
        "japanese": "上野駅までどのくらいかかりますか？",
        "pronunciation": "Ueno eki made dono kurai kakarimasu ka?",
        "meaning": "到上野站大約需要多久？"
      }
    },
    "liveDataStatus": "not_required",
    "suggestedActions": [
      {
        "id": "act-nearby-food",
        "label": "上野附近美食",
        "actionType": "search_nearby",
        "payload": { "area": "上野", "category": "food" }
      }
    ],
    "emergency": false
  }
}
```

#### 範例 3：緊急模式（Emergency Result - 最小契約：現在先做 → 接著行動 → 可選日文 → 可選提醒）
```json
{
  "success": true,
  "data": {
    "id": "asst-1726100000002",
    "safety": "emergency",
    "freshness": "live_required",
    "intent": "emergency",
    "sourceLanguage": "zh-TW",
    "targetLanguage": "zh-TW",
    "answerType": "emergency_guide",
    "primaryContent": "護照遺失時請立即保持冷靜，並照以下順序處理：",
    "liveDataStatus": "verified",
    "liveDataMessage": "台北駐日代表處領事組今日正常辦公（09:00-17:30）。",
    "suggestedActions": [],
    "emergency": true,
    "emergencyGuide": {
      "immediateAction": [
        "向當地最近的警察署或派出所（交番 Koban）報案，取得報案證明 (盗難・紛失証明書)",
        "撥打台北駐日經濟文化代表處緊急聯絡電話：03-3280-7111"
      ],
      "nextAction": [
        "準備大頭照 2 張與身分證明文件（身分證影本、照片或健保卡）",
        "前往港區白金台的台北駐日代表處辦理入國證明書或入國許可"
      ],
      "phrase": [
        "パスポートを紛失しました。(我遺失了護照)",
        "近くの交番はどこですか？(最近的交番在哪裡？)"
      ],
      "importantNotice": "請勿相信非官方代辦，駐日代表處地址：東京都港區白金台5-20-2"
    }
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
    "userTitle": "輸入內容無效",
    "userMessage": "請輸入文字內容後再試一次。",
    "actionableStep": "請重新輸入您的問題或需求。"
  }
}
```

### `500 Internal Server Error`
```json
{
  "success": false,
  "error": {
    "code": "AI_SERVICE_UNAVAILABLE",
    "userTitle": "東京 AI 暫時無法連線",
    "userMessage": "目前 AI 服務回應繁忙或網路不穩定。",
    "actionableStep": "請稍後重試，或使用東京百科查詢固定景點與交通指南。"
  }
}
```
