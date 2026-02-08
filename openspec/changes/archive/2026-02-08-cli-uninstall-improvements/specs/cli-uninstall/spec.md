## ADDED Requirements

### Requirement: Interactive uninstall menu
The CLI SHALL display an interactive menu when `agentgazer uninstall` is run without flags.

#### Scenario: Show menu options
- **WHEN** user runs `agentgazer uninstall` without flags
- **THEN** display menu with 5 options:
  1. Complete uninstall (everything)
  2. Binary only (npm/homebrew)
  3. Config only
  4. Provider keys only
  5. Agent data only

### Requirement: Complete uninstall
The CLI SHALL remove all AgentGazer data when option 1 or `--all` flag is used.

#### Scenario: Complete uninstall
- **WHEN** user selects option 1 or runs `agentgazer uninstall --all`
- **THEN** stop daemon if running
- **AND** remove all provider keys from secret store
- **AND** remove `~/.agentgazer/config.json`
- **AND** remove `~/.agentgazer/data.db`
- **AND** remove `~/.agentgazer/agentgazer.log`
- **AND** remove `~/.agentgazer/agentgazer.pid`
- **AND** display npm/brew uninstall command for binary removal

### Requirement: Binary only uninstall
The CLI SHALL show npm/brew uninstall commands when option 2 is selected.

#### Scenario: Show binary removal command
- **WHEN** user selects option 2
- **THEN** display `npm uninstall -g @agentgazer/cli`
- **AND** display `brew uninstall agentgazer` as alternative

### Requirement: Config only uninstall
The CLI SHALL remove only config when option 3 or `--config` flag is used.

#### Scenario: Remove config
- **WHEN** user selects option 3 or runs `agentgazer uninstall --config`
- **THEN** remove `~/.agentgazer/config.json`
- **AND** confirm deletion

### Requirement: Provider keys only uninstall
The CLI SHALL remove only provider keys when option 4 or `--keys` flag is used.

#### Scenario: Remove provider keys
- **WHEN** user selects option 4 or runs `agentgazer uninstall --keys`
- **THEN** list all provider keys from secret store
- **AND** remove each key
- **AND** show which keys were removed

### Requirement: Agent data only uninstall
The CLI SHALL remove only agent data when option 5 or `--data` flag is used.

#### Scenario: Remove agent data
- **WHEN** user selects option 5 or runs `agentgazer uninstall --data`
- **THEN** remove `~/.agentgazer/data.db`
- **AND** confirm deletion

### Requirement: Stop daemon before cleanup
The CLI SHALL stop the running daemon before performing cleanup operations.

#### Scenario: Daemon is running
- **WHEN** uninstall is triggered (options 1, 3, 4, or 5)
- **AND** daemon is running
- **THEN** stop the daemon first
- **AND** show "Stopping AgentGazer daemon... done"

### Requirement: Confirmation before destructive actions
The CLI SHALL ask for confirmation before deleting data (except binary-only option).

#### Scenario: Confirm before delete
- **WHEN** user selects options 1, 3, 4, or 5
- **THEN** show what will be deleted
- **AND** ask "Continue? [y/N]"
- **AND** only proceed if user confirms
