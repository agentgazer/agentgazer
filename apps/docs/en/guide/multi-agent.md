# Multi-Agent Setup

When running multiple AI agents on the same machine, you can share a single AgentTrace Proxy while tracking each agent's usage separately.

## The Problem

By default, all requests through the Proxy are attributed to a single agent (the `--agent-id` set at startup). This works fine for single-agent setups, but becomes limiting when:

- You run multiple agents (e.g., a coding assistant + a research assistant)
- You want to see cost breakdown per agent
- You need separate alerts for each agent

## Solution: x-agent-id Header

Add the `x-agent-id` header to each request to identify which agent made it:

```typescript
const openai = new OpenAI({
  baseURL: "http://localhost:4000/openai/v1",
  apiKey: "dummy",
  defaultHeaders: {
    "x-agent-id": "coding-assistant",
  },
});
```

Each agent uses a different `x-agent-id` value. The Proxy routes all requests to the same provider but records metrics separately per agent.

## Example: Two Agents Sharing One Proxy

### Agent 1: Coding Assistant

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:4000/openai/v1",
  apiKey: "dummy",
  defaultHeaders: {
    "x-agent-id": "coding-assistant",
  },
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
  baseURL: "http://localhost:4000/anthropic",
  apiKey: "dummy",
  defaultHeaders: {
    "x-agent-id": "research-assistant",
  },
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
agenttrace start
```

No special flags needed — the `x-agent-id` header handles agent identification.

## Dashboard View

With this setup, the AgentTrace Dashboard shows:

- **Agents page**: Lists both `coding-assistant` and `research-assistant` as separate agents
- **Per-agent stats**: Each agent has its own cost, token usage, latency metrics
- **Alerts**: You can set different alert rules for each agent (e.g., higher budget for the coding assistant)

## Using with curl

```bash
curl http://localhost:4000/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-agent-id: my-custom-agent" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hi"}]}'
```

## Using with Python

```python
import openai

client = openai.OpenAI(
    base_url="http://localhost:4000/openai/v1",
    api_key="dummy",
    default_headers={
        "x-agent-id": "python-agent",
    },
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
)
```

## Fallback Behavior

If a request doesn't include `x-agent-id`, it uses the Proxy's default agent ID:

| Scenario | Agent ID Used |
|----------|---------------|
| `x-agent-id: my-agent` header present | `my-agent` |
| No header, started with `--agent-id foo` | `foo` |
| No header, no `--agent-id` flag | Default value from config |

## When to Use This

| Scenario | Recommendation |
|----------|----------------|
| Single agent (e.g., OpenClaw only) | No need for `x-agent-id` |
| Multiple agents, same provider | Use `x-agent-id` |
| Multiple agents, different providers | Use `x-agent-id` |
| Testing different prompts/configs | Use `x-agent-id` to compare |

## Limitations

- **OpenClaw**: Does not currently support custom headers, so you cannot use `x-agent-id` with OpenClaw. Use separate Proxy instances if you need multiple OpenClaw agents.
- **Some SDKs**: Check if your SDK supports `defaultHeaders` or equivalent.
