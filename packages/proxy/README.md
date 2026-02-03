# @agenttrace/proxy

Drop-in LLM proxy that intercepts API calls, extracts token usage and latency, and forwards events to AgentTrace.

## Install

```bash
npm install @agenttrace/proxy
```

## CLI usage

```bash
agenttrace-proxy \
  --api-key <key> \
  --agent-id <id> \
  --listen-port 4020 \
  --endpoint http://localhost:3274/api/events
```

Point your LLM client at `http://localhost:4020` instead of the provider's API. The proxy forwards requests transparently and reports metrics to AgentTrace.

## Programmatic usage

```typescript
import { startProxy } from "@agenttrace/proxy";

const server = await startProxy({
  listenPort: 4020,
  apiKey: "your-key",
  agentId: "my-agent",
  endpoint: "http://localhost:3274/api/events",
});
```

## License

Apache-2.0 — see [LICENSE](./LICENSE).

Part of the [AgentTrace](https://github.com/agenttrace/agenttrace) monorepo.
