# AgentTrace Operation Guide

> Local-first AI Agent observability platform — Complete installation, configuration, and usage manual

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [System Architecture](#2-system-architecture)
3. [Installation and Quick Start](#3-installation-and-quick-start)
4. [CLI Command Reference](#4-cli-command-reference)
5. [Proxy Server](#5-proxy-server)
6. [SDK Usage Guide](#6-sdk-usage-guide)
7. [Dashboard](#7-dashboard)
8. [Alert System](#8-alert-system)
9. [Provider Key Management](#9-provider-key-management)
10. [API Reference](#10-api-reference)
11. [Docker Deployment](#11-docker-deployment)
12. [Environment Variables](#12-environment-variables)
13. [Troubleshooting](#13-troubleshooting)
14. [Appendix: Quick Start Checklist](#14-appendix-quick-start-checklist)

---

## 1. Platform Overview

AgentTrace is a **local-first** AI Agent observability platform. With a single command `npx agenttrace`, you can launch everything: an Express server, an LLM proxy, and a React dashboard — all data stored locally in SQLite with zero cloud dependencies.

### Core Features

- **LLM Call Monitoring**: Track every Agent's LLM requests, latency, and token usage
- **Cost Tracking**: Spend analysis by Provider / Model with daily budget alerts
- **Health Detection**: Automatic Agent status assessment (healthy / degraded / down) based on heartbeat mechanism
- **Alert Notifications**: Rules for Agent down, error rate threshold, budget overrun, delivered via Webhook or Email
- **Privacy First**: Prompt content and API keys never leave the user's machine

### Data Collection Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| **Proxy** (Recommended) | Transparent proxy intercepts LLM requests with zero code changes | No modifications to existing code needed; automatically captures all LLM calls |
| **SDK** | Manual instrumentation in your code | When you need precise control over which calls to track, or custom events |

### Supported LLM Providers

| Provider | Host Pattern | Path Detection |
|----------|-------------|----------------|
| OpenAI | `api.openai.com` | `/v1/chat/completions`, `/v1/completions` |
| Anthropic | `api.anthropic.com` | `/v1/messages` |
| Google | `generativelanguage.googleapis.com` | Host matching |
| Mistral | `api.mistral.ai` | Host matching |
| Cohere | `api.cohere.com` | Host matching |
| DeepSeek | `api.deepseek.com` | Host matching |

---

## 2. System Architecture

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Machine                           │
│                                                                 │
│  ┌──────────┐    ┌────────────────────┐                         │
│  │ AI Agent │───>│ AgentTrace Proxy   │──> LLM Provider         │
│  │          │<───│ (:4000 default)    │<── (OpenAI, Anthropic   │
│  └──────────┘    └────────┬───────────┘    Google, Mistral...)   │
│       │                   │                                     │
│       │ SDK               │ Metrics Data                        │
│       │ (optional)        │ (tokens, model, latency, cost)      │
│       │                   │                                     │
│       ▼                   ▼                                     │
│  ┌─────────────────────────────────────┐                        │
│  │     Express Server (:8080 default)  │                        │
│  │                                     │                        │
│  │  ┌───────────┐  ┌────────────────┐  │                        │
│  │  │ REST API  │  │ React Dashboard│  │                        │
│  │  │ /api/*    │  │ (Vite build)   │  │                        │
│  │  └─────┬─────┘  └────────────────┘  │                        │
│  │        │                            │                        │
│  │  ┌─────▼─────────────────────────┐  │                        │
│  │  │      SQLite Database          │  │                        │
│  │  │  ~/.agenttrace/data.db        │  │                        │
│  │  └───────────────────────────────┘  │                        │
│  └─────────────────────────────────────┘                        │
│                                                                 │
│  Config file: ~/.agenttrace/config.json                         │
│  Encrypted keystore: AES-256-GCM encrypted storage              │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

- **Single Command Startup**: `agenttrace start` launches the Express server, LLM Proxy, and React dashboard simultaneously
- **Local SQLite**: All data is stored in `~/.agenttrace/data.db` with no external database required
- **Privacy Guarantee**: The Proxy only extracts metric data (token counts, model name, latency, cost) — prompt content and API keys never leave the local machine

### Project Structure (Turborepo Monorepo)

```
agenttrace/
├── packages/
│   ├── cli/               # CLI entry point (agenttrace command)
│   ├── server/            # Express API + SQLite database
│   ├── proxy/             # LLM Proxy with metrics extraction
│   ├── sdk/               # TypeScript SDK (@agenttrace/sdk)
│   └── shared/            # Shared types, pricing calculations, Provider detection
├── apps/
│   └── dashboard-local/   # React + Vite dashboard
├── package.json           # Monorepo root config
└── turbo.json             # Turborepo config
```

---

## 3. Installation and Quick Start

### 3.1 Installation

**Option A: One-line install (Recommended)**

```bash
curl -fsSL https://raw.githubusercontent.com/agenttrace/agenttrace/main/scripts/install.sh | sh
```

This script automatically detects your platform, downloads Node.js if needed, and installs AgentTrace to `~/.agenttrace/`. No prerequisites required.

**Option B: Homebrew (macOS / Linux)**

```bash
brew install agenttrace/tap/agenttrace
```

**Option C: npm (requires Node.js >= 18)**

```bash
# Direct execution
npx agenttrace

# Or global install
npm install -g agenttrace
```

### 3.2 Uninstalling

```bash
# If installed via curl | sh
curl -fsSL https://raw.githubusercontent.com/agenttrace/agenttrace/main/scripts/uninstall.sh | sh
# Or: agenttrace uninstall

# If installed via Homebrew
brew uninstall agenttrace

# If installed via npm
npm uninstall -g agenttrace
```

> Note: Uninstalling does **not** remove your data (`~/.agenttrace/config.json`, `~/.agenttrace/data.db`). The curl uninstaller will prompt you; for other methods, manually remove `~/.agenttrace/` if desired.

### 3.3 Initial Setup

On first use, run the setup wizard:

```bash
agenttrace onboard
```

This command will:

1. Create a `config.json` configuration file in the `~/.agenttrace/` directory
2. Generate an authentication Token (used for API access and dashboard login)
3. Guide you through setting up LLM Provider API keys

### 3.4 Starting the Service

```bash
agenttrace start
```

After startup, a browser window automatically opens to the dashboard:

```
http://localhost:8080
```

Default ports:

| Service | Port | Description |
|---------|------|-------------|
| Express Server + Dashboard | 8080 | REST API and React dashboard |
| LLM Proxy | 4000 | Proxies LLM requests and extracts metrics |

### 3.5 Quick Verification

After startup, use the following methods to verify the system is running properly:

```bash
# Check server health
curl http://localhost:8080/api/health

# Check Proxy health
curl http://localhost:4000/health

# Use the built-in diagnostic tool
agenttrace doctor
```

---

## 4. CLI Command Reference

### Command Overview

| Command | Description | Flags |
|---------|-------------|-------|
| `onboard` | Initial setup, generates Token, configures Providers | — |
| `start` | Starts the server, Proxy, and dashboard | `--port` (default 8080), `--proxy-port` (default 4000), `--retention-days` (default 30), `--no-open` |
| `status` | Displays current configuration | — |
| `reset-token` | Regenerates the authentication Token | — |
| `providers list` | Lists configured Providers | — |
| `providers set <name> <key>` | Stores a Provider API key | — |
| `providers remove <name>` | Removes a Provider | — |
| `version` | Displays the version number | — |
| `doctor` | Runs a system health check | `--port`, `--proxy-port` |
| `agents` | Lists registered Agents | `--port`, `--proxy-port` |
| `stats [agentId]` | Displays Agent statistics | `--port`, `--proxy-port`, `--range` (1h/24h/7d/30d, default 24h) |
| `uninstall` | Removes a curl-based installation | `--yes` (skip prompts) |
| `help` | Displays help information | — |

### Detailed Descriptions

#### `agenttrace onboard`

Initial setup wizard. Generates an authentication Token and writes it to `~/.agenttrace/config.json`, then guides the user through configuring Provider API keys.

#### `agenttrace start`

Starts all services.

```bash
# Start with default ports
agenttrace start

# Custom ports, without auto-opening the browser
agenttrace start --port 9090 --proxy-port 5000 --no-open

# Set data retention to 7 days
agenttrace start --retention-days 7
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `8080` | Express server and dashboard port |
| `--proxy-port` | `4000` | LLM Proxy port |
| `--retention-days` | `30` | Event data retention period in days |
| `--no-open` | `false` | Do not auto-open the browser on startup |

#### `agenttrace status`

Displays current configuration, including Token prefix, configured Providers, database path, and more.

#### `agenttrace reset-token`

Regenerates the authentication Token. The old Token is immediately invalidated. You will need to update all SDK configurations and dashboard logins that use the old Token.

#### `agenttrace providers`

Manage LLM Provider API keys.

```bash
# List all configured Providers
agenttrace providers list

# Set OpenAI API Key (securely encrypted)
agenttrace providers set openai sk-xxxxxxxxxxxxx

# Remove the Anthropic Provider
agenttrace providers remove anthropic
```

#### `agenttrace doctor`

Runs a system health check to verify the server and Proxy are operating correctly.

```bash
agenttrace doctor
agenttrace doctor --port 9090 --proxy-port 5000
```

#### `agenttrace agents`

Lists all registered Agents and their current status.

```bash
agenttrace agents
```

#### `agenttrace stats`

Displays Agent statistics. If there is only one Agent in the system, it is automatically selected.

```bash
# Display statistics for all Agents (default 24 hours)
agenttrace stats

# Display statistics for a specific Agent over a 7-day range
agenttrace stats my-agent --range 7d
```

---

## 5. Proxy Server

The Proxy is a local HTTP proxy that transparently intercepts your AI Agent's requests to LLM Providers, automatically extracting metrics such as token usage, latency, and cost — **without modifying any existing code**.

### 5.1 Path Prefix Routing (Recommended)

The Proxy supports path prefix routing, which automatically forwards requests to the corresponding Provider:

| Path Prefix | Target |
|-------------|--------|
| `/openai/...` | `https://api.openai.com` |
| `/anthropic/...` | `https://api.anthropic.com` |
| `/google/...` | `https://generativelanguage.googleapis.com` |
| `/cohere/...` | `https://api.cohere.ai` |
| `/mistral/...` | `https://api.mistral.ai` |
| `/deepseek/...` | `https://api.deepseek.com` |

#### OpenAI SDK Integration Example

**Option A: Use stored API Key (Recommended)**

If you've stored your API Key with `agenttrace providers set openai <key>`, use the path prefix for automatic injection:

```bash
export OPENAI_BASE_URL=http://localhost:4000/openai/v1
```

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:4000/openai/v1",
  apiKey: "dummy",  // Any value — will be overwritten by Proxy
});
```

**Option B: Provide your own API Key**

If you want to use your own API Key (not the stored one):

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:4000/v1",
  apiKey: process.env.OPENAI_API_KEY,  // Must provide your own
});
```

The Proxy detects this as an OpenAI request from the path `/v1/chat/completions` and passes your key through.

#### Anthropic SDK Integration Example

Use the `/anthropic` path prefix — the Proxy will automatically inject the stored API Key:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  baseURL: "http://localhost:4000/anthropic",
  apiKey: "dummy",  // Any value — will be overwritten by Proxy
});

const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello!" }],
});
```

> To use your own API Key instead, set `apiKey` and avoid the path prefix (but automatic injection won't work).

### 5.2 Using the x-target-url Header

If path prefix routing does not meet your needs, you can use the `x-target-url` header to explicitly specify the target:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "x-target-url: https://api.openai.com" \
  -H "Authorization: Bearer sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hi"}]}'
```

### 5.3 Provider Detection Priority

The Proxy detects the target Provider in the following order:

1. **Path prefix** — e.g., `/openai/...`, `/anthropic/...`
2. **Host header** — e.g., `Host: api.openai.com`
3. **Path pattern** — e.g., `/v1/chat/completions` maps to OpenAI
4. **x-target-url header** — manually specified target URL

### 5.4 Streaming Support

The Proxy supports both streaming (SSE, Server-Sent Events) and non-streaming responses. In streaming mode, the Proxy asynchronously parses and extracts metrics after the stream ends.

### 5.5 Health Check

```bash
curl http://localhost:4000/health
```

Response:

```json
{
  "status": "ok",
  "agent_id": "my-agent",
  "uptime_ms": 123456
}
```

### 5.6 Privacy Guarantee

The Proxy only extracts the following metric data:

- Token counts (input / output / total)
- Model name
- Latency (milliseconds)
- Cost (USD)
- HTTP status code

**Prompt content and API keys are never sent to the AgentTrace server.**

---

## 6. SDK Usage Guide

### 6.1 Installation

```bash
npm install @agenttrace/sdk
```

### 6.2 Initialization

```typescript
import { AgentTrace } from "@agenttrace/sdk";

const at = AgentTrace.init({
  apiKey: "your-token",           // Required: Token generated during onboard
  agentId: "my-agent",            // Required: Unique identifier for this Agent
  endpoint: "http://localhost:8080/api/events",  // Optional: Defaults to local server
});
```

> `apiKey` and `agentId` are required parameters. An error is thrown if either is missing.

### 6.3 Tracking LLM Calls

```typescript
at.track({
  provider: "openai",           // LLM Provider name
  model: "gpt-4o",              // Model name
  tokens: {
    input: 500,                 // Input token count
    output: 200,                // Output token count
  },
  latency_ms: 1200,             // Latency in milliseconds
  status: 200,                  // HTTP status code
});
```

### 6.4 Sending Heartbeats

Call `heartbeat()` periodically to indicate the Agent is still running:

```typescript
// Recommended: send every 30 seconds
const heartbeatTimer = setInterval(() => {
  at.heartbeat();
}, 30_000);
```

Agent status determination rules:

- **Healthy**: Last heartbeat was less than 2 minutes ago
- **Degraded**: Last heartbeat was 2 to 10 minutes ago
- **Down**: Last heartbeat was more than 10 minutes ago

### 6.5 Reporting Errors

```typescript
try {
  await someOperation();
} catch (err) {
  at.error(err as Error);
  // The Error object's stack trace is automatically captured
}
```

### 6.6 Custom Events

```typescript
at.custom({
  key: "value",
  task: "data-processing",
  items_processed: 42,
});
```

### 6.7 Traces and Spans

The SDK supports structured Trace / Span tracking:

```typescript
const trace = at.startTrace();
const span = trace.startSpan("planning");
// ... execute planning logic ...
span.end();

const execSpan = trace.startSpan("execution");
// ... execute operations ...
execSpan.end();
```

### 6.8 Shutdown (Graceful Shutdown)

```typescript
// Call before process exit to ensure all buffered events are sent
await at.shutdown();
```

### 6.9 Event Buffering Mechanism

The SDK uses a batch sending strategy for efficiency:

- Events are first stored in an in-memory buffer
- Automatically flushed every **5 seconds**
- Immediately flushed when the buffer reaches **50 events** (whichever comes first)
- Hard cap of **5,000** events
- Network errors are logged as warnings but **do not throw exceptions** (they will not affect your Agent's operation)

### 6.10 Complete Example

```typescript
import { AgentTrace } from "@agenttrace/sdk";
import OpenAI from "openai";

const at = AgentTrace.init({
  apiKey: process.env.AGENTTRACE_TOKEN!,
  agentId: "my-chatbot",
  endpoint: "http://localhost:8080/api/events",
});

const openai = new OpenAI();

// Send heartbeats periodically
setInterval(() => at.heartbeat(), 30_000);

async function chat(userMessage: string): Promise<string> {
  const start = Date.now();
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: userMessage }],
    });

    at.track({
      provider: "openai",
      model: "gpt-4o",
      tokens: {
        input: response.usage?.prompt_tokens,
        output: response.usage?.completion_tokens,
      },
      latency_ms: Date.now() - start,
      status: 200,
    });

    return response.choices[0].message.content ?? "";
  } catch (err) {
    at.error(err as Error);
    throw err;
  }
}

// Before process exit
process.on("SIGTERM", async () => {
  await at.shutdown();
  process.exit(0);
});
```

---

## 7. Dashboard

### 7.1 Login

The dashboard uses **Token authentication**. After starting the service, enter your authentication Token on the login page. Token sources:

- Generated on first run of `agenttrace onboard`
- Stored in `~/.agenttrace/config.json`
- Can be regenerated via `agenttrace reset-token`

### 7.2 Page Overview

| Page | Description |
|------|-------------|
| **Overview** | Key metrics overview across all Agents |
| **Agents** (Agent List) | List of all Agents with status indicators (healthy / degraded / down), with search, filtering, and pagination |
| **Agent Detail** | Detailed statistics and charts for a single Agent |
| **Costs** | Cost analysis and charts by Provider / Model |
| **Alerts** | Alert rule management and alert history |

### 7.3 Agent Detail Page

The Agent detail page provides the following information:

**Stats Cards**

| Metric | Description |
|--------|-------------|
| Total Requests | Total number of requests |
| Total Errors | Number of errors |
| Error Rate | Error rate percentage |
| Total Cost | Total spend (USD) |
| Tokens Used | Total token usage |
| P50 Latency | Median latency (milliseconds) |
| P99 Latency | 99th percentile latency (milliseconds) |

**Charts** (rendered with Recharts)

- Token usage trend chart (Input / Output tokens over time)
- Cost breakdown chart (by Provider / Model)

**Time Range Filter**

Supports the following preset ranges:

- 1 hour (1h)
- 24 hours (24h)
- 7 days (7d)
- 30 days (30d)

### 7.4 Cost Analysis

The cost page provides aggregated spend across Providers and Models:

- Cost trend chart
- Cost breakdown by Provider
- Cost breakdown by Model

---

## 8. Alert System

### 8.1 Alert Rule Types

| Type | Description | Configurable Parameters | Default |
|------|-------------|------------------------|---------|
| **agent_down** | Agent has not sent a heartbeat for an extended period | `duration_minutes`: minutes before considered down | 10 minutes |
| **error_rate** | Error rate exceeds threshold | `threshold`: percentage; `window_minutes`: rolling window | 20%, 5 minutes |
| **budget** | Daily spend exceeds budget | `threshold`: amount limit in USD | — |

### 8.2 Notification Channels

Each alert rule can be configured with the following notification methods:

**Webhook**

- Sends a JSON payload via POST to a specified URL
- Automatically retries up to 3 times on failure with exponential backoff (1s, 4s, 16s)

**Email (SMTP)**

- Sends alert notifications via an SMTP server
- Requires SMTP environment variables to be configured (see the [Environment Variables](#12-environment-variables) section)

### 8.3 Cooldown Mechanism

After a rule fires, it enters a **15-minute** cooldown period during which the same rule will not fire again. This prevents alert fatigue.

### 8.4 Management Methods

Alert rules can be managed in two ways:

1. **Dashboard UI**: Create, edit, enable/disable, and delete rules on the Alerts page, and view alert history
2. **REST API**: Manage programmatically via the `/api/alerts` endpoint (see the [API Reference](#10-api-reference) section)

### 8.5 Creating Alert Rules (Dashboard)

1. Navigate to the Alerts page
2. Click "New Alert Rule"
3. Select the target Agent
4. Choose the rule type (agent_down / error_rate / budget)
5. Configure the relevant parameters
6. Enter a Webhook URL and/or Email address
7. Save the rule

### 8.6 Alert History

Switch to the "History" tab to view all triggered alert records, including trigger time, target Agent, rule type, alert message, and delivery method.

---

## 9. Provider Key Management

### 9.1 Encrypted Storage

Provider API keys are **never stored in plaintext** in the configuration file. AgentTrace uses an **AES-256-GCM** encrypted keystore to protect your API keys.

### 9.2 Storage and Management

```bash
# Store OpenAI API Key (securely encrypted)
agenttrace providers set openai sk-xxxxxxxxxxxxx

# Store Anthropic API Key
agenttrace providers set anthropic sk-ant-xxxxxxxxxxxxx

# List configured Providers
agenttrace providers list

# Remove a Provider
agenttrace providers remove openai
```

### 9.3 Keystore Backends

AgentTrace supports multiple keystore backends, automatically detected in the following priority order:

| Priority | Backend | Description |
|----------|---------|-------------|
| 1 | Environment variable | Manually specified via `AGENTTRACE_SECRET_BACKEND` |
| 2 | macOS Keychain | Automatically used on macOS with a GUI session |
| 3 | Linux libsecret | Automatically used on Linux |
| 4 | MachineKeyStore (default) | AES-256-GCM encryption based on machine-id + username |

### 9.4 Automatic Migration

If legacy plaintext API keys exist in `config.json`, AgentTrace will **automatically** migrate them to the encrypted keystore on startup.

### 9.5 Secure Injection Mechanism

When the Proxy forwards requests, it only injects API keys when the hostname matches a known Provider. This prevents key leakage to unknown third-party services.

---

## 10. API Reference

All API endpoints require authentication using one of the following methods:

- Header: `Authorization: Bearer <token>`
- Header: `x-api-key: <token>`

### 10.1 Events

#### POST /api/events

Accepts batch or single events.

**Request format — Batch:**

```json
{
  "events": [
    {
      "agent_id": "my-agent",
      "event_type": "llm_call",
      "source": "sdk",
      "timestamp": "2025-01-15T10:30:00.000Z",
      "provider": "openai",
      "model": "gpt-4o",
      "tokens_in": 500,
      "tokens_out": 200,
      "tokens_total": 700,
      "cost_usd": 0.0035,
      "latency_ms": 1200,
      "status_code": 200,
      "error_message": null,
      "tags": {}
    }
  ]
}
```

**Request format — Single event:**

```json
{
  "agent_id": "my-agent",
  "event_type": "heartbeat",
  "source": "sdk",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

**Event types:** `llm_call` | `completion` | `heartbeat` | `error` | `custom`

**Event sources:** `sdk` | `proxy`

**Field descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agent_id` | string | Yes | Agent identifier |
| `event_type` | string | Yes | Event type |
| `source` | string | Yes | Data source (sdk / proxy) |
| `timestamp` | string | Yes | ISO-8601 timestamp |
| `provider` | string | No | LLM Provider name |
| `model` | string | No | Model name |
| `tokens_in` | number | No | Input token count |
| `tokens_out` | number | No | Output token count |
| `tokens_total` | number | No | Total token count |
| `cost_usd` | number | No | Cost (USD) |
| `latency_ms` | number | No | Latency (milliseconds) |
| `status_code` | number | No | HTTP status code |
| `error_message` | string | No | Error message |
| `tags` | object | No | Custom tags (JSON object) |

**Response status codes:**

| Status Code | Description |
|-------------|-------------|
| `200 OK` | All events validated and stored |
| `207 Multi-Status` | Some events failed validation; valid events were stored |
| `400 Bad Request` | All events failed validation or malformed JSON |
| `401 Unauthorized` | Invalid Token |
| `429 Too Many Requests` | Rate limited (1,000 events per minute); response includes `Retry-After` header |

#### GET /api/events

Query events with the following filter parameters:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `agent_id` | Yes | Agent identifier |
| `from` | No | Start time (ISO-8601) |
| `to` | No | End time (ISO-8601) |
| `event_type` | No | Filter by event type |
| `provider` | No | Filter by Provider |
| `model` | No | Filter by model |
| `trace_id` | No | Filter by Trace ID |
| `search` | No | Search keyword |
| `limit` | No | Maximum number of results (max 10,000) |

#### GET /api/events/export

Export event data in CSV or JSON format, up to 100,000 records.

### 10.2 Agents

#### GET /api/agents

List all Agents with pagination and search support.

| Parameter | Description |
|-----------|-------------|
| `limit` | Number of results per page |
| `offset` | Offset |
| `search` | Search keyword |
| `status` | Filter by status (healthy / degraded / down) |

#### GET /api/agents/:agentId

Get detailed information for a specific Agent.

### 10.3 Stats

#### GET /api/stats/overview

Get aggregated statistics across all Agents.

| Parameter | Description |
|-----------|-------------|
| `range` | Time range: `1h`, `24h`, `7d`, `30d` |

#### GET /api/stats/:agentId

Get statistics for a specific Agent.

| Parameter | Description |
|-----------|-------------|
| `range` | Preset time range: `1h`, `24h`, `7d`, `30d` |
| `from` | Custom start time (ISO-8601) |
| `to` | Custom end time (ISO-8601) |

### 10.4 Alerts

#### GET /api/alerts

List alert rules.

| Parameter | Description |
|-----------|-------------|
| `limit` | Number of results per page |
| `offset` | Offset |
| `agent_id` | Filter by Agent |
| `rule_type` | Filter by rule type |

#### POST /api/alerts

Create an alert rule.

```json
{
  "agent_id": "my-agent",
  "rule_type": "error_rate",
  "config": {
    "threshold": 20,
    "window_minutes": 5
  },
  "webhook_url": "https://hooks.example.com/alert",
  "email": "ops@example.com",
  "enabled": true
}
```

#### PUT /api/alerts/:id

Update an alert rule (full replacement).

#### DELETE /api/alerts/:id

Delete an alert rule.

#### PATCH /api/alerts/:id/toggle

Toggle an alert rule's enabled/disabled state.

#### GET /api/alert-history

List alert trigger history records.

### 10.5 Auth

#### POST /api/auth/verify

Verify whether a Token is valid.

```json
{
  "token": "your-token"
}
```

Response:

```json
{
  "valid": true
}
```

### 10.6 Health Check

#### GET /api/health

Server health status.

```json
{
  "status": "ok"
}
```

---

## 11. Docker Deployment

### 11.1 Using Docker Compose

```bash
docker compose up -d
```

### 11.2 Port Mapping

| Port | Service |
|------|---------|
| 8080 | Dashboard + REST API |
| 4000 | LLM Proxy |

### 11.3 Data Persistence

Docker uses an `agenttrace-data` volume to persist the `~/.agenttrace/` directory, ensuring the SQLite database, configuration files, and encrypted keystore are retained across container restarts.

---

## 12. Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | When set to `production`, uses JSON-formatted logs | — |
| `LOG_LEVEL` | Log level: `debug` / `info` / `warn` / `error` | `info` |
| `SMTP_HOST` | SMTP server address | — |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASS` | SMTP password | — |
| `SMTP_FROM` | Sender email address | `alerts@agenttrace.dev` |
| `SMTP_SECURE` | Whether to use TLS | `false` |
| `AGENTTRACE_SECRET_BACKEND` | Manually specify the keystore backend | Auto-detected |

### Email Alert Configuration Example

To enable email alerts, configure the SMTP environment variables:

```bash
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@gmail.com
export SMTP_PASS=your-app-password
export SMTP_FROM=alerts@your-domain.com
export SMTP_SECURE=false
```

---

## 13. Troubleshooting

### Events are not appearing in the dashboard

1. **Verify the Token is correct**: Ensure the Token used by the SDK or Proxy matches the one in `~/.agenttrace/config.json`
2. **Check endpoint configuration**: Confirm the endpoint points to `http://localhost:8080/api/events`
3. **Ensure the buffer has been flushed**: Events may still be in the buffer. Call `at.shutdown()` to force a flush, or wait for the 5-second auto-flush cycle
4. **Check console warnings**: SDK network errors do not throw exceptions but are logged as warnings in the console

### Proxy cannot detect the Provider

1. **Use path prefix routing**: This is the most reliable method. For example, set the base URL to `http://localhost:4000/openai/v1`
2. **Use x-target-url**: Add the `x-target-url` header to explicitly specify the target
3. **Check the Provider detection order**: Path prefix -> Host header -> Path pattern -> x-target-url
4. **Check the Proxy logs**: The Proxy outputs detection results and warnings to the console

### Receiving 429 Too Many Requests

1. **Rate limit**: Maximum of 1,000 events per minute
2. **Increase buffer size**: A larger `maxBufferSize` reduces flush frequency
3. **Check Retry-After**: The `Retry-After` header in the response indicates how many seconds to wait

### Agent status shows "unknown"

1. **Confirm heartbeats are being sent**: Use `at.heartbeat()` to send heartbeats periodically (recommended every 30 seconds)
2. **Timeout threshold**: If no heartbeat is received for more than 10 minutes, the Agent is marked as "down"

### Dashboard login fails

1. **Verify the Token**: Check the Token in `~/.agenttrace/config.json`
2. **Regenerate the Token**: Run `agenttrace reset-token` to generate a new Token
3. **Confirm the server is running**: Run `agenttrace doctor` to check server status

### Cost calculations are incorrect

1. **Verify model names**: Cost calculation relies on the pricing table in `@agenttrace/shared`. Model names must match the pricing table
2. **Manually specify cost_usd**: If automatic calculation is inaccurate, pass the `cost_usd` field manually in `track()`

### Port conflicts

If the default ports are already in use, start with custom ports:

```bash
agenttrace start --port 9090 --proxy-port 5000
```

### Database issues

The SQLite database is located at `~/.agenttrace/data.db`. To reset it:

```bash
# Stop the service, then delete the database file
rm ~/.agenttrace/data.db

# Restart — the system will automatically create a new database
agenttrace start
```

---

## 14. Appendix: Quick Start Checklist

- [ ] Install AgentTrace (`curl | sh`, Homebrew, or npm)
- [ ] Run `agenttrace onboard` to complete initial setup
- [ ] Note down the authentication Token
- [ ] Use `agenttrace providers set` to configure LLM Provider API keys
- [ ] Run `agenttrace start` to launch all services
- [ ] Open `http://localhost:8080` in a browser to log into the dashboard
- [ ] Configure the Proxy in your AI Agent (point the base URL to `http://localhost:4000`) or integrate the SDK
- [ ] Verify that event data appears correctly in the dashboard
- [ ] Set up alert rules (agent_down / error_rate / budget)
- [ ] Run `agenttrace doctor` to confirm system health

---

> AgentTrace — Local-first AI Agent observability platform. One command, full visibility.
