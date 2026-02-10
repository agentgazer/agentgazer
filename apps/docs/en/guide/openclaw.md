# OpenClaw Integration

> Monitor your OpenClaw personal AI assistant with AgentGazer — one-click setup, full control

## Overview

[OpenClaw](https://openclaw.ai) is an open-source personal AI assistant. By routing OpenClaw's LLM requests through AgentGazer, you get:

- **Cost tracking** — See exactly how much each conversation costs
- **Latency monitoring** — Detect performance issues
- **Error alerts** — Know immediately when API calls fail
- **Budget controls** — Set daily spending limits

## Quick Start (Dashboard)

The easiest way to integrate is through the AgentGazer Dashboard.

### Step 1: Start AgentGazer

```bash
agentgazer start
```

### Step 2: Configure Providers

1. Open Dashboard at [http://localhost:18800](http://localhost:18800)
2. Go to **Providers** page
3. Add your LLM provider API keys (Anthropic, OpenAI, etc.)

### Step 3: OpenClaw Integration Page

1. Go to **OpenClaw** page in the sidebar
2. Verify your providers are listed under "Prerequisites"
3. Enter an **Agent Name** (e.g., `openclaw`)
4. Select a **Default Model** from the dropdown
5. Click **Apply Configuration**

This automatically writes to `~/.openclaw/openclaw.json`.

### Step 4: Restart OpenClaw

```bash
openclaw restart
```

### Step 5: Verify

Send a test message through OpenClaw (Discord, Telegram, etc.), then check the **Agents** page — your OpenClaw agent should appear with request data.

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    Your Machine                          │
│                                                          │
│  ┌─────────────┐     ┌──────────────────┐               │
│  │  OpenClaw   │────▶│  AgentGazer      │               │
│  │             │     │  Proxy :18900    │               │
│  │  baseUrl →  │     │                  │               │
│  │  :18900     │     │  Auto-captures:  │               │
│  └─────────────┘     │  - tokens        │               │
│                      │  - cost          │               │
│                      │  - latency       │               │
│                      └────────┬─────────┘               │
│                               │                         │
│                   ┌───────────▼───────────┐             │
│                   │  LLM Provider APIs    │             │
│                   │  (Anthropic, OpenAI)  │             │
│                   └───────────────────────┘             │
└─────────────────────────────────────────────────────────┘
```

The proxy intercepts requests, extracts metrics, and forwards to the real provider. **Prompt content is never stored** — only token counts, latency, and cost.

## Setting Up Alerts

After integration, configure alerts for your OpenClaw agent:

1. Go to **Alerts** page
2. Click **New Alert Rule**
3. Select agent: `openclaw`

### Recommended Alert Rules

| Type | Settings | Purpose |
|------|----------|---------|
| **Agent Down** | 10 minutes | Detect when OpenClaw stops running |
| **Error Rate** | 15% / 10 min | Detect API failures |
| **Budget** | $20/day | Prevent runaway costs |

## Governance Features

Control OpenClaw's LLM usage from the Dashboard:

| Feature | Description |
|---------|-------------|
| **Active Toggle** | Disable agent to block all requests |
| **Budget Limit** | Set daily spending cap |
| **Allowed Hours** | Restrict when LLM calls are allowed |
| **Kill Switch** | Auto-disable on detected infinite loops |
| **Model Override** | Force cheaper models |

Configure these in **Agents** → **openclaw** → **Policy Settings**.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| OpenClaw calls not appearing | Check `baseUrl` points to `:18900`, restart OpenClaw |
| 401 Unauthorized | Run `agentgazer provider add <provider>` to store API key |
| No cost data | Model may not be in pricing table (metrics still captured) |
| Connection refused | Ensure AgentGazer is running (`agentgazer doctor`) |

## Advanced: Manual Configuration

If you prefer to edit `~/.openclaw/openclaw.json` manually:

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "anthropic-traced": {
        "baseUrl": "http://localhost:18900/agents/openclaw/anthropic",
        "apiKey": "managed-by-agentgazer",
        "api": "anthropic-messages",
        "models": [
          { "id": "claude-sonnet-4-20250514", "name": "claude-sonnet-4-20250514" }
        ]
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

### URL Format

```
http://localhost:18900/agents/{agent-name}/{provider}
```

- `{agent-name}` — Identifies this agent in AgentGazer (e.g., `openclaw`)
- `{provider}` — Provider name: `anthropic`, `openai`, `google`, etc.

### Supported Providers

| Provider | API Type |
|----------|----------|
| `anthropic` | `anthropic-messages` |
| `openai` | `openai-completions` |
| `google` | `google-generative-ai` |
| Others | `openai-completions` (OpenAI-compatible) |

### API Key Handling

Set `apiKey` to any non-empty value (e.g., `"managed-by-agentgazer"`). The proxy injects the real key stored via `agentgazer provider add`.
