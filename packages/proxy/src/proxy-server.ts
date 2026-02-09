import * as http from "node:http";
import {
  getProviderChatEndpoint,
  getProviderRootUrl,
  getProviderAuthHeader,
  providerUsesPathRouting,
  parseProviderResponse,
  calculateCost,
  createLogger,
  KNOWN_PROVIDER_NAMES,
  type AgentEvent,
  type ParsedResponse,
  type ProviderName,
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
  type AgentPolicy,
  type InsertEventRow,
  type ProviderSettingsRow,
  type KillSwitchEventData,
} from "@agentgazer/server";
import type Database from "better-sqlite3";

// ---------------------------------------------------------------------------
// Model Override Cache
// ---------------------------------------------------------------------------

interface ModelOverrideCache {
  [key: string]: {
    model_override: string | null;
    expiresAt: number;
  };
}

const modelOverrideCache: ModelOverrideCache = {};
const MODEL_OVERRIDE_CACHE_TTL_MS = 30_000; // 30 seconds

function getModelOverride(
  db: Database.Database | undefined,
  agentId: string,
  provider: string,
): string | null {
  if (!db) return null;

  const cacheKey = `${agentId}:${provider}`;
  const cached = modelOverrideCache[cacheKey];

  if (cached && cached.expiresAt > Date.now()) {
    return cached.model_override;
  }

  // Fetch from DB
  const rule = getModelRule(db, agentId, provider);
  const modelOverride = rule?.model_override ?? null;

  // Cache the result
  modelOverrideCache[cacheKey] = {
    model_override: modelOverride,
    expiresAt: Date.now() + MODEL_OVERRIDE_CACHE_TTL_MS,
  };

  return modelOverride;
}

const log = createLogger("proxy");
import { EventBuffer } from "./event-buffer.js";
import { RateLimiter, type RateLimitConfig } from "./rate-limiter.js";
import { loopDetector, type KillSwitchConfig } from "./loop-detector.js";

/** SecretStore interface for loading provider API keys */
export interface SecretStore {
  get(service: string, account: string): Promise<string | null>;
  list(service: string): Promise<string[]>;
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
}

export interface ProxyServer {
  server: http.Server;
  shutdown: () => Promise<void>;
}

const DEFAULT_PORT = 4000;
const DEFAULT_ENDPOINT = "https://ingest.agentgazer.com/v1/events";
const DEFAULT_FLUSH_INTERVAL = 5000;
const DEFAULT_MAX_BUFFER_SIZE = 50;
const MAX_REQUEST_BODY_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_SSE_BUFFER_SIZE = 50 * 1024 * 1024; // 50 MB
const UPSTREAM_TIMEOUT_MS = 120_000; // 2 minutes
const RATE_LIMIT_REFRESH_INTERVAL_MS = 30_000; // 30 seconds
const PROVIDER_KEYS_REFRESH_INTERVAL_MS = 10_000; // 10 seconds
const PROVIDER_SERVICE = "com.agentgazer.provider";

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
  const openaiOnlyFields = ["store", "metadata", "parallel_tool_calls", "stream_options"];

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
  if (provider !== "openai") {
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
    case "cohere":
      // Cohere uses different field names and doesn't support some OpenAI fields
      // See: https://docs.cohere.com/reference/chat
      const cohereUnsupported = ["top_logprobs", "n", "user", "stream_options"];
      for (const field of cohereUnsupported) {
        if (field in result) {
          delete result[field];
          changes.push(`-${field}`);
          modified = true;
        }
      }
      // top_p → p for Cohere
      if ("top_p" in result && !("p" in result)) {
        result.p = result.top_p;
        delete result.top_p;
        changes.push("top_p→p");
        modified = true;
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

  for (const line of dataLines) {
    try {
      const data = JSON.parse(line);
      if (data.type === "message_start" && data.message) {
        model = data.message.model ?? null;
        tokensIn = data.message.usage?.input_tokens ?? null;
      }
      if (data.type === "message_delta" && data.usage) {
        tokensOut = data.usage.output_tokens ?? null;
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

function parseCohereSSE(
  dataLines: string[],
  statusCode: number
): ParsedResponse {
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;

  for (const line of dataLines) {
    try {
      const data = JSON.parse(line);
      if (data.meta?.billed_units) {
        tokensIn = data.meta.billed_units.input_tokens ?? null;
        tokensOut = data.meta.billed_units.output_tokens ?? null;
      }
      // Cohere v2 chat streaming uses response.meta at the end
      if (data.response?.meta?.billed_units) {
        tokensIn = data.response.meta.billed_units.input_tokens ?? null;
        tokensOut = data.response.meta.billed_units.output_tokens ?? null;
      }
    } catch {
      continue;
    }
  }

  const tokensTotal =
    tokensIn != null && tokensOut != null ? tokensIn + tokensOut : null;

  return {
    model: null,
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
    case "anthropic":
      return parseAnthropicSSE(dataLines, statusCode);
    case "google":
      return parseGoogleSSE(dataLines, statusCode);
    case "cohere":
      return parseCohereSSE(dataLines, statusCode);
    default:
      return null;
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
const PROVIDER_POLICY_CACHE_TTL_MS = 5_000; // 5 seconds (shorter for faster policy updates)

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

export function startProxy(options: ProxyOptions): ProxyServer {
  const port = options.port ?? DEFAULT_PORT;
  const agentId = options.agentId;
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const flushInterval = options.flushInterval ?? DEFAULT_FLUSH_INTERVAL;
  const maxBufferSize = options.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;
  let providerKeys = options.providerKeys ?? {};
  const db = options.db;
  const secretStore = options.secretStore;

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

  const startTime = Date.now();

  const eventBuffer = new EventBuffer({
    apiKey: options.apiKey,
    endpoint,
    flushInterval,
    maxBufferSize,
  });
  eventBuffer.start();

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
      if (providerUsesPathRouting(routeProvider) && trailingPath) {
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
    provider: ProviderName,
    statusCode: number,
    sseBody: Buffer,
    latencyMs: number,
    effectiveAgentId: string,
    requestedModel: string | null,
  ): void {
    if (provider === "unknown") {
      log.warn("Unrecognized provider - skipping streaming metric extraction");
      return;
    }

    const sseText = sseBody.toString("utf-8");
    const parsed = parseSSEResponse(provider, sseText, statusCode);

    if (!parsed) {
      log.warn(`No parseable SSE data for provider: ${provider} — skipping event`);
      return;
    }

    let costUsd: number | null = null;
    if (parsed.model && parsed.tokensIn != null && parsed.tokensOut != null) {
      costUsd = calculateCost(parsed.model, parsed.tokensIn, parsed.tokensOut);
    }

    // Record response for loop detection
    loopDetector.recordResponse(effectiveAgentId, sseText);

    const event: AgentEvent = {
      agent_id: effectiveAgentId,
      event_type: "llm_call",
      provider,
      model: parsed.model,
      requested_model: requestedModel,
      tokens_in: parsed.tokensIn,
      tokens_out: parsed.tokensOut,
      tokens_total: parsed.tokensTotal,
      cost_usd: costUsd,
      latency_ms: latencyMs,
      status_code: statusCode,
      source: "proxy",
      timestamp: new Date().toISOString(),
      tags: { streaming: "true" },
    };

    eventBuffer.add(event);
  }

  function extractAndQueueMetrics(
    provider: ProviderName,
    statusCode: number,
    responseBody: Buffer,
    latencyMs: number,
    effectiveAgentId: string,
    requestedModel: string | null,
  ): void {
    if (provider === "unknown") {
      log.warn("Unrecognized provider - skipping metric extraction");
      return;
    }

    // Parse the response body as JSON
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(responseBody.toString("utf-8"));
    } catch {
      log.warn(`Could not parse response body as JSON for ${provider} - skipping metric extraction`);
      return;
    }

    const parsed = parseProviderResponse(provider, parsedBody, statusCode);
    if (!parsed) {
      log.warn(`No parser result for provider: ${provider}`);
      return;
    }

    // Calculate cost if we have the necessary token data
    let costUsd: number | null = null;
    if (parsed.model && parsed.tokensIn != null && parsed.tokensOut != null) {
      costUsd = calculateCost(parsed.model, parsed.tokensIn, parsed.tokensOut);
    }

    // Record response for loop detection
    loopDetector.recordResponse(effectiveAgentId, responseBody.toString("utf-8"));

    const event: AgentEvent = {
      agent_id: effectiveAgentId,
      event_type: "llm_call",
      provider,
      model: parsed.model,
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
        const { promptHash, toolCalls } = loopDetector.recordRequest(effectiveAgentId, bodyJson);
        const loopCheck = loopDetector.checkLoop(effectiveAgentId, promptHash, toolCalls);

        if (loopCheck.isLoop) {
          log.warn(`[PROXY] Kill Switch triggered for agent "${effectiveAgentId}": score=${loopCheck.score.toFixed(2)}`);
          const message = `Agent loop detected (score: ${loopCheck.score.toFixed(1)}). Agent deactivated to prevent runaway costs.`;

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
                  similar_prompts: loopCheck.details.similarPrompts,
                  similar_responses: loopCheck.details.similarResponses,
                  repeated_tool_calls: loopCheck.details.repeatedToolCalls,
                  action: "deactivated",
                },
              };
              insertEvents(db, [killSwitchEvent]);

              // Fire kill_switch alert for Telegram/webhook/email notifications
              const killSwitchData: KillSwitchEventData = {
                agent_id: effectiveAgentId,
                score: loopCheck.score,
                window_size: killSwitchConfig.windowSize,
                threshold: killSwitchConfig.threshold,
                details: loopCheck.details,
              };
              void fireKillSwitchAlert(db, killSwitchData);
            } catch (err) {
              log.error("Failed to record kill_switch event", { err: String(err) });
            }
          }

          const blockedResponse = generateBlockedResponse(provider, "inactive", message);
          sendJson(res, 200, blockedResponse);
          return;
        }
      } catch {
        // Not JSON body - skip loop detection
      }
    }

    // Model override and request normalization
    let requestedModel: string | null = null;
    let modifiedRequestBody = requestBody;
    try {
      let bodyJson = JSON.parse(requestBody.toString("utf-8"));
      let bodyModified = false;

      // Extract and optionally override model
      if (bodyJson.model) {
        requestedModel = bodyJson.model;
        const modelOverride = getModelOverride(db, effectiveAgentId, provider);
        if (modelOverride) {
          log.info(`[PROXY] Model override: ${requestedModel} → ${modelOverride}`);
          bodyJson.model = modelOverride;
          bodyModified = true;
        }
      }

      // Normalize request body for provider compatibility
      const normalized = normalizeRequestBody(provider, bodyJson, log);
      if (normalized.modified) {
        bodyJson = normalized.body;
        bodyModified = true;
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

    // Inject API key
    const providerKey = providerKeys[provider];
    if (providerKey) {
      const authHeader = getProviderAuthHeader(provider, providerKey, useNativeApi);
      if (authHeader) {
        const existingAuthKey = Object.keys(forwardHeaders).find(k => k.toLowerCase() === authHeader.name.toLowerCase());
        if (existingAuthKey) delete forwardHeaders[existingAuthKey];
        forwardHeaders[authHeader.name] = authHeader.value;
        log.info(`[PROXY] Injected ${authHeader.name} header for ${provider}${useNativeApi ? " (native API)" : ""}`);
      }
    } else {
      log.warn(`[PROXY] No API key configured for provider: ${provider}`);
    }

    // Add provider-specific required headers
    if (provider === "anthropic") {
      // Anthropic requires anthropic-version header
      if (!forwardHeaders["anthropic-version"]) {
        forwardHeaders["anthropic-version"] = "2023-06-01";
        log.info(`[PROXY] Added anthropic-version header`);
      }
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
    const isSSE = contentType.includes("text/event-stream");

    if (isSSE && providerResponse.body) {
      // Streaming response
      const responseHeaders: Record<string, string> = {};
      providerResponse.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      res.writeHead(providerResponse.status, responseHeaders);

      const chunks: Buffer[] = [];
      let accumulatedSize = 0;
      const reader = providerResponse.body.getReader();

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const buf = Buffer.from(value);
          res.write(buf);
          accumulatedSize += buf.length;
          if (accumulatedSize <= MAX_SSE_BUFFER_SIZE) {
            chunks.push(buf);
          }
        }
      } catch (error) {
        log.error("Stream read error", { err: error instanceof Error ? error.message : String(error) });
      } finally {
        res.end();
      }

      const latencyMs = Date.now() - requestStart;
      const fullBody = Buffer.concat(chunks);

      try {
        extractStreamingMetrics(provider, providerResponse.status, fullBody, latencyMs, effectiveAgentId, requestedModel);
      } catch (error) {
        log.error("Streaming metric extraction error", { err: error instanceof Error ? error.message : String(error) });
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

      const responseHeaders: Record<string, string> = {};
      providerResponse.headers.forEach((value, key) => {
        if (key.toLowerCase() === "transfer-encoding") return;
        responseHeaders[key] = value;
      });

      // Debug log error responses
      if (providerResponse.status >= 400) {
        try {
          const errorBody = responseBodyBuffer.toString("utf-8").slice(0, 2000);
          log.debug(`[PROXY] Error response body: ${errorBody}${responseBodyBuffer.length > 2000 ? "... (truncated)" : ""}`);
        } catch {
          log.debug(`[PROXY] Error response body: (binary, ${responseBodyBuffer.length} bytes)`);
        }
      }

      res.writeHead(providerResponse.status, responseHeaders);
      res.end(responseBodyBuffer);

      try {
        extractAndQueueMetrics(provider, providerResponse.status, responseBodyBuffer, latencyMs, effectiveAgentId, requestedModel);
      } catch (error) {
        log.error("Metric extraction error", { err: error instanceof Error ? error.message : String(error) });
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
