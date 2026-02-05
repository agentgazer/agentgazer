## MODIFIED Requirements

### Requirement: Response format with event IDs

The Supabase ingest function SHALL return `{ status: "ok", results, event_ids }` on success. Integration tests MUST assert on `status === "ok"` and verify the `event_ids` array, not a nonexistent `success` field.

#### Scenario: Single valid event test assertion
- **WHEN** a single valid event is POSTed to the ingest function
- **THEN** the response status code is 200
- **AND** the response body contains `status` equal to `"ok"`
- **AND** the response body contains an `event_ids` array with 1 entry

#### Scenario: Batch events test assertion
- **WHEN** a batch of N valid events is POSTed
- **THEN** the response body contains `status` equal to `"ok"`
- **AND** the `event_ids` array has N entries
