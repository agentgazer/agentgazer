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

**Option C: npm (requires Node.js >= 18)**

```bash
npx agentgazer          # Direct execution
npm install -g agentgazer   # Or global install
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

Opens the dashboard at [http://localhost:8080](http://localhost:8080).

| Service | Port |
|---------|------|
| Server + Dashboard | 8080 |
| LLM Proxy | 4000 |

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

# npm
npm uninstall -g agentgazer
```

User data (`~/.agentgazer/`) is preserved. Remove manually if needed.

## Next Steps

- [Proxy Guide](/en/guide/proxy) — Route LLM calls through the proxy (zero code changes)
- [SDK Guide](/en/guide/sdk) — Manual instrumentation for fine-grained control
- [Dashboard](/en/guide/dashboard) — Navigate the web UI
- [Alerts](/en/guide/alerts) — Set up notifications for downtime, errors, and budget
