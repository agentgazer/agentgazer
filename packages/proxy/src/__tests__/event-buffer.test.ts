import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as http from "node:http";
import { EventBuffer } from "../event-buffer.js";
import type { AgentEvent } from "@agentwatch/shared";

function makeEvent(overrides: Partial<AgentEvent> = {}): AgentEvent {
  return {
    agent_id: "test-agent",
    event_type: "llm_call",
    provider: "openai",
    model: "gpt-4o",
    tokens_in: 100,
    tokens_out: 50,
    tokens_total: 150,
    cost_usd: 0.00075,
    latency_ms: 200,
    status_code: 200,
    source: "proxy",
    timestamp: new Date().toISOString(),
    tags: {},
    ...overrides,
  };
}

/**
 * Creates a local HTTP server that captures incoming request bodies.
 * Returns the server, its URL, and an array of received batches.
 */
function createMockIngestServer(): Promise<{
  server: http.Server;
  url: string;
  receivedBatches: Array<{ events: AgentEvent[] }>;
  statusToReturn: { code: number };
}> {
  return new Promise((resolve) => {
    const receivedBatches: Array<{ events: AgentEvent[] }> = [];
    const statusToReturn = { code: 200 };

    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf-8");
        try {
          const parsed = JSON.parse(body);
          receivedBatches.push(parsed);
        } catch {
          // ignore parse errors in tests
        }
        res.writeHead(statusToReturn.code, {
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({
        server,
        url: `http://127.0.0.1:${addr.port}/v1/events`,
        receivedBatches,
        statusToReturn,
      });
    });
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

describe("EventBuffer", () => {
  let mockServer: Awaited<ReturnType<typeof createMockIngestServer>>;

  beforeEach(async () => {
    mockServer = await createMockIngestServer();
  });

  afterEach(async () => {
    await closeServer(mockServer.server);
  });

  it("add() buffers events and reports pending count", () => {
    const buffer = new EventBuffer({
      apiKey: "test-key",
      endpoint: mockServer.url,
      flushInterval: 60_000, // very long so it won't auto-flush by timer
      maxBufferSize: 100,
    });

    expect(buffer.pending).toBe(0);

    buffer.add(makeEvent());
    expect(buffer.pending).toBe(1);

    buffer.add(makeEvent());
    buffer.add(makeEvent());
    expect(buffer.pending).toBe(3);
  });

  it("flush() sends buffered events to the endpoint", async () => {
    const buffer = new EventBuffer({
      apiKey: "test-key",
      endpoint: mockServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
    });

    const event1 = makeEvent({ model: "gpt-4o" });
    const event2 = makeEvent({ model: "gpt-4o-mini" });
    buffer.add(event1);
    buffer.add(event2);

    expect(buffer.pending).toBe(2);

    await buffer.flush();

    expect(buffer.pending).toBe(0);
    expect(mockServer.receivedBatches).toHaveLength(1);
    expect(mockServer.receivedBatches[0].events).toHaveLength(2);
    expect(mockServer.receivedBatches[0].events[0].model).toBe("gpt-4o");
    expect(mockServer.receivedBatches[0].events[1].model).toBe("gpt-4o-mini");
  });

  it("flush() with empty buffer is a no-op", async () => {
    const buffer = new EventBuffer({
      apiKey: "test-key",
      endpoint: mockServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
    });

    await buffer.flush();

    expect(mockServer.receivedBatches).toHaveLength(0);
    expect(buffer.pending).toBe(0);
  });

  it("flush() sends Authorization header with Bearer token", async () => {
    // Use a custom server that captures headers
    const capturedHeaders: http.IncomingHttpHeaders[] = [];
    const headerServer = http.createServer((req, res) => {
      capturedHeaders.push(req.headers);
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    await new Promise<void>((resolve) => {
      headerServer.listen(0, "127.0.0.1", () => resolve());
    });
    const headerAddr = headerServer.address() as { port: number };
    const headerUrl = `http://127.0.0.1:${headerAddr.port}/v1/events`;

    try {
      const buffer = new EventBuffer({
        apiKey: "my-secret-api-key",
        endpoint: headerUrl,
        flushInterval: 60_000,
        maxBufferSize: 100,
      });

      buffer.add(makeEvent());
      await buffer.flush();

      expect(capturedHeaders).toHaveLength(1);
      expect(capturedHeaders[0].authorization).toBe(
        "Bearer my-secret-api-key"
      );
      expect(capturedHeaders[0]["content-type"]).toBe("application/json");
    } finally {
      await new Promise<void>((resolve, reject) => {
        headerServer.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it("auto-flushes when maxBufferSize is reached", async () => {
    const buffer = new EventBuffer({
      apiKey: "test-key",
      endpoint: mockServer.url,
      flushInterval: 60_000,
      maxBufferSize: 3,
    });

    buffer.add(makeEvent({ model: "m1" }));
    buffer.add(makeEvent({ model: "m2" }));

    // Not yet at maxBufferSize
    expect(mockServer.receivedBatches).toHaveLength(0);

    // This third add should trigger auto-flush
    buffer.add(makeEvent({ model: "m3" }));

    // flush() is called asynchronously via void; give it time to complete
    await vi.waitFor(
      () => {
        expect(mockServer.receivedBatches.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 2000, interval: 50 }
    );

    expect(mockServer.receivedBatches[0].events).toHaveLength(3);
  });

  it("re-queues events on failed flush (non-2xx status)", async () => {
    // Make the server return 500
    mockServer.statusToReturn.code = 500;

    const buffer = new EventBuffer({
      apiKey: "test-key",
      endpoint: mockServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
    });

    buffer.add(makeEvent({ model: "m1" }));
    buffer.add(makeEvent({ model: "m2" }));

    await buffer.flush();

    // Events should be re-queued
    expect(buffer.pending).toBe(2);

    // Now make the server return 200 and try again
    mockServer.statusToReturn.code = 200;
    await buffer.flush();

    expect(buffer.pending).toBe(0);
    expect(mockServer.receivedBatches).toHaveLength(2);
  });

  it("re-queues events on network failure", async () => {
    const buffer = new EventBuffer({
      apiKey: "test-key",
      endpoint: "http://127.0.0.1:1/unreachable-endpoint",
      flushInterval: 60_000,
      maxBufferSize: 100,
    });

    buffer.add(makeEvent({ model: "m1" }));

    // Suppress the expected console.error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await buffer.flush();

    // Event should be re-queued since the network request fails
    expect(buffer.pending).toBe(1);

    consoleSpy.mockRestore();
  });

  it("shutdown() flushes remaining events and stops the timer", async () => {
    const buffer = new EventBuffer({
      apiKey: "test-key",
      endpoint: mockServer.url,
      flushInterval: 100, // short interval
      maxBufferSize: 100,
    });
    buffer.start();

    buffer.add(makeEvent({ model: "shutdown-test" }));
    expect(buffer.pending).toBe(1);

    await buffer.shutdown();

    // After shutdown, events should have been flushed
    expect(buffer.pending).toBe(0);
    expect(mockServer.receivedBatches).toHaveLength(1);
    expect(mockServer.receivedBatches[0].events[0].model).toBe(
      "shutdown-test"
    );
  });

  it("start() is idempotent - calling multiple times does not create multiple timers", async () => {
    const buffer = new EventBuffer({
      apiKey: "test-key",
      endpoint: mockServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
    });

    // Calling start multiple times should not throw or create multiple timers
    buffer.start();
    buffer.start();
    buffer.start();

    buffer.add(makeEvent());
    await buffer.shutdown();

    expect(buffer.pending).toBe(0);
    expect(mockServer.receivedBatches).toHaveLength(1);
  });

  it("timer-based flush triggers periodically", async () => {
    const buffer = new EventBuffer({
      apiKey: "test-key",
      endpoint: mockServer.url,
      flushInterval: 100, // 100ms interval
      maxBufferSize: 1000,
    });
    buffer.start();

    buffer.add(makeEvent({ model: "timer-test" }));

    // Wait for the timer to trigger a flush
    await vi.waitFor(
      () => {
        expect(mockServer.receivedBatches.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 2000, interval: 50 }
    );

    expect(mockServer.receivedBatches[0].events[0].model).toBe("timer-test");

    await buffer.shutdown();
  });
});
