## ADDED Requirements

### Requirement: Record blocked requests as events

When a request is blocked by policy, the proxy SHALL record a blocked event.

#### Scenario: Blocked event created
- **WHEN** a request is blocked due to policy
- **THEN** an event with event_type "blocked" SHALL be inserted into agent_events

#### Scenario: Blocked event contains reason
- **WHEN** a blocked event is created
- **THEN** the event tags SHALL include block_reason with value "agent_deactivated", "budget_exceeded", or "outside_allowed_hours"

#### Scenario: Blocked event contains request metadata
- **WHEN** a blocked event is created
- **THEN** the event SHALL include provider, model (if detectable from request), and timestamp

### Requirement: Blocked event type in schema

The agent_events table SHALL support "blocked" as a valid event_type.

#### Scenario: Insert blocked event
- **WHEN** inserting an event with event_type "blocked"
- **THEN** the insert SHALL succeed

#### Scenario: Query blocked events
- **WHEN** querying events with event_type filter "blocked"
- **THEN** only blocked events SHALL be returned

### Requirement: Blocked events statistics

The system SHALL provide statistics on blocked events.

#### Scenario: Count blocked events
- **WHEN** requesting agent stats
- **THEN** the response SHALL include blocked_count (total blocked events)

#### Scenario: Blocked by reason breakdown
- **WHEN** requesting agent stats
- **THEN** the response SHALL include counts per block_reason
