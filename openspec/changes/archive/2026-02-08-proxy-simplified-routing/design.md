## Context

Users currently need to understand provider-specific endpoint formats when routing through the proxy. This leads to configuration errors especially with Chinese AI providers that have non-standard paths (`/v1/text/chatcompletion_v2` for MiniMax, `/api/paas/v4/...` for Zhipu). The goal is to make the proxy handle all path complexity internally.

Current state:
- Proxy supports path-prefix routing: `/openai/v1/chat/completions`, `/anthropic/v1/messages`
- Proxy supports agent path routing: `/agents/:agent/openai/v1/chat/completions`
- Users must know the correct path suffix for each provider
- `getProviderBaseUrl()` and `rewriteProviderPath()` already exist but require path input

## Goals / Non-Goals

**Goals:**
- Single endpoint format: `POST /agents/:agent/:provider`
- Proxy constructs full downstream URL including correct path
- Works for all supported providers (OpenAI, Anthropic, Google, Mistral, Cohere, DeepSeek, Moonshot, Zhipu, MiniMax, Yi)
- Accept standard OpenAI-format request body
- Backward compatible with existing path-prefix routing

**Non-Goals:**
- Support for non-chat endpoints (embeddings, completions legacy, etc.)
- Request body transformation between formats (OpenAI ↔ Anthropic Messages)
- Dynamic provider discovery

## Decisions

### D1: Single Chat Endpoint Per Provider

Each provider has exactly one chat endpoint URL. The proxy maintains a complete mapping.

| Provider | Full Chat Endpoint |
|----------|-------------------|
| openai | `https://api.openai.com/v1/chat/completions` |
| anthropic | `https://api.anthropic.com/v1/messages` |
| google | `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` |
| mistral | `https://api.mistral.ai/v1/chat/completions` |
| cohere | `https://api.cohere.com/v2/chat` |
| deepseek | `https://api.deepseek.com/v1/chat/completions` |
| moonshot | `https://api.moonshot.ai/v1/chat/completions` |
| zhipu | `https://api.z.ai/api/paas/v4/chat/completions` |
| minimax | `https://api.minimax.io/v1/text/chatcompletion_v2` |
| yi | `https://api.01.ai/v1/chat/completions` |

**Rationale**: Pre-defined complete URLs eliminate all path construction logic at request time. No parsing, no guessing.

### D2: Add `getProviderChatEndpoint()` Function

New function in `packages/shared/src/providers.ts` that returns the complete chat endpoint URL for a provider. Returns `null` for unknown providers.

**Rationale**: Centralizes endpoint knowledge in shared package. Proxy and other consumers can use it.

### D3: New Route Handler Pattern

Route: `POST /agents/:agent/:provider`

Handler logic:
1. Extract `agent` and `provider` from path params
2. Look up `getProviderChatEndpoint(provider)` - return 400 if null
3. Look up API key from secret store for the provider
4. Forward request to the complete endpoint URL with proper auth header
5. Parse response and emit events with agent context

**Rationale**: Simple route with no path parsing complexity. All intelligence is in the endpoint lookup.

### D4: Coexist with Existing Routes

Keep existing `/agents/:agent/:provider/*` and `/:provider/*` routes. The new simplified route is additive.

**Rationale**: Backward compatibility for existing integrations. No breaking changes.

## Risks / Trade-offs

**[Risk] Provider uses different content-type or request format**
→ Mitigation: All supported providers accept JSON. Non-OpenAI providers (Anthropic, Cohere) have different request schemas but users of simplified routing should use OpenAI-compatible format. Document this limitation.

**[Risk] Provider endpoint URLs change**
→ Mitigation: Endpoint table is easy to update. Single source of truth.

**[Trade-off] Only supports chat endpoint**
→ Accepted. Chat is 99% of use cases. Users needing embeddings/other can use path-prefix routing.

**[Trade-off] No request body transformation**
→ Accepted. Users must send format compatible with target provider. Anthropic's OpenAI-compatibility layer or native format.
