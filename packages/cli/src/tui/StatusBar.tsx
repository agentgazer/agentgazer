import React from "react";
import { Box, Text } from "ink";

interface StatusBarProps {
  uptimeSeconds?: number;
  requestsToday?: number;
  costToday?: number;
  serverStatus: "running" | "stopped" | "disconnected";
  proxyStatus: "running" | "stopped";
}

function formatUptime(seconds: number | undefined): string {
  if (seconds == null) return "--";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatNumber(n: number | undefined): string {
  if (n == null) return "--";
  return n.toLocaleString("en-US");
}

function formatCost(n: number | undefined): string {
  if (n == null) return "--";
  return n.toFixed(2);
}

export function StatusBar({
  uptimeSeconds,
  requestsToday,
  costToday,
  serverStatus,
  proxyStatus,
}: StatusBarProps): React.ReactElement {
  const serverColor = serverStatus === "running" ? "green" : serverStatus === "disconnected" ? "red" : "yellow";
  const proxyColor = proxyStatus === "running" ? "green" : "yellow";
  const serverIndicator = serverStatus === "running" ? "\u25CF" : "\u25CB";
  const proxyIndicator = proxyStatus === "running" ? "\u25CF" : "\u25CB";

  return (
    <Box flexDirection="column">
      <Text bold>AgentGazer Overview</Text>
      <Box marginTop={1}>
        <Text>
          Uptime: {formatUptime(uptimeSeconds)} | Requests: {formatNumber(requestsToday)} | Cost: $
          {formatCost(costToday)} |{" "}
        </Text>
        <Text color={serverColor}>Server: {serverIndicator}</Text>
        <Text> | </Text>
        <Text color={proxyColor}>Proxy: {proxyIndicator}</Text>
        {serverStatus === "disconnected" && <Text color="red"> (disconnected)</Text>}
      </Box>
    </Box>
  );
}
