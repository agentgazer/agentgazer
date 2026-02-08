## Why

OpenClaw users need to manually edit `~/.openclaw/openclaw.json` to integrate with AgentGazer proxy, which is error-prone and confusing. A Dashboard feature can auto-generate the correct configuration, making integration seamless.

## What Changes

- Add new Dashboard page "OpenClaw Integration" under settings/tools section
- Server API endpoint to read/write OpenClaw config file (`~/.openclaw/openclaw.json`)
- Auto-generate `models` configuration pointing to AgentGazer proxy endpoints
- Handle case where `models` key doesn't exist (create it)
- Preserve other OpenClaw config keys when updating
- **Step 2: Default model selection** - Let users pick primary/secondary models from configured providers
  - Dropdown to select models (easy for beginners)
  - Copy-able CLI command shown (for users who prefer manual control)
  - Write to `agents.defaults.model.primary/secondary` in same config file

## Capabilities

### New Capabilities
- `openclaw-integration`: Dashboard UI and server API to configure OpenClaw to use AgentGazer proxy. Reads/writes `~/.openclaw/openclaw.json`, focusing on the `models` key.

### Modified Capabilities
<!-- No existing spec requirements are changing -->

## Impact

- **Dashboard**: New page component for OpenClaw integration
- **Server**: New API routes `/api/openclaw/config` (GET/PUT)
- **Dependencies**: None - reads/writes JSON file directly
- **File system**: Reads/writes `~/.openclaw/openclaw.json`
