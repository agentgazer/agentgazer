## Context

The `cmdOnboard()` function in `packages/cli/src/cli.ts` currently iterates through all providers in `KNOWN_PROVIDER_NAMES` and prompts for each one sequentially using `askSecret()`. This requires users to press Enter to skip each unwanted provider.

The CLI already has `inquirer` as a dependency, which provides a `checkbox` prompt type for multi-select lists.

## Goals / Non-Goals

**Goals:**
- Replace sequential prompts with a single multi-select checkbox list
- Show OAuth providers with clear labeling that they need Dashboard configuration
- Show already-configured providers with a visual indicator
- Only prompt for API keys for selected providers

**Non-Goals:**
- Changing OAuth flow (still configured via Dashboard)
- Adding provider validation during selection (validation happens after key entry)
- Pre-selecting configured providers (just mark them, don't auto-select)

## Decisions

### 1. Use inquirer checkbox prompt

**Decision**: Use `inquirer.prompt()` with `type: 'checkbox'` for provider selection.

**Rationale**: Already a dependency, provides arrow-key navigation and space-to-select UX that's familiar to CLI users.

**Alternative considered**: Custom implementation with ink - rejected as overkill for this use case.

### 2. Build choice list dynamically

**Decision**: Build the choices array by:
1. Iterating `SELECTABLE_PROVIDER_NAMES` (excludes internal providers like `agentgazer`)
2. For each provider, check if OAuth via `isOAuthProvider()`
3. For each provider, check if configured via secret store `store.get()`
4. Format label accordingly

**Choice label formats**:
- Normal: `OpenAI (GPT-4o, o1, o3)`
- OAuth: `OpenAI Codex (OAuth - configure in Dashboard)`
- Configured: `Anthropic (Claude) ✓ configured`

### 3. Skip OAuth providers silently

**Decision**: If user selects an OAuth provider, don't prompt for API key - just skip it. No error, no message during the flow.

**Rationale**: The label already tells them to configure in Dashboard. Adding a message would be redundant.

### 4. Check configured status via secret store

**Decision**: Use `store.get(PROVIDER_SERVICE, provider)` to check if a provider has a key stored.

**Rationale**: This is the source of truth for whether a provider is configured. The config.json entry just marks that a provider exists, but the actual key is in the secret store.

## Risks / Trade-offs

**[Risk]** Long provider list may be hard to navigate
→ Mitigation: inquirer supports pagination automatically, list is currently ~12 items which fits most terminals

**[Risk]** User confusion about OAuth providers appearing in list
→ Mitigation: Clear "(OAuth - configure in Dashboard)" label

**[Trade-off]** Losing the ability to configure providers in a specific order
→ Acceptable: Order doesn't matter for configuration
