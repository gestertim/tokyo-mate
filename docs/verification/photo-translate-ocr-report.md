# T040 — OCR 實際能力驗證報告（Photo Translate 002）

- date: 2026-09-19
- 對應 task：T040（Phase 11）
- 對應需求：quickstart.md 情境 12、SC-008

## 結論

**T040 PASS** — 5 組代表性案例皆透過真實 OpenAI Responses API 驗證，行為符合預期，無臆測文字，足以支援 Tokyo Mate Photo Translate MVP 已批准之實際使用情境。

## 驗證方法

1. 於一次性、非產品程式碼的本機驗證測試（執行後已刪除，未加入自動化套件、未提交至 repository）中：
   - 使用既有 `@playwright/test`（既有 devDependency，未新增）於本機 Chromium 產生 5 組代表性合成影像（非個人照片），涵蓋：清楚日文印刷文字（菜單）、清楚英文印刷文字（車站標示）、清楚繁體中文印刷文字（告示）、東京旅遊常見雙語 signage/notice、無可靠文字（視覺雜訊，無任何文字）。
   - **直接呼叫產品現有的 `api/photo-ocr.ts` `POST` handler**（未 mock），因此完整經過現行產品批准的 OCR boundary：`createOpenAIClient()`、`getOpenAIModel()`、現有 `photoOcrInstruction()` prompt（`api/_lib/prompts/photo-ocr.ts`）、以及現有 `parseOcrResult` 回應解析與 `reliableTextFound` semantics。
   - 憑證讀取自本機 `.env.local` 之 `OPENAI_API_KEY`／`OPENAI_MODEL`（server-side only）；金鑰內容、片段均未輸出、未寫入本報告、未寫入 repo。
2. 驗證腳本為一次性、非產品程式碼，執行後已刪除，未加入自動化測試套件、未提交至 repository。

## Environment

- credential connectivity：PASS（五次真實 API 呼叫皆回傳 HTTP 200）
- model configured：Yes（讀自 `.env.local` 之 `OPENAI_MODEL`）
- secret exposed：No

## 代表性案例結果

| Case | 類型 | Expected | Actual observed | reliableTextFound | recognized text 合理性 | fabricated text | Translation-flow usability | 判定 |
|---|---|---|---|---|---|---|---|---|
| A | 清楚日文印刷文字（菜單） | `reliableTextFound: true`，原文對應合成文字 | 回傳 `reliableTextFound: true`，`sourceText` 與合成影像文字完全一致（`牛丼並盛　490円 / 味噌汁　120円 / お持ち帰りできます`） | true | 合理，逐字一致 | No | 可直接作為 `/api/photo-translate` 之 `sourceText` | PASS |
| B | 清楚英文印刷文字（車站標示） | 同上 | `reliableTextFound: true`，`sourceText` 為 `EXIT → / Platform 3 / Please mind the gap`，與影像一致 | true | 合理，逐字一致 | No | 可直接作為 `sourceText` | PASS |
| C | 清楚繁體中文印刷文字（告示） | 同上 | `reliableTextFound: true`，`sourceText` 為 `請勿飲食 / 緊急出口 / 施工中，請小心通行`，與影像一致 | true | 合理，逐字一致 | No | 可直接作為 `sourceText` | PASS |
| D | 東京旅遊常見雙語 signage/notice | 同上（雙語內容應保留原文，不做語言轉換） | `reliableTextFound: true`，`sourceText` 為 `出口 / Exit / 浅草寺 Sensoji Temple / この先禁煙 / No Smoking Beyond This Point`，雙語原文均保留、未被 OCR 階段轉換或省略 | true | 合理，逐字一致 | No | 可直接作為 `sourceText` | PASS |
| E | 無可靠文字（純視覺雜訊，無文字） | `reliableTextFound: false`，不得包含 `sourceText` | 回傳 `{ reliableTextFound: false }`，未包含 `sourceText` 欄位 | false | N/A（正確判定無可靠文字） | No（未臆造任何文字） | N/A | PASS |

全部 5 案例：**5/5 PASS**。

## OCR Guard 判定

- existing OpenAI OCR sufficient：**Yes**
- second provider required：**No**
- new dependency required：**No**
- T040 completed：**Yes**

## 備註

- 本次驗證前曾因本機 `.env.local` 之 `OPENAI_API_KEY` 解析問題（值被雙引號包覆但一次性驗證腳本未去除引號）導致誤判為 401 Unauthorized；修正一次性驗證腳本之環境變數解析（去除包覆引號）後，即可正常呼叫真實 OpenAI Responses API，非金鑰本身失效。
- 本報告與過程均未記錄該金鑰之任何字元或片段。
