import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import * as os from "node:os";

export interface AgentWatchConfig {
  token: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".agentwatch");
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

export function ensureConfig(): AgentWatchConfig {
  // Create directory if it doesn't exist
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Read existing config or create new one
  const existing = readConfig();
  if (existing) {
    return existing;
  }

  const config: AgentWatchConfig = {
    token: generateToken(),
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  return config;
}

export function readConfig(): AgentWatchConfig | null {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.token === "string" && parsed.token.length > 0) {
      return parsed as AgentWatchConfig;
    }
    return null;
  } catch {
    return null;
  }
}

export function resetToken(): AgentWatchConfig {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const config: AgentWatchConfig = {
    token: generateToken(),
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  return config;
}
