#!/usr/bin/env node

import { startProxy } from "./proxy-server.js";
import type { RateLimitConfig } from "./rate-limiter.js";
import { KNOWN_PROVIDER_NAMES } from "@agentgazer/shared";

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
Usage: agentgazer-proxy --api-key <key> --agent-id <id> [options]

Required:
  --api-key          AgentGazer API key
  --agent-id         Agent identifier

Options:
  --port             Port to listen on (default: 4000)
  --endpoint         AgentGazer ingest API URL
  --provider-keys    Provider API keys as JSON, e.g. '{"openai":"sk-...","anthropic":"sk-ant-..."}'
  --rate-limits      Rate limits as JSON, e.g. '{"openai":{"maxRequests":100,"windowSeconds":60}}'
  --help             Show this help message
`);
}

function parseJsonFlag<T>(value: string | undefined, flagName: string): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    console.error(`Error: --${flagName} must be valid JSON`);
    process.exit(1);
  }
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
  const providerKeys = parseJsonFlag<Record<string, string>>(
    args["provider-keys"],
    "provider-keys"
  );
  const rateLimits = parseJsonFlag<Record<string, RateLimitConfig>>(
    args["rate-limits"],
    "rate-limits"
  );

  const { shutdown } = startProxy({
    apiKey,
    agentId,
    port,
    endpoint,
    providerKeys,
    rateLimits,
  });

  const listenPort = port ?? 4000;
  console.log(
    `AgentGazer Proxy running on http://localhost:${listenPort}`
  );
  if (providerKeys) {
    const names = Object.keys(providerKeys);
    if (names.length > 0) {
      console.log(`Provider keys configured: ${names.join(", ")}`);
    }
  }
  if (rateLimits) {
    const names = Object.keys(rateLimits);
    if (names.length > 0) {
      console.log(`Rate limits configured: ${names.join(", ")}`);
    }
  }
  console.log(`Path prefix routing: http://localhost:${listenPort}/{provider}/...`);
  console.log(`Providers: ${KNOWN_PROVIDER_NAMES.join(", ")}`);

  let shuttingDown = false;

  function handleShutdown(): void {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\n[agentgazer-proxy] Shutting down gracefully...");
    shutdown()
      .then(() => {
        console.log("[agentgazer-proxy] Shutdown complete.");
        process.exit(0);
      })
      .catch((err) => {
        console.error("[agentgazer-proxy] Error during shutdown:", err);
        process.exit(1);
      });
  }

  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);
}

main();
