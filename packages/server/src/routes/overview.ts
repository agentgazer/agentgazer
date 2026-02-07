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
}

export function createOverviewRouter(options: OverviewRouterOptions): Router {
  const { db } = options;
  const router = Router();

  // GET /api/overview - comprehensive dashboard data
  router.get("/", (req: Request, res: Response) => {
    try {
      const stats = getOverviewStats(db);
      const topAgents = getTopAgentsByCost(db, 5);
      const topModels = getTopModelsByTokens(db, 5);
      const trends = getDailyTrends(db, 7);

      res.json({
        ...stats,
        top_agents: topAgents,
        top_models: topModels,
        cost_trend: trends.cost_trend,
        requests_trend: trends.requests_trend,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
