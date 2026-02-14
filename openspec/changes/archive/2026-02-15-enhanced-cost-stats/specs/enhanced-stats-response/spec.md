## ADDED Requirements

### Requirement: Unified period parameter across all stats APIs

All stats APIs SHALL accept the same set of period values: `"1h"`, `"today"`, `"24h"`, `"7d"`, `"30d"`, `"all"`.

#### Scenario: All period values accepted by stats endpoint
- **WHEN** client calls `GET /api/stats/:agentId?range=today`
- **THEN** response contains data from midnight local time to now

#### Scenario: All period values accepted by cost endpoint
- **WHEN** client calls `GET /api/stats/cost?period=24h`
- **THEN** response contains cost data from last 24 hours

#### Scenario: "all" returns all-time data
- **WHEN** client calls any stats endpoint with period `"all"`
- **THEN** response contains data from the beginning of time (no time filter)

### Requirement: Stats response includes input/output token breakdown

The stats API SHALL return separate `tokens_in` and `tokens_out` fields in addition to the existing `total_tokens` field.

#### Scenario: Agent stats returns token breakdown
- **WHEN** client calls `GET /api/stats/:agentId`
- **THEN** response includes `tokens_in` (input tokens total) and `tokens_out` (output tokens total)
- **AND** `tokens_in + tokens_out` equals `total_tokens`

### Requirement: Stats response includes period metadata

The stats API SHALL return a `period` field indicating the time range of the data.

#### Scenario: Period is included in response
- **WHEN** client calls `GET /api/stats/:agentId?range=24h`
- **THEN** response includes `period: "24h"`

#### Scenario: Default period is 24h for stats endpoint
- **WHEN** client calls `GET /api/stats/:agentId` without range parameter
- **THEN** response includes `period: "24h"`

### Requirement: Stats response includes comparison with previous period

The stats API SHALL return a `comparison` object containing data from the equivalent previous period.

#### Scenario: Comparison data for 24h range
- **WHEN** client calls `GET /api/stats/:agentId?range=24h`
- **THEN** response includes `comparison` with `period: "previous_24h"`, `total_cost`, `total_requests`, and `cost_change_pct`

#### Scenario: Comparison shows percentage change
- **WHEN** current period cost is $10 and previous period cost is $8
- **THEN** `comparison.cost_change_pct` equals `25.0` (representing +25%)

#### Scenario: Comparison handles zero previous cost
- **WHEN** previous period has zero cost and current period has non-zero cost
- **THEN** `comparison.cost_change_pct` is `null` (cannot calculate percentage from zero)

### Requirement: MCP get_cost defaults to today

The MCP `get_cost` tool SHALL default to period "today" when no period parameter is provided.

#### Scenario: get_cost without period returns today's cost
- **WHEN** MCP client calls `get_cost()` without period parameter
- **THEN** response contains cost data for current day only (from midnight local time)
- **AND** response includes `period: "today"`

### Requirement: MCP get_cost includes request count

The MCP `get_cost` tool SHALL return `requestCount` in the response.

#### Scenario: Cost response includes request count
- **WHEN** MCP client calls `get_cost()`
- **THEN** response includes `requestCount` field with the number of LLM calls in the period

### Requirement: MCP get_token_usage defaults to today

The MCP `get_token_usage` tool SHALL default to period "today" when no period parameter is provided.

#### Scenario: get_token_usage without period returns today's usage
- **WHEN** MCP client calls `get_token_usage()` without period parameter
- **THEN** response contains token usage for current day only
- **AND** response includes `period: "today"`

### Requirement: MCP cost response includes comparison data

The MCP `get_cost` tool SHALL return comparison data with the previous equivalent period.

#### Scenario: Cost comparison for today
- **WHEN** MCP client calls `get_cost({ period: "today" })`
- **THEN** response includes `comparison` with yesterday's cost data and percentage change

#### Scenario: Cost comparison for 7d
- **WHEN** MCP client calls `get_cost({ period: "7d" })`
- **THEN** response includes `comparison` with previous 7-day period data

### Requirement: CLI stat displays token breakdown

The CLI `agent <name> stat` command SHALL display input and output tokens separately.

#### Scenario: Token breakdown in CLI output
- **WHEN** user runs `agentgazer agent my-agent stat`
- **THEN** output shows tokens in format "Tokens: 45,200 (in: 38,000 / out: 7,200)"

### Requirement: CLI stat displays comparison trend

The CLI `agent <name> stat` command SHALL display cost and request comparison with previous period.

#### Scenario: Comparison trend in CLI output
- **WHEN** user runs `agentgazer agent my-agent stat`
- **AND** cost increased 15% compared to previous period
- **THEN** output shows cost with trend indicator like "$2.50 (+15% vs prev)"
