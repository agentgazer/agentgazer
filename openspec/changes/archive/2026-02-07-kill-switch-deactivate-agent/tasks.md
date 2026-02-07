# Tasks: Kill Switch Deactivate Agent

## 1. Database Schema

- [x] 1.1 Add `deactivated_by` column to `agent_policies` table (TEXT, nullable)
- [x] 1.2 Update `updateAgentPolicy()` to accept `deactivated_by` field
- [x] 1.3 Add migration logic for existing databases

## 2. Proxy Kill Switch Logic

- [x] 2.1 Modify kill switch trigger to call `updateAgentPolicy(db, agentId, { active: 0, deactivated_by: 'kill_switch' })`
- [x] 2.2 Remove 429 response logic, use standard inactive response
- [x] 2.3 Keep alert firing and kill_switch event recording

## 3. Proxy Clear Window API

- [x] 3.1 Add `POST /internal/agents/:id/clear-window` endpoint in proxy
- [x] 3.2 Endpoint calls `loopDetector.clearAgent(agentId)`
- [x] 3.3 Require internal auth or localhost-only access

## 4. Server Activate Logic

- [x] 4.1 In PATCH `/api/agents/:id`, detect when `active` changes from 0 to 1
- [x] 4.2 When activating, set `deactivated_by = null`
- [x] 4.3 When activating, call proxy's clear-window endpoint (fire-and-forget, log errors)
- [x] 4.4 When manually deactivating, set `deactivated_by = 'manual'`

## 5. Dashboard UI

- [x] 5.1 Add `deactivated_by` to agent API response
- [x] 5.2 Show "Deactivated by Kill Switch" badge when `deactivated_by === 'kill_switch'`
- [x] 5.3 Use different styling (e.g., red with warning icon) for kill switch deactivation

## 6. Testing

- [x] 6.1 Update kill switch integration test for new deactivate behavior
- [x] 6.2 Add test for clear-window endpoint
- [x] 6.3 Add test for activate clearing deactivated_by field
