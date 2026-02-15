# Provider Key Management

AgentGazer supports two authentication methods for LLM providers:

- **API Key** — Traditional API key authentication (most providers)
- **OAuth** — Browser-based login for subscription services (OpenAI Codex, Zhipu Coding Plan)

## Supported Providers

| Provider | Auth Method | Endpoint |
|----------|-------------|----------|
| OpenAI | API Key | api.openai.com |
| OpenAI Codex | **OAuth** | api.openai.com |
| Anthropic | API Key | api.anthropic.com |
| Google (Gemini) | API Key | generativelanguage.googleapis.com |
| Mistral | API Key | api.mistral.ai |
| Cohere | API Key | api.cohere.com |
| DeepSeek | API Key | api.deepseek.com |
| Moonshot | API Key | api.moonshot.cn |
| Zhipu (GLM-4) | API Key | api.z.ai |
| Zhipu Coding Plan | **OAuth** | api.z.ai |
| MiniMax | API Key | api.minimax.chat |
| MiniMax Coding Plan | **OAuth** | api.minimax.chat |
| Baichuan | API Key | api.baichuan-ai.com |
| Yi | API Key | api.lingyiwanwu.com |

## OAuth Authentication

For subscription-based providers (OpenAI Codex, Zhipu Coding Plan), use OAuth login:

```bash
# Login via browser (recommended)
agentgazer login openai-oauth

# Or use device code flow (for headless servers)
agentgazer login openai-oauth --device

# Check login status
agentgazer providers list

# Logout
agentgazer logout openai-oauth
```

### How OAuth Works

1. **Browser Flow**: Opens your browser to the provider's login page
2. **PKCE Security**: Uses Proof Key for Code Exchange for secure token retrieval
3. **Auto Refresh**: Tokens are automatically refreshed before expiry
4. **Secure Storage**: OAuth tokens stored in the same secure keystore as API keys

### Available OAuth Providers

| Provider | Command | Description |
|----------|---------|-------------|
| OpenAI Codex | `agentgazer login openai-oauth` | OpenAI subscription (ChatGPT Plus/Pro) |
| Zhipu Coding Plan | `agentgazer login zhipu-coding-plan` | Zhipu GLM subscription |
| MiniMax Coding Plan | `agentgazer login minimax-oauth` | MiniMax subscription service |

## OS-Level Secure Storage

Provider API keys are **never stored in plaintext**. AgentGazer uses OS-level secure storage backends:

| Platform | Storage Backend | Security |
|----------|----------------|----------|
| **macOS** | Keychain | Hardware-backed encryption via Secure Enclave |
| **Linux (desktop)** | libsecret / GNOME Keyring | Session-locked encryption |
| **Linux (headless)** | AES-256-GCM encrypted file | Machine-specific key derivation |

Keys are encrypted at rest and only decrypted in memory when needed for API calls.

## Storage and Management

```bash
# Store OpenAI API Key (securely encrypted)
agentgazer providers set openai sk-xxxxxxxxxxxxx

# Store Anthropic API Key
agentgazer providers set anthropic sk-ant-xxxxxxxxxxxxx

# List configured Providers
agentgazer providers list

# Remove a Provider
agentgazer providers remove openai
```

## Keystore Backends

AgentGazer supports multiple keystore backends, automatically detected in the following priority order:

| Priority | Backend | Description |
|----------|---------|-------------|
| 1 | macOS Keychain | Automatically used on macOS with a GUI session |
| 2 | Linux libsecret | Automatically used on Linux desktop |
| 3 | MachineKeyStore (default) | AES-256-GCM encryption based on machine-id + username |

### Manual Backend Override

To override auto-detection, set the environment variable:

```bash
export AGENTGAZER_SECRET_BACKEND=machine
```

Valid values:
- `keychain` — Force macOS Keychain
- `libsecret` — Force Linux libsecret
- `machine` — Force AES-256-GCM encrypted file

## Automatic Migration

If legacy plaintext API keys exist in `config.json`, AgentGazer will **automatically** migrate them to the encrypted keystore on startup.

## Secure Injection Mechanism

When the Proxy forwards requests, it only injects API keys when the hostname matches a known Provider. This prevents key leakage to unknown third-party services.
