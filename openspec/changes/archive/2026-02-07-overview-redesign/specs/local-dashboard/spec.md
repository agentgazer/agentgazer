## ADDED Requirements

### Requirement: Overview summary cards with trends

The Overview page SHALL display 4 summary cards showing key metrics with trend comparison.

#### Scenario: Active agents card
- **WHEN** viewing the Overview page
- **THEN** a card SHALL display the count of active agents

#### Scenario: Today's cost card with trend
- **WHEN** today's cost is $12.34 and yesterday was $10.00
- **THEN** the card SHALL display "$12.34" with "↑ 23%" trend indicator

#### Scenario: Requests card with trend
- **WHEN** today has 1,234 requests and yesterday had 1,400
- **THEN** the card SHALL display "1,234" with "↓ 12%" trend indicator

#### Scenario: Error rate card with warning
- **WHEN** error rate is 5.2% which exceeds the 5% threshold
- **THEN** the card SHALL display "5.2%" with a warning indicator

### Requirement: Overview recent events timeline

The Overview page SHALL display a timeline of recent important events.

#### Scenario: Kill switch event display
- **WHEN** an agent was deactivated by kill switch
- **THEN** the timeline SHALL show a red-coded entry with agent name and "Loop detected, deactivated" message

#### Scenario: Budget warning event display
- **WHEN** an agent reached 80% of daily budget
- **THEN** the timeline SHALL show a yellow-coded entry with spend vs limit information

#### Scenario: High error rate event display
- **WHEN** an agent has high error rate
- **THEN** the timeline SHALL show an orange-coded entry with error percentage

#### Scenario: New agent event display
- **WHEN** a new agent was created
- **THEN** the timeline SHALL show a blue-coded entry with "First request received" message

#### Scenario: Relative timestamps
- **WHEN** viewing the timeline
- **THEN** timestamps SHALL be displayed as relative time (e.g., "2 min ago", "1 hour ago")

### Requirement: Overview top agents ranking

The Overview page SHALL display a ranking of top agents by cost.

#### Scenario: Top 5 agents display
- **WHEN** viewing the Overview page
- **THEN** the top 5 agents by cost SHALL be displayed with horizontal bar chart

#### Scenario: Agent cost and percentage
- **WHEN** agent "code-agent" has $5.20 cost which is 42% of total
- **THEN** the entry SHALL display "code-agent", "$5.20", and a bar representing 42%

### Requirement: Overview top models ranking

The Overview page SHALL display a ranking of top models by token usage.

#### Scenario: Top 5 models display
- **WHEN** viewing the Overview page
- **THEN** the top 5 models by token usage SHALL be displayed with horizontal bar chart

#### Scenario: Model tokens and bar
- **WHEN** model "gpt-4o" has 120K tokens which is highest
- **THEN** the entry SHALL display "gpt-4o", "120K", and a full-width bar

### Requirement: Overview trend charts

The Overview page SHALL display 7-day trend charts for cost and requests.

#### Scenario: Cost trend chart
- **WHEN** viewing the Overview page
- **THEN** a line/area chart SHALL display daily cost for the last 7 days

#### Scenario: Requests trend chart
- **WHEN** viewing the Overview page
- **THEN** a line/area chart SHALL display daily request count for the last 7 days

#### Scenario: Chart axis labels
- **WHEN** viewing trend charts
- **THEN** X-axis SHALL show day labels (Mon, Tue, etc.) and Y-axis SHALL show appropriate units

### Requirement: Overview polling

The Overview page SHALL poll for updates.

#### Scenario: Auto-refresh
- **WHEN** the Overview page is active
- **THEN** data SHALL refresh every 3 seconds via polling
