export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * Sliding-window rate limiter with per-agent per-provider tracking.
 * Keeps a list of request timestamps per (agent, provider) key and evicts
 * entries older than the configured window.
 */
export class RateLimiter {
  // Key format: "agentId:provider"
  private windows: Map<string, number[]> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();

  constructor(configs?: Record<string, RateLimitConfig>) {
    if (configs) {
      for (const [key, config] of Object.entries(configs)) {
        this.configs.set(key, config);
      }
    }
  }

  /**
   * Update rate limit configurations. Replaces all existing configs.
   * Key format: "agentId:provider"
   */
  updateConfigs(configs: Record<string, RateLimitConfig>): void {
    this.configs.clear();
    for (const [key, config] of Object.entries(configs)) {
      this.configs.set(key, config);
    }
  }

  /**
   * Check if a request for the given agent and provider is allowed.
   * If allowed, records the request timestamp.
   * If denied, returns the number of seconds until a slot opens.
   */
  check(agentId: string, provider: string): RateLimitResult {
    const key = `${agentId}:${provider}`;
    const config = this.configs.get(key);
    if (!config) {
      // No rate limit configured for this agent+provider — allow
      return { allowed: true };
    }

    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const cutoff = now - windowMs;

    let timestamps = this.windows.get(key);
    if (!timestamps) {
      timestamps = [];
      this.windows.set(key, timestamps);
    }

    // Evict expired entries
    while (timestamps.length > 0 && timestamps[0] <= cutoff) {
      timestamps.shift();
    }

    if (timestamps.length >= config.maxRequests) {
      // Oldest entry in the window determines when a slot opens
      const oldestInWindow = timestamps[0];
      const retryAfterMs = oldestInWindow + windowMs - now;
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
      return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
    }

    timestamps.push(now);
    return { allowed: true };
  }

  /**
   * Check whether a rate limit is configured for the given agent and provider.
   */
  hasConfig(agentId: string, provider: string): boolean {
    return this.configs.has(`${agentId}:${provider}`);
  }

  /**
   * Check and record a request with explicit rate limit config.
   * Used for provider-level rate limiting where config comes from database.
   */
  checkAndRecord(
    keyPart1: string,
    keyPart2: string,
    maxRequests: number,
    windowSeconds: number,
  ): boolean {
    const key = `${keyPart1}:${keyPart2}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const cutoff = now - windowMs;

    let timestamps = this.windows.get(key);
    if (!timestamps) {
      timestamps = [];
      this.windows.set(key, timestamps);
    }

    // Evict expired entries
    while (timestamps.length > 0 && timestamps[0] <= cutoff) {
      timestamps.shift();
    }

    if (timestamps.length >= maxRequests) {
      return false;
    }

    timestamps.push(now);
    return true;
  }

  /**
   * Get retry-after seconds for a rate-limited key.
   * Returns 0 if not rate limited.
   */
  getRetryAfter(keyPart1: string, keyPart2: string): number {
    const key = `${keyPart1}:${keyPart2}`;
    const timestamps = this.windows.get(key);
    if (!timestamps || timestamps.length === 0) {
      return 0;
    }

    // Get config if available, otherwise estimate from window
    const config = this.configs.get(key);
    const windowSeconds = config?.windowSeconds ?? 60;
    const windowMs = windowSeconds * 1000;
    const now = Date.now();
    const oldestInWindow = timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return Math.max(1, Math.ceil(retryAfterMs / 1000));
  }
}
