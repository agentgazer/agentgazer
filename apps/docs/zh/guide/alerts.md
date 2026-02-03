# 告警系統

AgentTrace 支援可設定的告警規則，在 agent 出問題時通知你。告警可透過 webhook 或 email 發送。

## 告警類型

### Agent 離線（agent_down）

當 agent 停止送出心跳超過指定時間時觸發。

```json
{
  "agent_id": "my-agent",
  "rule_type": "agent_down",
  "config": { "duration_minutes": 5 },
  "webhook_url": "https://hooks.slack.com/..."
}
```

### 錯誤率（error_rate）

當錯誤率在時間視窗內超過閾值時觸發。

```json
{
  "agent_id": "my-agent",
  "rule_type": "error_rate",
  "config": {
    "window_minutes": 60,
    "threshold": 10
  },
  "webhook_url": "https://hooks.slack.com/..."
}
```

`threshold` 是百分比（10 = 10% 錯誤率）。

### 預算（budget）

當 agent 的每日成本超過閾值時觸發。

```json
{
  "agent_id": "my-agent",
  "rule_type": "budget",
  "config": { "threshold": 50.0 },
  "email": "ops@example.com"
}
```

`threshold` 的單位是美元。

## 管理告警

透過 REST API 管理告警：

```bash
TOKEN="your-token"

# 列出所有告警
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/alerts

# 建立告警
curl -X POST http://localhost:8080/api/alerts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my-agent",
    "rule_type": "error_rate",
    "config": { "window_minutes": 60, "threshold": 10 },
    "webhook_url": "https://hooks.slack.com/..."
  }'

# 開關告警
curl -X PATCH http://localhost:8080/api/alerts/<id>/toggle \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# 刪除告警
curl -X DELETE http://localhost:8080/api/alerts/<id> \
  -H "Authorization: Bearer $TOKEN"

# 檢視告警歷史
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/alert-history
```

## 通知管道

### Webhook

發送 POST 請求，包含 JSON 內容：

```json
{
  "agent_id": "my-agent",
  "rule_type": "error_rate",
  "message": "Error rate for my-agent exceeded 10% in the last 60 minutes",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

失敗時會重試最多 3 次，使用指數退避（1 秒、4 秒、16 秒）。

### Email

需要透過環境變數設定 SMTP：

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `SMTP_HOST` | — | SMTP 伺服器主機名（必填） |
| `SMTP_PORT` | `587` | SMTP 埠號 |
| `SMTP_SECURE` | `false` | 使用 TLS |
| `SMTP_USER` | — | SMTP 使用者名稱 |
| `SMTP_PASS` | — | SMTP 密碼 |
| `SMTP_FROM` | `alerts@agenttrace.dev` | 寄件者地址 |

## 冷卻時間

為防止告警風暴，同一規則的告警送出之間有 15 分鐘的冷卻時間。冷卻期間仍會檢查告警條件，但通知會被抑制。
