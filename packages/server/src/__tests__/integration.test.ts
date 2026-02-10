import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createServer } from "../server.js";
import { startEvaluator } from "../alerts/evaluator.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function cleanupDb(dbPath: string): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(dbPath + suffix);
    } catch {
      /* ignore */
    }
  }
}

/** Helper: JSON request with Bearer auth */
async function jsonRequest(
  base: string,
  method: string,
  urlPath: string,
  options?: { body?: unknown; token?: string | null },
): Promise<{ status: number; body: any }> {
  const url = `${base}${urlPath}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.token !== null) {
    headers["Authorization"] = `Bearer ${options?.token ?? ""}`;
  }
  const res = await fetch(url, {
    method,
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const ct = res.headers.get("content-type") ?? "";
  const body = ct.includes("application/json") ? await res.json() : await res.text();
  return { status: res.status, body };
}

// =========================================================================
// Test 1: SDK sends events to local server
// =========================================================================

describe("Integration: SDK -> Local Server", () => {
  let server: http.Server;
  let port: number;
  let db: ReturnType<typeof createServer>["db"];
  const token = `integ-sdk-${randomUUID().slice(0, 8)}`;
  const dbPath = path.join(os.tmpdir(), `agentgazer-integ-sdk-${randomUUID()}.db`);

  beforeAll(async () => {
    const { app, db: database } = createServer({ token, dbPath });
    db = database;
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as { port: number }).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    db.close();
    cleanupDb(dbPath);
  });

  it("SDK events appear in server API responses", async () => {
    // Dynamically import SDK so workspace resolution finds the built dist
    const { AgentGazer } = await import("@agentgazer/sdk");

    const agentId = `sdk-test-${randomUUID().slice(0, 8)}`;

    const watch = AgentGazer.init({
      apiKey: token,
      agentId,
      endpoint: `http://localhost:${port}/api/events`,
      flushInterval: 60_000, // disable auto-flush; we flush manually
      maxBufferSize: 1000,
    });

    // Enqueue an LLM call event
    watch.track({
      provider: "openai",
      model: "gpt-4o",
      tokens: { input: 100, output: 50 },
      latency_ms: 500,
      status: 200,
    });

    // Enqueue a heartbeat
    watch.heartbeat();

    // Enqueue an error
    watch.error("something went wrong");

    // Flush everything to the server
    await watch.flush();
    await watch.shutdown();

    // Small delay for DB writes to finalize
    await new Promise((r) => setTimeout(r, 100));

    // ---- Verify events via GET /api/events ----
    const eventsRes = await jsonRequest(
      `http://localhost:${port}`,
      "GET",
      `/api/events?agent_id=${agentId}`,
      { token },
    );
    expect(eventsRes.status).toBe(200);
    const { events } = eventsRes.body;

    // We sent 3 events: llm_call, heartbeat, error
    expect(events.length).toBe(3);

    const types = events.map((e: any) => e.event_type).sort();
    expect(types).toEqual(["error", "heartbeat", "llm_call"]);

    // Verify LLM call details
    const llmEvent = events.find((e: any) => e.event_type === "llm_call");
    expect(llmEvent).toBeTruthy();
    expect(llmEvent.provider).toBe("openai");
    expect(llmEvent.model).toBe("gpt-4o");
    expect(llmEvent.tokens_in).toBe(100);
    expect(llmEvent.tokens_out).toBe(50);
    expect(llmEvent.latency_ms).toBe(500);
    expect(llmEvent.status_code).toBe(200);
    expect(llmEvent.source).toBe("sdk");

    // Verify error event
    const errEvent = events.find((e: any) => e.event_type === "error");
    expect(errEvent).toBeTruthy();
    expect(errEvent.error_message).toBe("something went wrong");

    // ---- Verify agent was auto-created and marked healthy ----
    const agentRes = await jsonRequest(
      `http://localhost:${port}`,
      "GET",
      `/api/agents/${agentId}`,
      { token },
    );
    expect(agentRes.status).toBe(200);
    expect(agentRes.body.agent_id).toBe(agentId);
    expect(agentRes.body.updated_at).toBeTruthy();
  });

  it("SDK custom events and tags round-trip through the server", async () => {
    const { AgentGazer } = await import("@agentgazer/sdk");

    const agentId = `sdk-custom-${randomUUID().slice(0, 8)}`;

    const watch = AgentGazer.init({
      apiKey: token,
      agentId,
      endpoint: `http://localhost:${port}/api/events`,
      flushInterval: 60_000,
      maxBufferSize: 1000,
    });

    watch.custom({ workflow: "summarize", step: 3, metadata: { foo: "bar" } });
    await watch.flush();
    await watch.shutdown();

    await new Promise((r) => setTimeout(r, 50));

    const eventsRes = await jsonRequest(
      `http://localhost:${port}`,
      "GET",
      `/api/events?agent_id=${agentId}`,
      { token },
    );
    expect(eventsRes.status).toBe(200);
    expect(eventsRes.body.events.length).toBe(1);

    const ev = eventsRes.body.events[0];
    expect(ev.event_type).toBe("custom");
    expect(ev.tags.workflow).toBe("summarize");
    expect(ev.tags.step).toBe(3);
    expect(ev.tags.metadata).toEqual({ foo: "bar" });
  });

  it("SDK track events feed into the stats endpoint", async () => {
    const { AgentGazer } = await import("@agentgazer/sdk");

    const agentId = `sdk-stats-${randomUUID().slice(0, 8)}`;

    const watch = AgentGazer.init({
      apiKey: token,
      agentId,
      endpoint: `http://localhost:${port}/api/events`,
      flushInterval: 60_000,
      maxBufferSize: 1000,
    });

    // Send multiple LLM calls
    watch.track({
      provider: "openai",
      model: "gpt-4o",
      tokens: { input: 200, output: 100, total: 300 },
      latency_ms: 400,
      status: 200,
    });
    watch.track({
      provider: "anthropic",
      model: "claude-3-5-sonnet",
      tokens: { input: 150, output: 80, total: 230 },
      latency_ms: 350,
      status: 200,
    });
    // Send an error event via watch.error() -- this creates event_type "error"
    // which is what the stats endpoint counts for total_errors
    watch.error("model rate limited");

    await watch.flush();
    await watch.shutdown();

    await new Promise((r) => setTimeout(r, 50));

    const statsRes = await jsonRequest(
      `http://localhost:${port}`,
      "GET",
      `/api/stats/${agentId}`,
      { token },
    );
    expect(statsRes.status).toBe(200);

    const stats = statsRes.body;
    // 2 llm_call + 1 error = 3 total requests
    expect(stats.total_requests).toBe(3);
    // The stats endpoint counts events with event_type "error"
    expect(stats.total_errors).toBe(1);
    expect(stats.error_rate).toBeCloseTo(1 / 3, 5);
    // Only llm_call events contribute to total_tokens (300 + 230 = 530)
    expect(stats.total_tokens).toBe(530);
    expect(typeof stats.p50_latency).toBe("number");
    expect(typeof stats.p99_latency).toBe("number");
  });
});

// =========================================================================
// Test 2: Alert evaluation fires and records history
// =========================================================================

describe("Integration: Alert evaluation", () => {
  let server: http.Server;
  let port: number;
  let db: ReturnType<typeof createServer>["db"];
  const token = `integ-alert-${randomUUID().slice(0, 8)}`;
  const dbPath = path.join(os.tmpdir(), `agentgazer-integ-alert-${randomUUID()}.db`);
  let base: string;

  beforeAll(async () => {
    const { app, db: database } = createServer({ token, dbPath });
    db = database;
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as { port: number }).port;
    base = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    db.close();
    cleanupDb(dbPath);
  });

  it("agent_down alert fires when heartbeat is stale", async () => {
    const agentId = `alert-down-${randomUUID().slice(0, 8)}`;

    // 1. Create an agent by sending a heartbeat event through the API
    const eventRes = await jsonRequest(base, "POST", "/api/events", {
      token,
      body: {
        agent_id: agentId,
        event_type: "heartbeat",
        source: "sdk",
        timestamp: new Date().toISOString(),
      },
    });
    expect(eventRes.status).toBe(200);

    // 2. Create an agent_down alert rule with a very short threshold (1 minute)
    const alertRes = await jsonRequest(base, "POST", "/api/alerts", {
      token,
      body: {
        agent_id: agentId,
        rule_type: "agent_down",
        config: { duration_minutes: 1 },
        webhook_url: "https://hooks.example.com/noop",
      },
    });
    expect(alertRes.status).toBe(201);
    const ruleId = alertRes.body.id;
    expect(ruleId).toBeTruthy();

    // 3. Directly manipulate the agent's updated_at to be 10 minutes ago
    //    so the evaluator thinks the agent is inactive.
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    // SQLite datetime format without trailing Z (matches the schema convention)
    const staleTimestamp = tenMinutesAgo.toISOString().replace("T", " ").slice(0, 19);
    db.prepare("UPDATE agents SET updated_at = ? WHERE agent_id = ?").run(
      staleTimestamp,
      agentId,
    );

    // 4. Start the evaluator with a short interval and wait for it to tick
    const evaluator = startEvaluator({ db, interval: 200 });

    // Wait enough for at least one tick to complete
    await new Promise((r) => setTimeout(r, 600));
    evaluator.stop();

    // 5. Verify alert_history contains a record for this rule
    const historyRes = await jsonRequest(base, "GET", "/api/alert-history", {
      token,
    });
    expect(historyRes.status).toBe(200);
    expect(Array.isArray(historyRes.body.history)).toBe(true);

    const entry = historyRes.body.history.find(
      (h: any) => h.alert_rule_id === ruleId && h.agent_id === agentId,
    );
    expect(entry).toBeTruthy();
    expect(entry.rule_type).toBe("agent_down");
    expect(entry.message).toContain(agentId);
    expect(entry.message).toContain("inactive");
    expect(entry.delivered_via).toBe("webhook");
  });

  it("error_rate alert fires when error rate exceeds threshold", async () => {
    const agentId = `alert-errrate-${randomUUID().slice(0, 8)}`;

    // 1. Insert events: 8 successful + 3 errors = 11 total, error rate ~27%
    const events = [];
    for (let i = 0; i < 8; i++) {
      events.push({
        agent_id: agentId,
        event_type: "llm_call",
        source: "sdk",
        timestamp: new Date().toISOString(),
        provider: "openai",
        model: "gpt-4o",
        tokens_in: 50,
        tokens_out: 25,
        status_code: 200,
        latency_ms: 300,
      });
    }
    for (let i = 0; i < 3; i++) {
      events.push({
        agent_id: agentId,
        event_type: "llm_call",
        source: "sdk",
        timestamp: new Date().toISOString(),
        provider: "openai",
        model: "gpt-4o",
        tokens_in: 50,
        tokens_out: 0,
        status_code: 500,
        latency_ms: 100,
      });
    }
    const eventRes = await jsonRequest(base, "POST", "/api/events", {
      token,
      body: { events },
    });
    expect(eventRes.status).toBe(200);

    // 2. Create an error_rate alert with a threshold of 20% and a 60-minute window
    const alertRes = await jsonRequest(base, "POST", "/api/alerts", {
      token,
      body: {
        agent_id: agentId,
        rule_type: "error_rate",
        config: { window_minutes: 60, threshold: 20 },
        webhook_url: "https://hooks.example.com/noop",
      },
    });
    expect(alertRes.status).toBe(201);
    const ruleId = alertRes.body.id;

    // 3. Run the evaluator
    const evaluator = startEvaluator({ db, interval: 200 });
    await new Promise((r) => setTimeout(r, 600));
    evaluator.stop();

    // 4. Verify alert history
    const historyRes = await jsonRequest(base, "GET", "/api/alert-history", {
      token,
    });
    expect(historyRes.status).toBe(200);

    const entry = historyRes.body.history.find(
      (h: any) => h.alert_rule_id === ruleId && h.agent_id === agentId,
    );
    expect(entry).toBeTruthy();
    expect(entry.rule_type).toBe("error_rate");
    expect(entry.message).toContain(agentId);
    expect(entry.message).toContain("error rate");
  });

  it("budget alert fires when daily spend exceeds threshold", async () => {
    const agentId = `alert-budget-${randomUUID().slice(0, 8)}`;

    // 1. Insert events with cost that exceeds the threshold
    const events = [];
    for (let i = 0; i < 5; i++) {
      events.push({
        agent_id: agentId,
        event_type: "llm_call",
        source: "sdk",
        timestamp: new Date().toISOString(),
        provider: "openai",
        model: "gpt-4o",
        tokens_in: 1000,
        tokens_out: 500,
        cost_usd: 5.0, // $5 each -> $25 total
        latency_ms: 400,
        status_code: 200,
      });
    }
    const eventRes = await jsonRequest(base, "POST", "/api/events", {
      token,
      body: { events },
    });
    expect(eventRes.status).toBe(200);

    // 2. Create a budget alert with $10 threshold
    const alertRes = await jsonRequest(base, "POST", "/api/alerts", {
      token,
      body: {
        agent_id: agentId,
        rule_type: "budget",
        config: { threshold: 10 },
        webhook_url: "https://hooks.example.com/noop",
      },
    });
    expect(alertRes.status).toBe(201);
    const ruleId = alertRes.body.id;

    // 3. Run the evaluator
    const evaluator = startEvaluator({ db, interval: 200 });
    await new Promise((r) => setTimeout(r, 600));
    evaluator.stop();

    // 4. Verify alert history
    const historyRes = await jsonRequest(base, "GET", "/api/alert-history", {
      token,
    });
    expect(historyRes.status).toBe(200);

    const entry = historyRes.body.history.find(
      (h: any) => h.alert_rule_id === ruleId && h.agent_id === agentId,
    );
    expect(entry).toBeTruthy();
    expect(entry.rule_type).toBe("budget");
    expect(entry.message).toContain(agentId);
    expect(entry.message).toContain("spend");
  });

  it("disabled alert rules are NOT evaluated", async () => {
    const agentId = `alert-disabled-${randomUUID().slice(0, 8)}`;

    // Create the agent with an old heartbeat (should trigger agent_down)
    await jsonRequest(base, "POST", "/api/events", {
      token,
      body: {
        agent_id: agentId,
        event_type: "heartbeat",
        source: "sdk",
        timestamp: new Date().toISOString(),
      },
    });

    // Make the activity stale
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const staleTimestamp = tenMinutesAgo.toISOString().replace("T", " ").slice(0, 19);
    db.prepare("UPDATE agents SET updated_at = ? WHERE agent_id = ?").run(
      staleTimestamp,
      agentId,
    );

    // Create rule and immediately disable it
    const alertRes = await jsonRequest(base, "POST", "/api/alerts", {
      token,
      body: {
        agent_id: agentId,
        rule_type: "agent_down",
        config: { duration_minutes: 1 },
        webhook_url: "https://hooks.example.com/noop",
        enabled: false,
      },
    });
    expect(alertRes.status).toBe(201);
    const ruleId = alertRes.body.id;

    // Run the evaluator
    const evaluator = startEvaluator({ db, interval: 200 });
    await new Promise((r) => setTimeout(r, 600));
    evaluator.stop();

    // Verify NO alert history for this rule
    const historyRes = await jsonRequest(base, "GET", "/api/alert-history", {
      token,
    });
    expect(historyRes.status).toBe(200);

    const entry = historyRes.body.history.find(
      (h: any) => h.alert_rule_id === ruleId,
    );
    expect(entry).toBeUndefined();
  });
});

// =========================================================================
// Test 3: Proxy integration
// =========================================================================

describe("Integration: Proxy -> Local Server", () => {
  let localServer: http.Server;
  let localPort: number;
  let db: ReturnType<typeof createServer>["db"];
  const token = `integ-proxy-${randomUUID().slice(0, 8)}`;
  const dbPath = path.join(os.tmpdir(), `agentgazer-integ-proxy-${randomUUID()}.db`);

  beforeAll(async () => {
    const { app, db: database } = createServer({ token, dbPath });
    db = database;
    localServer = http.createServer(app);
    await new Promise<void>((resolve) => localServer.listen(0, resolve));
    localPort = (localServer.address() as { port: number }).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      localServer.close((err) => (err ? reject(err) : resolve())),
    );
    db.close();
    cleanupDb(dbPath);
  });

  it("proxy health check returns ok with agent_id", async () => {
    const { startProxy } = await import("@agentgazer/proxy");

    const agentId = `proxy-health-${randomUUID().slice(0, 8)}`;

    // Start proxy on port 0 so the OS assigns a free port.
    // startProxy calls server.listen(port) internally, so port 0 works.
    const proxy = startProxy({
      port: 0,
      apiKey: token,
      agentId,
      endpoint: `http://localhost:${localPort}/api/events`,
      flushInterval: 60_000,
      maxBufferSize: 1000,
    });

    // Wait for the proxy server to be listening
    await new Promise<void>((resolve) => {
      if (proxy.server.listening) {
        resolve();
      } else {
        proxy.server.on("listening", resolve);
      }
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;

    try {
      // Hit the proxy's /health endpoint
      const res = await fetch(`http://localhost:${proxyPort}/health`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.agent_id).toBe(agentId);
      expect(typeof body.uptime_ms).toBe("number");
    } finally {
      await proxy.shutdown();
    }
  });

  it("proxy EventBuffer sends events to the local server", async () => {
    const { EventBuffer } = await import("@agentgazer/proxy");

    const agentId = `proxy-buffer-${randomUUID().slice(0, 8)}`;

    const buffer = new EventBuffer({
      apiKey: token,
      endpoint: `http://localhost:${localPort}/api/events`,
      flushInterval: 60_000, // disable auto-flush
      maxBufferSize: 1000,
    });

    // Add events directly to the buffer (simulating what the proxy does
    // after parsing upstream LLM responses)
    buffer.add({
      agent_id: agentId,
      event_type: "llm_call",
      provider: "openai",
      model: "gpt-4o-mini",
      tokens_in: 500,
      tokens_out: 250,
      tokens_total: 750,
      cost_usd: 0.003,
      latency_ms: 220,
      status_code: 200,
      source: "proxy",
      timestamp: new Date().toISOString(),
      tags: {},
    });

    buffer.add({
      agent_id: agentId,
      event_type: "llm_call",
      provider: "anthropic",
      model: "claude-3-5-haiku",
      tokens_in: 300,
      tokens_out: 150,
      tokens_total: 450,
      cost_usd: 0.001,
      latency_ms: 180,
      status_code: 200,
      source: "proxy",
      timestamp: new Date().toISOString(),
      tags: {},
    });

    expect(buffer.pending).toBe(2);

    // Flush to the local server
    await buffer.flush();
    await buffer.shutdown();

    expect(buffer.pending).toBe(0);

    // Small delay for DB
    await new Promise((r) => setTimeout(r, 100));

    // Verify the events arrived in the server
    const eventsRes = await jsonRequest(
      `http://localhost:${localPort}`,
      "GET",
      `/api/events?agent_id=${agentId}`,
      { token },
    );
    expect(eventsRes.status).toBe(200);
    expect(eventsRes.body.events.length).toBe(2);

    // All events should have source "proxy"
    for (const ev of eventsRes.body.events) {
      expect(ev.source).toBe("proxy");
      expect(ev.agent_id).toBe(agentId);
    }

    // Verify the agent was created
    const agentRes = await jsonRequest(
      `http://localhost:${localPort}`,
      "GET",
      `/api/agents/${agentId}`,
      { token },
    );
    expect(agentRes.status).toBe(200);
    expect(agentRes.body.agent_id).toBe(agentId);

    // Verify stats reflect proxy events
    const statsRes = await jsonRequest(
      `http://localhost:${localPort}`,
      "GET",
      `/api/stats/${agentId}`,
      { token },
    );
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.total_requests).toBe(2);
    expect(statsRes.body.total_tokens).toBe(1200); // 750 + 450
    expect(statsRes.body.total_cost).toBeCloseTo(0.004, 5);
  });

  it("proxy EventBuffer retries on auth failure", async () => {
    const { EventBuffer } = await import("@agentgazer/proxy");

    const agentId = `proxy-retry-${randomUUID().slice(0, 8)}`;

    // Create a buffer with a WRONG api key
    const buffer = new EventBuffer({
      apiKey: "wrong-key",
      endpoint: `http://localhost:${localPort}/api/events`,
      flushInterval: 60_000,
      maxBufferSize: 1000,
    });

    buffer.add({
      agent_id: agentId,
      event_type: "llm_call",
      provider: "openai",
      model: "gpt-4o",
      tokens_in: 100,
      tokens_out: 50,
      tokens_total: 150,
      latency_ms: 200,
      status_code: 200,
      source: "proxy",
      timestamp: new Date().toISOString(),
      tags: {},
    });

    expect(buffer.pending).toBe(1);

    // Flush should fail (401) and put events back in buffer
    await buffer.flush();

    // Events should be re-queued because the server returned a non-ok response
    expect(buffer.pending).toBe(1);

    await buffer.shutdown();
  });
});

// =========================================================================
// Test 4: Advanced Alert Evaluator features
// =========================================================================

describe("Integration: Advanced Alert Evaluator", () => {
  let server: http.Server;
  let db: ReturnType<typeof createServer>["db"];
  let base: string;
  const token = `integ-alert-adv-${randomUUID().slice(0, 8)}`;
  const dbPath = path.join(os.tmpdir(), `agentgazer-integ-alert-adv-${randomUUID()}.db`);

  beforeAll(async () => {
    const { app, db: database } = createServer({ token, dbPath });
    db = database;
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;
    base = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    db.close();
    cleanupDb(dbPath);
  });

  it("repeat_enabled re-sends alert after interval", async () => {
    const agentId = `alert-repeat-${randomUUID().slice(0, 8)}`;

    // Create agent with stale heartbeat
    await jsonRequest(base, "POST", "/api/events", {
      token,
      body: {
        agent_id: agentId,
        event_type: "heartbeat",
        source: "sdk",
        timestamp: new Date().toISOString(),
      },
    });

    // Make activity stale
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const staleTimestamp = tenMinutesAgo.toISOString().replace("T", " ").slice(0, 19);
    db.prepare("UPDATE agents SET updated_at = ? WHERE agent_id = ?").run(staleTimestamp, agentId);

    // Create rule with repeat_enabled and 1 minute interval
    const alertRes = await jsonRequest(base, "POST", "/api/alerts", {
      token,
      body: {
        agent_id: agentId,
        rule_type: "agent_down",
        config: { duration_minutes: 1 },
        webhook_url: "https://hooks.example.com/noop",
        repeat_enabled: true,
        repeat_interval_minutes: 1, // Very short for testing
      },
    });
    expect(alertRes.status).toBe(201);
    const ruleId = alertRes.body.id;

    // Run evaluator twice with short interval
    const evaluator = startEvaluator({ db, interval: 100 });
    await new Promise((r) => setTimeout(r, 400));
    evaluator.stop();

    // Check alert history - should have at least one entry
    const historyRes = await jsonRequest(base, "GET", "/api/alert-history", { token });
    expect(historyRes.status).toBe(200);

    const entries = historyRes.body.history.filter((h: any) => h.alert_rule_id === ruleId);
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  it("recovery_notify sends message when alert recovers", async () => {
    const agentId = `alert-recovery-${randomUUID().slice(0, 8)}`;

    // Create agent with stale heartbeat
    await jsonRequest(base, "POST", "/api/events", {
      token,
      body: {
        agent_id: agentId,
        event_type: "heartbeat",
        source: "sdk",
        timestamp: new Date().toISOString(),
      },
    });

    // Make activity stale
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const staleTimestamp = tenMinutesAgo.toISOString().replace("T", " ").slice(0, 19);
    db.prepare("UPDATE agents SET updated_at = ? WHERE agent_id = ?").run(staleTimestamp, agentId);

    // Create rule with recovery_notify
    const alertRes = await jsonRequest(base, "POST", "/api/alerts", {
      token,
      body: {
        agent_id: agentId,
        rule_type: "agent_down",
        config: { duration_minutes: 1 },
        webhook_url: "https://hooks.example.com/noop",
        recovery_notify: true,
      },
    });
    expect(alertRes.status).toBe(201);
    const ruleId = alertRes.body.id;

    // Run evaluator to trigger alert
    let evaluator = startEvaluator({ db, interval: 100 });
    await new Promise((r) => setTimeout(r, 300));
    evaluator.stop();

    // Update activity to be recent (simulating recovery)
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    db.prepare("UPDATE agents SET updated_at = ? WHERE agent_id = ?").run(now, agentId);

    // Run evaluator again to detect recovery
    evaluator = startEvaluator({ db, interval: 100 });
    await new Promise((r) => setTimeout(r, 300));
    evaluator.stop();

    // Check alert history for recovery entry
    const historyRes = await jsonRequest(base, "GET", "/api/alert-history", { token });
    expect(historyRes.status).toBe(200);

    // Should have both alert and recovery entries
    const alertEntry = historyRes.body.history.find(
      (h: any) => h.alert_rule_id === ruleId && h.rule_type === "agent_down",
    );
    const recoveryEntry = historyRes.body.history.find(
      (h: any) => h.alert_rule_id === ruleId && h.rule_type === "agent_down_recovery",
    );

    expect(alertEntry).toBeTruthy();
    expect(recoveryEntry).toBeTruthy();
  });

  it("state transitions from normal to alerting to normal", async () => {
    const agentId = `alert-state-${randomUUID().slice(0, 8)}`;

    // Create agent with stale heartbeat
    await jsonRequest(base, "POST", "/api/events", {
      token,
      body: {
        agent_id: agentId,
        event_type: "heartbeat",
        source: "sdk",
        timestamp: new Date().toISOString(),
      },
    });

    // Make activity stale
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const staleTimestamp = tenMinutesAgo.toISOString().replace("T", " ").slice(0, 19);
    db.prepare("UPDATE agents SET updated_at = ? WHERE agent_id = ?").run(staleTimestamp, agentId);

    // Create rule
    const alertRes = await jsonRequest(base, "POST", "/api/alerts", {
      token,
      body: {
        agent_id: agentId,
        rule_type: "agent_down",
        config: { duration_minutes: 1 },
        webhook_url: "https://hooks.example.com/noop",
        repeat_enabled: true,
      },
    });
    expect(alertRes.status).toBe(201);
    const ruleId = alertRes.body.id;

    // Check initial state is normal
    let rule = db.prepare("SELECT state FROM alert_rules WHERE id = ?").get(ruleId) as { state: string };
    expect(rule.state).toBe("normal");

    // Run evaluator to trigger alert
    let evaluator = startEvaluator({ db, interval: 100 });
    await new Promise((r) => setTimeout(r, 300));
    evaluator.stop();

    // Check state is now alerting (repeat_enabled)
    rule = db.prepare("SELECT state FROM alert_rules WHERE id = ?").get(ruleId) as { state: string };
    expect(rule.state).toBe("alerting");

    // Make activity recent (recovery)
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    db.prepare("UPDATE agents SET updated_at = ? WHERE agent_id = ?").run(now, agentId);

    // Run evaluator to detect recovery
    evaluator = startEvaluator({ db, interval: 100 });
    await new Promise((r) => setTimeout(r, 300));
    evaluator.stop();

    // Check state is back to normal
    rule = db.prepare("SELECT state FROM alert_rules WHERE id = ?").get(ruleId) as { state: string };
    expect(rule.state).toBe("normal");
  });

  it("budget alert supports weekly period", async () => {
    const agentId = `alert-budget-weekly-${randomUUID().slice(0, 8)}`;

    // Create agent with events that have cost
    await jsonRequest(base, "POST", "/api/events", {
      token,
      body: {
        events: [
          {
            agent_id: agentId,
            event_type: "llm_call",
            provider: "openai",
            model: "gpt-4o",
            tokens_in: 1000,
            tokens_out: 500,
            cost_usd: 15.0, // Over $10 threshold
            source: "sdk",
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    // Create budget rule with weekly period
    const alertRes = await jsonRequest(base, "POST", "/api/alerts", {
      token,
      body: {
        agent_id: agentId,
        rule_type: "budget",
        config: { threshold: 10 },
        webhook_url: "https://hooks.example.com/noop",
        budget_period: "weekly",
      },
    });
    expect(alertRes.status).toBe(201);
    const ruleId = alertRes.body.id;

    // Run evaluator
    const evaluator = startEvaluator({ db, interval: 100 });
    await new Promise((r) => setTimeout(r, 300));
    evaluator.stop();

    // Check alert history
    const historyRes = await jsonRequest(base, "GET", "/api/alert-history", { token });
    expect(historyRes.status).toBe(200);

    const entry = historyRes.body.history.find(
      (h: any) => h.alert_rule_id === ruleId && h.agent_id === agentId,
    );
    expect(entry).toBeTruthy();
    expect(entry.message).toContain("weekly");
  });

  it("budget alert supports monthly period", async () => {
    const agentId = `alert-budget-monthly-${randomUUID().slice(0, 8)}`;

    // Create agent with events that have cost
    await jsonRequest(base, "POST", "/api/events", {
      token,
      body: {
        events: [
          {
            agent_id: agentId,
            event_type: "llm_call",
            provider: "openai",
            model: "gpt-4o",
            tokens_in: 1000,
            tokens_out: 500,
            cost_usd: 25.0, // Over $20 threshold
            source: "sdk",
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    // Create budget rule with monthly period
    const alertRes = await jsonRequest(base, "POST", "/api/alerts", {
      token,
      body: {
        agent_id: agentId,
        rule_type: "budget",
        config: { threshold: 20 },
        webhook_url: "https://hooks.example.com/noop",
        budget_period: "monthly",
      },
    });
    expect(alertRes.status).toBe(201);
    const ruleId = alertRes.body.id;

    // Run evaluator
    const evaluator = startEvaluator({ db, interval: 100 });
    await new Promise((r) => setTimeout(r, 300));
    evaluator.stop();

    // Check alert history
    const historyRes = await jsonRequest(base, "GET", "/api/alert-history", { token });
    expect(historyRes.status).toBe(200);

    const entry = historyRes.body.history.find(
      (h: any) => h.alert_rule_id === ruleId && h.agent_id === agentId,
    );
    expect(entry).toBeTruthy();
    expect(entry.message).toContain("monthly");
  });

  it("kill_switch alert type fires on event", async () => {
    const { fireKillSwitchAlert } = await import("../alerts/evaluator.js");

    const agentId = `alert-killswitch-${randomUUID().slice(0, 8)}`;

    // Create the agent first
    await jsonRequest(base, "POST", "/api/events", {
      token,
      body: {
        agent_id: agentId,
        event_type: "heartbeat",
        source: "sdk",
        timestamp: new Date().toISOString(),
      },
    });

    // Create kill_switch rule
    const alertRes = await jsonRequest(base, "POST", "/api/alerts", {
      token,
      body: {
        agent_id: agentId,
        rule_type: "kill_switch",
        config: {},
        webhook_url: "https://hooks.example.com/noop",
      },
    });
    expect(alertRes.status).toBe(201);
    const ruleId = alertRes.body.id;

    // Directly fire kill switch alert
    await fireKillSwitchAlert(db, {
      agent_id: agentId,
      score: 85,
      window_size: 10,
      threshold: 70,
      details: {
        similarPrompts: 5,
        similarResponses: 3,
        repeatedToolCalls: 2,
      },
    });

    // Wait for async webhook
    await new Promise((r) => setTimeout(r, 200));

    // Check alert history
    const historyRes = await jsonRequest(base, "GET", "/api/alert-history", { token });
    expect(historyRes.status).toBe(200);

    const entry = historyRes.body.history.find(
      (h: any) => h.alert_rule_id === ruleId && h.rule_type === "kill_switch",
    );
    expect(entry).toBeTruthy();
    expect(entry.message).toContain("Kill switch");
    expect(entry.message).toContain("85");
  });
});
