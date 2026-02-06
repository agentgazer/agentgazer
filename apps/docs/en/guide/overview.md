# Overview

## The Problem

Building AI agents is hard. Debugging them is harder.

- **No visibility** — LLM calls happen in a black box. When something breaks, you grep through logs hoping to find the cause.
- **Cost surprises** — Token usage adds up fast. You only find out when the bill arrives.
- **Silent failures** — Agents crash or hang with no notification. Users discover problems before you do.
- **Privacy concerns** — Cloud observability tools want your prompts and API keys. That's a non-starter for many use cases.

## The Solution

AgentGazer is a **local-first** observability platform for AI agents.

```bash
curl -fsSL https://raw.githubusercontent.com/agentgazer/agentgazer/main/scripts/install.sh | sh
agentgazer start
```

One command gives you:

- **LLM call tracking** — Every request logged with tokens, latency, cost, and model
- **Real-time dashboard** — See what your agents are doing right now
- **Cost analysis** — Spend breakdown by provider, model, and agent
- **Health monitoring** — Heartbeat-based status (healthy / degraded / down)
- **Alerts** — Webhook and email notifications for downtime, errors, and budget overruns

All data stays on your machine. Prompts and API keys never leave your environment.

## How It Works

Two ways to capture data:

| Method | Description | Best For |
|--------|-------------|----------|
| **Proxy** | Point your LLM client at `localhost:4000`. Zero code changes. | Existing codebases, quick setup |
| **SDK** | Call `track()` manually in your code. | Fine-grained control, custom events |

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Machine                             │
│                                                             │
│  ┌──────────┐    ┌─────────────────┐                        │
│  │ AI Agent │───▶│ AgentGazer Proxy│───▶ LLM Provider       │
│  └──────────┘    │    (:4000)      │     (OpenAI, etc.)     │
│       │          └────────┬────────┘                        │
│       │ SDK               │                                 │
│       ▼                   ▼                                 │
│  ┌─────────────────────────────────┐                        │
│  │   Server (:8080) + Dashboard    │                        │
│  │         SQLite DB               │                        │
│  └─────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## API Key Management

Store your API keys once, use them everywhere:

```bash
agentgazer providers set openai sk-xxx
agentgazer providers set anthropic sk-ant-xxx
```

Keys are encrypted locally (AES-256-GCM) and never leave your machine. When you use the Proxy with path prefix routing (`/openai/...`, `/anthropic/...`), keys are automatically injected into requests — no need to configure each agent separately.

```typescript
// No API key needed in code — Proxy injects it automatically
const openai = new OpenAI({
  baseURL: "http://localhost:4000/openai/v1",
  apiKey: "dummy",  // Will be replaced by stored key
});
```

This also centralizes key rotation: update once with `providers set`, all agents use the new key immediately.

Multiple agents can share the same Proxy and API key while tracking usage separately — just add the `x-agent-id` header to each request.

## Supported Providers

| Provider | Auto-detected |
|----------|---------------|
| OpenAI | ✓ |
| Anthropic | ✓ |
| Google | ✓ |
| Mistral | ✓ |
| Cohere | ✓ |
| DeepSeek | ✓ |

## Project Structure

```
~/.agentgazer/
├── config.json     # Auth token, settings
├── data.db         # SQLite database (events, agents, alerts)
└── lib/            # Installed package (curl install only)
```

AgentGazer is a monorepo:

| Package | Description |
|---------|-------------|
| `agentgazer` | CLI — starts server, proxy, dashboard |
| `@agentgazer/server` | Express API + SQLite |
| `@agentgazer/proxy` | Transparent LLM proxy |
| `@agentgazer/sdk` | Client SDK for manual tracking |
| `@agentgazer/shared` | Types, pricing tables, provider detection |
