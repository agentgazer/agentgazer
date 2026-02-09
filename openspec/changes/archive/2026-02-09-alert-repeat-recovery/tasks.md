## 1. Schema Migration

- [x] 1.1 新增 alert_rules 欄位: repeat_enabled, repeat_interval_minutes, recovery_notify, state, last_triggered_at, budget_period
- [x] 1.2 設定既有 rules 的預設值 (repeat_enabled=1, state='normal')

## 2. Alert Evaluator 重構

- [x] 2.1 移除 hardcoded 15 分鐘 cooldown，改用 rule 的 repeat_interval_minutes
- [x] 2.2 實作 state 狀態轉換邏輯 (normal → alerting/fired → normal)
- [x] 2.3 實作 inactive agent 跳過評估
- [x] 2.4 實作恢復條件檢查 (agent_down, error_rate)
- [x] 2.5 實作恢復通知發送
- [x] 2.6 更新 kill_switch alert 邏輯，agent reactivate 時重置 state

## 3. Budget Alert 增強

- [x] 3.1 實作 budget_period (daily/weekly/monthly) 週期計算
- [x] 3.2 實作週期重置邏輯

## 4. API 更新

- [x] 4.1 更新 POST /api/alerts 支援新欄位
- [x] 4.2 更新 GET /api/alerts 回傳新欄位
- [x] 4.3 新增 POST /api/alerts/:id/reset 重置 state

## 5. CLI Alert 命令

- [x] 5.1 新增 `agent <name> alerts` 列出命令
- [x] 5.2 新增 `agent <name> alert add <type>` 新增命令
- [x] 5.3 新增 `agent <name> alert delete <id>` 刪除命令
- [x] 5.4 新增 `agent <name> alert reset <id>` 重置命令
- [x] 5.5 更新 CLI help text

## 6. 測試

- [x] 6.1 測試 repeat 通知間隔 (integration tests pass)
- [x] 6.2 測試一次性通知 (integration tests pass)
- [x] 6.3 測試恢復通知 (integration tests pass)
- [x] 6.4 測試 CLI 命令 (CLI tests pass)

Note: 修復了兩個不相關的測試:
- shared: getProviderAuthHeader 測試更新以反映 google useNativeApi 參數
- server: events API 測試更新以反映分頁支援
