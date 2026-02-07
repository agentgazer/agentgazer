## Why

The current Overview page is essentially a duplicate of the Agents list, providing no unique value as a "dashboard". Users need a comprehensive at-a-glance view showing system health, trends, top consumers, and recent important events to effectively monitor their AI agents.

## What Changes

- Redesign Overview page as a comprehensive dashboard with multiple information-rich sections
- Add Summary Cards with trend comparison (vs yesterday): Active Agents, Today's Cost, Requests/24h, Error Rate
- Add Recent Events timeline showing kill switch triggers, budget warnings, high error rates, new agents
- Add TOP AGENTS section showing agents ranked by cost with visual bar chart
- Add TOP MODELS section showing models ranked by token usage with visual bar chart
- Add dual 7-day trend charts for Cost and Requests
- Create new API endpoints for overview statistics, recent events, and trend data

## Capabilities

### New Capabilities
- `overview-api`: New API endpoints for overview dashboard data (stats, trends, recent events, top agents, top models)

### Modified Capabilities
- `local-dashboard`: Redesign Overview page with new dashboard layout and components

## Impact

- **API**: New `/api/overview` endpoint with aggregated stats, trends, and rankings
- **API**: New `/api/events/recent` endpoint for system events timeline
- **Dashboard**: Complete rewrite of `OverviewPage.tsx`
- **Dashboard**: New chart components for trend visualization
- **Server**: New queries for trend calculation, top agents/models ranking
