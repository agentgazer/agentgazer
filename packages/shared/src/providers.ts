export type ProviderName =
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "cohere"
  | "deepseek"
  | "moonshot"
  | "zhipu"
  | "minimax"
  | "yi"
  | "unknown";

interface ProviderPattern {
  name: ProviderName;
  hostPatterns: RegExp[];
  pathPatterns?: RegExp[];
}

/** All known provider names (excludes "unknown"). Single source of truth. */
export const KNOWN_PROVIDER_NAMES: ProviderName[] = [
  "openai",
  "anthropic",
  "google",
  "mistral",
  "cohere",
  "deepseek",
  "moonshot",
  "zhipu",
  "minimax",
  "yi",
];

/**
 * Provider names available for user selection in UI/CLI.
 * Excludes providers without active API access.
 */
export const SELECTABLE_PROVIDER_NAMES: ProviderName[] = [
  "openai",
  "anthropic",
  "google",
  "mistral",
  "cohere",
  "deepseek",
  "moonshot",
  "zhipu",
  "minimax",
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
    name: "cohere",
    hostPatterns: [/^api\.cohere\.com$/, /^api\.cohere\.ai$/],
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
    name: "yi",
    hostPatterns: [/^api\.01\.ai$/, /^api\.lingyiwanwu\.com$/],
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
    anthropic: "https://api.anthropic.com/v1",
    google: "https://generativelanguage.googleapis.com/v1beta/openai",
    mistral: "https://api.mistral.ai/v1",
    cohere: "https://api.cohere.com/v2",
    deepseek: "https://api.deepseek.com/v1",
    moonshot: "https://api.moonshot.ai/v1",
    zhipu: "https://api.z.ai/api/paas/v4",
    minimax: "https://api.minimax.io/v1",
    yi: "https://api.01.ai/v1",
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
    anthropic: "https://api.anthropic.com",
    google: "https://generativelanguage.googleapis.com/v1beta",  // Include version prefix
    mistral: "https://api.mistral.ai",
    cohere: "https://api.cohere.com",
    deepseek: "https://api.deepseek.com",
    moonshot: "https://api.moonshot.ai",
    zhipu: "https://api.z.ai",
    minimax: "https://api.minimax.io",
    yi: "https://api.01.ai",
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
    anthropic: "https://api.anthropic.com/v1/messages",
    google: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    mistral: "https://api.mistral.ai/v1/chat/completions",
    cohere: "https://api.cohere.com/v2/chat",
    deepseek: "https://api.deepseek.com/v1/chat/completions",
    moonshot: "https://api.moonshot.ai/v1/chat/completions",
    zhipu: "https://api.z.ai/api/paas/v4/chat/completions",
    minimax: "https://api.minimax.io/v1/text/chatcompletion_v2",
    yi: "https://api.01.ai/v1/chat/completions",
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
    case "mistral":
    case "cohere":
    case "deepseek":
    case "moonshot":
    case "zhipu":
    case "minimax":
    case "yi":
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
      // MiniMax uses /v1/text/chatcompletion_v2 instead of /v1/chat/completions
      if (path === "/v1/chat/completions" || path.startsWith("/v1/chat/completions?")) {
        return path.replace("/v1/chat/completions", "/v1/text/chatcompletion_v2");
      }
      break;
    // Zhipu base URL already includes /api/paas, so /v4/chat/completions works directly
    // Yi and Moonshot use standard OpenAI-compatible paths
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
