# Provider Key Management

AgentTrace can manage your LLM provider API keys so your application doesn't need to know them. The proxy injects the correct auth header for each provider automatically.

## Configure During Onboard

```bash
agenttrace onboard
```

The onboard wizard prompts you for API keys for each supported provider. You can skip any provider by pressing Enter.

## Manage with CLI

```bash
# List configured providers
agenttrace providers list

# Set or update a provider key
agenttrace providers set openai sk-proj-...
agenttrace providers set anthropic sk-ant-...

# Remove a provider
agenttrace providers remove openai
```

## Supported Providers

| Provider | Auth Header Injected |
|----------|---------------------|
| `openai` | `Authorization: Bearer <key>` |
| `anthropic` | `x-api-key: <key>` |
| `google` | `x-goog-api-key: <key>` |
| `mistral` | `Authorization: Bearer <key>` |
| `cohere` | `Authorization: Bearer <key>` |

## How It Works

1. You configure API keys via `agenttrace providers set` or during `agenttrace onboard`
2. Keys are stored in `~/.agenttrace/config.json`
3. When `agenttrace start` runs, keys are passed to the proxy
4. For each request, the proxy detects the provider and injects the matching auth header
5. If the client already sends its own auth header, the proxy does **not** override it

This means your application can make requests without any API key:

```bash
# No Authorization header needed — the proxy injects it
curl http://localhost:4000/v1/chat/completions \
  -H "Host: api.openai.com" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}'
```

## Config File Format

Keys are stored in `~/.agenttrace/config.json`:

```json
{
  "token": "at_...",
  "providers": {
    "openai": {
      "apiKey": "sk-proj-...",
      "rateLimit": {
        "maxRequests": 100,
        "windowSeconds": 60
      }
    },
    "anthropic": {
      "apiKey": "sk-ant-..."
    }
  }
}
```

## Rate Limiting

Each provider can have an optional rate limit. When configured, the proxy enforces a sliding-window limit and returns `429 Too Many Requests` with a `Retry-After` header when the limit is exceeded.

Set rate limits during onboard (e.g., `100/60` for 100 requests per 60 seconds) or edit the config file directly.
