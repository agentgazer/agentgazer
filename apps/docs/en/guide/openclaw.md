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

1. Open Dashboard at [http://localhost:18880](http://localhost:18880)
2. Go to **Providers** page
3. Add your LLM provider API keys (Anthropic, OpenAI, etc.)

### Step 3: OpenClaw Integration Page

1. Go to **OpenClaw** page in the sidebar
2. Verify your providers are listed under "Prerequisites"
3. Set **Proxy Host** (default: `localhost:18900`, use internal IP for network access)
4. Enter an **Agent Name** (e.g., `openclaw`)
5. Click **Apply Configuration**

This automatically writes to `~/.openclaw/openclaw.json`.

### Step 4: Restart OpenClaw

```bash
openclaw restart
```

### Step 5: Send a Test Message

Send a test message through OpenClaw (Discord, Telegram, etc.), then check the **Agents** page — your OpenClaw agent should appear.

### Step 6: Configure Model Routing

1. Go to **Agents** → **openclaw** → **Model Settings**
2. For the `agentgazer` provider, configure:
   - **Model Override**: The actual model to use (e.g., `claude-sonnet-4-20250514`)
   - **Target Provider**: The actual provider (e.g., `anthropic`)

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

### How It Works

1. OpenClaw sends all requests to the `agentgazer` provider
2. The proxy receives requests at `/agents/openclaw/agentgazer`
3. AgentGazer looks up **Model Override Rules** for the agent and routes to the actual provider

### Setting Up Model Routing

After applying the config, set up routing in the Dashboard:

1. Go to **Agents** → **openclaw** (appears after first request)
2. Click **Model Settings**
3. For the `agentgazer` provider entry, configure:
   - **Model Override**: The actual model to use (e.g., `claude-sonnet-4-20250514`)
   - **Target Provider**: The actual provider (e.g., `anthropic`)

This allows you to change which model/provider OpenClaw uses without editing its config file.

### API Key Handling

Set `apiKey` to any non-empty value (e.g., `"managed-by-agentgazer"`). The proxy injects the real key stored via `agentgazer provider add`.

## Cost Awareness Skill {#cost-skill}

When you click **Apply Configuration** in the Dashboard, AgentGazer automatically installs a cost awareness skill for OpenClaw.

### What Gets Installed

The Apply action creates:

```
~/.openclaw/skills/agentgazer/
├── SKILL.md          # Skill metadata and instructions
└── scripts/
    └── cost.sh       # Script to query AgentGazer stats
```

### Using the Skill

After installation, you can ask OpenClaw about your AI spending:

```
User: /cost
OpenClaw: Your AgentGazer stats for the last 24 hours:
          - Total cost: $12.45
          - Requests: 847
          - Tokens: 1.2M (in: 800K, out: 400K)
```

### Skill Commands

| Command | Description |
|---------|-------------|
| `/cost` | Show cost summary for current period |
| `/cost 7d` | Show cost for last 7 days |
| `/cost compare` | Compare current period vs previous |

### Manual Installation

If you didn't use Dashboard Apply, manually create the skill:

```bash
mkdir -p ~/.openclaw/skills/agentgazer/scripts

# Create SKILL.md
cat > ~/.openclaw/skills/agentgazer/SKILL.md << 'EOF'
---
name: agentgazer
description: Query AgentGazer for cost and usage stats
---

Use the cost.sh script to get spending information.
EOF

# Create cost.sh
cat > ~/.openclaw/skills/agentgazer/scripts/cost.sh << 'EOF'
#!/bin/bash
agentgazer agent openclaw stat -o json
EOF

chmod +x ~/.openclaw/skills/agentgazer/scripts/cost.sh
```
