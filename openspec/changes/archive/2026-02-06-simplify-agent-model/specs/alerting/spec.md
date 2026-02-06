## MODIFIED Requirements

### Requirement: Agent-down alert

The system SHALL trigger an `agent-down` alert when no activity (any event) has been recorded from a monitored agent for a configurable duration. Activity is determined by the agent's `updated_at` timestamp, which updates on every event including LLM calls from proxy. The default duration MUST be 10 minutes. The user MUST be able to customize the duration per agent. The alert MUST fire once the duration elapses without activity. The UI SHALL display this rule type as "Agent Inactive".

#### Scenario: Agent inactive alert triggers after default duration

- **WHEN** an agent has an `agent_down` alert configured with the default 10-minute duration
- **AND** no events are received for 10 minutes (updated_at is stale)
- **THEN** the system MUST trigger the alert and deliver it through the configured channels

#### Scenario: Agent inactive alert with custom duration

- **WHEN** an agent has an `agent_down` alert configured with a 5-minute custom duration
- **AND** no events are received for 5 minutes
- **THEN** the system MUST trigger the alert

#### Scenario: Activity received before threshold

- **WHEN** an agent has an `agent_down` alert configured with a 10-minute duration
- **AND** any event (llm_call, heartbeat, etc.) arrives after 8 minutes
- **THEN** the system MUST NOT trigger the alert because updated_at was refreshed

#### Scenario: Proxy-only agents are properly monitored

- **WHEN** an agent only uses the proxy (never sends SDK heartbeat)
- **AND** the agent has an `agent_down` alert configured
- **THEN** the system MUST correctly evaluate based on the last LLM call timestamp (updated_at)
