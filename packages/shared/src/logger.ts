export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function isProduction(): boolean {
  return (
    typeof process !== "undefined" && process.env?.NODE_ENV === "production"
  );
}

function getMinLevel(): LogLevel {
  if (typeof process !== "undefined" && process.env?.LOG_LEVEL) {
    const env = process.env.LOG_LEVEL as LogLevel;
    if (env in LEVEL_PRIORITY) return env;
  }
  return "info";
}

function formatPretty(entry: LogEntry): string {
  const { timestamp, level, component, message, ...extra } = entry;
  const time = timestamp.slice(11, 23); // HH:mm:ss.SSS
  const prefix = `[${time}] [${level.toUpperCase().padEnd(5)}] [${component}]`;
  const extraStr =
    Object.keys(extra).length > 0 ? " " + JSON.stringify(extra) : "";
  return `${prefix} ${message}${extraStr}`;
}

export interface Logger {
  debug(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
}

export function createLogger(component: string): Logger {
  function log(
    level: LogLevel,
    message: string,
    extra?: Record<string, unknown>,
  ): void {
    // Check level on each call so LOG_LEVEL changes take effect
    const minLevel = getMinLevel();
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

    const json = isProduction();

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      ...extra,
    };

    const output = json ? JSON.stringify(entry) : formatPretty(entry);

    if (level === "error") {
      console.error(output);
    } else if (level === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  return {
    debug: (msg, extra) => log("debug", msg, extra),
    info: (msg, extra) => log("info", msg, extra),
    warn: (msg, extra) => log("warn", msg, extra),
    error: (msg, extra) => log("error", msg, extra),
  };
}
