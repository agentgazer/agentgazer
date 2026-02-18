## ADDED Requirements

### Requirement: MCP server stdio transport
The MCP server SHALL use stdio transport for communication with Host Apps (OpenClaw, Claude Desktop).

#### Scenario: Host app spawns MCP server
- **WHEN** Host app starts with agentgazer in mcpServers config
- **THEN** Host spawns `agentgazer-mcp` process and communicates via stdin/stdout

#### Scenario: MCP server stays alive during session
- **WHEN** Host app is running
- **THEN** MCP server process remains active and handles multiple tool calls

### Requirement: MCP server HTTP backend
The MCP server SHALL query AgentGazer API via HTTP for all data operations.

#### Scenario: Query cost data
- **WHEN** MCP tool `get_cost` is called
- **THEN** MCP server makes HTTP GET to `{endpoint}/api/stats/cost`

#### Scenario: Connection to remote server
- **WHEN** AGENTGAZER_ENDPOINT is set to remote address (e.g., http://192.168.1.2:18880)
- **THEN** MCP server queries that remote AgentGazer instance

### Requirement: MCP server configuration via environment
The MCP server SHALL read configuration from environment variables.

#### Scenario: Required environment variables
- **WHEN** MCP server starts
- **THEN** it reads AGENTGAZER_ENDPOINT, AGENTGAZER_TOKEN, AGENTGAZER_AGENT_ID from environment

#### Scenario: Default endpoint
- **WHEN** AGENTGAZER_ENDPOINT is not set
- **THEN** MCP server uses http://localhost:18880 as default

#### Scenario: Missing token
- **WHEN** AGENTGAZER_TOKEN is not set
- **THEN** MCP server logs error and exits with non-zero code

### Requirement: MCP server connection health check
The MCP server SHALL verify connectivity to AgentGazer API on startup.

#### Scenario: Successful connection
- **WHEN** MCP server starts and AgentGazer API is reachable
- **THEN** MCP server advertises available tools to Host

#### Scenario: Failed connection
- **WHEN** MCP server starts and AgentGazer API is unreachable
- **THEN** MCP server logs clear error message with endpoint URL
