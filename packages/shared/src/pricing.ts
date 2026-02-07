export interface ModelPricing {
  inputPerMToken: number;   // USD per 1M input tokens
  outputPerMToken: number;  // USD per 1M output tokens
}

// Prices in USD per 1M tokens
const PRICING_TABLE: Record<string, ModelPricing> = {
  // OpenAI
  "gpt-4o": { inputPerMToken: 2.50, outputPerMToken: 10.00 },
  "gpt-4o-mini": { inputPerMToken: 0.15, outputPerMToken: 0.60 },
  "gpt-4-turbo": { inputPerMToken: 10.00, outputPerMToken: 30.00 },
  "o1": { inputPerMToken: 15.00, outputPerMToken: 60.00 },
  "o1-mini": { inputPerMToken: 3.00, outputPerMToken: 12.00 },
  "o1-pro": { inputPerMToken: 150.00, outputPerMToken: 600.00 },
  "o3-mini": { inputPerMToken: 1.10, outputPerMToken: 4.40 },

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

  // Yi (01.AI)
  "yi-lightning": { inputPerMToken: 0.14, outputPerMToken: 0.14 },
  "yi-large": { inputPerMToken: 2.78, outputPerMToken: 2.78 },
  "yi-medium": { inputPerMToken: 0.35, outputPerMToken: 0.35 },
};

export function getModelPricing(model: string): ModelPricing | null {
  return PRICING_TABLE[model] ?? PRICING_TABLE[model.toLowerCase()] ?? null;
}

export function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number
): number | null {
  if (tokensIn < 0 || tokensOut < 0) return null;

  const pricing = getModelPricing(model);
  if (!pricing) return null;

  const inputCost = (tokensIn / 1_000_000) * pricing.inputPerMToken;
  const outputCost = (tokensOut / 1_000_000) * pricing.outputPerMToken;
  // Round to 10 decimal places to mitigate floating-point arithmetic drift
  return Math.round((inputCost + outputCost) * 1e10) / 1e10;
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
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o1-mini", "o1-pro", "o3-mini"],
  anthropic: ["claude-opus-4-5-20251101", "claude-sonnet-4-5-20250929", "claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
  google: ["gemini-3-pro-preview", "gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
  mistral: ["mistral-large-latest", "mistral-small-latest", "codestral-latest"],
  cohere: ["command-r-plus", "command-r"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  moonshot: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k", "kimi-k2.5", "kimi-k2-thinking"],
  zhipu: ["glm-4.7", "glm-4.7-flash", "glm-4.5", "glm-4.5-flash", "glm-4", "glm-4-air", "glm-4-flash"],
  minimax: ["MiniMax-M2.1", "MiniMax-M2.1-lightning", "MiniMax-M2", "M2-her"],
  yi: ["yi-lightning", "yi-large", "yi-medium"],
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
