import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  setSticky,
  getSticky,
  clearSticky,
  clearAgentSessions,
  getAllSessions,
  getSessionCount,
  cleanupExpiredSessions,
  setSessionTtl,
  getSessionTtl,
  clearAllSessions,
} from "../session-sticky.js";

describe("session-sticky", () => {
  beforeEach(() => {
    clearAllSessions();
    setSessionTtl(30 * 60 * 1000); // Reset to default 30 min
  });

  describe("setSticky", () => {
    it("creates a new session", () => {
      const session = setSticky("agent-1", "gpt-4o", "openai");

      expect(session.agentId).toBe("agent-1");
      expect(session.model).toBe("gpt-4o");
      expect(session.provider).toBe("openai");
      expect(session.requestCount).toBe(1);
    });

    it("increments request count on same provider", () => {
      setSticky("agent-1", "gpt-4o", "openai");
      const session = setSticky("agent-1", "gpt-4o", "openai");

      expect(session.requestCount).toBe(2);
    });

    it("resets session when provider changes", () => {
      setSticky("agent-1", "gpt-4o", "openai");
      const session = setSticky("agent-1", "gpt-4o", "anthropic");

      expect(session.provider).toBe("anthropic");
      expect(session.requestCount).toBe(1);
    });

    it("normalizes model to lowercase", () => {
      setSticky("agent-1", "GPT-4O", "openai");
      const session = getSticky("agent-1", "gpt-4o");

      expect(session).not.toBeNull();
      expect(session!.model).toBe("gpt-4o");
    });
  });

  describe("getSticky", () => {
    it("returns null for non-existent session", () => {
      expect(getSticky("agent-1", "gpt-4o")).toBeNull();
    });

    it("returns existing session", () => {
      setSticky("agent-1", "gpt-4o", "openai");
      const session = getSticky("agent-1", "gpt-4o");

      expect(session).not.toBeNull();
      expect(session!.provider).toBe("openai");
    });

    it("returns null for expired session", () => {
      setSessionTtl(1); // 1ms TTL

      setSticky("agent-1", "gpt-4o", "openai");

      // Wait for expiration
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(getSticky("agent-1", "gpt-4o")).toBeNull();
          resolve();
        }, 10);
      });
    });

    it("is case-insensitive for model lookup", () => {
      setSticky("agent-1", "gpt-4o", "openai");

      expect(getSticky("agent-1", "GPT-4O")).not.toBeNull();
      expect(getSticky("agent-1", "Gpt-4o")).not.toBeNull();
    });
  });

  describe("clearSticky", () => {
    it("removes specific session", () => {
      setSticky("agent-1", "gpt-4o", "openai");
      setSticky("agent-1", "claude-3", "anthropic");

      clearSticky("agent-1", "gpt-4o");

      expect(getSticky("agent-1", "gpt-4o")).toBeNull();
      expect(getSticky("agent-1", "claude-3")).not.toBeNull();
    });
  });

  describe("clearAgentSessions", () => {
    it("clears all sessions for an agent", () => {
      setSticky("agent-1", "gpt-4o", "openai");
      setSticky("agent-1", "claude-3", "anthropic");
      setSticky("agent-2", "gpt-4o", "openai");

      const cleared = clearAgentSessions("agent-1");

      expect(cleared).toBe(2);
      expect(getSticky("agent-1", "gpt-4o")).toBeNull();
      expect(getSticky("agent-1", "claude-3")).toBeNull();
      expect(getSticky("agent-2", "gpt-4o")).not.toBeNull();
    });
  });

  describe("getAllSessions", () => {
    it("returns all active sessions", () => {
      setSticky("agent-1", "gpt-4o", "openai");
      setSticky("agent-2", "claude-3", "anthropic");

      const sessions = getAllSessions();

      expect(sessions).toHaveLength(2);
    });

    it("filters out expired sessions", () => {
      setSessionTtl(1); // 1ms TTL

      setSticky("agent-1", "gpt-4o", "openai");

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const sessions = getAllSessions();
          expect(sessions).toHaveLength(0);
          resolve();
        }, 10);
      });
    });
  });

  describe("getSessionCount", () => {
    it("returns count of active sessions", () => {
      expect(getSessionCount()).toBe(0);

      setSticky("agent-1", "gpt-4o", "openai");
      expect(getSessionCount()).toBe(1);

      setSticky("agent-2", "claude-3", "anthropic");
      expect(getSessionCount()).toBe(2);
    });
  });

  describe("cleanupExpiredSessions", () => {
    it("removes expired sessions", () => {
      setSessionTtl(1); // 1ms TTL

      setSticky("agent-1", "gpt-4o", "openai");
      setSticky("agent-2", "claude-3", "anthropic");

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const cleaned = cleanupExpiredSessions();
          expect(cleaned).toBe(2);
          expect(getSessionCount()).toBe(0);
          resolve();
        }, 10);
      });
    });

    it("keeps active sessions", () => {
      setSessionTtl(60000); // 60 second TTL

      setSticky("agent-1", "gpt-4o", "openai");

      const cleaned = cleanupExpiredSessions();

      expect(cleaned).toBe(0);
      expect(getSessionCount()).toBe(1);
    });
  });

  describe("TTL configuration", () => {
    it("can get and set session TTL", () => {
      expect(getSessionTtl()).toBe(30 * 60 * 1000);

      setSessionTtl(60000);
      expect(getSessionTtl()).toBe(60000);
    });
  });
});
