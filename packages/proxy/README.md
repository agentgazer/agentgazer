# @agentgazer/proxy

Transparent HTTP proxy for LLM API calls. Forwards requests to upstream providers, extracts usage metrics from responses (including SSE streams), and buffers them for delivery to an AgentGazer server.

## Supported providers

- OpenAI (`api.openai.com`)
- Anthropic (`api.anthropic.com`)
- Google (`generativelanguage.googleapis.com`)
- Mistral (`api.mistral.ai`)
- Cohere (`api.cohere.com`)
- DeepSeek (`api.deepseek.com`)
- Moonshot (`api.moonshot.cn`)
- Zhipu / GLM (`open.bigmodel.cn`)
- MiniMax (`api.minimax.chat`)
- Baichuan (`api.baichuan-ai.com`)

## How it works

1. Your LLM client sends requests to the proxy instead of the provider directly
2. The proxy detects the provider from the Host header or request path
3. If configured, a provider API key is injected into the request headers
4. If configured, a per-provider rate limit is enforced (429 on excess)
5. The request is forwarded to the real upstream API
6. The response is streamed back to your client in real-time
7. Token counts, model, latency, and cost are extracted and buffered
8. Buffered events are flushed to the AgentGazer server periodically

Both standard JSON responses and SSE streaming responses are supported.

## Usage

### As part of the CLI (typical)

```bash
npx agentgazer start
# Proxy starts on port 4000
```

### Standalone CLI

```bash
agentgazer-proxy --api-key <token> --agent-id proxy \
  --provider-keys '{"openai":"sk-..."}' \
  --rate-limits '{"openai":{"maxRequests":100,"windowSeconds":60}}'
```

### Programmatic

```typescript
import { startProxy } from "@agentgazer/proxy";

const { server, shutdown } = startProxy({
  port: 4000,
  apiKey: "your-token",
  agentId: "proxy",
  endpoint: "http://localhost:18800/api/events",
  providerKeys: {
    openai: "sk-...",
    anthropic: "sk-ant-...",
  },
  rateLimits: {
    openai: { maxRequests: 100, windowSeconds: 60 },
  },
});

// Later
await shutdown();
```

### Provider detection

The proxy auto-detects the target provider from the `Host` header. Set your LLM client's base URL to `http://localhost:18900` and the proxy handles routing.

If auto-detection fails, set the `x-target-url` header to specify the upstream base URL explicitly.

### API key injection

When `providerKeys` is configured, the proxy injects the correct auth header per provider:

| Provider | Header |
|----------|--------|
| OpenAI, Mistral, Cohere, DeepSeek, Moonshot, Zhipu, MiniMax, Baichuan | `Authorization: Bearer <key>` |
| Anthropic | `x-api-key: <key>` |
| Google | `x-goog-api-key: <key>` |

If the client already provides the auth header, the proxy does not override it.

### Rate limiting

When `rateLimits` is configured, the proxy enforces a sliding-window rate limit per provider. Requests exceeding the limit receive a `429` response with a `Retry-After` header.

### Health check

```
GET http://localhost:18900/health
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `4000` | Proxy listen port |
| `apiKey` | `string` | **required** | Auth token for the AgentGazer server |
| `agentId` | `string` | **required** | Agent ID for recorded events |
| `endpoint` | `string` | — | Event ingestion URL |
| `flushInterval` | `number` | `5000` | Event buffer flush interval in ms |
| `maxBufferSize` | `number` | `50` | Max buffered events before auto-flush |
| `providerKeys` | `Record<string, string>` | — | Provider API keys to inject |
| `rateLimits` | `Record<string, RateLimitConfig>` | — | Per-provider rate limits |

## License

Apache-2.0
