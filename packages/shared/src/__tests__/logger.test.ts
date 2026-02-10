import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "../logger.js";

describe("createLogger", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a logger with all log methods", () => {
    const log = createLogger("test-component");
    expect(log.debug).toBeInstanceOf(Function);
    expect(log.info).toBeInstanceOf(Function);
    expect(log.warn).toBeInstanceOf(Function);
    expect(log.error).toBeInstanceOf(Function);
  });

  it("logs info messages to console.log", () => {
    const log = createLogger("test");
    log.info("Test message");
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy.mock.calls[0][0]).toContain("Test message");
    expect(consoleLogSpy.mock.calls[0][0]).toContain("[test]");
    expect(consoleLogSpy.mock.calls[0][0]).toContain("[INFO ]");
  });

  it("logs warn messages to console.warn", () => {
    const log = createLogger("test");
    log.warn("Warning message");
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy.mock.calls[0][0]).toContain("Warning message");
    expect(consoleWarnSpy.mock.calls[0][0]).toContain("[WARN ]");
  });

  it("logs error messages to console.error", () => {
    const log = createLogger("test");
    log.error("Error message");
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("Error message");
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("[ERROR]");
  });

  it("includes extra data in log output", () => {
    const log = createLogger("test");
    log.info("Message with extra", { key: "value", num: 42 });
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const output = consoleLogSpy.mock.calls[0][0];
    expect(output).toContain("Message with extra");
    expect(output).toContain("key");
    expect(output).toContain("value");
  });

  it("includes component name in log output", () => {
    const log = createLogger("my-component");
    log.info("Test");
    expect(consoleLogSpy.mock.calls[0][0]).toContain("[my-component]");
  });

  it("debug messages are not logged by default (min level is info)", () => {
    const log = createLogger("test");
    log.debug("Debug message");
    // Default LOG_LEVEL is info, so debug should not be logged
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("respects LOG_LEVEL environment variable", () => {
    const originalLogLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "debug";

    const log = createLogger("test");
    log.debug("Debug message");

    // Now debug should be logged
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy.mock.calls[0][0]).toContain("Debug message");

    // Restore
    if (originalLogLevel) {
      process.env.LOG_LEVEL = originalLogLevel;
    } else {
      delete process.env.LOG_LEVEL;
    }
  });

  it("filters messages below minimum level", () => {
    const originalLogLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "error";

    const log = createLogger("test");
    log.debug("Debug");
    log.info("Info");
    log.warn("Warn");
    log.error("Error");

    // Only error should be logged
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    // Restore
    if (originalLogLevel) {
      process.env.LOG_LEVEL = originalLogLevel;
    } else {
      delete process.env.LOG_LEVEL;
    }
  });
});
