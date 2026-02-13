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

// Re-export alert functions for kill switch handling
export { fireKillSwitchAlert, resetKillSwitchAlerts } from "./alerts/evaluator.js";
export type { KillSwitchEventData } from "./alerts/evaluator.js";

// Re-export security config functions for proxy
export {
  getSecurityConfig,
  upsertSecurityConfig,
  insertSecurityEvent,
  getSecurityEvents,
  getSecurityEventById,
} from "./db.js";
export type {
  SecurityConfig,
  SecurityEventRow,
  InsertSecurityEvent,
  SecurityEventQueryOptions,
  SecurityEventQueryResult,
} from "./db.js";
