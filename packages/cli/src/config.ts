import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import * as os from "node:os";

/**
 * @deprecated Rate limits are now managed in the Dashboard and stored in the database.
 * This type is kept for backwards compatibility during migration.
 */
export interface ProviderRateLimit {
  maxRequests: number;
  windowSeconds: number;
}

export interface ProviderConfig {
  apiKey: string;
  /** @deprecated Rate limits are now managed in the Dashboard. This field is ignored. */
  rateLimit?: ProviderRateLimit;
}

export interface AgentTraceConfig {
  token: string;
  providers?: Record<string, ProviderConfig>;
}

const CONFIG_DIR = path.join(os.homedir(), ".agenttrace");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const DB_FILE = path.join(CONFIG_DIR, "data.db");

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getDbPath(): string {
  return DB_FILE;
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function ensureConfig(): AgentTraceConfig {
  // Create directory if it doesn't exist
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Read existing config or create new one
  const existing = readConfig();
  if (existing) {
    return existing;
  }

  const config: AgentTraceConfig = {
    token: generateToken(),
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  return config;
}

export function readConfig(): AgentTraceConfig | null {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.token === "string" && parsed.token.length > 0) {
      const config: AgentTraceConfig = { token: parsed.token };
      if (parsed.providers && typeof parsed.providers === "object") {
        config.providers = parsed.providers;
      }
      return config;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveConfig(config: AgentTraceConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function setProvider(
  name: string,
  providerConfig: ProviderConfig
): AgentTraceConfig {
  const config = ensureConfig();
  if (!config.providers) {
    config.providers = {};
  }
  config.providers[name] = providerConfig;
  saveConfig(config);
  return config;
}

export function removeProvider(name: string): AgentTraceConfig {
  const config = ensureConfig();
  if (config.providers) {
    delete config.providers[name];
    if (Object.keys(config.providers).length === 0) {
      delete config.providers;
    }
  }
  saveConfig(config);
  return config;
}

export function listProviders(): Record<string, ProviderConfig> {
  const config = readConfig();
  return config?.providers ?? {};
}

export function resetToken(): AgentTraceConfig {
  const existing = readConfig();
  const config: AgentTraceConfig = {
    ...existing,
    token: generateToken(),
  };
  saveConfig(config);
  return config;
}
