export { createServer, startServer } from "./server.js";
export type { ServerOptions } from "./server.js";

// Re-export DB types and functions needed by proxy for policy enforcement
export { getAgentPolicy, getDailySpend, insertEvents, upsertAgent, getModelRule, getAllRateLimits } from "./db.js";
export type { AgentPolicy, InsertEventRow, ModelRuleRow, RateLimitRow } from "./db.js";
