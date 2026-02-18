## Why

AI Agents 缺乏成本意識 — 它們不知道自己花了多少錢、用了多少 token。透過 MCP (Model Context Protocol) 整合，讓 Agent 能夠查詢自己的使用量和花費，實現「成本感知 Agent」。這對於內網多台裝置共用一台 AgentGazer 的場景尤其重要。

## What Changes

- 新增 `@agentgazer/mcp` 輕量套件，提供 MCP server (stdio transport)
- 實作 5 個 MCP tools：`get_token_usage`, `get_cost`, `get_budget_status`, `estimate_cost`, `whoami`
- MCP server 透過 HTTP API 查詢 AgentGazer server（支援本機和遠端）
- Dashboard OpenClaw 頁面新增 MCP server 設定（合併到現有 mcpServers，不覆蓋）
- CLI 新增 `agentgazer-mcp` 獨立入口點

## Capabilities

### New Capabilities

- `mcp-server`: MCP server 實作，stdio transport，透過 HTTP 查詢 AgentGazer API
- `mcp-tools`: 5 個成本感知 tools (get_token_usage, get_cost, get_budget_status, estimate_cost, whoami)
- `mcp-cli`: 獨立 CLI (`agentgazer-mcp`) 及設定流程

### Modified Capabilities

- `openclaw-integration`: OpenClaw 設定頁面新增 mcpServers 合併邏輯

## Impact

- **新套件**: `packages/mcp/` — 輕量 MCP 套件，遠端 Agent 只需安裝此套件
- **API**: 現有 `/api/stats/*` 端點供 MCP server 使用，可能需要新增 `/api/mcp/*` 端點
- **Config**: 新增 `~/.agentgazer/mcp-config.json` 供遠端 Agent 設定
- **OpenClaw**: `~/.openclaw/openclaw.json` 的 mcpServers section 需要 deep merge
- **依賴**: 需要 MCP SDK (`@modelcontextprotocol/sdk`)
