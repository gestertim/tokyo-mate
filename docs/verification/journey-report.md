# Journey Report（Phase 6 automated evidence）

- date: 2026-09-13
- environment: local test/build (Windows, Node v24.19.0)
- commit: 3376307

## Automated Results

| Journey / requirement | 結果 | 證據 |
|---|---|---|
| Journey 0 PWA shell / offline boundary | PARTIAL | manifest、icons、service worker build、NetworkStatus automated tests passed；實際安裝與 offline restart deferred to T089 |
| Journey 1 translation | PASS (regression) | existing translation journey tests included in full suite |
| Journey 2 Knowledge Browser | PASS (regression) | existing knowledge journey tests included in full suite |
| Journey 3 Nearby GPS/manual fallback | PASS (regression) | existing nearby journey and geolocation tests included in full suite |
| Journey 4 live-data status | PASS (regression) | existing live-data contract tests included in full suite |
| Journey 5 emergency priority | PASS (regression) | existing emergency contract and nearby journey tests included in full suite |
| SC-013 update prompt | PASS | `src/components/UpdatePrompt.test.tsx` 3/3 |
| FR-025 accessibility / responsive baseline | PASS (automated subset) | `src/components/AccessibilityAudit.test.tsx` 6/6; manual viewport matrix deferred |
| FR-017 / FR-018 / FR-026 privacy boundary | PASS (automated subset) | `src/service-worker.test.ts` + platform safety gate passed; real browser storage inspection deferred |

## Commands

- `npx vitest run --pool=threads` → 17 test files, 63 tests passed
- `npm run build` → TypeScript and Vite build passed

## Deferred Issues

- Browser/device manual PWA installation, offline restart, Cache Storage inspection, update timing, and four-viewport standalone matrix remain required under T080/T081/T084/T089.

## 2026-09-17 Knowledge Card Repair Pre-commit Evidence

- branch: `fix/knowledge-card-details`
- pre-commit HEAD: `036cf28201a0633fd7a3e9f7b3c8d9c1693e8b00`
- targeted test: `npm test -- src/features/knowledge/KnowledgeJourney.test.tsx` PASS（15/15）
- full test: `npm test` PASS（23 files、138/138）
- build: `npm run build` PASS
- diff hygiene: `git diff --check` PASS
- local viewport acceptance: 360 x 800、390 x 844、430 x 932、844 x 390 全數 PASS。各尺寸均驗證六分類操作、完整靜態卡片、展開/收合、日文內容、無水平捲動、複製與語音控制無重疊、keyboard focus indicator 與 safe-area；844 x 390 可正常捲動及操作。
- static catalog/request boundary: 區域 11、交通 2、美食 2、購物 2、文化 1、緊急 1；切換時未觀察到 `/api/*` request。
- deferred: Preview 驗收、真正 offline reload/語音 fallback，以及真實 TTS 播放均未執行，不宣稱通過。詳見 `specs/001-tokyo-travel-assistant/quickstart-results.md`。
