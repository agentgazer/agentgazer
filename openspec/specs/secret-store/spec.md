## ADDED Requirements

### Requirement: SecretStore interface
The system SHALL provide a `SecretStore` interface with methods: `get(service, account)`, `set(service, account, value)`, `delete(service, account)`, `list(service)`, and `isAvailable()`. All implementations MUST conform to this interface.

#### Scenario: Store and retrieve a secret
- **WHEN** `set("com.agenttrace.provider", "openai", "sk-xxx")` is called followed by `get("com.agenttrace.provider", "openai")`
- **THEN** the returned value SHALL be `"sk-xxx"`

#### Scenario: Delete a secret
- **WHEN** `delete("com.agenttrace.provider", "openai")` is called
- **THEN** subsequent `get("com.agenttrace.provider", "openai")` SHALL return `null`

#### Scenario: List secrets for a service
- **WHEN** secrets exist for accounts "openai" and "anthropic" under service "com.agenttrace.provider"
- **THEN** `list("com.agenttrace.provider")` SHALL return `["openai", "anthropic"]`

### Requirement: Encrypted file backend
The system SHALL implement an `EncryptedFileStore` backend that encrypts secrets using AES-256-GCM with a scrypt-derived key from a user-provided passphrase. The encrypted data SHALL be stored in `~/.agenttrace/secrets.enc` with file permissions 0600. The file format SHALL include a version field, base64-encoded salt (16 bytes), IV (12 bytes), auth tag (16 bytes), and ciphertext.

#### Scenario: Encrypt and persist secrets
- **WHEN** a provider key is stored via `set()` with a passphrase-derived key
- **THEN** the file `~/.agenttrace/secrets.enc` SHALL contain a JSON object with fields `version`, `salt`, `iv`, `tag`, and `ciphertext`, and the file permissions SHALL be 0600

#### Scenario: Decrypt with correct passphrase
- **WHEN** `get()` is called with the same passphrase used during `set()`
- **THEN** the original plaintext secret SHALL be returned

#### Scenario: Decrypt with wrong passphrase
- **WHEN** `get()` is called with an incorrect passphrase
- **THEN** the operation SHALL throw an error indicating authentication failure

#### Scenario: File tampered
- **WHEN** the ciphertext or tag in `secrets.enc` has been modified
- **THEN** decryption SHALL fail with an authentication error (GCM tag verification)

### Requirement: macOS Keychain backend
The system SHALL implement a `KeychainStore` backend that uses the macOS `security` CLI tool (`/usr/bin/security`) to store and retrieve secrets. Secrets SHALL be stored as generic passwords with service name `com.agenttrace.provider` and account name matching the provider name. Items SHALL be created with an empty ACL (`-T ""`) so that access attempts trigger a user confirmation dialog.

#### Scenario: Store key in Keychain
- **WHEN** `set("com.agenttrace.provider", "openai", "sk-xxx")` is called on macOS with GUI session
- **THEN** a generic password entry SHALL exist in the login keychain with service `com.agenttrace.provider` and account `openai`

#### Scenario: Retrieve key from Keychain
- **WHEN** `get("com.agenttrace.provider", "openai")` is called and the keychain is unlocked
- **THEN** the stored password value SHALL be returned

#### Scenario: Availability check
- **WHEN** `isAvailable()` is called on macOS without a GUI session (SSH-only)
- **THEN** it SHALL return `false`

### Requirement: Linux libsecret backend
The system SHALL implement a `LibsecretStore` backend that uses the `secret-tool` CLI to store and retrieve secrets. Secrets SHALL use attribute `service=com.agenttrace.provider` and `account=<provider-name>`.

#### Scenario: Store key via secret-tool
- **WHEN** `set("com.agenttrace.provider", "openai", "sk-xxx")` is called on Linux with libsecret available
- **THEN** the secret SHALL be retrievable via `secret-tool lookup service com.agenttrace.provider account openai`

#### Scenario: Availability check without secret-tool
- **WHEN** `isAvailable()` is called and `secret-tool` is not installed
- **THEN** it SHALL return `false`

### Requirement: Backend auto-detection
The system SHALL automatically detect the best available backend using the following priority: (1) `AGENTTRACE_SECRET_BACKEND` environment variable override, (2) macOS Keychain if on darwin with GUI session, (3) Linux libsecret if `secret-tool` is available, (4) encrypted-file as default fallback. The detection result SHALL be logged at startup.

#### Scenario: macOS with GUI session
- **WHEN** `detectSecretStore()` is called on macOS with WindowServer running
- **THEN** the `KeychainStore` backend SHALL be selected

#### Scenario: macOS over SSH
- **WHEN** `detectSecretStore()` is called on macOS without WindowServer running
- **THEN** the `EncryptedFileStore` backend SHALL be selected

#### Scenario: Linux with secret-tool
- **WHEN** `detectSecretStore()` is called on Linux with `secret-tool` in PATH
- **THEN** the `LibsecretStore` backend SHALL be selected

#### Scenario: Environment variable override
- **WHEN** `AGENTTRACE_SECRET_BACKEND=encrypted-file` is set
- **THEN** the `EncryptedFileStore` backend SHALL be selected regardless of platform

### Requirement: Passphrase acquisition
When the encrypted-file backend is active, the system SHALL obtain the passphrase from (in order): (1) `AGENTTRACE_PASSPHRASE` environment variable, (2) interactive stdin prompt if a TTY is detected, (3) error with instructions if neither is available.

#### Scenario: Passphrase from environment variable
- **WHEN** `AGENTTRACE_PASSPHRASE` is set and the encrypted-file backend is active
- **THEN** the system SHALL use the env var value as the passphrase without prompting

#### Scenario: Passphrase from interactive prompt
- **WHEN** `AGENTTRACE_PASSPHRASE` is not set and stdin is a TTY
- **THEN** the system SHALL prompt "Enter passphrase to unlock provider keys:" and read the passphrase from stdin (input not echoed)

#### Scenario: No passphrase available
- **WHEN** `AGENTTRACE_PASSPHRASE` is not set and stdin is not a TTY
- **THEN** the system SHALL print an error explaining how to provide a passphrase and exit with code 1

### Requirement: Migration from plaintext config

The system SHALL auto-detect plaintext API keys in `config.json` and migrate them to the active secret store backend. The migration function MUST use the exported `PROVIDER_SERVICE` constant for the service name, not a locally defined duplicate.

#### Scenario: Migration uses shared constant
- **WHEN** `migrateFromPlaintextConfig` stores keys in the secret store
- **THEN** it uses the exported `PROVIDER_SERVICE` constant as the service parameter
- **AND** keys stored by migration are retrievable via `loadProviderKeys` (which also uses `PROVIDER_SERVICE`)

### Requirement: Hostname-only key injection
The proxy SHALL only inject provider API keys into outbound requests when the target URL's hostname matches a known provider pattern via `detectProvider()`. Path-only provider matches (where hostname returns "unknown" but path pattern matches) SHALL NOT trigger key injection. Path-only matches SHALL still be used for metric extraction and event recording.

#### Scenario: Key injected for known provider hostname
- **WHEN** `x-target-url` is `https://api.openai.com` and an OpenAI key is configured
- **THEN** the proxy SHALL inject the `Authorization: Bearer <key>` header

#### Scenario: Key NOT injected for unknown hostname with matching path
- **WHEN** `x-target-url` is `https://evil.com` and the path is `/v1/chat/completions`
- **THEN** the proxy SHALL NOT inject any provider API key, even though the path matches OpenAI's pattern

#### Scenario: Metrics still recorded for path-only match
- **WHEN** `x-target-url` is `http://localhost:8000` and the path is `/v1/chat/completions`
- **THEN** the proxy SHALL record the event with `provider: "openai"` for metrics but SHALL NOT inject a key
