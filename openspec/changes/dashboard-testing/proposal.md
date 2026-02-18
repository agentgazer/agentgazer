## Why

Dashboard (`apps/dashboard-local`) 目前零 unit test — test script 是 `echo 'No unit tests'`。只有 Playwright e2e 測試，但 e2e 需要跑 server 且沒有 CI workflow 執行。React component 的邏輯沒有任何自動化驗證。

## What Changes

- 為 Dashboard 新增 Vitest + React Testing Library 設定
- 為關鍵頁面和 components 新增 unit tests
- 重點覆蓋：資料格式化、API hook、條件渲染邏輯

## Capabilities

### New Capabilities

- `dashboard-unit-tests`: React component unit test 覆蓋

## Impact

- **devDependencies**: 新增 `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
- **apps/dashboard-local**: 新增 test 設定和測試檔案
- **CI**: 一旦 ci-pipeline change 完成，dashboard tests 也會被自動執行
