## Context

A full codebase review uncovered 8 bugs spanning 6 packages. These are all independent fixes — no shared architectural change needed. The fixes range from trivial one-liners (#8 constant reference) to moderate refactors (#4/#5 API contract alignment). All can be done in parallel without conflicts.

The server is the source of truth for API response shapes. Where CLI and dashboard disagree on field names, we need to read the actual server routes to determine who is correct, then fix the consumer(s).

## Goals / Non-Goals

**Goals:**
- Fix all 8 identified bugs
- Ensure CLI and dashboard agree on API contracts
- Zero breaking changes to existing API surface
- All existing tests pass after changes

**Non-Goals:**
- Adding new features or capabilities
- Refactoring beyond the minimum fix
- Adding new tests beyond what's needed to verify the fixes
- Addressing performance or UX issues not in the bug list

## Decisions

### D1: resetToken — read-then-write vs merge

**Decision**: Read existing config, replace only `token`, write back.

**Rationale**: Simplest fix. The alternative (separate token file) would be over-engineering for a one-field fix.

```typescript
export function resetToken(): AgentTraceConfig {
  const existing = readConfig();
  const config: AgentTraceConfig = {
    ...existing,
    token: generateToken(),
  };
  saveConfig(config);
  return config;
}
```

### D2: API response shape — server is source of truth

**Decision**: Read the actual server route code for `/api/agents` and `/api/stats/:agentId` to determine the canonical response shapes. Fix whichever consumer (CLI or dashboard) is wrong.

**Rationale**: The server is already deployed and clients depend on it. Changing the server would break any existing integrations.

### D3: CLI argument parsing — skip flags for positional args

**Decision**: Filter out `--flag value` pairs from argv before extracting positional agent ID, rather than rewriting with a full arg parser library.

**Rationale**: The CLI already has a `parseFlags()` helper. We just need a `parsePositional()` companion. Adding commander/yargs for this one fix is overkill — the CLI already uses a manual approach throughout.

### D4: Auth token — timingSafeEqual

**Decision**: Use `crypto.timingSafeEqual()` with Buffer encoding to compare tokens.

**Rationale**: Standard Node.js approach. No dependencies needed. Must handle different-length strings (timingSafeEqual throws on length mismatch).

```typescript
import { timingSafeEqual } from "node:crypto";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
```

### D5: EventBuffer warning — use shared logger

**Decision**: Import logger from `@agenttrace/shared` and emit a `warn` log when events are dropped.

**Rationale**: The SDK already depends on `@agenttrace/shared`. Using the existing logger keeps the approach consistent and avoids adding callback/event-emitter complexity.

### D6: Ingest test fix — match actual response

**Decision**: Change test assertions from `json.success` to `json.status === "ok"` and check `json.event_ids`.

**Rationale**: The function's response contract is correct. The tests are wrong.

### D7: Secret store constant — use exported PROVIDER_SERVICE

**Decision**: Replace the local `const SERVICE` with the imported `PROVIDER_SERVICE` in `migrateFromPlaintextConfig`.

**Rationale**: One-line fix. Eliminates the divergence risk.

## Risks / Trade-offs

- **[Risk] API contract uncertainty** — We haven't confirmed the actual server response shapes yet. → Mitigation: Read the server route files during implementation and fix accordingly. This is task #1.
- **[Risk] timingSafeEqual on short tokens** — If token is empty string, Buffer.from("") has length 0 which is valid for timingSafeEqual. → Mitigation: Auth middleware already rejects missing/empty tokens before comparison.
- **[Risk] Logger dependency in SDK** — SDK may not currently import logger. → Mitigation: Check during implementation; if not imported, a simple `console.warn` fallback is acceptable.
