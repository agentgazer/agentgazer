## 1. API Layer

- [x] 1.1 Add `getOverviewStats()` query to `db.ts` returning active_agents, today_cost, today_requests, error_rate with yesterday comparisons
- [x] 1.2 Add `getTopAgentsByCost()` query returning top 5 agents with cost and percentage
- [x] 1.3 Add `getTopModelsByTokens()` query returning top 5 models with tokens and percentage
- [x] 1.4 Add `getDailyTrends()` query returning 7-day cost and requests trends
- [x] 1.5 Add `getRecentEvents()` query returning kill_switch, budget_warning, high_error_rate, new_agent events
- [x] 1.6 Create `GET /api/overview` route combining all overview data
- [x] 1.7 Create `GET /api/events/recent` route for events timeline

## 2. Dashboard Components

- [x] 2.1 Create `SummaryCard` component with value, trend percentage, and optional warning state
- [x] 2.2 Create `RecentEventsTimeline` component with color-coded event entries
- [x] 2.3 Create `TopRankingChart` component with horizontal bar visualization
- [x] 2.4 Create `TrendChart` component wrapping Recharts AreaChart

## 3. Overview Page

- [x] 3.1 Add overview types to `api.ts` (OverviewData, RecentEvent, etc.)
- [x] 3.2 Rewrite `OverviewPage.tsx` with new layout: summary cards, events + rankings, trend charts
- [x] 3.3 Add usePolling hook for 3-second auto-refresh
- [x] 3.4 Handle loading and error states for each section independently

## 4. Testing

- [x] 4.1 Manually verify overview stats display correctly
- [x] 4.2 Verify trend charts render with real data
- [x] 4.3 Verify recent events show appropriate event types
