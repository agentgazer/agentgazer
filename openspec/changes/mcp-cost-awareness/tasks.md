## 1. Package Setup

- [x] 1.1 Create `packages/mcp/` directory structure
- [x] 1.2 Initialize `packages/mcp/package.json` with @agentgazer/mcp name and dependencies
- [x] 1.3 Add MCP SDK dependency (`@modelcontextprotocol/sdk`)
- [x] 1.4 Configure TypeScript for mcp package (tsconfig.json)
- [x] 1.5 Add mcp package to root workspace in package.json

## 2. MCP Server Core

- [x] 2.1 Implement HTTP client for AgentGazer API (`src/client.ts`)
- [x] 2.2 Implement MCP server with stdio transport (`src/server.ts`)
- [x] 2.3 Add configuration loading from environment variables
- [x] 2.4 Add configuration file support (`~/.agentgazer/mcp-config.json`)
- [x] 2.5 Add startup health check for API connectivity

## 3. MCP Tools Implementation

- [x] 3.1 Implement `get_token_usage` tool
- [x] 3.2 Implement `get_cost` tool
- [x] 3.3 Implement `get_budget_status` tool
- [x] 3.4 Implement `estimate_cost` tool
- [x] 3.5 Implement `whoami` tool

## 4. CLI Entry Point

- [x] 4.1 Create `bin/agentgazer-mcp.ts` CLI entry point
- [x] 4.2 Add `--version` and `--help` flags
- [x] 4.3 Implement `init` subcommand for interactive setup
- [x] 4.4 Add non-interactive `init` with `--endpoint`, `--token`, `--agent-id` flags

## 5. Server API Updates

- [x] 5.1 Add `/api/stats/tokens` endpoint for MCP token queries (if not exists)
- [x] 5.2 Add `/api/stats/cost` endpoint for MCP cost queries (if not exists)
- [x] 5.3 Add `/api/stats/budget` endpoint for budget status
- [x] 5.4 Update `/api/openclaw/config` to support mcpServers deep merge

## 6. Dashboard OpenClaw Page Updates

- [x] 6.1 ~~Add mcpServers config generation~~ (Removed - OpenClaw doesn't support MCP)
- [x] 6.2 ~~Update `openclawApi.updateConfig()` to include mcpServers~~ (Removed)
- [x] 6.3 ~~Display generated mcpServers config in UI~~ (Removed)
- [x] 6.4 ~~Test that existing mcpServers are preserved on apply~~ (N/A)

## 7. Testing

- [x] 7.1 Add unit tests for MCP client HTTP calls
- [x] 7.2 Add unit tests for each MCP tool
- [x] 7.3 Add integration test for MCP server startup
- [x] 7.4 Test OpenClaw config merge behavior

## 8. Documentation

- [x] 8.1 Add MCP setup guide to docs (en)
- [x] 8.2 Add MCP setup guide to docs (zh)
- [x] 8.3 Update README with MCP feature description

## 9. Release

- [x] 9.1 Build and test @agentgazer/mcp package
- [ ] 9.2 Publish @agentgazer/mcp to npm
- [ ] 9.3 Update @agentgazer/cli to optionally depend on mcp package
