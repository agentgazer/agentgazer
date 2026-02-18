## 1. Fix security_blocked CHECK Constraint

- [ ] 1.1 Add `security_blocked` and `security_event` to `agent_events.event_type` CHECK constraint in DB migration
- [ ] 1.2 Update `runMigrations()` to detect and apply the new constraint
- [ ] 1.3 Add test: inserting `security_blocked` event type should succeed
- [ ] 1.4 Add test: inserting invalid event type should fail

## 2. Fix Proxy URL Default

- [ ] 2.1 Change `AGENTGAZER_PROXY_URL` default from `http://127.0.0.1:4000` to `http://127.0.0.1:18900` in `packages/server/src/routes/agents.ts`
- [ ] 2.2 Add test: agent reactivation should call correct proxy URL to clear loop detector window

## 3. Fix Timezone Inconsistency

- [ ] 3.1 Update `getDailySpend()` in `db.ts` to use UTC (`setUTCHours`) instead of local time
- [ ] 3.2 Audit all other date calculations in `db.ts` for consistent UTC usage
- [ ] 3.3 Add test: `getDailySpend` returns correct value regardless of server timezone
- [ ] 3.4 Update `allowed_hours` check in proxy to document whether it uses local or UTC time

## 4. Verification

- [ ] 4.1 Run full test suite to ensure no regressions
- [ ] 4.2 Manual test: trigger security block and verify event appears in logs
