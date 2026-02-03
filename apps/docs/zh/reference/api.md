# API 參考

所有端點需要在 `Authorization` header 中帶 Bearer token：

```
Authorization: Bearer <token>
```

Token 在 `agenttrace onboard` 時產生，存在 `~/.agenttrace/config.json`。

Base URL: `http://localhost:8080`（預設）

## 健康檢查

### `GET /api/health`

回傳伺服器健康狀態。

**回應：**

```json
{ "status": "ok", "uptime_ms": 12345 }
```

## Agent

### `GET /api/agents`

列出所有已知的 agent。

**回應：**

```json
{ "agents": [{ "agent_id": "my-agent", "last_seen": "2025-01-15T10:00:00Z", "status": "healthy" }] }
```

### `GET /api/agents/:agentId`

取得特定 agent。

**回應：** Agent 物件或 `404`。

## 事件

### `POST /api/events`

接收一個或多個事件。

**請求本體** — 單一事件：

```json
{
  "agent_id": "my-agent",
  "event_type": "llm_call",
  "provider": "openai",
  "model": "gpt-4o",
  "tokens_in": 150,
  "tokens_out": 50,
  "latency_ms": 1200,
  "status_code": 200,
  "source": "sdk",
  "timestamp": "2025-01-15T10:00:00Z"
}
```

**請求本體** — 批次：

```json
{
  "events": [
    { "agent_id": "my-agent", "event_type": "llm_call", "..." : "..." },
    { "agent_id": "my-agent", "event_type": "heartbeat", "..." : "..." }
  ]
}
```

**回應：**

```json
{ "status": "ok", "event_ids": ["uuid-1", "uuid-2"], "results": [...] }
```

| 狀態碼 | 意義 |
|--------|------|
| `200` | 所有事件已接受 |
| `207` | 部分成功（部分事件無效） |
| `400` | 所有事件無效 |

### `GET /api/events`

查詢 agent 的事件。

**查詢參數：**

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `agent_id` | string | 是 | Agent 識別碼 |
| `from` | ISO 8601 | 否 | 開始時間 |
| `to` | ISO 8601 | 否 | 結束時間 |
| `event_type` | string | 否 | `llm_call`, `completion`, `heartbeat`, `error`, `custom` |
| `provider` | string | 否 | Provider 名稱 |
| `model` | string | 否 | 模型識別碼 |
| `trace_id` | string | 否 | 依 trace 篩選 |
| `search` | string | 否 | 全文搜尋 |
| `limit` | number | 否 | 最大回傳數 |

**回應：**

```json
{ "events": [...] }
```

### `GET /api/events/export`

匯出事件為 JSON 或 CSV。

**查詢參數：**

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `agent_id` | string | 是 | Agent 識別碼 |
| `format` | string | 否 | `json`（預設）或 `csv` |
| `from` | ISO 8601 | 否 | 開始時間 |
| `to` | ISO 8601 | 否 | 結束時間 |
| `event_type` | string | 否 | 依類型篩選 |
| `provider` | string | 否 | 依 provider 篩選 |
| `model` | string | 否 | 依模型篩選 |
| `trace_id` | string | 否 | 依 trace 篩選 |

## 統計

### `GET /api/stats/:agentId`

取得 agent 的彙總統計。

**查詢參數：**

| 參數 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| `range` | string | `24h` | `1h`, `24h`, `7d`, `30d` 或 `custom` |
| `from` | ISO 8601 | — | 開始時間（`custom` 範圍用） |
| `to` | ISO 8601 | — | 結束時間（`custom` 範圍用） |

**回應：**

```json
{
  "total_requests": 1500,
  "total_errors": 12,
  "error_rate": 0.8,
  "total_cost": 3.45,
  "total_tokens": 250000,
  "p50_latency": 800,
  "p99_latency": 3200,
  "cost_by_model": [
    { "model": "gpt-4o", "provider": "openai", "cost": 2.10, "count": 800 }
  ],
  "token_series": [
    { "timestamp": "2025-01-15T10:00:00Z", "tokens_in": 1500, "tokens_out": 500 }
  ]
}
```

## 告警

### `GET /api/alerts`

列出所有告警規則。

### `POST /api/alerts`

建立告警規則。

**請求本體：**

```json
{
  "agent_id": "my-agent",
  "rule_type": "error_rate",
  "config": { "window_minutes": 60, "threshold": 10 },
  "enabled": true,
  "webhook_url": "https://hooks.slack.com/..."
}
```

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `agent_id` | string | 是 | 目標 agent |
| `rule_type` | string | 是 | `agent_down`, `error_rate` 或 `budget` |
| `config` | object | 是 | 規則專屬設定 |
| `enabled` | boolean | 否 | 預設: `true` |
| `webhook_url` | string | 條件式 | Webhook URL（`webhook_url` 或 `email` 至少填一個） |
| `email` | string | 條件式 | Email 地址 |

### `PUT /api/alerts/:id`

更新告警規則。

### `PATCH /api/alerts/:id/toggle`

開關告警。

**請求本體：**

```json
{ "enabled": false }
```

### `DELETE /api/alerts/:id`

刪除告警規則。回傳 `204 No Content`。

### `GET /api/alert-history`

取得告警發送歷史。

**查詢參數：**

| 參數 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| `limit` | number | `100` | 最大回傳數 |

## 事件 Schema

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | UUID | 自動產生 |
| `agent_id` | string | Agent 識別碼 |
| `event_type` | string | `llm_call`, `completion`, `heartbeat`, `error`, `custom` |
| `provider` | string | Provider 名稱 |
| `model` | string | 模型識別碼 |
| `tokens_in` | number | 輸入 token 數 |
| `tokens_out` | number | 輸出 token 數 |
| `tokens_total` | number | 總 token 數 |
| `cost_usd` | number | 計算的成本（美元） |
| `latency_ms` | number | 請求耗時 |
| `status_code` | number | HTTP 狀態碼 |
| `error_message` | string | 錯誤描述 |
| `tags` | object | 自訂中繼資料 |
| `source` | string | `sdk` 或 `proxy` |
| `timestamp` | ISO 8601 | 事件時間戳記 |
| `trace_id` | string | 分散式追蹤 ID |
| `span_id` | string | Span ID |
| `parent_span_id` | string | 父 Span ID |
