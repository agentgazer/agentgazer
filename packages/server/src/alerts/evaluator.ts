import type Database from "better-sqlite3";
import nodemailer from "nodemailer";
import { createLogger } from "@agentgazer/shared";
import { isAllowed, recordSuccess, recordFailure, getState } from "./circuit-breaker.js";

const log = createLogger("evaluator");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvaluatorOptions {
  db: Database.Database;
  interval?: number; // ms, default 60_000
}

interface AlertRuleRow {
  id: string;
  agent_id: string;
  rule_type: "agent_down" | "error_rate" | "budget" | "kill_switch";
  config: string; // JSON text stored by SQLite
  enabled: number;
  notification_type: string;
  webhook_url: string | null;
  email: string | null;
  smtp_config: string | null;
  telegram_config: string | null;
  repeat_enabled: number;
  repeat_interval_minutes: number;
  recovery_notify: number;
  state: "normal" | "alerting" | "fired";
  last_triggered_at: string | null;
  budget_period: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentRow {
  agent_id: string;
  status: string;
  updated_at: string | null;
  name: string | null;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
}

interface TelegramConfig {
  bot_token: string;
  chat_id: string;
  message_template: string;
}

interface AgentDownConfig {
  duration_minutes: number;
}

interface ErrorRateConfig {
  window_minutes: number;
  threshold: number; // percentage, e.g. 10 means 10%
}

interface BudgetConfig {
  threshold: number; // USD
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface KillSwitchConfig {
  // No config needed - triggers on any kill_switch event
}

export interface KillSwitchEventData {
  agent_id: string;
  score: number;
  window_size: number;
  threshold: number;
  details: {
    similarPrompts: number;
    similarResponses: number;
    repeatedToolCalls: number;
  };
}

// ---------------------------------------------------------------------------
// Prepared-statement SQL
// ---------------------------------------------------------------------------

const SQL_ENABLED_RULES = `SELECT * FROM alert_rules WHERE enabled = 1`;

const SQL_KILL_SWITCH_RULES = `SELECT * FROM alert_rules WHERE enabled = 1 AND rule_type = 'kill_switch' AND agent_id = ?`;

const SQL_AGENT_BY_ID = `SELECT * FROM agents WHERE agent_id = ?`;

const SQL_ERROR_RATE = `
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors
  FROM agent_events
  WHERE agent_id = ?
    AND event_type IN ('llm_call', 'completion')
    AND timestamp >= ?
`;

const SQL_BUDGET_SPEND = `
  SELECT COALESCE(SUM(cost_usd), 0) AS total_cost
  FROM agent_events
  WHERE agent_id = ?
    AND event_type IN ('llm_call', 'completion')
    AND timestamp >= ?
`;

const SQL_UPDATE_RULE_STATE = `
  UPDATE alert_rules SET state = ?, last_triggered_at = ?, updated_at = datetime('now') WHERE id = ?
`;

const SQL_INSERT_HISTORY = `
  INSERT INTO alert_history (alert_rule_id, agent_id, rule_type, message, delivered_via)
  VALUES (?, ?, ?, ?, ?)
`;

// ---------------------------------------------------------------------------
// Webhook delivery (with circuit breaker)
// ---------------------------------------------------------------------------

function postWebhook(
  url: string,
  payload: { agent_id: string; rule_type: string; message: string; timestamp: string },
): void {
  // Check circuit breaker before attempting
  if (!isAllowed(url)) {
    log.warn("Webhook skipped - circuit open", { url, state: getState(url) });
    return;
  }
  // Fire initial attempt, then retry in the background without blocking.
  void postWebhookWithRetry(url, payload);
}

async function postWebhookWithRetry(
  url: string,
  payload: { agent_id: string; rule_type: string; message: string; timestamp: string },
): Promise<void> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        recordSuccess(url);
        return;
      }
      log.error(`Webhook POST returned ${res.status}`, { url, attempt: attempt + 1, maxAttempts: MAX_RETRIES + 1 });
    } catch (err) {
      log.error(`Webhook POST failed`, { url, attempt: attempt + 1, maxAttempts: MAX_RETRIES + 1, err: String(err) });
    }
    if (attempt < MAX_RETRIES) {
      const delayMs = Math.pow(4, attempt) * 1000; // 1s, 4s, 16s
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  // All retries exhausted - record failure for circuit breaker
  recordFailure(url);
}

// ---------------------------------------------------------------------------
// Email delivery
// ---------------------------------------------------------------------------

function getSmtpTransport(smtpConfig?: SmtpConfig | null): nodemailer.Transporter | null {
  // Use per-rule SMTP config if provided
  if (smtpConfig && smtpConfig.host) {
    return nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port || 587,
      secure: smtpConfig.secure || false,
      ...(smtpConfig.user && smtpConfig.pass ? { auth: { user: smtpConfig.user, pass: smtpConfig.pass } } : {}),
    });
  }

  // Fall back to environment variables
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user && pass ? { auth: { user, pass } } : {}),
  });
}

async function sendEmail(
  payload: { agent_id: string; rule_type: string; message: string; timestamp: string },
  smtpConfig?: SmtpConfig | null,
  legacyTo?: string | null,
): Promise<void> {
  const transport = getSmtpTransport(smtpConfig);
  if (!transport) {
    log.warn("Email alert skipped: SMTP not configured");
    return;
  }

  const from = smtpConfig?.from ?? process.env.SMTP_FROM ?? "alerts@agentgazer.com";
  const to = smtpConfig?.to ?? legacyTo;
  if (!to) {
    log.warn("Email alert skipped: no recipient configured");
    return;
  }

  const ruleLabel = payload.rule_type.replace(/_/g, " ");
  const subject = `[AgentGazer] ${ruleLabel} alert: ${payload.agent_id}`;
  const text = [
    `Alert: ${ruleLabel}`,
    `Agent: ${payload.agent_id}`,
    `Time: ${payload.timestamp}`,
    ``,
    payload.message,
  ].join("\n");

  try {
    await transport.sendMail({ from, to, subject, text });
  } catch (err) {
    log.error(`Email delivery failed`, { to, err: String(err) });
  }
}

// ---------------------------------------------------------------------------
// Telegram delivery
// ---------------------------------------------------------------------------

async function sendTelegram(
  payload: { agent_id: string; rule_type: string; message: string; timestamp: string },
  telegramConfig: TelegramConfig,
): Promise<void> {
  const { bot_token, chat_id, message_template } = telegramConfig;

  if (!bot_token || !chat_id) {
    log.warn("Telegram alert skipped: missing bot_token or chat_id");
    return;
  }

  // Use template or default message
  const template = message_template || "[From AgentGazer] Alert: {rule_type} - Agent: {agent_id} - {message}";
  const text = template
    .replace(/{agent_id}/g, payload.agent_id)
    .replace(/{rule_type}/g, payload.rule_type.replace(/_/g, " "))
    .replace(/{message}/g, payload.message)
    .replace(/{timestamp}/g, payload.timestamp);

  const url = `https://api.telegram.org/bot${bot_token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id,
        text,
        parse_mode: "HTML",
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text();
      log.error(`Telegram API returned ${res.status}`, { chat_id, body });
    }
  } catch (err) {
    log.error(`Telegram delivery failed`, { chat_id, err: String(err) });
  }
}

// ---------------------------------------------------------------------------
// Notification delivery helper
// ---------------------------------------------------------------------------

async function deliverNotification(
  db: Database.Database,
  rule: AlertRuleRow,
  message: string,
  isRecovery: boolean = false,
): Promise<void> {
  const timestamp = new Date().toISOString();
  const ruleType = isRecovery ? `${rule.rule_type}_recovery` : rule.rule_type;
  const payload = {
    agent_id: rule.agent_id,
    rule_type: ruleType,
    message,
    timestamp,
  };

  const notificationType = rule.notification_type || "webhook";

  if (notificationType === "webhook" && rule.webhook_url) {
    postWebhook(rule.webhook_url, payload);
    db.prepare(SQL_INSERT_HISTORY).run(
      rule.id,
      rule.agent_id,
      ruleType,
      message,
      "webhook",
    );
  } else if (notificationType === "email") {
    try {
      let smtpConfig: SmtpConfig | null = null;
      if (rule.smtp_config) {
        try { smtpConfig = JSON.parse(rule.smtp_config); } catch { /* ignore */ }
      }
      await sendEmail(payload, smtpConfig, rule.email);
      db.prepare(SQL_INSERT_HISTORY).run(
        rule.id,
        rule.agent_id,
        ruleType,
        message,
        "email",
      );
    } catch (emailErr) {
      log.error("Email delivery failed, history not recorded", { ruleId: rule.id, err: String(emailErr) });
    }
  } else if (notificationType === "telegram") {
    try {
      let telegramConfig: TelegramConfig | null = null;
      if (rule.telegram_config) {
        try { telegramConfig = JSON.parse(rule.telegram_config); } catch { /* ignore */ }
      }
      if (telegramConfig) {
        await sendTelegram(payload, telegramConfig);
        db.prepare(SQL_INSERT_HISTORY).run(
          rule.id,
          rule.agent_id,
          ruleType,
          message,
          "telegram",
        );
      } else {
        log.warn("Telegram alert skipped: no telegram_config", { ruleId: rule.id });
      }
    } catch (tgErr) {
      log.error("Telegram delivery failed, history not recorded", { ruleId: rule.id, err: String(tgErr) });
    }
  }
}

// ---------------------------------------------------------------------------
// Budget period helpers
// ---------------------------------------------------------------------------

function getBudgetPeriodStart(period: string | null): string {
  const now = new Date();

  switch (period) {
    case "weekly": {
      // Start of current week (Sunday)
      const day = now.getUTCDay();
      const diff = now.getUTCDate() - day;
      const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff, 0, 0, 0, 0));
      return weekStart.toISOString();
    }
    case "monthly": {
      // Start of current month
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      return monthStart.toISOString();
    }
    case "daily":
    default: {
      // Start of today (UTC midnight)
      const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      return todayStart.toISOString();
    }
  }
}

// ---------------------------------------------------------------------------
// Evaluation helpers (with recovery detection)
// ---------------------------------------------------------------------------

interface EvaluationResult {
  conditionMet: boolean;
  message: string | null;
  recoveryMessage: string | null;
}

function evaluateAgentDown(
  db: Database.Database,
  rule: AlertRuleRow,
  config: AgentDownConfig,
): EvaluationResult {
  const agent = db.prepare(SQL_AGENT_BY_ID).get(rule.agent_id) as AgentRow | undefined;

  if (!agent) {
    return {
      conditionMet: true,
      message: `Agent "${rule.agent_id}" has never been registered`,
      recoveryMessage: null,
    };
  }

  if (!agent.updated_at) {
    return {
      conditionMet: true,
      message: `Agent "${rule.agent_id}" has no recorded activity`,
      recoveryMessage: null,
    };
  }

  const lastActivity = new Date(
    agent.updated_at.endsWith("Z") || agent.updated_at.includes("+")
      ? agent.updated_at
      : agent.updated_at + "Z",
  ).getTime();
  const threshold = config.duration_minutes * 60 * 1000;
  const now = Date.now();

  if (now - lastActivity > threshold) {
    const minutesAgo = Math.round((now - lastActivity) / 60_000);
    return {
      conditionMet: true,
      message: `Agent "${rule.agent_id}" has been inactive for ${minutesAgo} minutes (threshold: ${config.duration_minutes}m)`,
      recoveryMessage: null,
    };
  }

  // Agent is active - this is a recovery
  return {
    conditionMet: false,
    message: null,
    recoveryMessage: `Agent "${rule.agent_id}" is back online`,
  };
}

function evaluateErrorRate(
  db: Database.Database,
  rule: AlertRuleRow,
  config: ErrorRateConfig,
): EvaluationResult {
  const windowStart = new Date(
    Date.now() - config.window_minutes * 60 * 1000,
  ).toISOString();

  const row = db.prepare(SQL_ERROR_RATE).get(rule.agent_id, windowStart) as {
    total: number;
    errors: number;
  };

  if (row.total === 0) {
    // No events in window - if we were alerting, consider it recovered
    return {
      conditionMet: false,
      message: null,
      recoveryMessage: rule.state !== "normal" ? `Agent "${rule.agent_id}" error rate returned to normal (no events)` : null,
    };
  }

  const rate = (row.errors / row.total) * 100;

  if (rate > config.threshold) {
    return {
      conditionMet: true,
      message: `Agent "${rule.agent_id}" error rate is ${rate.toFixed(1)}% (${row.errors}/${row.total}) over the last ${config.window_minutes}m (threshold: ${config.threshold}%)`,
      recoveryMessage: null,
    };
  }

  // Error rate is within threshold - recovery
  return {
    conditionMet: false,
    message: null,
    recoveryMessage: `Agent "${rule.agent_id}" error rate returned to normal (${rate.toFixed(1)}%)`,
  };
}

function evaluateBudget(
  db: Database.Database,
  rule: AlertRuleRow,
  config: BudgetConfig,
): EvaluationResult {
  const since = getBudgetPeriodStart(rule.budget_period);

  const row = db.prepare(SQL_BUDGET_SPEND).get(rule.agent_id, since) as {
    total_cost: number;
  };

  const periodLabel = rule.budget_period || "daily";

  if (row.total_cost > config.threshold) {
    return {
      conditionMet: true,
      message: `Agent "${rule.agent_id}" ${periodLabel} spend is $${row.total_cost.toFixed(4)} (threshold: $${config.threshold})`,
      recoveryMessage: null,
    };
  }

  // Under budget - recovery (new period started or reset)
  return {
    conditionMet: false,
    message: null,
    recoveryMessage: `Agent "${rule.agent_id}" budget reset for new ${periodLabel} period`,
  };
}

// ---------------------------------------------------------------------------
// Core tick
// ---------------------------------------------------------------------------

async function tick(db: Database.Database): Promise<void> {
  let rules: AlertRuleRow[];
  try {
    rules = db.prepare(SQL_ENABLED_RULES).all() as AlertRuleRow[];
  } catch (err) {
    log.error("Failed to query alert rules", { err: String(err) });
    return;
  }

  for (const rule of rules) {
    try {
      // Skip kill_switch - handled separately via fireKillSwitchAlert()
      if (rule.rule_type === "kill_switch") {
        continue;
      }

      // Check if agent is inactive - skip evaluation
      const agent = db.prepare(SQL_AGENT_BY_ID).get(rule.agent_id) as AgentRow | undefined;
      if (agent && agent.status === "inactive") {
        log.debug("Skipping alert evaluation for inactive agent", { ruleId: rule.id, agentId: rule.agent_id });
        continue;
      }

      const config = JSON.parse(rule.config);
      let result: EvaluationResult;

      switch (rule.rule_type) {
        case "agent_down":
          result = evaluateAgentDown(db, rule, config as AgentDownConfig);
          break;
        case "error_rate":
          result = evaluateErrorRate(db, rule, config as ErrorRateConfig);
          break;
        case "budget":
          result = evaluateBudget(db, rule, config as BudgetConfig);
          break;
        default:
          log.warn(`Unknown rule_type "${rule.rule_type}"`, { ruleId: rule.id });
          continue;
      }

      const currentState = rule.state || "normal";
      const now = new Date().toISOString();

      if (result.conditionMet && result.message) {
        // Condition is met
        if (currentState === "normal") {
          // First trigger - send notification and update state
          log.info(`Alert fired: ${result.message}`, { ruleId: rule.id, ruleType: rule.rule_type, agentId: rule.agent_id });
          await deliverNotification(db, rule, result.message);

          const newState = rule.repeat_enabled ? "alerting" : "fired";
          db.prepare(SQL_UPDATE_RULE_STATE).run(newState, now, rule.id);

        } else if (currentState === "alerting" && rule.repeat_enabled) {
          // Check if repeat interval has passed
          const lastTriggered = rule.last_triggered_at ? new Date(rule.last_triggered_at).getTime() : 0;
          const intervalMs = rule.repeat_interval_minutes * 60 * 1000;

          if (Date.now() - lastTriggered >= intervalMs) {
            log.info(`Alert repeat: ${result.message}`, { ruleId: rule.id, ruleType: rule.rule_type, agentId: rule.agent_id });
            await deliverNotification(db, rule, result.message);
            db.prepare(SQL_UPDATE_RULE_STATE).run("alerting", now, rule.id);
          }
        }
        // If state is "fired" (one-time), do nothing until recovery

      } else if (!result.conditionMet && (currentState === "alerting" || currentState === "fired")) {
        // Condition recovered
        log.info(`Alert recovered`, { ruleId: rule.id, ruleType: rule.rule_type, agentId: rule.agent_id });

        // Send recovery notification if enabled
        if (rule.recovery_notify && result.recoveryMessage) {
          await deliverNotification(db, rule, result.recoveryMessage, true);
        }

        // Reset state to normal
        db.prepare(SQL_UPDATE_RULE_STATE).run("normal", null, rule.id);
      }

    } catch (err) {
      log.error(`Error evaluating rule`, { ruleId: rule.id, ruleType: rule.rule_type, err: String(err) });
    }
  }
}

// ---------------------------------------------------------------------------
// Kill Switch Alert Handler
// ---------------------------------------------------------------------------

/**
 * Fire kill_switch alerts for an agent.
 * Called immediately when a kill_switch event is triggered by the proxy.
 */
export async function fireKillSwitchAlert(
  db: Database.Database,
  data: KillSwitchEventData,
): Promise<void> {
  const rules = db.prepare(SQL_KILL_SWITCH_RULES).all(data.agent_id) as AlertRuleRow[];

  if (rules.length === 0) {
    log.debug("No kill_switch alert rules for agent", { agentId: data.agent_id });
    return;
  }

  const message = [
    `Kill switch triggered for agent "${data.agent_id}"`,
    `Loop score: ${data.score.toFixed(1)} (threshold: ${data.threshold})`,
    `Details: ${data.details.similarPrompts} similar prompts, ${data.details.similarResponses} similar responses, ${data.details.repeatedToolCalls} repeated tool calls`,
    `Window size: ${data.window_size}`,
  ].join("\n");

  const now = new Date().toISOString();

  for (const rule of rules) {
    try {
      const currentState = rule.state || "normal";

      // Check if we should send based on state and repeat settings
      if (currentState === "fired" && !rule.repeat_enabled) {
        log.debug("Kill switch alert skipped (already fired, one-time)", { ruleId: rule.id });
        continue;
      }

      if (currentState === "alerting" && rule.repeat_enabled) {
        // Check repeat interval
        const lastTriggered = rule.last_triggered_at ? new Date(rule.last_triggered_at).getTime() : 0;
        const intervalMs = rule.repeat_interval_minutes * 60 * 1000;

        if (Date.now() - lastTriggered < intervalMs) {
          log.debug("Kill switch alert skipped due to repeat interval", { ruleId: rule.id });
          continue;
        }
      }

      log.info(`Kill switch alert fired`, { ruleId: rule.id, agentId: data.agent_id, score: data.score });

      await deliverNotification(db, rule, message);

      const newState = rule.repeat_enabled ? "alerting" : "fired";
      db.prepare(SQL_UPDATE_RULE_STATE).run(newState, now, rule.id);

    } catch (err) {
      log.error("Error firing kill_switch alert", { ruleId: rule.id, err: String(err) });
    }
  }
}

/**
 * Reset kill_switch alert state when agent is reactivated.
 * Called when agent status changes from inactive to active.
 */
export function resetKillSwitchAlerts(db: Database.Database, agentId: string): void {
  const rules = db.prepare(SQL_KILL_SWITCH_RULES).all(agentId) as AlertRuleRow[];

  for (const rule of rules) {
    if (rule.state !== "normal") {
      log.info("Resetting kill_switch alert state", { ruleId: rule.id, agentId });

      if (rule.recovery_notify) {
        const message = `Agent "${agentId}" has been reactivated`;
        void deliverNotification(db, rule, message, true);
      }

      db.prepare(SQL_UPDATE_RULE_STATE).run("normal", null, rule.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startEvaluator(options: EvaluatorOptions): { stop: () => void } {
  const intervalMs = options.interval ?? 60_000;
  const { db } = options;

  // Run the first evaluation immediately (fire-and-forget).
  tick(db).catch((err) =>
    log.error("Evaluator tick failed", { err: String(err) }),
  );

  const timer = setInterval(() => {
    tick(db).catch((err) =>
      log.error("Evaluator tick failed", { err: String(err) }),
    );
  }, intervalMs);

  // Allow Node.js to exit naturally even if the timer is still pending.
  timer.unref();

  return {
    stop() {
      clearInterval(timer);
    },
  };
}
