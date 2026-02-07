## Context

The current CLI has grown organically with commands like `providers list/set/remove` for key management and a basic `stats` command. Users must switch to the Dashboard for most operations (toggling agents, kill switches, viewing detailed stats). This redesign creates a consistent noun-verb command structure and adds a real-time TUI dashboard.

Current command structure:
```
agentgazer providers list/set/set-key/remove   ← key management
agentgazer stats [agent]                       ← basic stats
agentgazer agents                              ← list agents
```

## Goals / Non-Goals

**Goals:**
- Unified noun-verb command structure: `agentgazer <noun> <verb>`
- Full agent management from CLI (active/deactive, killswitch, delete, stats, model override)
- Full provider management from CLI (add, active/deactive, test, delete, models, stats)
- Real-time htop-style overview TUI
- Interactive prompts where appropriate (provider selection, model override)

**Non-Goals:**
- Backward compatibility with old command structure (breaking change)
- Alert management from CLI (keep in Dashboard for now)
- Rate limit configuration from CLI (keep in Dashboard)

## Decisions

### D1: Command Structure

```
agentgazer
├── overview                     ← TUI (ink)
├── agents                       ← list table
├── agent <name> <action>        ← agent management
├── providers                    ← list table
├── provider <action> [args]     ← provider management
├── start / status / onboard / reset-token / doctor / version / uninstall
```

**Rationale**: Noun-verb pattern is consistent and discoverable. `agent` singular for single-agent commands, `agents` plural for listing.

### D2: Provider Add with Flexible Arguments

```bash
agentgazer provider add                    # Full interactive
agentgazer provider add openai             # Ask for key only
agentgazer provider add openai sk-xxx      # Non-interactive
```

**Rationale**: Supports both interactive exploration and scripted automation. The current `providers set` required both args; new design is more flexible.

### D3: Model Override with Interactive Provider Selection

When `agentgazer agent <name> model-override <model>` is called:
1. Fetch list of providers the agent has used
2. If single provider → apply directly
3. If multiple providers → interactive selection via `inquirer` or similar

**Rationale**: Prevents ambiguity without forcing users to always specify provider.

### D4: TUI Library Choice — ink

Using `ink` (React for CLI) for the `overview` command:

| Considered | Pros | Cons |
|------------|------|------|
| blessed | Full-featured, charts | Large, old, poor TS support |
| ink | Modern, React model, good TS | No built-in charts |
| terminal-kit | Lightweight | Less ergonomic |

**Rationale**: ink is modern, well-maintained, and the React model fits well with component-based UI. For charts, we'll use ASCII art or simple bar representations.

### D5: File Structure

```
packages/cli/src/
├── cli.ts                     ← Main entry, command routing
├── commands/
│   ├── agent.ts               ← agent <name> <action>
│   ├── agents.ts              ← agents list
│   ├── provider.ts            ← provider <action>
│   ├── providers.ts           ← providers list
│   ├── overview.ts            ← Launch ink TUI
│   └── (existing: start, status, onboard, etc.)
├── tui/
│   ├── Overview.tsx           ← Main TUI component
│   ├── AgentTable.tsx         ← Agent list component
│   ├── EventLog.tsx           ← Recent events component
│   └── StatusBar.tsx          ← Top status bar
└── utils/
    ├── api.ts                 ← HTTP client for server API
    ├── format.ts              ← Number/time formatting
    └── prompt.ts              ← Interactive prompt helpers
```

### D6: API Endpoints Required

The CLI needs these server API endpoints (most already exist):

| Command | Endpoint | Exists? |
|---------|----------|---------|
| `agents` | `GET /api/agents` | ✓ |
| `agent <n> stat` | `GET /api/stats/:agent` | ✓ |
| `agent <n> active/deactive` | `PUT /api/agents/:id/policy` | ✓ |
| `agent <n> killswitch` | `PUT /api/agents/:id/policy` | ✓ |
| `agent <n> delete` | `DELETE /api/agents/:id` | ✓ |
| `agent <n> model` | `GET /api/agents/:id/model-rules` | ✓ |
| `agent <n> model-override` | `PUT /api/agents/:id/model-rules/:provider` | ✓ |
| `providers` | `GET /api/providers` | ✓ |
| `provider <n> stat` | `GET /api/providers/:name/stats` | ✓ |
| `provider <n> active/deactive` | `PUT /api/providers/:name/settings` | ✓ |
| `provider <n> delete` | `DELETE /api/providers/:name` | ✓ |
| `provider <n> models` | `GET /api/providers/:name/models` | ✓ |
| `overview` (polling) | `GET /api/overview` | ✓ |

## Risks / Trade-offs

**[Risk] ink adds React as dependency**
→ Mitigation: Only imported when `overview` command runs; tree-shaking keeps bundle reasonable.

**[Risk] Breaking change removes familiar commands**
→ Mitigation: Clear error messages pointing to new command. Update docs.

**[Trade-off] No `--provider` flag for model-override**
→ Accepted. Interactive selection is more user-friendly; power users can script with API directly.

**[Trade-off] TUI polling vs WebSocket**
→ Accepted. Polling every 2-3s is simpler and sufficient for overview dashboard.

## Migration Plan

1. Add new commands alongside old (temporarily)
2. Add deprecation warnings to old commands
3. Remove old commands in next minor version
4. Update all documentation

For this change: Skip deprecation, direct removal (user confirmed breaking change is OK).
