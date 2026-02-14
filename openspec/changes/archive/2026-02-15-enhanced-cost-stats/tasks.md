## 1. Unify Period Parameters

- [x] 1.1 Define unified period type: `"1h" | "today" | "24h" | "7d" | "30d" | "all"`
- [x] 1.2 Update `/api/stats/:agentId` to accept unified period values (add `today`, `all`)
- [x] 1.3 Update `/api/stats/cost` to accept unified period values (add `1h`, `24h`)
- [x] 1.4 Update `/api/stats/tokens` to accept unified period values (add `1h`, `24h`)
- [x] 1.5 Update CLI `--range` help text to document all valid values

## 2. Server Stats Endpoint Enhancement

- [x] 2.1 Add `tokens_in` and `tokens_out` fields to `/api/stats/:agentId` response
- [x] 2.2 Add `period` field to `/api/stats/:agentId` response
- [x] 2.3 Implement comparison query helper to fetch previous period data
- [x] 2.4 Add `comparison` object to `/api/stats/:agentId` response with cost_change_pct calculation

## 3. MCP Stats Endpoints Enhancement

- [x] 3.1 Add `period` field to `/api/stats/cost` response
- [x] 3.2 Add `requestCount` field to `/api/stats/cost` response
- [x] 3.3 Change default period from "all time" to "today" in `/api/stats/cost`
- [x] 3.4 Add `comparison` object to `/api/stats/cost` response
- [x] 3.5 Add `period` field to `/api/stats/tokens` response
- [x] 3.6 Change default period from "all time" to "today" in `/api/stats/tokens`

## 4. MCP Client Update

- [x] 4.1 Update `CostData` interface to include `period`, `requestCount`, and `comparison`
- [x] 4.2 Update `TokenUsage` interface to include `period`
- [x] 4.3 Update MCP tool descriptions to document new fields and default behavior

## 5. CLI Output Enhancement

- [x] 5.1 Update `showStats` to display token breakdown (in: X / out: Y)
- [x] 5.2 Add comparison trend display to cost and requests in CLI output
- [x] 5.3 Update JSON output format to include new fields

## 6. Testing

- [x] 6.1 Add tests for comparison calculation edge cases (zero cost, null values)
- [x] 6.2 Update MCP client tests for new response fields
- [x] 6.3 Test CLI output formatting with comparison data
- [x] 6.4 Test unified period parameter handling across all endpoints
