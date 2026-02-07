# Provider Management Dashboard

## Problem
Currently, users can only manage providers via CLI (`agentgazer providers set/list`). There's no way to:
1. Verify if an API key is valid before saving
2. See provider connectivity status at a glance
3. View provider-specific usage and costs
4. Manage available models per provider

## Solution
Add a Providers page to the dashboard with:
1. **Providers List** — Shows all configured providers with connectivity status
2. **Provider Detail Page** — Shows models, usage stats, and costs for a single provider
3. **API Key Validation** — Test keys before saving (using free endpoints where possible)
4. **Model Management** — Add/test custom models per provider

## Scope
- Backend: New API routes for providers, validation, and stats
- Frontend: New Providers page and Provider Detail page
- CLI: Add validation when setting provider keys

## Out of Scope
- Modifying existing proxy behavior
- Provider-specific rate limit configuration (already exists in agent detail)
