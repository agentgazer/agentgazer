/**
 * Selectable models per provider for dashboard dropdowns and OpenClaw config.
 * Single source of truth for all model lists.
 * Only includes commonly available models (excludes those requiring special access).
 */
export const SELECTABLE_MODELS: Record<string, string[]> = {
  openai: [
    // GPT-5.2
    "gpt-5.2-pro",
    "gpt-5.2",
    "gpt-5.2-codex",
    // GPT-5.1
    "gpt-5.1",
    "gpt-5.1-codex",
    "gpt-5.1-codex-mini",
    "gpt-5.1-codex-max",
    // GPT-5
    "gpt-5-pro",
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-5-codex",
    // GPT-4
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4o",
    "gpt-4o-mini",
    // o-series
    "o3",
    "o3-mini",
    "o4-mini",
    "o1",
    "o1-pro",
  ],
  // OpenAI OAuth (Codex subscription) - Codex-specific models
  "openai-oauth": [
    "gpt-5.3-codex",
    "gpt-5.2-codex",
    "gpt-5.1-codex",
    "gpt-5.1-codex-mini",
    "gpt-5.1-codex-max",
    "gpt-5-codex",
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
  "zhipu-coding-plan": [
    "glm-5",
    "glm-4.7",
    "glm-4.6",
    "glm-4.5",
    "glm-4.5-air",
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
