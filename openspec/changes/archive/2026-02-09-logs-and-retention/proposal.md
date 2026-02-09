## Why

Dashboard 目前只有 Overview 頁面的 "Recent Events" 顯示少量特殊事件，沒有完整的 logs 瀏覽功能。使用者無法查詢歷史事件、篩選特定 agent/provider 的紀錄。同時，event 資料會無限累積，沒有自動清理機制。

## What Changes

- 新增 Dashboard Logs 頁面：表格顯示所有 events，支援篩選、分頁、匯出
- 調整 API：`GET /api/events` 不再強制要求 `agent_id`，支援分頁參數
- 實作自動 retention：預設保留 30 天，server 啟動及每日定時清理
- 優化 Recent Events 元件：從 3 行壓縮為 2 行，時間顯示在第一行

## Capabilities

### New Capabilities
- `logs-page`: Dashboard 的 Logs 頁面，提供完整 event 瀏覽、篩選、分頁功能
- `auto-retention`: 自動清理過期 events，可配置保留天數

### Modified Capabilities
- `dashboard`: Recent Events 元件 UI 緊湊化調整

## Impact

- `apps/dashboard-local`: 新增 LogsPage，修改 RecentEventsTimeline 元件
- `packages/server`: 調整 events route，新增 retention scheduler
- `packages/cli`: 可能新增 retention 設定選項
