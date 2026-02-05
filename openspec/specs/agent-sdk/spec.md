## ADDED Requirements

### Requirement: SDK initialization

The SDK SHALL export an `AgentTrace.init()` function that accepts a configuration object with the following properties: `apiKey` (required string), `agentId` (required string), and `endpoint` (optional string). The function MUST return a `watch` instance that exposes the `track`, `heartbeat`, and `error` methods. If `apiKey` or `agentId` is missing, `init()` MUST throw a descriptive error.

#### Scenario: Successful initialization

WHEN a developer calls `AgentTrace.init({ apiKey: "ak_test123", agentId: "bot-1" })`
THEN the function MUST return a `watch` instance with `track`, `heartbeat`, and `error` methods available.

#### Scenario: Initialization with custom endpoint

WHEN a developer calls `AgentTrace.init({ apiKey: "ak_test123", agentId: "bot-1", endpoint: "http://localhost:4000" })`
THEN the SDK MUST send all subsequent events to `http://localhost:4000` instead of the default cloud API.

#### Scenario: Initialization with missing apiKey

WHEN a developer calls `AgentTrace.init({ agentId: "bot-1" })` without providing `apiKey`
THEN the function MUST throw an error indicating that `apiKey` is required.

#### Scenario: Initialization with missing agentId

WHEN a developer calls `AgentTrace.init({ apiKey: "ak_test123" })` without providing `agentId`
THEN the function MUST throw an error indicating that `agentId` is required.

### Requirement: Manual tracking via watch.track()

The SDK SHALL provide a `watch.track()` method that accepts an object with the following fields: `provider` (required string), `model` (required string), `tokens` (required number), `latency_ms` (required number), `status` (required string), and `tags` (optional object of key-value string pairs). Calling `track()` MUST enqueue a `completion` event in the internal buffer for delivery to the ingest API.

#### Scenario: Track a completion event

WHEN a developer calls `watch.track({ provider: "openai", model: "gpt-4", tokens: 1500, latency_ms: 820, status: "success" })`
THEN the SDK MUST enqueue an event of type `completion` with the provided fields into its internal buffer.

#### Scenario: Track with optional tags

WHEN a developer calls `watch.track({ provider: "anthropic", model: "claude-3", tokens: 900, latency_ms: 450, status: "success", tags: { task: "summarize", priority: "high" } })`
THEN the enqueued event MUST include the `tags` object as part of the event payload.

### Requirement: Heartbeat via watch.heartbeat()

The SDK SHALL provide a `watch.heartbeat()` method that enqueues a `heartbeat` event for the configured agent. The heartbeat event MUST include the `agent_id` and a current `timestamp`.

#### Scenario: Send a heartbeat

WHEN a developer calls `watch.heartbeat()`
THEN the SDK MUST enqueue an event of type `heartbeat` with the configured `agent_id` and the current timestamp.

### Requirement: Error reporting via watch.error()

The SDK SHALL provide a `watch.error(error)` method that accepts an Error object (or any value). The method MUST enqueue an `error` event containing the error message and stack trace (if available) for delivery to the ingest API.

#### Scenario: Report an error with an Error object

WHEN a developer calls `watch.error(new Error("LLM timeout"))` with a standard JavaScript Error
THEN the SDK MUST enqueue an event of type `error` containing the message `"LLM timeout"` and the stack trace from the Error object.

#### Scenario: Report an error with a string

WHEN a developer calls `watch.error("something went wrong")` with a plain string
THEN the SDK MUST enqueue an event of type `error` containing the message `"something went wrong"`.

### Requirement: Automatic batching

The SDK SHALL flush events every 5 seconds OR when the buffer reaches 50 events. The buffer MUST have a hard cap of 5000 events. When the cap is reached and new events arrive, the SDK MUST log a warning indicating that events are being dropped and the current buffer size.

#### Scenario: Buffer cap reached with warning
- **WHEN** the internal buffer reaches MAX_BUFFER_CAP (5000 events)
- **AND** a new event is enqueued via `track()`, `heartbeat()`, `error()`, or `custom()`
- **THEN** the new event is discarded
- **AND** a warning is logged indicating events are being dropped due to buffer overflow

### Requirement: Graceful degradation

The SDK MUST NOT throw exceptions or crash the host agent process if the ingest API is unreachable. When the ingest API is unreachable or returns a server error, the SDK SHALL silently discard the events in the current flush batch and continue buffering new events. The SDK MUST NOT allow failed network calls to propagate unhandled promise rejections or uncaught exceptions.

#### Scenario: Ingest API unreachable

WHEN the SDK attempts to flush events but the ingest API endpoint is unreachable (e.g., network timeout)
THEN the SDK MUST NOT throw an error, MUST NOT crash the host process, and MUST continue accepting new events via `track`, `heartbeat`, and `error`.

#### Scenario: Ingest API returns server error

WHEN the SDK flushes events and the ingest API responds with HTTP 500
THEN the SDK MUST silently discard the batch and MUST NOT propagate the error to the agent code.

### Requirement: TypeScript types for AgentEvent

The SDK SHALL export TypeScript type definitions for the `AgentEvent` schema and all related types (including the configuration object, track payload, and event types). These types MUST be available to consumers for compile-time type checking when using the SDK in a TypeScript project.

#### Scenario: Type availability in TypeScript project

WHEN a TypeScript developer imports `{ AgentEvent }` from the SDK package
THEN the type MUST be available and MUST describe the full event schema including `agent_id`, `event_type`, `timestamp`, and optional fields.

#### Scenario: Configuration type exported

WHEN a TypeScript developer imports `{ AgentTraceConfig }` from the SDK package
THEN the type MUST be available and MUST describe `apiKey` (string), `agentId` (string), and `endpoint` (optional string).

### Requirement: Configurable endpoint URL

The SDK SHALL use a default endpoint URL pointing to the cloud-hosted ingest API. The endpoint MUST be overridable via the `endpoint` property in the `AgentTrace.init()` configuration. When `endpoint` is provided, all event flushes MUST be sent to the specified URL instead of the default.

#### Scenario: Default endpoint used when not specified

WHEN a developer calls `AgentTrace.init({ apiKey: "ak_test123", agentId: "bot-1" })` without specifying `endpoint`
THEN the SDK MUST send events to the default cloud API endpoint.

#### Scenario: Custom endpoint override

WHEN a developer calls `AgentTrace.init({ apiKey: "ak_test123", agentId: "bot-1", endpoint: "https://custom.example.com/api/events" })`
THEN the SDK MUST send all flushed events to `https://custom.example.com/api/events`.
