import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { usePolling } from "../hooks/usePolling";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorBanner from "../components/ErrorBanner";

interface Agent {
  agent_id: string;
  status: string;
  last_heartbeat: string;
}

interface AgentsResponse {
  agents: Agent[];
}

interface StatsResponse {
  total_requests: number;
  total_cost: number;
  total_tokens: number;
}

interface AgentCost {
  agent_id: string;
  total_cost: number;
  total_requests: number;
}

interface CostsData {
  agent_costs: AgentCost[];
  grand_total: number;
  grand_requests: number;
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

async function fetchCostsData(): Promise<CostsData> {
  const { agents } = await api.get<AgentsResponse>("/api/agents");
  const top = agents.slice(0, 10);

  const results = await Promise.allSettled(
    top.map((a) =>
      api.get<StatsResponse>(
        `/api/stats/${encodeURIComponent(a.agent_id)}?range=30d`,
      ),
    ),
  );

  const agent_costs: AgentCost[] = [];
  let grand_total = 0;
  let grand_requests = 0;

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      const stats = result.value;
      agent_costs.push({
        agent_id: top[i].agent_id,
        total_cost: stats.total_cost,
        total_requests: stats.total_requests,
      });
      grand_total += stats.total_cost;
      grand_requests += stats.total_requests;
    } else {
      agent_costs.push({
        agent_id: top[i].agent_id,
        total_cost: 0,
        total_requests: 0,
      });
    }
  });

  // Sort by cost descending
  agent_costs.sort((a, b) => b.total_cost - a.total_cost);

  return { agent_costs, grand_total, grand_requests };
}

export default function CostsPage() {
  const fetcher = useCallback(() => fetchCostsData(), []);
  const { data, error, loading } = usePolling(fetcher, 10000);

  const sortedCosts = useMemo(() => data?.agent_costs ?? [], [data]);

  if (loading && !data) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Costs</h1>
      <p className="mt-1 text-sm text-gray-400">Last 30 days</p>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
              <p className="text-xs text-gray-400">Total Cost (30d)</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {formatCost(data.grand_total)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
              <p className="text-xs text-gray-400">Total Requests (30d)</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {formatNumber(data.grand_requests)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
              <p className="text-xs text-gray-400">Agents Tracked</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {data.agent_costs.length}
              </p>
            </div>
          </div>

          {/* Per-agent table */}
          {sortedCosts.length > 0 && (
            <div className="mt-8 overflow-hidden rounded-lg border border-gray-700">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-800 text-xs uppercase text-gray-400">
                    <th className="px-4 py-3 font-medium">Agent ID</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Total Cost
                    </th>
                    <th className="px-4 py-3 font-medium text-right">
                      Requests
                    </th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {sortedCosts.map((row) => (
                    <tr
                      key={row.agent_id}
                      className="bg-gray-900 transition-colors hover:bg-gray-800"
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        {row.agent_id}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {formatCost(row.total_cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {formatNumber(row.total_requests)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/agents/${encodeURIComponent(row.agent_id)}`}
                          className="text-sm font-medium text-blue-400 hover:text-blue-300"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sortedCosts.length === 0 && (
            <div className="mt-8 rounded-lg border border-gray-700 bg-gray-800 px-6 py-12 text-center">
              <p className="text-gray-400">No cost data available.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
