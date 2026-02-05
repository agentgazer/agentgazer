## Context

The secret store implementation (MachineKeyStore, KeychainStore, LibsecretStore) is complete and working. The documentation describes which backends exist and their names, but does not explain the trust boundary differences, threat model details, or runtime key lifecycle. This is a documentation-only change — no code modifications.

## Goals / Non-Goals

**Goals:**
- Document the trust boundary differences between the three secret backends
- Explain who owns encryption (OS vs. application) for each backend
- Describe the MachineKeyStore threat model honestly (machine-id + username are public)
- Document the runtime key lifecycle (decrypt once, in-memory, no hot-reload)
- Provide this information in both EN and ZH documentation

**Non-Goals:**
- Changing any runtime behavior or code
- Adding new secret store backends
- Implementing key hot-reload

## Decisions

### 1. Add a "Security Architecture" section to providers.md (not a separate page)

**Rationale:** The information is directly related to provider key management. A separate security page would fragment the reading flow. The section goes between "Key Storage" and "Rate Limiting" since it deepens the key storage explanation.

**Alternatives considered:**
- Separate `security.md` page — rejected because the content is tightly coupled to provider key management and too short for its own page.

### 2. Use a comparison table for trust boundaries

**Rationale:** The three backends have the same interface but very different security properties. A table makes the differences scannable at a glance. Include columns: backend, who encrypts, who can decrypt, protection level.

### 3. Expand FAQ rather than duplicating detail

**Rationale:** The FAQ already has a Security section with two entries. Add one more entry about runtime lifecycle rather than repeating the full architecture explanation. Cross-reference providers.md for details.

## Risks / Trade-offs

- [Risk] Over-documenting MachineKeyStore limitations could discourage headless users → Mitigation: frame it as "better than plaintext" and recommend OS keychain when possible, without being alarmist.
- [Risk] Chinese translations may not capture security nuance precisely → Mitigation: keep technical terms (AES-256-GCM, scrypt, machine-id) untranslated as they are universally understood in technical Chinese.
