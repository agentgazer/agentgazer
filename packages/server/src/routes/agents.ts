import { Router } from "express";
import type Database from "better-sqlite3";
import { getAllAgents, getAgentByAgentId } from "../db.js";

const router = Router();

router.get("/api/agents", (req, res) => {
  const db = req.app.locals.db as Database.Database;

  const limitStr = req.query.limit as string | undefined;
  const offsetStr = req.query.offset as string | undefined;
  const search = req.query.search as string | undefined;
  const status = req.query.status as string | undefined;

  const hasPagination = limitStr || offsetStr || search || status;

  if (!hasPagination) {
    // Backwards compatible: return all agents
    const agents = getAllAgents(db);
    res.json({ agents });
    return;
  }

  const limit = limitStr ? Math.min(Math.max(1, parseInt(limitStr, 10) || 20), 100) : 20;
  const offset = offsetStr ? Math.max(0, parseInt(offsetStr, 10) || 0) : 0;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (search) {
    conditions.push("(a.agent_id LIKE ? OR a.name LIKE ?)");
    const term = `%${search}%`;
    params.push(term, term);
  }

  if (status) {
    conditions.push("a.status = ?");
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRow = db
    .prepare(
      `SELECT COUNT(*) AS total FROM agents a ${where}`,
    )
    .get(...params) as { total: number };

  const rows = db
    .prepare(
      `SELECT a.id, a.agent_id, a.name, a.status,
              a.last_heartbeat_at AS last_heartbeat,
              a.created_at, a.updated_at,
              COALESCE(e.cnt, 0) AS total_events
       FROM agents a
       LEFT JOIN (SELECT agent_id, COUNT(*) AS cnt FROM agent_events GROUP BY agent_id) e
         ON e.agent_id = a.agent_id
       ${where}
       ORDER BY a.updated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);

  res.json({ agents: rows, total: countRow.total });
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

export default router;
