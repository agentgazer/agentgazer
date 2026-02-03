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
The dashboard SHALL have a persistent sidebar with navigation links (Overview, Agents, Costs, Alerts) and a main content area. The sidebar SHALL display the AgentWatch logo/name at the top. The layout SHALL use a dark theme consistent with the existing dashboard styling.

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
