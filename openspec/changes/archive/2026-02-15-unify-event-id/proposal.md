## Why

Security events (`security_events.request_id`) and LLM events (`agent_events.id` / `event_payloads.event_id`) use different IDs, making it impossible to link security events to their payloads. Users who enable payload logging cannot view payloads for security events.

## What Changes

- Generate a single `eventId` at the start of each proxy request
- Use this same ID for `security_events.request_id`, `agent_events.id`, and `event_payloads.event_id`
- Dashboard can now fetch payloads for security events using `request_id`

## Capabilities

### New Capabilities

None - this is a refactoring of existing functionality.

### Modified Capabilities

None - no spec-level behavior changes, only internal ID correlation.

## Impact

- `packages/proxy/src/proxy-server.ts`: Rename `requestId` to `eventId`, generate earlier, pass through to metrics extraction
- Dashboard: Security event detail can query `/api/payloads/:eventId` using `request_id`
