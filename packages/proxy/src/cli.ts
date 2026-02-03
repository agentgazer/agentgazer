#!/usr/bin/env node

import { startProxy } from "./proxy-server.js";

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
Usage: agentwatch-proxy --api-key <key> --agent-id <id> [options]

Required:
  --api-key    AgentWatch API key
  --agent-id   Agent identifier

Options:
  --port       Port to listen on (default: 4000)
  --endpoint   AgentWatch ingest API URL
  --help       Show this help message
`);
}

function main(): void {
  const args = parseArgs(process.argv);

  if ("help" in args) {
    printUsage();
    process.exit(0);
  }

  const apiKey = args["api-key"];
  const agentId = args["agent-id"];

  if (!apiKey) {
    console.error("Error: --api-key is required");
    printUsage();
    process.exit(1);
  }

  if (!agentId) {
    console.error("Error: --agent-id is required");
    printUsage();
    process.exit(1);
  }

  const port = args["port"] ? parseInt(args["port"], 10) : undefined;
  if (port !== undefined && (isNaN(port) || port < 1 || port > 65535)) {
    console.error("Error: --port must be a valid port number (1-65535)");
    process.exit(1);
  }

  const endpoint = args["endpoint"] || undefined;

  const { shutdown } = startProxy({
    apiKey,
    agentId,
    port,
    endpoint,
  });

  const listenPort = port ?? 4000;
  console.log(
    `AgentWatch Proxy running on http://localhost:${listenPort}`
  );

  let shuttingDown = false;

  function handleShutdown(): void {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\n[agentwatch-proxy] Shutting down gracefully...");
    shutdown()
      .then(() => {
        console.log("[agentwatch-proxy] Shutdown complete.");
        process.exit(0);
      })
      .catch((err) => {
        console.error("[agentwatch-proxy] Error during shutdown:", err);
        process.exit(1);
      });
  }

  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);
}

main();
