## Why

The `agentgazer onboard` experience needs polish before public release. Three issues:
1. Yi provider is listed but no longer supported
2. Provider names alone are confusing (users know "GLM-4" not "Zhipu")
3. No visual branding - CLI feels generic

## What Changes

- **Remove Yi provider** from onboard prompts and provider list
- **Show model names** alongside provider names for recognition (e.g., "zhipu (GLM-4)")
- **Add ASCII logo** with brand colors at onboard start

## Capabilities

### New Capabilities
- `onboard-branding`: ASCII logo display with ANSI colors matching dashboard theme

### Modified Capabilities
- `cli-subcommands`: Update onboard command to show model names and remove Yi

## Impact

- `packages/shared/src/providers.ts` - Remove Yi from KNOWN_PROVIDER_NAMES
- `packages/shared/src/pricing.ts` - Remove Yi pricing data
- `packages/cli/src/cli.ts` - Add ASCII logo, update provider display format
