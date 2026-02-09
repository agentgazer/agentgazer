# Provider Key Management

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
| 1 | Environment variable | Manually specified via `AGENTGAZER_SECRET_BACKEND` |
| 2 | macOS Keychain | Automatically used on macOS with a GUI session |
| 3 | Linux libsecret | Automatically used on Linux |
| 4 | MachineKeyStore (default) | AES-256-GCM encryption based on machine-id + username |

## Automatic Migration

If legacy plaintext API keys exist in `config.json`, AgentGazer will **automatically** migrate them to the encrypted keystore on startup.

## Secure Injection Mechanism

When the Proxy forwards requests, it only injects API keys when the hostname matches a known Provider. This prevents key leakage to unknown third-party services.
