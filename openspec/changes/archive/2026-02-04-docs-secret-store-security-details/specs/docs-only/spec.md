## ADDED Requirements

### Requirement: Security documentation covers trust boundary differences
The documentation SHALL describe who owns encryption for each secret backend (OS-managed vs. application-managed) and what each backend protects against.

#### Scenario: User reads providers.md security architecture
- **WHEN** a user reads the "Security Architecture" section in providers.md
- **THEN** they see a comparison table showing: backend name, who encrypts, who can decrypt, and protection level for all three backends (Keychain, libsecret, MachineKeyStore)

### Requirement: Security documentation explains MachineKeyStore threat model
The documentation SHALL explain that MachineKeyStore derives its key from public inputs (machine-id + username) and that same-user processes can theoretically derive the same key.

#### Scenario: User reads MachineKeyStore limitations
- **WHEN** a user reads the security documentation
- **THEN** they understand that MachineKeyStore is a "better than plaintext" fallback, not equivalent to OS keychain protection

### Requirement: Security documentation describes runtime key lifecycle
The documentation SHALL explain that keys are decrypted once at startup, held in memory, never written back to disk, and require a restart to pick up changes.

#### Scenario: User reads runtime lifecycle FAQ
- **WHEN** a user reads the FAQ security section
- **THEN** they understand that keys live in-memory only after startup and that changing a key requires restarting `agenttrace start`
