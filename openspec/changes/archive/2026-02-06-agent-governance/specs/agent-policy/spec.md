## ADDED Requirements

### Requirement: Agent policy data model

The system SHALL store the following policy fields for each agent:
- `active` (boolean): Whether the agent is enabled
- `budget_limit` (number, nullable): Daily spending cap in USD, NULL means no limit
- `allowed_hours_start` (integer 0-23, nullable): Start of allowed time window
- `allowed_hours_end` (integer 0-23, nullable): End of allowed time window

#### Scenario: New agent has default policy
- **WHEN** a new agent is created (first event received)
- **THEN** the agent SHALL have active=true, budget_limit=NULL, allowed_hours=NULL

#### Scenario: Policy fields stored in agents table
- **WHEN** querying the agents table
- **THEN** the active, budget_limit, allowed_hours_start, allowed_hours_end columns SHALL be available

### Requirement: Get agent policy API

The system SHALL provide `GET /api/agents/:agentId/policy` endpoint that returns the agent's policy settings.

#### Scenario: Get existing agent policy
- **WHEN** GET /api/agents/my-agent/policy is called
- **THEN** the response SHALL include { active, budget_limit, allowed_hours_start, allowed_hours_end }

#### Scenario: Get non-existent agent policy
- **WHEN** GET /api/agents/unknown-agent/policy is called
- **THEN** the response SHALL be 404 Not Found

### Requirement: Update agent policy API

The system SHALL provide `PUT /api/agents/:agentId/policy` endpoint to update policy settings.

#### Scenario: Deactivate agent
- **WHEN** PUT /api/agents/my-agent/policy with { active: false }
- **THEN** the agent's active field SHALL be set to false

#### Scenario: Set budget limit
- **WHEN** PUT /api/agents/my-agent/policy with { budget_limit: 20.00 }
- **THEN** the agent's budget_limit SHALL be set to 20.00

#### Scenario: Set allowed hours
- **WHEN** PUT /api/agents/my-agent/policy with { allowed_hours_start: 9, allowed_hours_end: 18 }
- **THEN** the agent SHALL only be allowed to make requests between 09:00 and 18:00 server local time

#### Scenario: Clear budget limit
- **WHEN** PUT /api/agents/my-agent/policy with { budget_limit: null }
- **THEN** the agent's budget_limit SHALL be cleared (no limit)

### Requirement: Calculate daily spend

The system SHALL provide a function to calculate an agent's total spending for the current day.

#### Scenario: Calculate spend from events
- **WHEN** calculating daily spend for agent "my-agent"
- **THEN** the system SHALL SUM cost_usd from agent_events WHERE agent_id='my-agent' AND timestamp is today (server local time)

#### Scenario: No events today
- **WHEN** the agent has no events today
- **THEN** the daily spend SHALL be 0
