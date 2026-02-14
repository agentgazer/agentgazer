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

// ---------------------------------------------------------------------------
// Health API
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: string;
  version: string;
  uptime_ms: number;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  return res.json() as Promise<HealthResponse>;
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

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
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
  delete: (path: string) => apiFetch<void>(path, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Provider API Types
// ---------------------------------------------------------------------------

export interface ProviderInfo {
  name: string;
  configured: boolean;
  active: boolean;
  authType?: "oauth" | "apikey";
  rate_limit: { max_requests: number; window_seconds: number } | null;
  // Stats fields
  agent_count: number;
  total_tokens: number;
  total_cost: number;
  today_cost: number;
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

  toggle: (name: string, active: boolean) =>
    api.put<ProviderSettings>(`/api/providers/${name}`, { active }),

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

// ---------------------------------------------------------------------------
// Overview API Types
// ---------------------------------------------------------------------------

export interface TopAgent {
  agent_id: string;
  cost: number;
  percentage: number;
}

export interface TopModel {
  model: string;
  tokens: number;
  percentage: number;
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface OverviewData {
  active_agents: number;
  today_cost: number;
  today_requests: number;
  error_rate: number;
  yesterday_cost: number;
  yesterday_requests: number;
  yesterday_error_rate: number;
  top_agents: TopAgent[];
  top_models: TopModel[];
  cost_trend: TrendPoint[];
  requests_trend: TrendPoint[];
}

export interface RecentEvent {
  type: "kill_switch" | "budget_warning" | "high_error_rate" | "new_agent" | "security";
  agent_id: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Overview API Functions
// ---------------------------------------------------------------------------

export const overviewApi = {
  getData: () => api.get<OverviewData>("/api/overview"),
  getRecentEvents: (limit = 10) =>
    api.get<{ events: RecentEvent[] }>(`/api/events/recent?limit=${limit}`),
};

// ---------------------------------------------------------------------------
// OpenClaw API Types
// ---------------------------------------------------------------------------

export interface OpenclawConfigResponse {
  exists: boolean;
  models: OpenclawModels | null;
  agents: OpenclawAgents | null;
  parseError?: boolean;
  raw?: string;
}

export interface OpenclawAgents {
  defaults?: {
    model?: {
      primary?: string;
    };
  };
}

export interface OpenclawModels {
  mode?: string;
  providers?: Record<string, OpenclawProvider>;
  [key: string]: unknown;
}

export interface OpenclawProvider {
  baseUrl?: string;
  apiKey?: string;
  api?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// OpenClaw API Functions
// ---------------------------------------------------------------------------

export const openclawApi = {
  getConfig: () => api.get<OpenclawConfigResponse>("/api/openclaw/config"),

  updateConfig: (models: OpenclawModels, primaryModel?: string) =>
    api.put<{ success: boolean }>("/api/openclaw/config", {
      models,
      ...(primaryModel && {
        agents: {
          defaults: {
            model: { primary: primaryModel },
          },
        },
      }),
    }),
};

// ---------------------------------------------------------------------------
// Events/Logs API Types
// ---------------------------------------------------------------------------

export interface EventRow {
  id: string;
  agent_id: string;
  event_type: string;
  provider: string | null;
  model: string | null;
  requested_model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  tokens_total: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  source: string;
  timestamp: string;
  trace_id: string | null;
  span_id: string | null;
  parent_span_id: string | null;
  tags: Record<string, unknown> | null;
}

export interface EventsResponse {
  events: EventRow[];
  total: number;
  offset: number;
  limit: number;
}

export interface EventsQueryParams {
  agent_id?: string;
  event_type?: string;
  provider?: string;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Events/Logs API Functions
// ---------------------------------------------------------------------------

export const eventsApi = {
  query: (params: EventsQueryParams = {}) => {
    const urlParams = new URLSearchParams();
    if (params.agent_id) urlParams.set("agent_id", params.agent_id);
    if (params.event_type) urlParams.set("event_type", params.event_type);
    if (params.provider) urlParams.set("provider", params.provider);
    if (params.from) urlParams.set("from", params.from);
    if (params.to) urlParams.set("to", params.to);
    if (params.search) urlParams.set("search", params.search);
    if (params.limit) urlParams.set("limit", String(params.limit));
    if (params.offset) urlParams.set("offset", String(params.offset));
    const query = urlParams.toString();
    return api.get<EventsResponse>(`/api/events${query ? `?${query}` : ""}`);
  },

  exportCsv: (params: EventsQueryParams = {}) => {
    const urlParams = new URLSearchParams();
    urlParams.set("format", "csv");
    if (params.agent_id) urlParams.set("agent_id", params.agent_id);
    if (params.event_type) urlParams.set("event_type", params.event_type);
    if (params.provider) urlParams.set("provider", params.provider);
    if (params.from) urlParams.set("from", params.from);
    if (params.to) urlParams.set("to", params.to);
    return `/api/events/export?${urlParams.toString()}`;
  },
};

// ---------------------------------------------------------------------------
// OAuth API Types
// ---------------------------------------------------------------------------

export interface OAuthStatus {
  loggedIn: boolean;
  expiresAt?: number;
  expired?: boolean;
  error?: string;
}

export interface OAuthStartResponse {
  sessionId: string;
  authUrl?: string;
  // MiniMax device code flow
  userCode?: string;
  verificationUri?: string;
}

// ---------------------------------------------------------------------------
// OAuth API Functions
// ---------------------------------------------------------------------------

export const oauthApi = {
  getStatus: (provider: string) =>
    api.get<OAuthStatus>(`/api/oauth/${provider}/status`),

  start: (provider: string) =>
    api.post<OAuthStartResponse>(`/api/oauth/${provider}/start`, {}),

  logout: (provider: string) =>
    api.post<{ success: boolean }>(`/api/oauth/${provider}/logout`, {}),
};
