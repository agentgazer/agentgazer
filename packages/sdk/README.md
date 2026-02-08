# @agentgazer/sdk

TypeScript SDK for recording AI agent activity to an AgentGazer server.

## Install

```bash
npm install @agentgazer/sdk
```

## Usage

```typescript
import { AgentGazer } from "@agentgazer/sdk";

const at = AgentGazer.init({
  apiKey: "your-token",
  agentId: "my-agent",
  endpoint: "http://localhost:18800/api/events",
});

// Track an LLM call
at.track({
  provider: "openai",
  model: "gpt-4o",
  tokens: { input: 150, output: 50 },
  latency_ms: 1200,
  status: 200,
});

// Report errors
at.error(new Error("Something went wrong"));

// Send a heartbeat (for agent-down alerts)
at.heartbeat();

// Send custom events
at.custom({ step: "planning", result: "success" });

// Flush buffer and shut down
await at.shutdown();
```

## Distributed tracing

```typescript
const trace = at.startTrace();
const parentSpan = trace.startSpan("orchestrator");
const childSpan = parentSpan.startSpan("tool-call");

at.track({
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  trace_id: trace.traceId,
  span_id: childSpan.spanId,
  parent_span_id: childSpan.parentSpanId,
  tokens: { input: 500, output: 200 },
  latency_ms: 3000,
  status: 200,
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | **required** | Auth token for the AgentGazer server |
| `agentId` | `string` | **required** | Unique identifier for this agent |
| `endpoint` | `string` | — | Event ingestion URL |
| `flushInterval` | `number` | `5000` | Buffer flush interval in ms |
| `maxBufferSize` | `number` | `50` | Max events before auto-flush |

## API

### `AgentGazer.init(options): AgentGazer`

Create a new client instance.

### `track(options: TrackOptions): void`

Record an LLM call event. All fields in `TrackOptions` are optional except that at least one should be meaningful.

### `startTrace(): Trace`

Start a new distributed trace. Returns a `Trace` object with a `traceId` and a `startSpan()` method for creating child spans.

### `heartbeat(): void`

Send a heartbeat event. Used by the server's alert evaluator to detect agent-down conditions.

### `error(err: Error | string): void`

Record an error event. If an `Error` object is passed, the stack trace is captured in tags.

### `custom(data: Record<string, unknown>): void`

Record a custom event with arbitrary data stored in tags.

### `flush(): Promise<void>`

Flush the event buffer to the server.

### `shutdown(): Promise<void>`

Stop the flush timer and send any remaining buffered events.

## License

Apache-2.0
