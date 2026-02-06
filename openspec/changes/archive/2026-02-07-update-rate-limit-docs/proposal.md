## Why

The rate limit feature (per-agent per-provider) was implemented in `move-rate-limits-to-dashboard` but documentation was not updated. Users have no way to discover or learn about this feature from the docs or README.

## What Changes

- Add "Rate Limit Settings" section to Dashboard documentation (en/zh)
- Add "Rate Limiting" section to Proxy documentation (en/zh)
- Update README.md to mention rate limiting feature with link to docs

## Capabilities

### New Capabilities

None — this is a documentation-only change.

### Modified Capabilities

None — no spec-level behavior changes, only documentation updates.

## Impact

- `apps/docs/en/guide/dashboard.md` — add Rate Limit Settings section
- `apps/docs/zh/guide/dashboard.md` — add Rate Limit Settings section (Chinese)
- `apps/docs/en/guide/proxy.md` — add Rate Limiting section
- `apps/docs/zh/guide/proxy.md` — add Rate Limiting section (Chinese)
- `README.md` — add rate limiting to feature list with doc link
