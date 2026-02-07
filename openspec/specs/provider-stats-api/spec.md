### Requirement: Provider stats API endpoint

The `/api/providers` endpoint SHALL return aggregated usage statistics for each configured provider.

#### Scenario: Response includes usage stats
- **WHEN** client fetches `GET /api/providers`
- **THEN** each provider object SHALL include `agent_count`, `total_tokens`, `total_cost`, and `today_cost` fields

#### Scenario: Stats aggregation from events
- **WHEN** provider "openai" has events from 3 different agents totaling 10000 tokens and $1.50 cost
- **THEN** the provider object SHALL show `agent_count: 3`, `total_tokens: 10000`, `total_cost: 1.5`

#### Scenario: Today cost calculation
- **WHEN** provider "anthropic" has $0.50 cost from today and $2.00 from previous days
- **THEN** the provider object SHALL show `today_cost: 0.5` and `total_cost: 2.5`

#### Scenario: Provider with no events
- **WHEN** provider "mistral" is configured but has no events
- **THEN** the provider object SHALL show `agent_count: 0`, `total_tokens: 0`, `total_cost: 0`, `today_cost: 0`

### Requirement: Provider active toggle API

The system SHALL allow toggling provider active status via API.

#### Scenario: Disable provider
- **WHEN** client sends `PUT /api/providers/:name` with `{ active: false }`
- **THEN** the provider's active status SHALL be set to false
- **AND** subsequent proxy requests to that provider SHALL be blocked

#### Scenario: Enable provider
- **WHEN** client sends `PUT /api/providers/:name` with `{ active: true }`
- **THEN** the provider's active status SHALL be set to true
- **AND** subsequent proxy requests to that provider SHALL be allowed
