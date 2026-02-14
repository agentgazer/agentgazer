/**
 * estimate_cost MCP tool
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { AgentGazerClient } from "../client.js";

export const estimateCostTool: Tool = {
  name: "estimate_cost",
  description: "Estimate cost for a given model and token count",
  inputSchema: {
    type: "object",
    properties: {
      model: {
        type: "string",
        description: "Model name (e.g., 'claude-opus-4-5-20251101', 'gpt-4o')",
      },
      input_tokens: {
        type: "number",
        description: "Estimated input token count",
      },
      output_tokens: {
        type: "number",
        description: "Estimated output token count",
      },
    },
    required: ["model", "input_tokens", "output_tokens"],
  },
};

interface EstimateCostArgs {
  model: string;
  input_tokens: number;
  output_tokens: number;
}

export async function estimateCostHandler(
  client: AgentGazerClient,
  args?: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const params = args as EstimateCostArgs;

  if (!params?.model || params.input_tokens === undefined || params.output_tokens === undefined) {
    return {
      content: [{ type: "text", text: "Error: model, input_tokens, and output_tokens are required" }],
    };
  }

  const result = await client.estimateCost({
    model: params.model,
    inputTokens: params.input_tokens,
    outputTokens: params.output_tokens,
  });

  const lines = [
    `Cost Estimate:`,
    `  Model:         ${result.model}`,
    `  Input tokens:  ${params.input_tokens.toLocaleString()}`,
    `  Output tokens: ${params.output_tokens.toLocaleString()}`,
    `  Estimated:     $${result.estimatedCost.toFixed(4)} ${result.currency}`,
  ];

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}
