## ADDED Requirements

### Requirement: Rate limit database storage
系統 SHALL 在 SQLite 中儲存 per-agent per-provider 的 rate limit 設定，包含 agent_id、provider、max_requests、window_seconds。

#### Scenario: Rate limit table exists
- **WHEN** 系統啟動
- **THEN** SQLite 中存在 `agent_rate_limits` table，有 (agent_id, provider) 複合主鍵

### Requirement: List rate limits API
系統 SHALL 提供 `GET /api/agents/:agentId/rate-limits` 列出指定 agent 的所有 rate limit 設定。

#### Scenario: List rate limits for agent
- **WHEN** 對 `/api/agents/my-agent/rate-limits` 發送 GET 請求
- **THEN** 回傳該 agent 所有 provider 的 rate limit 設定 array

#### Scenario: List rate limits for agent with no limits
- **WHEN** 對沒有設定 rate limit 的 agent 發送 GET 請求
- **THEN** 回傳空 array `[]`

### Requirement: Set rate limit API
系統 SHALL 提供 `PUT /api/agents/:agentId/rate-limits/:provider` 設定或更新 rate limit。

#### Scenario: Create new rate limit
- **WHEN** 對 `/api/agents/my-agent/rate-limits/openai` 發送 PUT 請求，body 為 `{ "max_requests": 100, "window_seconds": 60 }`
- **THEN** 建立新的 rate limit 設定並回傳 200

#### Scenario: Update existing rate limit
- **WHEN** 對已存在的 rate limit 發送 PUT 請求
- **THEN** 更新設定並回傳 200

#### Scenario: Invalid rate limit values
- **WHEN** max_requests 或 window_seconds 不是正整數
- **THEN** 回傳 400 錯誤

### Requirement: Delete rate limit API
系統 SHALL 提供 `DELETE /api/agents/:agentId/rate-limits/:provider` 移除 rate limit。

#### Scenario: Delete existing rate limit
- **WHEN** 對存在的 rate limit 發送 DELETE 請求
- **THEN** 移除設定並回傳 200

#### Scenario: Delete non-existent rate limit
- **WHEN** 對不存在的 rate limit 發送 DELETE 請求
- **THEN** 回傳 404 錯誤

### Requirement: Proxy reads rate limits from database
Proxy SHALL 從 SQLite 讀取 rate limits，而非從 config.json。

#### Scenario: Proxy startup
- **WHEN** Proxy 啟動
- **THEN** 從 SQLite 載入所有 agent rate limits

#### Scenario: Proxy periodic refresh
- **WHEN** 每 30 秒
- **THEN** Proxy 從 SQLite 重新載入 rate limits

### Requirement: Proxy enforces per-agent rate limits
Proxy SHALL 根據請求的 agent_id 和 provider 套用對應的 rate limit。

#### Scenario: Request within limit
- **WHEN** agent 的請求數在限制內
- **THEN** 請求正常轉發

#### Scenario: Request exceeds limit
- **WHEN** agent 的請求超過限制
- **THEN** 回傳 429 Too Many Requests

#### Scenario: No rate limit configured
- **WHEN** agent + provider 沒有設定 rate limit
- **THEN** 請求不受限制，正常轉發

### Requirement: Dashboard rate limit management UI
Dashboard Agent Detail 頁面 SHALL 提供 Rate Limits 管理區塊。

#### Scenario: Display existing rate limits
- **WHEN** 使用者進入 Agent Detail 頁面
- **THEN** 顯示該 agent 所有 provider 的 rate limit 設定

#### Scenario: Add new rate limit
- **WHEN** 使用者點擊 Add Rate Limit，選擇 provider 並輸入值
- **THEN** 呼叫 PUT API 新增設定，UI 更新

#### Scenario: Edit rate limit
- **WHEN** 使用者修改 rate limit 值並點擊 Apply
- **THEN** 呼叫 PUT API 更新設定

#### Scenario: Remove rate limit
- **WHEN** 使用者點擊 Remove
- **THEN** 呼叫 DELETE API 移除設定，UI 更新
