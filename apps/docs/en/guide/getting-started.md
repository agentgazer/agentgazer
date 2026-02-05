# Getting Started

> Local-first AI Agent observability platform — Complete installation, configuration, and usage manual

## Platform Overview

AgentTrace is a **local-first** AI Agent observability platform. With a single command `npx agenttrace`, you can launch everything: an Express server, an LLM proxy, and a React dashboard — all data stored locally in SQLite with zero cloud dependencies.

### Core Features

- **LLM Call Monitoring**: Track every Agent's LLM requests, latency, and token usage
- **Cost Tracking**: Spend analysis by Provider / Model with daily budget alerts
- **Health Detection**: Automatic Agent status assessment (healthy / degraded / down) based on heartbeat mechanism
- **Alert Notifications**: Rules for Agent down, error rate threshold, budget overrun, delivered via Webhook or Email
- **Privacy First**: Prompt content and API keys never leave the user's machine

### Data Collection Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| **Proxy** (Recommended) | Transparent proxy intercepts LLM requests with zero code changes | No modifications to existing code needed; automatically captures all LLM calls |
| **SDK** | Manual instrumentation in your code | When you need precise control over which calls to track, or custom events |

### Supported LLM Providers

| Provider | Host Pattern | Path Detection |
|----------|-------------|----------------|
| OpenAI | `api.openai.com` | `/v1/chat/completions`, `/v1/completions` |
| Anthropic | `api.anthropic.com` | `/v1/messages` |
| Google | `generativelanguage.googleapis.com` | Host matching |
| Mistral | `api.mistral.ai` | Host matching |
| Cohere | `api.cohere.com` | Host matching |
| DeepSeek | `api.deepseek.com` | Host matching |

## System Architecture

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Machine                           │
│                                                                 │
│  ┌──────────┐    ┌────────────────────┐                         │
│  │ AI Agent │───>│ AgentTrace Proxy   │──> LLM Provider         │
│  │          │<───│ (:4000 default)    │<── (OpenAI, Anthropic   │
│  └──────────┘    └────────┬───────────┘    Google, Mistral...)   │
│       │                   │                                     │
│       │ SDK               │ Metrics Data                        │
│       │ (optional)        │ (tokens, model, latency, cost)      │
│       │                   │                                     │
│       ▼                   ▼                                     │
│  ┌─────────────────────────────────────┐                        │
│  │     Express Server (:8080 default)  │                        │
│  │                                     │                        │
│  │  ┌───────────┐  ┌────────────────┐  │                        │
│  │  │ REST API  │  │ React Dashboard│  │                        │
│  │  │ /api/*    │  │ (Vite build)   │  │                        │
│  │  └─────┬─────┘  └────────────────┘  │                        │
│  │        │                            │                        │
│  │  ┌─────▼─────────────────────────┐  │                        │
│  │  │      SQLite Database          │  │                        │
│  │  │  ~/.agenttrace/data.db        │  │                        │
│  │  └───────────────────────────────┘  │                        │
│  └─────────────────────────────────────┘                        │
│                                                                 │
│  Config file: ~/.agenttrace/config.json                         │
│  Encrypted keystore: AES-256-GCM encrypted storage              │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

- **Single Command Startup**: `agenttrace start` launches the Express server, LLM Proxy, and React dashboard simultaneously
- **Local SQLite**: All data is stored in `~/.agenttrace/data.db` with no external database required
- **Privacy Guarantee**: The Proxy only extracts metric data (token counts, model name, latency, cost) — prompt content and API keys never leave the local machine

### Project Structure (Turborepo Monorepo)

```
agenttrace/
├── packages/
│   ├── cli/               # CLI entry point (agenttrace command)
│   ├── server/            # Express API + SQLite database
│   ├── proxy/             # LLM Proxy with metrics extraction
│   ├── sdk/               # TypeScript SDK (@agenttrace/sdk)
│   └── shared/            # Shared types, pricing calculations, Provider detection
├── apps/
│   └── dashboard-local/   # React + Vite dashboard
├── package.json           # Monorepo root config
└── turbo.json             # Turborepo config
```

## Installation and Quick Start

### Prerequisites

| Tool | Version | Description |
|------|---------|-------------|
| Node.js | >= 18 | JavaScript runtime |
| npm | >= 10 | Package manager |

No cloud accounts or external services required.

### Installation

**Option A: Direct execution (Recommended)**

```bash
npx agenttrace
```

**Option B: Global installation**

```bash
npm install -g agenttrace
```

### Initial Setup

On first use, run the setup wizard:

```bash
agenttrace onboard
```

This command will:

1. Create a `config.json` configuration file in the `~/.agenttrace/` directory
2. Generate an authentication Token (used for API access and dashboard login)
3. Guide you through setting up LLM Provider API keys

### Starting the Service

```bash
agenttrace start
```

After startup, a browser window automatically opens to the dashboard:

```
http://localhost:8080
```

Default ports:

| Service | Port | Description |
|---------|------|-------------|
| Express Server + Dashboard | 8080 | REST API and React dashboard |
| LLM Proxy | 4000 | Proxies LLM requests and extracts metrics |

### Quick Verification

After startup, use the following methods to verify the system is running properly:

```bash
# Check server health
curl http://localhost:8080/api/health

# Check Proxy health
curl http://localhost:4000/health

# Use the built-in diagnostic tool
agenttrace doctor
```

## Appendix: Quick Start Checklist

- [ ] Install Node.js >= 18
- [ ] Run `npx agenttrace` or `npm install -g agenttrace`
- [ ] Run `agenttrace onboard` to complete initial setup
- [ ] Note down the authentication Token
- [ ] Use `agenttrace providers set` to configure LLM Provider API keys
- [ ] Run `agenttrace start` to launch all services
- [ ] Open `http://localhost:8080` in a browser to log into the dashboard
- [ ] Configure the Proxy in your AI Agent (point the base URL to `http://localhost:4000`) or integrate the SDK
- [ ] Verify that event data appears correctly in the dashboard
- [ ] Set up alert rules (agent_down / error_rate / budget)
- [ ] Run `agenttrace doctor` to confirm system health
