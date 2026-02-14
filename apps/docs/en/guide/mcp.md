# MCP Integration

AgentGazer provides an MCP (Model Context Protocol) server that enables AI agents to query their own cost and usage data. This creates "cost-aware agents" that can monitor their spending and make informed decisions.

::: info Note
MCP is supported by Claude Code and other MCP-compatible hosts. OpenClaw uses a different plugin system (Skills) and does not support MCP servers directly.
:::

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   AI Agent (Claude Code, Cursor, etc.)                      │
│        │                                                    │
│        │ stdio                                              │
│        ▼                                                    │
│   ┌──────────────────┐         ┌──────────────────┐         │
│   │  agentgazer-mcp  │──HTTP──▶│ AgentGazer Server│         │
│   └──────────────────┘         │    :18880        │         │
│                                └──────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Installation

### Local Machine

If you have AgentGazer CLI installed, MCP is already available:

```bash
agentgazer-mcp --help
```

### Remote Machine

For remote agents that connect to a central AgentGazer server:

```bash
npm install -g @agentgazer/mcp
agentgazer-mcp init
```

## Configuration

### Claude Code

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "agentgazer": {
      "command": "agentgazer-mcp",
      "env": {
        "AGENTGAZER_ENDPOINT": "http://localhost:18880",
        "AGENTGAZER_TOKEN": "your-token-here",
        "AGENTGAZER_AGENT_ID": "my-agent"
      }
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENTGAZER_ENDPOINT` | AgentGazer server URL | `http://localhost:18880` |
| `AGENTGAZER_TOKEN` | API authentication token | Required |
| `AGENTGAZER_AGENT_ID` | Unique agent identifier | Required |

## Available Tools

### get_token_usage

Query token consumption for the current agent.

**Parameters:**
- `period` (optional): Time filter (`today`, `7d`, `30d`)
- `model` (optional): Filter by model name

**Example response:**
```
Token Usage:
  Input tokens:  15,234
  Output tokens: 8,921
  Total tokens:  24,155
```

### get_cost

Query spending in USD.

**Parameters:**
- `period` (optional): Time filter
- `breakdown` (optional): Include per-model breakdown

**Example response:**
```
Cost: $2.4500 USD

Breakdown by model:
  claude-opus-4-5-20251101: $1.8200
  gpt-4o: $0.6300
```

### get_budget_status

Check budget limits and remaining balance.

**Example response:**
```
Budget Status:
  Limit:     $50.00
  Used:      $12.45
  Remaining: $37.55
  Progress:  24.9%
```

### estimate_cost

Predict cost for an operation before executing.

**Parameters:**
- `model`: Model name (required)
- `input_tokens`: Estimated input tokens (required)
- `output_tokens`: Estimated output tokens (required)

**Example response:**
```
Cost Estimate:
  Model:         claude-opus-4-5-20251101
  Input tokens:  10,000
  Output tokens: 5,000
  Estimated:     $0.3500 USD
```

### whoami

Get current agent identity and connection status.

**Example response:**
```
Agent Identity:
  Agent ID:  my-coding-agent
  Endpoint:  http://localhost:18880
  Connected: Yes
  Server:    AgentGazer 0.5.5
```

## Use Cases

### Budget-Aware Responses

Agents can check their remaining budget before expensive operations:

```
"I've already spent $45 of my $50 budget today.
Let me summarize my progress before stopping."
```

### Cost Reporting

Agents can report their spending at the end of a session:

```
"Task complete. This session cost $2.35
and used 45,000 tokens."
```

### Resource Estimation

Before large operations, agents can estimate costs:

```
"This analysis will require approximately 100K tokens.
Estimated cost: $3.50. Proceed?"
```

## Remote Setup

For multi-machine deployments where agents run on different machines:

1. Install MCP package on each agent machine:
   ```bash
   npm install -g @agentgazer/mcp
   ```

2. Configure with central server endpoint:
   ```bash
   agentgazer-mcp init \
     --endpoint http://192.168.1.100:18880 \
     --token ag_xxx \
     --agent-id dev-machine-1
   ```

3. Add to Claude Code settings on each machine (`~/.claude/settings.json`)

## Troubleshooting

### "Cannot connect to AgentGazer"

Ensure the AgentGazer server is running:
```bash
agentgazer status
```

### "Missing token"

Get your token from:
```bash
agentgazer status
# or check ~/.agentgazer/config.json
```

### MCP not showing in agent

1. Verify config file exists: `~/.claude/settings.json`
2. Check `mcpServers.agentgazer` entry is present
3. Restart Claude Code
