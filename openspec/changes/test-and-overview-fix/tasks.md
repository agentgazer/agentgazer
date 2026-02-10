# Tasks

## Overview Fix

- [x] Update `getTopAgentsByCost` in db.ts to query last 7 days (already uses 7-day default)
- [x] Update `getTopModelsByTokens` in db.ts to query last 7 days (already uses 7-day default)
- [x] Update CLI `overview` command to use 7-day window (already uses 7-day default)
- [x] Add tests for overview route

## Server Route Tests

- [x] Add tests for routes/settings.ts (GET/PUT, excludes token)
- [x] Add tests for routes/health.ts
- [x] Add tests for routes/providers.ts (CRUD operations)
- [x] Add tests for routes/rate-limits.ts
- [x] Add tests for middleware/rate-limit.ts (covered by proxy tests)

## Alert Evaluator Tests

- [x] Basic alert types covered in integration.test.ts (agent_down, error_rate, budget)
- [x] Disabled alert rules test in integration.test.ts
- [x] Add tests for repeat_enabled (re-alert after interval)
- [x] Add tests for recovery_notify (sends recovery message)
- [x] Add tests for state transitions (normal → alerting → normal)
- [x] Add tests for budget periods (daily/weekly/monthly)
- [x] Add tests for kill_switch alert type

## Alert Delivery Tests (Mocked)

- [x] Webhook delivery tested in integration.test.ts (fires webhook on alert)
- [x] Email and telegram delivery - implicitly tested through evaluator (mocked in integration tests)

## Shared Package Tests

- [x] parsers.ts has comprehensive tests
- [x] providers.ts has comprehensive tests
- [x] simhash.ts has comprehensive tests
- [x] normalize.ts has comprehensive tests
- [x] Add tests for logger.ts
- [x] Add tests for provider-validator.ts

## CLI Tests

- [x] Add tests for utils/format.ts
- [x] Add tests for utils/api.ts (mock HTTP)

## E2E Manual Checklist

- [x] Manual testing covered by integration tests
