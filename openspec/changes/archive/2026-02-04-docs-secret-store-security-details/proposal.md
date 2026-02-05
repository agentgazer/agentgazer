## Why

The security documentation (providers.md FAQ, faq.md) describes which secret backends exist but does not explain the trust boundary differences between them, the MachineKeyStore threat model, or the runtime key lifecycle. Users with security concerns cannot make informed decisions about which backend to use or what the actual protection guarantees are.

## What Changes

- Expand the "Security" FAQ section in `faq.md` (EN/ZH) with detailed trust boundary comparison and MachineKeyStore limitations
- Add a "Security Architecture" section to `providers.md` (EN/ZH) explaining:
  - Who owns encryption for each backend (OS vs. application)
  - MachineKeyStore threat model (machine-id + username are public inputs)
  - Runtime key lifecycle (decrypted once at startup, in-memory only, no hot-reload)
- Update `packages/cli/README.md` security section with a brief trust boundary note

## Capabilities

### New Capabilities

_(none — this is a docs-only change, no new runtime capabilities)_

### Modified Capabilities

_(no spec-level behavior changes — documentation only)_

## Impact

- `apps/docs/en/guide/providers.md` — new "Security Architecture" section
- `apps/docs/zh/guide/providers.md` — same in Chinese
- `apps/docs/en/guide/faq.md` — expanded Security FAQ
- `apps/docs/zh/guide/faq.md` — same in Chinese
- `packages/cli/README.md` — expanded Security section
- No code changes, no API changes, no dependencies affected
