import React from "react";
import { Box, Text } from "ink";

interface EventData {
  timestamp: string;
  agent_id: string;
  provider: string;
  model: string;
  cost: number;
  latency_ms: number;
}

interface EventLogProps {
  events: EventData[];
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-US", { hour12: false });
}

export function EventLog({ events }: EventLogProps): React.ReactElement {
  if (!events || events.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold>Recent Events</Text>
        <Text dimColor>Waiting for events...</Text>
      </Box>
    );
  }

  // Show most recent 10 events
  const recent = events.slice(0, 10);

  return (
    <Box flexDirection="column">
      <Text bold>Recent Events</Text>
      <Box marginTop={1}>
        <Text dimColor>
          {"Time".padEnd(10)}
          {"Agent".padEnd(14)}
          {"Provider".padEnd(10)}
          {"Model".padEnd(20)}
          {"Cost".padStart(8)}
          {"Latency".padStart(10)}
        </Text>
      </Box>
      {recent.map((event, index) => (
        <Box key={index}>
          <Text>
            {formatTime(event.timestamp).padEnd(10)}
            {event.agent_id.slice(0, 13).padEnd(14)}
            {event.provider.padEnd(10)}
            {event.model.slice(0, 19).padEnd(20)}
            {`$${event.cost.toFixed(4)}`.padStart(8)}
            {`${event.latency_ms}ms`.padStart(10)}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
