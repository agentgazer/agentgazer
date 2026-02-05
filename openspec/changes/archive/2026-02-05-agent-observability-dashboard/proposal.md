## Why

Autonomous AI agents (Moltbook bots, background task agents, multi-agent systems) are proliferating, but existing LLM observability tools (Helicone, LangSmith, Langfuse) only monitor individual API calls — not the agent as a living entity. Operators have no way to know if their agent is alive, behaving normally, under attack, or worth the cost of running. The market needs an **agent-level** observability layer that sits above LLM call monitoring.

## What Changes

- New full-stack web application: Next.js frontend + Supabase backend
- TypeScript SDK for agent developers to instrument their agents with one-line setup
- Local proxy server that intercepts LLM API calls (any provider), extracts usage stats, and reports them without exposing prompt content
- Real-time dashboard showing agent health, behavior patterns, cost tracking, and anomaly detection
- Alerting system (webhook + email) for agent failures, abnormal behavior, and budget thresholds
- REST API for ingesting agent events from SDK and proxy

## Capabilities

### New Capabilities
- `event-ingestion`: REST API that receives agent lifecycle events and LLM usage data from SDK/proxy, validates, and stores them
- `agent-sdk`: TypeScript SDK providing `track()`, `heartbeat()`, and `error()` methods for agent instrumentation
- `local-proxy`: Local proxy server that transparently intercepts LLM API calls (OpenAI, Anthropic, etc.), extracts token/cost/latency metrics, and forwards stats to the ingest API without transmitting prompt content
- `dashboard`: Real-time web dashboard displaying agent list, health status, token usage charts, cost breakdowns, and latency trends
- `alerting`: Configurable alerts for agent-down, error rate spikes, budget thresholds, and behavior anomalies, delivered via webhook and email

### Modified Capabilities

(none — greenfield project)

## Impact

- **New codebase**: Next.js app, SDK package, proxy package (monorepo)
- **External dependencies**: Supabase (Postgres + Realtime + Auth), Resend or similar for email alerts
- **Deployment**: Vercel for dashboard, npm for SDK + proxy packages
- **User environment**: SDK/proxy run in user's local environment; only anonymized metrics leave their machine
