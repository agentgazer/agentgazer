## ADDED Requirements

### Requirement: Policy check before forwarding

The proxy SHALL check the agent's policy before forwarding any LLM request.

#### Scenario: Active agent allowed
- **WHEN** agent is active=true AND within budget AND within allowed hours
- **THEN** the request SHALL be forwarded to the LLM provider

#### Scenario: Inactive agent blocked
- **WHEN** agent is active=false
- **THEN** the request SHALL NOT be forwarded
- **AND** a fake LLM response SHALL be returned with reason "agent_deactivated"

#### Scenario: Budget exceeded blocked
- **WHEN** agent's daily spend >= budget_limit
- **THEN** the request SHALL NOT be forwarded
- **AND** a fake LLM response SHALL be returned with reason "budget_exceeded"

#### Scenario: Outside allowed hours blocked
- **WHEN** current server time is outside allowed_hours_start to allowed_hours_end
- **THEN** the request SHALL NOT be forwarded
- **AND** a fake LLM response SHALL be returned with reason "outside_allowed_hours"

### Requirement: Fake LLM response format

When a request is blocked, the proxy SHALL return a response that matches the provider's expected format.

#### Scenario: OpenAI fake response
- **WHEN** blocked request was targeting OpenAI (or OpenAI-compatible provider)
- **THEN** the response SHALL be a valid OpenAI chat completion format with message content explaining the block reason

#### Scenario: Anthropic fake response
- **WHEN** blocked request was targeting Anthropic
- **THEN** the response SHALL be a valid Anthropic message format with text content explaining the block reason

### Requirement: Policy check uses shared DB

The proxy SHALL use the same database instance as the server to check policies.

#### Scenario: DB instance passed to proxy
- **WHEN** CLI starts the proxy
- **THEN** the proxy SHALL receive the same DB instance used by the server

#### Scenario: Policy query performance
- **WHEN** checking policy for a request
- **THEN** the DB query SHALL complete in under 10ms for typical workloads

### Requirement: Default agent for unidentified requests

Requests without agent identification SHALL be assigned to a "default" agent.

#### Scenario: No agent-id header
- **WHEN** request has no x-agent-id header AND no /agents/{id}/ path prefix
- **THEN** the request SHALL be assigned to agent_id "default"

#### Scenario: Default agent policy applies
- **WHEN** request is assigned to "default" agent
- **THEN** the default agent's policy settings SHALL be checked
