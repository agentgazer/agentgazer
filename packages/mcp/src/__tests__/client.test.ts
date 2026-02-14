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
        json: () => Promise.resolve({ period: "today", inputTokens: 100, outputTokens: 50 }),
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

    it("calculates total tokens and includes period", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ period: "today", inputTokens: 100, outputTokens: 50 }),
      });

      const client = new AgentGazerClient(mockConfig);
      const result = await client.getTokenUsage();

      expect(result.totalTokens).toBe(150);
      expect(result.period).toBe("today");
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

    it("returns connected: false when server is unreachable", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const client = new AgentGazerClient(mockConfig);
      const result = await client.whoami();

      expect(result.connected).toBe(false);
      expect(result.agentId).toBe("test-agent");
    });
  });

  describe("getCost", () => {
    it("sends correct query parameters", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ period: "7d", totalCost: 12.50, requestCount: 10, currency: "USD" }),
      });

      const client = new AgentGazerClient(mockConfig);
      await client.getCost({ period: "7d", breakdown: true });

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:18880/api/stats/cost?agentId=test-agent&period=7d&breakdown=true",
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-api-key": "test-token",
          }),
        })
      );
    });

    it("returns cost data with breakdown and comparison", async () => {
      const mockCostData = {
        period: "today",
        totalCost: 25.00,
        requestCount: 15,
        currency: "USD",
        breakdown: [
          { model: "gpt-4o", cost: 15.00 },
          { model: "claude-opus-4-5", cost: 10.00 },
        ],
        comparison: {
          period: "yesterday",
          totalCost: 20.00,
          requestCount: 12,
          cost_change_pct: 25.0,
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCostData),
      });

      const client = new AgentGazerClient(mockConfig);
      const result = await client.getCost({ breakdown: true });

      expect(result.totalCost).toBe(25.00);
      expect(result.period).toBe("today");
      expect(result.requestCount).toBe(15);
      expect(result.breakdown).toHaveLength(2);
      expect(result.comparison?.cost_change_pct).toBe(25.0);
    });
  });

  describe("getBudgetStatus", () => {
    it("sends correct query parameters", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ hasLimit: false, used: 0 }),
      });

      const client = new AgentGazerClient(mockConfig);
      await client.getBudgetStatus();

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:18880/api/stats/budget?agentId=test-agent",
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-api-key": "test-token",
          }),
        })
      );
    });

    it("returns budget status with limit", async () => {
      const mockBudgetStatus = {
        hasLimit: true,
        limit: 100,
        used: 45.50,
        remaining: 54.50,
        percentageUsed: 45.5,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBudgetStatus),
      });

      const client = new AgentGazerClient(mockConfig);
      const result = await client.getBudgetStatus();

      expect(result.hasLimit).toBe(true);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(54.50);
    });

    it("returns budget status without limit", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ hasLimit: false, used: 25.00 }),
      });

      const client = new AgentGazerClient(mockConfig);
      const result = await client.getBudgetStatus();

      expect(result.hasLimit).toBe(false);
      expect(result.used).toBe(25.00);
    });
  });

  describe("estimateCost", () => {
    it("sends POST request with correct body", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          estimatedCost: 0.35,
          currency: "USD",
          model: "claude-opus-4-5",
        }),
      });

      const client = new AgentGazerClient(mockConfig);
      await client.estimateCost({
        model: "claude-opus-4-5",
        inputTokens: 10000,
        outputTokens: 5000,
      });

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:18880/api/stats/estimate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            model: "claude-opus-4-5",
            inputTokens: 10000,
            outputTokens: 5000,
          }),
        })
      );
    });

    it("returns estimated cost result", async () => {
      const mockEstimate = {
        estimatedCost: 1.25,
        currency: "USD",
        model: "gpt-4o",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEstimate),
      });

      const client = new AgentGazerClient(mockConfig);
      const result = await client.estimateCost({
        model: "gpt-4o",
        inputTokens: 50000,
        outputTokens: 10000,
      });

      expect(result.estimatedCost).toBe(1.25);
      expect(result.model).toBe("gpt-4o");
    });
  });

  describe("comparison edge cases", () => {
    it("handles null cost_change_pct when previous period has zero cost", async () => {
      const mockCostData = {
        period: "today",
        totalCost: 10.00,
        requestCount: 5,
        currency: "USD",
        comparison: {
          period: "yesterday",
          totalCost: 0,
          requestCount: 0,
          cost_change_pct: null,
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCostData),
      });

      const client = new AgentGazerClient(mockConfig);
      const result = await client.getCost();

      expect(result.comparison?.cost_change_pct).toBeNull();
    });

    it("handles response without comparison for 'all' period", async () => {
      const mockCostData = {
        period: "all",
        totalCost: 100.00,
        requestCount: 50,
        currency: "USD",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCostData),
      });

      const client = new AgentGazerClient(mockConfig);
      const result = await client.getCost({ period: "all" });

      expect(result.comparison).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("throws error on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      const client = new AgentGazerClient(mockConfig);

      await expect(client.getTokenUsage()).rejects.toThrow("API error 401: Unauthorized");
    });

    it("throws error on 404 response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Agent not found"),
      });

      const client = new AgentGazerClient(mockConfig);

      await expect(client.getCost()).rejects.toThrow("API error 404: Agent not found");
    });
  });
});
