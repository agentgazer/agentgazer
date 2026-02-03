## Context

AgentWatch is currently a Supabase-dependent stack: Next.js dashboard + Supabase Auth/DB/Realtime/Edge Functions. The SDK and Proxy already communicate via plain HTTP POST, making the backend swappable. The goal is to build a parallel local-first stack that lets developers run `npx agentwatch` and have a fully functional observability dashboard on localhost with zero cloud dependencies.

Existing packages that are 100% reusable without modification:
- `packages/shared` — types (Zod schemas), provider detection, pricing tables, response parsers
- `packages/sdk` — event buffering and HTTP POST to configurable endpoint
- `packages/proxy` — LLM request interception, metric extraction, event buffering to configurable endpoint

The Supabase-based dashboard (`apps/dashboard`) remains in the repo for a potential future cloud offering.

## Goals / Non-Goals

**Goals:**
- Single command (`npx agentwatch`) starts everything: API server, LLM proxy, dashboard
- All data stored locally in SQLite at `~/.agentwatch/data.db`
- Token-based auth protecting all endpoints (auto-generated on first run)
- Dashboard feature parity with current Supabase dashboard: agent list, agent detail (stats, charts, cost breakdown), cost overview, alerts management
- SDK and Proxy work unchanged — only `endpoint` URL differs

**Non-Goals:**
- Realtime WebSocket/SSE push (polling is sufficient for local dev use)
- Multi-user / multi-tenant support (single user, single token)
- Email-based alert delivery (webhook only for local version)
- Migrating data from Supabase to local or vice versa
- Removing the existing Supabase-based dashboard

## Decisions

### D1: Vite + React for dashboard (not Next.js static export)

**Choice**: Build a new SPA in `apps/dashboard-local` using Vite + React + React Router.

**Alternatives considered**:
- *Next.js `output: "export"`*: Too many limitations (no middleware, no server components, no API routes). Would require extensive workarounds.
- *Next.js standalone*: Running a full Next.js server inside `npx agentwatch` is heavy and slow to start.

**Rationale**: Vite produces static files that Express can serve directly. Fast build, fast startup, small bundle. The existing React components (charts, cards, tables) can be ported with minimal changes — only the data-fetching layer changes (Supabase client → `fetch()`).

### D2: Express + better-sqlite3 for local server

**Choice**: `packages/server` uses Express for HTTP and `better-sqlite3` for synchronous SQLite access.

**Alternatives considered**:
- *Fastify*: Slightly faster but less ecosystem familiarity, marginal benefit for local dev tool.
- *Drizzle/Prisma ORM*: Adds complexity. Raw SQL with better-sqlite3 is simpler for 5 tables and direct for this use case.

**Rationale**: Express is the most familiar Node.js HTTP framework. `better-sqlite3` is synchronous (no async overhead), fast, and zero-config. SQLite is a single file — no database server to install or manage.

### D3: Token-based auth with auto-generation

**Choice**: On first run, generate a random token, store in `~/.agentwatch/config.json`, print to terminal. All API requests require `Authorization: Bearer <token>`. Dashboard serves a login page that accepts the token and stores it in localStorage.

**Alternatives considered**:
- *No auth*: Risky if someone binds to `0.0.0.0` or is on a shared network.
- *Username/password*: Overkill for a local tool.
- *mTLS*: Way too complex for developer tooling.

**Rationale**: A single bearer token is simple, sufficient for local security, and compatible with existing SDK/Proxy `Authorization: Bearer` header pattern. The token doubles as the API key for SDK/Proxy configuration.

### D4: Polling for data refresh (not Realtime)

**Choice**: Dashboard components poll their respective API endpoints every 3 seconds when the tab is active. Use `visibilitychange` to pause polling when tab is hidden.

**Alternatives considered**:
- *Server-Sent Events (SSE)*: Adds server complexity, marginal benefit for local dev.
- *WebSocket*: Overkill.

**Rationale**: For a local dashboard with single-digit millisecond latency to localhost, 3-second polling is indistinguishable from "real-time" in practice. Much simpler to implement and debug.

### D5: Database schema mirrors Supabase but simplified

**Choice**: Same 5 tables (`api_keys` removed, replaced by single token config; `agents`, `agent_events`, `alert_rules`, `alert_history` kept). No RLS (single user). No `user_id` column (implicit single user).

**Rationale**: Keeps the data model familiar. Alert rules and history still function the same way. Removing `user_id` and RLS simplifies every query.

### D6: Unified CLI orchestrates all processes

**Choice**: `packages/cli` exports a single bin (`agentwatch`) that:
1. Ensures `~/.agentwatch/` exists with config and DB
2. Starts the Express server (API + static dashboard)
3. Starts the LLM proxy (reuses `startProxy()` from `packages/proxy`)
4. Prints token + URLs to terminal
5. Handles SIGINT/SIGTERM for graceful shutdown of both

**Rationale**: One process, one command. No docker, no multiple terminals. The proxy and server run in the same Node.js process.

### D7: Monorepo structure

```
packages/server/       # Express + SQLite + API routes
  src/
    db.ts              # SQLite schema init + query helpers
    server.ts          # Express app factory
    routes/
      events.ts        # POST /api/events (ingest), GET /api/events (query)
      agents.ts        # GET /api/agents, GET /api/agents/:id
      stats.ts         # GET /api/stats/:agentId
      alerts.ts        # CRUD /api/alerts, GET /api/alert-history
      auth.ts          # POST /api/auth/verify

packages/cli/          # Unified entry point
  src/
    cli.ts             # Parse args, init config, start server + proxy
    config.ts          # ~/.agentwatch/ management

apps/dashboard-local/  # Vite + React SPA
  src/
    main.tsx           # Entry point
    App.tsx            # Router
    lib/api.ts         # fetch wrapper with auth token
    hooks/usePolling.ts # Generic polling hook
    pages/             # Route pages
    components/        # Ported UI components
```

## Risks / Trade-offs

**[Risk] SQLite write contention under heavy event load** → Single-writer SQLite handles thousands of writes/sec with WAL mode. For local dev tool with a few agents, this is not a realistic concern. Enable WAL mode on init.

**[Risk] Dashboard bundle size with Vite** → Tailwind CSS purge + code splitting keeps bundle small. Target < 500KB gzipped.

**[Risk] Maintaining two dashboards (Supabase + local)** → Accept this for now. The local dashboard is the primary product. The Supabase dashboard can be deprecated or extracted later if a cloud offering materializes.

**[Risk] Token leaked in terminal output** → Acceptable for local dev tool. User can regenerate with `agentwatch token --reset`. Token is only valid for localhost.

**[Trade-off] No email alerts in local version** → Webhook-only. Users can use webhook-to-email bridges if needed. Keeps dependencies minimal.

**[Trade-off] Polling vs push** → 3-second polling adds minor latency. Acceptable for dev tool. Can add SSE later if demand exists.

## Open Questions

- Should `npx agentwatch` auto-open the browser? (Leaning yes, with `--no-open` flag)
- Data retention policy? (Leaning: keep all data, user can manually delete `~/.agentwatch/data.db`)
