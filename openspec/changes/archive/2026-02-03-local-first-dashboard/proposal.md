## Why

AgentWatch currently requires Supabase (Auth, PostgreSQL, Realtime, Edge Functions) as its backend, meaning users must set up a cloud account before seeing any data. This creates high onboarding friction and contradicts the "privacy-first" positioning — the proxy keeps prompts local, but all metrics still flow to a third-party cloud. Rewriting as a local-first developer tool (`npx agentwatch`) removes the cloud dependency, drops onboarding to under 30 seconds, and keeps all data on the user's machine.

## What Changes

- **New unified CLI** (`npx agentwatch`): single command starts local API server, LLM proxy, and dashboard
- **New local API server** (Express + SQLite): replaces Supabase Edge Functions and PostgreSQL; stores all events, agents, alert rules, and alert history in a local SQLite database
- **New Vite + React dashboard**: replaces the Next.js + Supabase dashboard; pure client-side SPA served as static files by the local server; uses HTTP fetch + polling instead of Supabase Realtime
- **Token-based auth**: generates a local bearer token on first run; required for all API and dashboard access; stored in `~/.agentwatch/config.json`
- **SDK and Proxy unchanged**: existing `@agentwatch/sdk` and `@agentwatch/proxy` packages work as-is — only the `endpoint` parameter changes to `http://localhost:<port>/api/events`
- **`packages/shared` unchanged**: types, provider detection, pricing, parsers are fully backend-agnostic
- **BREAKING**: the Supabase-based dashboard (`apps/dashboard`) is not removed but is no longer the primary distribution path; the new `apps/dashboard-local` + `packages/server` + `packages/cli` become the default experience

## Capabilities

### New Capabilities
- `local-server`: Express HTTP server with SQLite storage, event ingestion API, query endpoints, agent lifecycle management, and alert evaluation
- `local-dashboard`: Vite + React single-page application for viewing agents, events, costs, and alerts — served as static files by the local server
- `local-auth`: Token-based authentication for the local server and dashboard — auto-generated token, bearer header validation, dashboard login gate
- `local-cli`: Unified CLI entry point that orchestrates server, proxy, and dashboard startup with a single command

### Modified Capabilities
<!-- No existing specs to modify — this is a greenfield local-first stack alongside the existing cloud stack -->

## Impact

- **New packages**: `packages/server`, `packages/cli`
- **New app**: `apps/dashboard-local`
- **Dependencies added**: `express`, `better-sqlite3`, `vite`, `react-router-dom`
- **Existing code untouched**: `packages/shared`, `packages/sdk`, `packages/proxy` remain as-is
- **Existing dashboard**: `apps/dashboard` (Supabase-based) stays for potential future cloud offering but is no longer the default
- **Monorepo**: new workspaces added to root `package.json` and `turbo.json`
