import { apiGet, apiPut, apiDelete, handleApiError } from "../utils/api.js";
import { formatNumber, formatCurrency } from "../utils/format.js";
import { confirm, selectProvider, inputApiKey } from "../utils/prompt.js";
import { getConfigDir, setProvider, getServerPort, type ProviderConfig } from "../config.js";
import { detectSecretStore, PROVIDER_SERVICE } from "../secret-store.js";
import {
  KNOWN_PROVIDER_NAMES,
  validateProviderKey,
  getProviderModels,
  type ProviderName,
} from "@agentgazer/shared";

interface ProviderStats {
  total_calls: number;
  total_cost: number;
  total_tokens: number;
  top_models: { model: string; count: number; cost: number }[];
  top_agents: { agent_id: string; count: number; cost: number }[];
}

interface ModelInfo {
  id: string;
  name: string;
  input_price?: number;
  output_price?: number;
}

export async function cmdProvider(action: string, args: string[], flags: Record<string, string>): Promise<void> {
  const port = flags["port"] ? parseInt(flags["port"], 10) : getServerPort();

  switch (action) {
    case "add":
      await addProvider(args[0], args[1]);
      break;
    default:
      // Check if action is a provider name followed by a subcommand
      if (args.length > 0) {
        const providerName = action;
        const subAction = args[0];
        const subArgs = args.slice(1);
        await handleProviderAction(providerName, subAction, subArgs, flags, port);
      } else {
        console.error("Usage: agentgazer provider add [provider] [key]");
        console.error("       agentgazer provider <name> <action>");
        console.error("Actions: active, deactive, test-connection, delete, models, stat");
        process.exit(1);
      }
  }
}

async function handleProviderAction(
  name: string,
  action: string,
  args: string[],
  flags: Record<string, string>,
  port: number,
): Promise<void> {
  switch (action) {
    case "active":
      await activateProvider(name, port);
      break;
    case "deactive":
      await deactivateProvider(name, port);
      break;
    case "test-connection":
      await testConnection(name);
      break;
    case "delete":
      await deleteProvider(name, flags);
      break;
    case "models":
      await listModels(name);
      break;
    case "stat":
      await showStats(name, flags, port);
      break;
    default:
      console.error(`Unknown action: ${action}`);
      console.error("Available actions: active, deactive, test-connection, delete, models, stat");
      process.exit(1);
  }
}

async function addProvider(providerArg?: string, keyArg?: string): Promise<void> {
  let provider = providerArg;
  let apiKey = keyArg;

  const knownProviders = KNOWN_PROVIDER_NAMES as readonly string[];

  // Interactive provider selection if not provided
  if (!provider) {
    provider = await selectProvider([...knownProviders]);
  } else if (!knownProviders.includes(provider)) {
    console.warn(`Warning: '${provider}' is not a known provider (${knownProviders.join(", ")}).`);
    const proceed = await confirm("Continue anyway?", false);
    if (!proceed) {
      console.log("Aborted.");
      return;
    }
  }

  // Interactive key input if not provided
  if (!apiKey) {
    apiKey = await inputApiKey(provider);
    if (!apiKey) {
      console.error("API key is required.");
      process.exit(1);
    }
  }

  // Validate the key
  console.log(`Validating API key for ${provider}...`);
  const result = await validateProviderKey(provider as ProviderName, apiKey);
  if (result.valid) {
    console.log("  \u2713 API key is valid.");
  } else {
    console.warn(`  \u26A0 Validation failed: ${result.error}`);
    console.warn("  Proceeding with save anyway.");
  }

  // Store in secret store
  const { store, backendName } = await detectSecretStore(getConfigDir());
  await store.set(PROVIDER_SERVICE, provider, apiKey);

  // Add provider entry to config
  const providerConfig: ProviderConfig = { apiKey: "" };
  setProvider(provider, providerConfig);

  console.log(`Provider '${provider}' configured (secret stored in ${backendName}).`);
}

async function activateProvider(name: string, port: number): Promise<void> {
  try {
    await apiPut(`/api/providers/${encodeURIComponent(name)}/settings`, { active: true }, port);
    console.log(`Provider '${name}' activated.`);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
      console.error(`Provider '${name}' not found.`);
      process.exit(1);
    }
    handleApiError(err);
  }
}

async function deactivateProvider(name: string, port: number): Promise<void> {
  try {
    await apiPut(`/api/providers/${encodeURIComponent(name)}/settings`, { active: false }, port);
    console.log(`Provider '${name}' deactivated. All requests to this provider will be blocked.`);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
      console.error(`Provider '${name}' not found.`);
      process.exit(1);
    }
    handleApiError(err);
  }
}

async function testConnection(name: string): Promise<void> {
  const { store } = await detectSecretStore(getConfigDir());
  const apiKey = await store.get(PROVIDER_SERVICE, name);

  if (!apiKey) {
    console.log(`No API key configured for '${name}'. Use 'agentgazer provider add ${name}' first.`);
    return;
  }

  console.log(`Testing connection for '${name}'...`);
  const result = await validateProviderKey(name as ProviderName, apiKey);

  if (result.valid) {
    console.log(`\u2713 Connection successful for '${name}'.`);
  } else {
    console.log(`\u2717 Connection failed for '${name}': ${result.error}`);
  }
}

async function deleteProvider(name: string, flags: Record<string, string>): Promise<void> {
  const skipConfirm = "yes" in flags;

  if (!skipConfirm) {
    const confirmed = await confirm(`Delete provider '${name}' and its API key?`, false);
    if (!confirmed) {
      console.log("Aborted.");
      return;
    }
  }

  const { store } = await detectSecretStore(getConfigDir());
  await store.delete(PROVIDER_SERVICE, name);

  // Also remove from config
  const { removeProvider } = await import("../config.js");
  removeProvider(name);

  console.log(`Provider '${name}' deleted.`);
}

async function listModels(name: string): Promise<void> {
  const models = getProviderModels(name as ProviderName);

  if (!models || models.length === 0) {
    console.log(`No built-in models for '${name}'.`);
    return;
  }

  console.log(`\n  Models for "${name}":`);
  console.log("  ───────────────────────────────────────────────────────");

  const header = `  ${"Model".padEnd(32)}${"Input".padStart(12)}${"Output".padStart(12)}`;
  console.log(header);

  for (const m of models) {
    const model = m.id.padEnd(32);
    const input = m.inputPrice != null ? `$${m.inputPrice.toFixed(4)}/1K` : "—";
    const output = m.outputPrice != null ? `$${m.outputPrice.toFixed(4)}/1K` : "—";
    console.log(`  ${model}${input.padStart(12)}${output.padStart(12)}`);
  }
  console.log();
}

async function showStats(name: string, flags: Record<string, string>, port: number): Promise<void> {
  const range = flags["range"] || "24h";

  try {
    const data = await apiGet<ProviderStats>(
      `/api/providers/${encodeURIComponent(name)}/stats?range=${encodeURIComponent(range)}`,
      port,
    );

    console.log(`
  Provider Statistics: "${name}" (last ${range})
  ───────────────────────────────────────

  Total Calls:  ${formatNumber(data.total_calls)}
  Total Cost:   ${formatCurrency(data.total_cost)}
  Total Tokens: ${formatNumber(data.total_tokens)}`);

    if (data.top_models && data.top_models.length > 0) {
      console.log("\n  Top models:");
      for (const m of data.top_models.slice(0, 5)) {
        const model = m.model.padEnd(24);
        const cost = formatCurrency(m.cost);
        console.log(`    ${model}${cost}  (${formatNumber(m.count)} calls)`);
      }
    }

    if (data.top_agents && data.top_agents.length > 0) {
      console.log("\n  Top agents:");
      for (const a of data.top_agents.slice(0, 5)) {
        const agent = a.agent_id.padEnd(20);
        const cost = formatCurrency(a.cost);
        console.log(`    ${agent}${cost}  (${formatNumber(a.count)} calls)`);
      }
    }

    console.log();
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
      console.error(`Provider '${name}' not found.`);
      process.exit(1);
    }
    handleApiError(err);
  }
}
