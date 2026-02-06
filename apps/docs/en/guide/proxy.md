# Proxy

The Proxy is a local HTTP proxy that transparently intercepts your AI Agent's requests to LLM Providers, automatically extracting metrics such as token usage, latency, and cost — **without modifying any existing code**.

## Path Prefix Routing (Recommended)

The Proxy supports path prefix routing, which automatically forwards requests to the corresponding Provider:

| Path Prefix | Target |
|-------------|--------|
| `/openai/...` | `https://api.openai.com` |
| `/anthropic/...` | `https://api.anthropic.com` |
| `/google/...` | `https://generativelanguage.googleapis.com` |
| `/cohere/...` | `https://api.cohere.ai` |
| `/mistral/...` | `https://api.mistral.ai` |
| `/deepseek/...` | `https://api.deepseek.com` |

### OpenAI SDK Integration Example

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

### Anthropic SDK Integration Example

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

## Per-Agent Tracking with x-agent-id

When multiple agents share the same Proxy, use the `x-agent-id` header to attribute usage to each agent:

```typescript
const openai = new OpenAI({
  baseURL: "http://localhost:4000/openai/v1",
  apiKey: "dummy",
  defaultHeaders: {
    "x-agent-id": "my-agent-name",
  },
});
```

Without this header, all requests use the Proxy's default agent ID (set via `--agent-id` at startup).

## Using the x-target-url Header

If path prefix routing does not meet your needs, you can use the `x-target-url` header to explicitly specify the target:

```bash
curl http://localhost:4000/v1/chat/completions \
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

## Streaming Support

The Proxy supports both streaming (SSE, Server-Sent Events) and non-streaming responses. In streaming mode, the Proxy asynchronously parses and extracts metrics after the stream ends.

## Health Check

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

## Privacy Guarantee

The Proxy only extracts the following metric data:

- Token counts (input / output / total)
- Model name
- Latency (milliseconds)
- Cost (USD)
- HTTP status code

**Prompt content and API keys are never sent to the AgentTrace server.**
