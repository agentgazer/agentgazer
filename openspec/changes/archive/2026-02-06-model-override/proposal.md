## Why

AgentGazer 目前只能「觀察」agent 使用哪個 model，無法控制。用戶需要成本控制（強制使用便宜 model）、快速測試（切換 model 看效果）、集中管理（不用改 agent code 就能切換 model）。由於一個 agent 可能使用多個 provider，需要 per-agent-per-provider 的 override 規則。

## What Changes

- 新增 `agent_model_rules` table 儲存 per-agent-per-provider 的 model override 規則
- `agent_events` table 新增 `requested_model` 欄位，記錄 agent 原本請求的 model
- Proxy 在轉發前檢查 override 規則，改寫 request body 的 model 欄位
- Dashboard Agents 列表顯示使用的 Providers（從 events 自動發現）+ override 指示器
- Dashboard Agent Detail 新增 Model Settings 區塊，per-provider 的 model 下拉選單
- Dashboard Request Log 顯示 Requested vs Actual model
- Shared package export 可選 model 清單供 Dashboard 使用
- Server 新增 API endpoints 管理 model rules 和取得 model 清單

## Capabilities

### New Capabilities
- `model-override`: Per-agent-per-provider model override rules, including DB schema, proxy rewrite logic, server API, and dashboard UI

### Modified Capabilities
- `local-proxy`: Proxy 需要在轉發前檢查 override 規則並改寫 model
- `dashboard`: Agents 列表新增 Providers 欄位，Agent Detail 新增 Model Settings 控制區塊

## Impact

- **Database**: 新增 `agent_model_rules` table，修改 `agent_events` table
- **Proxy**: 需要查詢 DB 或 API 取得 override 規則
- **Server**: 新增 `/api/agents/:id/model-rules` 和 `/api/models` endpoints
- **Shared**: 新增 `SELECTABLE_MODELS` export
- **Dashboard**: 修改 AgentsPage、AgentDetailPage
