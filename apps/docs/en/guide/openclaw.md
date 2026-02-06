# OpenClaw Integration

> Monitor your OpenClaw personal AI assistant with AgentGazer — zero code changes, full observability

## Overview

[OpenClaw](https://openclaw.ai) is an open-source personal AI assistant built with TypeScript/Node.js that runs on your local machine. It supports multiple LLM providers (Anthropic, OpenAI) and is configured through the `~/.openclaw/openclaw.json` configuration file.

### Why Monitor OpenClaw?

As an autonomous AI agent, OpenClaw continuously sends requests to LLM providers. Without proper monitoring, the following issues can occur without your knowledge:

- **Runaway costs**: Autonomous LLM calls initiated by OpenClaw can rapidly accumulate significant charges, and a lack of visibility means bills may far exceed expectations
- **Silent failures**: API call failures, rate limits, expired credentials, and other issues will not proactively notify you
- **Performance degradation**: Increased latency, declining response quality, and similar issues require historical data to diagnose effectively
- **Service outages**: OpenClaw may stop running for various reasons, and you might not notice for hours

### What AgentGazer Provides

By integrating OpenClaw with AgentGazer's Proxy mode, you can:

- **Track the cost of every LLM call**: Detailed spending breakdowns by provider and model
- **Monitor latency and error rates in real time**: Detect anomalies immediately
- **Configure alert rules**: Agent offline detection, error rate thresholds, daily budget caps
- **Zero code changes required**: Simply modify the `baseUrl` setting in OpenClaw — no forking or source code modifications needed

### How It Works

OpenClaw's `models.providers` configuration supports `baseUrl` overrides. By pointing `baseUrl` to the AgentGazer Proxy, the proxy transparently intercepts all LLM requests, automatically extracts metrics such as token usage, latency, and cost, then forwards the requests unchanged to the actual LLM provider. The entire process is completely transparent to OpenClaw.

## Prerequisites

### System Requirements

| Item | Requirement | Description |
|------|-------------|-------------|
| Node.js | >= 18 | JavaScript runtime |
| AgentGazer | Latest version | `npm install -g agentgazer` or use `npx agentgazer` |
| OpenClaw | Installed and running | Obtain from [openclaw.ai](https://openclaw.ai) |

### API Keys

You need an API key from at least one of the following LLM providers:

- **Anthropic API Key**: Obtain from [console.anthropic.com](https://console.anthropic.com)
- **OpenAI API Key**: Obtain from [platform.openai.com](https://platform.openai.com)

### Confirm OpenClaw Is Running

Before starting the integration, verify that OpenClaw is properly installed and operational:

```bash
# Confirm the OpenClaw configuration file exists
ls ~/.openclaw/openclaw.json

# Confirm the OpenClaw service is running
openclaw status
```

## Starting AgentGazer

### Quick Start

```bash
npx agentgazer
```

Once started, the terminal will display the following information:

```
AgentGazer server running on http://localhost:8080
AgentGazer proxy running on http://localhost:4000
Auth token: at_xxxxxxxxxxxxxxxx
```

Make note of the displayed **Auth Token** — you will need it later when configuring alerts.

### Default Ports

| Service | Port | Purpose |
|---------|------|---------|
| AgentGazer Server | `:8080` | REST API and Dashboard (React) |
| AgentGazer Proxy | `:4000` | Transparent LLM request proxy |

### Opening the Dashboard

Navigate to [http://localhost:8080](http://localhost:8080) in your browser to access the AgentGazer real-time monitoring dashboard.

## Architecture Diagram

The following diagram illustrates the complete data flow of OpenClaw connecting to LLM providers through the AgentGazer Proxy:

```
┌─────────────────────────────────────────────────────────────┐
│                       User's Machine                        │
│                                                             │
│  ┌───────────────┐     ┌──────────────────┐                 │
│  │   OpenClaw     │────▶│  AgentGazer      │                 │
│  │   Gateway      │     │  Proxy :4000     │                 │
│  │               │     │                  │                 │
│  │  openclaw.json:│     │  Auto-captures:  │                 │
│  │  baseUrl →     │     │  - tokens        │                 │
│  │  localhost:4000│     │  - cost          │                 │
│  └───────────────┘     │  - latency       │                 │
│                        └────────┬─────────┘                 │
│                                 │                           │
│                     ┌───────────▼───────────┐               │
│                     │  LLM Provider APIs     │               │
│                     │  api.anthropic.com     │               │
│                     │  api.openai.com        │               │
│                     └───────────────────────┘               │
│                                                             │
│  ┌──────────────────────────────────────────┐               │
│  │  AgentGazer Server :8080                  │               │
│  │  ├── REST API  (/api/*)                   │               │
│  │  ├── SQLite (data.db)                     │               │
│  │  └── Dashboard (React)                    │               │
│  └──────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. OpenClaw sends LLM requests to `http://localhost:4000` (AgentGazer Proxy)
2. The proxy transparently forwards requests to the actual LLM provider (e.g., `api.anthropic.com`)
3. Upon receiving the provider's response, the proxy first returns the complete response to OpenClaw
4. The proxy asynchronously parses the response, extracting metrics such as token usage, model name, latency, and cost
5. Metrics are stored in the local SQLite database (`data.db`)
6. The dashboard reads data from the server and presents it through charts and visualizations

**Privacy guarantee**: The proxy only extracts metrics (token counts, model names, latency, etc.) and **does not log or transmit prompt content**. All data remains on your local machine.

## Configuring Provider Keys

The AgentGazer Proxy can automatically inject API keys on your behalf. To enable key injection, you must use **path prefix routing** — include the provider name in the `baseUrl` (e.g., `http://localhost:4000/anthropic`). This allows the proxy to securely identify the provider and inject the correct credentials.

### Storing API Keys in AgentGazer

```bash
# Store your Anthropic API key
agentgazer providers set anthropic $ANTHROPIC_API_KEY

# Store your OpenAI API key
agentgazer providers set openai $OPENAI_API_KEY
```

### How Auto-Injection Works

| baseUrl | Provider | Injected Header |
|---------|----------|-----------------|
| `http://localhost:4000/anthropic` | Anthropic | `x-api-key: <key>` |
| `http://localhost:4000/openai` | OpenAI | `Authorization: Bearer <key>` |

When you use path prefix routing (e.g., `/anthropic/...`), the proxy strips the prefix, forwards the request to the real provider URL, and injects the stored API key automatically.

This means you can **omit the `apiKey` field** in your OpenClaw configuration and let the proxy manage all provider keys centrally.

> **Important**: Key injection only works with path prefix routing. If your `baseUrl` is `http://localhost:4000` (no prefix), the proxy can still collect metrics but will **not** inject API keys — in that case, you must include `apiKey` in `openclaw.json` so OpenClaw can authenticate directly.

> **Note**: If you choose to specify `apiKey` directly in `openclaw.json`, that key will be attached to the request by OpenClaw, and the proxy will forward it as-is without overriding it.

## Anthropic Configuration

Edit `~/.openclaw/openclaw.json` and point the Anthropic provider's `baseUrl` to the AgentGazer Proxy:

```json5
{
  "models": {
    "mode": "merge",
    "providers": {
      "anthropic-traced": {
        "baseUrl": "http://localhost:4000/anthropic",
        "apiKey": "${ANTHROPIC_API_KEY}",
        "api": "anthropic-messages"
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic-traced/claude-opus-4-5"
      }
    }
  }
}
```

### Field Descriptions

| Field | Description |
|-------|-------------|
| `baseUrl` | Points to the AgentGazer Proxy with the provider path prefix (`http://localhost:4000/anthropic`). The proxy strips the `/anthropic` prefix and forwards to `api.anthropic.com` |
| `apiKey` | Anthropic API key. Can be omitted if already stored via `agentgazer providers set` (requires path prefix in `baseUrl`) |
| `api` | Specifies the API protocol as `anthropic-messages`, enabling the proxy to correctly detect the provider |
| `primary` | The model to use, in the format `<provider-name>/<model-name>` |

### Important: apiKey Cannot Be Empty

OpenClaw validates that `apiKey` is not empty before sending requests. Even when using AgentGazer's key injection feature, you must provide a placeholder value:

```json5
{
  "models": {
    "mode": "merge",
    "providers": {
      "anthropic-traced": {
        "baseUrl": "http://localhost:4000/anthropic",
        "apiKey": "placeholder",  // Required! Cannot be empty
        "api": "anthropic-messages",
        "models": [
          {
            "id": "claude-sonnet-4-20250514",
            "name": "Claude Sonnet 4",
            "reasoning": false,
            "input": ["text"],
            "contextWindow": 200000,
            "maxTokens": 8192
          },
          {
            "id": "claude-opus-4-20250514",
            "name": "Claude Opus 4",
            "reasoning": false,
            "input": ["text"],
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic-traced/claude-sonnet-4-20250514"
      }
    }
  }
}
```

::: warning
- **`apiKey`**: Use `"placeholder"` — AgentGazer proxy will replace it with your real key
- **`models`**: Required array defining available models for this provider
- **`baseUrl`**: Must NOT include `/v1` — OpenClaw adds the API path automatically
:::

### Configure auth-profiles.json

OpenClaw also requires auth configuration in the agent directory:

```bash
# Create auth profile for the main agent
mkdir -p ~/.openclaw/agents/main/agent
cat > ~/.openclaw/agents/main/agent/auth-profiles.json << 'EOF'
{
  "anthropic": {
    "provider": "anthropic",
    "mode": "api_key",
    "apiKey": "placeholder"
  }
}
EOF
```

Or use the OpenClaw CLI:

```bash
openclaw models auth api-key --provider anthropic
# Enter "placeholder" when prompted
```

### Supported Anthropic Models

AgentGazer includes built-in pricing data for the following Anthropic models to automatically calculate costs:

| Model | Input Cost (per million tokens) | Output Cost (per million tokens) |
|-------|--------------------------------|----------------------------------|
| `claude-opus-4-20250514` | $15.00 | $75.00 |
| `claude-sonnet-4-20250514` | $3.00 | $15.00 |
| `claude-3-5-haiku-20241022` | $0.80 | $4.00 |

## OpenAI Configuration

Edit `~/.openclaw/openclaw.json` and point the OpenAI provider's `baseUrl` to the AgentGazer Proxy:

```json5
{
  "models": {
    "mode": "merge",
    "providers": {
      "openai-traced": {
        "baseUrl": "http://localhost:4000/openai",
        "apiKey": "${OPENAI_API_KEY}",
        "api": "openai-completions"
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "openai-traced/gpt-4o"
      }
    }
  }
}
```

### Field Descriptions

| Field | Description |
|-------|-------------|
| `baseUrl` | Points to the AgentGazer Proxy with the provider path prefix (`http://localhost:4000/openai`). The proxy strips the `/openai` prefix and forwards to `api.openai.com` |
| `apiKey` | OpenAI API key. Can be omitted if already stored via `agentgazer providers set` (requires path prefix in `baseUrl`) |
| `api` | Specifies the API protocol as `openai-completions`, enabling the proxy to correctly detect the provider |
| `primary` | The model to use, in the format `<provider-name>/<model-name>` |

### Supported OpenAI Models

AgentGazer includes built-in pricing data for the following OpenAI models:

| Model | Input Cost (per million tokens) | Output Cost (per million tokens) |
|-------|--------------------------------|----------------------------------|
| `gpt-4o` | $2.50 | $10.00 |
| `gpt-4o-mini` | $0.15 | $0.60 |
| `gpt-4-turbo` | $10.00 | $30.00 |
| `gpt-4` | $30.00 | $60.00 |
| `gpt-3.5-turbo` | $0.50 | $1.50 |
| `o1` | $15.00 | $60.00 |
| `o1-mini` | $3.00 | $12.00 |
| `o3-mini` | $1.10 | $4.40 |

## Multi-Provider Configuration

OpenClaw supports using multiple LLM providers simultaneously. The following configuration enables both Anthropic and OpenAI with all requests routed through the AgentGazer Proxy:

```json5
{
  "models": {
    "mode": "merge",
    "providers": {
      "anthropic-traced": {
        "baseUrl": "http://localhost:4000/anthropic",
        "apiKey": "${ANTHROPIC_API_KEY}",
        "api": "anthropic-messages"
      },
      "openai-traced": {
        "baseUrl": "http://localhost:4000/openai",
        "apiKey": "${OPENAI_API_KEY}",
        "api": "openai-completions"
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic-traced/claude-opus-4-5",
        "secondary": "openai-traced/gpt-4o"
      }
    }
  }
}
```

### Configuration Details

- **`primary`**: The default model OpenClaw uses (Anthropic Claude Opus 4.5 in this example)
- **`secondary`**: The fallback model used when the primary model is unavailable or encounters errors (OpenAI GPT-4o in this example)
- Each provider's `baseUrl` includes its own path prefix (`/anthropic`, `/openai`) so the proxy can identify the provider and inject the correct API key
- The proxy strips the path prefix, then forwards the request to the real provider URL

### Multi-Provider Monitoring Benefits

When using multiple providers simultaneously, the AgentGazer Dashboard can:

- Display cost comparisons categorized by provider
- Track error rate differences across providers
- Compare latency performance between providers
- Provide complete call records during provider failovers

## Agent Governance (Optional)

AgentGazer supports agent-level governance policies that allow you to control and limit LLM usage on a per-agent basis. When using governance features, you'll need to use agent path routing to identify which agent is making the request.

### Agent Path Routing

Instead of the simple provider path (`/anthropic`), you can use an agent-specific path that includes an agent ID:

```
http://localhost:4000/agents/{agent-id}/{provider}
```

For example:
- `http://localhost:4000/agents/openclaw/anthropic` — routes to Anthropic, identified as agent "openclaw"
- `http://localhost:4000/agents/discord-bot/openai` — routes to OpenAI, identified as agent "discord-bot"

### OpenClaw Configuration with Agent Path

```json5
{
  "models": {
    "mode": "merge",
    "providers": {
      "anthropic-traced": {
        "baseUrl": "http://localhost:4000/agents/openclaw/anthropic",
        "apiKey": "placeholder",
        "api": "anthropic-messages",
        "models": [
          {
            "id": "claude-sonnet-4-20250514",
            "name": "Claude Sonnet 4",
            "reasoning": false,
            "input": ["text"],
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  }
}
```

### Governance Features

Once you have requests routing through agent paths, you can configure policies in the AgentGazer Dashboard:

| Feature | Description |
|---------|-------------|
| **Active Toggle** | Disable an agent to block all requests (returns a policy block message instead of calling the LLM) |
| **Daily Budget Limit** | Set a maximum daily spend; requests are blocked once the limit is reached |
| **Allowed Hours** | Restrict when the agent can make LLM calls (e.g., 9:00-17:00 only) |

### Agent Identification Priority

The proxy identifies agents in the following order:

1. **`x-agent-id` header** — Highest priority, useful for programmatic control
2. **Agent path** (`/agents/{id}/...`) — Middle priority, recommended for OpenClaw
3. **Default** — Falls back to "default" if neither is specified

### Example: Setting a Budget Limit

After configuring agent path routing, you can set a $10/day budget limit via the API:

```bash
curl -X PUT http://localhost:8080/api/agents/openclaw/policy \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "active": true,
    "budget_limit": 10.00
  }'
```

Or use the Dashboard: navigate to **Agents** > **openclaw** > **Policy Settings**.

## Verification

After completing the configuration, follow these steps to verify that the integration is working correctly.

### Step 1: Confirm AgentGazer Is Running

```bash
# Start AgentGazer (if not already running)
npx agentgazer

# Or if installed globally
agentgazer start
```

Verify that the terminal shows the proxy is listening on `:4000`.

### Step 2: Restart OpenClaw

After modifying `openclaw.json`, you need to restart the OpenClaw Gateway for the changes to take effect:

```bash
# Restart OpenClaw (depending on your startup method)
openclaw restart

# Or stop and start separately
openclaw stop
openclaw start
```

### Step 3: Send a Test Message

Send a test message through any channel supported by OpenClaw:

- Discord bot
- Telegram bot
- Other configured input channels

For example, send the following to the OpenClaw bot in Discord:

```
@OpenClaw Hello, this is a test message.
```

### Step 4: Check the AgentGazer Dashboard

1. Open [http://localhost:8080](http://localhost:8080) in your browser
2. Navigate to the **Agents** page — you should see a new agent entry appear
3. Click on the agent to view its details page

### Step 5: Confirm Event Data

On the agent details page, verify that the following information is displayed correctly:

| Metric | Expected Value | Description |
|--------|---------------|-------------|
| Provider | `anthropic` or `openai` | Depends on your configuration |
| Model | `claude-opus-4-5` or `gpt-4o` | Depends on your configuration |
| Tokens (Input) | > 0 | Number of input tokens |
| Tokens (Output) | > 0 | Number of output tokens |
| Cost (USD) | > $0.00 | Automatically calculated cost |
| Latency (ms) | > 0 | Request latency |

If all metrics are displayed correctly, congratulations — the integration is complete!

### Using the Proxy Health Check Endpoint

You can also check the proxy's operational status directly:

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{
  "status": "ok",
  "agent_id": "openclaw",
  "uptime_ms": 123456
}
```

## Setting Up Alerts

AgentGazer provides multiple alert rules to notify you immediately when OpenClaw encounters anomalies. The following are the most practical alert configurations for OpenClaw use cases.

### Agent Down Alert — Detecting When OpenClaw Stops Running

When OpenClaw has not sent any LLM requests for an extended period, it may indicate that the service has stopped running.

**Configuring via Dashboard:**

1. Open the AgentGazer Dashboard (`http://localhost:8080`)
2. Navigate to the **Alerts** page
3. Click **New Alert Rule**
4. Select the target agent: `openclaw`
5. Rule type: `agent_down`
6. Set `duration_minutes`: `10` (10 minutes of inactivity is considered offline)
7. Enter your Webhook URL
8. Click **Save Rule**

**Configuring via API:**

```bash
curl -X POST http://localhost:8080/api/alerts \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "openclaw",
    "rule_type": "agent_down",
    "config": { "duration_minutes": 10 },
    "webhook_url": "https://your-webhook-url.com/alerts"
  }'
```

### Error Rate Alert — Detecting API Call Failures

Triggers an alert when the LLM API error rate exceeds a threshold. Common causes include expired API keys, rate limits, and provider service outages.

```bash
curl -X POST http://localhost:8080/api/alerts \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "openclaw",
    "rule_type": "error_rate",
    "config": { "threshold": 15, "window_minutes": 10 },
    "webhook_url": "https://your-webhook-url.com/alerts"
  }'
```

**Parameter Details:**

| Parameter | Value | Description |
|-----------|-------|-------------|
| `threshold` | `15` | Triggers an alert when the error rate exceeds 15% |
| `window_minutes` | `10` | Calculates based on requests within the last 10 minutes |

### Budget Alert — Daily Spending Cap

Set a daily spending cap to prevent runaway costs from OpenClaw's autonomous LLM calls.

```bash
curl -X POST http://localhost:8080/api/alerts \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "openclaw",
    "rule_type": "budget",
    "config": { "threshold": 20 },
    "webhook_url": "https://your-webhook-url.com/alerts"
  }'
```

**Parameter Details:**

| Parameter | Value | Description |
|-----------|-------|-------------|
| `threshold` | `20` | Triggers an alert when cumulative daily spending exceeds $20 USD |

### Recommended Alert Rules

For typical OpenClaw usage scenarios, the following alert configuration combinations are recommended:

| Alert Type | Recommended Setting | Use Case |
|------------|-------------------|----------|
| Agent Down | `duration_minutes: 10` | OpenClaw should run continuously; 10 minutes of inactivity is abnormal |
| Error Rate | `threshold: 15, window_minutes: 10` | An API error rate above 15% warrants attention |
| Budget | `threshold: 20` | $20 USD per day is typically sufficient for personal use |

> **Tip**: You can adjust these values based on your actual usage. If OpenClaw has higher usage (e.g., serving multiple chat channels simultaneously), consider increasing the budget threshold accordingly.

## Troubleshooting

### Quick Reference Table

| Problem | Possible Cause | Solution |
|---------|---------------|----------|
| "No API key found for provider" | `apiKey` is empty in config | Use `"apiKey": "placeholder"` — cannot be empty string |
| "No API key found for provider" | Missing `auth-profiles.json` | Create `~/.openclaw/agents/main/agent/auth-profiles.json` with placeholder key |
| 404 Not Found | `baseUrl` includes `/v1` | Remove `/v1` from baseUrl (e.g., use `/anthropic` not `/anthropic/v1`) |
| 401 Unauthorized | AgentGazer doesn't have the real key | Run `agentgazer providers set-key` to store your real API key |
| OpenClaw calls do not appear in Dashboard | Incorrect `baseUrl` in `openclaw.json` | Confirm `baseUrl` points to the Proxy's `:4000` with a provider path prefix (e.g., `http://localhost:4000/anthropic`), not the Server's `:8080`, and verify that AgentGazer is running |
| Provider not detected | Incorrect `api` protocol field | Use `"api": "anthropic-messages"` for Anthropic and `"api": "openai-completions"` for OpenAI |
| Provider not detected | Missing `models` array | Add `models` array with at least one model definition |
| Connection refused | AgentGazer not started or incorrect port | Run `agentgazer doctor` to check service status and verify consistent port configuration |
| Events appear but cost data is missing | Model name not in the pricing table | Verify the model name matches an entry in `packages/shared/src/pricing.ts` |
| OpenClaw fails to start after configuration changes | Syntax error in `openclaw.json` | Validate JSON syntax and check for trailing commas |

### Detailed Troubleshooting Steps

#### OpenClaw Calls Do Not Appear in Dashboard

1. **Confirm AgentGazer is running**:

   ```bash
   # Check if the proxy is listening
   curl http://localhost:4000/health
   ```

   If a connection error is returned, restart AgentGazer:

   ```bash
   npx agentgazer
   ```

2. **Confirm the `baseUrl` is set correctly**:

   ```bash
   # Check the baseUrl in openclaw.json
   cat ~/.openclaw/openclaw.json | grep baseUrl
   ```

   The output should contain `http://localhost:4000`, not `http://localhost:8080` or any other address.

3. **Confirm OpenClaw has been restarted**: Configuration changes require restarting OpenClaw to take effect.

#### LLM Provider Returns Authentication Error

1. **Confirm keys are stored correctly**:

   ```bash
   # List stored provider keys
   agentgazer providers list
   ```

2. **Test proxy forwarding**:

   ```bash
   # Send a test request directly through the proxy (OpenAI example)
   curl http://localhost:4000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $OPENAI_API_KEY" \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [{"role": "user", "content": "Hi"}],
       "max_tokens": 10
     }'
   ```

   If this request succeeds, the proxy forwarding is working correctly and the issue likely lies in the OpenClaw configuration.

#### Events Appear but Cost Data Is Missing

AgentGazer calculates costs automatically based on the built-in pricing table (`packages/shared/src/pricing.ts`). If the model name is not in the pricing table, the cost field will appear empty.

Currently supported model pricing includes:

- **OpenAI**: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-4`, `gpt-3.5-turbo`, `o1`, `o1-mini`, `o3-mini`
- **Anthropic**: `claude-opus-4-20250514`, `claude-sonnet-4-20250514`, `claude-3-5-haiku-20241022`

> **Note**: The model name in the OpenClaw configuration (e.g., `claude-opus-4-5`) may differ from the full model ID in the AgentGazer pricing table. The proxy attempts to extract the actual model ID from the API response for cost calculation.

#### OpenClaw Fails to Start After Configuration Changes

`openclaw.json` uses JSON format. Common syntax errors include:

- **Trailing commas**: The JSON standard does not allow a comma after the last element
- **Unclosed brackets**: Ensure all `{` and `}` are properly paired
- **Unexpanded environment variables**: If using `${ANTHROPIC_API_KEY}` syntax, confirm that OpenClaw supports environment variable substitution

You can validate JSON syntax with the following command:

```bash
# Validate JSON syntax using Node.js
node -e "JSON.parse(require('fs').readFileSync('$HOME/.openclaw/openclaw.json','utf8')); console.log('JSON syntax is valid')"
```

#### Port Conflicts

If the default ports are already in use by other services, you can specify different ports when starting AgentGazer:

```bash
npx agentgazer --port 9080 --proxy-port 5000
```

Then update the `baseUrl` in `openclaw.json` accordingly:

```json5
{
  "models": {
    "providers": {
      "anthropic-traced": {
        "baseUrl": "http://localhost:5000/anthropic",
        "api": "anthropic-messages"
      }
    }
  }
}
```

## Appendix: Quick Start Checklist

Complete the following steps in order for a quick integration:

- [ ] Install AgentGazer (`npm install -g agentgazer` or use `npx`)
- [ ] Start AgentGazer (`npx agentgazer`)
- [ ] Store provider keys (`agentgazer providers set anthropic <key>`)
- [ ] Edit `~/.openclaw/openclaw.json` and set `baseUrl` to `http://localhost:4000/<provider>` (e.g., `http://localhost:4000/anthropic`)
- [ ] Restart the OpenClaw Gateway
- [ ] Send a test message and confirm events appear in the Dashboard
- [ ] Set up an Agent Down alert (recommended: 10 minutes)
- [ ] Set up a Budget alert (recommended: $20 USD per day)
- [ ] Set up an Error Rate alert (recommended: 15% threshold)
- [ ] Monitor the Dashboard to confirm data is flowing in correctly
