## Context

Current `agentgazer uninstall` command just prints a message and doesn't perform any actual cleanup. Users expect uninstall to clean up sensitive data like API keys.

## Goals / Non-Goals

**Goals:**
- Provide modular uninstall options (users can run multiple times to clean different things)
- Clean up provider keys from secret store
- Clean up config and data files
- Stop running daemon before cleanup
- Support both interactive menu and CLI flags

**Non-Goals:**
- Auto-detecting installation method (we show both npm and brew commands)
- Uninstalling the binary itself (we just show the command)

## Decisions

### 1. Interactive menu by default, flags for scripting
**Rationale**: Interactive menu is friendlier for users who aren't sure what to clean. Flags enable scripting and automation.

### 2. Modular cleanup options
**Rationale**: User may want to keep some data (e.g., keep history but remove keys). Running uninstall multiple times with different options is intuitive.

### 3. Confirmation required for destructive actions
**Rationale**: Prevent accidental data loss. Option 2 (binary only) doesn't need confirmation since it just shows a command.

### 4. Stop daemon first
**Rationale**: Files may be locked if daemon is running. Always stop daemon before cleanup.

### 5. Use existing secret store methods
**Rationale**: `secretStore.list("com.agentgazer.provider")` returns all provider names, then `secretStore.delete()` for each.

## Implementation Notes

```typescript
// Menu using readline or simple prompt
const options = [
  "Complete uninstall (everything)",
  "Binary only (npm/homebrew)",
  "Config only (~/.agentgazer/config.json)",
  "Provider keys only",
  "Agent data only (~/.agentgazer/data.db)",
];

// Files to clean
const CONFIG_FILE = path.join(os.homedir(), ".agentgazer", "config.json");
const DATA_FILE = path.join(os.homedir(), ".agentgazer", "data.db");
const LOG_FILE = path.join(os.homedir(), ".agentgazer", "agentgazer.log");
const PID_FILE = path.join(os.homedir(), ".agentgazer", "agentgazer.pid");

// Secret store service
const PROVIDER_SERVICE = "com.agentgazer.provider";
```

## Risks / Trade-offs

**[Risk] User accidentally deletes data** → Mitigated by confirmation prompt

**[Risk] Secret store fails to delete** → Show error but continue with other cleanup
