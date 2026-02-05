## ADDED Requirements

### Requirement: Agent API returns consistent field names
The `GET /api/agents` endpoint SHALL return `last_heartbeat` (not `last_heartbeat_at`) in agent objects, matching what the dashboard frontend expects.

#### Scenario: Agent list response field name
- **WHEN** client calls `GET /api/agents`
- **THEN** each agent object in the response SHALL have a `last_heartbeat` field (string or null)

#### Scenario: Dashboard renders agent heartbeat
- **WHEN** the dashboard Overview or Agents page loads
- **THEN** the last heartbeat timestamp SHALL display correctly for each agent
