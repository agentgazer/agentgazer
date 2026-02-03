# @agenttrace/sdk

TypeScript SDK for AgentTrace — agent-level observability for AI agents.

## Install

```bash
npm install @agenttrace/sdk
```

## Quick Start

```typescript
import { AgentTrace } from "@agenttrace/sdk";

const watch = AgentTrace.init({
  apiKey: "aw_your_api_key",
  agentId: "my-agent",
});

// Track an LLM call
watch.track({
  provider: "openai",
  model: "gpt-4o",
  tokens: { input: 500, output: 200 },
  latency_ms: 1200,
  status: 200,
});

// Send a heartbeat (call periodically to show agent is alive)
watch.heartbeat();

// Report an error
watch.error(new Error("Failed to connect to database"));

// Send a custom event
watch.custom({ task: "data-processing", items: 42 });

// Graceful shutdown (flushes remaining events)
await watch.shutdown();
```

## API

### `AgentTrace.init(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | required | Your AgentTrace API key |
| `agentId` | `string` | required | Unique identifier for this agent |
| `endpoint` | `string` | AgentTrace cloud | Ingest API URL |
| `flushInterval` | `number` | `5000` | Milliseconds between automatic flushes |
| `maxBufferSize` | `number` | `50` | Flush when buffer reaches this size |

### `watch.track(options)`

Record an LLM API call.

### `watch.heartbeat()`

Signal that the agent is alive. Call this periodically (e.g., every 30 seconds).

### `watch.error(err)`

Report an error. Accepts `Error` or `string`.

### `watch.flush()`

Manually flush buffered events. Called automatically on interval and when buffer is full.

### `watch.shutdown()`

Stop the flush timer and send remaining events. Call before process exit.

## Behavior

- Events are buffered and sent in batches for efficiency
- Network failures are logged but never thrown — the SDK will not crash your agent
- The flush timer is `unref()`'d so it won't prevent Node.js from exiting
