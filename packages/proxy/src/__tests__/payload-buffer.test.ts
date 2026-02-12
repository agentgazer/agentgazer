import { describe, it, expect, beforeEach } from "vitest";
import {
  pushPayload,
  getPayloads,
  extractPayloads,
  clearPayloads,
  getBufferSize,
  getBufferedAgents,
  clearAllBuffers,
  setBufferWindowSize,
  getBufferWindowSize,
  type BufferedPayload,
} from "../payload-buffer.js";

describe("payload-buffer", () => {
  beforeEach(() => {
    clearAllBuffers();
    setBufferWindowSize(50); // Reset to default
  });

  const createPayload = (eventId: string, agentId: string): BufferedPayload => ({
    eventId,
    agentId,
    requestBody: `{"messages": [{"role": "user", "content": "Hello ${eventId}"}]}`,
    responseBody: `{"content": "Response for ${eventId}"}`,
    timestamp: Date.now(),
  });

  describe("pushPayload", () => {
    it("adds payload to buffer", () => {
      const payload = createPayload("e1", "agent-1");
      pushPayload("agent-1", payload);

      expect(getBufferSize("agent-1")).toBe(1);
    });

    it("maintains rolling window", () => {
      setBufferWindowSize(3);

      pushPayload("agent-1", createPayload("e1", "agent-1"));
      pushPayload("agent-1", createPayload("e2", "agent-1"));
      pushPayload("agent-1", createPayload("e3", "agent-1"));
      pushPayload("agent-1", createPayload("e4", "agent-1"));

      const payloads = getPayloads("agent-1");
      expect(payloads).toHaveLength(3);
      expect(payloads[0].eventId).toBe("e2"); // e1 was removed
      expect(payloads[2].eventId).toBe("e4");
    });

    it("keeps separate buffers per agent", () => {
      pushPayload("agent-1", createPayload("e1", "agent-1"));
      pushPayload("agent-1", createPayload("e2", "agent-1"));
      pushPayload("agent-2", createPayload("e3", "agent-2"));

      expect(getBufferSize("agent-1")).toBe(2);
      expect(getBufferSize("agent-2")).toBe(1);
    });
  });

  describe("getPayloads", () => {
    it("returns empty array for unknown agent", () => {
      expect(getPayloads("unknown")).toEqual([]);
    });

    it("returns copy of payloads (does not modify buffer)", () => {
      pushPayload("agent-1", createPayload("e1", "agent-1"));

      const payloads1 = getPayloads("agent-1");
      const payloads2 = getPayloads("agent-1");

      expect(payloads1).toHaveLength(1);
      expect(payloads2).toHaveLength(1);
      expect(payloads1).not.toBe(payloads2); // Different array instances
    });
  });

  describe("extractPayloads", () => {
    it("returns and clears buffer", () => {
      pushPayload("agent-1", createPayload("e1", "agent-1"));
      pushPayload("agent-1", createPayload("e2", "agent-1"));

      const extracted = extractPayloads("agent-1");

      expect(extracted).toHaveLength(2);
      expect(getBufferSize("agent-1")).toBe(0);
    });

    it("returns empty array for unknown agent", () => {
      expect(extractPayloads("unknown")).toEqual([]);
    });
  });

  describe("clearPayloads", () => {
    it("clears buffer for specific agent", () => {
      pushPayload("agent-1", createPayload("e1", "agent-1"));
      pushPayload("agent-2", createPayload("e2", "agent-2"));

      clearPayloads("agent-1");

      expect(getBufferSize("agent-1")).toBe(0);
      expect(getBufferSize("agent-2")).toBe(1);
    });
  });

  describe("getBufferedAgents", () => {
    it("returns all agents with buffers", () => {
      pushPayload("agent-1", createPayload("e1", "agent-1"));
      pushPayload("agent-2", createPayload("e2", "agent-2"));
      pushPayload("agent-3", createPayload("e3", "agent-3"));

      const agents = getBufferedAgents();

      expect(agents).toContain("agent-1");
      expect(agents).toContain("agent-2");
      expect(agents).toContain("agent-3");
      expect(agents).toHaveLength(3);
    });
  });

  describe("window size configuration", () => {
    it("can set and get window size", () => {
      setBufferWindowSize(100);
      expect(getBufferWindowSize()).toBe(100);
    });

    it("throws for invalid window size", () => {
      expect(() => setBufferWindowSize(0)).toThrow();
      expect(() => setBufferWindowSize(-1)).toThrow();
    });
  });
});
