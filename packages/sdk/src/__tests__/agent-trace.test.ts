import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgentTrace } from "../agent-trace.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS = {
  apiKey: "test-api-key",
  agentId: "agent-123",
  endpoint: "https://example.com/ingest",
  flushInterval: 60_000, // long interval so auto-flush does not interfere
};

/**
 * Convenience: create a fresh instance and a mock fetch in one call.
 * Returns both so each test can make assertions on the mock.
 */
function setup(overrides: Record<string, unknown> = {}) {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const watch = AgentTrace.init({ ...DEFAULT_OPTIONS, ...overrides } as any);
  return { watch, fetchMock };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentTrace", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // init()
  // -----------------------------------------------------------------------
  describe("init()", () => {
    it("creates an instance with the provided options", () => {
      const { watch } = setup();
      expect(watch).toBeInstanceOf(AgentTrace);
    });

    it("throws if apiKey is missing", () => {
      expect(() =>
        AgentTrace.init({ apiKey: "", agentId: "agent-123", flushInterval: 60_000 })
      ).toThrow("[AgentTrace] apiKey is required");
    });

    it("throws if agentId is missing", () => {
      expect(() =>
        AgentTrace.init({ apiKey: "key", agentId: "", flushInterval: 60_000 })
      ).toThrow("[AgentTrace] agentId is required");
    });

    it("uses default endpoint when none is provided", () => {
      const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const watch = AgentTrace.init({
        apiKey: "key",
        agentId: "agent",
        flushInterval: 60_000,
      });

      // Track an event then flush to observe the endpoint used
      watch.track({ provider: "openai", model: "gpt-4" });
      void watch.flush();
      vi.advanceTimersByTime(0); // allow microtasks

      expect(fetchMock).toHaveBeenCalledOnce();
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toBe(
        "https://your-project.supabase.co/functions/v1/ingest",
      );

      void watch.shutdown();
    });

    it("uses custom endpoint when provided", () => {
      const { watch, fetchMock } = setup({
        endpoint: "https://custom.endpoint/ingest",
      });

      watch.track({ provider: "openai" });
      void watch.flush();

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://custom.endpoint/ingest",
      );

      void watch.shutdown();
    });
  });

  // -----------------------------------------------------------------------
  // track()
  // -----------------------------------------------------------------------
  describe("track()", () => {
    it("buffers events without sending immediately", () => {
      const { watch, fetchMock } = setup();

      watch.track({ provider: "openai", model: "gpt-4" });

      // fetch should NOT have been called yet
      expect(fetchMock).not.toHaveBeenCalled();

      void watch.shutdown();
    });

    it("creates an llm_call event with correct structure", async () => {
      const { watch, fetchMock } = setup();

      watch.track({
        provider: "openai",
        model: "gpt-4",
        tokens: { input: 100, output: 50, total: 150 },
        latency_ms: 320,
        status: 200,
        tags: { run_id: "r1" },
      });

      await watch.flush();

      expect(fetchMock).toHaveBeenCalledOnce();
      const body = JSON.parse(
        fetchMock.mock.calls[0][1]!.body as string,
      ) as { events: any[] };

      expect(body.events).toHaveLength(1);
      const event = body.events[0];
      expect(event.agent_id).toBe("agent-123");
      expect(event.event_type).toBe("llm_call");
      expect(event.source).toBe("sdk");
      expect(event.provider).toBe("openai");
      expect(event.model).toBe("gpt-4");
      expect(event.tokens_in).toBe(100);
      expect(event.tokens_out).toBe(50);
      expect(event.tokens_total).toBe(150);
      expect(event.latency_ms).toBe(320);
      expect(event.status_code).toBe(200);
      expect(event.tags).toEqual({ run_id: "r1" });
      expect(typeof event.timestamp).toBe("string");

      void watch.shutdown();
    });

    it("defaults optional fields to null when not provided", async () => {
      const { watch, fetchMock } = setup();

      watch.track({});

      await watch.flush();

      const body = JSON.parse(
        fetchMock.mock.calls[0][1]!.body as string,
      ) as { events: any[] };
      const event = body.events[0];

      expect(event.provider).toBeNull();
      expect(event.model).toBeNull();
      expect(event.tokens_in).toBeNull();
      expect(event.tokens_out).toBeNull();
      expect(event.tokens_total).toBeNull();
      expect(event.latency_ms).toBeNull();
      expect(event.status_code).toBeNull();
      expect(event.error_message).toBeNull();
      expect(event.tags).toEqual({});

      void watch.shutdown();
    });
  });

  // -----------------------------------------------------------------------
  // heartbeat()
  // -----------------------------------------------------------------------
  describe("heartbeat()", () => {
    it("creates a heartbeat event in the buffer", async () => {
      const { watch, fetchMock } = setup();

      watch.heartbeat();
      await watch.flush();

      expect(fetchMock).toHaveBeenCalledOnce();
      const body = JSON.parse(
        fetchMock.mock.calls[0][1]!.body as string,
      ) as { events: any[] };

      expect(body.events).toHaveLength(1);
      const event = body.events[0];
      expect(event.agent_id).toBe("agent-123");
      expect(event.event_type).toBe("heartbeat");
      expect(event.source).toBe("sdk");
      expect(typeof event.timestamp).toBe("string");
      expect(event.tags).toEqual({});

      void watch.shutdown();
    });
  });

  // -----------------------------------------------------------------------
  // error()
  // -----------------------------------------------------------------------
  describe("error()", () => {
    it("creates an error event from an Error object", async () => {
      const { watch, fetchMock } = setup();

      watch.error(new Error("something went wrong"));
      await watch.flush();

      const body = JSON.parse(
        fetchMock.mock.calls[0][1]!.body as string,
      ) as { events: any[] };
      const event = body.events[0];

      expect(event.agent_id).toBe("agent-123");
      expect(event.event_type).toBe("error");
      expect(event.source).toBe("sdk");
      expect(event.error_message).toBe("something went wrong");
      expect(typeof event.timestamp).toBe("string");

      void watch.shutdown();
    });

    it("captures stack trace from Error objects in tags", async () => {
      const { watch, fetchMock } = setup();

      watch.error(new Error("stack test"));
      await watch.flush();

      const body = JSON.parse(
        fetchMock.mock.calls[0][1]!.body as string,
      ) as { events: any[] };
      const event = body.events[0];

      expect(event.tags.stack).toBeDefined();
      expect(typeof event.tags.stack).toBe("string");
      expect(event.tags.stack).toContain("stack test");

      void watch.shutdown();
    });

    it("creates an error event from a plain string", async () => {
      const { watch, fetchMock } = setup();

      watch.error("string error message");
      await watch.flush();

      const body = JSON.parse(
        fetchMock.mock.calls[0][1]!.body as string,
      ) as { events: any[] };
      const event = body.events[0];

      expect(event.event_type).toBe("error");
      expect(event.error_message).toBe("string error message");

      void watch.shutdown();
    });
  });

  // -----------------------------------------------------------------------
  // Automatic flush when buffer reaches maxBufferSize
  // -----------------------------------------------------------------------
  describe("automatic flush on buffer overflow", () => {
    it("flushes automatically when buffer reaches maxBufferSize", () => {
      const { watch, fetchMock } = setup({ maxBufferSize: 3 });

      watch.track({ provider: "a" });
      watch.track({ provider: "b" });
      expect(fetchMock).not.toHaveBeenCalled();

      // This third event should trigger the auto-flush
      watch.track({ provider: "c" });
      expect(fetchMock).toHaveBeenCalledOnce();

      const body = JSON.parse(
        fetchMock.mock.calls[0][1]!.body as string,
      ) as { events: any[] };
      expect(body.events).toHaveLength(3);

      void watch.shutdown();
    });
  });

  // -----------------------------------------------------------------------
  // flush()
  // -----------------------------------------------------------------------
  describe("flush()", () => {
    it("sends batched events to the endpoint via POST", async () => {
      const { watch, fetchMock } = setup();

      watch.track({ provider: "openai" });
      watch.heartbeat();
      await watch.flush();

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0];

      expect(url).toBe("https://example.com/ingest");
      expect(init!.method).toBe("POST");

      const headers = init!.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["x-api-key"]).toBe("test-api-key");

      const body = JSON.parse(init!.body as string) as { events: any[] };
      expect(body.events).toHaveLength(2);

      void watch.shutdown();
    });

    it("does nothing when the buffer is empty", async () => {
      const { watch, fetchMock } = setup();

      await watch.flush();

      expect(fetchMock).not.toHaveBeenCalled();

      void watch.shutdown();
    });

    it("clears the buffer after flushing", async () => {
      const { watch, fetchMock } = setup();

      watch.track({ provider: "openai" });
      await watch.flush();

      expect(fetchMock).toHaveBeenCalledOnce();

      // Second flush should be a no-op since the buffer is empty
      await watch.flush();
      expect(fetchMock).toHaveBeenCalledOnce();

      void watch.shutdown();
    });

    it("clears the buffer even if the network call fails", async () => {
      const { watch, fetchMock } = setup();
      fetchMock.mockRejectedValueOnce(new Error("Network failure"));

      // Suppress expected console.warn
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      watch.track({ provider: "openai" });
      await watch.flush();

      // Buffer should still be cleared (no re-queueing)
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
      await watch.flush();
      // The second flush should NOT have called fetch (buffer empty)
      expect(fetchMock).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
      void watch.shutdown();
    });
  });

  // -----------------------------------------------------------------------
  // Graceful degradation
  // -----------------------------------------------------------------------
  describe("graceful degradation", () => {
    it("catches network errors and logs a warning instead of throwing", async () => {
      const { watch, fetchMock } = setup();
      fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      watch.track({ provider: "openai" });

      // flush should NOT throw
      await expect(watch.flush()).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0][0]).toContain("[AgentTrace] flush failed");
      expect(warnSpy.mock.calls[0][0]).toContain("ECONNREFUSED");

      warnSpy.mockRestore();
      void watch.shutdown();
    });

    it("handles non-Error rejection values gracefully", async () => {
      const { watch, fetchMock } = setup();
      fetchMock.mockRejectedValueOnce("raw string error");

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      watch.track({ provider: "openai" });
      await expect(watch.flush()).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0][0]).toContain("raw string error");

      warnSpy.mockRestore();
      void watch.shutdown();
    });
  });

  // -----------------------------------------------------------------------
  // shutdown()
  // -----------------------------------------------------------------------
  describe("shutdown()", () => {
    it("clears the interval timer and flushes remaining events", async () => {
      const { watch, fetchMock } = setup();

      watch.track({ provider: "openai" });
      watch.heartbeat();

      await watch.shutdown();

      // Remaining events should have been flushed
      expect(fetchMock).toHaveBeenCalledOnce();
      const body = JSON.parse(
        fetchMock.mock.calls[0][1]!.body as string,
      ) as { events: any[] };
      expect(body.events).toHaveLength(2);
    });

    it("does not trigger additional flushes after shutdown", async () => {
      const { watch, fetchMock } = setup({ flushInterval: 1000 });

      watch.track({ provider: "openai" });
      await watch.shutdown();

      expect(fetchMock).toHaveBeenCalledOnce();

      // Advance past several flush intervals -- no more calls should happen
      vi.advanceTimersByTime(10_000);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("is safe to call shutdown when buffer is empty", async () => {
      const { watch, fetchMock } = setup();

      await expect(watch.shutdown()).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Timer-based automatic flushing
  // -----------------------------------------------------------------------
  describe("timer-based automatic flushing", () => {
    it("flushes automatically when the timer interval elapses", () => {
      const { watch, fetchMock } = setup({ flushInterval: 5000 });

      watch.track({ provider: "openai" });

      // Not yet flushed
      expect(fetchMock).not.toHaveBeenCalled();

      // Advance time past the flush interval
      vi.advanceTimersByTime(5000);

      expect(fetchMock).toHaveBeenCalledOnce();

      void watch.shutdown();
    });

    it("flushes on each interval cycle", () => {
      const { watch, fetchMock } = setup({ flushInterval: 2000 });

      watch.track({ provider: "a" });
      vi.advanceTimersByTime(2000);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      watch.track({ provider: "b" });
      vi.advanceTimersByTime(2000);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      void watch.shutdown();
    });

    it("does not call fetch on interval tick if buffer is empty", () => {
      const { watch, fetchMock } = setup({ flushInterval: 1000 });

      vi.advanceTimersByTime(5000);

      // flush() should short-circuit on empty buffer and never call fetch
      expect(fetchMock).not.toHaveBeenCalled();

      void watch.shutdown();
    });
  });

  // -----------------------------------------------------------------------
  // Event structure validation
  // -----------------------------------------------------------------------
  describe("event structure", () => {
    it("all events include agent_id, event_type, timestamp, and source: 'sdk'", async () => {
      const { watch, fetchMock } = setup();

      watch.track({ provider: "anthropic", model: "claude-3" });
      watch.heartbeat();
      watch.error(new Error("fail"));

      await watch.flush();

      const body = JSON.parse(
        fetchMock.mock.calls[0][1]!.body as string,
      ) as { events: any[] };

      for (const event of body.events) {
        expect(event.agent_id).toBe("agent-123");
        expect(event.source).toBe("sdk");
        expect(typeof event.timestamp).toBe("string");
        // Validate ISO 8601 format
        expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
        expect(["llm_call", "completion", "heartbeat", "error", "custom"]).toContain(
          event.event_type,
        );
      }

      void watch.shutdown();
    });

    it("timestamps reflect the time the event was created", async () => {
      const { watch, fetchMock } = setup();

      const beforeTime = new Date().toISOString();
      watch.heartbeat();
      const afterTime = new Date().toISOString();

      await watch.flush();

      const body = JSON.parse(
        fetchMock.mock.calls[0][1]!.body as string,
      ) as { events: any[] };
      const timestamp = body.events[0].timestamp;

      expect(timestamp >= beforeTime).toBe(true);
      expect(timestamp <= afterTime).toBe(true);

      void watch.shutdown();
    });
  });

  // -----------------------------------------------------------------------
  // custom()
  // -----------------------------------------------------------------------
  describe("custom()", () => {
    it("creates a custom event with the given data as tags", async () => {
      const { watch, fetchMock } = setup();

      watch.custom({ action: "deploy", version: "1.2.3" });
      await watch.flush();

      const body = JSON.parse(
        fetchMock.mock.calls[0][1]!.body as string,
      ) as { events: any[] };
      const event = body.events[0];

      expect(event.event_type).toBe("custom");
      expect(event.source).toBe("sdk");
      expect(event.tags).toEqual({ action: "deploy", version: "1.2.3" });

      void watch.shutdown();
    });
  });
});
