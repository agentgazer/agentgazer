## ADDED Requirements

### Requirement: Homebrew formula for agentgazer
A Homebrew formula SHALL be provided so users can install AgentGazer via `brew install agentgazer/tap/agentgazer` (or `brew tap agentgazer/tap && brew install agentgazer`).

#### Scenario: Fresh Homebrew install
- **GIVEN** the user has Homebrew installed
- **WHEN** the user runs `brew install agentgazer/tap/agentgazer`
- **THEN** Homebrew installs Node.js (as a dependency), installs the agentgazer npm package, and the `agentgazer` command is available in PATH

#### Scenario: Node.js already installed via Homebrew
- **GIVEN** the user already has `node@22` installed via Homebrew
- **WHEN** the user runs `brew install agentgazer/tap/agentgazer`
- **THEN** Homebrew skips Node.js installation and installs only agentgazer

### Requirement: Homebrew tap repository structure
The project SHALL include a `homebrew/` directory with the formula file that can be published as a Homebrew tap repository.

#### Scenario: Tap directory structure
- **WHEN** a maintainer checks the `homebrew/` directory
- **THEN** it contains `Formula/agentgazer.rb` with correct metadata (desc, homepage, url, sha256, depends_on, install method)

### Requirement: Formula installs working CLI
The formula SHALL produce a working `agentgazer` binary that can run all subcommands (start, status, providers, etc.).

#### Scenario: Post-install verification
- **GIVEN** agentgazer was installed via Homebrew
- **WHEN** the user runs `agentgazer --version`
- **THEN** it prints the version number without errors

### Requirement: Homebrew uninstall
Uninstalling via `brew uninstall agentgazer` SHALL remove the CLI binary and npm-installed files. It SHALL NOT remove `~/.agentgazer/` (user data).

#### Scenario: Brew uninstall
- **WHEN** the user runs `brew uninstall agentgazer`
- **THEN** the `agentgazer` binary is removed, but `~/.agentgazer/config.json` and `~/.agentgazer/data.db` are preserved
