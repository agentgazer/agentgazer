# AgentGazer

**From Observability to Control** — The missing governance layer for AI agents.

Most observability tools just **watch**. AgentGazer **controls**.

| Feature | Langsmith | Langfuse | Helicone | AgentGazer |
|---------|:---------:|:--------:|:--------:|:----------:|
| Tracing | ✅ | ✅ | ✅ | ✅ |
| Cost Tracking | ✅ | ✅ | ✅ | ✅ |
| **Rate Limiting** | ❌ | ❌ | ❌ | ✅ |
| **Model Override** | ❌ | ❌ | ❌ | ✅ |
| **Kill Switch** | ❌ | ❌ | ❌ | ✅ |
| Self-hosted | ❌ | ✅ | ❌ | ✅ |
| Zero SaaS cost | ❌ | ❌ | ❌ | ✅ |

**[Documentation](https://agentgazer.com)** | **[中文文件](https://agentgazer.com/zh/)**

## Install

```bash
# One-line install (recommended) — works without Node.js
curl -fsSL https://raw.githubusercontent.com/agentgazer/agentgazer/main/scripts/install.sh | sh

# Homebrew (macOS / Linux)
brew install agentgazer/tap/agentgazer

# npm (requires Node.js >= 18)
npx agentgazer
```

This starts a local Express+SQLite server, an LLM proxy, and a web dashboard — no cloud dependencies.

## How it works

AgentGazer has two ways to capture data:

1. **LLM Proxy** (zero-code) — Point your LLM client's base URL at `http://localhost:4000`. The proxy forwards requests to the real provider, extracts usage metrics from responses (including SSE streams), and records them locally.

2. **SDK** (manual instrumentation) — Import `@agentgazer/sdk` into your agent code and call `track()` to record events with full control over what gets captured.

Both approaches store data in a local SQLite database (`~/.agentgazer/data.db`) and expose it through a REST API and web dashboard.

## Governance Features

### 🛡️ Kill Switch — Stop runaway agents

Detects infinite loops using SimHash similarity scoring. When an agent keeps making similar requests (same prompts, same tool calls, similar responses), AgentGazer auto-deactivates it before it burns your budget.

```
Score = similar_prompts × 1.0 + similar_responses × 2.0 + repeated_tool_calls × 1.5
Score > Threshold → Agent deactivated
```

Configure per-agent in the Dashboard: window size, score threshold, enable/disable.

### 🔄 Model Override — Force cheaper models

Replace expensive models with cheaper alternatives without changing your agent code. The proxy rewrites the request before forwarding.

```
Agent requests: gpt-4           Your override rule: openai → gpt-4o-mini
      ↓                                    ↓
   Proxy intercepts ──────────────────→ Rewrites to gpt-4o-mini
      ↓
   Sent to OpenAI (90% cost savings)
```

Set per-agent per-provider rules in the Dashboard.

### ⏱️ Rate Limiting — Prevent quota exhaustion

Sliding window rate limits per provider. Agents exceeding the limit receive `429 Too Many Requests` with `Retry-After` header.

```
Provider: openai
Limit: 100 requests / 60 seconds
```

Configure in the Dashboard or via API.

## Quick start

### Using the proxy (recommended)

```bash
# Start AgentGazer
npx agentgazer

# Point your OpenAI client at the proxy
export OPENAI_BASE_URL=http://localhost:4000/v1

# Use your LLM client as normal — calls are recorded automatically
```

The proxy auto-detects the provider from the request URL and forwards to the correct upstream API. Supported providers:

| Provider | Host pattern | | Provider | Host pattern |
|----------|-------------|---|----------|-------------|
| OpenAI | `api.openai.com` | | DeepSeek | `api.deepseek.com` |
| Anthropic | `api.anthropic.com` | | Moonshot | `api.moonshot.cn` |
| Google | `generativelanguage.googleapis.com` | | Zhipu (智譜) | `open.bigmodel.cn` |
| Mistral | `api.mistral.ai` | | MiniMax | `api.minimax.chat` |
| Cohere | `api.cohere.com` | | Baichuan (百川) | `api.baichuan-ai.com` |

For providers that can't be auto-detected, set the `x-target-url` header:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "x-target-url: https://api.openai.com" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "hello"}]}'
```

### Using the SDK

```bash
npm install @agentgazer/sdk
```

```typescript
import { AgentGazer } from "@agentgazer/sdk";

const at = AgentGazer.init({
  apiKey: "your-token",        // from ~/.agentgazer/config.json
  agentId: "my-agent",
  endpoint: "http://localhost:8080/api/events",
});

// Track an LLM call
at.track({
  provider: "openai",
  model: "gpt-4o",
  tokens: { input: 150, output: 50 },
  latency_ms: 1200,
  status: 200,
});

// Track errors
at.error(new Error("Agent failed to parse response"));

// Send heartbeats
at.heartbeat();

// Distributed tracing
const trace = at.startTrace();
const span = trace.startSpan("planning");
const childSpan = span.startSpan("tool-call");

at.track({
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  trace_id: trace.traceId,
  span_id: childSpan.spanId,
  parent_span_id: childSpan.parentSpanId,
  tokens: { input: 500, output: 200 },
  latency_ms: 3000,
  status: 200,
});

// Flush and shut down when done
await at.shutdown();
```

## CLI options

```
agentgazer [options]

Options:
  --port <number>            Server/dashboard port (default: 8080)
  --proxy-port <number>      LLM proxy port (default: 4000)
  --retention-days <number>  Data retention period in days (default: 30)
  --no-open                  Don't auto-open browser
  --reset-token              Generate a new auth token and exit
  --help                     Show this help message
```

## API

All API endpoints require authentication via `Authorization: Bearer <token>` or `x-api-key: <token>` header.

### Event ingestion

```
POST /api/events
```

Accepts a batch of events:

```json
{
  "events": [
    {
      "agent_id": "my-agent",
      "event_type": "llm_call",
      "provider": "openai",
      "model": "gpt-4o",
      "tokens_in": 150,
      "tokens_out": 50,
      "latency_ms": 1200,
      "status_code": 200,
      "source": "sdk",
      "timestamp": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

Rate limit: 1000 events/minute per API key.

### Querying events

```
GET /api/events?agent_id=my-agent&from=2025-01-01&to=2025-01-31&provider=openai&model=gpt-4o&search=error
```

### Exporting data

```
GET /api/events/export?format=csv&agent_id=my-agent
GET /api/events/export?format=json&agent_id=my-agent
```

### Agent management

```
GET    /api/agents
POST   /api/agents/register   { "agent_id": "my-agent", "name": "My Agent" }
POST   /api/agents/heartbeat  { "agent_id": "my-agent" }
```

### Statistics

```
GET /api/stats/summary?agent_id=my-agent
GET /api/stats/timeseries?agent_id=my-agent&bucket=hour
```

### Alerts

```
GET    /api/alerts
POST   /api/alerts
PUT    /api/alerts/:id
DELETE /api/alerts/:id
PATCH  /api/alerts/:id/toggle
GET    /api/alert-history
```

Alert rule types:

- **agent_down** — fires when an agent hasn't sent a heartbeat within `duration_minutes`
- **error_rate** — fires when error rate exceeds `threshold`% over `window_minutes`
- **budget** — fires when daily spend exceeds `threshold` USD

Delivery channels: webhook (with exponential backoff retry) and email (requires SMTP configuration).

See `packages/server/openapi.yaml` for the full OpenAPI specification.

## Alerting

### Webhook alerts

Webhooks are delivered via POST with JSON body and retried up to 3 times with exponential backoff (1s, 4s, 16s).

```json
{
  "agent_id": "my-agent",
  "rule_type": "error_rate",
  "message": "Agent \"my-agent\" error rate is 25.0% (5/20) over the last 15m (threshold: 10%)",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Email alerts

Set SMTP environment variables to enable email delivery:

```bash
export SMTP_HOST=smtp.example.com
export SMTP_PORT=587
export SMTP_USER=alerts@example.com
export SMTP_PASS=secret
export SMTP_FROM=alerts@agentgazer.com
export SMTP_SECURE=false
```

## Docker

```bash
docker compose up -d
```

This builds and runs AgentGazer with persistent storage. The dashboard is available at `http://localhost:8080` and the proxy at `http://localhost:4000`.

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   npx agentgazer                 │
│                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │  Dashboard   │  │   Express   │  │  LLM     │ │
│  │  (React)     │  │   Server    │  │  Proxy   │ │
│  │  :8080       │  │   :8080/api │  │  :4000   │ │
│  └──────┬───────┘  └──────┬──────┘  └────┬─────┘ │
│         │                 │              │        │
│         │          ┌──────┴──────┐       │        │
│         └─────────►│   SQLite    │◄──────┘        │
│                    │  data.db    │                 │
│                    └─────────────┘                 │
└──────────────────────────────────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `agentgazer` | CLI entry point — starts server, proxy, and dashboard |
| `@agentgazer/server` | Express API server with SQLite storage |
| `@agentgazer/proxy` | Transparent LLM proxy with metric extraction |
| `@agentgazer/sdk` | Client SDK for manual instrumentation |
| `@agentgazer/shared` | Shared types, schemas, provider detection, and pricing |

## Cost tracking

AgentGazer automatically calculates USD cost for known models when token counts are available. Supported models include GPT-4o, GPT-4, Claude Opus/Sonnet/Haiku, Gemini, Mistral, Command-R, and others. See `packages/shared/src/pricing.ts` for the full pricing table.

## Configuration

On first run, AgentGazer creates `~/.agentgazer/config.json` with a randomly generated auth token. The SQLite database is stored at `~/.agentgazer/data.db`.

To reset the auth token:

```bash
agentgazer --reset-token
```

## Uninstall

```bash
# If installed via curl | sh
agentgazer uninstall
# Or: curl -fsSL https://raw.githubusercontent.com/agentgazer/agentgazer/main/scripts/uninstall.sh | sh

# If installed via Homebrew
brew uninstall agentgazer

# If installed via npm
npm uninstall -g agentgazer
```

User data (`~/.agentgazer/`) is preserved by default. The curl uninstaller will prompt you; for other methods, manually remove `~/.agentgazer/` if desired.

## Environment variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Set to `production` for JSON log output |
| `LOG_LEVEL` | Log verbosity: `debug`, `info`, `warn`, `error` (default: `info`) |
| `SMTP_HOST` | SMTP server hostname for email alerts |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | Sender email address (default: `alerts@agentgazer.com`) |
| `SMTP_SECURE` | Use TLS (`true`/`false`, default: `false`) |

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Dev mode (watch)
npm run dev
```

## License

Apache-2.0
