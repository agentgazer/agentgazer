## ADDED Requirements

### Requirement: Overview TUI command

The CLI SHALL provide an `agentgazer overview` command that launches a real-time terminal UI dashboard using ink. The TUI SHALL remain active until the user presses ESC or Q to exit.

#### Scenario: Launch overview
- **WHEN** user runs `agentgazer overview`
- **THEN** CLI launches full-screen TUI showing system overview
- **AND** TUI updates every 2-3 seconds via polling

#### Scenario: Exit overview
- **WHEN** user presses ESC or Q while in overview
- **THEN** TUI exits cleanly and returns to shell

### Requirement: Overview header section

The overview TUI SHALL display a header section showing: uptime, total requests (today), total cost (today), and server/proxy status.

#### Scenario: Display header stats
- **WHEN** overview is running
- **THEN** header shows: "Uptime: Xh Ym | Requests: N | Cost: $X.XX | Server: ● | Proxy: ●"

### Requirement: Overview agents table

The overview TUI SHALL display a table of agents showing: name, status, primary provider, recent calls, cost, and last activity.

#### Scenario: Display agents table
- **WHEN** overview is running and agents exist
- **THEN** table shows all agents sorted by last activity (most recent first)

#### Scenario: No agents
- **WHEN** overview is running and no agents exist
- **THEN** table shows "No agents yet. Start making LLM calls through the proxy."

### Requirement: Overview recent events log

The overview TUI SHALL display a scrolling log of recent events showing: timestamp, agent, provider, model, cost, and latency.

#### Scenario: Display recent events
- **WHEN** overview is running
- **THEN** log shows most recent 10-15 events
- **AND** new events appear at top as they arrive

#### Scenario: No events
- **WHEN** overview is running and no events exist
- **THEN** log shows "Waiting for events..."

### Requirement: Overview keyboard navigation

The overview TUI SHALL support keyboard shortcuts for common actions.

#### Scenario: Keyboard shortcuts
- **WHEN** user is in overview
- **THEN** the following shortcuts are available:
  - `Q` or `ESC` — Exit overview
  - `R` — Force refresh
  - `A` — Toggle showing only active agents
  - `?` — Show help overlay

### Requirement: Overview server connectivity

The overview TUI SHALL handle server connectivity gracefully.

#### Scenario: Server not running
- **WHEN** user runs `agentgazer overview` and server is not running
- **THEN** TUI displays "Server not running. Start with 'agentgazer start' first."
- **AND** TUI continues polling and updates when server becomes available

#### Scenario: Server connection lost
- **WHEN** overview is running and server connection is lost
- **THEN** header shows "Server: ○ (disconnected)" in red
- **AND** TUI continues polling and reconnects automatically
