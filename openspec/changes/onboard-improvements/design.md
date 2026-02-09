## Context

The onboard command is the first interaction users have with AgentGazer. Currently it's functional but lacks polish - no branding, confusing provider names, and includes a deprecated provider (Yi).

## Goals / Non-Goals

**Goals:**
- Make onboard visually branded with ASCII logo
- Help users recognize providers by popular model names
- Clean up deprecated Yi provider

**Non-Goals:**
- Redesigning the entire onboard flow
- Adding interactive provider selection UI
- Supporting provider aliases (e.g., typing "claude" to mean "anthropic")

## Decisions

### 1. ASCII Logo Design
Use eye-themed ASCII art matching dashboard icon, with ANSI colors:
- Eye shape: Blue (`\x1b[34m`)
- "AgentGazer" text: White bold (`\x1b[1m`)
- Tagline: Gray (`\x1b[90m`)

```
       .-===-.
      / /   \ \
     | |     | |    AgentGazer
      \ \   / /     From Observability to Control
       '-===-'
```

**Why**: Matches dashboard branding, simple enough to render in any terminal.

### 2. Provider Display Format
Show `provider (Model)` format:
```
openai (GPT-4)
anthropic (Claude)
google (Gemini)
zhipu (GLM-4)
moonshot (Kimi)
minimax (abab)
```

**Why**: Many users know models by name, not company. Chinese providers especially (Zhipu → GLM, Moonshot → Kimi).

### 3. Yi Removal Scope
Remove Yi from:
- `KNOWN_PROVIDER_NAMES` array
- Pricing tables
- Provider detection logic

**Why**: Yi API is discontinued/inaccessible.

## Risks / Trade-offs

- **ANSI colors may not render in all terminals** → Logo still readable without colors
- **Model names may become outdated** → Use flagship/stable model names that rarely change
