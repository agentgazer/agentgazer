## MODIFIED Requirements

### Requirement: Unified CLI entry point
The package SHALL export a bin command `agentgazer` that starts the local API server, LLM proxy, and serves the dashboard — all in a single Node.js process. The command SHALL be runnable via `npx agentgazer`. On startup, the CLI SHALL initialize the secret store, prompt for a passphrase if the encrypted-file backend is active, and load provider keys from the secret store into memory before starting the proxy.

#### Scenario: Default startup
- **WHEN** the user runs `npx agentgazer`
- **THEN** the server starts on port 8080 (API + dashboard), the proxy starts on port 4000, and the terminal displays the dashboard URL, proxy URL, and auth token

#### Scenario: Startup with encrypted-file backend
- **WHEN** the user runs `agentgazer start` and the encrypted-file backend is active
- **THEN** the CLI SHALL prompt for the passphrase, decrypt provider keys, then start the server and proxy with keys in memory

#### Scenario: Startup with passphrase env var
- **WHEN** the user runs `AGENTTRACE_PASSPHRASE=xxx agentgazer start`
- **THEN** the CLI SHALL use the env var as passphrase without prompting and start normally

#### Scenario: Startup output
- **WHEN** the CLI starts successfully
- **THEN** the terminal prints:
  ```
  AgentGazer running:
    Dashboard: http://localhost:8080
    Proxy:     http://localhost:4000
    Token:     <hex-token>
  ```

## ADDED Requirements

### Requirement: Providers set writes to secret store
The `agentgazer providers set <name> <key>` command SHALL write the API key to the active secret store instead of to `config.json`. Non-secret provider configuration (rate limits) SHALL remain in `config.json`.

#### Scenario: Set provider key with encrypted-file backend
- **WHEN** the user runs `agentgazer providers set openai sk-xxx` and the encrypted-file backend is active
- **THEN** the CLI SHALL prompt for the passphrase (or use env var), encrypt and store the key in `secrets.enc`, and store only non-secret config in `config.json`

#### Scenario: Set provider key with keychain backend
- **WHEN** the user runs `agentgazer providers set openai sk-xxx` on macOS with GUI session
- **THEN** the CLI SHALL store the key in macOS Keychain and store only non-secret config in `config.json`

### Requirement: Providers remove deletes from secret store
The `agentgazer providers remove <name>` command SHALL delete the API key from the active secret store in addition to removing the provider entry from `config.json`.

#### Scenario: Remove provider
- **WHEN** the user runs `agentgazer providers remove openai`
- **THEN** the key SHALL be removed from the secret store and the provider entry removed from `config.json`

### Requirement: Onboard writes to secret store
The `agentgazer onboard` interactive setup SHALL write provider API keys to the active secret store. If using the encrypted-file backend, the user SHALL be prompted to create a passphrase before any keys are stored.

#### Scenario: Onboard with encrypted-file backend
- **WHEN** the user runs `agentgazer onboard` and enters API keys for providers
- **THEN** the CLI SHALL prompt for a new passphrase (with confirmation), encrypt all entered keys, and store them in `secrets.enc`

### Requirement: Auto-migration on start
The `agentgazer start` command SHALL check for plaintext `apiKey` fields in `config.json` and migrate them to the secret store before starting services. The user SHALL be informed of the migration.

#### Scenario: Migration triggered
- **WHEN** `agentgazer start` detects plaintext keys in `config.json`
- **THEN** the CLI SHALL print "Found plaintext API keys in config.json. Migrating to secure storage..." and perform migration

#### Scenario: No migration needed
- **WHEN** `agentgazer start` finds no plaintext keys in `config.json`
- **THEN** no migration message is shown and startup proceeds normally
