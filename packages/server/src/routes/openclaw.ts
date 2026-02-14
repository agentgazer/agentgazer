import { Router, Request, Response } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// Middleware to check if request is from loopback
function isLoopback(req: Request): boolean {
  const ip = req.ip || req.socket?.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function requireLoopback(req: Request, res: Response, next: () => void): void {
  if (!isLoopback(req)) {
    res.status(403).json({
      error: "This operation is only available from localhost for security",
    });
    return;
  }
  next();
}

function getOpenclawConfigPath(): string {
  return path.join(os.homedir(), ".openclaw", "openclaw.json");
}

interface OpenclawConfig {
  models?: {
    mode?: string;
    providers?: Record<string, unknown>;
    [key: string]: unknown;
  };
  agents?: {
    defaults?: {
      model?: {
        primary?: string;
      };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function createOpenclawRouter(): Router {
  const router = Router();

  // GET /api/openclaw/config - read current OpenClaw config
  router.get("/config", requireLoopback, (req: Request, res: Response) => {
    const configPath = getOpenclawConfigPath();

    try {
      if (!fs.existsSync(configPath)) {
        res.json({ exists: false, models: null, agents: null });
        return;
      }

      const raw = fs.readFileSync(configPath, "utf-8");

      try {
        const config: OpenclawConfig = JSON.parse(raw);
        res.json({
          exists: true,
          models: config.models ?? null,
          agents: config.agents ?? null,
        });
      } catch {
        // JSON parse error
        res.json({
          exists: true,
          parseError: true,
          raw,
        });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // PUT /api/openclaw/config - update models and/or agents in OpenClaw config
  router.put("/config", requireLoopback, (req: Request, res: Response) => {
    const configPath = getOpenclawConfigPath();
    const configDir = path.dirname(configPath);
    const { models, agents } = req.body as {
      models?: OpenclawConfig["models"];
      agents?: OpenclawConfig["agents"];
    };

    if (!models && !agents) {
      res.status(400).json({ error: "models or agents is required" });
      return;
    }

    try {
      // Ensure directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      let config: OpenclawConfig = {};

      // Read existing config if it exists
      if (fs.existsSync(configPath)) {
        try {
          const raw = fs.readFileSync(configPath, "utf-8");
          config = JSON.parse(raw);
        } catch {
          // If parse fails, start fresh but preserve nothing
          config = {};
        }
      }

      // Update models key if provided
      if (models) {
        config.models = models;
      }

      // Update agents.defaults.model if provided (deep merge)
      if (agents?.defaults?.model) {
        config.agents = config.agents ?? {};
        config.agents.defaults = config.agents.defaults ?? {};
        config.agents.defaults.model = {
          ...config.agents.defaults.model,
          ...agents.defaults.model,
        };
      }

      // Write back with pretty formatting
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/openclaw/setup-agentgazer - write mcp-config.json and create skill
  router.post("/setup-agentgazer", requireLoopback, (req: Request, res: Response) => {
    const { endpoint, token, agentId } = req.body as {
      endpoint: string;
      token: string;
      agentId: string;
    };

    if (!endpoint || !token || !agentId) {
      res.status(400).json({ error: "endpoint, token, and agentId are required" });
      return;
    }

    try {
      // 1. Write mcp-config.json to ~/.agentgazer/
      const agentgazerDir = path.join(os.homedir(), ".agentgazer");
      if (!fs.existsSync(agentgazerDir)) {
        fs.mkdirSync(agentgazerDir, { recursive: true });
      }

      const mcpConfig = {
        endpoint,
        token,
        agentId,
      };
      fs.writeFileSync(
        path.join(agentgazerDir, "mcp-config.json"),
        JSON.stringify(mcpConfig, null, 2) + "\n",
        "utf-8"
      );

      // 2. Create OpenClaw skill in ~/.openclaw/skills/agentgazer/
      const skillDir = path.join(os.homedir(), ".openclaw", "skills", "agentgazer");
      const scriptsDir = path.join(skillDir, "scripts");

      if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
      }

      // Write SKILL.md
      const skillMd = `---
name: agentgazer
description: Query your AI agent's cost and token usage from AgentGazer. Use this to check spending, monitor budgets, and get usage statistics.
metadata:
  {
    "openclaw":
      {
        "emoji": "📊",
        "os": ["darwin", "linux"],
        "requires": { "bins": ["agentgazer"] },
      },
  }
---

# AgentGazer Cost Awareness

Query your AI agent's cost and token usage from AgentGazer observability platform.

## Quick start

Check current session stats:

\`\`\`bash
bash {baseDir}/scripts/cost.sh
\`\`\`

Get stats for a specific time range:

\`\`\`bash
bash {baseDir}/scripts/cost.sh 7d   # Last 7 days
bash {baseDir}/scripts/cost.sh 30d  # Last 30 days
\`\`\`

## What you can query

- **Total cost** - How much you've spent in USD
- **Token usage** - Input and output tokens consumed
- **Request count** - Number of API calls made
- **Error rate** - Percentage of failed requests
- **Cost by model** - Breakdown by model used

## Configuration

Config is stored in \`~/.agentgazer/mcp-config.json\`:

\`\`\`json
{
  "endpoint": "http://localhost:18880",
  "token": "your-token",
  "agentId": "your-agent-id"
}
\`\`\`

This is automatically configured when using AgentGazer Dashboard's OpenClaw integration.
`;

      fs.writeFileSync(path.join(skillDir, "SKILL.md"), skillMd, "utf-8");

      // Write cost.sh script
      const costScript = `#!/bin/bash
# AgentGazer cost query script for OpenClaw
# Usage: bash cost.sh [range]
#   range: 1h, 24h, 7d, 30d (default: 24h)

RANGE="\${1:-24h}"
CONFIG="$HOME/.agentgazer/mcp-config.json"

if [ ! -f "$CONFIG" ]; then
  echo "Error: AgentGazer config not found at $CONFIG"
  echo "Run AgentGazer Dashboard's OpenClaw integration to configure."
  exit 1
fi

# Check if jq is available
if command -v jq &> /dev/null; then
  ENDPOINT=$(jq -r '.endpoint' "$CONFIG")
  TOKEN=$(jq -r '.token' "$CONFIG")
  AGENT_ID=$(jq -r '.agentId' "$CONFIG")
else
  # Fallback: use grep/sed for simple JSON parsing
  ENDPOINT=$(grep -o '"endpoint"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG" | sed 's/.*"\\([^"]*\\)"$/\\1/')
  TOKEN=$(grep -o '"token"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG" | sed 's/.*"\\([^"]*\\)"$/\\1/')
  AGENT_ID=$(grep -o '"agentId"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG" | sed 's/.*"\\([^"]*\\)"$/\\1/')
fi

if [ -z "$ENDPOINT" ] || [ -z "$TOKEN" ] || [ -z "$AGENT_ID" ]; then
  echo "Error: Invalid config in $CONFIG"
  exit 1
fi

# Use agentgazer CLI if available (preferred)
if command -v agentgazer &> /dev/null; then
  agentgazer agent "$AGENT_ID" stat --range "$RANGE" -o json
  exit $?
fi

# Fallback to curl
curl -s -H "x-api-key: $TOKEN" "$ENDPOINT/api/stats/$AGENT_ID?range=$RANGE"
`;

      fs.writeFileSync(path.join(scriptsDir, "cost.sh"), costScript, "utf-8");
      fs.chmodSync(path.join(scriptsDir, "cost.sh"), 0o755);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
