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

  return db;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    agent_id TEXT NOT NULL UNIQUE,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('healthy', 'degraded', 'down', 'unknown')),
    last_heartbeat_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON agents(agent_id);

  CREATE TABLE IF NOT EXISTS agent_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    agent_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('llm_call', 'completion', 'heartbeat', 'error', 'custom')),
    provider TEXT,
    model TEXT,
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
    webhook_url TEXT,
    email TEXT,
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
    delivered_via TEXT NOT NULL CHECK (delivered_via IN ('webhook', 'email')),
    delivered_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(alert_rule_id);
`;

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function upsertAgent(
  db: Database.Database,
  agentId: string,
  isHeartbeat: boolean,
): void {
  const now = new Date().toISOString();

  if (isHeartbeat) {
    const stmt = db.prepare(`
      INSERT INTO agents (id, agent_id, status, last_heartbeat_at, updated_at)
      VALUES (?, ?, 'healthy', ?, ?)
      ON CONFLICT(agent_id) DO UPDATE SET
        status = 'healthy',
        last_heartbeat_at = excluded.last_heartbeat_at,
        updated_at = excluded.updated_at
    `);
    stmt.run(randomUUID(), agentId, now, now);
  } else {
    const stmt = db.prepare(`
      INSERT INTO agents (id, agent_id, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(agent_id) DO UPDATE SET
        updated_at = excluded.updated_at
    `);
    stmt.run(randomUUID(), agentId, now);
  }
}

export interface InsertEventRow {
  agent_id: string;
  event_type: string;
  provider?: string | null;
  model?: string | null;
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
      id, agent_id, event_type, provider, model,
      tokens_in, tokens_out, tokens_total, cost_usd,
      latency_ms, status_code, error_message, tags,
      source, timestamp, trace_id, span_id, parent_span_id
    ) VALUES (
      ?, ?, ?, ?, ?,
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
  status: string;
  last_heartbeat: string | null;
  created_at: string;
  updated_at: string;
}

export function getAllAgents(db: Database.Database): (AgentRow & { total_events: number })[] {
  return db.prepare(`
    SELECT a.id, a.agent_id, a.name, a.status,
           a.last_heartbeat_at AS last_heartbeat,
           a.created_at, a.updated_at,
           COALESCE(e.cnt, 0) AS total_events
    FROM agents a
    LEFT JOIN (SELECT agent_id, COUNT(*) AS cnt FROM agent_events GROUP BY agent_id) e
      ON e.agent_id = a.agent_id
    ORDER BY a.updated_at DESC
  `).all() as (AgentRow & { total_events: number })[];
}

export function getAgentByAgentId(
  db: Database.Database,
  agentId: string,
): AgentRow | undefined {
  return db.prepare(`
    SELECT id, agent_id, name, status,
           last_heartbeat_at AS last_heartbeat,
           created_at, updated_at
    FROM agents WHERE agent_id = ?
  `).get(agentId) as AgentRow | undefined;
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
