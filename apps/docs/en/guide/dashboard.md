# Dashboard

## Login

The dashboard uses **Token authentication**. After starting the service, enter your authentication Token on the login page. Token sources:

- Generated on first run of `agentgazer onboard`
- Stored in `~/.agentgazer/config.json`
- Can be regenerated via `agentgazer reset-token`

## Page Overview

| Page | Description |
|------|-------------|
| **Overview** | Key metrics overview across all Agents |
| **Agents** (Agent List) | List of all Agents with providers, policy status, and activity |
| **Agent Detail** | Detailed statistics, charts, model settings, and policy controls |
| **Costs** | Cost analysis and charts by Provider / Model |
| **Alerts** | Alert rule management and alert history |
| **Providers** | Provider configuration, API key management, and usage statistics |

## Providers

The Providers page allows you to manage LLM provider connections and their settings.

### Provider List

Each provider card shows:

| Field | Description |
|-------|-------------|
| **Name** | Provider name (e.g., openai, anthropic) |
| **Status Badge** | Active, Inactive, or Not configured |
| **Rate Limit** | Current rate limit if configured |

Click a provider card to view its detail page.

### Add Provider

::: warning Security Note
The "Add Provider" button is only enabled when accessing the dashboard from localhost (127.0.0.1 or ::1). When accessing from a LAN address, the button is disabled to protect API key security during transmission.
:::

To add a provider:

1. Click "Add Provider" (localhost only)
2. Select provider from dropdown
3. Enter API key
4. Click "Test & Save"

The system will validate the API key before saving. If validation fails, the provider is still saved with a warning — you can test the connection again from the provider detail page.

### Provider Detail Page

#### Settings Section

| Setting | Description |
|---------|-------------|
| **Active** | Toggle to enable/disable the provider. Disabled providers block all requests. |
| **Rate Limit** | Enable and configure global rate limit for this provider |
| **Max Requests** | Maximum requests allowed in the time window |
| **Window (seconds)** | Sliding window duration |

When a provider is deactivated, all agents using that provider will receive a `403 Forbidden` response with reason `provider_deactivated`.

When rate limited, agents receive a `429 Too Many Requests` response with reason `provider_rate_limited`.

#### Models Section

View and manage models for the provider:

- **Built-in models** — Pre-configured models from pricing tables (read-only)
- **Custom models** — User-added models (can be deleted)
- **Verified badge** — Model has been tested and confirmed to exist

To add a custom model:

1. Enter the model ID (e.g., `gpt-4o-2024-11-20`)
2. Click "Test & Add"
3. If the model exists, it will be added to the list

#### Stats Section

Usage statistics for the provider with time range filters (1h, 24h, 7d, 30d):

| Metric | Description |
|--------|-------------|
| **Total Requests** | Number of requests to this provider |
| **Total Tokens** | Total tokens consumed |
| **Total Cost** | Total spend (USD) |

The pie chart shows cost breakdown by model.

## Agents List

The Agents page displays all registered agents with the following columns:

| Column | Description |
|--------|-------------|
| **Agent ID** | Unique identifier |
| **Providers** | LLM providers used (e.g., OpenAI, Anthropic) with override indicator |
| **Requests** | Total request count |
| **Cost** | Total spend (USD) |
| **Last Activity** | Time since last event |
| **Status** | Policy status badges |

**Status Badges:**

- **Inactive** — Agent is deactivated (active=false)
- **Budget %** — Current daily spend as percentage of budget limit

**Override Indicator:**

Providers with active model overrides show a visual indicator (e.g., "OpenAI*") to indicate that requests to that provider are being redirected to a different model.

## Agent Detail Page

The Agent detail page provides the following information:

### Stats Cards

| Metric | Description |
|--------|-------------|
| Total Requests | Total number of requests |
| Total Errors | Number of errors |
| Blocked Requests | Requests blocked by policy |
| Error Rate | Error rate percentage |
| Total Cost | Total spend (USD) |
| Tokens Used | Total token usage |
| P50 Latency | Median latency (milliseconds) |
| P99 Latency | 99th percentile latency (milliseconds) |

### Charts

Rendered with Recharts:

- Token usage trend chart (Input / Output tokens over time)
- Cost breakdown chart (by Provider / Model)

### Time Range Filter

Supports the following preset ranges:

- 1 hour (1h)
- 24 hours (24h)
- 7 days (7d)
- 30 days (30d)

### Policy Settings

Control agent behavior with the following settings:

| Setting | Description |
|---------|-------------|
| **Active** | Toggle to enable/disable the agent. Disabled agents have all requests blocked. |
| **Budget Limit** | Daily spending cap in USD. Requests are blocked when limit is reached. |
| **Allowed Hours** | Time window when requests are allowed (server local time). |

**Daily Spend Display:**

When a budget limit is set, the UI shows current spend vs limit (e.g., "$12.34 / $20.00"). A warning indicator appears when spend exceeds 80% of the limit.

**Timezone:**

Allowed hours use server local time. The UI displays the server timezone (e.g., "Server time: UTC+8").

### Model Settings

Override the model used for each provider. The agent's original model request will be replaced with the selected model before forwarding to the provider.

| Control | Description |
|---------|-------------|
| **Provider Card** | One card per provider the agent has used |
| **Model Dropdown** | Select override model or "None" to use agent default |
| **Override Active** | Badge indicating an override is in effect |

This is useful for:
- **Cost control** — Force agents to use cheaper models (e.g., gpt-4o-mini instead of gpt-4o)
- **Testing** — Compare behavior across different models
- **Centralized management** — Control model usage across all agents from one place

### Rate Limit Settings

Configure per-provider rate limits to control request frequency. When a limit is exceeded, the Proxy returns a `429 Too Many Requests` response.

| Control | Description |
|---------|-------------|
| **Provider Dropdown** | Select a provider to add a rate limit |
| **Max Requests** | Maximum number of requests allowed in the time window |
| **Window (seconds)** | Time window for the rate limit (sliding window) |
| **Add / Apply / Remove** | Manage rate limit configurations |

**How it works:**

- Rate limits are per-agent per-provider (e.g., agent "my-bot" can have different limits for OpenAI vs Anthropic)
- Uses a sliding window algorithm — requests are counted within the last N seconds
- When limit is exceeded, the response includes `retry_after_seconds` indicating when to retry
- Rate-limited requests are recorded with block reason `rate_limited`

**Example:**

Setting "100 requests per 60 seconds" means the agent can make at most 100 requests to that provider within any 60-second sliding window.

See [Proxy Rate Limiting](/en/guide/proxy#rate-limiting) for details on response format.

### Request Log

Recent LLM calls with the following columns:

| Column | Description |
|--------|-------------|
| **Timestamp** | When the request was made |
| **Provider** | LLM provider |
| **Model** | Requested model and actual model (if different, shown as "gpt-4 → gpt-4o-mini") |
| **Tokens** | Input / Output token count |
| **Cost** | Request cost (USD) |

### Blocked Events

When requests are blocked by policy, the dashboard shows:

- **Blocked Count** — Total blocked requests
- **Block Reasons** — Breakdown by reason:
  - `agent_deactivated` — Agent is inactive
  - `budget_exceeded` — Daily budget limit reached
  - `outside_allowed_hours` — Request outside allowed time window

## Cost Analysis

The cost page provides aggregated spend across Providers and Models:

- Cost trend chart
- Cost breakdown by Provider
- Cost breakdown by Model
