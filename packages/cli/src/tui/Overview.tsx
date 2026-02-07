import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { StatusBar } from "./StatusBar.js";
import { AgentTable } from "./AgentTable.js";
import { EventLog } from "./EventLog.js";
import { HelpOverlay } from "./HelpOverlay.js";
import { apiGet } from "../utils/api.js";

interface OverviewData {
  uptime_seconds: number;
  total_requests_today: number;
  total_cost_today: number;
  server_status: "running" | "stopped";
  proxy_status: "running" | "stopped";
  agents: AgentData[];
  recent_events: EventData[];
}

interface AgentData {
  agent_id: string;
  status: string;
  primary_provider: string;
  recent_calls: number;
  cost_today: number;
  last_activity: string | null;
}

interface EventData {
  timestamp: string;
  agent_id: string;
  provider: string;
  model: string;
  cost: number;
  latency_ms: number;
}

interface OverviewProps {
  port: number;
}

export function Overview({ port }: OverviewProps): React.ReactElement {
  const { exit } = useApp();
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const result = await apiGet<OverviewData>("/api/overview", port);
      setData(result);
      setError(null);
      setLastUpdate(new Date());
    } catch (err: unknown) {
      if (err && typeof err === "object" && "status" in err) {
        const apiErr = err as { status: number; message: string };
        if (apiErr.status === 0) {
          setError("Server not running. Start with 'agentgazer start' first.");
        } else {
          setError(`Error: ${apiErr.message}`);
        }
      } else {
        setError("Connection lost");
      }
    }
  }, [port]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2500);
    return () => clearInterval(interval);
  }, [fetchData]);

  useInput((input, key) => {
    if (input === "q" || input === "Q" || key.escape) {
      exit();
    } else if (input === "r" || input === "R") {
      fetchData();
    } else if (input === "a" || input === "A") {
      setShowActiveOnly((prev) => !prev);
    } else if (input === "?") {
      setShowHelp((prev) => !prev);
    }
  });

  if (showHelp) {
    return <HelpOverlay onClose={() => setShowHelp(false)} />;
  }

  if (error && !data) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="red">
          AgentGazer Overview
        </Text>
        <Box marginTop={1}>
          <Text color="yellow">{error}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press Q or ESC to exit. Waiting for server...</Text>
        </Box>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>AgentGazer Overview</Text>
        <Text dimColor>Loading...</Text>
      </Box>
    );
  }

  const agents = showActiveOnly ? data.agents.filter((a) => a.status === "active") : data.agents;

  return (
    <Box flexDirection="column" padding={1}>
      <StatusBar
        uptimeSeconds={data.uptime_seconds}
        requestsToday={data.total_requests_today}
        costToday={data.total_cost_today}
        serverStatus={error ? "disconnected" : data.server_status}
        proxyStatus={data.proxy_status}
      />

      <Box marginTop={1}>
        <AgentTable agents={agents} />
      </Box>

      <Box marginTop={1}>
        <EventLog events={data.recent_events} />
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          Q/ESC: Exit | R: Refresh | A: Toggle active only{showActiveOnly ? " (on)" : ""} | ?: Help
        </Text>
      </Box>
    </Box>
  );
}
