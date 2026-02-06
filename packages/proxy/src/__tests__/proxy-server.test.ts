import { describe, it, expect, afterEach, vi } from "vitest";
import * as http from "node:http";
import { startProxy, type ProxyServer } from "../proxy-server.js";

/**
 * Helper: make an HTTP request and return the status, headers, and body.
 * Sets Content-Length explicitly when a body is provided so that Node's
 * http module does not add Transfer-Encoding: chunked (which the proxy
 * would forward and cause fetch to reject with "invalid transfer-encoding").
 */
function httpRequest(options: {
  hostname: string;
  port: number;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const headers = { ...options.headers };
    // Set Content-Length explicitly to avoid Transfer-Encoding: chunked
    if (options.body !== undefined) {
      headers["Content-Length"] = Buffer.byteLength(options.body).toString();
    }
    const req = http.request(
      {
        hostname: options.hostname,
        port: options.port,
        path: options.path,
        method: options.method ?? "GET",
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
      }
    );
    req.on("error", reject);
    if (options.body !== undefined) {
      req.end(options.body);
    } else {
      req.end();
    }
  });
}

/**
 * Creates a mock "provider" HTTP server that returns OpenAI-style responses.
 * Captures incoming request details for assertions.
 */
function createMockProviderServer(): Promise<{
  server: http.Server;
  port: number;
  url: string;
  receivedRequests: Array<{
    method: string;
    url: string;
    headers: http.IncomingHttpHeaders;
    body: string;
  }>;
  responseOverride: {
    statusCode: number;
    body: unknown;
  };
}> {
  return new Promise((resolve) => {
    const receivedRequests: Array<{
      method: string;
      url: string;
      headers: http.IncomingHttpHeaders;
      body: string;
    }> = [];

    const responseOverride = {
      statusCode: 200,
      body: {
        id: "chatcmpl-abc123",
        object: "chat.completion",
        model: "gpt-4o",
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
        choices: [
          {
            message: { role: "assistant", content: "Hello!" },
            finish_reason: "stop",
          },
        ],
      } as unknown,
    };

    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        receivedRequests.push({
          method: req.method ?? "GET",
          url: req.url ?? "/",
          headers: req.headers,
          body: Buffer.concat(chunks).toString("utf-8"),
        });
        const payload = JSON.stringify(responseOverride.body);
        res.writeHead(responseOverride.statusCode, {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload).toString(),
        });
        res.end(payload);
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({
        server,
        port: addr.port,
        url: `http://127.0.0.1:${addr.port}`,
        receivedRequests,
        responseOverride,
      });
    });
  });
}

/**
 * Creates a mock ingest server (for the event buffer flush endpoint)
 * that captures reported events.
 */
function createMockIngestServer(): Promise<{
  server: http.Server;
  port: number;
  url: string;
  receivedBatches: Array<{ events: unknown[] }>;
}> {
  return new Promise((resolve) => {
    const receivedBatches: Array<{ events: unknown[] }> = [];

    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        const bodyStr = Buffer.concat(chunks).toString("utf-8");
        try {
          const parsed = JSON.parse(bodyStr);
          receivedBatches.push(parsed);
        } catch {
          // ignore parse errors
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({
        server,
        port: addr.port,
        url: `http://127.0.0.1:${addr.port}/v1/events`,
        receivedBatches,
      });
    });
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Waits for the proxy server to accept connections by trying to connect.
 */
function waitForServer(port: number, maxAttempts = 20): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function tryConnect(): void {
      attempts++;
      const req = http.request(
        { hostname: "127.0.0.1", port, path: "/health", method: "GET" },
        (res) => {
          res.resume();
          resolve();
        }
      );
      req.on("error", () => {
        if (attempts >= maxAttempts) {
          reject(new Error(`Server not ready after ${maxAttempts} attempts`));
        } else {
          setTimeout(tryConnect, 50);
        }
      });
      req.end();
    }
    tryConnect();
  });
}

describe("Proxy Server Integration", () => {
  let proxy: ProxyServer | null = null;
  let providerServer: Awaited<ReturnType<typeof createMockProviderServer>> | null = null;
  let ingestServer: Awaited<ReturnType<typeof createMockIngestServer>> | null = null;

  afterEach(async () => {
    if (proxy) {
      await proxy.shutdown();
      proxy = null;
    }
    if (providerServer) {
      await closeServer(providerServer.server);
      providerServer = null;
    }
    if (ingestServer) {
      await closeServer(ingestServer.server);
      ingestServer = null;
    }
  });

  it("GET /health returns status ok with agent_id and uptime_ms", async () => {
    ingestServer = await createMockIngestServer();

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-health-test",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    const res = await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/health",
      method: "GET",
    });

    expect(res.status).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.agent_id).toBe("agent-health-test");
    expect(typeof body.uptime_ms).toBe("number");
    expect(body.uptime_ms).toBeGreaterThanOrEqual(0);
  });

  it("auto-detects provider from path when x-target-url is missing", async () => {
    providerServer = await createMockProviderServer();
    ingestServer = await createMockIngestServer();

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-autodetect-test",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    // Without x-target-url, path /v1/chat/completions should auto-detect
    // OpenAI via path patterns. In this test environment there's no real
    // OpenAI to reach, so we verify the proxy attempts to call the detected
    // provider (it will fail with 502, proving auto-detection worked).
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gpt-4o", messages: [] }),
    });

    // The proxy should have auto-detected OpenAI and tried to reach it.
    // We expect either a 401 (OpenAI rejects unauthenticated requests)
    // or a 502 (if the host is unreachable). Either proves auto-detection worked.
    expect([401, 502]).toContain(res.status);

    consoleSpy.mockRestore();
  });

  it("returns 400 when provider cannot be detected and x-target-url is missing", async () => {
    ingestServer = await createMockIngestServer();

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-400-test",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    // Use a path that doesn't match any known provider
    const res = await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/api/custom-endpoint",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toContain("Could not determine upstream provider");
  });

  it("forwards request to target URL and returns provider response", async () => {
    providerServer = await createMockProviderServer();
    ingestServer = await createMockIngestServer();

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-forward-test",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    const requestBody = JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });

    const res = await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": providerServer.url,
        Authorization: "Bearer sk-test-key",
      },
      body: requestBody,
    });

    // The proxy should forward the provider's response
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.model).toBe("gpt-4o");
    expect(body.usage.prompt_tokens).toBe(100);
    expect(body.usage.completion_tokens).toBe(50);

    // Verify the mock provider received the forwarded request
    expect(providerServer.receivedRequests).toHaveLength(1);
    const forwarded = providerServer.receivedRequests[0];
    expect(forwarded.method).toBe("POST");
    expect(forwarded.url).toBe("/v1/chat/completions");

    // Verify proxy-specific headers are stripped
    expect(forwarded.headers["x-target-url"]).toBeUndefined();
    // Authorization header should be forwarded to the provider
    expect(forwarded.headers["authorization"]).toBe("Bearer sk-test-key");
  });

  it("forwards request path correctly - x-target-url base + request path", async () => {
    providerServer = await createMockProviderServer();
    ingestServer = await createMockIngestServer();

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-path-test",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": providerServer.url,
      },
      body: JSON.stringify({ model: "gpt-4o", messages: [] }),
    });

    expect(providerServer.receivedRequests).toHaveLength(1);
    expect(providerServer.receivedRequests[0].url).toBe(
      "/v1/chat/completions"
    );
  });

  it("strips host, connection, and x-target-url headers before forwarding", async () => {
    providerServer = await createMockProviderServer();
    ingestServer = await createMockIngestServer();

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-headers-test",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": providerServer.url,
        "x-custom-header": "should-be-forwarded",
      },
      body: JSON.stringify({}),
    });

    expect(providerServer.receivedRequests).toHaveLength(1);
    const fwdHeaders = providerServer.receivedRequests[0].headers;

    // x-target-url should be stripped
    expect(fwdHeaders["x-target-url"]).toBeUndefined();
    // Custom headers should be forwarded
    expect(fwdHeaders["x-custom-header"]).toBe("should-be-forwarded");
    // Content-Type should be forwarded
    expect(fwdHeaders["content-type"]).toBe("application/json");
  });

  it("extracts metrics from OpenAI-style response and queues event", async () => {
    providerServer = await createMockProviderServer();
    ingestServer = await createMockIngestServer();

    // detectProvider checks the full targetUrl via regex. To make it detect
    // "openai", the URL must contain "api.openai.com" somewhere. We embed it
    // in a query parameter so the regex matches while the actual request still
    // reaches our local mock server.
    const fakeOpenAIUrl = `${providerServer.url}?host=api.openai.com`;

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-metrics-test",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 1, // flush immediately on first event
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": fakeOpenAIUrl,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
      }),
    });

    // Wait for the event buffer to flush (maxBufferSize=1 triggers auto-flush)
    await vi.waitFor(
      () => {
        expect(ingestServer!.receivedBatches.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 3000, interval: 50 }
    );

    const events = ingestServer.receivedBatches[0].events as Array<{
      agent_id: string;
      event_type: string;
      provider: string;
      model: string;
      tokens_in: number;
      tokens_out: number;
      tokens_total: number;
      latency_ms: number;
      status_code: number;
      source: string;
      cost_usd: number | null;
    }>;

    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.agent_id).toBe("agent-metrics-test");
    expect(event.event_type).toBe("llm_call");
    expect(event.provider).toBe("openai");
    expect(event.model).toBe("gpt-4o");
    expect(event.tokens_in).toBe(100);
    expect(event.tokens_out).toBe(50);
    expect(event.tokens_total).toBe(150);
    expect(event.status_code).toBe(200);
    expect(event.source).toBe("proxy");
    expect(event.latency_ms).toBeGreaterThanOrEqual(0);
    // gpt-4o pricing: input $2.50/1M, output $10.00/1M
    // cost = (100/1M)*2.50 + (50/1M)*10.00 = 0.00025 + 0.0005 = 0.00075
    expect(event.cost_usd).toBeCloseTo(0.00075, 6);
  });

  it("uses x-agent-id header to override default agentId", async () => {
    providerServer = await createMockProviderServer();
    providerServer.responseOverride.body = {
      id: "chatcmpl-123",
      model: "gpt-4o",
      usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
    };

    ingestServer = await createMockIngestServer();

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "default-agent",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 1,
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    // Send request with x-agent-id header
    const fakeOpenAIUrl = `${providerServer.url}?host=api.openai.com`;
    await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": fakeOpenAIUrl,
        "x-agent-id": "custom-agent-from-header",
      },
      body: JSON.stringify({ model: "gpt-4o", messages: [] }),
    });

    await vi.waitFor(
      () => {
        expect(ingestServer!.receivedBatches.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 3000, interval: 50 }
    );

    const events = ingestServer.receivedBatches[0].events as Array<{
      agent_id: string;
    }>;

    expect(events).toHaveLength(1);
    expect(events[0].agent_id).toBe("custom-agent-from-header");
  });

  it("returns 502 when upstream is unreachable", async () => {
    ingestServer = await createMockIngestServer();

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-502-test",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    // Suppress the expected console.error from the proxy
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": "http://127.0.0.1:1",
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(502);
    const body = JSON.parse(res.body);
    expect(body.error).toContain("Upstream request failed");

    consoleSpy.mockRestore();
  });

  it("forwards non-2xx status codes from upstream", async () => {
    providerServer = await createMockProviderServer();
    ingestServer = await createMockIngestServer();

    // Configure the mock provider to return 429
    providerServer.responseOverride.statusCode = 429;
    providerServer.responseOverride.body = {
      error: {
        message: "Rate limit exceeded",
        type: "rate_limit_error",
      },
    };

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-upstream-err-test",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    // Suppress expected console.warn for error response parsing
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": providerServer.url,
      },
      body: JSON.stringify({ model: "gpt-4o" }),
    });

    expect(res.status).toBe(429);
    const body = JSON.parse(res.body);
    expect(body.error.message).toBe("Rate limit exceeded");

    consoleSpy.mockRestore();
  });

  it("handles Anthropic-style responses and extracts metrics", async () => {
    providerServer = await createMockProviderServer();
    ingestServer = await createMockIngestServer();

    // Configure mock to return Anthropic-style response
    providerServer.responseOverride.body = {
      id: "msg_abc123",
      type: "message",
      model: "claude-sonnet-4-20250514",
      usage: {
        input_tokens: 200,
        output_tokens: 80,
      },
      content: [{ type: "text", text: "Hello!" }],
      stop_reason: "end_turn",
    };

    // Trick detectProvider into recognizing Anthropic
    const fakeAnthropicUrl = `${providerServer.url}?host=api.anthropic.com`;

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-anthropic-test",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 1,
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": fakeAnthropicUrl,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
      }),
    });

    // Wait for event buffer to flush
    await vi.waitFor(
      () => {
        expect(ingestServer!.receivedBatches.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 3000, interval: 50 }
    );

    const events = ingestServer.receivedBatches[0].events as Array<{
      provider: string;
      model: string;
      tokens_in: number;
      tokens_out: number;
      tokens_total: number;
      cost_usd: number | null;
    }>;

    expect(events).toHaveLength(1);
    expect(events[0].provider).toBe("anthropic");
    expect(events[0].model).toBe("claude-sonnet-4-20250514");
    expect(events[0].tokens_in).toBe(200);
    expect(events[0].tokens_out).toBe(80);
    expect(events[0].tokens_total).toBe(280);
    // claude-sonnet-4-20250514: input $3.00/1M, output $15.00/1M
    // cost = (200/1M)*3.00 + (80/1M)*15.00 = 0.0006 + 0.0012 = 0.0018
    expect(events[0].cost_usd).toBeCloseTo(0.0018, 6);
  });

  it("skips metric extraction for unknown provider (localhost)", async () => {
    providerServer = await createMockProviderServer();
    ingestServer = await createMockIngestServer();

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-unknown-provider",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 1,
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    // Suppress expected console.warn for unknown provider
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Use a path that does NOT match any known provider path pattern.
    // detectProvider checks both host patterns and path patterns.
    // The path /v1/chat/completions would match OpenAI's pathPatterns even
    // on localhost, so we use a custom path here instead.
    const res = await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/api/generate",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Plain localhost URL - detectProvider will return "unknown"
        "x-target-url": providerServer.url,
      },
      body: JSON.stringify({ model: "gpt-4o", messages: [] }),
    });

    // The response should still be forwarded
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.model).toBe("gpt-4o");

    // Wait a bit to ensure no events are queued
    await new Promise((resolve) => setTimeout(resolve, 200));

    // No events should be reported for unknown provider
    expect(ingestServer.receivedBatches).toHaveLength(0);

    consoleSpy.mockRestore();
  });

  it("GET requests are forwarded without a body", async () => {
    providerServer = await createMockProviderServer();
    ingestServer = await createMockIngestServer();

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-get-test",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    const res = await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/models",
      method: "GET",
      headers: {
        "x-target-url": providerServer.url,
      },
    });

    expect(res.status).toBe(200);
    expect(providerServer.receivedRequests).toHaveLength(1);
    expect(providerServer.receivedRequests[0].method).toBe("GET");
    expect(providerServer.receivedRequests[0].url).toBe("/v1/models");
    // GET request should have empty body
    expect(providerServer.receivedRequests[0].body).toBe("");
  });

  it("streams SSE response through to client and extracts OpenAI metrics", async () => {
    ingestServer = await createMockIngestServer();

    // Build OpenAI-style SSE chunks
    const sseChunks = [
      `data: ${JSON.stringify({ id: "chatcmpl-1", object: "chat.completion.chunk", model: "gpt-4o", choices: [{ delta: { role: "assistant" } }] })}\n\n`,
      `data: ${JSON.stringify({ id: "chatcmpl-1", object: "chat.completion.chunk", model: "gpt-4o", choices: [{ delta: { content: "Hello" } }] })}\n\n`,
      `data: ${JSON.stringify({ id: "chatcmpl-1", object: "chat.completion.chunk", model: "gpt-4o", choices: [{ delta: { content: "!" } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } })}\n\n`,
      `data: [DONE]\n\n`,
    ];

    // Create SSE mock provider
    const sseServer = await new Promise<{ server: http.Server; port: number }>((resolve) => {
      const server = http.createServer((_req, res) => {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        // Write all chunks then end
        for (const chunk of sseChunks) {
          res.write(chunk);
        }
        res.end();
      });
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as { port: number };
        resolve({ server, port: addr.port });
      });
    });

    const fakeOpenAIUrl = `http://127.0.0.1:${sseServer.port}?host=api.openai.com`;

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-sse-openai",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 1,
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    const res = await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": fakeOpenAIUrl,
      },
      body: JSON.stringify({ model: "gpt-4o", messages: [], stream: true }),
    });

    // The SSE response should be streamed through
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.body).toContain("data: ");
    expect(res.body).toContain("[DONE]");

    // Wait for event buffer to flush
    await vi.waitFor(
      () => {
        expect(ingestServer!.receivedBatches.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 3000, interval: 50 }
    );

    const events = ingestServer.receivedBatches[0].events as Array<{
      agent_id: string;
      provider: string;
      model: string;
      tokens_in: number;
      tokens_out: number;
      tokens_total: number;
      status_code: number;
      tags: Record<string, string>;
    }>;

    expect(events).toHaveLength(1);
    expect(events[0].agent_id).toBe("agent-sse-openai");
    expect(events[0].provider).toBe("openai");
    expect(events[0].model).toBe("gpt-4o");
    expect(events[0].tokens_in).toBe(10);
    expect(events[0].tokens_out).toBe(5);
    expect(events[0].tokens_total).toBe(15);
    expect(events[0].status_code).toBe(200);
    expect(events[0].tags).toEqual({ streaming: "true" });

    await closeServer(sseServer.server);
  });

  it("streams SSE response through to client and extracts Anthropic metrics", async () => {
    ingestServer = await createMockIngestServer();

    // Build Anthropic-style SSE chunks
    const sseChunks = [
      `event: message_start\ndata: ${JSON.stringify({ type: "message_start", message: { id: "msg_1", type: "message", model: "claude-sonnet-4-20250514", usage: { input_tokens: 25 }, content: [], stop_reason: null } })}\n\n`,
      `event: content_block_start\ndata: ${JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })}\n\n`,
      `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hello!" } })}\n\n`,
      `event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: 0 })}\n\n`,
      `event: message_delta\ndata: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 12 } })}\n\n`,
      `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`,
    ];

    const sseServer = await new Promise<{ server: http.Server; port: number }>((resolve) => {
      const server = http.createServer((_req, res) => {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        for (const chunk of sseChunks) {
          res.write(chunk);
        }
        res.end();
      });
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as { port: number };
        resolve({ server, port: addr.port });
      });
    });

    const fakeAnthropicUrl = `http://127.0.0.1:${sseServer.port}?host=api.anthropic.com`;

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-sse-anthropic",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 1,
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    const res = await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": fakeAnthropicUrl,
      },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", messages: [], stream: true }),
    });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.body).toContain("message_start");

    // Wait for event buffer to flush
    await vi.waitFor(
      () => {
        expect(ingestServer!.receivedBatches.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 3000, interval: 50 }
    );

    const events = ingestServer.receivedBatches[0].events as Array<{
      agent_id: string;
      provider: string;
      model: string;
      tokens_in: number;
      tokens_out: number;
      tokens_total: number;
      tags: Record<string, string>;
    }>;

    expect(events).toHaveLength(1);
    expect(events[0].agent_id).toBe("agent-sse-anthropic");
    expect(events[0].provider).toBe("anthropic");
    expect(events[0].model).toBe("claude-sonnet-4-20250514");
    expect(events[0].tokens_in).toBe(25);
    expect(events[0].tokens_out).toBe(12);
    expect(events[0].tokens_total).toBe(37);
    expect(events[0].tags).toEqual({ streaming: "true" });

    await closeServer(sseServer.server);
  });

  it("shutdown() cleanly shuts down the server and flushes events", async () => {
    providerServer = await createMockProviderServer();
    ingestServer = await createMockIngestServer();

    const fakeOpenAIUrl = `${providerServer.url}?host=api.openai.com`;

    const p = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-shutdown-test",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100, // large buffer so it won't auto-flush
    });

    const proxyPort = (p.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    // Send a request that will generate an event
    await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": fakeOpenAIUrl,
      },
      body: JSON.stringify({ model: "gpt-4o", messages: [] }),
    });

    // Give the async metric extraction a moment to queue the event
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Shutdown should flush the buffered event
    await p.shutdown();
    proxy = null; // prevent afterEach from trying to shut down again

    // The ingest server should have received the flushed events
    expect(ingestServer.receivedBatches.length).toBeGreaterThanOrEqual(1);
    const allEvents = ingestServer.receivedBatches.flatMap((b) => b.events);
    expect(allEvents.length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // Provider key injection
  // -----------------------------------------------------------------------

  it("injects Authorization header for OpenAI when providerKeys is set", async () => {
    providerServer = await createMockProviderServer();
    ingestServer = await createMockIngestServer();

    // Mock fetch to redirect actual provider URLs to local mock server
    const originalFetch = global.fetch;
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes("api.openai.com")) {
        const redirectUrl = url.replace(/https:\/\/api\.openai\.com/, providerServer!.url);
        return originalFetch(redirectUrl, init);
      }
      return originalFetch(input, init);
    });

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-key-inject",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
      providerKeys: {
        openai: "sk-injected-key-12345",
      },
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    // Send request WITHOUT Authorization header, targeting actual provider hostname
    await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": "https://api.openai.com",
      },
      body: JSON.stringify({ model: "gpt-4o", messages: [] }),
    });

    expect(providerServer.receivedRequests).toHaveLength(1);
    // The proxy should have injected the Authorization header
    expect(providerServer.receivedRequests[0].headers["authorization"]).toBe(
      "Bearer sk-injected-key-12345"
    );

    vi.restoreAllMocks();
  });

  it("overrides existing Authorization header when providerKeys is configured", async () => {
    providerServer = await createMockProviderServer();
    ingestServer = await createMockIngestServer();

    // Mock fetch to redirect actual provider URLs to local mock server
    const originalFetch = global.fetch;
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes("api.openai.com")) {
        const redirectUrl = url.replace(/https:\/\/api\.openai\.com/, providerServer!.url);
        return originalFetch(redirectUrl, init);
      }
      return originalFetch(input, init);
    });

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-key-no-override",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
      providerKeys: {
        openai: "sk-injected-key-12345",
      },
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    // Send request WITH existing Authorization header
    await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": "https://api.openai.com",
        Authorization: "Bearer sk-client-own-key",
      },
      body: JSON.stringify({ model: "gpt-4o", messages: [] }),
    });

    expect(providerServer.receivedRequests).toHaveLength(1);
    // When providerKeys is configured, it OVERRIDES any client-provided key
    // This is intentional for integrations like OpenClaw that send placeholder keys
    expect(providerServer.receivedRequests[0].headers["authorization"]).toBe(
      "Bearer sk-injected-key-12345"
    );

    vi.restoreAllMocks();
  });

  it("injects x-api-key header for Anthropic when providerKeys is set", async () => {
    providerServer = await createMockProviderServer();
    ingestServer = await createMockIngestServer();

    providerServer.responseOverride.body = {
      id: "msg_123",
      type: "message",
      model: "claude-sonnet-4-20250514",
      usage: { input_tokens: 10, output_tokens: 5 },
      content: [{ type: "text", text: "Hi" }],
    };

    // Mock fetch to redirect actual provider URLs to local mock server
    const originalFetch = global.fetch;
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes("api.anthropic.com")) {
        const redirectUrl = url.replace(/https:\/\/api\.anthropic\.com/, providerServer!.url);
        return originalFetch(redirectUrl, init);
      }
      return originalFetch(input, init);
    });

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-anthropic-key",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
      providerKeys: {
        anthropic: "sk-ant-injected-key",
      },
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": "https://api.anthropic.com",
      },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", messages: [] }),
    });

    expect(providerServer.receivedRequests).toHaveLength(1);
    expect(providerServer.receivedRequests[0].headers["x-api-key"]).toBe(
      "sk-ant-injected-key"
    );

    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Rate limiting
  // -----------------------------------------------------------------------

  it("returns 429 when provider rate limit is exceeded", async () => {
    providerServer = await createMockProviderServer();
    ingestServer = await createMockIngestServer();

    // Mock fetch to redirect actual provider URLs to local mock server
    const originalFetch = global.fetch;
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes("api.openai.com")) {
        const redirectUrl = url.replace(/https:\/\/api\.openai\.com/, providerServer!.url);
        return originalFetch(redirectUrl, init);
      }
      return originalFetch(input, init);
    });

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-rate-limit",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
      rateLimits: {
        openai: { maxRequests: 2, windowSeconds: 60 },
      },
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    const makeRequest = () =>
      httpRequest({
        hostname: "127.0.0.1",
        port: proxyPort,
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-target-url": "https://api.openai.com",
        },
        body: JSON.stringify({ model: "gpt-4o", messages: [] }),
      });

    // First 2 requests should succeed
    const res1 = await makeRequest();
    expect(res1.status).toBe(200);

    const res2 = await makeRequest();
    expect(res2.status).toBe(200);

    // 3rd request should be rate limited
    const res3 = await makeRequest();
    expect(res3.status).toBe(429);
    expect(res3.headers["retry-after"]).toBeDefined();

    const body = JSON.parse(res3.body);
    expect(body.error.message).toContain("Rate limit exceeded");
    expect(body.retry_after_seconds).toBeGreaterThanOrEqual(1);

    vi.restoreAllMocks();
  });

  it.skip("rate limiting is per-provider — other providers are unaffected", async () => {
    providerServer = await createMockProviderServer();
    ingestServer = await createMockIngestServer();

    // Mock fetch to redirect actual provider URLs to local mock server
    const originalFetch = global.fetch;
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes("api.openai.com") || url.includes("api.anthropic.com")) {
        const redirectUrl = url
          .replace(/https:\/\/api\.openai\.com/, providerServer!.url)
          .replace(/https:\/\/api\.anthropic\.com/, providerServer!.url);
        return originalFetch(redirectUrl, init);
      }
      return originalFetch(input, init);
    });

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-rate-per-provider",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
      rateLimits: {
        openai: { maxRequests: 1, windowSeconds: 60 },
      },
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    // Exhaust OpenAI limit
    const res1 = await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": "https://api.openai.com",
      },
      body: JSON.stringify({ model: "gpt-4o", messages: [] }),
    });
    expect(res1.status).toBe(200);

    // OpenAI should be blocked
    const res2 = await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": "https://api.openai.com",
      },
      body: JSON.stringify({ model: "gpt-4o", messages: [] }),
    });
    expect(res2.status).toBe(429);

    // Anthropic should still work (no rate limit configured)
    providerServer.responseOverride.body = {
      id: "msg_123",
      type: "message",
      model: "claude-sonnet-4-20250514",
      usage: { input_tokens: 10, output_tokens: 5 },
      content: [{ type: "text", text: "Hi" }],
    };

    const res3 = await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": "https://api.anthropic.com",
      },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", messages: [] }),
    });
    expect(res3.status).toBe(200);

    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Hostname-only key injection security
  // -----------------------------------------------------------------------

  it.skip("does NOT inject key when x-target-url has non-provider hostname but matching path", async () => {
    providerServer = await createMockProviderServer();
    ingestServer = await createMockIngestServer();

    proxy = startProxy({
      port: 0,
      apiKey: "test-api-key",
      agentId: "agent-no-inject",
      endpoint: ingestServer.url,
      flushInterval: 60_000,
      maxBufferSize: 100,
      providerKeys: {
        openai: "sk-should-not-leak",
      },
    });

    const proxyPort = (proxy.server.address() as { port: number }).port;
    await waitForServer(proxyPort);

    // Target a non-provider server with an OpenAI-matching path
    await httpRequest({
      hostname: "127.0.0.1",
      port: proxyPort,
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-target-url": providerServer.url,
      },
      body: JSON.stringify({ model: "gpt-4o", messages: [] }),
    });

    expect(providerServer.receivedRequests).toHaveLength(1);
    // No authorization header should be injected for non-provider hostname
    expect(providerServer.receivedRequests[0].headers["authorization"]).toBeUndefined();
  });
});
