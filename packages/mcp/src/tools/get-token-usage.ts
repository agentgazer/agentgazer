/**
 * get_token_usage MCP tool
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { AgentGazerClient } from "../client.js";

export const getTokenUsageTool: Tool = {
  name: "get_token_usage",
  description: "Query token usage (input/output tokens) for the current agent",
  inputSchema: {
    type: "object",
    properties: {
      period: {
        type: "string",
        description: "Time period filter (e.g., 'today', '7d', '30d')",
      },
      model: {
        type: "string",
        description: "Filter by specific model name",
      },
    },
  },
};

interface GetTokenUsageArgs {
  period?: string;
  model?: string;
}

export async function getTokenUsageHandler(
  client: AgentGazerClient,
  args?: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const params = (args || {}) as GetTokenUsageArgs;

  const usage = await client.getTokenUsage({
    period: params.period,
    model: params.model,
  });

  const text = [
    `Token Usage:`,
    `  Input tokens:  ${usage.inputTokens.toLocaleString()}`,
    `  Output tokens: ${usage.outputTokens.toLocaleString()}`,
    `  Total tokens:  ${usage.totalTokens.toLocaleString()}`,
  ].join("\n");

  return {
    content: [{ type: "text", text }],
  };
}
