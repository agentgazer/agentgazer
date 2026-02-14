## 1. Self-Protection Patterns (packages/shared)

- [x] 1.1 Add SELF_PROTECTION_PATTERNS constant with path and SQL patterns
- [x] 1.2 Add checkSelfProtection() function that returns matched patterns
- [x] 1.3 Add tests for self-protection pattern matching

## 2. Hardware Fingerprint Patterns (packages/shared)

- [x] 2.1 Add "hardware_fingerprint" to SensitiveDataPattern category type
- [x] 2.2 Add Windows hardware fingerprint patterns (wmic, Get-WmiObject, Get-CimInstance)
- [x] 2.3 Add macOS hardware fingerprint patterns (system_profiler, ioreg)
- [x] 2.4 Add Linux hardware fingerprint patterns (dmidecode, /sys/class/dmi)
- [x] 2.5 Add tests for hardware fingerprint pattern matching

## 3. Security Filter Integration (packages/proxy)

- [x] 3.1 Import checkSelfProtection in security-filter.ts
- [x] 3.2 Add self-protection check to checkRequest() - block if matched
- [x] 3.3 Add self-protection check to checkResponse() - block if matched
- [x] 3.4 Update generateSecurityBlockedResponse() for self-protection blocks
- [x] 3.5 Add tests for self-protection blocking in proxy

## 4. Default Configuration (packages/server)

- [x] 4.1 Update default security config to enable hardware_fingerprint
- [x] 4.2 Add self_protection to security event types
- [x] 4.3 Ensure self-protection cannot be disabled via API (hardcoded in proxy, runs before config check)

## 5. Alert Integration

- [x] 5.1 Generate alert when self-protection blocks a request (via fireSecurityAlert)
- [x] 5.2 Generate alert when hardware fingerprint is masked (if alerting enabled, via existing security event flow)
