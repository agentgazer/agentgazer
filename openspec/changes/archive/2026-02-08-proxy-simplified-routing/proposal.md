## Why

Users currently need to know provider-specific path formats (e.g., `/v1/chat/completions`, `/v1/messages`, `/v1beta/openai/chat/completions`) when routing through the proxy. This leads to configuration errors and confusion, as evidenced by recent debugging sessions with Chinese AI providers having inconsistent endpoints. By simplifying to `/agents/:agent/:provider`, users only specify agent name and provider name while the proxy handles all path construction internally.

## What Changes

- Add new simplified route: `POST /agents/:agent/:provider` that accepts standard chat request body
- Create provider endpoint configuration table with complete chat URLs for each provider
- Proxy automatically constructs full downstream URL based on provider
- Proxy handles all path variations (`/v1`, `/v4`, `/v1beta`, `/messages` vs `/chat/completions`, etc.)
- Existing path-prefix routing (`/openai/v1/...`, `/anthropic/v1/...`) remains for backward compatibility
- **BREAKING**: None - this is additive

## Capabilities

### New Capabilities
- `simplified-proxy-routing`: New `/agents/:agent/:provider` endpoint that abstracts away all provider-specific path details. Users send standard chat request body, proxy determines correct downstream endpoint.

### Modified Capabilities
- `local-proxy`: Add provider chat endpoint configuration and new route handler alongside existing path-prefix routing.

## Impact

- `packages/proxy/src/proxy-server.ts` - Add new route handler for `/agents/:agent/:provider`
- `packages/shared/src/providers.ts` - Add `getProviderChatEndpoint()` function returning full chat URL per provider
- Documentation updates to recommend simplified routing pattern
- OpenClaw integration becomes simpler (just `baseUrl: http://localhost:4000/agents/<agent>/<provider>`)
