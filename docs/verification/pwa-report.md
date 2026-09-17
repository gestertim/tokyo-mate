# PWA Report（FR-021～FR-025 / SC-010～SC-014）

- date: 2026-09-13
- environment: local build & preview (Windows, Node v24.19.0)
- commit: 3376307

## Automated Checks

| 檢查項目 | 結果 |
|---|---|
| Manifest JSON、standalone、icons、scope/start_url | PASS：`public/manifest.webmanifest` 含 standalone、scope、start_url 與 4 個 192/512 any/maskable icons |
| Apple / browser icon metadata | PASS：`index.html` 含 manifest、favicon、apple-touch-icon 與 iOS standalone metadata |
| Service Worker build output | PASS：`npm run build` 產出 `dist/service-worker.js`、`dist/manifest.webmanifest` 與 `dist/icons/*` |
| API / AI / location cache exclusion | PASS：allowlist 與自動化 privacy tests 通過 |
| Offline network-required boundary | PASS：NetworkStatus test 3/3；離線顯示需要網路與重試訊息，恢復後自動消失 |
| Update flow | PASS：UpdatePrompt test 3/3；可選擇稍後更新，立即更新透過 `SKIP_WAITING`，不無提示強制 reload |
| Responsive / safe-area / reduced-motion rules | PASS：Accessibility audit test 7/7；`components.css` / `global.css` 補足 tablet/desktop 寬度展開、橫向 safe-area、矮螢幕 modal、360px 單欄與 reduced-motion |

## Viewport Matrix & Standalone Verification（FR-025 / SC-014）

| Viewport / 環境 | 驗證項目 | 結果 | 說明 |
|---|---|---|---|
| **360 × 800**（小型手機直向） | Safe-area、無水平 overflow、單欄功能入口、觸控尺寸 ≥44px | PASS | 窄寬度下 `nav[aria-label='東京功能入口']` 切換為單欄網格，輸入框與按鈕不擠壓、無水平捲動 |
| **390 × 844**（一般手機直向） | 標準手機直向、雙欄入口、底部 sheet dialog、touch targets | PASS | 兩欄功能入口與語調按鈕群組自適應換行，底部 Modal 具備 safe-bottom 邊界與最大高度保護 |
| **430 × 932**（大型手機直向） | 大螢幕直向、高解析度、Dynamic Island safe-area、表單與清單排版 | PASS | top/bottom safe-area 正確生效，卡片與文字按比例排版舒適 |
| **844 × 390**（一般手機橫向 / 矮螢幕） | 橫向左右 safe-area、矮螢幕鍵盤展開、語音 Modal 可捲動性 | PASS | 左右 notch safe-area 留白充足；矮螢幕與軟體鍵盤展開時 dialog 自動調整留白並支援 overflow-y 捲動，不超出視窗 |
| **768 × 1024**（平板） | 寬度展開、4 欄功能入口、雙欄卡片、置中 Modal | PASS | 主容器擴展至 768px，首頁四入口一字排開，東京百科與探索地點展開為雙欄卡片，Modal 自動切換為置中視窗 |
| **1280 × 800 / 1440 × 900**（桌面） | 寬螢幕行前查詢、多欄卡片、大標題與排版呼吸空間 | PASS | 主容器擴展至 980px，閱讀空間寬敞，支援鍵盤 tab/focus-visible 完整操作，未破壞既有單頁與資訊架構 |
| **Installed Standalone PWA** | 全螢幕 standalone 模式、無瀏覽器 UI 干擾、safe-area 互動完整性 | PASS | `@media (display-mode: standalone)` 確保四向 safe-area padding，所有 primary CTA 與輸入皆可見可點 |

## PWA Cache Hotfix Preparation Gate（2026-09-17）

本節只記錄 Preparation Gate，尚未驗證 hotfix implementation；不得視為 Production PASS。

| 項目 | 狀態 | 追蹤 |
|---|---|---|
| Cache version bump | 待驗證 | T102、T105 |
| Navigation network-first | 待驗證 | T102、T106 |
| Offline `/`／`/index.html` App Shell fallback | 待驗證 | T102、T106 |
| Activate 舊 cache cleanup | 待驗證 | T102、T107 |
| Hashed asset cache-first | 待驗證 | T102、T105 |
| API／speech／Places／使用者資料 privacy boundary | 待驗證 | T102、T108 |
| UpdatePrompt waiting／主動套用／單次 reload | 待驗證 | T103、T109 |
| Preview／Production existing-client upgrade journey | 尚未執行 | T109 |

本階段未修改 `src/service-worker.ts` 或其他 production source，未 deploy，未變更 Production alias。
