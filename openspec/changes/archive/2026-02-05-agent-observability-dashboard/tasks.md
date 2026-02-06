## 1. Project Setup

- [x] 1.1 Initialize monorepo with Turborepo (apps/dashboard, packages/sdk, packages/proxy, packages/shared)
- [x] 1.2 Configure TypeScript with shared tsconfig base and per-package configs
- [x] 1.3 Set up Supabase project (create project, configure Auth providers: email + GitHub OAuth)
- [x] 1.4 Create Supabase database schema: users, agents, agent_events, alert_rules, alert_history, api_keys tables
- [x] 1.5 Configure Supabase Row Level Security policies for all tables
- [x] 1.6 Set up Next.js dashboard app with App Router and Supabase client

## 2. Shared Package

- [x] 2.1 Define AgentEvent TypeScript type and Zod validation schema in packages/shared
- [x] 2.2 Define event_type enum: "llm_call" | "heartbeat" | "error" | "custom"
- [x] 2.3 Create LLM pricing table (OpenAI, Anthropic, Google, Mistral, Cohere models with per-token costs)
- [x] 2.4 Create provider detection utility (URL pattern matching for known providers)
- [x] 2.5 Create response parser per provider (extract tokens, model, status from response JSON)

## 3. Event Ingestion API

- [x] 3.1 Create Supabase Edge Function for POST /api/events endpoint
- [x] 3.2 Implement API key authentication middleware (validate key against api_keys table)
- [x] 3.3 Implement single event validation using shared Zod schema
- [x] 3.4 Implement batch event support (accept array of events, validate each, bulk insert)
- [x] 3.5 Implement rate limiting (1000 events/minute per API key)
- [x] 3.6 Return response with event IDs for confirmation

## 4. TypeScript SDK

- [x] 4.1 Implement AgentGazer.init({ apiKey, agentId, endpoint? }) initialization
- [x] 4.2 Implement watch.track({ provider, model, tokens, latency_ms, status, tags? })
- [x] 4.3 Implement watch.heartbeat() for periodic heartbeat events
- [x] 4.4 Implement watch.error(error) for error reporting
- [x] 4.5 Implement automatic batching (buffer events, flush every 5s or at 50 events)
- [x] 4.6 Implement graceful degradation (catch network errors, never crash the host agent)
- [x] 4.7 Export TypeScript types for AgentEvent and SDK options
- [x] 4.8 Write SDK README with usage examples

## 5. Local Proxy

- [x] 5.1 Create HTTP proxy server with configurable port (default: 4000)
- [x] 5.2 Implement request forwarding to real provider URLs (transparent pass-through)
- [x] 5.3 Implement provider detection from request URL using shared utility
- [x] 5.4 Implement response interception and metric extraction using shared parsers
- [x] 5.5 Implement cost calculation using shared pricing table
- [x] 5.6 Implement metric reporting to ingest API (stats only, no prompt content)
- [x] 5.7 Implement client-side event batching (buffer and flush every 5s or at 50 events)
- [x] 5.8 Handle unrecognized providers gracefully (forward request, skip metric extraction, log warning)
- [x] 5.9 Create CLI entry point: npx agentgazer-proxy --api-key <key> --agent-id <id> --port <port>
- [x] 5.10 Add proxy health check endpoint (GET /health)

## 6. Dashboard — Authentication & Layout

- [x] 6.1 Implement Supabase Auth login/signup pages (email + GitHub OAuth)
- [x] 6.2 Create authenticated layout with sidebar navigation
- [x] 6.3 Implement API key management page (generate, revoke, copy keys)
- [x] 6.4 Create responsive layout shell (desktop-first, usable on tablet)

## 7. Dashboard — Agent Views

- [x] 7.1 Build agent list view with status indicators (healthy/degraded/down)
- [x] 7.2 Implement agent health calculation from heartbeat recency (healthy < 2 intervals, degraded 2-5, down > 5)
- [x] 7.3 Build agent detail view with time range selector (1h, 24h, 7d, 30d, custom)
- [x] 7.4 Add token usage over time chart (line chart, input vs output tokens)
- [x] 7.5 Add cost breakdown by model/provider (bar chart or table)
- [x] 7.6 Add error rate display and latency percentiles (P50/P95/P99)
- [x] 7.7 Build cost summary view: total spend across all agents, per-agent breakdown

## 8. Dashboard — Real-time Updates

- [x] 8.1 Set up Supabase Realtime subscriptions for agent_events table changes
- [x] 8.2 Update agent status indicators in real-time when new heartbeats/events arrive
- [x] 8.3 Update charts and metrics live without page refresh (within 5 seconds of event)

## 9. Alerting System

- [x] 9.1 Create alert rules configuration UI (per-agent: agent-down, error-rate, budget threshold)
- [x] 9.2 Implement agent-down detection (no heartbeat for configurable duration, default 10 min)
- [x] 9.3 Implement error-rate threshold detection (configurable %, default 20%, rolling window)
- [x] 9.4 Implement budget threshold detection (cumulative cost exceeds user-defined limit)
- [x] 9.5 Implement webhook delivery (POST JSON to user-configured URL)
- [x] 9.6 Implement email delivery via Resend
- [x] 9.7 Implement alert cooldown (same alert must not fire more than once per 15 minutes)
- [x] 9.8 Build alert history view in dashboard
- [x] 9.9 Add enable/disable toggle per alert rule per agent

## 10. Testing & Polish

- [x] 10.1 Add integration tests for event ingestion API (valid events, invalid events, auth, rate limiting, batch)
- [x] 10.2 Add unit tests for provider detection and response parsing (per provider)
- [x] 10.3 Add unit tests for SDK batching and graceful degradation
- [x] 10.4 Add integration test for proxy end-to-end (mock provider, verify metrics reported)
- [x] 10.5 Add end-to-end test for dashboard (login, view agents, verify real-time updates)
- [x] 10.6 Configure Vercel deployment for dashboard
- [x] 10.7 Configure npm publish for @agentgazer/sdk and @agentgazer/proxy packages
