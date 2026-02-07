## ADDED Requirements

### Requirement: SPA shell with client-side routing
The dashboard SHALL be a Vite + React single-page application using React Router. Routes: `/` (agent overview), `/agents` (agent list), `/agents/:agentId` (agent detail), `/costs` (cost analysis), `/alerts` (alert management), `/login` (token entry).

#### Scenario: Navigation between pages
- **WHEN** a user clicks a navigation link in the sidebar
- **THEN** the browser URL updates and the corresponding page renders without a full page reload

#### Scenario: Direct URL access
- **WHEN** a user navigates directly to `/agents/my-agent`
- **THEN** the SPA loads and renders the agent detail page (server returns `index.html` for all non-API routes)

### Requirement: Dashboard layout
The dashboard SHALL have a persistent sidebar with navigation links (Overview, Agents, Costs, Alerts) and a main content area. The sidebar SHALL display the AgentGazer logo/name at the top. The layout SHALL use a dark theme consistent with the existing dashboard styling.

#### Scenario: Sidebar navigation
- **WHEN** the dashboard loads
- **THEN** a sidebar is visible with links to Overview, Agents, Costs, and Alerts, and the current page's link is visually highlighted

### Requirement: Agent overview page
The overview page (`/`) SHALL display a summary of all agents with their current status (healthy/degraded/down/unknown), total request count, and last heartbeat time. Data SHALL be fetched from `GET /api/agents`.

#### Scenario: Display agents with status
- **WHEN** the user navigates to `/`
- **THEN** all agents are listed with color-coded status indicators (green=healthy, yellow=degraded, red=down, gray=unknown)

### Requirement: Agent list page
The agent list page (`/agents`) SHALL display all agents in a table/card layout with columns: agent name/ID, status, last heartbeat, total events. Each row SHALL link to the agent detail page.

#### Scenario: Click through to agent detail
- **WHEN** a user clicks on an agent row
- **THEN** the browser navigates to `/agents/:agentId`

### Requirement: Agent detail page with stats
The agent detail page (`/agents/:agentId`) SHALL display: stats cards (total requests, total errors, error rate, total cost, tokens used, P50 latency, P99 latency), a token usage chart, and a cost breakdown by model. Data SHALL be fetched from `GET /api/stats/:agentId`.

#### Scenario: Stats display with time range
- **WHEN** the user views agent detail for "my-agent" with range "24h"
- **THEN** the page shows 7 stat cards, a token time-series chart, and a model cost breakdown for the last 24 hours

### Requirement: Time range selector
The agent detail page SHALL include a time range selector with preset options (1h, 24h, 7d, 30d) and a custom date range picker. Changing the range SHALL re-fetch data for the selected period.

#### Scenario: Switch to 7-day range
- **WHEN** the user clicks the "7d" button
- **THEN** all stats, charts, and breakdowns update to show the last 7 days of data

#### Scenario: Custom date range
- **WHEN** the user selects "Custom" and enters a from/to date
- **THEN** the data updates to show only events within the specified range

### Requirement: Cost analysis page
The cost page (`/costs`) SHALL display a breakdown of costs across all agents, grouped by agent and by model/provider. Data SHALL be fetched from `GET /api/events` with appropriate filters.

#### Scenario: Cost breakdown display
- **WHEN** the user navigates to `/costs`
- **THEN** the page shows total cost, cost per agent, and cost per model

### Requirement: Alert management page
The alerts page (`/alerts`) SHALL have two tabs: "Rules" and "History". The Rules tab SHALL list all alert rules with toggle switches, edit/delete buttons, and a "New Alert Rule" button. The History tab SHALL show recent alert deliveries.

#### Scenario: Create new alert rule
- **WHEN** the user clicks "New Alert Rule" and fills in the form (agent, rule type, config, webhook URL)
- **THEN** a POST is sent to `/api/alerts` and the new rule appears in the list

#### Scenario: Toggle alert rule
- **WHEN** the user toggles a rule's switch
- **THEN** a PATCH is sent to `/api/alerts/:id/toggle` and the UI updates immediately

#### Scenario: View alert history
- **WHEN** the user clicks the "History" tab
- **THEN** recent alert deliveries are shown in a table with timestamp, agent, rule type, message, and delivery method

### Requirement: Polling-based data refresh
All data-displaying pages SHALL poll their respective API endpoints every 3 seconds while the browser tab is active. Polling SHALL pause when the tab is hidden (using `visibilitychange` event) and resume when the tab becomes visible again.

#### Scenario: Live data updates
- **WHEN** new events are ingested while the user is viewing the agent detail page
- **THEN** the stats, charts, and breakdowns update within 3 seconds without manual refresh

#### Scenario: Polling pauses when tab hidden
- **WHEN** the user switches to another browser tab
- **THEN** polling stops until the user returns to the dashboard tab

### Requirement: Loading and error states
All pages SHALL display a loading indicator while data is being fetched. If an API request fails, the page SHALL display an error message with a retry option.

#### Scenario: Loading state
- **WHEN** a page is fetching data
- **THEN** a loading spinner or skeleton is displayed

#### Scenario: API error
- **WHEN** an API request returns an error
- **THEN** an error banner is displayed with the error message and a "Retry" button

### Requirement: Agent list view with status indicators

The dashboard agents page and overview page MUST use API response field names that match the server's actual `/api/agents` response shape. The TypeScript interfaces SHALL be aligned with the server contract.

#### Scenario: Agents page renders server response correctly
- **WHEN** the dashboard fetches `/api/agents`
- **THEN** the TypeScript interface matches the server's actual response structure
- **AND** agent list renders without undefined fields

### Requirement: Agent detail view

The agent detail page MUST use API response field names that match the server's actual `/api/stats/:agentId` response shape. Field names for requests, errors, cost, tokens, and latency percentiles SHALL match the server contract exactly.

#### Scenario: Stats page renders server response correctly
- **WHEN** the dashboard fetches `/api/stats/:agentId`
- **THEN** the TypeScript interface field names match the server's actual response
- **AND** all stat cards display correct values (not undefined or NaN)

#### Scenario: CLI stats command uses correct field names
- **WHEN** the CLI fetches `/api/stats/:agentId`
- **THEN** the CLI's StatsResponse field names match the server's actual response
- **AND** stats display renders correct values

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
