## Why

The current `agentgazer onboard` command requires users to press Enter to skip each provider they don't want to configure. With 12+ providers, this is tedious. Users should be able to select only the providers they want from an interactive list.

## What Changes

- Replace sequential "API key for X (Enter to skip)" prompts with an interactive multi-select checkbox list
- Show OAuth providers with "(OAuth - configure in Dashboard)" label and skip API key prompt if selected
- Show already-configured providers with "✓ configured" indicator, allowing re-configuration if selected
- Only prompt for API keys for the providers the user selects

## Capabilities

### New Capabilities

- `onboard-provider-select`: Interactive multi-select provider selection in CLI onboard flow

### Modified Capabilities

None - this is a UX improvement to the existing onboard command, not a spec-level requirement change.

## Impact

- `packages/cli/src/cli.ts`: Modify `cmdOnboard()` function
- Uses existing `inquirer` dependency (already in package.json)
- Requires detecting which providers are already configured (check secret store)
- Requires identifying OAuth providers (use `isOAuthProvider()` from shared)
