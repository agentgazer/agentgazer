## 1. Server API

- [x] 1.1 Create `packages/server/src/routes/openclaw.ts` with `createOpenclawRouter()` function
- [x] 1.2 Implement `GET /api/openclaw/config` - read and parse `~/.openclaw/openclaw.json`
- [x] 1.3 Implement `PUT /api/openclaw/config` - update `models` key, preserve other keys
- [x] 1.4 Add `requireLoopback` middleware to both endpoints
- [x] 1.5 Register the router in `packages/server/src/server.ts`

## 2. Dashboard Page

- [x] 2.1 Create `apps/dashboard-local/src/pages/OpenClawPage.tsx` page component
- [x] 2.2 Add "OpenClaw" item to navigation in `Layout.tsx`
- [x] 2.3 Add route to `App.tsx` for `/openclaw`
- [x] 2.4 Implement provider config generation logic (map providers to OpenClaw format)
- [x] 2.5 Display current OpenClaw config and generated config preview
- [x] 2.6 Add "Apply Configuration" button that calls `PUT /api/openclaw/config`
- [x] 2.7 Show success/error messages after applying

## 3. Default Model Selection (Step 2)

- [x] 3.1 Update `GET /api/openclaw/config` to also return `agents` key
- [x] 3.2 Update `PUT /api/openclaw/config` to accept optional `agents` key
- [x] 3.3 Add model dropdown UI - list models from configured providers (`PROVIDER_MODELS`)
- [x] 3.4 Add primary model selector with format `<provider-alias>/<model-id>`
- [x] 3.5 Add optional secondary model selector
- [x] 3.6 Add "Apply" button that writes `agents.defaults.model` to config
- [x] 3.7 Show copy-able CLI command: `openclaw config set agents.defaults.model.primary "..."`
- [x] 3.8 Add copy button for CLI command

## 4. Testing

- [x] 4.1 Test with no OpenClaw config file
- [x] 4.2 Test with existing config file without `models` key
- [x] 4.3 Test with existing config file with `models` key
- [x] 4.4 Test Apply Configuration updates file correctly
- [x] 4.5 Test default model apply writes to `agents.defaults.model`
- [x] 4.6 Test copy button copies correct command
