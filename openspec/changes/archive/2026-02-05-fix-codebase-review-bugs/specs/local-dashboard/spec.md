## MODIFIED Requirements

### Requirement: Agent list view with status indicators

The dashboard agents page and overview page MUST use API response field names that match the server's actual `/api/agents` response shape. The TypeScript interfaces SHALL be aligned with the server contract.

#### Scenario: Agents page renders server response correctly
- **WHEN** the dashboard fetches `/api/agents`
- **THEN** the TypeScript interface matches the server's actual response structure
- **AND** agent list renders without undefined fields

### Requirement: Agent detail view

The agent detail page MUST use API response field names that match the server's actual `/api/stats/:agentId` response shape. Field names for requests, errors, cost, tokens, and latency percentiles SHALL match the server contract exactly.

#### Scenario: Stats page renders server response correctly
- **WHEN** the dashboard fetches `/api/stats/:agentId`
- **THEN** the TypeScript interface field names match the server's actual response
- **AND** all stat cards display correct values (not undefined or NaN)

#### Scenario: CLI stats command uses correct field names
- **WHEN** the CLI fetches `/api/stats/:agentId`
- **THEN** the CLI's StatsResponse field names match the server's actual response
- **AND** stats display renders correct values
