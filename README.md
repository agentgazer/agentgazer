# AgentTrace

Local-first observability for AI agents. One command to monitor LLM calls, costs, errors, and latency across OpenAI, Anthropic, Google, Mistral, and Cohere.

```
npx agenttrace
```

This starts a local Express+SQLite server, an LLM proxy, and a web dashboard — no cloud dependencies.

## How it works

AgentTrace has two ways to capture data:

1. **LLM Proxy** (zero-code) — Point your LLM client's base URL at `http://localhost:4000`. The proxy forwards requests to the real provider, extracts usage metrics from responses (including SSE streams), and records them locally.

2. **SDK** (manual instrumentation) — Import `@agenttrace/sdk` into your agent code and call `track()` to record events with full control over what gets captured.

Both approaches store data in a local SQLite database (`~/.agenttrace/data.db`) and expose it through a REST API and web dashboard.

## Quick start

### Using the proxy (recommended)

```bash
# Start AgentTrace
npx agenttrace

# Point your OpenAI client at the proxy
export OPENAI_BASE_URL=http://localhost:4000/v1

# Use your LLM client as normal — calls are recorded automatically
```

The proxy auto-detects the provider from the request URL and forwards to the correct upstream API. Supported providers:

| Provider | Host pattern |
|----------|-------------|
| OpenAI | `api.openai.com` |
| Anthropic | `api.anthropic.com` |
| Google | `generativelanguage.googleapis.com` |
| Mistral | `api.mistral.ai` |
| Cohere | `api.cohere.com` |

For providers that can't be auto-detected, set the `x-target-url` header:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "x-target-url: https://api.openai.com" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "hello"}]}'
```

### Using the SDK

```bash
npm install @agenttrace/sdk
```

```typescript
import { AgentTrace } from "@agenttrace/sdk";

const at = AgentTrace.init({
  apiKey: "your-token",        // from ~/.agenttrace/config.json
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
agenttrace [options]

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
export SMTP_FROM=alerts@agenttrace.dev
export SMTP_SECURE=false
```

## Docker

```bash
docker compose up -d
```

This builds and runs AgentTrace with persistent storage. The dashboard is available at `http://localhost:8080` and the proxy at `http://localhost:4000`.

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   npx agenttrace                 │
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
| `agenttrace` | CLI entry point — starts server, proxy, and dashboard |
| `@agenttrace/server` | Express API server with SQLite storage |
| `@agenttrace/proxy` | Transparent LLM proxy with metric extraction |
| `@agenttrace/sdk` | Client SDK for manual instrumentation |
| `@agenttrace/shared` | Shared types, schemas, provider detection, and pricing |

## Cost tracking

AgentTrace automatically calculates USD cost for known models when token counts are available. Supported models include GPT-4o, GPT-4, Claude Opus/Sonnet/Haiku, Gemini, Mistral, Command-R, and others. See `packages/shared/src/pricing.ts` for the full pricing table.

## Configuration

On first run, AgentTrace creates `~/.agenttrace/config.json` with a randomly generated auth token. The SQLite database is stored at `~/.agenttrace/data.db`.

To reset the auth token:

```bash
agenttrace --reset-token
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Set to `production` for JSON log output |
| `LOG_LEVEL` | Log verbosity: `debug`, `info`, `warn`, `error` (default: `info`) |
| `SMTP_HOST` | SMTP server hostname for email alerts |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | Sender email address (default: `alerts@agenttrace.dev`) |
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
