# Proposal: Test Coverage & Overview Fix

## Problem

1. **Overview shows empty data**: `top_agents` and `top_models` arrays are empty because queries only look at today's data. When today has no activity, the dashboard looks broken.

2. **Test coverage gaps**: Multiple packages lack adequate test coverage:
   - Server routes (settings, providers, rate-limits, overview)
   - Alert evaluator state machine (repeat, recovery)
   - Alert delivery mechanisms (email, telegram, webhook)
   - CLI commands (non-interactive parts)
   - Shared utilities (logger, provider-validator)

## Solution

### Overview Fix
- Change `getTopAgentsByCost` and `getTopModelsByTokens` to query last 7 days instead of just today
- Update CLI `overview` command to match the same 7-day window
- Add period label to UI ("Last 7 days")

### Test Coverage
Add ~120 automated tests covering:
- Server routes: settings, health, providers, rate-limits, overview
- Alert state machine: repeat_enabled, recovery_notify, state transitions
- Alert delivery: webhook (with retry), email (mocked nodemailer), telegram (mocked fetch)
- Shared: logger, provider-validator
- CLI: output formatting, API calls (mocked)

### Manual Test Checklist
Create a checklist for E2E scenarios requiring human verification:
- Email delivery (check inbox)
- Telegram delivery (check app)
- Webhook delivery (use webhook.site)
- Dashboard UI flows

## Scope

- In scope: Server, CLI, Shared packages
- Out of scope: Dashboard React components (no test framework set up)

## Success Criteria

- Overview shows meaningful data even when today is empty
- All new tests pass
- Test count increases by ~120
- E2E checklist documented
