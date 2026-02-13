# Tasks: Payload Storage

## packages/proxy

- [x] Create `payload-buffer.ts` with rolling buffer per agent
- [x] Add pushPayload call in proxy-server.ts after successful response
- [x] Add extractPayloads call when kill switch triggers
- [x] Export payload buffer functions from index.ts
- [x] Add tests for payload-buffer.ts

## packages/server

- [x] Create `payload-store.ts` with separate DB management
- [x] Implement batch write mechanism with flush timer
- [x] Add saveEvidence function for kill switch
- [x] Add cleanup function for retention
- [x] Create `routes/payloads.ts` with API endpoints
- [x] Register payloads routes in server.ts
- [x] Add payload store initialization in server startup
- [x] Add daily cleanup job for archive retention
- [x] Add tests for payload-store.ts
- [x] Add tests for payloads routes

## packages/cli

- [x] Add PayloadConfig type to config.ts
- [x] Add DEFAULT_PAYLOAD_CONFIG
- [x] Add getPayloadConfig helper function
- [x] Update settings route to include payload config
- [x] Add payload DB path to getDbPath or new helper

## apps/dashboard-local

- [x] Add Payload Storage section to SettingsPage
- [x] Add toggle for enabled
- [x] Add input for retentionDays
- [x] Display current DB size
- [x] Add Clear Archive button
- [x] Add warning about sensitive data

## Integration

- [x] Update proxy to POST /api/payloads when archive enabled
- [x] Update proxy to POST /api/payloads/evidence on kill switch
- [x] Add kill switch evidence view in dashboard (implemented in Incidents page)
