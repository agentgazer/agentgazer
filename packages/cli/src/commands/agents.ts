import { apiGet, handleApiError } from "../utils/api.js";
import { formatNumber, timeAgo } from "../utils/format.js";

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

export async function cmdAgents(port: number = 18880): Promise<void> {
  try {
    const resp = await apiGet<AgentsResponse>("/api/agents", port);
    const agents = resp.agents;

    if (!agents || agents.length === 0) {
      console.log("\n  No agents registered yet.\n");
      console.log("  Agents are auto-registered when they send events via the SDK or proxy.");
      console.log("  See: https://agentgazer.com/docs/guide/getting-started\n");
      return;
    }

    const c = colors;

    console.log(`
${c.bold}  AgentGazer — Agents${c.reset}
  ───────────────────────────────────────────────────────────────
`);

    // Header
    const header = `  ${"Agent ID".padEnd(20)}${"Status".padEnd(14)}${"Events".padStart(10)}   Last Heartbeat`;
    console.log(`${c.dim}${header}${c.reset}`);
    console.log(`${c.dim}  ${"─".repeat(header.length - 2)}${c.reset}`);

    for (const a of agents) {
      const id = (a.agent_id ?? "").padEnd(20);

      // Status with color
      let status: string;
      const rawStatus = a.status ?? "unknown";
      if (rawStatus === "active" || rawStatus === "healthy") {
        status = `${c.green}● ${rawStatus}${c.reset}`.padEnd(14 + 9);
      } else if (rawStatus === "inactive" || rawStatus === "idle") {
        status = `${c.yellow}○ ${rawStatus}${c.reset}`.padEnd(14 + 9);
      } else if (rawStatus === "down" || rawStatus === "error") {
        status = `${c.red}✗ ${rawStatus}${c.reset}`.padEnd(14 + 9);
      } else {
        status = `${c.gray}? ${rawStatus}${c.reset}`.padEnd(14 + 9);
      }

      const events = formatNumber(a.total_events ?? 0).padStart(10);
      const heartbeat = timeAgo(a.last_heartbeat);

      console.log(`  ${c.cyan}${id}${c.reset}${status}${c.dim}${events}${c.reset}   ${heartbeat}`);
    }

    // Summary
    const totalEvents = agents.reduce((sum, a) => sum + (a.total_events ?? 0), 0);
    const activeCount = agents.filter(a => a.status === "active" || a.status === "healthy").length;

    console.log(`${c.dim}  ${"─".repeat(header.length - 2)}${c.reset}`);
    console.log(`  ${c.dim}${activeCount}/${agents.length} active${c.reset}                          ${c.bold}${formatNumber(totalEvents).padStart(10)}${c.reset}   events total`);
    console.log(`
  ${c.dim}Commands:${c.reset}
    agentgazer agent <id> stat          View agent statistics
    agentgazer agent <id> model         List model overrides
    agentgazer agent <id> killswitch    Toggle kill switch
`);
  } catch (err) {
    handleApiError(err);
  }
}
