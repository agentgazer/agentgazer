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

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
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
  mcpServers?: Record<string, McpServerConfig>;
  [key: string]: unknown;
}

export function createOpenclawRouter(): Router {
  const router = Router();

  // GET /api/openclaw/config - read current OpenClaw config
  router.get("/config", requireLoopback, (req: Request, res: Response) => {
    const configPath = getOpenclawConfigPath();

    try {
      if (!fs.existsSync(configPath)) {
        res.json({ exists: false, models: null, agents: null, mcpServers: null });
        return;
      }

      const raw = fs.readFileSync(configPath, "utf-8");

      try {
        const config: OpenclawConfig = JSON.parse(raw);
        res.json({
          exists: true,
          models: config.models ?? null,
          agents: config.agents ?? null,
          mcpServers: config.mcpServers ?? null,
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

  // PUT /api/openclaw/config - update models, agents, and/or mcpServers in OpenClaw config
  router.put("/config", requireLoopback, (req: Request, res: Response) => {
    const configPath = getOpenclawConfigPath();
    const configDir = path.dirname(configPath);
    const { models, agents, mcpServers } = req.body as {
      models?: OpenclawConfig["models"];
      agents?: OpenclawConfig["agents"];
      mcpServers?: Record<string, McpServerConfig>;
    };

    if (!models && !agents && !mcpServers) {
      res.status(400).json({ error: "models, agents, or mcpServers is required" });
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

      // Update mcpServers if provided (deep merge - preserve existing servers)
      if (mcpServers) {
        config.mcpServers = {
          ...config.mcpServers,
          ...mcpServers,
        };
      }

      // Write back with pretty formatting
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
