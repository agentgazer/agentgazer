## ADDED Requirements

### Requirement: Provider list view with statistics table

The Providers page SHALL display providers in a table layout matching the Agents page style.

#### Scenario: Table columns displayed
- **WHEN** user navigates to `/providers`
- **THEN** the page SHALL display a table with columns: Provider, Status (toggle), Agents, Total Tokens, Total Cost, Today Cost

#### Scenario: Provider name with icon
- **WHEN** viewing the Provider column
- **THEN** each row SHALL show the provider icon/initial and capitalized name as a link to provider detail

#### Scenario: Active toggle in table
- **WHEN** user clicks the status toggle for a provider
- **THEN** the provider's active status SHALL be toggled via API
- **AND** the toggle SHALL reflect the new state immediately

#### Scenario: Stats display
- **WHEN** provider "openai" has 50000 tokens, $5.00 total cost, $1.25 today cost
- **THEN** the row SHALL display formatted values: "50,000", "$5.00", "$1.25"

### Requirement: Provider table empty state

The Providers page SHALL show an appropriate message when no providers are configured.

#### Scenario: No providers configured
- **WHEN** no providers are configured
- **THEN** the page SHALL display "No providers configured yet" message with guidance to add one

### Requirement: Provider list sorting

The Providers page SHALL display providers sorted by usage.

#### Scenario: Sort by total cost descending
- **WHEN** viewing the providers table
- **THEN** providers SHALL be sorted by total_cost in descending order (highest usage first)

### Requirement: Provider list polling

The Providers page SHALL poll for updates like other dashboard pages.

#### Scenario: Live data updates
- **WHEN** new events are ingested for a provider
- **THEN** the stats SHALL update within 3 seconds without manual refresh
