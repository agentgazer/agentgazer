import { Router } from "express";
import type Database from "better-sqlite3";
import { insertEvents, upsertAgent, queryEvents, type InsertEventRow } from "../db.js";
import { rateLimitEvents } from "../middleware/rate-limit.js";

const router = Router();

const VALID_EVENT_TYPES = new Set(["llm_call", "completion", "heartbeat", "error", "custom"]);
const VALID_SOURCES = new Set(["sdk", "proxy"]);

const MAX_QUERY_LIMIT = 10_000;

function safeParseTags(tags: unknown): unknown {
  if (typeof tags !== "string") return tags;
  try { return JSON.parse(tags); } catch { return tags; }
}

interface RawEvent {
  agent_id?: unknown;
  event_type?: unknown;
  source?: unknown;
  timestamp?: unknown;
  provider?: unknown;
  model?: unknown;
  tokens_in?: unknown;
  tokens_out?: unknown;
  tokens_total?: unknown;
  cost_usd?: unknown;
  latency_ms?: unknown;
  status_code?: unknown;
  error_message?: unknown;
  tags?: unknown;
  trace_id?: unknown;
  span_id?: unknown;
  parent_span_id?: unknown;
}

interface ValidationResult {
  valid: boolean;
  event?: InsertEventRow;
  error?: string;
}

function isValidISOString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const d = new Date(value);
  return !isNaN(d.getTime()) && value.length > 0;
}

function validateEvent(raw: RawEvent): ValidationResult {
  // Required fields
  if (typeof raw.agent_id !== "string" || raw.agent_id.length === 0) {
    return { valid: false, error: "agent_id is required and must be a non-empty string" };
  }

  if (typeof raw.event_type !== "string" || !VALID_EVENT_TYPES.has(raw.event_type)) {
    return { valid: false, error: `event_type must be one of: ${[...VALID_EVENT_TYPES].join(", ")}` };
  }

  if (typeof raw.source !== "string" || !VALID_SOURCES.has(raw.source)) {
    return { valid: false, error: `source must be one of: ${[...VALID_SOURCES].join(", ")}` };
  }

  if (!isValidISOString(raw.timestamp)) {
    return { valid: false, error: "timestamp is required and must be a valid ISO string" };
  }

  const event: InsertEventRow = {
    agent_id: raw.agent_id,
    event_type: raw.event_type,
    source: raw.source,
    timestamp: raw.timestamp,
  };

  // Optional fields
  if (raw.provider != null) {
    if (typeof raw.provider !== "string") {
      return { valid: false, error: "provider must be a string" };
    }
    event.provider = raw.provider;
  }

  if (raw.model != null) {
    if (typeof raw.model !== "string") {
      return { valid: false, error: "model must be a string" };
    }
    event.model = raw.model;
  }

  if (raw.tokens_in != null) {
    if (typeof raw.tokens_in !== "number" || !Number.isInteger(raw.tokens_in)) {
      return { valid: false, error: "tokens_in must be an integer" };
    }
    event.tokens_in = raw.tokens_in;
  }

  if (raw.tokens_out != null) {
    if (typeof raw.tokens_out !== "number" || !Number.isInteger(raw.tokens_out)) {
      return { valid: false, error: "tokens_out must be an integer" };
    }
    event.tokens_out = raw.tokens_out;
  }

  if (raw.tokens_total != null) {
    if (typeof raw.tokens_total !== "number" || !Number.isInteger(raw.tokens_total)) {
      return { valid: false, error: "tokens_total must be an integer" };
    }
    event.tokens_total = raw.tokens_total;
  }

  if (raw.cost_usd != null) {
    if (typeof raw.cost_usd !== "number") {
      return { valid: false, error: "cost_usd must be a number" };
    }
    event.cost_usd = raw.cost_usd;
  }

  if (raw.latency_ms != null) {
    if (typeof raw.latency_ms !== "number" || !Number.isInteger(raw.latency_ms)) {
      return { valid: false, error: "latency_ms must be an integer" };
    }
    event.latency_ms = raw.latency_ms;
  }

  if (raw.status_code != null) {
    if (typeof raw.status_code !== "number" || !Number.isInteger(raw.status_code)) {
      return { valid: false, error: "status_code must be an integer" };
    }
    event.status_code = raw.status_code;
  }

  if (raw.error_message != null) {
    if (typeof raw.error_message !== "string") {
      return { valid: false, error: "error_message must be a string" };
    }
    event.error_message = raw.error_message;
  }

  if (raw.tags != null) {
    if (typeof raw.tags !== "object" || Array.isArray(raw.tags)) {
      return { valid: false, error: "tags must be an object" };
    }
    event.tags = raw.tags as Record<string, unknown>;
  }

  if (raw.trace_id != null) {
    if (typeof raw.trace_id !== "string") {
      return { valid: false, error: "trace_id must be a string" };
    }
    event.trace_id = raw.trace_id;
  }

  if (raw.span_id != null) {
    if (typeof raw.span_id !== "string") {
      return { valid: false, error: "span_id must be a string" };
    }
    event.span_id = raw.span_id;
  }

  if (raw.parent_span_id != null) {
    if (typeof raw.parent_span_id !== "string") {
      return { valid: false, error: "parent_span_id must be a string" };
    }
    event.parent_span_id = raw.parent_span_id;
  }

  return { valid: true, event };
}

// POST /api/events - Event ingestion
router.post("/api/events", rateLimitEvents, (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const body = req.body as { events?: unknown[] } | RawEvent;

  // Normalize to array: accept { events: [...] } or single event object
  let rawEvents: unknown[];
  if (body && "events" in body && Array.isArray(body.events)) {
    rawEvents = body.events;
  } else {
    rawEvents = [body];
  }

  if (rawEvents.length === 0) {
    res.status(400).json({ error: "No events provided" });
    return;
  }

  const results: Array<{ index: number; success: boolean; id?: string; error?: string }> = [];
  const validEvents: InsertEventRow[] = [];
  const validIndices: number[] = [];

  for (let i = 0; i < rawEvents.length; i++) {
    const raw = rawEvents[i] as RawEvent;
    const validation = validateEvent(raw);

    if (validation.valid && validation.event) {
      validEvents.push(validation.event);
      validIndices.push(i);
    } else {
      results.push({ index: i, success: false, error: validation.error });
    }
  }

  // If all events are invalid, return 400
  if (validEvents.length === 0) {
    res.status(400).json({
      status: "error",
      event_ids: [],
      results,
    });
    return;
  }

  // Insert valid events into DB
  const ids = insertEvents(db, validEvents);

  // Upsert agents for each unique agent_id
  const agentIds = new Set(validEvents.map((e) => e.agent_id));
  for (const agentId of agentIds) {
    const hasHeartbeat = validEvents.some(
      (e) => e.agent_id === agentId && e.event_type === "heartbeat",
    );
    upsertAgent(db, agentId, hasHeartbeat);
  }

  // Build results for valid events
  let idIdx = 0;
  for (const originalIndex of validIndices) {
    results.push({ index: originalIndex, success: true, id: ids[idIdx] });
    idIdx++;
  }

  // Sort results by original index
  results.sort((a, b) => a.index - b.index);

  const allValid = validEvents.length === rawEvents.length;
  const statusCode = allValid ? 200 : 207;

  res.status(statusCode).json({
    status: "ok",
    event_ids: ids,
    results,
  });
});

// GET /api/events - Query events
router.get("/api/events", (req, res) => {
  const db = req.app.locals.db as Database.Database;

  const agentId = req.query.agent_id as string | undefined;
  if (!agentId) {
    res.status(400).json({ error: "agent_id query parameter is required" });
    return;
  }

  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const eventType = req.query.event_type as string | undefined;
  const provider = req.query.provider as string | undefined;
  const model = req.query.model as string | undefined;
  const traceId = req.query.trace_id as string | undefined;
  const search = req.query.search as string | undefined;
  const limitStr = req.query.limit as string | undefined;
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  const rows = queryEvents(db, {
    agent_id: agentId,
    from,
    to,
    event_type: eventType,
    provider,
    model,
    trace_id: traceId,
    search,
    limit: limit && !isNaN(limit) ? Math.min(limit, MAX_QUERY_LIMIT) : undefined,
  });

  // Parse tags from JSON string to object
  const events = rows.map((row) => ({
    ...row,
    tags: safeParseTags(row.tags),
  }));

  res.json({ events });
});

// GET /api/events/export - Export events as CSV or JSON
router.get("/api/events/export", (req, res) => {
  const db = req.app.locals.db as Database.Database;

  const agentId = req.query.agent_id as string | undefined;
  if (!agentId) {
    res.status(400).json({ error: "agent_id query parameter is required" });
    return;
  }

  const format = (req.query.format as string | undefined) ?? "json";
  if (format !== "json" && format !== "csv") {
    res.status(400).json({ error: "format must be 'json' or 'csv'" });
    return;
  }

  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const eventType = req.query.event_type as string | undefined;
  const provider = req.query.provider as string | undefined;
  const model = req.query.model as string | undefined;
  const traceId = req.query.trace_id as string | undefined;

  const rows = queryEvents(db, {
    agent_id: agentId,
    from,
    to,
    event_type: eventType,
    provider,
    model,
    trace_id: traceId,
    limit: 100_000,
  });

  if (format === "csv") {
    const headers = [
      "id", "agent_id", "event_type", "provider", "model",
      "tokens_in", "tokens_out", "tokens_total", "cost_usd",
      "latency_ms", "status_code", "error_message", "source",
      "timestamp", "trace_id", "span_id", "parent_span_id", "tags",
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="events-${agentId}.csv"`);

    res.write(headers.join(",") + "\n");

    for (const row of rows) {
      const values = headers.map((h) => {
        const val = (row as unknown as Record<string, unknown>)[h];
        if (val == null) return "";
        const str = String(val);
        // Escape CSV values containing commas, quotes, or newlines
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      res.write(values.join(",") + "\n");
    }

    res.end();
  } else {
    const events = rows.map((row) => ({
      ...row,
      tags: safeParseTags(row.tags),
    }));

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="events-${agentId}.json"`);
    res.json({ events });
  }
});

export default router;
