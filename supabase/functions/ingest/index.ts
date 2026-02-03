import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ---------------------------------------------------------------------------
// Constants / Validation helpers
// ---------------------------------------------------------------------------
const VALID_EVENT_TYPES = ["llm_call", "completion", "heartbeat", "error", "custom"] as const;
const VALID_SOURCES = ["sdk", "proxy"] as const;
const MAX_BATCH_SIZE = 500;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 1000;

type EventType = (typeof VALID_EVENT_TYPES)[number];
type Source = (typeof VALID_SOURCES)[number];

interface IncomingEvent {
  agent_id: string;
  event_type: EventType;
  timestamp: string;
  source: Source;
  provider?: string | null;
  model?: string | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  tokens_total?: number | null;
  cost_usd?: number | null;
  latency_ms?: number | null;
  status_code?: number | null;
  error_message?: string | null;
  tags?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// SHA-256 hashing via Web Crypto API
// ---------------------------------------------------------------------------
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// In-memory rate limiter (per edge function instance)
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(apiKeyHash: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(apiKeyHash);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(apiKeyHash, { count: 1, windowStart: now });
    return { allowed: true };
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function validateEvent(
  evt: unknown,
  index: number,
): { valid: true; event: IncomingEvent } | { valid: false; error: string } {
  if (typeof evt !== "object" || evt === null) {
    return { valid: false, error: `Event at index ${index} is not an object.` };
  }

  const e = evt as Record<string, unknown>;

  // agent_id - required non-empty string
  if (typeof e.agent_id !== "string" || e.agent_id.length === 0) {
    return {
      valid: false,
      error: `Event at index ${index}: agent_id is required and must be a non-empty string.`,
    };
  }

  // event_type - required enum
  if (
    typeof e.event_type !== "string" ||
    !(VALID_EVENT_TYPES as readonly string[]).includes(e.event_type)
  ) {
    return {
      valid: false,
      error: `Event at index ${index}: event_type must be one of ${VALID_EVENT_TYPES.join(", ")}.`,
    };
  }

  // timestamp - required ISO-8601 datetime string
  if (typeof e.timestamp !== "string" || isNaN(Date.parse(e.timestamp))) {
    return {
      valid: false,
      error: `Event at index ${index}: timestamp is required and must be a valid ISO-8601 datetime string.`,
    };
  }

  // source - required enum
  if (
    typeof e.source !== "string" ||
    !(VALID_SOURCES as readonly string[]).includes(e.source)
  ) {
    return {
      valid: false,
      error: `Event at index ${index}: source must be one of ${VALID_SOURCES.join(", ")}.`,
    };
  }

  // Optional numeric fields — if present, must be a number
  for (const field of [
    "tokens_in",
    "tokens_out",
    "tokens_total",
    "latency_ms",
    "status_code",
  ]) {
    if (e[field] !== undefined && e[field] !== null && typeof e[field] !== "number") {
      return {
        valid: false,
        error: `Event at index ${index}: ${field} must be a number if provided.`,
      };
    }
  }

  if (
    e.cost_usd !== undefined &&
    e.cost_usd !== null &&
    typeof e.cost_usd !== "number"
  ) {
    return {
      valid: false,
      error: `Event at index ${index}: cost_usd must be a number if provided.`,
    };
  }

  // Optional string fields
  for (const field of ["provider", "model", "error_message"]) {
    if (
      e[field] !== undefined &&
      e[field] !== null &&
      typeof e[field] !== "string"
    ) {
      return {
        valid: false,
        error: `Event at index ${index}: ${field} must be a string if provided.`,
      };
    }
  }

  // tags — if present, must be an object
  if (
    e.tags !== undefined &&
    e.tags !== null &&
    (typeof e.tags !== "object" || Array.isArray(e.tags))
  ) {
    return {
      valid: false,
      error: `Event at index ${index}: tags must be a JSON object if provided.`,
    };
  }

  return {
    valid: true,
    event: {
      agent_id: e.agent_id as string,
      event_type: e.event_type as EventType,
      timestamp: e.timestamp as string,
      source: e.source as Source,
      provider: (e.provider as string | null) ?? null,
      model: (e.model as string | null) ?? null,
      tokens_in: (e.tokens_in as number | null) ?? null,
      tokens_out: (e.tokens_out as number | null) ?? null,
      tokens_total: (e.tokens_total as number | null) ?? null,
      cost_usd: (e.cost_usd as number | null) ?? null,
      latency_ms: (e.latency_ms as number | null) ?? null,
      status_code: (e.status_code as number | null) ?? null,
      error_message: (e.error_message as string | null) ?? null,
      tags: (e.tags as Record<string, unknown>) ?? {},
    },
  };
}

// ---------------------------------------------------------------------------
// CORS headers helper
// ---------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only POST allowed
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  // -----------------------------------------------------------------------
  // 1. Authenticate via x-api-key or Authorization: Bearer header
  // -----------------------------------------------------------------------
  let apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      apiKey = authHeader.slice(7);
    }
  }
  if (!apiKey) {
    return jsonResponse(
      { error: "Missing API key. Provide x-api-key header or Authorization: Bearer <key>." },
      401,
    );
  }

  const keyHash = await hashApiKey(apiKey);

  const { data: apiKeyRecord, error: keyError } = await supabase
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", keyHash)
    .single();

  if (keyError || !apiKeyRecord) {
    return jsonResponse({ error: "Invalid API key." }, 401);
  }

  if (apiKeyRecord.revoked_at !== null) {
    return jsonResponse({ error: "API key has been revoked." }, 401);
  }

  const userId: string = apiKeyRecord.user_id;

  // -----------------------------------------------------------------------
  // 2. Rate limiting
  // -----------------------------------------------------------------------
  const rateLimitResult = checkRateLimit(keyHash);
  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Maximum 1000 events per minute." }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(rateLimitResult.retryAfterSeconds),
        },
      },
    );
  }

  // -----------------------------------------------------------------------
  // 3. Parse body — accept single event or { events: [...] }
  // -----------------------------------------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  let rawEvents: unknown[];

  if (Array.isArray((body as Record<string, unknown>)?.events)) {
    rawEvents = (body as Record<string, unknown>).events as unknown[];
  } else if (typeof body === "object" && body !== null && "agent_id" in body) {
    // Single event object
    rawEvents = [body];
  } else {
    return jsonResponse(
      {
        error:
          "Body must be a single event object or { events: [...] }.",
      },
      400,
    );
  }

  if (rawEvents.length === 0) {
    return jsonResponse({ error: "At least one event is required." }, 400);
  }

  if (rawEvents.length > MAX_BATCH_SIZE) {
    return jsonResponse(
      { error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}.` },
      400,
    );
  }

  // -----------------------------------------------------------------------
  // 4. Validate each event — collect valid and invalid separately
  // -----------------------------------------------------------------------
  const validatedEvents: IncomingEvent[] = [];
  const results: Array<{ index: number; status: "ok"; event_id?: string } | { index: number; status: "error"; error: string }> = [];
  const validIndices: number[] = [];

  for (let i = 0; i < rawEvents.length; i++) {
    const result = validateEvent(rawEvents[i], i);
    if (!result.valid) {
      results.push({ index: i, status: "error", error: result.error });
    } else {
      validatedEvents.push(result.event);
      validIndices.push(i);
      results.push({ index: i, status: "ok" }); // event_id filled after insert
    }
  }

  // If ALL events are invalid, return 400
  if (validatedEvents.length === 0) {
    return jsonResponse({ error: "All events failed validation.", results }, 400);
  }

  // -----------------------------------------------------------------------
  // 5. Upsert agents to ensure they exist; handle heartbeats
  // -----------------------------------------------------------------------
  const uniqueAgentIds = [...new Set(validatedEvents.map((e) => e.agent_id))];
  const heartbeatAgentIds = [
    ...new Set(
      validatedEvents
        .filter((e) => e.event_type === "heartbeat")
        .map((e) => e.agent_id),
    ),
  ];

  // Upsert all referenced agents (create if not exists)
  for (const agentId of uniqueAgentIds) {
    const isHeartbeat = heartbeatAgentIds.includes(agentId);

    const upsertData: Record<string, unknown> = {
      user_id: userId,
      agent_id: agentId,
      updated_at: new Date().toISOString(),
    };

    if (isHeartbeat) {
      upsertData.last_heartbeat_at = new Date().toISOString();
      upsertData.status = "healthy";
    }

    const { error: upsertError } = await supabase
      .from("agents")
      .upsert(upsertData, {
        onConflict: "user_id,agent_id",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("Agent upsert error:", upsertError);
      return jsonResponse(
        { error: "Failed to upsert agent record." },
        500,
      );
    }
  }

  // -----------------------------------------------------------------------
  // 6. Bulk insert valid events into agent_events
  // -----------------------------------------------------------------------
  const rows = validatedEvents.map((e) => ({
    user_id: userId,
    agent_id: e.agent_id,
    event_type: e.event_type,
    provider: e.provider,
    model: e.model,
    tokens_in: e.tokens_in,
    tokens_out: e.tokens_out,
    tokens_total: e.tokens_total,
    cost_usd: e.cost_usd,
    latency_ms: e.latency_ms,
    status_code: e.status_code,
    error_message: e.error_message,
    tags: e.tags ?? {},
    source: e.source,
    timestamp: e.timestamp,
  }));

  const { data: insertedRows, error: insertError } = await supabase
    .from("agent_events")
    .insert(rows)
    .select("id");

  if (insertError) {
    console.error("Insert error:", insertError);
    return jsonResponse({ error: "Failed to insert events." }, 500);
  }

  const eventIds = (insertedRows ?? []).map(
    (row: { id: string }) => row.id,
  );

  // Back-fill event_ids into the results array for valid events
  let insertIdx = 0;
  for (const vi of validIndices) {
    const r = results[vi];
    if (r.status === "ok") {
      (r as { index: number; status: "ok"; event_id?: string }).event_id =
        eventIds[insertIdx++];
    }
  }

  const hasErrors = results.some((r) => r.status === "error");

  // -----------------------------------------------------------------------
  // 7. Return results — 200 if all valid, 207 (Multi-Status) if partial
  // -----------------------------------------------------------------------
  return jsonResponse(
    { status: "ok", results, event_ids: eventIds },
    hasErrors ? 207 : 200,
  );
});
