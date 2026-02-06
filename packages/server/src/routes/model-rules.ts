import { Router } from "express";
import type Database from "better-sqlite3";
import {
  getModelRulesForAgent,
  getModelRule,
  upsertModelRule,
  deleteModelRule,
  getAgentProviders,
  getAgentByAgentId,
} from "../db.js";
import { SELECTABLE_MODELS } from "@agentgazer/shared";

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
  const { model_override } = req.body as { model_override?: string | null };

  const agent = getAgentByAgentId(db, agentId);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const rule = upsertModelRule(db, agentId, provider, model_override ?? null);
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

  // Map provider to its override if exists
  const providerDetails = providers.map(p => ({
    provider: p,
    model_override: rules.find(r => r.provider === p)?.model_override ?? null,
  }));

  res.json({ providers: providerDetails });
});

// Get selectable models for dropdowns
router.get("/api/models", (_req, res) => {
  res.json(SELECTABLE_MODELS);
});

export default router;
