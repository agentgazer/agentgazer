import { apiGet, apiPut, apiDelete, handleApiError } from "../utils/api.js";
import { formatNumber, formatCurrency, formatLatency } from "../utils/format.js";
import { confirm, selectProvider } from "../utils/prompt.js";

interface StatsResponse {
  total_requests: number;
  total_errors: number;
  error_rate: number;
  total_cost: number;
  total_tokens: number;
  p50_latency: number | null;
  p99_latency: number | null;
  cost_by_model: { model: string; provider: string; cost: number; count: number }[];
}

interface ModelRule {
  provider: string;
  override_model: string | null;
  original_model?: string;
}

interface AgentDetail {
  agent_id: string;
  providers?: string[];
}

export async function cmdAgent(
  name: string,
  action: string,
  args: string[],
  flags: Record<string, string>,
): Promise<void> {
  const port = flags["port"] ? parseInt(flags["port"], 10) : 8080;

  if (!name) {
    console.error("Usage: agentgazer agent <name> <action>");
    process.exit(1);
  }

  switch (action) {
    case "active":
      await activateAgent(name, port);
      break;
    case "deactive":
      await deactivateAgent(name, port);
      break;
    case "killswitch":
      await toggleKillswitch(name, args[0], port);
      break;
    case "delete":
      await deleteAgent(name, flags, port);
      break;
    case "stat":
      await showStats(name, flags, port);
      break;
    case "model":
      await listModels(name, port);
      break;
    case "model-override":
      await setModelOverride(name, args[0], port);
      break;
    default:
      console.error(`Unknown action: ${action}`);
      console.error("Available actions: active, deactive, killswitch, delete, stat, model, model-override");
      process.exit(1);
  }
}

async function activateAgent(name: string, port: number): Promise<void> {
  try {
    await apiPut(`/api/agents/${encodeURIComponent(name)}/policy`, { active: true }, port);
    console.log(`Agent '${name}' activated.`);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
      console.error(`Agent '${name}' not found.`);
      process.exit(1);
    }
    handleApiError(err);
  }
}

async function deactivateAgent(name: string, port: number): Promise<void> {
  try {
    await apiPut(`/api/agents/${encodeURIComponent(name)}/policy`, { active: false }, port);
    console.log(`Agent '${name}' deactivated.`);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
      console.error(`Agent '${name}' not found.`);
      process.exit(1);
    }
    handleApiError(err);
  }
}

async function toggleKillswitch(name: string, state: string, port: number): Promise<void> {
  if (state !== "on" && state !== "off") {
    console.error("Usage: agentgazer agent <name> killswitch on|off");
    process.exit(1);
  }

  try {
    const enabled = state === "on";
    await apiPut(`/api/agents/${encodeURIComponent(name)}/policy`, { kill_switch_enabled: enabled }, port);
    console.log(`Kill switch ${enabled ? "enabled" : "disabled"} for '${name}'.`);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
      console.error(`Agent '${name}' not found.`);
      process.exit(1);
    }
    handleApiError(err);
  }
}

async function deleteAgent(name: string, flags: Record<string, string>, port: number): Promise<void> {
  const skipConfirm = "yes" in flags;

  if (!skipConfirm) {
    const confirmed = await confirm(`Delete agent '${name}' and all its data?`, false);
    if (!confirmed) {
      console.log("Aborted.");
      return;
    }
  }

  try {
    await apiDelete(`/api/agents/${encodeURIComponent(name)}`, port);
    console.log(`Agent '${name}' deleted.`);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
      console.error(`Agent '${name}' not found.`);
      process.exit(1);
    }
    handleApiError(err);
  }
}

async function showStats(name: string, flags: Record<string, string>, port: number): Promise<void> {
  const range = flags["range"] || "24h";

  try {
    const data = await apiGet<StatsResponse>(
      `/api/stats/${encodeURIComponent(name)}?range=${encodeURIComponent(range)}`,
      port,
    );

    const errorPct =
      data.total_requests > 0 ? ((data.total_errors / data.total_requests) * 100).toFixed(2) : "0.00";

    console.log(`
  Agent Statistics: "${name}" (last ${range})
  ───────────────────────────────────────

  Requests:   ${formatNumber(data.total_requests)}
  Errors:     ${formatNumber(data.total_errors)} (${errorPct}%)
  Cost:       ${formatCurrency(data.total_cost)}
  Tokens:     ${formatNumber(data.total_tokens)}

  Latency:    p50 = ${formatLatency(data.p50_latency)}   p99 = ${formatLatency(data.p99_latency)}`);

    if (data.cost_by_model && data.cost_by_model.length > 0) {
      console.log("\n  Cost by model:");
      for (const m of data.cost_by_model) {
        const model = m.model.padEnd(24);
        const cost = formatCurrency(m.cost);
        console.log(`    ${model}${cost}  (${formatNumber(m.count)} calls)`);
      }
    }

    console.log();
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
      console.error(`Agent '${name}' not found.`);
      process.exit(1);
    }
    handleApiError(err);
  }
}

async function listModels(name: string, port: number): Promise<void> {
  try {
    const rules = await apiGet<ModelRule[]>(`/api/agents/${encodeURIComponent(name)}/model-rules`, port);

    if (!rules || rules.length === 0) {
      console.log(`No model overrides configured for '${name}'.`);
      return;
    }

    console.log(`\n  Model overrides for "${name}":`);
    console.log("  ───────────────────────────────────────");

    for (const r of rules) {
      const provider = r.provider.padEnd(12);
      const override = r.override_model || "(default)";
      console.log(`  ${provider}→ ${override}`);
    }
    console.log();
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
      console.error(`Agent '${name}' not found.`);
      process.exit(1);
    }
    handleApiError(err);
  }
}

async function setModelOverride(name: string, model: string, port: number): Promise<void> {
  if (!model) {
    console.error("Usage: agentgazer agent <name> model-override <model>");
    process.exit(1);
  }

  try {
    // Get agent's providers
    const agent = await apiGet<AgentDetail>(`/api/agents/${encodeURIComponent(name)}`, port);
    const providers = agent.providers || [];

    if (providers.length === 0) {
      console.log(`No providers found for agent '${name}'. Make some LLM calls first.`);
      return;
    }

    let provider: string;
    if (providers.length === 1) {
      provider = providers[0];
    } else {
      provider = await selectProvider(providers);
    }

    await apiPut(
      `/api/agents/${encodeURIComponent(name)}/model-rules/${encodeURIComponent(provider)}`,
      { override_model: model },
      port,
    );
    console.log(`Model override set: ${provider} → ${model}`);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
      console.error(`Agent '${name}' not found.`);
      process.exit(1);
    }
    handleApiError(err);
  }
}
