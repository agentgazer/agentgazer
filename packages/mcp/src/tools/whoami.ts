/**
 * whoami MCP tool
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { AgentGazerClient } from "../client.js";

export const whoamiTool: Tool = {
  name: "whoami",
  description: "Get current agent identity and connection status",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

export async function whoamiHandler(
  client: AgentGazerClient
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const info = await client.whoami();

  const lines = [
    `Agent Identity:`,
    `  Agent ID:  ${info.agentId}`,
    `  Endpoint:  ${info.endpoint}`,
    `  Connected: ${info.connected ? "Yes" : "No"}`,
  ];

  if (info.serverVersion) {
    lines.push(`  Server:    AgentGazer ${info.serverVersion}`);
  }

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}
