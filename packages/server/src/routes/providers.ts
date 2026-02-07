import { Router, Request, Response } from "express";
import type Database from "better-sqlite3";
import { KNOWN_PROVIDER_NAMES, ProviderName } from "@agentgazer/shared";
import { PROVIDER_MODELS } from "@agentgazer/shared";
import {
  getProviderSettings,
  getAllProviderSettings,
  upsertProviderSettings,
  getProviderModels,
  addProviderModel,
  deleteProviderModel,
  getProviderStats,
  getProviderModelStats,
  getAllProviderListStats,
} from "../db.js";
import { validateProviderKey, testProviderModel } from "../services/provider-validator.js";

interface SecretStore {
  get(service: string, account: string): Promise<string | null>;
  set(service: string, account: string, secret: string): Promise<void>;
  delete(service: string, account: string): Promise<void | boolean>;
  list(service: string): Promise<string[]>;
}

interface ProvidersRouterOptions {
  db: Database.Database;
  secretStore?: SecretStore;
}

// Middleware to check if request is from loopback
function isLoopback(req: Request): boolean {
  const ip = req.ip || req.socket?.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function requireLoopback(req: Request, res: Response, next: () => void): void {
  if (!isLoopback(req)) {
    res.status(403).json({
      error: "This operation is only available from localhost for API key security",
    });
    return;
  }
  next();
}

const PROVIDER_SERVICE = "agentgazer.providers";

export function createProvidersRouter(options: ProvidersRouterOptions): Router {
  const { db, secretStore } = options;
  const router = Router();

  // GET /api/connection-info
  router.get("/connection-info", (req: Request, res: Response) => {
    res.json({ isLoopback: isLoopback(req) });
  });

  // GET /api/providers - list all providers with status and stats
  router.get("/", async (req: Request, res: Response) => {
    try {
      const configuredProviders: string[] = secretStore
        ? await secretStore.list(PROVIDER_SERVICE)
        : [];

      const settings = getAllProviderSettings(db);
      const settingsMap = new Map(settings.map(s => [s.provider, s]));

      // Get aggregated stats for all providers
      const allStats = getAllProviderListStats(db);
      const statsMap = new Map(allStats.map(s => [s.provider, s]));

      const providers = KNOWN_PROVIDER_NAMES.map(name => {
        const configured = configuredProviders.includes(name);
        const providerSettings = settingsMap.get(name);
        const stats = statsMap.get(name);

        return {
          name,
          configured,
          active: providerSettings?.active !== 0,
          rate_limit: providerSettings?.rate_limit_max_requests
            ? {
                max_requests: providerSettings.rate_limit_max_requests,
                window_seconds: providerSettings.rate_limit_window_seconds,
              }
            : null,
          // Stats fields
          agent_count: stats?.agent_count ?? 0,
          total_tokens: stats?.total_tokens ?? 0,
          total_cost: stats?.total_cost ?? 0,
          today_cost: stats?.today_cost ?? 0,
        };
      });

      // Sort by total_cost descending (highest usage first)
      providers.sort((a, b) => b.total_cost - a.total_cost);

      res.json({ providers });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/providers - add new provider (loopback only)
  router.post("/", requireLoopback, async (req: Request, res: Response) => {
    try {
      const { name, apiKey } = req.body as { name?: string; apiKey?: string };

      if (!name || !apiKey) {
        res.status(400).json({ error: "name and apiKey are required" });
        return;
      }

      if (!KNOWN_PROVIDER_NAMES.includes(name as ProviderName)) {
        res.status(400).json({ error: `Unknown provider: ${name}` });
        return;
      }

      if (!secretStore) {
        res.status(500).json({ error: "Secret store not configured" });
        return;
      }

      // Validate the key first
      const validation = await validateProviderKey(name as ProviderName, apiKey);

      // Store even if validation fails (user may want to save anyway)
      await secretStore.set(PROVIDER_SERVICE, name, apiKey);

      // Initialize settings if not exists
      upsertProviderSettings(db, name, {});

      res.json({
        success: true,
        validated: validation.valid,
        error: validation.error,
        models: validation.models,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // PUT /api/providers/:name - update provider (toggle active status)
  router.put("/:name", (req: Request, res: Response) => {
    try {
      const name = req.params.name as string;
      const { active } = req.body as { active?: boolean };

      if (active === undefined) {
        res.status(400).json({ error: "active is required" });
        return;
      }

      const settings = upsertProviderSettings(db, name, { active });

      res.json({
        provider: name,
        active: settings.active === 1,
        rate_limit: settings.rate_limit_max_requests
          ? {
              max_requests: settings.rate_limit_max_requests,
              window_seconds: settings.rate_limit_window_seconds,
            }
          : null,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // DELETE /api/providers/:name - remove provider (loopback only)
  router.delete("/:name", requireLoopback, async (req: Request, res: Response) => {
    try {
      const name = req.params.name as string;

      if (!secretStore) {
        res.status(500).json({ error: "Secret store not configured" });
        return;
      }

      const deleted = await secretStore.delete(PROVIDER_SERVICE, name);
      res.json({ success: deleted });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/providers/:name/validate - validate API key
  router.post("/:name/validate", async (req: Request, res: Response) => {
    try {
      const name = req.params.name as string;
      let apiKey = req.body?.apiKey as string | undefined;

      // If no key provided, try to get from store
      if (!apiKey && secretStore) {
        apiKey = (await secretStore.get(PROVIDER_SERVICE, name)) ?? undefined;
      }

      if (!apiKey) {
        res.status(400).json({ error: "No API key provided or stored" });
        return;
      }

      const result = await validateProviderKey(name as ProviderName, apiKey);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/providers/:name/settings
  router.get("/:name/settings", (req: Request, res: Response) => {
    try {
      const name = req.params.name as string;
      const settings = getProviderSettings(db, name);

      res.json({
        provider: name,
        active: settings?.active !== 0,
        rate_limit: settings?.rate_limit_max_requests
          ? {
              max_requests: settings.rate_limit_max_requests,
              window_seconds: settings.rate_limit_window_seconds,
            }
          : null,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // PATCH /api/providers/:name/settings
  router.patch("/:name/settings", (req: Request, res: Response) => {
    try {
      const name = req.params.name as string;
      const { active, rate_limit } = req.body as {
        active?: boolean;
        rate_limit?: { max_requests: number; window_seconds: number } | null;
      };

      const settings = upsertProviderSettings(db, name, {
        active,
        rate_limit_max_requests: rate_limit?.max_requests ?? null,
        rate_limit_window_seconds: rate_limit?.window_seconds ?? null,
      });

      res.json({
        provider: name,
        active: settings.active === 1,
        rate_limit: settings.rate_limit_max_requests
          ? {
              max_requests: settings.rate_limit_max_requests,
              window_seconds: settings.rate_limit_window_seconds,
            }
          : null,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/providers/:name/models
  router.get("/:name/models", (req: Request, res: Response) => {
    try {
      const name = req.params.name as string;

      // Get built-in models from shared package
      const builtInModels = PROVIDER_MODELS[name as ProviderName] ?? [];

      // Get custom models from database
      const customModels = getProviderModels(db, name);

      const models = [
        ...builtInModels.map(id => ({ id, custom: false, verified: true })),
        ...customModels.map(m => ({
          id: m.model_id,
          displayName: m.display_name,
          custom: true,
          verified: !!m.verified_at,
          verifiedAt: m.verified_at,
        })),
      ];

      res.json({ provider: name, models });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/providers/:name/models - add custom model
  router.post("/:name/models", (req: Request, res: Response) => {
    try {
      const name = req.params.name as string;
      const { modelId, displayName, verified } = req.body as {
        modelId?: string;
        displayName?: string;
        verified?: boolean;
      };

      if (!modelId) {
        res.status(400).json({ error: "modelId is required" });
        return;
      }

      const model = addProviderModel(
        db,
        name,
        modelId,
        displayName,
        verified ? new Date().toISOString() : undefined,
      );

      res.json({
        id: model.model_id,
        displayName: model.display_name,
        custom: true,
        verified: !!model.verified_at,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // DELETE /api/providers/:name/models/:modelId
  router.delete("/:name/models/:modelId", (req: Request, res: Response) => {
    try {
      const name = req.params.name as string;
      const modelId = req.params.modelId as string;
      const deleted = deleteProviderModel(db, name, decodeURIComponent(modelId));
      res.json({ success: deleted });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/providers/:name/models/:modelId/test
  router.post("/:name/models/:modelId/test", async (req: Request, res: Response) => {
    try {
      const name = req.params.name as string;
      const modelId = req.params.modelId as string;

      if (!secretStore) {
        res.status(500).json({ error: "Secret store not configured" });
        return;
      }

      const apiKey = await secretStore.get(PROVIDER_SERVICE, name);
      if (!apiKey) {
        res.status(400).json({ error: "Provider not configured" });
        return;
      }

      const result = await testProviderModel(
        name as ProviderName,
        apiKey,
        decodeURIComponent(modelId),
      );

      if (result.exists) {
        // Mark as verified in database
        addProviderModel(db, name, decodeURIComponent(modelId), undefined, new Date().toISOString());
      }

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/providers/:name/stats
  router.get("/:name/stats", (req: Request, res: Response) => {
    try {
      const name = req.params.name as string;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;

      const stats = getProviderStats(db, name, from, to);
      const modelStats = getProviderModelStats(db, name, from, to);

      res.json({
        provider: name,
        total_requests: stats.total_requests,
        total_tokens: stats.total_tokens,
        total_cost: stats.total_cost,
        by_model: modelStats,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
