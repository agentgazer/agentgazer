## Context

Autonomous AI agents are moving from novelty to production workload. Moltbook bots run continuously, task agents execute multi-step workflows unsupervised, and multi-agent systems coordinate across processes. Operators deploy these agents and then have surprisingly little visibility into what happens next.

Existing LLM observability tools -- Helicone, LangSmith, Langfuse -- solve a different problem. They monitor individual LLM API calls: prompt/completion pairs, token counts, latencies. This is useful for debugging a single chain or evaluating prompt quality, but it does not answer the questions an agent operator actually has:

- Is my agent still alive?
- Is it behaving normally or stuck in a loop?
- How much is it costing me per hour / per task?
- Did something change in its behavior pattern overnight?
- Should I kill it or let it keep running?

There is no tool today that treats the agent as the primary unit of observation. This project fills that gap. It is a greenfield build: a real-time dashboard backed by a lightweight SDK and a local proxy, designed to give operators agent-level situational awareness without requiring them to trust a third party with their prompts or API keys.

This design document covers the architecture and key decisions for the MVP.

## Goals / Non-Goals

### Goals

- **Agent lifecycle monitoring.** Track whether each registered agent is alive, degraded, or down. Surface this as the top-level view in the dashboard.
- **Provider-agnostic LLM cost and usage tracking.** Capture token counts, cost estimates, and latency from any LLM provider (OpenAI, Anthropic, Google, Mistral, local models) through a local proxy that requires zero provider-specific configuration from the user.
- **Real-time dashboard.** Show agent health, cost accumulation, token usage trends, error rates, and behavior patterns with live updates -- no manual refresh.
- **Alerting on failures, anomalies, and budget thresholds.** Notify operators via webhook and email when an agent goes down, error rates spike, or spending exceeds a configured limit.
- **Privacy-first architecture.** Prompt content and API keys never leave the user's machine. Only aggregated, anonymized metrics are transmitted to the cloud dashboard.

### Non-Goals

- **NOT replacing LLM-level observability.** This is complementary to Helicone, LangSmith, and Langfuse. Those tools are better for prompt debugging and evaluation. This tool is better for operational monitoring of the agent as a whole.
- **NOT building prompt management or evaluation features.** No prompt versioning, A/B testing, or output scoring. That is a different product.
- **NOT supporting a self-hosted dashboard in MVP.** The dashboard is cloud-hosted. Self-hosted deployment is a future consideration, not an MVP requirement.
- **NOT building a mobile app.** The dashboard is a responsive web application. Native mobile clients are out of scope.

## Decisions

### 1. Monorepo with Turborepo

**Structure:**
```
/
  apps/
    dashboard/          # Next.js app (deployed to Vercel)
  packages/
    sdk/                # TypeScript SDK (published to npm)
    proxy/              # Local proxy server (published to npm)
    shared/             # Shared types, constants, pricing data
```

**Why:** A monorepo with Turborepo gives us shared TypeScript types between the SDK, proxy, and dashboard. The `AgentEvent` schema is defined once in `packages/shared` and imported everywhere. Changes to the data model are atomic -- one PR updates the type, the SDK that produces it, the proxy that produces it, and the dashboard that consumes it. For an MVP team, this removes an entire class of "the SDK sends field X but the dashboard expects field Y" bugs.

**Alternative considered:** Separate repositories for SDK, proxy, and dashboard. Rejected because the coordination cost is too high for an MVP. Versioning shared types across three repos requires a publish-and-update cycle for every schema change. That overhead is justified at scale but counterproductive when moving fast with a small team.

### 2. Supabase for Backend

**Components used:**
- **Postgres** for all persistent storage (agents, events, alert configs, users)
- **Realtime** for pushing live updates to the dashboard (agent status changes, new events)
- **Auth** for user authentication (email/password + OAuth)
- **Edge Functions** for the event ingest API (receives events from SDK/proxy, validates, writes to Postgres)

**Why:** Supabase collapses what would otherwise be four separate infrastructure decisions (database, WebSocket server, auth provider, serverless functions) into one platform with a single SDK. The Realtime feature is particularly valuable here -- the dashboard needs live updates as agent events arrive, and Supabase Realtime provides this out of the box by listening to Postgres changes. No need to build and operate a WebSocket server or polling layer.

The Postgres foundation also means we get full SQL for analytics queries (cost aggregation over time windows, anomaly detection via statistical functions) without needing a separate analytics database for the MVP.

**Alternative considered:** Custom Node.js backend with Express, a managed Postgres instance, a separate WebSocket server (e.g., Socket.io), and a third-party auth provider (e.g., Clerk). Rejected because assembling and maintaining this stack is a significant time investment that does not differentiate the product. The value is in the agent-level abstraction, not in the backend plumbing.

### 3. Local Proxy over Cloud Proxy

**Architecture:** The proxy runs on the user's machine as a local process (default: `localhost:4000`). The user points their LLM API calls through it by changing the base URL in their agent's configuration (e.g., `OPENAI_BASE_URL=http://localhost:4000/v1`). The proxy forwards the request to the real provider, receives the response, extracts usage metrics (tokens, cost, latency, model, status), and sends only those metrics to the cloud ingest API. The raw request and response bodies -- including all prompt content and completions -- stay local.

**Why:** This is the single most important architectural decision in the project. The trust problem is real: developers and operators will not route their LLM API traffic through a third-party cloud proxy. Their prompts contain proprietary business logic, customer data, and system instructions. Their API keys are expensive and sensitive. A cloud proxy that sees both is a non-starter for security-conscious users.

The local proxy solves this cleanly. The user's prompts and API keys never leave their environment. The cloud only sees: "Agent X used model gpt-4o, consumed 1,200 input tokens and 340 output tokens, cost $0.024, took 1,800ms, returned status 200." This is enough for the dashboard to provide full operational visibility without any privacy exposure.

**Alternative considered:** Cloud proxy (user routes traffic through our servers, we extract metrics server-side). Rejected for the trust reasons described above. Even with contractual guarantees and encryption, the perception of a third party handling API keys and prompts is a significant adoption barrier, especially for the early-adopter audience this product targets.

### 4. Provider-Agnostic via Request/Response Pattern Matching

**Approach:** The proxy identifies the LLM provider by matching the outbound request URL against known patterns:
- `api.openai.com` or path containing `/v1/chat/completions` -> OpenAI-compatible
- `api.anthropic.com` or path containing `/v1/messages` -> Anthropic
- `generativelanguage.googleapis.com` -> Google
- (Additional providers added over time)

Once the provider is identified, the proxy parses the response body using that provider's known response schema to extract token counts (input, output, total), the model name, and any error information. Cost is calculated by looking up the model in a local pricing table.

**Why:** This approach has zero dependencies on provider SDKs. It works with any HTTP client the user's agent uses (fetch, axios, the official OpenAI SDK, a custom wrapper -- it does not matter). The proxy only needs to understand HTTP requests and JSON responses, which are stable interfaces. Adding a new provider means adding a URL pattern and a response parser, not integrating a new SDK.

**Alternative considered:** Wrapping each provider's official SDK to intercept calls at the SDK level. Rejected for two reasons: (1) it would require maintaining wrappers for every SDK in every language, which does not scale, and (2) many agents use custom HTTP clients or thin wrappers rather than official SDKs, so SDK-level interception would miss them.

### 5. Unified AgentEvent Data Model

**Schema:**
```
AgentEvent {
  id:           uuid
  agent_id:     string        # user-defined identifier for the agent
  event_type:   enum          # "llm_call" | "heartbeat" | "error" | "custom"
  provider:     string | null # "openai" | "anthropic" | "google" | ...
  model:        string | null # "gpt-4o" | "claude-sonnet-4-20250514" | ...
  tokens_in:    int | null
  tokens_out:   int | null
  tokens_total: int | null
  cost_usd:     float | null
  latency_ms:   int | null
  status:       int | null    # HTTP status code
  tags:         jsonb         # user-defined key-value pairs
  source:       enum          # "sdk" | "proxy"
  timestamp:    timestamptz
  created_at:   timestamptz
}
```

**Why:** Every piece of data that reaches the dashboard -- whether it came from the TypeScript SDK's `track()` call or from the local proxy's response parsing -- is normalized into this single schema. This means the dashboard's queries, charts, and alerting rules do not need to know or care about the data source. A cost-over-time chart is just `SELECT SUM(cost_usd) FROM agent_events WHERE agent_id = ? GROUP BY time_bucket(...)` regardless of whether the events originated from SDK instrumentation or proxy interception.

The `tags` field (JSONB) provides an escape hatch for user-defined metadata (task ID, workflow name, environment, etc.) without requiring schema changes.

### 6. Heartbeat-Based Health Detection

**Mechanism:** The SDK sends a heartbeat event at a configurable interval (default: 30 seconds). The dashboard evaluates agent health based on heartbeat recency:

| Condition | Status |
|---|---|
| Last heartbeat < 1 interval ago | **Healthy** |
| Last heartbeat between 1-2 intervals ago | **Healthy** (within tolerance) |
| Last heartbeat between 2-5 intervals ago | **Degraded** |
| Last heartbeat > 5 intervals ago | **Down** |

**Why:** Heartbeats are simple, reliable, and decoupled from LLM activity. An agent might be alive and healthy but not making LLM calls (e.g., waiting for a scheduled trigger, processing local data, sleeping between tasks). Heartbeats detect this correctly; LLM call frequency does not.

The 2-missed / 5-missed thresholds are deliberately conservative. Network hiccups and GC pauses can cause a single missed heartbeat. Two missed heartbeats suggest something is wrong but recoverable. Five missed heartbeats means the agent is almost certainly down.

**Alternative considered:** Inferring health from LLM call frequency (if an agent that normally makes 10 calls/minute drops to zero, mark it as degraded). Rejected because agent workloads are inherently bursty. A coding agent might make 50 LLM calls in 2 minutes while writing code, then make zero calls for 10 minutes while running tests. Frequency-based detection would generate constant false alarms.

### 7. Next.js App Router + Supabase Realtime for Dashboard

**Architecture:** The dashboard uses Next.js App Router with a split rendering strategy:

- **Server Components** handle the initial page load. When a user opens the agent list or a detail view, the server fetches the current state from Supabase Postgres and renders the full page server-side. This means fast first paint with no loading spinners.
- **Client Components** subscribe to Supabase Realtime channels after hydration. New agent events, status changes, and alert triggers are pushed to the browser via WebSocket. Charts and status indicators update live without polling.

**Why:** This gives the best user experience for a monitoring dashboard. The initial load is fast (server-rendered, no client-side data fetching waterfall). Once loaded, the dashboard stays current without any user action. An operator can leave the dashboard open and trust that what they see reflects the current state of their agents.

Polling-based alternatives (fetch every N seconds) introduce a trade-off between freshness and server load. With Realtime subscriptions, updates arrive within milliseconds of the underlying Postgres change, and idle dashboards consume no API resources.

### 8. Alerting via Webhooks + Email (Resend)

**MVP alerting channels:**
- **Webhooks:** User configures a URL. Alert payloads are POSTed as JSON. Covers programmatic integrations (PagerDuty, custom Slack bots, automation pipelines).
- **Email:** Sent via Resend. Covers direct human notification for operators who want email alerts.

**Alert types in MVP:**
- Agent status change (healthy -> degraded, degraded -> down)
- Error rate exceeds threshold (configurable, e.g., >10% of calls in last 5 minutes)
- Budget threshold exceeded (e.g., agent has spent > $50 today)

**Why:** Webhooks and email cover the two fundamental notification patterns: machine-to-machine and machine-to-human. Webhooks are the universal integration point -- any chat platform, incident management tool, or automation system can consume a webhook. Email requires no setup beyond an address.

Native Slack and Discord integrations are intentionally deferred. They add OAuth complexity, bot management, and channel configuration UI that is not justified for MVP. Users who want Slack notifications can pipe webhooks through Slack's incoming webhook feature or a lightweight relay.

## Risks / Trade-offs

### Provider API format changes

**Risk:** LLM providers change their response format (new fields, restructured JSON, different token counting). The proxy's response parser breaks for that provider, causing events to be dropped or have missing metrics.

**Mitigation:** Version-pin known response formats with explicit parser versions. Add integration tests per provider that run against recorded response fixtures. When the proxy encounters a response it cannot parse, log the failure and emit a degraded event (with provider and model but without token/cost data) rather than dropping the event entirely. This ensures the dashboard still shows that a call happened, even if cost data is temporarily unavailable.

### Supabase scaling limits

**Risk:** Agents that make high-frequency LLM calls (e.g., a fast loop making calls every second) could generate event volumes that stress Supabase's ingest rate or Realtime subscription capacity.

**Mitigation:** Both the SDK and proxy buffer events client-side and flush in batches (default: every 5 seconds or when the buffer reaches 50 events, whichever comes first). This converts potentially hundreds of individual inserts per agent into a handful of batched writes. The Supabase Edge Function handling ingest uses bulk insert operations. For the MVP, this should be sufficient. If scaling becomes an issue post-MVP, the ingest path can be moved to a dedicated event streaming system (e.g., a queue in front of Postgres) without changing the SDK or proxy interface.

### Local proxy adoption friction

**Risk:** Requiring users to run an additional local process (the proxy) adds setup friction and operational overhead. Some users may not want to manage another background service.

**Mitigation:** The proxy is strictly optional. The SDK alone provides agent health monitoring (heartbeats), error tracking, and manual event reporting. The proxy adds automated LLM call tracking, but agents work on the dashboard without it. For users who do adopt the proxy, the setup is a single command (`npx @agenttrace/proxy start`) and one environment variable change. The proxy also provides a CLI health check (`agenttrace-proxy status`) so users can verify it is running.

### Cost calculation accuracy

**Risk:** LLM providers change pricing frequently. Model pricing varies by tier, commitment, and region. Calculated costs may drift from actual billing.

**Mitigation:** Maintain an open pricing table in `packages/shared` (similar to Helicone's open-source LLM pricing database) that maps model identifiers to per-token costs. Update this table with each SDK/proxy release. Allow users to override pricing for any model via dashboard settings (useful for enterprise agreements with custom rates). Display cost figures with a clear "estimated" label so users understand these are approximations, not billing-accurate numbers.
