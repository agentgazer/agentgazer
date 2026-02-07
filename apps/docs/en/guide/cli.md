# CLI Reference

## Command Overview

### Core Commands

| Command | Description | Flags |
|---------|-------------|-------|
| `onboard` | Initial setup, generates Token, configures Providers | — |
| `start` | Starts the server, Proxy, and dashboard | `--port`, `--proxy-port`, `--retention-days`, `--no-open` |
| `status` | Displays current configuration | — |
| `reset-token` | Regenerates the authentication Token | — |
| `overview` | Launch real-time TUI dashboard | `--port` |
| `version` | Displays the version number | — |
| `doctor` | Runs a system health check | `--port`, `--proxy-port` |
| `uninstall` | Remove AgentGazer (curl-installed only) | `--yes` |
| `help` | Displays help information | — |

### Agent Commands

| Command | Description | Flags |
|---------|-------------|-------|
| `agents` | List all registered Agents | `--port` |
| `agent <name> active` | Activate an Agent | `--port` |
| `agent <name> deactive` | Deactivate an Agent | `--port` |
| `agent <name> killswitch on\|off` | Toggle kill switch | `--port` |
| `agent <name> delete` | Delete Agent and all data | `--port`, `--yes` |
| `agent <name> stat` | Show Agent statistics | `--port`, `--range` |
| `agent <name> model` | List model overrides | `--port` |
| `agent <name> model-override <model>` | Set model override | `--port` |

### Provider Commands

| Command | Description | Flags |
|---------|-------------|-------|
| `providers` | List all configured Providers | `--port` |
| `provider add [name] [key]` | Add Provider (interactive if args omitted) | — |
| `provider <name> active` | Activate a Provider | `--port` |
| `provider <name> deactive` | Deactivate a Provider | `--port` |
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
| `--port` | `8080` | Express server and dashboard port |
| `--proxy-port` | `4000` | LLM Proxy port |
| `--retention-days` | `30` | Event data retention period in days |
| `--no-open` | `false` | Do not auto-open the browser on startup |

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
agentgazer agent my-bot deactive

# Toggle kill switch
agentgazer agent my-bot killswitch on
agentgazer agent my-bot killswitch off

# Show statistics
agentgazer agent my-bot stat
agentgazer agent my-bot stat --range 7d

# View model overrides
agentgazer agent my-bot model

# Set a model override (interactive provider selection if multiple)
agentgazer agent my-bot model-override gpt-4o-mini

# Delete an agent
agentgazer agent my-bot delete
agentgazer agent my-bot delete --yes  # Skip confirmation
```

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
agentgazer provider openai deactive

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
