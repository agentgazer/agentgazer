## ADDED Requirements

### Requirement: Local SQLite database initialization
The server SHALL create a SQLite database at `~/.agentwatch/data.db` on startup if it does not exist. The database SHALL use WAL mode for concurrent read/write performance. The schema SHALL include tables: `agents`, `agent_events`, `alert_rules`, `alert_history` — matching the existing Supabase schema but without `user_id` columns or RLS.

#### Scenario: First startup creates database
- **WHEN** the server starts and `~/.agentwatch/data.db` does not exist
- **THEN** the server creates the database file with all tables and indexes

#### Scenario: Subsequent startup reuses existing database
- **WHEN** the server starts and `~/.agentwatch/data.db` already exists
- **THEN** the server opens the existing database without data loss

### Requirement: Event ingestion endpoint
The server SHALL expose `POST /api/events` that accepts the same JSON format as the Supabase ingest Edge Function: either `{ events: [...] }` or a single event object. The server SHALL validate each event (required fields: `agent_id`, `event_type`, `source`, `timestamp`). Valid events SHALL be inserted into `agent_events`. The server SHALL upsert the corresponding agent in `agents` (create if not exists, update `updated_at`). Heartbeat events SHALL update `last_heartbeat_at` and set `status` to `healthy`.

#### Scenario: Batch event ingestion
- **WHEN** a POST to `/api/events` contains `{ events: [evt1, evt2] }` with a valid auth token
- **THEN** the server validates each event, inserts valid ones, and returns `{ status: "ok", event_ids: [...], results: [...] }` with status 200 (all valid) or 207 (partial)

#### Scenario: Single event ingestion
- **WHEN** a POST to `/api/events` contains a single event object `{ agent_id: "x", event_type: "heartbeat", ... }`
- **THEN** the server wraps it as a batch of one and processes identically

#### Scenario: Heartbeat event updates agent status
- **WHEN** an event with `event_type: "heartbeat"` is ingested for agent "my-agent"
- **THEN** the `agents` row for "my-agent" has `status = "healthy"` and `last_heartbeat_at` set to current time

#### Scenario: Invalid event in batch
- **WHEN** a batch contains one valid and one invalid event (e.g., missing `agent_id`)
- **THEN** the valid event is inserted, the invalid one is rejected, and the response has status 207 with per-event results

### Requirement: Agent listing endpoint
The server SHALL expose `GET /api/agents` that returns all agents ordered by `updated_at` descending.

#### Scenario: List agents
- **WHEN** a GET request is made to `/api/agents` with a valid auth token
- **THEN** the server returns `{ agents: [...] }` with each agent's `id`, `agent_id`, `name`, `status`, `last_heartbeat_at`, `created_at`, `updated_at`

### Requirement: Agent detail endpoint
The server SHALL expose `GET /api/agents/:agentId` that returns a single agent by its `agent_id`.

#### Scenario: Get existing agent
- **WHEN** a GET request is made to `/api/agents/my-agent` and the agent exists
- **THEN** the server returns the agent object with status 200

#### Scenario: Agent not found
- **WHEN** a GET request is made to `/api/agents/nonexistent`
- **THEN** the server returns status 404 with `{ error: "Agent not found" }`

### Requirement: Events query endpoint
The server SHALL expose `GET /api/events` with query parameters: `agent_id` (required), `from` (ISO timestamp), `to` (ISO timestamp), `event_type` (filter), `limit` (default 1000). Results SHALL be ordered by `timestamp` descending.

#### Scenario: Query events with time range
- **WHEN** a GET request is made to `/api/events?agent_id=my-agent&from=2025-01-01T00:00:00Z&to=2025-01-02T00:00:00Z`
- **THEN** the server returns events for "my-agent" within that time range

#### Scenario: Query events with type filter
- **WHEN** a GET request is made to `/api/events?agent_id=my-agent&event_type=error`
- **THEN** the server returns only error events for "my-agent"

### Requirement: Stats endpoint
The server SHALL expose `GET /api/stats/:agentId` with query parameter `range` (one of: `1h`, `24h`, `7d`, `30d`, `custom`) and optional `from`/`to` for custom range. The server SHALL return pre-aggregated statistics: `total_requests`, `total_errors`, `error_rate`, `total_cost`, `total_tokens`, `p50_latency`, `p99_latency`, cost breakdown by model, and token time-series data.

#### Scenario: Get stats for last 24 hours
- **WHEN** a GET request is made to `/api/stats/my-agent?range=24h`
- **THEN** the server returns aggregated stats for the last 24 hours

#### Scenario: Get stats for custom range
- **WHEN** a GET request is made to `/api/stats/my-agent?range=custom&from=2025-01-01T00:00:00Z&to=2025-01-07T00:00:00Z`
- **THEN** the server returns aggregated stats for that custom range

### Requirement: Alert rules CRUD
The server SHALL expose endpoints for managing alert rules:
- `GET /api/alerts` — list all alert rules
- `POST /api/alerts` — create a new alert rule
- `PUT /api/alerts/:id` — update an existing alert rule
- `DELETE /api/alerts/:id` — delete an alert rule
- `PATCH /api/alerts/:id/toggle` — enable/disable a rule

#### Scenario: Create alert rule
- **WHEN** a POST to `/api/alerts` contains `{ agent_id: "x", rule_type: "agent_down", config: { duration_minutes: 10 }, webhook_url: "https://..." }`
- **THEN** the server creates the rule and returns it with an `id` and status 201

#### Scenario: Toggle alert rule
- **WHEN** a PATCH to `/api/alerts/:id/toggle` contains `{ enabled: false }`
- **THEN** the server updates the rule's `enabled` field and returns the updated rule

### Requirement: Alert history endpoint
The server SHALL expose `GET /api/alert-history` with optional `limit` parameter (default 100). Results SHALL be ordered by `delivered_at` descending.

#### Scenario: List alert history
- **WHEN** a GET request is made to `/api/alert-history`
- **THEN** the server returns the most recent 100 alert delivery records

### Requirement: Alert evaluation
The server SHALL periodically evaluate enabled alert rules (every 60 seconds). For each rule:
- `agent_down`: check if agent's `last_heartbeat_at` is older than `config.duration_minutes`
- `error_rate`: check if error rate in `config.window_minutes` exceeds `config.threshold`%
- `budget`: check if total `cost_usd` today exceeds `config.threshold`

When a rule triggers, the server SHALL deliver a webhook POST and record the delivery in `alert_history`. A cooldown of 15 minutes per rule SHALL prevent duplicate alerts.

#### Scenario: Agent down alert fires
- **WHEN** agent "my-agent" has `last_heartbeat_at` older than 10 minutes and there is an enabled `agent_down` rule with `duration_minutes: 10`
- **THEN** the server sends a webhook POST and inserts a record into `alert_history`

#### Scenario: Alert cooldown prevents duplicate
- **WHEN** an alert for rule X was delivered 5 minutes ago
- **THEN** the server skips evaluation of rule X until the 15-minute cooldown expires

### Requirement: Serve static dashboard files
The server SHALL serve the built Vite dashboard as static files. All non-API routes (`GET /*` where path does not start with `/api/`) SHALL return `index.html` to support client-side routing.

#### Scenario: Dashboard page load
- **WHEN** a browser navigates to `http://localhost:8080/agents/my-agent`
- **THEN** the server returns `index.html` and the React SPA handles routing

### Requirement: Health check
The server SHALL expose `GET /api/health` (no auth required) returning `{ status: "ok", uptime_ms: <number> }`.

#### Scenario: Health check
- **WHEN** a GET request is made to `/api/health`
- **THEN** the server returns 200 with status "ok" and uptime in milliseconds
