## Why

Provider API keys are stored as plaintext in `~/.agentgazer/config.json` (default permissions 0644). AI agents running on the same machine with local user file-read access can trivially extract all configured provider keys. Additionally, the proxy's path-based provider detection allows key extraction via `x-target-url` pointed at an attacker-controlled server. These vectors must be closed to make AgentGazer safe to run alongside AI coding agents.

## What Changes

- **Encrypted secret storage**: Provider API keys are encrypted at rest using AES-256-GCM with a user-provided passphrase (scrypt-derived key). Keys are decrypted into memory at startup and never written to disk in plaintext.
- **OS keychain integration (optional)**: When a GUI session is detected, use macOS Keychain or Linux libsecret for better UX (no passphrase prompt). Falls back to encrypted file when unavailable (SSH, headless).
- **SecretStore abstraction**: Platform-agnostic interface with pluggable backends (encrypted-file, macOS Keychain, libsecret), auto-detected based on OS and session type.
- **Hostname-only key injection**: Proxy only injects provider API keys when the target URL's hostname matches a known provider. Path-only detection is restricted to metrics extraction only. **BREAKING** for users relying on path-based detection for key injection with custom `x-target-url` targets.
- **Config migration**: Existing plaintext keys in `config.json` are automatically migrated to the secret store on first run, then removed from the config file.
- **Passphrase support**: `agentgazer start` prompts for passphrase (stdin). Also accepts `AGENTTRACE_PASSPHRASE` environment variable for scripting/CI.

## Capabilities

### New Capabilities
- `secret-store`: Encrypted storage and retrieval of provider API keys with OS-aware backend selection (encrypted file, macOS Keychain, libsecret). Includes migration from plaintext config.

### Modified Capabilities
- `local-cli`: CLI commands (`onboard`, `start`, `providers set`) updated to write/read keys via SecretStore instead of plaintext config. Passphrase prompt added to `start`.

## Impact

- **packages/cli**: `config.ts` modified to separate secret storage from config. New `secret-store.ts` module. `cli.ts` updated for passphrase prompt and migration flow.
- **packages/proxy**: `proxy-server.ts` key injection logic restricted to hostname-matched providers only.
- **packages/shared**: No changes (provider detection already uses hostname extraction).
- **Config file format**: `providers[name].apiKey` field removed from `config.json`. New `secretStore` field added to track active backend. Non-breaking for users without configured providers.
- **New dependency**: None required. Uses Node.js built-in `crypto` module for encryption and `child_process` for OS keychain CLI tools.
