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

### Requirement: Agents list displays providers

The Agents list page SHALL display a "Providers" column showing which providers each agent has used. The providers MUST be derived from the agent's event history. Providers with active model override rules MUST be visually distinguished (e.g., with an icon or badge).

#### Scenario: Display single provider

- **WHEN** agent "simple-bot" has only used OpenAI
- **THEN** Providers column MUST show "OpenAI"

#### Scenario: Display multiple providers

- **WHEN** agent "smart-bot" has used OpenAI and Anthropic
- **THEN** Providers column MUST show both providers (e.g., "OpenAI, Anthropic")

#### Scenario: Indicate override active

- **WHEN** agent "my-bot" has an active model override for OpenAI
- **THEN** Providers column MUST show OpenAI with an override indicator (e.g., icon, badge, or text)

### Requirement: Agent detail includes model settings

The Agent Detail page SHALL include a "Model Settings" section. This section MUST list each provider the agent has used with a model override dropdown for each. The dropdown options MUST come from the selectable models list for that provider plus a "None" option.

#### Scenario: Display model settings section

- **WHEN** user navigates to Agent Detail for "smart-bot"
- **THEN** page MUST show "Model Settings" section with controls for each provider used

#### Scenario: Dropdown shows current override

- **WHEN** agent "my-bot" has override "gpt-4o-mini" for OpenAI
- **THEN** OpenAI dropdown MUST show "gpt-4o-mini" as selected

#### Scenario: Dropdown shows None when no override

- **WHEN** agent "my-bot" has no override for Anthropic
- **THEN** Anthropic dropdown MUST show "None" as selected

### Requirement: Agent detail includes request log

The Agent Detail page SHALL include a "Request Log" section showing recent LLM calls. Each log entry MUST display: timestamp, provider, requested model, actual model (with visual distinction if different), token count, and cost.

#### Scenario: Display request log entries

- **WHEN** user views Agent Detail for "my-bot" with recent LLM calls
- **THEN** page MUST show Request Log with entries showing timestamp, provider, models, tokens, cost

#### Scenario: Highlight model override in log

- **WHEN** log entry has requested_model different from model
- **THEN** entry MUST visually indicate the override (e.g., "gpt-4 → gpt-4o-mini")

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

### Requirement: Recent Events display
Recent Events component SHALL display events in a compact 2-line format to maximize visible events.

#### Scenario: Event display format
- **WHEN** Recent Events component renders an event
- **THEN** first line shows: Icon + Event Type + Agent Name + Relative Time (separated by ·)
- **AND** second line shows: Event message

#### Scenario: Compact spacing
- **WHEN** Multiple events are displayed
- **THEN** vertical spacing between events is reduced for density
