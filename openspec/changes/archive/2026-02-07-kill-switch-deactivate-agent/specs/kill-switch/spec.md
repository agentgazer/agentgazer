## MODIFIED Requirements

### Requirement: Kill Switch Enforcement

The system SHALL deactivate the agent when loop detection score exceeds threshold.

#### Scenario: Deactivate on threshold exceeded
- **WHEN** loop detection score exceeds configured threshold
- **THEN** proxy SHALL set agent's `active` to `0`
- **AND** proxy SHALL set agent's `deactivated_by` to `'kill_switch'`

#### Scenario: Use standard inactive response
- **WHEN** agent has been deactivated by kill switch
- **THEN** subsequent requests SHALL receive standard inactive agent response (not 429)

#### Scenario: Record kill switch event
- **WHEN** agent is deactivated by kill switch
- **THEN** event SHALL be recorded with `event_type: "kill_switch"` and deactivation details

### Requirement: Kill Switch State Management

The system SHALL maintain per-agent request history for loop detection and clear it on activation.

#### Scenario: Sliding window storage
- **WHEN** new request is processed
- **THEN** request fingerprint SHALL be added to agent's sliding window

#### Scenario: Window overflow
- **WHEN** window exceeds configured size
- **THEN** oldest entries SHALL be removed (FIFO)

#### Scenario: Response hash capture
- **WHEN** response is received from LLM
- **THEN** response content SHALL be hashed and stored in window

#### Scenario: Clear window on activate
- **WHEN** agent is activated (from inactive to active)
- **THEN** loop detector sliding window for that agent SHALL be cleared

## ADDED Requirements

### Requirement: Deactivation Reason Tracking

The system SHALL track why an agent was deactivated.

#### Scenario: Store deactivation reason
- **WHEN** agent is deactivated
- **THEN** `deactivated_by` field SHALL be set to `'kill_switch'` or `'manual'`

#### Scenario: Clear deactivation reason on activate
- **WHEN** agent is activated
- **THEN** `deactivated_by` field SHALL be set to `null`

#### Scenario: Display deactivation reason in dashboard
- **WHEN** viewing an inactive agent in dashboard
- **AND** `deactivated_by` is `'kill_switch'`
- **THEN** dashboard SHALL display "Deactivated by Kill Switch" indicator

#### Scenario: Display manual deactivation in dashboard
- **WHEN** viewing an inactive agent in dashboard
- **AND** `deactivated_by` is `'manual'` or `null`
- **THEN** dashboard SHALL display standard "Inactive" indicator
