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
