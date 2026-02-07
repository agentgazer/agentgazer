## 1. SecretStore Interface and Encrypted File Backend

- [x] 1.1 Create `packages/cli/src/secret-store.ts` with `SecretStore` interface (`get`, `set`, `delete`, `list`, `isAvailable`)
- [x] 1.2 Implement `EncryptedFileStore` class using AES-256-GCM + scrypt KDF, storing to `~/.agentgazer/secrets.enc` with 0600 permissions
- [x] 1.3 Implement passphrase acquisition: env var `AGENTGAZER_PASSPHRASE` → interactive stdin prompt → error with instructions
- [x] 1.4 Write unit tests for `EncryptedFileStore` (encrypt/decrypt, wrong passphrase, tampered file, file permissions)

## 2. OS Keychain Backends

- [x] 2.1 Implement `KeychainStore` class using `/usr/bin/security` CLI for macOS Keychain (generic passwords, `-T ""` ACL)
- [x] 2.2 Implement `LibsecretStore` class using `secret-tool` CLI for Linux libsecret
- [x] 2.3 Implement `detectSecretStore()` with priority: env var override → macOS Keychain (GUI) → libsecret → encrypted-file fallback
- [x] 2.4 Write unit tests for backend auto-detection logic (mock platform/env checks)

## 3. Proxy Hostname-Only Key Injection

- [x] 3.1 Split provider detection in `proxy-server.ts` into `detectedProviderStrict` (hostname-only, for key injection) and `detectedProviderForMetrics` (hostname+path, for metrics)
- [x] 3.2 Update proxy key injection to only use strict hostname match — skip injection when provider detected by path only
- [x] 3.3 Update proxy tests to verify key NOT injected for path-only matches and IS injected for hostname matches

## 4. CLI Commands Integration

- [x] 4.1 Update `agentgazer start` to initialize secret store, acquire passphrase if needed, and load provider keys into memory before starting proxy
- [x] 4.2 Update `agentgazer providers set` to write API key to active secret store instead of `config.json`
- [x] 4.3 Update `agentgazer providers remove` to delete API key from secret store in addition to removing config entry
- [x] 4.4 Update `agentgazer onboard` to write provider keys to secret store, prompting for new passphrase if encrypted-file backend

## 5. Migration from Plaintext Config

- [x] 5.1 Implement migration logic: detect plaintext `apiKey` fields in `config.json`, write to secret store, remove from config
- [x] 5.2 Add migration to `agentgazer start` flow — run before starting services, print migration message
- [x] 5.3 Ensure migration is idempotent (safe to re-run, no duplicate writes)
- [x] 5.4 Write tests for migration (plaintext keys present, already migrated, partial migration recovery)

## 6. Integration Testing and Build Verification

- [x] 6.1 Run full build (`npm run build`) and fix any TypeScript errors
- [x] 6.2 Run full test suite (`npm test`) and fix any failures
- [ ] 6.3 Manual smoke test: `agentgazer start` with encrypted-file backend prompts for passphrase and starts correctly
