import { createLogger } from "@agentgazer/shared";

const log = createLogger("circuit-breaker");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerConfig {
  failureThreshold: number;   // Consecutive failures before opening (default: 5)
  baseCooldownMs: number;     // Base cooldown in ms (default: 60_000 = 1 min)
  maxCooldownMs: number;      // Max cooldown in ms (default: 600_000 = 10 min)
}

interface CircuitEntry {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureAt: number;
  tripCount: number;          // Number of times circuit has been tripped
  openedAt: number | null;
  cooldownMs: number;         // Current cooldown duration
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  baseCooldownMs: 60_000,     // 1 minute
  maxCooldownMs: 600_000,     // 10 minutes
};

// ---------------------------------------------------------------------------
// Circuit Breaker State
// ---------------------------------------------------------------------------

// Map of URL -> CircuitEntry
const circuits = new Map<string, CircuitEntry>();

let config: CircuitBreakerConfig = { ...DEFAULT_CONFIG };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getOrCreate(url: string): CircuitEntry {
  let entry = circuits.get(url);
  if (!entry) {
    entry = {
      state: "closed",
      consecutiveFailures: 0,
      lastFailureAt: 0,
      tripCount: 0,
      openedAt: null,
      cooldownMs: config.baseCooldownMs,
    };
    circuits.set(url, entry);
  }
  return entry;
}

function calculateCooldown(tripCount: number): number {
  // Exponential backoff: base * 2^(tripCount - 1), capped at max
  const cooldown = config.baseCooldownMs * Math.pow(2, Math.max(0, tripCount - 1));
  return Math.min(cooldown, config.maxCooldownMs);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if a request to the given URL is allowed.
 * Returns true if the circuit is closed or half-open (probe allowed).
 * Returns false if the circuit is open and cooldown hasn't elapsed.
 */
export function isAllowed(url: string): boolean {
  const entry = getOrCreate(url);
  const now = Date.now();

  switch (entry.state) {
    case "closed":
      return true;

    case "open":
      // Check if cooldown has elapsed
      if (entry.openedAt && now - entry.openedAt >= entry.cooldownMs) {
        // Transition to half-open, allow a probe request
        entry.state = "half_open";
        log.info("Circuit half-open, allowing probe", { url, cooldownMs: entry.cooldownMs });
        return true;
      }
      return false;

    case "half_open":
      // Only one probe at a time - already allowed
      return true;
  }
}

/**
 * Record a successful request.
 * Resets the circuit to closed state.
 */
export function recordSuccess(url: string): void {
  const entry = getOrCreate(url);

  if (entry.state === "half_open") {
    log.info("Circuit closed after successful probe", { url, tripCount: entry.tripCount });
  }

  // Reset to closed state
  entry.state = "closed";
  entry.consecutiveFailures = 0;
  entry.openedAt = null;
  // Note: We don't reset tripCount or cooldownMs here
  // This provides "memory" of past issues
}

/**
 * Record a failed request.
 * If threshold is exceeded, opens the circuit.
 */
export function recordFailure(url: string): void {
  const entry = getOrCreate(url);
  const now = Date.now();

  entry.consecutiveFailures++;
  entry.lastFailureAt = now;

  if (entry.state === "half_open") {
    // Probe failed - trip the circuit again
    entry.tripCount++;
    entry.cooldownMs = calculateCooldown(entry.tripCount);
    entry.state = "open";
    entry.openedAt = now;
    log.warn("Circuit re-opened after probe failure", {
      url,
      tripCount: entry.tripCount,
      cooldownMs: entry.cooldownMs,
    });
    return;
  }

  if (entry.consecutiveFailures >= config.failureThreshold) {
    // Trip the circuit
    entry.tripCount++;
    entry.cooldownMs = calculateCooldown(entry.tripCount);
    entry.state = "open";
    entry.openedAt = now;
    log.warn("Circuit opened after consecutive failures", {
      url,
      failures: entry.consecutiveFailures,
      tripCount: entry.tripCount,
      cooldownMs: entry.cooldownMs,
    });
  }
}

/**
 * Get the current state of a circuit.
 */
export function getState(url: string): CircuitState {
  const entry = circuits.get(url);
  return entry?.state ?? "closed";
}

/**
 * Get detailed info about a circuit (for debugging/monitoring).
 */
export function getCircuitInfo(url: string): CircuitEntry | null {
  return circuits.get(url) ?? null;
}

/**
 * Get all circuits with their states.
 */
export function getAllCircuits(): Array<{ url: string; entry: CircuitEntry }> {
  return Array.from(circuits.entries()).map(([url, entry]) => ({ url, entry }));
}

/**
 * Reset a specific circuit to closed state.
 * Useful for manual intervention.
 */
export function resetCircuit(url: string): void {
  const entry = circuits.get(url);
  if (entry) {
    entry.state = "closed";
    entry.consecutiveFailures = 0;
    entry.openedAt = null;
    entry.tripCount = 0;
    entry.cooldownMs = config.baseCooldownMs;
    log.info("Circuit manually reset", { url });
  }
}

/**
 * Clear all circuits.
 */
export function clearAllCircuits(): void {
  circuits.clear();
}

/**
 * Configure the circuit breaker.
 */
export function configureCircuitBreaker(newConfig: Partial<CircuitBreakerConfig>): void {
  config = { ...config, ...newConfig };
  log.info("Circuit breaker configured", { config });
}

/**
 * Get current configuration.
 */
export function getCircuitBreakerConfig(): CircuitBreakerConfig {
  return { ...config };
}
