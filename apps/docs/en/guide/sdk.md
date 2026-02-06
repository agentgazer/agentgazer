# SDK

## Installation

```bash
npm install @agentgazer/sdk
```

## Initialization

```typescript
import { AgentGazer } from "@agentgazer/sdk";

const at = AgentGazer.init({
  apiKey: "your-token",           // Required: Token generated during onboard
  agentId: "my-agent",            // Required: Unique identifier for this Agent
  endpoint: "http://localhost:8080/api/events",  // Optional: Defaults to local server
});
```

> `apiKey` and `agentId` are required parameters. An error is thrown if either is missing or contains only whitespace. Both values are automatically trimmed.

## Tracking LLM Calls

```typescript
at.track({
  provider: "openai",           // LLM Provider name
  model: "gpt-4o",              // Model name
  tokens: {
    input: 500,                 // Input token count
    output: 200,                // Output token count
  },
  latency_ms: 1200,             // Latency in milliseconds
  status: 200,                  // HTTP status code
});
```

## Sending Heartbeats

Call `heartbeat()` periodically to indicate the Agent is still running:

```typescript
// Recommended: send every 30 seconds
const heartbeatTimer = setInterval(() => {
  at.heartbeat();
}, 30_000);
```

Agent status determination rules:

- **Healthy**: Last heartbeat was less than 2 minutes ago
- **Degraded**: Last heartbeat was 2 to 10 minutes ago
- **Down**: Last heartbeat was more than 10 minutes ago

## Reporting Errors

```typescript
try {
  await someOperation();
} catch (err) {
  at.error(err as Error);
  // The Error object's stack trace is automatically captured
}
```

## Custom Events

```typescript
at.custom({
  key: "value",
  task: "data-processing",
  items_processed: 42,
});
```

## Traces and Spans

The SDK supports structured Trace / Span tracking:

```typescript
const trace = at.startTrace();
const span = trace.startSpan("planning");
// ... execute planning logic ...
span.end();

const execSpan = trace.startSpan("execution");
// ... execute operations ...
execSpan.end();
```

## Shutdown (Graceful Shutdown)

```typescript
// Call before process exit to ensure all buffered events are sent
await at.shutdown();
```

## Event Buffering Mechanism

The SDK uses a batch sending strategy for efficiency:

- Events are first stored in an in-memory buffer
- Automatically flushed every **5 seconds**
- Immediately flushed when the buffer reaches **50 events** (whichever comes first)
- Hard cap of **5,000** events — an emergency flush is attempted before dropping the oldest event
- `maxBufferSize` values of 0 or below fall back to the default (50)
- Network errors are logged as warnings but **do not throw exceptions** (they will not affect your Agent's operation)

## Complete Example

```typescript
import { AgentGazer } from "@agentgazer/sdk";
import OpenAI from "openai";

const at = AgentGazer.init({
  apiKey: process.env.AGENTTRACE_TOKEN!,
  agentId: "my-chatbot",
  endpoint: "http://localhost:8080/api/events",
});

const openai = new OpenAI();

// Send heartbeats periodically
setInterval(() => at.heartbeat(), 30_000);

async function chat(userMessage: string): Promise<string> {
  const start = Date.now();
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: userMessage }],
    });

    at.track({
      provider: "openai",
      model: "gpt-4o",
      tokens: {
        input: response.usage?.prompt_tokens,
        output: response.usage?.completion_tokens,
      },
      latency_ms: Date.now() - start,
      status: 200,
    });

    return response.choices[0].message.content ?? "";
  } catch (err) {
    at.error(err as Error);
    throw err;
  }
}

// Before process exit
process.on("SIGTERM", async () => {
  await at.shutdown();
  process.exit(0);
});
```
