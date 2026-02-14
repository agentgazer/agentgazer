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

export interface ServerConfig {
  /** Dashboard port (default: 18880) */
  port?: number;
  /** LLM proxy port (default: 18900) */
  proxyPort?: number;
  /** Auto-open browser on start (default: true) */
  autoOpen?: boolean;
}

export interface DataConfig {
  /** Data retention period in days (default: 30) */
  retentionDays?: number;
}

export interface PayloadConfig {
  /** Enable payload archiving (default: false) */
  enabled?: boolean;
  /** Payload retention period in days (default: 7) */
  retentionDays?: number;
}

export interface TelegramDefaults {
  botToken?: string;
  chatId?: string;
}

export interface WebhookDefaults {
  url?: string;
}

export interface EmailDefaults {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
  to?: string;
}

export interface AlertDefaults {
  telegram?: TelegramDefaults;
  webhook?: WebhookDefaults;
  email?: EmailDefaults;
}

export interface AlertsConfig {
  defaults?: AlertDefaults;
}

export interface AgentGazerConfig {
  token: string;
  server?: ServerConfig;
  data?: DataConfig;
  payload?: PayloadConfig;
  alerts?: AlertsConfig;
  providers?: Record<string, ProviderConfig>;
}

const CONFIG_DIR = path.join(os.homedir(), ".agentgazer");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const DB_FILE = path.join(CONFIG_DIR, "data.db");
const PAYLOAD_DB_FILE = path.join(CONFIG_DIR, "payloads.db");

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function getDbPath(): string {
  return DB_FILE;
}

export function getPayloadDbPath(): string {
  return PAYLOAD_DB_FILE;
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Migrate old flat config to new hierarchical structure.
 * Returns true if migration was performed.
 */
function migrateConfig(parsed: Record<string, unknown>): { config: AgentGazerConfig; migrated: boolean } {
  const config: AgentGazerConfig = { token: parsed.token as string };
  let migrated = false;

  // Check for old flat structure
  const hasOldFormat =
    typeof parsed.port === "number" ||
    typeof parsed.proxyPort === "number" ||
    typeof parsed.autoOpen === "boolean" ||
    typeof parsed.retentionDays === "number";

  if (hasOldFormat) {
    migrated = true;
    // Migrate to new structure
    if (typeof parsed.port === "number" || typeof parsed.proxyPort === "number" || typeof parsed.autoOpen === "boolean") {
      config.server = {};
      if (typeof parsed.port === "number") config.server.port = parsed.port;
      if (typeof parsed.proxyPort === "number") config.server.proxyPort = parsed.proxyPort;
      if (typeof parsed.autoOpen === "boolean") config.server.autoOpen = parsed.autoOpen;
    }
    if (typeof parsed.retentionDays === "number") {
      config.data = { retentionDays: parsed.retentionDays };
    }
  } else {
    // Already new format or fresh config
    if (parsed.server && typeof parsed.server === "object") {
      config.server = parsed.server as ServerConfig;
    }
    if (parsed.data && typeof parsed.data === "object") {
      config.data = parsed.data as DataConfig;
    }
  }

  // Alerts config (new, no migration needed)
  if (parsed.alerts && typeof parsed.alerts === "object") {
    config.alerts = parsed.alerts as AlertsConfig;
  }

  // Payload config (new, no migration needed)
  if (parsed.payload && typeof parsed.payload === "object") {
    config.payload = parsed.payload as PayloadConfig;
  }

  // Providers
  if (parsed.providers && typeof parsed.providers === "object") {
    config.providers = parsed.providers as Record<string, ProviderConfig>;
  }

  return { config, migrated };
}

export function ensureConfig(): AgentGazerConfig {
  // Create directory if it doesn't exist
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Read existing config or create new one
  const existing = readConfig();
  if (existing) {
    return existing;
  }

  const config: AgentGazerConfig = {
    token: generateToken(),
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  return config;
}

export function readConfig(): AgentGazerConfig | null {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.token === "string" && parsed.token.length > 0) {
      const { config, migrated } = migrateConfig(parsed);

      // Write back if migrated
      if (migrated) {
        saveConfig(config);
      }

      return config;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveConfig(config: AgentGazerConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

/** Get the server port from config, or return default 18880 */
export function getServerPort(): number {
  const config = readConfig();
  return config?.server?.port ?? 18880;
}

export function setProvider(
  name: string,
  providerConfig: ProviderConfig
): AgentGazerConfig {
  const config = ensureConfig();
  if (!config.providers) {
    config.providers = {};
  }
  config.providers[name] = providerConfig;
  saveConfig(config);
  return config;
}

export function removeProvider(name: string): AgentGazerConfig {
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

export function resetToken(): AgentGazerConfig {
  const existing = readConfig();
  const config: AgentGazerConfig = {
    ...existing,
    token: generateToken(),
  };
  saveConfig(config);
  return config;
}

// ---------------------------------------------------------------------------
// Helper functions for accessing config values with defaults
// ---------------------------------------------------------------------------

export function getAlertDefaults(config: AgentGazerConfig | null): AlertDefaults {
  return config?.alerts?.defaults ?? {};
}

export function updateAlertDefaults(defaults: AlertDefaults): AgentGazerConfig {
  const config = ensureConfig();
  if (!config.alerts) {
    config.alerts = {};
  }
  config.alerts.defaults = {
    ...config.alerts.defaults,
    ...defaults,
  };
  saveConfig(config);
  return config;
}

// ---------------------------------------------------------------------------
// Payload config helpers
// ---------------------------------------------------------------------------

export const DEFAULT_PAYLOAD_CONFIG: Required<PayloadConfig> = {
  enabled: false,
  retentionDays: 7,
};

export function getPayloadConfig(config: AgentGazerConfig | null): Required<PayloadConfig> {
  return {
    enabled: config?.payload?.enabled ?? DEFAULT_PAYLOAD_CONFIG.enabled,
    retentionDays: config?.payload?.retentionDays ?? DEFAULT_PAYLOAD_CONFIG.retentionDays,
  };
}

export function updatePayloadConfig(updates: Partial<PayloadConfig>): AgentGazerConfig {
  const config = ensureConfig();
  config.payload = {
    ...config.payload,
    ...updates,
  };
  saveConfig(config);
  return config;
}
