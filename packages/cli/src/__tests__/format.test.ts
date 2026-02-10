import { describe, it, expect } from "vitest";
import {
  formatNumber,
  formatCurrency,
  timeAgo,
  formatUptime,
  formatLatency,
  parseRange,
} from "../utils/format.js";

describe("formatNumber", () => {
  it("formats integers with commas", () => {
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber(1000000)).toBe("1,000,000");
  });

  it("handles small numbers", () => {
    expect(formatNumber(42)).toBe("42");
    expect(formatNumber(0)).toBe("0");
  });

  it("handles negative numbers", () => {
    expect(formatNumber(-1000)).toBe("-1,000");
  });
});

describe("formatCurrency", () => {
  it("formats with dollar sign and two decimals", () => {
    expect(formatCurrency(10.5)).toBe("$10.50");
    expect(formatCurrency(0.05)).toBe("$0.05");
    expect(formatCurrency(1234.567)).toBe("$1234.57");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });
});

describe("timeAgo", () => {
  it("returns dash for null/undefined input", () => {
    expect(timeAgo(null)).toBe("—");
    expect(timeAgo(undefined)).toBe("—");
  });

  it("returns 'just now' for future times", () => {
    const future = new Date(Date.now() + 60000).toISOString();
    expect(timeAgo(future)).toBe("just now");
  });

  it("returns seconds ago for recent times", () => {
    const thirtySecsAgo = new Date(Date.now() - 30000).toISOString();
    expect(timeAgo(thirtySecsAgo)).toMatch(/30s ago|29s ago|31s ago/);
  });

  it("returns minutes ago for times within an hour", () => {
    const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString();
    expect(timeAgo(tenMinsAgo)).toBe("10m ago");
  });

  it("returns hours ago for times within a day", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60000).toISOString();
    expect(timeAgo(twoHoursAgo)).toBe("2h ago");
  });

  it("returns days ago for times beyond a day", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString();
    expect(timeAgo(threeDaysAgo)).toBe("3d ago");
  });
});

describe("formatUptime", () => {
  it("formats uptime as hours and minutes", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60000);
    expect(formatUptime(twoHoursAgo)).toBe("2h 0m");
  });

  it("includes minutes", () => {
    const twoHoursThirtyMinsAgo = new Date(Date.now() - (2 * 60 + 30) * 60000);
    expect(formatUptime(twoHoursThirtyMinsAgo)).toBe("2h 30m");
  });

  it("handles zero uptime", () => {
    expect(formatUptime(new Date())).toBe("0h 0m");
  });
});

describe("formatLatency", () => {
  it("formats latency with ms suffix", () => {
    expect(formatLatency(150)).toBe("150ms");
    expect(formatLatency(1500)).toBe("1,500ms");
  });

  it("returns dash for null/undefined", () => {
    expect(formatLatency(null)).toBe("--");
    expect(formatLatency(undefined)).toBe("--");
  });
});

describe("parseRange", () => {
  it("parses hours", () => {
    expect(parseRange("1h")).toBe(1 * 60 * 60 * 1000);
    expect(parseRange("24h")).toBe(24 * 60 * 60 * 1000);
  });

  it("parses days", () => {
    expect(parseRange("1d")).toBe(24 * 60 * 60 * 1000);
    expect(parseRange("7d")).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("parses weeks", () => {
    expect(parseRange("1w")).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseRange("2w")).toBe(14 * 24 * 60 * 60 * 1000);
  });

  it("parses months", () => {
    expect(parseRange("1m")).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("returns default for invalid input", () => {
    expect(parseRange("invalid")).toBe(24 * 60 * 60 * 1000);
    expect(parseRange("")).toBe(24 * 60 * 60 * 1000);
  });
});
