# Provider Key Management

AgentTrace can manage your LLM provider API keys so your application doesn't need to know them. The proxy injects the correct auth header for each provider automatically.

## Configure During Onboard

```bash
agenttrace onboard
```

The onboard wizard prompts you for API keys for each supported provider. You can skip any provider by pressing Enter.

## Manage with CLI

```bash
# List configured providers
agenttrace providers list

# Set or update a provider key
agenttrace providers set openai sk-proj-...
agenttrace providers set anthropic sk-ant-...

# Remove a provider
agenttrace providers remove openai
```

## Supported Providers

| Provider | Auth Header Injected |
|----------|---------------------|
| `openai` | `Authorization: Bearer <key>` |
| `anthropic` | `x-api-key: <key>` |
| `google` | `x-goog-api-key: <key>` |
| `mistral` | `Authorization: Bearer <key>` |
| `cohere` | `Authorization: Bearer <key>` |

## How It Works

1. You configure API keys via `agenttrace providers set` or during `agenttrace onboard`
2. Keys are stored securely — never in plaintext config files:
   - **macOS**: System Keychain (when GUI session is active)
   - **Linux desktop**: libsecret / GNOME Keyring
   - **SSH / headless / Docker**: AES-256-GCM encrypted file (`~/.agenttrace/secrets.enc`)
3. When `agenttrace start` runs, keys are loaded and passed to the proxy in memory
4. For each request, the proxy detects the provider and injects the matching auth header
5. If the client already sends its own auth header, the proxy does **not** override it

This means your application can make requests without any API key:

```bash
# No Authorization header needed — the proxy injects it
curl http://localhost:4000/v1/chat/completions \
  -H "Host: api.openai.com" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}'
```

## Key Storage

API keys are **never** stored in `config.json`. They are secured by your OS keychain or encrypted at rest.

You can check which backend is active:

```bash
agenttrace doctor
```

Override the backend with the `AGENTTRACE_SECRET_BACKEND` environment variable:

| Value | Backend |
|-------|---------|
| `keychain` | macOS Keychain |
| `libsecret` | Linux libsecret |
| `machine` | Encrypted file (machine-derived key) |

## Security Architecture

Each backend has different trust boundaries:

| Backend | Who encrypts | Who can decrypt | Protection level |
|---------|-------------|----------------|-----------------|
| macOS Keychain | OS (Security framework) | Current user session + authorized apps | OS-managed — strongest |
| Linux libsecret | Desktop environment (GNOME Keyring / KDE Wallet) | Current user's D-Bus session | OS-managed — strong |
| Encrypted file (`machine`) | AgentTrace (AES-256-GCM via `crypto.scryptSync`) | Any process with same OS user + machine identity | Application-managed — better than plaintext |

The encrypted file backend (MachineKeyStore) derives its key from `machine-id` and `username` via scrypt. These are not secret inputs, so a process running as the same user on the same machine could theoretically derive the same key. This backend is designed as a "better than plaintext" fallback for SSH, headless, and Docker environments — not as a replacement for OS keychain protection.

**Runtime lifecycle:** Keys are decrypted once when `agenttrace start` runs and held in memory for the lifetime of the process. They are never written back to disk. Changing a key requires restarting `agenttrace start`.

## Rate Limiting

Each provider can have an optional rate limit. When configured, the proxy enforces a sliding-window limit and returns `429 Too Many Requests` with a `Retry-After` header when the limit is exceeded.

Set rate limits during onboard (e.g., `100/60` for 100 requests per 60 seconds) or edit the config file directly.
