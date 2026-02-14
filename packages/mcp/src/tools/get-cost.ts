/**
 * get_cost MCP tool
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { AgentGazerClient } from "../client.js";

export const getCostTool: Tool = {
  name: "get_cost",
  description: "Query spending in USD for the current agent",
  inputSchema: {
    type: "object",
    properties: {
      period: {
        type: "string",
        description: "Time period filter (e.g., 'today', '7d', '30d')",
      },
      breakdown: {
        type: "boolean",
        description: "Include cost breakdown by model",
      },
    },
  },
};

interface GetCostArgs {
  period?: string;
  breakdown?: boolean;
}

export async function getCostHandler(
  client: AgentGazerClient,
  args?: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const params = (args || {}) as GetCostArgs;

  const cost = await client.getCost({
    period: params.period,
    breakdown: params.breakdown,
  });

  const lines = [
    `Cost: $${cost.totalCost.toFixed(4)} ${cost.currency}`,
  ];

  if (cost.breakdown && cost.breakdown.length > 0) {
    lines.push("");
    lines.push("Breakdown by model:");
    for (const item of cost.breakdown) {
      lines.push(`  ${item.model}: $${item.cost.toFixed(4)}`);
    }
  }

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}
