## MODIFIED Requirements

### Requirement: Token reset flag

The CLI SHALL provide a `reset-token` command that regenerates the auth token. The command MUST preserve all existing configuration (providers, rate limits) and only replace the `token` field.

#### Scenario: Reset token preserves providers
- **WHEN** user runs `agentgazer reset-token` with existing providers configured
- **THEN** a new 64-character hex token is generated
- **AND** all existing provider configurations (rate limits, etc.) are preserved in config.json

#### Scenario: Reset token with no prior config
- **WHEN** user runs `agentgazer reset-token` with no existing config file
- **THEN** a new config is created with only the generated token

## ADDED Requirements

### Requirement: Stats command positional argument parsing

The `stats` subcommand MUST correctly extract the positional agent ID argument regardless of flag positioning. Flags (`--flag value` pairs) SHALL be filtered out before extracting the positional argument.

#### Scenario: Agent ID after flags
- **WHEN** user runs `agentgazer stats --port 9090 my-agent`
- **THEN** the agent ID is resolved as `my-agent`
- **AND** the port flag is parsed as `9090`

#### Scenario: Agent ID before flags
- **WHEN** user runs `agentgazer stats my-agent --range 7d`
- **THEN** the agent ID is resolved as `my-agent`
- **AND** the range flag is parsed as `7d`

#### Scenario: No agent ID with flags
- **WHEN** user runs `agentgazer stats --port 9090` with only one registered agent
- **THEN** the single agent is auto-selected
