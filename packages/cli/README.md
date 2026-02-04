# agenttrace

AI Agent observability. One command to monitor your agents locally.

## Install

```bash
npm install -g agenttrace
```

## Quick start

```bash
agenttrace onboard                    # First-time setup + configure provider keys
agenttrace start                      # Start server, proxy, and dashboard
```

## Commands

| Command | Description |
|---------|-------------|
| `agenttrace onboard` | First-time setup — generate token and configure provider API keys |
| `agenttrace start` | Start the server, proxy, and dashboard |
| `agenttrace status` | Show current configuration |
| `agenttrace reset-token` | Generate a new auth token |
| `agenttrace providers list` | List configured providers |
| `agenttrace providers set <name> <key>` | Set/update a provider API key |
| `agenttrace providers remove <name>` | Remove a provider |

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
agenttrace providers set openai sk-proj-...
agenttrace providers set anthropic sk-ant-...
agenttrace providers list
```

When a request goes through the proxy, the correct auth header is injected automatically:

- OpenAI / Mistral / Cohere / DeepSeek / Moonshot / Zhipu / MiniMax / Baichuan / Yi → `Authorization: Bearer <key>`
- Anthropic → `x-api-key: <key>`
- Google → `x-goog-api-key: <key>`

If the client already provides its own auth header, the proxy does not override it.

## Security

Provider API keys are stored securely:
- **macOS**: System Keychain
- **Linux desktop**: libsecret / GNOME Keyring
- **SSH / headless**: AES-256-GCM encrypted file

Keys are never stored as plaintext in config files.

## Rate limiting

You can set per-provider rate limits during `onboard`, or edit `~/.agenttrace/config.json` directly:

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

Part of the [AgentTrace](https://github.com/agenttrace/agenttrace) monorepo.
