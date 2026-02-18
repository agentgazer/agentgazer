import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  relativeTime,
  formatTimestamp,
  formatTime,
  formatDate,
  formatCost,
  formatNumber,
} from "./format";

describe("relativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-19T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'Never' for null/undefined input", () => {
    expect(relativeTime(null)).toBe("Never");
    expect(relativeTime(undefined)).toBe("Never");
  });

  it("returns 'Never' for invalid ISO string", () => {
    expect(relativeTime("not-a-date")).toBe("Never");
  });

  it("returns seconds ago for recent timestamps", () => {
    const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString();
    expect(relativeTime(thirtySecondsAgo)).toBe("30s ago");
  });

  it("returns minutes ago", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(relativeTime(fiveMinutesAgo)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000).toISOString();
    expect(relativeTime(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days ago", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(relativeTime(twoDaysAgo)).toBe("2d ago");
  });

  it("returns '0s ago' for timestamps in the future (clamped to 0)", () => {
    const futureTime = new Date(Date.now() + 60_000).toISOString();
    expect(relativeTime(futureTime)).toBe("0s ago");
  });
});

describe("formatTimestamp", () => {
  it("returns '-' for null/undefined input", () => {
    expect(formatTimestamp(null)).toBe("-");
    expect(formatTimestamp(undefined)).toBe("-");
  });

  it("returns '-' for invalid date string", () => {
    expect(formatTimestamp("invalid")).toBe("-");
  });

  it("returns a locale string for valid ISO", () => {
    const result = formatTimestamp("2026-02-19T12:00:00Z");
    // The exact format depends on locale, but it should be a non-empty string
    expect(result).not.toBe("-");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatTime", () => {
  it("returns '-' for null/undefined input", () => {
    expect(formatTime(null)).toBe("-");
    expect(formatTime(undefined)).toBe("-");
  });

  it("returns '-' for invalid date string", () => {
    expect(formatTime("bad")).toBe("-");
  });

  it("returns formatted time for valid ISO", () => {
    const result = formatTime("2026-02-19T14:30:00Z");
    expect(result).not.toBe("-");
    // Should contain hour:minute pattern
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("formatDate", () => {
  it("returns '-' for null/undefined input", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate(undefined)).toBe("-");
  });

  it("returns '-' for invalid date string", () => {
    expect(formatDate("nope")).toBe("-");
  });

  it("returns formatted date for valid ISO", () => {
    const result = formatDate("2026-02-19T12:00:00Z");
    expect(result).not.toBe("-");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatCost", () => {
  it("formats a number as a dollar amount with 4 decimal places", () => {
    expect(formatCost(0)).toBe("$0.0000");
    expect(formatCost(1.5)).toBe("$1.5000");
    expect(formatCost(0.0001)).toBe("$0.0001");
    expect(formatCost(123.45678)).toBe("$123.4568");
  });
});

describe("formatNumber", () => {
  it("formats numbers with US locale separators", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
});
