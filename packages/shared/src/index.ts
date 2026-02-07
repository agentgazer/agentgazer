export {
  AgentEventSchema,
  BatchEventsSchema,
  EventType,
  Source,
  type AgentEvent,
  type BatchEvents,
} from "./types.js";

export {
  getModelPricing,
  calculateCost,
  listSupportedModels,
  type ModelPricing,
} from "./pricing.js";

export {
  detectProvider,
  detectProviderByHostname,
  getProviderBaseUrl,
  getProviderAuthHeader,
  parsePathPrefix,
  parseAgentPath,
  KNOWN_PROVIDER_NAMES,
  type ProviderName,
} from "./providers.js";

export {
  parseProviderResponse,
  type ParsedResponse,
} from "./parsers.js";

export {
  createLogger,
  type Logger,
  type LogLevel,
} from "./logger.js";

export {
  SELECTABLE_MODELS,
  PROVIDER_MODELS,
  getSelectableModels,
} from "./models.js";

export {
  validateProviderKey,
  testProviderModel,
  type ValidationResult,
} from "./provider-validator.js";

export {
  computeSimHash,
  hammingDistance,
  isSimilar,
} from "./simhash.js";

export {
  normalizePrompt,
  extractUserMessage,
  extractToolCalls,
  extractAndNormalizePrompt,
  type ChatMessage,
} from "./normalize.js";
