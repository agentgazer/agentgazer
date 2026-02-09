## ADDED Requirements

### Requirement: Logs page displays all events
Dashboard SHALL have a Logs page accessible from navigation that displays all agent events in a paginated table.

#### Scenario: View logs page
- **WHEN** user navigates to /logs
- **THEN** system displays a table with columns: Time, Agent, Type, Provider, Model, Status, Cost

#### Scenario: Empty state
- **WHEN** user views logs page with no events
- **THEN** system displays "No events found" message

### Requirement: Logs filtering
User SHALL be able to filter events by agent, event type, provider, and time range.

#### Scenario: Filter by agent
- **WHEN** user selects an agent from the Agent dropdown
- **THEN** table shows only events for that agent

#### Scenario: Filter by event type
- **WHEN** user selects event types (e.g., error, completion)
- **THEN** table shows only events matching selected types

#### Scenario: Filter by time range
- **WHEN** user selects a time range preset (1h, 24h, 7d, 30d)
- **THEN** table shows only events within that time range

#### Scenario: Combined filters
- **WHEN** user applies multiple filters
- **THEN** table shows events matching ALL filter criteria

### Requirement: Logs pagination
User SHALL be able to navigate through events using pagination controls.

#### Scenario: Navigate pages
- **WHEN** user clicks Next/Previous page buttons
- **THEN** table loads the next/previous set of events (50 per page)

#### Scenario: Page info display
- **WHEN** user views the logs page
- **THEN** system displays current page range and total count (e.g., "1-50 of 1,234")

### Requirement: Logs export
User SHALL be able to export filtered events.

#### Scenario: Export to CSV
- **WHEN** user clicks Export button with CSV selected
- **THEN** browser downloads a CSV file with current filtered events

### Requirement: API supports global event query
GET /api/events SHALL work without requiring agent_id parameter.

#### Scenario: Query all events
- **WHEN** client calls GET /api/events without agent_id
- **THEN** API returns events from all agents

#### Scenario: Pagination parameters
- **WHEN** client calls GET /api/events?offset=50&limit=50
- **THEN** API returns events 51-100 with total count in response

### Requirement: Navigation link from Overview
Overview page Recent Events section SHALL have a link to the full Logs page.

#### Scenario: Click view all
- **WHEN** user clicks "View All" link in Recent Events
- **THEN** user is navigated to /logs
