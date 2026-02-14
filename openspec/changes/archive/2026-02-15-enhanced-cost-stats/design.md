## Context

Currently, the stats API returns basic aggregations:
- `/api/stats/:agentId` returns total_requests, total_errors, total_cost, total_tokens (combined), latency percentiles
- `/api/stats/cost` (MCP) returns totalCost with optional breakdown by model
- `/api/stats/tokens` (MCP) returns inputTokens and outputTokens

The MCP tools default to "all time" when no period is specified, which is counterintuitive for cost-awareness use cases where agents typically want to know "how much have I spent today/this session?"

## Goals / Non-Goals

**Goals:**
- Add input/output token breakdown to stats responses
- Add request count to MCP cost responses
- Add comparison data (previous period) for trend awareness
- Change default period to "today" for more intuitive behavior
- Include explicit period metadata in all responses
- Keep responses backward-compatible (additive changes only)

**Non-Goals:**
- Session tracking (separate feature)
- Budget limit implementation (already has placeholder)
- Real-time streaming cost updates
- Cost forecasting/prediction

## Decisions

### 1. Unified Period Parameters

Consolidate period values across all stats APIs:

| Value | Meaning |
|-------|---------|
| `1h` | Last 1 hour |
| `today` | From midnight local time to now |
| `24h` | Last 24 hours (default for CLI) |
| `7d` | Last 7 days |
| `30d` | Last 30 days |
| `all` | All time (no time filter) |

**Rationale**: Currently CLI uses `1h/24h/7d/30d` while MCP uses `today/7d/30d/all-time`. This causes confusion. Unifying allows users to use the same values everywhere.

**Note**: `today` vs `24h` are distinct - `today` starts at midnight, `24h` is a rolling window.

### 2. Response Structure Enhancement

Add new fields to existing responses rather than creating new endpoints:

```typescript
// Enhanced /api/stats/:agentId response
{
  // Existing fields (unchanged)
  total_requests: number;
  total_errors: number;
  error_rate: number;
  total_cost: number;
  total_tokens: number;
  p50_latency: number | null;
  p99_latency: number | null;
  cost_by_model: [...];

  // New fields
  period: string;           // "24h", "7d", "30d", "1h"
  tokens_in: number;        // Input tokens total
  tokens_out: number;       // Output tokens total
  comparison: {             // Previous period comparison
    period: string;         // e.g., "previous_24h"
    total_cost: number;
    total_requests: number;
    cost_change_pct: number; // +15.5 or -10.2
  } | null;
}
```

**Rationale**: Additive changes preserve backward compatibility. Existing API consumers continue to work unchanged.

### 3. Default Period Change

Change MCP tools default from "all time" to "today":
- `get_cost()` → defaults to today
- `get_token_usage()` → defaults to today

Keep `/api/stats/:agentId` default as "24h" for consistency with existing behavior.

**Rationale**: AI agents asking "how much did I spend?" typically want recent spending, not lifetime totals. "today" is more actionable for cost awareness.

### 4. Comparison Period Logic

For each period, compare with the equivalent previous period:
- "today" → compare with "yesterday"
- "24h" → compare with "previous 24h" (24-48 hours ago)
- "7d" → compare with "previous 7d" (7-14 days ago)
- "30d" → compare with "previous 30d"

**Rationale**: Same-length comparison periods provide meaningful trend data.

### 5. CLI Output Enhancement

Update `agentgazer agent <name> stat` to show:
```
Agent Statistics: "my-agent" (last 24h)
───────────────────────────────────────

Requests:   150          (+12% vs prev period)
Errors:     3 (2.00%)
Cost:       $2.50        (+8% vs prev period)
Tokens:     45,200 (in: 38,000 / out: 7,200)

Latency:    p50 = 245ms   p99 = 1,200ms
```

## Risks / Trade-offs

**[Performance]** Comparison queries double the database reads → Mitigate by using a single query with UNION or conditional aggregation.

**[Breaking change risk]** Changing MCP default period could surprise users → Mitigate by documenting clearly; additive field changes are non-breaking.

**[Complexity]** More fields in response → Keep optional fields nullable; document clearly.
