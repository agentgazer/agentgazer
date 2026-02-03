# API Reference

All endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

The token is generated during `agenttrace onboard` and stored in `~/.agenttrace/config.json`.

Base URL: `http://localhost:8080` (default)

## Health

### `GET /api/health`

Returns server health status.

**Response:**

```json
{ "status": "ok", "uptime_ms": 12345 }
```

## Agents

### `GET /api/agents`

List all known agents.

**Response:**

```json
{ "agents": [{ "agent_id": "my-agent", "last_seen": "2025-01-15T10:00:00Z", "status": "healthy" }] }
```

### `GET /api/agents/:agentId`

Get a specific agent by ID.

**Response:** Agent object or `404`.

## Events

### `POST /api/events`

Ingest one or more events.

**Request body** — single event:

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

**Request body** — batch:

```json
{
  "events": [
    { "agent_id": "my-agent", "event_type": "llm_call", "..." : "..." },
    { "agent_id": "my-agent", "event_type": "heartbeat", "..." : "..." }
  ]
}
```

**Response:**

```json
{ "status": "ok", "event_ids": ["uuid-1", "uuid-2"], "results": [...] }
```

| Status | Meaning |
|--------|---------|
| `200` | All events accepted |
| `207` | Partial success (some events invalid) |
| `400` | All events invalid |

### `GET /api/events`

Query events for an agent.

**Query parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `agent_id` | string | Yes | Agent identifier |
| `from` | ISO 8601 | No | Start time |
| `to` | ISO 8601 | No | End time |
| `event_type` | string | No | `llm_call`, `completion`, `heartbeat`, `error`, `custom` |
| `provider` | string | No | Provider name |
| `model` | string | No | Model identifier |
| `trace_id` | string | No | Filter by trace |
| `search` | string | No | Full-text search |
| `limit` | number | No | Max results |

**Response:**

```json
{ "events": [...] }
```

### `GET /api/events/export`

Export events as JSON or CSV.

**Query parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `agent_id` | string | Yes | Agent identifier |
| `format` | string | No | `json` (default) or `csv` |
| `from` | ISO 8601 | No | Start time |
| `to` | ISO 8601 | No | End time |
| `event_type` | string | No | Filter by type |
| `provider` | string | No | Filter by provider |
| `model` | string | No | Filter by model |
| `trace_id` | string | No | Filter by trace |

## Stats

### `GET /api/stats/:agentId`

Get aggregated statistics for an agent.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `range` | string | `24h` | `1h`, `24h`, `7d`, `30d`, or `custom` |
| `from` | ISO 8601 | — | Start time (for `custom` range) |
| `to` | ISO 8601 | — | End time (for `custom` range) |

**Response:**

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

## Alerts

### `GET /api/alerts`

List all alert rules.

### `POST /api/alerts`

Create an alert rule.

**Request body:**

```json
{
  "agent_id": "my-agent",
  "rule_type": "error_rate",
  "config": { "window_minutes": 60, "threshold": 10 },
  "enabled": true,
  "webhook_url": "https://hooks.slack.com/..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agent_id` | string | Yes | Target agent |
| `rule_type` | string | Yes | `agent_down`, `error_rate`, or `budget` |
| `config` | object | Yes | Rule-specific configuration |
| `enabled` | boolean | No | Default: `true` |
| `webhook_url` | string | Conditional | Webhook URL (at least one of `webhook_url` or `email` required) |
| `email` | string | Conditional | Email address |

### `PUT /api/alerts/:id`

Update an alert rule.

### `PATCH /api/alerts/:id/toggle`

Toggle an alert on or off.

**Request body:**

```json
{ "enabled": false }
```

### `DELETE /api/alerts/:id`

Delete an alert rule. Returns `204 No Content`.

### `GET /api/alert-history`

Get alert delivery history.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | `100` | Max results |

## Event Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Auto-generated |
| `agent_id` | string | Agent identifier |
| `event_type` | string | `llm_call`, `completion`, `heartbeat`, `error`, `custom` |
| `provider` | string | Provider name |
| `model` | string | Model identifier |
| `tokens_in` | number | Input token count |
| `tokens_out` | number | Output token count |
| `tokens_total` | number | Total token count |
| `cost_usd` | number | Calculated cost in USD |
| `latency_ms` | number | Request duration |
| `status_code` | number | HTTP status code |
| `error_message` | string | Error description |
| `tags` | object | Custom metadata |
| `source` | string | `sdk` or `proxy` |
| `timestamp` | ISO 8601 | Event timestamp |
| `trace_id` | string | Distributed trace ID |
| `span_id` | string | Span ID |
| `parent_span_id` | string | Parent span ID |
