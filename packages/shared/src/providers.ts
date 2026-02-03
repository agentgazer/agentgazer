export type ProviderName =
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "cohere"
  | "unknown";

interface ProviderPattern {
  name: ProviderName;
  hostPatterns: RegExp[];
  pathPatterns?: RegExp[];
}

const PROVIDER_PATTERNS: ProviderPattern[] = [
  {
    name: "openai",
    hostPatterns: [/api\.openai\.com/],
    pathPatterns: [/\/v1\/chat\/completions/, /\/v1\/completions/],
  },
  {
    name: "anthropic",
    hostPatterns: [/api\.anthropic\.com/],
    pathPatterns: [/\/v1\/messages/],
  },
  {
    name: "google",
    hostPatterns: [/generativelanguage\.googleapis\.com/],
  },
  {
    name: "mistral",
    hostPatterns: [/api\.mistral\.ai/],
  },
  {
    name: "cohere",
    hostPatterns: [/api\.cohere\.com/, /api\.cohere\.ai/],
  },
];

export function detectProvider(url: string): ProviderName {
  for (const provider of PROVIDER_PATTERNS) {
    for (const hostPattern of provider.hostPatterns) {
      if (hostPattern.test(url)) {
        return provider.name;
      }
    }
    if (provider.pathPatterns) {
      for (const pathPattern of provider.pathPatterns) {
        if (pathPattern.test(url)) {
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
      return { name: "authorization", value: `Bearer ${apiKey}` };
    case "anthropic":
      return { name: "x-api-key", value: apiKey };
    case "google":
      return { name: "x-goog-api-key", value: apiKey };
    default:
      return null;
  }
}
