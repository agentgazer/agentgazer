## ADDED Requirements

### Requirement: Path-based agent identification

The proxy SHALL support identifying agents via URL path prefix `/agents/{agent-id}/`.

#### Scenario: Agent ID in path
- **WHEN** request URL is `/agents/my-bot/openai/v1/chat/completions`
- **THEN** agent_id SHALL be extracted as "my-bot"
- **AND** the remaining path `/openai/v1/chat/completions` SHALL be used for provider routing

#### Scenario: No agent path prefix
- **WHEN** request URL is `/openai/v1/chat/completions` (no /agents/ prefix)
- **THEN** agent_id SHALL default to "default"

#### Scenario: Path with header override
- **WHEN** request URL is `/agents/path-agent/openai/...` AND x-agent-id header is "header-agent"
- **THEN** agent_id SHALL be "header-agent" (header takes priority)

### Requirement: Agent identification priority

The proxy SHALL determine agent ID using this priority order:
1. x-agent-id header (highest priority)
2. /agents/{id}/ path prefix
3. "default" (fallback)

#### Scenario: Header present
- **WHEN** x-agent-id header is present
- **THEN** the header value SHALL be used regardless of path

#### Scenario: Path present without header
- **WHEN** x-agent-id header is absent AND path starts with /agents/{id}/
- **THEN** the path agent ID SHALL be used

#### Scenario: Neither present
- **WHEN** x-agent-id header is absent AND path does not start with /agents/
- **THEN** agent_id SHALL be "default"

### Requirement: Auto-create agent on first request

When a request identifies a new agent ID, the agent SHALL be created automatically.

#### Scenario: New agent via path
- **WHEN** request URL is `/agents/new-agent/openai/...` AND "new-agent" does not exist
- **THEN** an agent with agent_id "new-agent" SHALL be created with default policy

#### Scenario: Default agent auto-creation
- **WHEN** first request without agent identification arrives AND "default" agent does not exist
- **THEN** an agent with agent_id "default" SHALL be created
