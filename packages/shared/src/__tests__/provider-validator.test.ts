import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateProviderKey, testProviderModel } from "../provider-validator.js";

describe("validateProviderKey", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("OpenAI validation", () => {
    it("returns valid with models list on success", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          data: [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }],
        }),
      });

      const result = await validateProviderKey("openai", "sk-test-key");

      expect(result.valid).toBe(true);
      expect(result.models).toContain("gpt-4o");
      expect(result.models).toContain("gpt-4o-mini");
    });

    it("returns invalid for 401 status", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const result = await validateProviderKey("openai", "invalid-key");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid API key");
    });

    it("returns invalid on network error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await validateProviderKey("openai", "sk-test-key");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Network error");
    });
  });

  describe("Anthropic validation", () => {
    it("returns valid on successful response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "msg_123" }),
      });

      const result = await validateProviderKey("anthropic", "sk-ant-test");

      expect(result.valid).toBe(true);
    });

    it("returns valid on rate limit (429)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      const result = await validateProviderKey("anthropic", "sk-ant-test");

      expect(result.valid).toBe(true);
    });

    it("returns invalid for 401 status", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const result = await validateProviderKey("anthropic", "invalid-key");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid API key");
    });
  });

  describe("Google validation", () => {
    it("returns valid with models list on success", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          models: [{ name: "models/gemini-pro" }, { name: "models/gemini-flash" }],
        }),
      });

      const result = await validateProviderKey("google", "test-key");

      expect(result.valid).toBe(true);
      expect(result.models).toContain("gemini-pro");
    });

    it("returns invalid for 401/403 status", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      const result = await validateProviderKey("google", "invalid-key");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid API key");
    });
  });

  describe("Mistral validation", () => {
    it("returns valid with models list on success", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          data: [{ id: "mistral-large" }, { id: "mistral-small" }],
        }),
      });

      const result = await validateProviderKey("mistral", "test-key");

      expect(result.valid).toBe(true);
      expect(result.models).toContain("mistral-large");
    });
  });

  describe("DeepSeek validation", () => {
    it("returns valid with models list on success", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          data: [{ id: "deepseek-chat" }, { id: "deepseek-coder" }],
        }),
      });

      const result = await validateProviderKey("deepseek", "test-key");

      expect(result.valid).toBe(true);
      expect(result.models).toContain("deepseek-chat");
    });
  });

  describe("unsupported provider", () => {
    it("returns error for unknown provider", async () => {
      const result = await validateProviderKey("unknown" as any, "test-key");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("not supported");
    });
  });
});

describe("testProviderModel", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns exists true when model is in list", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        data: [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }],
      }),
    });

    const result = await testProviderModel("openai", "sk-test", "gpt-4o");

    expect(result.exists).toBe(true);
  });

  it("returns exists false when model not in list", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        data: [{ id: "gpt-4o" }],
      }),
    });

    const result = await testProviderModel("openai", "sk-test", "nonexistent-model");

    expect(result.exists).toBe(false);
  });

  it("returns error when API key is invalid", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    const result = await testProviderModel("openai", "invalid-key", "gpt-4o");

    expect(result.exists).toBe(false);
    expect(result.error).toBeDefined();
  });
});
