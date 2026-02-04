# FAQ

## General

### What is AgentTrace?

AgentTrace is a local-first observability tool for AI agents. It tracks LLM API calls, token usage, costs, latency, and errors — all running on your machine with no cloud dependency.

### What LLM providers are supported?

OpenAI, Anthropic, Google (Gemini), Mistral, and Cohere. The proxy auto-detects the provider from the request.

### Is my data sent anywhere?

No. AgentTrace runs entirely on your machine. Data is stored in a local SQLite database at `~/.agenttrace/agenttrace.db`. Your prompts and API keys never leave your environment.

## Proxy

### Do I need to change my application code?

No. Just point your LLM client's base URL to the proxy:

```bash
export OPENAI_BASE_URL=http://localhost:4000/v1
```

The proxy is transparent — it forwards requests and responses without modification.

### Can I use the proxy without storing API keys in AgentTrace?

Yes. If your application already provides its own API key in the request headers, the proxy will use that key and not override it. Provider key injection is optional.

### What happens if the proxy goes down?

Your LLM calls will fail since they're routed through the proxy. To avoid this in production, point directly at the provider and use the SDK for tracking instead.

### Does the proxy modify my requests or responses?

No. The proxy forwards requests and responses verbatim. It only reads the response to extract usage metrics (token counts, model, status code).

## SDK

### When should I use the SDK vs. the proxy?

| | Proxy | SDK |
|--|-------|-----|
| Code changes | None | Requires instrumentation |
| Coverage | All LLM calls automatically | Only what you instrument |
| Custom events | No | Yes (heartbeat, error, custom) |
| Tracing | No | Yes (traces and spans) |

Use the proxy for zero-effort tracking. Use the SDK when you need heartbeats, custom events, or distributed tracing.

### Can I use both the proxy and SDK together?

Yes. The proxy tracks LLM call metrics automatically. The SDK can add heartbeats, custom events, and trace context on top of that.

## Security

### How are provider API keys stored?

Keys are stored using your OS keychain when available (macOS Keychain, Linux libsecret).
In SSH, headless, or Docker environments, keys are encrypted with AES-256-GCM using a
machine-derived key. They are never stored as plaintext.

### Can another process on my machine read my API keys?

If your OS keychain is available, keys are protected by the OS. In headless mode, the
encrypted file prevents casual reading, but a process running as the same user could
theoretically derive the same encryption key. For maximum protection, use a desktop
environment with OS keychain support.

## Data

### How long is data retained?

Default is 30 days. Configure with `--retention-days`:

```bash
agenttrace start --retention-days 7
```

### Can I export my data?

Yes. Use the export API:

```bash
# JSON export
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/events/export?agent_id=my-agent&format=json" > events.json

# CSV export
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/events/export?agent_id=my-agent&format=csv" > events.csv
```

### How does cost calculation work?

AgentTrace has built-in pricing data for common models. When the proxy or SDK records an event with `provider`, `model`, and token counts, the cost is calculated automatically. If a model isn't in the pricing table, cost will be `null`.

## Performance

### Will the proxy slow down my LLM calls?

The proxy adds negligible overhead. It streams responses in real-time and processes metrics asynchronously. LLM API latency (typically 500ms–5s) dominates any proxy overhead.

### Can SQLite handle the load?

Yes. LLM calls are typically low QPS (single digits to low hundreds per second). SQLite handles this easily. The database uses WAL mode for concurrent read/write access.
