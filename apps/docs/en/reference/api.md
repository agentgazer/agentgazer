# API Reference

All API endpoints require authentication using one of the following methods:

- Header: `Authorization: Bearer <token>`
- Header: `x-api-key: <token>`

## Events

### POST /api/events

Accepts batch or single events.

**Request format — Batch:**

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

**Request format — Single event:**

```json
{
  "agent_id": "my-agent",
  "event_type": "heartbeat",
  "source": "sdk",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

**Event types:** `llm_call` | `completion` | `heartbeat` | `error` | `custom`

**Event sources:** `sdk` | `proxy`

**Field descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agent_id` | string | Yes | Agent identifier (max 256 characters) |
| `event_type` | string | Yes | Event type |
| `source` | string | Yes | Data source (sdk / proxy) |
| `timestamp` | string | Yes | ISO-8601 timestamp |
| `provider` | string | No | LLM Provider name |
| `model` | string | No | Model name |
| `tokens_in` | number | No | Input token count |
| `tokens_out` | number | No | Output token count |
| `tokens_total` | number | No | Total token count |
| `cost_usd` | number | No | Cost (USD) |
| `latency_ms` | number | No | Latency (milliseconds) |
| `status_code` | number | No | HTTP status code |
| `error_message` | string | No | Error message (max 10,000 characters) |
| `tags` | object | No | Custom tags (JSON object) |

**Response status codes:**

| Status Code | Description |
|-------------|-------------|
| `200 OK` | All events validated and stored |
| `207 Multi-Status` | Some events failed validation; valid events were stored |
| `400 Bad Request` | All events failed validation or malformed JSON |
| `401 Unauthorized` | Invalid Token |
| `429 Too Many Requests` | Rate limited (1,000 events per minute); response includes `Retry-After` header |

### GET /api/events

Query events with the following filter parameters:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `agent_id` | Yes | Agent identifier |
| `from` | No | Start time (ISO-8601) |
| `to` | No | End time (ISO-8601) |
| `event_type` | No | Filter by event type |
| `provider` | No | Filter by Provider |
| `model` | No | Filter by model |
| `trace_id` | No | Filter by Trace ID |
| `search` | No | Search keyword |
| `limit` | No | Maximum number of results (max 10,000) |

### GET /api/events/export

Export event data in CSV or JSON format, up to 100,000 records.

## Agents

### GET /api/agents

List all Agents with pagination and search support.

| Parameter | Description |
|-----------|-------------|
| `limit` | Number of results per page |
| `offset` | Offset |
| `search` | Search keyword |
| `status` | Filter by status (healthy / degraded / down) |

### GET /api/agents/:agentId

Get detailed information for a specific Agent.

## Stats

### GET /api/stats/overview

Get aggregated statistics across all Agents.

| Parameter | Description |
|-----------|-------------|
| `range` | Time range: `1h`, `24h`, `7d`, `30d` |

### GET /api/stats/:agentId

Get statistics for a specific Agent.

| Parameter | Description |
|-----------|-------------|
| `range` | Preset time range: `1h`, `24h`, `7d`, `30d` |
| `from` | Custom start time (ISO-8601) |
| `to` | Custom end time (ISO-8601) |

## Alerts

### GET /api/alerts

List alert rules.

| Parameter | Description |
|-----------|-------------|
| `limit` | Number of results per page |
| `offset` | Offset |
| `agent_id` | Filter by Agent |
| `rule_type` | Filter by rule type |

### POST /api/alerts

Create an alert rule.

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

Update an alert rule (full replacement).

### DELETE /api/alerts/:id

Delete an alert rule.

### PATCH /api/alerts/:id/toggle

Toggle an alert rule's enabled/disabled state.

### GET /api/alert-history

List alert trigger history records.

## Auth

### POST /api/auth/verify

Verify whether a Token is valid.

```json
{
  "token": "your-token"
}
```

Response:

```json
{
  "valid": true
}
```

## Health Check

### GET /api/health

Server health status.

```json
{
  "status": "ok"
}
```
