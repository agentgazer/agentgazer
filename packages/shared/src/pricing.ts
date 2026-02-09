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
