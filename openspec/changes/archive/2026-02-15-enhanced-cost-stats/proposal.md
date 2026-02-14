## Why

The current stats API and MCP tools return limited cost information that makes it difficult for AI agents to be truly cost-aware. Key issues include: (1) `get_cost()` without parameters returns all-time total, which is unintuitive - users expect current period data, (2) tokens are only shown as totals without input/output breakdown, (3) no comparison with previous periods to understand spending trends, and (4) missing request count in MCP responses.

## What Changes

- **Unify period parameters** across all stats APIs: `1h`, `today`, `24h`, `7d`, `30d`, `all`
- Enhance `/api/stats/:agentId` to return richer data: input/output tokens separately, request count, and period metadata
- Add comparison data (previous period) to cost responses for trend awareness
- Update MCP `get_cost` and `get_token_usage` tools to return enhanced data
- Change default period behavior: no period should default to "today" instead of all-time
- Add `period` field in responses to clearly indicate what time range is being shown
- Update CLI `agent <name> stat` to display input/output tokens separately and show period comparison

## Capabilities

### New Capabilities

- `enhanced-stats-response`: Richer stats response structure with input/output token breakdown, request count, period metadata, and previous period comparison data

### Modified Capabilities

<!-- No existing specs need modification - this is implementation-level enhancement -->

## Impact

- **packages/server**: Update `/api/stats/:agentId`, `/api/stats/tokens`, `/api/stats/cost` endpoints
- **packages/mcp**: Update client methods and MCP tool responses
- **packages/cli**: Update `agent stat` command output formatting
- **API consumers**: Response structure changes (additive, non-breaking - new fields added)
