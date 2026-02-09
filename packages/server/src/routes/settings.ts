import { Router } from "express";
import * as fs from "node:fs";
import { createLogger } from "@agentgazer/shared";

const router = Router();
const log = createLogger("routes/settings");

/**
 * Settings structure (matches CLI config schema).
 * Excludes token and providers for security.
 */
interface SettingsResponse {
  server?: {
    port?: number;
    proxyPort?: number;
    autoOpen?: boolean;
  };
  data?: {
    retentionDays?: number;
  };
  alerts?: {
    defaults?: {
      telegram?: {
        botToken?: string;
        chatId?: string;
      };
      webhook?: {
        url?: string;
      };
      email?: {
        host?: string;
        port?: number;
        secure?: boolean;
        user?: string;
        pass?: string;
        from?: string;
        to?: string;
      };
    };
  };
}

interface ConfigFile {
  token: string;
  server?: SettingsResponse["server"];
  data?: SettingsResponse["data"];
  alerts?: SettingsResponse["alerts"];
  providers?: Record<string, unknown>;
}

/**
 * Deep merge two objects. Source values override target values.
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceVal = source[key];
    const targetVal = result[key];
    if (
      sourceVal !== undefined &&
      sourceVal !== null &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal !== undefined &&
      targetVal !== null &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      ) as T[keyof T];
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal as T[keyof T];
    }
  }
  return result;
}

export function createSettingsRouter(options: { configPath: string }): Router {
  const { configPath } = options;

  /**
   * GET /api/settings
   * Returns current config (excluding token and providers)
   */
  router.get("/api/settings", (_req, res) => {
    try {
      if (!fs.existsSync(configPath)) {
        res.json({});
        return;
      }

      const raw = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(raw) as ConfigFile;

      const settings: SettingsResponse = {
        server: config.server,
        data: config.data,
        alerts: config.alerts,
      };

      res.json(settings);
    } catch (err) {
      log.error("Failed to read config", { err: String(err) });
      res.status(500).json({ error: "Failed to read settings" });
    }
  });

  /**
   * PUT /api/settings
   * Partial merge update of config (excluding token and providers)
   */
  router.put("/api/settings", (req, res) => {
    try {
      const updates = req.body as SettingsResponse;

      // Read existing config
      let config: ConfigFile = { token: "" };
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, "utf-8");
        config = JSON.parse(raw) as ConfigFile;
      }

      // Merge updates (only allowed fields)
      if (updates.server) {
        config.server = deepMerge(config.server ?? {}, updates.server);
      }
      if (updates.data) {
        config.data = deepMerge(config.data ?? {}, updates.data);
      }
      if (updates.alerts) {
        config.alerts = deepMerge(config.alerts ?? {}, updates.alerts);
      }

      // Write back
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
      log.info("Settings updated");

      // Return updated settings
      const settings: SettingsResponse = {
        server: config.server,
        data: config.data,
        alerts: config.alerts,
      };

      res.json(settings);
    } catch (err) {
      log.error("Failed to update config", { err: String(err) });
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  return router;
}

export default router;
