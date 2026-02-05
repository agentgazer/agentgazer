# CLI Reference

## Command Overview

| Command | Description | Flags |
|---------|-------------|-------|
| `onboard` | Initial setup, generates Token, configures Providers | — |
| `start` | Starts the server, Proxy, and dashboard | `--port` (default 8080), `--proxy-port` (default 4000), `--retention-days` (default 30), `--no-open` |
| `status` | Displays current configuration | — |
| `reset-token` | Regenerates the authentication Token | — |
| `providers list` | Lists configured Providers | — |
| `providers set <name> <key>` | Stores a Provider API key | — |
| `providers remove <name>` | Removes a Provider | — |
| `version` | Displays the version number | — |
| `doctor` | Runs a system health check | `--port`, `--proxy-port` |
| `agents` | Lists registered Agents | `--port`, `--proxy-port` |
| `stats [agentId]` | Displays Agent statistics | `--port`, `--proxy-port`, `--range` (1h/24h/7d/30d, default 24h) |
| `help` | Displays help information | — |

## Detailed Descriptions

### `agenttrace onboard`

Initial setup wizard. Generates an authentication Token and writes it to `~/.agenttrace/config.json`, then guides the user through configuring Provider API keys.

### `agenttrace start`

Starts all services.

```bash
# Start with default ports
agenttrace start

# Custom ports, without auto-opening the browser
agenttrace start --port 9090 --proxy-port 5000 --no-open

# Set data retention to 7 days
agenttrace start --retention-days 7
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `8080` | Express server and dashboard port |
| `--proxy-port` | `4000` | LLM Proxy port |
| `--retention-days` | `30` | Event data retention period in days |
| `--no-open` | `false` | Do not auto-open the browser on startup |

### `agenttrace status`

Displays current configuration, including Token prefix, configured Providers, database path, and more.

### `agenttrace reset-token`

Regenerates the authentication Token. The old Token is immediately invalidated. You will need to update all SDK configurations and dashboard logins that use the old Token.

### `agenttrace providers`

Manage LLM Provider API keys.

```bash
# List all configured Providers
agenttrace providers list

# Set OpenAI API Key (securely encrypted)
agenttrace providers set openai sk-xxxxxxxxxxxxx

# Remove the Anthropic Provider
agenttrace providers remove anthropic
```

### `agenttrace doctor`

Runs a system health check to verify the server and Proxy are operating correctly.

```bash
agenttrace doctor
agenttrace doctor --port 9090 --proxy-port 5000
```

### `agenttrace agents`

Lists all registered Agents and their current status.

```bash
agenttrace agents
```

### `agenttrace stats`

Displays Agent statistics. If there is only one Agent in the system, it is automatically selected.

```bash
# Display statistics for all Agents (default 24 hours)
agenttrace stats

# Display statistics for a specific Agent over a 7-day range
agenttrace stats my-agent --range 7d
```
