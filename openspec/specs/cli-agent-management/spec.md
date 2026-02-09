## ADDED Requirements

### Requirement: List agents command

The CLI SHALL provide an `agentgazer agents` command that displays all registered agents in a table format, showing agent ID, status (active/inactive), event count, and last heartbeat time.

#### Scenario: List agents with data
- **WHEN** user runs `agentgazer agents`
- **THEN** CLI displays a table with columns: Agent ID, Status, Events, Last Heartbeat

#### Scenario: List agents when empty
- **WHEN** user runs `agentgazer agents` and no agents exist
- **THEN** CLI displays "No agents registered yet."

### Requirement: Agent active command

The CLI SHALL provide an `agentgazer agent <name> active` command that enables an agent (sets active=true in policy).

#### Scenario: Activate agent
- **WHEN** user runs `agentgazer agent my-bot active`
- **THEN** CLI sends PUT to `/api/agents/my-bot/policy` with `{"active": true}`
- **AND** CLI displays "Agent 'my-bot' activated."

#### Scenario: Activate non-existent agent
- **WHEN** user runs `agentgazer agent unknown-bot active`
- **THEN** CLI displays "Agent 'unknown-bot' not found." and exits with code 1

### Requirement: Agent deactive command

The CLI SHALL provide an `agentgazer agent <name> deactive` command that disables an agent (sets active=false in policy).

#### Scenario: Deactivate agent
- **WHEN** user runs `agentgazer agent my-bot deactive`
- **THEN** CLI sends PUT to `/api/agents/my-bot/policy` with `{"active": false}`
- **AND** CLI displays "Agent 'my-bot' deactivated."

### Requirement: Agent killswitch command

The CLI SHALL provide an `agentgazer agent <name> killswitch on|off` command that toggles the kill switch for an agent.

#### Scenario: Enable kill switch
- **WHEN** user runs `agentgazer agent my-bot killswitch on`
- **THEN** CLI sends PUT to `/api/agents/my-bot/policy` with `{"kill_switch_enabled": true}`
- **AND** CLI displays "Kill switch enabled for 'my-bot'."

#### Scenario: Disable kill switch
- **WHEN** user runs `agentgazer agent my-bot killswitch off`
- **THEN** CLI sends PUT to `/api/agents/my-bot/policy` with `{"kill_switch_enabled": false}`
- **AND** CLI displays "Kill switch disabled for 'my-bot'."

#### Scenario: Invalid killswitch argument
- **WHEN** user runs `agentgazer agent my-bot killswitch maybe`
- **THEN** CLI displays "Usage: agentgazer agent <name> killswitch on|off" and exits with code 1

### Requirement: Agent delete command

The CLI SHALL provide an `agentgazer agent <name> delete` command that deletes an agent and all its events.

#### Scenario: Delete agent with confirmation
- **WHEN** user runs `agentgazer agent my-bot delete`
- **THEN** CLI prompts "Delete agent 'my-bot' and all its data? [y/N]"
- **AND** if user confirms, CLI sends DELETE to `/api/agents/my-bot`
- **AND** CLI displays "Agent 'my-bot' deleted."

#### Scenario: Delete agent with --yes flag
- **WHEN** user runs `agentgazer agent my-bot delete --yes`
- **THEN** CLI skips confirmation and deletes immediately

### Requirement: Agent stat command

The CLI SHALL provide an `agentgazer agent <name> stat` command that displays detailed statistics for an agent in table format.

#### Scenario: Show agent stats
- **WHEN** user runs `agentgazer agent my-bot stat`
- **THEN** CLI displays statistics including: total requests, errors, error rate, total cost, total tokens, p50/p99 latency, and cost breakdown by model

#### Scenario: Show agent stats with range
- **WHEN** user runs `agentgazer agent my-bot stat --range 7d`
- **THEN** CLI displays statistics for the last 7 days

### Requirement: Agent model command

The CLI SHALL provide an `agentgazer agent <name> model` command that lists current model configurations per provider.

#### Scenario: List models for agent
- **WHEN** user runs `agentgazer agent my-bot model`
- **THEN** CLI displays a table showing each provider and its current/override model

#### Scenario: No model overrides
- **WHEN** user runs `agentgazer agent my-bot model` and no overrides exist
- **THEN** CLI displays "No model overrides configured for 'my-bot'."

### Requirement: Agent model-override command

The CLI SHALL provide an `agentgazer agent <name> model-override <model>` command that sets a model override. If the agent uses multiple providers, CLI SHALL interactively prompt for provider selection.

#### Scenario: Set model override with single provider
- **WHEN** user runs `agentgazer agent my-bot model-override gpt-4o-mini`
- **AND** my-bot has only used one provider (openai)
- **THEN** CLI sets override for openai to gpt-4o-mini
- **AND** CLI displays "Model override set: openai → gpt-4o-mini"

#### Scenario: Set model override with multiple providers
- **WHEN** user runs `agentgazer agent my-bot model-override gpt-4o-mini`
- **AND** my-bot has used multiple providers (openai, deepseek)
- **THEN** CLI prompts "Select provider:" with list of providers
- **AND** after selection, sets override for chosen provider
- **AND** CLI displays "Model override set: <provider> → gpt-4o-mini"

#### Scenario: No providers found
- **WHEN** user runs `agentgazer agent my-bot model-override gpt-4o-mini`
- **AND** my-bot has no recorded provider usage
- **THEN** CLI displays "No providers found for agent 'my-bot'. Make some LLM calls first."

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
- **WHEN** user runs `agentgazer agent <name> alert add error_rate --threshold 10 --webhook <url>`
- **THEN** CLI creates an error_rate rule with threshold 10%
- **AND** notification via webhook

#### Scenario: Add agent-down alert
- **WHEN** user runs `agentgazer agent <name> alert add agent_down --timeout 300 --webhook <url>`
- **THEN** CLI creates an agent_down rule with 5 minute timeout
- **AND** notification via webhook

#### Scenario: Add budget alert
- **WHEN** user runs `agentgazer agent <name> alert add budget --limit 100 --period monthly --webhook <url>`
- **THEN** CLI creates a budget rule with $100 monthly limit
- **AND** notification via webhook

#### Scenario: Add with repeat options
- **WHEN** user runs `agentgazer agent <name> alert add error_rate --threshold 10 --repeat --interval 30 --webhook <url>`
- **THEN** CLI creates rule with repeat_enabled=true and repeat_interval_minutes=30

#### Scenario: Add one-time alert
- **WHEN** user runs `agentgazer agent <name> alert add error_rate --threshold 10 --no-repeat --webhook <url>`
- **THEN** CLI creates rule with repeat_enabled=false

#### Scenario: Add with recovery notification
- **WHEN** user runs `agentgazer agent <name> alert add agent_down --timeout 300 --recovery-notify --webhook <url>`
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
