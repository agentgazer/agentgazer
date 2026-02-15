# Multi-Agent Setup

When running multiple AI agents on the same machine, you can share a single AgentGazer Proxy while tracking each agent's usage separately.

## The Problem

By default, all requests through the Proxy are attributed to a single agent (the `--agent-id` set at startup). This works fine for single-agent setups, but becomes limiting when:

- You run multiple agents (e.g., a coding assistant + a research assistant)
- You want to see cost breakdown per agent
- You need separate alerts for each agent

## Solution 1: Path-based Agent ID (Recommended)

Include the agent ID in the URL path:

```typescript
// Coding assistant
const openai = new OpenAI({
  baseURL: "http://localhost:18900/agents/coding-assistant/openai/v1",
  apiKey: "dummy",
});

// Research assistant
const anthropic = new Anthropic({
  baseURL: "http://localhost:18900/agents/research-assistant/anthropic",
  apiKey: "dummy",
});
```

This approach:
- Works with any SDK (no custom headers needed)
- Makes agent ID visible in logs and URLs
- Auto-creates agents on first request

## Solution 2: x-agent-id Header

Use the agent name in the URL path to identify each agent:

```typescript
const openai = new OpenAI({
  baseURL: "http://localhost:18900/agents/coding-assistant/agentgazer",
  apiKey: "dummy",
});
```

Each agent has its own URL path. The Proxy records metrics separately per agent.

## Example: Two Agents Sharing One Proxy

### Agent 1: Coding Assistant

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:18900/agents/coding-assistant/agentgazer",
  apiKey: "dummy",
});

// All requests attributed to "coding-assistant"
await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Write a function..." }],
});
```

### Agent 2: Research Assistant

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  baseURL: "http://localhost:18900/agents/research-assistant/agentgazer",
  apiKey: "dummy",
});

// All requests attributed to "research-assistant"
await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Summarize this paper..." }],
});
```

### Start the Proxy

```bash
agentgazer start
```

No special flags needed — the `x-agent-id` header handles agent identification.

## Dashboard View

With this setup, the AgentGazer Dashboard shows:

- **Agents page**: Lists both `coding-assistant` and `research-assistant` as separate agents
- **Per-agent stats**: Each agent has its own cost, token usage, latency metrics
- **Alerts**: You can set different alert rules for each agent (e.g., higher budget for the coding assistant)

## Using with curl

```bash
curl http://localhost:18900/agents/my-custom-agent/openai \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hi"}]}'
```

## Using with Python

```python
import openai

client = openai.OpenAI(
    base_url="http://localhost:18900/agents/python-agent/agentgazer",
    api_key="dummy",
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
)
```

## Agent ID Priority

When multiple identification methods are used, the Proxy follows this priority:

| Priority | Method | Example |
|----------|--------|---------|
| 1 (highest) | `x-agent-id` header | `x-agent-id: my-agent` |
| 2 | Path prefix | `/agents/my-agent/openai/...` |
| 3 (lowest) | Default | Configured at startup or "default" |

## When to Use Which

| Scenario | Recommendation |
|----------|----------------|
| Single agent | No agent ID needed — uses default |
| Multiple agents, SDK supports headers | Use `x-agent-id` header |
| Multiple agents, SDK doesn't support headers | Use path-based `/agents/{id}/...` |
| OpenClaw (no custom header support) | Use path-based `/agents/{id}/...` |
| Testing different prompts/configs | Use either method to compare |

## Limitations

- **Some SDKs**: If your SDK doesn't support `defaultHeaders`, use the path-based approach instead.
