## Context

The current Provider page (`ProvidersPage.tsx`) displays providers in a card grid layout showing only configuration status (Active/Inactive) and rate limit info. There is no visibility into actual usage statistics like tokens, costs, or which agents are using each provider.

Meanwhile, the Agents page successfully uses a table layout with rich statistics (total_tokens, total_cost, today_cost) that users find valuable for quick scanning.

## Goals / Non-Goals

**Goals:**
- Convert Provider page to table layout matching Agents page patterns
- Show aggregated usage statistics per provider (tokens, cost, today cost)
- Show how many agents are using each provider
- Add toggle to enable/disable providers
- Maintain existing functionality (add provider modal, provider detail links)

**Non-Goals:**
- Provider detail page redesign (out of scope)
- Real-time usage graphs (future enhancement)
- Provider-level budget limits (separate feature)

## Decisions

### Decision 1: API Endpoint Strategy

**Choice**: Extend existing `/api/providers` to include stats, rather than creating a new endpoint.

**Alternatives Considered**:
1. New `/api/providers/stats` endpoint - would require two API calls
2. Extend `/api/providers` - single call, backward compatible

**Rationale**: Single endpoint reduces network calls and complexity. The existing response can be extended with optional stats fields.

### Decision 2: Stats Query Approach

**Choice**: Aggregate from events table with LEFT JOIN to providers.

```sql
SELECT
  ps.provider,
  ps.active,
  COUNT(DISTINCT e.agent_id) as agent_count,
  COALESCE(SUM(e.input_tokens + e.output_tokens), 0) as total_tokens,
  COALESCE(SUM(e.cost), 0) as total_cost,
  COALESCE(SUM(CASE WHEN date(e.created_at) = date('now') THEN e.cost ELSE 0 END), 0) as today_cost
FROM provider_settings ps
LEFT JOIN events e ON e.provider = ps.provider
GROUP BY ps.provider
```

**Rationale**: Re-uses existing events table structure, consistent with how agent stats are calculated.

### Decision 3: Provider Toggle Behavior

**Choice**: Toggle updates `provider_settings.active` column, same as existing pattern.

**Rationale**: Leverages existing infrastructure. When a provider is disabled, proxy should reject requests to that provider.

## Risks / Trade-offs

**[Performance]** Aggregating stats for all providers could be slow with large event tables.
→ Mitigation: Use appropriate indices (already exist on events.provider). Consider caching if needed later.

**[UI Clutter]** Table might feel cramped with many providers.
→ Mitigation: Follow same column widths as Agents page, proven to work well.

**[Breaking Change]** Existing API consumers might not expect new fields.
→ Mitigation: New fields are additive only, existing fields unchanged.
