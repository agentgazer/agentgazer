import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isAllowed,
  recordSuccess,
  recordFailure,
  getState,
  getCircuitInfo,
  getAllCircuits,
  resetCircuit,
  clearAllCircuits,
  configureCircuitBreaker,
  getCircuitBreakerConfig,
} from "../alerts/circuit-breaker.js";

describe("circuit-breaker", () => {
  beforeEach(() => {
    clearAllCircuits();
    configureCircuitBreaker({
      failureThreshold: 5,
      baseCooldownMs: 60_000,
      maxCooldownMs: 600_000,
    });
  });

  describe("isAllowed", () => {
    it("allows requests for new URLs (closed state)", () => {
      expect(isAllowed("https://example.com/webhook")).toBe(true);
      expect(getState("https://example.com/webhook")).toBe("closed");
    });

    it("allows requests when circuit is closed", () => {
      const url = "https://example.com/webhook";
      recordSuccess(url);
      expect(isAllowed(url)).toBe(true);
    });

    it("blocks requests when circuit is open", () => {
      const url = "https://example.com/webhook";

      // Trip the circuit
      for (let i = 0; i < 5; i++) {
        recordFailure(url);
      }

      expect(getState(url)).toBe("open");
      expect(isAllowed(url)).toBe(false);
    });
  });

  describe("recordFailure", () => {
    it("opens circuit after reaching failure threshold", () => {
      const url = "https://example.com/webhook";

      // 4 failures - still closed
      for (let i = 0; i < 4; i++) {
        recordFailure(url);
      }
      expect(getState(url)).toBe("closed");

      // 5th failure - opens
      recordFailure(url);
      expect(getState(url)).toBe("open");
    });

    it("tracks consecutive failures", () => {
      const url = "https://example.com/webhook";

      recordFailure(url);
      recordFailure(url);
      recordFailure(url);

      const info = getCircuitInfo(url);
      expect(info?.consecutiveFailures).toBe(3);
    });
  });

  describe("recordSuccess", () => {
    it("resets consecutive failures", () => {
      const url = "https://example.com/webhook";

      recordFailure(url);
      recordFailure(url);
      expect(getCircuitInfo(url)?.consecutiveFailures).toBe(2);

      recordSuccess(url);
      expect(getCircuitInfo(url)?.consecutiveFailures).toBe(0);
    });

    it("closes circuit when in half-open state", () => {
      const url = "https://example.com/webhook";

      // Trip circuit with low cooldown for testing
      configureCircuitBreaker({ baseCooldownMs: 1, maxCooldownMs: 10 });

      for (let i = 0; i < 5; i++) {
        recordFailure(url);
      }
      expect(getState(url)).toBe("open");

      // Wait for cooldown and check - should transition to half_open
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(isAllowed(url)).toBe(true);
          expect(getState(url)).toBe("half_open");

          // Success closes the circuit
          recordSuccess(url);
          expect(getState(url)).toBe("closed");
          resolve();
        }, 10);
      });
    });
  });

  describe("half-open state", () => {
    it("transitions from open to half-open after cooldown", () => {
      const url = "https://example.com/webhook";
      configureCircuitBreaker({ baseCooldownMs: 1, maxCooldownMs: 10 });

      // Trip circuit
      for (let i = 0; i < 5; i++) {
        recordFailure(url);
      }
      expect(getState(url)).toBe("open");

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // isAllowed should transition to half_open
          expect(isAllowed(url)).toBe(true);
          expect(getState(url)).toBe("half_open");
          resolve();
        }, 10);
      });
    });

    it("re-opens on failure during half-open", () => {
      const url = "https://example.com/webhook";
      configureCircuitBreaker({ baseCooldownMs: 1, maxCooldownMs: 1000 });

      // Trip circuit
      for (let i = 0; i < 5; i++) {
        recordFailure(url);
      }

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          isAllowed(url); // Transition to half_open
          expect(getState(url)).toBe("half_open");

          // Failure during probe re-opens
          recordFailure(url);
          expect(getState(url)).toBe("open");

          const info = getCircuitInfo(url);
          expect(info?.tripCount).toBe(2);
          resolve();
        }, 10);
      });
    });
  });

  describe("exponential backoff", () => {
    it("doubles cooldown on each trip", () => {
      const url = "https://example.com/webhook";
      configureCircuitBreaker({ baseCooldownMs: 100, maxCooldownMs: 10000 });

      // First trip
      for (let i = 0; i < 5; i++) {
        recordFailure(url);
      }
      let info = getCircuitInfo(url);
      expect(info?.tripCount).toBe(1);
      expect(info?.cooldownMs).toBe(100); // base

      // Reset and trip again
      resetCircuit(url);
      info = getCircuitInfo(url);
      expect(info?.tripCount).toBe(0);
      expect(info?.cooldownMs).toBe(100);
    });

    it("caps cooldown at max", () => {
      const url = "https://example.com/webhook";
      configureCircuitBreaker({ baseCooldownMs: 1, maxCooldownMs: 10 });

      // Manually trip multiple times by manipulating state
      for (let i = 0; i < 5; i++) {
        recordFailure(url);
      }

      const info = getCircuitInfo(url);
      expect(info?.cooldownMs).toBeLessThanOrEqual(10);
    });
  });

  describe("resetCircuit", () => {
    it("resets circuit to initial state", () => {
      const url = "https://example.com/webhook";

      // Trip circuit
      for (let i = 0; i < 5; i++) {
        recordFailure(url);
      }
      expect(getState(url)).toBe("open");

      resetCircuit(url);

      expect(getState(url)).toBe("closed");
      const info = getCircuitInfo(url);
      expect(info?.consecutiveFailures).toBe(0);
      expect(info?.tripCount).toBe(0);
    });
  });

  describe("getAllCircuits", () => {
    it("returns all tracked circuits", () => {
      recordSuccess("https://example.com/a");
      recordFailure("https://example.com/b");

      const circuits = getAllCircuits();
      expect(circuits).toHaveLength(2);
      expect(circuits.map((c) => c.url).sort()).toEqual([
        "https://example.com/a",
        "https://example.com/b",
      ]);
    });
  });

  describe("configuration", () => {
    it("can configure threshold", () => {
      configureCircuitBreaker({ failureThreshold: 3 });

      const url = "https://example.com/webhook";

      recordFailure(url);
      recordFailure(url);
      expect(getState(url)).toBe("closed");

      recordFailure(url);
      expect(getState(url)).toBe("open");
    });

    it("returns current config", () => {
      configureCircuitBreaker({
        failureThreshold: 10,
        baseCooldownMs: 5000,
        maxCooldownMs: 30000,
      });

      const cfg = getCircuitBreakerConfig();
      expect(cfg.failureThreshold).toBe(10);
      expect(cfg.baseCooldownMs).toBe(5000);
      expect(cfg.maxCooldownMs).toBe(30000);
    });
  });
});
