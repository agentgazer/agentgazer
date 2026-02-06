import { describe, it, expect, vi, afterEach } from "vitest";
import { RateLimiter } from "../rate-limiter.js";

describe("RateLimiter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows requests when no config is set for an agent+provider", () => {
    const limiter = new RateLimiter();
    const result = limiter.check("agent-1", "openai");
    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBeUndefined();
  });

  it("allows requests within the configured limit", () => {
    const limiter = new RateLimiter({
      "agent-1:openai": { maxRequests: 3, windowSeconds: 60 },
    });

    expect(limiter.check("agent-1", "openai").allowed).toBe(true);
    expect(limiter.check("agent-1", "openai").allowed).toBe(true);
    expect(limiter.check("agent-1", "openai").allowed).toBe(true);
  });

  it("denies requests exceeding the configured limit", () => {
    const limiter = new RateLimiter({
      "agent-1:openai": { maxRequests: 2, windowSeconds: 60 },
    });

    expect(limiter.check("agent-1", "openai").allowed).toBe(true);
    expect(limiter.check("agent-1", "openai").allowed).toBe(true);

    const result = limiter.check("agent-1", "openai");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("tracks agent+provider combinations independently", () => {
    const limiter = new RateLimiter({
      "agent-1:openai": { maxRequests: 1, windowSeconds: 60 },
      "agent-1:anthropic": { maxRequests: 1, windowSeconds: 60 },
      "agent-2:openai": { maxRequests: 1, windowSeconds: 60 },
    });

    expect(limiter.check("agent-1", "openai").allowed).toBe(true);
    expect(limiter.check("agent-1", "openai").allowed).toBe(false);

    // agent-1 anthropic should still be allowed
    expect(limiter.check("agent-1", "anthropic").allowed).toBe(true);
    expect(limiter.check("agent-1", "anthropic").allowed).toBe(false);

    // agent-2 openai should still be allowed
    expect(limiter.check("agent-2", "openai").allowed).toBe(true);
    expect(limiter.check("agent-2", "openai").allowed).toBe(false);
  });

  it("allows requests after the window expires", () => {
    vi.useFakeTimers();

    const limiter = new RateLimiter({
      "agent-1:openai": { maxRequests: 1, windowSeconds: 10 },
    });

    expect(limiter.check("agent-1", "openai").allowed).toBe(true);
    expect(limiter.check("agent-1", "openai").allowed).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(11_000);

    expect(limiter.check("agent-1", "openai").allowed).toBe(true);

    vi.useRealTimers();
  });

  it("returns appropriate retry-after value", () => {
    vi.useFakeTimers();

    const limiter = new RateLimiter({
      "agent-1:openai": { maxRequests: 1, windowSeconds: 30 },
    });

    limiter.check("agent-1", "openai"); // consume the slot

    const result = limiter.check("agent-1", "openai");
    expect(result.allowed).toBe(false);
    // Should be roughly 30 seconds
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(30);
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);

    vi.useRealTimers();
  });

  it("allows unconfigured agent+providers even when others are limited", () => {
    const limiter = new RateLimiter({
      "agent-1:openai": { maxRequests: 1, windowSeconds: 60 },
    });

    limiter.check("agent-1", "openai");
    expect(limiter.check("agent-1", "openai").allowed).toBe(false);

    // agent-1 google has no config — should always be allowed
    expect(limiter.check("agent-1", "google").allowed).toBe(true);
    expect(limiter.check("agent-1", "google").allowed).toBe(true);

    // agent-2 openai has no config — should always be allowed
    expect(limiter.check("agent-2", "openai").allowed).toBe(true);
    expect(limiter.check("agent-2", "openai").allowed).toBe(true);
  });

  it("hasConfig returns correct values", () => {
    const limiter = new RateLimiter({
      "agent-1:openai": { maxRequests: 10, windowSeconds: 60 },
    });

    expect(limiter.hasConfig("agent-1", "openai")).toBe(true);
    expect(limiter.hasConfig("agent-1", "anthropic")).toBe(false);
    expect(limiter.hasConfig("agent-2", "openai")).toBe(false);
  });

  it("handles sliding window correctly with staggered requests", () => {
    vi.useFakeTimers();

    const limiter = new RateLimiter({
      "agent-1:openai": { maxRequests: 3, windowSeconds: 10 },
    });

    // t=0: first request
    expect(limiter.check("agent-1", "openai").allowed).toBe(true);

    // t=3s: second request
    vi.advanceTimersByTime(3_000);
    expect(limiter.check("agent-1", "openai").allowed).toBe(true);

    // t=6s: third request
    vi.advanceTimersByTime(3_000);
    expect(limiter.check("agent-1", "openai").allowed).toBe(true);

    // t=6s: fourth request — should be denied
    expect(limiter.check("agent-1", "openai").allowed).toBe(false);

    // t=8s: still denied (first request at t=0 is still within window)
    vi.advanceTimersByTime(2_000);
    expect(limiter.check("agent-1", "openai").allowed).toBe(false);

    // t=11s: first request (t=0) expired, one slot opens
    vi.advanceTimersByTime(3_000);
    expect(limiter.check("agent-1", "openai").allowed).toBe(true);
    // now at capacity again
    expect(limiter.check("agent-1", "openai").allowed).toBe(false);

    vi.useRealTimers();
  });

  it("updateConfigs replaces all existing configs", () => {
    const limiter = new RateLimiter({
      "agent-1:openai": { maxRequests: 1, windowSeconds: 60 },
    });

    expect(limiter.hasConfig("agent-1", "openai")).toBe(true);

    limiter.updateConfigs({
      "agent-2:anthropic": { maxRequests: 5, windowSeconds: 30 },
    });

    expect(limiter.hasConfig("agent-1", "openai")).toBe(false);
    expect(limiter.hasConfig("agent-2", "anthropic")).toBe(true);
  });
});
