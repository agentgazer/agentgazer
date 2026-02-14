/**
 * HTTP client for AgentGazer API
 */

export interface AgentGazerClientConfig {
  endpoint: string;
  token: string;
  agentId: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CostData {
  totalCost: number;
  currency: string;
  breakdown?: Array<{
    model: string;
    cost: number;
  }>;
}

export interface BudgetStatus {
  hasLimit: boolean;
  limit?: number;
  used: number;
  remaining?: number;
  percentageUsed?: number;
}

export interface AgentInfo {
  agentId: string;
  endpoint: string;
  connected: boolean;
  serverVersion?: string;
}

export interface EstimateCostParams {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface EstimateCostResult {
  estimatedCost: number;
  currency: string;
  model: string;
}

export class AgentGazerClient {
  private config: AgentGazerClientConfig;

  constructor(config: AgentGazerClientConfig) {
    this.config = config;
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.config.endpoint}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": this.config.token,
    };

    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options?.headers },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Check connectivity to AgentGazer server
   */
  async healthCheck(): Promise<{ ok: boolean; version?: string }> {
    try {
      const result = await this.fetch<{ status: string; version?: string }>("/api/health");
      return { ok: result.status === "ok", version: result.version };
    } catch {
      return { ok: false };
    }
  }

  /**
   * Get token usage for the current agent
   */
  async getTokenUsage(params?: {
    period?: string;
    model?: string;
  }): Promise<TokenUsage> {
    const query = new URLSearchParams();
    query.set("agentId", this.config.agentId);
    if (params?.period) query.set("period", params.period);
    if (params?.model) query.set("model", params.model);

    const result = await this.fetch<{
      inputTokens: number;
      outputTokens: number;
    }>(`/api/stats/tokens?${query}`);

    return {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      totalTokens: result.inputTokens + result.outputTokens,
    };
  }

  /**
   * Get cost for the current agent
   */
  async getCost(params?: {
    period?: string;
    breakdown?: boolean;
  }): Promise<CostData> {
    const query = new URLSearchParams();
    query.set("agentId", this.config.agentId);
    if (params?.period) query.set("period", params.period);
    if (params?.breakdown) query.set("breakdown", "true");

    return this.fetch<CostData>(`/api/stats/cost?${query}`);
  }

  /**
   * Get budget status for the current agent
   */
  async getBudgetStatus(): Promise<BudgetStatus> {
    const query = new URLSearchParams();
    query.set("agentId", this.config.agentId);

    return this.fetch<BudgetStatus>(`/api/stats/budget?${query}`);
  }

  /**
   * Estimate cost for a given operation
   */
  async estimateCost(params: EstimateCostParams): Promise<EstimateCostResult> {
    return this.fetch<EstimateCostResult>("/api/stats/estimate", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * Get agent identity info
   */
  async whoami(): Promise<AgentInfo> {
    const health = await this.healthCheck();
    return {
      agentId: this.config.agentId,
      endpoint: this.config.endpoint,
      connected: health.ok,
      serverVersion: health.version,
    };
  }
}
