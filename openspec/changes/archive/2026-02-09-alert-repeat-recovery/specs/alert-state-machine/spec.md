## ADDED Requirements

### Requirement: Alert rules support configurable repeat settings
Alert rules SHALL support configurable repeat notification settings.

#### Scenario: Default repeat behavior
- **GIVEN** a new alert rule is created without repeat settings
- **THEN** repeat_enabled defaults to true
- **AND** repeat_interval_minutes defaults to 15

#### Scenario: One-time notification
- **GIVEN** an alert rule with repeat_enabled = false
- **WHEN** the condition is met
- **THEN** notification is sent once
- **AND** state changes to 'fired'
- **AND** no further notifications until condition recovers

#### Scenario: Repeat notification
- **GIVEN** an alert rule with repeat_enabled = true and repeat_interval_minutes = 30
- **WHEN** the condition is met and remains met
- **THEN** notification is sent every 30 minutes
- **AND** state remains 'alerting'

### Requirement: Alert rules track state
Alert rules SHALL track their current state (normal, alerting, fired).

#### Scenario: Initial state
- **GIVEN** a new alert rule
- **THEN** state is 'normal'

#### Scenario: State transition to alerting
- **GIVEN** an alert rule in 'normal' state with repeat_enabled = true
- **WHEN** the condition is met
- **THEN** state changes to 'alerting'

#### Scenario: State transition to fired
- **GIVEN** an alert rule in 'normal' state with repeat_enabled = false
- **WHEN** the condition is met
- **THEN** state changes to 'fired'

#### Scenario: State recovery
- **GIVEN** an alert rule in 'alerting' or 'fired' state
- **WHEN** the condition recovers
- **THEN** state changes to 'normal'

### Requirement: Recovery notifications
Alert rules SHALL support optional recovery notifications.

#### Scenario: Recovery notification enabled
- **GIVEN** an alert rule with recovery_notify = true in 'alerting' state
- **WHEN** the condition recovers
- **THEN** a recovery notification is sent
- **AND** state changes to 'normal'

#### Scenario: Recovery notification disabled
- **GIVEN** an alert rule with recovery_notify = false in 'alerting' state
- **WHEN** the condition recovers
- **THEN** no notification is sent
- **AND** state changes to 'normal'

### Requirement: Inactive agents skip evaluation
Alert evaluation SHALL skip inactive agents.

#### Scenario: Inactive agent
- **GIVEN** an agent with status 'inactive'
- **WHEN** alert evaluation runs
- **THEN** all rules for that agent are skipped
- **AND** no notifications are sent

### Requirement: Each alert type has recovery conditions
Each alert type SHALL have defined recovery conditions.

#### Scenario: agent_down recovery
- **GIVEN** an agent_down alert in alerting state
- **WHEN** the agent sends a heartbeat
- **THEN** the condition is considered recovered

#### Scenario: error_rate recovery
- **GIVEN** an error_rate alert with threshold 10% in alerting state
- **WHEN** the error rate drops to 10% or below
- **THEN** the condition is considered recovered

#### Scenario: budget recovery
- **GIVEN** a budget alert in alerting state
- **WHEN** user calls reset API or new budget period starts
- **THEN** the condition is considered recovered

#### Scenario: kill_switch recovery
- **GIVEN** a kill_switch alert in fired state
- **WHEN** the agent is reactivated
- **THEN** the condition is considered recovered
