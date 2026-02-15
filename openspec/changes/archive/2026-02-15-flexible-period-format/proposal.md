## Why

Current stats API only accepts fixed period values (1h, today, 24h, 7d, 30d, all). Users cannot query arbitrary time ranges like "last 3 days" or "last 6 hours". This is unintuitive for AI agents that want to ask natural questions like "how much did I spend in the last 3 days?"

## What Changes

- Support arbitrary numeric period formats: `Nd` (days) and `Nh` (hours)
- Examples: `3d` (last 3 days), `12h` (last 12 hours), `5d` (last 5 days)
- Keep existing fixed periods as aliases: `today`, `all`
- Update CLI help text and OpenClaw skill documentation

## Capabilities

### New Capabilities

- `flexible-period-format`: Support arbitrary Nd/Nh period formats in stats APIs

### Modified Capabilities

<!-- None - this extends existing period handling -->

## Impact

- **packages/server**: Update `computeTimeRange` to parse `Nd`/`Nh` formats
- **packages/cli**: Update help text for `--range` flag
- **packages/server/routes/openclaw.ts**: Update skill template documentation
