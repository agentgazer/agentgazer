/**
 * get_budget_status MCP tool
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { AgentGazerClient } from "../client.js";

export const getBudgetStatusTool: Tool = {
  name: "get_budget_status",
  description: "Check budget limits and remaining balance for the current agent",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

export async function getBudgetStatusHandler(
  client: AgentGazerClient
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const status = await client.getBudgetStatus();

  const lines: string[] = [];

  if (status.hasLimit) {
    lines.push(`Budget Status:`);
    lines.push(`  Limit:     $${status.limit?.toFixed(2)}`);
    lines.push(`  Used:      $${status.used.toFixed(2)}`);
    lines.push(`  Remaining: $${status.remaining?.toFixed(2)}`);
    lines.push(`  Progress:  ${status.percentageUsed?.toFixed(1)}%`);

    if (status.percentageUsed && status.percentageUsed >= 90) {
      lines.push("");
      lines.push("⚠️ Warning: Budget is almost exhausted!");
    }
  } else {
    lines.push(`No budget limit configured.`);
    lines.push(`Total spent: $${status.used.toFixed(2)}`);
  }

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}
