## MODIFIED Requirements

### Requirement: Route handling for agent requests

The proxy SHALL handle requests to `/agents/:agent/:provider` by:
1. Extracting agent ID and provider name from the path
2. Looking up the complete chat endpoint URL via `getProviderChatEndpoint(provider)`
3. Retrieving the API key for the provider from the secret store
4. Forwarding the request to the provider's chat endpoint with proper authentication
5. Parsing the response and emitting events with agent context

If the provider is unknown (no chat endpoint configured), the proxy SHALL return HTTP 400.

If no trailing path is provided after `/agents/:agent/:provider`, the proxy SHALL use the simplified routing logic.

If a trailing path is provided (e.g., `/agents/:agent/:provider/v1/...`), the proxy SHALL use the existing path-prefix routing logic for backward compatibility.

#### Scenario: Simplified route without trailing path
- **WHEN** client sends `POST /agents/my-bot/openai` (no trailing path)
- **THEN** proxy uses simplified routing: looks up chat endpoint and forwards directly

#### Scenario: Legacy route with trailing path
- **WHEN** client sends `POST /agents/my-bot/openai/v1/chat/completions` (has trailing path)
- **THEN** proxy uses existing path-prefix routing logic

#### Scenario: Invalid provider in simplified route
- **WHEN** client sends `POST /agents/my-bot/not-a-provider`
- **THEN** proxy returns `400 Bad Request` with error: "Unknown provider: not-a-provider"
