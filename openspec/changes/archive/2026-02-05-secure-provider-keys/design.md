## Context

Provider API keys are currently stored as plaintext in `~/.agenttrace/config.json` with default file permissions (0644). AI coding agents running on the same machine as the local user can read this file directly, extracting all configured provider keys. The proxy also has a path-based key injection fallback that allows an agent to extract keys via HTTP by pointing `x-target-url` at a server it controls.

The system needs to protect provider keys from co-resident AI agents while maintaining a practical developer experience, including SSH access to headless machines.

## Goals / Non-Goals

**Goals:**
- Provider API keys are never stored in plaintext on the filesystem
- Keys in memory are only accessible to the proxy process, not extractable via HTTP
- Works over SSH (no GUI dependency in the critical path)
- Automatic migration from existing plaintext configs
- Cross-platform (macOS, Linux; Windows as future work)

**Non-Goals:**
- Protecting against root/sudo-level attackers
- Protecting the auth token (remains in config.json — it grants telemetry access, not provider billing)
- Hardware security module integration
- Protecting against agent reading process memory via ptrace

## Decisions

### 1. Encrypted file as primary backend, OS keychain as optional upgrade

**Decision:** The encrypted-file backend (AES-256-GCM + scrypt KDF) is the default for all platforms. macOS Keychain and Linux libsecret are optional backends activated only when a GUI session is detected.

**Rationale:** The primary user scenario is SSH into a Mac Mini or Linux server. macOS Keychain does not work reliably over SSH (login keychain is locked, ACL dialogs require GUI). An encrypted file with user-provided passphrase is the only approach that is truly secure against same-user file-reading agents AND works over SSH.

**Alternatives considered:**
- *OS keychain as primary*: Rejected — broken over SSH, which is the stated primary access method.
- *File permissions only (chmod 600)*: Rejected — same-user agent can still read 0600 files.
- *Separate OS user for proxy*: Rejected — too heavy for a dev tool (needs sudo, user management).

### 2. SecretStore abstraction with runtime backend selection

**Decision:** A `SecretStore` interface with three implementations: `EncryptedFileStore`, `KeychainStore` (macOS), `LibsecretStore` (Linux). Backend is selected at runtime via `detectSecretStore()`.

```
detectSecretStore():
├── AGENTTRACE_SECRET_BACKEND env var set?
│   └── Use specified backend (override)
├── process.platform === "darwin" && GUI session detected?
│   └── KeychainStore
├── process.platform === "linux" && `which secret-tool` succeeds?
│   └── LibsecretStore
└── Otherwise
    └── EncryptedFileStore (default)
```

**Rationale:** Auto-detection minimizes user configuration. The env var override allows CI/CD and edge cases. GUI detection on macOS checks if WindowServer is running (`pgrep -x WindowServer`).

### 3. Passphrase handling for encrypted-file backend

**Decision:** Passphrase is obtained from (in priority order):
1. `AGENTTRACE_PASSPHRASE` environment variable
2. Interactive stdin prompt (TTY detected)
3. Error with instructions if neither is available

The passphrase is used with `crypto.scryptSync(passphrase, salt, 32)` to derive a 256-bit key. A random 16-byte salt is stored alongside the encrypted data. A random 12-byte IV is generated per encryption operation.

**Rationale:** Env var supports CI/CD and scripting. Interactive prompt is the primary UX. The passphrase never touches the filesystem. Scrypt parameters (N=16384, r=8, p=1) balance security and startup latency (~200ms on modern hardware).

### 4. Hostname-only key injection in proxy

**Decision:** The proxy SHALL only inject provider API keys when `detectProvider(targetUrl)` matches via hostname. The existing path-based fallback (`detectProvider("https://placeholder${path}")`) is used for metrics extraction only, not for key injection or rate limiting.

**Rationale:** Path-based detection matches generic URL patterns like `/v1/chat/completions`. If combined with key injection, an agent can point `x-target-url` at any server and receive the injected key. Hostname matching requires the target to actually be `api.openai.com`, etc.

**Implementation:** Split `detectedProviderForAuth` into two variables:
- `detectedProviderStrict` — hostname match only, used for key injection and rate limiting
- `detectedProviderForMetrics` — hostname OR path match, used for metric extraction

### 5. Encrypted file format

**Decision:** Secrets stored in `~/.agenttrace/secrets.enc` as JSON encrypted with AES-256-GCM:

```
{
  "version": 1,
  "salt": "<base64 16 bytes>",
  "iv": "<base64 12 bytes>",
  "tag": "<base64 16 bytes>",
  "ciphertext": "<base64>"
}
```

The decrypted plaintext is a JSON object: `{ "providers": { "openai": "sk-xxx", ... } }`.

**Rationale:** JSON wrapper allows versioning for future format changes. Storing salt/IV/tag alongside ciphertext is standard practice (they are not secret). The version field enables forward-compatible parsing.

### 6. Config file changes

**Decision:** After migration, `config.json` changes from:
```json
{ "token": "...", "providers": { "openai": { "apiKey": "sk-xxx", "rateLimit": {...} } } }
```
To:
```json
{ "token": "...", "providers": { "openai": { "rateLimit": {...} } }, "secretBackend": "encrypted-file" }
```

The `apiKey` field is removed from each provider entry. The `secretBackend` field records which backend was used (informational, actual detection is at runtime).

### 7. Shell out to OS CLI tools, no native addons

**Decision:** macOS Keychain accessed via `/usr/bin/security`, Linux libsecret via `secret-tool`. Both invoked via `child_process.execSync`.

**Rationale:** Avoids node-gyp / native addon compilation. The `keytar` npm package is archived. CLI tools are pre-installed on their respective platforms. The tradeoff is spawning child processes, but this only happens at startup (not per-request).

## Risks / Trade-offs

- **[UX friction]** Encrypted-file backend requires passphrase on every `agenttrace start`. → Mitigated by `AGENTTRACE_PASSPHRASE` env var for scripting. Users on GUI desktops can opt into Keychain/libsecret for passphrase-free experience.

- **[Env var passphrase visible on Linux /proc]** `AGENTTRACE_PASSPHRASE` is readable via `/proc/<pid>/environ` on Linux by the same user. → macOS has no /proc; on Linux this is documented as a known limitation. Using stdin prompt is more secure.

- **[Keychain imperfect on macOS]** Even with `-T ""` ACL, if both proxy and agent run via `node`, Keychain ACLs can't distinguish them. → Keychain is an optional UX upgrade, not the security boundary. The encrypted-file backend remains the secure option.

- **[Migration data loss risk]** If migration writes to secrets.enc but crashes before removing keys from config.json, keys exist in both places. → Migration is idempotent: always check if secrets.enc already has the key before writing. Only remove from config.json after confirming secrets.enc is valid.

- **[Breaking change for path-based key injection]** Users who relied on `x-target-url` to a non-provider hostname with a provider-matching path will no longer get key injection. → Document in release notes. The previous behavior was a security vulnerability.
