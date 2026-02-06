import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export interface DbOptions {
  path: string;
}

export function initDatabase(options: DbOptions): Database.Database {
  const db = new Database(options.path);

  // Enable WAL mode for better concurrent read/write performance
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Create tables if they don't exist
  db.exec(SCHEMA);

  // Run migrations for existing databases
  runMigrations(db);

  return db;
}

function runMigrations(db: Database.Database): void {
  // Migration: Add policy columns to agents table
  const agentCols = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[];
  const colNames = agentCols.map((c) => c.name);

  if (!colNames.includes("active")) {
    db.exec("ALTER TABLE agents ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
  }
  if (!colNames.includes("budget_limit")) {
    db.exec("ALTER TABLE agents ADD COLUMN budget_limit REAL");
  }
  if (!colNames.includes("allowed_hours_start")) {
    db.exec("ALTER TABLE agents ADD COLUMN allowed_hours_start INTEGER");
  }
  if (!colNames.includes("allowed_hours_end")) {
    db.exec("ALTER TABLE agents ADD COLUMN allowed_hours_end INTEGER");
  }

  // Migration: Remove deprecated columns from agents table
  if (colNames.includes("status")) {
    db.exec("ALTER TABLE agents DROP COLUMN status");
  }
  if (colNames.includes("last_heartbeat_at")) {
    db.exec("ALTER TABLE agents DROP COLUMN last_heartbeat_at");
  }

  // Migration: Add notification columns to alert_rules table
  const alertCols = db.prepare("PRAGMA table_info(alert_rules)").all() as { name: string }[];
  const alertColNames = alertCols.map((c) => c.name);

  if (!alertColNames.includes("notification_type")) {
    db.exec("ALTER TABLE alert_rules ADD COLUMN notification_type TEXT NOT NULL DEFAULT 'webhook'");
  }
  if (!alertColNames.includes("smtp_config")) {
    db.exec("ALTER TABLE alert_rules ADD COLUMN smtp_config TEXT");
  }
  if (!alertColNames.includes("telegram_config")) {
    db.exec("ALTER TABLE alert_rules ADD COLUMN telegram_config TEXT");
  }

  // Migration: Add requested_model column to agent_events table
  const eventCols = db.prepare("PRAGMA table_info(agent_events)").all() as { name: string }[];
  const eventColNames = eventCols.map((c) => c.name);

  if (!eventColNames.includes("requested_model")) {
    db.exec("ALTER TABLE agent_events ADD COLUMN requested_model TEXT");
  }
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    agent_id TEXT NOT NULL UNIQUE,
    name TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    budget_limit REAL,
    allowed_hours_start INTEGER,
    allowed_hours_end INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON agents(agent_id);

  CREATE TABLE IF NOT EXISTS agent_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    agent_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('llm_call', 'completion', 'heartbeat', 'error', 'custom', 'blocked')),
    provider TEXT,
    model TEXT,
    requested_model TEXT,
    tokens_in INTEGER,
    tokens_out INTEGER,
    tokens_total INTEGER,
    cost_usd REAL,
    latency_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    tags TEXT DEFAULT '{}',
    source TEXT NOT NULL CHECK (source IN ('sdk', 'proxy')),
    timestamp TEXT NOT NULL,
    trace_id TEXT,
    span_id TEXT,
    parent_span_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_agent_events_agent_id ON agent_events(agent_id);
  CREATE INDEX IF NOT EXISTS idx_agent_events_timestamp ON agent_events(timestamp);
  CREATE INDEX IF NOT EXISTS idx_agent_events_type ON agent_events(event_type);
  CREATE INDEX IF NOT EXISTS idx_agent_events_trace ON agent_events(trace_id);

  CREATE TABLE IF NOT EXISTS alert_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    agent_id TEXT NOT NULL,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('agent_down', 'error_rate', 'budget')),
    config TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1,
    notification_type TEXT NOT NULL DEFAULT 'webhook',
    webhook_url TEXT,
    email TEXT,
    smtp_config TEXT,
    telegram_config TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_alert_rules_agent_id ON alert_rules(agent_id);

  CREATE TABLE IF NOT EXISTS alert_history (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    alert_rule_id TEXT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    message TEXT NOT NULL,
    delivered_via TEXT NOT NULL,
    delivered_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(alert_rule_id);

  CREATE TABLE IF NOT EXISTS agent_model_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    agent_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model_override TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(agent_id, provider)
  );

  CREATE INDEX IF NOT EXISTS idx_agent_model_rules_agent ON agent_model_rules(agent_id);

  CREATE TABLE IF NOT EXISTS agent_rate_limits (
    agent_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    max_requests INTEGER NOT NULL,
    window_seconds INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (agent_id, provider)
  );

  CREATE INDEX IF NOT EXISTS idx_agent_rate_limits_agent ON agent_rate_limits(agent_id);
`;

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function upsertAgent(
  db: Database.Database,
  agentId: string,
  _isHeartbeat?: boolean, // kept for API compatibility, no longer used
): void {
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO agents (id, agent_id, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(agent_id) DO UPDATE SET
      updated_at = excluded.updated_at
  `);
  stmt.run(randomUUID(), agentId, now);
}

export interface InsertEventRow {
  agent_id: string;
  event_type: string;
  provider?: string | null;
  model?: string | null;
  requested_model?: string | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  tokens_total?: number | null;
  cost_usd?: number | null;
  latency_ms?: number | null;
  status_code?: number | null;
  error_message?: string | null;
  tags?: Record<string, unknown>;
  source: string;
  timestamp: string;
  trace_id?: string | null;
  span_id?: string | null;
  parent_span_id?: string | null;
}

export function insertEvents(
  db: Database.Database,
  events: InsertEventRow[],
): string[] {
  const stmt = db.prepare(`
    INSERT INTO agent_events (
      id, agent_id, event_type, provider, model, requested_model,
      tokens_in, tokens_out, tokens_total, cost_usd,
      latency_ms, status_code, error_message, tags,
      source, timestamp, trace_id, span_id, parent_span_id
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  const ids: string[] = [];

  const insertAll = db.transaction(() => {
    for (const e of events) {
      const id = randomUUID();
      stmt.run(
        id,
        e.agent_id,
        e.event_type,
        e.provider ?? null,
        e.model ?? null,
        e.requested_model ?? null,
        e.tokens_in ?? null,
        e.tokens_out ?? null,
        e.tokens_total ?? null,
        e.cost_usd ?? null,
        e.latency_ms ?? null,
        e.status_code ?? null,
        e.error_message ?? null,
        JSON.stringify(e.tags ?? {}),
        e.source,
        e.timestamp,
        e.trace_id ?? null,
        e.span_id ?? null,
        e.parent_span_id ?? null,
      );
      ids.push(id);
    }
  });

  insertAll();
  return ids;
}

export interface AgentRow {
  id: string;
  agent_id: string;
  name: string | null;
  active: number;
  budget_limit: number | null;
  created_at: string;
  updated_at: string;
  total_tokens: number;
  total_cost: number;
  today_cost: number;
}

export function getAllAgents(db: Database.Database): AgentRow[] {
  // Get today's UTC midnight for today_cost calculation
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const todayStart = todayUTC.toISOString();

  return db.prepare(`
    SELECT
      a.id, a.agent_id, a.name, a.active, a.budget_limit,
      a.created_at, a.updated_at,
      COALESCE(SUM(e.tokens_total), 0) AS total_tokens,
      COALESCE(SUM(e.cost_usd), 0) AS total_cost,
      COALESCE(SUM(CASE WHEN e.timestamp >= ? THEN e.cost_usd ELSE 0 END), 0) AS today_cost
    FROM agents a
    LEFT JOIN agent_events e ON e.agent_id = a.agent_id
    GROUP BY a.id
    ORDER BY a.updated_at DESC
  `).all(todayStart) as AgentRow[];
}

export function getAgentByAgentId(
  db: Database.Database,
  agentId: string,
): AgentRow | undefined {
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const todayStart = todayUTC.toISOString();

  return db.prepare(`
    SELECT
      a.id, a.agent_id, a.name, a.active, a.budget_limit,
      a.created_at, a.updated_at,
      COALESCE(SUM(e.tokens_total), 0) AS total_tokens,
      COALESCE(SUM(e.cost_usd), 0) AS total_cost,
      COALESCE(SUM(CASE WHEN e.timestamp >= ? THEN e.cost_usd ELSE 0 END), 0) AS today_cost
    FROM agents a
    LEFT JOIN agent_events e ON e.agent_id = a.agent_id
    WHERE a.agent_id = ?
    GROUP BY a.id
  `).get(todayStart, agentId) as AgentRow | undefined;
}

export interface EventQueryOptions {
  agent_id: string;
  from?: string;
  to?: string;
  event_type?: string;
  provider?: string;
  model?: string;
  trace_id?: string;
  search?: string;
  limit?: number;
}

export interface EventRow {
  id: string;
  agent_id: string;
  event_type: string;
  provider: string | null;
  model: string | null;
  requested_model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  tokens_total: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  tags: string;
  source: string;
  timestamp: string;
  trace_id: string | null;
  span_id: string | null;
  parent_span_id: string | null;
  created_at: string;
}

/**
 * Delete events and alert history older than the given number of days.
 * Returns the number of rows deleted from each table.
 */
export function purgeOldData(
  db: Database.Database,
  retentionDays: number,
): { eventsDeleted: number; historyDeleted: number } {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const eventsResult = db.prepare(
    "DELETE FROM agent_events WHERE timestamp < ?",
  ).run(cutoff);

  const historyResult = db.prepare(
    "DELETE FROM alert_history WHERE delivered_at < ?",
  ).run(cutoff);

  return {
    eventsDeleted: eventsResult.changes,
    historyDeleted: historyResult.changes,
  };
}

export function queryEvents(
  db: Database.Database,
  options: EventQueryOptions,
): EventRow[] {
  const conditions: string[] = ["agent_id = ?"];
  const params: unknown[] = [options.agent_id];

  if (options.from) {
    conditions.push("timestamp >= ?");
    params.push(options.from);
  }
  if (options.to) {
    conditions.push("timestamp <= ?");
    params.push(options.to);
  }
  if (options.event_type) {
    conditions.push("event_type = ?");
    params.push(options.event_type);
  }
  if (options.provider) {
    conditions.push("provider = ?");
    params.push(options.provider);
  }
  if (options.model) {
    conditions.push("model = ?");
    params.push(options.model);
  }
  if (options.trace_id) {
    conditions.push("trace_id = ?");
    params.push(options.trace_id);
  }
  if (options.search) {
    conditions.push("(model LIKE ? OR provider LIKE ? OR error_message LIKE ? OR tags LIKE ?)");
    const term = `%${options.search}%`;
    params.push(term, term, term, term);
  }

  const limit = options.limit ?? 1000;
  const sql = `SELECT * FROM agent_events WHERE ${conditions.join(" AND ")} ORDER BY timestamp DESC LIMIT ?`;
  params.push(limit);

  return db.prepare(sql).all(...params) as EventRow[];
}

/**
 * Calculate an agent's total spending for today (server local time).
 */
export function getDailySpend(db: Database.Database, agentId: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfDay = today.toISOString();

  const result = db.prepare(`
    SELECT COALESCE(SUM(cost_usd), 0) as total
    FROM agent_events
    WHERE agent_id = ? AND timestamp >= ? AND cost_usd IS NOT NULL
  `).get(agentId, startOfDay) as { total: number };

  return result.total;
}

// ---------------------------------------------------------------------------
// Agent Policy
// ---------------------------------------------------------------------------

export interface AgentPolicy {
  active: boolean;
  budget_limit: number | null;
  allowed_hours_start: number | null;
  allowed_hours_end: number | null;
}

export function getAgentPolicy(
  db: Database.Database,
  agentId: string,
): AgentPolicy | null {
  const row = db.prepare(`
    SELECT active, budget_limit, allowed_hours_start, allowed_hours_end
    FROM agents WHERE agent_id = ?
  `).get(agentId) as {
    active: number;
    budget_limit: number | null;
    allowed_hours_start: number | null;
    allowed_hours_end: number | null;
  } | undefined;

  if (!row) return null;

  return {
    active: row.active === 1,
    budget_limit: row.budget_limit,
    allowed_hours_start: row.allowed_hours_start,
    allowed_hours_end: row.allowed_hours_end,
  };
}

export function updateAgentPolicy(
  db: Database.Database,
  agentId: string,
  policy: Partial<AgentPolicy>,
): boolean {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (policy.active !== undefined) {
    updates.push("active = ?");
    params.push(policy.active ? 1 : 0);
  }
  if (policy.budget_limit !== undefined) {
    updates.push("budget_limit = ?");
    params.push(policy.budget_limit);
  }
  if (policy.allowed_hours_start !== undefined) {
    updates.push("allowed_hours_start = ?");
    params.push(policy.allowed_hours_start);
  }
  if (policy.allowed_hours_end !== undefined) {
    updates.push("allowed_hours_end = ?");
    params.push(policy.allowed_hours_end);
  }

  if (updates.length === 0) return false;

  updates.push("updated_at = ?");
  params.push(new Date().toISOString());
  params.push(agentId);

  const result = db.prepare(`
    UPDATE agents SET ${updates.join(", ")} WHERE agent_id = ?
  `).run(...params);

  return result.changes > 0;
}

// ---------------------------------------------------------------------------
// Model Override Rules
// ---------------------------------------------------------------------------

export interface ModelRuleRow {
  id: string;
  agent_id: string;
  provider: string;
  model_override: string | null;
  created_at: string;
  updated_at: string;
}

export function getModelRulesForAgent(
  db: Database.Database,
  agentId: string,
): ModelRuleRow[] {
  return db.prepare(`
    SELECT * FROM agent_model_rules WHERE agent_id = ? ORDER BY provider
  `).all(agentId) as ModelRuleRow[];
}

export function getModelRule(
  db: Database.Database,
  agentId: string,
  provider: string,
): ModelRuleRow | undefined {
  return db.prepare(`
    SELECT * FROM agent_model_rules WHERE agent_id = ? AND provider = ?
  `).get(agentId, provider) as ModelRuleRow | undefined;
}

export function upsertModelRule(
  db: Database.Database,
  agentId: string,
  provider: string,
  modelOverride: string | null,
): ModelRuleRow {
  const now = new Date().toISOString();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO agent_model_rules (id, agent_id, provider, model_override, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent_id, provider) DO UPDATE SET
      model_override = excluded.model_override,
      updated_at = excluded.updated_at
  `).run(id, agentId, provider, modelOverride, now, now);

  return getModelRule(db, agentId, provider)!;
}

export function deleteModelRule(
  db: Database.Database,
  agentId: string,
  provider: string,
): boolean {
  const result = db.prepare(`
    DELETE FROM agent_model_rules WHERE agent_id = ? AND provider = ?
  `).run(agentId, provider);

  return result.changes > 0;
}

export function getAgentProviders(
  db: Database.Database,
  agentId: string,
): string[] {
  const rows = db.prepare(`
    SELECT DISTINCT provider FROM agent_events
    WHERE agent_id = ? AND provider IS NOT NULL
    ORDER BY provider
  `).all(agentId) as { provider: string }[];

  return rows.map(r => r.provider);
}

// ---------------------------------------------------------------------------
// Rate Limits
// ---------------------------------------------------------------------------

export interface RateLimitRow {
  agent_id: string;
  provider: string;
  max_requests: number;
  window_seconds: number;
  updated_at: string;
}

export function getRateLimitsForAgent(
  db: Database.Database,
  agentId: string,
): RateLimitRow[] {
  return db.prepare(`
    SELECT * FROM agent_rate_limits WHERE agent_id = ? ORDER BY provider
  `).all(agentId) as RateLimitRow[];
}

export function getAllRateLimits(db: Database.Database): RateLimitRow[] {
  return db.prepare(`
    SELECT * FROM agent_rate_limits ORDER BY agent_id, provider
  `).all() as RateLimitRow[];
}

export function getRateLimit(
  db: Database.Database,
  agentId: string,
  provider: string,
): RateLimitRow | undefined {
  return db.prepare(`
    SELECT * FROM agent_rate_limits WHERE agent_id = ? AND provider = ?
  `).get(agentId, provider) as RateLimitRow | undefined;
}

export function setRateLimit(
  db: Database.Database,
  agentId: string,
  provider: string,
  maxRequests: number,
  windowSeconds: number,
): RateLimitRow {
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO agent_rate_limits (agent_id, provider, max_requests, window_seconds, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(agent_id, provider) DO UPDATE SET
      max_requests = excluded.max_requests,
      window_seconds = excluded.window_seconds,
      updated_at = excluded.updated_at
  `).run(agentId, provider, maxRequests, windowSeconds, now);

  return getRateLimit(db, agentId, provider)!;
}

export function deleteRateLimit(
  db: Database.Database,
  agentId: string,
  provider: string,
): boolean {
  const result = db.prepare(`
    DELETE FROM agent_rate_limits WHERE agent_id = ? AND provider = ?
  `).run(agentId, provider);

  return result.changes > 0;
}
