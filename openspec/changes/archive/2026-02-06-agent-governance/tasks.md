## 1. Database Schema

- [x] 1.1 Add policy columns to agents table (active, budget_limit, allowed_hours_start, allowed_hours_end)
- [x] 1.2 Add 'blocked' to event_type CHECK constraint in agent_events table
- [x] 1.3 Add getDailySpend() function to calculate agent's today's spending
- [x] 1.4 Add getAgentPolicy() and updateAgentPolicy() DB functions

## 2. Server API

- [x] 2.1 Create GET /api/agents/:agentId/policy endpoint
- [x] 2.2 Create PUT /api/agents/:agentId/policy endpoint
- [x] 2.3 Add blocked_count and block_reasons to agent stats endpoint

## 3. Proxy Path Routing

- [x] 3.1 Add parseAgentPath() to extract agent-id from /agents/{id}/... paths
- [x] 3.2 Update agent identification logic with priority: header > path > default
- [x] 3.3 Strip /agents/{id}/ prefix before provider routing

## 4. Proxy Policy Enforcement

- [x] 4.1 Modify CLI to pass DB instance to proxy
- [x] 4.2 Add checkPolicy() function in proxy to query agent policy
- [x] 4.3 Add getDailySpend() query in proxy (or reuse from server)
- [x] 4.4 Implement policy check before forwarding (active, budget, hours)
- [x] 4.5 Create generateBlockedResponse() for OpenAI format
- [x] 4.6 Create generateBlockedResponse() for Anthropic format
- [x] 4.7 Record blocked events to agent_events table

## 5. Dashboard - Agent Detail Page

- [x] 5.1 Create PolicySettings component with active toggle, budget input, hours selectors
- [x] 5.2 Add useAgentPolicy hook to fetch/update policy via API
- [x] 5.3 Display current daily spend vs budget limit
- [x] 5.4 Show server timezone indicator for allowed hours
- [x] 5.5 Display blocked events count and breakdown by reason

## 6. Dashboard - Agents List Page

- [x] 6.1 Add "Inactive" badge for agents with active=false
- [x] 6.2 Show budget usage indicator for agents with budget_limit

## 7. Testing & Documentation

- [x] 7.1 Test policy enforcement with various scenarios (deactivated, over budget, outside hours)
- [x] 7.2 Test path-based agent identification
- [x] 7.3 Update OpenClaw integration docs with agent path routing examples
