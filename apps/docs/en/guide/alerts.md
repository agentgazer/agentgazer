# Alerts

AgentTrace supports configurable alert rules that notify you when your agents encounter problems. Alerts can be delivered via webhook or email.

## Alert Types

### Agent Down

Triggers when an agent stops sending heartbeats for a specified duration.

```json
{
  "agent_id": "my-agent",
  "rule_type": "agent_down",
  "config": { "duration_minutes": 5 },
  "webhook_url": "https://hooks.slack.com/..."
}
```

### Error Rate

Triggers when the error rate exceeds a threshold within a time window.

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

`threshold` is a percentage (10 = 10% error rate).

### Budget

Triggers when an agent's daily cost exceeds a threshold.

```json
{
  "agent_id": "my-agent",
  "rule_type": "budget",
  "config": { "threshold": 50.0 },
  "email": "ops@example.com"
}
```

`threshold` is in USD.

## Managing Alerts

Alerts are managed via the REST API:

```bash
TOKEN="your-token"

# List all alerts
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/alerts

# Create an alert
curl -X POST http://localhost:8080/api/alerts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my-agent",
    "rule_type": "error_rate",
    "config": { "window_minutes": 60, "threshold": 10 },
    "webhook_url": "https://hooks.slack.com/..."
  }'

# Toggle an alert on/off
curl -X PATCH http://localhost:8080/api/alerts/<id>/toggle \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# Delete an alert
curl -X DELETE http://localhost:8080/api/alerts/<id> \
  -H "Authorization: Bearer $TOKEN"

# View alert history
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/alert-history
```

## Notification Channels

### Webhook

Sends a POST request with JSON payload:

```json
{
  "agent_id": "my-agent",
  "rule_type": "error_rate",
  "message": "Error rate for my-agent exceeded 10% in the last 60 minutes",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

Failed deliveries are retried up to 3 times with exponential backoff.

### Email

Requires SMTP configuration via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | — | SMTP server hostname (required) |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURE` | `false` | Use TLS |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |
| `SMTP_FROM` | `alerts@agenttrace.dev` | Sender address |

## Cooldown

To prevent alert storms, there is a 15-minute cooldown between alert deliveries for the same rule. During cooldown, the alert condition is still checked but notifications are suppressed.
