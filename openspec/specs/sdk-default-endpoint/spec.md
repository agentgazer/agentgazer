## ADDED Requirements

### Requirement: SDK default endpoint points to local server
The SDK SHALL use `http://localhost:8080/api/events` as the default endpoint when the user does not provide an `endpoint` option.

#### Scenario: No endpoint provided
- **WHEN** user calls `AgentGazer.init({ apiKey: "...", agentId: "..." })` without an `endpoint` option
- **THEN** events SHALL be sent to `http://localhost:8080/api/events`

#### Scenario: Custom endpoint overrides default
- **WHEN** user provides `endpoint: "https://custom.example.com/ingest"`
- **THEN** events SHALL be sent to that URL instead of the default
