# Getting Started

## Installation

**Option A: One-line install (Recommended)**

```bash
curl -fsSL https://raw.githubusercontent.com/agentgazer/agentgazer/main/scripts/install.sh | sh
```

Works on macOS and Linux. Automatically downloads Node.js if needed.

**Option B: Homebrew (macOS / Linux)**

```bash
brew install agentgazer/tap/agentgazer
```

## Initial Setup

Run the setup wizard:

```bash
agentgazer onboard
```

This creates `~/.agentgazer/config.json`, generates an auth token, and guides you through configuring LLM provider API keys.

## Start the Service

```bash
agentgazer start
```

Opens the dashboard at [http://localhost:18880](http://localhost:18880).

| Service | Port |
|---------|------|
| Server + Dashboard | 18880 |
| LLM Proxy | 18900 |

### Verbose Mode

For debugging, start with verbose logging:

```bash
agentgazer start -v
```

## Verify

```bash
agentgazer doctor
```

## Uninstall

```bash
# curl install
agentgazer uninstall

# Homebrew
brew uninstall agentgazer
```

User data (`~/.agentgazer/`) is preserved. Remove manually if needed.

## Next Steps

- [Proxy Guide](/en/guide/proxy) — Route LLM calls through the proxy (zero code changes)
- [Dashboard](/en/guide/dashboard) — Navigate the web UI
- [Alerts](/en/guide/alerts) — Set up notifications for downtime, errors, and budget
