# Privacy Report（FR-017 / FR-018 / FR-026 / SC-009）

- date: 2026-09-13
- environment: local dev (Windows, Node v24.19.0, `npm run test` + `npm run build`)
- commit: 3376307

## 檢查項目與結果

| 檢查項目 | 方法 | 結果 |
|---|---|---|
| 聊天內容 / 對話紀錄 | 全 repo 搜尋 `localStorage`/`indexedDB`/`sessionStorage`，src/ 下無任何寫入呼叫 | PASS |
| 翻譯結果 | `AssistantResult` 僅存在 React state（`AssistantScreen`），未寫入任何 storage | PASS |
| 使用者語音 blob / TTS audio | `AudioPlayer`／`recorder.ts` 僅使用 `URL.createObjectURL` 於 runtime memory，播放後於 unmount / 下一次播放前 `URL.revokeObjectURL` | PASS |
| Transcription | `EditableTranscript`／`VoiceInputModal` 僅存在 component state | PASS |
| 精確位置 | `src/services/geolocation.ts` 僅回傳座標供當次 request 使用，未寫入任何 storage（`geolocation.test.ts` 涵蓋不持久化驗證） | PASS |
| Places 個人情境結果 | `NearbyResults`／`PlaceCard` 僅存在 component state，`api/places.ts` 為 stateless request/response | PASS |
| 即時 API response（web search） | `api/_lib/live-search.ts` 結果僅透過 `AssistantResult` 回傳，前端未持久化 | PASS |
| credentials/secrets | `OPENAI_API_KEY`／`GOOGLE_PLACES_API_KEY` 僅於 server（`api/_lib/openai.ts` 等）讀取，未輸出至前端 bundle 或 Cache Storage | PASS |
| Cache Storage allowlist | `src/service-worker.ts` `APPROVED_STATIC_PREFIXES` 僅含 `/assets/`、`/src/data/tokyo/`、`/icons/`；`PRECACHE_URLS` 僅含 `/`、`/index.html`、`/manifest.webmanifest`；`/api/*` 一律排除（`src/service-worker.test.ts`、`src/test/platform-safety-gate.test.ts`） | PASS |

## Automated Checks

- `npx vitest run --pool=threads` → 63/63 tests passed（含 `src/service-worker.test.ts`、`src/test/platform-safety-gate.test.ts`）
- `npm run build`（`tsc -b && vite build`）→ 成功，`dist/service-worker.js` 產出且未包含任何 API proxy 快取邏輯

## Deferred Issues

- 尚未於實際安裝之 standalone PWA 上以瀏覽器 DevTools（Application 分頁）人工檢視 Cache Storage / LocalStorage / IndexedDB 實際內容，屬於 T089 手動裝置驗收範圍，待實機/瀏覽器環境執行。
