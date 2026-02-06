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
  removeProvider,
  listProviders,
  saveConfig,
  type ProviderConfig,
} from "./config.js";
import {
  detectSecretStore,
  migrateFromPlaintextConfig,
  loadProviderKeys,
  PROVIDER_SERVICE,
} from "./secret-store.js";
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
AgentTrace — AI Agent Observability

Usage: agenttrace <command> [options]

Commands:
  onboard                     First-time setup — generate token and configure providers
  start                       Start the server, proxy, and dashboard
  status                      Show current configuration
  reset-token                 Generate a new auth token
  providers list              List configured providers
  providers set-key           Interactive provider key setup
  providers set <name> <key>  Set provider key (non-interactive)
  providers remove <name>     Remove a provider
  version                     Show version
  doctor                      Check system health
  agents                      List registered agents
  stats [agentId]             Show agent statistics (auto-selects if only one agent)
  uninstall                   Remove AgentTrace (curl-installed only)
  help                        Show this help message

Options (for start):
  --port <number>            Server/dashboard port (default: 8080)
  --proxy-port <number>      LLM proxy port (default: 4000)
  --retention-days <number>  Data retention period in days (default: 30)
  --no-open                  Don't auto-open browser

Options (for doctor, stats, agents):
  --port <number>            Server port to check (default: 8080)
  --proxy-port <number>      Proxy port to check (default: 4000)

Options (for stats):
  --range <period>           Time range (default: 24h)

Options (for uninstall):
  --yes                      Skip confirmation prompts

Examples:
  agenttrace onboard                           First-time setup
  agenttrace start                             Start with defaults
  agenttrace start --port 9090                 Use custom server port
  agenttrace providers set-key                 Interactive provider setup
  agenttrace providers list                    List configured providers
  agenttrace stats                             Show stats (auto-selects agent)
  agenttrace stats my-agent --range 7d         Show stats for specific agent
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

      const rateLimitAnswer = await ask(
        rl,
        `  Set rate limit for ${provider}? (e.g. "100/60" for 100 req per 60s, Enter to skip): `
      );

      // Store API key in secret store
      await store.set(PROVIDER_SERVICE, provider, key);

      // Store non-secret config (rate limits) in config.json
      const providerConfig: ProviderConfig = { apiKey: "" };
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

      // Store provider config in config.json (apiKey is empty — actual key is in secret store)
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

  Or point your LLM client at the proxy (with auto API key injection):

    export OPENAI_BASE_URL=http://localhost:4000/openai/v1

  Next: run "agenttrace start" to launch.
`);
}

async function cmdProviders(args: string[]): Promise<void> {
  const action = args[0];

  switch (action) {
    case "list": {
      // List reads from config.json only — no secret store access needed.
      const providers = listProviders();
      const names = Object.keys(providers);
      if (names.length === 0) {
        console.log("No providers configured. Use \"agenttrace providers set-key\" to add one.");
        return;
      }
      console.log("\n  Configured providers:");
      console.log("  ───────────────────────────────────────");
      for (const name of names) {
        const p = providers[name];
        const keyStatus = p.apiKey ? "(plaintext — run \"agenttrace start\" to migrate)" : "(secured)";
        const rateInfo = p.rateLimit
          ? ` (rate limit: ${p.rateLimit.maxRequests} req / ${p.rateLimit.windowSeconds}s)`
          : "";
        console.log(`  ${name}: ${keyStatus}${rateInfo}`);
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
      if (!(KNOWN_PROVIDERS as readonly string[]).includes(name)) {
        console.warn(`Warning: "${name}" is not a known provider (${KNOWN_PROVIDERS.join(", ")}). Proceeding anyway.`);
      }
      const { store, backendName } = await detectSecretStore(getConfigDir());
      // Store API key in secret store
      await store.set(PROVIDER_SERVICE, name, key);
      // Ensure provider entry exists in config.json (for rate limits etc.)
      const config = ensureConfig();
      if (!config.providers) config.providers = {};
      if (!config.providers[name]) {
        config.providers[name] = { apiKey: "" };
      }
      // Remove any plaintext apiKey that might be in config
      config.providers[name].apiKey = "";
      saveConfig(config);
      console.log(`Provider "${name}" configured (secret stored in ${backendName}).`);
      break;
    }
    case "set-key": {
      // Interactive provider key setup
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      console.log("\n  Available providers:");
      console.log("  ───────────────────────────────────────");
      KNOWN_PROVIDERS.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p}`);
      });
      console.log();

      try {
        const choice = await ask(rl, "  Select provider (number): ");
        const idx = parseInt(choice, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= KNOWN_PROVIDERS.length) {
          console.error("  Invalid selection.");
          process.exit(1);
        }
        const provider = KNOWN_PROVIDERS[idx];

        const apiKey = await ask(rl, `  API key for ${provider}: `);
        if (!apiKey) {
          console.error("  API key is required.");
          process.exit(1);
        }

        const rateLimitAnswer = await ask(
          rl,
          `  Rate limit (e.g. "100/60" for 100 req per 60s, Enter to skip): `
        );

        // Store API key in secret store
        const { store, backendName: backend } = await detectSecretStore(getConfigDir());
        await store.set(PROVIDER_SERVICE, provider, apiKey);

        // Store non-secret config (rate limits) in config.json
        const providerConfig: ProviderConfig = { apiKey: "" };
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
        console.log(`\n  ✓ ${provider} configured (secret stored in ${backend}).`);
      } finally {
        rl.close();
      }
      break;
    }
    case "remove": {
      const name = args[1];
      if (!name) {
        console.error("Usage: agenttrace providers remove <provider-name>");
        process.exit(1);
      }
      const { store } = await detectSecretStore(getConfigDir());
      // Delete from secret store
      await store.delete(PROVIDER_SERVICE, name);
      // Remove from config.json
      removeProvider(name);
      console.log(`Provider "${name}" removed.`);
      break;
    }
    default:
      console.error("Usage: agenttrace providers <list|set-key|set|remove>");
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

  // Start the local server
  const { shutdown: shutdownServer } = await startServer({
    port: serverPort,
    token: config.token,
    dbPath: getDbPath(),
    dashboardDir,
    retentionDays,
  });

  // Initialize secret store
  const configDir = getConfigDir();
  const configPath = path.join(configDir, "config.json");

  const { store, backendName } = await detectSecretStore(configDir);
  console.log(`  Secret backend: ${backendName}`);

  // Auto-migrate plaintext keys from config.json to secret store
  const migratedCount = await migrateFromPlaintextConfig(configPath, store);
  if (migratedCount > 0) {
    console.log(`  Migrated ${migratedCount} provider key(s) from config.json to secret store.`);
  }

  // Load provider keys from secret store
  const providerKeys = await loadProviderKeys(store);

  // Load rate limits from config.json (non-secret config)
  const rateLimits: Record<string, { maxRequests: number; windowSeconds: number }> = {};
  if (config.providers) {
    for (const [name, pConfig] of Object.entries(config.providers)) {
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
  ╔════════════════════════════════════════════════════╗
  ║              AgentTrace running                    ║
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
// Formatting helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function apiGet(urlPath: string, port: number): Promise<unknown> {
  const config = readConfig();
  const token = config?.token ?? "";
  try {
    const res = await fetch(`http://localhost:${port}${urlPath}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`Server responded with ${res.status} ${res.statusText}`);
      process.exit(1);
    }
    return await res.json();
  } catch (err: unknown) {
    if (
      err instanceof TypeError &&
      (err as NodeJS.ErrnoException & { cause?: { code?: string } }).cause
        ?.code === "ECONNREFUSED"
    ) {
      console.error('Server not running. Run "agenttrace start" first.');
      process.exit(1);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// New subcommands
// ---------------------------------------------------------------------------

function cmdVersion(): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require(path.resolve(__dirname, "../package.json")) as { version: string };
  console.log(`agenttrace ${pkg.version}`);
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
  AgentTrace — Doctor
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

interface AgentRecord {
  agent_id: string;
  status: string;
  total_events: number;
  last_heartbeat: string | null;
}

interface AgentsResponse {
  agents: AgentRecord[];
  total?: number;
}

async function cmdAgents(flags: Record<string, string>): Promise<void> {
  const port = flags["port"] ? parseInt(flags["port"], 10) : 8080;
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error("Error: --port must be a valid port number (1-65535)");
    process.exit(1);
  }
  const resp = (await apiGet("/api/agents", port)) as AgentsResponse;
  const agents = resp.agents;

  if (!agents || agents.length === 0) {
    console.log("No agents registered yet.");
    return;
  }

  const header = `  ${"Agent ID".padEnd(18)}${"Status".padEnd(11)}${"Events".padStart(8)}   Last Heartbeat`;
  console.log(header);
  console.log("  " + "─".repeat(header.trimStart().length));

  for (const a of agents) {
    const id = (a.agent_id ?? "").padEnd(18);
    const status = (a.status ?? "unknown").padEnd(11);
    const events = formatNumber(a.total_events ?? 0).padStart(8);
    const heartbeat = timeAgo(a.last_heartbeat);
    console.log(`  ${id}${status}${events}   ${heartbeat}`);
  }
}

interface StatsResponse {
  total_requests: number;
  total_errors: number;
  error_rate: number;
  total_cost: number;
  total_tokens: number;
  p50_latency: number | null;
  p99_latency: number | null;
  cost_by_model: { model: string; provider: string; cost: number; count: number }[];
  token_series: { timestamp: string; tokens_in: number | null; tokens_out: number | null }[];
}

async function cmdStats(flags: Record<string, string>): Promise<void> {
  const port = flags["port"] ? parseInt(flags["port"], 10) : 8080;
  const range = flags["range"] || "24h";
  const positional = parsePositional(process.argv.slice(3));
  let agentId = positional[0];

  // Auto-select agent if not specified
  if (!agentId) {
    const resp = (await apiGet("/api/agents", port)) as AgentsResponse;
    const agents = resp.agents;
    if (!agents || agents.length === 0) {
      console.log("No agents registered yet.");
      return;
    }
    if (agents.length === 1) {
      agentId = agents[0].agent_id;
    } else {
      console.log("Multiple agents found. Please specify one:\n");
      for (const a of agents) {
        console.log(`  agenttrace stats ${a.agent_id}`);
      }
      console.log();
      process.exit(1);
    }
  }

  let data: StatsResponse;
  try {
    data = (await apiGet(
      `/api/stats/${encodeURIComponent(agentId)}?range=${encodeURIComponent(range)}`,
      port,
    )) as StatsResponse;
  } catch (err: unknown) {
    if (err && typeof err === "object" && "message" in err) {
      console.error(`Error fetching stats for "${agentId}": ${(err as Error).message}`);
    } else {
      console.error(`Error fetching stats for "${agentId}".`);
    }
    process.exit(1);
  }

  const errorPct =
    data.total_requests > 0
      ? ((data.total_errors / data.total_requests) * 100).toFixed(2)
      : "0.00";

  console.log(`
  AgentTrace — Stats for "${agentId}" (last ${range})
  ───────────────────────────────────────

  Requests:   ${formatNumber(data.total_requests)}
  Errors:     ${formatNumber(data.total_errors)} (${errorPct}%)
  Cost:       $${data.total_cost.toFixed(2)}
  Tokens:     ${formatNumber(data.total_tokens)}

  Latency:    p50 = ${data.p50_latency != null ? formatNumber(data.p50_latency) : "--"}ms   p99 = ${data.p99_latency != null ? formatNumber(data.p99_latency) : "--"}ms`);

  if (data.cost_by_model && data.cost_by_model.length > 0) {
    console.log("\n  Cost by model:");
    for (const m of data.cost_by_model) {
      const model = m.model.padEnd(16);
      const cost = `$${m.cost.toFixed(2)}`;
      console.log(`    ${model}${cost}  (${formatNumber(m.count)} calls)`);
    }
  }

  console.log();
}

// ---------------------------------------------------------------------------
// Uninstall
// ---------------------------------------------------------------------------

async function cmdUninstall(flags: Record<string, string>): Promise<void> {
  const home = process.env.AGENTTRACE_HOME || path.join(require("os").homedir(), ".agenttrace");
  const libDir = path.join(home, "lib");
  const nodeDir = path.join(home, "node");
  const wrapperPath = path.join(process.env.AGENTTRACE_BIN || "/usr/local/bin", "agenttrace");

  // Detect install method
  if (!fs.existsSync(libDir)) {
    console.log('AgentTrace was not installed via the install script.');
    console.log('');
    console.log('  If installed via npm:');
    console.log('    npm uninstall -g agenttrace');
    console.log('');
    console.log('  If installed via Homebrew:');
    console.log('    brew uninstall agenttrace');
    console.log('');
    return;
  }

  const skipPrompt = "yes" in flags;

  console.log(`
  AgentTrace — Uninstall
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

  console.log("\n  ✓ AgentTrace uninstalled.\n");
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
      await cmdProviders(process.argv.slice(3));
      break;
    case "version":
      cmdVersion();
      break;
    case "doctor":
      await cmdDoctor(flags);
      break;
    case "agents":
      await cmdAgents(flags);
      break;
    case "stats":
      await cmdStats(flags);
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
