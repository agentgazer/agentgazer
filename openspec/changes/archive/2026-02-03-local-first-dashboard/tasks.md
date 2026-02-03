## 1. Project scaffolding

- [x] 1.1 Create `packages/server/` with `package.json` (express, better-sqlite3, cors), `tsconfig.json`, and src directory structure (`src/db.ts`, `src/server.ts`, `src/routes/`)
- [x] 1.2 Create `packages/cli/` with `package.json` (bin: `agentwatch`), `tsconfig.json`, and src directory structure (`src/cli.ts`, `src/config.ts`)
- [x] 1.3 Create `apps/dashboard-local/` with Vite + React + TypeScript + Tailwind CSS + React Router scaffold
- [x] 1.4 Add new workspaces to root `package.json` and configure `turbo.json` build pipeline

## 2. Local server — database layer

- [x] 2.1 Implement `packages/server/src/db.ts`: SQLite initialization with WAL mode, schema creation (agents, agent_events, alert_rules, alert_history tables without user_id), migration check, query helper functions
- [x] 2.2 Write unit tests for database initialization and schema creation

## 3. Local server — auth middleware

- [x] 3.1 Implement auth middleware in `packages/server/src/middleware/auth.ts`: validate `Authorization: Bearer` or `x-api-key` header against configured token, skip for `/api/health` and `/api/auth/verify`
- [x] 3.2 Implement `POST /api/auth/verify` endpoint in `packages/server/src/routes/auth.ts`
- [x] 3.3 Write tests for auth middleware (valid token, invalid token, missing header, health check bypass, x-api-key alias)

## 4. Local server — event ingestion

- [x] 4.1 Implement `POST /api/events` in `packages/server/src/routes/events.ts`: parse batch or single event, validate each event (reuse validation logic from shared types), insert valid events, upsert agents, handle heartbeats, return per-event results with 200/207
- [x] 4.2 Write tests for event ingestion (batch, single, partial failure, heartbeat updates agent status, invalid events rejected)

## 5. Local server — query endpoints

- [x] 5.1 Implement `GET /api/agents` and `GET /api/agents/:agentId` in `packages/server/src/routes/agents.ts`
- [x] 5.2 Implement `GET /api/events` with query params (agent_id, from, to, event_type, limit) in `packages/server/src/routes/events.ts`
- [x] 5.3 Implement `GET /api/stats/:agentId` with range support and pre-aggregated stats (totals, percentiles, cost breakdown, token time-series) in `packages/server/src/routes/stats.ts`
- [x] 5.4 Implement `GET /api/health` (no auth) in `packages/server/src/routes/health.ts`
- [x] 5.5 Write tests for all query endpoints

## 6. Local server — alerts

- [x] 6.1 Implement alert CRUD: `GET /api/alerts`, `POST /api/alerts`, `PUT /api/alerts/:id`, `DELETE /api/alerts/:id`, `PATCH /api/alerts/:id/toggle` in `packages/server/src/routes/alerts.ts`
- [x] 6.2 Implement `GET /api/alert-history` in `packages/server/src/routes/alerts.ts`
- [x] 6.3 Implement alert evaluation loop in `packages/server/src/alerts/evaluator.ts`: 60-second interval, evaluate agent_down/error_rate/budget rules, webhook delivery, cooldown tracking, alert_history insert
- [x] 6.4 Write tests for alert CRUD and evaluation logic

## 7. Local server — static file serving and Express app assembly

- [x] 7.1 Implement `packages/server/src/server.ts`: Express app factory that mounts all routes, auth middleware, CORS, static file serving for dashboard, SPA fallback (non-API routes → index.html)
- [x] 7.2 Export `createServer(options)` and `startServer(options)` from package entry point

## 8. CLI — config and startup

- [x] 8.1 Implement `packages/cli/src/config.ts`: ensure `~/.agentwatch/` exists, read/write `config.json`, generate random token on first run
- [x] 8.2 Implement `packages/cli/src/cli.ts`: parse args (`--port`, `--proxy-port`, `--no-open`, `--reset-token`, `--help`), init config, start server (from `packages/server`), start proxy (from `packages/proxy`), print URLs and token, handle SIGINT/SIGTERM graceful shutdown
- [x] 8.3 Implement auto-open browser using `open` package (or `child_process` exec for platform-specific open)
- [x] 8.4 Write tests for config management (first run, subsequent run, token reset)

## 9. Dashboard — shell and auth

- [x] 9.1 Set up `apps/dashboard-local/src/main.tsx` entry point, `App.tsx` with React Router, Tailwind CSS config
- [x] 9.2 Implement `src/lib/api.ts`: fetch wrapper that injects `Authorization: Bearer` from localStorage, handles 401 by redirecting to login
- [x] 9.3 Implement `src/hooks/usePolling.ts`: generic polling hook with configurable interval, `visibilitychange` pause/resume
- [x] 9.4 Implement `/login` page: token input, verify via `POST /api/auth/verify`, store in localStorage, redirect to `/`
- [x] 9.5 Implement auth guard component: check localStorage for token, redirect to `/login` if missing

## 10. Dashboard — layout and navigation

- [x] 10.1 Implement sidebar layout with navigation links (Overview, Agents, Costs, Alerts), active state highlighting, logout button, dark theme
- [x] 10.2 Implement loading spinner and error banner components (reusable)

## 11. Dashboard — pages

- [x] 11.1 Implement overview page (`/`): fetch `GET /api/agents`, display agents grid with status indicators
- [x] 11.2 Implement agents list page (`/agents`): table with agent_id, status, last heartbeat, clickable rows linking to detail
- [x] 11.3 Implement agent detail page (`/agents/:agentId`): time range selector, stats cards (7 metrics), token chart, cost breakdown — all fetching from `GET /api/stats/:agentId`
- [x] 11.4 Implement costs page (`/costs`): fetch events, aggregate by agent and model, display cost breakdown tables
- [x] 11.5 Implement alerts page (`/alerts`): Rules tab with list/toggle/edit/delete/create, History tab with delivery log table, alert form modal/page

## 12. Dashboard — build and integration

- [x] 12.1 Configure Vite build to output to `dist/` directory, verify `packages/server` can serve these static files
- [x] 12.2 Add build step in `packages/cli` or `turbo.json` so `npm run build` produces the dashboard dist and server dist together

## 13. End-to-end integration testing

- [x] 13.1 Write integration test: start CLI, send events via SDK pointed to local endpoint, verify events appear in dashboard API responses
- [x] 13.2 Write integration test: start CLI with proxy, make a mock LLM request through proxy, verify metrics extracted and stored
- [x] 13.3 Verify alert evaluation fires webhook when conditions met
