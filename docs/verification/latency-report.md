# Latency Report（SC-002）

- date: 2026-09-13
- environment: local Windows, Node v24.19.0
- commit: 3376307
- dataset: `tests/fixtures/latency-cases.json` (32 cases)
- status: DEFERRED

本次 Phase 6 完成固定 dataset 與報告格式，但未在 production-like deployment、正常穩定網路及真實 provider API keys 下執行 32 次 client-to-render 量測，因此不捏造 p50/p95/maximum 數值。T087 需在可重複的 production-like 環境中執行並填入每個 case 的 latency milliseconds、pass/fail、p50、p95、maximum 與 outlier cases。

| Metric | Result |
|---|---|
| Dataset cases | 32 |
| p50 | N/A（尚未量測） |
| p95 | N/A（尚未量測） |
| Maximum | N/A（尚未量測） |
| 5.0s threshold | Pending T087 |

排除於本基準的 web search、Places、STT、TTS 需另行獨立量測。
