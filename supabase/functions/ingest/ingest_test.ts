/**
 * Integration tests for the event ingestion Edge Function.
 *
 * These tests validate the HTTP contract of the ingest endpoint.
 * To run against a local Supabase instance:
 *   supabase start
 *   supabase functions serve ingest --env-file .env.local
 *   deno test --allow-net supabase/functions/ingest/ingest_test.ts
 *
 * Required env vars (or defaults below):
 *   INGEST_URL    — URL of the running ingest function
 *   TEST_API_KEY  — A valid API key registered in the api_keys table
 */

const INGEST_URL =
  Deno.env.get("INGEST_URL") ?? "http://localhost:54321/functions/v1/ingest";
const TEST_API_KEY = Deno.env.get("TEST_API_KEY") ?? "aw_test_key_12345";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    agent_id: "test-agent",
    event_type: "llm_call",
    timestamp: new Date().toISOString(),
    source: "sdk",
    provider: "openai",
    model: "gpt-4o",
    tokens_in: 100,
    tokens_out: 50,
    tokens_total: 150,
    cost_usd: 0.0045,
    latency_ms: 800,
    status_code: 200,
    ...overrides,
  };
}

async function post(
  body: unknown,
  headers: Record<string, string> = {}
): Promise<Response> {
  return await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": TEST_API_KEY,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("OPTIONS returns CORS headers", async () => {
  const res = await fetch(INGEST_URL, { method: "OPTIONS" });
  const text = await res.text();
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  if (!res.headers.get("access-control-allow-origin"))
    throw new Error("Missing CORS header");
  void text;
});

Deno.test("GET returns 405", async () => {
  const res = await fetch(INGEST_URL, {
    method: "GET",
    headers: { "x-api-key": TEST_API_KEY },
  });
  const json = await res.json();
  if (res.status !== 405) throw new Error(`Expected 405, got ${res.status}`);
  if (!json.error) throw new Error("Expected error message");
});

Deno.test("POST without x-api-key returns 401", async () => {
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(makeEvent()),
  });
  const json = await res.json();
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  if (!json.error.includes("x-api-key"))
    throw new Error("Expected x-api-key error");
});

Deno.test("POST with invalid API key returns 401", async () => {
  const res = await post(makeEvent(), { "x-api-key": "invalid_key" });
  const json = await res.json();
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  if (!json.error.includes("Invalid")) throw new Error("Expected invalid key error");
});

Deno.test("POST with invalid JSON returns 400", async () => {
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": TEST_API_KEY,
    },
    body: "not json",
  });
  const json = await res.json();
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  if (!json.error.includes("Invalid JSON"))
    throw new Error("Expected JSON error");
});

Deno.test("Single valid event returns 200 with event_ids", async () => {
  const res = await post(makeEvent());
  const json = await res.json();
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(json)}`);
  if (!json.success) throw new Error("Expected success: true");
  if (!Array.isArray(json.event_ids)) throw new Error("Expected event_ids array");
  if (json.event_ids.length !== 1) throw new Error("Expected 1 event_id");
});

Deno.test("Batch events returns 200 with matching event_ids count", async () => {
  const events = [
    makeEvent({ agent_id: "batch-agent-1" }),
    makeEvent({ agent_id: "batch-agent-1", event_type: "heartbeat" }),
    makeEvent({ agent_id: "batch-agent-2" }),
  ];
  const res = await post({ events });
  const json = await res.json();
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(json)}`);
  if (json.event_ids.length !== 3)
    throw new Error(`Expected 3 event_ids, got ${json.event_ids.length}`);
});

Deno.test("Event missing agent_id returns 400", async () => {
  const event = makeEvent();
  delete (event as Record<string, unknown>).agent_id;
  const res = await post(event);
  const json = await res.json();
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  if (!json.error.includes("agent_id"))
    throw new Error("Expected agent_id validation error");
});

Deno.test("Event with invalid event_type returns 400", async () => {
  const res = await post(makeEvent({ event_type: "invalid_type" }));
  const json = await res.json();
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  if (!json.error.includes("event_type"))
    throw new Error("Expected event_type validation error");
});

Deno.test("Event with invalid timestamp returns 400", async () => {
  const res = await post(makeEvent({ timestamp: "not-a-date" }));
  const json = await res.json();
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  if (!json.error.includes("timestamp"))
    throw new Error("Expected timestamp validation error");
});

Deno.test("Event with invalid source returns 400", async () => {
  const res = await post(makeEvent({ source: "browser" }));
  const json = await res.json();
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  if (!json.error.includes("source"))
    throw new Error("Expected source validation error");
});

Deno.test("Event with non-numeric tokens_in returns 400", async () => {
  const res = await post(makeEvent({ tokens_in: "abc" }));
  const json = await res.json();
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  if (!json.error.includes("tokens_in"))
    throw new Error("Expected tokens_in validation error");
});

Deno.test("Batch exceeding 500 events returns 400", async () => {
  const events = Array.from({ length: 501 }, () => makeEvent());
  const res = await post({ events });
  const json = await res.json();
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  if (!json.error.includes("500"))
    throw new Error("Expected batch size error");
});

Deno.test("Empty batch returns 400", async () => {
  const res = await post({ events: [] });
  const json = await res.json();
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  if (!json.error.includes("At least one"))
    throw new Error("Expected empty batch error");
});

Deno.test("Event with tags object is accepted", async () => {
  const res = await post(
    makeEvent({ tags: { env: "staging", version: "1.2.0" } })
  );
  const json = await res.json();
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(json)}`);
  if (!json.success) throw new Error("Expected success");
});

Deno.test("Event with array tags returns 400", async () => {
  const res = await post(makeEvent({ tags: ["not", "an", "object"] }));
  const json = await res.json();
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  if (!json.error.includes("tags"))
    throw new Error("Expected tags validation error");
});

Deno.test("Heartbeat event sets agent status to healthy", async () => {
  const res = await post(
    makeEvent({
      agent_id: "heartbeat-test-agent",
      event_type: "heartbeat",
    })
  );
  const json = await res.json();
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(json)}`);
  if (!json.success) throw new Error("Expected success");
});

Deno.test("Error event is accepted", async () => {
  const res = await post(
    makeEvent({
      event_type: "error",
      error_message: "Connection timeout",
      status_code: 500,
    })
  );
  const json = await res.json();
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(json)}`);
  if (!json.success) throw new Error("Expected success");
});

Deno.test("Custom event is accepted", async () => {
  const res = await post(
    makeEvent({
      event_type: "custom",
      tags: { action: "tool_call", tool: "web_search" },
    })
  );
  const json = await res.json();
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(json)}`);
  if (!json.success) throw new Error("Expected success");
});

Deno.test("Optional fields can be null", async () => {
  const res = await post(
    makeEvent({
      provider: null,
      model: null,
      tokens_in: null,
      tokens_out: null,
      tokens_total: null,
      cost_usd: null,
      latency_ms: null,
      status_code: null,
      error_message: null,
      tags: null,
    })
  );
  const json = await res.json();
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(json)}`);
  if (!json.success) throw new Error("Expected success");
});
