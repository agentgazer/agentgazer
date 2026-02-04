#!/usr/bin/env node

import * as path from "node:path";
import * as readline from "node:readline";
import {
  ensureConfig,
  readConfig,
  resetToken,
  getDbPath,
  getConfigDir,
  setProvider,
  removeProvider,
  listProviders,
  type ProviderConfig,
} from "./config.js";
import { startServer } from "@agenttrace/server";
import { startProxy } from "@agenttrace/proxy";
import { KNOWN_PROVIDER_NAMES } from "@agenttrace/shared";

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
  onboard                     First-time setup — generate token and configure providers
  start                       Start the server, proxy, and dashboard
  status                      Show current configuration
  reset-token                 Generate a new auth token
  providers list              List configured providers
  providers set <name> <key>  Set/update a provider API key
  providers remove <name>     Remove a provider

Options (for start):
  --port <number>            Server/dashboard port (default: 8080)
  --proxy-port <number>      LLM proxy port (default: 4000)
  --retention-days <number>  Data retention period in days (default: 30)
  --no-open                  Don't auto-open browser

Examples:
  agenttrace onboard                           First-time setup
  agenttrace start                             Start with defaults
  agenttrace start --port 9090                 Use custom server port
  agenttrace providers set openai sk-xxx       Set OpenAI API key
  agenttrace providers list                    List configured providers
`);
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

const KNOWN_PROVIDERS = KNOWN_PROVIDER_NAMES;

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function cmdOnboard(): Promise<void> {
  const saved = ensureConfig();

  console.log(`
  AgentTrace — Setup
  ───────────────────────────────────────

  Token:    ${saved.token}
  Config:   ${getConfigDir()}/config.json
  Database: ${getDbPath()}
  Server:   http://localhost:8080
  Proxy:    http://localhost:4000

  ───────────────────────────────────────
`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("  Configure provider API keys (the proxy will inject these for you).");
    console.log(`  Available providers: ${KNOWN_PROVIDERS.join(", ")}\n`);

    for (const provider of KNOWN_PROVIDERS) {
      const key = await ask(rl, `  API key for ${provider} (press Enter to skip): `);
      if (!key) continue;

      const rateLimitAnswer = await ask(
        rl,
        `  Set rate limit for ${provider}? (e.g. "100/60" for 100 req per 60s, Enter to skip): `
      );

      const providerConfig: ProviderConfig = { apiKey: key };

      if (rateLimitAnswer) {
        const parts = rateLimitAnswer.split("/");
        if (parts.length === 2) {
          const maxRequests = parseInt(parts[0], 10);
          const windowSeconds = parseInt(parts[1], 10);
          if (!isNaN(maxRequests) && !isNaN(windowSeconds) && maxRequests > 0 && windowSeconds > 0) {
            providerConfig.rateLimit = { maxRequests, windowSeconds };
          }
        }
      }

      setProvider(provider, providerConfig);
      console.log(`  ✓ ${provider} configured.\n`);
    }
  } finally {
    rl.close();
  }

  // Re-read to show final state
  const finalConfig = readConfig() ?? saved;
  const providerCount = finalConfig.providers
    ? Object.keys(finalConfig.providers).length
    : 0;

  console.log(`
  ───────────────────────────────────────
  Setup complete. ${providerCount} provider(s) configured.
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

function cmdProviders(args: string[]): void {
  const action = args[0];

  switch (action) {
    case "list": {
      const providers = listProviders();
      const names = Object.keys(providers);
      if (names.length === 0) {
        console.log("No providers configured. Use \"agenttrace providers set <name> <key>\" to add one.");
        return;
      }
      console.log("\n  Configured providers:");
      console.log("  ───────────────────────────────────────");
      for (const name of names) {
        const p = providers[name];
        const maskedKey = p.apiKey.slice(0, 8) + "..." + p.apiKey.slice(-4);
        const rateInfo = p.rateLimit
          ? ` (rate limit: ${p.rateLimit.maxRequests} req / ${p.rateLimit.windowSeconds}s)`
          : "";
        console.log(`  ${name}: ${maskedKey}${rateInfo}`);
      }
      console.log();
      break;
    }
    case "set": {
      const name = args[1];
      const key = args[2];
      if (!name || !key) {
        console.error("Usage: agenttrace providers set <provider-name> <api-key>");
        process.exit(1);
      }
      setProvider(name, { apiKey: key });
      console.log(`Provider "${name}" configured.`);
      break;
    }
    case "remove": {
      const name = args[1];
      if (!name) {
        console.error("Usage: agenttrace providers remove <provider-name>");
        process.exit(1);
      }
      removeProvider(name);
      console.log(`Provider "${name}" removed.`);
      break;
    }
    default:
      console.error("Usage: agenttrace providers <list|set|remove>");
      process.exit(1);
  }
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

  if (serverPort < 1024) {
    console.warn("Warning: port %d may require elevated privileges on Unix systems.", serverPort);
  }
  if (proxyPort < 1024) {
    console.warn("Warning: proxy port %d may require elevated privileges on Unix systems.", proxyPort);
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

  // Build provider keys and rate limits from config
  const providerKeys: Record<string, string> = {};
  const rateLimits: Record<string, { maxRequests: number; windowSeconds: number }> = {};
  if (config.providers) {
    for (const [name, pConfig] of Object.entries(config.providers)) {
      providerKeys[name] = pConfig.apiKey;
      if (pConfig.rateLimit) {
        rateLimits[name] = pConfig.rateLimit;
      }
    }
  }

  // Start the LLM proxy
  const { shutdown: shutdownProxy } = startProxy({
    apiKey: config.token,
    agentId: "proxy",
    port: proxyPort,
    endpoint: `http://localhost:${serverPort}/api/events`,
    providerKeys,
    rateLimits,
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
      await cmdOnboard();
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
    case "providers":
      cmdProviders(process.argv.slice(3));
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
