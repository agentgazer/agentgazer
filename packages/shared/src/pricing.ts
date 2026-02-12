import { isSubscriptionProvider, type ProviderName } from "./providers.js";

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
  "gpt-4.1-mini": { inputPerMToken: 0.40, outputPerMToken: 1.60 },
  "gpt-4.1-nano": { inputPerMToken: 0.10, outputPerMToken: 0.40 },
  // OpenAI - o-series
  "o1": { inputPerMToken: 15.00, outputPerMToken: 60.00 },
  "o1-mini": { inputPerMToken: 1.10, outputPerMToken: 4.40 },
  "o1-pro": { inputPerMToken: 150.00, outputPerMToken: 600.00 },
  "o3": { inputPerMToken: 2.00, outputPerMToken: 8.00 },
  "o3-mini": { inputPerMToken: 1.10, outputPerMToken: 4.40 },
  "o3-pro": { inputPerMToken: 20.00, outputPerMToken: 80.00 },
  "o3-deep-research": { inputPerMToken: 10.00, outputPerMToken: 40.00 },
  "o4-mini": { inputPerMToken: 1.10, outputPerMToken: 4.40 },
  "o4-mini-deep-research": { inputPerMToken: 2.00, outputPerMToken: 8.00 },
  // OpenAI - GPT-5
  "gpt-5": { inputPerMToken: 1.25, outputPerMToken: 10.00 },
  "gpt-5-mini": { inputPerMToken: 0.25, outputPerMToken: 2.00 },
  "gpt-5-nano": { inputPerMToken: 0.05, outputPerMToken: 0.40 },
  "gpt-5-pro": { inputPerMToken: 15.00, outputPerMToken: 120.00 },
  "gpt-5-codex": { inputPerMToken: 1.25, outputPerMToken: 10.00 },
  // OpenAI - GPT-5.1
  "gpt-5.1": { inputPerMToken: 1.25, outputPerMToken: 10.00 },
  "gpt-5.1-codex": { inputPerMToken: 1.25, outputPerMToken: 10.00 },
  "gpt-5.1-codex-mini": { inputPerMToken: 0.25, outputPerMToken: 2.00 },
  "gpt-5.1-codex-max": { inputPerMToken: 1.25, outputPerMToken: 10.00 },
  // OpenAI - GPT-5.2
  "gpt-5.2": { inputPerMToken: 1.75, outputPerMToken: 14.00 },
  "gpt-5.2-pro": { inputPerMToken: 21.00, outputPerMToken: 168.00 },
  "gpt-5.2-codex": { inputPerMToken: 1.75, outputPerMToken: 14.00 },
  // OpenAI - GPT-5.3
  "gpt-5.3-codex": { inputPerMToken: 1.75, outputPerMToken: 14.00 },
  // OpenAI - Codex
  "codex-mini-latest": { inputPerMToken: 1.50, outputPerMToken: 6.00 },

  // Anthropic
  "claude-opus-4-6": { inputPerMToken: 5.00, outputPerMToken: 25.00 },
  "claude-opus-4-5-20251101": { inputPerMToken: 5.00, outputPerMToken: 25.00 },
  "claude-opus-4-1": { inputPerMToken: 15.00, outputPerMToken: 75.00 },
  "claude-sonnet-4-5-20250929": { inputPerMToken: 3.00, outputPerMToken: 15.00 },
  "claude-sonnet-4-20250514": { inputPerMToken: 3.00, outputPerMToken: 15.00 },
  "claude-3-7-sonnet-latest": { inputPerMToken: 3.00, outputPerMToken: 15.00 },
  "claude-haiku-4-5-20251001": { inputPerMToken: 1.00, outputPerMToken: 5.00 },
  "claude-3-5-haiku-latest": { inputPerMToken: 0.80, outputPerMToken: 4.00 },

  // Google
  "gemini-3-pro-preview": { inputPerMToken: 2.00, outputPerMToken: 12.00 },
  "gemini-3-flash-preview": { inputPerMToken: 0.50, outputPerMToken: 3.00 },
  "gemini-2.5-pro": { inputPerMToken: 1.25, outputPerMToken: 10.00 },
  "gemini-2.5-flash": { inputPerMToken: 0.30, outputPerMToken: 2.50 },
  "gemini-2.5-flash-lite": { inputPerMToken: 0.10, outputPerMToken: 0.40 },

  // Mistral
  "mistral-large-latest": { inputPerMToken: 0.50, outputPerMToken: 1.50 },
  "mistral-medium-latest": { inputPerMToken: 0.40, outputPerMToken: 2.00 },
  "mistral-small-latest": { inputPerMToken: 0.10, outputPerMToken: 0.30 },
  "mistral-nemo": { inputPerMToken: 0.15, outputPerMToken: 0.15 },
  "codestral-latest": { inputPerMToken: 0.30, outputPerMToken: 0.90 },
  "magistral-medium-latest": { inputPerMToken: 2.00, outputPerMToken: 5.00 },
  "magistral-small": { inputPerMToken: 0.50, outputPerMToken: 1.50 },

  // DeepSeek (V3.2 unified pricing)
  "deepseek-chat": { inputPerMToken: 0.28, outputPerMToken: 0.42 },
  "deepseek-reasoner": { inputPerMToken: 0.28, outputPerMToken: 0.42 },

  // Moonshot / Kimi
  "moonshot-v1-8k": { inputPerMToken: 0.20, outputPerMToken: 2.00 },
  "moonshot-v1-32k": { inputPerMToken: 1.00, outputPerMToken: 3.00 },
  "moonshot-v1-128k": { inputPerMToken: 0.60, outputPerMToken: 2.50 },
  "kimi-k2.5": { inputPerMToken: 0.60, outputPerMToken: 2.50 },
  "kimi-k2-thinking": { inputPerMToken: 0.60, outputPerMToken: 2.50 },

  // Zhipu (GLM) / Z.ai
  "glm-4.7": { inputPerMToken: 0.60, outputPerMToken: 2.20 },
  "glm-4.7-flashx": { inputPerMToken: 0.07, outputPerMToken: 0.40 },
  "glm-4.7-flash": { inputPerMToken: 0, outputPerMToken: 0 },
  "glm-4.6": { inputPerMToken: 0.60, outputPerMToken: 2.20 },
  "glm-4.5": { inputPerMToken: 0.60, outputPerMToken: 2.20 },
  "glm-4.5-x": { inputPerMToken: 2.20, outputPerMToken: 8.90 },
  "glm-4.5-air": { inputPerMToken: 0.20, outputPerMToken: 1.10 },
  "glm-4.5-airx": { inputPerMToken: 1.10, outputPerMToken: 4.50 },
  "glm-4.5-flash": { inputPerMToken: 0, outputPerMToken: 0 },

  // MiniMax
  "minimax-01": { inputPerMToken: 0.20, outputPerMToken: 1.10 },
  "minimax-m1": { inputPerMToken: 0.40, outputPerMToken: 2.20 },
  "minimax-m2": { inputPerMToken: 0.255, outputPerMToken: 1.00 },
  "minimax-m2.1": { inputPerMToken: 0.27, outputPerMToken: 0.95 },
  "minimax-m2-her": { inputPerMToken: 0.30, outputPerMToken: 1.20 },

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

  // Subscription providers (e.g., openai-oauth) have no per-token cost
  if (provider && isSubscriptionProvider(provider as ProviderName)) {
    return 0;
  }

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
    "gpt-5.3-codex",
    "gpt-5.2-pro", "gpt-5.2", "gpt-5.2-codex",
    "gpt-5.1", "gpt-5.1-codex", "gpt-5.1-codex-mini", "gpt-5.1-codex-max",
    "gpt-5-pro", "gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5-codex",
    "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini",
    "o3", "o3-mini", "o3-pro", "o4-mini", "o1", "o1-pro",
  ],
  anthropic: ["claude-opus-4-6", "claude-opus-4-5-20251101", "claude-sonnet-4-5-20250929", "claude-sonnet-4-20250514", "claude-3-7-sonnet-latest", "claude-haiku-4-5-20251001", "claude-3-5-haiku-latest"],
  google: ["gemini-3-pro-preview", "gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
  mistral: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "mistral-nemo", "codestral-latest", "magistral-medium-latest", "magistral-small"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  moonshot: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k", "kimi-k2.5", "kimi-k2-thinking"],
  zhipu: ["glm-4.7", "glm-4.7-flashx", "glm-4.7-flash", "glm-4.6", "glm-4.5", "glm-4.5-x", "glm-4.5-air", "glm-4.5-airx", "glm-4.5-flash"],
  "zhipu-coding-plan": ["glm-4.7", "glm-4.7-flashx", "glm-4.7-flash", "glm-4.6", "glm-4.5", "glm-4.5-x", "glm-4.5-air", "glm-4.5-airx", "glm-4.5-flash"],
  minimax: ["minimax-01", "minimax-m1", "minimax-m2", "minimax-m2.1", "minimax-m2-her"],
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
