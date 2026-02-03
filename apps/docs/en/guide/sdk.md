# SDK

The AgentTrace SDK lets you instrument your application code to track LLM calls, errors, and custom events. It buffers events locally and flushes them to the AgentTrace server.

## Install

```bash
npm install @agenttrace/sdk
```

## Quick Start

```typescript
import { AgentTrace } from "@agenttrace/sdk";

const at = AgentTrace.init({
  apiKey: "your-token",     // from ~/.agenttrace/config.json
  agentId: "my-agent",
});

// Track an LLM call
at.track({
  provider: "openai",
  model: "gpt-4o",
  tokens: { input: 150, output: 50 },
  latency_ms: 1200,
  status: 200,
});
```

## Initialization

```typescript
const at = AgentTrace.init({
  apiKey: string;            // Required — auth token
  agentId: string;           // Required — identifies this agent
  endpoint?: string;         // Default: http://localhost:8080/api/events
  flushInterval?: number;    // Default: 5000 (ms)
  maxBufferSize?: number;    // Default: 50 events
});
```

## Tracking Methods

### `track(options)`

Record an LLM call or completion event.

```typescript
at.track({
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  tokens: { input: 200, output: 100 },
  latency_ms: 800,
  status: 200,
  tags: { workflow: "summarize" },
});
```

| Field | Type | Description |
|-------|------|-------------|
| `provider` | `string` | Provider name (openai, anthropic, etc.) |
| `model` | `string` | Model identifier |
| `tokens` | `{ input?, output?, total? }` | Token counts |
| `latency_ms` | `number` | Request duration in milliseconds |
| `status` | `number` | HTTP status code |
| `tags` | `Record<string, unknown>` | Custom metadata |
| `error_message` | `string` | Error description if failed |
| `trace_id` | `string` | Trace ID for distributed tracing |
| `span_id` | `string` | Span ID |
| `parent_span_id` | `string` | Parent span ID |

### `heartbeat()`

Send a heartbeat signal. The server uses heartbeats to determine agent health status (healthy / degraded / down).

```typescript
// Send heartbeats periodically
setInterval(() => at.heartbeat(), 30_000);
```

### `error(err)`

Record an error event.

```typescript
try {
  await callLLM();
} catch (err) {
  at.error(err);
}
```

### `custom(data)`

Record a custom event with arbitrary data.

```typescript
at.custom({ action: "tool_call", tool: "web_search", query: "..." });
```

## Tracing

The SDK supports distributed tracing with traces and spans:

```typescript
const trace = at.startTrace();

const span = trace.startSpan("summarize");
// ... do work ...

const childSpan = span.startSpan("call-llm");
at.track({
  trace_id: childSpan.traceId,
  span_id: childSpan.spanId,
  parent_span_id: childSpan.parentSpanId,
  provider: "openai",
  model: "gpt-4o",
  tokens: { input: 100, output: 50 },
  latency_ms: 500,
  status: 200,
});
```

## Lifecycle

### `flush()`

Manually flush buffered events to the server.

```typescript
await at.flush();
```

### `shutdown()`

Flush remaining events and stop the SDK.

```typescript
await at.shutdown();
```

Call this before your process exits to ensure all events are delivered.

## Cost Calculation

AgentTrace automatically calculates costs for known models when `provider` and `model` are specified. Supported models include:

- **OpenAI**: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-4, gpt-3.5-turbo, o1, o1-mini, o3-mini
- **Anthropic**: claude-opus-4-20250514, claude-sonnet-4-20250514, claude-3-5-haiku-20241022
- **Google**: gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash
- **Mistral**: mistral-large-latest, mistral-small-latest, codestral-latest
- **Cohere**: command-r-plus, command-r
