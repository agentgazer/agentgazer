import { describe, it, expect } from "vitest";
import { parseProviderResponse } from "../parsers.js";

describe("parseProviderResponse", () => {
  describe("OpenAI format", () => {
    it("parses a successful OpenAI response with usage", () => {
      const body = {
        model: "gpt-4o",
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };
      const result = parseProviderResponse("openai", body, 200);
      expect(result).toEqual({
        model: "gpt-4o",
        tokensIn: 100,
        tokensOut: 50,
        tokensTotal: 150,
        statusCode: 200,
        errorMessage: null,
        cachedInputTokens: null,
      });
    });

    it("parses an OpenAI response without usage field", () => {
      const body = { model: "gpt-4o" };
      const result = parseProviderResponse("openai", body, 200);
      expect(result).toEqual({
        model: "gpt-4o",
        tokensIn: null,
        tokensOut: null,
        tokensTotal: null,
        statusCode: 200,
        errorMessage: null,
        cachedInputTokens: null,
      });
    });

    it("parses an OpenAI error response", () => {
      const body = {
        error: { message: "Rate limit exceeded" },
      };
      const result = parseProviderResponse("openai", body, 429);
      expect(result).toEqual({
        model: null,
        tokensIn: null,
        tokensOut: null,
        tokensTotal: null,
        statusCode: 429,
        errorMessage: "Rate limit exceeded",
      });
    });

    it("handles OpenAI error without message (falls back to HTTP status)", () => {
      const result = parseProviderResponse("openai", {}, 500);
      expect(result).toEqual({
        model: null,
        tokensIn: null,
        tokensOut: null,
        tokensTotal: null,
        statusCode: 500,
        errorMessage: "HTTP 500",
      });
    });

    it("parses OpenAI response with partial usage data", () => {
      const body = {
        model: "gpt-3.5-turbo",
        usage: {
          prompt_tokens: 200,
        },
      };
      const result = parseProviderResponse("openai", body, 200);
      expect(result).toEqual({
        model: "gpt-3.5-turbo",
        tokensIn: 200,
        tokensOut: null,
        tokensTotal: null,
        statusCode: 200,
        errorMessage: null,
        cachedInputTokens: null,
      });
    });

    it("parses OpenAI response with empty body", () => {
      const result = parseProviderResponse("openai", {}, 200);
      expect(result).toEqual({
        model: null,
        tokensIn: null,
        tokensOut: null,
        tokensTotal: null,
        statusCode: 200,
        errorMessage: null,
        cachedInputTokens: null,
      });
    });
  });

  describe("Anthropic format", () => {
    it("parses a successful Anthropic response", () => {
      const body = {
        model: "claude-opus-4-20250514",
        usage: {
          input_tokens: 250,
          output_tokens: 150,
        },
      };
      const result = parseProviderResponse("anthropic", body, 200);
      expect(result).toEqual({
        model: "claude-opus-4-20250514",
        tokensIn: 250,
        tokensOut: 150,
        tokensTotal: 400,
        statusCode: 200,
        errorMessage: null,
        cacheCreationTokens: null,
        cacheReadTokens: null,
      });
    });

    it("computes tokensTotal from input and output tokens", () => {
      const body = {
        model: "claude-3-5-haiku-20241022",
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
        },
      };
      const result = parseProviderResponse("anthropic", body, 200);
      expect(result!.tokensTotal).toBe(1500);
    });

    it("calculates tokensTotal even when input_tokens is missing (defaults to 0)", () => {
      const body = {
        model: "claude-sonnet-4-20250514",
        usage: {
          output_tokens: 150,
        },
      };
      const result = parseProviderResponse("anthropic", body, 200);
      expect(result!.tokensIn).toBeNull();
      expect(result!.tokensTotal).toBe(150); // 0 (default) + 150 output
    });

    it("returns null tokensTotal when output_tokens is missing", () => {
      const body = {
        model: "claude-sonnet-4-20250514",
        usage: {
          input_tokens: 250,
        },
      };
      const result = parseProviderResponse("anthropic", body, 200);
      expect(result!.tokensOut).toBeNull();
      expect(result!.tokensTotal).toBeNull();
    });

    it("parses an Anthropic error response", () => {
      const body = {
        error: { message: "Invalid API key" },
      };
      const result = parseProviderResponse("anthropic", body, 401);
      expect(result).toEqual({
        model: null,
        tokensIn: null,
        tokensOut: null,
        tokensTotal: null,
        statusCode: 401,
        errorMessage: "Invalid API key",
      });
    });

    it("handles Anthropic 400 error with no error field (falls back to HTTP status)", () => {
      const result = parseProviderResponse("anthropic", {}, 400);
      expect(result!.statusCode).toBe(400);
      expect(result!.errorMessage).toBe("HTTP 400");
    });
  });

  describe("Google format", () => {
    it("parses a successful Google response", () => {
      const body = {
        modelVersion: "gemini-2.0-flash",
        usageMetadata: {
          promptTokenCount: 300,
          candidatesTokenCount: 200,
          totalTokenCount: 500,
        },
      };
      const result = parseProviderResponse("google", body, 200);
      expect(result).toEqual({
        model: "gemini-2.0-flash",
        tokensIn: 300,
        tokensOut: 200,
        tokensTotal: 500,
        statusCode: 200,
        errorMessage: null,
      });
    });

    it("parses a Google response without usageMetadata", () => {
      const body = { modelVersion: "gemini-1.5-pro" };
      const result = parseProviderResponse("google", body, 200);
      expect(result).toEqual({
        model: "gemini-1.5-pro",
        tokensIn: null,
        tokensOut: null,
        tokensTotal: null,
        statusCode: 200,
        errorMessage: null,
      });
    });

    it("parses a Google error response", () => {
      const body = {
        error: { message: "API key not valid" },
      };
      const result = parseProviderResponse("google", body, 403);
      expect(result).toEqual({
        model: null,
        tokensIn: null,
        tokensOut: null,
        tokensTotal: null,
        statusCode: 403,
        errorMessage: "API key not valid",
      });
    });

    it("handles Google response with partial usageMetadata", () => {
      const body = {
        modelVersion: "gemini-1.5-flash",
        usageMetadata: {
          promptTokenCount: 100,
        },
      };
      const result = parseProviderResponse("google", body, 200);
      expect(result!.tokensIn).toBe(100);
      expect(result!.tokensOut).toBeNull();
      expect(result!.tokensTotal).toBeNull();
    });
  });

  describe("Mistral format (OpenAI-compatible)", () => {
    it("parses a successful Mistral response using OpenAI format", () => {
      const body = {
        model: "mistral-large-latest",
        usage: {
          prompt_tokens: 400,
          completion_tokens: 300,
          total_tokens: 700,
        },
      };
      const result = parseProviderResponse("mistral", body, 200);
      expect(result).toEqual({
        model: "mistral-large-latest",
        tokensIn: 400,
        tokensOut: 300,
        tokensTotal: 700,
        statusCode: 200,
        errorMessage: null,
        cachedInputTokens: null,
      });
    });

    it("parses a Mistral error response", () => {
      const body = {
        error: { message: "Model not found" },
      };
      const result = parseProviderResponse("mistral", body, 404);
      expect(result).toEqual({
        model: null,
        tokensIn: null,
        tokensOut: null,
        tokensTotal: null,
        statusCode: 404,
        errorMessage: "Model not found",
      });
    });
  });

  describe("unknown provider", () => {
    it("falls back to OpenAI format for unknown provider", () => {
      // Unknown providers should try OpenAI-compatible format as fallback
      const result = parseProviderResponse("unknown", {
        model: "custom-model",
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }, 200);
      expect(result).not.toBeNull();
      expect(result?.model).toBe("custom-model");
      expect(result?.tokensIn).toBe(10);
      expect(result?.tokensOut).toBe(20);
    });
  });

  describe("edge cases", () => {
    it("throws when null body is passed for a success response (no null guard)", () => {
      // The implementation casts body and accesses .model without null checks
      expect(() => parseProviderResponse("openai", null, 200)).toThrow();
    });

    it("throws when undefined body is passed for a success response (no null guard)", () => {
      // The implementation casts body and accesses .usage without null checks
      expect(() =>
        parseProviderResponse("anthropic", undefined, 200)
      ).toThrow();
    });

    it("handles null body for error responses (error path accesses optional chain)", () => {
      // On the error path, body is cast and accessed with ?. so null is safer
      // But makeErrorResult still works because the ?? fallback catches undefined message
      const result = parseProviderResponse("openai", null, 500);
      expect(result!.statusCode).toBe(500);
      expect(result!.errorMessage).toBe("HTTP 500");
    });

    it("treats status 400 as error boundary", () => {
      const result = parseProviderResponse("openai", {}, 400);
      expect(result!.errorMessage).toBeDefined();
    });

    it("treats status 399 as success", () => {
      const body = { model: "gpt-4o" };
      const result = parseProviderResponse("openai", body, 399);
      expect(result!.errorMessage).toBeNull();
      expect(result!.model).toBe("gpt-4o");
    });

    it("treats status 200 with empty object as success with nulls", () => {
      const result = parseProviderResponse("openai", {}, 200);
      expect(result!.model).toBeNull();
      expect(result!.tokensIn).toBeNull();
      expect(result!.tokensOut).toBeNull();
      expect(result!.tokensTotal).toBeNull();
      expect(result!.errorMessage).toBeNull();
    });

    it("treats status 201 as success", () => {
      const body = { model: "gpt-4o" };
      const result = parseProviderResponse("openai", body, 201);
      expect(result!.errorMessage).toBeNull();
      expect(result!.model).toBe("gpt-4o");
    });
  });
});
