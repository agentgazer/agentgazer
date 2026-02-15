# Proxy

The Proxy is a local HTTP proxy that transparently intercepts your AI Agent's requests to LLM Providers, automatically extracting metrics such as token usage, latency, and cost — **without modifying any existing code**.

## Simplified Routing (Recommended)

The simplest way to use the Proxy is with **simplified routing**. You only need to specify the agent name and provider — the Proxy handles all endpoint path construction internally:

```
POST http://localhost:18900/agents/{agent-name}/{provider}
```

### Supported Providers

| Provider | Endpoint |
|----------|----------|
| `openai` | OpenAI Chat Completions |
| `anthropic` | Anthropic Messages |
| `google` | Google Gemini (OpenAI-compatible) |
| `mistral` | Mistral Chat |
| `deepseek` | DeepSeek Chat |
| `moonshot` | Moonshot / Kimi Chat |
| `zhipu` | Zhipu GLM Chat |
| `minimax` | MiniMax Chat |
| `baichuan` | Baichuan Chat |

### Example: OpenAI via Simplified Routing

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:18900/agents/my-bot/openai",
  apiKey: "dummy",  // Will be replaced by stored key
});

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
```

### Example: Anthropic via Simplified Routing

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  baseURL: "http://localhost:18900/agents/my-bot/anthropic",
  apiKey: "dummy",  // Will be replaced by stored key
});

const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello!" }],
});
```

### Benefits

- **No path knowledge required** — You don't need to know `/v1/chat/completions`, `/v1/messages`, or provider-specific paths
- **Automatic key injection** — The Proxy injects the stored API key for the provider
- **Built-in agent tracking** — The agent name is embedded in the URL

## Path Prefix Routing

The Proxy supports path prefix routing, which automatically forwards requests to the corresponding Provider:

| Path Prefix | Target |
|-------------|--------|
| `/openai/...` | `https://api.openai.com` |
| `/anthropic/...` | `https://api.anthropic.com` |
| `/google/...` | `https://generativelanguage.googleapis.com` |
| `/mistral/...` | `https://api.mistral.ai` |
| `/deepseek/...` | `https://api.deepseek.com` |
| `/moonshot/...` | `https://api.moonshot.cn` |
| `/zhipu/...` | `https://open.bigmodel.cn` |
| `/minimax/...` | `https://api.minimax.chat` |
| `/baichuan/...` | `https://api.baichuan-ai.com` |

### OpenAI SDK Integration Example

**Option A: Use stored API Key (Recommended)**

If you've stored your API Key with `agentgazer providers set openai <key>`, use the path prefix for automatic injection:

```bash
export OPENAI_BASE_URL=http://localhost:18900/agents/my-agent/agentgazer
```

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:18900/agents/my-agent/agentgazer",
  apiKey: "dummy",  // Any value — will be overwritten by Proxy
});
```

**Option B: Provide your own API Key**

If you want to use your own API Key (not the stored one):

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:18900/v1",
  apiKey: process.env.OPENAI_API_KEY,  // Must provide your own
});
```

The Proxy detects this as an OpenAI request from the path `/v1/chat/completions` and passes your key through.

### Anthropic SDK Integration Example

Use the `/anthropic` path prefix — the Proxy will automatically inject the stored API Key:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  baseURL: "http://localhost:18900/anthropic",
  apiKey: "dummy",  // Any value — will be overwritten by Proxy
});

const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello!" }],
});
```

> To use your own API Key instead, set `apiKey` and avoid the path prefix (but automatic injection won't work).

## Agent Identification

The Proxy supports multiple ways to identify which agent is making a request.

### Path-based Agent ID

Include the agent ID in the URL path using `/agents/{agent-id}/`:

```
http://localhost:18900/agents/my-bot/openai/v1/chat/completions
                      └─────────┘└────────────────────────────┘
                       Agent ID      Provider path
```

Example with OpenAI SDK:

```typescript
const openai = new OpenAI({
  baseURL: "http://localhost:18900/agents/coding-assistant/openai/v1",
  apiKey: "dummy",
});
```

This is useful when:
- Your SDK doesn't support custom headers
- You want the agent ID visible in the URL
- You're using curl or simple HTTP clients

### x-agent-id Header (Alternative)

You can also use the `x-agent-id` header with explicit provider routing:

```typescript
const openai = new OpenAI({
  baseURL: "http://localhost:18900/agents/default/openai",
  apiKey: "dummy",
  defaultHeaders: {
    "x-agent-id": "my-agent-name",  // Overrides "default" in URL
  },
});
```

### Agent ID Priority

When multiple identification methods are present, the Proxy uses this priority:

| Priority | Method | Example |
|----------|--------|---------|
| 1 (highest) | `x-agent-id` header | `x-agent-id: my-agent` |
| 2 | Path prefix | `/agents/my-agent/openai/...` |
| 3 (lowest) | Default | Configured at startup or "default" |

### Auto-Create Agents

When the Proxy receives a request for an agent that doesn't exist, it automatically creates the agent with default policy settings.

## Using the x-target-url Header

If path prefix routing does not meet your needs, you can use the `x-target-url` header to explicitly specify the target:

```bash
curl http://localhost:18900/v1/chat/completions \
  -H "x-target-url: https://api.openai.com" \
  -H "Authorization: Bearer sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hi"}]}'
```

## Provider Detection Priority

The Proxy detects the target Provider in the following order:

1. **Path prefix** — e.g., `/openai/...`, `/anthropic/...`
2. **Host header** — e.g., `Host: api.openai.com`
3. **Path pattern** — e.g., `/v1/chat/completions` maps to OpenAI
4. **x-target-url header** — manually specified target URL

## Policy Enforcement

The Proxy enforces agent policies before forwarding requests. When a policy blocks a request, the Proxy returns a fake LLM response instead of forwarding to the provider.

### Policy Checks

| Policy | Behavior |
|--------|----------|
| **Active** | If `active=false`, all requests are blocked |
| **Budget Limit** | If daily spend >= `budget_limit`, requests are blocked |
| **Allowed Hours** | If current time is outside `allowed_hours_start` to `allowed_hours_end`, requests are blocked |

### Blocked Response Format

When blocked, the Proxy returns a valid response in the provider's format:

**OpenAI format:**

```json
{
  "id": "blocked-...",
  "object": "chat.completion",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "[AgentGazer] Request blocked: budget_exceeded"
    },
    "finish_reason": "stop"
  }]
}
```

**Anthropic format:**

```json
{
  "id": "blocked-...",
  "type": "message",
  "content": [{
    "type": "text",
    "text": "[AgentGazer] Request blocked: agent_deactivated"
  }],
  "stop_reason": "end_turn"
}
```

### Block Reasons

| Reason | Description |
|--------|-------------|
| `agent_deactivated` | Agent's `active` setting is `false` |
| `budget_exceeded` | Daily spend has reached `budget_limit` |
| `outside_allowed_hours` | Current time is outside allowed window |

Blocked requests are recorded as events with `event_type: "blocked"` and the block reason in tags.

## Rate Limiting

The Proxy enforces per-agent per-provider rate limits configured in the Dashboard. When a limit is exceeded, the Proxy returns a `429 Too Many Requests` response.

### How It Works

Rate limits use a **sliding window** algorithm:

1. Each request timestamp is recorded
2. When a new request arrives, timestamps older than the window are evicted
3. If the remaining count >= max requests, the request is rejected
4. The response includes `retry_after_seconds` calculated from when the oldest request in the window will expire

### Response Format

When rate limited, the Proxy returns a provider-specific error format:

**OpenAI format (and most other providers):**

```json
{
  "error": {
    "message": "Rate limit exceeded for agent \"my-bot\" on openai. Please retry after 45 seconds.",
    "type": "rate_limit_error",
    "param": null,
    "code": "rate_limit_exceeded"
  },
  "retry_after_seconds": 45
}
```

**Anthropic format:**

```json
{
  "type": "error",
  "error": {
    "type": "rate_limit_error",
    "message": "Rate limit exceeded for agent \"my-bot\" on anthropic. Please retry after 45 seconds."
  },
  "retry_after_seconds": 45
}
```

The `Retry-After` HTTP header is also set.

### Configuration

Rate limits are configured in the Dashboard's Agent Detail → Rate Limit Settings section. See [Dashboard Rate Limit Settings](/en/guide/dashboard#rate-limit-settings) for details.

### Block Reason

Rate-limited requests are recorded with block reason `rate_limited` in the event tags.

## Model Override

The Proxy can rewrite the model in requests based on rules configured in the Dashboard.

### How It Works

1. Request arrives with `model: "gpt-4o"`
2. Proxy checks for override rule for this agent + provider
3. If rule exists (e.g., override to "gpt-4o-mini"), Proxy rewrites the request body
4. Request is forwarded with `model: "gpt-4o-mini"`
5. Event is recorded with both `requested_model: "gpt-4o"` and `model: "gpt-4o-mini"`

### Use Cases

- **Cost control** — Force cheaper models without changing agent code
- **Testing** — Compare behavior across models
- **Rollback** — Quickly switch models if issues arise

Model overrides are configured in the Dashboard's Agent Detail → Model Settings section.

## Streaming Support

The Proxy supports both streaming (SSE, Server-Sent Events) and non-streaming responses. In streaming mode, the Proxy asynchronously parses and extracts metrics after the stream ends.

## Health Check

```bash
curl http://localhost:18900/health
```

Response:

```json
{
  "status": "ok",
  "agent_id": "my-agent",
  "uptime_ms": 123456
}
```

## Privacy Guarantee

The Proxy only extracts the following metric data:

- Token counts (input / output / total)
- Model name (requested and actual)
- Latency (milliseconds)
- Cost (USD)
- HTTP status code

**Prompt content and API keys are never sent to the AgentGazer server.**
