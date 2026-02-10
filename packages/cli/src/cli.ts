#!/usr/bin/env node

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
import { KNOWN_PROVIDER_NAMES, PROVIDER_DISPLAY_NAMES, validateProviderKey, type ProviderName } from "@agentgazer/shared";

// New command imports
import { cmdAgents } from "./commands/agents.js";
import { cmdAgent } from "./commands/agent.js";
import { cmdProviders } from "./commands/providers.js";
import { cmdProvider } from "./commands/provider.js";
import { cmdEvents } from "./commands/events.js";
// cmdOverview is imported dynamically to avoid ESM top-level await issues

// ---------------------------------------------------------------------------
// ASCII Logo with ANSI colors
// ---------------------------------------------------------------------------

const BLUE = "\x1b[34m";
const BOLD = "\x1b[1m";
const GRAY = "\x1b[90m";
const RESET = "\x1b[0m";

// Read version from package.json
const pkgPath = path.resolve(__dirname, "../package.json");
const CLI_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { version: string };
    return pkg.version;
  } catch {
    return "unknown";
  }
})();

const ASCII_LOGO = `
${BLUE}       .-===-.${RESET}
${BLUE}      / /   \\ \\${RESET}
${BLUE}     | |     | |${RESET}    ${BOLD}AgentGazer${RESET} ${GRAY}v${CLI_VERSION}${RESET}
${BLUE}      \\ \\   / /${RESET}     ${GRAY}From Observability to Control${RESET}
${BLUE}       '-===-'${RESET}
`;

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
      if (next !== undefined && !next.startsWith("-")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "";
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      // Short flags like -v, -d, or short flags with values like -o json
      const key = arg.slice(1);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("-")) {
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
// Port utilities
// ---------------------------------------------------------------------------

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

async function findAvailablePort(startPort: number, maxAttempts: number = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + maxAttempts - 1}`);
}

/**
 * Find PIDs of processes listening on the given ports.
 * Uses lsof on macOS/Linux. Returns empty array on error.
 */
function findPidsOnPorts(ports: number[]): number[] {
  const pids: Set<number> = new Set();
  for (const port of ports) {
    try {
      const result = execSync(`lsof -ti:${port} 2>/dev/null`, { encoding: "utf-8" });
      for (const line of result.trim().split("\n")) {
        const pid = parseInt(line.trim(), 10);
        if (!isNaN(pid) && pid > 0) {
          pids.add(pid);
        }
      }
    } catch {
      // No process on this port or lsof not available
    }
  }
  return Array.from(pids);
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
  stop                        Stop the daemon process
  logs                        Show daemon logs (use -f to follow)
  status                      Show current configuration
  reset-token                 Generate a new auth token
  overview                    Launch real-time TUI dashboard
  events                      Query and display agent events

  agents                      List all registered agents
  agent <name> active         Activate an agent
  agent <name> deactive       Deactivate an agent
  agent <name> killswitch on|off  Toggle kill switch
  agent <name> delete         Delete agent and all data
  agent <name> stat           Show agent statistics
  agent <name> model          List model overrides
  agent <name> model-override <model>  Set model override
  agent <name> alerts         List alert rules for agent
  agent <name> alert add <type>  Add alert rule (agent_down, error_rate, budget)
  agent <name> alert delete <id>  Delete alert rule
  agent <name> alert reset <id>   Reset alert state to normal

  providers                   List all configured providers
  provider add [name] [key]   Add provider (interactive if args omitted)
  provider <name> active      Activate a provider
  provider <name> deactive    Deactivate a provider
  provider <name> test-connection  Test API key validity
  provider <name> delete      Delete provider and key
  provider <name> models      List available models
  provider <name> stat        Show provider statistics

  version                     Show version
  update                      Update to latest version (preserves settings)
  doctor                      Check system health
  uninstall                   Remove AgentGazer data (interactive menu)
  help                        Show this help message

Options (for start):
  --port <number>            Server/dashboard port (default: 18800, or config.server.port)
  --proxy-port <number>      LLM proxy port (default: 18900, or config.server.proxyPort)
  --retention-days <number>  Data retention in days (default: 30, or config.data.retentionDays)
  --no-open                  Don't auto-open browser (or set config.server.autoOpen: false)
  -v, --verbose              Print verbose logs to console
  -d, --daemon               Print info and token, then run in background

Config file: ~/.agentgazer/config.json (optional settings: port, proxyPort, autoOpen, retentionDays)

Options (for agent/provider stat):
  --range <period>           Time range: 1h, 24h, 7d, 30d (default: 24h)

Options (for delete commands):
  --yes                      Skip confirmation prompts

Options (for alert add):
  --threshold <percent>      Error rate threshold (error_rate only, default: 10)
  --timeout <seconds>        Timeout in seconds (agent_down only, default: 300)
  --limit <amount>           Budget limit in USD (budget only, required)
  --period <period>          Budget period: daily, weekly, monthly (budget only)
  --repeat                   Enable repeat notifications (default: enabled)
  --no-repeat                Disable repeat notifications (one-time only)
  --interval <minutes>       Repeat interval in minutes (default: 15)
  --recovery-notify          Send notification when alert recovers
  --webhook <url>            Webhook URL for notifications
  --telegram <chat_id>       Telegram chat ID for notifications

Options (for logs):
  -f, --follow               Follow log output (like tail -f)
  -n, --lines <number>       Number of lines to show (default: 50)

Options (for events):
  -a, --agent <name>         Filter by agent ID
  -t, --type <type>          Filter by event type
  -p, --provider <name>      Filter by provider
  -s, --since <duration>     Time range: 1h, 24h, 7d, 30d (default: 24h)
  -n, --limit <number>       Max events (default: 50, max: 1000)
  -o, --output <format>      Output: table, json, csv (default: table)
      --search <term>        Search in model/provider/error
  -f, --follow               Poll for new events every 3s

Options (for uninstall):
  --all                      Remove everything (keys, config, data)
  --config                   Remove config only
  --keys                     Remove provider keys only
  --data                     Remove agent data only
  --yes                      Skip confirmation prompts

Examples:
  agentgazer onboard                    First-time setup
  agentgazer start                      Start with defaults
  agentgazer start -d                   Start as daemon (background)
  agentgazer stop                       Stop the daemon
  agentgazer logs -f                    Follow daemon logs
  agentgazer overview                   Launch TUI dashboard
  agentgazer provider add openai        Add OpenAI (prompts for key)
  agentgazer agent my-bot stat          Show stats for my-bot
  agentgazer agent my-bot killswitch on Enable kill switch
  agentgazer events                     Show recent events
  agentgazer events -a my-bot -t error  Filter by agent and type
  agentgazer events -f                  Follow new events live
  agentgazer agent my-bot alerts        List alerts for my-bot
  agentgazer agent my-bot alert add error_rate --threshold 20
  agentgazer agent my-bot alert add budget --limit 50 --period daily
  agentgazer agent my-bot alert reset abc  Reset alert state
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

function askSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);

    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let input = "";

    const onData = (char: string) => {
      const code = char.charCodeAt(0);

      if (code === 13 || code === 10) {
        // Enter
        stdin.setRawMode(wasRaw ?? false);
        stdin.removeListener("data", onData);
        stdin.pause();
        process.stdout.write("\n");
        resolve(input.trim());
      } else if (code === 127 || code === 8) {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else if (code === 3) {
        // Ctrl+C
        stdin.setRawMode(wasRaw ?? false);
        process.exit(0);
      } else if (code >= 32) {
        // Printable character
        input += char;
        process.stdout.write("*");
      }
    };

    stdin.on("data", onData);
  });
}

async function cmdOnboard(): Promise<void> {
  const saved = ensureConfig();

  console.log(ASCII_LOGO);
  console.log(`  ───────────────────────────────────────

  Token:    ${saved.token}
  Config:   ${getConfigDir()}/config.json
  Database: ${getDbPath()}
  Server:   http://localhost:18800
  Proxy:    http://localhost:18900

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
    const providerList = KNOWN_PROVIDERS.map(p => PROVIDER_DISPLAY_NAMES[p] || p).join(", ");
    console.log(`  Available: ${providerList}\n`);

    for (const provider of KNOWN_PROVIDERS) {
      const displayName = PROVIDER_DISPLAY_NAMES[provider] || provider;
      const key = await askSecret(`  API key for ${displayName} (Enter to skip): `);
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

    export OPENAI_BASE_URL=http://localhost:18900/openai/v1

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
  Server:   http://localhost:18800 (default)
  Proxy:    http://localhost:18900 (default)
`);
}

function cmdResetToken(): void {
  const config = resetToken();
  console.log(`Token reset. New token: ${config.token}`);
}

async function cmdStart(flags: Record<string, string>): Promise<void> {
  const verbose = "v" in flags || "verbose" in flags;
  const daemon = "d" in flags || "daemon" in flags;

  // Set log level for verbose mode
  if (verbose) {
    process.env.LOG_LEVEL = "debug";
  }

  // Handle daemon mode: fork process and exit
  if (daemon && !process.env.AGENTGAZER_DAEMON_CHILD) {
    const { spawn } = await import("node:child_process");
    const configDir = getConfigDir();
    const pidFile = path.join(configDir, "agentgazer.pid");
    const logFile = path.join(configDir, "agentgazer.log");

    // Check if already running
    if (fs.existsSync(pidFile)) {
      const existingPid = parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
      try {
        process.kill(existingPid, 0); // Check if process exists
        console.error(`AgentGazer is already running (PID: ${existingPid})`);
        console.error(`Use "agentgazer stop" to stop it first.`);
        process.exit(1);
      } catch {
        // Process doesn't exist, clean up stale PID file
        fs.unlinkSync(pidFile);
      }
    }

    // Open log file for output
    const logFd = fs.openSync(logFile, "a");

    const args = process.argv.slice(2).filter((a) => a !== "-d" && a !== "--daemon");
    const child = spawn(process.execPath, [process.argv[1], ...args], {
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: { ...process.env, AGENTGAZER_DAEMON_CHILD: "1" },
    });
    child.unref();
    fs.closeSync(logFd);

    // Write PID file
    fs.writeFileSync(pidFile, String(child.pid));

    const config = ensureConfig();
    // Use config values as defaults for daemon mode display
    const serverPort = flags["port"] ? parseInt(flags["port"], 10) : (config.server?.port ?? 18800);
    const proxyPort = flags["proxy-port"] ? parseInt(flags["proxy-port"], 10) : (config.server?.proxyPort ?? 18900);

    console.log(`
  ╔════════════════════════════════════════════════════╗
  ║          AgentGazer v${CLI_VERSION.padEnd(7)} (daemon)              ║
  ╠════════════════════════════════════════════════════╣
  ║                                                    ║
  ║  Dashboard:  http://localhost:${String(serverPort).padEnd(5)}                ║
  ║  Proxy:      http://localhost:${String(proxyPort).padEnd(5)}                ║
  ║                                                    ║
  ║  Token:      ${config.token.padEnd(32)}    ║
  ║                                                    ║
  ╚════════════════════════════════════════════════════╝

  Process running in background (PID: ${child.pid})
  Logs:    ${logFile}

  To stop:  agentgazer stop
  To logs:  agentgazer logs -f
`);
    process.exit(0);
  }

  const config = ensureConfig();

  // Use config values as defaults, CLI flags override
  const defaultPort = config.server?.port ?? 18800;
  const defaultProxyPort = config.server?.proxyPort ?? 18900;
  const defaultRetentionDays = config.data?.retentionDays ?? 30;
  const defaultAutoOpen = config.server?.autoOpen ?? true;

  const requestedServerPort = flags["port"] ? parseInt(flags["port"], 10) : defaultPort;
  const proxyPort = flags["proxy-port"]
    ? parseInt(flags["proxy-port"], 10)
    : defaultProxyPort;

  if (isNaN(requestedServerPort) || requestedServerPort < 1 || requestedServerPort > 65535) {
    console.error("Error: --port must be a valid port number (1-65535)");
    process.exit(1);
  }

  if (isNaN(proxyPort) || proxyPort < 1 || proxyPort > 65535) {
    console.error("Error: --proxy-port must be a valid port number (1-65535)");
    process.exit(1);
  }

  if (requestedServerPort < 1024) {
    console.warn("Warning: port %d may require elevated privileges on Unix systems.", requestedServerPort);
  }
  if (proxyPort < 1024) {
    console.warn("Warning: proxy port %d may require elevated privileges on Unix systems.", proxyPort);
  }

  // Check if proxy port is available (no auto-switching for proxy)
  if (!(await isPortAvailable(proxyPort))) {
    console.error(`Error: Proxy port ${proxyPort} is already in use.`);
    console.error("  The proxy port must be fixed for OpenClaw configuration to work.");
    console.error("  Please stop the process using this port or specify a different port with --proxy-port <number>");
    process.exit(1);
  }

  // Find available port for dashboard (auto-increment if in use)
  let serverPort: number;
  try {
    serverPort = await findAvailablePort(requestedServerPort);
    if (serverPort !== requestedServerPort) {
      console.log(`  Dashboard port ${requestedServerPort} is in use, using ${serverPort} instead.`);
    }
  } catch {
    console.error(`Error: Could not find available port starting from ${requestedServerPort}`);
    console.error("  Try specifying a different port with --port <number>");
    process.exit(1);
  }

  const retentionDays = flags["retention-days"]
    ? parseInt(flags["retention-days"], 10)
    : defaultRetentionDays;

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
    configPath,
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
    secretStore: store, // For hot-reloading provider keys
  });

  const modeLabel = verbose ? "(verbose)" : "";
  console.log(`
  ╔════════════════════════════════════════════════════╗
  ║          AgentGazer v${CLI_VERSION.padEnd(7)} running ${modeLabel.padEnd(9)}    ║
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

  // Auto-open browser unless --no-open flag or autoOpen=false in config
  const shouldAutoOpen = !("no-open" in flags) && defaultAutoOpen;
  if (shouldAutoOpen) {
    try {
      const open = await import("open");
      await open.default(`http://localhost:${serverPort}`);
    } catch {
      // Silently fail if browser can't be opened
    }
  }

  // Graceful shutdown
  let shuttingDown = false;
  let forceExitTimeout: ReturnType<typeof setTimeout> | null = null;
  const pidFile = path.join(configDir, "agentgazer.pid");

  function handleShutdown(): void {
    if (shuttingDown) {
      // Second Ctrl+C: force exit immediately
      console.log("\nForce exiting...");
      process.exit(1);
    }
    shuttingDown = true;
    console.log("\nShutting down... (press Ctrl+C again to force exit)");

    // Force exit after 5 seconds if graceful shutdown hangs
    forceExitTimeout = setTimeout(() => {
      console.error("Shutdown timed out, forcing exit.");
      process.exit(1);
    }, 5000);
    forceExitTimeout.unref();

    Promise.all([shutdownProxy(), shutdownServer()])
      .then(() => {
        if (forceExitTimeout) clearTimeout(forceExitTimeout);
        // Clean up PID file if we're a daemon child
        if (process.env.AGENTGAZER_DAEMON_CHILD && fs.existsSync(pidFile)) {
          fs.unlinkSync(pidFile);
        }
        console.log("Shutdown complete.");
        process.exit(0);
      })
      .catch((err) => {
        if (forceExitTimeout) clearTimeout(forceExitTimeout);
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

async function cmdVersion(): Promise<void> {
  console.log(`agentgazer ${CLI_VERSION}`);
}

async function cmdUpdate(flags: Record<string, string>): Promise<void> {
  console.log(`\n  Current version: ${CLI_VERSION}`);
  console.log("  Checking for updates...\n");

  // Check latest version from npm
  let latestVersion: string;
  try {
    const res = await fetch("https://registry.npmjs.org/@agentgazer/cli/latest");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json() as { version: string };
    latestVersion = data.version;
  } catch (err) {
    console.error(`  Error checking npm registry: ${err}`);
    process.exit(1);
  }

  if (CLI_VERSION === latestVersion) {
    console.log(`  ✓ Already up to date (${CLI_VERSION})`);
    return;
  }

  console.log(`  New version available: ${latestVersion}`);

  // Detect installation method
  const execPath = process.argv[1];
  const isHomebrew = execPath.includes("/homebrew/") || execPath.includes("/Cellar/");
  const isGlobalNpm = execPath.includes("/lib/node_modules/") || execPath.includes("/npm/");

  if (isHomebrew) {
    console.log("\n  Detected: Homebrew installation");
    console.log("  Updating via Homebrew...\n");

    try {
      execSync("brew update && brew upgrade agentgazer/tap/agentgazer", {
        stdio: "inherit",
      });
      console.log("\n  ✓ Update complete!");
    } catch {
      console.error("\n  Update failed. Try manually:");
      console.error("    brew update && brew upgrade agentgazer/tap/agentgazer");
      process.exit(1);
    }
  } else if (isGlobalNpm) {
    console.log("\n  Detected: npm global installation");
    console.log("  Updating via npm...\n");

    try {
      execSync("npm install -g @agentgazer/cli@latest", {
        stdio: "inherit",
      });
      console.log("\n  ✓ Update complete!");
    } catch {
      console.error("\n  Update failed. Try manually:");
      console.error("    npm install -g @agentgazer/cli@latest");
      process.exit(1);
    }
  } else {
    // Check if there's a path mismatch (binary in one place, npm installs to another)
    let npmGlobalRoot = "";
    try {
      npmGlobalRoot = execSync("npm root -g", { encoding: "utf-8" }).trim();
    } catch {
      // Ignore
    }

    // Resolve the binary path (follow symlinks)
    let realBinPath = "";
    try {
      realBinPath = fs.realpathSync(execPath);
    } catch {
      realBinPath = execPath;
    }

    const binInNpmRoot = realBinPath.includes(npmGlobalRoot) || realBinPath.includes("/node_modules/@agentgazer/cli");

    if (npmGlobalRoot && !binInNpmRoot) {
      // Path mismatch detected - old binary not in current npm global location
      console.log("\n  Detected: Stale installation (binary location differs from npm global path)");
      console.log(`  Current binary: ${execPath}`);
      console.log(`  npm global root: ${npmGlobalRoot}`);
      console.log("\n  Cleaning up and reinstalling...\n");

      try {
        // Remove the old binary/symlink
        const binDir = path.dirname(execPath);
        const binName = path.basename(execPath);
        execSync(`rm -f "${path.join(binDir, binName)}"`, { stdio: "inherit" });

        // Install fresh
        execSync("npm install -g @agentgazer/cli@latest", { stdio: "inherit" });

        console.log("\n  ✓ Update complete!");
        console.log("  Note: You may need to open a new terminal or run 'hash -r' to refresh the command path.");
      } catch (err) {
        console.error("\n  Update failed. Try manually:");
        console.error(`    sudo rm ${execPath}`);
        console.error("    npm install -g @agentgazer/cli@latest");
        process.exit(1);
      }
    } else {
      // Unknown installation method
      console.log("\n  Could not detect installation method.");
      console.log("  Please update manually:\n");
      console.log("    npm:      npm install -g @agentgazer/cli@latest");
      console.log("    Homebrew: brew upgrade agentgazer/tap/agentgazer");
      console.log("    Docker:   docker pull ghcr.io/agentgazer/agentgazer:latest");
      process.exit(0);
    }
  }

  console.log("\n  Your settings in ~/.agentgazer/ have been preserved.");
}

async function cmdDoctor(flags: Record<string, string>): Promise<void> {
  const port = flags["port"] ? parseInt(flags["port"], 10) : 18800;
  const proxyPort = flags["proxy-port"]
    ? parseInt(flags["proxy-port"], 10)
    : 18900;

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

async function confirmPrompt(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await ask(rl, message);
  rl.close();
  return /^y(es)?$/i.test(answer);
}

async function stopDaemonIfRunning(): Promise<void> {
  const configDir = getConfigDir();
  const pidFile = path.join(configDir, "agentgazer.pid");

  if (!fs.existsSync(pidFile)) return;

  const pid = parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
  try {
    process.kill(pid, 0); // Check if process exists
  } catch {
    // Process doesn't exist, clean up stale PID file
    fs.unlinkSync(pidFile);
    return;
  }

  console.log("  Stopping AgentGazer daemon...");
  process.kill(pid, "SIGTERM");

  // Wait for process to exit (poll for up to 3 seconds)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      process.kill(pid, 0);
    } catch {
      if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
      console.log("  ✓ Daemon stopped");
      return;
    }
  }

  // Force kill
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // Already dead
  }
  if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
  console.log("  ✓ Daemon stopped (forced)");
}

async function removeProviderKeys(): Promise<void> {
  const configDir = getConfigDir();
  const { store } = await detectSecretStore(configDir);

  const providers = await store.list(PROVIDER_SERVICE);
  if (providers.length === 0) {
    console.log("  No provider keys found.");
    return;
  }

  console.log("  Removing provider keys...");
  for (const provider of providers) {
    try {
      await store.delete(PROVIDER_SERVICE, provider);
      console.log(`    ✓ ${provider}`);
    } catch (err) {
      console.log(`    ✗ ${provider}: ${err}`);
    }
  }
}

function removeConfig(): void {
  const configDir = getConfigDir();
  const configPath = path.join(configDir, "config.json");

  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
    console.log(`  ✓ Removed config (${configPath})`);
  } else {
    console.log("  Config file not found.");
  }
}

function removeAgentData(): void {
  const configDir = getConfigDir();
  const dbPath = path.join(configDir, "data.db");

  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
    fs.unlinkSync(dbPath);
    console.log(`  ✓ Removed database (${sizeMB} MB)`);
  } else {
    console.log("  Database file not found.");
  }
}

function removeLogFiles(): void {
  const configDir = getConfigDir();
  const logFile = path.join(configDir, "agentgazer.log");
  const pidFile = path.join(configDir, "agentgazer.pid");

  let removed = 0;
  if (fs.existsSync(logFile)) {
    fs.unlinkSync(logFile);
    removed++;
  }
  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile);
    removed++;
  }

  if (removed > 0) {
    console.log(`  ✓ Removed log files`);
  }
}

function detectInstallMethod(): "homebrew" | "npm" | "unknown" {
  const execPath = process.argv[1] || "";

  // Check if installed via Homebrew
  try {
    const brewPrefix = execSync("brew --prefix 2>/dev/null", { encoding: "utf-8" }).trim();
    if (execPath.includes(brewPrefix) || execPath.includes("/Cellar/")) {
      return "homebrew";
    }
    // Also check if brew knows about agentgazer
    try {
      execSync("brew list agentgazer 2>/dev/null", { encoding: "utf-8" });
      return "homebrew";
    } catch {
      // Not installed via brew
    }
  } catch {
    // Homebrew not installed
  }

  // Check if installed via npm
  try {
    const npmGlobalRoot = execSync("npm root -g", { encoding: "utf-8" }).trim();
    if (execPath.includes(npmGlobalRoot) || execPath.includes("node_modules/@agentgazer/cli")) {
      return "npm";
    }
    // Check if npm knows about the package
    try {
      execSync("npm list -g @agentgazer/cli 2>/dev/null", { encoding: "utf-8" });
      return "npm";
    } catch {
      // Not in npm global list
    }
  } catch {
    // npm not available
  }

  return "unknown";
}

async function uninstallBinary(): Promise<boolean> {
  const method = detectInstallMethod();

  console.log(`  Detecting installation method...`);

  if (method === "homebrew") {
    console.log(`  Found: Homebrew installation`);
    console.log(`  Running: brew uninstall agentgazer\n`);
    try {
      execSync("brew uninstall agentgazer", { stdio: "inherit" });
      console.log(`\n  ✓ Uninstalled via Homebrew`);
      return true;
    } catch (err) {
      console.error(`  ✗ Homebrew uninstall failed:`, err instanceof Error ? err.message : err);
      return false;
    }
  }

  if (method === "npm") {
    console.log(`  Found: npm global installation`);
    console.log(`  Running: npm uninstall -g @agentgazer/cli\n`);
    try {
      execSync("npm uninstall -g @agentgazer/cli", { stdio: "inherit" });
      console.log(`\n  ✓ Uninstalled via npm`);

      // Also check for stale binary like in update command
      const execPath = process.argv[1] || "";
      let realBinPath = "";
      try {
        realBinPath = fs.realpathSync(execPath);
      } catch {
        realBinPath = execPath;
      }

      // If there's a stale symlink or binary, remove it
      if (fs.existsSync(execPath) && !realBinPath.includes("node_modules")) {
        console.log(`  Cleaning up stale binary at ${execPath}...`);
        try {
          fs.unlinkSync(execPath);
          console.log(`  ✓ Removed stale binary`);
        } catch {
          console.log(`  Note: Could not remove ${execPath} - you may need to delete it manually`);
        }
      }

      return true;
    } catch (err) {
      console.error(`  ✗ npm uninstall failed:`, err instanceof Error ? err.message : err);
      return false;
    }
  }

  // Unknown installation method
  console.log(`  Could not detect installation method.`);
  console.log(`\n  Please try one of these commands manually:\n`);
  console.log(`    npm uninstall -g @agentgazer/cli`);
  console.log(`    brew uninstall agentgazer\n`);
  return false;
}

async function cmdUninstall(flags: Record<string, string>): Promise<void> {
  const configDir = getConfigDir();
  const skipPrompt = "yes" in flags;

  // Handle flags for scripting
  if ("all" in flags) {
    if (!skipPrompt) {
      const confirmed = await confirmPrompt("\n  This will remove ALL AgentGazer data and the binary. Continue? [y/N] ");
      if (!confirmed) {
        console.log("  Cancelled.");
        return;
      }
    }
    await stopDaemonIfRunning();
    await removeProviderKeys();
    removeConfig();
    removeAgentData();
    removeLogFiles();
    console.log("");
    await uninstallBinary();
    console.log("\n  AgentGazer has been completely removed.");
    return;
  }

  if ("config" in flags) {
    if (!skipPrompt) {
      const confirmed = await confirmPrompt("\n  Remove config file? [y/N] ");
      if (!confirmed) {
        console.log("  Cancelled.");
        return;
      }
    }
    await stopDaemonIfRunning();
    removeConfig();
    return;
  }

  if ("keys" in flags) {
    if (!skipPrompt) {
      const { store } = await detectSecretStore(configDir);
      const providers = await store.list(PROVIDER_SERVICE);
      if (providers.length === 0) {
        console.log("  No provider keys to remove.");
        return;
      }
      console.log(`\n  Provider keys to remove: ${providers.join(", ")}`);
      const confirmed = await confirmPrompt("  Continue? [y/N] ");
      if (!confirmed) {
        console.log("  Cancelled.");
        return;
      }
    }
    await removeProviderKeys();
    return;
  }

  if ("data" in flags) {
    if (!skipPrompt) {
      const dbPath = path.join(configDir, "data.db");
      if (!fs.existsSync(dbPath)) {
        console.log("  No database to remove.");
        return;
      }
      const confirmed = await confirmPrompt("\n  Remove agent data (database)? [y/N] ");
      if (!confirmed) {
        console.log("  Cancelled.");
        return;
      }
    }
    await stopDaemonIfRunning();
    removeAgentData();
    return;
  }

  // Interactive menu
  console.log(`
  AgentGazer — Uninstall
  ───────────────────────────────────────

  What would you like to remove?

    1. Complete uninstall (everything + binary)
    2. Binary only (auto-detects npm/homebrew)
    3. Config only (~/.agentgazer/config.json)
    4. Provider keys only (from secret store)
    5. Agent data only (~/.agentgazer/data.db)

`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const choice = await ask(rl, "  Select [1-5]: ");
  rl.close();

  console.log("");

  switch (choice) {
    case "1": {
      // Complete uninstall
      const confirmed = await confirmPrompt("  This will remove ALL AgentGazer data and the binary. Continue? [y/N] ");
      if (!confirmed) {
        console.log("  Cancelled.");
        return;
      }
      await stopDaemonIfRunning();
      await removeProviderKeys();
      removeConfig();
      removeAgentData();
      removeLogFiles();
      console.log("");
      await uninstallBinary();
      console.log("\n  AgentGazer has been completely removed.");
      break;
    }

    case "2": {
      // Binary only
      const confirmed = await confirmPrompt("  Remove agentgazer binary? [y/N] ");
      if (!confirmed) {
        console.log("  Cancelled.");
        return;
      }
      await uninstallBinary();
      break;
    }

    case "3": {
      // Config only
      const confirmed = await confirmPrompt("  Remove config file? [y/N] ");
      if (!confirmed) {
        console.log("  Cancelled.");
        return;
      }
      await stopDaemonIfRunning();
      removeConfig();
      break;
    }

    case "4": {
      // Provider keys only
      const { store } = await detectSecretStore(configDir);
      const providers = await store.list(PROVIDER_SERVICE);
      if (providers.length === 0) {
        console.log("  No provider keys to remove.");
        return;
      }
      console.log(`  Provider keys to remove: ${providers.join(", ")}`);
      const confirmed = await confirmPrompt("  Continue? [y/N] ");
      if (!confirmed) {
        console.log("  Cancelled.");
        return;
      }
      await removeProviderKeys();
      break;
    }

    case "5": {
      // Agent data only
      const dbPath = path.join(configDir, "data.db");
      if (!fs.existsSync(dbPath)) {
        console.log("  No database to remove.");
        return;
      }
      const confirmed = await confirmPrompt("  Remove agent data (database)? [y/N] ");
      if (!confirmed) {
        console.log("  Cancelled.");
        return;
      }
      await stopDaemonIfRunning();
      removeAgentData();
      break;
    }

    default:
      console.log("  Invalid option.");
  }
}

// ---------------------------------------------------------------------------
// Stop command
// ---------------------------------------------------------------------------

function cmdStop(): void {
  const configDir = getConfigDir();
  const pidFile = path.join(configDir, "agentgazer.pid");
  const config = readConfig();
  const port = config?.server?.port ?? 18800;
  const proxyPort = config?.server?.proxyPort ?? 18900;

  if (!fs.existsSync(pidFile)) {
    // No PID file, but check if processes are running on ports
    const pidsOnPorts = findPidsOnPorts([port, proxyPort]);
    if (pidsOnPorts.length > 0) {
      console.log("AgentGazer PID file not found, but processes detected on ports.");
      console.log(`Killing processes: ${pidsOnPorts.join(", ")}...`);
      for (const pid of pidsOnPorts) {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          // Ignore errors
        }
      }
      // Wait a bit and force kill if needed
      setTimeout(() => {
        for (const pid of pidsOnPorts) {
          try {
            process.kill(pid, 0);
            process.kill(pid, "SIGKILL");
          } catch {
            // Already dead
          }
        }
        console.log("AgentGazer stopped.");
      }, 1000);
      return;
    }
    console.log("AgentGazer is not running.");
    return;
  }

  const pid = parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);

  try {
    process.kill(pid, 0); // Check if process exists
  } catch {
    // Process doesn't exist
    fs.unlinkSync(pidFile);
    console.log("AgentGazer is not running (stale PID file removed).");
    return;
  }

  // Send SIGTERM
  try {
    process.kill(pid, "SIGTERM");
    console.log(`Stopping AgentGazer (PID: ${pid})...`);

    // Wait for process to exit (poll for up to 5 seconds)
    let attempts = 0;
    const maxAttempts = 50;
    const checkInterval = 100;

    const waitForExit = (): void => {
      try {
        process.kill(pid, 0);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(waitForExit, checkInterval);
        } else {
          console.log("Process did not exit gracefully, sending SIGKILL...");
          try {
            process.kill(pid, "SIGKILL");
          } catch {
            // Already dead
          }
          if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
          console.log("AgentGazer stopped.");
        }
      } catch {
        // Process exited
        if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
        console.log("AgentGazer stopped.");
      }
    };

    waitForExit();
  } catch (err) {
    console.error(`Failed to stop AgentGazer: ${err}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Logs command
// ---------------------------------------------------------------------------

async function cmdLogs(flags: Record<string, string>): Promise<void> {
  const configDir = getConfigDir();
  const logFile = path.join(configDir, "agentgazer.log");

  if (!fs.existsSync(logFile)) {
    console.log("No log file found. Start AgentGazer with -d flag first.");
    console.log(`  agentgazer start -d`);
    return;
  }

  const follow = "f" in flags || "follow" in flags;
  const lines = flags["n"] ? parseInt(flags["n"], 10) : (flags["lines"] ? parseInt(flags["lines"], 10) : 50);

  if (follow) {
    // Follow mode: tail -f equivalent
    const { spawn } = await import("node:child_process");
    const tail = spawn("tail", ["-f", "-n", String(lines), logFile], {
      stdio: "inherit",
    });

    // Handle Ctrl+C gracefully
    process.on("SIGINT", () => {
      tail.kill();
      process.exit(0);
    });

    await new Promise<void>((resolve) => {
      tail.on("close", () => resolve());
    });
  } else {
    // Just show last N lines
    const content = fs.readFileSync(logFile, "utf-8");
    const allLines = content.split("\n");
    const lastLines = allLines.slice(-lines).join("\n");
    console.log(lastLines);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const subcommand = process.argv[2];
  const allArgs = process.argv.slice(3);
  const flags = parseFlags(allArgs);
  const positional = parsePositional(allArgs);
  const port = flags["port"] ? parseInt(flags["port"], 10) : 18800;

  switch (subcommand) {
    case "onboard":
      await cmdOnboard();
      break;
    case "start":
      await cmdStart(flags);
      break;
    case "stop":
      cmdStop();
      break;
    case "logs":
      await cmdLogs(flags);
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
    case "events":
      await cmdEvents(flags);
      break;
    case "version":
    case "--version":
    case "-V":
      await cmdVersion();
      break;
    case "update":
      await cmdUpdate(flags);
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
