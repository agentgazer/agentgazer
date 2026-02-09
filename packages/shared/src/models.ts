/**
 * Selectable models per provider for dashboard dropdowns and OpenClaw config.
 * Single source of truth for all model lists.
 * Only includes commonly available models (excludes those requiring special access).
 */
export const SELECTABLE_MODELS: Record<string, string[]> = {
  openai: [
    "gpt-5.2-pro",
    "gpt-5.2",
    "gpt-5.2-codex",
    "gpt-5",
    "gpt-5-mini",
    "gpt-4o",
    "gpt-4o-mini",
    "o1",
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
    "mistral-small-latest",
    "codestral-latest",
  ],
  cohere: [
    "command-a-03-2025",
    "command-r-plus-08-2024",
    "command-r-08-2024",
    "command-r7b-12-2024",
  ],
  deepseek: [
    "deepseek-chat",
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
  ],
  minimax: [
    "MiniMax-M2.1",
    "MiniMax-M2.1-lightning",
    "MiniMax-M2",
    "M2-her",
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
