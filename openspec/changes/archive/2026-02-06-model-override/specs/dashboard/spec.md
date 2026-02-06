## MODIFIED Requirements

### Requirement: Agents list displays providers

The Agents list page SHALL display a "Providers" column showing which providers each agent has used. The providers MUST be derived from the agent's event history. Providers with active model override rules MUST be visually distinguished (e.g., with an icon or badge).

#### Scenario: Display single provider

- **WHEN** agent "simple-bot" has only used OpenAI
- **THEN** Providers column MUST show "OpenAI"

#### Scenario: Display multiple providers

- **WHEN** agent "smart-bot" has used OpenAI and Anthropic
- **THEN** Providers column MUST show both providers (e.g., "OpenAI, Anthropic")

#### Scenario: Indicate override active

- **WHEN** agent "my-bot" has an active model override for OpenAI
- **THEN** Providers column MUST show OpenAI with an override indicator (e.g., icon, badge, or text)

### Requirement: Agent detail includes model settings

The Agent Detail page SHALL include a "Model Settings" section. This section MUST list each provider the agent has used with a model override dropdown for each. The dropdown options MUST come from the selectable models list for that provider plus a "None" option.

#### Scenario: Display model settings section

- **WHEN** user navigates to Agent Detail for "smart-bot"
- **THEN** page MUST show "Model Settings" section with controls for each provider used

#### Scenario: Dropdown shows current override

- **WHEN** agent "my-bot" has override "gpt-4o-mini" for OpenAI
- **THEN** OpenAI dropdown MUST show "gpt-4o-mini" as selected

#### Scenario: Dropdown shows None when no override

- **WHEN** agent "my-bot" has no override for Anthropic
- **THEN** Anthropic dropdown MUST show "None" as selected

### Requirement: Agent detail includes request log

The Agent Detail page SHALL include a "Request Log" section showing recent LLM calls. Each log entry MUST display: timestamp, provider, requested model, actual model (with visual distinction if different), token count, and cost.

#### Scenario: Display request log entries

- **WHEN** user views Agent Detail for "my-bot" with recent LLM calls
- **THEN** page MUST show Request Log with entries showing timestamp, provider, models, tokens, cost

#### Scenario: Highlight model override in log

- **WHEN** log entry has requested_model different from model
- **THEN** entry MUST visually indicate the override (e.g., "gpt-4 → gpt-4o-mini")
