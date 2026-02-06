## MODIFIED Requirements

### Requirement: Add uninstall subcommand
The CLI SHALL support an `agentgazer uninstall` subcommand that removes the curl-installed files (`~/.agentgazer/node/`, `~/.agentgazer/lib/`, wrapper script) and optionally removes user data.

#### Scenario: Uninstall preserving data
- **WHEN** the user runs `agentgazer uninstall`
- **THEN** the CLI prompts "Remove user data (~/.agentgazer/config.json, data.db)? [y/N]"
- **AND** if the user answers "N", removes `~/.agentgazer/node/`, `~/.agentgazer/lib/`, and `/usr/local/bin/agentgazer` but preserves config and data files

#### Scenario: Uninstall with --yes flag
- **WHEN** the user runs `agentgazer uninstall --yes`
- **THEN** the CLI removes everything including user data without prompting

#### Scenario: Uninstall when installed via npm
- **GIVEN** agentgazer was installed via `npm install -g` (no `~/.agentgazer/lib/` exists)
- **WHEN** the user runs `agentgazer uninstall`
- **THEN** the CLI prints a message saying "AgentGazer was installed via npm. Use `npm uninstall -g agentgazer` to remove it." and exits
