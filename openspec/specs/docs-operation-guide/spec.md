## ADDED Requirements

### Requirement: Bilingual operation guide files exist
The project SHALL provide `docs/operation-guide-zh.md` (Traditional Chinese) and `docs/operation-guide-en.md` (English) with identical heading structure.

#### Scenario: Both files exist with matching structure
- **WHEN** a user checks the docs/ directory
- **THEN** both `operation-guide-zh.md` and `operation-guide-en.md` exist, and their heading hierarchy (h1, h2, h3) matches one-to-one

### Requirement: Guide reflects local-first architecture
The operation guide SHALL describe the current architecture: local Express server, SQLite database, React dashboard served by CLI, and LLM proxy — with no references to Supabase, Vercel, Next.js, Edge Functions, or GitHub OAuth.

#### Scenario: No outdated references
- **WHEN** a user reads the operation guide
- **THEN** there are zero mentions of Supabase, Vercel, Next.js, Edge Functions, `.env.local`, or GitHub OAuth

#### Scenario: Architecture diagram is accurate
- **WHEN** a user reads the architecture section
- **THEN** the diagram shows CLI starting Express server (:8080), LLM proxy (:4000), and React dashboard, all backed by local SQLite

### Requirement: Platform overview section
The guide SHALL include a platform overview section covering: what AgentTrace is, core features (monitoring, cost tracking, health detection, alerting, privacy), data collection methods (proxy vs SDK), and supported LLM providers table.

#### Scenario: Provider table is complete
- **WHEN** a user reads the supported providers table
- **THEN** it lists at minimum: OpenAI, Anthropic, Google, Mistral, Cohere with their host patterns

### Requirement: Installation and quick start section
The guide SHALL include installation instructions via `npx agenttrace`, covering the onboard flow, first-time token generation, and how to verify the system is running.

#### Scenario: First run walkthrough
- **WHEN** a new user follows the quick start section
- **THEN** they can run `npx agenttrace`, see the dashboard open in a browser, and know where to find their auth token

### Requirement: CLI reference section
The guide SHALL document all CLI subcommands: `onboard`, `start`, `status`, `reset-token`, `providers list|set|remove`, `version`, `doctor`, `agents`, `stats`, and `help`, with their flags and usage examples.

#### Scenario: Start command documented with all flags
- **WHEN** a user reads the CLI reference for `start`
- **THEN** they see documentation for `--port`, `--proxy-port`, `--retention-days`, and `--no-open` flags with defaults

#### Scenario: Providers subcommands documented
- **WHEN** a user reads the CLI reference for `providers`
- **THEN** they see documentation for `list`, `set <name> <key>`, and `remove <name>` subcommands

### Requirement: Proxy usage section
The guide SHALL document proxy usage including: path prefix routing (`/openai/v1/...`, `/anthropic/v1/...`), `x-target-url` header, transparent forwarding, provider auto-detection hierarchy, health check endpoint, and privacy guarantees.

#### Scenario: Path prefix routing documented
- **WHEN** a user reads the proxy section
- **THEN** they see examples of routing via path prefix (e.g., `http://localhost:4000/openai/v1/chat/completions`) and a table of supported prefix-to-provider mappings

#### Scenario: OpenAI base URL example
- **WHEN** a user wants to route OpenAI calls through the proxy
- **THEN** the guide shows setting `OPENAI_BASE_URL=http://localhost:4000/v1` or configuring the SDK's `baseURL`

### Requirement: SDK usage section
The guide SHALL document the SDK with: installation, initialization (`AgentTrace.init`), `track()`, `heartbeat()`, `error()`, `custom()`, distributed tracing (`startTrace`/`startSpan`), batching behavior, graceful shutdown, and a complete working example.

#### Scenario: Complete SDK example
- **WHEN** a user reads the SDK section
- **THEN** they see a complete TypeScript example showing init, track, heartbeat, error, and shutdown with an OpenAI call

### Requirement: Dashboard section
The guide SHALL document all dashboard pages: Login, Overview, Agents list, Agent detail (with stats cards, charts, time range selector), Costs, and Alerts.

#### Scenario: Agent detail page documented
- **WHEN** a user reads the dashboard section
- **THEN** they see documentation for stats cards (requests, errors, error rate, cost, tokens, P50/P99 latency), charts, and time range filtering (1h, 24h, 7d, 30d)

### Requirement: Alert system section
The guide SHALL document: three alert rule types (agent_down, error_rate, budget) with their configurable parameters, delivery channels (webhook with retry, email via SMTP), cooldown period, and how to manage alerts via dashboard and API.

#### Scenario: Alert types documented with parameters
- **WHEN** a user reads the alert section
- **THEN** they see each rule type with its config parameters (e.g., agent_down: duration_minutes, error_rate: threshold + window_minutes, budget: threshold USD)

### Requirement: Provider key management section
The guide SHALL document: how API keys are stored (encrypted secret store), `providers set` command, supported secret backends (machine key, macOS Keychain, libsecret), auto-migration from plaintext config, and key injection behavior in the proxy.

#### Scenario: Secret store explained
- **WHEN** a user reads the provider key management section
- **THEN** they understand that keys are encrypted at rest, which backends are available, and that keys are auto-injected by the proxy when the target hostname matches a known provider

### Requirement: API reference section
The guide SHALL document all REST API endpoints: events (POST ingest, GET query, GET export), agents (GET list, GET detail), stats (GET overview, GET per-agent), alerts (CRUD + toggle), alert-history (GET), auth (POST verify), and health (GET).

#### Scenario: Event ingestion API documented
- **WHEN** a user reads the API reference
- **THEN** they see the POST /api/events endpoint with request/response format, field descriptions, event types, rate limits, and status codes (200, 207, 400, 401, 429)

### Requirement: Docker deployment section
The guide SHALL document deployment via `docker compose up -d` with port mapping, persistent volume for `~/.agenttrace/`, and environment variable configuration.

#### Scenario: Docker quick start
- **WHEN** a user reads the Docker section
- **THEN** they can run `docker compose up -d` and access the dashboard at localhost:8080 and proxy at localhost:4000

### Requirement: Environment variables section
The guide SHALL list all supported environment variables: `NODE_ENV`, `LOG_LEVEL`, and SMTP variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE`).

#### Scenario: SMTP variables documented
- **WHEN** a user wants to enable email alerts
- **THEN** the guide lists all required SMTP environment variables with their descriptions and defaults

### Requirement: Troubleshooting section
The guide SHALL include a troubleshooting section covering common issues specific to the local-first architecture: events not appearing, proxy not detecting provider, 429 rate limits, agent status unknown, dashboard login issues, and cost calculation issues.

#### Scenario: Troubleshooting reflects local architecture
- **WHEN** a user reads the troubleshooting section
- **THEN** all advice references local components (localhost endpoints, SQLite, token auth) with no mention of Supabase or cloud services
