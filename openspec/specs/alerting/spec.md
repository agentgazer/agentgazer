## ADDED Requirements

### Requirement: Configurable alert rules per agent

The system SHALL support configurable alert rules on a per-agent basis. The supported alert rule types MUST include: `agent-down`, `error-rate-threshold`, and `budget-threshold`. Users MUST be able to create, update, and delete alert rules for each of their agents through the dashboard.

#### Scenario: Create an alert rule

WHEN a user creates an `agent-down` alert rule for a specific agent
THEN the system MUST save the rule and begin evaluating it against incoming events for that agent.

#### Scenario: Update an alert rule threshold

WHEN a user updates the duration threshold on an existing `agent-down` alert rule from 10 minutes to 5 minutes
THEN the system MUST apply the updated threshold immediately for subsequent evaluations.

#### Scenario: Delete an alert rule

WHEN a user deletes an alert rule for an agent
THEN the system MUST stop evaluating that rule and MUST NOT trigger alerts for it.

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

### Requirement: Error-rate alert

The system SHALL trigger an `error-rate-threshold` alert when the error rate for an agent exceeds a configurable percentage threshold within a rolling evaluation window. The default threshold MUST be 20%. The error rate MUST be calculated as the number of `error` events divided by the total number of events in the rolling window.

#### Scenario: Error rate exceeds threshold

WHEN an agent has an `error-rate-threshold` alert configured with the default 20% threshold and the agent's error rate reaches 25% in the rolling window
THEN the system MUST trigger the `error-rate-threshold` alert.

#### Scenario: Error rate below threshold

WHEN an agent has an `error-rate-threshold` alert configured with a 20% threshold and the agent's error rate is 10% in the rolling window
THEN the system MUST NOT trigger the alert.

#### Scenario: Custom error rate threshold

WHEN a user configures an `error-rate-threshold` alert with a 50% threshold and the agent's error rate reaches 55%
THEN the system MUST trigger the alert.

### Requirement: Budget alert

The system SHALL trigger a `budget-threshold` alert when the cumulative cost for an agent exceeds a user-defined dollar threshold. The threshold MUST be configurable per agent. The system MUST evaluate the cumulative cost continuously and fire the alert as soon as the threshold is crossed.

#### Scenario: Budget threshold crossed

WHEN an agent has a `budget-threshold` alert configured at $50.00 and the agent's cumulative cost reaches $50.01
THEN the system MUST trigger the `budget-threshold` alert.

#### Scenario: Budget below threshold

WHEN an agent has a `budget-threshold` alert configured at $100.00 and the agent's cumulative cost is $80.00
THEN the system MUST NOT trigger the alert.

### Requirement: Delivery channels

The system SHALL support two alert delivery channels: webhook and email. For webhook delivery, the system MUST send an HTTP POST request with a JSON payload to the user-configured URL. For email delivery, the system MUST send an email via Resend containing the alert details. Users MUST be able to configure one or both channels per alert rule.

#### Scenario: Webhook delivery

WHEN an alert is triggered and the alert rule has a webhook URL configured
THEN the system MUST send an HTTP POST request to the configured URL with a JSON body containing the alert type, agent ID, timestamp, and relevant metric values.

#### Scenario: Email delivery

WHEN an alert is triggered and the alert rule has email delivery enabled
THEN the system MUST send an email via Resend to the user's email address containing the alert type, agent ID, and relevant details.

#### Scenario: Both channels configured

WHEN an alert is triggered and the alert rule has both webhook and email channels configured
THEN the system MUST deliver the alert through both channels.

### Requirement: Alert repeat settings

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

### Requirement: Alert state tracking

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

### Requirement: Alert recovery conditions

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

### Requirement: Alert history in dashboard

The system SHALL maintain a history of all triggered alerts and MUST display this history in the dashboard. The alert history MUST show the alert type, agent ID, timestamp of firing, delivery status (sent/failed per channel), and the metric value that triggered the alert.

#### Scenario: View alert history

WHEN a user navigates to the alert history section in the dashboard
THEN the dashboard MUST display a list of all previously triggered alerts with their type, agent ID, timestamp, delivery status, and triggering metric value.

#### Scenario: Alert history includes delivery status

WHEN an alert was delivered via webhook and the webhook endpoint returned HTTP 200
THEN the alert history entry MUST show the webhook delivery status as "sent".

#### Scenario: Failed delivery recorded in history

WHEN an alert webhook delivery fails (e.g., target URL unreachable)
THEN the alert history entry MUST show the webhook delivery status as "failed".

### Requirement: Enable and disable alerts per agent

The system SHALL allow users to enable or disable alert rules on a per-agent basis. When an alert rule is disabled, the system MUST stop evaluating that rule and MUST NOT fire alerts for it. When re-enabled, the system MUST resume evaluation. Disabling an alert MUST NOT delete the rule or its configuration.

#### Scenario: Disable an alert rule

WHEN a user disables an `error-rate-threshold` alert rule for an agent
THEN the system MUST stop evaluating that rule and MUST NOT trigger alerts for it.

#### Scenario: Re-enable a disabled alert rule

WHEN a user re-enables a previously disabled alert rule
THEN the system MUST resume evaluating the rule against incoming events.

#### Scenario: Disabled rule preserves configuration

WHEN a user disables an alert rule configured with a custom threshold and later re-enables it
THEN the alert rule MUST retain its original custom threshold configuration.
