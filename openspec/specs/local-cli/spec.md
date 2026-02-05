## ADDED Requirements

### Requirement: Unified CLI entry point
The package SHALL export a bin command `agenttrace` that starts the local API server, LLM proxy, and serves the dashboard — all in a single Node.js process. The command SHALL be runnable via `npx agenttrace`. On startup, the CLI SHALL initialize the secret store, prompt for a passphrase if the encrypted-file backend is active, and load provider keys from the secret store into memory before starting the proxy.

#### Scenario: Default startup
- **WHEN** the user runs `npx agenttrace`
- **THEN** the server starts on port 8080 (API + dashboard), the proxy starts on port 4000, and the terminal displays the dashboard URL, proxy URL, and auth token

#### Scenario: Startup with encrypted-file backend
- **WHEN** the user runs `agenttrace start` and the encrypted-file backend is active
- **THEN** the CLI SHALL prompt for the passphrase, decrypt provider keys, then start the server and proxy with keys in memory

#### Scenario: Startup with passphrase env var
- **WHEN** the user runs `AGENTTRACE_PASSPHRASE=xxx agenttrace start`
- **THEN** the CLI SHALL use the env var as passphrase without prompting and start normally

#### Scenario: Startup output
- **WHEN** the CLI starts successfully
- **THEN** the terminal prints:
  ```
  AgentTrace running:
    Dashboard: http://localhost:8080
    Proxy:     http://localhost:4000
    Token:     <hex-token>
  ```

### Requirement: Port configuration
The CLI SHALL accept `--port <number>` for the server/dashboard port (default: 8080) and `--proxy-port <number>` for the proxy port (default: 4000).

#### Scenario: Custom ports
- **WHEN** the user runs `npx agenttrace --port 9090 --proxy-port 5000`
- **THEN** the server starts on port 9090 and the proxy on port 5000

#### Scenario: Port conflict
- **WHEN** the specified port is already in use
- **THEN** the CLI prints an error message and exits with code 1

### Requirement: Data directory initialization
The CLI SHALL ensure `~/.agenttrace/` exists on startup. If the directory does not exist, it SHALL be created. The config file (`config.json`) and database (`data.db`) SHALL reside in this directory.

#### Scenario: First run creates directory
- **WHEN** the CLI starts and `~/.agenttrace/` does not exist
- **THEN** the directory is created with `config.json` (containing generated token) and empty `data.db`

### Requirement: Auto-open browser
The CLI SHALL open the dashboard URL in the default browser on startup. This behavior SHALL be suppressible with a `--no-open` flag.

#### Scenario: Browser opens automatically
- **WHEN** the user runs `npx agenttrace` without `--no-open`
- **THEN** the default browser opens `http://localhost:8080`

#### Scenario: Browser opening suppressed
- **WHEN** the user runs `npx agenttrace --no-open`
- **THEN** the browser does not open automatically

### Requirement: Graceful shutdown
The CLI SHALL handle SIGINT (Ctrl+C) and SIGTERM signals by: flushing the proxy event buffer, closing the HTTP server, closing the SQLite database, then exiting with code 0.

#### Scenario: Ctrl+C shutdown
- **WHEN** the user presses Ctrl+C
- **THEN** the terminal prints "Shutting down..." and the process exits cleanly after flushing events and closing connections

### Requirement: Help flag
The CLI SHALL accept `--help` and print usage information listing all available flags.

#### Scenario: Help output
- **WHEN** the user runs `npx agenttrace --help`
- **THEN** usage information is printed showing all flags: `--port`, `--proxy-port`, `--no-open`, `--reset-token`, `--help`

### Requirement: Token reset flag

The CLI SHALL provide a `reset-token` command that regenerates the auth token. The command MUST preserve all existing configuration (providers, rate limits) and only replace the `token` field.

#### Scenario: Reset token preserves providers
- **WHEN** user runs `agenttrace reset-token` with existing providers configured
- **THEN** a new 64-character hex token is generated
- **AND** all existing provider configurations (rate limits, etc.) are preserved in config.json

#### Scenario: Reset token with no prior config
- **WHEN** user runs `agenttrace reset-token` with no existing config file
- **THEN** a new config is created with only the generated token

### Requirement: Providers set writes to secret store
The `agenttrace providers set <name> <key>` command SHALL write the API key to the active secret store instead of to `config.json`. Non-secret provider configuration (rate limits) SHALL remain in `config.json`.

#### Scenario: Set provider key with encrypted-file backend
- **WHEN** the user runs `agenttrace providers set openai sk-xxx` and the encrypted-file backend is active
- **THEN** the CLI SHALL prompt for the passphrase (or use env var), encrypt and store the key in `secrets.enc`, and store only non-secret config in `config.json`

#### Scenario: Set provider key with keychain backend
- **WHEN** the user runs `agenttrace providers set openai sk-xxx` on macOS with GUI session
- **THEN** the CLI SHALL store the key in macOS Keychain and store only non-secret config in `config.json`

### Requirement: Providers remove deletes from secret store
The `agenttrace providers remove <name>` command SHALL delete the API key from the active secret store in addition to removing the provider entry from `config.json`.

#### Scenario: Remove provider
- **WHEN** the user runs `agenttrace providers remove openai`
- **THEN** the key SHALL be removed from the secret store and the provider entry removed from `config.json`

### Requirement: Onboard writes to secret store
The `agenttrace onboard` interactive setup SHALL write provider API keys to the active secret store. If using the encrypted-file backend, the user SHALL be prompted to create a passphrase before any keys are stored.

#### Scenario: Onboard with encrypted-file backend
- **WHEN** the user runs `agenttrace onboard` and enters API keys for providers
- **THEN** the CLI SHALL prompt for a new passphrase (with confirmation), encrypt all entered keys, and store them in `secrets.enc`

### Requirement: Auto-migration on start
The `agenttrace start` command SHALL check for plaintext `apiKey` fields in `config.json` and migrate them to the secret store before starting services. The user SHALL be informed of the migration.

#### Scenario: Migration triggered
- **WHEN** `agenttrace start` detects plaintext keys in `config.json`
- **THEN** the CLI SHALL print "Found plaintext API keys in config.json. Migrating to secure storage..." and perform migration

#### Scenario: No migration needed
- **WHEN** `agenttrace start` finds no plaintext keys in `config.json`
- **THEN** no migration message is shown and startup proceeds normally

### Requirement: Stats command positional argument parsing

The `stats` subcommand MUST correctly extract the positional agent ID argument regardless of flag positioning. Flags (`--flag value` pairs) SHALL be filtered out before extracting the positional argument.

#### Scenario: Agent ID after flags
- **WHEN** user runs `agenttrace stats --port 9090 my-agent`
- **THEN** the agent ID is resolved as `my-agent`
- **AND** the port flag is parsed as `9090`

#### Scenario: Agent ID before flags
- **WHEN** user runs `agenttrace stats my-agent --range 7d`
- **THEN** the agent ID is resolved as `my-agent`
- **AND** the range flag is parsed as `7d`

#### Scenario: No agent ID with flags
- **WHEN** user runs `agenttrace stats --port 9090` with only one registered agent
- **THEN** the single agent is auto-selected
