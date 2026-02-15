## Design: Unify Event ID

### Current Flow

```
Request arrives
    │
    ▼
requestId = crypto.randomUUID()  ← Generated here
    │
    ▼
securityFilter.checkRequest(agentId, body, requestId)
    │                                    │
    │                              security_events
    │                              (request_id = requestId)
    ▼
LLM Call
    │
    ▼
eventId = crypto.randomUUID()  ← Generated here (DIFFERENT ID)
    │
    ├──► agent_events (id = eventId)
    └──► event_payloads (event_id = eventId)
```

### New Flow

```
Request arrives
    │
    ▼
eventId = crypto.randomUUID()  ← Single ID generated early
    │
    ├──► securityFilter.checkRequest(agentId, body, eventId)
    │         │
    │         └──► security_events (request_id = eventId)
    │
    ▼
LLM Call
    │
    ▼
    ├──► agent_events (id = eventId)  ← Same ID
    └──► event_payloads (event_id = eventId)  ← Same ID
```

### Changes

1. **proxy-server.ts**:
   - Rename `requestId` variable to `eventId`
   - Move generation to before security check (already there)
   - Pass `eventId` to `extractStreamingMetrics` and `extractAndQueueMetrics`
   - Pass `eventId` to `archivePayload`

2. **No schema changes needed** - `security_events.request_id` will now just happen to match `event_payloads.event_id`

### Edge Cases

- **Blocked requests**: If security blocks the request, no `agent_events` or `event_payloads` record exists. The `security_events.request_id` will be an orphan ID. This is acceptable - we can still store the blocked request payload if needed in future.
