## 1. Database

- [x] 1.1 Add `agent_rate_limits` table to SQLite schema in `packages/server/src/db.ts`
- [x] 1.2 Add CRUD functions: `getRateLimits`, `setRateLimit`, `deleteRateLimit`

## 2. Server API

- [x] 2.1 Create `packages/server/src/routes/rate-limits.ts` with GET/PUT/DELETE endpoints
- [x] 2.2 Register routes in server.ts
- [x] 2.3 Add input validation for max_requests and window_seconds

## 3. Proxy Integration

- [x] 3.1 Add `loadRateLimitsFromDb` function in proxy to read from SQLite
- [x] 3.2 Add `updateConfigs` method to `RateLimiter` class
- [x] 3.3 Implement 30-second periodic refresh with setInterval
- [x] 3.4 Update proxy startup to load rate limits from db instead of config
- [x] 3.5 Update rate limit check to use (agent_id, provider) key

## 4. CLI Cleanup

- [x] 4.1 Remove rate limit prompt from `onboard` command
- [x] 4.2 Remove rate limit prompt from `providers set-api-key` command
- [x] 4.3 Remove `rateLimits` parameter from `startProxy` call in cli.ts
- [x] 4.4 Keep `ProviderRateLimit` type for backwards compatibility but mark as deprecated

## 5. Dashboard UI

- [x] 5.1 Create `RateLimitSettings.tsx` component
- [x] 5.2 Add API functions in `lib/api.ts` for rate limit CRUD
- [x] 5.3 Add RateLimitSettings to Agent Detail page below Model Settings
- [x] 5.4 Implement Add/Edit/Remove rate limit UI with Apply button

## 6. Testing & Verification

- [x] 6.1 Test API endpoints manually
- [x] 6.2 Test proxy rate limiting with new database-backed config
- [x] 6.3 Test Dashboard UI flow
- [x] 6.4 Build and verify no TypeScript errors
