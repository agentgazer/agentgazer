const TOKEN_KEY = "agentgazer_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(path, { ...options, headers: { ...headers, ...options?.headers } });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as Record<string, string>).error || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: (path: string) => apiFetch<void>(path, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Provider API Types
// ---------------------------------------------------------------------------

export interface ProviderInfo {
  name: string;
  configured: boolean;
  active: boolean;
  rate_limit: { max_requests: number; window_seconds: number } | null;
}

export interface ProviderModel {
  id: string;
  displayName?: string;
  custom: boolean;
  verified: boolean;
  verifiedAt?: string;
}

export interface ProviderSettings {
  provider: string;
  active: boolean;
  rate_limit: { max_requests: number; window_seconds: number } | null;
}

export interface ProviderStats {
  provider: string;
  total_requests: number;
  total_tokens: number;
  total_cost: number;
  by_model: { model: string; requests: number; tokens: number; cost: number }[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  models?: string[];
}

export interface ConnectionInfo {
  isLoopback: boolean;
}

// ---------------------------------------------------------------------------
// Provider API Functions
// ---------------------------------------------------------------------------

export const providerApi = {
  getConnectionInfo: () => api.get<ConnectionInfo>("/api/connection-info"),

  list: () => api.get<{ providers: ProviderInfo[] }>("/api/providers"),

  add: (name: string, apiKey: string) =>
    api.post<{ success: boolean; validated: boolean; error?: string; models?: string[] }>(
      "/api/providers",
      { name, apiKey }
    ),

  remove: (name: string) => api.del(`/api/providers/${name}`),

  validate: (name: string, apiKey?: string) =>
    api.post<ValidationResult>(`/api/providers/${name}/validate`, apiKey ? { apiKey } : {}),

  getSettings: (name: string) => api.get<ProviderSettings>(`/api/providers/${name}/settings`),

  updateSettings: (
    name: string,
    settings: { active?: boolean; rate_limit?: { max_requests: number; window_seconds: number } | null }
  ) => api.patch<ProviderSettings>(`/api/providers/${name}/settings`, settings),

  getModels: (name: string) =>
    api.get<{ provider: string; models: ProviderModel[] }>(`/api/providers/${name}/models`),

  addModel: (name: string, modelId: string, displayName?: string) =>
    api.post<ProviderModel>(`/api/providers/${name}/models`, { modelId, displayName }),

  removeModel: (name: string, modelId: string) =>
    api.del(`/api/providers/${name}/models/${encodeURIComponent(modelId)}`),

  testModel: (name: string, modelId: string) =>
    api.post<{ exists: boolean; error?: string }>(
      `/api/providers/${name}/models/${encodeURIComponent(modelId)}/test`,
      {}
    ),

  getStats: (name: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    return api.get<ProviderStats>(`/api/providers/${name}/stats${query ? `?${query}` : ""}`);
  },
};
