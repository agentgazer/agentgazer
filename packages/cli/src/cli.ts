#!/usr/bin/env node

import * as path from "node:path";
import { ensureConfig, readConfig, resetToken, getDbPath, getConfigDir } from "./config.js";
import { startServer } from "@agenttrace/server";
import { startProxy } from "@agenttrace/proxy";

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseFlags(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "";
      }
    }
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`
AgentTrace — AI Agent Observability

Usage: agenttrace <command> [options]

Commands:
  onboard       First-time setup — generate token and show SDK snippet
  start         Start the server, proxy, and dashboard
  status        Show current configuration
  reset-token   Generate a new auth token

Options (for start):
  --port <number>            Server/dashboard port (default: 8080)
  --proxy-port <number>      LLM proxy port (default: 4000)
  --retention-days <number>  Data retention period in days (default: 30)
  --no-open                  Don't auto-open browser

Examples:
  agenttrace onboard                    First-time setup
  agenttrace start                      Start with defaults
  agenttrace start --port 9090          Use custom server port
`);
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

function cmdOnboard(): void {
  const config = ensureConfig();
  const isNew = !readConfig();

  // Re-read to get the saved config
  const saved = ensureConfig();

  console.log(`
  AgentTrace — Setup Complete
  ───────────────────────────────────────

  Token:    ${saved.token}
  Config:   ${getConfigDir()}/config.json
  Database: ${getDbPath()}
  Server:   http://localhost:8080
  Proxy:    http://localhost:4000

  ───────────────────────────────────────

  Add this to your project to start tracking:

  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │  import { AgentTrace } from "@agenttrace/sdk";           │
  │                                                          │
  │  const at = AgentTrace.init({                            │
  │    apiKey: "${saved.token.slice(0, 20)}...",│
  │    agentId: "my-agent",                                  │
  │  });                                                     │
  │                                                          │
  │  at.track({                                              │
  │    provider: "openai",                                   │
  │    model: "gpt-4o",                                      │
  │    tokens: { input: 150, output: 50 },                   │
  │    latency_ms: 1200,                                     │
  │    status: 200,                                          │
  │  });                                                     │
  │                                                          │
  └──────────────────────────────────────────────────────────┘

  Or point your LLM client at the proxy:

    export OPENAI_BASE_URL=http://localhost:4000/v1

  Next: run "agenttrace start" to launch.
`);
}

function cmdStatus(): void {
  const config = readConfig();
  if (!config) {
    console.log("No configuration found. Run \"agenttrace onboard\" first.");
    process.exit(1);
  }

  console.log(`
  AgentTrace — Status
  ───────────────────────────────────────

  Token:    ${config.token.slice(0, 16)}...
  Config:   ${getConfigDir()}/config.json
  Database: ${getDbPath()}
  Server:   http://localhost:8080 (default)
  Proxy:    http://localhost:4000 (default)
`);
}

function cmdResetToken(): void {
  const config = resetToken();
  console.log(`Token reset. New token: ${config.token}`);
}

async function cmdStart(flags: Record<string, string>): Promise<void> {
  const config = ensureConfig();

  const serverPort = flags["port"] ? parseInt(flags["port"], 10) : 8080;
  const proxyPort = flags["proxy-port"]
    ? parseInt(flags["proxy-port"], 10)
    : 4000;

  if (isNaN(serverPort) || serverPort < 1 || serverPort > 65535) {
    console.error("Error: --port must be a valid port number (1-65535)");
    process.exit(1);
  }

  if (isNaN(proxyPort) || proxyPort < 1 || proxyPort > 65535) {
    console.error("Error: --proxy-port must be a valid port number (1-65535)");
    process.exit(1);
  }

  const retentionDays = flags["retention-days"]
    ? parseInt(flags["retention-days"], 10)
    : 30;

  if (isNaN(retentionDays) || retentionDays < 1) {
    console.error("Error: --retention-days must be a positive integer");
    process.exit(1);
  }

  // Resolve dashboard directory
  let dashboardDir: string | undefined;
  const possibleDashboardPaths = [
    path.resolve(__dirname, "dashboard"),
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
  const { shutdown: shutdownServer } = await startServer({
    port: serverPort,
    token: config.token,
    dbPath: getDbPath(),
    dashboardDir,
    retentionDays,
  });

  // Start the LLM proxy
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
  ║                                          ║
  ╚══════════════════════════════════════════╝
`);

  // Auto-open browser unless --no-open
  if (!("no-open" in flags)) {
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const subcommand = process.argv[2];
  const flags = parseFlags(process.argv.slice(3));

  switch (subcommand) {
    case "onboard":
      cmdOnboard();
      break;
    case "start":
      await cmdStart(flags);
      break;
    case "status":
      cmdStatus();
      break;
    case "reset-token":
      cmdResetToken();
      break;
    case "--help":
    case "-h":
    case "help":
    case undefined:
      printUsage();
      break;
    default:
      console.error(`Unknown command: ${subcommand}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
