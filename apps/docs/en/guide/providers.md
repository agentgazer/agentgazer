# Provider Key Management

## Encrypted Storage

Provider API keys are **never stored in plaintext** in the configuration file. AgentTrace uses an **AES-256-GCM** encrypted keystore to protect your API keys.

## Storage and Management

```bash
# Store OpenAI API Key (securely encrypted)
agenttrace providers set openai sk-xxxxxxxxxxxxx

# Store Anthropic API Key
agenttrace providers set anthropic sk-ant-xxxxxxxxxxxxx

# List configured Providers
agenttrace providers list

# Remove a Provider
agenttrace providers remove openai
```

## Keystore Backends

AgentTrace supports multiple keystore backends, automatically detected in the following priority order:

| Priority | Backend | Description |
|----------|---------|-------------|
| 1 | Environment variable | Manually specified via `AGENTTRACE_SECRET_BACKEND` |
| 2 | macOS Keychain | Automatically used on macOS with a GUI session |
| 3 | Linux libsecret | Automatically used on Linux |
| 4 | MachineKeyStore (default) | AES-256-GCM encryption based on machine-id + username |

## Automatic Migration

If legacy plaintext API keys exist in `config.json`, AgentTrace will **automatically** migrate them to the encrypted keystore on startup.

## Secure Injection Mechanism

When the Proxy forwards requests, it only injects API keys when the hostname matches a known Provider. This prevents key leakage to unknown third-party services.
