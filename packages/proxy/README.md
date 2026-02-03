# @agenttrace/proxy

Transparent HTTP proxy for LLM API calls. Forwards requests to upstream providers, extracts usage metrics from responses (including SSE streams), and buffers them for delivery to an AgentTrace server.

## Supported providers

- OpenAI (`api.openai.com`)
- Anthropic (`api.anthropic.com`)
- Google (`generativelanguage.googleapis.com`)
- Mistral (`api.mistral.ai`)
- Cohere (`api.cohere.com`)

## How it works

1. Your LLM client sends requests to the proxy instead of the provider directly
2. The proxy detects the provider from the Host header or request path
3. The request is forwarded to the real upstream API
4. The response is streamed back to your client in real-time
5. Token counts, model, latency, and cost are extracted and buffered
6. Buffered events are flushed to the AgentTrace server periodically

Both standard JSON responses and SSE streaming responses are supported.

## Usage

### As part of the CLI (typical)

```bash
npx agenttrace
# Proxy starts on port 4000
```

### Programmatic

```typescript
import { startProxy } from "@agenttrace/proxy";

const { server, shutdown } = startProxy({
  port: 4000,
  apiKey: "your-token",
  agentId: "proxy",
  endpoint: "http://localhost:8080/api/events",
});

// Later
await shutdown();
```

### Provider detection

The proxy auto-detects the target provider from the `Host` header. Set your LLM client's base URL to `http://localhost:4000` and the proxy handles routing.

If auto-detection fails, set the `x-target-url` header to specify the upstream base URL explicitly.

### Health check

```
GET http://localhost:4000/health
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `4000` | Proxy listen port |
| `apiKey` | `string` | **required** | Auth token for the AgentTrace server |
| `agentId` | `string` | **required** | Agent ID for recorded events |
| `endpoint` | `string` | — | Event ingestion URL |
| `flushInterval` | `number` | `5000` | Event buffer flush interval in ms |
| `maxBufferSize` | `number` | `50` | Max buffered events before auto-flush |

## License

Apache-2.0
