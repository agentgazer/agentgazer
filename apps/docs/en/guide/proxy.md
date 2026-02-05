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

The simplest approach is to set the `OPENAI_BASE_URL` environment variable:

```bash
export OPENAI_BASE_URL=http://localhost:4000/v1
```

Or specify it in your code:

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:4000/v1",  // Point to the Proxy
  // API Key is configured normally; the Proxy passes it through
});

// Use as usual — no other changes needed
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
```

The Proxy automatically detects this as an OpenAI request from the path `/v1/chat/completions`.

### Anthropic SDK Integration Example

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  baseURL: "http://localhost:4000/anthropic",
});

const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello!" }],
});
```

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
