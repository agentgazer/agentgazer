import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiGet, apiPost, apiPut, apiDelete, handleApiError } from "../utils/api.js";

// Mock the config module
vi.mock("../config.js", () => ({
  readConfig: () => ({ token: "test-token" }),
}));

describe("API utilities", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("apiGet", () => {
    it("makes GET request with auth header", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: "test" }),
      });

      const result = await apiGet<{ data: string }>("/api/test");

      expect(result.data).toBe("test");
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:18880/api/test",
        expect.objectContaining({
          headers: { Authorization: "Bearer test-token" },
        }),
      );
    });

    it("uses custom port", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiGet("/api/test", 9000);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:9000/api/test",
        expect.any(Object),
      );
    });

    it("throws error on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(apiGet("/api/test")).rejects.toEqual({
        status: 404,
        message: "Not Found",
      });
    });
  });

  describe("apiPost", () => {
    it("makes POST request with body", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await apiPost<{ success: boolean }>("/api/test", { key: "value" });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:18880/api/test",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer test-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ key: "value" }),
        }),
      );
    });
  });

  describe("apiPut", () => {
    it("makes PUT request with body", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ updated: true }),
      });

      const result = await apiPut<{ updated: boolean }>("/api/test", { key: "value" });

      expect(result.updated).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "PUT",
        }),
      );
    });
  });

  describe("apiDelete", () => {
    it("makes DELETE request", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ deleted: true }),
      });

      const result = await apiDelete<{ deleted: boolean }>("/api/test");

      expect(result.deleted).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });
  });

  describe("handleApiError", () => {
    it("logs error message and exits", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      expect(() => {
        handleApiError({ status: 500, message: "Server error" });
      }).toThrow("process.exit called");

      expect(consoleErrorSpy).toHaveBeenCalledWith("Server error");
      expect(exitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it("logs generic message for unknown error shape", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      expect(() => {
        handleApiError("unexpected");
      }).toThrow("process.exit called");

      expect(consoleErrorSpy).toHaveBeenCalledWith("An unexpected error occurred.");

      consoleErrorSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });
});
