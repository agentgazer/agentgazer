## MODIFIED Requirements

### Requirement: Request forwarding with model override

The proxy SHALL forward incoming LLM requests to the appropriate provider API. Before forwarding, the proxy MUST check for model override rules via the Server API. If an override rule exists for the agent-provider pair, the proxy MUST rewrite the `model` field in the request body. The proxy MUST record both `requested_model` (original) and `model` (actual) in the event.

#### Scenario: Forward with model override

- **WHEN** request arrives at `/openai/v1/chat/completions` with x-agent-id header "my-bot" and body containing model "gpt-4"
- **AND** override rule exists for agent "my-bot" and provider "openai" with model_override "gpt-4o-mini"
- **THEN** proxy MUST forward to OpenAI with model "gpt-4o-mini"
- **AND** event MUST have requested_model="gpt-4" and model="gpt-4o-mini"

#### Scenario: Forward without override

- **WHEN** request arrives at `/anthropic/v1/messages` with x-agent-id header "my-bot" and body containing model "claude-opus-4-5"
- **AND** no override rule exists for agent "my-bot" and provider "anthropic"
- **THEN** proxy MUST forward to Anthropic with model "claude-opus-4-5" unchanged
- **AND** event MUST have requested_model="claude-opus-4-5" and model="claude-opus-4-5"

#### Scenario: Cache override rules

- **WHEN** proxy receives multiple requests for same agent-provider pair within 30 seconds
- **THEN** proxy SHOULD use cached override rule instead of querying API each time
