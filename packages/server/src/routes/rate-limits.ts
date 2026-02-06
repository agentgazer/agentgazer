import { Router } from "express";
import type Database from "better-sqlite3";
import {
  getRateLimitsForAgent,
  getRateLimit,
  setRateLimit,
  deleteRateLimit,
  getAllRateLimits,
} from "../db.js";

const router = Router();

// GET /api/agents/:agentId/rate-limits - List rate limits for an agent
router.get("/api/agents/:agentId/rate-limits", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { agentId } = req.params;

  const rateLimits = getRateLimitsForAgent(db, agentId);

  res.json({ rate_limits: rateLimits });
});

// PUT /api/agents/:agentId/rate-limits/:provider - Set/update a rate limit
router.put("/api/agents/:agentId/rate-limits/:provider", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { agentId, provider } = req.params;
  const { max_requests, window_seconds } = req.body as {
    max_requests?: unknown;
    window_seconds?: unknown;
  };

  // Validate max_requests
  if (
    typeof max_requests !== "number" ||
    !Number.isInteger(max_requests) ||
    max_requests <= 0
  ) {
    res.status(400).json({
      error: "max_requests must be a positive integer",
    });
    return;
  }

  // Validate window_seconds
  if (
    typeof window_seconds !== "number" ||
    !Number.isInteger(window_seconds) ||
    window_seconds <= 0
  ) {
    res.status(400).json({
      error: "window_seconds must be a positive integer",
    });
    return;
  }

  const rateLimit = setRateLimit(db, agentId, provider, max_requests, window_seconds);

  res.json(rateLimit);
});

// DELETE /api/agents/:agentId/rate-limits/:provider - Remove a rate limit
router.delete("/api/agents/:agentId/rate-limits/:provider", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { agentId, provider } = req.params;

  const existing = getRateLimit(db, agentId, provider);
  if (!existing) {
    res.status(404).json({ error: "Rate limit not found" });
    return;
  }

  deleteRateLimit(db, agentId, provider);

  res.json({ success: true });
});

// GET /api/rate-limits - List all rate limits (for proxy to load)
router.get("/api/rate-limits", (req, res) => {
  const db = req.app.locals.db as Database.Database;

  const rateLimits = getAllRateLimits(db);

  res.json({ rate_limits: rateLimits });
});

export default router;
