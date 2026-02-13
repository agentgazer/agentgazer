import { Router } from "express";
import type Database from "better-sqlite3";
import {
  getSecurityConfig,
  upsertSecurityConfig,
  insertSecurityEvent,
  getSecurityEvents,
  getSecurityEventById,
  type SecurityConfig,
  type InsertSecurityEvent,
} from "../db.js";
import { fireSecurityAlert, type SecurityEventData } from "../alerts/evaluator.js";

const router = Router();

// GET /api/security/config - Get security config for an agent (or global)
router.get("/api/security/config", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const agentId = req.query.agent_id as string | undefined;

  const config = getSecurityConfig(db, agentId ?? null);
  res.json(config);
});

// PUT /api/security/config - Update security config for an agent (or global)
router.put("/api/security/config", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const body = req.body as Partial<SecurityConfig> & { agent_id?: string | null };

  // Build config object with defaults
  const existing = getSecurityConfig(db, body.agent_id ?? null);

  const config: SecurityConfig = {
    agent_id: body.agent_id ?? null,
    prompt_injection: {
      action: body.prompt_injection?.action ?? existing.prompt_injection.action,
      rules: body.prompt_injection?.rules ?? existing.prompt_injection.rules,
      custom: body.prompt_injection?.custom ?? existing.prompt_injection.custom,
    },
    data_masking: {
      replacement: body.data_masking?.replacement ?? existing.data_masking.replacement,
      rules: body.data_masking?.rules ?? existing.data_masking.rules,
      custom: body.data_masking?.custom ?? existing.data_masking.custom,
    },
    tool_restrictions: {
      action: body.tool_restrictions?.action ?? existing.tool_restrictions.action,
      rules: body.tool_restrictions?.rules ?? existing.tool_restrictions.rules,
      allowlist: body.tool_restrictions?.allowlist ?? existing.tool_restrictions.allowlist,
      blocklist: body.tool_restrictions?.blocklist ?? existing.tool_restrictions.blocklist,
    },
  };

  // Validate action values
  const validActions = new Set(["log", "alert", "block"]);
  if (!validActions.has(config.prompt_injection.action)) {
    res.status(400).json({ error: "prompt_injection.action must be one of: log, alert, block" });
    return;
  }
  if (!validActions.has(config.tool_restrictions.action)) {
    res.status(400).json({ error: "tool_restrictions.action must be one of: log, alert, block" });
    return;
  }

  // Validate custom patterns (must be valid regex)
  for (const pattern of config.prompt_injection.custom) {
    try {
      new RegExp(pattern.pattern);
    } catch {
      res.status(400).json({ error: `Invalid regex in prompt_injection.custom: ${pattern.pattern}` });
      return;
    }
  }

  for (const pattern of config.data_masking.custom) {
    try {
      new RegExp(pattern.pattern);
    } catch {
      res.status(400).json({ error: `Invalid regex in data_masking.custom: ${pattern.pattern}` });
      return;
    }
  }

  const updated = upsertSecurityConfig(db, config);
  res.json(updated);
});

// GET /api/security/events - List security events with pagination and filters
router.get("/api/security/events", (req, res) => {
  const db = req.app.locals.db as Database.Database;

  const agentId = req.query.agent_id as string | undefined;
  const eventType = req.query.event_type as string | undefined;
  const severity = req.query.severity as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const limitStr = req.query.limit as string | undefined;
  const offsetStr = req.query.offset as string | undefined;

  const limit = limitStr ? Math.min(Math.max(1, parseInt(limitStr, 10) || 50), 1000) : 50;
  const offset = offsetStr ? Math.max(0, parseInt(offsetStr, 10) || 0) : 0;

  const result = getSecurityEvents(db, {
    agent_id: agentId,
    event_type: eventType,
    severity,
    from,
    to,
    limit,
    offset,
  });

  res.json(result);
});

// GET /api/security/events/:id - Get a single security event
router.get("/api/security/events/:id", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { id } = req.params;

  const event = getSecurityEventById(db, id);
  if (!event) {
    res.status(404).json({ error: "Security event not found" });
    return;
  }

  res.json(event);
});

// POST /api/security/events - Create a security event (internal use by proxy)
router.post("/api/security/events", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const body = req.body as InsertSecurityEvent;

  // Validate required fields
  if (!body.agent_id || typeof body.agent_id !== "string") {
    res.status(400).json({ error: "agent_id is required" });
    return;
  }

  const validEventTypes = new Set(["prompt_injection", "data_masked", "tool_blocked"]);
  if (!body.event_type || !validEventTypes.has(body.event_type)) {
    res.status(400).json({ error: `event_type must be one of: ${[...validEventTypes].join(", ")}` });
    return;
  }

  const validSeverities = new Set(["info", "warning", "critical"]);
  if (!body.severity || !validSeverities.has(body.severity)) {
    res.status(400).json({ error: `severity must be one of: ${[...validSeverities].join(", ")}` });
    return;
  }

  const validActions = new Set(["logged", "alerted", "blocked", "masked"]);
  if (!body.action_taken || !validActions.has(body.action_taken)) {
    res.status(400).json({ error: `action_taken must be one of: ${[...validActions].join(", ")}` });
    return;
  }

  const id = insertSecurityEvent(db, body);
  const event = getSecurityEventById(db, id);

  // Fire security alert (non-blocking)
  const alertData: SecurityEventData = {
    agent_id: body.agent_id,
    event_type: body.event_type as "prompt_injection" | "data_masked" | "tool_blocked",
    severity: body.severity as "info" | "warning" | "critical",
    action_taken: body.action_taken,
    rule_name: body.rule_name,
    matched_pattern: body.matched_pattern,
    snippet: body.snippet,
  };
  void fireSecurityAlert(db, alertData);

  res.status(201).json(event);
});

export default router;
