# OpenClaw + AgentGazer Integration Guide

> Monitor your OpenClaw personal AI assistant with AgentGazer — one-click setup, full observability

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Quick Start (Dashboard)](#3-quick-start-dashboard)
4. [Architecture](#4-architecture)
5. [Setting Up Alerts](#5-setting-up-alerts)
6. [Governance Features](#6-governance-features)
7. [Troubleshooting](#7-troubleshooting)
8. [Advanced: Manual Configuration](#8-advanced-manual-configuration)
9. [Alternative: Direct Provider Routing](#9-alternative-direct-provider-routing)

---

## 1. Overview

[OpenClaw](https://openclaw.ai) is an open-source personal AI assistant built with TypeScript/Node.js that runs on your local machine. It supports multiple LLM providers (Anthropic, OpenAI, Google, etc.) and is configured through the `~/.openclaw/openclaw.json` configuration file.

### Why Monitor OpenClaw?

As an autonomous AI agent, OpenClaw continuously sends requests to LLM providers. Without proper monitoring:

- **Runaway costs**: Autonomous LLM calls can rapidly accumulate charges without visibility
- **Silent failures**: API failures, rate limits, and expired credentials won't notify you
- **Performance degradation**: Increased latency requires historical data to diagnose
- **Service outages**: OpenClaw may stop running and you might not notice for hours

### What AgentGazer Provides

By integrating OpenClaw with AgentGazer:

- **Track the cost of every LLM call**: Detailed spending breakdowns by provider and model
- **Monitor latency and error rates**: Detect anomalies immediately
- **Configure alert rules**: Agent offline detection, error rate thresholds, budget caps
- **Dynamic model switching**: Change providers/models from Dashboard without editing config files
- **Zero code changes**: Simply use AgentGazer's OpenClaw integration page

---

## 2. Prerequisites

### System Requirements

| Item | Requirement | Description |
|------|-------------|-------------|
| Node.js | >= 18 | JavaScript runtime |
| AgentGazer | Latest version | `npm install -g @agentgazer/cli` or Homebrew |
| OpenClaw | Installed and running | From [openclaw.ai](https://openclaw.ai) |

### API Keys

You need an API key from at least one LLM provider:

- **Anthropic**: From [console.anthropic.com](https://console.anthropic.com)
- **OpenAI**: From [platform.openai.com](https://platform.openai.com)
- **Google**: From [ai.google.dev](https://ai.google.dev)

---

## 3. Quick Start (Dashboard)

The recommended way to integrate is through the AgentGazer Dashboard.

### Step 1: Start AgentGazer

```bash
agentgazer start
```

Open [http://localhost:18880](http://localhost:18880) in your browser.

### Step 2: Configure Provider Keys

1. Go to **Providers** page
2. Click **Add Provider**
3. Select your provider (Anthropic, OpenAI, etc.)
4. Enter your API key
5. Click **Save**

### Step 3: OpenClaw Integration Page

1. Go to **OpenClaw** page in the sidebar
2. Verify your providers are listed under "Prerequisites"
3. Set **Proxy Host** (default: `localhost:18900`)
   - For network access from other machines, use your internal IP (e.g., `192.168.1.100:18900`)
4. Enter an **Agent Name** (e.g., `openclaw`)
5. Click **Apply Configuration**

This automatically writes the configuration to `~/.openclaw/openclaw.json`.

### Step 4: Restart OpenClaw

```bash
openclaw restart
```

### Step 5: Send a Test Message

Send any message through OpenClaw (Discord, Telegram, etc.). This creates the agent in AgentGazer.

### Step 6: Configure Model Routing

1. Go to **Agents** → click your agent (e.g., `openclaw`)
2. Find **Model Settings** at the top
3. For the `agentgazer` provider entry, configure:
   - **Model Override**: The actual model to use (e.g., `claude-sonnet-4-20250514`)
   - **Target Provider**: The actual provider (e.g., `anthropic`)
4. Click **Save**

Now all OpenClaw requests will be routed to your configured provider!

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Your Machine                          │
│                                                             │
│  ┌───────────────┐     ┌──────────────────┐                 │
│  │   OpenClaw    │────▶│  AgentGazer      │                 │
│  │               │     │  Proxy :18900    │                 │
│  │  Configured:  │     │                  │                 │
│  │  agentgazer/  │     │  1. Receives     │                 │
│  │  agentgazer-  │     │     request      │                 │
│  │  proxy        │     │  2. Looks up     │                 │
│  └───────────────┘     │     Model Override│                │
│                        │  3. Routes to    │                 │
│                        │     real provider│                 │
│                        │  4. Captures     │                 │
│                        │     metrics      │                 │
│                        └────────┬─────────┘                 │
│                                 │                           │
│                     ┌───────────▼───────────┐               │
│                     │  LLM Provider APIs    │               │
│                     │  (Anthropic, OpenAI,  │               │
│                     │   Google, etc.)       │               │
│                     └───────────────────────┘               │
│                                                             │
│  ┌──────────────────────────────────────────┐               │
│  │  AgentGazer Dashboard :18880             │               │
│  │  - Real-time metrics                     │               │
│  │  - Model Override configuration          │               │
│  │  - Alert management                      │               │
│  └──────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### How It Works

1. **OpenClaw** sends requests to the `agentgazer` virtual provider
2. **AgentGazer Proxy** receives the request at `/agents/{agent}/agentgazer`
3. The proxy looks up **Model Override Rules** for this agent
4. Request is transformed and forwarded to the actual provider (e.g., Anthropic)
5. Response is returned to OpenClaw while metrics are captured asynchronously
6. **Dashboard** displays real-time cost, latency, and token usage

### Privacy Guarantee

The proxy only extracts metrics (token counts, model names, latency, etc.). **Prompt content is never stored or transmitted**. All data remains on your local machine.

### Benefits of This Approach

| Feature | Benefit |
|---------|---------|
| **Dynamic switching** | Change models/providers from Dashboard without editing OpenClaw config |
| **Centralized key management** | API keys stored securely in AgentGazer, not in config files |
| **Unified monitoring** | All requests appear under one agent regardless of target provider |
| **A/B testing** | Easily switch between providers to compare performance |

---

## 5. Setting Up Alerts

After integration, configure alerts for your OpenClaw agent.

### Recommended Alert Rules

| Type | Settings | Purpose |
|------|----------|---------|
| **Agent Down** | 10 minutes | Detect when OpenClaw stops running |
| **Error Rate** | 15% / 10 min | Detect API failures |
| **Budget** | $20/day | Prevent runaway costs |

### Configuring via Dashboard

1. Go to **Alerts** page
2. Click **New Alert Rule**
3. Select agent: your OpenClaw agent name
4. Choose rule type and configure thresholds
5. Enter webhook URL for notifications
6. Click **Save**

### Configuring via API

```bash
# Agent Down Alert
curl -X POST http://localhost:18880/api/alerts \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "openclaw",
    "rule_type": "agent_down",
    "config": { "duration_minutes": 10 },
    "webhook_url": "https://your-webhook.com/alerts"
  }'

# Budget Alert
curl -X POST http://localhost:18880/api/alerts \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "openclaw",
    "rule_type": "budget",
    "config": { "threshold": 20 },
    "webhook_url": "https://your-webhook.com/alerts"
  }'
```

---

## 6. Governance Features

Control OpenClaw's LLM usage from the Dashboard:

| Feature | Description | Location |
|---------|-------------|----------|
| **Active Toggle** | Disable agent to block all requests | Policy Settings |
| **Budget Limit** | Set daily spending cap | Policy Settings |
| **Allowed Hours** | Restrict when LLM calls are allowed | Policy Settings |
| **Kill Switch** | Auto-disable on detected infinite loops | Kill Switch Settings |
| **Model Override** | Control which model/provider is used | Model Settings |
| **Rate Limits** | Limit requests per time window | Rate Limit Settings |

Configure these in **Agents** → **[your agent]**.

---

## 7. Troubleshooting

### Quick Reference

| Problem | Solution |
|---------|----------|
| OpenClaw calls not appearing | Check `baseUrl` points to `:18900`, restart OpenClaw |
| "Provider agentgazer requires cross-provider override" | Configure Model Override in Dashboard (Step 6) |
| 401 Unauthorized | Add provider API key in Dashboard → Providers |
| No cost data | Model may not be in pricing table (metrics still captured) |
| Connection refused | Ensure AgentGazer is running (`agentgazer status`) |

### Detailed Steps

#### OpenClaw Calls Not Appearing

1. Verify AgentGazer is running:
   ```bash
   curl http://localhost:18900/health
   ```

2. Check OpenClaw config:
   ```bash
   cat ~/.openclaw/openclaw.json | grep baseUrl
   ```
   Should show `http://localhost:18900/agents/...`

3. Restart OpenClaw after config changes

#### Model Override Not Working

1. Go to **Agents** → your agent → **Model Settings**
2. Ensure you have a rule for `agentgazer` provider
3. Set both **Model Override** and **Target Provider**
4. The target provider must have an API key configured

#### Events Appear But No Cost Data

AgentGazer uses a built-in pricing table. If the model isn't in the table, cost shows as empty but other metrics are still captured.

Supported providers: OpenAI, Anthropic, Google, Mistral, DeepSeek, Moonshot, Zhipu, MiniMax, Baichuan

---

## 8. Advanced: Manual Configuration

If you prefer to edit `~/.openclaw/openclaw.json` manually:

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "agentgazer": {
        "baseUrl": "http://localhost:18900/agents/openclaw/agentgazer",
        "apiKey": "managed-by-agentgazer",
        "api": "openai-completions",
        "models": [
          { "id": "agentgazer-proxy", "name": "AgentGazer Proxy" }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "agentgazer/agentgazer-proxy"
      }
    }
  }
}
```

### Key Fields

| Field | Description |
|-------|-------------|
| `baseUrl` | Points to AgentGazer proxy with agent name |
| `apiKey` | Any non-empty value (proxy manages real keys) |
| `api` | Use `openai-completions` for OpenAI-compatible format |
| `primary` | The model identifier in `provider/model` format |

### For Network Access

If AgentGazer runs on a different machine or you need network access:

```json
{
  "baseUrl": "http://192.168.1.100:18900/agents/openclaw/agentgazer"
}
```

Replace `192.168.1.100` with your AgentGazer host's IP address.

---

## 9. Alternative: Direct Provider Routing

If you prefer not to use Model Override and want direct provider routing:

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "anthropic-traced": {
        "baseUrl": "http://localhost:18900/anthropic",
        "api": "anthropic-messages"
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic-traced/claude-sonnet-4-20250514"
      }
    }
  }
}
```

This approach:
- Routes directly to a specific provider (`/anthropic`, `/openai`, etc.)
- Requires provider API key to be stored via `agentgazer provider add`
- Cannot dynamically switch providers from Dashboard
- Each provider needs its own entry in the config

**Supported path prefixes**: `/openai`, `/anthropic`, `/google`, `/mistral`, `/deepseek`, `/moonshot`, `/zhipu`, `/minimax`, `/baichuan`

---

## Appendix: Quick Start Checklist

- [ ] Install AgentGazer (`npm install -g @agentgazer/cli`)
- [ ] Start AgentGazer (`agentgazer start`)
- [ ] Open Dashboard ([http://localhost:18880](http://localhost:18880))
- [ ] Add provider API keys (Providers page)
- [ ] Go to OpenClaw page and click Apply Configuration
- [ ] Restart OpenClaw (`openclaw restart`)
- [ ] Send a test message
- [ ] Configure Model Override (Agents → your agent → Model Settings)
- [ ] Set up Agent Down alert (10 minutes)
- [ ] Set up Budget alert ($20/day)
- [ ] Monitor Dashboard to confirm data is flowing
