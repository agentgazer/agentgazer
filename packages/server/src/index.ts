export { createServer, startServer } from "./server.js";
export type { ServerOptions, SecretStore } from "./server.js";

// Re-export DB types and functions needed by proxy for policy enforcement
export {
  getAgentPolicy,
  updateAgentPolicy,
  getDailySpend,
  insertEvents,
  upsertAgent,
  getModelRule,
  getAllRateLimits,
  getProviderSettings,
  getAllProviderSettings,
} from "./db.js";
export type {
  AgentPolicy,
  InsertEventRow,
  ModelRuleRow,
  RateLimitRow,
  ProviderSettingsRow,
} from "./db.js";
