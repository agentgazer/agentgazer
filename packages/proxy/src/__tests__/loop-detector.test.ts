import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LoopDetector } from "../loop-detector.js";

describe("LoopDetector", () => {
  let detector: LoopDetector;

  beforeEach(() => {
    detector = new LoopDetector();
  });

  afterEach(() => {
    detector.stopCleanup();
  });

  describe("config management", () => {
    it("returns default config for unknown agent", () => {
      const config = detector.getConfig("unknown-agent");
      expect(config).toEqual({
        enabled: false,
        windowSize: 20,
        threshold: 10.0,
      });
    });

    it("allows setting config for an agent", () => {
      detector.setConfig("agent-1", {
        enabled: true,
        windowSize: 50,
        threshold: 15.0,
      });

      const config = detector.getConfig("agent-1");
      expect(config).toEqual({
        enabled: true,
        windowSize: 50,
        threshold: 15.0,
      });
    });

    it("merges partial config updates", () => {
      detector.setConfig("agent-1", { enabled: true });
      detector.setConfig("agent-1", { threshold: 20.0 });

      const config = detector.getConfig("agent-1");
      expect(config.enabled).toBe(true);
      expect(config.threshold).toBe(20.0);
      expect(config.windowSize).toBe(20); // default unchanged
    });
  });

  describe("recordRequest", () => {
    it("records a request and returns hash info", () => {
      const body = {
        messages: [{ role: "user", content: "Hello, how are you?" }],
      };

      const result = detector.recordRequest("agent-1", body);

      expect(typeof result.promptHash).toBe("bigint");
      expect(Array.isArray(result.toolCalls)).toBe(true);
    });

    it("extracts tool calls from request", () => {
      // Uses OpenAI tools format (in body.tools, not in messages)
      const body = {
        tools: [
          { type: "function", function: { name: "search" } },
          { type: "function", function: { name: "read_file" } },
        ],
        messages: [{ role: "user", content: "Hello" }],
      };

      const result = detector.recordRequest("agent-1", body);

      expect(result.toolCalls).toContain("fn:search");
      expect(result.toolCalls).toContain("fn:read_file");
    });
  });

  describe("recordResponse", () => {
    it("records response hash for latest request", () => {
      const body = {
        messages: [{ role: "user", content: "Test message" }],
      };

      detector.recordRequest("agent-1", body);
      detector.recordResponse("agent-1", "This is the response text");

      // No error should occur
    });

    it("does nothing for unknown agent", () => {
      // Should not throw
      detector.recordResponse("unknown-agent", "response text");
    });
  });

  describe("checkLoop", () => {
    it("returns not loop when disabled", () => {
      detector.setConfig("agent-1", { enabled: false });

      const body = { messages: [{ role: "user", content: "test" }] };
      const { promptHash, toolCalls } = detector.recordRequest("agent-1", body);

      const result = detector.checkLoop("agent-1", promptHash, toolCalls);

      expect(result.isLoop).toBe(false);
      expect(result.score).toBe(0);
    });

    it("returns not loop for first request", () => {
      detector.setConfig("agent-1", { enabled: true, threshold: 5 });

      const body = { messages: [{ role: "user", content: "first request" }] };
      const { promptHash, toolCalls } = detector.recordRequest("agent-1", body);

      const result = detector.checkLoop("agent-1", promptHash, toolCalls);

      expect(result.isLoop).toBe(false);
    });

    it("detects loop with repeated identical prompts", () => {
      detector.setConfig("agent-1", {
        enabled: true,
        windowSize: 10,
        threshold: 5,
      });

      // Send same prompt multiple times
      for (let i = 0; i < 10; i++) {
        const body = {
          messages: [{ role: "user", content: "search for files" }],
        };
        detector.recordRequest("agent-1", body);
        detector.recordResponse("agent-1", `Response ${i}`);
      }

      // Next identical prompt should trigger loop
      const body = { messages: [{ role: "user", content: "search for files" }] };
      const { promptHash, toolCalls } = detector.recordRequest("agent-1", body);
      const result = detector.checkLoop("agent-1", promptHash, toolCalls);

      expect(result.score).toBeGreaterThan(5);
      expect(result.isLoop).toBe(true);
      expect(result.details.similarPrompts).toBeGreaterThan(0);
    });

    it("detects loop with repeated tool calls", () => {
      detector.setConfig("agent-1", {
        enabled: true,
        windowSize: 10,
        threshold: 5,
      });

      // Send requests with same tool calls (using OpenAI tools format)
      for (let i = 0; i < 5; i++) {
        const body = {
          tools: [
            { type: "function", function: { name: "read_file" } },
            { type: "function", function: { name: "search" } },
          ],
          messages: [{ role: "user", content: `Query ${i}` }],
        };
        detector.recordRequest("agent-1", body);
      }

      // Next request with same tools
      const body = {
        tools: [
          { type: "function", function: { name: "read_file" } },
          { type: "function", function: { name: "search" } },
        ],
        messages: [{ role: "user", content: "Query 5" }],
      };
      const { promptHash, toolCalls } = detector.recordRequest("agent-1", body);
      const result = detector.checkLoop("agent-1", promptHash, toolCalls);

      expect(result.details.repeatedToolCalls).toBeGreaterThan(0);
    });

    it("returns score details", () => {
      detector.setConfig("agent-1", { enabled: true, threshold: 100 });

      const body = { messages: [{ role: "user", content: "test" }] };
      detector.recordRequest("agent-1", body);

      const { promptHash, toolCalls } = detector.recordRequest("agent-1", body);
      const result = detector.checkLoop("agent-1", promptHash, toolCalls);

      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("details");
      expect(result.details).toHaveProperty("similarPrompts");
      expect(result.details).toHaveProperty("similarResponses");
      expect(result.details).toHaveProperty("repeatedToolCalls");
    });
  });

  describe("clearAgent", () => {
    it("clears all state for an agent", () => {
      detector.setConfig("agent-1", { enabled: true });

      const body = { messages: [{ role: "user", content: "test" }] };
      detector.recordRequest("agent-1", body);
      detector.recordRequest("agent-1", body);

      detector.clearAgent("agent-1");

      // After clearing, checkLoop should see empty history
      const { promptHash, toolCalls } = detector.recordRequest("agent-1", body);
      const result = detector.checkLoop("agent-1", promptHash, toolCalls);

      // Should have no past requests to compare against
      expect(result.details.similarPrompts).toBe(0);
    });
  });

  describe("clearAll", () => {
    it("clears all agent state", () => {
      detector.setConfig("agent-1", { enabled: true });
      detector.setConfig("agent-2", { enabled: true, threshold: 20 });

      const body = { messages: [{ role: "user", content: "test" }] };
      detector.recordRequest("agent-1", body);
      detector.recordRequest("agent-2", body);

      detector.clearAll();

      // Configs should be reset to defaults
      expect(detector.getConfig("agent-1")).toEqual({
        enabled: false,
        windowSize: 20,
        threshold: 10.0,
      });
      expect(detector.getConfig("agent-2")).toEqual({
        enabled: false,
        windowSize: 20,
        threshold: 10.0,
      });
    });
  });

  describe("TTL cleanup", () => {
    it("tracks agent count", () => {
      expect(detector.getAgentCount()).toBe(0);

      const body = { messages: [{ role: "user", content: "test" }] };
      detector.recordRequest("agent-1", body);
      detector.recordRequest("agent-2", body);

      expect(detector.getAgentCount()).toBe(2);
    });

    it("cleans up inactive agents based on TTL", () => {
      vi.useFakeTimers();

      // Create detector with very short TTL (100ms)
      const shortTtlDetector = new LoopDetector(100);

      const body = { messages: [{ role: "user", content: "test" }] };
      shortTtlDetector.recordRequest("agent-1", body);
      shortTtlDetector.recordRequest("agent-2", body);

      expect(shortTtlDetector.getAgentCount()).toBe(2);

      // Manually trigger cleanup before TTL expires
      let cleaned = shortTtlDetector.cleanupInactiveAgents();
      expect(cleaned).toBe(0);
      expect(shortTtlDetector.getAgentCount()).toBe(2);

      // Advance time past TTL
      vi.advanceTimersByTime(150);

      // Now cleanup should remove inactive agents
      cleaned = shortTtlDetector.cleanupInactiveAgents();
      expect(cleaned).toBe(2);
      expect(shortTtlDetector.getAgentCount()).toBe(0);

      vi.useRealTimers();
      shortTtlDetector.stopCleanup();
    });

    it("preserves active agents during cleanup", () => {
      vi.useFakeTimers();

      const shortTtlDetector = new LoopDetector(100);

      const body = { messages: [{ role: "user", content: "test" }] };
      shortTtlDetector.recordRequest("agent-1", body);
      shortTtlDetector.recordRequest("agent-2", body);

      // Advance time past TTL
      vi.advanceTimersByTime(150);

      // Touch agent-1 to make it active again (still in fake time)
      shortTtlDetector.recordRequest("agent-1", body);

      // Only agent-2 should be cleaned up
      const cleaned = shortTtlDetector.cleanupInactiveAgents();
      expect(cleaned).toBe(1);
      expect(shortTtlDetector.getAgentCount()).toBe(1);
      expect(shortTtlDetector.getConfig("agent-1")).toBeDefined();

      vi.useRealTimers();
      shortTtlDetector.stopCleanup();
    });

    it("allows setting and getting TTL", () => {
      expect(detector.getTtl()).toBe(24 * 60 * 60 * 1000); // default 24h

      detector.setTtl(1000);
      expect(detector.getTtl()).toBe(1000);
    });

    it("starts and stops cleanup timer", () => {
      // Should not throw
      detector.startCleanup(1000);
      detector.startCleanup(1000); // idempotent
      detector.stopCleanup();
      detector.stopCleanup(); // idempotent
    });
  });
});
