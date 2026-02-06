## Why

Full codebase review revealed 8 bugs across CLI, SDK, server, dashboard, and Supabase functions. These include data loss on token reset, API contract mismatches between frontend and backend, fragile argument parsing, and silent data drops. Fixing these now prevents user-facing breakage and data integrity issues before the first public release.

## What Changes

- **resetToken() preserves existing config**: Read existing config before overwriting so provider settings (rate limits etc.) survive a token reset
- **Supabase ingest tests check correct field**: Tests check `status === "ok"` instead of nonexistent `success` field
- **CLI cmdStats argument parsing**: Properly separate positional args from flags so `agentgazer stats --port 9090 my-agent` works correctly
- **Dashboard/Server API response format alignment**: Ensure `/api/agents` response shape matches what both CLI and dashboard expect
- **CLI/Dashboard stats field name alignment**: Unify field names for `/api/stats/:agentId` so CLI and dashboard use the same contract
- **Auth token constant-time comparison**: Use `crypto.timingSafeEqual()` instead of `===` for token verification
- **SDK EventBuffer warns on cap overflow**: Log a warning when events are dropped due to buffer cap, so users know data is being lost
- **Secret store migration uses exported constant**: Replace local `SERVICE` constant with the exported `PROVIDER_SERVICE`

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `local-cli`: resetToken must preserve existing providers; cmdStats must correctly parse positional agent ID when flags are present
- `event-ingestion`: Supabase ingest test assertions must match actual response shape (`status` not `success`)
- `agent-sdk`: EventBuffer must warn (via logger) when events are dropped at MAX_BUFFER_CAP
- `secret-store`: migrateFromPlaintextConfig must use the exported PROVIDER_SERVICE constant
- `local-auth`: Token comparison must use constant-time algorithm
- `dashboard`: Stats page and agents page must use field names that match the server's actual response

## Impact

- **packages/cli/src/config.ts** — resetToken() logic change
- **packages/cli/src/cli.ts** — cmdStats argument parsing
- **packages/server/src/middleware/auth.ts** — token comparison
- **packages/server/src/routes/agents.ts** — response shape contract
- **packages/server/src/routes/stats.ts** — response field names contract
- **packages/sdk/src/agent-trace.ts** — buffer overflow warning
- **packages/cli/src/secret-store.ts** — constant reference
- **supabase/functions/ingest/ingest_test.ts** — test assertions
- **apps/dashboard-local/src/pages/** — AgentsPage, OverviewPage, AgentDetailPage type interfaces
- No breaking API changes — all fixes align existing code to intended contracts
