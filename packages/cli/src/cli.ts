#!/usr/bin/env node

import * as path from "node:path";
import { ensureConfig, resetToken, getDbPath } from "./config.js";
import { startServer } from "@agenttrace/server";
import { startProxy } from "@agenttrace/proxy";

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = "";
      }
    }
  }
  return args;
}

function printUsage(): void {
  console.log(`
AgentTrace — AI Agent Observability

Usage: agenttrace [options]

Options:
  --port <number>        Server/dashboard port (default: 8080)
  --proxy-port <number>  LLM proxy port (default: 4000)
  --no-open              Don't auto-open browser
  --reset-token          Generate a new auth token and exit
  --help                 Show this help message

Examples:
  agenttrace                          Start with defaults
  agenttrace --port 9090              Use custom server port
  agenttrace --no-open                Start without opening browser
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if ("help" in args) {
    printUsage();
    process.exit(0);
  }

  if ("reset-token" in args) {
    const config = resetToken();
    console.log(`Token reset. New token: ${config.token}`);
    process.exit(0);
  }

  // Initialize config (generates token on first run)
  const config = ensureConfig();

  const serverPort = args["port"] ? parseInt(args["port"], 10) : 8080;
  const proxyPort = args["proxy-port"]
    ? parseInt(args["proxy-port"], 10)
    : 4000;

  if (isNaN(serverPort) || serverPort < 1 || serverPort > 65535) {
    console.error("Error: --port must be a valid port number (1-65535)");
    process.exit(1);
  }

  if (isNaN(proxyPort) || proxyPort < 1 || proxyPort > 65535) {
    console.error(
      "Error: --proxy-port must be a valid port number (1-65535)",
    );
    process.exit(1);
  }

  // Resolve the dashboard dist directory
  // In the built package, dashboard files are at ../dashboard-local/dist relative to this file
  // We try multiple possible locations
  let dashboardDir: string | undefined;
  const possibleDashboardPaths = [
    path.resolve(__dirname, "../../dashboard-local/dist"),
    path.resolve(__dirname, "../../../apps/dashboard-local/dist"),
  ];

  for (const p of possibleDashboardPaths) {
    try {
      const fs = await import("node:fs");
      if (fs.existsSync(path.join(p, "index.html"))) {
        dashboardDir = p;
        break;
      }
    } catch {
      // ignore
    }
  }

  // Start the local server
  const { server, shutdown: shutdownServer } = await startServer({
    port: serverPort,
    token: config.token,
    dbPath: getDbPath(),
    dashboardDir,
  });

  // Start the LLM proxy, pointing events to the local server
  const { shutdown: shutdownProxy } = startProxy({
    apiKey: config.token,
    agentId: "proxy",
    port: proxyPort,
    endpoint: `http://localhost:${serverPort}/api/events`,
  });

  console.log(`
  ╔══════════════════════════════════════════╗
  ║           AgentTrace running             ║
  ╠══════════════════════════════════════════╣
  ║                                          ║
  ║  Dashboard:  http://localhost:${String(serverPort).padEnd(5)}      ║
  ║  Proxy:      http://localhost:${String(proxyPort).padEnd(5)}      ║
  ║                                          ║
  ║  Token:      ${config.token.slice(0, 16)}...      ║
  ║  (full token in ~/.agenttrace/config.json)║
  ║                                          ║
  ╚══════════════════════════════════════════╝
`);

  // Auto-open browser unless --no-open
  if (!("no-open" in args)) {
    try {
      const open = await import("open");
      await open.default(`http://localhost:${serverPort}`);
    } catch {
      // Silently fail if browser can't be opened
    }
  }

  // Graceful shutdown
  let shuttingDown = false;

  function handleShutdown(): void {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\nShutting down...");

    Promise.all([shutdownProxy(), shutdownServer()])
      .then(() => {
        console.log("Shutdown complete.");
        process.exit(0);
      })
      .catch((err) => {
        console.error("Error during shutdown:", err);
        process.exit(1);
      });
  }

  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
