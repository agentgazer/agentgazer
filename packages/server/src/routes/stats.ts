import { Router } from "express";
import type Database from "better-sqlite3";
import type { EventRow } from "../db.js";
import { getModelPricing, calculateCost } from "@agentgazer/shared";

const router = Router();

// Unified period type across all stats APIs
type Period = "1h" | "today" | "24h" | "7d" | "30d" | "all" | "custom";

const VALID_PERIODS = new Set<string>(["1h", "today", "24h", "7d", "30d", "all", "custom"]);

function computeTimeRange(period: Period, from?: string, to?: string): { from: string; to: string } {
  const now = new Date();
  const toTime = to ? new Date(to) : now;

  if (period === "custom") {
    if (!from) {
      // Default to 24h if custom range without from
      const d = new Date(toTime);
      d.setHours(d.getHours() - 24);
      return { from: d.toISOString(), to: toTime.toISOString() };
    }
    return { from: new Date(from).toISOString(), to: toTime.toISOString() };
  }

  if (period === "all") {
    // All time - use epoch
    return { from: new Date(0).toISOString(), to: toTime.toISOString() };
  }

  if (period === "today") {
    // From midnight local time to now
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from: midnight.toISOString(), to: toTime.toISOString() };
  }

  const d = new Date(toTime);
  switch (period) {
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

/**
 * Compute the previous period's time range for comparison.
 * For "today" → yesterday, for "24h" → previous 24h, etc.
 */
function computePreviousPeriodRange(period: Period): { from: string; to: string } | null {
  if (period === "all" || period === "custom") {
    return null; // No comparison for all-time or custom ranges
  }

  const now = new Date();

  if (period === "today") {
    // Yesterday: from yesterday midnight to today midnight
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayMidnight = new Date(todayMidnight);
    yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1);
    return { from: yesterdayMidnight.toISOString(), to: todayMidnight.toISOString() };
  }

  // For rolling periods, shift back by the same duration
  const currentRange = computeTimeRange(period);
  const durationMs = new Date(currentRange.to).getTime() - new Date(currentRange.from).getTime();
  const prevTo = new Date(currentRange.from);
  const prevFrom = new Date(prevTo.getTime() - durationMs);

  return { from: prevFrom.toISOString(), to: prevTo.toISOString() };
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

  const rangeParam = req.query.range as string | undefined;
  const period: Period = (rangeParam && VALID_PERIODS.has(rangeParam) ? rangeParam : "24h") as Period;
  const modelFilter = req.query.model as string | undefined;

  const timeRange = computeTimeRange(period);

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

  // Cost time series — bucket appropriately by period
  // 1h: 5-minute buckets, today/24h: hourly buckets, 7d/30d/all: daily buckets
  let costSeriesSQL: string;
  if (period === "1h") {
    // 5-minute buckets for 1h range
    costSeriesSQL = `SELECT
         strftime('%Y-%m-%dT%H:', timestamp) || printf('%02d', (CAST(strftime('%M', timestamp) AS INTEGER) / 5) * 5) || ':00Z' AS timestamp,
         COALESCE(SUM(cost_usd), 0) AS cost,
         COALESCE(SUM(tokens_total), 0) AS tokens
       FROM agent_events
       ${where}
       GROUP BY strftime('%Y-%m-%dT%H:', timestamp) || printf('%02d', (CAST(strftime('%M', timestamp) AS INTEGER) / 5) * 5)
       ORDER BY timestamp ASC`;
  } else if (period === "today" || period === "24h") {
    // Hourly buckets for 24h range
    costSeriesSQL = `SELECT
         strftime('%Y-%m-%dT%H:00:00Z', timestamp) AS timestamp,
         COALESCE(SUM(cost_usd), 0) AS cost,
         COALESCE(SUM(tokens_total), 0) AS tokens
       FROM agent_events
       ${where}
       GROUP BY strftime('%Y-%m-%dT%H:00:00Z', timestamp)
       ORDER BY timestamp ASC`;
  } else {
    // Daily buckets for 7d/30d
    costSeriesSQL = `SELECT
         strftime('%Y-%m-%dT00:00:00Z', timestamp) AS timestamp,
         COALESCE(SUM(cost_usd), 0) AS cost,
         COALESCE(SUM(tokens_total), 0) AS tokens
       FROM agent_events
       ${where}
       GROUP BY strftime('%Y-%m-%dT00:00:00Z', timestamp)
       ORDER BY timestamp ASC`;
  }

  const costSeries = db
    .prepare(costSeriesSQL)
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

  const rangeParam = req.query.range as string | undefined;
  const period: Period = (rangeParam && VALID_PERIODS.has(rangeParam) ? rangeParam : "24h") as Period;
  const fromParam = req.query.from as string | undefined;
  const toParam = req.query.to as string | undefined;

  const timeRange = computeTimeRange(period, fromParam, toParam);

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

  // Tokens (with input/output breakdown)
  const tokensIn = llmEvents.reduce((sum, e) => sum + (e.tokens_in ?? 0), 0);
  const tokensOut = llmEvents.reduce((sum, e) => sum + (e.tokens_out ?? 0), 0);
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

  // Blocked events stats
  const blockedEvents = allEvents.filter((e) => e.event_type === "blocked");
  const blockedCount = blockedEvents.length;

  // Count by block reason
  const blockReasons: Record<string, number> = {};
  for (const e of blockedEvents) {
    try {
      const tags = JSON.parse(e.tags || "{}");
      const reason = tags.block_reason || "unknown";
      blockReasons[reason] = (blockReasons[reason] || 0) + 1;
    } catch {
      blockReasons["unknown"] = (blockReasons["unknown"] || 0) + 1;
    }
  }

  // Compute comparison with previous period
  const prevRange = computePreviousPeriodRange(period);
  let comparison: {
    period: string;
    total_cost: number;
    total_requests: number;
    cost_change_pct: number | null;
  } | null = null;

  if (prevRange) {
    const prevEvents = db
      .prepare(
        `SELECT * FROM agent_events
         WHERE agent_id = ? AND timestamp >= ? AND timestamp <= ?`,
      )
      .all(agentId, prevRange.from, prevRange.to) as EventRow[];

    const prevLlmEvents = prevEvents.filter(
      (e) => e.event_type === "llm_call" || e.event_type === "completion",
    );
    const prevTotalCost = prevLlmEvents.reduce((sum, e) => sum + (e.cost_usd ?? 0), 0);
    const prevTotalRequests = prevEvents.length;

    const costChangePct = prevTotalCost > 0
      ? ((totalCost - prevTotalCost) / prevTotalCost) * 100
      : null;

    comparison = {
      period: period === "today" ? "yesterday" : `previous_${period}`,
      total_cost: prevTotalCost,
      total_requests: prevTotalRequests,
      cost_change_pct: costChangePct !== null ? Math.round(costChangePct * 10) / 10 : null,
    };
  }

  res.json({
    period,
    total_requests: totalRequests,
    total_errors: totalErrors,
    error_rate: errorRate,
    total_cost: totalCost,
    total_tokens: totalTokens,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    p50_latency: p50Latency,
    p99_latency: p99Latency,
    cost_by_model: costByModel,
    token_series: tokenSeries,
    blocked_count: blockedCount,
    block_reasons: blockReasons,
    comparison,
  });
});

// GET /api/stats/tokens - Token usage for MCP
router.get("/api/stats/tokens", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const agentId = req.query.agentId as string | undefined;
  const periodParam = req.query.period as string | undefined;
  const model = req.query.model as string | undefined;

  // Default to "today" for MCP (more intuitive for cost awareness)
  const period: Period = (periodParam && VALID_PERIODS.has(periodParam) ? periodParam : "today") as Period;
  const timeRange = computeTimeRange(period);

  const conditions: string[] = [
    "(event_type = 'llm_call' OR event_type = 'completion')",
    "timestamp >= ?",
    "timestamp <= ?",
  ];
  const params: unknown[] = [timeRange.from, timeRange.to];

  if (agentId) {
    conditions.push("agent_id = ?");
    params.push(agentId);
  }
  if (model) {
    conditions.push("model = ?");
    params.push(model);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const result = db
    .prepare(
      `SELECT
         COALESCE(SUM(tokens_in), 0) AS inputTokens,
         COALESCE(SUM(tokens_out), 0) AS outputTokens
       FROM agent_events
       ${where}`,
    )
    .get(...params) as { inputTokens: number; outputTokens: number };

  res.json({
    period,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });
});

// GET /api/stats/cost - Cost for MCP
router.get("/api/stats/cost", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const agentId = req.query.agentId as string | undefined;
  const periodParam = req.query.period as string | undefined;
  const breakdown = req.query.breakdown === "true";

  // Default to "today" for MCP (more intuitive for cost awareness)
  const period: Period = (periodParam && VALID_PERIODS.has(periodParam) ? periodParam : "today") as Period;
  const timeRange = computeTimeRange(period);

  const conditions: string[] = [
    "(event_type = 'llm_call' OR event_type = 'completion')",
    "timestamp >= ?",
    "timestamp <= ?",
  ];
  const params: unknown[] = [timeRange.from, timeRange.to];

  if (agentId) {
    conditions.push("agent_id = ?");
    params.push(agentId);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const totalResult = db
    .prepare(
      `SELECT
         COALESCE(SUM(cost_usd), 0) AS totalCost,
         COUNT(*) AS requestCount
       FROM agent_events
       ${where}`,
    )
    .get(...params) as { totalCost: number; requestCount: number };

  // Compute comparison with previous period
  const prevRange = computePreviousPeriodRange(period);
  let comparison: {
    period: string;
    totalCost: number;
    requestCount: number;
    cost_change_pct: number | null;
  } | null = null;

  if (prevRange) {
    const prevConditions = [...conditions];
    prevConditions[1] = "timestamp >= ?";
    prevConditions[2] = "timestamp <= ?";
    const prevParams = [prevRange.from, prevRange.to];
    if (agentId) prevParams.push(agentId);
    const prevWhere = `WHERE ${prevConditions.join(" AND ")}`;

    const prevResult = db
      .prepare(
        `SELECT
           COALESCE(SUM(cost_usd), 0) AS totalCost,
           COUNT(*) AS requestCount
         FROM agent_events
         ${prevWhere}`,
      )
      .get(...prevParams) as { totalCost: number; requestCount: number };

    const costChangePct = prevResult.totalCost > 0
      ? ((totalResult.totalCost - prevResult.totalCost) / prevResult.totalCost) * 100
      : null;

    comparison = {
      period: period === "today" ? "yesterday" : `previous_${period}`,
      totalCost: prevResult.totalCost,
      requestCount: prevResult.requestCount,
      cost_change_pct: costChangePct !== null ? Math.round(costChangePct * 10) / 10 : null,
    };
  }

  const response: {
    period: string;
    totalCost: number;
    requestCount: number;
    currency: string;
    breakdown?: Array<{ model: string; cost: number }>;
    comparison?: typeof comparison;
  } = {
    period,
    totalCost: totalResult.totalCost,
    requestCount: totalResult.requestCount,
    currency: "USD",
  };

  if (breakdown) {
    const breakdownRows = db
      .prepare(
        `SELECT
           COALESCE(model, 'unknown') AS model,
           COALESCE(SUM(cost_usd), 0) AS cost
         FROM agent_events
         ${where}
         GROUP BY model
         ORDER BY cost DESC`,
      )
      .all(...params) as Array<{ model: string; cost: number }>;
    response.breakdown = breakdownRows;
  }

  if (comparison) {
    response.comparison = comparison;
  }

  res.json(response);
});

// GET /api/stats/budget - Budget status for MCP
router.get("/api/stats/budget", (req, res) => {
  const db = req.app.locals.db as Database.Database;
  const agentId = req.query.agentId as string | undefined;

  // Get total spent
  const conditions: string[] = [
    "(event_type = 'llm_call' OR event_type = 'completion')",
  ];
  const params: unknown[] = [];

  if (agentId) {
    conditions.push("agent_id = ?");
    params.push(agentId);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const totalResult = db
    .prepare(
      `SELECT COALESCE(SUM(cost_usd), 0) AS used
       FROM agent_events
       ${where}`,
    )
    .get(...params) as { used: number };

  // Check if there's a budget limit for this agent
  // For now, we don't have budget limits in the schema, so return no limit
  // This can be extended when budget alerts are implemented
  const response: {
    hasLimit: boolean;
    limit?: number;
    used: number;
    remaining?: number;
    percentageUsed?: number;
  } = {
    hasLimit: false,
    used: totalResult.used,
  };

  // TODO: Read budget limit from agent settings when implemented
  // const agentSettings = db.prepare("SELECT budget_limit FROM agents WHERE id = ?").get(agentId);
  // if (agentSettings?.budget_limit) {
  //   response.hasLimit = true;
  //   response.limit = agentSettings.budget_limit;
  //   response.remaining = response.limit - response.used;
  //   response.percentageUsed = (response.used / response.limit) * 100;
  // }

  res.json(response);
});

// POST /api/stats/estimate - Estimate cost for MCP
router.post("/api/stats/estimate", (req, res) => {
  const { model, inputTokens, outputTokens } = req.body as {
    model: string;
    inputTokens: number;
    outputTokens: number;
  };

  if (!model || inputTokens === undefined || outputTokens === undefined) {
    res.status(400).json({ error: "model, inputTokens, and outputTokens are required" });
    return;
  }

  const pricing = getModelPricing(model);
  if (!pricing) {
    res.status(404).json({ error: `Model '${model}' not found in pricing table` });
    return;
  }

  const estimatedCost = calculateCost(model, inputTokens, outputTokens);

  res.json({
    model,
    estimatedCost,
    currency: "USD",
  });
});

export default router;
