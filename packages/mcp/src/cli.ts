#!/usr/bin/env node
/**
 * AgentGazer MCP CLI entry point
 */

import { loadConfig, saveToFile, getConfigFilePath, type McpConfig } from "./config.js";
import { runMcpServer } from "./server.js";
import * as readline from "node:readline";

const VERSION = "0.5.5";

function printHelp(): void {
  console.log(`
AgentGazer MCP Server v${VERSION}

Usage:
  agentgazer-mcp              Start MCP server (stdio mode)
  agentgazer-mcp init         Interactive configuration setup
  agentgazer-mcp --version    Show version
  agentgazer-mcp --help       Show this help

Environment Variables:
  AGENTGAZER_ENDPOINT   AgentGazer server URL (default: http://localhost:18880)
  AGENTGAZER_TOKEN      API token for authentication (required)
  AGENTGAZER_AGENT_ID   Agent identifier (required)

Configuration File:
  ${getConfigFilePath()}

Examples:
  # Start MCP server with environment variables
  AGENTGAZER_TOKEN=ag_xxx AGENTGAZER_AGENT_ID=my-agent agentgazer-mcp

  # Interactive setup
  agentgazer-mcp init

  # Non-interactive setup
  agentgazer-mcp init --endpoint http://192.168.1.2:18880 --token ag_xxx --agent-id dev-1
`);
}

function printVersion(): void {
  console.log(VERSION);
}

async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const defaultStr = defaultValue ? ` (${defaultValue})` : "";
    rl.question(`${question}${defaultStr}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

async function runInit(args: string[]): Promise<void> {
  // Parse command line flags
  let endpoint: string | undefined;
  let token: string | undefined;
  let agentId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--endpoint" && args[i + 1]) {
      endpoint = args[++i];
    } else if (arg === "--token" && args[i + 1]) {
      token = args[++i];
    } else if (arg === "--agent-id" && args[i + 1]) {
      agentId = args[++i];
    }
  }

  // If all flags provided, skip interactive mode
  if (endpoint && token && agentId) {
    const config: McpConfig = { endpoint, token, agentId };
    saveToFile(config);
    console.log(`Configuration saved to ${getConfigFilePath()}`);
    return;
  }

  // Interactive mode
  console.log("AgentGazer MCP Configuration\n");

  endpoint = endpoint || await prompt("AgentGazer endpoint", "http://localhost:18880");
  token = token || await prompt("API token (from 'agentgazer status')");
  agentId = agentId || await prompt("Agent ID (unique identifier for this agent)");

  if (!token) {
    console.error("Error: Token is required");
    process.exit(1);
  }
  if (!agentId) {
    console.error("Error: Agent ID is required");
    process.exit(1);
  }

  const config: McpConfig = { endpoint, token, agentId };
  saveToFile(config);
  console.log(`\nConfiguration saved to ${getConfigFilePath()}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle flags
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    printVersion();
    process.exit(0);
  }

  // Handle subcommands
  const command = args[0];

  if (command === "init") {
    await runInit(args.slice(1));
    process.exit(0);
  }

  // Default: start MCP server
  try {
    const config = loadConfig();
    await runMcpServer(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
