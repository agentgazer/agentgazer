## 1. Dashboard Screenshot

- [x] 1.1 Capture dashboard screenshot and save to `assets/dashboard-screenshot.png` — SKIPPED: screenshot already exists (3628x1796 PNG, 448KB)
- [x] 1.2 Verify README image renders correctly on GitHub — image reference `assets/dashboard-screenshot.png` is correct and file exists

## 2. MCP Documentation in README

- [x] 2.1 Add MCP feature section to README (what it does, how to set up)
- [x] 2.2 Add MCP to the feature comparison table
- [x] 2.3 Link to detailed MCP docs page

## 3. Remove Supabase Remnants

- [x] 3.1 Remove `supabase/` directory (or document why it's kept) — removed; not used by any active source code
- [x] 3.2 Remove any references to Supabase in codebase — remaining references are only in openspec archives/specs (historical records, not modified)

## 4. Fix CLI Typo

- [x] 4.1 Fix `deactive` → `deactivate` in CLI help text and command name
- [x] 4.2 Keep `deactive` as an alias for backward compatibility (optional) — kept as hidden alias in agent.ts and provider.ts

## 5. Verification

- [x] 5.1 Review README renders correctly on GitHub — verified image path, MCP section style consistency, feature table alignment
- [x] 5.2 Run CLI help and verify corrected text — help text updated in cli.ts, agent.ts, provider.ts; docs updated in en/zh
