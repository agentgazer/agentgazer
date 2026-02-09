## ADDED Requirements

### Requirement: List agent alerts
CLI SHALL provide a command to list alert rules for an agent.

#### Scenario: List alerts
- **WHEN** user runs `agentgazer agent <name> alerts`
- **THEN** CLI displays all alert rules for that agent
- **AND** shows ID, type, state, repeat settings, delivery method, last triggered time

#### Scenario: No alerts
- **WHEN** user runs `agentgazer agent <name> alerts` for an agent with no rules
- **THEN** CLI displays "No alert rules configured"

### Requirement: Add alert rule
CLI SHALL provide a command to add alert rules.

#### Scenario: Add error-rate alert
- **WHEN** user runs `agentgazer agent <name> alert add error-rate --threshold 10 --telegram`
- **THEN** CLI creates an error_rate rule with threshold 10%
- **AND** notification via Telegram

#### Scenario: Add agent-down alert
- **WHEN** user runs `agentgazer agent <name> alert add agent-down --timeout 5 --webhook <url>`
- **THEN** CLI creates an agent_down rule with 5 minute timeout
- **AND** notification via webhook

#### Scenario: Add budget alert
- **WHEN** user runs `agentgazer agent <name> alert add budget --limit 100 --period monthly --email <addr>`
- **THEN** CLI creates a budget rule with $100 monthly limit
- **AND** notification via email

#### Scenario: Add with repeat options
- **WHEN** user runs `agentgazer agent <name> alert add error-rate --threshold 10 --repeat --interval 30 --telegram`
- **THEN** CLI creates rule with repeat_enabled=true and repeat_interval_minutes=30

#### Scenario: Add one-time alert
- **WHEN** user runs `agentgazer agent <name> alert add error-rate --threshold 10 --no-repeat --telegram`
- **THEN** CLI creates rule with repeat_enabled=false

#### Scenario: Add with recovery notification
- **WHEN** user runs `agentgazer agent <name> alert add agent-down --timeout 5 --recovery-notify --telegram`
- **THEN** CLI creates rule with recovery_notify=true

### Requirement: Delete alert rule
CLI SHALL provide a command to delete alert rules.

#### Scenario: Delete by ID
- **WHEN** user runs `agentgazer agent <name> alert delete <rule-id>`
- **THEN** CLI deletes the alert rule
- **AND** displays confirmation message

#### Scenario: Delete non-existent rule
- **WHEN** user runs `agentgazer agent <name> alert delete <invalid-id>`
- **THEN** CLI displays error "Alert rule not found"

### Requirement: Reset alert rule state
CLI SHALL provide a command to reset alert rule state.

#### Scenario: Reset to normal
- **WHEN** user runs `agentgazer agent <name> alert reset <rule-id>`
- **THEN** CLI resets the rule state to 'normal'
- **AND** displays confirmation message

#### Scenario: Reset budget for new period
- **WHEN** user runs `agentgazer agent <name> alert reset <budget-rule-id>`
- **THEN** the budget tracking resets
- **AND** state changes to 'normal'
