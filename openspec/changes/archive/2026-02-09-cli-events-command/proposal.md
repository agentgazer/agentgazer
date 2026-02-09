## Why

Dashboard 現在有 Logs 頁面可以查看和篩選 events，但 CLI 沒有對應的功能。使用者需要能夠在終端機快速查詢 events，不必開啟瀏覽器。

## What Changes

- 新增 `agentgazer events` 命令，支援查詢和篩選 agent events
- 支援多種篩選參數：agent、type、provider、時間範圍
- 支援多種輸出格式：table、json、csv
- 可選的 follow mode 持續監看新 events

## Capabilities

### New Capabilities
- `cli-events`: CLI events 查詢命令，提供類似 Dashboard Logs 頁面的篩選和顯示功能

### Modified Capabilities
（無）

## Impact

- `packages/cli`: 新增 events 命令處理邏輯
- 使用現有的 `/api/events` API，無需後端修改
