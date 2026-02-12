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

  // Migration: Add repeat/recovery columns to alert_rules table
  if (!alertColNames.includes("repeat_enabled")) {
    db.exec("ALTER TABLE alert_rules ADD COLUMN repeat_enabled INTEGER NOT NULL DEFAULT 1");
  }
  if (!alertColNames.includes("repeat_interval_minutes")) {
    db.exec("ALTER TABLE alert_rules ADD COLUMN repeat_interval_minutes INTEGER NOT NULL DEFAULT 15");
  }
  if (!alertColNames.includes("recovery_notify")) {
    db.exec("ALTER TABLE alert_rules ADD COLUMN recovery_notify INTEGER NOT NULL DEFAULT 0");
  }
  if (!alertColNames.includes("state")) {
    db.exec("ALTER TABLE alert_rules ADD COLUMN state TEXT NOT NULL DEFAULT 'normal'");
  }
  if (!alertColNames.includes("last_triggered_at")) {
    db.exec("ALTER TABLE alert_rules ADD COLUMN last_triggered_at TEXT");
  }
  if (!alertColNames.includes("budget_period")) {
    db.exec("ALTER TABLE alert_rules ADD COLUMN budget_period TEXT");
  }

  // Migration: Add requested_model and ttft_ms columns to agent_events table
  const eventCols = db.prepare("PRAGMA table_info(agent_events)").all() as { name: string }[];
  const eventColNames = eventCols.map((c) => c.name);

  if (!eventColNames.includes("requested_model")) {
    db.exec("ALTER TABLE agent_events ADD COLUMN requested_model TEXT");
  }
  if (!eventColNames.includes("ttft_ms")) {
    db.exec("ALTER TABLE agent_events ADD COLUMN ttft_ms INTEGER");
  }

  // Migration: Add kill_switch columns to agents table
  if (!colNames.includes("kill_switch_enabled")) {
    db.exec("ALTER TABLE agents ADD COLUMN kill_switch_enabled INTEGER NOT NULL DEFAULT 0");
  }
  if (!colNames.includes("kill_switch_window_size")) {
    db.exec("ALTER TABLE agents ADD COLUMN kill_switch_window_size INTEGER NOT NULL DEFAULT 20");
  }
  if (!colNames.includes("kill_switch_threshold")) {
    db.exec("ALTER TABLE agents ADD COLUMN kill_switch_threshold REAL NOT NULL DEFAULT 10.0");
  }

  // Migration: Add deactivated_by column to agents table
  if (!colNames.includes("deactivated_by")) {
    db.exec("ALTER TABLE agents ADD COLUMN deactivated_by TEXT");
  }

  // Migration: Add target_provider column to agent_model_rules table
  const modelRuleCols = db.prepare("PRAGMA table_info(agent_model_rules)").all() as { name: string }[];
  const modelRuleColNames = modelRuleCols.map((c) => c.name);
  if (!modelRuleColNames.includes("target_provider")) {
    db.exec("ALTER TABLE agent_model_rules ADD COLUMN target_provider TEXT");
  }
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    agent_id TEXT NOT NULL UNIQUE,
    name TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    deactivated_by TEXT,
    budget_limit REAL,
    allowed_hours_start INTEGER,
    allowed_hours_end INTEGER,
    kill_switch_enabled INTEGER NOT NULL DEFAULT 0,
    kill_switch_window_size INTEGER NOT NULL DEFAULT 20,
    kill_switch_threshold REAL NOT NULL DEFAULT 10.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON agents(agent_id);

  CREATE TABLE IF NOT EXISTS agent_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    agent_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('llm_call', 'completion', 'heartbeat', 'error', 'custom', 'blocked', 'kill_switch')),
    provider TEXT,
    model TEXT,
    requested_model TEXT,
    tokens_in INTEGER,
    tokens_out INTEGER,
    tokens_total INTEGER,
    cost_usd REAL,
    latency_ms INTEGER,
    ttft_ms INTEGER,
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
    rule_type TEXT NOT NULL CHECK (rule_type IN ('agent_down', 'error_rate', 'budget', 'kill_switch')),
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
    target_provider TEXT,
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

  -- Custom models added by user per provider
  CREATE TABLE IF NOT EXISTS provider_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    model_id TEXT NOT NULL,
    display_name TEXT,
    verified_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(provider, model_id)
  );

  CREATE INDEX IF NOT EXISTS idx_provider_models_provider ON provider_models(provider);

  -- Provider-level settings (active toggle, rate limit)
  CREATE TABLE IF NOT EXISTS provider_settings (
    provider TEXT PRIMARY KEY,
    active INTEGER DEFAULT 1,
    rate_limit_max_requests INTEGER,
    rate_limit_window_seconds INTEGER,
    updated_at TEXT DEFAULT (datetime('now'))
  );
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
  id?: string;  // Optional: use provided ID or generate new one
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
  ttft_ms?: number | null;
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
      latency_ms, ttft_ms, status_code, error_message, tags,
      source, timestamp, trace_id, span_id, parent_span_id
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  const ids: string[] = [];

  const insertAll = db.transaction(() => {
    for (const e of events) {
      const id = e.id ?? randomUUID();
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
        e.ttft_ms ?? null,
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
  deactivated_by: string | null;
  budget_limit: number | null;
  kill_switch_enabled: number;
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
      a.id, a.agent_id, a.name, a.active, a.deactivated_by, a.budget_limit, a.kill_switch_enabled,
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
      a.id, a.agent_id, a.name, a.active, a.deactivated_by, a.budget_limit, a.kill_switch_enabled,
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
  agent_id?: string;  // Optional - if not provided, queries all agents
  from?: string;
  to?: string;
  event_type?: string;
  provider?: string;
  model?: string;
  trace_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
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

export interface EventQueryResult {
  events: EventRow[];
  total: number;
}

export function queryEvents(
  db: Database.Database,
  options: EventQueryOptions,
): EventQueryResult {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.agent_id) {
    conditions.push("agent_id = ?");
    params.push(options.agent_id);
  }
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

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Get total count
  const countSql = `SELECT COUNT(*) as total FROM agent_events ${whereClause}`;
  const countResult = db.prepare(countSql).get(...params) as { total: number };

  // Get paginated results
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const sql = `SELECT * FROM agent_events ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
  const events = db.prepare(sql).all(...params, limit, offset) as EventRow[];

  return { events, total: countResult.total };
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
  deactivated_by: string | null;
  budget_limit: number | null;
  allowed_hours_start: number | null;
  allowed_hours_end: number | null;
  kill_switch_enabled: number;
  kill_switch_window_size: number;
  kill_switch_threshold: number;
}

export function getAgentPolicy(
  db: Database.Database,
  agentId: string,
): AgentPolicy | null {
  const row = db.prepare(`
    SELECT active, deactivated_by, budget_limit, allowed_hours_start, allowed_hours_end,
           kill_switch_enabled, kill_switch_window_size, kill_switch_threshold
    FROM agents WHERE agent_id = ?
  `).get(agentId) as {
    active: number;
    deactivated_by: string | null;
    budget_limit: number | null;
    allowed_hours_start: number | null;
    allowed_hours_end: number | null;
    kill_switch_enabled: number;
    kill_switch_window_size: number;
    kill_switch_threshold: number;
  } | undefined;

  if (!row) return null;

  return {
    active: row.active === 1,
    deactivated_by: row.deactivated_by,
    budget_limit: row.budget_limit,
    allowed_hours_start: row.allowed_hours_start,
    allowed_hours_end: row.allowed_hours_end,
    kill_switch_enabled: row.kill_switch_enabled,
    kill_switch_window_size: row.kill_switch_window_size,
    kill_switch_threshold: row.kill_switch_threshold,
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
  if ("deactivated_by" in policy) {
    updates.push("deactivated_by = ?");
    params.push(policy.deactivated_by);
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
  if (policy.kill_switch_enabled !== undefined) {
    updates.push("kill_switch_enabled = ?");
    params.push(policy.kill_switch_enabled);
  }
  if (policy.kill_switch_window_size !== undefined) {
    updates.push("kill_switch_window_size = ?");
    params.push(policy.kill_switch_window_size);
  }
  if (policy.kill_switch_threshold !== undefined) {
    updates.push("kill_switch_threshold = ?");
    params.push(policy.kill_switch_threshold);
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
  target_provider: string | null;
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
  targetProvider: string | null = null,
): ModelRuleRow {
  const now = new Date().toISOString();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO agent_model_rules (id, agent_id, provider, model_override, target_provider, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent_id, provider) DO UPDATE SET
      model_override = excluded.model_override,
      target_provider = excluded.target_provider,
      updated_at = excluded.updated_at
  `).run(id, agentId, provider, modelOverride, targetProvider, now, now);

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

// Get the most commonly used model for each provider by an agent
export function getAgentDefaultModels(
  db: Database.Database,
  agentId: string,
): Record<string, string> {
  const rows = db.prepare(`
    SELECT provider, model, COUNT(*) as cnt
    FROM agent_events
    WHERE agent_id = ? AND provider IS NOT NULL AND model IS NOT NULL
    GROUP BY provider, model
    ORDER BY provider, cnt DESC
  `).all(agentId) as { provider: string; model: string; cnt: number }[];

  // For each provider, take the most used model (first in the sorted list)
  const result: Record<string, string> = {};
  for (const row of rows) {
    if (!(row.provider in result)) {
      result[row.provider] = row.model;
    }
  }
  return result;
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

// ---------------------------------------------------------------------------
// Provider Models
// ---------------------------------------------------------------------------

export interface ProviderModelRow {
  id: number;
  provider: string;
  model_id: string;
  display_name: string | null;
  verified_at: string | null;
  created_at: string;
}

export function getProviderModels(
  db: Database.Database,
  provider: string,
): ProviderModelRow[] {
  return db.prepare(`
    SELECT * FROM provider_models WHERE provider = ? ORDER BY model_id
  `).all(provider) as ProviderModelRow[];
}

export function addProviderModel(
  db: Database.Database,
  provider: string,
  modelId: string,
  displayName?: string,
  verifiedAt?: string,
): ProviderModelRow {
  db.prepare(`
    INSERT INTO provider_models (provider, model_id, display_name, verified_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(provider, model_id) DO UPDATE SET
      display_name = COALESCE(excluded.display_name, display_name),
      verified_at = COALESCE(excluded.verified_at, verified_at)
  `).run(provider, modelId, displayName ?? null, verifiedAt ?? null);

  return db.prepare(`
    SELECT * FROM provider_models WHERE provider = ? AND model_id = ?
  `).get(provider, modelId) as ProviderModelRow;
}

export function deleteProviderModel(
  db: Database.Database,
  provider: string,
  modelId: string,
): boolean {
  const result = db.prepare(`
    DELETE FROM provider_models WHERE provider = ? AND model_id = ?
  `).run(provider, modelId);

  return result.changes > 0;
}

// ---------------------------------------------------------------------------
// Provider Settings
// ---------------------------------------------------------------------------

export interface ProviderSettingsRow {
  provider: string;
  active: number;
  rate_limit_max_requests: number | null;
  rate_limit_window_seconds: number | null;
  updated_at: string;
}

export function getProviderSettings(
  db: Database.Database,
  provider: string,
): ProviderSettingsRow | undefined {
  return db.prepare(`
    SELECT * FROM provider_settings WHERE provider = ?
  `).get(provider) as ProviderSettingsRow | undefined;
}

export function getAllProviderSettings(
  db: Database.Database,
): ProviderSettingsRow[] {
  return db.prepare(`
    SELECT * FROM provider_settings ORDER BY provider
  `).all() as ProviderSettingsRow[];
}

export function upsertProviderSettings(
  db: Database.Database,
  provider: string,
  settings: {
    active?: boolean;
    rate_limit_max_requests?: number | null;
    rate_limit_window_seconds?: number | null;
  },
): ProviderSettingsRow {
  const now = new Date().toISOString();
  const existing = getProviderSettings(db, provider);

  const active = settings.active !== undefined ? (settings.active ? 1 : 0) : (existing?.active ?? 1);
  const maxReqs = settings.rate_limit_max_requests !== undefined
    ? settings.rate_limit_max_requests
    : (existing?.rate_limit_max_requests ?? null);
  const windowSecs = settings.rate_limit_window_seconds !== undefined
    ? settings.rate_limit_window_seconds
    : (existing?.rate_limit_window_seconds ?? null);

  db.prepare(`
    INSERT INTO provider_settings (provider, active, rate_limit_max_requests, rate_limit_window_seconds, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET
      active = excluded.active,
      rate_limit_max_requests = excluded.rate_limit_max_requests,
      rate_limit_window_seconds = excluded.rate_limit_window_seconds,
      updated_at = excluded.updated_at
  `).run(provider, active, maxReqs, windowSecs, now);

  return getProviderSettings(db, provider)!;
}

// ---------------------------------------------------------------------------
// Provider Stats
// ---------------------------------------------------------------------------

export interface ProviderStatsRow {
  provider: string;
  total_requests: number;
  total_tokens: number;
  total_cost: number;
}

export function getProviderStats(
  db: Database.Database,
  provider: string,
  from?: string,
  to?: string,
): ProviderStatsRow {
  const conditions: string[] = ["provider = ?"];
  const params: unknown[] = [provider];

  if (from) {
    conditions.push("timestamp >= ?");
    params.push(from);
  }
  if (to) {
    conditions.push("timestamp <= ?");
    params.push(to);
  }

  const result = db.prepare(`
    SELECT
      ? as provider,
      COUNT(*) as total_requests,
      COALESCE(SUM(tokens_total), 0) as total_tokens,
      COALESCE(SUM(cost_usd), 0) as total_cost
    FROM agent_events
    WHERE ${conditions.join(" AND ")}
  `).get(provider, ...params) as ProviderStatsRow;

  return result;
}

export interface ProviderModelStatsRow {
  model: string;
  requests: number;
  tokens: number;
  cost: number;
}

export function getProviderModelStats(
  db: Database.Database,
  provider: string,
  from?: string,
  to?: string,
): ProviderModelStatsRow[] {
  const conditions: string[] = ["provider = ?", "model IS NOT NULL"];
  const params: unknown[] = [provider];

  if (from) {
    conditions.push("timestamp >= ?");
    params.push(from);
  }
  if (to) {
    conditions.push("timestamp <= ?");
    params.push(to);
  }

  return db.prepare(`
    SELECT
      model,
      COUNT(*) as requests,
      COALESCE(SUM(tokens_total), 0) as tokens,
      COALESCE(SUM(cost_usd), 0) as cost
    FROM agent_events
    WHERE ${conditions.join(" AND ")}
    GROUP BY model
    ORDER BY cost DESC
  `).all(...params) as ProviderModelStatsRow[];
}

// ---------------------------------------------------------------------------
// Provider List Stats (for provider list view)
// ---------------------------------------------------------------------------

export interface ProviderListStatsRow {
  provider: string;
  agent_count: number;
  total_tokens: number;
  total_cost: number;
  today_cost: number;
}

export function getAllProviderListStats(
  db: Database.Database,
): ProviderListStatsRow[] {
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const todayStart = todayUTC.toISOString();

  return db.prepare(`
    SELECT
      provider,
      COUNT(DISTINCT agent_id) as agent_count,
      COALESCE(SUM(tokens_total), 0) as total_tokens,
      COALESCE(SUM(cost_usd), 0) as total_cost,
      COALESCE(SUM(CASE WHEN timestamp >= ? THEN cost_usd ELSE 0 END), 0) as today_cost
    FROM agent_events
    WHERE provider IS NOT NULL
    GROUP BY provider
    ORDER BY total_cost DESC
  `).all(todayStart) as ProviderListStatsRow[];
}

// ---------------------------------------------------------------------------
// Kill Switch
// ---------------------------------------------------------------------------

export interface KillSwitchConfig {
  enabled: boolean;
  window_size: number;
  threshold: number;
}

export function getKillSwitchConfig(
  db: Database.Database,
  agentId: string,
): KillSwitchConfig | null {
  const row = db.prepare(`
    SELECT kill_switch_enabled, kill_switch_window_size, kill_switch_threshold
    FROM agents WHERE agent_id = ?
  `).get(agentId) as {
    kill_switch_enabled: number;
    kill_switch_window_size: number;
    kill_switch_threshold: number;
  } | undefined;

  if (!row) return null;

  return {
    enabled: row.kill_switch_enabled === 1,
    window_size: row.kill_switch_window_size,
    threshold: row.kill_switch_threshold,
  };
}

export function updateKillSwitchConfig(
  db: Database.Database,
  agentId: string,
  config: Partial<KillSwitchConfig>,
): boolean {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (config.enabled !== undefined) {
    updates.push("kill_switch_enabled = ?");
    params.push(config.enabled ? 1 : 0);
  }
  if (config.window_size !== undefined) {
    updates.push("kill_switch_window_size = ?");
    params.push(config.window_size);
  }
  if (config.threshold !== undefined) {
    updates.push("kill_switch_threshold = ?");
    params.push(config.threshold);
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
// Overview Dashboard Stats
// ---------------------------------------------------------------------------

export interface OverviewStats {
  active_agents: number;
  today_cost: number;
  today_requests: number;
  error_rate: number;
  yesterday_cost: number;
  yesterday_requests: number;
  yesterday_error_rate: number;
}

export function getOverviewStats(db: Database.Database): OverviewStats {
  const now = new Date();
  const todayUTC = new Date(now);
  todayUTC.setUTCHours(0, 0, 0, 0);
  const todayStart = todayUTC.toISOString();

  const yesterdayUTC = new Date(todayUTC);
  yesterdayUTC.setUTCDate(yesterdayUTC.getUTCDate() - 1);
  const yesterdayStart = yesterdayUTC.toISOString();

  // Active agents count
  const activeAgentsResult = db.prepare(`
    SELECT COUNT(*) as count FROM agents WHERE active = 1
  `).get() as { count: number };

  // Today's stats
  const todayStatsResult = db.prepare(`
    SELECT
      COALESCE(SUM(cost_usd), 0) as cost,
      COUNT(*) as requests,
      SUM(CASE WHEN event_type = 'error' OR status_code >= 400 THEN 1 ELSE 0 END) as errors
    FROM agent_events
    WHERE timestamp >= ?
  `).get(todayStart) as { cost: number; requests: number; errors: number };

  // Yesterday's stats
  const yesterdayStatsResult = db.prepare(`
    SELECT
      COALESCE(SUM(cost_usd), 0) as cost,
      COUNT(*) as requests,
      SUM(CASE WHEN event_type = 'error' OR status_code >= 400 THEN 1 ELSE 0 END) as errors
    FROM agent_events
    WHERE timestamp >= ? AND timestamp < ?
  `).get(yesterdayStart, todayStart) as { cost: number; requests: number; errors: number };

  const todayErrorRate = todayStatsResult.requests > 0
    ? (todayStatsResult.errors / todayStatsResult.requests) * 100
    : 0;

  const yesterdayErrorRate = yesterdayStatsResult.requests > 0
    ? (yesterdayStatsResult.errors / yesterdayStatsResult.requests) * 100
    : 0;

  return {
    active_agents: activeAgentsResult.count,
    today_cost: todayStatsResult.cost,
    today_requests: todayStatsResult.requests,
    error_rate: todayErrorRate,
    yesterday_cost: yesterdayStatsResult.cost,
    yesterday_requests: yesterdayStatsResult.requests,
    yesterday_error_rate: yesterdayErrorRate,
  };
}

export interface TopAgentRow {
  agent_id: string;
  cost: number;
  percentage: number;
}

export function getTopAgentsByCost(db: Database.Database, limit = 5, days = 7): TopAgentRow[] {
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - days + 1);
  startDate.setUTCHours(0, 0, 0, 0);
  const periodStart = startDate.toISOString();

  // Get total cost first
  const totalResult = db.prepare(`
    SELECT COALESCE(SUM(cost_usd), 0) as total
    FROM agent_events
    WHERE timestamp >= ?
  `).get(periodStart) as { total: number };

  const totalCost = totalResult.total || 1; // Avoid division by zero

  // Get top agents by cost
  const rows = db.prepare(`
    SELECT
      agent_id,
      COALESCE(SUM(cost_usd), 0) as cost
    FROM agent_events
    WHERE timestamp >= ? AND cost_usd IS NOT NULL
    GROUP BY agent_id
    ORDER BY cost DESC
    LIMIT ?
  `).all(periodStart, limit) as { agent_id: string; cost: number }[];

  return rows.map(row => ({
    agent_id: row.agent_id,
    cost: row.cost,
    percentage: (row.cost / totalCost) * 100,
  }));
}

export interface TopModelRow {
  model: string;
  tokens: number;
  percentage: number;
}

export function getTopModelsByTokens(db: Database.Database, limit = 5, days = 7): TopModelRow[] {
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - days + 1);
  startDate.setUTCHours(0, 0, 0, 0);
  const periodStart = startDate.toISOString();

  // Get total tokens first
  const totalResult = db.prepare(`
    SELECT COALESCE(SUM(tokens_total), 0) as total
    FROM agent_events
    WHERE timestamp >= ?
  `).get(periodStart) as { total: number };

  const totalTokens = totalResult.total || 1; // Avoid division by zero

  // Get top models by tokens
  const rows = db.prepare(`
    SELECT
      model,
      COALESCE(SUM(tokens_total), 0) as tokens
    FROM agent_events
    WHERE timestamp >= ? AND model IS NOT NULL AND tokens_total IS NOT NULL
    GROUP BY model
    ORDER BY tokens DESC
    LIMIT ?
  `).all(periodStart, limit) as { model: string; tokens: number }[];

  return rows.map(row => ({
    model: row.model,
    tokens: row.tokens,
    percentage: (row.tokens / totalTokens) * 100,
  }));
}

export interface DailyTrendPoint {
  date: string;
  value: number;
}

export interface DailyTrends {
  cost_trend: DailyTrendPoint[];
  requests_trend: DailyTrendPoint[];
}

export function getDailyTrends(db: Database.Database, days = 7): DailyTrends {
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - days + 1);
  startDate.setUTCHours(0, 0, 0, 0);
  const startDateStr = startDate.toISOString();

  const rows = db.prepare(`
    SELECT
      date(timestamp) as date,
      COALESCE(SUM(cost_usd), 0) as cost,
      COUNT(*) as requests
    FROM agent_events
    WHERE timestamp >= ?
    GROUP BY date(timestamp)
    ORDER BY date ASC
  `).all(startDateStr) as { date: string; cost: number; requests: number }[];

  // Create a map of existing data
  const dataMap = new Map(rows.map(r => [r.date, r]));

  // Generate all dates in range
  const costTrend: DailyTrendPoint[] = [];
  const requestsTrend: DailyTrendPoint[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().split("T")[0];

    const data = dataMap.get(dateStr);
    costTrend.push({ date: dateStr, value: data?.cost ?? 0 });
    requestsTrend.push({ date: dateStr, value: data?.requests ?? 0 });
  }

  return {
    cost_trend: costTrend,
    requests_trend: requestsTrend,
  };
}

export interface RecentEvent {
  type: "kill_switch" | "budget_warning" | "high_error_rate" | "new_agent";
  agent_id: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Delete Agent (cascade)
// ---------------------------------------------------------------------------

export function deleteAgent(db: Database.Database, agentId: string): boolean {
  const deleteAll = db.transaction(() => {
    // 1. Delete events
    db.prepare("DELETE FROM agent_events WHERE agent_id = ?").run(agentId);

    // 2. Delete alert history (via alert_rules FK, but also direct delete for safety)
    db.prepare(`
      DELETE FROM alert_history WHERE alert_rule_id IN (
        SELECT id FROM alert_rules WHERE agent_id = ?
      )
    `).run(agentId);

    // 3. Delete alert rules
    db.prepare("DELETE FROM alert_rules WHERE agent_id = ?").run(agentId);

    // 4. Delete model rules
    db.prepare("DELETE FROM agent_model_rules WHERE agent_id = ?").run(agentId);

    // 5. Delete rate limits
    db.prepare("DELETE FROM agent_rate_limits WHERE agent_id = ?").run(agentId);

    // 6. Delete agent
    const result = db.prepare("DELETE FROM agents WHERE agent_id = ?").run(agentId);

    return result.changes > 0;
  });

  return deleteAll();
}

// ---------------------------------------------------------------------------
// Delete Provider (cascade)
// ---------------------------------------------------------------------------

export function deleteProvider(db: Database.Database, provider: string): boolean {
  const deleteAll = db.transaction(() => {
    // 1. Delete agent model rules for this provider
    db.prepare("DELETE FROM agent_model_rules WHERE provider = ?").run(provider);

    // 2. Delete agent rate limits for this provider
    db.prepare("DELETE FROM agent_rate_limits WHERE provider = ?").run(provider);

    // 3. Delete custom models for this provider
    db.prepare("DELETE FROM provider_models WHERE provider = ?").run(provider);

    // 4. Delete provider settings
    const result = db.prepare("DELETE FROM provider_settings WHERE provider = ?").run(provider);

    return result.changes > 0;
  });

  return deleteAll();
}

// Normalize SQLite datetime to ISO format with Z suffix
function normalizeTimestamp(ts: string | null | undefined): string {
  if (!ts) return new Date().toISOString();
  // Already has Z or timezone info
  if (ts.includes("Z") || ts.includes("+") || ts.includes("-", 10)) {
    return ts;
  }
  // SQLite format: "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DDTHH:MM:SS.000Z"
  return ts.replace(" ", "T") + ".000Z";
}

export function getRecentEvents(db: Database.Database, limit = 10): RecentEvent[] {
  const events: RecentEvent[] = [];
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Kill switch events
  const killSwitchEvents = db.prepare(`
    SELECT agent_id, timestamp
    FROM agent_events
    WHERE event_type = 'kill_switch' AND timestamp >= ?
    ORDER BY timestamp DESC
    LIMIT 5
  `).all(oneDayAgo) as { agent_id: string; timestamp: string }[];

  for (const e of killSwitchEvents) {
    events.push({
      type: "kill_switch",
      agent_id: e.agent_id,
      message: "Loop detected, deactivated",
      timestamp: normalizeTimestamp(e.timestamp),
    });
  }

  // 2. New agents (created in last 24h)
  const newAgents = db.prepare(`
    SELECT agent_id, created_at
    FROM agents
    WHERE created_at >= ?
    ORDER BY created_at DESC
    LIMIT 5
  `).all(oneDayAgo) as { agent_id: string; created_at: string }[];

  for (const a of newAgents) {
    events.push({
      type: "new_agent",
      agent_id: a.agent_id,
      message: "First request received",
      timestamp: normalizeTimestamp(a.created_at),
    });
  }

  // 3. Budget warnings (agents near budget limit)
  const budgetWarnings = db.prepare(`
    SELECT a.agent_id, a.budget_limit,
           COALESCE(SUM(e.cost_usd), 0) as today_spend,
           MAX(e.timestamp) as timestamp
    FROM agents a
    LEFT JOIN agent_events e ON e.agent_id = a.agent_id AND date(e.timestamp) = date('now')
    WHERE a.budget_limit IS NOT NULL
    GROUP BY a.agent_id
    HAVING today_spend >= a.budget_limit * 0.8
  `).all() as { agent_id: string; budget_limit: number; today_spend: number; timestamp: string | null }[];

  for (const b of budgetWarnings) {
    if (b.timestamp) {
      events.push({
        type: "budget_warning",
        agent_id: b.agent_id,
        message: `Budget ${Math.round((b.today_spend / b.budget_limit) * 100)}%: $${b.today_spend.toFixed(2)} / $${b.budget_limit.toFixed(2)}`,
        timestamp: normalizeTimestamp(b.timestamp),
        details: { current_spend: b.today_spend, budget_limit: b.budget_limit },
      });
    }
  }

  // 4. High error rate (>5% in last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const errorRates = db.prepare(`
    SELECT
      agent_id,
      COUNT(*) as total,
      SUM(CASE WHEN event_type = 'error' OR status_code >= 400 THEN 1 ELSE 0 END) as errors,
      MAX(timestamp) as timestamp
    FROM agent_events
    WHERE timestamp >= ?
    GROUP BY agent_id
    HAVING total >= 10 AND (errors * 1.0 / total) > 0.05
  `).all(oneHourAgo) as { agent_id: string; total: number; errors: number; timestamp: string }[];

  for (const r of errorRates) {
    const errorRate = (r.errors / r.total) * 100;
    events.push({
      type: "high_error_rate",
      agent_id: r.agent_id,
      message: `${errorRate.toFixed(1)}% errors in last hour`,
      timestamp: normalizeTimestamp(r.timestamp),
      details: { error_rate: errorRate },
    });
  }

  // Sort all events by timestamp descending and limit
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events.slice(0, limit);
}
