import type { ProviderName } from "./providers.js";

export interface ParsedResponse {
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  tokensTotal: number | null;
  statusCode: number;
  errorMessage: string | null;
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
    };
  };
  return {
    model: data.model ?? null,
    tokensIn: data.usage?.prompt_tokens ?? null,
    tokensOut: data.usage?.completion_tokens ?? null,
    tokensTotal: data.usage?.total_tokens ?? null,
    statusCode,
    errorMessage: null,
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
    };
  };
  const tokensIn = data.usage?.input_tokens ?? null;
  const tokensOut = data.usage?.output_tokens ?? null;
  return {
    model: data.model ?? null,
    tokensIn,
    tokensOut,
    tokensTotal: tokensIn != null && tokensOut != null ? tokensIn + tokensOut : null,
    statusCode,
    errorMessage: null,
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

function parseCohere(body: unknown, statusCode: number): ParsedResponse {
  if (statusCode >= 400) {
    const err = body as { message?: string };
    return makeErrorResult(statusCode, err?.message);
  }
  const data = body as {
    meta?: {
      billed_units?: {
        input_tokens?: number;
        output_tokens?: number;
      };
    };
  };
  const tokensIn = data.meta?.billed_units?.input_tokens ?? null;
  const tokensOut = data.meta?.billed_units?.output_tokens ?? null;
  return {
    model: null,  // Cohere doesn't always echo model in response
    tokensIn,
    tokensOut,
    tokensTotal: tokensIn != null && tokensOut != null ? tokensIn + tokensOut : null,
    statusCode,
    errorMessage: null,
  };
}

const PARSERS: Record<string, ResponseParser> = {
  openai: parseOpenAI,
  anthropic: parseAnthropic,
  google: parseGoogle,
  mistral: parseMistral,
  cohere: parseCohere,
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
