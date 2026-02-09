# Tasks

## Overview Fix

- [ ] Update `getTopAgentsByCost` in db.ts to query last 7 days
- [ ] Update `getTopModelsByTokens` in db.ts to query last 7 days
- [ ] Update CLI `overview` command to use 7-day window
- [ ] Add tests for overview route

## Server Route Tests

- [ ] Add tests for routes/settings.ts (GET/PUT, excludes token)
- [ ] Add tests for routes/health.ts
- [ ] Add tests for routes/providers.ts (CRUD operations)
- [ ] Add tests for routes/rate-limits.ts
- [ ] Add tests for middleware/rate-limit.ts

## Alert Evaluator Tests

- [ ] Add tests for repeat_enabled (re-alert after interval)
- [ ] Add tests for recovery_notify (sends recovery message)
- [ ] Add tests for state transitions (normal → alerting → normal)
- [ ] Add tests for budget periods (daily/weekly/monthly)
- [ ] Add tests for kill_switch alert type

## Alert Delivery Tests (Mocked)

- [ ] Add tests for webhook delivery with retry
- [ ] Add tests for email delivery (mock nodemailer)
- [ ] Add tests for telegram delivery (mock fetch)

## Shared Package Tests

- [ ] Add tests for logger.ts
- [ ] Add tests for provider-validator.ts

## CLI Tests

- [ ] Add tests for utils/format.ts
- [ ] Add tests for utils/api.ts (mock HTTP)

## E2E Manual Checklist

- [ ] Create manual-test-checklist.md with scenarios requiring human verification
