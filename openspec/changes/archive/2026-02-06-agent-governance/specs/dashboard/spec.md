## ADDED Requirements

### Requirement: Policy settings UI on Agent Detail page

The Agent Detail page SHALL display a Policy Settings section.

#### Scenario: View policy settings
- **WHEN** user navigates to Agent Detail page
- **THEN** the page SHALL show current values for active, budget_limit, allowed_hours

#### Scenario: Toggle active status
- **WHEN** user toggles the active switch
- **THEN** the agent's active status SHALL be updated via API
- **AND** the UI SHALL reflect the new status

#### Scenario: Set budget limit
- **WHEN** user enters a budget limit value and saves
- **THEN** the agent's budget_limit SHALL be updated via API

#### Scenario: Set allowed hours
- **WHEN** user selects start and end hours and saves
- **THEN** the agent's allowed_hours_start and allowed_hours_end SHALL be updated via API

#### Scenario: Clear restrictions
- **WHEN** user clears budget_limit or allowed_hours
- **THEN** the corresponding fields SHALL be set to null (no restriction)

### Requirement: Display current daily spend

The Policy Settings section SHALL show the agent's current daily spending.

#### Scenario: Show daily spend
- **WHEN** viewing an agent with budget_limit set
- **THEN** the UI SHALL show current spend vs limit (e.g., "$12.34 / $20.00")

#### Scenario: Budget warning
- **WHEN** daily spend exceeds 80% of budget_limit
- **THEN** the UI SHALL show a warning indicator

### Requirement: Display timezone info

The allowed hours settings SHALL display timezone information.

#### Scenario: Show server timezone
- **WHEN** viewing allowed hours settings
- **THEN** the UI SHALL indicate the timezone (e.g., "Server time: UTC+8")

### Requirement: Blocked events visibility

The Agent Detail page SHALL show blocked event statistics.

#### Scenario: Show blocked count
- **WHEN** viewing an agent that has blocked events
- **THEN** the UI SHALL display the count of blocked events

#### Scenario: Show block reasons
- **WHEN** viewing blocked events
- **THEN** the UI SHALL show breakdown by block_reason

### Requirement: Agent list shows policy status

The Agents list page SHALL indicate policy status for each agent.

#### Scenario: Show inactive badge
- **WHEN** an agent is inactive (active=false)
- **THEN** the agent row SHALL show an "Inactive" badge

#### Scenario: Show budget usage
- **WHEN** an agent has budget_limit set
- **THEN** the agent row SHALL show current spend percentage
