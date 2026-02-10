import { Router } from "express";
import type Database from "better-sqlite3";
import {
  getModelRulesForAgent,
  getModelRule,
  upsertModelRule,
  deleteModelRule,
  getAgentProviders,
  getAgentDefaultModels,
  getAgentByAgentId,
  getProviderModels,
} from "../db.js";
import { SELECTABLE_MODELS, SELECTABLE_PROVIDER_NAMES } from "@agentgazer/shared";

const router = Router();

// Get all model rules for an agent
router.get("/api/agents/:agentId/model-rules", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { agentId } = req.params;

  const agent = getAgentByAgentId(db, agentId);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const rules = getModelRulesForAgent(db, agentId);
  res.json({ rules });
});

// Get or create model rule for a specific provider
router.put("/api/agents/:agentId/model-rules/:provider", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { agentId, provider } = req.params;
  const { model_override, target_provider } = req.body as {
    model_override?: string | null;
    target_provider?: string | null;
  };

  const agent = getAgentByAgentId(db, agentId);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const rule = upsertModelRule(
    db,
    agentId,
    provider,
    model_override ?? null,
    target_provider ?? null,
  );
  res.json(rule);
});

// Delete model rule for a specific provider
router.delete("/api/agents/:agentId/model-rules/:provider", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { agentId, provider } = req.params;

  const agent = getAgentByAgentId(db, agentId);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const deleted = deleteModelRule(db, agentId, provider);
  if (!deleted) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }

  res.json({ success: true });
});

// Get distinct providers used by an agent (from events)
router.get("/api/agents/:agentId/providers", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { agentId } = req.params;

  const agent = getAgentByAgentId(db, agentId);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const providers = getAgentProviders(db, agentId);
  const rules = getModelRulesForAgent(db, agentId);
  const defaultModels = getAgentDefaultModels(db, agentId);

  // Map provider to its override if exists
  const providerDetails = providers.map(p => {
    const rule = rules.find(r => r.provider === p);
    return {
      provider: p,
      default_model: defaultModels[p] ?? null,
      model_override: rule?.model_override ?? null,
      target_provider: rule?.target_provider ?? null,
    };
  });

  res.json({ providers: providerDetails });
});

// Get selectable models for dropdowns (static + custom models from DB)
router.get("/api/models", (req, res) => {
  const db = req.app.locals.db as Database.Database;

  // Start with static models
  const result: Record<string, string[]> = {};

  for (const provider of SELECTABLE_PROVIDER_NAMES) {
    const staticModels = SELECTABLE_MODELS[provider] ?? [];
    const customModels = getProviderModels(db, provider).map(m => m.model_id);

    // Merge and deduplicate
    const allModels = [...new Set([...staticModels, ...customModels])];
    result[provider] = allModels;
  }

  res.json(result);
});

export default router;
