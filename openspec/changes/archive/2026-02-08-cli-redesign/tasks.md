## 1. Setup and Dependencies

- [x] 1.1 Add ink, react, and ink-table dependencies to packages/cli/package.json
- [x] 1.2 Create packages/cli/src/commands/ directory structure for new commands
- [x] 1.3 Create packages/cli/src/tui/ directory structure for ink components
- [x] 1.4 Create packages/cli/src/utils/api.ts HTTP client for server API calls

## 2. Agent Management Commands

- [x] 2.1 Create agents.ts command to list all agents in table format
- [x] 2.2 Create agent.ts base command with subcommand routing
- [x] 2.3 Implement `agent <name> active` subcommand
- [x] 2.4 Implement `agent <name> deactive` subcommand
- [x] 2.5 Implement `agent <name> killswitch on|off` subcommand
- [x] 2.6 Implement `agent <name> delete` subcommand with confirmation
- [x] 2.7 Implement `agent <name> stat` subcommand with --range option
- [x] 2.8 Implement `agent <name> model` subcommand
- [x] 2.9 Implement `agent <name> model-override <model>` with interactive provider selection

## 3. Provider Management Commands

- [x] 3.1 Create providers.ts command to list all providers in table format
- [x] 3.2 Create provider.ts base command with subcommand routing
- [x] 3.3 Implement `provider add [provider] [key]` with flexible interactive mode
- [x] 3.4 Implement `provider <name> active` subcommand
- [x] 3.5 Implement `provider <name> deactive` subcommand
- [x] 3.6 Implement `provider <name> test-connection` subcommand
- [x] 3.7 Implement `provider <name> delete` subcommand with confirmation
- [x] 3.8 Implement `provider <name> models` subcommand
- [x] 3.9 Implement `provider <name> stat` subcommand with --range option

## 4. Overview TUI

- [x] 4.1 Create Overview.tsx main TUI component with ink
- [x] 4.2 Create StatusBar.tsx header component (uptime, requests, cost, server/proxy status)
- [x] 4.3 Create AgentTable.tsx component for agent list
- [x] 4.4 Create EventLog.tsx component for recent events
- [x] 4.5 Implement polling mechanism for real-time updates (2-3s interval)
- [x] 4.6 Implement keyboard shortcuts (Q/ESC exit, R refresh, A toggle active, ? help)
- [x] 4.7 Handle server connectivity states (not running, disconnected)
- [x] 4.8 Create overview.ts command that launches the ink TUI

## 5. CLI Integration

- [x] 5.1 Register all new commands in cli.ts
- [x] 5.2 Remove old `providers list/set/set-key/remove` commands
- [x] 5.3 Remove old `stats` command
- [x] 5.4 Update help text to reflect new command structure

## 6. Documentation

- [x] 6.1 Update EN CLI guide with new command structure
- [x] 6.2 Update ZH CLI guide with new command structure
