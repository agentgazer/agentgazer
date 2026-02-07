# Tasks: Provider Management Dashboard

## Backend (packages/server)

- [x] Add `provider_models` table to db.ts schema
- [x] Add `provider_settings` table to db.ts schema:
  - `provider` TEXT PRIMARY KEY
  - `active` INTEGER DEFAULT 1
  - `rate_limit_max_requests` INTEGER
  - `rate_limit_window_seconds` INTEGER
- [x] Create `src/routes/providers.ts` with:
  - [x] GET `/api/providers` — list providers with connection status
  - [x] POST `/api/providers` — add new provider (loopback only)
  - [x] DELETE `/api/providers/:name` — remove provider (loopback only)
  - [x] POST `/api/providers/:name/validate` — validate API key
  - [x] GET `/api/providers/:name/models` — list models (built-in + custom)
  - [x] POST `/api/providers/:name/models` — add custom model
  - [x] DELETE `/api/providers/:name/models/:modelId` — remove custom model
  - [x] POST `/api/providers/:name/models/:modelId/test` — test model exists
  - [x] GET `/api/providers/:name/stats` — usage & cost stats
  - [x] GET `/api/providers/:name/settings` — get provider settings
  - [x] PATCH `/api/providers/:name/settings` — update active, rate limit
- [x] Add provider validation logic in `src/services/provider-validator.ts`:
  - [x] OpenAI: GET /v1/models (free)
  - [x] Anthropic: POST /v1/messages with haiku + max_tokens=1
  - [x] Google: GET /v1/models (free)
  - [x] Mistral/Cohere/DeepSeek: GET /v1/models (free)
  - [x] Fallback: minimal request for unknown providers
- [x] Register routes in server.ts
- [x] Add loopback detection middleware:
  - [x] `isLoopback(req)` helper function
  - [x] Return 403 for sensitive endpoints when accessed from LAN
- [x] Add `GET /api/connection-info` endpoint — returns `{ isLoopback: boolean }`
- [x] Move `secret-store.ts` to shared or make it importable by server

## Proxy (packages/proxy)

- [x] Add provider-level rate limit check before forwarding request
- [x] Add provider active check — block if provider is deactivated
- [x] Return appropriate error response when provider is blocked/rate-limited

## CLI (packages/cli)

- [x] Add validation step to `providers set` command:
  - [x] After user enters key, call validation endpoint
  - [x] Show success/failure message
  - [x] Allow save even if validation fails (with warning)

## Dashboard (apps/dashboard-local)

- [x] Add Providers page (`src/pages/Providers.tsx`):
  - [x] Grid of provider cards
  - [x] Each card shows: icon, name, status badge, last checked time
  - [x] Click → navigate to `/providers/:name`
  - [x] "Add Provider" button:
    - [x] Loopback: enabled, opens add modal
    - [x] LAN: disabled (grayed out) with tooltip "Only available from localhost for API key security"
  - [x] Add Provider modal:
    - [x] Provider dropdown (supported providers list)
    - [x] API key input (password field)
    - [x] "Test & Save" button → validate then save
- [x] Add Provider Detail page (`src/pages/ProviderDetail.tsx`):
  - [x] Header with provider name, status, "Test Connection" button
  - [x] Settings section:
    - [x] Active toggle (on/off) — deactivated providers block all requests
    - [x] Rate limit config (max requests / window seconds)
    - [x] Save button to apply changes
  - [x] Models section:
    - [x] List known + custom models with verified badge
    - [x] Input field + "Test & Add" button for new models
    - [x] Delete button for custom models
  - [x] Stats section:
    - [x] Cards: total requests, tokens, cost
    - [x] Time range filter (1h, 24h, 7d, 30d)
    - [x] Recharts: requests trend, cost by model pie chart
- [x] Add navigation link to sidebar
- [x] Add API client functions in `src/api.ts`
- [x] Fetch `/api/connection-info` on app load, store `isLoopback` in context
- [x] Use `isLoopback` to control Add Provider button state

## Shared (packages/shared)

- [x] Export provider model lists from `models.ts` for dashboard use
- [x] Add provider validation endpoint types to `types.ts`

## Documentation

- [x] Update `apps/docs/en/guide/dashboard.md` with Providers page docs
- [x] Update `apps/docs/zh/guide/dashboard.md` (Chinese translation)
