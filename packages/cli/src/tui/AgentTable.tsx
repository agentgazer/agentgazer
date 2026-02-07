import React from "react";
import { Box, Text } from "ink";

interface AgentData {
  agent_id: string;
  status: string;
  primary_provider: string;
  recent_calls: number;
  cost_today: number;
  last_activity: string | null;
}

interface AgentTableProps {
  agents: AgentData[];
}

function timeAgo(iso: string | null): string {
  if (!iso) return "\u2014";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AgentTable({ agents }: AgentTableProps): React.ReactElement {
  if (!agents || agents.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold>Agents</Text>
        <Text dimColor>No agents yet. Start making LLM calls through the proxy.</Text>
      </Box>
    );
  }

  // Sort by last activity (most recent first)
  const sorted = [...agents].sort((a, b) => {
    if (!a.last_activity) return 1;
    if (!b.last_activity) return -1;
    return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
  });

  return (
    <Box flexDirection="column">
      <Text bold>Agents</Text>
      <Box marginTop={1}>
        <Text dimColor>
          {"Agent".padEnd(16)}
          {"Status".padEnd(10)}
          {"Provider".padEnd(12)}
          {"Calls".padStart(8)}
          {"Cost".padStart(10)}
          {"  Last Activity"}
        </Text>
      </Box>
      {sorted.map((agent) => (
        <Box key={agent.agent_id}>
          <Text>
            {agent.agent_id.slice(0, 15).padEnd(16)}
            <Text color={agent.status === "active" ? "green" : "yellow"}>{agent.status.padEnd(10)}</Text>
            {(agent.primary_provider || "\u2014").padEnd(12)}
            {agent.recent_calls.toLocaleString().padStart(8)}
            {`$${agent.cost_today.toFixed(2)}`.padStart(10)}
            {"  "}
            {timeAgo(agent.last_activity)}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
