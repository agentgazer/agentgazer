## ADDED Requirements

### Requirement: agentgazer-mcp binary
The @agentgazer/mcp package SHALL provide an `agentgazer-mcp` CLI binary.

#### Scenario: Run MCP server
- **WHEN** user runs `agentgazer-mcp`
- **THEN** MCP server starts in stdio mode and waits for Host communication

#### Scenario: Show version
- **WHEN** user runs `agentgazer-mcp --version`
- **THEN** displays package version

#### Scenario: Show help
- **WHEN** user runs `agentgazer-mcp --help`
- **THEN** displays usage information and environment variable requirements

### Requirement: agentgazer-mcp init command
The CLI SHALL provide an `init` subcommand for configuration setup.

#### Scenario: Interactive setup
- **WHEN** user runs `agentgazer-mcp init`
- **THEN** prompts for endpoint, token, and agent_id interactively

#### Scenario: Save configuration
- **WHEN** user completes init prompts
- **THEN** saves config to ~/.agentgazer/mcp-config.json

#### Scenario: Non-interactive setup
- **WHEN** user runs `agentgazer-mcp init --endpoint http://x --token y --agent-id z`
- **THEN** saves config without prompting

### Requirement: Configuration file support
The CLI SHALL support reading configuration from file.

#### Scenario: Load config from file
- **WHEN** MCP server starts and ~/.agentgazer/mcp-config.json exists
- **THEN** reads endpoint, token, agent_id from file

#### Scenario: Environment overrides file
- **WHEN** both config file and environment variables are present
- **THEN** environment variables take precedence

### Requirement: @agentgazer/mcp package structure
The package SHALL be lightweight and independently installable.

#### Scenario: Install on remote agent machine
- **WHEN** user runs `npm install -g @agentgazer/mcp`
- **THEN** only MCP dependencies are installed (no server/proxy/dashboard)

#### Scenario: Package size
- **WHEN** package is published
- **THEN** unpacked size is under 100KB (excluding node_modules)
