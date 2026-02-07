## 1. API Layer

- [x] 1.1 Add `getProviderStats()` query to `packages/server/src/db.ts` that aggregates events by provider (agent_count, total_tokens, total_cost, today_cost)
- [x] 1.2 Update `GET /api/providers` route in `packages/server/src/routes/providers.ts` to include stats in response
- [x] 1.3 Add `PUT /api/providers/:name` route to toggle provider active status

## 2. Dashboard Updates

- [x] 2.1 Update `ProviderInfo` type in `apps/dashboard-local/src/lib/api.ts` to include new stats fields
- [x] 2.2 Rewrite `ProvidersPage.tsx` to use table layout with columns: Provider, Status toggle, Agents, Total Tokens, Total Cost, Today Cost
- [x] 2.3 Add usePolling hook to ProvidersPage for 3-second auto-refresh
- [x] 2.4 Add toggle handler that calls PUT `/api/providers/:name` and refreshes list
- [x] 2.5 Sort providers by total_cost descending (highest usage first)

## 3. Testing

- [x] 3.1 Manually verify provider stats display correctly with real data
- [x] 3.2 Verify toggle enables/disables provider and persists across refresh
