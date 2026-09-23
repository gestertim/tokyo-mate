# Travel Japanese Audio QA Tool

這是 Feature 004 的本機人工聽檢工具，只用於成人教育者逐句檢查既有 WAV。它不是正式 App 功能，不加入 production runtime，也不呼叫 VOICEVOX Nemo synthesis。

## 使用方式

1. 啟動 VOICEVOX 不需要。
2. WAV 已經生成，所以 QA 時不需要 Nemo engine、OpenAI、API key 或 cloud 服務。
3. 在 repository root 執行：

   ```powershell
   node tools/travel-japanese-audio-qa/server.mjs
   ```

4. 打開 `http://127.0.0.1:4174`。
5. 從 `tj-001` 開始逐句聽 WAV。
6. 使用 `PASS` / `FAIL` 記錄結果；若 FAIL，建議填寫備註，但工具不強制阻塞。
7. 完成或中途需要落檔時，按「匯出 QA 結果」。

## 快捷鍵

- `Space`：播放 / 暫停
- `P`：PASS
- `F`：FAIL
- `←`：上一句
- `→`：下一句

## 資料與結果

- Dataset：`src/data/tokyo/travel-japanese-phrases.json`
- WAV source：`production/audio/travel-japanese/wav/`
- 初始 checklist：`production/audio/travel-japanese/reports/human-qa-checklist.md`
- QA result JSON：`production/audio/travel-japanese/reports/human-qa-results.json`
- QA summary：`production/audio/travel-japanese/reports/human-qa-summary.md`

第一次啟動時，如果 `human-qa-results.json` 不存在，server 會從 checklist / dataset 建立 `PENDING` 狀態。若結果 JSON 格式損壞，畫面會提示並暫時回到 checklist defaults；下一次儲存會重寫合法 JSON。

只有 `PASS = 108`、`FAIL = 0`、`PENDING = 0` 時，畫面才顯示「108 句人工聽檢完成」。工具不會修改 `human-qa-checklist.md` 的 PENDING 狀態，也不會修改 T055 / production status。

## 測試

```powershell
node --test tools/travel-japanese-audio-qa/qa-data.test.mjs
```