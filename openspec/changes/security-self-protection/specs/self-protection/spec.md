## ADDED Requirements

### Requirement: Detect AgentGazer path access
The system SHALL detect when request or response content contains references to AgentGazer's internal paths.

Patterns to detect:
- `~/.agentgazer/` or `$HOME/.agentgazer/`
- `.agentgazer/data.db`
- `.agentgazer/config.json`
- `.agentgazer/secrets`

#### Scenario: Request contains AgentGazer path
- **WHEN** a request message contains `~/.agentgazer/data.db`
- **THEN** the request SHALL be blocked
- **AND** an alert SHALL be generated with severity "critical"
- **AND** a security event SHALL be logged with event_type "self_protection"

#### Scenario: Response contains AgentGazer path
- **WHEN** an LLM response contains `cat ~/.agentgazer/config.json`
- **THEN** the response SHALL be blocked
- **AND** an alert SHALL be generated

### Requirement: Detect AgentGazer database queries
The system SHALL detect SQL queries targeting AgentGazer's internal tables.

Tables to protect:
- agent_events
- agents
- alert_rules
- alert_history
- security_events
- security_config

#### Scenario: SELECT query on protected table
- **WHEN** request content contains `SELECT * FROM agent_events`
- **THEN** the request SHALL be blocked
- **AND** an alert SHALL be generated

#### Scenario: INSERT query on protected table
- **WHEN** request content contains `INSERT INTO agents`
- **THEN** the request SHALL be blocked

#### Scenario: DELETE query on protected table
- **WHEN** request content contains `DELETE FROM alert_rules`
- **THEN** the request SHALL be blocked

### Requirement: Self-protection enabled by default
The self-protection check SHALL be enabled by default and cannot be disabled through per-agent configuration.

#### Scenario: New agent inherits self-protection
- **WHEN** a new agent is created
- **THEN** self-protection SHALL be active for that agent

#### Scenario: Self-protection cannot be disabled via API
- **WHEN** an API request attempts to disable self-protection
- **THEN** the request SHALL be rejected or the setting ignored

### Requirement: Self-protection generates alerts
When self-protection blocks a request or response, the system SHALL generate an alert.

#### Scenario: Alert on blocked request
- **WHEN** self-protection blocks a request
- **THEN** an alert SHALL be created with:
  - rule_type: "security"
  - severity: "critical"
  - message containing the matched pattern
