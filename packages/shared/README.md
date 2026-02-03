# @agenttrace/shared

Shared types, schemas, and utilities for AgentTrace packages.

## Install

```bash
npm install @agenttrace/shared
```

## What's inside

- **Types & Schemas** — `AgentEvent`, `BatchEvents` with Zod validation
- **Pricing** — Token cost calculation for common LLM models
- **Providers** — Provider detection and base URL mapping (OpenAI, Anthropic, etc.)
- **Parsers** — Response parsers for extracting token usage from provider responses

## Usage

```typescript
import {
  AgentEventSchema,
  calculateCost,
  detectProvider,
  parseProviderResponse,
} from "@agenttrace/shared";
```

## License

Apache-2.0 — see [LICENSE](./LICENSE).

Part of the [AgentTrace](https://github.com/agenttrace/agenttrace) monorepo.
