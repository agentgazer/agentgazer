## Why

AgentGazer monitors AI agents, but those same agents can potentially access AgentGazer's own data - the SQLite database, config files, and API tokens. A recent security incident (OpenClaw #15805) demonstrated how AI agents can execute unexpected commands to collect system information. We need to protect AgentGazer's internal data from being read or exfiltrated by monitored agents.

Additionally, hardware fingerprinting commands (BIOS serial numbers, machine UUIDs) should be detected and masked, as these have no legitimate use in typical AI agent workflows.

## What Changes

- Add self-protection checks that block requests/responses containing AgentGazer paths or database queries
- Add hardware fingerprint patterns to sensitive data detection with auto-masking
- Both protections enabled by default
- Self-protection triggers block + alert
- Hardware fingerprint triggers mask + alert

## Capabilities

### New Capabilities
- `self-protection`: Independent security check that blocks access to AgentGazer's own data (~/.agentgazer/, database tables, config files). Checks both request and response content. Default: enabled, action: block + alert.

### Modified Capabilities
- `data-masking`: Add new category `hardware_fingerprint` for detecting and masking hardware serial numbers, BIOS info, machine UUIDs. Default: enabled, action: mask + alert.

## Impact

- `packages/shared/src/security-patterns.ts`: Add SELF_PROTECTION_PATTERNS, hardware_fingerprint patterns, checkSelfProtection() function
- `packages/proxy/src/security-filter.ts`: Integrate self-protection check in checkRequest() and checkResponse()
- `packages/server/src/db.ts`: Update default security config to enable new protections
- Dashboard security settings may need UI updates to show new protection categories
