## ADDED Requirements

### Requirement: CLI supports subcommands
The CLI SHALL accept a subcommand as the first positional argument. Supported subcommands: `onboard`, `start`, `status`, `reset-token`. Running `agenttrace` with no subcommand or with `--help` SHALL print usage showing all subcommands.

#### Scenario: Start subcommand launches services
- **WHEN** user runs `agenttrace start`
- **THEN** the server, proxy, and dashboard SHALL start on configured ports

#### Scenario: Start with port overrides
- **WHEN** user runs `agenttrace start --port 9090 --proxy-port 5000`
- **THEN** server SHALL listen on 9090 and proxy on 5000

#### Scenario: Status subcommand shows config
- **WHEN** user runs `agenttrace status`
- **THEN** the CLI SHALL print current config (ports, token prefix, db path, retention days)

#### Scenario: No subcommand shows help
- **WHEN** user runs `agenttrace` with no arguments
- **THEN** the CLI SHALL print usage listing all available subcommands

#### Scenario: Reset-token subcommand
- **WHEN** user runs `agenttrace reset-token`
- **THEN** a new token SHALL be generated and saved, and the new token SHALL be printed
