import type Database from "better-sqlite3";

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
  rule_type: "agent_down" | "error_rate" | "budget";
  config: string; // JSON text stored by SQLite
  enabled: number;
  webhook_url: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
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

// ---------------------------------------------------------------------------
// Prepared-statement SQL
// ---------------------------------------------------------------------------

const SQL_ENABLED_RULES = `SELECT * FROM alert_rules WHERE enabled = 1`;

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

const SQL_BUDGET_TODAY = `
  SELECT COALESCE(SUM(cost_usd), 0) AS total_cost
  FROM agent_events
  WHERE agent_id = ?
    AND event_type IN ('llm_call', 'completion')
    AND timestamp >= ?
`;

const SQL_COOLDOWN_CHECK = `
  SELECT id FROM alert_history
  WHERE alert_rule_id = ? AND delivered_at > datetime('now', '-15 minutes')
  LIMIT 1
`;

const SQL_INSERT_HISTORY = `
  INSERT INTO alert_history (alert_rule_id, agent_id, rule_type, message, delivered_via)
  VALUES (?, ?, ?, ?, ?)
`;

// ---------------------------------------------------------------------------
// Webhook delivery
// ---------------------------------------------------------------------------

async function postWebhook(
  url: string,
  payload: { agent_id: string; rule_type: string; message: string; timestamp: string },
): Promise<void> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(
        `[agentwatch] Webhook POST to ${url} returned ${res.status}`,
      );
    }
  } catch (err) {
    console.error(`[agentwatch] Webhook POST to ${url} failed:`, err);
  }
}

// ---------------------------------------------------------------------------
// Evaluation helpers
// ---------------------------------------------------------------------------

function evaluateAgentDown(
  db: Database.Database,
  rule: AlertRuleRow,
  config: AgentDownConfig,
): string | null {
  const agent = db.prepare(SQL_AGENT_BY_ID).get(rule.agent_id) as
    | { last_heartbeat_at: string | null; name: string | null }
    | undefined;

  if (!agent) {
    // Agent has never been registered -- treat as down.
    return `Agent "${rule.agent_id}" has never sent a heartbeat`;
  }

  if (!agent.last_heartbeat_at) {
    return `Agent "${rule.agent_id}" has no recorded heartbeat`;
  }

  const lastBeat = new Date(agent.last_heartbeat_at + "Z").getTime();
  const threshold = config.duration_minutes * 60 * 1000;
  const now = Date.now();

  if (now - lastBeat > threshold) {
    const minutesAgo = Math.round((now - lastBeat) / 60_000);
    return `Agent "${rule.agent_id}" last heartbeat was ${minutesAgo} minutes ago (threshold: ${config.duration_minutes}m)`;
  }

  return null;
}

function evaluateErrorRate(
  db: Database.Database,
  rule: AlertRuleRow,
  config: ErrorRateConfig,
): string | null {
  const windowStart = new Date(
    Date.now() - config.window_minutes * 60 * 1000,
  ).toISOString();

  const row = db.prepare(SQL_ERROR_RATE).get(rule.agent_id, windowStart) as {
    total: number;
    errors: number;
  };

  if (row.total === 0) {
    return null; // No events in window, nothing to evaluate.
  }

  const rate = (row.errors / row.total) * 100;

  if (rate > config.threshold) {
    return `Agent "${rule.agent_id}" error rate is ${rate.toFixed(1)}% (${row.errors}/${row.total}) over the last ${config.window_minutes}m (threshold: ${config.threshold}%)`;
  }

  return null;
}

function evaluateBudget(
  db: Database.Database,
  rule: AlertRuleRow,
  config: BudgetConfig,
): string | null {
  // UTC midnight today
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const since = todayUTC.toISOString();

  const row = db.prepare(SQL_BUDGET_TODAY).get(rule.agent_id, since) as {
    total_cost: number;
  };

  if (row.total_cost > config.threshold) {
    return `Agent "${rule.agent_id}" daily spend is $${row.total_cost.toFixed(4)} (threshold: $${config.threshold})`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Core tick
// ---------------------------------------------------------------------------

async function tick(db: Database.Database): Promise<void> {
  let rules: AlertRuleRow[];
  try {
    rules = db.prepare(SQL_ENABLED_RULES).all() as AlertRuleRow[];
  } catch (err) {
    console.error("[agentwatch] Failed to query alert rules:", err);
    return;
  }

  for (const rule of rules) {
    try {
      const config = JSON.parse(rule.config);
      let message: string | null = null;

      switch (rule.rule_type) {
        case "agent_down":
          message = evaluateAgentDown(db, rule, config as AgentDownConfig);
          break;
        case "error_rate":
          message = evaluateErrorRate(db, rule, config as ErrorRateConfig);
          break;
        case "budget":
          message = evaluateBudget(db, rule, config as BudgetConfig);
          break;
        default:
          console.warn(
            `[agentwatch] Unknown rule_type "${rule.rule_type}" for rule ${rule.id}`,
          );
          continue;
      }

      if (message === null) {
        continue; // Condition not met; nothing to fire.
      }

      // -- Cooldown check: skip if we already delivered for this rule recently.
      const recent = db.prepare(SQL_COOLDOWN_CHECK).get(rule.id);
      if (recent) {
        continue;
      }

      // -- Fire alert --------------------------------------------------------

      console.log(`[agentwatch] Alert fired: ${message}`);

      const timestamp = new Date().toISOString();

      if (rule.webhook_url) {
        await postWebhook(rule.webhook_url, {
          agent_id: rule.agent_id,
          rule_type: rule.rule_type,
          message,
          timestamp,
        });
      }

      // Record in history
      db.prepare(SQL_INSERT_HISTORY).run(
        rule.id,
        rule.agent_id,
        rule.rule_type,
        message,
        "webhook",
      );
    } catch (err) {
      console.error(
        `[agentwatch] Error evaluating rule ${rule.id} (${rule.rule_type}):`,
        err,
      );
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
    console.error("[agentwatch] Evaluator tick failed:", err),
  );

  const timer = setInterval(() => {
    tick(db).catch((err) =>
      console.error("[agentwatch] Evaluator tick failed:", err),
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
