import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  parseModelsDevResponse,
  getSyncedPricing,
  getAllSyncedPrices,
  getSyncStatus,
  clearSyncedPrices,
  type ModelsDevResponse,
} from "../price-sync.js";

describe("parseModelsDevResponse", () => {
  it("parses openai models correctly", () => {
    const mockResponse: ModelsDevResponse = {
      openai: {
        models: {
          "gpt-4o": {
            id: "gpt-4o",
            cost: { input: 2.5, output: 10.0 },
          },
          "gpt-4o-mini": {
            id: "gpt-4o-mini",
            cost: { input: 0.15, output: 0.6 },
          },
        },
      },
    };

    const result = parseModelsDevResponse(mockResponse);

    expect(result["gpt-4o"]).toEqual({
      inputPerMToken: 2.5,
      outputPerMToken: 10.0,
    });
    expect(result["gpt-4o-mini"]).toEqual({
      inputPerMToken: 0.15,
      outputPerMToken: 0.6,
    });
  });

  it("parses anthropic models correctly", () => {
    const mockResponse: ModelsDevResponse = {
      anthropic: {
        models: {
          "claude-3-opus": {
            id: "claude-3-opus",
            cost: { input: 15.0, output: 75.0 },
          },
        },
      },
    };

    const result = parseModelsDevResponse(mockResponse);

    expect(result["claude-3-opus"]).toEqual({
      inputPerMToken: 15.0,
      outputPerMToken: 75.0,
    });
  });

  it("handles models without cost data", () => {
    const mockResponse: ModelsDevResponse = {
      openai: {
        models: {
          "gpt-4o": {
            id: "gpt-4o",
            // no cost field
          },
        },
      },
    };

    const result = parseModelsDevResponse(mockResponse);
    expect(result["gpt-4o"]).toBeUndefined();
  });

  it("normalizes model IDs to lowercase", () => {
    const mockResponse: ModelsDevResponse = {
      openai: {
        models: {
          "GPT-4O": {
            id: "GPT-4O",
            cost: { input: 2.5, output: 10.0 },
          },
        },
      },
    };

    const result = parseModelsDevResponse(mockResponse);
    expect(result["gpt-4o"]).toBeDefined();
    expect(result["GPT-4O"]).toBeUndefined();
  });

  it("handles multiple providers", () => {
    const mockResponse: ModelsDevResponse = {
      openai: {
        models: {
          "gpt-4o": {
            id: "gpt-4o",
            cost: { input: 2.5, output: 10.0 },
          },
        },
      },
      anthropic: {
        models: {
          "claude-3-sonnet": {
            id: "claude-3-sonnet",
            cost: { input: 3.0, output: 15.0 },
          },
        },
      },
      google: {
        models: {
          "gemini-pro": {
            id: "gemini-pro",
            cost: { input: 0.5, output: 1.5 },
          },
        },
      },
    };

    const result = parseModelsDevResponse(mockResponse);

    expect(Object.keys(result)).toHaveLength(3);
    expect(result["gpt-4o"]).toBeDefined();
    expect(result["claude-3-sonnet"]).toBeDefined();
    expect(result["gemini-pro"]).toBeDefined();
  });

  it("ignores unsupported providers", () => {
    const mockResponse: ModelsDevResponse = {
      "unknown-provider": {
        models: {
          "some-model": {
            id: "some-model",
            cost: { input: 1.0, output: 2.0 },
          },
        },
      },
    };

    const result = parseModelsDevResponse(mockResponse);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("handles free models (0 cost)", () => {
    const mockResponse: ModelsDevResponse = {
      zhipuai: {
        models: {
          "glm-4-flash": {
            id: "glm-4-flash",
            cost: { input: 0, output: 0 },
          },
        },
      },
    };

    const result = parseModelsDevResponse(mockResponse);
    expect(result["glm-4-flash"]).toEqual({
      inputPerMToken: 0,
      outputPerMToken: 0,
    });
  });
});

describe("getSyncStatus", () => {
  beforeEach(() => {
    clearSyncedPrices();
  });

  it("returns empty status initially", () => {
    const status = getSyncStatus();
    expect(status.lastSyncTime).toBeNull();
    expect(status.lastSyncError).toBeNull();
    expect(status.modelCount).toBe(0);
  });
});

describe("getSyncedPricing", () => {
  beforeEach(() => {
    clearSyncedPrices();
  });

  it("returns null for unknown model", () => {
    expect(getSyncedPricing("unknown-model")).toBeNull();
  });
});
