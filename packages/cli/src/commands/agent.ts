import { apiGet, apiPost, apiPut, apiDelete, handleApiError } from "../utils/api.js";
import { formatNumber, formatCurrency, formatLatency, timeAgo } from "../utils/format.js";
import { confirm, selectProvider } from "../utils/prompt.js";
import { readConfig, getAlertDefaults, updateAlertDefaults, getServerPort } from "../config.js";

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

interface AlertRule {
  id: string;
  agent_id: string;
  rule_type: string;
  config: Record<string, unknown>;
  enabled: boolean;
  notification_type: string;
  repeat_enabled: boolean;
  repeat_interval_minutes: number;
  recovery_notify: boolean;
  state: string;
  last_triggered_at: string | null;
  budget_period: string | null;
}

interface AlertsResponse {
  alerts: AlertRule[];
  total?: number;
}

export async function cmdAgent(
  name: string,
  action: string,
  args: string[],
  flags: Record<string, string>,
): Promise<void> {
  const port = flags["port"] ? parseInt(flags["port"], 10) : getServerPort();

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
    case "alerts":
      await listAlerts(name, port);
      break;
    case "alert":
      await handleAlertCommand(name, args, flags, port);
      break;
    default:
      console.error(`Unknown action: ${action}`);
      console.error("Available actions: active, deactive, killswitch, delete, stat, model, model-override, alerts, alert");
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

// ---------------------------------------------------------------------------
// Alert Commands
// ---------------------------------------------------------------------------

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function getStateColor(state: string): string {
  switch (state) {
    case "normal":
      return colors.green;
    case "alerting":
      return colors.yellow;
    case "fired":
      return colors.red;
    default:
      return colors.gray;
  }
}

function getStateSymbol(state: string): string {
  switch (state) {
    case "normal":
      return "●";
    case "alerting":
      return "○";
    case "fired":
      return "✗";
    default:
      return "?";
  }
}

async function listAlerts(agentName: string, port: number): Promise<void> {
  try {
    const resp = await apiGet<AlertsResponse>(
      `/api/alerts?agent_id=${encodeURIComponent(agentName)}`,
      port,
    );
    const alerts = resp.alerts;
    const c = colors;

    if (!alerts || alerts.length === 0) {
      console.log(`\n  No alert rules configured for '${agentName}'.\n`);
      console.log("  Use 'agentgazer agent <name> alert add <type>' to create one.\n");
      return;
    }

    console.log(`
${c.bold}  AgentGazer — Alerts for ${agentName}${c.reset}
  ───────────────────────────────────────────────────────────────
`);

    // Header
    const header = `  ${"ID".padEnd(10)}${"TYPE".padEnd(14)}${"STATE".padEnd(12)}${"REPEAT".padEnd(12)}${"DELIVERY".padEnd(12)}LAST TRIGGERED`;
    console.log(`${c.dim}${header}${c.reset}`);
    console.log(`${c.dim}  ${"─".repeat(header.length - 2)}${c.reset}`);

    for (const a of alerts) {
      const id = a.id.slice(0, 8).padEnd(10);
      const type = a.rule_type.padEnd(14);
      const stateColor = getStateColor(a.state);
      const stateSymbol = getStateSymbol(a.state);
      const state = `${stateColor}${stateSymbol} ${a.state}${c.reset}`.padEnd(12 + 9);
      const repeat = a.repeat_enabled ? `${a.repeat_interval_minutes}m` : "one-time";
      const repeatPad = repeat.padEnd(12);
      const delivery = a.notification_type.padEnd(12);
      const lastTriggered = timeAgo(a.last_triggered_at);

      console.log(`  ${c.cyan}${id}${c.reset}${type}${state}${c.dim}${repeatPad}${c.reset}${delivery}${lastTriggered}`);
    }

    console.log(`${c.dim}  ${"─".repeat(header.length - 2)}${c.reset}`);
    console.log(`
  ${c.dim}Commands:${c.reset}
    agentgazer agent ${agentName} alert add <type>     Add new alert
    agentgazer agent ${agentName} alert delete <id>    Delete alert
    agentgazer agent ${agentName} alert reset <id>     Reset to normal state
`);
  } catch (err) {
    handleApiError(err);
  }
}

async function handleAlertCommand(
  agentName: string,
  args: string[],
  flags: Record<string, string>,
  port: number,
): Promise<void> {
  const subAction = args[0];

  switch (subAction) {
    case "add":
      await addAlert(agentName, args.slice(1), flags, port);
      break;
    case "delete":
      await deleteAlert(agentName, args[1], flags, port);
      break;
    case "reset":
      await resetAlert(agentName, args[1], port);
      break;
    default:
      console.error("Usage: agentgazer agent <name> alert <add|delete|reset> ...");
      console.error("\nExamples:");
      console.error("  agentgazer agent my-bot alert add error-rate --threshold 10 --telegram");
      console.error("  agentgazer agent my-bot alert add agent-down --timeout 5 --repeat --interval 30 --telegram");
      console.error("  agentgazer agent my-bot alert delete <id>");
      console.error("  agentgazer agent my-bot alert reset <id>");
      process.exit(1);
  }
}

async function addAlert(
  agentName: string,
  args: string[],
  flags: Record<string, string>,
  port: number,
): Promise<void> {
  const alertType = args[0];

  if (!alertType) {
    console.error("Usage: agentgazer agent <name> alert add <type> [options]");
    console.error("\nTypes: agent-down, error-rate, budget");
    console.error("\nOptions:");
    console.error("  --threshold <n>       Error rate percentage (for error-rate)");
    console.error("  --timeout <n>         Minutes without heartbeat (for agent-down)");
    console.error("  --limit <n>           Budget limit in USD (for budget)");
    console.error("  --period <p>          Budget period: daily, weekly, monthly (for budget)");
    console.error("  --window <n>          Evaluation window in minutes (for error-rate, default: 60)");
    console.error("  --repeat              Enable repeated notifications (default)");
    console.error("  --no-repeat           One-time notification only");
    console.error("  --interval <minutes>  Minutes between repeat notifications (default: 15)");
    console.error("  --recovery-notify     Send notification when condition recovers");
    console.error("  --webhook <url>       Send to webhook URL");
    console.error("  --telegram            Send to configured Telegram");
    process.exit(1);
  }

  // Map CLI type names to API type names
  const typeMap: Record<string, string> = {
    "agent-down": "agent_down",
    "error-rate": "error_rate",
    "budget": "budget",
  };

  const ruleType = typeMap[alertType];
  if (!ruleType) {
    console.error(`Unknown alert type: ${alertType}`);
    console.error("Valid types: agent-down, error-rate, budget");
    process.exit(1);
  }

  // Build config based on type
  const config: Record<string, unknown> = {};

  if (ruleType === "agent_down") {
    const timeout = flags["timeout"] ? parseInt(flags["timeout"], 10) : 5;
    config.duration_minutes = timeout;
  } else if (ruleType === "error_rate") {
    if (!flags["threshold"]) {
      console.error("--threshold is required for error-rate alerts");
      process.exit(1);
    }
    config.threshold = parseInt(flags["threshold"], 10);
    config.window_minutes = flags["window"] ? parseInt(flags["window"], 10) : 60;
  } else if (ruleType === "budget") {
    if (!flags["limit"]) {
      console.error("--limit is required for budget alerts");
      process.exit(1);
    }
    config.threshold = parseFloat(flags["limit"]);
  }

  // Load alert defaults from config
  const cliConfig = readConfig();
  const alertDefaults = getAlertDefaults(cliConfig);

  // Determine notification type
  let notificationType = "webhook";
  let webhookUrl: string | undefined;
  let telegramConfig: { bot_token: string; chat_id: string } | undefined;

  if ("telegram" in flags) {
    notificationType = "telegram";
    // Use defaults if available
    const defaultTelegram = alertDefaults.telegram;
    const botToken = defaultTelegram?.botToken ?? "";
    const chatId = defaultTelegram?.chatId ?? "";

    if (!botToken || !chatId) {
      console.error("Telegram not configured. Set bot token and chat ID in Settings or use --webhook.");
      process.exit(1);
    }

    telegramConfig = { bot_token: botToken, chat_id: chatId };
  } else if (flags["webhook"]) {
    webhookUrl = flags["webhook"];
  } else {
    // Try to use default webhook URL
    const defaultWebhook = alertDefaults.webhook?.url;
    if (defaultWebhook) {
      webhookUrl = defaultWebhook;
      console.log(`Using default webhook: ${defaultWebhook}`);
    } else {
      console.error("At least one notification method is required (--webhook <url> or --telegram)");
      process.exit(1);
    }
  }

  // Repeat settings
  const repeatEnabled = !("no-repeat" in flags);
  const repeatIntervalMinutes = flags["interval"] ? parseInt(flags["interval"], 10) : 15;
  const recoveryNotify = "recovery-notify" in flags;

  // Budget period
  const budgetPeriod = flags["period"] || (ruleType === "budget" ? "daily" : undefined);

  const body: Record<string, unknown> = {
    agent_id: agentName,
    rule_type: ruleType,
    config,
    notification_type: notificationType,
    repeat_enabled: repeatEnabled,
    repeat_interval_minutes: repeatIntervalMinutes,
    recovery_notify: recoveryNotify,
  };

  if (webhookUrl) {
    body.webhook_url = webhookUrl;
  }

  if (telegramConfig) {
    body.telegram_config = telegramConfig;
  }

  if (budgetPeriod) {
    body.budget_period = budgetPeriod;
  }

  try {
    const result = await apiPost<AlertRule>("/api/alerts", body, port);
    console.log(`Alert created: ${result.id.slice(0, 8)} (${ruleType})`);
    console.log(`  Repeat: ${repeatEnabled ? `every ${repeatIntervalMinutes}m` : "one-time"}`);
    console.log(`  Recovery notify: ${recoveryNotify ? "yes" : "no"}`);
    console.log(`  Delivery: ${notificationType}`);
  } catch (err) {
    handleApiError(err);
  }
}

async function deleteAlert(
  agentName: string,
  alertId: string,
  flags: Record<string, string>,
  port: number,
): Promise<void> {
  if (!alertId) {
    console.error("Usage: agentgazer agent <name> alert delete <alert-id>");
    process.exit(1);
  }

  const skipConfirm = "yes" in flags;

  if (!skipConfirm) {
    const confirmed = await confirm(`Delete alert rule '${alertId}'?`, false);
    if (!confirmed) {
      console.log("Aborted.");
      return;
    }
  }

  try {
    // Find the full ID if user provided short form
    const resp = await apiGet<AlertsResponse>(
      `/api/alerts?agent_id=${encodeURIComponent(agentName)}`,
      port,
    );
    const alert = resp.alerts.find((a) => a.id.startsWith(alertId));

    if (!alert) {
      console.error(`Alert rule '${alertId}' not found for agent '${agentName}'.`);
      process.exit(1);
    }

    await apiDelete(`/api/alerts/${encodeURIComponent(alert.id)}`, port);
    console.log(`Alert rule '${alertId}' deleted.`);
  } catch (err) {
    handleApiError(err);
  }
}

async function resetAlert(agentName: string, alertId: string, port: number): Promise<void> {
  if (!alertId) {
    console.error("Usage: agentgazer agent <name> alert reset <alert-id>");
    process.exit(1);
  }

  try {
    // Find the full ID if user provided short form
    const resp = await apiGet<AlertsResponse>(
      `/api/alerts?agent_id=${encodeURIComponent(agentName)}`,
      port,
    );
    const alert = resp.alerts.find((a) => a.id.startsWith(alertId));

    if (!alert) {
      console.error(`Alert rule '${alertId}' not found for agent '${agentName}'.`);
      process.exit(1);
    }

    await apiPost(`/api/alerts/${encodeURIComponent(alert.id)}/reset`, {}, port);
    console.log(`Alert rule '${alertId}' reset to normal state.`);
  } catch (err) {
    handleApiError(err);
  }
}
