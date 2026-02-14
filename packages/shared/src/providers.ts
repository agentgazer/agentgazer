export type ProviderName =
  | "openai"
  | "openai-oauth"
  | "anthropic"
  | "google"
  | "mistral"
  | "deepseek"
  | "moonshot"
  | "zhipu"
  | "zhipu-coding-plan"
  | "minimax"
  | "minimax-oauth"
  | "baichuan"
  | "agentgazer"
  | "unknown";

interface ProviderPattern {
  name: ProviderName;
  hostPatterns: RegExp[];
  pathPatterns?: RegExp[];
}

/** Mapping of provider names to their popular model names for display. */
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: "OpenAI (API Key)",
  "openai-oauth": "OpenAI (Codex OAuth)",
  anthropic: "Anthropic (Claude)",
  google: "Google (Gemini)",
  mistral: "Mistral",
  deepseek: "DeepSeek",
  moonshot: "Moonshot (Kimi)",
  zhipu: "Zhipu (GLM-4)",
  "zhipu-coding-plan": "Zhipu (GLM Coding Plan)",
  minimax: "MiniMax (API Key)",
  "minimax-oauth": "MiniMax (Coding Plan)",
  baichuan: "Baichuan",
  agentgazer: "AgentGazer (Proxy)",
};

/** All known provider names (excludes "unknown"). Single source of truth. */
export const KNOWN_PROVIDER_NAMES: ProviderName[] = [
  "openai",
  "openai-oauth",
  "anthropic",
  "google",
  "mistral",
  "deepseek",
  "moonshot",
  "zhipu",
  "zhipu-coding-plan",
  "minimax",
  "minimax-oauth",
  "baichuan",
  "agentgazer",
];

/**
 * Provider names available for user selection in UI/CLI.
 * Excludes providers without active API access.
 */
export const SELECTABLE_PROVIDER_NAMES: ProviderName[] = [
  "openai",
  "openai-oauth",
  "anthropic",
  "google",
  "mistral",
  "deepseek",
  "moonshot",
  "zhipu",
  "zhipu-coding-plan",
  "minimax",
  "minimax-oauth",
  "baichuan",
];

const PROVIDER_PATTERNS: ProviderPattern[] = [
  {
    name: "openai",
    hostPatterns: [/^api\.openai\.com$/],
    pathPatterns: [/\/v1\/chat\/completions/, /\/v1\/completions/],
  },
  {
    name: "anthropic",
    hostPatterns: [/^api\.anthropic\.com$/],
    pathPatterns: [/\/v1\/messages/],
  },
  {
    name: "google",
    hostPatterns: [/^generativelanguage\.googleapis\.com$/],
  },
  {
    name: "mistral",
    hostPatterns: [/^api\.mistral\.ai$/],
  },
  {
    name: "deepseek",
    hostPatterns: [/^api\.deepseek\.com$/],
  },
  {
    name: "moonshot",
    hostPatterns: [/^api\.moonshot\.ai$/, /^api\.moonshot\.cn$/],
  },
  {
    name: "zhipu",
    hostPatterns: [/^open\.bigmodel\.cn$/, /^api\.z\.ai$/],
  },
  {
    name: "minimax",
    hostPatterns: [/^api\.minimax\.io$/, /^api\.minimax\.chat$/],
  },
  {
    name: "baichuan",
    hostPatterns: [/^api\.baichuan-ai\.com$/],
  },
];

export function detectProvider(url: string): ProviderName {
  let hostname = "";
  let pathname = url;
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname;
    pathname = parsed.pathname;
  } catch {
    // If URL can't be parsed, fall through to path-only matching
  }

  for (const provider of PROVIDER_PATTERNS) {
    if (hostname) {
      for (const hostPattern of provider.hostPatterns) {
        if (hostPattern.test(hostname)) {
          return provider.name;
        }
      }
    }
    if (provider.pathPatterns) {
      for (const pathPattern of provider.pathPatterns) {
        if (pathPattern.test(pathname)) {
          return provider.name;
        }
      }
    }
  }
  return "unknown";
}

/**
 * Detect provider by hostname only. Returns "unknown" for path-only matches.
 * Used for key injection and rate limiting where hostname trust is required.
 */
export function detectProviderByHostname(url: string): ProviderName {
  let hostname = "";
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname;
  } catch {
    return "unknown";
  }

  if (!hostname) return "unknown";

  for (const provider of PROVIDER_PATTERNS) {
    for (const hostPattern of provider.hostPatterns) {
      if (hostPattern.test(hostname)) {
        return provider.name;
      }
    }
  }
  return "unknown";
}

export function getProviderBaseUrl(provider: ProviderName): string | null {
  // Base URLs include version path so users can set OPENAI_BASE_URL=http://localhost:4000/openai
  // and the SDK will send /openai/chat/completions which becomes /v1/chat/completions
  const urls: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    "openai-oauth": "https://chatgpt.com/backend-api/codex",  // Codex uses different API
    anthropic: "https://api.anthropic.com/v1",
    google: "https://generativelanguage.googleapis.com/v1beta/openai",
    mistral: "https://api.mistral.ai/v1",
    deepseek: "https://api.deepseek.com/v1",
    moonshot: "https://api.moonshot.ai/v1",
    zhipu: "https://api.z.ai/api/paas/v4",
    "zhipu-coding-plan": "https://api.z.ai/api/coding/paas/v4",
    minimax: "https://api.minimax.io/v1",
    "minimax-oauth": "https://api.minimax.io/anthropic",  // Uses Anthropic Messages API format
    baichuan: "https://api.baichuan-ai.com/v1",
  };
  return urls[provider] ?? null;
}

/**
 * Returns the root API URL for a provider for path-based routing.
 * Includes version prefix where needed (e.g., /v1beta for Google).
 * Used for providers that need path-based routing (e.g., Google's native API).
 */
export function getProviderRootUrl(provider: ProviderName): string | null {
  const urls: Record<string, string> = {
    openai: "https://api.openai.com",
    "openai-oauth": "https://chatgpt.com",  // Codex uses different API
    anthropic: "https://api.anthropic.com",
    google: "https://generativelanguage.googleapis.com/v1beta",  // Include version prefix
    mistral: "https://api.mistral.ai",
    deepseek: "https://api.deepseek.com",
    moonshot: "https://api.moonshot.ai",
    zhipu: "https://api.z.ai",
    "zhipu-coding-plan": "https://api.z.ai",
    minimax: "https://api.minimax.io",
    "minimax-oauth": "https://api.minimax.io/anthropic",  // Uses Anthropic Messages API format
    baichuan: "https://api.baichuan-ai.com",
  };
  return urls[provider] ?? null;
}

/**
 * Check if a provider uses path-based routing (client provides the full path).
 * These providers expect the trailing path to be preserved, not replaced with a fixed endpoint.
 */
export function providerUsesPathRouting(provider: ProviderName): boolean {
  // Google's native API uses paths like /v1beta/models/{model}:generateContent
  return provider === "google";
}

/**
 * Returns the complete chat endpoint URL for a provider.
 * This is the full URL including path - no additional path construction needed.
 * Returns null for unknown providers.
 */
export function getProviderChatEndpoint(provider: ProviderName): string | null {
  const endpoints: Record<string, string> = {
    openai: "https://api.openai.com/v1/chat/completions",
    "openai-oauth": "https://chatgpt.com/backend-api/codex/responses",  // Codex API endpoint
    anthropic: "https://api.anthropic.com/v1/messages",
    google: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    mistral: "https://api.mistral.ai/v1/chat/completions",
    deepseek: "https://api.deepseek.com/v1/chat/completions",
    moonshot: "https://api.moonshot.ai/v1/chat/completions",
    zhipu: "https://api.z.ai/api/paas/v4/chat/completions",
    "zhipu-coding-plan": "https://api.z.ai/api/coding/paas/v4/chat/completions",
    minimax: "https://api.minimax.io/v1/text/chatcompletion_v2",
    "minimax-oauth": "https://api.minimax.io/anthropic/v1/messages",  // Anthropic Messages format
    baichuan: "https://api.baichuan-ai.com/v1/chat/completions",
  };
  return endpoints[provider] ?? null;
}

/**
 * Returns the auth header name and value for a given provider.
 * Different providers use different header conventions.
 * @param useNativeApi - For Google, whether to use native API auth (x-goog-api-key) vs OpenAI-compatible (Bearer)
 */
export function getProviderAuthHeader(
  provider: ProviderName,
  apiKey: string,
  useNativeApi: boolean = false
): { name: string; value: string } | null {
  switch (provider) {
    case "openai":
    case "openai-oauth":
    case "mistral":
    case "deepseek":
    case "moonshot":
    case "zhipu":
    case "zhipu-coding-plan":
    case "minimax":
    case "minimax-oauth":
    case "baichuan":
      return { name: "authorization", value: `Bearer ${apiKey}` };
    case "anthropic":
      return { name: "x-api-key", value: apiKey };
    case "google":
      // Google native API uses x-goog-api-key, OpenAI-compatible uses Bearer
      if (useNativeApi) {
        return { name: "x-goog-api-key", value: apiKey };
      }
      return { name: "authorization", value: `Bearer ${apiKey}` };
    default:
      return null;
  }
}

/**
 * Parse a URL path to extract a provider name prefix.
 * Given "/openai/v1/chat/completions" returns { provider: "openai", remainingPath: "/v1/chat/completions" }.
 * Returns null for unknown prefixes, allowing fallthrough to existing detection.
 */
export function parsePathPrefix(
  path: string
): { provider: ProviderName; remainingPath: string } | null {
  const match = path.match(/^\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  const segment = match[1].toLowerCase();
  const rest = match[2] ?? "/";
  if (KNOWN_PROVIDER_NAMES.includes(segment as ProviderName)) {
    // Apply path rewriting for non-OpenAI-compatible providers
    const rewrittenPath = rewriteProviderPath(segment as ProviderName, rest);
    return { provider: segment as ProviderName, remainingPath: rewrittenPath };
  }
  return null;
}

/**
 * Rewrite OpenAI-compatible paths to provider-specific paths.
 * Some Chinese providers use different endpoint structures.
 */
export function rewriteProviderPath(provider: ProviderName, path: string): string {
  switch (provider) {
    case "minimax":
      // MiniMax API key uses /v1/text/chatcompletion_v2 (OpenAI-style)
      if (path === "/v1/chat/completions" || path.startsWith("/v1/chat/completions?")) {
        return path.replace("/v1/chat/completions", "/v1/text/chatcompletion_v2");
      }
      break;
    case "minimax-oauth":
      // MiniMax Coding Plan uses Anthropic Messages API format at /v1/messages
      // No rewriting needed - client should send Anthropic format directly
      break;
    // Zhipu base URL already includes /api/paas, so /v4/chat/completions works directly
    // Moonshot and Baichuan use standard OpenAI-compatible paths
  }
  return path;
}

/**
 * Parse a URL path to extract an agent ID from /agents/{id}/... format.
 * Given "/agents/my-bot/openai/v1/chat/completions" returns:
 *   { agentId: "my-bot", remainingPath: "/openai/v1/chat/completions" }
 * Returns null if path doesn't match the /agents/{id}/ pattern.
 */
export function parseAgentPath(
  path: string
): { agentId: string; remainingPath: string } | null {
  const match = path.match(/^\/agents\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  const agentId = match[1];
  const rest = match[2] ?? "/";
  return { agentId, remainingPath: rest };
}

/**
 * Check if a provider uses OAuth authentication instead of API keys.
 */
export function isOAuthProvider(provider: ProviderName): boolean {
  return provider === "openai-oauth" || provider === "minimax-oauth";
}

/**
 * Check if a provider uses subscription billing (cost = $0).
 */
export function isSubscriptionProvider(provider: ProviderName): boolean {
  return provider === "openai-oauth" || provider === "zhipu-coding-plan" || provider === "minimax-oauth";
}

/**
 * OAuth configuration for providers that support it.
 */
export const OAUTH_CONFIG = {
  "openai-oauth": {
    clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
    authorizeUrl: "https://auth.openai.com/oauth/authorize",
    tokenUrl: "https://auth.openai.com/oauth/token",
    deviceCodeUrl: "https://auth.openai.com/codex/device",
    callbackPort: 1455,
    callbackPath: "/auth/callback",
    scopes: ["openid", "profile", "email", "offline_access"],
    // Additional params required for Codex CLI flow
    extraAuthParams: {
      id_token_add_organizations: "true",
      codex_cli_simplified_flow: "true",
      originator: "pi",
    },
    // API endpoint for Codex (NOT standard OpenAI API)
    apiEndpoint: "https://chatgpt.com/backend-api/codex/responses",
  },
  "minimax-oauth": {
    clientId: "78257093-7e40-4613-99e0-527b14b39113",
    // MiniMax uses device code flow (user_code)
    codeEndpoint: "https://api.minimax.io/oauth/code",
    tokenEndpoint: "https://api.minimax.io/oauth/token",
    // For China region, use api.minimaxi.com instead
    codeEndpointCN: "https://api.minimaxi.com/oauth/code",
    tokenEndpointCN: "https://api.minimaxi.com/oauth/token",
    scopes: ["group_id", "profile", "model.completion"],
    grantType: "urn:ietf:params:oauth:grant-type:user_code",
    // API endpoint for MiniMax Coding Plan (Anthropic Messages format)
    apiEndpoint: "https://api.minimax.io/anthropic/v1/messages",
  },
} as const;
