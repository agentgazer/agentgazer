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

export default function AgentsPage() {
  const fetcher = useCallback(() => api.get<AgentsResponse>("/api/agents"), []);
  const { data, error, loading } = usePolling(fetcher, 3000);

  if (loading && !data) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Agents</h1>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {data && data.agents.length === 0 && (
        <div className="mt-8 rounded-lg border border-gray-700 bg-gray-800 px-6 py-12 text-center">
          <p className="text-gray-400">No agents found.</p>
        </div>
      )}

      {data && data.agents.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-700">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-800 text-xs uppercase text-gray-400">
                <th className="px-4 py-3 font-medium">Agent ID</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last Heartbeat</th>
                <th className="px-4 py-3 font-medium text-right">Total Events</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {data.agents.map((agent) => (
                <tr
                  key={agent.agent_id}
                  className="bg-gray-900 transition-colors hover:bg-gray-800"
                >
                  <td className="px-4 py-3 font-medium text-white">
                    {agent.agent_id}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={agent.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {relativeTime(agent.last_heartbeat)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {agent.total_events.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/agents/${encodeURIComponent(agent.agent_id)}`}
                      className="text-sm font-medium text-blue-400 hover:text-blue-300"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
