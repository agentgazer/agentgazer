/**
 * @agentgazer/mcp - MCP server for AI agent cost awareness
 */

export { AgentGazerClient, type AgentGazerClientConfig } from "./client.js";
export { createMcpServer, runMcpServer, type McpServerConfig } from "./server.js";
export { loadConfig, saveToFile, getConfigFilePath, type McpConfig } from "./config.js";
