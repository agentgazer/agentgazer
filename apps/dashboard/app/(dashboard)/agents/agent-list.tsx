"use client";

import Link from "next/link";
import { useRealtimeAgents } from "@/hooks/use-realtime";
import { computeHealth, relativeTime } from "@/lib/format";

interface Agent {
  id: string;
  agent_id: string;
  name: string | null;
  status: string;
  last_heartbeat_at: string | null;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; dotClass: string }> = {
  healthy: { label: "Healthy", dotClass: "bg-green-500" },
  degraded: { label: "Degraded", dotClass: "bg-yellow-500" },
  down: { label: "Down", dotClass: "bg-red-500" },
  unknown: { label: "Unknown", dotClass: "bg-gray-500" },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${config.dotClass}`}
      />
      {config.label}
    </span>
  );
}

export function AgentList({ initialAgents }: { initialAgents: Agent[] }) {
  const agents = useRealtimeAgents(initialAgents);

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <h2 className="mb-2 text-xl font-semibold text-white">
          No agents yet
        </h2>
        <p className="mb-6 max-w-md text-center text-gray-400">
          Agents appear here automatically once they start sending events.
          Install the AgentWatch SDK in your agent and configure your API key to
          get started.
        </p>
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <code className="text-sm text-green-400">
            npm install @agentwatch/sdk
          </code>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => {
        const health = computeHealth(agent.last_heartbeat_at);
        return (
          <Link
            key={agent.id}
            href={`/agents/${agent.agent_id}`}
            className="block rounded-lg border border-gray-700 bg-gray-800 p-6 transition-colors hover:border-gray-600"
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="font-medium text-white">
                  {agent.name ?? agent.agent_id}
                </h3>
                <p className="mt-0.5 text-sm text-gray-400">
                  {agent.agent_id}
                </p>
              </div>
              <StatusBadge status={health} />
            </div>
            <p className="text-sm text-gray-500">
              Last heartbeat:{" "}
              <span className="text-gray-300">
                {relativeTime(agent.last_heartbeat_at)}
              </span>
            </p>
          </Link>
        );
      })}
    </div>
  );
}
