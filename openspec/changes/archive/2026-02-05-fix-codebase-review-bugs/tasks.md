## 1. CLI Fixes

- [x] 1.1 Fix `resetToken()` in `packages/cli/src/config.ts` to read existing config and preserve providers before replacing the token
- [x] 1.2 Update `resetToken()` tests in `packages/cli/src/__tests__/config.test.ts` to verify providers survive a token reset
- [x] 1.3 Add `parsePositional()` helper in `packages/cli/src/cli.ts` that filters out `--flag value` pairs and returns remaining positional args
- [x] 1.4 Refactor `cmdStats` to use `parsePositional()` instead of raw `process.argv[3]` for agent ID extraction

## 2. API Contract Alignment

- [x] 2.1 Read `packages/server/src/routes/agents.ts` and `packages/server/src/routes/stats.ts` to confirm actual response shapes (server is source of truth)
- [x] 2.2 Fix dashboard TypeScript interfaces in `AgentsPage.tsx` and `OverviewPage.tsx` to match server's `/api/agents` response (verified: already correct)
- [x] 2.3 Fix dashboard TypeScript interface in `AgentDetailPage.tsx` to match server's `/api/stats/:agentId` response field names (verified: already correct)
- [x] 2.4 Fix CLI `StatsResponse`, `AgentRecord`, and `cmdAgents`/`cmdStats` in `cli.ts` to match server's actual response shapes

## 3. Auth Token Comparison

- [x] 3.1 Replace `===` token comparison with `crypto.timingSafeEqual()` in `packages/server/src/middleware/auth.ts`, handling different-length strings safely

## 4. SDK Buffer Warning

- [x] 4.1 Add a warning log in `packages/sdk/src/agent-trace.ts` when an event is dropped due to `MAX_BUFFER_CAP` overflow

## 5. Secret Store Constant

- [x] 5.1 Replace local `const SERVICE` with imported `PROVIDER_SERVICE` in `migrateFromPlaintextConfig` in `packages/cli/src/secret-store.ts`

## 6. Supabase Ingest Tests

- [x] 6.1 Fix all test assertions in `supabase/functions/ingest/ingest_test.ts` to check `json.status === "ok"` instead of `json.success`

## 7. Verification

- [x] 7.1 Run `npm test` across all packages and verify all tests pass
- [x] 7.2 Run `npm run build` to verify no TypeScript compilation errors (all 6 code packages pass; docs fails on pre-existing dead links, unrelated)
