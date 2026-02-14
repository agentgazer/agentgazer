import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentGazerClient } from "../client.js";

describe("AgentGazerClient", () => {
  const mockConfig = {
    endpoint: "http://localhost:18880",
    token: "test-token",
    agentId: "test-agent",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("healthCheck", () => {
    it("returns ok: true when server responds with status ok", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "ok", version: "0.5.5" }),
      });

      const client = new AgentGazerClient(mockConfig);
      const result = await client.healthCheck();

      expect(result).toEqual({ ok: true, version: "0.5.5" });
    });

    it("returns ok: false when server is unreachable", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const client = new AgentGazerClient(mockConfig);
      const result = await client.healthCheck();

      expect(result).toEqual({ ok: false });
    });
  });

  describe("getTokenUsage", () => {
    it("sends correct query parameters", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
      });

      const client = new AgentGazerClient(mockConfig);
      await client.getTokenUsage({ period: "today", model: "gpt-4o" });

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:18880/api/stats/tokens?agentId=test-agent&period=today&model=gpt-4o",
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-api-key": "test-token",
          }),
        })
      );
    });

    it("calculates total tokens", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
      });

      const client = new AgentGazerClient(mockConfig);
      const result = await client.getTokenUsage();

      expect(result.totalTokens).toBe(150);
    });
  });

  describe("whoami", () => {
    it("returns agent info with connection status", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "ok", version: "0.5.5" }),
      });

      const client = new AgentGazerClient(mockConfig);
      const result = await client.whoami();

      expect(result).toEqual({
        agentId: "test-agent",
        endpoint: "http://localhost:18880",
        connected: true,
        serverVersion: "0.5.5",
      });
    });
  });
});
