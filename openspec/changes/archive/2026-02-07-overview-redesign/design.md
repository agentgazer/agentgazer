## Context

The current Overview page (`OverviewPage.tsx`) displays basic agent cards with minimal information. It doesn't provide the "big picture" view that a dashboard should offer. Users have no visibility into trends, system events, or comparative analysis.

The dashboard already has Recharts installed and uses it in the AgentDetail page for charts.

## Goals / Non-Goals

**Goals:**
- Create a comprehensive dashboard that answers "What's happening with my agents right now?"
- Show trends to answer "Is usage going up or down?"
- Surface important events to answer "What needs my attention?"
- Rank top consumers to answer "Where is my spend going?"

**Non-Goals:**
- Real-time WebSocket updates (continue using polling)
- User-customizable widget layout (future enhancement)
- Alerting from the Overview page (alerts page handles this)

## Decisions

### Decision 1: Single Overview API Endpoint

**Choice**: Create a single `/api/overview` endpoint that returns all dashboard data in one call.

**Alternatives Considered**:
1. Multiple endpoints (stats, trends, rankings separately) - more network calls
2. Single endpoint - one call, simpler client code, can be cached together

**Rationale**: Dashboard loads all data at once anyway. Single endpoint reduces latency and simplifies error handling.

### Decision 2: Trend Calculation Approach

**Choice**: Calculate trends by comparing aggregated data for "today" vs "yesterday" and daily aggregates for 7-day charts.

```sql
-- Today vs Yesterday comparison
SELECT
  SUM(CASE WHEN date(timestamp) = date('now') THEN cost_usd ELSE 0 END) as today,
  SUM(CASE WHEN date(timestamp) = date('now', '-1 day') THEN cost_usd ELSE 0 END) as yesterday
FROM agent_events
WHERE timestamp >= date('now', '-1 day')
```

**Rationale**: Simple, accurate, and performant with existing indices.

### Decision 3: Recent Events Source

**Choice**: Query `agent_events` table for event types: `kill_switch`, `blocked`, `error`, and detect "new agent" from first event timestamp.

**Event Types to Surface**:
| Event | Source | Condition |
|-------|--------|-----------|
| Kill Switch | `event_type = 'kill_switch'` | Direct query |
| Budget Warning | `event_type = 'blocked'` + `block_reason` | 80%+ of budget |
| High Error Rate | Calculated | >5% errors in last hour |
| New Agent | `agents.created_at` | Created in last 24h |

**Rationale**: Leverage existing event data, no new tables needed.

### Decision 4: Chart Library

**Choice**: Continue using Recharts (already installed).

**Rationale**: Consistency with existing AgentDetail charts, no new dependencies.

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Summary Cards (4 columns, grid)                                 │
│ [Active Agents] [Today's Cost] [Requests/24h] [Error Rate]     │
│  with ↑↓ trend   with ↑↓ trend  with ↑↓ trend  with warning    │
├─────────────────────────────────────────────────────────────────┤
│ Recent Events (left 50%)  │  Rankings (right 50%)              │
│ - Timeline list           │  - Top Agents by Cost              │
│ - Last 10 events          │  - Top Models by Tokens            │
│ - Color-coded by type     │  - Horizontal bar charts           │
├─────────────────────────────────────────────────────────────────┤
│ Trend Charts (full width, 2 columns)                           │
│ [Cost Trend - 7 days]     [Requests Trend - 7 days]           │
│  AreaChart                 AreaChart                           │
└─────────────────────────────────────────────────────────────────┘
```

## Risks / Trade-offs

**[Performance]** Single overview query aggregates a lot of data.
→ Mitigation: Use appropriate date filters, limit to 7 days for trends.

**[Complexity]** Many sections means more things that can break.
→ Mitigation: Each section fails independently, shows error state.
