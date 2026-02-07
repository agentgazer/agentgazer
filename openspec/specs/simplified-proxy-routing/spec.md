## ADDED Requirements

### Requirement: Simplified agent-provider routing endpoint

The proxy SHALL expose a `POST /agents/:agent/:provider` endpoint that accepts a standard chat request body and forwards it to the correct provider chat endpoint.

#### Scenario: Successful request to OpenAI via simplified route
- **WHEN** client sends `POST /agents/my-bot/openai` with body `{"model": "gpt-4o", "messages": [...]}`
- **THEN** proxy forwards to `https://api.openai.com/v1/chat/completions` with stored API key

#### Scenario: Successful request to Anthropic via simplified route
- **WHEN** client sends `POST /agents/my-bot/anthropic` with body `{"model": "claude-sonnet-4-5-20250929", "messages": [...]}`
- **THEN** proxy forwards to `https://api.anthropic.com/v1/messages` with stored API key

#### Scenario: Successful request to Chinese provider via simplified route
- **WHEN** client sends `POST /agents/my-bot/zhipu` with body `{"model": "glm-4.7", "messages": [...]}`
- **THEN** proxy forwards to `https://api.z.ai/api/paas/v4/chat/completions` with stored API key

### Requirement: Provider chat endpoint lookup function

The shared package SHALL provide a `getProviderChatEndpoint(provider: ProviderName)` function that returns the complete chat endpoint URL for a given provider.

#### Scenario: Get endpoint for known provider
- **WHEN** `getProviderChatEndpoint("openai")` is called
- **THEN** it returns `"https://api.openai.com/v1/chat/completions"`

#### Scenario: Get endpoint for provider with non-standard path
- **WHEN** `getProviderChatEndpoint("minimax")` is called
- **THEN** it returns `"https://api.minimax.io/v1/text/chatcompletion_v2"`

#### Scenario: Get endpoint for unknown provider
- **WHEN** `getProviderChatEndpoint("unknown")` is called
- **THEN** it returns `null`

### Requirement: Reject unknown provider in simplified route

The simplified routing endpoint SHALL return HTTP 400 when the provider is not recognized.

#### Scenario: Unknown provider rejected
- **WHEN** client sends `POST /agents/my-bot/invalid-provider`
- **THEN** proxy returns `400 Bad Request` with error message indicating unknown provider

### Requirement: Backward compatibility with path-prefix routing

Existing path-prefix routes (`/:provider/*` and `/agents/:agent/:provider/*`) SHALL continue to work unchanged.

#### Scenario: Legacy path-prefix route still works
- **WHEN** client sends `POST /openai/v1/chat/completions`
- **THEN** proxy forwards to `https://api.openai.com/v1/chat/completions` as before

#### Scenario: Legacy agent path route still works
- **WHEN** client sends `POST /agents/my-bot/openai/v1/chat/completions`
- **THEN** proxy forwards to `https://api.openai.com/v1/chat/completions` with agent tracking as before
