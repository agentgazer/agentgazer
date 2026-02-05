# API 參考

所有 API 端點皆需認證，使用以下任一方式：

- Header：`Authorization: Bearer <token>`
- Header：`x-api-key: <token>`

## 事件（Events）

### POST /api/events

接收批次或單一事件。

**請求格式 — 批次發送：**

```json
{
  "events": [
    {
      "agent_id": "my-agent",
      "event_type": "llm_call",
      "source": "sdk",
      "timestamp": "2025-01-15T10:30:00.000Z",
      "provider": "openai",
      "model": "gpt-4o",
      "tokens_in": 500,
      "tokens_out": 200,
      "tokens_total": 700,
      "cost_usd": 0.0035,
      "latency_ms": 1200,
      "status_code": 200,
      "error_message": null,
      "tags": {}
    }
  ]
}
```

**請求格式 — 單一事件：**

```json
{
  "agent_id": "my-agent",
  "event_type": "heartbeat",
  "source": "sdk",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

**事件類型：** `llm_call` | `completion` | `heartbeat` | `error` | `custom`

**事件來源：** `sdk` | `proxy`

**欄位說明：**

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `agent_id` | string | 是 | Agent 識別碼（最長 256 字元） |
| `event_type` | string | 是 | 事件類型 |
| `source` | string | 是 | 資料來源（sdk / proxy） |
| `timestamp` | string | 是 | ISO-8601 時間戳 |
| `provider` | string | 否 | LLM Provider 名稱 |
| `model` | string | 否 | 模型名稱 |
| `tokens_in` | number | 否 | 輸入 token 數 |
| `tokens_out` | number | 否 | 輸出 token 數 |
| `tokens_total` | number | 否 | 總 token 數 |
| `cost_usd` | number | 否 | 花費（USD） |
| `latency_ms` | number | 否 | 延遲（毫秒） |
| `status_code` | number | 否 | HTTP 狀態碼 |
| `error_message` | string | 否 | 錯誤訊息（最長 10,000 字元） |
| `tags` | object | 否 | 自定義標籤（JSON 物件） |

**回應狀態碼：**

| 狀態碼 | 說明 |
|--------|------|
| `200 OK` | 所有事件驗證通過並已儲存 |
| `207 Multi-Status` | 部分事件驗證失敗，有效事件已儲存 |
| `400 Bad Request` | 所有事件驗證失敗或 JSON 格式錯誤 |
| `401 Unauthorized` | Token 無效 |
| `429 Too Many Requests` | 速率限制（每分鐘 1000 個事件），回應包含 `Retry-After` header |

### GET /api/events

查詢事件，支援以下篩選參數：

| 參數 | 必填 | 說明 |
|------|------|------|
| `agent_id` | 是 | Agent 識別碼 |
| `from` | 否 | 起始時間（ISO-8601） |
| `to` | 否 | 結束時間（ISO-8601） |
| `event_type` | 否 | 事件類型篩選 |
| `provider` | 否 | Provider 篩選 |
| `model` | 否 | 模型篩選 |
| `trace_id` | 否 | Trace ID 篩選 |
| `search` | 否 | 搜尋關鍵字 |
| `limit` | 否 | 回傳筆數上限（最大 10000） |

### GET /api/events/export

匯出事件資料，支援 CSV 或 JSON 格式，上限 100000 筆。

## Agent

### GET /api/agents

列出所有 Agent，支援分頁與搜尋。

| 參數 | 說明 |
|------|------|
| `limit` | 每頁筆數 |
| `offset` | 偏移量 |
| `search` | 搜尋關鍵字 |
| `status` | 狀態篩選（healthy / degraded / down） |

### GET /api/agents/:agentId

取得特定 Agent 的詳細資訊。

## 統計（Stats）

### GET /api/stats/overview

取得跨所有 Agent 的彙總統計。

| 參數 | 說明 |
|------|------|
| `range` | 時間範圍：`1h`、`24h`、`7d`、`30d` |

### GET /api/stats/:agentId

取得特定 Agent 的統計數據。

| 參數 | 說明 |
|------|------|
| `range` | 預設時間範圍：`1h`、`24h`、`7d`、`30d` |
| `from` | 自定義起始時間（ISO-8601） |
| `to` | 自定義結束時間（ISO-8601） |

## 告警（Alerts）

### GET /api/alerts

列出告警規則。

| 參數 | 說明 |
|------|------|
| `limit` | 每頁筆數 |
| `offset` | 偏移量 |
| `agent_id` | Agent 篩選 |
| `rule_type` | 規則類型篩選 |

### POST /api/alerts

建立告警規則。

```json
{
  "agent_id": "my-agent",
  "rule_type": "error_rate",
  "config": {
    "threshold": 20,
    "window_minutes": 5
  },
  "webhook_url": "https://hooks.example.com/alert",
  "email": "ops@example.com",
  "enabled": true
}
```

### PUT /api/alerts/:id

更新告警規則（完整更新）。

### DELETE /api/alerts/:id

刪除告警規則。

### PATCH /api/alerts/:id/toggle

切換告警規則的啟用/停用狀態。

### GET /api/alert-history

列出告警觸發歷史記錄。

## 認證（Auth）

### POST /api/auth/verify

驗證 Token 是否有效。

```json
{
  "token": "your-token"
}
```

回傳：

```json
{
  "valid": true
}
```

## 健康檢查（Health）

### GET /api/health

伺服器健康狀態。

```json
{
  "status": "ok"
}
```
