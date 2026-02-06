# Getting Started

## Installation

**Option A: One-line install (Recommended)**

```bash
curl -fsSL https://raw.githubusercontent.com/agenttrace/agenttrace/main/scripts/install.sh | sh
```

Works on macOS and Linux. Automatically downloads Node.js if needed.

**Option B: Homebrew (macOS / Linux)**

```bash
brew install agenttrace/tap/agenttrace
```

**Option C: npm (requires Node.js >= 18)**

```bash
npx agenttrace          # Direct execution
npm install -g agenttrace   # Or global install
```

## Initial Setup

Run the setup wizard:

```bash
agenttrace onboard
```

This creates `~/.agenttrace/config.json`, generates an auth token, and guides you through configuring LLM provider API keys.

## Start the Service

```bash
agenttrace start
```

Opens the dashboard at [http://localhost:8080](http://localhost:8080).

| Service | Port |
|---------|------|
| Server + Dashboard | 8080 |
| LLM Proxy | 4000 |

## Verify

```bash
agenttrace doctor
```

## Uninstall

```bash
# curl install
agenttrace uninstall

# Homebrew
brew uninstall agenttrace

# npm
npm uninstall -g agenttrace
```

User data (`~/.agenttrace/`) is preserved. Remove manually if needed.

## Next Steps

- [Proxy Guide](/en/guide/proxy) — Route LLM calls through the proxy (zero code changes)
- [SDK Guide](/en/guide/sdk) — Manual instrumentation for fine-grained control
- [Dashboard](/en/guide/dashboard) — Navigate the web UI
- [Alerts](/en/guide/alerts) — Set up notifications for downtime, errors, and budget
