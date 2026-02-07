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

export async function cmdAgents(port: number = 8080): Promise<void> {
  try {
    const resp = await apiGet<AgentsResponse>("/api/agents", port);
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
  } catch (err) {
    handleApiError(err);
  }
}
