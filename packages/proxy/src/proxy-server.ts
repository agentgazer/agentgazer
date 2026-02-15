import * as http from "node:http";
import * as crypto from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import {
  getProviderChatEndpoint,
  getProviderRootUrl,
  getProviderAuthHeader,
  providerUsesPathRouting,
  parseProviderResponse,
  calculateCost,
  createLogger,
  KNOWN_PROVIDER_NAMES,
  isOAuthProvider,
  OAUTH_CONFIG,
  openaiToAnthropic,
  anthropicToOpenaiRequest,
  anthropicToOpenai,
  openaiToAnthropicResponse,
  anthropicSseToOpenaiChunks,
  openaiChunkToAnthropicSse,
  createStreamingConverterState,
  createOpenAIToAnthropicStreamState,
  finalizeOpenAIToAnthropicStream,
  isOpenAIToAnthropicStreamFinalized,
  formatOpenAISSELine,
  formatOpenAISSEDone,
  // Codex API converters
  openaiToCodex,
  codexSseToOpenaiChunks,
  parseCodexSSELine,
  createCodexToOpenAIStreamState,
  finalizeCodexToOpenAIStream,
  type AgentEvent,
  type ParsedResponse,
  type ProviderName,
  type OpenAIRequest,
  type OpenAIResponse,
  type OpenAIStreamChunk,
  type AnthropicRequest,
  type AnthropicResponse,
  type AnthropicSSEEvent,
  type StreamingConverterState,
  type OpenAIToAnthropicStreamState,
  type CodexSSEEvent,
  type CodexToOpenAIStreamState,
} from "@agentgazer/shared";
import {
  getAgentPolicy,
  getDailySpend,
  insertEvents,
  upsertAgent,
  getModelRule,
  getAllRateLimits,
  getProviderSettings,
  updateAgentPolicy,
  fireKillSwitchAlert,
  getSecurityConfig,
  insertSecurityEvent,
  type AgentPolicy,
  type InsertEventRow,
  type ProviderSettingsRow,
  type KillSwitchEventData,
  type SecurityConfig,
} from "@agentgazer/server";
import {
  SecurityFilter,
  clearSecurityConfigCache,
  generateSecurityBlockedResponse,
} from "./security-filter.js";
import type Database from "better-sqlite3";

// ---------------------------------------------------------------------------
// Model Override Cache
// ---------------------------------------------------------------------------

interface ModelOverrideResult {
  model: string | null;
  targetProvider: string | null;
}

interface ModelOverrideCache {
  [key: string]: {
    result: ModelOverrideResult;
    expiresAt: number;
  };
}

const modelOverrideCache: ModelOverrideCache = {};
const MODEL_OVERRIDE_CACHE_TTL_MS = 30_000; // 30 seconds

function getModelOverride(
  db: Database.Database | undefined,
  agentId: string,
  provider: string,
): ModelOverrideResult {
  const noOverride: ModelOverrideResult = { model: null, targetProvider: null };
  if (!db) return noOverride;

  const cacheKey = `${agentId}:${provider}`;
  const cached = modelOverrideCache[cacheKey];

  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  // Fetch from DB
  const rule = getModelRule(db, agentId, provider);
  const result: ModelOverrideResult = {
    model: rule?.model_override ?? null,
    targetProvider: rule?.target_provider ?? null,
  };

  // Cache the result
  modelOverrideCache[cacheKey] = {
    result,
    expiresAt: Date.now() + MODEL_OVERRIDE_CACHE_TTL_MS,
  };

  return result;
}

const log = createLogger("proxy");
import { EventBuffer } from "./event-buffer.js";
import { RateLimiter, type RateLimitConfig } from "./rate-limiter.js";
import { loopDetector, type KillSwitchConfig } from "./loop-detector.js";
import {
  setSticky,
  getSticky,
  clearSticky,
  getAllSessions,
  getSessionCount,
  cleanupExpiredSessions,
  type StickySession,
} from "./session-sticky.js";
import { pushPayload, extractPayloads, type BufferedPayload } from "./payload-buffer.js";

/** SecretStore interface for loading provider API keys and OAuth tokens */
export interface SecretStore {
  get(service: string, account: string): Promise<string | null>;
  set(service: string, account: string, value: string): Promise<void>;
  list(service: string): Promise<string[]>;
}

export interface PayloadArchiveOptions {
  /** Enable payload archiving to server */
  enabled: boolean;
  /** Server endpoint for payload archiving (e.g., http://localhost:18880/api/payloads) */
  endpoint: string;
  /** API token for authentication */
  token: string;
}

export interface ProxyOptions {
  port?: number;
  apiKey: string;
  agentId: string;
  endpoint?: string;
  flushInterval?: number;
  maxBufferSize?: number;
  providerKeys?: Record<string, string>;
  /** @deprecated Rate limits are now loaded from the database. This option is ignored. */
  rateLimits?: Record<string, RateLimitConfig>;
  /** Optional database instance for policy enforcement and rate limits */
  db?: Database.Database;
  /** Optional secret store for hot-reloading provider keys */
  secretStore?: SecretStore;
  /** Optional payload archive settings */
  payloadArchive?: PayloadArchiveOptions;
}

export interface ProxyServer {
  server: http.Server;
  shutdown: () => Promise<void>;
}

const DEFAULT_PORT = 4000;
const DEFAULT_ENDPOINT = "https://ingest.agentgazer.com/v1/events";
const DEFAULT_FLUSH_INTERVAL = 5000;
const DEFAULT_MAX_BUFFER_SIZE = 50;

// OpenAI Codex models require the Responses API (/v1/responses) instead of Chat Completions API
const OPENAI_RESPONSES_API_ENDPOINT = "https://api.openai.com/v1/responses";

/**
 * Detect if a model uses the OpenAI Responses API (Codex models)
 * Codex models like gpt-5.2-codex require /v1/responses endpoint
 */
function isCodexModel(model: string | null): boolean {
  if (!model) return false;
  const lowerModel = model.toLowerCase();
  return lowerModel.includes("codex");
}
const MAX_REQUEST_BODY_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_SSE_BUFFER_SIZE = 50 * 1024 * 1024; // 50 MB
const UPSTREAM_TIMEOUT_MS = 120_000; // 2 minutes
const RATE_LIMIT_REFRESH_INTERVAL_MS = 30_000; // 30 seconds
const PROVIDER_KEYS_REFRESH_INTERVAL_MS = 10_000; // 10 seconds
const OAUTH_TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const PROVIDER_SERVICE = "com.agentgazer.provider";
const OAUTH_SERVICE = "com.agentgazer.oauth";

/** OAuth token data structure */
interface OAuthTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp (seconds)
  scope?: string;
}

/** Refresh OAuth token using refresh_token */
async function refreshOAuthToken(
  provider: ProviderName,
  refreshToken: string
): Promise<OAuthTokenData> {
  if (provider !== "openai-oauth" && provider !== "minimax-oauth") {
    throw new Error(`No OAuth config for provider: ${provider}`);
  }

  // Get the appropriate token endpoint for each provider
  let tokenUrl: string;
  let clientId: string;

  if (provider === "openai-oauth") {
    const config = OAUTH_CONFIG["openai-oauth"];
    tokenUrl = config.tokenUrl;
    clientId = config.clientId;
  } else {
    const config = OAUTH_CONFIG["minimax-oauth"];
    tokenUrl = config.tokenEndpoint;
    clientId = config.clientId;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${text}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    scope: data.scope,
  };
}

function readRequestBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    req.on("data", (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > MAX_REQUEST_BODY_SIZE) {
        const err = new Error("Request body too large");
        req.destroy(err);
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(
  res: http.ServerResponse,
  statusCode: number,
  body: unknown
): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * Send a blocked response in SSE streaming format.
 * This ensures streaming clients (like Claude Code, OpenClaw) receive the blocked message properly.
 */
function sendStreamingBlockedResponse(
  res: http.ServerResponse,
  blockedResponse: Record<string, unknown>
): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  // Convert to streaming chunk format
  const choices = blockedResponse.choices as Array<{ message?: { content?: string } }> | undefined;
  const content = choices?.[0]?.message?.content || "[Security] Request blocked";

  // Send as a single delta chunk
  const chunk = {
    id: blockedResponse.id,
    object: "chat.completion.chunk",
    created: blockedResponse.created,
    model: blockedResponse.model,
    choices: [
      {
        index: 0,
        delta: {
          role: "assistant",
          content: content,
        },
        finish_reason: null,
      },
    ],
  };
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);

  // Send finish chunk
  const finishChunk = {
    id: blockedResponse.id,
    object: "chat.completion.chunk",
    created: blockedResponse.created,
    model: blockedResponse.model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
      },
    ],
  };
  res.write(`data: ${JSON.stringify(finishChunk)}\n\n`);

  // Send done marker
  res.write("data: [DONE]\n\n");
  res.end();
}

// ---------------------------------------------------------------------------
// Request body normalization — remove/transform unsupported fields per provider
// ---------------------------------------------------------------------------

/**
 * Normalize request body for provider compatibility.
 * Some providers don't support all OpenAI fields.
 * Returns the modified body and a list of changes made.
 */
function normalizeRequestBody(
  provider: ProviderName,
  body: Record<string, unknown>,
  log: ReturnType<typeof createLogger>,
): { body: Record<string, unknown>; modified: boolean } {
  const result = { ...body };
  let modified = false;
  const changes: string[] = [];

  // Fields that only OpenAI supports (top-level)
  const openaiOnlyFields = ["store", "metadata", "parallel_tool_calls"];

  // Providers that support stream_options for usage tracking
  const streamOptionsProviders = new Set(["openai", "deepseek", "moonshot", "zhipu", "minimax", "yi", "baichuan"]);

  // Providers that don't support stream_options at all
  const noStreamOptionsProviders = new Set(["anthropic", "google", "mistral"]);

  // max_completion_tokens -> max_tokens conversion for non-OpenAI providers
  if (provider !== "openai" && "max_completion_tokens" in result) {
    if (!("max_tokens" in result)) {
      result.max_tokens = result.max_completion_tokens;
      changes.push(`max_completion_tokens→max_tokens`);
    }
    delete result.max_completion_tokens;
    modified = true;
  }

  // OpenAI o1/o3 models require max_completion_tokens instead of max_tokens
  if (provider === "openai" && "max_tokens" in result) {
    const model = (result.model as string) ?? "";
    if (model.startsWith("o1") || model.startsWith("o3")) {
      if (!("max_completion_tokens" in result)) {
        result.max_completion_tokens = result.max_tokens;
        changes.push(`max_tokens→max_completion_tokens (${model})`);
      }
      delete result.max_tokens;
      modified = true;
    }
  }

  // Remove OpenAI-only fields for other providers
  // Note: openai-oauth (Codex) uses a different format entirely and should skip normalization
  if (provider !== "openai" && provider !== "openai-oauth") {
    for (const field of openaiOnlyFields) {
      if (field in result) {
        delete result[field];
        changes.push(`-${field}`);
        modified = true;
      }
    }

    // Remove 'strict' from within tools array (OpenAI-specific nested field)
    if (Array.isArray(result.tools)) {
      let toolsModified = false;
      for (const tool of result.tools as Array<Record<string, unknown>>) {
        if (tool.function && typeof tool.function === "object") {
          const fn = tool.function as Record<string, unknown>;
          if ("strict" in fn) {
            delete fn.strict;
            toolsModified = true;
          }
        }
        // Also check top-level strict on tool
        if ("strict" in tool) {
          delete tool.strict;
          toolsModified = true;
        }
      }
      if (toolsModified) {
        changes.push("-tools[].strict");
        modified = true;
      }
    }
  }

  // Handle stream_options for usage tracking
  if (result.stream === true) {
    if (streamOptionsProviders.has(provider)) {
      // Add stream_options.include_usage for providers that support it
      const existingStreamOptions = result.stream_options as Record<string, unknown> | undefined;
      if (!existingStreamOptions?.include_usage) {
        result.stream_options = {
          ...existingStreamOptions,
          include_usage: true,
        };
        changes.push("+stream_options.include_usage");
        modified = true;
      }
    } else if (noStreamOptionsProviders.has(provider)) {
      // Remove stream_options for providers that don't support it
      if ("stream_options" in result) {
        delete result.stream_options;
        changes.push("-stream_options");
        modified = true;
      }
    }
  }

  // Provider-specific handling
  switch (provider) {
    case "mistral":
      // Mistral doesn't support these additional fields
      const mistralUnsupported = ["logprobs", "top_logprobs", "n", "user", "service_tier"];
      for (const field of mistralUnsupported) {
        if (field in result) {
          delete result[field];
          changes.push(`-${field}`);
          modified = true;
        }
      }
      break;
  }

  if (modified) {
    log.debug(`[PROXY] Normalized request body: ${changes.join(", ")}`);
  }

  return { body: result, modified };
}

// ---------------------------------------------------------------------------
// SSE streaming parsers — extract usage/model from provider-specific formats
// ---------------------------------------------------------------------------

function parseOpenAISSE(
  dataLines: string[],
  statusCode: number
): ParsedResponse {
  let model: string | null = null;
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;
  let tokensTotal: number | null = null;

  for (const line of dataLines) {
    try {
      const data = JSON.parse(line);
      if (data.model) model = data.model;
      if (data.usage) {
        tokensIn = data.usage.prompt_tokens ?? null;
        tokensOut = data.usage.completion_tokens ?? null;
        tokensTotal = data.usage.total_tokens ?? null;
      }
    } catch {
      continue;
    }
  }

  return {
    model,
    tokensIn,
    tokensOut,
    tokensTotal,
    statusCode,
    errorMessage: null,
  };
}

function parseAnthropicSSE(
  dataLines: string[],
  statusCode: number
): ParsedResponse {
  let model: string | null = null;
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;
  let cacheCreationTokens: number | null = null;
  let cacheReadTokens: number | null = null;

  for (const line of dataLines) {
    try {
      const data = JSON.parse(line);
      if (data.type === "message_start" && data.message) {
        model = data.message.model ?? null;
        const usage = data.message.usage;
        if (usage) {
          tokensIn = usage.input_tokens ?? null;
          // Anthropic prompt caching: include cache tokens in input count
          cacheCreationTokens = usage.cache_creation_input_tokens ?? null;
          cacheReadTokens = usage.cache_read_input_tokens ?? null;
        }
      }
      if (data.type === "message_delta" && data.usage) {
        tokensOut = data.usage.output_tokens ?? null;
      }
    } catch {
      continue;
    }
  }

  // Total input includes regular + cache tokens
  // Note: cache_creation is charged at 1.25x, cache_read at 0.1x
  // For now we count all as regular input tokens for simplicity
  let totalInputTokens = tokensIn;
  if (totalInputTokens != null) {
    if (cacheCreationTokens != null) {
      totalInputTokens += cacheCreationTokens;
    }
    if (cacheReadTokens != null) {
      totalInputTokens += cacheReadTokens;
    }
  }

  const tokensTotal =
    totalInputTokens != null && tokensOut != null ? totalInputTokens + tokensOut : null;

  return {
    model,
    tokensIn: totalInputTokens,
    tokensOut,
    tokensTotal,
    statusCode,
    errorMessage: null,
    cacheCreationTokens,
    cacheReadTokens,
  };
}

function parseGoogleSSE(
  dataLines: string[],
  statusCode: number
): ParsedResponse {
  let model: string | null = null;
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;
  let tokensTotal: number | null = null;

  for (const line of dataLines) {
    try {
      const data = JSON.parse(line);
      if (data.modelVersion) model = data.modelVersion;
      if (data.usageMetadata) {
        tokensIn = data.usageMetadata.promptTokenCount ?? null;
        tokensOut = data.usageMetadata.candidatesTokenCount ?? null;
        tokensTotal = data.usageMetadata.totalTokenCount ?? null;
      }
    } catch {
      continue;
    }
  }

  return {
    model,
    tokensIn,
    tokensOut,
    tokensTotal,
    statusCode,
    errorMessage: null,
  };
}

/**
 * Parse Google's streaming response format (JSON array chunks, not standard SSE).
 * Google Gemini API returns streaming data as: [{"candidates":...}, {"candidates":...}]
 * Each chunk may or may not have usageMetadata - typically only the last chunk has it.
 */
function parseGoogleStreamingResponse(
  rawText: string,
  statusCode: number
): ParsedResponse {
  let model: string | null = null;
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;
  let tokensTotal: number | null = null;

  // Try to extract JSON objects from the response
  // Google streaming format: [{"candidates":...},\n{"candidates":...}]
  // We need to handle the array brackets and commas between objects

  // First, try parsing as a complete JSON array
  try {
    const cleanedText = rawText.trim();
    if (cleanedText.startsWith("[")) {
      const data = JSON.parse(cleanedText);
      if (Array.isArray(data)) {
        for (const chunk of data) {
          if (chunk.modelVersion) model = chunk.modelVersion;
          if (chunk.usageMetadata) {
            tokensIn = chunk.usageMetadata.promptTokenCount ?? null;
            tokensOut = chunk.usageMetadata.candidatesTokenCount ?? null;
            tokensTotal = chunk.usageMetadata.totalTokenCount ?? null;
          }
        }
      }
    }
  } catch {
    // Not a valid JSON array, try line-by-line parsing
  }

  // If we didn't find data, try extracting individual JSON objects
  if (tokensIn === null && tokensOut === null) {
    // Remove array brackets and split by object boundaries
    const cleanedText = rawText
      .replace(/^\s*\[\s*/, "")  // Remove leading [
      .replace(/\s*\]\s*$/, "")  // Remove trailing ]
      .replace(/^\s*,\s*/gm, "") // Remove leading commas on each line
      .trim();

    // Try to find and parse JSON objects
    const objectMatches = cleanedText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
    if (objectMatches) {
      for (const objStr of objectMatches) {
        try {
          const data = JSON.parse(objStr);
          if (data.modelVersion) model = data.modelVersion;
          if (data.usageMetadata) {
            tokensIn = data.usageMetadata.promptTokenCount ?? null;
            tokensOut = data.usageMetadata.candidatesTokenCount ?? null;
            tokensTotal = data.usageMetadata.totalTokenCount ?? null;
          }
        } catch {
          continue;
        }
      }
    }
  }

  return {
    model,
    tokensIn,
    tokensOut,
    tokensTotal,
    statusCode,
    errorMessage: null,
  };
}

/**
 * Parse Codex (OpenAI Responses API) SSE format.
 * Codex uses response.done/response.completed events with usage info.
 */
function parseCodexSSE(
  dataLines: string[],
  statusCode: number
): ParsedResponse {
  let model: string | null = null;
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;

  for (const line of dataLines) {
    try {
      const data = JSON.parse(line);
      // Look for response.done or response.completed events
      if (data.type === "response.done" || data.type === "response.completed") {
        if (data.response?.usage) {
          tokensIn = data.response.usage.input_tokens ?? null;
          tokensOut = data.response.usage.output_tokens ?? null;
        }
        if (data.response?.model) {
          model = data.response.model;
        }
      }
    } catch {
      continue;
    }
  }

  const tokensTotal =
    tokensIn != null && tokensOut != null ? tokensIn + tokensOut : null;

  return {
    model,
    tokensIn,
    tokensOut,
    tokensTotal,
    statusCode,
    errorMessage: null,
  };
}

function parseSSEResponse(
  provider: string,
  sseText: string,
  statusCode: number
): ParsedResponse | null {
  const lines = sseText.split("\n");
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("data: ") && line !== "data: [DONE]") {
      dataLines.push(line.slice(6));
    }
  }

  // Google Gemini API uses a different streaming format (JSON array, not SSE)
  // Handle it specially even if no "data: " lines found
  if (provider === "google") {
    if (dataLines.length > 0) {
      // Google with SSE format (when ?alt=sse is used)
      return parseGoogleSSE(dataLines, statusCode);
    } else {
      // Google's default JSON array streaming format
      return parseGoogleStreamingResponse(sseText, statusCode);
    }
  }

  if (dataLines.length === 0) return null;

  switch (provider) {
    case "openai":
    case "mistral":
    case "deepseek":
    case "moonshot":
    case "zhipu":
    case "minimax":
    case "yi":
      return parseOpenAISSE(dataLines, statusCode);
    case "openai-oauth":
      // Codex uses Responses API format - parse for usage info
      return parseCodexSSE(dataLines, statusCode);
    case "anthropic":
      return parseAnthropicSSE(dataLines, statusCode);
    default:
      // For unknown providers, try OpenAI-compatible format as fallback
      // Many providers (including custom zhipu endpoints) use this format
      return parseOpenAISSE(dataLines, statusCode);
  }
}

// ---------------------------------------------------------------------------
// Policy enforcement helpers
// ---------------------------------------------------------------------------

type BlockReason = "inactive" | "budget_exceeded" | "outside_hours" | "provider_deactivated" | "provider_rate_limited" | "loop_detected";

interface PolicyCheckResult {
  allowed: boolean;
  reason?: BlockReason;
  message?: string;
}

function checkAgentPolicy(
  db: Database.Database | undefined,
  agentId: string,
): PolicyCheckResult {
  if (!db) {
    // No DB means no policy enforcement (backwards compatible)
    return { allowed: true };
  }

  const policy = getAgentPolicy(db, agentId);
  if (!policy) {
    // Agent doesn't exist yet or no policy — allow by default
    return { allowed: true };
  }

  // Check if agent is active
  if (!policy.active) {
    return {
      allowed: false,
      reason: "inactive",
      message: "Agent is currently deactivated",
    };
  }

  // Check budget limit
  if (policy.budget_limit !== null) {
    const dailySpend = getDailySpend(db, agentId);
    if (dailySpend >= policy.budget_limit) {
      return {
        allowed: false,
        reason: "budget_exceeded",
        message: `Daily budget limit of $${policy.budget_limit.toFixed(2)} exceeded (spent: $${dailySpend.toFixed(2)})`,
      };
    }
  }

  // Check allowed hours
  if (policy.allowed_hours_start !== null && policy.allowed_hours_end !== null) {
    const now = new Date();
    const currentHour = now.getHours();
    const start = policy.allowed_hours_start;
    const end = policy.allowed_hours_end;

    let isWithinHours: boolean;
    if (start <= end) {
      // Normal range (e.g., 9-17)
      isWithinHours = currentHour >= start && currentHour < end;
    } else {
      // Overnight range (e.g., 22-6)
      isWithinHours = currentHour >= start || currentHour < end;
    }

    if (!isWithinHours) {
      return {
        allowed: false,
        reason: "outside_hours",
        message: `Agent is only allowed to operate between ${start}:00 and ${end}:00 (server time)`,
      };
    }
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Provider-Level Policy
// ---------------------------------------------------------------------------

interface ProviderPolicyCache {
  [provider: string]: {
    settings: ProviderSettingsRow | null;
    expiresAt: number;
  };
}

const providerPolicyCache: ProviderPolicyCache = {};
const PROVIDER_POLICY_CACHE_TTL_MS = 1_000; // 1 second - short TTL for responsive policy updates

/**
 * Clear the provider policy cache for a specific provider, or all providers.
 * Useful for testing or when provider settings are updated.
 */
export function clearProviderPolicyCache(provider?: string): void {
  if (provider) {
    delete providerPolicyCache[provider];
  } else {
    for (const key of Object.keys(providerPolicyCache)) {
      delete providerPolicyCache[key];
    }
  }
}

// Provider-level rate limiter (separate from agent rate limiter)
const providerRateLimiter = new RateLimiter();

function checkProviderPolicy(
  db: Database.Database | undefined,
  provider: ProviderName,
): PolicyCheckResult {
  if (!db || provider === "unknown") {
    return { allowed: true };
  }

  // Check cache first
  const cached = providerPolicyCache[provider];
  let settings: ProviderSettingsRow | null | undefined;

  if (cached && cached.expiresAt > Date.now()) {
    settings = cached.settings;
  } else {
    settings = getProviderSettings(db, provider);
    providerPolicyCache[provider] = {
      settings: settings ?? null,
      expiresAt: Date.now() + PROVIDER_POLICY_CACHE_TTL_MS,
    };
  }

  if (!settings) {
    // No settings means default (active, no rate limit)
    return { allowed: true };
  }

  // Check if provider is active
  if (settings.active === 0) {
    return {
      allowed: false,
      reason: "provider_deactivated",
      message: `Provider "${provider}" is currently deactivated`,
    };
  }

  // Check provider rate limit
  if (settings.rate_limit_max_requests && settings.rate_limit_window_seconds) {
    const isAllowed = providerRateLimiter.checkAndRecord(
      provider, // Use provider as the key
      provider,
      settings.rate_limit_max_requests,
      settings.rate_limit_window_seconds,
    );

    if (!isAllowed) {
      const retryAfter = providerRateLimiter.getRetryAfter(provider, provider);
      log.info(`[PROXY] Provider ${provider} rate limited, retry after ${retryAfter}s`);
      return {
        allowed: false,
        reason: "provider_rate_limited",
        message: `Provider "${provider}" rate limit exceeded. Retry after ${retryAfter} seconds.`,
      };
    }
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Kill Switch Config Cache
// ---------------------------------------------------------------------------

interface KillSwitchConfigCache {
  [agentId: string]: {
    config: KillSwitchConfig;
    expiresAt: number;
  };
}

const killSwitchConfigCache: KillSwitchConfigCache = {};
const KILL_SWITCH_CACHE_TTL_MS = 30_000; // 30 seconds

function getKillSwitchConfig(
  db: Database.Database | undefined,
  agentId: string,
): KillSwitchConfig {
  const defaultConfig: KillSwitchConfig = {
    enabled: false,
    windowSize: 20,
    threshold: 10.0,
  };

  if (!db) return defaultConfig;

  // Check cache first
  const cached = killSwitchConfigCache[agentId];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.config;
  }

  // Fetch from DB
  const policy = getAgentPolicy(db, agentId);
  const config: KillSwitchConfig = {
    enabled: policy?.kill_switch_enabled === 1,
    windowSize: policy?.kill_switch_window_size ?? 20,
    threshold: policy?.kill_switch_threshold ?? 10.0,
  };

  // Update loop detector config
  loopDetector.setConfig(agentId, config);

  // Cache the result
  killSwitchConfigCache[agentId] = {
    config,
    expiresAt: Date.now() + KILL_SWITCH_CACHE_TTL_MS,
  };

  return config;
}

/**
 * Generate a blocked response in OpenAI format.
 */
function generateOpenAIBlockedResponse(reason: BlockReason, message: string): object {
  return {
    id: `chatcmpl-blocked-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "agentgazer-policy",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: `[AgentGazer Policy Block] ${message}`,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}

/**
 * Generate a blocked response in Anthropic format.
 */
function generateAnthropicBlockedResponse(reason: BlockReason, message: string): object {
  return {
    id: `msg_blocked_${Date.now()}`,
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: `[AgentGazer Policy Block] ${message}`,
      },
    ],
    model: "agentgazer-policy",
    stop_reason: "end_turn",
    usage: {
      input_tokens: 0,
      output_tokens: 0,
    },
  };
}

/**
 * Generate a blocked response based on provider format.
 */
function generateBlockedResponse(
  provider: ProviderName,
  reason: BlockReason,
  message: string,
): object {
  if (provider === "anthropic") {
    return generateAnthropicBlockedResponse(reason, message);
  }
  // Default to OpenAI format (used by most providers)
  return generateOpenAIBlockedResponse(reason, message);
}

/**
 * Generate a kill switch response that clearly informs the agent about the loop detection.
 * This ensures the agent can immediately communicate the situation to the user.
 */
function generateKillSwitchResponse(
  provider: ProviderName,
  agentId: string,
  score: number,
  details: { similarPrompts: number; similarResponses: number; repeatedToolCalls: number },
): Record<string, unknown> {
  const timestamp = new Date().toISOString();

  const message = `🛑 **AgentGazer Kill Switch Activated**

**Agent:** ${agentId}
**Loop Score:** ${score.toFixed(1)}
**Time:** ${timestamp}

---

**CRITICAL: Please inform the user immediately:**

This agent has been **automatically deactivated** because an infinite loop was detected. This protection prevents runaway API costs.

**Loop Detection Details:**
- Similar prompts detected: ${details.similarPrompts}
- Similar responses detected: ${details.similarResponses}
- Repeated tool calls: ${details.repeatedToolCalls}

**What the user should know:**
- The agent is now deactivated and cannot make further requests
- This is a safety measure to prevent excessive API charges
- All recent requests have been logged for review

**To resume:**
1. Go to AgentGazer Dashboard → Agents → ${agentId}
2. Review the incident details
3. Re-enable the agent if appropriate

**Do not retry.** The agent is deactivated and all requests will be blocked until manually re-enabled.`;

  if (provider === "anthropic") {
    return {
      id: `msg_killswitch_${Date.now()}`,
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: message }],
      model: "agentgazer-kill-switch",
      stop_reason: "end_turn",
      usage: { input_tokens: 0, output_tokens: 0 },
      agentgazer_kill_switch: {
        triggered: true,
        agent_id: agentId,
        score: score,
        details: details,
        timestamp: timestamp,
      },
    };
  }

  return {
    id: `chatcmpl-killswitch-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "agentgazer-kill-switch",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: message },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    agentgazer_kill_switch: {
      triggered: true,
      agent_id: agentId,
      score: score,
      details: details,
      timestamp: timestamp,
    },
  };
}

/**
 * Generate a rate limit response based on provider format.
 */
function generateRateLimitResponse(
  provider: ProviderName,
  agentId: string,
  retryAfterSeconds: number,
): object {
  const message = `Rate limit exceeded for provider "${provider}". Please retry after ${retryAfterSeconds} seconds.`;

  if (provider === "anthropic") {
    return {
      type: "error",
      error: {
        type: "rate_limit_error",
        message,
      },
      retry_after_seconds: retryAfterSeconds,
    };
  }

  // OpenAI-style error format (used by most providers)
  return {
    error: {
      message,
      type: "rate_limit_error",
      param: null,
      code: "rate_limit_exceeded",
    },
    retry_after_seconds: retryAfterSeconds,
  };
}

/**
 * Record a blocked event to the database.
 */
function recordBlockedEvent(
  db: Database.Database | undefined,
  agentId: string,
  provider: ProviderName,
  reason: BlockReason,
  message: string,
): void {
  if (!db) return;

  try {
    // Ensure agent exists
    upsertAgent(db, agentId, false);

    // Insert blocked event
    const event: InsertEventRow = {
      agent_id: agentId,
      event_type: "blocked",
      provider,
      model: null,
      tokens_in: null,
      tokens_out: null,
      tokens_total: null,
      cost_usd: null,
      latency_ms: null,
      status_code: 403,
      source: "proxy",
      timestamp: new Date().toISOString(),
      tags: { block_reason: reason, block_message: message },
    };
    insertEvents(db, [event]);
  } catch (err) {
    log.error("Failed to record blocked event", { err: String(err) });
  }
}

// ---------------------------------------------------------------------------
// Proxy server
// ---------------------------------------------------------------------------

/**
 * Load rate limits from database and convert to RateLimiter config format.
 */
function loadRateLimitsFromDb(db: Database.Database | undefined): Record<string, RateLimitConfig> {
  if (!db) return {};

  try {
    const rows = getAllRateLimits(db);
    const configs: Record<string, RateLimitConfig> = {};

    for (const row of rows) {
      const key = `${row.agent_id}:${row.provider}`;
      configs[key] = {
        maxRequests: row.max_requests,
        windowSeconds: row.window_seconds,
      };
    }

    return configs;
  } catch (err) {
    log.error("Failed to load rate limits from database", { err: String(err) });
    return {};
  }
}

// ---------------------------------------------------------------------------
// Payload Archive Functions
// ---------------------------------------------------------------------------

/**
 * Archive a single payload to the server (fire-and-forget).
 */
function archivePayload(
  archiveOpts: PayloadArchiveOptions,
  eventId: string,
  agentId: string,
  requestBody: string,
  responseBody: string,
): void {
  const body = JSON.stringify({ eventId, agentId, requestBody, responseBody });
  fetch(archiveOpts.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${archiveOpts.token}`,
    },
    body,
  }).catch((err) => {
    log.debug("Failed to archive payload", { err: String(err), eventId });
  });
}

/**
 * Archive evidence payloads for a kill switch event.
 */
async function archiveEvidence(
  archiveOpts: PayloadArchiveOptions,
  killSwitchEventId: string,
  payloads: BufferedPayload[],
): Promise<void> {
  try {
    const body = JSON.stringify({ killSwitchEventId, payloads });
    const res = await fetch(`${archiveOpts.endpoint}/evidence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${archiveOpts.token}`,
      },
      body,
    });
    if (!res.ok) {
      log.warn("Failed to archive evidence", { status: res.status, killSwitchEventId });
    } else {
      log.info(`Archived ${payloads.length} evidence payloads for kill switch ${killSwitchEventId}`);
    }
  } catch (err) {
    log.error("Failed to archive evidence", { err: String(err), killSwitchEventId });
  }
}

export function startProxy(options: ProxyOptions): ProxyServer {
  const port = options.port ?? DEFAULT_PORT;
  const agentId = options.agentId;
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const flushInterval = options.flushInterval ?? DEFAULT_FLUSH_INTERVAL;
  const maxBufferSize = options.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;
  let providerKeys = options.providerKeys ?? {};
  const db = options.db;
  const secretStore = options.secretStore;
  const payloadArchive = options.payloadArchive;

  // Initialize rate limiter - prefer database, fall back to options for backward compatibility/testing
  let initialRateLimits: Record<string, RateLimitConfig> = {};
  if (db) {
    initialRateLimits = loadRateLimitsFromDb(db);
  } else if (options.rateLimits) {
    // Convert legacy format (provider -> config) to new format (agentId:provider -> config)
    for (const [provider, config] of Object.entries(options.rateLimits)) {
      initialRateLimits[`${agentId}:${provider}`] = config;
    }
  }
  const rateLimiter = new RateLimiter(initialRateLimits);

  // Set up periodic refresh of rate limits from database
  let rateLimitRefreshTimer: ReturnType<typeof setInterval> | null = null;
  if (db) {
    rateLimitRefreshTimer = setInterval(() => {
      const configs = loadRateLimitsFromDb(db);
      rateLimiter.updateConfigs(configs);
    }, RATE_LIMIT_REFRESH_INTERVAL_MS);
    rateLimitRefreshTimer.unref();
  }

  // Set up periodic refresh of provider keys from secret store
  let providerKeysRefreshTimer: ReturnType<typeof setInterval> | null = null;
  if (secretStore) {
    providerKeysRefreshTimer = setInterval(async () => {
      try {
        const accounts = await secretStore.list(PROVIDER_SERVICE);
        const newKeys: Record<string, string> = {};
        for (const account of accounts) {
          const value = await secretStore.get(PROVIDER_SERVICE, account);
          if (value) {
            newKeys[account] = value;
          }
        }
        providerKeys = newKeys;
      } catch (err) {
        log.error("Failed to refresh provider keys", { err: String(err) });
      }
    }, PROVIDER_KEYS_REFRESH_INTERVAL_MS);
    providerKeysRefreshTimer.unref();
  }

  // OAuth token cache: provider -> token data
  let oauthTokens: Record<string, OAuthTokenData> = {};

  // Load and refresh OAuth tokens from secret store
  async function loadOAuthTokens(): Promise<void> {
    if (!secretStore) return;

    try {
      const oauthProviders = await secretStore.list(OAUTH_SERVICE);
      const newTokens: Record<string, OAuthTokenData> = {};

      for (const provider of oauthProviders) {
        const value = await secretStore.get(OAUTH_SERVICE, provider);
        if (value) {
          try {
            const tokenData = JSON.parse(value) as OAuthTokenData;
            newTokens[provider] = tokenData;
          } catch {
            log.error(`Invalid OAuth token data for ${provider}`);
          }
        }
      }

      oauthTokens = newTokens;
    } catch (err) {
      log.error("Failed to load OAuth tokens", { err: String(err) });
    }
  }

  // Get OAuth access token for a provider, refreshing if needed
  async function getOAuthAccessToken(provider: ProviderName): Promise<string | null> {
    const tokenData = oauthTokens[provider];
    if (!tokenData) return null;

    const nowMs = Date.now();
    const expiresAtMs = tokenData.expiresAt * 1000;

    // Check if token needs refresh (within threshold)
    if (expiresAtMs - nowMs < OAUTH_TOKEN_REFRESH_THRESHOLD_MS) {
      log.info(`OAuth token for ${provider} expiring soon, refreshing...`);
      try {
        const newToken = await refreshOAuthToken(provider, tokenData.refreshToken);
        oauthTokens[provider] = newToken;

        // Save refreshed token to secret store
        if (secretStore) {
          await secretStore.set(OAUTH_SERVICE, provider, JSON.stringify(newToken));
        }

        return newToken.accessToken;
      } catch (err) {
        log.error(`Failed to refresh OAuth token for ${provider}`, { err: String(err) });
        // Return existing token if refresh fails (it might still work)
        return tokenData.accessToken;
      }
    }

    return tokenData.accessToken;
  }

  // Initial load of OAuth tokens
  if (secretStore) {
    void loadOAuthTokens();

    // Refresh OAuth tokens periodically
    const oauthRefreshTimer = setInterval(() => {
      void loadOAuthTokens();
    }, PROVIDER_KEYS_REFRESH_INTERVAL_MS);
    oauthRefreshTimer.unref();
  }

  // Session sticky cleanup (runs every 5 minutes)
  const SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
  const sessionCleanupTimer = setInterval(() => {
    const cleaned = cleanupExpiredSessions();
    if (cleaned > 0) {
      log.debug(`[SESSION] Cleaned up ${cleaned} expired sessions, ${getSessionCount()} active`);
    }
  }, SESSION_CLEANUP_INTERVAL_MS);
  sessionCleanupTimer.unref();

  const startTime = Date.now();

  const eventBuffer = new EventBuffer({
    apiKey: options.apiKey,
    endpoint,
    flushInterval,
    maxBufferSize,
  });
  eventBuffer.start();

  // Initialize security filter for request/response checks
  const securityFilter = new SecurityFilter({
    db,
    serverEndpoint: endpoint.replace("/v1/events", ""), // Derive server endpoint
    apiKey: options.apiKey,
  });

  const server = http.createServer(
    (req: http.IncomingMessage, res: http.ServerResponse) => {
      void handleRequest(req, res);
    }
  );

  async function handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const method = req.method ?? "GET";
    const path = req.url ?? "/";

    // Health check endpoint
    if (method === "GET" && path === "/health") {
      sendJson(res, 200, {
        status: "ok",
        agent_id: agentId,
        uptime_ms: Date.now() - startTime,
      });
      return;
    }

    // Internal endpoint: Clear loop detector window for an agent
    // POST /internal/agents/:id/clear-window
    const clearWindowMatch = path.match(/^\/internal\/agents\/([^/]+)\/clear-window$/);
    if (method === "POST" && clearWindowMatch) {
      const targetAgentId = decodeURIComponent(clearWindowMatch[1]);

      // Security: Only allow from localhost
      const remoteAddr = req.socket.remoteAddress;
      const isLocalhost = remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";
      if (!isLocalhost) {
        sendJson(res, 403, { error: "This endpoint is only accessible from localhost" });
        return;
      }

      loopDetector.clearAgent(targetAgentId);
      log.info(`[PROXY] Cleared loop detector window for agent "${targetAgentId}"`);
      sendJson(res, 200, { success: true, agent_id: targetAgentId });
      return;
    }

    // Internal endpoint: Clear provider policy cache
    // POST /internal/providers/:provider/clear-cache
    // POST /internal/providers/clear-cache (clears all)
    const clearProviderCacheMatch = path.match(/^\/internal\/providers(?:\/([^/]+))?\/clear-cache$/);
    if (method === "POST" && clearProviderCacheMatch) {
      const targetProvider = clearProviderCacheMatch[1] ? decodeURIComponent(clearProviderCacheMatch[1]) : undefined;

      // Security: Only allow from localhost
      const remoteAddr = req.socket.remoteAddress;
      const isLocalhost = remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";
      if (!isLocalhost) {
        sendJson(res, 403, { error: "This endpoint is only accessible from localhost" });
        return;
      }

      clearProviderPolicyCache(targetProvider);
      if (targetProvider) {
        log.info(`[PROXY] Cleared provider policy cache for "${targetProvider}"`);
        sendJson(res, 200, { success: true, provider: targetProvider });
      } else {
        log.info(`[PROXY] Cleared all provider policy caches`);
        sendJson(res, 200, { success: true, all: true });
      }
      return;
    }

    // Internal endpoint: Clear security config cache
    // POST /internal/security/clear-cache/:agentId
    // POST /internal/security/clear-cache (clears all)
    const clearSecurityCacheMatch = path.match(/^\/internal\/security\/clear-cache(?:\/([^/]+))?$/);
    if (method === "POST" && clearSecurityCacheMatch) {
      const targetAgentId = clearSecurityCacheMatch[1] ? decodeURIComponent(clearSecurityCacheMatch[1]) : undefined;

      // Security: Only allow from localhost
      const remoteAddr = req.socket.remoteAddress;
      const isLocalhost = remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";
      if (!isLocalhost) {
        sendJson(res, 403, { error: "This endpoint is only accessible from localhost" });
        return;
      }

      clearSecurityConfigCache(targetAgentId);
      if (targetAgentId) {
        log.info(`[PROXY] Cleared security config cache for agent "${targetAgentId}"`);
        sendJson(res, 200, { success: true, agent_id: targetAgentId });
      } else {
        log.info(`[PROXY] Cleared all security config caches`);
        sendJson(res, 200, { success: true, all: true });
      }
      return;
    }

    // Simplified routing: POST /agents/:agent/:provider[/...]
    // For most providers, trailing path is ignored and we use the fixed chat endpoint.
    // For providers with path-based routing (e.g., Google), we preserve the trailing path.
    const simplifiedRouteMatch = path.match(/^\/agents\/([^/]+)\/([^/]+)(\/.*)?$/);
    if (method === "POST" && simplifiedRouteMatch) {
      const routeAgentId = decodeURIComponent(simplifiedRouteMatch[1]);
      const routeProvider = simplifiedRouteMatch[2].toLowerCase() as ProviderName;
      const trailingPath = simplifiedRouteMatch[3] || "";

      // Validate provider
      if (!KNOWN_PROVIDER_NAMES.includes(routeProvider)) {
        sendJson(res, 400, { error: `Unknown provider: ${routeProvider}` });
        return;
      }

      let targetUrl: string;
      if (routeProvider === "agentgazer") {
        // Virtual provider - requires cross-provider override (resolved in handleSimplifiedRoute)
        targetUrl = "PLACEHOLDER_REQUIRES_OVERRIDE";
      } else if (providerUsesPathRouting(routeProvider) && trailingPath) {
        // Path-based routing: append trailing path to root URL
        const rootUrl = getProviderRootUrl(routeProvider);
        if (!rootUrl) {
          sendJson(res, 400, { error: `No root URL configured for provider: ${routeProvider}` });
          return;
        }
        targetUrl = rootUrl + trailingPath;

        // For Google native API, add key as query parameter
        if (routeProvider === "google" && providerKeys["google"]) {
          const separator = targetUrl.includes("?") ? "&" : "?";
          targetUrl = `${targetUrl}${separator}key=${providerKeys["google"]}`;
        }
      } else {
        // Fixed endpoint routing
        const chatEndpoint = getProviderChatEndpoint(routeProvider);
        if (!chatEndpoint) {
          sendJson(res, 400, { error: `No chat endpoint configured for provider: ${routeProvider}` });
          return;
        }
        targetUrl = chatEndpoint;
      }

      log.info(`[PROXY] Simplified route: agent=${routeAgentId}, provider=${routeProvider}`);
      log.info(`[PROXY] Forwarding to: ${targetUrl}`);

      // For path-based routing (e.g., Google native API), we use different auth
      const useNativeApi = providerUsesPathRouting(routeProvider) && !!trailingPath;

      // Handle the simplified route request
      await handleSimplifiedRoute(req, res, routeAgentId, routeProvider, targetUrl, useNativeApi);
      return;
    }

    // Legacy routing: /:provider/... -> treat as /agents/default/:provider
    // This maintains backward compatibility with old SDK configurations
    const legacyProviderMatch = path.match(/^\/([^/]+)/);
    if (method === "POST" && legacyProviderMatch) {
      const legacyProvider = legacyProviderMatch[1].toLowerCase() as ProviderName;

      if (KNOWN_PROVIDER_NAMES.includes(legacyProvider)) {
        const chatEndpoint = getProviderChatEndpoint(legacyProvider);
        if (chatEndpoint) {
          log.info(`[PROXY] Legacy route /${legacyProvider}/... -> agents/default/${legacyProvider}`);
          log.info(`[PROXY] Forwarding to: ${chatEndpoint}`);
          await handleSimplifiedRoute(req, res, "default", legacyProvider, chatEndpoint, false);
          return;
        }
      }
    }

    // All other requests: return error with usage instructions
    sendJson(res, 400, {
      error: "Invalid route. Use POST /agents/:agent/:provider for LLM requests.",
      usage: {
        endpoint: "POST /agents/{agent_name}/{provider}",
        example: "POST /agents/my-agent/openai",
        providers: KNOWN_PROVIDER_NAMES,
        sdk_config: {
          openai: "new OpenAI({ baseURL: 'http://localhost:4000/agents/my-agent/openai' })",
          anthropic: "new Anthropic({ baseURL: 'http://localhost:4000/agents/my-agent/anthropic' })",
        },
      },
    });
  }

  function extractStreamingMetrics(
    provider: ProviderName,  // For response parsing
    statusCode: number,
    sseBody: Buffer,
    latencyMs: number,
    effectiveAgentId: string,
    requestedModel: string | null,
    actualModel: string | null,  // Model after override (for cost calculation)
    eventProvider?: ProviderName,  // For event recording (defaults to provider)
    ttftMs?: number | null,  // Time to first token (streaming only)
    eventId?: string,  // Pre-generated event ID for payload correlation
  ): void {
    if (provider === "unknown") {
      log.warn("Unrecognized provider - skipping streaming metric extraction");
      return;
    }

    const sseText = sseBody.toString("utf-8");
    const parsed = parseSSEResponse(provider, sseText, statusCode);

    // Record response for loop detection (even if parsing fails)
    loopDetector.recordResponse(effectiveAgentId, sseText);

    // If parsing fails, still record a basic event with available info
    if (!parsed) {
      log.warn(`No parseable SSE data for provider: ${provider} — recording basic event`);
      const basicEvent: AgentEvent = {
        id: eventId,
        agent_id: effectiveAgentId,
        event_type: "llm_call",
        provider: eventProvider ?? provider,
        model: actualModel ?? requestedModel,
        requested_model: requestedModel,
        tokens_in: null,
        tokens_out: null,
        tokens_total: null,
        cost_usd: null,
        latency_ms: latencyMs,
        ttft_ms: ttftMs ?? null,
        status_code: statusCode,
        source: "proxy",
        timestamp: new Date().toISOString(),
        tags: { streaming: "true", parse_failed: "true" },
      };
      eventBuffer.add(basicEvent);
      return;
    }

    // Use actualModel (after override) as fallback for cost calculation
    // This ensures cross-provider overrides use the target model's pricing
    const effectiveModel = parsed.model ?? actualModel ?? requestedModel;

    let costUsd: number | null = null;
    if (effectiveModel && parsed.tokensIn != null && parsed.tokensOut != null) {
      costUsd = calculateCost(effectiveModel, parsed.tokensIn, parsed.tokensOut, {
        cacheCreation: parsed.cacheCreationTokens ?? undefined,
        cacheRead: parsed.cacheReadTokens ?? undefined,
      }, provider);
    }

    const event: AgentEvent = {
      id: eventId,
      agent_id: effectiveAgentId,
      event_type: "llm_call",
      provider: eventProvider ?? provider,  // Use original provider for event
      model: effectiveModel,
      requested_model: requestedModel,
      tokens_in: parsed.tokensIn,
      tokens_out: parsed.tokensOut,
      tokens_total: parsed.tokensTotal,
      cost_usd: costUsd,
      latency_ms: latencyMs,
      ttft_ms: ttftMs ?? null,
      status_code: statusCode,
      source: "proxy",
      timestamp: new Date().toISOString(),
      tags: { streaming: "true" },
    };

    eventBuffer.add(event);

    // Track session sticky for conversation continuity (only for successful requests)
    if (statusCode >= 200 && statusCode < 300 && effectiveModel) {
      setSticky(effectiveAgentId, effectiveModel, eventProvider ?? provider);
    }
  }

  function extractAndQueueMetrics(
    provider: ProviderName,  // For response parsing
    statusCode: number,
    responseBody: Buffer,
    latencyMs: number,
    effectiveAgentId: string,
    requestedModel: string | null,
    actualModel: string | null,  // Model after override (for cost calculation)
    eventProvider?: ProviderName,  // For event recording (defaults to provider)
    eventId?: string,  // Pre-generated event ID for payload correlation
  ): void {
    const responseText = responseBody.toString("utf-8");

    // Record response for loop detection (always, even if parsing fails)
    loopDetector.recordResponse(effectiveAgentId, responseText);

    // Helper to record basic event when parsing fails
    const recordBasicEvent = (reason: string): void => {
      log.warn(`${reason} — recording basic event`);
      const basicEvent: AgentEvent = {
        id: eventId,
        agent_id: effectiveAgentId,
        event_type: "llm_call",
        provider: eventProvider ?? provider,
        model: actualModel ?? requestedModel,
        requested_model: requestedModel,
        tokens_in: null,
        tokens_out: null,
        tokens_total: null,
        cost_usd: null,
        latency_ms: latencyMs,
        status_code: statusCode,
        source: "proxy",
        timestamp: new Date().toISOString(),
        tags: { parse_failed: "true" },
      };
      eventBuffer.add(basicEvent);
    };

    if (provider === "unknown") {
      recordBasicEvent("Unrecognized provider");
      return;
    }

    // Parse the response body as JSON
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(responseText);
    } catch {
      recordBasicEvent(`Could not parse response body as JSON for ${provider}`);
      return;
    }

    const parsed = parseProviderResponse(provider, parsedBody, statusCode);
    if (!parsed) {
      recordBasicEvent(`No parser result for provider: ${provider}`);
      return;
    }

    // Use actualModel (after override) as fallback for cost calculation
    // This ensures cross-provider overrides use the target model's pricing
    const effectiveModel = parsed.model ?? actualModel ?? requestedModel;

    // Calculate cost if we have the necessary token data
    let costUsd: number | null = null;
    if (effectiveModel && parsed.tokensIn != null && parsed.tokensOut != null) {
      costUsd = calculateCost(effectiveModel, parsed.tokensIn, parsed.tokensOut, {
        cacheCreation: parsed.cacheCreationTokens ?? undefined,
        cacheRead: parsed.cacheReadTokens ?? undefined,
      }, provider);
    }

    const event: AgentEvent = {
      id: eventId,
      agent_id: effectiveAgentId,
      event_type: "llm_call",
      provider: eventProvider ?? provider,  // Use original provider for event
      model: effectiveModel,
      requested_model: requestedModel,
      tokens_in: parsed.tokensIn,
      tokens_out: parsed.tokensOut,
      tokens_total: parsed.tokensTotal,
      cost_usd: costUsd,
      latency_ms: latencyMs,
      status_code: statusCode,
      source: "proxy",
      timestamp: new Date().toISOString(),
      tags: {},
    };

    eventBuffer.add(event);

    // Track session sticky for conversation continuity (only for successful requests)
    if (statusCode >= 200 && statusCode < 300 && effectiveModel) {
      setSticky(effectiveAgentId, effectiveModel, eventProvider ?? provider);
    }
  }

  /**
   * Handle simplified route: POST /agents/:agent/:provider
   * All path construction is done internally - user just provides agent and provider.
   */
  async function handleSimplifiedRoute(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    effectiveAgentId: string,
    provider: ProviderName,
    targetUrl: string,
    useNativeApi: boolean = false,
  ): Promise<void> {
    // Provider policy check
    const providerPolicyResult = checkProviderPolicy(db, provider);
    if (!providerPolicyResult.allowed && providerPolicyResult.reason && providerPolicyResult.message) {
      log.info(`[PROXY] Request blocked for provider "${provider}": ${providerPolicyResult.reason}`);
      recordBlockedEvent(db, effectiveAgentId, provider, providerPolicyResult.reason, providerPolicyResult.message);

      if (providerPolicyResult.reason === "provider_rate_limited") {
        const retryAfter = providerRateLimiter.getRetryAfter(provider, provider);
        const rateLimitResponse = generateRateLimitResponse(provider, effectiveAgentId, retryAfter);
        res.setHeader("Retry-After", String(retryAfter));
        sendJson(res, 429, rateLimitResponse);
      } else {
        const blockedResponse = generateBlockedResponse(provider, providerPolicyResult.reason, providerPolicyResult.message);
        sendJson(res, 200, blockedResponse);
      }
      return;
    }

    // Agent policy check
    const policyResult = checkAgentPolicy(db, effectiveAgentId);
    if (!policyResult.allowed && policyResult.reason && policyResult.message) {
      log.info(`[PROXY] Request blocked for agent "${effectiveAgentId}": ${policyResult.reason}`);
      recordBlockedEvent(db, effectiveAgentId, provider, policyResult.reason, policyResult.message);
      const blockedResponse = generateBlockedResponse(provider, policyResult.reason, policyResult.message);
      sendJson(res, 200, blockedResponse);
      return;
    }

    // Read request body
    let requestBody: Buffer;
    try {
      requestBody = await readRequestBody(req);
    } catch (err) {
      if (err instanceof Error && err.message === "Request body too large") {
        sendJson(res, 413, { error: `Request body too large (max ${MAX_REQUEST_BODY_SIZE / 1024 / 1024}MB)` });
      } else {
        sendJson(res, 502, { error: "Failed to read request body" });
      }
      return;
    }

    // Kill Switch check
    const killSwitchConfig = getKillSwitchConfig(db, effectiveAgentId);
    if (killSwitchConfig.enabled) {
      try {
        const bodyJson = JSON.parse(requestBody.toString("utf-8"));
        const killSwitchIsStreaming = bodyJson.stream === true;
        const { promptHash, toolCalls } = loopDetector.recordRequest(effectiveAgentId, bodyJson);
        const loopCheck = loopDetector.checkLoop(effectiveAgentId, promptHash, toolCalls);

        if (loopCheck.isLoop) {
          log.warn(`[PROXY] Kill Switch triggered for agent "${effectiveAgentId}": score=${loopCheck.score.toFixed(2)}`);
          const message = `Agent loop detected (score: ${loopCheck.score.toFixed(1)}). Agent deactivated to prevent runaway costs.`;

          // Generate the kill switch response FIRST (before deactivating)
          // This ensures the agent/user receives a clear explanation
          const killSwitchResponse = generateKillSwitchResponse(
            provider,
            effectiveAgentId,
            loopCheck.score,
            loopCheck.details,
          );

          // Record events and deactivate agent
          if (db) {
            try {
              updateAgentPolicy(db, effectiveAgentId, { active: false, deactivated_by: "kill_switch" });
              log.info(`[PROXY] Agent "${effectiveAgentId}" deactivated by Kill Switch`);
            } catch (err) {
              log.error("Failed to deactivate agent", { err: String(err) });
            }
          }

          recordBlockedEvent(db, effectiveAgentId, provider, "loop_detected", message);

          if (db) {
            try {
              const killSwitchEvent: InsertEventRow = {
                agent_id: effectiveAgentId,
                event_type: "kill_switch",
                provider,
                model: null,
                tokens_in: null,
                tokens_out: null,
                tokens_total: null,
                cost_usd: null,
                latency_ms: null,
                status_code: 200,
                source: "proxy",
                timestamp: new Date().toISOString(),
                tags: {
                  loop_score: loopCheck.score,
                  threshold: killSwitchConfig.threshold,
                  window_size: killSwitchConfig.windowSize,
                  similar_prompts: loopCheck.details.similarPrompts,
                  similar_responses: loopCheck.details.similarResponses,
                  repeated_tool_calls: loopCheck.details.repeatedToolCalls,
                  action: "deactivated",
                },
              };
              const [killSwitchEventId] = insertEvents(db, [killSwitchEvent]);

              // Fire kill_switch alert for Telegram/webhook/email notifications
              const killSwitchData: KillSwitchEventData = {
                agent_id: effectiveAgentId,
                score: loopCheck.score,
                window_size: killSwitchConfig.windowSize,
                threshold: killSwitchConfig.threshold,
                details: loopCheck.details,
              };
              void fireKillSwitchAlert(db, killSwitchData);

              // Extract payload buffer as evidence for analysis
              const evidencePayloads = extractPayloads(effectiveAgentId);
              if (evidencePayloads.length > 0) {
                log.info(`[PROXY] Extracted ${evidencePayloads.length} payloads as kill switch evidence for agent "${effectiveAgentId}"`);

                // Archive evidence to server if enabled
                if (payloadArchive?.enabled && killSwitchEventId) {
                  void archiveEvidence(payloadArchive, killSwitchEventId, evidencePayloads);
                }
              }
            } catch (err) {
              log.error("Failed to record kill_switch event", { err: String(err) });
            }
          }

          // Send the response (streaming or non-streaming)
          if (killSwitchIsStreaming) {
            sendStreamingBlockedResponse(res, killSwitchResponse);
          } else {
            sendJson(res, 200, killSwitchResponse);
          }
          return;
        }
      } catch {
        // Not JSON body - skip loop detection
      }
    }

    // Generate eventId early for correlation: security_events, agent_events, event_payloads
    const eventId = crypto.randomUUID();

    // Check if request is streaming (needed for proper blocked response format)
    let requestIsStreaming = false;
    try {
      const bodyJson = JSON.parse(requestBody.toString("utf-8"));
      requestIsStreaming = bodyJson.stream === true;
    } catch {
      // Not JSON, assume non-streaming
    }

    // Security request check (data masking + tool restrictions)
    const securityRequestResult = await securityFilter.checkRequest(
      effectiveAgentId,
      requestBody.toString("utf-8"),
      eventId,
    );

    if (!securityRequestResult.allowed) {
      log.info(`[PROXY] Request blocked by security: ${securityRequestResult.blockReason}`);
      const blockedResponse = generateSecurityBlockedResponse(
        securityRequestResult.blockReason || "Security policy violation",
        provider,
      );

      if (requestIsStreaming) {
        // Send as SSE streaming response so streaming clients can handle it
        sendStreamingBlockedResponse(res, blockedResponse);
      } else {
        sendJson(res, 200, blockedResponse);
      }
      return;
    }

    // Apply masked content if security filter modified the request
    if (securityRequestResult.modifiedContent) {
      requestBody = Buffer.from(securityRequestResult.modifiedContent, "utf-8");
      log.debug(`[PROXY] Request content masked by security filter`);
    }

    // Model override and request normalization
    let requestedModel: string | null = null;  // Original model from client request
    let actualModel: string | null = null;     // Model after override (for cost calculation)
    let modifiedRequestBody = requestBody;
    let crossProviderOverride: { targetProvider: ProviderName; originalProvider: ProviderName } | null = null;
    let effectiveProvider = provider; // May change if cross-provider override
    let isStreaming = false;
    let useCodexApi = false; // True when using OpenAI Codex models (need /v1/responses)

    try {
      let bodyJson = JSON.parse(requestBody.toString("utf-8"));
      let bodyModified = false;
      isStreaming = bodyJson.stream === true;

      // Extract model from request body if present
      if (bodyJson.model) {
        requestedModel = bodyJson.model;
        actualModel = bodyJson.model;  // Default to same as requested
      }

      // Always check for model override rules (even if request has no model)
      // This handles providers like Google where model is in URL, not body
      const override = getModelOverride(db, effectiveAgentId, provider);

      // Virtual "agentgazer" provider requires cross-provider override
      // But if model is "agentgazer-proxy", return connection success and create agent
      if (provider === "agentgazer" && !override.targetProvider) {
        if (requestedModel === "agentgazer-proxy" && db) {
          // Connection test - create agent and return success
          log.info(`[PROXY] AgentGazer connection test for agent: ${effectiveAgentId}`);
          upsertAgent(db, effectiveAgentId);

          // Record connection event
          const event: AgentEvent = {
            agent_id: effectiveAgentId,
            event_type: "custom",
            provider: "agentgazer",
            model: "agentgazer-proxy",
            tokens_in: 0,
            tokens_out: 0,
            tokens_total: 0,
            cost_usd: 0,
            latency_ms: 0,
            status_code: 200,
            source: "proxy",
            timestamp: new Date().toISOString(),
            tags: { event_name: "connection_test" },
          };
          eventBuffer.add(event);

          const messageContent = `AgentGazer connected successfully for agent "${effectiveAgentId}".\n\nNext step: Go to Dashboard > Agents > ${effectiveAgentId} > Model Settings and configure the "agentgazer" provider with your desired model and target provider.`;
          const completionId = `chatcmpl-${Date.now()}`;
          const created = Math.floor(Date.now() / 1000);

          if (isStreaming) {
            // Return OpenAI streaming response (SSE)
            res.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            });

            // Send content chunk
            const chunk = {
              id: completionId,
              object: "chat.completion.chunk",
              created,
              model: "agentgazer-proxy",
              choices: [{
                index: 0,
                delta: { role: "assistant", content: messageContent },
                finish_reason: null,
              }],
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);

            // Send finish chunk
            const finishChunk = {
              id: completionId,
              object: "chat.completion.chunk",
              created,
              model: "agentgazer-proxy",
              choices: [{
                index: 0,
                delta: {},
                finish_reason: "stop",
              }],
            };
            res.write(`data: ${JSON.stringify(finishChunk)}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();
          } else {
            // Return OpenAI non-streaming response
            sendJson(res, 200, {
              id: completionId,
              object: "chat.completion",
              created,
              model: "agentgazer-proxy",
              choices: [{
                index: 0,
                message: {
                  role: "assistant",
                  content: messageContent,
                },
                finish_reason: "stop",
              }],
              usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            });
          }
          return;
        }

        log.error(`[PROXY] Provider "agentgazer" requires cross-provider override. Configure Model Settings in Dashboard.`);
        sendJson(res, 400, {
          error: "AgentGazer proxy requires Model Settings configuration",
          hint: "Go to Dashboard > Agents > Model Settings and set Target Provider for agentgazer",
        });
        return;
      }

      // Apply model override if configured
      if (override.model) {
        if (requestedModel) {
          log.info(`[PROXY] Model override: ${requestedModel} → ${override.model}`);
        } else {
          log.info(`[PROXY] Model override (no model in request): → ${override.model}`);
        }
        bodyJson.model = override.model;
        actualModel = override.model;  // Track the actual model for cost calculation
        bodyModified = true;
      }

      // Handle cross-provider override
      if (override.targetProvider && override.targetProvider !== provider && KNOWN_PROVIDER_NAMES.includes(override.targetProvider as ProviderName)) {
        const targetProv = override.targetProvider as ProviderName;
        log.info(`[PROXY] Cross-provider override: ${provider} → ${targetProv}`);

        // Check if we have credentials for the target provider
        // OAuth providers use OAuth tokens, others use API keys
        const isTargetOAuth = isOAuthProvider(targetProv);
        const hasOAuthToken = isTargetOAuth && oauthTokens[targetProv];
        const hasApiKey = !isTargetOAuth && providerKeys[targetProv];

        if (!hasOAuthToken && !hasApiKey) {
          const credType = isTargetOAuth ? "OAuth token" : "API key";
          log.error(`[PROXY] No ${credType} configured for target provider: ${targetProv}`);
          sendJson(res, 400, { error: `Cross-provider override failed: no ${credType} for ${targetProv}` });
          return;
        }

        crossProviderOverride = { targetProvider: targetProv, originalProvider: provider };
        effectiveProvider = targetProv;

        // Transform request format if needed
        // Providers that use Anthropic Messages API format
        const anthropicFormatProviders = new Set(["anthropic", "minimax-oauth"]);
        const isSourceAnthropic = anthropicFormatProviders.has(provider);
        const isTargetAnthropic = anthropicFormatProviders.has(targetProv);

        if (targetProv === "openai-oauth") {
          // Any provider → Codex API
          // Convert to Codex format (Responses API)
          let openaiRequest: OpenAIRequest;
          if (isSourceAnthropic) {
            openaiRequest = anthropicToOpenaiRequest(bodyJson as AnthropicRequest);
          } else {
            openaiRequest = bodyJson as OpenAIRequest;
          }
          const codexRequest = openaiToCodex(openaiRequest);
          bodyJson = codexRequest;
          bodyModified = true;
          log.info(`[PROXY] Transformed request: ${provider} → Codex API`);
        } else if (!isSourceAnthropic && isTargetAnthropic) {
          // OpenAI-compatible → Anthropic format (anthropic, minimax-oauth)
          const anthropicRequest = openaiToAnthropic(bodyJson as OpenAIRequest);
          bodyJson = anthropicRequest;
          bodyModified = true;
          log.info(`[PROXY] Transformed request: ${provider} → Anthropic format (${targetProv})`);
        } else if (isSourceAnthropic && !isTargetAnthropic && targetProv !== ("openai-oauth" as ProviderName)) {
          // Anthropic format → OpenAI-compatible
          const openaiRequest = anthropicToOpenaiRequest(bodyJson as AnthropicRequest);
          bodyJson = openaiRequest;
          bodyModified = true;
          log.info(`[PROXY] Transformed request: Anthropic format → OpenAI`);
        }
        // Other cases (same format family) don't need transformation

        // Update target URL for cross-provider
        const newEndpoint = getProviderChatEndpoint(targetProv);
        if (newEndpoint) {
          targetUrl = newEndpoint;
          log.info(`[PROXY] Redirecting to: ${targetUrl}`);
        }
      }

      // Detect Codex models for OpenAI provider (not openai-oauth which already uses Codex API)
      // Codex models like gpt-5.2-codex require /v1/responses endpoint instead of /v1/chat/completions
      if (provider === "openai" && !crossProviderOverride && isCodexModel(actualModel)) {
        useCodexApi = true;
        log.info(`[PROXY] Detected Codex model "${actualModel}" - using Responses API`);

        // Convert OpenAI Chat Completions format to Codex Responses API format
        const codexRequest = openaiToCodex(bodyJson as OpenAIRequest);
        bodyJson = codexRequest;
        bodyModified = true;

        // Update target URL to Responses API
        targetUrl = OPENAI_RESPONSES_API_ENDPOINT;
        log.info(`[PROXY] Redirecting to: ${targetUrl}`);
      }

      // Normalize request body for provider compatibility
      // Skip for openai-oauth (Codex) and when using Codex API since it uses a completely different format
      if (effectiveProvider !== "openai-oauth" && !useCodexApi) {
        const normalized = normalizeRequestBody(effectiveProvider, bodyJson, log);
        if (normalized.modified) {
          bodyJson = normalized.body;
          bodyModified = true;
        }
      }

      if (bodyModified) {
        modifiedRequestBody = Buffer.from(JSON.stringify(bodyJson), "utf-8");
      }
    } catch {
      // Not JSON or parse error - forward as-is
    }

    // Rate limiting check
    const rateLimitResult = rateLimiter.check(effectiveAgentId, provider);
    if (!rateLimitResult.allowed) {
      const retryAfter = rateLimitResult.retryAfterSeconds ?? 60;
      const message = `Rate limit exceeded for agent "${effectiveAgentId}" on ${provider}. Please retry after ${retryAfter} seconds.`;

      res.writeHead(429, { "Content-Type": "application/json", "Retry-After": String(retryAfter) });

      const errorBody = provider === "anthropic"
        ? { type: "error", error: { type: "rate_limit_error", message }, retry_after_seconds: retryAfter }
        : { error: { message, type: "rate_limit_error", param: null, code: "rate_limit_exceeded" }, retry_after_seconds: retryAfter };

      res.end(JSON.stringify(errorBody));

      const event: AgentEvent = {
        agent_id: effectiveAgentId,
        event_type: "error",
        provider,
        model: null,
        tokens_in: null,
        tokens_out: null,
        tokens_total: null,
        cost_usd: null,
        latency_ms: null,
        status_code: 429,
        source: "proxy",
        timestamp: new Date().toISOString(),
        tags: { rate_limited: "true" },
      };
      eventBuffer.add(event);
      return;
    }

    // Build headers
    const forwardHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === "x-target-url" || lowerKey === "host" || lowerKey === "connection" || lowerKey === "content-length") {
        continue;
      }
      if (value !== undefined) {
        forwardHeaders[key] = Array.isArray(value) ? value.join(", ") : value;
      }
    }

    // For cross-provider override, remove ALL auth-related headers from the original request
    // This prevents the original provider's API key from being forwarded to the target provider
    if (crossProviderOverride) {
      const authHeaders = ["authorization", "x-api-key", "api-key", "x-goog-api-key"];
      for (const key of Object.keys(forwardHeaders)) {
        if (authHeaders.includes(key.toLowerCase())) {
          delete forwardHeaders[key];
          log.info(`[PROXY] Removed ${key} header for cross-provider override`);
        }
      }
    }

    // Inject API key or OAuth token (use effective provider for cross-provider override)
    let authKey: string | null = null;
    let authType: "apikey" | "oauth" = "apikey";

    if (isOAuthProvider(effectiveProvider)) {
      // Use OAuth token for OAuth providers
      authKey = await getOAuthAccessToken(effectiveProvider);
      authType = "oauth";
      if (!authKey) {
        log.warn(`[PROXY] No OAuth token configured for provider: ${effectiveProvider}. Run 'agentgazer login ${effectiveProvider}'.`);
        sendJson(res, 401, {
          error: `OAuth not configured for ${effectiveProvider}. Run 'agentgazer login ${effectiveProvider}' to authenticate.`,
        });
        return;
      }
    } else {
      // Use API key for regular providers
      authKey = providerKeys[effectiveProvider] ?? null;
      if (crossProviderOverride) {
        // Debug: show available provider keys for troubleshooting
        const availableProviders = Object.keys(providerKeys);
        log.info(`[PROXY] Cross-provider: looking for "${effectiveProvider}" key, available: [${availableProviders.join(", ")}]`);
        // Show key lengths for debugging
        const keyLengths = availableProviders.map(p => `${p}:${providerKeys[p]?.length ?? 0}`).join(", ");
        log.info(`[PROXY] Key lengths: ${keyLengths}`);
      }
    }

    if (authKey) {
      const authHeader = getProviderAuthHeader(effectiveProvider, authKey, useNativeApi && !crossProviderOverride);
      if (authHeader) {
        const existingAuthKey = Object.keys(forwardHeaders).find(k => k.toLowerCase() === authHeader.name.toLowerCase());
        if (existingAuthKey) delete forwardHeaders[existingAuthKey];
        forwardHeaders[authHeader.name] = authHeader.value;
        const maskedKey = authKey.length > 12 ? `${authKey.slice(0, 8)}...${authKey.slice(-4)}` : "****";
        log.info(`[PROXY] Injected ${authHeader.name}=${maskedKey} (len=${authKey.length}) for ${effectiveProvider}${crossProviderOverride ? " (cross-provider)" : ""}${authType === "oauth" ? " (OAuth)" : ""}${useNativeApi ? " (native API)" : ""}`);
      }
    } else if (!isOAuthProvider(effectiveProvider)) {
      log.warn(`[PROXY] No API key configured for provider: ${effectiveProvider}`);
    }

    // Add provider-specific required headers
    if (effectiveProvider === "anthropic") {
      // Anthropic requires anthropic-version header
      if (!forwardHeaders["anthropic-version"]) {
        forwardHeaders["anthropic-version"] = "2023-06-01";
        log.info(`[PROXY] Added anthropic-version header`);
      }
    }

    // Codex API (via OpenAI OAuth) requires special headers
    if (effectiveProvider === "openai-oauth" && authKey) {
      forwardHeaders["OpenAI-Beta"] = "responses=experimental";
      forwardHeaders["originator"] = "pi";
      forwardHeaders["accept"] = "text/event-stream";

      // Extract chatgpt-account-id from JWT token
      try {
        const tokenParts = authKey.split(".");
        if (tokenParts.length >= 2) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], "base64").toString("utf-8"));
          // Try multiple possible claim names for the account ID
          // OpenAI OAuth tokens often have nested claims in https://api.openai.com/auth
          const authClaim = payload["https://api.openai.com/auth"];
          const accountId = payload.chatgpt_account_id
            || payload.account_id
            || authClaim?.account_id
            || authClaim?.user_id
            || authClaim?.organization_id
            || payload.org_id
            || payload.organization_id
            || payload.sub; // Fallback to subject claim
          if (accountId) {
            forwardHeaders["chatgpt-account-id"] = accountId;
            log.info(`[PROXY] Added Codex headers (account: ${String(accountId).slice(0, 8)}...)`);
          } else {
            // Log available claims for debugging
            const claimKeys = Object.keys(payload).slice(0, 10).join(", ");
            const authClaimKeys = authClaim ? Object.keys(authClaim).join(", ") : "none";
            log.warn(`[PROXY] JWT token missing account_id claim. Top-level: ${claimKeys}. Auth claim keys: ${authClaimKeys}`);
          }
        }
      } catch (e) {
        log.warn(`[PROXY] Failed to decode JWT for chatgpt-account-id: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Codex API (via regular OpenAI API key) requires beta header
    if (useCodexApi) {
      forwardHeaders["OpenAI-Beta"] = "responses=experimental";
      log.info(`[PROXY] Added OpenAI-Beta header for Codex Responses API`);
    }

    // Debug logging for request details (mask sensitive headers)
    const maskedHeaders: Record<string, string> = {};
    const sensitiveHeaders = ["authorization", "x-api-key", "x-goog-api-key", "api-key"];
    for (const [key, value] of Object.entries(forwardHeaders)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        // Show first 8 chars + masked rest
        maskedHeaders[key] = value.length > 12 ? `${value.slice(0, 8)}...****` : "****";
      } else {
        maskedHeaders[key] = value;
      }
    }
    log.debug(`[PROXY] Request headers: ${JSON.stringify(maskedHeaders)}`);
    try {
      const bodyPreview = modifiedRequestBody.toString("utf-8").slice(0, 2000);
      log.debug(`[PROXY] Request body: ${bodyPreview}${modifiedRequestBody.length > 2000 ? "... (truncated)" : ""}`);
    } catch {
      log.debug(`[PROXY] Request body: (binary, ${modifiedRequestBody.length} bytes)`);
    }

    const requestStart = Date.now();
    let providerResponse: Response;

    try {
      providerResponse = await fetch(targetUrl, {
        method: "POST",
        headers: forwardHeaders,
        body: new Uint8Array(modifiedRequestBody),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown fetch error";
      log.error(`[PROXY] Upstream request failed: ${message}`);
      sendJson(res, 502, { error: `Upstream request failed: ${message}` });
      return;
    }

    log.info(`[PROXY] Response: ${providerResponse.status} ${providerResponse.statusText}`);

    const contentType = providerResponse.headers.get("content-type") ?? "";
    // Codex may not return text/event-stream content-type, so also check if we requested streaming
    const isSSE = contentType.includes("text/event-stream") ||
      (effectiveProvider === "openai-oauth" && isStreaming) ||
      (useCodexApi && isStreaming);

    if (isSSE && providerResponse.body) {
      // Providers that use Anthropic Messages API format (for streaming conversion)
      const anthropicFormatProviders = new Set(["anthropic", "minimax-oauth"]);
      const isOriginalAnthropic = crossProviderOverride ? anthropicFormatProviders.has(crossProviderOverride.originalProvider) : false;
      const isTargetAnthropic = anthropicFormatProviders.has(effectiveProvider);

      // Determine stream conversion direction BEFORE setting headers
      // Case 1: OpenAI-compatible client → Anthropic format target (convert Anthropic SSE → OpenAI SSE)
      const needsAnthropicToOpenai = crossProviderOverride && isTargetAnthropic && !isOriginalAnthropic;
      // Case 2: Anthropic format client → OpenAI-compatible target (convert OpenAI SSE → Anthropic SSE)
      const needsOpenaiToAnthropic = crossProviderOverride && isOriginalAnthropic && !isTargetAnthropic && effectiveProvider !== "openai-oauth";
      // Case 3: OpenAI-compatible client → Codex target (convert Codex SSE → OpenAI SSE)
      // This includes: (a) cross-provider override to openai-oauth, or (b) direct Codex model via OpenAI API
      const needsCodexToOpenai = (crossProviderOverride && effectiveProvider === "openai-oauth" && !isOriginalAnthropic) ||
        (useCodexApi && !crossProviderOverride);
      // Case 4: Anthropic format client → Codex target (convert Codex SSE → OpenAI SSE → Anthropic SSE)
      const needsCodexToAnthropic = crossProviderOverride && effectiveProvider === "openai-oauth" && isOriginalAnthropic;

      // Streaming response - build headers carefully
      const responseHeaders: Record<string, string> = {};

      // Headers to skip when forwarding SSE response
      const skipHeaders = new Set([
        "content-encoding",      // fetch() auto-decompresses, so this would be wrong
        "content-length",        // SSE is streamed, no fixed length
        "transfer-encoding",     // Let Node.js handle this
        "connection",            // Let Node.js handle this
      ]);

      // Headers to skip when doing cross-provider override (provider-specific headers)
      const providerSpecificHeaders = new Set([
        "x-request-id",
        "openai-processing-ms",
        "openai-organization",
        "openai-version",
        "x-ratelimit-limit-requests",
        "x-ratelimit-limit-tokens",
        "x-ratelimit-remaining-requests",
        "x-ratelimit-remaining-tokens",
        "x-ratelimit-reset-requests",
        "x-ratelimit-reset-tokens",
      ]);

      providerResponse.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (skipHeaders.has(lowerKey)) return;
        if (crossProviderOverride && providerSpecificHeaders.has(lowerKey)) return;
        responseHeaders[key] = value;
      });

      // Ensure correct headers for SSE
      responseHeaders["Content-Type"] = "text/event-stream; charset=utf-8";
      responseHeaders["Cache-Control"] = "no-cache";
      responseHeaders["Connection"] = "keep-alive";
      responseHeaders["X-Accel-Buffering"] = "no"; // Disable nginx buffering if behind nginx

      res.writeHead(providerResponse.status, responseHeaders);
      res.flushHeaders(); // Ensure headers are sent immediately

      const chunks: Buffer[] = [];
      let accumulatedSize = 0;
      const reader = providerResponse.body.getReader();

      let streamState: StreamingConverterState | null = null;
      let reverseStreamState: OpenAIToAnthropicStreamState | null = null;
      let codexStreamState: CodexToOpenAIStreamState | null = null;
      let lineBuffer = "";
      // Use StringDecoder to handle multi-byte UTF-8 characters split across chunks
      const utf8Decoder = new StringDecoder("utf8");

      // Track time to first token (TTFT)
      let firstChunkTime: number | null = null;

      if (needsCodexToOpenai) {
        codexStreamState = createCodexToOpenAIStreamState();
        log.info(`[PROXY] Converting Codex SSE stream → OpenAI format`);
      } else if (needsCodexToAnthropic) {
        codexStreamState = createCodexToOpenAIStreamState();
        reverseStreamState = createOpenAIToAnthropicStreamState();
        log.info(`[PROXY] Converting Codex SSE stream → OpenAI → Anthropic format`);
      } else if (needsAnthropicToOpenai) {
        streamState = createStreamingConverterState();
        log.info(`[PROXY] Converting Anthropic SSE stream → OpenAI format`);
      } else if (needsOpenaiToAnthropic) {
        reverseStreamState = createOpenAIToAnthropicStreamState();
        log.info(`[PROXY] Converting OpenAI SSE stream → Anthropic format`);
      }

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const buf = Buffer.from(value);

          // Track time to first token
          if (firstChunkTime === null && buf.length > 0) {
            firstChunkTime = Date.now();
          }

          if (needsCodexToOpenai && codexStreamState) {
            // Transform Codex SSE to OpenAI SSE
            // Use StringDecoder to properly handle multi-byte UTF-8 characters
            lineBuffer += utf8Decoder.write(buf);
            const lines = lineBuffer.split("\n");
            lineBuffer = lines.pop() ?? ""; // Keep incomplete line for next chunk

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data && data !== "[DONE]") {
                  const event = parseCodexSSELine(data);
                  if (event) {
                    const openaiChunks = codexSseToOpenaiChunks(event, codexStreamState, requestedModel ?? undefined);
                    for (const chunk of openaiChunks) {
                      const sseData = formatOpenAISSELine(chunk);
                      res.write(sseData);
                      accumulatedSize += sseData.length;
                    }
                  } else {
                    log.debug(`[PROXY] Failed to parse Codex SSE event: ${data.slice(0, 200)}`);
                  }
                }
              }
            }

            // Store original for metrics
            if (accumulatedSize <= MAX_SSE_BUFFER_SIZE) {
              chunks.push(buf);
            }
          } else if (needsCodexToAnthropic && codexStreamState && reverseStreamState) {
            // Transform Codex SSE → OpenAI SSE → Anthropic SSE (two-stage conversion)
            lineBuffer += utf8Decoder.write(buf);
            const lines = lineBuffer.split("\n");
            lineBuffer = lines.pop() ?? "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data && data !== "[DONE]") {
                  const event = parseCodexSSELine(data);
                  if (event) {
                    // Stage 1: Codex → OpenAI chunks
                    const openaiChunks = codexSseToOpenaiChunks(event, codexStreamState, requestedModel ?? undefined);
                    // Stage 2: OpenAI chunks → Anthropic SSE
                    for (const chunk of openaiChunks) {
                      const anthropicLines = openaiChunkToAnthropicSse(chunk, reverseStreamState, requestedModel ?? undefined);
                      for (const sseLine of anthropicLines) {
                        res.write(sseLine);
                        accumulatedSize += sseLine.length;
                      }
                    }
                  } else {
                    log.debug(`[PROXY] Failed to parse Codex SSE event: ${data.slice(0, 200)}`);
                  }
                }
              }
            }

            // Store original for metrics
            if (accumulatedSize <= MAX_SSE_BUFFER_SIZE) {
              chunks.push(buf);
            }
          } else if (needsAnthropicToOpenai && streamState) {
            // Transform Anthropic SSE to OpenAI SSE
            // Use StringDecoder to properly handle multi-byte UTF-8 characters
            lineBuffer += utf8Decoder.write(buf);
            const lines = lineBuffer.split("\n");
            lineBuffer = lines.pop() ?? ""; // Keep incomplete line for next chunk

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data && data !== "[DONE]") {
                  try {
                    const event = JSON.parse(data) as AnthropicSSEEvent;
                    const openaiChunks = anthropicSseToOpenaiChunks(event, streamState, requestedModel ?? undefined);
                    for (const chunk of openaiChunks) {
                      const sseData = formatOpenAISSELine(chunk);
                      res.write(sseData);
                      accumulatedSize += sseData.length;
                    }
                  } catch (e) {
                    log.debug(`[PROXY] Failed to parse Anthropic SSE event: ${data}`);
                  }
                }
              }
            }

            // Store original for metrics
            if (accumulatedSize <= MAX_SSE_BUFFER_SIZE) {
              chunks.push(buf);
            }
          } else if (needsOpenaiToAnthropic && reverseStreamState) {
            // Transform OpenAI SSE to Anthropic SSE
            // Use StringDecoder to properly handle multi-byte UTF-8 characters
            lineBuffer += utf8Decoder.write(buf);
            const lines = lineBuffer.split("\n");
            lineBuffer = lines.pop() ?? ""; // Keep incomplete line for next chunk

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data && data !== "[DONE]") {
                  try {
                    const chunk = JSON.parse(data) as OpenAIStreamChunk;
                    const anthropicLines = openaiChunkToAnthropicSse(chunk, reverseStreamState, requestedModel ?? undefined);
                    for (const sseLine of anthropicLines) {
                      log.info(`[PROXY] Anthropic SSE: ${sseLine.slice(0, 150).replace(/\n/g, "\\n")}`);
                      res.write(sseLine);
                      accumulatedSize += sseLine.length;
                    }
                  } catch (e) {
                    log.debug(`[PROXY] Failed to parse OpenAI SSE chunk: ${data}`);
                  }
                }
              }
            }

            // Store original for metrics
            if (accumulatedSize <= MAX_SSE_BUFFER_SIZE) {
              chunks.push(buf);
            }
          } else {
            // No conversion needed, pass through
            res.write(buf);
            accumulatedSize += buf.length;
            if (accumulatedSize <= MAX_SSE_BUFFER_SIZE) {
              chunks.push(buf);
            }
          }
        }

        // Handle any remaining data in lineBuffer for OpenAI → Anthropic conversion
        if (needsOpenaiToAnthropic && reverseStreamState && lineBuffer.trim()) {
          if (lineBuffer.startsWith("data: ")) {
            const data = lineBuffer.slice(6).trim();
            if (data && data !== "[DONE]") {
              try {
                const chunk = JSON.parse(data) as OpenAIStreamChunk;
                const anthropicLines = openaiChunkToAnthropicSse(chunk, reverseStreamState, requestedModel ?? undefined);
                for (const sseLine of anthropicLines) {
                  log.info(`[PROXY] Anthropic SSE (final): ${sseLine.slice(0, 150).replace(/\n/g, "\\n")}`);
                  res.write(sseLine);
                }
              } catch (e) {
                log.debug(`[PROXY] Failed to parse final OpenAI SSE chunk: ${data}`);
              }
            }
          }
        }

        // Send done markers for converted streams
        if (needsAnthropicToOpenai || needsCodexToOpenai) {
          res.write(formatOpenAISSEDone());
        }

        // For Codex → OpenAI conversion, ensure proper stream finalization
        if (needsCodexToOpenai && codexStreamState && codexStreamState.sentFirstChunk) {
          // If stream ended without response.done, send finalization
          const finalChunks = finalizeCodexToOpenAIStream(codexStreamState);
          for (const chunk of finalChunks) {
            res.write(formatOpenAISSELine(chunk));
          }
        }

        // For Codex → Anthropic conversion, finalize both stages
        if (needsCodexToAnthropic && codexStreamState && reverseStreamState) {
          // Stage 1: Finalize Codex → OpenAI
          if (codexStreamState.sentFirstChunk) {
            const finalChunks = finalizeCodexToOpenAIStream(codexStreamState);
            // Stage 2: Convert finalization chunks to Anthropic
            for (const chunk of finalChunks) {
              const anthropicLines = openaiChunkToAnthropicSse(chunk, reverseStreamState, requestedModel ?? undefined);
              for (const sseLine of anthropicLines) {
                res.write(sseLine);
              }
            }
          }
          // Finalize Anthropic stream if not already done
          if (reverseStreamState.sentMessageStart && !isOpenAIToAnthropicStreamFinalized(reverseStreamState)) {
            const finalLines = finalizeOpenAIToAnthropicStream(reverseStreamState);
            for (const sseLine of finalLines) {
              res.write(sseLine);
            }
          }
        }

        // For OpenAI → Anthropic conversion, ensure proper stream finalization
        // This handles cases where the OpenAI stream ended without a finish_reason chunk
        if (needsOpenaiToAnthropic && reverseStreamState) {
          if (!isOpenAIToAnthropicStreamFinalized(reverseStreamState)) {
            log.info(`[PROXY] OpenAI stream ended without proper finalization, sending closing events`);
            const finalLines = finalizeOpenAIToAnthropicStream(reverseStreamState);
            for (const sseLine of finalLines) {
              log.info(`[PROXY] Anthropic SSE (finalize): ${sseLine.slice(0, 150).replace(/\n/g, "\\n")}`);
              res.write(sseLine);
            }
          }
        }
      } catch (error) {
        log.error("Stream read error", { err: error instanceof Error ? error.message : String(error) });

        // Even on error, try to finalize streams
        if (needsCodexToOpenai && codexStreamState && codexStreamState.sentFirstChunk) {
          try {
            const finalChunks = finalizeCodexToOpenAIStream(codexStreamState);
            for (const chunk of finalChunks) {
              res.write(formatOpenAISSELine(chunk));
            }
            res.write(formatOpenAISSEDone());
          } catch {
            // Ignore errors during error recovery
          }
        }

        // Error recovery for Codex → Anthropic
        if (needsCodexToAnthropic && codexStreamState && reverseStreamState) {
          try {
            if (codexStreamState.sentFirstChunk) {
              const finalChunks = finalizeCodexToOpenAIStream(codexStreamState);
              for (const chunk of finalChunks) {
                const anthropicLines = openaiChunkToAnthropicSse(chunk, reverseStreamState, requestedModel ?? undefined);
                for (const sseLine of anthropicLines) {
                  res.write(sseLine);
                }
              }
            }
            if (reverseStreamState.sentMessageStart && !isOpenAIToAnthropicStreamFinalized(reverseStreamState)) {
              const finalLines = finalizeOpenAIToAnthropicStream(reverseStreamState);
              for (const sseLine of finalLines) {
                res.write(sseLine);
              }
            }
          } catch {
            // Ignore errors during error recovery
          }
        }

        if (needsOpenaiToAnthropic && reverseStreamState && reverseStreamState.sentMessageStart) {
          try {
            if (!isOpenAIToAnthropicStreamFinalized(reverseStreamState)) {
              const finalLines = finalizeOpenAIToAnthropicStream(reverseStreamState);
              for (const sseLine of finalLines) {
                res.write(sseLine);
              }
            }
          } catch {
            // Ignore errors during error recovery
          }
        }
      } finally {
        res.end();
      }

      const latencyMs = Date.now() - requestStart;
      const fullBody = Buffer.concat(chunks);

      // Calculate TTFT (time to first token)
      const ttftMs = firstChunkTime !== null ? firstChunkTime - requestStart : null;

      // Use eventId from request scope for correlation with security_events
      try {
        // Use effective provider for parsing, original provider for event recording
        // When using Codex API via regular OpenAI, parse as openai-oauth (Codex format)
        const parsingProvider = useCodexApi ? "openai-oauth" as ProviderName : effectiveProvider;
        extractStreamingMetrics(parsingProvider, providerResponse.status, fullBody, latencyMs, effectiveAgentId, requestedModel, actualModel, provider, ttftMs, eventId);
      } catch (error) {
        log.error("Streaming metric extraction error", { err: error instanceof Error ? error.message : String(error) });
      }

      // Push to payload buffer for kill switch evidence (streaming)
      if (providerResponse.status >= 200 && providerResponse.status < 400) {
        try {
          const reqBody = modifiedRequestBody.toString("utf-8");
          const resBody = fullBody.toString("utf-8");
          const payload: BufferedPayload = {
            eventId,
            agentId: effectiveAgentId,
            requestBody: reqBody,
            responseBody: resBody,
            timestamp: Date.now(),
          };
          pushPayload(effectiveAgentId, payload);

          // Archive to server if enabled
          if (payloadArchive?.enabled) {
            archivePayload(payloadArchive, eventId, effectiveAgentId, reqBody, resBody);
          }
        } catch {
          // Ignore payload buffer errors
        }
      }
    } else {
      // Non-streaming response
      let responseBodyBuffer: Buffer;
      try {
        const arrayBuffer = await providerResponse.arrayBuffer();
        responseBodyBuffer = Buffer.from(arrayBuffer);
      } catch {
        sendJson(res, 502, { error: "Failed to read upstream response body" });
        return;
      }

      const latencyMs = Date.now() - requestStart;

      // Transform response if cross-provider override
      let finalResponseBody = responseBodyBuffer;
      let responseConverted = false;

      if (crossProviderOverride && providerResponse.status < 400) {
        // Providers that use Anthropic Messages API format
        const anthropicFormatProviders = new Set(["anthropic", "minimax-oauth"]);
        const isOriginalAnthropic = anthropicFormatProviders.has(crossProviderOverride.originalProvider);
        const isTargetAnthropic = anthropicFormatProviders.has(effectiveProvider);

        // Case 1: OpenAI-compatible client → Anthropic format target
        // Need to convert Anthropic response → OpenAI format
        if (isTargetAnthropic && !isOriginalAnthropic) {
          try {
            const anthropicResponse = JSON.parse(responseBodyBuffer.toString("utf-8")) as AnthropicResponse;
            const openaiResponse = anthropicToOpenai(anthropicResponse, requestedModel ?? undefined);
            finalResponseBody = Buffer.from(JSON.stringify(openaiResponse), "utf-8");
            responseConverted = true;
            log.info(`[PROXY] Converted Anthropic format response → OpenAI format`);
          } catch (e) {
            log.error(`[PROXY] Failed to convert Anthropic response: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        // Case 2: Anthropic format client → OpenAI-compatible target
        // Need to convert OpenAI response → Anthropic format
        else if (isOriginalAnthropic && !isTargetAnthropic) {
          try {
            const openaiResponse = JSON.parse(responseBodyBuffer.toString("utf-8")) as OpenAIResponse;
            const anthropicResponse = openaiToAnthropicResponse(openaiResponse, requestedModel ?? undefined);
            finalResponseBody = Buffer.from(JSON.stringify(anthropicResponse), "utf-8");
            responseConverted = true;
            log.info(`[PROXY] Converted OpenAI response → Anthropic format`);
          } catch (e) {
            log.error(`[PROXY] Failed to convert OpenAI response: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }

      const responseHeaders: Record<string, string> = {};
      providerResponse.headers.forEach((value, key) => {
        if (key.toLowerCase() === "transfer-encoding") return;
        // Update content-length if we transformed the body
        if (key.toLowerCase() === "content-length" && responseConverted) {
          responseHeaders[key] = String(finalResponseBody.length);
          return;
        }
        responseHeaders[key] = value;
      });

      // Log error responses (INFO level for cross-provider, DEBUG for others)
      if (providerResponse.status >= 400) {
        try {
          const errorBody = responseBodyBuffer.toString("utf-8").slice(0, 2000);
          if (crossProviderOverride) {
            log.info(`[PROXY] Cross-provider error (${providerResponse.status}): ${errorBody}${responseBodyBuffer.length > 2000 ? "... (truncated)" : ""}`);
          } else {
            log.debug(`[PROXY] Error response body: ${errorBody}${responseBodyBuffer.length > 2000 ? "... (truncated)" : ""}`);
          }
        } catch {
          log.debug(`[PROXY] Error response body: (binary, ${responseBodyBuffer.length} bytes)`);
        }
      }

      // Security response check (prompt injection + data masking) - only for successful responses
      if (providerResponse.status >= 200 && providerResponse.status < 400) {
        const securityResponseResult = await securityFilter.checkResponse(
          effectiveAgentId,
          finalResponseBody.toString("utf-8"),
          eventId,
          modifiedRequestBody.toString("utf-8"),  // Pass original request body for context
        );

        if (!securityResponseResult.allowed) {
          log.info(`[PROXY] Response blocked by security: ${securityResponseResult.blockReason}`);
          const blockedResponse = generateSecurityBlockedResponse(
            securityResponseResult.blockReason || "Security policy violation",
            provider,
          );
          sendJson(res, 200, blockedResponse);
          return;
        }

        // Apply masked content if security filter modified the response
        if (securityResponseResult.modifiedContent) {
          finalResponseBody = Buffer.from(securityResponseResult.modifiedContent, "utf-8");
          responseHeaders["content-length"] = String(finalResponseBody.length);
          log.debug(`[PROXY] Response content masked by security filter`);
        }
      }

      res.writeHead(providerResponse.status, responseHeaders);
      res.end(finalResponseBody);

      // Use eventId from request scope for correlation with security_events
      try {
        // Use effective provider for parsing, original provider for event recording
        // When using Codex API via regular OpenAI, parse as openai-oauth (Codex format)
        const parsingProvider = useCodexApi ? "openai-oauth" as ProviderName : effectiveProvider;
        extractAndQueueMetrics(parsingProvider, providerResponse.status, responseBodyBuffer, latencyMs, effectiveAgentId, requestedModel, actualModel, provider, eventId);
      } catch (error) {
        log.error("Metric extraction error", { err: error instanceof Error ? error.message : String(error) });
      }

      // Push to payload buffer for kill switch evidence (non-streaming)
      if (providerResponse.status >= 200 && providerResponse.status < 400) {
        try {
          const reqBody = modifiedRequestBody.toString("utf-8");
          const resBody = responseBodyBuffer.toString("utf-8");
          const payload: BufferedPayload = {
            eventId,
            agentId: effectiveAgentId,
            requestBody: reqBody,
            responseBody: resBody,
            timestamp: Date.now(),
          };
          pushPayload(effectiveAgentId, payload);

          // Archive to server if enabled
          if (payloadArchive?.enabled) {
            archivePayload(payloadArchive, eventId, effectiveAgentId, reqBody, resBody);
          }
        } catch {
          // Ignore payload buffer errors
        }
      }
    }
  }

  server.listen(port);

  // Start loop detector cleanup timer (cleans inactive agents every hour)
  loopDetector.startCleanup();

  async function shutdown(): Promise<void> {
    if (rateLimitRefreshTimer) {
      clearInterval(rateLimitRefreshTimer);
    }
    if (providerKeysRefreshTimer) {
      clearInterval(providerKeysRefreshTimer);
    }
    loopDetector.stopCleanup();
    await eventBuffer.shutdown();
    return new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  return { server, shutdown };
}
