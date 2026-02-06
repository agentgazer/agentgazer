import { describe, it, expect } from "vitest";
import {
  calculateCost,
  getModelPricing,
  listSupportedModels,
} from "../pricing.js";

describe("getModelPricing", () => {
  it("returns pricing for gpt-4o", () => {
    const pricing = getModelPricing("gpt-4o");
    expect(pricing).toEqual({
      inputPerMToken: 2.5,
      outputPerMToken: 10.0,
    });
  });

  it("returns pricing for gpt-4o-mini", () => {
    const pricing = getModelPricing("gpt-4o-mini");
    expect(pricing).toEqual({
      inputPerMToken: 0.15,
      outputPerMToken: 0.6,
    });
  });

  it("returns pricing for gpt-4-turbo", () => {
    const pricing = getModelPricing("gpt-4-turbo");
    expect(pricing).toEqual({
      inputPerMToken: 10.0,
      outputPerMToken: 30.0,
    });
  });

  it("returns pricing for o1", () => {
    const pricing = getModelPricing("o1");
    expect(pricing).toEqual({
      inputPerMToken: 15.0,
      outputPerMToken: 60.0,
    });
  });

  it("returns pricing for o3-mini", () => {
    const pricing = getModelPricing("o3-mini");
    expect(pricing).toEqual({
      inputPerMToken: 1.1,
      outputPerMToken: 4.4,
    });
  });

  it("returns pricing for claude-opus-4-5-20251101", () => {
    const pricing = getModelPricing("claude-opus-4-5-20251101");
    expect(pricing).toEqual({
      inputPerMToken: 15.0,
      outputPerMToken: 75.0,
    });
  });

  it("returns pricing for claude-sonnet-4-5-20250929", () => {
    const pricing = getModelPricing("claude-sonnet-4-5-20250929");
    expect(pricing).toEqual({
      inputPerMToken: 3.0,
      outputPerMToken: 15.0,
    });
  });

  it("returns pricing for claude-sonnet-4-20250514", () => {
    const pricing = getModelPricing("claude-sonnet-4-20250514");
    expect(pricing).toEqual({
      inputPerMToken: 3.0,
      outputPerMToken: 15.0,
    });
  });

  it("returns pricing for claude-haiku-4-5-20251001", () => {
    const pricing = getModelPricing("claude-haiku-4-5-20251001");
    expect(pricing).toEqual({
      inputPerMToken: 0.8,
      outputPerMToken: 4.0,
    });
  });

  it("returns pricing for gemini-2.5-pro", () => {
    const pricing = getModelPricing("gemini-2.5-pro");
    expect(pricing).toEqual({
      inputPerMToken: 1.25,
      outputPerMToken: 5.0,
    });
  });

  it("returns pricing for gemini-2.0-flash", () => {
    const pricing = getModelPricing("gemini-2.0-flash");
    expect(pricing).toEqual({
      inputPerMToken: 0.1,
      outputPerMToken: 0.4,
    });
  });

  it("returns pricing for mistral-large-latest", () => {
    const pricing = getModelPricing("mistral-large-latest");
    expect(pricing).toEqual({
      inputPerMToken: 2.0,
      outputPerMToken: 6.0,
    });
  });

  it("returns pricing for command-r-plus", () => {
    const pricing = getModelPricing("command-r-plus");
    expect(pricing).toEqual({
      inputPerMToken: 2.5,
      outputPerMToken: 10.0,
    });
  });

  it("returns pricing for command-r", () => {
    const pricing = getModelPricing("command-r");
    expect(pricing).toEqual({
      inputPerMToken: 0.15,
      outputPerMToken: 0.6,
    });
  });

  // DeepSeek
  it("returns pricing for deepseek-chat", () => {
    const pricing = getModelPricing("deepseek-chat");
    expect(pricing).toEqual({
      inputPerMToken: 0.27,
      outputPerMToken: 1.10,
    });
  });

  it("returns pricing for deepseek-reasoner", () => {
    const pricing = getModelPricing("deepseek-reasoner");
    expect(pricing).toEqual({
      inputPerMToken: 0.55,
      outputPerMToken: 2.19,
    });
  });

  // Moonshot
  it("returns pricing for moonshot-v1-8k", () => {
    const pricing = getModelPricing("moonshot-v1-8k");
    expect(pricing).toEqual({
      inputPerMToken: 0.20,
      outputPerMToken: 2.00,
    });
  });

  it("returns pricing for moonshot-v1-32k", () => {
    const pricing = getModelPricing("moonshot-v1-32k");
    expect(pricing).toEqual({
      inputPerMToken: 1.00,
      outputPerMToken: 3.00,
    });
  });

  it("returns pricing for moonshot-v1-128k", () => {
    const pricing = getModelPricing("moonshot-v1-128k");
    expect(pricing).toEqual({
      inputPerMToken: 0.60,
      outputPerMToken: 2.50,
    });
  });

  // Zhipu
  it("returns pricing for glm-4.7", () => {
    const pricing = getModelPricing("glm-4.7");
    expect(pricing).toEqual({
      inputPerMToken: 0.28,
      outputPerMToken: 1.11,
    });
  });

  it("returns pricing for glm-4.7-flash (free)", () => {
    const pricing = getModelPricing("glm-4.7-flash");
    expect(pricing).toEqual({
      inputPerMToken: 0,
      outputPerMToken: 0,
    });
  });

  it("returns pricing for glm-4", () => {
    const pricing = getModelPricing("glm-4");
    expect(pricing).toEqual({
      inputPerMToken: 0.14,
      outputPerMToken: 0.42,
    });
  });

  it("returns pricing for glm-4-flash (free)", () => {
    const pricing = getModelPricing("glm-4-flash");
    expect(pricing).toEqual({
      inputPerMToken: 0,
      outputPerMToken: 0,
    });
  });

  // MiniMax
  it("returns pricing for MiniMax-M2", () => {
    const pricing = getModelPricing("MiniMax-M2");
    expect(pricing).toEqual({
      inputPerMToken: 0.30,
      outputPerMToken: 1.20,
    });
  });

  // Baichuan
  it("returns pricing for Baichuan4", () => {
    const pricing = getModelPricing("Baichuan4");
    expect(pricing).toEqual({
      inputPerMToken: 13.89,
      outputPerMToken: 13.89,
    });
  });

  // Yi
  it("returns pricing for yi-lightning", () => {
    const pricing = getModelPricing("yi-lightning");
    expect(pricing).toEqual({
      inputPerMToken: 0.14,
      outputPerMToken: 0.14,
    });
  });

  it("returns pricing for yi-large", () => {
    const pricing = getModelPricing("yi-large");
    expect(pricing).toEqual({
      inputPerMToken: 2.78,
      outputPerMToken: 2.78,
    });
  });

  it("returns null for unknown model", () => {
    expect(getModelPricing("nonexistent-model")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getModelPricing("")).toBeNull();
  });

  it("is case-insensitive (falls back to lowercase lookup)", () => {
    expect(getModelPricing("GPT-4O")).not.toBeNull();
    expect(getModelPricing("gpt-4o")).not.toBeNull();
    expect(getModelPricing("Gpt-4o")).not.toBeNull();
  });
});

describe("calculateCost", () => {
  it("calculates cost for gpt-4o with known token counts", () => {
    // gpt-4o: $2.50/1M in, $10.00/1M out
    // 1000 input tokens = 1000/1M * 2.50 = 0.0025
    // 500 output tokens = 500/1M * 10.00 = 0.005
    // total = 0.0075
    const cost = calculateCost("gpt-4o", 1000, 500);
    expect(cost).toBeCloseTo(0.0075, 10);
  });

  it("calculates cost for claude-opus-4-5-20251101", () => {
    // claude-opus-4-5-20251101: $15.00/1M in, $75.00/1M out
    // 10000 in = 10000/1M * 15.00 = 0.15
    // 5000 out = 5000/1M * 75.00 = 0.375
    // total = 0.525
    const cost = calculateCost("claude-opus-4-5-20251101", 10000, 5000);
    expect(cost).toBeCloseTo(0.525, 10);
  });

  it("calculates cost for gemini-2.0-flash (low-cost model)", () => {
    // gemini-2.0-flash: $0.10/1M in, $0.40/1M out
    // 1M in = 1.0 * 0.10 = 0.10
    // 1M out = 1.0 * 0.40 = 0.40
    // total = 0.50
    const cost = calculateCost("gemini-2.0-flash", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.5, 10);
  });

  it("returns 0 cost for zero tokens", () => {
    const cost = calculateCost("gpt-4o", 0, 0);
    expect(cost).toBe(0);
  });

  it("returns null for unknown model", () => {
    expect(calculateCost("unknown-model", 1000, 500)).toBeNull();
  });

  it("handles large token counts correctly", () => {
    // gemini-2.5-pro: $1.25/1M in, $5.00/1M out
    // 10M in = 10 * 1.25 = 12.5
    // 5M out = 5 * 5.00 = 25
    // total = 37.5
    const cost = calculateCost("gemini-2.5-pro", 10_000_000, 5_000_000);
    expect(cost).toBeCloseTo(37.5, 10);
  });

  it("handles only input tokens (zero output)", () => {
    // gpt-4o-mini: $0.15/1M in
    // 1M in = 0.15
    const cost = calculateCost("gpt-4o-mini", 1_000_000, 0);
    expect(cost).toBeCloseTo(0.15, 10);
  });

  it("handles only output tokens (zero input)", () => {
    // gpt-4o-mini: $0.60/1M out
    // 1M out = 0.60
    const cost = calculateCost("gpt-4o-mini", 0, 1_000_000);
    expect(cost).toBeCloseTo(0.6, 10);
  });

  it("calculates cost for mistral-small-latest", () => {
    // $0.20/1M in, $0.60/1M out
    // 500000 in = 0.5 * 0.20 = 0.10
    // 200000 out = 0.2 * 0.60 = 0.12
    // total = 0.22
    const cost = calculateCost("mistral-small-latest", 500_000, 200_000);
    expect(cost).toBeCloseTo(0.22, 10);
  });

  it("calculates cost for command-r-plus", () => {
    // $2.50/1M in, $10.00/1M out
    // 100 in = 0.0001 * 2.50 = 0.00025
    // 50 out = 0.00005 * 10.00 = 0.0005
    // total = 0.00075
    const cost = calculateCost("command-r-plus", 100, 50);
    expect(cost).toBeCloseTo(0.00075, 10);
  });
});

describe("listSupportedModels", () => {
  it("returns a non-empty array", () => {
    const models = listSupportedModels();
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
  });

  it("includes known OpenAI models", () => {
    const models = listSupportedModels();
    expect(models).toContain("gpt-4o");
    expect(models).toContain("gpt-4o-mini");
    expect(models).toContain("gpt-4-turbo");
    expect(models).toContain("o1");
    expect(models).toContain("o1-mini");
    expect(models).toContain("o3-mini");
  });

  it("includes known Anthropic models", () => {
    const models = listSupportedModels();
    expect(models).toContain("claude-opus-4-5-20251101");
    expect(models).toContain("claude-sonnet-4-5-20250929");
    expect(models).toContain("claude-sonnet-4-20250514");
    expect(models).toContain("claude-haiku-4-5-20251001");
  });

  it("includes known Google models", () => {
    const models = listSupportedModels();
    expect(models).toContain("gemini-2.5-pro");
    expect(models).toContain("gemini-2.5-flash");
    expect(models).toContain("gemini-2.0-flash");
    expect(models).toContain("gemini-2.0-flash-lite");
  });

  it("includes known Mistral models", () => {
    const models = listSupportedModels();
    expect(models).toContain("mistral-large-latest");
    expect(models).toContain("mistral-small-latest");
    expect(models).toContain("codestral-latest");
  });

  it("includes known Cohere models", () => {
    const models = listSupportedModels();
    expect(models).toContain("command-r-plus");
    expect(models).toContain("command-r");
  });

  it("includes known DeepSeek models", () => {
    const models = listSupportedModels();
    expect(models).toContain("deepseek-chat");
    expect(models).toContain("deepseek-reasoner");
  });

  it("includes known Moonshot models", () => {
    const models = listSupportedModels();
    expect(models).toContain("moonshot-v1-8k");
    expect(models).toContain("moonshot-v1-32k");
    expect(models).toContain("moonshot-v1-128k");
  });

  it("includes known Zhipu models", () => {
    const models = listSupportedModels();
    expect(models).toContain("glm-4.7");
    expect(models).toContain("glm-4.7-flash");
    expect(models).toContain("glm-4");
    expect(models).toContain("glm-4-air");
    expect(models).toContain("glm-4-flash");
  });

  it("includes known MiniMax models", () => {
    const models = listSupportedModels();
    expect(models).toContain("MiniMax-M2");
    expect(models).toContain("MiniMax-01");
  });

  it("includes known Baichuan models", () => {
    const models = listSupportedModels();
    expect(models).toContain("Baichuan4");
    expect(models).toContain("Baichuan3-Turbo");
  });

  it("includes known Yi models", () => {
    const models = listSupportedModels();
    expect(models).toContain("yi-lightning");
    expect(models).toContain("yi-large");
    expect(models).toContain("yi-medium");
  });

  it("returns strings only", () => {
    const models = listSupportedModels();
    models.forEach((model) => {
      expect(typeof model).toBe("string");
    });
  });

  it("every listed model has valid pricing data", () => {
    const models = listSupportedModels();
    models.forEach((model) => {
      const pricing = getModelPricing(model);
      expect(pricing).not.toBeNull();
      expect(pricing!.inputPerMToken).toBeGreaterThanOrEqual(0);
      expect(pricing!.outputPerMToken).toBeGreaterThanOrEqual(0);
    });
  });
});
