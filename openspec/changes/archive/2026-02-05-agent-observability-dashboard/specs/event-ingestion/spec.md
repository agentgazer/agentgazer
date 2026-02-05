## ADDED Requirements

### Requirement: POST /api/events endpoint

The system SHALL expose a `POST /api/events` endpoint that accepts AgentEvent payloads. The endpoint MUST accept a JSON request body conforming to the AgentEvent schema and MUST return a JSON response containing the assigned event ID(s) for confirmation.

#### Scenario: Single event ingestion

WHEN a client sends a POST request to `/api/events` with a valid AgentEvent JSON body containing `agent_id`, `event_type`, and `timestamp`
THEN the server MUST respond with HTTP 200 and a JSON body containing the assigned `event_id` for the ingested event.

#### Scenario: Malformed JSON body

WHEN a client sends a POST request to `/api/events` with a body that is not valid JSON
THEN the server MUST respond with HTTP 400 and a JSON error body describing the parse failure.

### Requirement: Event validation

The system SHALL validate every incoming event. The fields `agent_id`, `event_type`, and `timestamp` are required on every AgentEvent. The server MUST reject events missing any of these fields with an HTTP 400 response that identifies which fields are missing.

#### Scenario: Missing required field agent_id

WHEN a client sends a POST request to `/api/events` with a JSON body that includes `event_type` and `timestamp` but omits `agent_id`
THEN the server MUST respond with HTTP 400 and the error response MUST indicate that `agent_id` is required.

#### Scenario: Missing required field event_type

WHEN a client sends a POST request to `/api/events` with a JSON body that includes `agent_id` and `timestamp` but omits `event_type`
THEN the server MUST respond with HTTP 400 and the error response MUST indicate that `event_type` is required.

#### Scenario: Missing required field timestamp

WHEN a client sends a POST request to `/api/events` with a JSON body that includes `agent_id` and `event_type` but omits `timestamp`
THEN the server MUST respond with HTTP 400 and the error response MUST indicate that `timestamp` is required.

#### Scenario: All required fields present

WHEN a client sends a POST request to `/api/events` with a JSON body containing valid `agent_id`, `event_type`, and `timestamp`
THEN the server MUST accept the event and respond with HTTP 200.

### Requirement: API key authentication

The system SHALL authenticate every request to the ingest API using an API key. Each user MUST be issued an API key, and all requests MUST include the API key in the `Authorization` header (as `Bearer <api_key>`). Requests with a missing or invalid API key MUST be rejected with HTTP 401.

#### Scenario: Valid API key

WHEN a client sends a POST request to `/api/events` with a valid API key in the `Authorization: Bearer <api_key>` header
THEN the server MUST authenticate the request and process the event.

#### Scenario: Missing API key

WHEN a client sends a POST request to `/api/events` without an `Authorization` header
THEN the server MUST respond with HTTP 401 and a JSON error body indicating that authentication is required.

#### Scenario: Invalid API key

WHEN a client sends a POST request to `/api/events` with an `Authorization: Bearer <api_key>` header containing an unrecognized key
THEN the server MUST respond with HTTP 401 and a JSON error body indicating that the API key is invalid.

### Requirement: Batch event support

The system SHALL accept an array of AgentEvent objects in a single POST request to `/api/events`. When a batch is submitted, the server MUST validate each event individually and MUST return a response containing an event ID for each successfully ingested event. If any event in the batch fails validation, the server MUST still ingest the valid events and report per-event success/failure in the response.

#### Scenario: Batch of valid events

WHEN a client sends a POST request to `/api/events` with a JSON array containing 3 valid AgentEvent objects
THEN the server MUST respond with HTTP 200 and a JSON body containing 3 assigned event IDs, one per ingested event.

#### Scenario: Batch with partial validation failure

WHEN a client sends a POST request to `/api/events` with a JSON array of 3 events where 1 event is missing `agent_id`
THEN the server MUST ingest the 2 valid events, return their event IDs, and include an error entry for the invalid event indicating the missing field.

### Requirement: Event types

The system SHALL support the following event types: `completion`, `error`, `heartbeat`, and `custom`. The `event_type` field on every AgentEvent MUST be one of these values. Events with an unrecognized `event_type` MUST be rejected with HTTP 400.

#### Scenario: Recognized event type

WHEN a client sends an event with `event_type` set to `completion`
THEN the server MUST accept the event.

#### Scenario: Unrecognized event type

WHEN a client sends an event with `event_type` set to `unknown_type`
THEN the server MUST respond with HTTP 400 and the error response MUST indicate that the event type is not recognized.

#### Scenario: Each supported event type accepted

WHEN a client sends individual events with `event_type` set to `completion`, `error`, `heartbeat`, and `custom` respectively
THEN the server MUST accept all four events.

### Requirement: Rate limiting

The system SHALL enforce rate limiting of 1000 events per minute per API key. When a client exceeds this limit, subsequent requests MUST be rejected with HTTP 429 (Too Many Requests) until the rate window resets. The response MUST include a `Retry-After` header indicating when the client may retry.

#### Scenario: Within rate limit

WHEN a client sends 500 events within a 1-minute window using a single API key
THEN the server MUST accept all events.

#### Scenario: Exceeding rate limit

WHEN a client sends 1001 events within a 1-minute window using a single API key
THEN the server MUST reject the 1001st request with HTTP 429 and the response MUST include a `Retry-After` header.

#### Scenario: Rate limit resets after window

WHEN a client has been rate-limited and waits until the rate window resets
THEN the server MUST accept new events from that API key.

### Requirement: Response format with event IDs

The system SHALL return a JSON response body for every successful ingestion. For a single event, the response MUST contain the field `event_id` with a unique identifier. For a batch, the response MUST contain a `results` array where each entry includes an `event_id` on success or an `error` message on validation failure. The response MUST always include a top-level `status` field.

#### Scenario: Single event response format

WHEN a client sends a single valid event to `/api/events`
THEN the response body MUST be a JSON object with `status` set to `"ok"` and an `event_id` string field.

#### Scenario: Batch event response format

WHEN a client sends a batch of 3 valid events to `/api/events`
THEN the response body MUST be a JSON object with `status` set to `"ok"` and a `results` array of 3 objects, each containing an `event_id` string field.
