#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import {
  ensureConfig,
  readConfig,
  resetToken,
  getDbPath,
  getConfigDir,
  setProvider,
  saveConfig,
  type ProviderConfig,
} from "./config.js";
import {
  detectSecretStore,
  migrateFromPlaintextConfig,
  loadProviderKeys,
  PROVIDER_SERVICE,
} from "./secret-store.js";
import { startServer } from "@agentgazer/server";
import { startProxy } from "@agentgazer/proxy";
import { KNOWN_PROVIDER_NAMES, validateProviderKey, type ProviderName } from "@agentgazer/shared";

// New command imports
import { cmdAgents } from "./commands/agents.js";
import { cmdAgent } from "./commands/agent.js";
import { cmdProviders } from "./commands/providers.js";
import { cmdProvider } from "./commands/provider.js";
// cmdOverview is imported dynamically to avoid ESM top-level await issues

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

function parsePositional(argv: string[]): string[] {
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        i++; // skip flag value
      }
    } else {
      positional.push(arg);
    }
  }
  return positional;
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`
AgentGazer — AI Agent Observability

Usage: agentgazer <command> [options]

Commands:
  onboard                     First-time setup — generate token and configure providers
  start                       Start the server, proxy, and dashboard
  status                      Show current configuration
  reset-token                 Generate a new auth token
  overview                    Launch real-time TUI dashboard

  agents                      List all registered agents
  agent <name> active         Activate an agent
  agent <name> deactive       Deactivate an agent
  agent <name> killswitch on|off  Toggle kill switch
  agent <name> delete         Delete agent and all data
  agent <name> stat           Show agent statistics
  agent <name> model          List model overrides
  agent <name> model-override <model>  Set model override

  providers                   List all configured providers
  provider add [name] [key]   Add provider (interactive if args omitted)
  provider <name> active      Activate a provider
  provider <name> deactive    Deactivate a provider
  provider <name> test-connection  Test API key validity
  provider <name> delete      Delete provider and key
  provider <name> models      List available models
  provider <name> stat        Show provider statistics

  version                     Show version
  doctor                      Check system health
  uninstall                   Remove AgentGazer (curl-installed only)
  help                        Show this help message

Options (for start):
  --port <number>            Server/dashboard port (default: 8080)
  --proxy-port <number>      LLM proxy port (default: 4000)
  --retention-days <number>  Data retention period in days (default: 30)
  --no-open                  Don't auto-open browser

Options (for agent/provider stat):
  --range <period>           Time range: 1h, 24h, 7d, 30d (default: 24h)

Options (for delete commands):
  --yes                      Skip confirmation prompts

Examples:
  agentgazer onboard                    First-time setup
  agentgazer start                      Start with defaults
  agentgazer overview                   Launch TUI dashboard
  agentgazer provider add openai        Add OpenAI (prompts for key)
  agentgazer agent my-bot stat          Show stats for my-bot
  agentgazer agent my-bot killswitch on Enable kill switch
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
  AgentGazer — Setup
  ───────────────────────────────────────

  Token:    ${saved.token}
  Config:   ${getConfigDir()}/config.json
  Database: ${getDbPath()}
  Server:   http://localhost:8080
  Proxy:    http://localhost:4000

  ───────────────────────────────────────
`);

  // Initialize secret store
  const { store, backendName } = await detectSecretStore(getConfigDir());
  console.log(`  Secret backend: ${backendName}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let providerCount = 0;

  try {
    console.log("  Configure provider API keys (the proxy will inject these for you).");
    console.log(`  Available providers: ${KNOWN_PROVIDERS.join(", ")}\n`);

    for (const provider of KNOWN_PROVIDERS) {
      const key = await ask(rl, `  API key for ${provider} (press Enter to skip): `);
      if (!key) continue;

      // Store API key in secret store
      await store.set(PROVIDER_SERVICE, provider, key);

      // Store provider entry in config.json (apiKey is empty — actual key is in secret store)
      const providerConfig: ProviderConfig = { apiKey: "" };
      setProvider(provider, providerConfig);

      providerCount++;
      console.log(`  ✓ ${provider} configured.\n`);
    }
  } finally {
    rl.close();
  }

  console.log(`
  ───────────────────────────────────────
  Setup complete. ${providerCount} provider(s) configured.
  ───────────────────────────────────────

  Add this to your project to start tracking:

  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │  import { AgentGazer } from "@agentgazer/sdk";           │
  │                                                          │
  │  const at = AgentGazer.init({                            │
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

  Or point your LLM client at the proxy (with auto API key injection):

    export OPENAI_BASE_URL=http://localhost:4000/openai/v1

  Next: run "agentgazer start" to launch.
`);
}


function cmdStatus(): void {
  const config = readConfig();
  if (!config) {
    console.log("No configuration found. Run \"agentgazer onboard\" first.");
    process.exit(1);
  }

  console.log(`
  AgentGazer — Status
  ───────────────────────────────────────

  Token:    ${config.token}
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

  // Initialize secret store first (needed for both server and proxy)
  const configDir = getConfigDir();
  const configPath = path.join(configDir, "config.json");

  const { store, backendName } = await detectSecretStore(configDir);

  // Start the local server
  const { db, shutdown: shutdownServer } = await startServer({
    port: serverPort,
    token: config.token,
    dbPath: getDbPath(),
    dashboardDir,
    retentionDays,
    secretStore: store,
  });
  console.log(`  Secret backend: ${backendName}`);

  // Auto-migrate plaintext keys from config.json to secret store
  const migratedCount = await migrateFromPlaintextConfig(configPath, store);
  if (migratedCount > 0) {
    console.log(`  Migrated ${migratedCount} provider key(s) from config.json to secret store.`);
  }

  // Load provider keys from secret store
  const providerKeys = await loadProviderKeys(store);

  // Start the LLM proxy (with db for policy enforcement and rate limits)
  const { shutdown: shutdownProxy } = startProxy({
    apiKey: config.token,
    agentId: "proxy",
    port: proxyPort,
    endpoint: `http://localhost:${serverPort}/api/events`,
    providerKeys,
    db, // Rate limits are loaded from db
  });

  console.log(`
  ╔════════════════════════════════════════════════════╗
  ║              AgentGazer running                    ║
  ╠════════════════════════════════════════════════════╣
  ║                                                    ║
  ║  Dashboard:  http://localhost:${String(serverPort).padEnd(5)}                ║
  ║  Proxy:      http://localhost:${String(proxyPort).padEnd(5)}                ║
  ║                                                    ║
  ║  Token:      ${config.token.padEnd(32)}    ║
  ║                                                    ║
  ╚════════════════════════════════════════════════════╝

  Proxy routes:  http://localhost:${proxyPort}/{provider}/...
  Providers:     ${KNOWN_PROVIDER_NAMES.join(", ")}
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

  // Clean up listeners once shutdown completes to prevent leaks on restart
  process.once("exit", () => {
    process.removeListener("SIGINT", handleShutdown);
    process.removeListener("SIGTERM", handleShutdown);
  });
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

function cmdVersion(): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require(path.resolve(__dirname, "../package.json")) as { version: string };
  console.log(`agentgazer ${pkg.version}`);
}

async function cmdDoctor(flags: Record<string, string>): Promise<void> {
  const port = flags["port"] ? parseInt(flags["port"], 10) : 8080;
  const proxyPort = flags["proxy-port"]
    ? parseInt(flags["proxy-port"], 10)
    : 4000;

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error("Error: --port must be a valid port number (1-65535)");
    process.exit(1);
  }
  if (isNaN(proxyPort) || proxyPort < 1 || proxyPort > 65535) {
    console.error("Error: --proxy-port must be a valid port number (1-65535)");
    process.exit(1);
  }

  console.log(`
  AgentGazer — Doctor
  ───────────────────────────────────────
`);

  let passed = 0;
  const total = 6;

  // 1. Config file exists
  const config = readConfig();
  if (config) {
    console.log("  ✓ Config file exists");
    passed++;
  } else {
    console.log("  ✗ Config file missing");
  }

  // 2. Auth token set
  if (config?.token) {
    console.log("  ✓ Auth token set");
    passed++;
  } else {
    console.log("  ✗ Auth token not set");
  }

  // 3. Database file exists
  if (fs.existsSync(getDbPath())) {
    console.log("  ✓ Database file exists");
    passed++;
  } else {
    console.log("  ✗ Database file missing");
  }

  // 4. Secret store accessible
  try {
    const { store } = await detectSecretStore(getConfigDir());
    if (await store.isAvailable()) {
      console.log("  ✓ Secret store accessible");
      passed++;
    } else {
      console.log("  ✗ Secret store not accessible");
    }
  } catch {
    console.log("  ✗ Secret store not accessible");
  }

  // 5. Server responding
  try {
    const res = await fetch(`http://localhost:${port}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      console.log(`  ✓ Server responding (http://localhost:${port})`);
      passed++;
    } else {
      console.log(`  ✗ Server not responding (http://localhost:${port})`);
    }
  } catch {
    console.log(`  ✗ Server not responding (http://localhost:${port})`);
  }

  // 6. Proxy responding
  try {
    await fetch(`http://localhost:${proxyPort}/`, {
      signal: AbortSignal.timeout(3000),
    });
    // Any response (even 4xx) means it's up
    console.log(`  ✓ Proxy responding (http://localhost:${proxyPort})`);
    passed++;
  } catch {
    console.log(`  ✗ Proxy not responding (http://localhost:${proxyPort})`);
  }

  console.log(`\n  ${passed}/${total} checks passed.`);
}


// ---------------------------------------------------------------------------
// Uninstall
// ---------------------------------------------------------------------------

async function cmdUninstall(flags: Record<string, string>): Promise<void> {
  const home = process.env.AGENTGAZER_HOME || path.join(require("os").homedir(), ".agentgazer");
  const libDir = path.join(home, "lib");
  const nodeDir = path.join(home, "node");
  const wrapperPath = path.join(process.env.AGENTGAZER_BIN || "/usr/local/bin", "agentgazer");

  // Detect install method
  if (!fs.existsSync(libDir)) {
    console.log('AgentGazer was not installed via the install script.');
    console.log('');
    console.log('  If installed via npm:');
    console.log('    npm uninstall -g agentgazer');
    console.log('');
    console.log('  If installed via Homebrew:');
    console.log('    brew uninstall agentgazer');
    console.log('');
    return;
  }

  const skipPrompt = "yes" in flags;

  console.log(`
  AgentGazer — Uninstall
  ───────────────────────────────────────
`);

  // Remove embedded Node.js
  if (fs.existsSync(nodeDir)) {
    fs.rmSync(nodeDir, { recursive: true, force: true });
    console.log(`  ✓ Removed embedded Node.js (${nodeDir})`);
  }

  // Remove lib
  fs.rmSync(libDir, { recursive: true, force: true });
  console.log(`  ✓ Removed installation (${libDir})`);

  // Remove wrapper
  if (fs.existsSync(wrapperPath)) {
    try {
      fs.unlinkSync(wrapperPath);
      console.log(`  ✓ Removed wrapper (${wrapperPath})`);
    } catch {
      console.log(`  ! Could not remove ${wrapperPath} — try: sudo rm ${wrapperPath}`);
    }
  }

  // Handle user data
  const configPath = path.join(home, "config.json");
  const dbPath = path.join(home, "data.db");
  const hasData = fs.existsSync(configPath) || fs.existsSync(dbPath);

  if (hasData) {
    let removeData = skipPrompt;

    if (!skipPrompt) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await ask(rl, "\n  Remove user data (config.json, data.db)? [y/N] ");
      rl.close();
      removeData = /^y(es)?$/i.test(answer);
    }

    if (removeData) {
      fs.rmSync(home, { recursive: true, force: true });
      console.log(`  ✓ Removed all data (${home})`);
    } else {
      console.log(`  → User data preserved at ${home}`);
    }
  }

  console.log("\n  ✓ AgentGazer uninstalled.\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const subcommand = process.argv[2];
  const allArgs = process.argv.slice(3);
  const flags = parseFlags(allArgs);
  const positional = parsePositional(allArgs);
  const port = flags["port"] ? parseInt(flags["port"], 10) : 8080;

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
    case "overview": {
      const { cmdOverview } = await import("./commands/overview.js");
      await cmdOverview(port);
      break;
    }
    case "agents":
      await cmdAgents(port);
      break;
    case "agent":
      await cmdAgent(positional[0], positional[1], positional.slice(2), flags);
      break;
    case "providers":
      await cmdProviders(port);
      break;
    case "provider":
      await cmdProvider(positional[0], positional.slice(1), flags);
      break;
    case "version":
      cmdVersion();
      break;
    case "doctor":
      await cmdDoctor(flags);
      break;
    case "uninstall":
      await cmdUninstall(flags);
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
