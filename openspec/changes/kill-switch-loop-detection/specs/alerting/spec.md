## ADDED Requirements

### Requirement: Kill Switch Alert Type

The alert system SHALL support a new `kill_switch` alert rule type.

#### Scenario: Create kill switch alert rule
- **WHEN** user creates alert rule with type `kill_switch`
- **THEN** rule SHALL be saved with agent_id and delivery configuration

#### Scenario: Trigger on loop detection
- **WHEN** an agent is blocked due to loop detection
- **THEN** all `kill_switch` alert rules for that agent SHALL be evaluated

#### Scenario: Alert payload content
- **WHEN** kill_switch alert is triggered
- **THEN** payload SHALL include: agent_id, timestamp, loop_score, window_size, blocked_request_count

#### Scenario: Respect cooldown
- **WHEN** kill_switch alert was recently sent for same agent
- **THEN** new alert SHALL NOT be sent until cooldown expires
