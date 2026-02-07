## ADDED Requirements

### Requirement: SimHash Algorithm

The system SHALL provide a SimHash implementation for computing 64-bit locality-sensitive hashes of text content.

#### Scenario: Similar texts produce similar hashes
- **WHEN** two texts differ only in numbers or timestamps
- **THEN** their SimHash Hamming distance SHALL be less than 3

#### Scenario: Different texts produce different hashes
- **WHEN** two texts have substantially different content
- **THEN** their SimHash Hamming distance SHALL be greater than 5

### Requirement: Prompt Normalization

The system SHALL normalize prompts before hashing to detect semantic repetition.

#### Scenario: Normalize numbers
- **WHEN** prompt contains numbers like "order #12345"
- **THEN** numbers SHALL be replaced with `<NUM>` placeholder

#### Scenario: Normalize timestamps
- **WHEN** prompt contains ISO timestamps like "2024-01-15T10:30:00Z"
- **THEN** timestamps SHALL be replaced with `<TS>` placeholder

#### Scenario: Normalize UUIDs
- **WHEN** prompt contains UUIDs like "550e8400-e29b-41d4-a716-446655440000"
- **THEN** UUIDs SHALL be replaced with `<ID>` placeholder

#### Scenario: Normalize whitespace
- **WHEN** prompt contains multiple spaces or varied line endings
- **THEN** whitespace SHALL be normalized to single spaces

#### Scenario: Extract user message
- **WHEN** request contains multi-turn conversation (messages array)
- **THEN** only the last user message SHALL be used for hashing

### Requirement: Loop Detection Scoring

The system SHALL compute a loop detection score based on multiple signals within a sliding window.

#### Scenario: Score calculation
- **WHEN** analyzing recent requests in the sliding window
- **THEN** score SHALL be calculated as: `similar_prompts × 1.0 + similar_responses × 2.0 + repeated_tool_calls × 1.5`

#### Scenario: Prompt similarity check
- **WHEN** comparing current prompt hash to window history
- **THEN** prompts with Hamming distance < 3 SHALL be counted as similar

#### Scenario: Response similarity check
- **WHEN** comparing response hashes in window history
- **THEN** responses with Hamming distance < 3 SHALL be counted as similar

#### Scenario: Tool call repetition check
- **WHEN** request includes function/tool calls
- **THEN** identical tool call signatures SHALL be counted as repeated

### Requirement: Kill Switch Configuration

The system SHALL allow per-agent Kill Switch configuration.

#### Scenario: Enable kill switch
- **WHEN** user enables kill switch for an agent
- **THEN** loop detection SHALL be active for that agent's requests

#### Scenario: Disable kill switch
- **WHEN** kill switch is disabled (default)
- **THEN** loop detection SHALL NOT block any requests

#### Scenario: Configure window size
- **WHEN** user sets window_size to N
- **THEN** loop detection SHALL analyze the last N requests

#### Scenario: Configure threshold
- **WHEN** user sets score threshold to T
- **THEN** requests SHALL be blocked when score exceeds T

### Requirement: Kill Switch Enforcement

The system SHALL block requests when loop detection score exceeds threshold.

#### Scenario: Block on threshold exceeded
- **WHEN** loop detection score exceeds configured threshold
- **THEN** proxy SHALL return 429 status with `block_reason: "loop_detected"`

#### Scenario: Include retry information
- **WHEN** request is blocked due to loop detection
- **THEN** response SHALL include `retry_after_seconds` field

#### Scenario: Record blocked event
- **WHEN** request is blocked
- **THEN** event SHALL be recorded with `blocked: true` and `block_reason: "loop_detected"`

### Requirement: Kill Switch State Management

The system SHALL maintain per-agent request history for loop detection.

#### Scenario: Sliding window storage
- **WHEN** new request is processed
- **THEN** request fingerprint SHALL be added to agent's sliding window

#### Scenario: Window overflow
- **WHEN** window exceeds configured size
- **THEN** oldest entries SHALL be removed (FIFO)

#### Scenario: Response hash capture
- **WHEN** response is received from LLM
- **THEN** response content SHALL be hashed and stored in window

### Requirement: Kill Switch UI

The system SHALL provide dashboard UI for Kill Switch configuration.

#### Scenario: Toggle visibility
- **WHEN** viewing Agent Detail page
- **THEN** Kill Switch toggle and settings SHALL be visible

#### Scenario: Notification check on enable
- **WHEN** user enables Kill Switch toggle
- **AND** no alert notification is configured
- **THEN** system SHALL prompt user to configure alert notifications

#### Scenario: Configure parameters
- **WHEN** Kill Switch is enabled
- **THEN** user SHALL be able to configure window_size and threshold
