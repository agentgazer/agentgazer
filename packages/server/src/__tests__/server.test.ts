import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createServer } from "../server.js";

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const TEST_TOKEN = "test-token-123";
const tmpDbPath = path.join(os.tmpdir(), `agentgazer-test-${randomUUID()}.sqlite`);
const tmpConfigPath = path.join(os.tmpdir(), `agentgazer-test-config-${randomUUID()}.json`);

let server: http.Server;
let base: string;
let db: ReturnType<typeof createServer>["db"];

/** Helper: send JSON requests with auth header by default */
async function request(
  method: string,
  urlPath: string,
  options?: {
    body?: unknown;
    token?: string | null; // null = omit auth entirely
    headers?: Record<string, string>;
  },
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  const url = `${base}${urlPath}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers ?? {}),
  };

  // Default: include auth. null = omit, string = custom token.
  if (options?.token !== null) {
    const tok = options?.token ?? TEST_TOKEN;
    headers["Authorization"] = `Bearer ${tok}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let body: any;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  // Convert fetch Headers to a plain object to match the test interface
  const resHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    resHeaders[k] = v;
  });

  return { status: res.status, body, headers: resHeaders };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Create a test config file
  fs.writeFileSync(tmpConfigPath, JSON.stringify({ token: TEST_TOKEN }, null, 2));

  const result = createServer({ token: TEST_TOKEN, dbPath: tmpDbPath, configPath: tmpConfigPath });
  db = result.db;

  server = http.createServer(result.app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as { port: number };
  base = `http://localhost:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  db.close();

  // Clean up temp files
  try {
    fs.unlinkSync(tmpDbPath);
    fs.unlinkSync(tmpConfigPath);
  } catch {
    /* ignore */
  }
  try {
    fs.unlinkSync(tmpDbPath + "-wal");
  } catch {
    /* ignore */
  }
  try {
    fs.unlinkSync(tmpDbPath + "-shm");
  } catch {
    /* ignore */
  }
});

// ---------------------------------------------------------------------------
// Helpers: factory functions for building test payloads
// ---------------------------------------------------------------------------

function makeEvent(overrides?: Record<string, unknown>) {
  return {
    agent_id: `agent-${randomUUID()}`,
    event_type: "llm_call",
    source: "sdk",
    timestamp: new Date().toISOString(),
    provider: "openai",
    model: "gpt-4",
    tokens_in: 100,
    tokens_out: 200,
    tokens_total: 300,
    cost_usd: 0.005,
    latency_ms: 350,
    status_code: 200,
    ...overrides,
  };
}

function makeAlertRule(overrides?: Record<string, unknown>) {
  return {
    agent_id: `agent-${randomUUID()}`,
    rule_type: "error_rate",
    config: { window_minutes: 15, threshold: 10 },
    webhook_url: "https://hooks.example.com/test",
    ...overrides,
  };
}

// =========================================================================
// 1. Database initialization
// =========================================================================

describe("Database initialization", () => {
  it("first startup creates tables", () => {
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      )
      .all() as { name: string }[];

    const names = tables.map((t) => t.name).sort();
    expect(names).toEqual(
      ["agent_events", "agent_model_rules", "agent_rate_limits", "agents", "alert_history", "alert_rules", "provider_models", "provider_settings"].sort(),
    );
  });

  it("tables have correct structure", () => {
    // Verify agents columns
    const agentsCols = db.prepare("PRAGMA table_info(agents)").all() as {
      name: string;
    }[];
    const agentColNames = agentsCols.map((c) => c.name);
    expect(agentColNames).toContain("id");
    expect(agentColNames).toContain("agent_id");
    expect(agentColNames).toContain("name");
    expect(agentColNames).toContain("active");
    expect(agentColNames).toContain("created_at");
    expect(agentColNames).toContain("updated_at");

    // Verify agent_events columns
    const eventsCols = db
      .prepare("PRAGMA table_info(agent_events)")
      .all() as { name: string }[];
    const eventColNames = eventsCols.map((c) => c.name);
    expect(eventColNames).toContain("id");
    expect(eventColNames).toContain("agent_id");
    expect(eventColNames).toContain("event_type");
    expect(eventColNames).toContain("tokens_in");
    expect(eventColNames).toContain("tokens_out");
    expect(eventColNames).toContain("cost_usd");
    expect(eventColNames).toContain("latency_ms");
    expect(eventColNames).toContain("source");
    expect(eventColNames).toContain("timestamp");

    // Verify alert_rules columns
    const rulesCols = db
      .prepare("PRAGMA table_info(alert_rules)")
      .all() as { name: string }[];
    const ruleColNames = rulesCols.map((c) => c.name);
    expect(ruleColNames).toContain("id");
    expect(ruleColNames).toContain("agent_id");
    expect(ruleColNames).toContain("rule_type");
    expect(ruleColNames).toContain("config");
    expect(ruleColNames).toContain("enabled");
    expect(ruleColNames).toContain("webhook_url");
    expect(ruleColNames).toContain("email");

    // Verify alert_history columns
    const historyCols = db
      .prepare("PRAGMA table_info(alert_history)")
      .all() as { name: string }[];
    const historyColNames = historyCols.map((c) => c.name);
    expect(historyColNames).toContain("id");
    expect(historyColNames).toContain("alert_rule_id");
    expect(historyColNames).toContain("agent_id");
    expect(historyColNames).toContain("rule_type");
    expect(historyColNames).toContain("message");
    expect(historyColNames).toContain("delivered_via");
    expect(historyColNames).toContain("delivered_at");
  });
});

// =========================================================================
// 2. Auth middleware
// =========================================================================

describe("Auth middleware", () => {
  it("valid bearer token allows access (200)", async () => {
    const res = await request("GET", "/api/agents", { token: TEST_TOKEN });
    expect(res.status).toBe(200);
  });

  it("valid x-api-key header allows access (200)", async () => {
    const res = await request("GET", "/api/agents", {
      token: null,
      headers: { "x-api-key": TEST_TOKEN },
    });
    expect(res.status).toBe(200);
  });

  it("missing auth header returns 401", async () => {
    const res = await request("GET", "/api/agents", { token: null });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required");
  });

  it("invalid token returns 401", async () => {
    const res = await request("GET", "/api/agents", { token: "wrong-token" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid token");
  });

  it("health check is accessible without auth (200)", async () => {
    const res = await request("GET", "/api/health", { token: null });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime_ms).toBe("number");
  });
});

// =========================================================================
// 3. Auth verify endpoint
// =========================================================================

describe("Auth verify endpoint POST /api/auth/verify", () => {
  it("correct token returns { valid: true }", async () => {
    const res = await request("POST", "/api/auth/verify", {
      token: null, // auth/verify is a public path
      body: { token: TEST_TOKEN },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: true });
  });

  it("wrong token returns 401 { valid: false }", async () => {
    const res = await request("POST", "/api/auth/verify", {
      token: null,
      body: { token: "bad-token" },
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ valid: false });
  });
});

// =========================================================================
// 4. Event ingestion POST /api/events
// =========================================================================

describe("Event ingestion POST /api/events", () => {
  it("batch events returns 200 with event_ids", async () => {
    const agentId = `agent-batch-${randomUUID()}`;
    const events = [
      makeEvent({ agent_id: agentId }),
      makeEvent({ agent_id: agentId, event_type: "completion" }),
    ];

    const res = await request("POST", "/api/events", {
      body: { events },
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.event_ids).toHaveLength(2);
    expect(res.body.results).toHaveLength(2);
    res.body.results.forEach((r: any) => {
      expect(r.success).toBe(true);
      expect(typeof r.id).toBe("string");
    });
  });

  it("single event (non-array) returns 200", async () => {
    const event = makeEvent();

    const res = await request("POST", "/api/events", {
      body: event,
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.event_ids).toHaveLength(1);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].success).toBe(true);
  });

  it("partial failure (one valid, one invalid) returns 207", async () => {
    const goodEvent = makeEvent();
    const badEvent = { agent_id: "", event_type: "invalid_type", source: "sdk", timestamp: new Date().toISOString() };

    const res = await request("POST", "/api/events", {
      body: { events: [goodEvent, badEvent] },
    });

    expect(res.status).toBe(207);
    expect(res.body.status).toBe("ok");
    expect(res.body.event_ids).toHaveLength(1);
    expect(res.body.results).toHaveLength(2);

    // First event succeeded
    const sorted = [...res.body.results].sort((a: any, b: any) => a.index - b.index);
    expect(sorted[0].success).toBe(true);
    expect(typeof sorted[0].id).toBe("string");

    // Second event failed
    expect(sorted[1].success).toBe(false);
    expect(typeof sorted[1].error).toBe("string");
  });

  it("all invalid events returns 400", async () => {
    const badEvents = [
      { agent_id: "", event_type: "llm_call", source: "sdk", timestamp: new Date().toISOString() },
      { agent_id: "a", event_type: "not_valid", source: "sdk", timestamp: new Date().toISOString() },
    ];

    const res = await request("POST", "/api/events", {
      body: { events: badEvents },
    });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.event_ids).toHaveLength(0);
    expect(res.body.results.length).toBe(2);
    res.body.results.forEach((r: any) => {
      expect(r.success).toBe(false);
    });
  });

  it("heartbeat event updates agent updated_at", async () => {
    const agentId = `agent-heartbeat-${randomUUID()}`;

    // Send a heartbeat event
    const res = await request("POST", "/api/events", {
      body: {
        agent_id: agentId,
        event_type: "heartbeat",
        source: "sdk",
        timestamp: new Date().toISOString(),
      },
    });
    expect(res.status).toBe(200);

    // Verify agent was created with updated_at set
    const agentRes = await request("GET", `/api/agents/${agentId}`);
    expect(agentRes.status).toBe(200);
    expect(agentRes.body.agent_id).toBe(agentId);
    expect(agentRes.body.updated_at).toBeTruthy();
  });
});

// =========================================================================
// 5. Agent endpoints
// =========================================================================

describe("Agent endpoints", () => {
  it("GET /api/agents returns agents list", async () => {
    // Insert a known agent via an event
    const agentId = `agent-list-${randomUUID()}`;
    await request("POST", "/api/events", {
      body: makeEvent({ agent_id: agentId }),
    });

    const res = await request("GET", "/api/agents");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(res.body.agents.length).toBeGreaterThanOrEqual(1);

    // Our agent should be in the list
    const found = res.body.agents.find((a: any) => a.agent_id === agentId);
    expect(found).toBeTruthy();
    expect(found.agent_id).toBe(agentId);
  });

  it("GET /api/agents/:agentId returns specific agent", async () => {
    const agentId = `agent-specific-${randomUUID()}`;
    await request("POST", "/api/events", {
      body: makeEvent({ agent_id: agentId }),
    });

    const res = await request("GET", `/api/agents/${agentId}`);
    expect(res.status).toBe(200);
    expect(res.body.agent_id).toBe(agentId);
    expect(typeof res.body.id).toBe("string");
    expect(typeof res.body.created_at).toBe("string");
    expect(typeof res.body.updated_at).toBe("string");
  });

  it("GET /api/agents/:agentId with nonexistent agent returns 404", async () => {
    const res = await request("GET", "/api/agents/nonexistent-agent-xyz");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Agent not found");
  });
});

// =========================================================================
// 6. Event query GET /api/events
// =========================================================================

describe("Event query GET /api/events", () => {
  it("returns events filtered by agent_id", async () => {
    const agentId = `agent-query-${randomUUID()}`;

    // Insert a couple of events for this agent
    await request("POST", "/api/events", {
      body: {
        events: [
          makeEvent({ agent_id: agentId, model: "gpt-4" }),
          makeEvent({ agent_id: agentId, model: "gpt-3.5-turbo" }),
        ],
      },
    });

    // Also insert an event for a different agent to verify filtering
    await request("POST", "/api/events", {
      body: makeEvent({ agent_id: `other-agent-${randomUUID()}` }),
    });

    const res = await request("GET", `/api/events?agent_id=${agentId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.events).toHaveLength(2);

    // All returned events should belong to our agent
    for (const ev of res.body.events) {
      expect(ev.agent_id).toBe(agentId);
    }
  });

  it("returns events without agent_id filter (paginated)", async () => {
    const res = await request("GET", "/api/events");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("events");
    expect(res.body).toHaveProperty("total");
  });
});

// =========================================================================
// 7. Stats endpoint
// =========================================================================

describe("Stats endpoint GET /api/stats/:agentId", () => {
  it("returns aggregated stats for default 24h range", async () => {
    const agentId = `agent-stats-${randomUUID()}`;

    // Insert some mixed events
    await request("POST", "/api/events", {
      body: {
        events: [
          makeEvent({
            agent_id: agentId,
            event_type: "llm_call",
            tokens_in: 100,
            tokens_out: 200,
            tokens_total: 300,
            cost_usd: 0.01,
            latency_ms: 500,
          }),
          makeEvent({
            agent_id: agentId,
            event_type: "llm_call",
            tokens_in: 50,
            tokens_out: 100,
            tokens_total: 150,
            cost_usd: 0.005,
            latency_ms: 250,
          }),
          makeEvent({
            agent_id: agentId,
            event_type: "error",
            tokens_in: null,
            tokens_out: null,
            tokens_total: null,
            cost_usd: null,
            latency_ms: null,
          }),
        ],
      },
    });

    const res = await request("GET", `/api/stats/${agentId}`);
    expect(res.status).toBe(200);

    expect(res.body.total_requests).toBe(3);
    expect(res.body.total_errors).toBe(1);
    expect(res.body.error_rate).toBeCloseTo(1 / 3, 5);
    expect(res.body.total_cost).toBeCloseTo(0.015, 5);
    expect(res.body.total_tokens).toBe(450);
    expect(typeof res.body.p50_latency).toBe("number");
    expect(typeof res.body.p99_latency).toBe("number");
    expect(Array.isArray(res.body.cost_by_model)).toBe(true);
    expect(Array.isArray(res.body.token_series)).toBe(true);
  });

  it("returns stats with custom range", async () => {
    const agentId = `agent-stats-custom-${randomUUID()}`;
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

    // Insert event within the custom range
    await request("POST", "/api/events", {
      body: makeEvent({
        agent_id: agentId,
        timestamp: new Date(now.getTime() - 90 * 60 * 1000).toISOString(), // 90 min ago
        cost_usd: 0.02,
      }),
    });

    // Insert event outside the custom range (just now)
    await request("POST", "/api/events", {
      body: makeEvent({
        agent_id: agentId,
        timestamp: now.toISOString(),
        cost_usd: 0.10,
      }),
    });

    const from = twoHoursAgo.toISOString();
    const to = oneHourAgo.toISOString();
    const res = await request(
      "GET",
      `/api/stats/${agentId}?range=custom&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
    expect(res.status).toBe(200);

    // Only the event within the custom range should be counted
    expect(res.body.total_requests).toBe(1);
    expect(res.body.total_cost).toBeCloseTo(0.02, 5);
  });
});

// =========================================================================
// 8. Alert CRUD
// =========================================================================

describe("Alert CRUD /api/alerts", () => {
  it("POST creates an alert rule and returns 201", async () => {
    const payload = makeAlertRule();

    const res = await request("POST", "/api/alerts", { body: payload });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.agent_id).toBe(payload.agent_id);
    expect(res.body.rule_type).toBe(payload.rule_type);
    expect(res.body.config).toEqual(payload.config);
    expect(res.body.enabled).toBe(true);
    expect(res.body.webhook_url).toBe(payload.webhook_url);
  });

  it("GET lists alert rules", async () => {
    // Create two distinct rules
    const rule1 = makeAlertRule({ rule_type: "budget", config: { threshold: 50 } });
    const rule2 = makeAlertRule({ rule_type: "agent_down", config: { duration_minutes: 5 } });

    const r1 = await request("POST", "/api/alerts", { body: rule1 });
    const r2 = await request("POST", "/api/alerts", { body: rule2 });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);

    const res = await request("GET", "/api/alerts");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.alerts)).toBe(true);
    expect(res.body.alerts.length).toBeGreaterThanOrEqual(2);

    // Both rules should appear in the list
    const ids = res.body.alerts.map((a: any) => a.id);
    expect(ids).toContain(r1.body.id);
    expect(ids).toContain(r2.body.id);
  });

  it("PATCH toggle enables/disables a rule", async () => {
    // Create a rule (enabled by default)
    const createRes = await request("POST", "/api/alerts", {
      body: makeAlertRule(),
    });
    expect(createRes.status).toBe(201);
    const ruleId = createRes.body.id;
    expect(createRes.body.enabled).toBe(true);

    // Disable it
    const disableRes = await request("PATCH", `/api/alerts/${ruleId}/toggle`, {
      body: { enabled: false },
    });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.enabled).toBe(false);

    // Re-enable it
    const enableRes = await request("PATCH", `/api/alerts/${ruleId}/toggle`, {
      body: { enabled: true },
    });
    expect(enableRes.status).toBe(200);
    expect(enableRes.body.enabled).toBe(true);
  });

  it("PUT updates an alert rule", async () => {
    // Create
    const createRes = await request("POST", "/api/alerts", {
      body: makeAlertRule({ rule_type: "error_rate", config: { window_minutes: 15, threshold: 10 } }),
    });
    expect(createRes.status).toBe(201);
    const ruleId = createRes.body.id;

    // Update the config and webhook
    const updateRes = await request("PUT", `/api/alerts/${ruleId}`, {
      body: {
        config: { window_minutes: 30, threshold: 25 },
        webhook_url: "https://hooks.example.com/updated",
      },
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.config).toEqual({ window_minutes: 30, threshold: 25 });
    expect(updateRes.body.webhook_url).toBe("https://hooks.example.com/updated");
    // agent_id and rule_type should remain unchanged
    expect(updateRes.body.agent_id).toBe(createRes.body.agent_id);
    expect(updateRes.body.rule_type).toBe("error_rate");
  });

  it("DELETE removes a rule and returns 204", async () => {
    // Create
    const createRes = await request("POST", "/api/alerts", {
      body: makeAlertRule(),
    });
    expect(createRes.status).toBe(201);
    const ruleId = createRes.body.id;

    // Delete
    const deleteRes = await request("DELETE", `/api/alerts/${ruleId}`);
    expect(deleteRes.status).toBe(204);

    // Verify it is gone: attempt to update should 404
    const updateRes = await request("PUT", `/api/alerts/${ruleId}`, {
      body: { config: { threshold: 999 } },
    });
    expect(updateRes.status).toBe(404);
  });
});

// =========================================================================
// 9. Alert history
// =========================================================================

describe("Alert history GET /api/alert-history", () => {
  it("returns alert history array", async () => {
    // Create a rule so we can insert a history record manually via DB
    const createRes = await request("POST", "/api/alerts", {
      body: makeAlertRule(),
    });
    expect(createRes.status).toBe(201);
    const ruleId = createRes.body.id;
    const agentId = createRes.body.agent_id;

    // Insert a history record directly into the database
    db.prepare(
      `INSERT INTO alert_history (alert_rule_id, agent_id, rule_type, message, delivered_via)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(ruleId, agentId, "error_rate", "Test alert fired", "webhook");

    const res = await request("GET", "/api/alert-history");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.history)).toBe(true);
    expect(res.body.history.length).toBeGreaterThanOrEqual(1);

    // Find our record
    const found = res.body.history.find(
      (h: any) => h.alert_rule_id === ruleId && h.message === "Test alert fired",
    );
    expect(found).toBeTruthy();
    expect(found.agent_id).toBe(agentId);
    expect(found.rule_type).toBe("error_rate");
    expect(found.delivered_via).toBe("webhook");
    expect(typeof found.delivered_at).toBe("string");
  });
});

// =========================================================================
// 10. Model override rules
// =========================================================================

describe("Model override rules API", () => {
  it("GET /api/agents/:agentId/model-rules returns empty array for new agent", async () => {
    const agentId = `agent-model-${randomUUID()}`;
    // Create agent first
    await request("POST", "/api/events", {
      body: makeEvent({ agent_id: agentId, provider: "openai" }),
    });

    const res = await request("GET", `/api/agents/${agentId}/model-rules`);
    expect(res.status).toBe(200);
    expect(res.body.rules).toEqual([]);
  });

  it("PUT /api/agents/:agentId/model-rules/:provider creates override rule", async () => {
    const agentId = `agent-model-${randomUUID()}`;
    await request("POST", "/api/events", {
      body: makeEvent({ agent_id: agentId, provider: "openai" }),
    });

    const res = await request("PUT", `/api/agents/${agentId}/model-rules/openai`, {
      body: { model_override: "gpt-4o-mini" },
    });
    expect(res.status).toBe(200);
    expect(res.body.agent_id).toBe(agentId);
    expect(res.body.provider).toBe("openai");
    expect(res.body.model_override).toBe("gpt-4o-mini");
  });

  it("PUT /api/agents/:agentId/model-rules/:provider updates existing rule", async () => {
    const agentId = `agent-model-${randomUUID()}`;
    await request("POST", "/api/events", {
      body: makeEvent({ agent_id: agentId, provider: "anthropic" }),
    });

    // Create rule
    await request("PUT", `/api/agents/${agentId}/model-rules/anthropic`, {
      body: { model_override: "claude-sonnet-4-5" },
    });

    // Update rule
    const res = await request("PUT", `/api/agents/${agentId}/model-rules/anthropic`, {
      body: { model_override: "claude-haiku" },
    });
    expect(res.status).toBe(200);
    expect(res.body.model_override).toBe("claude-haiku");
  });

  it("DELETE /api/agents/:agentId/model-rules/:provider removes rule", async () => {
    const agentId = `agent-model-${randomUUID()}`;
    await request("POST", "/api/events", {
      body: makeEvent({ agent_id: agentId, provider: "openai" }),
    });

    // Create rule
    await request("PUT", `/api/agents/${agentId}/model-rules/openai`, {
      body: { model_override: "gpt-4o-mini" },
    });

    // Delete rule
    const deleteRes = await request("DELETE", `/api/agents/${agentId}/model-rules/openai`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // Verify it's gone
    const listRes = await request("GET", `/api/agents/${agentId}/model-rules`);
    expect(listRes.body.rules).toEqual([]);
  });

  it("GET /api/agents/:agentId/providers returns providers with override info", async () => {
    const agentId = `agent-model-${randomUUID()}`;

    // Create events for multiple providers
    await request("POST", "/api/events", {
      body: {
        events: [
          makeEvent({ agent_id: agentId, provider: "openai", model: "gpt-4" }),
          makeEvent({ agent_id: agentId, provider: "anthropic", model: "claude-3" }),
        ],
      },
    });

    // Add override for one provider
    await request("PUT", `/api/agents/${agentId}/model-rules/openai`, {
      body: { model_override: "gpt-4o-mini" },
    });

    const res = await request("GET", `/api/agents/${agentId}/providers`);
    expect(res.status).toBe(200);
    expect(res.body.providers).toHaveLength(2);

    const openai = res.body.providers.find((p: any) => p.provider === "openai");
    const anthropic = res.body.providers.find((p: any) => p.provider === "anthropic");

    expect(openai.model_override).toBe("gpt-4o-mini");
    expect(anthropic.model_override).toBeNull();
  });

  it("GET /api/models returns selectable models", async () => {
    const res = await request("GET", "/api/models");
    expect(res.status).toBe(200);
    expect(res.body.openai).toBeDefined();
    expect(res.body.anthropic).toBeDefined();
    expect(Array.isArray(res.body.openai)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Overview endpoint tests
// ---------------------------------------------------------------------------

describe("Overview endpoint GET /api/overview", () => {
  it("returns dashboard data with stats and trends", async () => {
    const res = await request("GET", "/api/overview");
    expect(res.status).toBe(200);

    // Check required fields exist
    expect(res.body.today_requests).toBeDefined();
    expect(res.body.today_cost).toBeDefined();
    expect(res.body.top_agents).toBeInstanceOf(Array);
    expect(res.body.top_models).toBeInstanceOf(Array);
    expect(res.body.cost_trend).toBeInstanceOf(Array);
    expect(res.body.requests_trend).toBeInstanceOf(Array);
    expect(res.body.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(res.body.server_status).toBe("running");
  });

  it("returns top agents with cost and percentage", async () => {
    // Create some events for an agent
    const agentId = `overview-agent-${randomUUID()}`;
    await request("POST", "/api/events", {
      body: makeEvent({ agent_id: agentId, provider: "openai", cost_usd: 0.05 }),
    });

    const res = await request("GET", "/api/overview");
    expect(res.status).toBe(200);

    // Top agents should have the expected structure
    if (res.body.top_agents.length > 0) {
      const agent = res.body.top_agents[0];
      expect(agent).toHaveProperty("agent_id");
      expect(agent).toHaveProperty("cost");
      expect(agent).toHaveProperty("percentage");
    }
  });

  it("returns agents list with activity info", async () => {
    const res = await request("GET", "/api/overview");
    expect(res.status).toBe(200);
    expect(res.body.agents).toBeInstanceOf(Array);

    if (res.body.agents.length > 0) {
      const agent = res.body.agents[0];
      expect(agent).toHaveProperty("agent_id");
      expect(agent).toHaveProperty("status");
      expect(agent).toHaveProperty("primary_provider");
    }
  });
});

// ---------------------------------------------------------------------------
// Settings endpoint tests
// ---------------------------------------------------------------------------

describe("Settings endpoint /api/settings", () => {
  it("GET returns settings without token", async () => {
    const res = await request("GET", "/api/settings");
    expect(res.status).toBe(200);
    // Should not contain token
    expect(res.body.token).toBeUndefined();
    // Should not contain providers
    expect(res.body.providers).toBeUndefined();
  });

  it("PUT updates settings and returns updated values", async () => {
    const updates = {
      server: { autoOpen: false },
      data: { retentionDays: 30 },
    };

    const res = await request("PUT", "/api/settings", { body: updates });
    expect(res.status).toBe(200);
    expect(res.body.server?.autoOpen).toBe(false);
    expect(res.body.data?.retentionDays).toBe(30);
  });

  it("PUT does not expose token in response", async () => {
    const res = await request("PUT", "/api/settings", {
      body: { server: { port: 8080 } },
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Health endpoint tests
// ---------------------------------------------------------------------------

describe("Health endpoint GET /api/health", () => {
  it("returns status ok without auth", async () => {
    const res = await request("GET", "/api/health", { token: null });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.version).toBeDefined();
    expect(res.body.uptime_ms).toBeGreaterThanOrEqual(0);
  });

  it("returns status ok with auth", async () => {
    const res = await request("GET", "/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// Providers endpoint tests
// ---------------------------------------------------------------------------

describe("Providers endpoint /api/providers", () => {
  it("GET returns list of configured providers", async () => {
    const res = await request("GET", "/api/providers");
    expect(res.status).toBe(200);
    expect(res.body.providers).toBeInstanceOf(Array);
  });
});
