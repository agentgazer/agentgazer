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
  "gpt-4": { inputPerMToken: 30.00, outputPerMToken: 60.00 },
  "gpt-3.5-turbo": { inputPerMToken: 0.50, outputPerMToken: 1.50 },
  "o1": { inputPerMToken: 15.00, outputPerMToken: 60.00 },
  "o1-mini": { inputPerMToken: 3.00, outputPerMToken: 12.00 },
  "o3-mini": { inputPerMToken: 1.10, outputPerMToken: 4.40 },

  // Anthropic
  "claude-opus-4-20250514": { inputPerMToken: 15.00, outputPerMToken: 75.00 },
  "claude-sonnet-4-20250514": { inputPerMToken: 3.00, outputPerMToken: 15.00 },
  "claude-3-5-haiku-20241022": { inputPerMToken: 0.80, outputPerMToken: 4.00 },

  // Google
  "gemini-2.0-flash": { inputPerMToken: 0.10, outputPerMToken: 0.40 },
  "gemini-1.5-pro": { inputPerMToken: 1.25, outputPerMToken: 5.00 },
  "gemini-1.5-flash": { inputPerMToken: 0.075, outputPerMToken: 0.30 },

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

  // Moonshot
  "moonshot-v1-8k": { inputPerMToken: 0.20, outputPerMToken: 2.00 },
  "moonshot-v1-32k": { inputPerMToken: 1.00, outputPerMToken: 3.00 },
  "moonshot-v1-128k": { inputPerMToken: 0.60, outputPerMToken: 2.50 },

  // Zhipu (GLM)
  "glm-4.7": { inputPerMToken: 0.28, outputPerMToken: 1.11 },
  "glm-4.7-flash": { inputPerMToken: 0, outputPerMToken: 0 },
  "glm-4": { inputPerMToken: 0.14, outputPerMToken: 0.42 },
  "glm-4-air": { inputPerMToken: 0.11, outputPerMToken: 0.28 },
  "glm-4-flash": { inputPerMToken: 0, outputPerMToken: 0 },

  // MiniMax
  "MiniMax-M2": { inputPerMToken: 0.30, outputPerMToken: 1.20 },
  "MiniMax-01": { inputPerMToken: 0.20, outputPerMToken: 1.10 },

  // Baichuan
  "Baichuan4": { inputPerMToken: 13.89, outputPerMToken: 13.89 },
  "Baichuan3-Turbo": { inputPerMToken: 1.39, outputPerMToken: 1.39 },

  // Yi (01.AI)
  "yi-lightning": { inputPerMToken: 0.14, outputPerMToken: 0.14 },
  "yi-large": { inputPerMToken: 2.78, outputPerMToken: 2.78 },
  "yi-medium": { inputPerMToken: 0.35, outputPerMToken: 0.35 },
};

export function getModelPricing(model: string): ModelPricing | null {
  return PRICING_TABLE[model] ?? null;
}

export function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number
): number | null {
  const pricing = getModelPricing(model);
  if (!pricing) return null;

  const inputCost = (tokensIn / 1_000_000) * pricing.inputPerMToken;
  const outputCost = (tokensOut / 1_000_000) * pricing.outputPerMToken;
  return inputCost + outputCost;
}

export function listSupportedModels(): string[] {
  return Object.keys(PRICING_TABLE);
}
