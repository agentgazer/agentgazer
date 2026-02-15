import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type Database from "better-sqlite3";

// Mock nodemailer
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({}),
    })),
  },
}));

// Mock circuit-breaker
vi.mock("../../alerts/circuit-breaker.js", () => ({
  isAllowed: vi.fn(() => true),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  getState: vi.fn(() => "closed"),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  startEvaluator,
  fireKillSwitchAlert,
  fireSecurityAlert,
  resetKillSwitchAlerts,
} from "../../alerts/evaluator.js";
import { isAllowed, recordSuccess, recordFailure } from "../../alerts/circuit-breaker.js";

// Helper to create mock database
function createMockDb() {
  const statements: Record<string, { all: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn>; run: ReturnType<typeof vi.fn> }> = {};

  const prepare = vi.fn((sql: string) => {
    if (!statements[sql]) {
      statements[sql] = {
        all: vi.fn(() => []),
        get: vi.fn(() => undefined),
        run: vi.fn(),
      };
    }
    return statements[sql];
  });

  return {
    prepare,
    statements,
  } as unknown as Database.Database & { statements: typeof statements };
}

describe("Alert Evaluator", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    db = createMockDb();
    mockFetch.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("startEvaluator", () => {
    it("should start and stop evaluator", () => {
      const evaluator = startEvaluator({ db, interval: 1000 });
      expect(evaluator.stop).toBeDefined();
      evaluator.stop();
    });

    it("should run tick immediately on start", async () => {
      startEvaluator({ db, interval: 60000 });

      // Should have queried for enabled rules
      await vi.advanceTimersByTimeAsync(0);
      expect(db.prepare).toHaveBeenCalled();
    });

    it("should run tick on interval", async () => {
      const evaluator = startEvaluator({ db, interval: 1000 });

      await vi.advanceTimersByTimeAsync(0); // Initial tick
      const initialCalls = db.prepare.mock.calls.length;

      await vi.advanceTimersByTimeAsync(1000); // After interval
      expect(db.prepare.mock.calls.length).toBeGreaterThan(initialCalls);

      evaluator.stop();
    });
  });

  describe("agent_down evaluation", () => {
    it("should fire alert when agent has no activity", async () => {
      const rule = {
        id: "rule-1",
        agent_id: "test-agent",
        rule_type: "agent_down",
        config: JSON.stringify({ duration_minutes: 5 }),
        enabled: 1,
        notification_type: "webhook",
        webhook_url: "https://example.com/webhook",
        state: "normal",
        repeat_enabled: 0,
        repeat_interval_minutes: 30,
        recovery_notify: 0,
      };

      // Mock: return agent_down rule
      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("alert_rules")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: vi.fn() };
        }
        if (sql.includes("agents WHERE")) {
          return {
            all: vi.fn(),
            get: vi.fn(() => ({
              agent_id: "test-agent",
              status: "active",
              updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
            })),
            run: vi.fn()
          };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      startEvaluator({ db, interval: 60000 });
      await vi.advanceTimersByTimeAsync(0);

      // Should have sent webhook
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/webhook",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("should not fire alert when agent is active", async () => {
      const rule = {
        id: "rule-1",
        agent_id: "test-agent",
        rule_type: "agent_down",
        config: JSON.stringify({ duration_minutes: 5 }),
        enabled: 1,
        notification_type: "webhook",
        webhook_url: "https://example.com/webhook",
        state: "normal",
        repeat_enabled: 0,
        repeat_interval_minutes: 30,
        recovery_notify: 0,
      };

      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("alert_rules")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: vi.fn() };
        }
        if (sql.includes("agents WHERE")) {
          return {
            all: vi.fn(),
            get: vi.fn(() => ({
              agent_id: "test-agent",
              status: "active",
              updated_at: new Date().toISOString(), // Just now
            })),
            run: vi.fn()
          };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      startEvaluator({ db, interval: 60000 });
      await vi.advanceTimersByTimeAsync(0);

      // Should NOT have sent webhook
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("error_rate evaluation", () => {
    it("should fire alert when error rate exceeds threshold", async () => {
      const rule = {
        id: "rule-2",
        agent_id: "test-agent",
        rule_type: "error_rate",
        config: JSON.stringify({ window_minutes: 10, threshold: 10 }),
        enabled: 1,
        notification_type: "webhook",
        webhook_url: "https://example.com/webhook",
        state: "normal",
        repeat_enabled: 0,
        repeat_interval_minutes: 30,
        recovery_notify: 0,
      };

      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("alert_rules")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: vi.fn() };
        }
        if (sql.includes("agents WHERE")) {
          return {
            all: vi.fn(),
            get: vi.fn(() => ({ agent_id: "test-agent", status: "active" })),
            run: vi.fn()
          };
        }
        if (sql.includes("COUNT(*)")) {
          return {
            all: vi.fn(),
            get: vi.fn(() => ({ total: 100, errors: 20 })), // 20% error rate
            run: vi.fn()
          };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      startEvaluator({ db, interval: 60000 });
      await vi.advanceTimersByTimeAsync(0);

      expect(mockFetch).toHaveBeenCalled();
    });

    it("should not fire alert when error rate is below threshold", async () => {
      const rule = {
        id: "rule-2",
        agent_id: "test-agent",
        rule_type: "error_rate",
        config: JSON.stringify({ window_minutes: 10, threshold: 10 }),
        enabled: 1,
        notification_type: "webhook",
        webhook_url: "https://example.com/webhook",
        state: "normal",
        repeat_enabled: 0,
        repeat_interval_minutes: 30,
        recovery_notify: 0,
      };

      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("alert_rules")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: vi.fn() };
        }
        if (sql.includes("agents WHERE")) {
          return {
            all: vi.fn(),
            get: vi.fn(() => ({ agent_id: "test-agent", status: "active" })),
            run: vi.fn()
          };
        }
        if (sql.includes("COUNT(*)")) {
          return {
            all: vi.fn(),
            get: vi.fn(() => ({ total: 100, errors: 5 })), // 5% error rate
            run: vi.fn()
          };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      startEvaluator({ db, interval: 60000 });
      await vi.advanceTimersByTimeAsync(0);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("budget evaluation", () => {
    it("should fire alert when budget exceeds threshold", async () => {
      const rule = {
        id: "rule-3",
        agent_id: "test-agent",
        rule_type: "budget",
        config: JSON.stringify({ threshold: 10 }),
        enabled: 1,
        notification_type: "webhook",
        webhook_url: "https://example.com/webhook",
        state: "normal",
        budget_period: "daily",
        repeat_enabled: 0,
        repeat_interval_minutes: 30,
        recovery_notify: 0,
      };

      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("alert_rules")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: vi.fn() };
        }
        if (sql.includes("agents WHERE")) {
          return {
            all: vi.fn(),
            get: vi.fn(() => ({ agent_id: "test-agent", status: "active" })),
            run: vi.fn()
          };
        }
        if (sql.includes("SUM(cost_usd)")) {
          return {
            all: vi.fn(),
            get: vi.fn(() => ({ total_cost: 15 })), // $15 > $10 threshold
            run: vi.fn()
          };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      startEvaluator({ db, interval: 60000 });
      await vi.advanceTimersByTimeAsync(0);

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("fireKillSwitchAlert", () => {
    it("should fire kill switch alert", async () => {
      const rule = {
        id: "rule-ks",
        agent_id: "test-agent",
        rule_type: "kill_switch",
        config: "{}",
        enabled: 1,
        notification_type: "webhook",
        webhook_url: "https://example.com/webhook",
        state: "normal",
        repeat_enabled: 0,
        repeat_interval_minutes: 30,
        recovery_notify: 0,
      };

      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("kill_switch")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: vi.fn() };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      await fireKillSwitchAlert(db, {
        agent_id: "test-agent",
        score: 8.5,
        window_size: 10,
        threshold: 7,
        details: {
          similarPrompts: 3,
          similarResponses: 2,
          repeatedToolCalls: 1,
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/webhook",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should skip if no rules configured", async () => {
      db.prepare.mockImplementation(() => ({
        all: vi.fn(() => []),
        get: vi.fn(),
        run: vi.fn(),
      }));

      await fireKillSwitchAlert(db, {
        agent_id: "test-agent",
        score: 8.5,
        window_size: 10,
        threshold: 7,
        details: { similarPrompts: 3, similarResponses: 2, repeatedToolCalls: 1 },
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should respect repeat interval", async () => {
      const rule = {
        id: "rule-ks",
        agent_id: "test-agent",
        rule_type: "kill_switch",
        config: "{}",
        enabled: 1,
        notification_type: "webhook",
        webhook_url: "https://example.com/webhook",
        state: "alerting",
        repeat_enabled: 1,
        repeat_interval_minutes: 30,
        last_triggered_at: new Date().toISOString(), // Just triggered
        recovery_notify: 0,
      };

      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("kill_switch")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: vi.fn() };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      await fireKillSwitchAlert(db, {
        agent_id: "test-agent",
        score: 8.5,
        window_size: 10,
        threshold: 7,
        details: { similarPrompts: 3, similarResponses: 2, repeatedToolCalls: 1 },
      });

      // Should be skipped due to repeat interval
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("fireSecurityAlert", () => {
    it("should fire security alert", async () => {
      const rule = {
        id: "rule-sec",
        agent_id: "test-agent",
        rule_type: "security_event",
        config: "{}",
        enabled: 1,
        notification_type: "webhook",
        webhook_url: "https://example.com/webhook",
        state: "normal",
        repeat_enabled: 0,
        repeat_interval_minutes: 30,
        recovery_notify: 0,
      };

      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("security_event")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: vi.fn() };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      await fireSecurityAlert(db, {
        agent_id: "test-agent",
        event_type: "prompt_injection",
        severity: "critical",
        action_taken: "blocked",
        rule_name: "ignore_instructions",
        matched_pattern: "ignore all previous",
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it("should filter by event type", async () => {
      const rule = {
        id: "rule-sec",
        agent_id: "test-agent",
        rule_type: "security_event",
        config: JSON.stringify({ event_types: ["data_masked"] }), // Only data_masked
        enabled: 1,
        notification_type: "webhook",
        webhook_url: "https://example.com/webhook",
        state: "normal",
        repeat_enabled: 0,
        repeat_interval_minutes: 30,
        recovery_notify: 0,
      };

      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("security_event")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: vi.fn() };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      await fireSecurityAlert(db, {
        agent_id: "test-agent",
        event_type: "prompt_injection", // Different type
        severity: "critical",
        action_taken: "blocked",
      });

      // Should be filtered out
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should filter by minimum severity", async () => {
      const rule = {
        id: "rule-sec",
        agent_id: "test-agent",
        rule_type: "security_event",
        config: JSON.stringify({ min_severity: "critical" }),
        enabled: 1,
        notification_type: "webhook",
        webhook_url: "https://example.com/webhook",
        state: "normal",
        repeat_enabled: 0,
        repeat_interval_minutes: 30,
        recovery_notify: 0,
      };

      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("security_event")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: vi.fn() };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      await fireSecurityAlert(db, {
        agent_id: "test-agent",
        event_type: "prompt_injection",
        severity: "warning", // Below critical
        action_taken: "logged",
      });

      // Should be filtered out due to severity
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("resetKillSwitchAlerts", () => {
    it("should reset alert state to normal", () => {
      const rule = {
        id: "rule-ks",
        agent_id: "test-agent",
        rule_type: "kill_switch",
        config: "{}",
        enabled: 1,
        state: "fired",
        recovery_notify: 0,
      };

      const runMock = vi.fn();
      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("kill_switch")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: runMock };
        }
        if (sql.includes("UPDATE alert_rules")) {
          return { all: vi.fn(), get: vi.fn(), run: runMock };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      resetKillSwitchAlerts(db, "test-agent");

      expect(runMock).toHaveBeenCalledWith("normal", null, "rule-ks");
    });

    it("should send recovery notification if enabled", () => {
      const rule = {
        id: "rule-ks",
        agent_id: "test-agent",
        rule_type: "kill_switch",
        config: "{}",
        enabled: 1,
        notification_type: "webhook",
        webhook_url: "https://example.com/webhook",
        state: "alerting",
        recovery_notify: 1, // Enabled
      };

      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("kill_switch")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: vi.fn() };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      resetKillSwitchAlerts(db, "test-agent");

      // Should send recovery webhook
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("webhook delivery", () => {
    it("should respect circuit breaker", async () => {
      vi.mocked(isAllowed).mockReturnValue(false);

      const rule = {
        id: "rule-1",
        agent_id: "test-agent",
        rule_type: "agent_down",
        config: JSON.stringify({ duration_minutes: 5 }),
        enabled: 1,
        notification_type: "webhook",
        webhook_url: "https://example.com/webhook",
        state: "normal",
        repeat_enabled: 0,
        repeat_interval_minutes: 30,
        recovery_notify: 0,
      };

      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("alert_rules")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: vi.fn() };
        }
        if (sql.includes("agents WHERE")) {
          return {
            all: vi.fn(),
            get: vi.fn(() => ({
              agent_id: "test-agent",
              status: "active",
              updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            })),
            run: vi.fn()
          };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      startEvaluator({ db, interval: 60000 });
      await vi.advanceTimersByTimeAsync(0);

      // Webhook should be skipped due to circuit breaker
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should retry on failure", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ ok: true });

      const rule = {
        id: "rule-ks",
        agent_id: "test-agent",
        rule_type: "kill_switch",
        config: "{}",
        enabled: 1,
        notification_type: "webhook",
        webhook_url: "https://example.com/webhook",
        state: "normal",
        repeat_enabled: 0,
        repeat_interval_minutes: 30,
        recovery_notify: 0,
      };

      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("kill_switch")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: vi.fn() };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      await fireKillSwitchAlert(db, {
        agent_id: "test-agent",
        score: 8.5,
        window_size: 10,
        threshold: 7,
        details: { similarPrompts: 3, similarResponses: 2, repeatedToolCalls: 1 },
      });

      // Wait for retries
      await vi.advanceTimersByTimeAsync(1000); // 1s delay
      await vi.advanceTimersByTimeAsync(4000); // 4s delay

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(recordSuccess).toHaveBeenCalled();
    });

    it("should record failure after all retries exhausted", async () => {
      vi.mocked(isAllowed).mockReturnValue(true);
      mockFetch.mockRejectedValue(new Error("Network error"));

      const rule = {
        id: "rule-ks",
        agent_id: "test-agent",
        rule_type: "kill_switch",
        config: "{}",
        enabled: 1,
        notification_type: "webhook",
        webhook_url: "https://example.com/webhook",
        state: "normal",
        repeat_enabled: 0,
        repeat_interval_minutes: 30,
        recovery_notify: 0,
      };

      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("kill_switch")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: vi.fn() };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      await fireKillSwitchAlert(db, {
        agent_id: "test-agent",
        score: 8.5,
        window_size: 10,
        threshold: 7,
        details: { similarPrompts: 3, similarResponses: 2, repeatedToolCalls: 1 },
      });

      // Wait for all retries
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(4000);
      await vi.advanceTimersByTimeAsync(16000);

      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
      expect(recordFailure).toHaveBeenCalled();
    });
  });

  describe("repeat and recovery", () => {
    it("should send repeat notifications when enabled", async () => {
      const rule = {
        id: "rule-1",
        agent_id: "test-agent",
        rule_type: "agent_down",
        config: JSON.stringify({ duration_minutes: 5 }),
        enabled: 1,
        notification_type: "webhook",
        webhook_url: "https://example.com/webhook",
        state: "alerting",
        repeat_enabled: 1,
        repeat_interval_minutes: 1, // 1 minute
        last_triggered_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 min ago
        recovery_notify: 0,
      };

      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("alert_rules")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: vi.fn() };
        }
        if (sql.includes("agents WHERE")) {
          return {
            all: vi.fn(),
            get: vi.fn(() => ({
              agent_id: "test-agent",
              status: "active",
              updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            })),
            run: vi.fn()
          };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      startEvaluator({ db, interval: 60000 });
      await vi.advanceTimersByTimeAsync(0);

      // Should send repeat notification
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should send recovery notification when enabled", async () => {
      const rule = {
        id: "rule-1",
        agent_id: "test-agent",
        rule_type: "agent_down",
        config: JSON.stringify({ duration_minutes: 5 }),
        enabled: 1,
        notification_type: "webhook",
        webhook_url: "https://example.com/webhook",
        state: "alerting", // Was alerting
        repeat_enabled: 0,
        repeat_interval_minutes: 30,
        recovery_notify: 1, // Recovery enabled
      };

      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("alert_rules")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: vi.fn() };
        }
        if (sql.includes("agents WHERE")) {
          return {
            all: vi.fn(),
            get: vi.fn(() => ({
              agent_id: "test-agent",
              status: "active",
              updated_at: new Date().toISOString(), // Just now - recovered
            })),
            run: vi.fn()
          };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      startEvaluator({ db, interval: 60000 });
      await vi.advanceTimersByTimeAsync(0);

      // Should send recovery notification
      expect(mockFetch).toHaveBeenCalled();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.rule_type).toBe("agent_down_recovery");
    });
  });

  describe("skip inactive agents", () => {
    it("should skip evaluation for inactive agents", async () => {
      const rule = {
        id: "rule-1",
        agent_id: "test-agent",
        rule_type: "agent_down",
        config: JSON.stringify({ duration_minutes: 5 }),
        enabled: 1,
        notification_type: "webhook",
        webhook_url: "https://example.com/webhook",
        state: "normal",
        repeat_enabled: 0,
        repeat_interval_minutes: 30,
        recovery_notify: 0,
      };

      db.prepare.mockImplementation((sql: string) => {
        if (sql.includes("alert_rules")) {
          return { all: vi.fn(() => [rule]), get: vi.fn(), run: vi.fn() };
        }
        if (sql.includes("agents WHERE")) {
          return {
            all: vi.fn(),
            get: vi.fn(() => ({
              agent_id: "test-agent",
              status: "inactive", // Inactive
              updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            })),
            run: vi.fn()
          };
        }
        return { all: vi.fn(() => []), get: vi.fn(), run: vi.fn() };
      });

      startEvaluator({ db, interval: 60000 });
      await vi.advanceTimersByTimeAsync(0);

      // Should not send notification for inactive agent
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
