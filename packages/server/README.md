# @agentgazer/server

Express + SQLite API server for AgentGazer. Handles event ingestion, agent management, statistics, alerting, and serves the web dashboard.

## Usage

### As part of the CLI (typical)

```bash
npx agentgazer
# Server starts on port 8080
```

### Programmatic

```typescript
import { startServer } from "@agentgazer/server";

const { server, shutdown } = await startServer({
  port: 8080,
  token: "your-auth-token",
  dbPath: "/path/to/data.db",
  dashboardDir: "/path/to/dashboard/dist",  // optional
  retentionDays: 30,                        // optional
});

// Later
await shutdown();
```

## API endpoints

All endpoints except `/health` and `/api/auth/verify` require `Authorization: Bearer <token>`.

### Health & auth

- `GET /health` — Server health check
- `POST /api/auth/verify` — Verify auth token

### Events

- `POST /api/events` — Ingest a batch of events (rate-limited: 1000/min per key)
- `GET /api/events` — Query events with filters (`agent_id`, `from`, `to`, `provider`, `model`, `trace_id`, `search`)
- `GET /api/events/export` — Export events as CSV or JSON

### Agents

- `GET /api/agents` — List registered agents
- `POST /api/agents/register` — Register or update an agent
- `POST /api/agents/heartbeat` — Record a heartbeat

### Statistics

- `GET /api/stats/summary` — Aggregated stats (total calls, tokens, cost, errors)
- `GET /api/stats/timeseries` — Time-bucketed stats (`minute`, `hour`, `day`)

### Alerts

- `GET /api/alerts` — List alert rules
- `POST /api/alerts` — Create an alert rule
- `PUT /api/alerts/:id` — Update an alert rule
- `DELETE /api/alerts/:id` — Delete an alert rule
- `PATCH /api/alerts/:id/toggle` — Toggle enabled status
- `GET /api/alert-history` — View alert delivery history

See `openapi.yaml` in this package for the full OpenAPI specification.

## Alert rule types

| Type | Config | Description |
|------|--------|-------------|
| `agent_down` | `{ duration_minutes: number }` | No heartbeat within duration |
| `error_rate` | `{ window_minutes: number, threshold: number }` | Error % exceeds threshold |
| `budget` | `{ threshold: number }` | Daily USD spend exceeds threshold |

Alerts are delivered via webhook and/or email. Webhooks retry up to 3 times with exponential backoff. Email requires SMTP environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).

A 15-minute cooldown prevents duplicate alerts for the same rule.

## Data retention

Old events and alert history are automatically purged based on `retentionDays` (default: 30). Cleanup runs on startup and every 24 hours.

## License

Apache-2.0
