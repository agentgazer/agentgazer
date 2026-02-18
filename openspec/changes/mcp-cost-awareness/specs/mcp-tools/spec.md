## ADDED Requirements

### Requirement: get_token_usage tool
The MCP server SHALL provide a `get_token_usage` tool to query token consumption.

#### Scenario: Query total token usage
- **WHEN** AI calls `get_token_usage` with no parameters
- **THEN** returns total input_tokens and output_tokens for current agent

#### Scenario: Query token usage with period filter
- **WHEN** AI calls `get_token_usage` with period="today" or period="7d"
- **THEN** returns token usage filtered by time period

#### Scenario: Query token usage by model
- **WHEN** AI calls `get_token_usage` with model="claude-opus-4-5-20251101"
- **THEN** returns token usage filtered by specific model

### Requirement: get_cost tool
The MCP server SHALL provide a `get_cost` tool to query spending in USD.

#### Scenario: Query total cost
- **WHEN** AI calls `get_cost` with no parameters
- **THEN** returns total cost in USD for current agent

#### Scenario: Query cost with period filter
- **WHEN** AI calls `get_cost` with period="today"
- **THEN** returns cost for current day only

#### Scenario: Query cost breakdown by model
- **WHEN** AI calls `get_cost` with breakdown=true
- **THEN** returns cost grouped by model

### Requirement: get_budget_status tool
The MCP server SHALL provide a `get_budget_status` tool to check budget limits.

#### Scenario: Query budget when limit is set
- **WHEN** AI calls `get_budget_status` and agent has budget limit configured
- **THEN** returns limit, used, remaining, and percentage_used

#### Scenario: Query budget when no limit set
- **WHEN** AI calls `get_budget_status` and no budget limit is configured
- **THEN** returns has_limit=false and total spent amount

### Requirement: estimate_cost tool
The MCP server SHALL provide an `estimate_cost` tool to predict operation costs.

#### Scenario: Estimate cost for model and tokens
- **WHEN** AI calls `estimate_cost` with model="claude-opus-4-5-20251101", input_tokens=1000, output_tokens=500
- **THEN** returns estimated cost in USD based on pricing table

#### Scenario: Estimate with unknown model
- **WHEN** AI calls `estimate_cost` with unrecognized model name
- **THEN** returns error indicating model not found in pricing table

### Requirement: whoami tool
The MCP server SHALL provide a `whoami` tool to identify current agent context.

#### Scenario: Query agent identity
- **WHEN** AI calls `whoami`
- **THEN** returns agent_id, endpoint, and connection status

#### Scenario: Verify connectivity
- **WHEN** AI calls `whoami` and server is reachable
- **THEN** returns connected=true and server version
