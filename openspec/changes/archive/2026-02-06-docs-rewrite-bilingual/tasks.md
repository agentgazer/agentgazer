## 1. Operation Guide — Chinese (rewrite)

- [x] 1.1 Rewrite `docs/operation-guide-zh.md` with platform overview section: what AgentTrace is, core features, data collection methods (proxy vs SDK), supported providers table, all reflecting local-first architecture
- [x] 1.2 Add system architecture section with ASCII diagram showing CLI → Express server (:8080) + LLM proxy (:4000) + React dashboard + SQLite
- [x] 1.3 Add installation and quick start section: `npx agenttrace`, onboard flow, token generation, verifying the system is running
- [x] 1.4 Add CLI reference section documenting all subcommands: onboard, start (with --port, --proxy-port, --retention-days, --no-open), status, reset-token, providers list|set|remove, version, doctor, agents, stats (with --range), help
- [x] 1.5 Add proxy usage section: path prefix routing table (/openai/, /anthropic/, etc.), x-target-url header, OpenAI baseURL example, provider auto-detection hierarchy, health check endpoint, privacy guarantees
- [x] 1.6 Add SDK usage section: installation, init, track, heartbeat, error, custom, distributed tracing (startTrace/startSpan), batching behavior, graceful shutdown, complete working example
- [x] 1.7 Add dashboard section documenting all pages: Login, Overview, Agents list, Agent detail (stats cards, charts, time range), Costs, Alerts
- [x] 1.8 Add alert system section: three rule types (agent_down, error_rate, budget) with config parameters, delivery channels (webhook with retry, email via SMTP), cooldown period, management via dashboard and API
- [x] 1.9 Add provider key management section: encrypted secret store, providers set command, supported backends (machine key, macOS Keychain, libsecret), auto-migration, key injection behavior
- [x] 1.10 Add API reference section: all REST endpoints (events, agents, stats, alerts, alert-history, auth, health) with methods, parameters, request/response formats, status codes
- [x] 1.11 Add Docker deployment section: docker compose up, port mapping, persistent volume, environment variables
- [x] 1.12 Add environment variables section: NODE_ENV, LOG_LEVEL, SMTP_HOST/PORT/USER/PASS/FROM/SECURE
- [x] 1.13 Add troubleshooting section with local-first specific issues: events not appearing, proxy not detecting provider, 429 rate limits, agent status unknown, dashboard login, cost calculation

## 2. Operation Guide — English

- [x] 2.1 Create `docs/operation-guide-en.md` with identical heading structure and content as the Chinese version, translated to English
- [x] 2.2 Verify heading hierarchy matches zh version one-to-one

## 3. OpenClaw Integration Guide — Chinese

- [x] 3.1 Create `docs/guide-openclaw-zh.md` with overview section: why monitor OpenClaw, what you get (cost visibility, error tracking, latency, agent-down detection)
- [x] 3.2 Add prerequisites section: Node.js >= 18, AgentTrace, OpenClaw installed and running, Anthropic/OpenAI API key
- [x] 3.3 Add AgentTrace setup section: npx agenttrace, note token and ports
- [x] 3.4 Add architecture diagram (ASCII): OpenClaw Gateway → AgentTrace Proxy → LLM Provider, with monitoring layer
- [x] 3.5 Add Anthropic provider config section: complete openclaw.json snippet with baseUrl pointing to localhost:4000, api: anthropic-messages, agent model selection
- [x] 3.6 Add OpenAI provider config section: openclaw.json snippet with api: openai-completions
- [x] 3.7 Add multi-provider config section: both Anthropic and OpenAI in single openclaw.json
- [x] 3.8 Add provider key setup section: agenttrace providers set anthropic/openai, explain auto-injection
- [x] 3.9 Add verification section: send test message to OpenClaw, check dashboard for event
- [x] 3.10 Add alert setup section: agent-down, error-rate, and budget alert examples relevant to OpenClaw
- [x] 3.11 Add troubleshooting section: wrong baseUrl, provider not detected, API key issues, connection errors, events not appearing

## 4. OpenClaw Integration Guide — English

- [x] 4.1 Create `docs/guide-openclaw-en.md` with identical heading structure and content as the Chinese version, translated to English
- [x] 4.2 Verify heading hierarchy matches zh version one-to-one

## 5. Cleanup and Verification

- [x] 5.1 Verify no mentions of Supabase, Vercel, Next.js, Edge Functions, .env.local, or GitHub OAuth remain in any docs/ file
- [x] 5.2 Verify all four files exist with matching heading structures (zh/en pairs)
