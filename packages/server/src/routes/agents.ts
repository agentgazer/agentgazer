import { Router } from "express";
import type Database from "better-sqlite3";
import {
  getAllAgents,
  getAgentByAgentId,
  getAgentPolicy,
  updateAgentPolicy,
  getDailySpend,
  getModelRulesForAgent,
  getKillSwitchConfig,
  updateKillSwitchConfig,
  deleteAgent,
} from "../db.js";
import { resetKillSwitchAlerts } from "../alerts/evaluator.js";
import { createLogger } from "@agentgazer/shared";

const router = Router();
const log = createLogger("routes/agents");

// Proxy URL for internal API calls (clear-window)
const PROXY_URL = process.env.AGENTGAZER_PROXY_URL ?? "http://127.0.0.1:4000";

/**
 * Call proxy's internal API to clear loop detector window for an agent.
 * Fire-and-forget: logs errors but doesn't throw.
 */
async function clearLoopDetectorWindow(agentId: string): Promise<void> {
  try {
    const response = await fetch(`${PROXY_URL}/internal/agents/${encodeURIComponent(agentId)}/clear-window`, {
      method: "POST",
    });
    if (response.ok) {
      log.info(`Cleared loop detector window for agent "${agentId}"`);
    } else {
      log.warn(`Failed to clear loop detector window for agent "${agentId}": ${response.status}`);
    }
  } catch (err) {
    log.warn(`Failed to contact proxy to clear window for agent "${agentId}": ${String(err)}`);
  }
}

router.get("/api/agents", (req, res) => {
  const db = req.app.locals.db as Database.Database;

  const limitStr = req.query.limit as string | undefined;
  const offsetStr = req.query.offset as string | undefined;
  const search = req.query.search as string | undefined;

  // Get today's UTC midnight for today_cost calculation
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const todayStart = todayUTC.toISOString();

  const hasPagination = limitStr || offsetStr || search;

  if (!hasPagination) {
    // Backwards compatible: return all agents with providers
    const agents = getAllAgents(db);
    const agentsWithProviders = agents.map((agent) => {
      const providerRows = db.prepare(`
        SELECT DISTINCT provider FROM agent_events
        WHERE agent_id = ? AND provider IS NOT NULL
        ORDER BY provider
      `).all(agent.agent_id) as { provider: string }[];

      const modelRules = getModelRulesForAgent(db, agent.agent_id);
      const overrideProviders = new Set(modelRules.filter(r => r.model_override).map(r => r.provider));

      return {
        ...agent,
        providers: providerRows.map(r => ({
          provider: r.provider,
          has_override: overrideProviders.has(r.provider),
        })),
      };
    });
    res.json({ agents: agentsWithProviders });
    return;
  }

  const limit = limitStr ? Math.min(Math.max(1, parseInt(limitStr, 10) || 20), 100) : 20;
  const offset = offsetStr ? Math.max(0, parseInt(offsetStr, 10) || 0) : 0;

  const conditions: string[] = [];
  const params: unknown[] = [todayStart];

  if (search) {
    conditions.push("(a.agent_id LIKE ? OR a.name LIKE ?)");
    const term = `%${search}%`;
    params.push(term, term);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRow = db
    .prepare(
      `SELECT COUNT(*) AS total FROM agents a ${where}`,
    )
    .get(...params.slice(1)) as { total: number };

  const rows = db
    .prepare(
      `SELECT
         a.id, a.agent_id, a.name, a.active, a.budget_limit, a.kill_switch_enabled,
         a.created_at, a.updated_at,
         COALESCE(SUM(e.tokens_total), 0) AS total_tokens,
         COALESCE(SUM(e.cost_usd), 0) AS total_cost,
         COALESCE(SUM(CASE WHEN e.timestamp >= ? THEN e.cost_usd ELSE 0 END), 0) AS today_cost
       FROM agents a
       LEFT JOIN agent_events e ON e.agent_id = a.agent_id
       ${where}
       GROUP BY a.id
       ORDER BY a.updated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);

  // Add providers to each agent
  const agentsWithProviders = (rows as { agent_id: string }[]).map((agent) => {
    const providerRows = db.prepare(`
      SELECT DISTINCT provider FROM agent_events
      WHERE agent_id = ? AND provider IS NOT NULL
      ORDER BY provider
    `).all(agent.agent_id) as { provider: string }[];

    const modelRules = getModelRulesForAgent(db, agent.agent_id);
    const overrideProviders = new Set(modelRules.filter(r => r.model_override).map(r => r.provider));

    return {
      ...agent,
      providers: providerRows.map(r => ({
        provider: r.provider,
        has_override: overrideProviders.has(r.provider),
      })),
    };
  });

  res.json({ agents: agentsWithProviders, total: countRow.total });
});

router.get("/api/agents/:agentId", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { agentId } = req.params;
  const agent = getAgentByAgentId(db, agentId);

  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.json(agent);
});

router.get("/api/agents/:agentId/policy", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { agentId } = req.params;

  const policy = getAgentPolicy(db, agentId);
  if (!policy) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const dailySpend = getDailySpend(db, agentId);

  res.json({
    ...policy,
    daily_spend: dailySpend,
  });
});

router.put("/api/agents/:agentId/policy", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { agentId } = req.params;
  const body = req.body as {
    active?: boolean;
    budget_limit?: number | null;
    allowed_hours_start?: number | null;
    allowed_hours_end?: number | null;
  };

  // Check agent exists
  const existing = getAgentPolicy(db, agentId);
  if (!existing) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  // Validate allowed_hours range
  if (body.allowed_hours_start !== undefined && body.allowed_hours_start !== null) {
    if (body.allowed_hours_start < 0 || body.allowed_hours_start > 23) {
      res.status(400).json({ error: "allowed_hours_start must be between 0 and 23" });
      return;
    }
  }
  if (body.allowed_hours_end !== undefined && body.allowed_hours_end !== null) {
    if (body.allowed_hours_end < 0 || body.allowed_hours_end > 23) {
      res.status(400).json({ error: "allowed_hours_end must be between 0 and 23" });
      return;
    }
  }

  // Detect activation (active: false → true)
  const isActivating = body.active === true && !existing.active;
  // Detect deactivation (active: true → false)
  const isDeactivating = body.active === false && existing.active;

  // Build policy update
  const policyUpdate: Parameters<typeof updateAgentPolicy>[2] = {
    active: body.active,
    budget_limit: body.budget_limit,
    allowed_hours_start: body.allowed_hours_start,
    allowed_hours_end: body.allowed_hours_end,
  };

  // Handle deactivated_by field
  if (isActivating) {
    policyUpdate.deactivated_by = null;
  } else if (isDeactivating) {
    policyUpdate.deactivated_by = "manual";
  }

  const updated = updateAgentPolicy(db, agentId, policyUpdate);

  if (!updated) {
    res.status(400).json({ error: "No changes provided" });
    return;
  }

  // Clear loop detector window and reset kill switch alerts when activating
  if (isActivating) {
    void clearLoopDetectorWindow(agentId);
    resetKillSwitchAlerts(db, agentId);
  }

  const newPolicy = getAgentPolicy(db, agentId);
  const dailySpend = getDailySpend(db, agentId);

  res.json({
    ...newPolicy,
    daily_spend: dailySpend,
  });
});

// ---------------------------------------------------------------------------
// Kill Switch Endpoints
// ---------------------------------------------------------------------------

router.get("/api/agents/:agentId/kill-switch", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { agentId } = req.params;

  const config = getKillSwitchConfig(db, agentId);
  if (!config) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.json(config);
});

router.patch("/api/agents/:agentId/kill-switch", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { agentId } = req.params;
  const body = req.body as {
    enabled?: boolean;
    window_size?: number;
    threshold?: number;
  };

  // Check agent exists
  const existing = getKillSwitchConfig(db, agentId);
  if (!existing) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  // Validate window_size
  if (body.window_size !== undefined) {
    if (body.window_size < 5 || body.window_size > 100) {
      res.status(400).json({ error: "window_size must be between 5 and 100" });
      return;
    }
  }

  // Validate threshold
  if (body.threshold !== undefined) {
    if (body.threshold < 1 || body.threshold > 50) {
      res.status(400).json({ error: "threshold must be between 1 and 50" });
      return;
    }
  }

  const updated = updateKillSwitchConfig(db, agentId, {
    enabled: body.enabled,
    window_size: body.window_size,
    threshold: body.threshold,
  });

  if (!updated) {
    res.status(400).json({ error: "No changes provided" });
    return;
  }

  const newConfig = getKillSwitchConfig(db, agentId);
  res.json(newConfig);
});

// ---------------------------------------------------------------------------
// Delete Agent
// ---------------------------------------------------------------------------

router.delete("/api/agents/:agentId", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { agentId } = req.params;

  // Check agent exists
  const agent = getAgentByAgentId(db, agentId);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const deleted = deleteAgent(db, agentId);
  if (deleted) {
    log.info(`Deleted agent "${agentId}" and all related data`);
    res.status(204).send();
  } else {
    res.status(500).json({ error: "Failed to delete agent" });
  }
});

export default router;
