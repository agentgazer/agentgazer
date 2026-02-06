## MODIFIED Requirements

### Requirement: Add uninstall subcommand
The CLI SHALL support an `agenttrace uninstall` subcommand that removes the curl-installed files (`~/.agenttrace/node/`, `~/.agenttrace/lib/`, wrapper script) and optionally removes user data.

#### Scenario: Uninstall preserving data
- **WHEN** the user runs `agenttrace uninstall`
- **THEN** the CLI prompts "Remove user data (~/.agenttrace/config.json, data.db)? [y/N]"
- **AND** if the user answers "N", removes `~/.agenttrace/node/`, `~/.agenttrace/lib/`, and `/usr/local/bin/agenttrace` but preserves config and data files

#### Scenario: Uninstall with --yes flag
- **WHEN** the user runs `agenttrace uninstall --yes`
- **THEN** the CLI removes everything including user data without prompting

#### Scenario: Uninstall when installed via npm
- **GIVEN** agenttrace was installed via `npm install -g` (no `~/.agenttrace/lib/` exists)
- **WHEN** the user runs `agenttrace uninstall`
- **THEN** the CLI prints a message saying "AgentTrace was installed via npm. Use `npm uninstall -g agenttrace` to remove it." and exits
