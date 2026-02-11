import type { ProviderName } from "./providers.js";

export interface ParsedResponse {
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  tokensTotal: number | null;
  statusCode: number;
  errorMessage: string | null;
  /** Anthropic: cache_creation_input_tokens */
  cacheCreationTokens?: number | null;
  /** Anthropic: cache_read_input_tokens */
  cacheReadTokens?: number | null;
  /** OpenAI: cached input tokens (from prompt_tokens_details.cached_tokens) */
  cachedInputTokens?: number | null;
}

type ResponseParser = (body: unknown, statusCode: number) => ParsedResponse;

function makeErrorResult(statusCode: number, message?: string): ParsedResponse {
  return {
    model: null,
    tokensIn: null,
    tokensOut: null,
    tokensTotal: null,
    statusCode,
    errorMessage: message ?? `HTTP ${statusCode}`,
  };
}

function parseOpenAI(body: unknown, statusCode: number): ParsedResponse {
  if (statusCode >= 400) {
    const err = body as { error?: { message?: string } };
    return makeErrorResult(statusCode, err?.error?.message);
  }
  const data = body as {
    model?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      prompt_tokens_details?: {
        cached_tokens?: number;
      };
    };
  };
  return {
    model: data.model ?? null,
    tokensIn: data.usage?.prompt_tokens ?? null,
    tokensOut: data.usage?.completion_tokens ?? null,
    tokensTotal: data.usage?.total_tokens ?? null,
    statusCode,
    errorMessage: null,
    cachedInputTokens: data.usage?.prompt_tokens_details?.cached_tokens ?? null,
  };
}

function parseAnthropic(body: unknown, statusCode: number): ParsedResponse {
  if (statusCode >= 400) {
    const err = body as { error?: { message?: string } };
    return makeErrorResult(statusCode, err?.error?.message);
  }
  const data = body as {
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };

  // Keep input tokens separate from cache tokens for accurate cost calculation
  // Cache tokens have different rates: cache_creation = 1.25x, cache_read = 0.1x
  const tokensIn = data.usage?.input_tokens ?? null;
  const tokensOut = data.usage?.output_tokens ?? null;
  const cacheCreationTokens = data.usage?.cache_creation_input_tokens ?? null;
  const cacheReadTokens = data.usage?.cache_read_input_tokens ?? null;

  // Total includes all input tokens for display purposes
  let totalIn = tokensIn ?? 0;
  if (cacheCreationTokens != null) totalIn += cacheCreationTokens;
  if (cacheReadTokens != null) totalIn += cacheReadTokens;

  return {
    model: data.model ?? null,
    tokensIn,
    tokensOut,
    tokensTotal: tokensOut != null ? totalIn + tokensOut : null,
    statusCode,
    errorMessage: null,
    cacheCreationTokens,
    cacheReadTokens,
  };
}

function parseGoogle(body: unknown, statusCode: number): ParsedResponse {
  if (statusCode >= 400) {
    const err = body as { error?: { message?: string } };
    return makeErrorResult(statusCode, err?.error?.message);
  }
  const data = body as {
    modelVersion?: string;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };
  return {
    model: data.modelVersion ?? null,
    tokensIn: data.usageMetadata?.promptTokenCount ?? null,
    tokensOut: data.usageMetadata?.candidatesTokenCount ?? null,
    tokensTotal: data.usageMetadata?.totalTokenCount ?? null,
    statusCode,
    errorMessage: null,
  };
}

function parseMistral(body: unknown, statusCode: number): ParsedResponse {
  // Mistral uses OpenAI-compatible format
  return parseOpenAI(body, statusCode);
}

const PARSERS: Record<string, ResponseParser> = {
  openai: parseOpenAI,
  anthropic: parseAnthropic,
  google: parseGoogle,
  mistral: parseMistral,
  deepseek: parseOpenAI,
  moonshot: parseOpenAI,
  zhipu: parseOpenAI,
  minimax: parseOpenAI,
  baichuan: parseOpenAI,
};

export function parseProviderResponse(
  provider: ProviderName,
  body: unknown,
  statusCode: number
): ParsedResponse | null {
  const parser = PARSERS[provider];
  if (!parser) return null;
  return parser(body, statusCode);
}
