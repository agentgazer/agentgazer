## Why

The current CLI is fragmented and doesn't expose the full capabilities available in the Dashboard. Users must switch to the web UI for common operations like toggling agent status, managing kill switches, or viewing detailed stats. A unified CLI experience allows power users to manage AgentGazer entirely from the terminal, including a real-time htop-style overview.

## What Changes

- **BREAKING**: Remove `providers list/set/delete/test` subcommand structure
- Add `agentgazer overview` — htop-style TUI with real-time monitoring (uses `ink`)
- Add `agentgazer agents` — list all agents in table format
- Add `agentgazer agent <name>` subcommands:
  - `active` / `deactive` — toggle agent status
  - `killswitch on|off` — toggle kill switch
  - `delete` — delete agent
  - `stat` — display detailed statistics
  - `model` — list current models per provider
  - `model-override <model>` — set model override (interactive provider selection if multiple)
- Add `agentgazer providers` — list all providers in table format
- Add `agentgazer provider <name>` subcommands:
  - `add [provider] [key]` — add provider with API key (interactive if args omitted)
  - `active` / `deactive` — toggle provider status
  - `test-connection` — test API key validity
  - `delete` — delete provider
  - `models` — list available models
  - `stat` — display detailed statistics
- Remove deprecated `stats` command (replaced by `agent <name> stat` and `overview`)

## Capabilities

### New Capabilities
- `cli-agent-management`: CLI commands for agent lifecycle management (active/deactive, killswitch, delete, stat, model, model-override)
- `cli-provider-management`: CLI commands for provider lifecycle management (add, active/deactive, test-connection, delete, models, stat)
- `cli-overview-tui`: Real-time terminal UI dashboard using ink, showing agents, recent events, and system stats

### Modified Capabilities
- `local-cli`: Remove legacy `providers` subcommand structure, remove `stats` command, update help text

## Impact

- `packages/cli/src/cli.ts` — Major restructure of command routing
- `packages/cli/src/commands/` — New command files for agent/provider management
- `packages/cli/src/tui/` — New directory for ink-based overview TUI
- `packages/cli/package.json` — Add `ink` and `react` dependencies
- Documentation updates for new CLI structure
