## 1. Database Schema

- [x] 1.1 移除 agents 表的 status 欄位（migration）
- [x] 1.2 移除 agents 表的 last_heartbeat_at 欄位（migration）
- [x] 1.3 更新 upsertAgent() 移除 status 和 last_heartbeat_at 相關邏輯

## 2. Server API

- [x] 2.1 更新 /api/agents 回傳格式：移除 status/last_heartbeat，新增 total_tokens/total_cost/today_cost
- [x] 2.2 更新 agents 查詢 SQL，加入聚合計算 total_tokens/total_cost/today_cost

## 3. Alert Evaluator

- [x] 3.1 修改 evaluateAgentDown() 使用 updated_at 而非 last_heartbeat_at
- [x] 3.2 更新 SQL_AGENT_BY_ID 查詢取得 updated_at

## 4. Dashboard - 移除 Status 相關

- [x] 4.1 刪除 StatusBadge 組件
- [x] 4.2 OverviewPage 移除 StatusBadge 使用
- [x] 4.3 AgentsPage 移除 StatusBadge 使用
- [x] 4.4 AgentsPage 移除 Status filter
- [x] 4.5 AgentDetailPage 移除 status 顯示（如有）

## 5. Dashboard - Agents 列表改版

- [x] 5.1 Agent ID 改為可點擊 Link
- [x] 5.2 移除 Actions 欄位
- [x] 5.3 新增 Active toggle 欄位
- [x] 5.4 新增 Total Tokens 欄位
- [x] 5.5 新增 Total Cost 欄位
- [x] 5.6 新增 Today Cost 欄位
- [x] 5.7 更新 Agent interface 以匹配新的 API 回傳格式

## 6. Dashboard - Alerts 頁面

- [x] 6.1 agent_down rule type 顯示改為 "Agent Inactive"

## 7. 驗證

- [x] 7.1 確認 build 成功
- [x] 7.2 確認測試通過（或更新測試）
