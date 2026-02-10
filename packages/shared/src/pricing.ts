export interface ModelPricing {
  inputPerMToken: number;   // USD per 1M input tokens
  outputPerMToken: number;  // USD per 1M output tokens
}

// Prices in USD per 1M tokens
const PRICING_TABLE: Record<string, ModelPricing> = {
  // OpenAI - GPT-4
  "gpt-4o": { inputPerMToken: 2.50, outputPerMToken: 10.00 },
  "gpt-4o-mini": { inputPerMToken: 0.15, outputPerMToken: 0.60 },
  "gpt-4-turbo": { inputPerMToken: 10.00, outputPerMToken: 30.00 },
  "gpt-4.1": { inputPerMToken: 2.00, outputPerMToken: 8.00 },
  "gpt-4.1-mini": { inputPerMToken: 0.10, outputPerMToken: 0.40 },
  "gpt-4.1-nano": { inputPerMToken: 0.05, outputPerMToken: 0.20 },
  // OpenAI - o-series
  "o1": { inputPerMToken: 15.00, outputPerMToken: 60.00 },
  "o1-mini": { inputPerMToken: 3.00, outputPerMToken: 12.00 },
  "o1-pro": { inputPerMToken: 150.00, outputPerMToken: 600.00 },
  "o3": { inputPerMToken: 20.00, outputPerMToken: 80.00 },
  "o3-mini": { inputPerMToken: 1.10, outputPerMToken: 4.40 },
  "o4-mini": { inputPerMToken: 1.50, outputPerMToken: 6.00 },
  // OpenAI - GPT-5
  "gpt-5": { inputPerMToken: 5.00, outputPerMToken: 20.00 },
  "gpt-5-mini": { inputPerMToken: 0.50, outputPerMToken: 2.00 },
  "gpt-5-nano": { inputPerMToken: 0.25, outputPerMToken: 1.00 },
  "gpt-5-pro": { inputPerMToken: 15.00, outputPerMToken: 60.00 },
  "gpt-5-codex": { inputPerMToken: 3.00, outputPerMToken: 12.00 },
  // OpenAI - GPT-5.1
  "gpt-5.1": { inputPerMToken: 4.00, outputPerMToken: 16.00 },
  "gpt-5.1-codex": { inputPerMToken: 2.50, outputPerMToken: 10.00 },
  "gpt-5.1-codex-mini": { inputPerMToken: 0.50, outputPerMToken: 2.00 },
  "gpt-5.1-codex-max": { inputPerMToken: 8.00, outputPerMToken: 32.00 },
  // OpenAI - GPT-5.2
  "gpt-5.2": { inputPerMToken: 1.75, outputPerMToken: 14.00 },
  "gpt-5.2-pro": { inputPerMToken: 10.00, outputPerMToken: 40.00 },
  "gpt-5.2-codex": { inputPerMToken: 3.00, outputPerMToken: 12.00 },

  // Anthropic
  "claude-opus-4-5-20251101": { inputPerMToken: 15.00, outputPerMToken: 75.00 },
  "claude-sonnet-4-5-20250929": { inputPerMToken: 3.00, outputPerMToken: 15.00 },
  "claude-sonnet-4-20250514": { inputPerMToken: 3.00, outputPerMToken: 15.00 },
  "claude-haiku-4-5-20251001": { inputPerMToken: 0.80, outputPerMToken: 4.00 },

  // Google
  "gemini-3-pro-preview": { inputPerMToken: 2.50, outputPerMToken: 10.00 },
  "gemini-3-flash-preview": { inputPerMToken: 0.20, outputPerMToken: 0.80 },
  "gemini-2.5-pro": { inputPerMToken: 1.25, outputPerMToken: 5.00 },
  "gemini-2.5-flash": { inputPerMToken: 0.15, outputPerMToken: 0.60 },
  "gemini-2.5-flash-lite": { inputPerMToken: 0.075, outputPerMToken: 0.30 },

  // Mistral
  "mistral-large-latest": { inputPerMToken: 2.00, outputPerMToken: 6.00 },
  "mistral-small-latest": { inputPerMToken: 0.20, outputPerMToken: 0.60 },
  "codestral-latest": { inputPerMToken: 0.30, outputPerMToken: 0.90 },

  // Cohere
  "command-r-plus": { inputPerMToken: 2.50, outputPerMToken: 10.00 },
  "command-r": { inputPerMToken: 0.15, outputPerMToken: 0.60 },

  // DeepSeek
  "deepseek-chat": { inputPerMToken: 0.27, outputPerMToken: 1.10 },
  "deepseek-reasoner": { inputPerMToken: 0.55, outputPerMToken: 2.19 },

  // Moonshot / Kimi
  "moonshot-v1-8k": { inputPerMToken: 0.20, outputPerMToken: 2.00 },
  "moonshot-v1-32k": { inputPerMToken: 1.00, outputPerMToken: 3.00 },
  "moonshot-v1-128k": { inputPerMToken: 0.60, outputPerMToken: 2.50 },
  "kimi-k2.5": { inputPerMToken: 0.60, outputPerMToken: 2.50 },
  "kimi-k2-thinking": { inputPerMToken: 0.60, outputPerMToken: 2.50 },

  // Zhipu (GLM) / Z.ai
  "glm-4.7": { inputPerMToken: 0.28, outputPerMToken: 1.11 },
  "glm-4.7-flash": { inputPerMToken: 0, outputPerMToken: 0 },
  "glm-4.5": { inputPerMToken: 0.20, outputPerMToken: 0.80 },
  "glm-4.5-flash": { inputPerMToken: 0, outputPerMToken: 0 },
  "glm-4": { inputPerMToken: 0.14, outputPerMToken: 0.42 },
  "glm-4-air": { inputPerMToken: 0.11, outputPerMToken: 0.28 },
  "glm-4-flash": { inputPerMToken: 0, outputPerMToken: 0 },

  // MiniMax
  "MiniMax-M2.1": { inputPerMToken: 0.30, outputPerMToken: 1.20 },
  "MiniMax-M2.1-lightning": { inputPerMToken: 0.15, outputPerMToken: 0.60 },
  "MiniMax-M2": { inputPerMToken: 0.30, outputPerMToken: 1.20 },
  "M2-her": { inputPerMToken: 0.30, outputPerMToken: 1.20 },

  // Baichuan
  "Baichuan4-Air": { inputPerMToken: 0.49, outputPerMToken: 0.99 },
  "Baichuan4-Turbo": { inputPerMToken: 1.00, outputPerMToken: 2.00 },
  "Baichuan4": { inputPerMToken: 2.00, outputPerMToken: 4.00 },
};

/**
 * Normalize model name by stripping date version suffix.
 * e.g. "gpt-4o-2024-08-06" -> "gpt-4o"
 *      "o1-2024-12-17" -> "o1"
 *      "gpt-4o-mini-2024-07-18" -> "gpt-4o-mini"
 */
export function normalizeModelName(model: string): string {
  // Strip date suffix like -2024-08-06 or -2025-01-31
  return model.replace(/-\d{4}-\d{2}-\d{2}$/, "");
}

export function getModelPricing(model: string): ModelPricing | null {
  // Try exact match first
  if (PRICING_TABLE[model]) return PRICING_TABLE[model];
  if (PRICING_TABLE[model.toLowerCase()]) return PRICING_TABLE[model.toLowerCase()];

  // Try with normalized name (strip date suffix)
  const normalized = normalizeModelName(model);
  if (PRICING_TABLE[normalized]) return PRICING_TABLE[normalized];
  if (PRICING_TABLE[normalized.toLowerCase()]) return PRICING_TABLE[normalized.toLowerCase()];

  return null;
}

/**
 * Cache token rate multipliers (relative to base input rate)
 * - Anthropic: cache_creation = 0.62x (empirically derived, docs say 1.25x), cache_read = 0.1x
 * - OpenAI: cached_input = 0.5x (for supported models)
 *
 * Note: Cost estimates may differ from actual billing. Always verify with official console.
 */
export const CACHE_RATE_MULTIPLIERS = {
  anthropic: {
    cacheCreation: 0.62,  // cache_creation_input_tokens (empirically derived)
    cacheRead: 0.10,      // cache_read_input_tokens
  },
  openai: {
    cachedInput: 0.50,    // cached input tokens
  },
} as const;

export interface CacheTokens {
  /** Anthropic: cache_creation_input_tokens */
  cacheCreation?: number;
  /** Anthropic: cache_read_input_tokens */
  cacheRead?: number;
  /** OpenAI: cached input tokens */
  cachedInput?: number;
}

export function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
  cacheTokens?: CacheTokens,
  provider?: string
): number | null {
  if (tokensIn < 0 || tokensOut < 0) return null;

  const pricing = getModelPricing(model);
  if (!pricing) return null;

  const inputRate = pricing.inputPerMToken;
  const outputRate = pricing.outputPerMToken;

  const isAnthropic = provider === "anthropic" || model.startsWith("claude");
  const isOpenAI = provider === "openai" || model.startsWith("gpt") || model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4");

  // For Anthropic: tokensIn from API includes cache tokens, so we need to:
  // 1. Subtract cache tokens to get uncached input
  // 2. Charge uncached at full rate, cache_creation at 1.25x, cache_read at 0.1x
  let uncachedIn = tokensIn;
  let cacheCost = 0;

  if (cacheTokens && isAnthropic) {
    const rates = CACHE_RATE_MULTIPLIERS.anthropic;
    const cacheCreation = cacheTokens.cacheCreation ?? 0;
    const cacheRead = cacheTokens.cacheRead ?? 0;

    // Subtract cache tokens from input to get uncached count
    uncachedIn = Math.max(0, tokensIn - cacheCreation - cacheRead);

    // Add cache-specific costs
    if (cacheCreation > 0) {
      cacheCost += (cacheCreation / 1_000_000) * inputRate * rates.cacheCreation;
    }
    if (cacheRead > 0) {
      cacheCost += (cacheRead / 1_000_000) * inputRate * rates.cacheRead;
    }
  } else if (cacheTokens && isOpenAI) {
    const rates = CACHE_RATE_MULTIPLIERS.openai;
    const cachedInput = cacheTokens.cachedInput ?? 0;

    // For OpenAI: subtract cached tokens, charge at 0.5x rate
    uncachedIn = Math.max(0, tokensIn - cachedInput);
    if (cachedInput > 0) {
      cacheCost += (cachedInput / 1_000_000) * inputRate * rates.cachedInput;
    }
  }

  // Base input/output cost (using uncached input count)
  const inputCost = (uncachedIn / 1_000_000) * inputRate;
  const outputCost = (tokensOut / 1_000_000) * outputRate;

  // Round to 10 decimal places to mitigate floating-point arithmetic drift
  return Math.round((inputCost + outputCost + cacheCost) * 1e10) / 1e10;
}

export function listSupportedModels(): string[] {
  return Object.keys(PRICING_TABLE);
}

export interface ProviderModel {
  id: string;
  inputPrice: number;
  outputPrice: number;
}

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: [
    "gpt-5.2-pro", "gpt-5.2", "gpt-5.2-codex",
    "gpt-5.1", "gpt-5.1-codex", "gpt-5.1-codex-mini", "gpt-5.1-codex-max",
    "gpt-5-pro", "gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5-codex",
    "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini",
    "o3", "o3-mini", "o4-mini", "o1", "o1-pro",
  ],
  anthropic: ["claude-opus-4-5-20251101", "claude-sonnet-4-5-20250929", "claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
  google: ["gemini-3-pro-preview", "gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
  mistral: ["mistral-large-latest", "mistral-small-latest", "codestral-latest"],
  cohere: ["command-r-plus", "command-r"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  moonshot: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k", "kimi-k2.5", "kimi-k2-thinking"],
  zhipu: ["glm-4.7", "glm-4.7-flash", "glm-4.5", "glm-4.5-flash", "glm-4", "glm-4-air", "glm-4-flash"],
  minimax: ["MiniMax-M2.1", "MiniMax-M2.1-lightning", "MiniMax-M2", "M2-her"],
  baichuan: ["Baichuan4-Air", "Baichuan4-Turbo", "Baichuan4"],
};

export function getProviderModels(provider: string): ProviderModel[] {
  const modelIds = PROVIDER_MODELS[provider];
  if (!modelIds) return [];

  return modelIds.map((id) => {
    const pricing = PRICING_TABLE[id];
    return {
      id,
      inputPrice: pricing?.inputPerMToken ?? 0,
      outputPrice: pricing?.outputPerMToken ?? 0,
    };
  });
}
