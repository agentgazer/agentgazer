## ADDED Requirements

### Requirement: User authentication via Supabase Auth

The dashboard SHALL authenticate users via Supabase Auth. The system MUST support two authentication methods: email with password and GitHub OAuth. Unauthenticated users MUST be redirected to the login page. Authenticated sessions MUST be managed by Supabase and the dashboard MUST validate the session on every protected route.

#### Scenario: Login with email and password

WHEN a user enters a valid email and password on the login page
THEN the dashboard MUST authenticate the user via Supabase Auth and redirect them to the main agent list view.

#### Scenario: Login with GitHub OAuth

WHEN a user clicks the "Sign in with GitHub" button on the login page
THEN the dashboard MUST initiate the GitHub OAuth flow via Supabase Auth and, upon successful authorization, redirect the user to the main agent list view.

#### Scenario: Unauthenticated access to protected route

WHEN an unauthenticated user attempts to access the agent list or any dashboard page
THEN the dashboard MUST redirect them to the login page.

#### Scenario: Invalid credentials

WHEN a user enters an incorrect email or password
THEN the dashboard MUST display an error message and MUST NOT grant access.

### Requirement: Agent list view with status indicators

The dashboard SHALL display an agent list view showing all agents belonging to the authenticated user. Each agent in the list MUST display the agent name, agent ID, and a status indicator. The status indicator MUST show one of three states: healthy (heartbeats arriving on schedule), degraded (heartbeats arriving but errors elevated), or down (no heartbeat received within the configured threshold).

#### Scenario: View agent list

WHEN an authenticated user navigates to the main dashboard page
THEN the dashboard MUST display a list of all agents associated with the user's account, each showing its name, ID, and current status.

#### Scenario: Healthy agent indicator

WHEN an agent has sent heartbeats on schedule and its error rate is below the threshold
THEN the status indicator MUST display as "healthy".

#### Scenario: Degraded agent indicator

WHEN an agent is sending heartbeats but its error rate exceeds the normal threshold
THEN the status indicator MUST display as "degraded".

#### Scenario: Down agent indicator

WHEN an agent has not sent a heartbeat within the configured down threshold
THEN the status indicator MUST display as "down".

### Requirement: Agent detail view

The dashboard SHALL provide an agent detail view accessible by selecting an agent from the list. The detail view MUST display: a token usage over time chart, a cost breakdown by model and by provider, the current error rate, and latency percentiles at P50, P95, and P99.

#### Scenario: View token usage chart

WHEN a user navigates to the detail view for a specific agent
THEN the dashboard MUST display a time-series chart showing the agent's token usage over the selected time range.

#### Scenario: View cost breakdown

WHEN a user views the agent detail page
THEN the dashboard MUST display cost broken down by model and by provider in the selected time range.

#### Scenario: View error rate

WHEN a user views the agent detail page
THEN the dashboard MUST display the current error rate as a percentage of total events.

#### Scenario: View latency percentiles

WHEN a user views the agent detail page
THEN the dashboard MUST display latency metrics at P50, P95, and P99 for the selected time range.

### Requirement: Real-time updates

The dashboard SHALL update agent status changes in real time without requiring a page refresh. Status changes (healthy, degraded, down) MUST be reflected in the UI within 5 seconds of the underlying data change. The dashboard MUST use Supabase Realtime or an equivalent push mechanism for live updates.

#### Scenario: Agent goes down in real time

WHEN an agent stops sending heartbeats and its status changes to "down" on the server
THEN the dashboard MUST update the agent's status indicator to "down" within 5 seconds without the user refreshing the page.

#### Scenario: Agent recovers in real time

WHEN a previously down agent resumes sending heartbeats and its status changes to "healthy"
THEN the dashboard MUST update the status indicator to "healthy" within 5 seconds without a page refresh.

### Requirement: Time range selector

The dashboard SHALL provide a time range selector that applies to all charts and metrics in the agent detail view. The selector MUST offer the following preset options: 1 hour, 24 hours, 7 days, and 30 days. The selector MUST also support a custom date range where the user can pick a start and end date/time.

#### Scenario: Select preset time range

WHEN a user selects the "24h" preset from the time range selector
THEN all charts and metrics on the agent detail page MUST update to show data from the last 24 hours.

#### Scenario: Select custom time range

WHEN a user selects "Custom" and enters a start date of January 1 and end date of January 15
THEN all charts and metrics MUST update to show data for that custom range.

#### Scenario: Default time range

WHEN a user first opens the agent detail view without selecting a time range
THEN the dashboard MUST default to displaying the last 24 hours.

### Requirement: Cost summary

The dashboard SHALL display a cost summary section. The summary MUST show the total spend across all agents for the selected time range. The summary MUST also show a per-agent cost breakdown so the user can see which agent is most expensive.

#### Scenario: View total cost

WHEN an authenticated user views the cost summary section
THEN the dashboard MUST display the total dollar amount spent across all agents in the selected time range.

#### Scenario: View per-agent cost breakdown

WHEN an authenticated user views the cost summary section
THEN the dashboard MUST display a breakdown listing each agent and its individual cost in the selected time range.

### Requirement: API key management

The dashboard SHALL provide an API key management interface. Users MUST be able to generate new API keys, revoke existing API keys, and copy an API key to the clipboard. Revoking a key MUST immediately invalidate it so that subsequent requests using that key are rejected by the ingest API.

#### Scenario: Generate a new API key

WHEN a user clicks "Generate API Key" in the key management section
THEN the dashboard MUST create a new API key, display it to the user, and make it available for copy.

#### Scenario: Revoke an API key

WHEN a user clicks "Revoke" on an existing API key
THEN the dashboard MUST invalidate that key immediately, and any subsequent ingest API request using that key MUST be rejected with HTTP 401.

#### Scenario: Copy API key to clipboard

WHEN a user clicks the copy button next to an API key
THEN the API key value MUST be copied to the user's system clipboard.

### Requirement: Responsive layout

The dashboard SHALL use a responsive layout that is desktop-first and usable on tablet-sized screens. On desktop viewports (1024px and above), the dashboard MUST display the full layout with side navigation and main content area. On tablet viewports (768px to 1023px), the dashboard MUST remain usable with appropriately adjusted layout and navigation.

#### Scenario: Desktop layout

WHEN a user accesses the dashboard on a viewport 1024px wide or larger
THEN the dashboard MUST display the full layout with side navigation and charts rendered at full size.

#### Scenario: Tablet layout

WHEN a user accesses the dashboard on a viewport between 768px and 1023px wide
THEN the dashboard MUST remain fully functional with readable text, accessible navigation, and usable charts.
