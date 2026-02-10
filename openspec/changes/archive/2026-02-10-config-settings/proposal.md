## Why

Users currently need to specify CLI flags (--port, --proxy-port, etc.) every time they run `agentgazer start`. There's no way to persist these preferences, forcing repetitive typing especially when default ports conflict with other services.

## What Changes

- Add support for persistent configuration options in `~/.agentgazer/config.json`
- CLI reads config file and uses values as defaults (CLI flags still override)
- Initial config options: `port`, `proxyPort`, `autoOpen`, `retentionDays`

## Capabilities

### New Capabilities
- `config-persistence`: Support for persistent user preferences in config.json, with CLI flag override precedence

### Modified Capabilities
<!-- No existing specs need requirement changes -->

## Impact

- `packages/cli/src/config.ts`: Add new fields to AgentGazerConfig interface
- `packages/cli/src/cli.ts`: Read config values as defaults for start command
- Documentation: Update docs to explain config options
