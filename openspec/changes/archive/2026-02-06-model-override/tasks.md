## 1. Database Schema

- [x] 1.1 Add `agent_model_rules` table to packages/server/src/db.ts with columns: id, agent_id, provider, model_override, created_at, updated_at (unique constraint on agent_id+provider)
- [x] 1.2 Add `requested_model` column to `agent_events` table
- [x] 1.3 Add migration logic to handle existing databases (ALTER TABLE for new column)

## 2. Shared Package

- [x] 2.1 Create packages/shared/src/models.ts with SELECTABLE_MODELS constant mapping provider names to model arrays
- [x] 2.2 Export SELECTABLE_MODELS from packages/shared/src/index.ts

## 3. Server API

- [x] 3.1 Add CRUD functions for agent_model_rules in db.ts: getModelRulesForAgent, getModelRule, upsertModelRule, deleteModelRule
- [x] 3.2 Create packages/server/src/routes/model-rules.ts with endpoints: GET /api/agents/:id/model-rules, PUT /api/agents/:id/model-rules/:provider, DELETE /api/agents/:id/model-rules/:provider
- [x] 3.3 Add GET /api/models endpoint to return SELECTABLE_MODELS
- [x] 3.4 Add GET /api/agents/:id/providers endpoint to return distinct providers from events
- [x] 3.5 Register model-rules routes in server.ts

## 4. Proxy Override Logic

- [x] 4.1 Add function to fetch model override rule from Server API (with 30s cache)
- [x] 4.2 Modify request forwarding to check override and rewrite model in request body
- [x] 4.3 Update event recording to include both requested_model and model fields

## 5. Dashboard - Agents List

- [x] 5.1 Add API call to fetch providers for each agent (or add to existing agents list response)
- [x] 5.2 Add "Providers" column to AgentsPage table
- [x] 5.3 Show override indicator (icon/badge) for providers with active rules

## 6. Dashboard - Agent Detail

- [x] 6.1 Fetch model rules and providers for the agent on AgentDetailPage
- [x] 6.2 Add "Model Settings" section with provider cards
- [x] 6.3 Add model override dropdown for each provider (populated from GET /api/models)
- [x] 6.4 Implement dropdown change handler to call PUT/DELETE model-rules API
- [x] 6.5 Add "Request Log" section showing recent events with requested_model vs model

## 7. Testing

- [x] 7.1 Add unit tests for model rules CRUD in db.ts
- [x] 7.2 Add integration tests for model-rules API endpoints
- [x] 7.3 Test proxy model override with mock server
