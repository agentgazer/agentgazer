# Cross-Provider Model Override - Design

## Architecture

```
┌─────────────┐     ┌────────────────────────────────────┐     ┌─────────────┐
│   Agent     │────▶│            Proxy                   │────▶│  Target     │
│  (OpenAI    │     │                                    │     │  Provider   │
│   format)   │     │  1. Check model override           │     │  (Anthropic)│
└─────────────┘     │  2. If cross-provider:             │     └─────────────┘
      ▲             │     - Transform request            │           │
      │             │     - Use target provider key      │           │
      │             │     - Forward to target endpoint   │           ▼
      │             │  3. Transform response back        │     ┌─────────────┐
      │             │  4. Return to agent                │◀────│  Response   │
      │             └────────────────────────────────────┘     │  (Claude    │
      │                            │                           │   format)   │
      └────────────────────────────┘                           └─────────────┘
                 OpenAI format response
```

## Database Changes

### Migration: Add target_provider column

```sql
ALTER TABLE agent_model_rules ADD COLUMN target_provider TEXT;
```

- `target_provider`: The provider to route to (NULL = same provider, no change)
- When `target_provider` is set and differs from `provider`, cross-provider conversion is applied

## Format Conversion

### packages/shared/src/format-converter.ts (new file)

#### OpenAI → Anthropic Request

```typescript
interface OpenAIRequest {
  model: string;
  messages: Array<{ role: string; content: string | ContentPart[] }>;
  max_tokens?: number;
  temperature?: number;
  tools?: OpenAITool[];
  stream?: boolean;
}

interface AnthropicRequest {
  model: string;
  system?: string;
  messages: Array<{ role: string; content: string | ContentPart[] }>;
  max_tokens: number;
  temperature?: number;
  tools?: AnthropicTool[];
  stream?: boolean;
}
```

Conversion rules:
1. Extract system message from messages array → `system` field
2. Remove `role: "system"` messages from messages array
3. `max_tokens` required for Anthropic (default: 4096 if not provided)
4. Convert tools format (remove `strict` field)

#### Anthropic → OpenAI Response

```typescript
// Non-streaming
AnthropicResponse {
  content: [{ type: "text", text: "..." }],
  role: "assistant",
  stop_reason: "end_turn",
  usage: { input_tokens, output_tokens }
}
→
OpenAIResponse {
  choices: [{
    message: { role: "assistant", content: "..." },
    finish_reason: "stop"
  }],
  usage: { prompt_tokens, completion_tokens, total_tokens }
}

// Streaming SSE
Anthropic events:
  event: message_start
  event: content_block_delta → delta.text
  event: message_stop

→ OpenAI chunks:
  data: {"choices":[{"delta":{"content":"..."}}]}
  data: [DONE]
```

## API Changes

### PUT /api/agents/:agentId/model-rules/:provider

Request body:
```json
{
  "model_override": "claude-sonnet-4-20250514",
  "target_provider": "anthropic"
}
```

### GET /api/agents/:agentId/providers

Response:
```json
{
  "providers": [
    {
      "provider": "openai",
      "model_override": "claude-sonnet-4-20250514",
      "target_provider": "anthropic"
    }
  ]
}
```

## Dashboard UI

### ModelSettings.tsx

Change dropdown from single provider models to grouped all-provider models:

```tsx
<select>
  <option value="">None (use agent default)</option>
  <optgroup label="OpenAI">
    <option value="openai:gpt-4o">gpt-4o</option>
    <option value="openai:gpt-4o-mini">gpt-4o-mini</option>
  </optgroup>
  <optgroup label="Anthropic">
    <option value="anthropic:claude-sonnet-4-20250514">claude-sonnet-4-20250514</option>
    <option value="anthropic:claude-opus-4-20250514">claude-opus-4-20250514</option>
  </optgroup>
  <optgroup label="Google">
    <option value="google:gemini-2.0-flash">gemini-2.0-flash</option>
  </optgroup>
  ...
</select>
```

Value format: `provider:model` to capture both target provider and model.

## Proxy Changes

### proxy-server.ts

1. Update `getModelOverride()` to return `{ model: string, targetProvider: string } | null`
2. When `targetProvider !== originalProvider`:
   - Check if target provider key exists
   - Transform request using format converter
   - Get target provider endpoint
   - Forward transformed request
   - Transform response back
   - For streaming: transform SSE chunks in real-time

### Streaming Transformation

For Anthropic → OpenAI streaming:
1. Buffer incoming Anthropic SSE events
2. Parse event type (message_start, content_block_delta, message_stop)
3. Emit corresponding OpenAI format chunks
4. Handle usage data from message_delta event

## Event Logging

Events should capture:
- `provider`: Original provider the agent was targeting
- `actual_provider`: Provider that actually served the request
- `requested_model`: Original model requested
- `model`: Actual model used (after override)

## Files to Modify

1. `packages/server/src/db.ts` - Add migration, update types
2. `packages/server/src/routes/model-rules.ts` - Handle target_provider
3. `packages/shared/src/format-converter.ts` - NEW: conversion functions
4. `packages/proxy/src/proxy-server.ts` - Cross-provider routing logic
5. `apps/dashboard-local/src/components/ModelSettings.tsx` - Grouped dropdown
