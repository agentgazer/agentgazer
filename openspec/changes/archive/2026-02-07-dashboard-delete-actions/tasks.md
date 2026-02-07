## 1. Server API - Delete Agent

- [x] 1.1 Add `deleteAgent(agentId)` method to db.ts with cascade delete
- [x] 1.2 Add DELETE /api/agents/:id endpoint to agents.ts route

## 2. Server API - Delete Provider

- [x] 2.1 Add `deleteProvider(provider)` method to db.ts with cascade delete
- [x] 2.2 Add DELETE /api/providers/:provider endpoint (create providers.ts route if needed)

## 3. Dashboard - Delete Agent

- [x] 3.1 Add Delete Agent button to AgentDetail.tsx
- [x] 3.2 Add confirmation dialog and delete handler
- [x] 3.3 Navigate to /agents after successful deletion

## 4. Dashboard - Delete Provider

- [x] 4.1 Add Delete Provider button to ProviderDetail.tsx
- [x] 4.2 Add confirmation dialog and delete handler
- [x] 4.3 Navigate to /providers after successful deletion
