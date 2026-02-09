## ADDED Requirements

### Requirement: Events command lists agent events
CLI SHALL provide an `events` command that queries and displays agent events from the server.

#### Scenario: List recent events
- **WHEN** user runs `agentgazer events`
- **THEN** CLI displays events from the last 24 hours in table format
- **AND** shows up to 50 events by default

#### Scenario: Server not running
- **WHEN** user runs `agentgazer events` but server is not running
- **THEN** CLI displays error message suggesting to run `agentgazer start`

### Requirement: Filter by agent
CLI SHALL support filtering events by agent ID.

#### Scenario: Filter single agent
- **WHEN** user runs `agentgazer events --agent openclaw`
- **THEN** CLI displays only events for agent "openclaw"

### Requirement: Filter by event type
CLI SHALL support filtering events by event type.

#### Scenario: Filter by type
- **WHEN** user runs `agentgazer events --type error`
- **THEN** CLI displays only events with event_type "error"

### Requirement: Filter by provider
CLI SHALL support filtering events by provider.

#### Scenario: Filter by provider
- **WHEN** user runs `agentgazer events --provider openai`
- **THEN** CLI displays only events from provider "openai"

### Requirement: Filter by time range
CLI SHALL support filtering events by time range using duration syntax.

#### Scenario: Time range filter
- **WHEN** user runs `agentgazer events --since 1h`
- **THEN** CLI displays only events from the last 1 hour

#### Scenario: Supported durations
- **WHEN** user specifies --since with 1h, 24h, 7d, or 30d
- **THEN** CLI correctly calculates the time range

### Requirement: Limit results
CLI SHALL support limiting the number of results.

#### Scenario: Custom limit
- **WHEN** user runs `agentgazer events --limit 100`
- **THEN** CLI displays up to 100 events

#### Scenario: Max limit
- **WHEN** user specifies --limit greater than 1000
- **THEN** CLI caps the limit at 1000

### Requirement: Search filter
CLI SHALL support searching in event fields.

#### Scenario: Search term
- **WHEN** user runs `agentgazer events --search "timeout"`
- **THEN** CLI displays events where model, provider, or error_message contains "timeout"

### Requirement: Output formats
CLI SHALL support multiple output formats.

#### Scenario: Table output (default)
- **WHEN** user runs `agentgazer events` or `agentgazer events --output table`
- **THEN** CLI displays events in formatted table with columns: TIME, AGENT, TYPE, PROVIDER, MODEL, STATUS, COST

#### Scenario: JSON output
- **WHEN** user runs `agentgazer events --output json`
- **THEN** CLI outputs raw JSON from API response

#### Scenario: CSV output
- **WHEN** user runs `agentgazer events --output csv`
- **THEN** CLI outputs events in CSV format with header row

### Requirement: Follow mode
CLI SHALL support a follow mode that polls for new events.

#### Scenario: Follow mode
- **WHEN** user runs `agentgazer events --follow`
- **THEN** CLI continuously polls for new events every 3 seconds
- **AND** displays only new events since last poll
- **AND** exits when user presses Ctrl+C

### Requirement: Combined filters
CLI SHALL support combining multiple filters.

#### Scenario: Multiple filters
- **WHEN** user runs `agentgazer events --agent openclaw --type error --since 1h`
- **THEN** CLI displays events matching ALL specified filters
