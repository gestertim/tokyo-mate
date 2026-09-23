# Travel Japanese Audio Production Verification Record

## 1. Formal decision status

本記錄包含 approved production baseline、108 WAV master structural production 證據、108 句 Human QA 證據，以及 MP3 delivery 驗證結果。WAV 批次已完成並通過 automated structural validation；108-Phrase Full Manual Listening QA：PASS。MP3 已由 approved WAV master 完成 108/108 conversion，並通過 structural、duration、mapping 與 decode spot validation。

## 2. Evidence summary

- Android static test tone：PASS
- `tj-097` OpenAI evaluation bundled audio：PASS
- `tj-097` VOICEVOX Nemo pilot phrase：PASS
- `tj-065` VOICEVOX Nemo pilot phrase：PASS
- `tj-015` VOICEVOX Nemo pilot phrase：PASS
- Android first playback：PASS
- Android second playback：PASS
- Cached offline replay：PASS
- VOICEVOX Nemo engine installation：PASS
- Nemo 男声1 evaluation sample：PASS
- 成人教育者 A/B 聽感選擇：Nemo 男声1 優先於 OpenAI sample
- 108 WAV master batch：STRUCTURAL PASS
- MP3 delivery batch：108 / 108 conversion PASS

## 3. Official approved baseline

- Provider：VOICEVOX Nemo
- Voice：男声1（ノーマル）／CV レナード・ジン
- Fixed parameters：Speed 0.80 / Pitch 0.00 / Intonation 1.00 / Volume 1.00 / Pause length 1.00 / Start silence 0.10 / End silence 0.10
- Master format：WAV
- App delivery format：MP3
- Runtime architecture：static MP3 Primary → `SpeechSynthesis` fallback → text fallback
- Runtime dependency constraint：MUST NOT rely on VOICEVOX / Nemo engine / OpenAI TTS / Cloud TTS API / API key
- QA gate：108 unique phrases 全量人工聽檢
- Attribution：正式公開／merge 前，須依 VOICEVOX Nemo 官方規約加入可見 credit

## 4. 3-Phrase Pilot Human QA

- Pilot phrases：`tj-097`、`tj-065`、`tj-015`
- 結果：三句均為 PASS
- Adult educator decision：Speed 0.80 preferred over 1.00 for production
- 限制：3 句 pilot PASS 不代表 108 句 production complete；正式 108 句 WAV 人工 QA 已由成人教育者逐句播放與判定並全數 PASS，MP3 delivery 則另以本記錄第 8 節完成 structural／duration／mapping／decode validation。

## 5. Full WAV batch production evidence

- Production script：`scripts/produce-travel-japanese-wav.mjs`
- Dry-run：PASS；108 unique phrases、`tj-001` 至 `tj-108`、output mapping、style `10001` 與固定參數均驗證，未呼叫 synthesis
- WAV output：`production/audio/travel-japanese/wav/`
- Generated WAV count：108 / 108
- Synthesis success：107；resume skip of previously validated `tj-001`：1；failure：0
- Structural validation：PASS；missing 0、extra 0、invalid WAV 0、zero-byte 0、duplicate 0
- Sample rate：24,000 Hz（全數一致）
- Duration range：0.9387–2.7947 seconds
- File size range：45,100–134,188 bytes
- Technical spot checks：`tj-097`、`tj-065`、`tj-015`、emergency、restaurant、hotel、shopping representatives all structurally valid
- QA checklist：`production/audio/travel-japanese/reports/human-qa-checklist.md`
- 108-Phrase Full Manual Listening QA：PASS
- Human QA totals：Total 108；PASS 108；FAIL 0；PENDING 0
- Human QA evidence：`production/audio/travel-japanese/reports/human-qa-results.json`、`production/audio/travel-japanese/reports/human-qa-summary.md`
- QA 由成人教育者實際逐句播放與判定；summary review date：`2026-09-23T12:23:03.051Z`
- Source tool：`tools/travel-japanese-audio-qa/`（正式 local QA tool）

## 6. Important limitation

上述證據僅說明：

1. Android 靜態測試音、播放流程、離線 cache、Nemo engine 及 sample voice 均已在實機／人工評審中驗證通過。
2. `tj-097` 的 OpenAI 評估音訊與現有機器檢查在此發現已存在，可作為比較基準。
3. WAV structural production 與 108 句人工聽檢均已完成；MP3 conversion 與 `public/audio` full delivery 亦已完成。
4. 本輪未進行 merge、push 或 deploy。

## 7. Production gate note

- 108-Phrase Production Started：YES
- 108-Phrase WAV Batch：COMPLETE / STRUCTURAL PASS
- Production Provider：VOICEVOX Nemo
- Production Voice：男声1（ノーマル）／レナード・ジン
- Full Manual QA Required：YES
- Runtime Nemo Dependency：NO
- Runtime OpenAI Dependency：NO
- Production Speed：0.80 APPROVED
- 108-Phrase Full Batch Started：YES
- Human QA Completed：YES
- MP3 Conversion Started：YES
- MP3 Conversion：108 / 108 PASS
- MP3 Structural Validation：PASS（missing 0、extra 0、invalid 0、zero-byte 0、valid MPEG audio 108）
- MP3 Duration Integrity：PASS（WAV 對 MP3 全數於 0.05 秒容差內）
- MP3 Size Range：12,428–34,604 bytes
- `tj-097` POC：已由 approved production WAV master 正式覆寫；POC provenance 已被 production provenance 取代
- Conversion Spot Check：`tj-001`、`tj-015`、`tj-065`、`tj-097`、`tj-108` decode PASS；本輪未將 conversion decode check 誤標為新的 Human QA
- App Mapping：`/audio/travel-japanese/{phraseId}.mp3`，108/108 PASS
- PWA Runtime Cache：`travel-japanese-audio-v1` cache-hit／offline 行為由 service-worker tests 48/48 PASS 覆蓋；未進行 108 full precache
- T055：APPROVED
- Master Modified：NO
- Permanent Baseline Changed：NO

**精確獨立狀態（取代原「108-Phrase Production Complete：YES」單一措辭，避免被誤讀為已包含跨裝置驗證或部署）**：

- MP3 Delivery Production：COMPLETE（僅指 108/108 MP3 conversion + structural/duration/mapping validation scope）
- Human QA：108 / 108 PASS
- Cross-device Verification（T072）：NOT COMPLETED
- Production Deployment：NOT STARTED
- New Safety Tag：NOT CREATED

## 8. Phase C MP3 delivery execution record（2026-09-23）

- Phase C Source Gate：PASS；WAV 108、`tj-001`～`tj-108`、missing 0、extra 0、invalid 0；四份 Human QA evidence 一致，Human QA 108/108 PASS、FAIL 0、PENDING 0、Completed YES。
- ffmpeg：8.0.1；encoder：`libmp3lame`；96 kbps CBR；未使用 normalization、EQ、trim、audio filter 或 cloud transcoding。
- Dry-run：PASS；source 108、expected target 108、`tj-097` replacement plan、output path 與 encoder settings 均確認，dry-run 未寫入 MP3。
- Conversion：108 WAV master 全數轉換至 `public/audio/travel-japanese/{id}.mp3`；`tj-097.mp3` 已正式覆寫。
- Structural validation：total 108、success 108、failure 0、missing 0、extra 0、invalid 0、zero-byte 0；valid MPEG audio 108。
- Duration integrity：PASS；MP3 duration 0.938667–2.794667 秒，WAV 對 MP3 無超過 0.05 秒之 anomaly。
- Spot listening / decode：指定五檔 `tj-001`、`tj-015`、`tj-065`、`tj-097`、`tj-108` 均 decode PASS。這是 conversion integrity check，不取代既有 108 句 WAV Human QA。
- App mapping：正式路徑維持 `/audio/travel-japanese/{phraseId}.mp3`，108/108 mapping PASS；未新增 `audioFile` 欄位或修改 dataset schema。
- PWA runtime cache：`travel-japanese-audio-v1`、首次成功 fetch cache、cache hit、cached offline replay、uncached failure 與不 precache 行為由既有 service-worker tests 驗證 PASS。
- Runtime constraints：不依賴 Nemo engine、VOICEVOX、OpenAI TTS 或 API key；runtime chain 維持 static MP3 Primary → `SpeechSynthesis` fallback → text fallback。
- Tests / build：audio 與 service-worker 窄測試 48/48 PASS；排除既有無 test suite 的 `tools/travel-japanese-audio-qa/qa-data.test.mjs` 後，Vitest 49/49 files、422/422 tests PASS（**當時執行結果**，2026-09-23 Phase C MP3 delivery 執行當下之數字）；`npm run build` PASS；PWA red-gate 4/4 PASS；`git diff --check` PASS。原始 `npm run test` 僅因該 helper 檔被 Vitest 收集但沒有 test suite 而 exit 1，非 application test failure。**目前最新 Final Integration Verification 請見**：[docs/verification/004-final-integration-test-evidence.md](./004-final-integration-test-evidence.md)（2026-09-23 Analyze Remediation 重新執行結果：Vitest 417/417、QA Node suite 8/8、Build PASS、PWA red-gate 4/4、`git diff --check` PASS）。
