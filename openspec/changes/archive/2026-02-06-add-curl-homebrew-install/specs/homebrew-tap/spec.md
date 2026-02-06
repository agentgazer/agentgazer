## ADDED Requirements

### Requirement: Homebrew formula for agenttrace
A Homebrew formula SHALL be provided so users can install AgentTrace via `brew install agenttrace/tap/agenttrace` (or `brew tap agenttrace/tap && brew install agenttrace`).

#### Scenario: Fresh Homebrew install
- **GIVEN** the user has Homebrew installed
- **WHEN** the user runs `brew install agenttrace/tap/agenttrace`
- **THEN** Homebrew installs Node.js (as a dependency), installs the agenttrace npm package, and the `agenttrace` command is available in PATH

#### Scenario: Node.js already installed via Homebrew
- **GIVEN** the user already has `node@22` installed via Homebrew
- **WHEN** the user runs `brew install agenttrace/tap/agenttrace`
- **THEN** Homebrew skips Node.js installation and installs only agenttrace

### Requirement: Homebrew tap repository structure
The project SHALL include a `homebrew/` directory with the formula file that can be published as a Homebrew tap repository.

#### Scenario: Tap directory structure
- **WHEN** a maintainer checks the `homebrew/` directory
- **THEN** it contains `Formula/agenttrace.rb` with correct metadata (desc, homepage, url, sha256, depends_on, install method)

### Requirement: Formula installs working CLI
The formula SHALL produce a working `agenttrace` binary that can run all subcommands (start, status, providers, etc.).

#### Scenario: Post-install verification
- **GIVEN** agenttrace was installed via Homebrew
- **WHEN** the user runs `agenttrace --version`
- **THEN** it prints the version number without errors

### Requirement: Homebrew uninstall
Uninstalling via `brew uninstall agenttrace` SHALL remove the CLI binary and npm-installed files. It SHALL NOT remove `~/.agenttrace/` (user data).

#### Scenario: Brew uninstall
- **WHEN** the user runs `brew uninstall agenttrace`
- **THEN** the `agenttrace` binary is removed, but `~/.agenttrace/config.json` and `~/.agenttrace/data.db` are preserved
