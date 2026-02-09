# Config Hierarchy & Settings

## Problem

目前 config.json 結構扁平，缺乏層次：
- Alert 設定（如 Telegram bot token, chat id）每次建立 alert 都要重新輸入
- 沒有地方可以儲存 user 的預設偏好
- Dashboard 無法檢視或編輯設定

## Solution

1. **重構 config.json 結構**：新增層次結構 `server`, `data`, `alerts.defaults`
2. **新增 Settings API**：`GET/PUT /api/settings` 讓 Dashboard 可以讀寫設定
3. **Dashboard Settings 頁面**：讓使用者可視化編輯設定
4. **CLI 自動帶入 defaults**：建立 alert 時自動使用 `alerts.defaults` 的值

## Scope

### In Scope
- Config schema 重構與 migration
- Server settings API endpoints
- Dashboard Settings 頁面
- CLI alert add 讀取 defaults

### Out of Scope
- Provider API keys（已有 secret-store 機制）
- 自動重啟（改 port 後顯示 "restart required" 即可）

## Success Criteria

- [ ] 舊 config 自動 migrate 成新格式
- [ ] Dashboard 可以編輯 server, data, alerts.defaults 設定
- [ ] CLI `agent <name> alert add` 自動帶入已儲存的 telegram/webhook 設定
