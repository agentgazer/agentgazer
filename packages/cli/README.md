# agenttrace

AI Agent observability. One command to monitor your agents locally.

## Install

```bash
npm install -g agenttrace
```

## Usage

```bash
agenttrace                          # Start with defaults
agenttrace --port 9090              # Use custom server port
agenttrace --no-open                # Start without opening browser
```

Starts the AgentTrace API server, LLM proxy, and local dashboard. All data is stored in `~/.agenttrace/`.

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `3274` | API server port |
| `--proxy-port` | `4020` | LLM proxy port |
| `--no-open` | — | Don't auto-open the browser |

## License

Apache-2.0 — see [LICENSE](./LICENSE).

Part of the [AgentTrace](https://github.com/agenttrace/agenttrace) monorepo.
