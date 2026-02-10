## Context

Currently, `agentgazer start` accepts CLI flags for configuration but doesn't persist them. Users with port conflicts or preferences must specify flags every time.

The config file `~/.agentgazer/config.json` already exists and stores the API token. We extend it with additional settings.

## Goals / Non-Goals

**Goals:**
- Allow users to set persistent defaults for: `port`, `proxyPort`, `autoOpen`, `retentionDays`
- CLI flags override config values (standard precedence: CLI > config > defaults)
- Backward compatible - existing config files without new fields work fine

**Non-Goals:**
- Config file editor/wizard (users edit JSON directly)
- Environment variable support (may add later)
- Hot-reload of config (requires restart)

## Decisions

### 1. Extend existing AgentGazerConfig interface

```typescript
interface AgentGazerConfig {
  token: string;
  // New optional fields:
  port?: number;        // Dashboard port (default: 18800)
  proxyPort?: number;   // LLM proxy port (default: 4000)
  autoOpen?: boolean;   // Auto-open browser (default: true)
  retentionDays?: number; // Data retention (default: 30)
}
```

**Rationale:** Reuse existing config infrastructure. Optional fields ensure backward compatibility.

### 2. Precedence: CLI flags > config.json > hardcoded defaults

**Rationale:** Standard pattern. Users expect CLI to override file config.

### 3. No validation on config read, validate at use-time

**Rationale:** Keep `readConfig()` simple. Validation happens in `cmdStart()` where we already validate CLI flags.

## Risks / Trade-offs

- **Invalid config values**: User puts `"port": "abc"` → Handled by existing validation in cmdStart, will show error
- **Unknown fields ignored**: Future-proof, but typos like `"prot": 8080` silently ignored → Acceptable trade-off for simplicity
