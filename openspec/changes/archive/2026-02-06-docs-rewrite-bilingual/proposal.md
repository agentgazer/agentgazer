## Why

The existing `docs/operation-guide-zh.md` describes the old Supabase + Next.js architecture that no longer exists. The codebase has since moved to a local-first Express + SQLite architecture with `npx agentgazer` as the single entry point. Users following the current guide will be completely misled. Additionally, there is no English version of the operation guide, no integration guide for real-world agents, and no documentation showing how to use AgentGazer with OpenClaw — the first target user.

## What Changes

- **Rewrite operation guide (Chinese)**: Complete rewrite of `docs/operation-guide-zh.md` to reflect the local-first architecture (Express + SQLite, CLI subcommands, token auth, secret store, local dashboard)
- **New operation guide (English)**: Create `docs/operation-guide-en.md` as the English counterpart with identical content structure
- **New OpenClaw integration guide (Chinese)**: Create `docs/guide-openclaw-zh.md` — step-by-step guide to monitoring OpenClaw's LLM calls via AgentGazer proxy, including provider config, alert setup, and troubleshooting
- **New OpenClaw integration guide (English)**: Create `docs/guide-openclaw-en.md` as the English counterpart
- **Remove outdated content**: All references to Supabase, Vercel, Next.js dashboard, Edge Functions, GitHub OAuth, and `apps/dashboard/` are removed from docs

## Capabilities

### New Capabilities

- `docs-operation-guide`: Bilingual (zh/en) complete operation manual covering installation, CLI usage, proxy, SDK, dashboard, alerts, provider key management, API reference, Docker deployment, and troubleshooting — all reflecting the current local-first architecture
- `docs-openclaw-guide`: Bilingual (zh/en) integration guide demonstrating how to monitor OpenClaw AI agent with AgentGazer proxy, including `openclaw.json` provider config, multi-provider setup, alert rules, and troubleshooting

### Modified Capabilities

(none — documentation only, no spec-level behavior changes)

## Impact

- `docs/operation-guide-zh.md` — complete rewrite
- `docs/operation-guide-en.md` — new file
- `docs/guide-openclaw-zh.md` — new file
- `docs/guide-openclaw-en.md` — new file
- No code changes, no API changes, no dependency changes
