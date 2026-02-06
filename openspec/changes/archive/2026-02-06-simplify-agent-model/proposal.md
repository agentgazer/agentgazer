## Why

Agent 的 `status` 欄位（healthy/degraded/down/unknown）在實務上無法可靠計算。Proxy 用戶永遠卡在 unknown，因為他們不發 heartbeat；而 degraded/down 從未有任何邏輯去設定。這個欄位造成混淆且沒有實際價值。同時，Agents 列表頁面缺乏關鍵的成本和用量資訊，無法快速識別高消耗的 agent。

## What Changes

**移除**
- **BREAKING**: `agents.status` 欄位（healthy/degraded/down/unknown）
- **BREAKING**: `agents.last_heartbeat_at` 欄位（改用 `updated_at`）
- StatusBadge 組件
- Agents 頁面的 Status filter
- Agents 頁面的 Actions 欄位

**修改**
- `agent_down` alert rule 改用 `updated_at` 判斷，UI 顯示為 "Agent Inactive"
- Agent ID 改為可點擊連結，直接進入詳細頁

**新增**
- Agents 列表新增 Active toggle 欄位（直接在列表切換）
- Agents 列表新增 Total Tokens 欄位
- Agents 列表新增 Total Cost 欄位
- Agents 列表新增 Today Cost 欄位

## Capabilities

### New Capabilities
- `agents-list-enhanced`: Agents 列表頁面增強，顯示用量和成本統計，支援 inline active toggle

### Modified Capabilities
- `alerting`: agent_down rule 改用 updated_at 判斷活動狀態，而非 last_heartbeat_at

## Impact

- **Database**: agents 表移除 status 和 last_heartbeat_at 欄位
- **Server API**: /api/agents 回傳格式變更，移除 status/last_heartbeat，新增 total_tokens/total_cost/today_cost
- **Dashboard**: OverviewPage, AgentsPage 移除 status 相關顯示，AgentsPage 大幅改版
- **Alert Evaluator**: agent_down 邏輯改用 updated_at
- **SDK**: heartbeat() 功能保留，但語義上就是更新 updated_at
