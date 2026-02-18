## ADDED Requirements

### Requirement: Server can write OpenClaw mcpServers config
The server SHALL support updating the `mcpServers` key in `~/.openclaw/openclaw.json` via `PUT /api/openclaw/config`, merging with existing MCP servers.

#### Scenario: Add agentgazer to existing mcpServers
- **WHEN** config file exists with `mcpServers: { filesystem: {...}, github: {...} }`
- **AND** PUT request includes `mcpServers: { agentgazer: {...} }`
- **THEN** result is `mcpServers: { filesystem: {...}, github: {...}, agentgazer: {...} }`
- **AND** existing servers are preserved

#### Scenario: Update agentgazer in mcpServers
- **WHEN** config file exists with `mcpServers: { agentgazer: { old config } }`
- **AND** PUT request includes `mcpServers: { agentgazer: { new config } }`
- **THEN** agentgazer config is replaced with new config
- **AND** other mcpServers are preserved

#### Scenario: Create mcpServers when not exists
- **WHEN** config file exists without `mcpServers` key
- **AND** PUT request includes `mcpServers: { agentgazer: {...} }`
- **THEN** `mcpServers` key is created with agentgazer config

### Requirement: Dashboard generates MCP server config
The dashboard OpenClaw page SHALL generate `mcpServers.agentgazer` configuration.

#### Scenario: Generate MCP config with current settings
- **WHEN** user is on OpenClaw integration page
- **THEN** page displays generated mcpServers config including:
  - `command: "agentgazer-mcp"`
  - `env.AGENTGAZER_ENDPOINT` set to proxy host (e.g., http://localhost:18880)
  - `env.AGENTGAZER_TOKEN` set to current auth token
  - `env.AGENTGAZER_AGENT_ID` set to agent name

#### Scenario: Custom proxy host reflects in MCP config
- **WHEN** user changes proxy host input to "192.168.1.2:18880"
- **THEN** generated `AGENTGAZER_ENDPOINT` shows "http://192.168.1.2:18880"

### Requirement: Dashboard applies MCP config with merge
The dashboard SHALL apply mcpServers config using deep merge, not overwrite.

#### Scenario: Apply preserves user's other MCP servers
- **WHEN** user has existing mcpServers (filesystem, github, etc.)
- **AND** user clicks "Apply Configuration"
- **THEN** agentgazer is added/updated in mcpServers
- **AND** user's existing MCP servers remain intact

#### Scenario: Apply includes MCP config automatically
- **WHEN** user clicks "Apply Configuration" on OpenClaw page
- **THEN** both `models` config AND `mcpServers` config are applied together
