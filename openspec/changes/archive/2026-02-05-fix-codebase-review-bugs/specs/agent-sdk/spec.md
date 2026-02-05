## MODIFIED Requirements

### Requirement: Automatic batching

The SDK SHALL flush events every 5 seconds OR when the buffer reaches 50 events. The buffer MUST have a hard cap of 5000 events. When the cap is reached and new events arrive, the SDK MUST log a warning indicating that events are being dropped and the current buffer size.

#### Scenario: Buffer cap reached with warning
- **WHEN** the internal buffer reaches MAX_BUFFER_CAP (5000 events)
- **AND** a new event is enqueued via `track()`, `heartbeat()`, `error()`, or `custom()`
- **THEN** the new event is discarded
- **AND** a warning is logged indicating events are being dropped due to buffer overflow
