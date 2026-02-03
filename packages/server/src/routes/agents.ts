import { Router } from "express";
import type Database from "better-sqlite3";
import { getAllAgents, getAgentByAgentId } from "../db.js";

const router = Router();

router.get("/api/agents", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const agents = getAllAgents(db);
  res.json({ agents });
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
