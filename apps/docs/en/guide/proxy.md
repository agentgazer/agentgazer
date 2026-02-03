# Proxy

The AgentTrace proxy is a transparent HTTP proxy that sits between your application and LLM providers. It forwards requests to the upstream API, streams responses back, and extracts usage metrics (tokens, cost, latency) without modifying the payload.

## How It Works

1. Your LLM client sends requests to `http://localhost:4000` instead of the provider
2. The proxy detects the provider from the `Host` header or request path
3. If configured, a provider API key is injected into the request headers
4. If configured, a per-provider rate limit is enforced
5. The request is forwarded to the real upstream API
6. The response is streamed back to your client in real-time
7. Token counts, model, latency, and cost are extracted and buffered
8. Buffered events are flushed to the AgentTrace server periodically

Both standard JSON responses and SSE streaming responses are supported.

## Supported Providers

| Provider | Host | Detection |
|----------|------|-----------|
| OpenAI | `api.openai.com` | Path `/v1/chat/completions` or Host |
| Anthropic | `api.anthropic.com` | Path `/v1/messages` or Host |
| Google | `generativelanguage.googleapis.com` | Host |
| Mistral | `api.mistral.ai` | Host |
| Cohere | `api.cohere.com` | Host |

## Provider Detection

The proxy auto-detects the target provider from the `Host` header. Set your LLM client's base URL to `http://localhost:4000` and the proxy handles routing.

If auto-detection fails, set the `x-target-url` header to specify the upstream base URL explicitly:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "x-target-url: https://api.openai.com" \
  -H "Authorization: Bearer sk-..." \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}'
```

## API Key Injection

When provider keys are configured (via `agenttrace onboard` or `agenttrace providers set`), the proxy injects the correct auth header automatically:

| Provider | Header |
|----------|--------|
| OpenAI, Mistral, Cohere | `Authorization: Bearer <key>` |
| Anthropic | `x-api-key: <key>` |
| Google | `x-goog-api-key: <key>` |

If the client already provides the auth header, the proxy does **not** override it.

## Rate Limiting

When rate limits are configured, the proxy enforces a sliding-window rate limit per provider. Requests exceeding the limit receive a `429` response with a `Retry-After` header.

Configure rate limits during onboard or in `~/.agenttrace/config.json`:

```json
{
  "providers": {
    "openai": {
      "apiKey": "sk-...",
      "rateLimit": { "maxRequests": 100, "windowSeconds": 60 }
    }
  }
}
```

## Health Check

```
GET http://localhost:4000/health
```

Returns:

```json
{ "status": "ok", "agent_id": "proxy", "uptime_ms": 12345 }
```

## Standalone Usage

The proxy can run independently of the CLI:

```bash
agenttrace-proxy --api-key <token> --agent-id proxy \
  --provider-keys '{"openai":"sk-..."}' \
  --rate-limits '{"openai":{"maxRequests":100,"windowSeconds":60}}'
```

Or programmatically:

```typescript
import { startProxy } from "@agenttrace/proxy";

const { server, shutdown } = startProxy({
  port: 4000,
  apiKey: "your-token",
  agentId: "proxy",
  endpoint: "http://localhost:8080/api/events",
  providerKeys: { openai: "sk-..." },
  rateLimits: { openai: { maxRequests: 100, windowSeconds: 60 } },
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `4000` | Proxy listen port |
| `apiKey` | `string` | required | Auth token for the AgentTrace server |
| `agentId` | `string` | required | Agent ID for recorded events |
| `endpoint` | `string` | — | Event ingestion URL |
| `flushInterval` | `number` | `5000` | Buffer flush interval in ms |
| `maxBufferSize` | `number` | `50` | Max buffered events before auto-flush |
| `providerKeys` | `Record<string, string>` | — | Provider API keys to inject |
| `rateLimits` | `Record<string, RateLimitConfig>` | — | Per-provider rate limits |
