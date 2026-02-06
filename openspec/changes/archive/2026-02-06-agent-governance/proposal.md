## Why

AgentGazer 目前只能「觀察」LLM 呼叫，無法「控制」。用戶需要能夠暫停 agent、限制預算、設定使用時段，將 AgentGazer 從被動監控工具升級為主動治理平台。

## What Changes

- **新增 Agent Policy 設定**：每個 agent 可獨立設定 active 狀態、每日預算上限、允許使用時段
- **Proxy 執行 Policy**：請求前檢查 policy，違規時回傳假 LLM 回應
- **新增 Agent 路徑識別**：支援 `/agents/{id}/provider/...` 路徑格式，未指定則歸類為 "default" agent
- **記錄 blocked 事件**：被擋的請求記錄為 event，Dashboard 可顯示統計
- **Dashboard Policy UI**：Agent Detail 頁面新增 Policy 設定區塊

## Capabilities

### New Capabilities

- `agent-policy`: Agent 治理 policy 設定與儲存（active、budget_limit、allowed_hours）
- `policy-enforcement`: Proxy 層的 policy 檢查與請求攔截
- `agent-path-routing`: 透過 URL 路徑識別 agent（/agents/{id}/...）
- `blocked-events`: 被 policy 攔截的請求事件記錄與統計

### Modified Capabilities

- `dashboard`: Agent Detail 頁面新增 Policy 設定 UI

## Impact

- **packages/server/src/db.ts**: agents 表新增 policy 欄位、新增 daily spend 查詢
- **packages/server/src/routes/**: 新增 policy CRUD API
- **packages/proxy/src/proxy-server.ts**: 新增 policy 檢查邏輯、假回應生成、path routing
- **packages/cli/src/cli.ts**: 傳遞 DB instance 給 proxy
- **apps/dashboard-local/**: Agent Detail 頁面新增 Policy 設定元件
