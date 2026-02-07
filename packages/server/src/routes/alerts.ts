import { Router } from "express";
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

const router = Router();

interface AlertRuleRow {
  id: string;
  agent_id: string;
  rule_type: string;
  config: string;
  enabled: number;
  notification_type: string;
  webhook_url: string | null;
  email: string | null;
  smtp_config: string | null;
  telegram_config: string | null;
  created_at: string;
  updated_at: string;
}

interface AlertHistoryRow {
  id: string;
  alert_rule_id: string;
  agent_id: string;
  rule_type: string;
  message: string;
  delivered_via: string;
  delivered_at: string;
}

function parseAlertRule(row: AlertRuleRow) {
  let config: unknown = row.config;
  if (typeof row.config === "string") {
    try { config = JSON.parse(row.config); } catch { /* keep as string */ }
  }
  let smtpConfig: unknown = row.smtp_config;
  if (row.smtp_config && typeof row.smtp_config === "string") {
    try { smtpConfig = JSON.parse(row.smtp_config); } catch { /* keep as string */ }
  }
  let telegramConfig: unknown = row.telegram_config;
  if (row.telegram_config && typeof row.telegram_config === "string") {
    try { telegramConfig = JSON.parse(row.telegram_config); } catch { /* keep as string */ }
  }
  return {
    id: row.id,
    agent_id: row.agent_id,
    rule_type: row.rule_type,
    config,
    enabled: row.enabled === 1,
    notification_type: row.notification_type || "webhook",
    webhook_url: row.webhook_url,
    email: row.email,
    smtp_config: smtpConfig,
    telegram_config: telegramConfig,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseAlertHistory(row: AlertHistoryRow & { data?: string }) {
  let data: unknown = row.data;
  if (row.data && typeof row.data === "string") {
    try { data = JSON.parse(row.data); } catch { /* keep as string */ }
  }
  return {
    ...row,
    data,
  };
}

// GET /api/alerts - List all alert rules (with optional pagination + filters)
router.get("/api/alerts", (req, res) => {
  const db = req.app.locals.db as Database.Database;

  const limitStr = req.query.limit as string | undefined;
  const offsetStr = req.query.offset as string | undefined;
  const agentId = req.query.agent_id as string | undefined;
  const ruleType = req.query.rule_type as string | undefined;

  const hasPagination = limitStr || offsetStr || agentId || ruleType;

  if (!hasPagination) {
    // Backwards compatible
    const rows = db
      .prepare("SELECT * FROM alert_rules ORDER BY created_at DESC")
      .all() as AlertRuleRow[];
    const alerts = rows.map(parseAlertRule);
    res.json({ alerts });
    return;
  }

  const limit = limitStr ? Math.min(Math.max(1, parseInt(limitStr, 10) || 20), 100) : 20;
  const offset = offsetStr ? Math.max(0, parseInt(offsetStr, 10) || 0) : 0;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (agentId) {
    conditions.push("agent_id = ?");
    params.push(agentId);
  }

  if (ruleType) {
    conditions.push("rule_type = ?");
    params.push(ruleType);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRow = db
    .prepare(`SELECT COUNT(*) AS total FROM alert_rules ${where}`)
    .get(...params) as { total: number };

  const rows = db
    .prepare(`SELECT * FROM alert_rules ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as AlertRuleRow[];

  const alerts = rows.map(parseAlertRule);
  res.json({ alerts, total: countRow.total });
});

// POST /api/alerts - Create a new alert rule
router.post("/api/alerts", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const body = req.body as {
    agent_id?: string;
    rule_type?: string;
    config?: Record<string, unknown>;
    enabled?: boolean;
    notification_type?: string;
    webhook_url?: string;
    email?: string;
    smtp_config?: Record<string, unknown>;
    telegram_config?: Record<string, unknown>;
  };

  // Validate required fields
  if (!body.agent_id || typeof body.agent_id !== "string") {
    res.status(400).json({ error: "agent_id is required" });
    return;
  }

  if (!body.rule_type || typeof body.rule_type !== "string") {
    res.status(400).json({ error: "rule_type is required" });
    return;
  }

  const validRuleTypes = new Set(["agent_down", "error_rate", "budget", "kill_switch"]);
  if (!validRuleTypes.has(body.rule_type)) {
    res.status(400).json({ error: `rule_type must be one of: ${[...validRuleTypes].join(", ")}` });
    return;
  }

  if (body.config === undefined || body.config === null || typeof body.config !== "object") {
    res.status(400).json({ error: "config is required and must be an object" });
    return;
  }

  const notificationType = body.notification_type || "webhook";
  const validNotificationTypes = new Set(["webhook", "email", "telegram"]);
  if (!validNotificationTypes.has(notificationType)) {
    res.status(400).json({ error: `notification_type must be one of: ${[...validNotificationTypes].join(", ")}` });
    return;
  }

  // Validate notification-specific fields
  if (notificationType === "webhook") {
    if (!body.webhook_url) {
      res.status(400).json({ error: "webhook_url is required for webhook notification" });
      return;
    }
    try {
      const parsed = new URL(body.webhook_url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        res.status(400).json({ error: "webhook_url must use http or https protocol" });
        return;
      }
    } catch {
      res.status(400).json({ error: "webhook_url must be a valid URL" });
      return;
    }
  } else if (notificationType === "email") {
    if (!body.smtp_config) {
      res.status(400).json({ error: "smtp_config is required for email notification" });
      return;
    }
    const smtp = body.smtp_config as { host?: string; port?: number; from?: string; to?: string };
    if (!smtp.host || !smtp.from || !smtp.to) {
      res.status(400).json({ error: "smtp_config requires host, from, and to fields" });
      return;
    }
  } else if (notificationType === "telegram") {
    if (!body.telegram_config) {
      res.status(400).json({ error: "telegram_config is required for telegram notification" });
      return;
    }
    const tg = body.telegram_config as { bot_token?: string; chat_id?: string };
    if (!tg.bot_token || !tg.chat_id) {
      res.status(400).json({ error: "telegram_config requires bot_token and chat_id fields" });
      return;
    }
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const enabled = body.enabled !== undefined ? (body.enabled ? 1 : 0) : 1;

  db.prepare(
    `INSERT INTO alert_rules (id, agent_id, rule_type, config, enabled, notification_type, webhook_url, email, smtp_config, telegram_config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    body.agent_id,
    body.rule_type,
    JSON.stringify(body.config),
    enabled,
    notificationType,
    body.webhook_url ?? null,
    body.email ?? null,
    body.smtp_config ? JSON.stringify(body.smtp_config) : null,
    body.telegram_config ? JSON.stringify(body.telegram_config) : null,
    now,
    now,
  );

  const row = db.prepare("SELECT * FROM alert_rules WHERE id = ?").get(id) as AlertRuleRow;
  res.status(201).json(parseAlertRule(row));
});

// PUT /api/alerts/:id - Update an alert rule
router.put("/api/alerts/:id", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { id } = req.params;
  const body = req.body as {
    agent_id?: string;
    rule_type?: string;
    config?: Record<string, unknown>;
    enabled?: boolean;
    notification_type?: string;
    webhook_url?: string;
    email?: string;
    smtp_config?: Record<string, unknown>;
    telegram_config?: Record<string, unknown>;
  };

  const existing = db.prepare("SELECT * FROM alert_rules WHERE id = ?").get(id) as
    | AlertRuleRow
    | undefined;

  if (!existing) {
    res.status(404).json({ error: "Alert rule not found" });
    return;
  }

  const now = new Date().toISOString();
  const agentId = body.agent_id ?? existing.agent_id;
  const ruleType = body.rule_type ?? existing.rule_type;
  const config = body.config !== undefined ? JSON.stringify(body.config) : existing.config;
  const enabled = body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing.enabled;
  const notificationType = body.notification_type ?? existing.notification_type ?? "webhook";

  // Validate webhook_url if provided
  if (body.webhook_url !== undefined && body.webhook_url !== null && body.webhook_url !== "") {
    try {
      const parsed = new URL(body.webhook_url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        res.status(400).json({ error: "webhook_url must use http or https protocol" });
        return;
      }
    } catch {
      res.status(400).json({ error: "webhook_url must be a valid URL" });
      return;
    }
  }
  const webhookUrl = body.webhook_url !== undefined ? (body.webhook_url || null) : existing.webhook_url;
  const email = body.email !== undefined ? body.email : existing.email;
  const smtpConfig = body.smtp_config !== undefined
    ? (body.smtp_config ? JSON.stringify(body.smtp_config) : null)
    : existing.smtp_config;
  const telegramConfig = body.telegram_config !== undefined
    ? (body.telegram_config ? JSON.stringify(body.telegram_config) : null)
    : existing.telegram_config;

  db.prepare(
    `UPDATE alert_rules
     SET agent_id = ?, rule_type = ?, config = ?, enabled = ?, notification_type = ?, webhook_url = ?, email = ?, smtp_config = ?, telegram_config = ?, updated_at = ?
     WHERE id = ?`,
  ).run(agentId, ruleType, config, enabled, notificationType, webhookUrl, email, smtpConfig, telegramConfig, now, id);

  const row = db.prepare("SELECT * FROM alert_rules WHERE id = ?").get(id) as AlertRuleRow;
  res.json(parseAlertRule(row));
});

// DELETE /api/alerts/:id - Delete an alert rule
router.delete("/api/alerts/:id", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM alert_rules WHERE id = ?").get(id) as
    | AlertRuleRow
    | undefined;

  if (!existing) {
    res.status(404).json({ error: "Alert rule not found" });
    return;
  }

  db.prepare("DELETE FROM alert_rules WHERE id = ?").run(id);
  res.status(204).send();
});

// PATCH /api/alerts/:id/toggle - Toggle alert rule enabled status
router.patch("/api/alerts/:id/toggle", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { id } = req.params;
  const body = req.body as { enabled?: boolean };

  const existing = db.prepare("SELECT * FROM alert_rules WHERE id = ?").get(id) as
    | AlertRuleRow
    | undefined;

  if (!existing) {
    res.status(404).json({ error: "Alert rule not found" });
    return;
  }

  if (body.enabled === undefined || typeof body.enabled !== "boolean") {
    res.status(400).json({ error: "enabled field (boolean) is required" });
    return;
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE alert_rules SET enabled = ?, updated_at = ? WHERE id = ?").run(
    body.enabled ? 1 : 0,
    now,
    id,
  );

  const row = db.prepare("SELECT * FROM alert_rules WHERE id = ?").get(id) as AlertRuleRow;
  res.json(parseAlertRule(row));
});

// GET /api/alert-history - List alert history (with optional pagination + filters)
router.get("/api/alert-history", (req, res) => {
  const db = req.app.locals.db as Database.Database;

  const limitStr = req.query.limit as string | undefined;
  const offsetStr = req.query.offset as string | undefined;
  const agentId = req.query.agent_id as string | undefined;
  const ruleType = req.query.rule_type as string | undefined;

  const limit = limitStr ? Math.min(Math.max(1, parseInt(limitStr, 10) || 100), 10_000) : 100;

  const hasPagination = offsetStr || agentId || ruleType;

  if (!hasPagination) {
    // Backwards compatible
    const rows = db
      .prepare("SELECT * FROM alert_history ORDER BY delivered_at DESC LIMIT ?")
      .all(limit) as AlertHistoryRow[];
    const history = rows.map(parseAlertHistory);
    res.json({ history });
    return;
  }

  const offset = offsetStr ? Math.max(0, parseInt(offsetStr, 10) || 0) : 0;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (agentId) {
    conditions.push("agent_id = ?");
    params.push(agentId);
  }

  if (ruleType) {
    conditions.push("rule_type = ?");
    params.push(ruleType);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRow = db
    .prepare(`SELECT COUNT(*) AS total FROM alert_history ${where}`)
    .get(...params) as { total: number };

  const rows = db
    .prepare(`SELECT * FROM alert_history ${where} ORDER BY delivered_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as AlertHistoryRow[];

  const history = rows.map(parseAlertHistory);
  res.json({ history, total: countRow.total });
});

export default router;
