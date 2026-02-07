### Requirement: Overview statistics endpoint

The system SHALL provide a `/api/overview` endpoint returning comprehensive dashboard statistics.

#### Scenario: Response includes summary stats
- **WHEN** client fetches `GET /api/overview`
- **THEN** response SHALL include `active_agents`, `today_cost`, `today_requests`, `error_rate` fields

#### Scenario: Response includes trend comparisons
- **WHEN** client fetches `GET /api/overview`
- **THEN** response SHALL include `yesterday_cost`, `yesterday_requests`, `yesterday_error_rate` for comparison

#### Scenario: Response includes top agents
- **WHEN** client fetches `GET /api/overview`
- **THEN** response SHALL include `top_agents` array with top 5 agents by cost, each having `agent_id`, `cost`, `percentage` fields

#### Scenario: Response includes top models
- **WHEN** client fetches `GET /api/overview`
- **THEN** response SHALL include `top_models` array with top 5 models by token usage, each having `model`, `tokens`, `percentage` fields

#### Scenario: Response includes daily trends
- **WHEN** client fetches `GET /api/overview`
- **THEN** response SHALL include `cost_trend` and `requests_trend` arrays with last 7 days of data, each entry having `date`, `value` fields

### Requirement: Recent events endpoint

The system SHALL provide a `/api/events/recent` endpoint returning important system events.

#### Scenario: Returns kill switch events
- **WHEN** an agent was deactivated by kill switch
- **THEN** recent events SHALL include entry with `type: "kill_switch"`, `agent_id`, `message`, `timestamp`

#### Scenario: Returns budget warning events
- **WHEN** an agent's daily spend exceeds 80% of budget limit
- **THEN** recent events SHALL include entry with `type: "budget_warning"`, `agent_id`, `current_spend`, `budget_limit`, `timestamp`

#### Scenario: Returns high error rate events
- **WHEN** an agent's error rate exceeds 5% in the last hour
- **THEN** recent events SHALL include entry with `type: "high_error_rate"`, `agent_id`, `error_rate`, `timestamp`

#### Scenario: Returns new agent events
- **WHEN** an agent was created in the last 24 hours
- **THEN** recent events SHALL include entry with `type: "new_agent"`, `agent_id`, `timestamp`

#### Scenario: Limits and sorts events
- **WHEN** client fetches `GET /api/events/recent`
- **THEN** response SHALL return at most 10 events, sorted by timestamp descending (most recent first)
