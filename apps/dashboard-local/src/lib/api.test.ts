import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getToken, setToken, clearToken, api, fetchHealth } from "./api";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("Token management", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("getToken returns null when no token is stored", () => {
    expect(getToken()).toBeNull();
  });

  it("setToken stores token in localStorage", () => {
    setToken("test-token-123");
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "agentgazer_token",
      "test-token-123"
    );
  });

  it("clearToken removes token from localStorage", () => {
    clearToken();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("agentgazer_token");
  });
});

describe("fetchHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches health endpoint and returns JSON", async () => {
    const healthData = { status: "ok", version: "0.6.0", uptime_ms: 12345 };
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(healthData),
    });

    const result = await fetchHealth();
    expect(mockFetch).toHaveBeenCalledWith("/api/health");
    expect(result).toEqual(healthData);
  });
});

describe("api client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("api.get sends GET request with authorization header when token is set", async () => {
    localStorageMock.getItem.mockReturnValue("my-token");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: "test" }),
    });

    const result = await api.get<{ data: string }>("/api/test");
    expect(result).toEqual({ data: "test" });

    expect(mockFetch).toHaveBeenCalledWith("/api/test", {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer my-token",
      },
    });
  });

  it("api.post sends POST request with body", async () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await api.post("/api/test", { key: "value" });

    expect(mockFetch).toHaveBeenCalledWith("/api/test", {
      method: "POST",
      body: JSON.stringify({ key: "value" }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("api.del sends DELETE request", async () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    await api.del("/api/test/1");

    expect(mockFetch).toHaveBeenCalledWith("/api/test/1", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("throws error on non-ok response", async () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal server error" }),
    });

    await expect(api.get("/api/fail")).rejects.toThrow("Internal server error");
  });

  it("redirects to /login on 401 response", async () => {
    localStorageMock.getItem.mockReturnValue("expired-token");

    // Mock window.location
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "/" },
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    await expect(api.get("/api/protected")).rejects.toThrow("Unauthorized");
    expect(window.location.href).toBe("/login");
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("agentgazer_token");

    // Restore
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });
});
