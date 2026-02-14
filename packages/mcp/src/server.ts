/**
 * MCP Server for AgentGazer cost awareness
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { AgentGazerClient, type AgentGazerClientConfig } from "./client.js";
import { getTokenUsageTool, getTokenUsageHandler } from "./tools/get-token-usage.js";
import { getCostTool, getCostHandler } from "./tools/get-cost.js";
import { getBudgetStatusTool, getBudgetStatusHandler } from "./tools/get-budget-status.js";
import { estimateCostTool, estimateCostHandler } from "./tools/estimate-cost.js";
import { whoamiTool, whoamiHandler } from "./tools/whoami.js";

export interface McpServerConfig extends AgentGazerClientConfig {}

export async function createMcpServer(config: McpServerConfig): Promise<Server> {
  const client = new AgentGazerClient(config);

  // Health check on startup
  const health = await client.healthCheck();
  if (!health.ok) {
    console.error(`[agentgazer-mcp] Warning: Cannot connect to AgentGazer at ${config.endpoint}`);
  } else {
    console.error(`[agentgazer-mcp] Connected to AgentGazer ${health.version || ""} at ${config.endpoint}`);
  }

  const server = new Server(
    {
      name: "agentgazer-mcp",
      version: "0.5.5",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        getTokenUsageTool,
        getCostTool,
        getBudgetStatusTool,
        estimateCostTool,
        whoamiTool,
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "get_token_usage":
          return await getTokenUsageHandler(client, args);
        case "get_cost":
          return await getCostHandler(client, args);
        case "get_budget_status":
          return await getBudgetStatusHandler(client);
        case "estimate_cost":
          return await estimateCostHandler(client, args);
        case "whoami":
          return await whoamiHandler(client);
        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

export async function runMcpServer(config: McpServerConfig): Promise<void> {
  const server = await createMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Keep the server running
  console.error("[agentgazer-mcp] Server running on stdio");
}
