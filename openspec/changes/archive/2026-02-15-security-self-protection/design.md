## Context

AgentGazer monitors AI agents by acting as a proxy between agents and LLM providers. The proxy can inspect request/response content for security issues. Currently, the Security Shield detects prompt injection, masks sensitive data (API keys, credit cards, etc.), and enforces tool restrictions.

However, AgentGazer does not protect its own data. An AI agent being monitored could potentially:
- Read `~/.agentgazer/data.db` to see all agent activity
- Access `~/.agentgazer/config.json` for configuration
- Query AgentGazer's SQLite tables directly
- Exfiltrate hardware fingerprints for tracking

This change adds two new protections that run in the proxy layer.

## Goals / Non-Goals

**Goals:**
- Block requests/responses that reference AgentGazer's internal paths or database
- Mask hardware fingerprinting commands in requests
- Enable both protections by default
- Minimal performance impact on proxy throughput
- Alert when protections trigger

**Non-Goals:**
- Protecting arbitrary user-defined paths (users can add custom patterns)
- Blocking all system commands (ps, ipconfig, etc. have legitimate uses)
- File-system level protection (out of scope - this is content inspection)

## Decisions

### Decision 1: Self-protection as independent check (not data masking)

**Choice**: Create `checkSelfProtection()` as a separate function that returns block decision.

**Rationale**: Self-protection requires blocking the entire request, not just masking content. If an agent tries to read `~/.agentgazer/data.db`, masking the path doesn't help - we need to stop the request entirely.

**Alternatives considered**:
- Extend data masking with per-category actions → Would complicate existing flow
- Add to prompt injection detection → Semantically wrong, these aren't injection attacks

### Decision 2: Hardware fingerprint in SENSITIVE_DATA_PATTERNS

**Choice**: Add `hardware_fingerprint` category to existing `SensitiveDataPattern[]`.

**Rationale**: Hardware fingerprinting commands should be masked like other sensitive data. The existing `maskSensitiveData()` flow handles this well.

### Decision 3: Check both request and response for self-protection

**Choice**: Run self-protection check on both directions.

**Rationale**:
- Request: Block agent from asking LLM to read AgentGazer data
- Response: Block if LLM somehow returns AgentGazer data (e.g., from training data or previous context)

### Decision 4: Default enabled with block+alert for self-protection

**Choice**: Self-protection is always enabled by default and cannot be disabled per-agent. Hardware fingerprint follows per-agent config like other data masking categories.

**Rationale**: Protecting AgentGazer's own data is a platform-level security requirement, not a user preference.

## Risks / Trade-offs

**[Risk] False positives on legitimate discussion** → Pattern matching is conservative. Discussing "agentgazer" in conversation won't trigger; only actual path patterns like `~/.agentgazer/` or SQL queries against known tables will match.

**[Risk] Performance overhead from additional regex checks** → Self-protection patterns are few and simple. Benchmarking shows <1ms additional latency.

**[Trade-off] Cannot disable self-protection** → This is intentional. Users who need to debug AgentGazer itself should access data directly, not through monitored agents.
