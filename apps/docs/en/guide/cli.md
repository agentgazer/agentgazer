# CLI Reference

## Command Overview

### Core Commands

| Command | Description | Flags |
|---------|-------------|-------|
| `onboard` | Initial setup, generates Token, configures Providers | — |
| `start` | Starts the server, Proxy, and dashboard | `--port`, `--proxy-port`, `--retention-days`, `--no-open`, `-v` |
| `stop` | Stops all running services | — |
| `status` | Displays current configuration | — |
| `logs` | View service logs | `--follow`, `--lines` |
| `reset-token` | Regenerates the authentication Token | — |
| `overview` | Launch real-time TUI dashboard | `--port` |
| `version`, `--version`, `-V` | Displays the version number | — |
| `update` | Update to latest version (preserves settings) | — |
| `doctor` | Runs a system health check | `--port`, `--proxy-port` |
| `uninstall` | Remove AgentGazer (curl-installed only) | `--yes` |
| `help` | Displays help information | — |

### Event Commands

| Command | Description | Flags |
|---------|-------------|-------|
| `events` | List recent events | `--port`, `--agent`, `--limit`, `--output` |

### Agent Commands

| Command | Description | Flags |
|---------|-------------|-------|
| `agents` | List all registered Agents | `--port` |
| `agent <name> active` | Activate an Agent | `--port` |
| `agent <name> deactivate` | Deactivate an Agent | `--port` |
| `agent <name> killswitch on\|off` | Toggle kill switch | `--port` |
| `agent <name> delete` | Delete Agent and all data | `--port`, `--yes` |
| `agent <name> stat` | Show Agent statistics | `--port`, `--range`, `-o` |
| `agent <name> model` | List model overrides | `--port` |
| `agent <name> model-override <model>` | Set model override | `--port` |
| `agent <name> alerts` | List all alerts for this Agent | `--port` |
| `agent <name> alert add <type>` | Add an alert rule | See below |
| `agent <name> alert delete <id>` | Delete an alert rule | `--port`, `--yes` |
| `agent <name> alert reset <id>` | Reset alert to normal state | `--port` |

### Provider Commands

| Command | Description | Flags |
|---------|-------------|-------|
| `providers` | List all configured Providers | `--port` |
| `provider add [name] [key]` | Add Provider (interactive if args omitted) | — |
| `provider <name> active` | Activate a Provider | `--port` |
| `provider <name> deactivate` | Deactivate a Provider | `--port` |
| `provider <name> test-connection` | Test API key validity | — |
| `provider <name> delete` | Delete Provider and API key | `--yes` |
| `provider <name> models` | List available models | — |
| `provider <name> stat` | Show Provider statistics | `--port`, `--range` |

## Detailed Descriptions

### `agentgazer onboard`

Initial setup wizard. Generates an authentication Token and writes it to `~/.agentgazer/config.json`, then guides the user through configuring Provider API keys.

### `agentgazer start`

Starts all services.

```bash
# Start with default ports
agentgazer start

# Custom ports, without auto-opening the browser
agentgazer start --port 9090 --proxy-port 5000 --no-open

# Set data retention to 7 days
agentgazer start --retention-days 7
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `18880` | Express server and dashboard port |
| `--proxy-port` | `4000` | LLM Proxy port |
| `--retention-days` | `30` | Event data retention period in days |
| `--no-open` | `false` | Do not auto-open the browser on startup |

These defaults can be overridden in the config file (see [Configuration File](#configuration-file)).

### `agentgazer overview`

Launch a real-time htop-style terminal UI dashboard showing system status, agents, and recent events.

```bash
agentgazer overview
agentgazer overview --port 9090
```

**Keyboard shortcuts:**
- `Q` or `ESC` — Exit overview
- `R` — Force refresh
- `A` — Toggle showing only active agents
- `?` — Show help

### Agent Management

Manage Agents from the command line.

```bash
# List all agents
agentgazer agents

# Activate/deactivate an agent
agentgazer agent my-bot active
agentgazer agent my-bot deactivate

# Toggle kill switch
agentgazer agent my-bot killswitch on
agentgazer agent my-bot killswitch off

# Show statistics
agentgazer agent my-bot stat
agentgazer agent my-bot stat --range 7d

# Output as JSON (for scripting/MCP integration)
agentgazer agent my-bot stat -o json

# View model overrides
agentgazer agent my-bot model

# Set a model override (interactive provider selection if multiple)
agentgazer agent my-bot model-override gpt-4o-mini

# Delete an agent
agentgazer agent my-bot delete
agentgazer agent my-bot delete --yes  # Skip confirmation
```

### Alert Management (CLI)

Manage alert rules from the command line.

```bash
# List all alerts for an agent
agentgazer agent my-bot alerts

# Add an error rate alert with Telegram notification
agentgazer agent my-bot alert add error-rate --threshold 10 --telegram

# Add an agent down alert with repeat notifications
agentgazer agent my-bot alert add agent-down --timeout 5 --repeat --interval 30 --telegram

# Add a budget alert with webhook
agentgazer agent my-bot alert add budget --limit 20 --period daily --webhook https://example.com/alert

# Delete an alert
agentgazer agent my-bot alert delete abc123

# Reset alert state to normal
agentgazer agent my-bot alert reset abc123
```

**Alert Types:**

| Type | Description | Key Options |
|------|-------------|-------------|
| `agent-down` | No heartbeat received | `--timeout <minutes>` |
| `error-rate` | Error rate exceeds threshold | `--threshold <percent>`, `--window <minutes>` |
| `budget` | Spending exceeds limit | `--limit <usd>`, `--period <daily\|weekly\|monthly>` |

**Common Options:**

| Option | Description |
|--------|-------------|
| `--repeat` | Enable repeated notifications (default) |
| `--no-repeat` | One-time notification only |
| `--interval <min>` | Minutes between repeat notifications |
| `--recovery-notify` | Notify when condition recovers |
| `--webhook <url>` | Send to webhook URL |
| `--telegram` | Send to configured Telegram |

### Provider Management

Manage LLM Provider API keys.

```bash
# List all configured Providers
agentgazer providers

# Add a provider (fully interactive)
agentgazer provider add

# Add with provider name (prompts for key)
agentgazer provider add openai

# Add with both arguments (non-interactive)
agentgazer provider add openai sk-xxxxxxxxxxxxx

# Activate/deactivate a provider
agentgazer provider openai active
agentgazer provider openai deactivate

# Test connection
agentgazer provider openai test-connection

# List available models
agentgazer provider openai models

# Show statistics
agentgazer provider openai stat
agentgazer provider openai stat --range 7d

# Delete a provider
agentgazer provider openai delete
agentgazer provider openai delete --yes  # Skip confirmation
```

### `agentgazer doctor`

Runs a system health check to verify the server and Proxy are operating correctly.

```bash
agentgazer doctor
agentgazer doctor --port 9090 --proxy-port 5000
```

### `agentgazer update`

Check for updates and upgrade to the latest version. Automatically detects whether AgentGazer was installed via npm or Homebrew and runs the appropriate update command.

```bash
agentgazer update
```

Example output:
```
  Current version: 0.3.2
  Checking for updates...

  New version available: 0.3.3

  Detected: npm global installation
  Updating via npm...

  ✓ Update complete!

  Your settings in ~/.agentgazer/ have been preserved.
```

Your configuration, database, and provider keys in `~/.agentgazer/` are preserved during updates.

## Configuration File

AgentGazer stores configuration in `~/.agentgazer/config.json`. You can set persistent defaults here instead of passing CLI flags every time.

### Available Settings

```json
{
  "token": "your-auth-token",
  "server": {
    "port": 18880,
    "proxyPort": 18900,
    "autoOpen": true
  },
  "data": {
    "retentionDays": 30
  },
  "alerts": {
    "defaults": {
      "telegram": {
        "botToken": "123456:ABC...",
        "chatId": "-100123456789"
      },
      "webhook": {
        "url": "https://example.com/webhook"
      },
      "email": {
        "host": "smtp.example.com",
        "port": 587,
        "secure": false,
        "user": "user@example.com",
        "pass": "password",
        "from": "alerts@example.com",
        "to": "admin@example.com"
      }
    }
  }
}
```

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `token` | string | (generated) | Authentication token (auto-generated on first run) |
| `server.port` | number | `18880` | Dashboard/server port |
| `server.proxyPort` | number | `18900` | LLM Proxy port |
| `server.autoOpen` | boolean | `true` | Auto-open browser on `agentgazer start` |
| `data.retentionDays` | number | `30` | Data retention period in days |
| `alerts.defaults.telegram` | object | — | Default Telegram settings for new alerts |
| `alerts.defaults.webhook` | object | — | Default webhook settings for new alerts |
| `alerts.defaults.email` | object | — | Default SMTP settings for new alerts |

### Precedence

CLI flags always override config file values:

```bash
# Uses port from config.json (e.g., 9000)
agentgazer start

# Overrides config, uses port 8080
agentgazer start --port 8080
```
