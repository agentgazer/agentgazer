# Getting Started

## Install

```bash
npm install -g agenttrace
```

Requires Node.js 18 or later.

## First-Time Setup

Run the onboard command to generate an auth token and configure provider API keys:

```bash
agenttrace onboard
```

This will:

1. Create `~/.agenttrace/config.json` with a generated token
2. Create a SQLite database at `~/.agenttrace/agenttrace.db`
3. Walk you through configuring API keys for each provider (optional)

## Start

```bash
agenttrace start
```

This launches three services:

| Service | Default Port | Description |
|---------|-------------|-------------|
| API Server | 8080 | REST API + dashboard |
| LLM Proxy | 4000 | Transparent proxy for LLM calls |
| Dashboard | 8080 | Web UI (served by the API server) |

Open `http://localhost:8080` to view the dashboard.

### Options

```bash
agenttrace start --port 9090          # Custom server port
agenttrace start --proxy-port 5000    # Custom proxy port
agenttrace start --retention-days 7   # Keep data for 7 days
agenttrace start --no-open            # Don't auto-open browser
```

## Connect Your Agent

There are two ways to send data to AgentTrace:

### Option A: Use the Proxy (recommended)

Point your LLM client at the proxy instead of the provider directly:

```bash
export OPENAI_BASE_URL=http://localhost:4000/v1
```

The proxy automatically detects the provider, forwards the request, and records usage metrics. No code changes needed.

### Option B: Use the SDK

```typescript
import { AgentTrace } from "@agenttrace/sdk";

const at = AgentTrace.init({
  apiKey: "your-token",     // from ~/.agenttrace/config.json
  agentId: "my-agent",
});

// Track an LLM call
at.track({
  provider: "openai",
  model: "gpt-4o",
  tokens: { input: 150, output: 50 },
  latency_ms: 1200,
  status: 200,
});

// Graceful shutdown
await at.shutdown();
```

Install the SDK:

```bash
npm install @agenttrace/sdk
```

## Check Status

```bash
agenttrace status            # Show current config
agenttrace providers list    # List configured providers
```

## Architecture

```
Your App ──> AgentTrace Proxy ──> LLM Provider (OpenAI, Anthropic, DeepSeek, etc.)
                  │
                  ▼
            AgentTrace Server (Express + SQLite)
                  │
                  ▼
             Dashboard (React)
```

All components run locally on your machine. The proxy intercepts LLM traffic, extracts usage data (tokens, cost, latency), and sends it to the local server. The dashboard reads from the same SQLite database.
