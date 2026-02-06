# agentgazer

AI Agent observability. One command to monitor your agents locally.

## Install

```bash
npm install -g agentgazer
```

## Quick start

```bash
agentgazer onboard                    # First-time setup + configure provider keys
agentgazer start                      # Start server, proxy, and dashboard
```

## Commands

| Command | Description |
|---------|-------------|
| `agentgazer onboard` | First-time setup — generate token and configure provider API keys |
| `agentgazer start` | Start the server, proxy, and dashboard |
| `agentgazer status` | Show current configuration |
| `agentgazer reset-token` | Generate a new auth token |
| `agentgazer providers list` | List configured providers |
| `agentgazer providers set <name> <key>` | Set/update a provider API key |
| `agentgazer providers remove <name>` | Remove a provider |

## Options (for `start`)

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `8080` | API server / dashboard port |
| `--proxy-port` | `4000` | LLM proxy port |
| `--retention-days` | `30` | Data retention period in days |
| `--no-open` | — | Don't auto-open the browser |

## Provider API key management

The proxy can manage provider API keys so your app doesn't need to know them. Configure keys during `onboard` or with the `providers` subcommand:

```bash
agentgazer providers set openai sk-proj-...
agentgazer providers set anthropic sk-ant-...
agentgazer providers list
```

When a request goes through the proxy, the correct auth header is injected automatically:

- OpenAI / Mistral / Cohere / DeepSeek / Moonshot / Zhipu / MiniMax / Baichuan / Yi → `Authorization: Bearer <key>`
- Anthropic → `x-api-key: <key>`
- Google → `x-goog-api-key: <key>`

If the client already provides its own auth header, the proxy does not override it.

## Security

Provider API keys are stored securely:
- **macOS**: System Keychain (OS-managed encryption, per-app access control)
- **Linux desktop**: libsecret / GNOME Keyring (OS-managed encryption, D-Bus session scoped)
- **SSH / headless**: AES-256-GCM encrypted file (application-managed, machine-derived key)

Keys are never stored as plaintext in config files. At runtime, keys are decrypted once at startup and held in memory only.

## Rate limiting

You can set per-provider rate limits during `onboard`, or edit `~/.agentgazer/config.json` directly:

```json
{
  "token": "...",
  "providers": {
    "openai": {
      "rateLimit": { "maxRequests": 100, "windowSeconds": 60 }
    }
  }
}
```

When the limit is exceeded, the proxy returns `429` with a `Retry-After` header.

## License

Apache-2.0 — see [LICENSE](./LICENSE).

Part of the [AgentGazer](https://github.com/agentgazer/agentgazer) monorepo.
