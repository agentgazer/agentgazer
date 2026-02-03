# @agenttrace/shared

Shared types, schemas, and utilities used by all AgentTrace packages.

## Contents

### Types and schemas

- `AgentEvent` / `AgentEventSchema` — Zod-validated event schema with fields for provider, model, tokens, cost, latency, trace IDs, and tags
- `BatchEvents` / `BatchEventsSchema` — Wrapper for event arrays
- `EventType` — `llm_call`, `completion`, `heartbeat`, `error`, `custom`
- `Source` — `sdk`, `proxy`

### Provider detection

- `detectProvider(url)` — Detects the LLM provider from a URL (returns `openai`, `anthropic`, `google`, `mistral`, `cohere`, or `unknown`)
- `getProviderBaseUrl(provider)` — Returns the base API URL for a provider

### Response parsing

- `parseProviderResponse(provider, body, statusCode)` — Extracts model, token counts, and errors from provider-specific JSON response formats

### Pricing

- `calculateCost(model, tokensIn, tokensOut)` — Calculates USD cost for a known model
- `getModelPricing(model)` — Returns per-million-token pricing
- `listSupportedModels()` — Lists all models with known pricing

### Logging

- `createLogger(component)` — Creates a structured logger with `debug`, `info`, `warn`, `error` methods. Outputs JSON in production, pretty-printed text in development.

## License

Apache-2.0
