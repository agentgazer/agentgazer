/**
 * Selectable models per provider for dashboard dropdowns.
 * Only includes commonly available models (excludes those requiring special access).
 */
export const SELECTABLE_MODELS: Record<string, string[]> = {
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "o1",
    "o1-mini",
    "o1-pro",
    "o3-mini",
  ],
  anthropic: [
    "claude-opus-4-5-20251101",
    "claude-sonnet-4-5-20250929",
    "claude-sonnet-4-20250514",
    "claude-haiku-4-5-20251001",
  ],
  google: [
    "gemini-3-pro-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
  ],
  mistral: [
    "mistral-large-latest",
    "mistral-medium-latest",
    "mistral-small-latest",
    "codestral-latest",
    "open-mistral-7b",
    "open-mixtral-8x7b",
    "open-mixtral-8x22b",
  ],
  cohere: [
    "command-r-plus",
    "command-r",
    "command",
    "command-light",
  ],
  deepseek: [
    "deepseek-chat",
    "deepseek-coder",
    "deepseek-reasoner",
  ],
  moonshot: [
    "moonshot-v1-8k",
    "moonshot-v1-32k",
    "moonshot-v1-128k",
    "kimi-k2.5",
    "kimi-k2-thinking",
  ],
  zhipu: [
    "glm-4.7",
    "glm-4.7-flash",
    "glm-4.5",
    "glm-4.5-flash",
    "glm-4",
    "glm-4-air",
    "glm-4-flash",
  ],
  minimax: [
    "MiniMax-M2.1",
    "MiniMax-M2.1-lightning",
    "MiniMax-M2",
    "M2-her",
  ],
  yi: [
    "yi-large",
    "yi-medium",
    "yi-spark",
  ],
};

/**
 * Get selectable models for a specific provider.
 * Returns empty array if provider is unknown.
 */
export function getSelectableModels(provider: string): string[] {
  return SELECTABLE_MODELS[provider.toLowerCase()] ?? [];
}

/** Alias for SELECTABLE_MODELS for API consistency */
export const PROVIDER_MODELS = SELECTABLE_MODELS;
