## Context

The codebase migrated from Supabase + Next.js to a local-first Express + SQLite architecture, but the only documentation (`docs/operation-guide-zh.md`) still describes the old architecture. The README is reasonably accurate but serves as a quick-start, not a comprehensive manual. There is no English operation guide and no integration guide for any real-world agent.

The first real-world test target is OpenClaw — an open-source personal AI assistant (TypeScript, Node.js, multi-provider). OpenClaw supports `baseUrl` override in its `models.providers` config, making AgentTrace proxy integration trivial.

## Goals / Non-Goals

**Goals:**
- Provide a complete, accurate bilingual (zh/en) operation manual reflecting the current local-first architecture
- Provide a bilingual step-by-step integration guide using OpenClaw as the example agent
- Both guides should be self-contained — a new user can go from zero to monitoring with just the docs
- Keep content structure identical between zh and en versions for easy maintenance

**Non-Goals:**
- Rewriting the README (it serves a different purpose as a quick-start)
- Adding integration guides for other agents (just OpenClaw for now)
- Generating API docs from code (manual docs are sufficient at this stage)
- Adding screenshots to the dashboard section (ASCII diagrams are sufficient)

## Decisions

### Decision 1: File structure — separate files per language, not one file with both

**Choice**: `operation-guide-zh.md` + `operation-guide-en.md` (and same for OpenClaw guide)

**Rationale**: Bilingual in a single file makes both languages harder to read. Separate files let each version be clean and independently navigable. Identical heading structure makes cross-referencing easy.

**Alternative considered**: Single file with `<details>` toggles per language — rejected because it bloats file size and is clunky to navigate.

### Decision 2: Operation guide structure — comprehensive manual organized by usage flow

**Choice**: Organize chapters in the order a user encounters them: install → onboard → start → proxy → SDK → dashboard → alerts → providers → API reference → Docker → env vars → troubleshooting.

**Rationale**: Follows the natural user journey rather than grouping by technical component.

### Decision 3: OpenClaw guide — focused on proxy integration with API key auth

**Choice**: Guide assumes OpenClaw uses Anthropic API key (not OAuth), and demonstrates proxy-only integration (no SDK instrumentation of OpenClaw code).

**Rationale**: The user confirmed API key usage. Proxy is the natural fit because OpenClaw's `models.providers` config supports `baseUrl` override natively — zero code changes needed. SDK integration would require forking OpenClaw, which defeats the purpose.

### Decision 4: OpenClaw multi-provider — show both Anthropic and OpenAI examples

**Choice**: Include configuration examples for routing both Anthropic and OpenAI calls through AgentTrace proxy.

**Rationale**: OpenClaw supports model failover across providers. Users running both should see how to monitor all of them.

### Decision 5: Architecture diagrams — ASCII art, not images

**Choice**: Use ASCII diagrams throughout both guides.

**Rationale**: Works in any markdown renderer, no external assets to maintain, diffs cleanly in git.

## Risks / Trade-offs

- **Maintenance burden**: 4 documentation files (2 guides × 2 languages) need to stay in sync. → Mitigation: Identical heading structure between zh/en makes diffing easy.
- **OpenClaw config may change**: OpenClaw is actively developed; `models.providers` config format could change. → Mitigation: Document the version/date tested and link to OpenClaw's official docs.
- **Docs may drift from code**: No automated doc-testing. → Mitigation: Structure docs around CLI commands and API endpoints that are relatively stable.
