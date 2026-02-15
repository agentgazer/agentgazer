## Tasks

### 1. Unify eventId in proxy-server.ts

- [x] 1.1 Rename `requestId` to `eventId` at line ~1807
- [x] 1.2 Pass `eventId` to streaming metrics extraction (line ~2616)
- [x] 1.3 Pass `eventId` to non-streaming metrics extraction (line ~2750)
- [x] 1.4 Verify `eventId` is passed to `archivePayload` calls (already using eventId)
- [x] 1.5 Update response security check to use same `eventId` (line ~2717)

### 2. Verify integration

- [x] 2.1 Run existing tests to ensure no regressions
- [x] 2.2 Manual test: trigger security event, verify `request_id` matches payload `event_id`
