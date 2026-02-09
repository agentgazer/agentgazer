import { Router, Request, Response } from "express";
import type Database from "better-sqlite3";
import {
  getOverviewStats,
  getTopAgentsByCost,
  getTopModelsByTokens,
  getDailyTrends,
  getRecentEvents,
} from "../db.js";

interface OverviewRouterOptions {
  db: Database.Database;
  startTime: number; // timestamp when server started
}

interface AgentOverviewRow {
  agent_id: string;
  active: number;
  updated_at: string | null;
  today_cost: number;
  today_requests: number;
  primary_provider: string | null;
}

export function createOverviewRouter(options: OverviewRouterOptions): Router {
  const { db, startTime } = options;
  const router = Router();

  // GET /api/overview - comprehensive dashboard data
  router.get("/", (req: Request, res: Response) => {
    try {
      const stats = getOverviewStats(db);
      const topAgents = getTopAgentsByCost(db, 5);
      const topModels = getTopModelsByTokens(db, 5);
      const trends = getDailyTrends(db, 7);

      // Calculate uptime
      const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

      // Get agents for CLI TUI
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayStartStr = todayStart.toISOString();

      const agentRows = db.prepare(`
        SELECT
          a.agent_id,
          a.active,
          a.updated_at,
          COALESCE((
            SELECT SUM(e.cost_usd)
            FROM agent_events e
            WHERE e.agent_id = a.agent_id AND e.timestamp >= ?
          ), 0) as today_cost,
          COALESCE((
            SELECT COUNT(*)
            FROM agent_events e
            WHERE e.agent_id = a.agent_id AND e.timestamp >= ?
          ), 0) as today_requests,
          (
            SELECT e.provider
            FROM agent_events e
            WHERE e.agent_id = a.agent_id
            ORDER BY e.timestamp DESC
            LIMIT 1
          ) as primary_provider
        FROM agents a
        ORDER BY a.updated_at DESC
        LIMIT 20
      `).all(todayStartStr, todayStartStr) as AgentOverviewRow[];

      const agents = agentRows.map(row => ({
        agent_id: row.agent_id,
        status: row.active === 1 ? "active" : "inactive",
        primary_provider: row.primary_provider || "unknown",
        recent_calls: row.today_requests,
        cost_today: row.today_cost,
        last_activity: row.updated_at,
      }));

      // Get recent events for CLI TUI
      const recentEventRows = db.prepare(`
        SELECT
          timestamp,
          agent_id,
          provider,
          model,
          cost_usd as cost,
          latency_ms
        FROM agent_events
        WHERE event_type IN ('llm_call', 'completion')
        ORDER BY timestamp DESC
        LIMIT 10
      `).all() as {
        timestamp: string;
        agent_id: string;
        provider: string;
        model: string;
        cost: number | null;
        latency_ms: number | null;
      }[];

      const recentEvents = recentEventRows.map(row => ({
        timestamp: row.timestamp,
        agent_id: row.agent_id,
        provider: row.provider || "unknown",
        model: row.model || "unknown",
        cost: row.cost || 0,
        latency_ms: row.latency_ms || 0,
      }));

      res.json({
        // Original dashboard fields
        ...stats,
        top_agents: topAgents,
        top_models: topModels,
        cost_trend: trends.cost_trend,
        requests_trend: trends.requests_trend,
        // CLI TUI fields
        uptime_seconds: uptimeSeconds,
        total_requests_today: stats.today_requests,
        total_cost_today: stats.today_cost,
        server_status: "running",
        proxy_status: "running",
        agents,
        recent_events: recentEvents,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
