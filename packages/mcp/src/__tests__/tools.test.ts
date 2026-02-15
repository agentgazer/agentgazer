import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentGazerClient } from "../client.js";
import {
  estimateCostTool,
  estimateCostHandler,
} from "../tools/estimate-cost.js";
import {
  getBudgetStatusTool,
  getBudgetStatusHandler,
} from "../tools/get-budget-status.js";
import {
  getCostTool,
  getCostHandler,
} from "../tools/get-cost.js";
import {
  getTokenUsageTool,
  getTokenUsageHandler,
} from "../tools/get-token-usage.js";
import {
  whoamiTool,
  whoamiHandler,
} from "../tools/whoami.js";

// Mock client factory
function createMockClient(overrides: Partial<AgentGazerClient> = {}): AgentGazerClient {
  return {
    agentId: "test-agent",
    endpoint: "http://localhost:18880",
    estimateCost: vi.fn(),
    getBudgetStatus: vi.fn(),
    getCost: vi.fn(),
    getTokenUsage: vi.fn(),
    whoami: vi.fn(),
    ...overrides,
  } as unknown as AgentGazerClient;
}

describe("MCP Tools", () => {
  describe("estimate_cost tool", () => {
    it("should have correct tool definition", () => {
      expect(estimateCostTool.name).toBe("estimate_cost");
      expect(estimateCostTool.inputSchema.required).toContain("model");
      expect(estimateCostTool.inputSchema.required).toContain("input_tokens");
      expect(estimateCostTool.inputSchema.required).toContain("output_tokens");
    });

    it("should return error when missing required params", async () => {
      const client = createMockClient();
      const result = await estimateCostHandler(client, {});

      expect(result.content[0].text).toContain("Error");
    });

    it("should return error when model is missing", async () => {
      const client = createMockClient();
      const result = await estimateCostHandler(client, {
        input_tokens: 1000,
        output_tokens: 500,
      });

      expect(result.content[0].text).toContain("Error");
    });

    it("should estimate cost correctly", async () => {
      const client = createMockClient({
        estimateCost: vi.fn().mockResolvedValue({
          model: "gpt-4o",
          estimatedCost: 0.0325,
          currency: "USD",
        }),
      });

      const result = await estimateCostHandler(client, {
        model: "gpt-4o",
        input_tokens: 1000,
        output_tokens: 500,
      });

      expect(result.content[0].text).toContain("Cost Estimate:");
      expect(result.content[0].text).toContain("gpt-4o");
      expect(result.content[0].text).toContain("1,000");
      expect(result.content[0].text).toContain("500");
      expect(result.content[0].text).toContain("$0.0325");
    });
  });

  describe("get_budget_status tool", () => {
    it("should have correct tool definition", () => {
      expect(getBudgetStatusTool.name).toBe("get_budget_status");
      expect(getBudgetStatusTool.inputSchema.properties).toBeDefined();
    });

    it("should show budget when limit is configured", async () => {
      const client = createMockClient({
        getBudgetStatus: vi.fn().mockResolvedValue({
          hasLimit: true,
          limit: 100,
          used: 45.5,
          remaining: 54.5,
          percentageUsed: 45.5,
        }),
      });

      const result = await getBudgetStatusHandler(client);

      expect(result.content[0].text).toContain("Budget Status:");
      expect(result.content[0].text).toContain("Limit:     $100.00");
      expect(result.content[0].text).toContain("Used:      $45.50");
      expect(result.content[0].text).toContain("Remaining: $54.50");
      expect(result.content[0].text).toContain("Progress:  45.5%");
    });

    it("should show warning when budget is almost exhausted", async () => {
      const client = createMockClient({
        getBudgetStatus: vi.fn().mockResolvedValue({
          hasLimit: true,
          limit: 100,
          used: 95,
          remaining: 5,
          percentageUsed: 95,
        }),
      });

      const result = await getBudgetStatusHandler(client);

      expect(result.content[0].text).toContain("Warning: Budget is almost exhausted!");
    });

    it("should show no limit message when no budget configured", async () => {
      const client = createMockClient({
        getBudgetStatus: vi.fn().mockResolvedValue({
          hasLimit: false,
          used: 123.45,
        }),
      });

      const result = await getBudgetStatusHandler(client);

      expect(result.content[0].text).toContain("No budget limit configured.");
      expect(result.content[0].text).toContain("Total spent: $123.45");
    });
  });

  describe("get_cost tool", () => {
    it("should have correct tool definition", () => {
      expect(getCostTool.name).toBe("get_cost");
      expect(getCostTool.inputSchema.properties).toHaveProperty("period");
      expect(getCostTool.inputSchema.properties).toHaveProperty("breakdown");
    });

    it("should return cost without breakdown", async () => {
      const client = createMockClient({
        getCost: vi.fn().mockResolvedValue({
          totalCost: 12.3456,
          currency: "USD",
        }),
      });

      const result = await getCostHandler(client, {});

      expect(result.content[0].text).toContain("Cost: $12.3456 USD");
    });

    it("should return cost with breakdown", async () => {
      const client = createMockClient({
        getCost: vi.fn().mockResolvedValue({
          totalCost: 25.5,
          currency: "USD",
          breakdown: [
            { model: "gpt-4o", cost: 15.25 },
            { model: "claude-sonnet", cost: 10.25 },
          ],
        }),
      });

      const result = await getCostHandler(client, { breakdown: true });

      expect(result.content[0].text).toContain("Cost: $25.5000 USD");
      expect(result.content[0].text).toContain("Breakdown by model:");
      expect(result.content[0].text).toContain("gpt-4o: $15.2500");
      expect(result.content[0].text).toContain("claude-sonnet: $10.2500");
    });

    it("should pass period to client", async () => {
      const getCostMock = vi.fn().mockResolvedValue({
        totalCost: 5.0,
        currency: "USD",
      });
      const client = createMockClient({ getCost: getCostMock });

      await getCostHandler(client, { period: "7d" });

      expect(getCostMock).toHaveBeenCalledWith({
        period: "7d",
        breakdown: undefined,
      });
    });
  });

  describe("get_token_usage tool", () => {
    it("should have correct tool definition", () => {
      expect(getTokenUsageTool.name).toBe("get_token_usage");
      expect(getTokenUsageTool.inputSchema.properties).toHaveProperty("period");
      expect(getTokenUsageTool.inputSchema.properties).toHaveProperty("model");
    });

    it("should return token usage", async () => {
      const client = createMockClient({
        getTokenUsage: vi.fn().mockResolvedValue({
          inputTokens: 1000000,
          outputTokens: 500000,
          totalTokens: 1500000,
        }),
      });

      const result = await getTokenUsageHandler(client, {});

      expect(result.content[0].text).toContain("Token Usage:");
      expect(result.content[0].text).toContain("Input tokens:  1,000,000");
      expect(result.content[0].text).toContain("Output tokens: 500,000");
      expect(result.content[0].text).toContain("Total tokens:  1,500,000");
    });

    it("should pass period and model to client", async () => {
      const getTokenUsageMock = vi.fn().mockResolvedValue({
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });
      const client = createMockClient({ getTokenUsage: getTokenUsageMock });

      await getTokenUsageHandler(client, { period: "today", model: "gpt-4o" });

      expect(getTokenUsageMock).toHaveBeenCalledWith({
        period: "today",
        model: "gpt-4o",
      });
    });
  });

  describe("whoami tool", () => {
    it("should have correct tool definition", () => {
      expect(whoamiTool.name).toBe("whoami");
      expect(whoamiTool.inputSchema.properties).toBeDefined();
    });

    it("should return agent identity", async () => {
      const client = createMockClient({
        whoami: vi.fn().mockResolvedValue({
          agentId: "my-test-agent",
          endpoint: "http://localhost:18880",
          connected: true,
          serverVersion: "0.5.5",
        }),
      });

      const result = await whoamiHandler(client);

      expect(result.content[0].text).toContain("Agent Identity:");
      expect(result.content[0].text).toContain("Agent ID:  my-test-agent");
      expect(result.content[0].text).toContain("Endpoint:  http://localhost:18880");
      expect(result.content[0].text).toContain("Connected: Yes");
      expect(result.content[0].text).toContain("Server:    AgentGazer 0.5.5");
    });

    it("should show not connected", async () => {
      const client = createMockClient({
        whoami: vi.fn().mockResolvedValue({
          agentId: "my-agent",
          endpoint: "http://localhost:18880",
          connected: false,
        }),
      });

      const result = await whoamiHandler(client);

      expect(result.content[0].text).toContain("Connected: No");
    });

    it("should not show server version when not available", async () => {
      const client = createMockClient({
        whoami: vi.fn().mockResolvedValue({
          agentId: "my-agent",
          endpoint: "http://localhost:18880",
          connected: true,
          serverVersion: undefined,
        }),
      });

      const result = await whoamiHandler(client);

      expect(result.content[0].text).not.toContain("Server:");
    });
  });
});
