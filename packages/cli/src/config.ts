import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import * as os from "node:os";

export interface AgentTraceConfig {
  token: string;
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
      return parsed as AgentTraceConfig;
    }
    return null;
  } catch {
    return null;
  }
}

export function resetToken(): AgentTraceConfig {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const config: AgentTraceConfig = {
    token: generateToken(),
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  return config;
}
