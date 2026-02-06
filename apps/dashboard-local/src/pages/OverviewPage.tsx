import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { relativeTime, formatCost } from "../lib/format";
import { usePolling } from "../hooks/usePolling";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";
import Pagination from "../components/Pagination";

interface Agent {
  agent_id: string;
  updated_at: string;
  total_tokens: number;
  total_cost: number;
  today_cost: number;
}

interface AgentsResponse {
  agents: Agent[];
  total?: number;
}

const PAGE_SIZE = 12;

export default function OverviewPage() {
  const [page, setPage] = useState(1);

  const fetcher = useCallback(() => {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String((page - 1) * PAGE_SIZE));
    return api.get<AgentsResponse>(`/api/agents?${params.toString()}`);
  }, [page]);

  const { data, error, loading } = usePolling(fetcher, 3000);

  const totalPages = data?.total != null ? Math.ceil(data.total / PAGE_SIZE) : 1;

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
        <>
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
                  <span className="text-xs text-gray-400">
                    {relativeTime(agent.updated_at)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-gray-500">Tokens</div>
                    <div className="text-gray-300">{agent.total_tokens.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Total Cost</div>
                    <div className="text-gray-300">{formatCost(agent.total_cost)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Today</div>
                    <div className="text-gray-300">{formatCost(agent.today_cost)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
