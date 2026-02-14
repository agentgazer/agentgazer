/**
 * Configuration loading for MCP server
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface McpConfig {
  endpoint: string;
  token: string;
  agentId: string;
}

const DEFAULT_ENDPOINT = "http://localhost:18880";
const CONFIG_DIR = path.join(os.homedir(), ".agentgazer");
const CONFIG_FILE = path.join(CONFIG_DIR, "mcp-config.json");

/**
 * Load configuration from environment variables
 */
export function loadFromEnv(): Partial<McpConfig> {
  return {
    endpoint: process.env.AGENTGAZER_ENDPOINT,
    token: process.env.AGENTGAZER_TOKEN,
    agentId: process.env.AGENTGAZER_AGENT_ID,
  };
}

/**
 * Load configuration from config file
 */
export function loadFromFile(): Partial<McpConfig> {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return {};
    }
    const content = fs.readFileSync(CONFIG_FILE, "utf-8");
    const config = JSON.parse(content);
    return {
      endpoint: config.endpoint,
      token: config.token,
      agentId: config.agentId,
    };
  } catch {
    return {};
  }
}

/**
 * Save configuration to config file
 */
export function saveToFile(config: McpConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/**
 * Load configuration with fallback chain:
 * 1. Environment variables (highest priority)
 * 2. Config file
 * 3. Defaults
 */
export function loadConfig(): McpConfig {
  const envConfig = loadFromEnv();
  const fileConfig = loadFromFile();

  const endpoint = envConfig.endpoint || fileConfig.endpoint || DEFAULT_ENDPOINT;
  const token = envConfig.token || fileConfig.token;
  const agentId = envConfig.agentId || fileConfig.agentId;

  if (!token) {
    throw new Error(
      "Missing token. Set AGENTGAZER_TOKEN environment variable or run 'agentgazer-mcp init'"
    );
  }

  if (!agentId) {
    throw new Error(
      "Missing agent ID. Set AGENTGAZER_AGENT_ID environment variable or run 'agentgazer-mcp init'"
    );
  }

  return { endpoint, token, agentId };
}

/**
 * Get config file path
 */
export function getConfigFilePath(): string {
  return CONFIG_FILE;
}
