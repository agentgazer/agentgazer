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
  | "baichuan"
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
  "baichuan",
  "yi",
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
    hostPatterns: [/^api\.moonshot\.cn$/],
  },
  {
    name: "zhipu",
    hostPatterns: [/^open\.bigmodel\.cn$/, /^api\.z\.ai$/],
  },
  {
    name: "minimax",
    hostPatterns: [/^api\.minimax\.chat$/],
  },
  {
    name: "baichuan",
    hostPatterns: [/^api\.baichuan-ai\.com$/],
  },
  {
    name: "yi",
    hostPatterns: [/^api\.lingyiwanwu\.com$/],
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

export function getProviderBaseUrl(provider: ProviderName): string | null {
  const urls: Record<string, string> = {
    openai: "https://api.openai.com",
    anthropic: "https://api.anthropic.com",
    google: "https://generativelanguage.googleapis.com",
    mistral: "https://api.mistral.ai",
    cohere: "https://api.cohere.com",
    deepseek: "https://api.deepseek.com",
    moonshot: "https://api.moonshot.cn",
    zhipu: "https://open.bigmodel.cn",
    minimax: "https://api.minimax.chat",
    baichuan: "https://api.baichuan-ai.com",
    yi: "https://api.lingyiwanwu.com",
  };
  return urls[provider] ?? null;
}

/**
 * Returns the auth header name and value for a given provider.
 * Different providers use different header conventions.
 */
export function getProviderAuthHeader(
  provider: ProviderName,
  apiKey: string
): { name: string; value: string } | null {
  switch (provider) {
    case "openai":
    case "mistral":
    case "cohere":
    case "deepseek":
    case "moonshot":
    case "zhipu":
    case "minimax":
    case "baichuan":
    case "yi":
      return { name: "authorization", value: `Bearer ${apiKey}` };
    case "anthropic":
      return { name: "x-api-key", value: apiKey };
    case "google":
      return { name: "x-goog-api-key", value: apiKey };
    default:
      return null;
  }
}
