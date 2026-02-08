## Why

Current `agentgazer uninstall` just shows a message suggesting npm/brew commands, but doesn't actually clean up:
- Provider API keys remain in keychain/libsecret/encrypted file
- Config and data files remain in `~/.agentgazer/`
- Running daemon processes aren't stopped

This leaves sensitive data behind and is poor UX.

## What Changes

- Interactive uninstall menu with 5 options:
  1. Complete uninstall (everything + show binary removal command)
  2. Binary only (show npm/brew command)
  3. Config only (`~/.agentgazer/config.json`)
  4. Provider keys only (from secret store)
  5. Agent data only (`~/.agentgazer/data.db`)
- CLI flags for scripting: `--all`, `--config`, `--keys`, `--data`
- Stop daemon before cleanup if running
- Show what will be removed and ask for confirmation

## Capabilities

### New Capabilities
- `cli-uninstall`: Interactive and flag-based uninstall command with modular cleanup options

### Modified Capabilities
<!-- No existing spec requirements are changing -->

## Impact

- **CLI**: Enhanced `uninstall` subcommand in `packages/cli/src/cli.ts`
- **Secret Store**: Use existing `list()` and `delete()` methods
- **File System**: Delete files in `~/.agentgazer/`
