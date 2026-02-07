## Why

The current Provider page uses a card-based layout that doesn't show usage statistics. Users cannot quickly see how much each provider is being used (tokens, cost) at a glance. This inconsistency with the Agents page (which uses a table with stats) makes the dashboard feel fragmented.

## What Changes

- Convert Provider page from card layout to list/table view matching Agents page style
- Add columns: Provider, Status (toggle), Agents Using, Total Tokens, Total Cost, Today Cost
- Add new API endpoint or extend `/api/providers` to return provider-level aggregated stats
- Add provider enable/disable toggle (sets all provider settings to disabled state)

## Capabilities

### New Capabilities
- `provider-stats-api`: New API endpoint to aggregate provider-level statistics (tokens, cost, agent count)

### Modified Capabilities
- `local-dashboard`: Add provider list view with stats table, reusing patterns from AgentsPage

## Impact

- **API**: New or extended `/api/providers/stats` endpoint with aggregated metrics
- **Dashboard**: `ProvidersPage.tsx` rewrite from cards to table
- **Server**: New query to aggregate events by provider
