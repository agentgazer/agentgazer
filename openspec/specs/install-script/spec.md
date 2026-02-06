## ADDED Requirements

### Requirement: Install script downloads and sets up AgentGazer
The install script (`install.sh`) SHALL detect the user's platform, ensure Node.js >= 18 is available (downloading it if needed), install `agentgazer` via npm into `~/.agentgazer/lib/`, and create a wrapper script at `/usr/local/bin/agentgazer`.

#### Scenario: User has no Node.js installed
- **GIVEN** the user's system has no `node` binary in PATH
- **WHEN** the user runs `curl -fsSL <url>/install.sh | sh`
- **THEN** the script downloads a Node.js LTS binary to `~/.agentgazer/node/`, installs agentgazer to `~/.agentgazer/lib/`, creates a wrapper at `/usr/local/bin/agentgazer`, and prints a success message

#### Scenario: User has Node.js >= 18
- **GIVEN** the user has `node` >= 18 in PATH
- **WHEN** the user runs the install script
- **THEN** the script skips the Node.js download, uses the system node for npm install, and creates the same wrapper script

#### Scenario: User has Node.js < 18
- **GIVEN** the user has `node` in PATH but version < 18
- **WHEN** the user runs the install script
- **THEN** the script downloads Node.js LTS to `~/.agentgazer/node/` and uses it instead of the system node

### Requirement: Platform detection
The install script SHALL support `darwin-arm64`, `darwin-x64`, `linux-x64`, and `linux-arm64`. Unsupported platforms SHALL cause the script to exit with a clear error message.

#### Scenario: Unsupported platform
- **GIVEN** the user is on an unsupported OS or architecture (e.g., Windows, FreeBSD)
- **WHEN** the user runs the install script
- **THEN** the script prints an error listing supported platforms and exits with code 1

### Requirement: Wrapper script resolves Node.js correctly
The wrapper script at `/usr/local/bin/agentgazer` SHALL prefer the embedded Node.js at `~/.agentgazer/node/bin/node` if it exists, otherwise fall back to the system `node`.

#### Scenario: Embedded node exists
- **GIVEN** `~/.agentgazer/node/bin/node` exists and is executable
- **WHEN** the user runs `agentgazer <command>`
- **THEN** the wrapper uses the embedded node to execute the CLI

#### Scenario: Only system node exists
- **GIVEN** `~/.agentgazer/node/` does not exist but system `node` is available
- **WHEN** the user runs `agentgazer <command>`
- **THEN** the wrapper uses the system node to execute the CLI

### Requirement: Idempotent installation
The install script SHALL be safe to run multiple times. Re-running SHALL update the installation without duplicating files or breaking configuration.

#### Scenario: Re-run install
- **WHEN** the user runs the install script on a system that already has AgentGazer installed
- **THEN** the script overwrites `~/.agentgazer/lib/` and the wrapper script, preserves `~/.agentgazer/config.json` and `~/.agentgazer/data.db`, and prints a success message

### Requirement: Uninstall script
An uninstall script (`uninstall.sh`) SHALL remove `~/.agentgazer/node/`, `~/.agentgazer/lib/`, and the wrapper at `/usr/local/bin/agentgazer`. It SHALL prompt before removing user data (`config.json`, `data.db`).

#### Scenario: Clean uninstall preserving data
- **WHEN** the user runs the uninstall script and answers "no" to removing data
- **THEN** `~/.agentgazer/node/` and `~/.agentgazer/lib/` are removed, the wrapper script is removed, but `~/.agentgazer/config.json` and `~/.agentgazer/data.db` are preserved

#### Scenario: Full uninstall
- **WHEN** the user runs the uninstall script and answers "yes" to removing data
- **THEN** the entire `~/.agentgazer/` directory and the wrapper script are removed

### Requirement: Sudo handling
The install script SHALL attempt to write the wrapper to `/usr/local/bin/` without sudo first. If it fails due to permissions, it SHALL prompt the user and retry with `sudo`.

#### Scenario: /usr/local/bin is writable
- **GIVEN** the user has write permission to `/usr/local/bin/`
- **WHEN** the install script creates the wrapper
- **THEN** no sudo prompt is shown

#### Scenario: /usr/local/bin requires sudo
- **GIVEN** the user does not have write permission to `/usr/local/bin/`
- **WHEN** the install script attempts to create the wrapper
- **THEN** the script prints a message and runs `sudo` to install the wrapper
