## ADDED Requirements

### Requirement: Unified CLI entry point
The package SHALL export a bin command `agentwatch` that starts the local API server, LLM proxy, and serves the dashboard — all in a single Node.js process. The command SHALL be runnable via `npx agentwatch`.

#### Scenario: Default startup
- **WHEN** the user runs `npx agentwatch`
- **THEN** the server starts on port 8080 (API + dashboard), the proxy starts on port 4000, and the terminal displays the dashboard URL, proxy URL, and auth token

#### Scenario: Startup output
- **WHEN** the CLI starts successfully
- **THEN** the terminal prints:
  ```
  AgentWatch running:
    Dashboard: http://localhost:8080
    Proxy:     http://localhost:4000
    Token:     <hex-token>
  ```

### Requirement: Port configuration
The CLI SHALL accept `--port <number>` for the server/dashboard port (default: 8080) and `--proxy-port <number>` for the proxy port (default: 4000).

#### Scenario: Custom ports
- **WHEN** the user runs `npx agentwatch --port 9090 --proxy-port 5000`
- **THEN** the server starts on port 9090 and the proxy on port 5000

#### Scenario: Port conflict
- **WHEN** the specified port is already in use
- **THEN** the CLI prints an error message and exits with code 1

### Requirement: Data directory initialization
The CLI SHALL ensure `~/.agentwatch/` exists on startup. If the directory does not exist, it SHALL be created. The config file (`config.json`) and database (`data.db`) SHALL reside in this directory.

#### Scenario: First run creates directory
- **WHEN** the CLI starts and `~/.agentwatch/` does not exist
- **THEN** the directory is created with `config.json` (containing generated token) and empty `data.db`

### Requirement: Auto-open browser
The CLI SHALL open the dashboard URL in the default browser on startup. This behavior SHALL be suppressible with a `--no-open` flag.

#### Scenario: Browser opens automatically
- **WHEN** the user runs `npx agentwatch` without `--no-open`
- **THEN** the default browser opens `http://localhost:8080`

#### Scenario: Browser opening suppressed
- **WHEN** the user runs `npx agentwatch --no-open`
- **THEN** the browser does not open automatically

### Requirement: Graceful shutdown
The CLI SHALL handle SIGINT (Ctrl+C) and SIGTERM signals by: flushing the proxy event buffer, closing the HTTP server, closing the SQLite database, then exiting with code 0.

#### Scenario: Ctrl+C shutdown
- **WHEN** the user presses Ctrl+C
- **THEN** the terminal prints "Shutting down..." and the process exits cleanly after flushing events and closing connections

### Requirement: Help flag
The CLI SHALL accept `--help` and print usage information listing all available flags.

#### Scenario: Help output
- **WHEN** the user runs `npx agentwatch --help`
- **THEN** usage information is printed showing all flags: `--port`, `--proxy-port`, `--no-open`, `--reset-token`, `--help`

### Requirement: Token reset flag
The CLI SHALL accept `--reset-token` which regenerates the auth token, saves it to config, prints it, and exits (does not start the server).

#### Scenario: Token reset
- **WHEN** the user runs `npx agentwatch --reset-token`
- **THEN** a new token is generated, saved, printed, and the process exits
