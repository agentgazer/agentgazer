import { useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { usePolling } from "../hooks/usePolling";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";
import StatusBadge from "../components/StatusBadge";

interface Agent {
  agent_id: string;
  status: string;
  last_heartbeat: string;
  total_events: number;
}

interface AgentsResponse {
  agents: Agent[];
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function OverviewPage() {
  const fetcher = useCallback(() => api.get<AgentsResponse>("/api/agents"), []);
  const { data, error, loading } = usePolling(fetcher, 3000);

  if (loading && !data) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Overview</h1>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {data && data.agents.length === 0 && (
        <div className="mt-8 rounded-lg border border-gray-700 bg-gray-800 px-6 py-12 text-center">
          <p className="text-gray-400">
            No agents detected yet. Start sending events to see them here.
          </p>
        </div>
      )}

      {data && data.agents.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.agents.map((agent) => (
            <Link
              key={agent.agent_id}
              to={`/agents/${encodeURIComponent(agent.agent_id)}`}
              className="rounded-lg border border-gray-700 bg-gray-800 px-5 py-4 transition-colors hover:border-gray-600 hover:bg-gray-750"
            >
              <div className="flex items-start justify-between">
                <h2 className="truncate text-sm font-semibold text-white">
                  {agent.agent_id}
                </h2>
                <StatusBadge status={agent.status} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                <span>
                  Last heartbeat:{" "}
                  <span className="text-gray-300">
                    {relativeTime(agent.last_heartbeat)}
                  </span>
                </span>
                <span>
                  Events:{" "}
                  <span className="text-gray-300">
                    {agent.total_events.toLocaleString()}
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
