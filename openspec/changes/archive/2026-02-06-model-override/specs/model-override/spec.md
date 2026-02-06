## ADDED Requirements

### Requirement: Model override rules storage

The system SHALL store model override rules in a dedicated `agent_model_rules` table with columns: `id`, `agent_id`, `provider`, `model_override`, `created_at`, `updated_at`. The combination of `agent_id` and `provider` MUST be unique.

#### Scenario: Create override rule for agent-provider pair

- **WHEN** a user creates a model override rule for agent "my-bot" and provider "openai" with model "gpt-4o-mini"
- **THEN** the system MUST insert a row with agent_id="my-bot", provider="openai", model_override="gpt-4o-mini"

#### Scenario: Update existing override rule

- **WHEN** a user updates the model override for agent "my-bot" and provider "openai" from "gpt-4o-mini" to "gpt-3.5-turbo"
- **THEN** the system MUST update the existing row's model_override to "gpt-3.5-turbo" and update updated_at

#### Scenario: Delete override rule

- **WHEN** a user removes the model override for agent "my-bot" and provider "openai"
- **THEN** the system MUST delete the row OR set model_override to NULL

### Requirement: Record requested model in events

The system SHALL record the originally requested model in `agent_events.requested_model` and the actually used model in `agent_events.model`. When no override is applied, both fields MUST contain the same value.

#### Scenario: Override applied - record both models

- **WHEN** agent requests model "gpt-4" and override rule specifies "gpt-4o-mini"
- **THEN** the event MUST have requested_model="gpt-4" and model="gpt-4o-mini"

#### Scenario: No override - record same model

- **WHEN** agent requests model "gpt-4" and no override rule exists
- **THEN** the event MUST have requested_model="gpt-4" and model="gpt-4"

### Requirement: Proxy model rewrite

The proxy SHALL check for model override rules before forwarding requests. If an override rule exists for the agent-provider pair, the proxy MUST rewrite the `model` field in the request body before forwarding to the provider.

#### Scenario: Rewrite model when override exists

- **WHEN** request arrives for agent "my-bot" to provider "openai" with model "gpt-4"
- **AND** override rule exists: agent_id="my-bot", provider="openai", model_override="gpt-4o-mini"
- **THEN** proxy MUST change request body model from "gpt-4" to "gpt-4o-mini" before forwarding

#### Scenario: Pass through when no override

- **WHEN** request arrives for agent "my-bot" to provider "anthropic" with model "claude-opus-4-5"
- **AND** no override rule exists for this agent-provider pair
- **THEN** proxy MUST forward request unchanged with model "claude-opus-4-5"

### Requirement: API for model rules management

The server SHALL provide REST API endpoints for managing model override rules:
- `GET /api/agents/:id/model-rules` - list all rules for an agent
- `PUT /api/agents/:id/model-rules/:provider` - create or update rule
- `DELETE /api/agents/:id/model-rules/:provider` - delete rule
- `GET /api/models` - list selectable models per provider

#### Scenario: Get model rules for agent

- **WHEN** client calls `GET /api/agents/my-bot/model-rules`
- **THEN** server MUST return array of rules: `[{ provider: "openai", model_override: "gpt-4o-mini" }]`

#### Scenario: Set model override

- **WHEN** client calls `PUT /api/agents/my-bot/model-rules/openai` with body `{ model_override: "gpt-4o-mini" }`
- **THEN** server MUST create or update the rule and return the updated rule

#### Scenario: Get selectable models

- **WHEN** client calls `GET /api/models`
- **THEN** server MUST return models per provider: `{ openai: ["gpt-4o", "gpt-4o-mini", ...], anthropic: [...] }`

### Requirement: Dashboard agents list shows providers

The Dashboard Agents list page SHALL display a "Providers" column showing which providers each agent has used. Providers with active override rules SHALL be marked with an indicator.

#### Scenario: Display providers for multi-provider agent

- **WHEN** agent "smart-bot" has events with provider "openai" and "anthropic"
- **AND** agent has override rule for "openai"
- **THEN** Agents list MUST show Providers column with "OpenAI (override), Anthropic"

### Requirement: Dashboard agent detail model settings

The Dashboard Agent Detail page SHALL include a "Model Settings" section showing each provider the agent has used. For each provider, a dropdown MUST allow selecting a model override from the selectable models list. The dropdown MUST include a "None" option to disable override.

#### Scenario: Display model settings for each provider

- **WHEN** user views Agent Detail for "smart-bot" which uses OpenAI and Anthropic
- **THEN** page MUST show Model Settings section with OpenAI dropdown and Anthropic dropdown

#### Scenario: Change model override from dropdown

- **WHEN** user selects "gpt-4o-mini" from OpenAI dropdown for agent "smart-bot"
- **THEN** system MUST call PUT /api/agents/smart-bot/model-rules/openai with model_override="gpt-4o-mini"
- **AND** dropdown MUST reflect the new selection

#### Scenario: Remove model override

- **WHEN** user selects "None" from OpenAI dropdown for agent "smart-bot"
- **THEN** system MUST call DELETE /api/agents/smart-bot/model-rules/openai
- **AND** dropdown MUST show "None" as selected

### Requirement: Dashboard request log shows model comparison

The Dashboard Agent Detail page SHALL include a Request Log section showing recent LLM calls. Each entry MUST display: timestamp, provider, requested_model, actual model (if different), tokens, and cost.

#### Scenario: Display override in request log

- **WHEN** request log entry has requested_model="gpt-4" and model="gpt-4o-mini"
- **THEN** entry MUST display both: "gpt-4 → gpt-4o-mini" or similar visual indication

#### Scenario: Display non-override in request log

- **WHEN** request log entry has requested_model="gpt-4" and model="gpt-4"
- **THEN** entry MUST display just "gpt-4" without override indication

### Requirement: Selectable models list

The shared package SHALL export a `SELECTABLE_MODELS` constant mapping provider names to arrays of model IDs. The list MUST include commonly available models and MUST exclude models requiring special access or application.

#### Scenario: Get OpenAI selectable models

- **WHEN** code accesses `SELECTABLE_MODELS.openai`
- **THEN** result MUST include ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] or subset thereof

#### Scenario: Get Anthropic selectable models

- **WHEN** code accesses `SELECTABLE_MODELS.anthropic`
- **THEN** result MUST include ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku"] or subset thereof
