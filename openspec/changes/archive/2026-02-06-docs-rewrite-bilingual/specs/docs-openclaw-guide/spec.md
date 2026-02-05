## ADDED Requirements

### Requirement: Bilingual OpenClaw guide files exist
The project SHALL provide `docs/guide-openclaw-zh.md` (Traditional Chinese) and `docs/guide-openclaw-en.md` (English) with identical heading structure.

#### Scenario: Both files exist with matching structure
- **WHEN** a user checks the docs/ directory
- **THEN** both `guide-openclaw-zh.md` and `guide-openclaw-en.md` exist, and their heading hierarchy matches one-to-one

### Requirement: Overview section explaining why monitor OpenClaw
The guide SHALL include an overview explaining why monitoring OpenClaw's LLM usage matters: cost visibility, error tracking, latency monitoring, and agent-down detection for a long-running personal AI assistant.

#### Scenario: Motivation is clear
- **WHEN** a user reads the overview
- **THEN** they understand the value of monitoring OpenClaw with AgentTrace (cost, reliability, performance visibility)

### Requirement: Prerequisites section
The guide SHALL list prerequisites: Node.js >= 18, AgentTrace installed (`npx agenttrace` or global install), OpenClaw installed and running, and an Anthropic/OpenAI API key.

#### Scenario: Prerequisites are actionable
- **WHEN** a user reads the prerequisites
- **THEN** they can verify each item and know exactly what to install if missing

### Requirement: AgentTrace setup section
The guide SHALL walk through starting AgentTrace (`npx agenttrace`), noting the auth token and default ports (server :8080, proxy :4000).

#### Scenario: AgentTrace started
- **WHEN** a user follows the setup section
- **THEN** AgentTrace is running with proxy on port 4000 and dashboard accessible at localhost:8080

### Requirement: OpenClaw provider configuration for Anthropic
The guide SHALL show the exact `~/.openclaw/openclaw.json` configuration to route Anthropic API calls through AgentTrace proxy, using `models.providers` with `baseUrl: "http://localhost:4000"`, `apiKey` referencing an env var, and `api: "anthropic-messages"`.

#### Scenario: Anthropic config example
- **WHEN** a user reads the Anthropic configuration section
- **THEN** they see a complete `openclaw.json` snippet with a custom provider pointing `baseUrl` to `http://localhost:4000` and `api` set to `"anthropic-messages"`, with agent model set to use this provider

### Requirement: OpenClaw provider configuration for OpenAI
The guide SHALL show the `openclaw.json` configuration to route OpenAI API calls through AgentTrace proxy, using `baseUrl: "http://localhost:4000"`, `api: "openai-completions"`.

#### Scenario: OpenAI config example
- **WHEN** a user reads the OpenAI configuration section
- **THEN** they see a complete `openclaw.json` snippet for routing OpenAI calls through the proxy

### Requirement: Multi-provider configuration
The guide SHALL show how to configure both Anthropic and OpenAI providers simultaneously through AgentTrace proxy, each with their own provider entry in `openclaw.json`.

#### Scenario: Both providers configured
- **WHEN** a user wants to monitor both Anthropic and OpenAI calls
- **THEN** the guide shows a single `openclaw.json` with two custom providers, both routing through localhost:4000

### Requirement: Provider key setup via AgentTrace CLI
The guide SHALL show how to store provider API keys in AgentTrace using `agenttrace providers set anthropic <key>` so the proxy can auto-inject keys, allowing the OpenClaw config to omit explicit API keys.

#### Scenario: Key stored in AgentTrace
- **WHEN** a user runs `agenttrace providers set anthropic $ANTHROPIC_API_KEY`
- **THEN** the proxy automatically injects the Authorization header for Anthropic requests, and the OpenClaw config does not need to contain the API key

### Requirement: Verification section
The guide SHALL include a step-by-step verification: send a test message to OpenClaw, then check the AgentTrace dashboard for the recorded event (showing provider, model, tokens, cost, latency).

#### Scenario: End-to-end verification
- **WHEN** a user sends a message to OpenClaw and opens the AgentTrace dashboard
- **THEN** they see the LLM call event with provider name, model, token counts, cost in USD, and latency

### Requirement: Alert setup section
The guide SHALL include examples of configuring alerts relevant to OpenClaw: agent-down alert (no LLM calls for N minutes), error-rate alert (API errors above threshold), and budget alert (daily spend limit).

#### Scenario: Agent-down alert configured
- **WHEN** a user follows the alert setup section
- **THEN** they have created an agent_down alert via the dashboard or API that fires when OpenClaw stops making LLM calls

#### Scenario: Budget alert configured
- **WHEN** a user follows the budget alert section
- **THEN** they have a budget alert that fires when daily spend exceeds a configured USD threshold

### Requirement: Architecture diagram
The guide SHALL include an ASCII architecture diagram showing: OpenClaw Gateway → AgentTrace Proxy (:4000) → LLM Provider APIs, with AgentTrace Server (:8080) + SQLite + Dashboard as the monitoring layer.

#### Scenario: Diagram shows data flow
- **WHEN** a user reads the architecture diagram
- **THEN** they understand the request flow: OpenClaw sends LLM calls to proxy, proxy forwards to real provider, proxy extracts metrics to local server, dashboard displays metrics

### Requirement: Troubleshooting section
The guide SHALL include troubleshooting for common integration issues: proxy not receiving requests (wrong baseUrl), provider not detected (wrong api protocol setting), API key issues (not stored or not injected), OpenClaw connection errors, and events not appearing in dashboard.

#### Scenario: Wrong baseUrl troubleshooting
- **WHEN** a user's OpenClaw calls are not appearing in AgentTrace
- **THEN** the troubleshooting section guides them to verify the `baseUrl` in `openclaw.json` matches the proxy port and that AgentTrace is running

#### Scenario: API key not injected troubleshooting
- **WHEN** a user gets authentication errors from the LLM provider
- **THEN** the troubleshooting section guides them to check that the API key is stored via `agenttrace providers set` or included in the OpenClaw config
