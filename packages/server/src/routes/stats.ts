import { Router } from "express";
import type Database from "better-sqlite3";
import type { EventRow } from "../db.js";

const router = Router();

type Range = "1h" | "24h" | "7d" | "30d" | "custom";

function computeFromTime(range: Range, from?: string, to?: string): { from: string; to: string } {
  const now = new Date();
  const toTime = to ? new Date(to) : now;

  if (range === "custom") {
    if (!from) {
      // Default to 24h if custom range without from
      const d = new Date(toTime);
      d.setHours(d.getHours() - 24);
      return { from: d.toISOString(), to: toTime.toISOString() };
    }
    return { from: new Date(from).toISOString(), to: toTime.toISOString() };
  }

  const d = new Date(toTime);
  switch (range) {
    case "1h":
      d.setHours(d.getHours() - 1);
      break;
    case "24h":
      d.setHours(d.getHours() - 24);
      break;
    case "7d":
      d.setDate(d.getDate() - 7);
      break;
    case "30d":
      d.setDate(d.getDate() - 30);
      break;
  }

  return { from: d.toISOString(), to: toTime.toISOString() };
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

interface CostByModel {
  model: string | null;
  provider: string | null;
  cost: number;
  count: number;
}

interface TokenSeriesEntry {
  timestamp: string;
  tokens_in: number | null;
  tokens_out: number | null;
}

// GET /api/stats/overview — aggregate stats across ALL agents
// Must be registered BEFORE /api/stats/:agentId
router.get("/api/stats/overview", (req, res) => {
  const db = req.app.locals.db as Database.Database;

  const VALID_RANGES = new Set<string>(["1h", "24h", "7d", "30d"]);
  const rangeParam = req.query.range as string | undefined;
  const range: Range = (rangeParam && VALID_RANGES.has(rangeParam) ? rangeParam : "24h") as Range;
  const modelFilter = req.query.model as string | undefined;

  const timeRange = computeFromTime(range);

  // Build query conditions
  const conditions: string[] = [
    "timestamp >= ?",
    "timestamp <= ?",
    "(event_type = 'llm_call' OR event_type = 'completion')",
  ];
  const params: unknown[] = [timeRange.from, timeRange.to];

  if (modelFilter) {
    conditions.push("model = ?");
    params.push(modelFilter);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  // Aggregate totals
  const totals = db
    .prepare(
      `SELECT
         COALESCE(SUM(cost_usd), 0) AS total_cost,
         COALESCE(SUM(tokens_total), 0) AS total_tokens,
         COUNT(*) AS total_requests
       FROM agent_events
       ${where}`,
    )
    .get(...params) as { total_cost: number; total_tokens: number; total_requests: number };

  const avgCostPerRequest =
    totals.total_requests > 0 ? totals.total_cost / totals.total_requests : 0;

  // Cost by model
  const costByModelRows = db
    .prepare(
      `SELECT
         COALESCE(model, 'unknown') AS model,
         COALESCE(provider, 'unknown') AS provider,
         COALESCE(SUM(cost_usd), 0) AS cost,
         COUNT(*) AS count
       FROM agent_events
       ${where}
       GROUP BY model, provider
       ORDER BY cost DESC`,
    )
    .all(...params) as CostByModel[];

  // Available models (unfiltered — always show all models in the time range)
  const availableModelsRows = db
    .prepare(
      `SELECT DISTINCT model FROM agent_events
       WHERE timestamp >= ? AND timestamp <= ?
         AND (event_type = 'llm_call' OR event_type = 'completion')
         AND model IS NOT NULL
       ORDER BY model`,
    )
    .all(timeRange.from, timeRange.to) as { model: string }[];

  const availableModels = availableModelsRows.map((r) => r.model);

  // Active models count
  const activeModels = costByModelRows.length;

  // Cost time series — bucket by hour for 1h, by day for others
  const bucketFormat = range === "1h" ? "%Y-%m-%dT%H:00:00Z" : "%Y-%m-%dT00:00:00Z";

  const costSeries = db
    .prepare(
      `SELECT
         strftime('${bucketFormat}', timestamp) AS timestamp,
         COALESCE(SUM(cost_usd), 0) AS cost,
         COALESCE(SUM(tokens_total), 0) AS tokens
       FROM agent_events
       ${where}
       GROUP BY strftime('${bucketFormat}', timestamp)
       ORDER BY timestamp ASC`,
    )
    .all(...params) as { timestamp: string; cost: number; tokens: number }[];

  res.json({
    total_cost: totals.total_cost,
    total_tokens: totals.total_tokens,
    total_requests: totals.total_requests,
    avg_cost_per_request: avgCostPerRequest,
    active_models: activeModels,
    cost_by_model: costByModelRows,
    cost_series: costSeries,
    available_models: availableModels,
  });
});

router.get("/api/stats/:agentId", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const { agentId } = req.params;

  const VALID_RANGES = new Set<string>(["1h", "24h", "7d", "30d", "custom"]);
  const rangeParam = req.query.range as string | undefined;
  const range: Range = (rangeParam && VALID_RANGES.has(rangeParam) ? rangeParam : "24h") as Range;
  const fromParam = req.query.from as string | undefined;
  const toParam = req.query.to as string | undefined;

  const timeRange = computeFromTime(range, fromParam, toParam);

  // Query all events for this agent in the time range
  const allEvents = db
    .prepare(
      `SELECT * FROM agent_events
       WHERE agent_id = ? AND timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp ASC`,
    )
    .all(agentId, timeRange.from, timeRange.to) as EventRow[];

  // Filter LLM-specific events for cost/token/latency stats
  const llmEvents = allEvents.filter(
    (e) => e.event_type === "llm_call" || e.event_type === "completion",
  );

  const totalRequests = allEvents.length;
  const totalErrors = allEvents.filter((e) => e.event_type === "error").length;
  const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

  // Cost
  const totalCost = llmEvents.reduce((sum, e) => sum + (e.cost_usd ?? 0), 0);

  // Tokens
  const totalTokens = llmEvents.reduce((sum, e) => sum + (e.tokens_total ?? 0), 0);

  // Latency percentiles
  const latencies = llmEvents
    .map((e) => e.latency_ms)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);

  const p50Latency = percentile(latencies, 50);
  const p99Latency = percentile(latencies, 99);

  // Cost by model
  const modelMap = new Map<string, CostByModel>();
  for (const e of llmEvents) {
    const key = `${e.model ?? "unknown"}::${e.provider ?? "unknown"}`;
    const existing = modelMap.get(key);
    if (existing) {
      existing.cost += e.cost_usd ?? 0;
      existing.count += 1;
    } else {
      modelMap.set(key, {
        model: e.model,
        provider: e.provider,
        cost: e.cost_usd ?? 0,
        count: 1,
      });
    }
  }
  const costByModel = [...modelMap.values()];

  // Token series: return raw events with tokens (limit 500)
  const tokenSeries: TokenSeriesEntry[] = llmEvents
    .filter((e) => e.tokens_in != null || e.tokens_out != null)
    .slice(0, 500)
    .map((e) => ({
      timestamp: e.timestamp,
      tokens_in: e.tokens_in,
      tokens_out: e.tokens_out,
    }));

  res.json({
    total_requests: totalRequests,
    total_errors: totalErrors,
    error_rate: errorRate,
    total_cost: totalCost,
    total_tokens: totalTokens,
    p50_latency: p50Latency,
    p99_latency: p99Latency,
    cost_by_model: costByModel,
    token_series: tokenSeries,
  });
});

export default router;
